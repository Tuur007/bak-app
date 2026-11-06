-- Test voor de koppel-migratie. Draait in een transactie en draait zichzelf terug:
-- plak het geheel in de SQL-editor; elke regel "ok_..." moet true zijn.
-- De migratie staat hieronder letterlijk mee in (bij een wijziging opnieuw kopiëren).
-- Vereist dat de eerste Crumbly-migratie (bak_items) al staat.
begin;

-- ---- begin migratie ----
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
-- ---- einde migratie ----

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'crumbly-a@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'crumbly-b@test.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'crumbly-c@test.invalid');

-- Gegevens van A (als eigenaar, buiten de RLS om): starter, 3 voedingen, een recept en een gewiste voeding.
insert into public.bak_items (user_id, id, kind, data, updated_at, deleted_at) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Jean Flore","updatedAt":"2026-11-05T10:00:00Z"}', '2026-11-05T10:00:00Z', null),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'feed', '{"fedAt":"2026-11-03T18:00:00Z"}', '2026-11-03T18:00:00Z', null),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'feed', '{"fedAt":"2026-11-04T18:00:00Z"}', '2026-11-04T18:00:00Z', null),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000003', 'feed', '{"fedAt":"2026-11-05T18:00:00Z"}', '2026-11-05T18:00:00Z', null),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000004', 'feed', '{"fedAt":"2026-11-02T18:00:00Z"}', '2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001', 'recipe', '{"name":"geheim recept"}', '2026-11-03T18:00:00Z', null);
insert into public.bak_items (user_id, id, kind, data, updated_at) values
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Jean Tuur","updatedAt":"2026-11-05T11:00:00Z"}', '2026-11-05T11:00:00Z');

set local role authenticated;

-- Zonder koppeling ziet niemand iets.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select count(*) = 0 as ok_geen_koppeling_geen_rijen from public.bak_get_linked();
select count(*) = 1 as ok_b_ziet_enkel_eigen_items from public.bak_items;

-- A maakt een code; B wisselt ze in.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
create temp table t_code on commit drop as select public.bak_create_link_code() as code;
select length(code) = 10 as ok_code_tien_tekens from t_code;
do $$ declare n int; begin
  select count(*) into n from public.bak_link_codes;
  if n > 0 then raise exception 'codes zijn rechtstreeks leesbaar'; end if;
exception when insufficient_privilege then null;
end $$;

-- Eigen code inwisselen mag niet.
do $$ begin
  perform public.bak_redeem_link_code((select code from t_code));
  raise exception 'eigen code werd aanvaard';
exception when others then
  if sqlerrm like 'eigen code werd aanvaard' then raise; end if;
end $$;
select count(*) = 0 as ok_eigen_code_geen_koppeling from public.bak_links;

-- Een foute code mag niet.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
  perform public.bak_redeem_link_code('0000000000');
  raise exception 'foute code werd aanvaard';
exception when others then
  if sqlerrm like 'foute code werd aanvaard' then raise; end if;
end $$;

-- Goede code, in kleine letters en met spaties.
select public.bak_redeem_link_code(' ' || lower((select code from t_code)) || ' ');
select count(*) = 1 as ok_koppeling_bestaat from public.bak_links;

-- De code is nu gebruikt: een derde kan ze niet meer inwisselen.
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$ begin
  perform public.bak_redeem_link_code((select code from t_code));
  raise exception 'gebruikte code werd opnieuw aanvaard';
exception when others then
  if sqlerrm like 'gebruikte code werd opnieuw aanvaard' then raise; end if;
end $$;
select count(*) = 0 as ok_derde_ziet_niets from public.bak_get_linked();
select count(*) = 0 as ok_derde_ziet_geen_koppeling from public.bak_links;

-- B ziet van A enkel de starter en de 3 voedingen (geen recept, geen gewiste voeding).
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select count(*) = 4 as ok_b_ziet_vier_rijen from public.bak_get_linked();
select count(*) filter (where kind = 'starter') = 1 and count(*) filter (where kind = 'feed') = 3 as ok_starter_en_drie_voedingen from public.bak_get_linked();
select count(*) = 0 as ok_geen_recept_zichtbaar from public.bak_get_linked() where kind not in ('starter', 'feed');
select bool_and(owner = '11111111-1111-4111-8111-111111111111') as ok_enkel_van_a from public.bak_get_linked();
select count(*) = 2 as ok_beperkt_tot_aantal_voedingen from public.bak_get_linked(1);
select count(*) = 1 as ok_b_eigen_items_blijven_eigen from public.bak_items;

-- Ook A ziet de starter van B.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select count(*) = 1 and bool_and(data ->> 'name' = 'Jean Tuur') as ok_a_ziet_jean_tuur from public.bak_get_linked();

-- Schrijven kan niet: B past een rij van A niet aan.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
with u as (update public.bak_items set data = '{"hacked":true}' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
select count(*) = 0 as ok_b_kan_a_niet_wijzigen from u;
with d as (delete from public.bak_items where id = '00000000-0000-4000-8000-0000000057a7' and data ->> 'name' = 'Jean Flore' returning 1)
select count(*) = 0 as ok_b_kan_a_niet_wissen from d;

-- Anon kan de functies niet gebruiken.
reset role;
select not has_function_privilege('anon', 'public.bak_get_linked(integer)', 'execute') as ok_anon_geen_toegang;
set local role authenticated;

-- Ontkoppelen kan aan beide kanten; daarna ziet B niets meer.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
delete from public.bak_links;
select count(*) = 0 as ok_ontkoppeld from public.bak_links;
select count(*) = 0 as ok_na_ontkoppelen_niets from public.bak_get_linked();

reset role;
rollback;
