export type User =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; id: string; displayName: string | null; isAnonymous: boolean };

export interface AuthService {
  getCurrentUser(): Promise<User>;
  /** Devolve a função para cancelar a subscrição. */
  subscribe(listener: (user: User) => void): () => void;
}
