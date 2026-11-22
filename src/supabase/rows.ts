import type { GiftEvent } from '../domain';

/** Linha da tabela public.events. */
export interface EventRow {
  id: string;
  owner_id: string;
  name: string;
  budget_cents: number;
  exchange_date: string;
  participants: GiftEvent['participants'];
  exclusions: GiftEvent['exclusions'];
  draw: GiftEvent['draw'];
  created_at: string;
  updated_at: string;
}

/** O owner_id não é enviado: a base de dados usa auth.uid() e o RLS valida-o. */
export function toRow(e: GiftEvent): Omit<EventRow, 'owner_id'> {
  return {
    id: e.id,
    name: e.name,
    budget_cents: e.budgetCents,
    exchange_date: e.exchangeDate,
    participants: e.participants,
    exclusions: e.exclusions,
    draw: e.draw,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

export function fromRow(r: EventRow): GiftEvent {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    budgetCents: r.budget_cents,
    exchangeDate: r.exchange_date,
    participants: r.participants ?? [],
    exclusions: r.exclusions ?? [],
    draw: r.draw ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}
