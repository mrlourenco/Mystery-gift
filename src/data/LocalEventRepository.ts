import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { normalizeEvent, type EventId, type GiftEvent } from '../domain';
import type { EventRepository } from './EventRepository';

interface Schema extends DBSchema {
  events: { key: string; value: GiftEvent; indexes: { byUpdatedAt: string } };
}

const DB_VERSION = 1;

/** Implementação local em IndexedDB (via `idb`). */
export class LocalEventRepository implements EventRepository {
  private db: Promise<IDBPDatabase<Schema>>;

  constructor(dbName = 'amigo-secreto') {
    this.db = openDB<Schema>(dbName, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('byUpdatedAt', 'updatedAt');
      },
    });
  }

  async list(): Promise<GiftEvent[]> {
    const all = await (await this.db).getAllFromIndex('events', 'byUpdatedAt');
    return all.reverse().map(normalizeEvent);
  }

  async get(id: EventId): Promise<GiftEvent | null> {
    const e = await (await this.db).get('events', id);
    return e ? normalizeEvent(e) : null;
  }

  async save(event: GiftEvent): Promise<void> {
    // structuredClone garante que não guardamos referências partilhadas com o estado React.
    await (await this.db).put('events', structuredClone(event));
  }

  async delete(id: EventId): Promise<void> {
    await (await this.db).delete('events', id);
  }

  async close(): Promise<void> {
    (await this.db).close();
  }
}
