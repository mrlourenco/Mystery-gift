import { describe, expect, it } from 'vitest';
import {
  formatEuros,
  isValidIsoDate,
  normalizeName,
  parseEuros,
  validateEventDetails,
  validateParticipantName,
} from '..';

describe('normalizeName', () => {
  it('ignora maiúsculas, acentos e espaços', () => {
    expect(normalizeName('  José   Maria ')).toBe(normalizeName('jose maria'));
    expect(normalizeName('ÂNGELA')).toBe('angela');
  });
});

describe('validateParticipantName', () => {
  const existing = [
    { id: '1', name: 'Ana' },
    { id: '2', name: 'José' },
  ];
  it('rejeita vazio', () => expect(validateParticipantName('   ', existing).ok).toBe(false));
  it('rejeita duplicado sem distinguir maiúsculas', () =>
    expect(validateParticipantName('ANA', existing).ok).toBe(false));
  it('rejeita duplicado sem distinguir acentos', () =>
    expect(validateParticipantName('jose', existing).ok).toBe(false));
  it('aceita novo nome', () => expect(validateParticipantName('Rui', existing).ok).toBe(true));
  it('permite manter o próprio nome ao editar', () =>
    expect(validateParticipantName('ana', existing, '1').ok).toBe(true));
  it('rejeita nomes demasiado longos', () =>
    expect(validateParticipantName('a'.repeat(51), existing).ok).toBe(false));
});

describe('validateEventDetails', () => {
  it('aceita dados válidos', () => {
    expect(
      validateEventDetails({ name: 'Natal', budgetCents: 2000, exchangeDate: '2026-12-24' }),
    ).toEqual({});
  });
  it('reporta todos os erros', () => {
    const e = validateEventDetails({ name: ' ', budgetCents: 0, exchangeDate: '2026-02-30' });
    expect(Object.keys(e).sort()).toEqual(['budgetCents', 'exchangeDate', 'name']);
  });
});

describe('datas e euros', () => {
  it('valida datas ISO', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('24/12/2026')).toBe(false);
  });
  it('converte euros para cêntimos', () => {
    expect(parseEuros('25')).toBe(2500);
    expect(parseEuros('25,5')).toBe(2550);
    expect(parseEuros('25.05 €')).toBe(2505);
    expect(parseEuros('1 000')).toBe(100000);
    expect(parseEuros('abc')).toBeNull();
    expect(parseEuros('1,234')).toBeNull();
  });
  it('formata euros', () => {
    expect(formatEuros(2500)).toMatch(/25\s?€/);
    expect(formatEuros(2550)).toMatch(/25,50\s?€/);
  });
});
