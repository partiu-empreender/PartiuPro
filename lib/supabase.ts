import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase client (safe to use in 'use client' components)
//
// POR QUE `implicit` E NÃO O PADRÃO
//
// O supabase-js v2 usa PKCE por padrão, e isso QUEBRA a recuperação de senha
// por e-mail — das duas formas possíveis:
//
// 1. O código digitado. No PKCE, o `resetPasswordForEmail` grava em
//    `auth.users.recovery_token` um valor `pkce_…` de 61 caracteres. Mas o
//    `{{ .Token }}` do e-mail imprime o código de 6 dígitos, e o `verifyOtp`
//    compara com o que está GRAVADO. Nunca casa. Medido em produção: token
//    pedido às 21:15:07, recusado às 21:15:32 com `token has expired or is
//    invalid` — 22 segundos, e o token ainda intacto no banco. O erro diz
//    "expirado", mas o que houve foi incompatibilidade de formato.
//
// 2. O link. O PKCE exige o `code_verifier` que ficou no `localStorage` do
//    navegador QUE PEDIU. Quem abre o e-mail no celular e pediu no
//    computador não tem esse verifier, a troca falha e a tela cai no
//    formulário de código.
//
// No fluxo implícito o `recovery_token` é o próprio código de 6 dígitos, o
// link traz os tokens no fragmento, e nenhum dos dois depende de estado
// guardado no navegador de origem.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'implicit' },
});

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
