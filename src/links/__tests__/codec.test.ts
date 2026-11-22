import { describe, expect, it, vi } from 'vitest';
import {
  buildRevealUrl,
  decodeReveal,
  encodeReveal,
  extractCode,
  InvalidCodeError,
  shareLink,
  whatsappUrl,
  type RevealData,
} from '..';

const sample: RevealData = {
  eventName: 'Natal da Família',
  budgetCents: 2550,
  exchangeDate: '2026-12-24',
  giverName: 'Ana',
  receiverName: 'Rui',
  drawId: 'abc12345',
};

describe('codec', () => {
  it('codifica e descodifica (ida e volta)', () => {
    expect(decodeReveal(encodeReveal(sample))).toEqual(sample);
  });

  it('suporta acentos, ç, ã e emojis', () => {
    const d = {
      ...sample,
      eventName: 'Consoada 🎄 em São João',
      giverName: 'Inês Gonçalves',
      receiverName: 'João 🎅🏽 Ângelo',
    };
    expect(decodeReveal(encodeReveal(d))).toEqual(d);
  });

  it('produz só caracteres base64url e não expõe o nome em claro', () => {
    const code = encodeReveal(sample);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code).not.toContain('Rui');
    expect(
      atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((code.length + 3) % 4)),
    ).not.toContain('Rui');
  });

  it('rejeita códigos inválidos', () => {
    expect(() => decodeReveal('')).toThrow(InvalidCodeError);
    expect(() => decodeReveal('não é base64!')).toThrow(InvalidCodeError);
    expect(() => decodeReveal(encodeReveal(sample).slice(0, 20))).toThrow(InvalidCodeError);
    expect(() => decodeReveal('eyJ2IjoxfQ')).toThrow(InvalidCodeError);
  });

  it('extrai o código de um link completo', () => {
    const code = encodeReveal(sample);
    const url = buildRevealUrl(code, 'https://x.github.io/Mystery-gift/#/eventos/1');
    expect(url).toBe(`https://x.github.io/Mystery-gift/#/r/${code}`);
    expect(extractCode(url)).toBe(code);
    expect(extractCode(`  ${code}\n`)).toBe(code);
  });
});

describe('shareLink', () => {
  const input = { title: 't', text: 'Olá', url: 'https://x/#/r/abc' };

  it('usa a Web Share API quando existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    expect(await shareLink(input, { share, canShare: () => true }, open)).toBe('shared');
    expect(open).not.toHaveBeenCalled();
  });

  it('cai para wa.me quando não há Web Share', async () => {
    const open = vi.fn();
    expect(await shareLink(input, undefined, open)).toBe('fallback');
    expect(open).toHaveBeenCalledWith(whatsappUrl(input));
    expect(whatsappUrl(input)).toContain('https://wa.me/?text=Ol%C3%A1');
  });

  it('não abre o WhatsApp se o utilizador cancelar', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    const open = vi.fn();
    expect(await shareLink(input, { share, canShare: () => true }, open)).toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
  });
});
