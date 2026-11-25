-- Amigo Secreto — e-mails dos participantes, valor mínimo e registo de envios

-- ───────────────────────── Valor mínimo ─────────────────────────
alter table amigo_secreto.events
  add column if not exists min_budget_cents integer
  check (min_budget_cents is null or (min_budget_cents > 0 and min_budget_cents <= budget_cents));

-- A função reveal passa a devolver também o valor mínimo (muda o tipo de retorno → drop + create).
drop function if exists amigo_secreto.reveal(text);

create function amigo_secreto.reveal(p_token text)
returns table (
  event_name       text,
  budget_cents     integer,
  min_budget_cents integer,
  exchange_date    date,
  giver_name       text,
  receiver_name    text,
  draw_id          text,
  is_current       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select rt.*, e.name, e.budget_cents, e.min_budget_cents, e.exchange_date, e.participants, e.draw,
           coalesce(e.draw ->> 'id' = rt.draw_id, false) as is_current
    from amigo_secreto.reveal_tokens rt
    join amigo_secreto.events e on e.id = rt.event_id
    where rt.token = upper(replace(p_token, '-', ''))
  )
  select
    t.name,
    t.budget_cents,
    t.min_budget_cents,
    t.exchange_date,
    (select p ->> 'name' from jsonb_array_elements(t.participants) p where p ->> 'id' = t.giver_id),
    case when t.is_current then (
      select p ->> 'name'
      from jsonb_array_elements(t.participants) p
      where p ->> 'id' = (
        select a ->> 'receiverId'
        from jsonb_array_elements(t.draw -> 'assignments') a
        where a ->> 'giverId' = t.giver_id
      )
    ) end,
    t.draw_id,
    t.is_current
  from t;
$$;

revoke all on function amigo_secreto.reveal(text) from public;
grant execute on function amigo_secreto.reveal(text) to anon, authenticated;

-- ───────────────────────── Registo de envios ─────────────────────────
-- Um registo por (evento, sorteio, participante). Não guarda o e-mail nem o conteúdo.
-- Só a Edge Function (service role) escreve aqui; o dono do evento lê o estado.
create table if not exists amigo_secreto.email_deliveries (
  event_id    uuid not null references amigo_secreto.events (id) on delete cascade,
  draw_id     text not null,
  giver_id    text not null,
  status      text not null check (status in ('sent', 'failed')),
  provider_id text,
  error       text,
  attempts    integer not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (event_id, draw_id, giver_id)
);

alter table amigo_secreto.email_deliveries enable row level security;

create policy "envios: o dono do evento lê" on amigo_secreto.email_deliveries
  for select to authenticated using (
    exists (select 1 from amigo_secreto.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );

-- ───────────────────────── RGPD: apagar e-mails ─────────────────────────
-- Remove os e-mails dos participantes 7 dias depois da data da troca.
create or replace function amigo_secreto.purge_participant_emails()
returns integer
language sql
security definer
set search_path = ''
as $$
  with upd as (
    update amigo_secreto.events e
    set participants = (
      select coalesce(jsonb_agg(p - 'email'), '[]'::jsonb)
      from jsonb_array_elements(e.participants) p
    )
    where e.exchange_date < current_date - 7
      and exists (select 1 from jsonb_array_elements(e.participants) p where p ? 'email')
    returning 1
  )
  select count(*)::integer from upd;
$$;

revoke all on function amigo_secreto.purge_participant_emails() from public, anon, authenticated;

-- O registo de envios só é escrito pela Edge Function (service role).
revoke insert, update, delete on amigo_secreto.email_deliveries from authenticated;

-- Para correr todos os dias, ativa a extensão pg_cron (Database → Extensions) e executa:
--   select cron.schedule('apagar-emails', '17 3 * * *', 'select amigo_secreto.purge_participant_emails()');
