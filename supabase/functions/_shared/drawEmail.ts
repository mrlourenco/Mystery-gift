/**
 * Conteúdo do e-mail do sorteio. Código puro, sem dependências: é usado pela Edge Function
 * (Deno) e pela app (alternativa por mailto:), para o texto ser igual nos dois casos.
 */

export interface DrawEmailInput {
  eventName: string;
  giverName: string;
  receiverName: string;
  budgetCents: number;
  minBudgetCents: number | null;
  /** YYYY-MM-DD */
  exchangeDate: string;
  /** Link do envelope. */
  link: string;
  /** Código para "Tenho um código" (opcional: no modo local o código é o link). */
  code?: string;
}

export interface DrawEmail {
  subject: string;
  text: string;
  html: string;
}

const euros = (cents: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

export function budgetText(maxCents: number, minCents: number | null): string {
  if (minCents === null || minCents <= 0) return `até ${euros(maxCents)}`;
  if (minCents === maxCents) return euros(maxCents);
  return `entre ${euros(minCents)} e ${euros(maxCents)}`;
}

export function dateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * O nome de quem recebe fica no fim da mensagem, depois do link, para não aparecer
 * na pré-visualização da notificação: quem quiser a surpresa abre o envelope.
 */
export function buildDrawEmail(i: DrawEmailInput): DrawEmail {
  const budget = budgetText(i.budgetCents, i.minBudgetCents);
  const date = dateText(i.exchangeDate);
  const subject = `O teu amigo secreto de «${i.eventName}»`;

  const text = [
    `Olá ${i.giverName},`,
    '',
    `O sorteio do amigo secreto «${i.eventName}» já foi feito.`,
    '',
    `Valor do presente: ${budget}`,
    `Data da troca: ${date}`,
    '',
    'Abre o teu envelope para descobrires a quem vais oferecer:',
    i.link,
    ...(i.code ? ['', `Se o link não abrir, usa o código ${i.code} em "Tenho um código".`] : []),
    '',
    '',
    '',
    `Se preferires saber já: vais oferecer um presente a ${i.receiverName}.`,
    '',
    'Guarda segredo! 🤫',
  ].join('\n');

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="pt-PT">
<body style="margin:0;padding:24px;background:#fff8f1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f1a17">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
    <p style="margin:0 0 16px;font-size:18px">Olá ${e(i.giverName)},</p>
    <p style="margin:0 0 16px">O sorteio do amigo secreto <strong>${e(i.eventName)}</strong> já foi feito.</p>
    <table role="presentation" style="margin:0 0 20px;border-collapse:collapse">
      <tr><td style="padding:2px 12px 2px 0;color:#5c524b">Valor do presente</td><td style="font-weight:600">${e(budget)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#5c524b">Data da troca</td><td style="font-weight:600">${e(date)}</td></tr>
    </table>
    <p style="margin:0 0 24px">
      <a href="${e(i.link)}" style="display:inline-block;background:#b3261e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">🎁 Abrir o meu envelope</a>
    </p>
    ${
      i.code
        ? `<p style="margin:0 0 24px;font-size:14px;color:#5c524b">Se o botão não abrir, usa o código <strong style="font-family:ui-monospace,monospace;color:#1f1a17">${e(i.code)}</strong> em «Tenho um código».</p>`
        : ''
    }
    <!-- O nome fica no fim, separado: muitos clientes não suportam <details>. -->
    <div style="border-top:1px solid #e6dcd3;margin-top:120px;padding-top:16px">
      <p style="margin:0;color:#5c524b;font-size:14px">Se preferires saber já:</p>
      <p style="margin:8px 0 0">Vais oferecer um presente a <strong style="color:#b3261e;font-size:20px">${e(i.receiverName)}</strong>.</p>
    </div>
    <p style="margin:24px 0 0;font-size:14px;color:#5c524b">Guarda segredo! 🤫</p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
