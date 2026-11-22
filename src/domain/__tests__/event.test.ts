import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  createEvent,
  DomainError,
  removeParticipant,
  renameParticipant,
  runDraw,
  type GiftEvent,
} from '..';

let n = 0;
const id = () => `id${n++}`;
const clock = { now: () => '2026-11-22T10:00:00.000Z' };

function withPeople(names: string[]): GiftEvent {
  let e = createEvent(
    { name: 'Natal', budgetCents: 2000, exchangeDate: '2026-12-24' },
    { id, clock },
  );
  for (const name of names) e = addParticipant(e, name, { id, clock });
  return e;
}

describe('operações do evento', () => {
  it('adiciona participantes e rejeita duplicados', () => {
    const e = withPeople(['Ana', 'Rui']);
    expect(e.participants.map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect(() => addParticipant(e, ' ana ')).toThrow(DomainError);
  });

  it('renomeia e remove', () => {
    let e = withPeople(['Ana', 'Rui', 'Eva']);
    const rui = e.participants[1]!;
    e = renameParticipant(e, rui.id, 'Rúben', clock);
    expect(e.participants[1]!.name).toBe('Rúben');
    expect(() => renameParticipant(e, rui.id, 'EVA', clock)).toThrow(DomainError);
    e = removeParticipant(e, rui.id, clock);
    expect(e.participants).toHaveLength(2);
  });

  it('sorteia e invalida o sorteio quando os participantes mudam', () => {
    let e = withPeople(['Ana', 'Rui', 'Eva']);
    e = runDraw(e, { clock });
    expect(e.draw?.assignments).toHaveLength(3);
    expect(e.draw?.id).toHaveLength(8);
    expect(addParticipant(e, 'Zé', { clock }).draw).toBeNull();
    expect(removeParticipant(e, e.participants[0]!.id, clock).draw).toBeNull();
  });

  it('repetir o sorteio gera um novo drawId', () => {
    const e = runDraw(withPeople(['Ana', 'Rui', 'Eva']));
    expect(runDraw(e).draw!.id).not.toBe(e.draw!.id);
  });
});
