import { drawAssignments, type Rng } from './draw';
import { randomId, shortId, type IdGenerator } from './ids';
import type {
  EventDetails,
  GiftEvent,
  Participant,
  ParticipantId,
  ParticipantInput,
} from './types';
import { cleanEmail, cleanName, participantsMissingEmail, validateParticipant } from './validation';

/** Operações puras sobre um evento. Devolvem sempre um novo objeto. */

export interface Clock {
  now(): string;
}
export const systemClock: Clock = { now: () => new Date().toISOString() };

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function createEvent(
  details: EventDetails,
  opts: { id?: IdGenerator; clock?: Clock; ownerId?: string | null } = {},
): GiftEvent {
  const now = (opts.clock ?? systemClock).now();
  return {
    id: (opts.id ?? randomId)(),
    name: cleanName(details.name),
    budgetCents: details.budgetCents,
    minBudgetCents: details.minBudgetCents,
    exchangeDate: details.exchangeDate,
    participants: [],
    exclusions: [],
    draw: null,
    ownerId: opts.ownerId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

const touch = (e: GiftEvent, clock: Clock, patch: Partial<GiftEvent>): GiftEvent => ({
  ...e,
  ...patch,
  updatedAt: clock.now(),
});

export function updateDetails(
  e: GiftEvent,
  details: EventDetails,
  clock: Clock = systemClock,
): GiftEvent {
  return touch(e, clock, { ...details, name: cleanName(details.name) });
}

/** Alterar participantes invalida o sorteio existente. */
function assertParticipant(input: ParticipantInput, e: GiftEvent, ignoreId?: ParticipantId) {
  const errors = validateParticipant(input, e.participants, ignoreId);
  const first = errors.name ?? errors.email;
  if (first) throw new DomainError(first);
}

export function addParticipant(
  e: GiftEvent,
  input: ParticipantInput,
  opts: { id?: IdGenerator; clock?: Clock } = {},
): GiftEvent {
  assertParticipant(input, e);
  const p: Participant = {
    id: (opts.id ?? randomId)(),
    name: cleanName(input.name),
    email: cleanEmail(input.email),
  };
  return touch(e, opts.clock ?? systemClock, {
    participants: [...e.participants, p],
    draw: null,
  });
}

export function updateParticipant(
  e: GiftEvent,
  id: ParticipantId,
  input: ParticipantInput,
  clock: Clock = systemClock,
): GiftEvent {
  assertParticipant(input, e, id);
  const current = e.participants.find((p) => p.id === id);
  const name = cleanName(input.name);
  const email = cleanEmail(input.email);
  // Mudar o nome invalida o sorteio (os links antigos têm o nome antigo).
  // Mudar só o e-mail (ex.: corrigir um endereço errado) mantém o sorteio.
  const nameChanged = current?.name !== name;
  return touch(e, clock, {
    participants: e.participants.map((p) => (p.id === id ? { ...p, name, email } : p)),
    draw: nameChanged ? null : e.draw,
  });
}

export function removeParticipant(
  e: GiftEvent,
  id: ParticipantId,
  clock: Clock = systemClock,
): GiftEvent {
  return touch(e, clock, {
    participants: e.participants.filter((p) => p.id !== id),
    exclusions: e.exclusions.filter((x) => x.giverId !== id && x.receiverId !== id),
    draw: null,
  });
}

export function runDraw(
  e: GiftEvent,
  opts: { rng?: Rng; id?: IdGenerator; clock?: Clock } = {},
): GiftEvent {
  const clock = opts.clock ?? systemClock;
  const missing = participantsMissingEmail(e);
  if (missing.length > 0) {
    throw new DomainError(`Falta o e-mail de: ${missing.map((p) => p.name).join(', ')}.`);
  }
  const assignments = drawAssignments(e.participants, e.exclusions, opts.rng);
  return touch(e, clock, {
    draw: { id: (opts.id ?? shortId)(), createdAt: clock.now(), assignments },
  });
}

export function participantById(e: GiftEvent, id: ParticipantId): Participant | undefined {
  return e.participants.find((p) => p.id === id);
}

/**
 * Completa eventos guardados por versões antigas da app
 * (sem e-mail nos participantes nem valor mínimo).
 */
export function normalizeEvent(e: GiftEvent): GiftEvent {
  return {
    ...e,
    minBudgetCents: e.minBudgetCents ?? null,
    exclusions: e.exclusions ?? [],
    participants: (e.participants ?? []).map((p) => ({ ...p, email: p.email ?? '' })),
  };
}
