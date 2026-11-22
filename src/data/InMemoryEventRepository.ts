import type { EventId, GiftEvent } from '../domain';
import type { EventRepository } from './EventRepository';

/** Útil em testes e como fallback se o IndexedDB não estiver disponível. */
export class InMemoryEventRepository implements EventRepository {
  private items = new Map<EventId, GiftEvent>();

  constructor(initial: GiftEvent[] = []) {
    for (const e of initial) this.items.set(e.id, structuredClone(e));
  }
  async list() {
    return [...this.items.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((e) => structuredClone(e));
  }
  async get(id: EventId) {
    const e = this.items.get(id);
    return e ? structuredClone(e) : null;
  }
  async save(event: GiftEvent) {
    this.items.set(event.id, structuredClone(event));
  }
  async delete(id: EventId) {
    this.items.delete(id);
  }
}
