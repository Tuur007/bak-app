-- Test voor de Crumbly-migratie. Draait in een transactie en draait zichzelf terug:
-- plak het geheel in de SQL-editor; elke regel "ok" moet true zijn.
-- De migratie staat hieronder letterlijk mee in (bij een wijziging opnieuw kopiëren).
begin;

-- ---- begin migratie ----
-- Crumbly (zuurdesem-app): eigen tabellen in het gedeelde project (zelfde login als de
-- Recepten-app en de Tuin-app). Raakt geen tabellen van die apps aan.
--
-- Elke rij is van een gebruiker; de RLS laat enkel de eigen rijen zien en aanpassen.
-- NIET TOEGEPAST: eerst testen met supabase/tests/crumbly_test.sql (draait zichzelf terug),
-- dan pas na Tuurs ok uitvoeren in de SQL-editor.

-- 1. Alle gegevens van de app als items (starter, voedingen, recepten, bakken, weg, instellingen).
create table if not exists public.bak_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('starter', 'feed', 'recipe', 'bake', 'away', 'settings')),
  data jsonb not null check (pg_column_size(data) <= 200000),
  -- tijd van de laatste wijziging op het toestel (laatste wijziging wint)
  updated_at timestamptz not null,
  deleted_at timestamptz,
  -- tijd waarop de server de rij kreeg: daarop haalt de app nieuwe wijzigingen op
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists bak_items_pull_idx on public.bak_items (user_id, server_updated_at);

alter table public.bak_items enable row level security;

drop policy if exists bak_items_own on public.bak_items;
create policy bak_items_own on public.bak_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Een oudere wijziging overschrijft nooit een nieuwere; de servertijd staat altijd juist.
create or replace function private.bak_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists bak_items_guard on public.bak_items;
create trigger bak_items_guard
  before insert or update on public.bak_items
  for each row execute function private.bak_items_guard();

-- 2. Wekkers die de server op tijd als melding verstuurt.
create table if not exists public.bak_reminders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) <= 200),
  due_at timestamptz not null,
  title text not null check (length(title) <= 120),
  body text not null check (length(body) <= 300),
  url text not null default '/' check (url like '/%' and length(url) <= 200),
  sent_at timestamptz,
  primary key (user_id, id)
);

create index if not exists bak_reminders_due_idx on public.bak_reminders (due_at) where sent_at is null;

alter table public.bak_reminders enable row level security;

drop policy if exists bak_reminders_own on public.bak_reminders;
create policy bak_reminders_own on public.bak_reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3. Push-abonnementen (een per toestel).
create table if not exists public.bak_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists bak_push_subscriptions_user_idx on public.bak_push_subscriptions (user_id);

alter table public.bak_push_subscriptions enable row level security;

drop policy if exists bak_push_subscriptions_own on public.bak_push_subscriptions;
create policy bak_push_subscriptions_own on public.bak_push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- ---- einde migratie ----

-- Twee testgebruikers.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'crumbly-a@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'crumbly-b@test.invalid');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.bak_items (id, kind, data, updated_at)
values ('00000000-0000-4000-8000-00000000c0de', 'settings', '{"v":1}', '2026-11-02T10:00:00Z');

-- Oudere wijziging overschrijft niet.
insert into public.bak_items (id, kind, data, updated_at)
values ('00000000-0000-4000-8000-00000000c0de', 'settings', '{"v":0}', '2026-11-01T10:00:00Z')
on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at;
select (select data->>'v' from public.bak_items) = '1' as ok_oudere_wint_niet;

-- Gebruiker B ziet niets van A, en kan dezelfde id gebruiken.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select count(*) = 0 as ok_b_ziet_a_niet from public.bak_items;
insert into public.bak_items (id, kind, data, updated_at)
values ('00000000-0000-4000-8000-00000000c0de', 'settings', '{"v":9}', now());
select count(*) = 1 as ok_b_eigen_rij from public.bak_items;

reset role;
rollback;
