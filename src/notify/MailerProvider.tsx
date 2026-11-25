/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { DrawMailer } from './DrawMailer';

const Ctx = createContext<DrawMailer | null>(null);

export function MailerProvider({
  mailer,
  children,
}: {
  mailer: DrawMailer | null;
  children: ReactNode;
}) {
  return <Ctx.Provider value={mailer}>{children}</Ctx.Provider>;
}

/** null quando não há servidor de e-mail (modo local): a UI usa mailto:. */
export function useMailer(): DrawMailer | null {
  return useContext(Ctx);
}
