import { describe, expect, it } from 'vitest';
import {
  DrawImpossibleError,
  drawAssignments,
  type Assignment,
  type Exclusion,
  type Participant,
} from '..';

const people = (n: number): Participant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Pessoa ${i}` }));

/** RNG determinístico (mulberry32) para reprodutibilidade. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertValid(ps: Participant[], result: Assignment[], exclusions: Exclusion[] = []) {
  expect(result).toHaveLength(ps.length);
  const givers = new Set(result.map((a) => a.giverId));
  const receivers = new Set(result.map((a) => a.receiverId));
  const ids = new Set(ps.map((p) => p.id));
  expect(givers).toEqual(ids);
  expect(receivers).toEqual(ids);
  for (const a of result) {
    expect(a.giverId).not.toBe(a.receiverId);
    expect(exclusions.some((x) => x.giverId === a.giverId && x.receiverId === a.receiverId)).toBe(
      false,
    );
  }
}

describe('drawAssignments', () => {
  it('ninguém se tira a si próprio e todos dão e recebem uma vez', () => {
    const ps = people(5);
    assertValid(ps, drawAssignments(ps));
  });

  it('exige pelo menos 3 participantes', () => {
    expect(() => drawAssignments(people(2))).toThrow(DrawImpossibleError);
    expect(() => drawAssignments(people(0))).toThrow(DrawImpossibleError);
  });

  it('rejeita IDs repetidos', () => {
    const ps = [...people(3), { id: 'p0', name: 'Outra' }];
    expect(() => drawAssignments(ps)).toThrow(DrawImpossibleError);
  });

  it('respeita exclusões (casais não se tiram um ao outro)', () => {
    const ps = people(6);
    const exclusions: Exclusion[] = [
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p1', receiverId: 'p0' },
      { giverId: 'p2', receiverId: 'p3' },
      { giverId: 'p3', receiverId: 'p2' },
    ];
    for (let i = 0; i < 200; i++) assertValid(ps, drawAssignments(ps, exclusions), exclusions);
  });

  it('encontra a única solução possível quando as restrições a forçam', () => {
    // Com 3 pessoas e p0 sem poder tirar p1, a única solução é p0→p2→p1→p0.
    const ps = people(3);
    const exclusions = [{ giverId: 'p0', receiverId: 'p1' }];
    for (let i = 0; i < 50; i++) {
      const r = drawAssignments(ps, exclusions);
      assertValid(ps, r, exclusions);
      expect(r.find((a) => a.giverId === 'p0')!.receiverId).toBe('p2');
    }
  });

  it('lança erro quando é impossível cumprir as restrições', () => {
    const ps = people(3);
    // p0 não pode tirar ninguém.
    const exclusions = [
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p0', receiverId: 'p2' },
    ];
    expect(() => drawAssignments(ps, exclusions)).toThrow(DrawImpossibleError);
  });

  it('lança erro quando ninguém pode receber uma pessoa (impossível por coluna)', () => {
    const ps = people(4);
    const exclusions = ['p0', 'p1', 'p2'].map((g) => ({ giverId: g, receiverId: 'p3' }));
    expect(() => drawAssignments(ps, exclusions)).toThrow(DrawImpossibleError);
  });

  it('ignora exclusões de IDs desconhecidos', () => {
    const ps = people(3);
    assertValid(ps, drawAssignments(ps, [{ giverId: 'x', receiverId: 'p0' }]));
  });

  it('é reprodutível com o mesmo RNG', () => {
    const ps = people(8);
    expect(drawAssignments(ps, [], seeded(42))).toEqual(drawAssignments(ps, [], seeded(42)));
  });

  it('1000 execuções aleatórias são todas válidas', () => {
    const rng = seeded(2026);
    for (let i = 0; i < 1000; i++) {
      const n = 3 + Math.floor(rng() * 18);
      const ps = people(n);
      // Exclusões aleatórias de casais (pares disjuntos), garantidamente com solução para n ≥ 4.
      const exclusions: Exclusion[] = [];
      if (n >= 4) {
        for (let k = 0; k + 1 < Math.floor(n / 2); k += 2) {
          exclusions.push({ giverId: `p${k}`, receiverId: `p${k + 1}` });
          exclusions.push({ giverId: `p${k + 1}`, receiverId: `p${k}` });
        }
      }
      assertValid(ps, drawAssignments(ps, exclusions, rng), exclusions);
    }
  });

  it('distribui os resultados (não é sempre o mesmo)', () => {
    const ps = people(4);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(
        drawAssignments(ps)
          .map((a) => a.receiverId)
          .join(','),
      );
    }
    // Para 4 pessoas existem 9 desarranjos.
    expect(seen.size).toBe(9);
  });
});
