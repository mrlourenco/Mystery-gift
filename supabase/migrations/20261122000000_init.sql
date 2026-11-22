-- Amigo Secreto — esquema inicial
-- Aplicar no SQL Editor do Supabase (ou com `supabase db push`).

-- ───────────────────────── Eventos ─────────────────────────
create table if not exists public.events (
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

create index if not exists events_owner_updated_idx on public.events (owner_id, updated_at desc);

alter table public.events enable row level security;

create policy "events: o dono lê" on public.events
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "events: o dono cria" on public.events
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "events: o dono altera" on public.events
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "events: o dono apaga" on public.events
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ───────────────────── Tokens dos links ─────────────────────
-- Um token por (evento, sorteio, participante). Os tokens de sorteios antigos ficam
-- guardados para a página de revelação poder dizer "este link já não é válido".
create table if not exists public.reveal_tokens (
  token      text primary key check (token ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  event_id   uuid not null references public.events (id) on delete cascade,
  draw_id    text not null,
  giver_id   text not null,
  created_at timestamptz not null default now(),
  unique (event_id, draw_id, giver_id)
);

alter table public.reveal_tokens enable row level security;

create policy "tokens: o dono do evento lê" on public.reveal_tokens
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );
create policy "tokens: o dono do evento cria" on public.reveal_tokens
  for insert to authenticated with check (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );
create policy "tokens: o dono do evento apaga" on public.reveal_tokens
  for delete to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
  );

-- ───────────────────── Revelação pública ─────────────────────
-- Quem recebe o link não tem conta: lê apenas a SUA linha, através do token.
-- Se o sorteio já não for o atual, o nome de quem recebe não é devolvido.
create or replace function public.reveal(p_token text)
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
    from public.reveal_tokens rt
    join public.events e on e.id = rt.event_id
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

revoke all on function public.reveal(text) from public;
grant execute on function public.reveal(text) to anon, authenticated;
