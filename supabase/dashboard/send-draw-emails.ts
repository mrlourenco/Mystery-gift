// GERADO por scripts/build-function-single-file.mjs — não editar à mão.
// Edge Function send-draw-emails num só ficheiro, para colar no painel do Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

// ───── _shared/drawEmail.ts ─────
/**
 * Conteúdo do e-mail do sorteio. Código puro, sem dependências: é usado pela Edge Function
 * (Deno) e pela app (alternativa por mailto:), para o texto ser igual nos dois casos.
 */

interface DrawEmailInput {
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

interface DrawEmail {
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

function budgetText(maxCents: number, minCents: number | null): string {
  if (minCents === null || minCents <= 0) return `até ${euros(maxCents)}`;
  if (minCents === maxCents) return euros(maxCents);
  return `entre ${euros(minCents)} e ${euros(maxCents)}`;
}

function dateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}

function escapeHtml(s: string): string {
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
function buildDrawEmail(i: DrawEmailInput): DrawEmail {
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

// ───── _shared/tokens.ts ─────
/** Igual a src/supabase/tokens.ts (a Edge Function não importa código de src/). */
const TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_LENGTH = 12;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  let out = '';
  for (const b of bytes) out += TOKEN_ALPHABET[b % 32];
  return out;
}

const formatToken = (t: string) => t.match(/.{1,4}/g)?.join('-') ?? t;

// ───── send-draw-emails/index.ts ─────
// Edge Function: envia por e-mail (Resend) o resultado do sorteio a cada participante.
//
// POST { eventId: string, giverIds?: string[], resend?: boolean }
//   - só o dono do evento consegue (o evento é lido com o JWT de quem chama, sujeito a RLS);
//   - sem `resend`, não volta a enviar a quem já recebeu este sorteio;
//   - o link usa APP_URL (definido no servidor), nunca um URL enviado pelo cliente.
//
// Secrets (supabase secrets set …): RESEND_API_KEY, EMAIL_FROM, APP_URL, [ALLOWED_ORIGIN]
// (RESEND_API_URL só serve para testes locais.)

interface Participant {
  id: string;
  name: string;
  email?: string;
}
interface Assignment {
  giverId: string;
  receiverId: string;
}
interface EventRow {
  id: string;
  name: string;
  budget_cents: number;
  min_budget_cents: number | null;
  exchange_date: string;
  participants: Participant[];
  draw: { id: string; assignments: Assignment[] } | null;
}
interface Result {
  giverId: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

const DB_SCHEMA = 'amigo_secreto';
const MAX_RECIPIENTS = 200;
const RESEND_BATCH = 100;

const env = (k: string) => Deno.env.get(k) ?? '';
const corsHeaders = {
  'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Método não suportado.' });

  const RESEND_API_KEY = env('RESEND_API_KEY');
  const EMAIL_FROM = env('EMAIL_FROM');
  const APP_URL = env('APP_URL');
  if (!RESEND_API_KEY || !EMAIL_FROM || !APP_URL) {
    return json(500, { error: 'O envio de e-mails não está configurado no servidor.' });
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'Sessão em falta.' });

  let body: { eventId?: unknown; giverIds?: unknown; resend?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Pedido inválido.' });
  }
  if (typeof body.eventId !== 'string') return json(400, { error: 'Falta o evento.' });
  const onlyGivers = Array.isArray(body.giverIds)
    ? new Set(body.giverIds.filter((x): x is string => typeof x === 'string'))
    : null;
  const resend = body.resend === true;

  const url = env('SUPABASE_URL');
  // Cliente com o JWT de quem chama: o RLS garante que só o dono lê o evento.
  const userDb = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false },
  });
  // Cliente de serviço: só para escrever o registo de envios.
  const adminDb = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false },
  });

  const { data: event, error: evErr } = await userDb
    .from('events')
    .select('id, name, budget_cents, min_budget_cents, exchange_date, participants, draw')
    .eq('id', body.eventId)
    .maybeSingle<EventRow>();
  if (evErr) return json(500, { error: evErr.message });
  if (!event) return json(404, { error: 'Evento não encontrado.' });
  const draw = event.draw;
  if (!draw) return json(409, { error: 'Ainda não há sorteio.' });

  const byId = new Map(event.participants.map((p) => [p.id, p]));
  let targets = draw.assignments.filter((a) => !onlyGivers || onlyGivers.has(a.giverId));
  if (targets.length > MAX_RECIPIENTS) return json(400, { error: 'Demasiados participantes.' });

  // Envios anteriores deste sorteio.
  const { data: previous } = await adminDb
    .from('email_deliveries')
    .select('giver_id, status, attempts')
    .eq('event_id', event.id)
    .eq('draw_id', draw.id);
  const prev = new Map((previous ?? []).map((d) => [d.giver_id as string, d]));
  const results: Result[] = [];
  if (!resend) {
    targets = targets.filter((a) => {
      if (prev.get(a.giverId)?.status !== 'sent') return true;
      results.push({ giverId: a.giverId, status: 'skipped' });
      return false;
    });
  }

  // Tokens dos links (os mesmos que a app mostra; cria os que faltarem).
  const { data: tokenRows, error: tokErr } = await userDb
    .from('reveal_tokens')
    .select('token, giver_id')
    .eq('event_id', event.id)
    .eq('draw_id', draw.id);
  if (tokErr) return json(500, { error: tokErr.message });
  const tokens = new Map((tokenRows ?? []).map((r) => [r.giver_id as string, r.token as string]));
  const newTokens = targets
    .filter((a) => !tokens.has(a.giverId))
    .map((a) => ({
      token: generateToken(),
      event_id: event.id,
      draw_id: draw.id,
      giver_id: a.giverId,
    }));
  if (newTokens.length) {
    const { error } = await userDb.from('reveal_tokens').insert(newTokens);
    if (error) return json(500, { error: error.message });
    for (const t of newTokens) tokens.set(t.giver_id, t.token);
  }

  // Prepara os e-mails.
  const appUrl = APP_URL.split('#')[0]!;
  const ready: { giverId: string; payload: Record<string, unknown> }[] = [];
  for (const a of targets) {
    const giver = byId.get(a.giverId);
    const receiver = byId.get(a.receiverId);
    if (!giver?.email || !receiver) {
      results.push({ giverId: a.giverId, status: 'failed', error: 'Participante sem e-mail.' });
      continue;
    }
    const token = tokens.get(a.giverId)!;
    const mail = buildDrawEmail({
      eventName: event.name,
      giverName: giver.name,
      receiverName: receiver.name,
      budgetCents: event.budget_cents,
      minBudgetCents: event.min_budget_cents,
      exchangeDate: event.exchange_date,
      link: `${appUrl}#/r/${token}`,
      code: formatToken(token),
    });
    ready.push({
      giverId: a.giverId,
      payload: {
        from: EMAIL_FROM,
        to: [giver.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      },
    });
  }

  // Envia em lotes (o Resend aceita até 100 por pedido).
  for (let i = 0; i < ready.length; i += RESEND_BATCH) {
    const chunk = ready.slice(i, i + RESEND_BATCH);
    const attemptKey = chunk.map((c) => `${c.giverId}:${(prev.get(c.giverId)?.attempts ?? 0) + 1}`);
    const idempotencyKey = await sha256(`${event.id}|${draw.id}|${attemptKey.join(',')}`);
    let ids: (string | undefined)[] = [];
    let error: string | undefined;
    try {
      const res = await fetch(`${env('RESEND_API_URL') || 'https://api.resend.com'}/emails/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(chunk.map((c) => c.payload)),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) error = out?.message ?? `Resend respondeu ${res.status}`;
      else ids = (out?.data ?? []).map((d: { id?: string }) => d.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Falha de rede ao contactar o Resend.';
    }

    const rows = chunk.map((c, k) => ({
      event_id: event.id,
      draw_id: draw.id,
      giver_id: c.giverId,
      status: error ? 'failed' : 'sent',
      provider_id: ids[k] ?? null,
      error: error ?? null,
      attempts: (prev.get(c.giverId)?.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }));
    await adminDb.from('email_deliveries').upsert(rows);
    for (const r of rows)
      results.push({
        giverId: r.giver_id,
        status: r.status as Result['status'],
        error: r.error ?? undefined,
      });
  }
  for (const r of results.filter(
    (r) => r.status === 'failed' && r.error === 'Participante sem e-mail.',
  )) {
    await adminDb.from('email_deliveries').upsert({
      event_id: event.id,
      draw_id: draw.id,
      giver_id: r.giverId,
      status: 'failed',
      error: r.error,
      attempts: (prev.get(r.giverId)?.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    });
  }

  return json(200, { drawId: draw.id, results });
});
