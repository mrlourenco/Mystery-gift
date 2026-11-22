import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthService, User } from '../auth/AuthService';

export function sessionToUser(session: Session | null): User {
  if (!session) return { kind: 'anonymous' };
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === 'string' ? meta.full_name : null;
  return {
    kind: 'authenticated',
    id: u.id,
    displayName: name,
    isAnonymous: u.is_anonymous ?? false,
  };
}

/**
 * Autenticação via Supabase. Usa login anónimo: cada dispositivo recebe um uid, o que
 * chega para o RLS. Mais tarde, a conta anónima pode ser ligada a um fornecedor OAuth
 * (`supabase.auth.linkIdentity`) sem perder os eventos.
 */
export class SupabaseAuthService implements AuthService {
  private signingIn: Promise<User> | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  async getCurrentUser(): Promise<User> {
    const { data } = await this.supabase.auth.getSession();
    return sessionToUser(data.session);
  }

  ensureSignedIn(): Promise<User> {
    // Partilha a mesma promessa entre chamadas concorrentes (evita criar 2 utilizadores).
    this.signingIn ??= (async () => {
      const current = await this.getCurrentUser();
      if (current.kind === 'authenticated') return current;
      const { data, error } = await this.supabase.auth.signInAnonymously();
      if (error) throw error;
      return sessionToUser(data.session);
    })().finally(() => {
      this.signingIn = null;
    });
    return this.signingIn;
  }

  subscribe(listener: (user: User) => void): () => void {
    void this.getCurrentUser().then(listener);
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) =>
      listener(sessionToUser(session)),
    );
    return () => data.subscription.unsubscribe();
  }
}
