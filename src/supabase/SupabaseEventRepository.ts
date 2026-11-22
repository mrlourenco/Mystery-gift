import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventId, GiftEvent } from '../domain';
import type { EventRepository } from '../data/EventRepository';
import { fromRow, toRow, type EventRow } from './rows';

export class SupabaseEventRepository implements EventRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    /** Garante sessão (login anónimo) antes de cada operação. */
    private readonly ensureSession: () => Promise<unknown>,
  ) {}

  async list(): Promise<GiftEvent[]> {
    await this.ensureSession();
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as EventRow[]).map(fromRow);
  }

  async get(id: EventId): Promise<GiftEvent | null> {
    await this.ensureSession();
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as EventRow) : null;
  }

  async save(event: GiftEvent): Promise<void> {
    await this.ensureSession();
    const { error } = await this.supabase.from('events').upsert(toRow(event));
    if (error) throw error;
  }

  async delete(id: EventId): Promise<void> {
    await this.ensureSession();
    const { error } = await this.supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  }
}
