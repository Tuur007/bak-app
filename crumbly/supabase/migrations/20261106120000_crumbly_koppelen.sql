-- Crumbly: twee accounts koppelen om elkaars starter te zien (enkel lezen).
-- Eigen tabellen en functies (bak_*), raakt geen tabellen van andere apps aan.
--
-- Werking: A maakt een koppelcode (een dag geldig, eenmalig), B vult ze in. Daarna geeft
-- bak_get_linked() aan beiden de rijen kind 'starter' en 'feed' van de ander. Recepten, bakken,
-- foto's en instellingen blijven privé. De RLS van bak_items blijft ongewijzigd: de ander krijgt
-- geen rechtstreekse toegang, enkel via de functie.
-- NIET TOEGEPAST: eerst testen met supabase/tests/crumbly_koppelen_test.sql (draait zichzelf
-- terug), dan pas na Tuurs ok uitvoeren.

-- 1. Koppelingen: een paar accounts, genormaliseerd (user_a < user_b) zodat ze maar eenmaal bestaan.
create table if not exists public.bak_links (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists bak_links_b_idx on public.bak_links (user_b);

alter table public.bak_links enable row level security;

drop policy if exists bak_links_select on public.bak_links;
create policy bak_links_select on public.bak_links
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- Beide kanten mogen de koppeling verbreken.
drop policy if exists bak_links_delete on public.bak_links;
create policy bak_links_delete on public.bak_links
  for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- 2. Koppelcodes: enkel via de functies, geen rechtstreekse toegang.
create table if not exists public.bak_link_codes (
  code text primary key check (code ~ '^[A-F0-9]{10}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

create index if not exists bak_link_codes_user_idx on public.bak_link_codes (user_id);

alter table public.bak_link_codes enable row level security;
-- bewust geen policies: niemand leest of schrijft de tabel rechtstreeks

grant select, delete on public.bak_links to authenticated;

-- 3. Een code maken (de oude, ongebruikte codes van jezelf verdwijnen).
create or replace function public.bak_create_link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_code text;
begin
  if v_me is null then
    raise exception 'Niet aangemeld';
  end if;
  delete from public.bak_link_codes where user_id = v_me and used_at is null;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.bak_link_codes (code, user_id) values (v_code, v_me);
  return v_code;
end;
$$;

-- 4. Een code inwisselen: maakt de koppeling.
create or replace function public.bak_redeem_link_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_row public.bak_link_codes;
begin
  if v_me is null then
    raise exception 'Niet aangemeld';
  end if;
  select * into v_row from public.bak_link_codes
  where code = upper(btrim(p_code)) and used_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'Deze code klopt niet of is verlopen';
  end if;
  if v_row.user_id = v_me then
    raise exception 'Dit is je eigen code: geef ze aan de ander';
  end if;
  insert into public.bak_links (user_a, user_b)
  values (least(v_me, v_row.user_id), greatest(v_me, v_row.user_id))
  on conflict do nothing;
  update public.bak_link_codes set used_by = v_me, used_at = now() where code = v_row.code;
end;
$$;

-- 5. De starter en de laatste voedingen van gekoppelde accounts (enkel lezen).
create or replace function public.bak_get_linked(p_feeds integer default 60)
returns table (owner uuid, id uuid, kind text, data jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  peers as (
    select case when l.user_a = me.uid then l.user_b else l.user_a end as peer
    from public.bak_links l, me
    where me.uid in (l.user_a, l.user_b)
  ),
  feeds as (
    select i.user_id, i.id, i.kind, i.data, i.updated_at,
           row_number() over (partition by i.user_id order by i.data ->> 'fedAt' desc) as rn
    from public.bak_items i
    where i.user_id in (select peer from peers) and i.kind = 'feed' and i.deleted_at is null
  )
  select i.user_id, i.id, i.kind, i.data, i.updated_at
  from public.bak_items i
  where i.user_id in (select peer from peers) and i.kind = 'starter' and i.deleted_at is null
  union all
  select f.user_id, f.id, f.kind, f.data, f.updated_at
  from feeds f
  where f.rn <= greatest(1, least(coalesce(p_feeds, 60), 200));
$$;

revoke all on function public.bak_create_link_code() from public, anon;
revoke all on function public.bak_redeem_link_code(text) from public, anon;
revoke all on function public.bak_get_linked(integer) from public, anon;
grant execute on function public.bak_create_link_code() to authenticated;
grant execute on function public.bak_redeem_link_code(text) to authenticated;
grant execute on function public.bak_get_linked(integer) to authenticated;
