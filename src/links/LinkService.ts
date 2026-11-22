import type { GiftEvent, ParticipantId } from '../domain';
import type { RevealData } from './payload';

export type RevealResult =
  | {
      status: 'ok';
      data: RevealData;
      /** true/false se for possível saber; null se não houver forma de verificar. */
      isCurrent: boolean | null;
    }
  /** O link é de um sorteio que já foi repetido (só o servidor consegue afirmar isto). */
  | { status: 'stale'; eventName: string; giverName: string }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

/** Gera e resolve os códigos dos links pessoais. Fase 1: payload no link; Fase 2: tokens. */
export interface LinkService {
  /** Códigos do sorteio atual, por participante (que dá). */
  codesFor(event: GiftEvent): Promise<Map<ParticipantId, string>>;
  /** Versão do código para mostrar/copiar (pode ter hífenes). */
  displayCode(code: string): string;
  /** Interpreta o que o utilizador colou (código ou link). null se não for reconhecível. */
  parseInput(input: string): string | null;
  resolve(code: string): Promise<RevealResult>;
}

export const revealPath = (code: string) => `/r/${code}`;

export function buildRevealUrl(code: string, baseUrl: string): string {
  return `${baseUrl.split('#')[0]!}#${revealPath(code)}`;
}

/** Extrai o código de um link completo (…#/r/<código>) ou devolve o texto limpo. */
export function extractCode(input: string): string {
  const s = input.trim();
  const m = s.match(/#\/r\/([A-Za-z0-9_-]+)/);
  if (m) return m[1]!;
  return s.replace(/\s+/g, '');
}
