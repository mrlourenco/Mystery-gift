export type EventId = string;
export type ParticipantId = string;
export type DrawId = string;

export interface Participant {
  id: ParticipantId;
  /** Nome tal como foi escrito (com trim). A unicidade usa `normalizeName`. */
  name: string;
}

/** Exclusão direcional: `giverId` não pode tirar `receiverId`. Um casal = 2 exclusões. */
export interface Exclusion {
  giverId: ParticipantId;
  receiverId: ParticipantId;
}

export interface Assignment {
  giverId: ParticipantId;
  receiverId: ParticipantId;
}

export interface Draw {
  /** Muda a cada repetição, para detetar links de sorteios antigos. */
  id: DrawId;
  /** ISO 8601 */
  createdAt: string;
  assignments: Assignment[];
}

/** "GiftEvent" para não colidir com o `Event` do DOM. */
export interface GiftEvent {
  id: EventId;
  name: string;
  /** Inteiro em cêntimos. */
  budgetCents: number;
  /** 'YYYY-MM-DD' */
  exchangeDate: string;
  participants: Participant[];
  /** Vazio na Fase 1. */
  exclusions: Exclusion[];
  draw: Draw | null;
  /** null enquanto não houver autenticação. */
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetails {
  name: string;
  budgetCents: number;
  exchangeDate: string;
}
