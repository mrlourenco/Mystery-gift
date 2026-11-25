import type { SupabaseClient } from '@supabase/supabase-js';
import type { GiftEvent, ParticipantId } from '../domain';
import { extractCode, LocalLinkService, type LinkService, type RevealResult } from '../links';
import { formatToken, generateToken, normalizeToken } from './tokens';

interface RevealRow {
  event_name: string;
  budget_cents: number;
  min_budget_cents: number | null;
  exchange_date: string;
  giver_name: string | null;
  receiver_name: string | null;
  draw_id: string;
  is_current: boolean;
}

/**
 * Links com tokens curtos guardados no Supabase (ex.: K7Q2-M9XP-4RTA).
 * O resultado fica no servidor e só é lido através da função `reveal(token)`.
 * Os links antigos (payload v1) continuam a funcionar através do LocalLinkService.
 */
export class SupabaseLinkService implements LinkService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ensureSession: () => Promise<unknown>,
    private readonly legacy: LinkService = new LocalLinkService(),
    private readonly newToken: () => string = () => generateToken(),
  ) {}

  async codesFor(event: GiftEvent): Promise<Map<ParticipantId, string>> {
    const codes = new Map<ParticipantId, string>();
    const draw = event.draw;
    if (!draw) return codes;
    await this.ensureSession();

    const { data, error } = await this.supabase
      .from('reveal_tokens')
      .select('token, giver_id')
      .eq('event_id', event.id)
      .eq('draw_id', draw.id);
    if (error) throw error;
    for (const row of data as { token: string; giver_id: string }[])
      codes.set(row.giver_id, row.token);

    const missing = draw.assignments.filter((a) => !codes.has(a.giverId));
    if (missing.length > 0) {
      const rows = missing.map((a) => ({
        token: this.newToken(),
        event_id: event.id,
        draw_id: draw.id,
        giver_id: a.giverId,
      }));
      const { error: insErr } = await this.supabase.from('reveal_tokens').insert(rows);
      if (insErr) throw insErr;
      for (const r of rows) codes.set(r.giver_id, r.token);
    }
    return codes;
  }

  displayCode(code: string): string {
    return normalizeToken(code) ? formatToken(code) : code;
  }

  parseInput(input: string): string | null {
    const raw = extractCode(input);
    return normalizeToken(raw) ?? this.legacy.parseInput(input);
  }

  async resolve(code: string): Promise<RevealResult> {
    const token = normalizeToken(code);
    if (!token) return this.legacy.resolve(code);

    const { data, error } = await this.supabase.rpc('reveal', { p_token: token });
    if (error) return { status: 'error', message: error.message };
    const row = (data as RevealRow[] | null)?.[0];
    if (!row || !row.giver_name) return { status: 'invalid' };
    if (!row.is_current || !row.receiver_name) {
      return { status: 'stale', eventName: row.event_name, giverName: row.giver_name };
    }
    return {
      status: 'ok',
      isCurrent: true,
      data: {
        eventName: row.event_name,
        budgetCents: row.budget_cents,
        minBudgetCents: row.min_budget_cents ?? null,
        exchangeDate: row.exchange_date,
        giverName: row.giver_name,
        receiverName: row.receiver_name,
        drawId: row.draw_id,
      },
    };
  }
}
