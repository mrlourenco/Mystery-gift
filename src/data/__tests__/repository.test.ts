import { describe, expect, it } from 'vitest';
import { addParticipant, createEvent, runDraw, type GiftEvent } from '../../domain';
import { InMemoryEventRepository, LocalEventRepository, type EventRepository } from '..';

let dbCount = 0;
const impls: [string, () => EventRepository][] = [
  ['LocalEventRepository', () => new LocalEventRepository(`test-${dbCount++}`)],
  ['InMemoryEventRepository', () => new InMemoryEventRepository()],
];

const make = (name: string, updatedAt: string): GiftEvent => ({
  ...createEvent({ name, budgetCents: 1000, exchangeDate: '2026-12-24' }),
  updatedAt,
});

describe.each(impls)('%s', (_, factory) => {
  it('guarda, lê, lista e apaga', async () => {
    const repo = factory();
    let a = make('A', '2026-01-01T00:00:00Z');
    for (const n of ['Ana', 'Rui', 'Eva']) a = addParticipant(a, n);
    a = { ...runDraw(a), updatedAt: '2026-01-01T00:00:00Z' };
    const b = make('B', '2026-02-01T00:00:00Z');
    await repo.save(a);
    await repo.save(b);

    expect(await repo.get(a.id)).toEqual(a);
    expect(await repo.get('nao-existe')).toBeNull();
    expect((await repo.list()).map((e) => e.name)).toEqual(['B', 'A']);

    await repo.save({ ...a, name: 'A2', updatedAt: '2026-03-01T00:00:00Z' });
    expect((await repo.list()).map((e) => e.name)).toEqual(['A2', 'B']);

    await repo.delete(b.id);
    expect(await repo.list()).toHaveLength(1);
  });

  it('não partilha referências com o chamador', async () => {
    const repo = factory();
    const e = make('X', '2026-01-01T00:00:00Z');
    await repo.save(e);
    e.name = 'mutado';
    expect((await repo.get(e.id))!.name).toBe('X');
  });
});
