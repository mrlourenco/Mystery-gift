import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthService, User } from './AuthService';

interface AuthState {
  service: AuthService;
  user: User | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => service.subscribe(setUser), [service]);
  return <AuthContext.Provider value={{ service, user }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tem de estar dentro de <AuthProvider>');
  return ctx;
}
