import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// O FLUXO DE AUTENTICAÇÃO É `implicit` DE PROPÓSITO, NOS DOIS CLIENTES ABAIXO.
//
// O padrão do Supabase é PKCE, e ele quebra a recuperação de senha por e-mail.
// Quem EMITE o token é o cliente do route handler (`action === 'recuperar'` em
// app/api/auth/route.ts), então o formato gravado em `auth.users.recovery_token`
// é decidido aqui — não no cliente do navegador.
//
// Com PKCE, o token gravado é um `pkce_…` de 61 caracteres, enquanto o
// `{{ .Token }}` do e-mail imprime o código de 6 dígitos. O `verifyOtp` compara
// com o valor GRAVADO, então o código correto é recusado como
// `token has expired or is invalid`. Medido em produção: pedido às 21:15:07,
// recusado às 21:15:32, com o token ainda intacto no banco.
//
// O link sofre do mesmo mal por outro caminho: o PKCE exige o `code_verifier`
// guardado no navegador que pediu, que não existe quando o e-mail é aberto no
// celular.
//
// No fluxo implícito o `recovery_token` é o próprio código de 6 dígitos. Se
// alguém "padronizar" isto de volta para PKCE, os dois caminhos voltam a falhar.
const OPCOES_DE_AUTH = { flowType: 'implicit' } as const;

// Server-side Supabase client for Server Components
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    auth: OPCOES_DE_AUTH,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore when middleware refreshes sessions
        }
      },
    },
  });
}

// Route Handler Supabase client
// É ESTE que roda o `resetPasswordForEmail`, ou seja, quem grava o
// `recovery_token`. Ver a nota sobre `implicit` acima.
export async function getRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    auth: OPCOES_DE_AUTH,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

// Service Role client (for admin operations) — never import this from a 'use client' file
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions for common operations
export async function getCurrentUser() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentUserWithWorkspace() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, userData };
}

// Admin-only helper — throws-free redirect is left to the caller (server component/page),
// this just resolves whether the current session belongs to an admin account.
export async function isCurrentUserAdmin() {
  const result = await getCurrentUserWithWorkspace();
  return Boolean(result?.userData?.is_admin);
}

export async function getUserWorkspaceSlug() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('workspace_slug')
    .eq('id', user.id)
    .single();

  return data?.workspace_slug;
}

// RLS-enabled queries
export async function getUserWorkspaceData(userId: string) {
  const supabase = await getServerSupabaseClient();

  const { data: user } = await supabase
    .from('users')
    .select('workspace_id, workspace_slug')
    .eq('id', userId)
    .single();

  return user;
}

export async function getWorkspaceStats(workspaceId: string) {
  const supabase = await getServerSupabaseClient();

  const [orders, customers, products] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, created_at, status')
      .eq('workspace_id', workspaceId),
    supabase
      .from('customers')
      .select('id, created_at')
      .eq('workspace_id', workspaceId),
    supabase
      .from('products')
      .select('id')
      .eq('workspace_id', workspaceId),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentOrders = (orders.data || []).filter((o) => new Date(o.created_at) > thirtyDaysAgo);
  const totalRevenue = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const recentCustomers = (customers.data || []).filter((c) => new Date(c.created_at) > thirtyDaysAgo);

  return {
    total_revenue: totalRevenue,
    total_orders: recentOrders.length,
    new_customers: recentCustomers.length,
    total_products: products.data?.length || 0,
  };
}
