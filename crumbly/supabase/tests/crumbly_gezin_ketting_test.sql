-- Test voor 20261106160000_crumbly_gezin_ketting.sql (na de migratie uitvoeren). Draait in een transactie en draait
-- zichzelf terug; het laatste resultaat moet "alles ok" zijn.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'crumbly-b@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'crumbly-a@test.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'crumbly-c@test.invalid');

set local role authenticated;

do $$
declare
  codeA text; codeB text; n int;
  b constant text := '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
  a constant text := '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
  c constant text := '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
begin
  -- A maakt een gezinscode (A is dan nog niemands lid)...
  perform set_config('request.jwt.claims', a, true);
  codeA := public.bak_create_household_code();
  -- ...en wordt daarna lid van het gezin van B.
  perform set_config('request.jwt.claims', b, true);
  codeB := public.bak_create_household_code();
  perform set_config('request.jwt.claims', a, true);
  perform public.bak_join_household(codeB, 'A');
  -- C probeert de oude code van A te gebruiken: dat mag niet meer (geen ketting).
  perform set_config('request.jwt.claims', c, true);
  begin perform public.bak_join_household(codeA, 'C'); raise exception 'ketting van gezinnen aanvaard';
  exception when others then if sqlerrm = 'ketting van gezinnen aanvaard' then raise; end if; end;
  select count(*) into n from public.bak_household_members;
  if n <> 0 then raise exception 'C ziet lidmaatschappen terwijl hij nergens lid van is'; end if;
  -- De gewone weg blijft werken: C wordt lid van B.
  perform set_config('request.jwt.claims', b, true);
  select code into codeB from public.bak_my_household_code();
  -- (de code van B is gebruikt door A: maak een nieuwe)
  codeB := public.bak_create_household_code();
  perform set_config('request.jwt.claims', c, true);
  perform public.bak_join_household(codeB, 'C');
  select count(*) into n from public.bak_household_members where member = '33333333-3333-4333-8333-333333333333';
  if n <> 1 then raise exception 'C kon niet bij het gezin van B'; end if;
end $$;

reset role;
select 'alles ok' as resultaat;
rollback;
