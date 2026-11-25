import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Schema próprio, para poder partilhar o projeto Supabase com outras apps. */
export const DB_SCHEMA = 'amigo_secreto';

export function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    db: { schema: DB_SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Chave própria no localStorage, para não colidir com sessões de outra app no mesmo domínio.
      storageKey: 'amigo-secreto-auth',
    },
  }) as unknown as SupabaseClient;
}
