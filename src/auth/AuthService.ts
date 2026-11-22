export type User =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; id: string; displayName: string | null; isAnonymous: boolean };

export interface AuthService {
  getCurrentUser(): Promise<User>;
  /** Garante uma sessão (ex.: login anónimo no Supabase) antes de aceder a dados privados. */
  ensureSignedIn(): Promise<User>;
  /** Devolve a função para cancelar a subscrição. */
  subscribe(listener: (user: User) => void): () => void;
}
