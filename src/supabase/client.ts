import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
