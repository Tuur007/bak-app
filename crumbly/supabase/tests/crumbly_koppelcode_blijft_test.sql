-- Test voor 20261106130000_crumbly_koppelcode_blijft.sql (na de migratie uitvoeren).
-- Draait in een transactie en draait zichzelf terug. Werkt ook in de SQL-editor van Supabase:
-- geen tijdelijke tabellen; elke controle stopt met een foutmelding als ze faalt.
-- Het laatste resultaat moet zijn: "alles ok".
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'crumbly-a@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'crumbly-b@test.invalid');

set local role authenticated;

do $$
declare
  c1 text; c2 text; c3 text; mine record; n int;
begin
  -- A maakt een code, en krijgt bij een tweede vraag dezelfde terug (ook vanop een ander toestel).
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  c1 := public.bak_create_link_code();
  if length(c1) <> 10 then raise exception 'code is geen 10 tekens: %', c1; end if;
  if public.bak_create_link_code() <> c1 then raise exception 'tweede vraag gaf een andere code'; end if;
  if public.bak_create_link_code(false) <> c1 then raise exception 'p_new=false gaf een andere code'; end if;

  -- bak_my_link_code toont die code, met een einddatum in de toekomst.
  select * into mine from public.bak_my_link_code();
  if mine.code is distinct from c1 then raise exception 'mijn code is niet %: %', c1, mine.code; end if;
  if mine.expires_at <= now() then raise exception 'code is al verlopen'; end if;

  -- Een nieuwe code op vraag: de oude vervalt.
  c2 := public.bak_create_link_code(true);
  if c2 = c1 then raise exception 'nieuwe code is dezelfde'; end if;
  select count(*) into n from public.bak_my_link_code();
  if n <> 1 then raise exception 'er moet precies een geldige code zijn, niet %', n; end if;

  -- B kan de oude code niet meer gebruiken, de nieuwe wel.
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform public.bak_redeem_link_code(c1);
    raise exception 'oude code werd nog aanvaard';
  exception when others then
    if sqlerrm = 'oude code werd nog aanvaard' then raise; end if;
  end;
  perform public.bak_redeem_link_code(c2);
  select count(*) into n from public.bak_links;
  if n <> 1 then raise exception 'koppeling niet gemaakt'; end if;
  -- B heeft zelf geen code.
  select count(*) into n from public.bak_my_link_code();
  if n <> 0 then raise exception 'B heeft een code die hij niet maakte'; end if;

  -- A: de gebruikte code is weg, een nieuwe vraag geeft een nieuwe code.
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  select count(*) into n from public.bak_my_link_code();
  if n <> 0 then raise exception 'gebruikte code wordt nog getoond'; end if;
  c3 := public.bak_create_link_code();
  if c3 = c2 or c3 = c1 then raise exception 'na gebruik kwam een oude code terug'; end if;
end $$;

reset role;

do $$
declare n int;
begin
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public' and p.proname = 'bak_create_link_code';
  if n <> 1 then raise exception 'er zijn % versies van bak_create_link_code', n; end if;
  if has_function_privilege('anon', 'public.bak_create_link_code(boolean)', 'execute') then raise exception 'anon mag codes maken'; end if;
  if has_function_privilege('anon', 'public.bak_my_link_code()', 'execute') then raise exception 'anon mag codes lezen'; end if;
  if not has_function_privilege('authenticated', 'public.bak_my_link_code()', 'execute') then raise exception 'aangemelde gebruiker mag code niet lezen'; end if;
end $$;

select 'alles ok' as resultaat;

rollback;
