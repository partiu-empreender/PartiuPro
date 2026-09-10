import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Server-side Supabase client for Server Components
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
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
export async function getRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
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

/**
 * Cliente usado SÓ para emitir o e-mail de recuperação de senha.
 *
 * POR QUE UM CLIENTE SEPARADO, E NÃO O DO ROUTE HANDLER
 *
 * Quem chama `resetPasswordForEmail` decide o formato do que fica gravado em
 * `auth.users.recovery_token`, e é isso que o `verifyOtp` compara depois.
 *
 * O `@supabase/ssr` FORÇA PKCE e não deixa desligar. No createServerClient.js
 * ele monta as opções assim:
 *
 *     auth: { ...options?.auth, flowType: "pkce", ... }
 *
 * O `...options?.auth` vem ANTES, então passar `flowType: 'implicit'` ali é
 * silenciosamente descartado — foi exatamente o que aconteceu na primeira
 * tentativa de correção: o código continuou sendo recusado e o token no banco
 * continuou `pkce_`.
 *
 * Com PKCE o token gravado é um `pkce_…` de 61 caracteres, enquanto o
 * `{{ .Token }}` do e-mail imprime o código de 6 dígitos. Eles nunca casam, e
 * o erro que volta é `token has expired or is invalid` — medido em produção
 * 22 segundos depois do pedido, com o token intacto no banco. A mensagem diz
 * "expirado", mas o que houve foi incompatibilidade de formato.
 *
 * O link falhava pelo mesmo motivo por outro caminho: PKCE exige o
 * `code_verifier` guardado no navegador QUE PEDIU, que não existe quando o
 * e-mail é aberto no celular.
 *
 * `createClient` puro respeita o `flowType`, e no fluxo implícito o
 * `recovery_token` é o próprio código de 6 dígitos. Não guarda sessão porque
 * não precisa: só dispara o e-mail.
 */
export const supabaseRecuperacao = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
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
