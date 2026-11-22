import type { AuthService, User } from './AuthService';

const ANON: User = { kind: 'anonymous' };

/** Fase 1: sem autenticação, devolve sempre "anónimo". */
export class NoAuthService implements AuthService {
  async getCurrentUser(): Promise<User> {
    return ANON;
  }
  subscribe(listener: (user: User) => void): () => void {
    listener(ANON);
    return () => {};
  }
}
