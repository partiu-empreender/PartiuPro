import { createClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client for Server Components
export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerComponentClient({ cookies: () => cookieStore });
}

// Route Handler Supabase client
export async function getRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

// Service Role client (for admin operations)
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

// Cache helpers
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}
