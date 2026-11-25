/** Configuração lida de import.meta.env. Sem as variáveis do Supabase, a app funciona só em local. */
export interface AppConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  /** Envio automático de e-mails (Edge Function + Resend). Ligar só depois de publicar a função. */
  emailEnabled: boolean;
}

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const config: AppConfig = {
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  emailEnabled: import.meta.env.VITE_EMAIL_ENABLED === 'true',
};

export const isSupabaseConfigured = (c: AppConfig = config) =>
  c.supabaseUrl !== null && c.supabaseAnonKey !== null;
