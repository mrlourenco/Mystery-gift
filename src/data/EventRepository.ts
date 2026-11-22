import type { EventId, GiftEvent } from '../domain';

/**
 * Fonte de dados dos eventos. Tudo assíncrono, para que a implementação
 * Supabase (Fase 2) entre sem tocar na UI.
 */
export interface EventRepository {
  /** Ordenados por `updatedAt` descendente. */
  list(): Promise<GiftEvent[]>;
  get(id: EventId): Promise<GiftEvent | null>;
  save(event: GiftEvent): Promise<void>;
  delete(id: EventId): Promise<void>;
}
