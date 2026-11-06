-- Test voor 20261106140000_crumbly_gezin.sql (na de migratie uitvoeren; vereist de eerste Crumbly-migratie).
-- Draait in een transactie en draait zichzelf terug. Geen tijdelijke tabellen: werkt ook in de SQL-editor.
-- Elke controle stopt met een foutmelding als ze faalt; het laatste resultaat moet "alles ok" zijn.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'crumbly-owner@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'crumbly-lid@test.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'crumbly-derde@test.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'crumbly-ander@test.invalid');

insert into public.bak_items (user_id, id, kind, data, updated_at) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Jeanine","updatedAt":"2026-11-05T10:00:00Z"}', '2026-11-05T10:00:00Z'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'feed', '{"id":"aaaaaaaa-0000-4000-8000-000000000001","fedAt":"2026-11-05T18:00:00Z","updatedAt":"2026-11-05T18:00:00Z"}', '2026-11-05T18:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Louises eigen","updatedAt":"2026-11-05T10:00:00Z"}', '2026-11-05T10:00:00Z'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Van een derde","updatedAt":"2026-11-05T10:00:00Z"}', '2026-11-05T10:00:00Z');

set local role authenticated;

do $$
declare
  c1 text; c2 text; n int; ok boolean;
  eig constant text := '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
  lid constant text := '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
  derde constant text := '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
  ander constant text := '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
begin
  -- Voor het gezin: het lid ziet enkel zijn eigen rij, niets van de eigenaar.
  perform set_config('request.jwt.claims', lid, true);
  select count(*) into n from public.bak_items;
  if n <> 1 then raise exception 'lid ziet % rijen voor het gezin, verwacht 1', n; end if;

  -- De eigenaar maakt een code; een tweede vraag geeft dezelfde.
  perform set_config('request.jwt.claims', eig, true);
  c1 := public.bak_create_household_code();
  if length(c1) <> 10 then raise exception 'code is geen 10 tekens: %', c1; end if;
  if public.bak_create_household_code() <> c1 then raise exception 'tweede vraag gaf een andere code'; end if;
  select count(*) into n from public.bak_my_household_code();
  if n <> 1 then raise exception 'bak_my_household_code gaf % rijen', n; end if;

  -- Eigen code inwisselen mag niet; een foute code ook niet; zonder naam ook niet.
  begin perform public.bak_join_household(c1, 'Eigenaar'); raise exception 'eigen code aanvaard';
  exception when others then if sqlerrm = 'eigen code aanvaard' then raise; end if; end;
  perform set_config('request.jwt.claims', lid, true);
  begin perform public.bak_join_household('0000000000', 'Louise'); raise exception 'foute code aanvaard';
  exception when others then if sqlerrm = 'foute code aanvaard' then raise; end if; end;
  begin perform public.bak_join_household(c1, '   '); raise exception 'lege naam aanvaard';
  exception when others then if sqlerrm = 'lege naam aanvaard' then raise; end if; end;

  -- Het lid komt bij het gezin, ook met kleine letters en spaties.
  perform public.bak_join_household(' ' || lower(c1) || ' ', 'Louise');
  select count(*) into n from public.bak_household_members;
  if n <> 1 then raise exception 'lid ziet % lidmaatschappen, verwacht 1', n; end if;

  -- De code is gebruikt: een derde kan ze niet meer inwisselen.
  perform set_config('request.jwt.claims', derde, true);
  begin perform public.bak_join_household(c1, 'Derde'); raise exception 'gebruikte code opnieuw aanvaard';
  exception when others then if sqlerrm = 'gebruikte code opnieuw aanvaard' then raise; end if; end;
  select count(*) into n from public.bak_items where user_id = '11111111-1111-4111-8111-111111111111';
  if n <> 0 then raise exception 'derde ziet rijen van de eigenaar'; end if;
  select count(*) into n from public.bak_household_members;
  if n <> 0 then raise exception 'derde ziet lidmaatschappen van een ander gezin'; end if;

  -- Het lid ziet nu de rijen van de eigenaar (en zijn eigen), niet die van de derde.
  perform set_config('request.jwt.claims', lid, true);
  select count(*) into n from public.bak_items where user_id = '11111111-1111-4111-8111-111111111111';
  if n <> 2 then raise exception 'lid ziet % rijen van de eigenaar, verwacht 2', n; end if;
  select count(*) into n from public.bak_items where user_id = '33333333-3333-4333-8333-333333333333';
  if n <> 0 then raise exception 'lid ziet rijen van een vreemde'; end if;

  -- Het lid voegt een voeding toe voor de eigenaar en past de starter aan (zoals de app doet: upsert).
  insert into public.bak_items (user_id, id, kind, data, updated_at)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'feed', '{"id":"aaaaaaaa-0000-4000-8000-000000000002","fedAt":"2026-11-06T08:00:00Z","by":"Louise","updatedAt":"2026-11-06T08:00:00Z"}', '2026-11-06T08:00:00Z')
  on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at;
  insert into public.bak_items (user_id, id, kind, data, updated_at)
  values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000057a7', 'starter', '{"id":"00000000-0000-4000-8000-0000000057a7","name":"Jeanine","location":"koelkast","updatedAt":"2026-11-06T09:00:00Z"}', '2026-11-06T09:00:00Z')
  on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at;

  -- Maar niet voor een vreemde, en niets wissen.
  begin
    insert into public.bak_items (user_id, id, kind, data, updated_at)
    values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000003', 'feed', '{}', '2026-11-06T08:00:00Z');
    raise exception 'lid schreef bij een vreemde';
  exception when others then if sqlerrm = 'lid schreef bij een vreemde' then raise; end if; end;
  with u as (update public.bak_items set data = '{"hacked":true}' where user_id = '33333333-3333-4333-8333-333333333333' returning 1)
  select count(*) into n from u;
  if n <> 0 then raise exception 'lid paste rijen van een vreemde aan'; end if;
  with d as (delete from public.bak_items where user_id = '11111111-1111-4111-8111-111111111111' returning 1)
  select count(*) into n from d;
  if n <> 0 then raise exception 'lid wiste rijen van de eigenaar'; end if;

  -- De eigenaar ziet wat het lid deed.
  perform set_config('request.jwt.claims', eig, true);
  select count(*) into n from public.bak_items where data ->> 'by' = 'Louise';
  if n <> 1 then raise exception 'eigenaar ziet de voeding van het lid niet'; end if;
  select count(*) into n from public.bak_items where kind = 'starter' and data ->> 'location' = 'koelkast';
  if n <> 1 then raise exception 'eigenaar ziet de aanpassing van het lid niet'; end if;
  -- De eigenaar ziet niets van de eigen rijen van het lid.
  select count(*) into n from public.bak_items where user_id = '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'eigenaar ziet de eigen rijen van het lid'; end if;

  -- Regels voor gezinnen: een lid maakt geen code, zit niet in twee gezinnen, en een eigenaar met leden wordt geen lid.
  perform set_config('request.jwt.claims', lid, true);
  begin perform public.bak_create_household_code(); raise exception 'lid maakte een gezinscode';
  exception when others then if sqlerrm = 'lid maakte een gezinscode' then raise; end if; end;
  perform set_config('request.jwt.claims', ander, true);
  c2 := public.bak_create_household_code();
  perform set_config('request.jwt.claims', lid, true);
  begin perform public.bak_join_household(c2, 'Louise'); raise exception 'lid kwam in twee gezinnen';
  exception when others then if sqlerrm = 'lid kwam in twee gezinnen' then raise; end if; end;
  perform set_config('request.jwt.claims', eig, true);
  begin perform public.bak_join_household(c2, 'Eigenaar'); raise exception 'eigenaar met leden werd lid';
  exception when others then if sqlerrm = 'eigenaar met leden werd lid' then raise; end if; end;

  -- Het lid verlaat het gezin en ziet de gegevens van de eigenaar niet meer.
  perform set_config('request.jwt.claims', lid, true);
  delete from public.bak_household_members;
  select count(*) into n from public.bak_items where user_id = '11111111-1111-4111-8111-111111111111';
  if n <> 0 then raise exception 'lid ziet na het verlaten nog rijen van de eigenaar'; end if;
  -- En kan met een nieuwe code weer terugkomen; de eigenaar kan een lid ook wegzetten.
  perform set_config('request.jwt.claims', eig, true);
  c1 := public.bak_create_household_code();
  perform set_config('request.jwt.claims', lid, true);
  perform public.bak_join_household(c1, 'Louise');
  perform set_config('request.jwt.claims', eig, true);
  delete from public.bak_household_members where member = '22222222-2222-4222-8222-222222222222';
  perform set_config('request.jwt.claims', lid, true);
  select count(*) into n from public.bak_items where user_id = '11111111-1111-4111-8111-111111111111';
  if n <> 0 then raise exception 'lid ziet na het wegzetten nog rijen van de eigenaar'; end if;

  -- Codes en lidmaatschappen zijn niet te wijzigen buiten de functies.
  begin
    insert into public.bak_household_members (owner, member, display_name) values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Ik zelf');
    raise exception 'lid voegde zichzelf toe';
  exception when others then if sqlerrm = 'lid voegde zichzelf toe' then raise; end if; end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.bak_join_household(text, text)', 'execute') then raise exception 'anon mag een gezin joinen'; end if;
  if has_function_privilege('anon', 'public.bak_create_household_code()', 'execute') then raise exception 'anon mag codes maken'; end if;
  if not has_function_privilege('authenticated', 'public.bak_join_household(text, text)', 'execute') then raise exception 'aangemelde gebruiker mag niet joinen'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'bak_items' and policyname = 'bak_items_own') <> 1 then raise exception 'de eigen-rijen-regel van bak_items ontbreekt'; end if;
end $$;

select 'alles ok' as resultaat;

rollback;
