-- Amigo Secreto — instalação completa (junta as migrações de supabase/migrations/).
-- Colar tudo no SQL Editor do Supabase e carregar em Run.

-- Amigo Secreto — esquema inicial
-- Aplicar no SQL Editor do Supabase (ou com `supabase db push`).
-- Tudo fica no schema `amigo_secreto`, para poder partilhar o projeto com outra app.
-- Depois de aplicar: Settings → Data API → Exposed schemas → acrescentar `amigo_secreto`.

create schema if not exists amigo_secreto;

grant usage on schema amigo_secreto to anon, authenticated, service_role;
alter default privileges in schema amigo_secreto
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema amigo_secreto
  grant all on tables to service_role;

-- ───────────────────────── Eventos ─────────────────────────
create table if not exists amigo_secreto.events (
  id            uuid primary key,
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  budget_cents  integer not null check (budget_cents > 0 and budget_cents <= 10000000),
  exchange_date date not null,
  participants  jsonb not null default '[]'::jsonb check (jsonb_typeof(participants) = 'array'),
  exclusions    jsonb not null default '[]'::jsonb check (jsonb_typeof(exclusions) = 'array'),
  draw          jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_owner_updated_idx on amigo_secreto.events (owner_id, updated_at desc);

alter table amigo_secreto.events enable row level security;

create policy "events: o dono lê" on amigo_secreto.events
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "events: o dono cria" on amigo_secreto.events
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "events: o dono altera" on amigo_secreto.events
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "events: o dono apaga" on amigo_secreto.events
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ───────────────────── Tokens dos links ─────────────────────
-- Um token por (evento, sorteio, participante). Os tokens de sorteios antigos ficam
-- guardados para a página de revelação poder dizer "este link já não é válido".
create table if not exists amigo_secreto.reveal_tokens (
  token      text primary key check (token ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  event_id   uuid not null references amigo_secreto.events (id) on delete cascade,
  draw_id    text not null,
  giver_id   text not null,
  created_at timestamptz not null default now(),
  unique (event_id, draw_id, giver_id)
);

alter table amigo_secreto.reveal_tokens enable row level security;

create policy "tokens: o dono do evento lê" on amigo_secreto.reveal_tokens
  for select to authenticated using (
    exists (select 1 from amigo_secreto.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );
create policy "tokens: o dono do evento cria" on amigo_secreto.reveal_tokens
  for insert to authenticated with check (
    exists (select 1 from amigo_secreto.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );
create policy "tokens: o dono do evento apaga" on amigo_secreto.reveal_tokens
  for delete to authenticated using (
    exists (select 1 from amigo_secreto.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );

-- ───────────────────── Revelação pública ─────────────────────
-- Quem recebe o link não tem conta: lê apenas a SUA linha, através do token.
-- Se o sorteio já não for o atual, o nome de quem recebe não é devolvido.
create or replace function amigo_secreto.reveal(p_token text)
returns table (
  event_name    text,
  budget_cents  integer,
  exchange_date date,
  giver_name    text,
  receiver_name text,
  draw_id       text,
  is_current    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select rt.*, e.name, e.budget_cents, e.exchange_date, e.participants, e.draw,
           coalesce(e.draw ->> 'id' = rt.draw_id, false) as is_current
    from amigo_secreto.reveal_tokens rt
    join amigo_secreto.events e on e.id = rt.event_id
    where rt.token = upper(replace(p_token, '-', ''))
  )
  select
    t.name,
    t.budget_cents,
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
