import type { EventDetails, Participant, ParticipantId } from './types';

export const MAX_EVENT_NAME = 80;
export const MAX_PARTICIPANT_NAME = 50;
export const MAX_BUDGET_CENTS = 100_000_00;

/** Normaliza para comparar nomes: ignora maiúsculas, acentos e espaços a mais. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-PT');
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export type ValidationResult = { ok: true } | { ok: false; error: string };
const ok: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

export function validateParticipantName(
  name: string,
  existing: readonly Participant[],
  ignoreId?: ParticipantId,
): ValidationResult {
  const clean = cleanName(name);
  if (!clean) return fail('Escreve um nome.');
  if (clean.length > MAX_PARTICIPANT_NAME)
    return fail(`O nome pode ter no máximo ${MAX_PARTICIPANT_NAME} caracteres.`);
  const key = normalizeName(clean);
  const dup = existing.some((p) => p.id !== ignoreId && normalizeName(p.name) === key);
  if (dup) return fail(`Já existe um participante chamado "${clean}".`);
  return ok;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type EventDetailsErrors = Partial<Record<keyof EventDetails, string>>;

export function validateEventDetails(details: EventDetails): EventDetailsErrors {
  const errors: EventDetailsErrors = {};
  const name = cleanName(details.name);
  if (!name) errors.name = 'Dá um nome ao evento.';
  else if (name.length > MAX_EVENT_NAME)
    errors.name = `O nome pode ter no máximo ${MAX_EVENT_NAME} caracteres.`;

  if (!Number.isInteger(details.budgetCents) || details.budgetCents <= 0)
    errors.budgetCents = 'Indica um orçamento maior que 0 €.';
  else if (details.budgetCents > MAX_BUDGET_CENTS) errors.budgetCents = 'Orçamento demasiado alto.';

  if (!isValidIsoDate(details.exchangeDate)) errors.exchangeDate = 'Escolhe uma data válida.';
  return errors;
}

/** "25", "25,5", "25.50", "1 000,00" → cêntimos. null se inválido. */
export function parseEuros(input: string): number | null {
  const s = input.replace(/[\s€]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.split(/[.,]/) as [string, string?];
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
