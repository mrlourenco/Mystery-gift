import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { CachingEventRepository, InMemoryEventRepository } from '../../data';
import { addParticipant, createEvent, runDraw, type GiftEvent } from '../../domain';
import { encodeReveal } from '../../links';
import { fromRow, toRow } from '../rows';
import { SupabaseAuthService } from '../SupabaseAuthService';
import { SupabaseLinkService } from '../SupabaseLinkService';
import { formatToken, generateToken, normalizeToken, TOKEN_ALPHABET } from '../tokens';

function drawnEvent(): GiftEvent {
  let e = createEvent({ name: 'Natal', budgetCents: 2000, exchangeDate: '2026-12-24' });
  for (const n of ['Ana', 'Rui', 'Eva']) e = addParticipant(e, n);
  return runDraw(e);
}

describe('tokens', () => {
  it('gera 12 caracteres Crockford base32', () => {
    for (let i = 0; i < 200; i++) {
      const t = generateToken();
      expect(t).toHaveLength(12);
      expect([...t].every((c) => TOKEN_ALPHABET.includes(c))).toBe(true);
    }
  });
  it('normaliza o que o utilizador escreve', () => {
    expect(normalizeToken('k7q2-m9xp-4rta')).toBe('K7Q2M9XP4RTA');
    expect(normalizeToken(' K7Q2 M9XP 4RTO ')).toBe('K7Q2M9XP4RT0');
    expect(normalizeToken('abc')).toBeNull();
    expect(formatToken('K7Q2M9XP4RTA')).toBe('K7Q2-M9XP-4RTA');
  });
});

describe('rows', () => {
  it('ida e volta entre GiftEvent e a linha da tabela', () => {
    const e = { ...drawnEvent(), ownerId: 'u1' };
    const row = { ...toRow(e), owner_id: 'u1' };
    expect(row).not.toHaveProperty('ownerId');
    expect(fromRow(row)).toEqual(e);
  });
});

describe('CachingEventRepository', () => {
  const failing = (): InMemoryEventRepository => {
    const r = new InMemoryEventRepository();
    const err = () => Promise.reject(new Error('offline'));
    r.list = err;
    r.get = err;
    r.save = err;
    r.delete = err;
    return r;
  };

  it('lê do remoto e atualiza a cache (incluindo remoções)', async () => {
    const a = drawnEvent();
    const stale = createEvent({ name: 'Velho', budgetCents: 1, exchangeDate: '2026-01-01' });
    const remote = new InMemoryEventRepository([a]);
    const cache = new InMemoryEventRepository([stale]);
    const repo = new CachingEventRepository(remote, cache);
    expect((await repo.list()).map((e) => e.id)).toEqual([a.id]);
    expect((await cache.list()).map((e) => e.id)).toEqual([a.id]);
  });

  it('sem rede, devolve a cache nas leituras e falha nas escritas', async () => {
    const a = drawnEvent();
    const repo = new CachingEventRepository(failing(), new InMemoryEventRepository([a]));
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.get(a.id)).toEqual(a);
    await expect(repo.save(a)).rejects.toThrow('offline');
    await expect(repo.get('x')).rejects.toThrow('offline');
  });
});

/** Fake mínimo do query builder do supabase-js. */
function fakeSupabase(opts: {
  existing?: { token: string; giver_id: string }[];
  rpc?: { data: unknown; error: { message: string } | null };
}) {
  const inserted: unknown[] = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    insert: (rows: unknown[]) => {
      inserted.push(...rows);
      return Promise.resolve({ error: null });
    },
    then: (resolve: (v: unknown) => void) => resolve({ data: opts.existing ?? [], error: null }),
  };
  const client = {
    from: vi.fn(() => builder),
    rpc: vi.fn(async () => opts.rpc ?? { data: [], error: null }),
  } as unknown as SupabaseClient;
  return { client, inserted };
}

describe('SupabaseLinkService', () => {
  const ensure = vi.fn(async () => {});

  it('reutiliza tokens existentes e cria os que faltam', async () => {
    const e = drawnEvent();
    const [p0, p1, p2] = e.participants;
    const { client, inserted } = fakeSupabase({
      existing: [{ token: 'AAAAAAAAAAAA', giver_id: p0!.id }],
    });
    let n = 0;
    const svc = new SupabaseLinkService(client, ensure, undefined, () => `BBBBBBBBBBB${n++}`);
    const codes = await svc.codesFor(e);
    expect(codes.get(p0!.id)).toBe('AAAAAAAAAAAA');
    expect(codes.size).toBe(3);
    expect(inserted).toHaveLength(2);
    expect(inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ giver_id: p1!.id, draw_id: e.draw!.id, event_id: e.id }),
        expect.objectContaining({ giver_id: p2!.id }),
      ]),
    );
    expect(ensure).toHaveBeenCalled();
  });

  const row = {
    event_name: 'Natal',
    budget_cents: 2000,
    exchange_date: '2026-12-24',
    giver_name: 'Ana',
    receiver_name: 'Rui',
    draw_id: 'abcd1234',
    is_current: true,
  };

  it('resolve um token válido', async () => {
    const { client } = fakeSupabase({ rpc: { data: [row], error: null } });
    const r = await new SupabaseLinkService(client, ensure).resolve('aaaa-aaaa-aaaa');
    expect(r).toMatchObject({ status: 'ok', isCurrent: true, data: { receiverName: 'Rui' } });
    expect(client.rpc).toHaveBeenCalledWith('reveal', { p_token: 'AAAAAAAAAAAA' });
  });

  it('indica que o link é de um sorteio antigo', async () => {
    const { client } = fakeSupabase({
      rpc: { data: [{ ...row, is_current: false, receiver_name: null }], error: null },
    });
    expect(await new SupabaseLinkService(client, ensure).resolve('AAAAAAAAAAAA')).toEqual({
      status: 'stale',
      eventName: 'Natal',
      giverName: 'Ana',
    });
  });

  it('token desconhecido → inválido; erro de rede → error', async () => {
    const empty = fakeSupabase({ rpc: { data: [], error: null } }).client;
    expect((await new SupabaseLinkService(empty, ensure).resolve('AAAAAAAAAAAA')).status).toBe(
      'invalid',
    );
    const broken = fakeSupabase({ rpc: { data: null, error: { message: 'x' } } }).client;
    expect((await new SupabaseLinkService(broken, ensure).resolve('AAAAAAAAAAAA')).status).toBe(
      'error',
    );
  });

  it('os links antigos (payload v1) continuam a funcionar', async () => {
    const { client } = fakeSupabase({});
    const code = encodeReveal({
      eventName: 'Natal',
      budgetCents: 2000,
      exchangeDate: '2026-12-24',
      giverName: 'Ana',
      receiverName: 'Rui',
      drawId: 'x',
    });
    const svc = new SupabaseLinkService(client, ensure);
    expect(await svc.resolve(code)).toMatchObject({ status: 'ok' });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(svc.parseInput(`https://x/#/r/${code}`)).toBe(code);
    expect(svc.parseInput('k7q2 m9xp 4rta')).toBe('K7Q2M9XP4RTA');
    expect(svc.displayCode('K7Q2M9XP4RTA')).toBe('K7Q2-M9XP-4RTA');
  });
});

describe('SupabaseAuthService', () => {
  it('faz login anónimo uma única vez, mesmo com chamadas concorrentes', async () => {
    const session = { user: { id: 'u1', is_anonymous: true, user_metadata: {} } };
    let current: unknown = null;
    const signInAnonymously = vi.fn(async () => {
      current = session;
      return { data: { session }, error: null };
    });
    const client = {
      auth: {
        getSession: async () => ({ data: { session: current } }),
        signInAnonymously,
      },
    } as unknown as SupabaseClient;
    const auth = new SupabaseAuthService(client);
    const [a, b] = await Promise.all([auth.ensureSignedIn(), auth.ensureSignedIn()]);
    expect(a).toEqual({ kind: 'authenticated', id: 'u1', displayName: null, isAnonymous: true });
    expect(b).toEqual(a);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    await auth.ensureSignedIn();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
