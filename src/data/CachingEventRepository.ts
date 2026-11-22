import type { EventId, GiftEvent } from '../domain';
import type { EventRepository } from './EventRepository';

/**
 * O remoto é a fonte de verdade; o local é uma cópia para funcionar offline em leitura.
 * - Leituras: tenta o remoto e atualiza a cópia local; se falhar, devolve a cópia local.
 * - Escritas: vão ao remoto (falham sem rede) e só depois à cópia local.
 */
export class CachingEventRepository implements EventRepository {
  constructor(
    private readonly remote: EventRepository,
    private readonly cache: EventRepository,
  ) {}

  async list(): Promise<GiftEvent[]> {
    try {
      const events = await this.remote.list();
      // Substitui a cache pelo estado do servidor.
      const cached = await this.cache.list();
      const ids = new Set(events.map((e) => e.id));
      await Promise.all([
        ...cached.filter((e) => !ids.has(e.id)).map((e) => this.cache.delete(e.id)),
        ...events.map((e) => this.cache.save(e)),
      ]);
      return events;
    } catch (err) {
      const cached = await this.cache.list();
      if (cached.length === 0) throw err;
      return cached;
    }
  }

  async get(id: EventId): Promise<GiftEvent | null> {
    try {
      const e = await this.remote.get(id);
      if (e) await this.cache.save(e);
      else await this.cache.delete(id);
      return e;
    } catch (err) {
      const cached = await this.cache.get(id);
      if (!cached) throw err;
      return cached;
    }
  }

  async save(event: GiftEvent): Promise<void> {
    await this.remote.save(event);
    await this.cache.save(event);
  }

  async delete(id: EventId): Promise<void> {
    await this.remote.delete(id);
    await this.cache.delete(id);
  }
}
