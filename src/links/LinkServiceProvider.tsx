/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { LinkService } from './LinkService';

const Ctx = createContext<LinkService | null>(null);

export function LinkServiceProvider({
  service,
  children,
}: {
  service: LinkService;
  children: ReactNode;
}) {
  return <Ctx.Provider value={service}>{children}</Ctx.Provider>;
}

export function useLinkService(): LinkService {
  const s = useContext(Ctx);
  if (!s) throw new Error('useLinkService tem de estar dentro de <LinkServiceProvider>');
  return s;
}
