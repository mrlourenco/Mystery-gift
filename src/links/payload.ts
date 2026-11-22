/** Conteúdo de um link pessoal (Fase 1: viaja dentro do próprio link). */
export interface RevealPayloadV1 {
  v: 1;
  /** nome do evento */
  e: string;
  /** orçamento em cêntimos */
  b: number;
  /** data da troca, YYYY-MM-DD */
  d: string;
  /** nome de quem dá (dono do link) */
  g: string;
  /** nome de quem recebe */
  r: string;
  /** id curto do sorteio, para detetar links antigos */
  k: string;
}

export type RevealPayload = RevealPayloadV1;

export interface RevealData {
  eventName: string;
  budgetCents: number;
  exchangeDate: string;
  giverName: string;
  receiverName: string;
  drawId: string;
}

export const toPayload = (d: RevealData): RevealPayloadV1 => ({
  v: 1,
  e: d.eventName,
  b: d.budgetCents,
  d: d.exchangeDate,
  g: d.giverName,
  r: d.receiverName,
  k: d.drawId,
});

export const fromPayload = (p: RevealPayload): RevealData => ({
  eventName: p.e,
  budgetCents: p.b,
  exchangeDate: p.d,
  giverName: p.g,
  receiverName: p.r,
  drawId: p.k,
});

export function isRevealPayload(x: unknown): x is RevealPayload {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.e === 'string' &&
    typeof o.b === 'number' &&
    Number.isFinite(o.b) &&
    typeof o.d === 'string' &&
    typeof o.g === 'string' &&
    typeof o.r === 'string' &&
    typeof o.k === 'string'
  );
}
