/** v1 (Fase 1): sem valor mínimo. */
export interface RevealPayloadV1 {
  v: 1;
  /** nome do evento */
  e: string;
  /** orçamento máximo em cêntimos */
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

/** v2: acrescenta o valor mínimo (opcional). */
export interface RevealPayloadV2 extends Omit<RevealPayloadV1, 'v'> {
  v: 2;
  /** orçamento mínimo em cêntimos (omitido se não houver) */
  m?: number;
}

export type RevealPayload = RevealPayloadV1 | RevealPayloadV2;

export interface RevealData {
  eventName: string;
  budgetCents: number;
  minBudgetCents: number | null;
  exchangeDate: string;
  giverName: string;
  receiverName: string;
  drawId: string;
}

/** Gera sempre a versão mais recente. */
export const toPayload = (d: RevealData): RevealPayloadV2 => ({
  v: 2,
  e: d.eventName,
  b: d.budgetCents,
  ...(d.minBudgetCents ? { m: d.minBudgetCents } : {}),
  d: d.exchangeDate,
  g: d.giverName,
  r: d.receiverName,
  k: d.drawId,
});

export const fromPayload = (p: RevealPayload): RevealData => ({
  eventName: p.e,
  budgetCents: p.b,
  minBudgetCents: p.v === 2 && typeof p.m === 'number' ? p.m : null,
  exchangeDate: p.d,
  giverName: p.g,
  receiverName: p.r,
  drawId: p.k,
});

export function isRevealPayload(x: unknown): x is RevealPayload {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const common =
    typeof o.e === 'string' &&
    typeof o.b === 'number' &&
    Number.isFinite(o.b) &&
    typeof o.d === 'string' &&
    typeof o.g === 'string' &&
    typeof o.r === 'string' &&
    typeof o.k === 'string';
  if (!common) return false;
  if (o.v === 1) return true;
  if (o.v === 2) return o.m === undefined || (typeof o.m === 'number' && Number.isFinite(o.m));
  return false;
}
