import { describe, expect, it } from 'vitest';
import { budgetText, buildDrawEmail, dateText, escapeHtml } from './drawEmail.ts';

const input = {
  eventName: 'Natal <da> Família',
  giverName: 'Inês',
  receiverName: 'João 🎅',
  budgetCents: 2500,
  minBudgetCents: 1000,
  exchangeDate: '2026-12-24',
  link: 'https://x.github.io/Mystery-gift/#/r/K7Q2M9XP4RTA',
  code: 'K7Q2-M9XP-4RTA',
};

describe('buildDrawEmail', () => {
  const mail = buildDrawEmail(input);

  it('o assunto não revela quem calhou', () => {
    expect(mail.subject).toBe('O teu amigo secreto de «Natal <da> Família»');
    expect(mail.subject).not.toContain('João');
  });

  it('inclui nome, valor, data, link e código', () => {
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('Inês');
      expect(body).toContain('João 🎅');
      expect(body).toMatch(/entre 10\s?€ e 25\s?€/);
      expect(body).toContain('24 de dezembro de 2026');
      expect(body).toContain(input.link);
      expect(body).toContain('K7Q2-M9XP-4RTA');
    }
  });

  it('o nome de quem calhou aparece só depois do link (não estraga a surpresa na pré-visualização)', () => {
    expect(mail.text.indexOf('João')).toBeGreaterThan(mail.text.indexOf(input.link));
    expect(mail.html.indexOf('João')).toBeGreaterThan(mail.html.indexOf('Abrir o meu envelope'));
  });

  it('escapa HTML', () => {
    expect(mail.html).toContain('Natal &lt;da&gt; Família');
    expect(mail.html).not.toContain('<da>');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('sem código não fala em "Tenho um código"', () => {
    expect(buildDrawEmail({ ...input, code: undefined }).text).not.toContain('Tenho um código');
  });

  it('formata valor e data', () => {
    expect(budgetText(2500, null)).toMatch(/^até 25\s?€$/);
    expect(dateText('2026-12-24')).toBe('24 de dezembro de 2026');
    expect(dateText('lixo')).toBe('lixo');
  });
});
