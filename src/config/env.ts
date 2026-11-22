/** Configuração lida de import.meta.env. Os valores do Supabase ainda não são usados. */
export interface AppConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const config: AppConfig = {
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
};

export const isSupabaseConfigured = (c: AppConfig = config) =>
  c.supabaseUrl !== null && c.supabaseAnonKey !== null;
