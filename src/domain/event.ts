import { drawAssignments, type Rng } from './draw';
import { randomId, shortId, type IdGenerator } from './ids';
import type { EventDetails, GiftEvent, Participant, ParticipantId } from './types';
import { cleanName, validateParticipantName } from './validation';

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
export function addParticipant(
  e: GiftEvent,
  name: string,
  opts: { id?: IdGenerator; clock?: Clock } = {},
): GiftEvent {
  const v = validateParticipantName(name, e.participants);
  if (!v.ok) throw new DomainError(v.error);
  const p: Participant = { id: (opts.id ?? randomId)(), name: cleanName(name) };
  return touch(e, opts.clock ?? systemClock, {
    participants: [...e.participants, p],
    draw: null,
  });
}

export function renameParticipant(
  e: GiftEvent,
  id: ParticipantId,
  name: string,
  clock: Clock = systemClock,
): GiftEvent {
  const v = validateParticipantName(name, e.participants, id);
  if (!v.ok) throw new DomainError(v.error);
  // Renomear não altera os pares, mas os links antigos têm o nome antigo → invalida.
  return touch(e, clock, {
    participants: e.participants.map((p) => (p.id === id ? { ...p, name: cleanName(name) } : p)),
    draw: null,
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
  const assignments = drawAssignments(e.participants, e.exclusions, opts.rng);
  return touch(e, clock, {
    draw: { id: (opts.id ?? shortId)(), createdAt: clock.now(), assignments },
  });
}

export function participantById(e: GiftEvent, id: ParticipantId): Participant | undefined {
  return e.participants.find((p) => p.id === id);
}
