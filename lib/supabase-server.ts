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
