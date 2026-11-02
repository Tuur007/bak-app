-- Crumbly (zuurdesem-app): eigen tabellen in het gedeelde project (zelfde login als de
-- Recepten-app en de Tuin-app). Raakt geen tabellen van die apps aan.
--
-- Elke rij is van een gebruiker; de RLS laat enkel de eigen rijen zien en aanpassen.
-- Getest in een teruggedraaide transactie en toegepast op 2 november 2026 na Tuurs ok.

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

grant select, insert, update, delete on public.bak_items to authenticated;
grant select, insert, update, delete on public.bak_reminders to authenticated;
grant select, insert, update, delete on public.bak_push_subscriptions to authenticated;
