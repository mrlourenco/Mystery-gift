// Edge Function: envia por e-mail o resultado do sorteio a cada participante.
// Fornecedor: Gmail (SMTP, grátis, sem domínio) se GMAIL_USER estiver definido; senão Resend.
//
// POST { eventId: string, giverIds?: string[], resend?: boolean }
//   - só o dono do evento consegue (o evento é lido com o JWT de quem chama, sujeito a RLS);
//   - sem `resend`, não volta a enviar a quem já recebeu este sorteio;
//   - o link usa APP_URL (definido no servidor), nunca um URL enviado pelo cliente.
//
// Secrets:
//   Gmail:  GMAIL_USER, GMAIL_APP_PASSWORD (palavra-passe de aplicação), [EMAIL_FROM]
//   Resend: RESEND_API_KEY, EMAIL_FROM
//   Ambos:  APP_URL, [ALLOWED_ORIGIN]
// (SMTP_HOST/SMTP_PORT/SMTP_SECURE e RESEND_API_URL só servem para testes locais.)
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import { buildDrawEmail } from '../_shared/drawEmail.ts';
import { formatToken, generateToken } from '../_shared/tokens.ts';

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

// ───────────────────────── Fornecedores de e-mail ─────────────────────────
interface Outgoing {
  giverId: string;
  attempt: number;
  payload: { from: string; to: string[]; subject: string; html: string; text: string };
}
interface Outcome {
  id?: string;
  error?: string;
}
interface Provider {
  from: string;
  send(list: Outgoing[], scope: string): Promise<Map<string, Outcome>>;
}

function pickProvider(): Provider | null {
  const gmailUser = env('GMAIL_USER');
  const gmailPass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  if (gmailUser && gmailPass) return gmailProvider(gmailUser, gmailPass);
  const resendKey = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (resendKey && from) return resendProvider(resendKey, from);
  return null;
}

/** Gmail por SMTP (porta 465, TLS). Envia um a um, pela mesma ligação. */
function gmailProvider(user: string, pass: string): Provider {
  const from = env('EMAIL_FROM') || `Amigo Secreto <${user}>`;
  return {
    from,
    async send(list) {
      const out = new Map<string, Outcome>();
      if (!list.length) return out;
      const transporter = nodemailer.createTransport({
        host: env('SMTP_HOST') || 'smtp.gmail.com',
        port: Number(env('SMTP_PORT') || 465),
        secure: (env('SMTP_SECURE') || 'true') === 'true',
        auth: { user, pass },
      });
      try {
        for (const item of list) {
          try {
            const info = await transporter.sendMail({
              from: item.payload.from,
              to: item.payload.to,
              subject: item.payload.subject,
              text: item.payload.text,
              html: item.payload.html,
            });
            out.set(item.giverId, { id: info.messageId });
          } catch (e) {
            out.set(item.giverId, { error: smtpError(e) });
          }
        }
      } finally {
        transporter.close();
      }
      return out;
    },
  };
}

function smtpError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  if (err.code === 'EAUTH' || err.responseCode === 535)
    return 'O Gmail recusou o login. Confirma GMAIL_USER e a palavra-passe de aplicação.';
  return err.message ?? 'Erro ao enviar pelo Gmail.';
}

/** Resend (API HTTP), em lotes de até 100, com chave de idempotência. */
function resendProvider(apiKey: string, from: string): Provider {
  return {
    from,
    async send(list, scope) {
      const out = new Map<string, Outcome>();
      for (let i = 0; i < list.length; i += RESEND_BATCH) {
        const chunk = list.slice(i, i + RESEND_BATCH);
        const key = await sha256(
          `${scope}|${chunk.map((c) => `${c.giverId}:${c.attempt}`).join(',')}`,
        );
        let ids: (string | undefined)[] = [];
        let error: string | undefined;
        try {
          const res = await fetch(
            `${env('RESEND_API_URL') || 'https://api.resend.com'}/emails/batch`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': key,
              },
              body: JSON.stringify(chunk.map((c) => c.payload)),
            },
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) error = body?.message ?? `Resend respondeu ${res.status}`;
          else ids = (body?.data ?? []).map((d: { id?: string }) => d.id);
        } catch (e) {
          error = e instanceof Error ? e.message : 'Falha de rede ao contactar o Resend.';
        }
        chunk.forEach((c, k) => out.set(c.giverId, error ? { error } : { id: ids[k] }));
      }
      return out;
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Método não suportado.' });

  const APP_URL = env('APP_URL');
  const provider = pickProvider();
  if (!provider || !APP_URL) {
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
  const ready: Omit<Outgoing, 'attempt'>[] = [];
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
        from: provider.from,
        to: [giver.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      },
    });
  }

  // Envia e regista o resultado de cada e-mail.
  const outcomes = await provider.send(
    ready.map((c) => ({ ...c, attempt: (prev.get(c.giverId)?.attempts ?? 0) + 1 })),
    `${event.id}|${draw.id}`,
  );
  const rows = ready.map((c) => {
    const o = outcomes.get(c.giverId) ?? { error: 'Sem resposta do servidor de e-mail.' };
    return {
      event_id: event.id,
      draw_id: draw.id,
      giver_id: c.giverId,
      status: o.error ? 'failed' : 'sent',
      provider_id: o.id ?? null,
      error: o.error ?? null,
      attempts: (prev.get(c.giverId)?.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) await adminDb.from('email_deliveries').upsert(rows);
  for (const r of rows)
    results.push({
      giverId: r.giver_id,
      status: r.status as Result['status'],
      error: r.error ?? undefined,
    });
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
