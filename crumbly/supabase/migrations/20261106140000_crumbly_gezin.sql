-- Crumbly: een gezin deelt de gegevens van één eigenaar (starter, voedingen, recepten, bakken, weg, instellingen).
-- Een lid werkt in de app op de gegevens van de eigenaar en mag ze lezen, toevoegen en aanpassen, zoals de
-- eigenaar zelf. Verwijderen gebeurt altijd met 'deleted_at' (zoals nu), nooit met delete.
--
-- Koppelen (bak_links) blijft apart: dat is enkel kijken naar de starter van een ander gezin.
-- Eigen tabellen en functies (bak_*), raakt geen tabellen van andere apps aan.
-- TOEGEPAST op 6 november 2026 na Tuurs ok (gecontroleerd). Test: supabase/tests/crumbly_gezin_test.sql.

-- 1. Leden van het gezin van een eigenaar. Een account kan maar in één gezin lid zijn.
create table if not exists public.bak_household_members (
  owner uuid not null references auth.users (id) on delete cascade,
  member uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (owner, member),
  unique (member),
  check (owner <> member)
);

create index if not exists bak_household_members_owner_idx on public.bak_household_members (owner);

alter table public.bak_household_members enable row level security;

-- Eigenaar en lid zien de rij; beide mogen ze verwijderen (lid verlaat het gezin, eigenaar zet een lid eruit).
drop policy if exists bak_household_select on public.bak_household_members;
create policy bak_household_select on public.bak_household_members
  for select to authenticated
  using ((select auth.uid()) in (owner, member));

drop policy if exists bak_household_delete on public.bak_household_members;
create policy bak_household_delete on public.bak_household_members
  for delete to authenticated
  using ((select auth.uid()) in (owner, member));

-- 2. Gezinscodes (eenmalig, een dag geldig), enkel via de functies.
create table if not exists public.bak_household_codes (
  code text primary key check (code ~ '^[A-F0-9]{10}$'),
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

create index if not exists bak_household_codes_owner_idx on public.bak_household_codes (owner);

alter table public.bak_household_codes enable row level security;
-- bewust geen policies

revoke all on public.bak_household_members from anon, authenticated;
revoke all on public.bak_household_codes from anon, authenticated;
grant select, delete on public.bak_household_members to authenticated;

-- 3. Leden werken op de rijen van hun eigenaar (naast de bestaande regel voor je eigen rijen).
-- Geen delete: wissen gebeurt met deleted_at.
drop policy if exists bak_items_household_select on public.bak_items;
create policy bak_items_household_select on public.bak_items
  for select to authenticated
  using (exists (select 1 from public.bak_household_members m where m.owner = bak_items.user_id and m.member = (select auth.uid())));

drop policy if exists bak_items_household_insert on public.bak_items;
create policy bak_items_household_insert on public.bak_items
  for insert to authenticated
  with check (exists (select 1 from public.bak_household_members m where m.owner = bak_items.user_id and m.member = (select auth.uid())));

drop policy if exists bak_items_household_update on public.bak_items;
create policy bak_items_household_update on public.bak_items
  for update to authenticated
  using (exists (select 1 from public.bak_household_members m where m.owner = bak_items.user_id and m.member = (select auth.uid())))
  with check (exists (select 1 from public.bak_household_members m where m.owner = bak_items.user_id and m.member = (select auth.uid())));

-- 4. Een gezinscode maken (enkel een eigenaar; wie zelf lid is van een ander gezin niet).
create or replace function public.bak_create_household_code()
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
  if exists (select 1 from public.bak_household_members where member = v_me) then
    raise exception 'Je zit zelf in het gezin van iemand anders';
  end if;
  -- Een geldige, ongebruikte code blijft bestaan (op elk toestel dezelfde).
  select c.code into v_code from public.bak_household_codes c
  where c.owner = v_me and c.used_at is null and c.expires_at > now()
  order by c.created_at desc limit 1;
  if v_code is not null then
    return v_code;
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.bak_household_codes (code, owner) values (v_code, v_me);
  return v_code;
end;
$$;

-- 5. Bij een gezin komen met een code en een naam (zo zie je wie wat deed).
create or replace function public.bak_join_household(p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_row public.bak_household_codes;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_me is null then
    raise exception 'Niet aangemeld';
  end if;
  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'Vul je naam in (hoogstens 40 tekens)';
  end if;
  select * into v_row from public.bak_household_codes
  where code = upper(btrim(p_code)) and used_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'Deze code klopt niet of is verlopen';
  end if;
  if v_row.owner = v_me then
    raise exception 'Dit is je eigen code: geef ze aan de ander';
  end if;
  if exists (select 1 from public.bak_household_members where member = v_me) then
    raise exception 'Je zit al in een gezin. Verlaat dat eerst';
  end if;
  if exists (select 1 from public.bak_household_members where owner = v_me) then
    raise exception 'Er zitten al leden in jouw gezin. Zet die eerst weg';
  end if;
  insert into public.bak_household_members (owner, member, display_name) values (v_row.owner, v_me, v_name);
  update public.bak_household_codes set used_by = v_me, used_at = now() where code = v_row.code;
end;
$$;

-- 6. Je geldige gezinscode (of niets), voor het scherm.
create or replace function public.bak_my_household_code()
returns table (code text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.expires_at from public.bak_household_codes c
  where c.owner = (select auth.uid()) and c.used_at is null and c.expires_at > now()
  order by c.created_at desc limit 1;
$$;

revoke all on function public.bak_create_household_code() from public, anon;
revoke all on function public.bak_join_household(text, text) from public, anon;
revoke all on function public.bak_my_household_code() from public, anon;
grant execute on function public.bak_create_household_code() to authenticated;
grant execute on function public.bak_join_household(text, text) to authenticated;
grant execute on function public.bak_my_household_code() to authenticated;

notify pgrst, 'reload schema';
