import type { Assignment, Exclusion, Participant, ParticipantId } from './types';

export const MIN_PARTICIPANTS = 3;

export class DrawImpossibleError extends Error {
  constructor(message = 'Não é possível fazer o sorteio com estas restrições.') {
    super(message);
    this.name = 'DrawImpossibleError';
  }
}

export type Rng = () => number;

/** Fisher–Yates, devolve uma cópia. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Sorteio por backtracking com shuffle.
 * - ninguém se tira a si próprio;
 * - cada pessoa dá e recebe exatamente uma vez;
 * - as exclusões (direcionais) são respeitadas.
 * Lança `DrawImpossibleError` se as restrições não tiverem solução.
 */
export function drawAssignments(
  participants: readonly Participant[],
  exclusions: readonly Exclusion[] = [],
  rng: Rng = Math.random,
): Assignment[] {
  if (participants.length < MIN_PARTICIPANTS) {
    throw new DrawImpossibleError(`São precisos pelo menos ${MIN_PARTICIPANTS} participantes.`);
  }
  const ids = participants.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new DrawImpossibleError('Há participantes repetidos.');
  }

  const blocked = new Map<ParticipantId, Set<ParticipantId>>();
  for (const id of ids) blocked.set(id, new Set([id]));
  for (const ex of exclusions) blocked.get(ex.giverId)?.add(ex.receiverId);

  const candidates = new Map<ParticipantId, ParticipantId[]>();
  for (const giver of ids) {
    const b = blocked.get(giver)!;
    candidates.set(
      giver,
      ids.filter((r) => !b.has(r)),
    );
  }

  // Ordena quem dá pelo menor número de opções (menos backtracking); empates aleatórios.
  const givers = shuffle(ids, rng).sort(
    (a, b) => candidates.get(a)!.length - candidates.get(b)!.length,
  );

  const taken = new Set<ParticipantId>();
  const result = new Map<ParticipantId, ParticipantId>();

  const solve = (index: number): boolean => {
    if (index === givers.length) return true;
    const giver = givers[index]!;
    for (const receiver of shuffle(candidates.get(giver)!, rng)) {
      if (taken.has(receiver)) continue;
      taken.add(receiver);
      result.set(giver, receiver);
      if (solve(index + 1)) return true;
      taken.delete(receiver);
      result.delete(giver);
    }
    return false;
  };

  if (!solve(0)) throw new DrawImpossibleError();

  return ids.map((giverId) => ({ giverId, receiverId: result.get(giverId)! }));
}
