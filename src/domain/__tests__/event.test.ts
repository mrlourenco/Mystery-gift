import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  createEvent,
  DomainError,
  removeParticipant,
  updateParticipant,
  normalizeEvent,
  runDraw,
  type GiftEvent,
} from '..';

let n = 0;
const id = () => `id${n++}`;
const clock = { now: () => '2026-11-22T10:00:00.000Z' };
const person = (name: string) => ({ name, email: `${name.toLowerCase()}@x.pt` });

function withPeople(names: string[]): GiftEvent {
  let e = createEvent(
    { name: 'Natal', budgetCents: 2000, minBudgetCents: null, exchangeDate: '2026-12-24' },
    { id, clock },
  );
  for (const name of names) e = addParticipant(e, person(name), { id, clock });
  return e;
}

describe('operações do evento', () => {
  it('adiciona participantes e rejeita duplicados', () => {
    const e = withPeople(['Ana', 'Rui']);
    expect(e.participants.map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect(() => addParticipant(e, { name: ' ana ', email: 'outra@x.pt' })).toThrow(DomainError);
    expect(() => addParticipant(e, { name: 'Eva', email: 'ANA@x.pt' })).toThrow(DomainError);
    expect(() => addParticipant(e, { name: 'Eva', email: '' })).toThrow(DomainError);
    expect(addParticipant(e, { name: 'Eva', email: ' Eva@X.pt ' }).participants[2]!.email).toBe(
      'eva@x.pt',
    );
  });

  it('edita e remove', () => {
    let e = withPeople(['Ana', 'Rui', 'Eva']);
    const rui = e.participants[1]!;
    e = updateParticipant(e, rui.id, { name: 'Rúben', email: 'ruben@x.pt' }, clock);
    expect(e.participants[1]).toMatchObject({ name: 'Rúben', email: 'ruben@x.pt' });
    expect(() => updateParticipant(e, rui.id, person('EVA'), clock)).toThrow(DomainError);
    e = removeParticipant(e, rui.id, clock);
    expect(e.participants).toHaveLength(2);
  });

  it('sorteia e invalida o sorteio quando os participantes mudam', () => {
    let e = withPeople(['Ana', 'Rui', 'Eva']);
    e = runDraw(e, { clock });
    expect(e.draw?.assignments).toHaveLength(3);
    expect(e.draw?.id).toHaveLength(8);
    expect(addParticipant(e, person('Zé'), { clock }).draw).toBeNull();
    expect(removeParticipant(e, e.participants[0]!.id, clock).draw).toBeNull();
  });

  it('corrigir só o e-mail mantém o sorteio; mudar o nome apaga-o', () => {
    const e = runDraw(withPeople(['Ana', 'Rui', 'Eva']), { clock });
    const ana = e.participants[0]!;
    expect(updateParticipant(e, ana.id, { name: 'Ana', email: 'nova@x.pt' }, clock).draw).toEqual(
      e.draw,
    );
    expect(
      updateParticipant(e, ana.id, { name: 'Anita', email: 'ana@x.pt' }, clock).draw,
    ).toBeNull();
  });

  it('não sorteia se faltar o e-mail de alguém (eventos antigos)', () => {
    const old = normalizeEvent({
      ...withPeople(['Ana', 'Rui', 'Eva']),
      minBudgetCents: undefined as unknown as null,
      participants: [
        { id: 'a', name: 'Ana' },
        { id: 'b', name: 'Rui', email: 'rui@x.pt' },
        { id: 'c', name: 'Eva' },
      ] as never,
    });
    expect(old.minBudgetCents).toBeNull();
    expect(old.participants[0]!.email).toBe('');
    expect(() => runDraw(old)).toThrow('Falta o e-mail de: Ana, Eva.');
  });

  it('repetir o sorteio gera um novo drawId', () => {
    const e = runDraw(withPeople(['Ana', 'Rui', 'Eva']));
    expect(runDraw(e).draw!.id).not.toBe(e.draw!.id);
  });
});
