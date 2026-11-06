-- Test voor 20261106150000_crumbly_wekkers_betrouwbaar.sql, in een LOKALE Postgres met de nagemaakte
-- onderdelen uit shims/supabase_basis.sql (nagemaakte pg_net en vault). In het echte project kan dit niet: daar
-- stuurt pg_net echte aanvragen en kan je geen antwoorden verzinnen. Daar test je met "Stuur mij een testmelding".
--
--   initdb en start een Postgres, daarna:
--   psql -f shims/supabase_basis.sql -f ../migrations/20261102120000_crumbly.sql -f ../migrations/20261106150000_crumbly_wekkers_betrouwbaar.sql -f crumbly_wekkers_betrouwbaar_test.sql
--
-- Draait in een transactie en draait zichzelf terug. Het laatste resultaat moet "alles ok" zijn.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'zonder-toestel@test.invalid');
insert into public.bak_push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('11111111-1111-4111-8111-111111111111', 'https://push.test/a1', 'p', 'a'),
  ('22222222-2222-4222-8222-222222222222', 'https://push.test/b1', 'p', 'a');

create function pg_temp.rem(p_user text, p_id text, p_due interval) returns void language sql as $$
  insert into public.bak_reminders (user_id, id, due_at, title, body, url) values (p_user::uuid, p_id, now() + p_due, 'Bâtard', 'Nu: vouwen', '/plan');
$$;
create function pg_temp.antwoord(p_req bigint, p_status integer, p_content text, p_timeout boolean default false) returns void language sql as $$
  insert into net._http_response (id, status_code, content, timed_out) values (p_req, p_status, p_content, p_timeout);
$$;
create function pg_temp.rij(p_user text, p_id text) returns public.bak_reminders language sql as $$
  select r from public.bak_reminders r where r.user_id = p_user::uuid and r.id = p_id;
$$;

do $$
declare
  a constant text := '11111111-1111-4111-8111-111111111111';
  b constant text := '22222222-2222-4222-8222-222222222222';
  z constant text := '33333333-3333-4333-8333-333333333333';
  req bigint; r public.bak_reminders; n int;
begin
  -- 1. Een wekker die aan de beurt is, met een toestel: verstuurd, aanvraag onthouden, poging 1.
  perform pg_temp.rem(a, 'bak:1', interval '-1 minute');
  req := private.bak_send_due();
  if req is null then raise exception 'er werd niets verstuurd'; end if;
  r := pg_temp.rij(a, 'bak:1');
  if r.sent_at is null or r.attempts <> 1 or r.request_id <> req or r.confirmed_at is not null then raise exception 'wekker 1 niet goed gemarkeerd: %', r; end if;
  select count(*) into n from net._calls where id = req and jsonb_array_length(body) = 1 and body -> 0 ->> 'title' = 'Bâtard' and jsonb_array_length(body -> 0 -> 'subs') = 1 and headers ->> 'Authorization' = 'Bearer geheim-voor-de-test';
  if n <> 1 then raise exception 'de aanvraag heeft niet de verwachte inhoud'; end if;
  -- nog geen antwoord: de controle laat de wekker met rust, en er volgt geen tweede verzending
  perform private.bak_push_check();
  if (pg_temp.rij(a, 'bak:1')).confirmed_at is not null or (pg_temp.rij(a, 'bak:1')).sent_at is null then raise exception 'zonder antwoord mag er niets veranderen'; end if;
  if private.bak_send_due() is not null then raise exception 'dezelfde wekker werd twee keer verstuurd'; end if;

  -- 2. Antwoord: aangekomen -> bevestigd, geen fout.
  perform pg_temp.antwoord(req, 200, '{"sent":1,"failed":0,"gone":0,"goneEndpoints":[]}');
  perform private.bak_push_check();
  r := pg_temp.rij(a, 'bak:1');
  if r.confirmed_at is null or r.last_error is not null then raise exception 'wekker 1 niet bevestigd: %', r; end if;

  -- 3. De pushroute valt om (500): opnieuw proberen, tot drie keer, daarna opgeven met een reden.
  perform pg_temp.rem(a, 'bak:2', interval '-1 minute');
  for i in 1..3 loop
    req := private.bak_send_due();
    if req is null then raise exception 'poging % werd niet verstuurd', i; end if;
    if (pg_temp.rij(a, 'bak:2')).attempts <> i then raise exception 'poging % niet geteld', i; end if;
    perform pg_temp.antwoord(req, 500, 'Internal Server Error');
    perform private.bak_push_check();
  end loop;
  r := pg_temp.rij(a, 'bak:2');
  if r.confirmed_at is null or r.last_error not like 'mislukt:%' or r.attempts <> 3 then raise exception 'na 3 mislukte pogingen moet de wekker opgegeven zijn: %', r; end if;
  if private.bak_send_due() is not null then raise exception 'een opgegeven wekker werd opnieuw verstuurd'; end if;

  -- 4. Alleen verlopen abonnementen (410): het abonnement wordt gewist, de wekker is niet te redden.
  perform pg_temp.rem(b, 'bak:3', interval '-1 minute');
  req := private.bak_send_due();
  perform pg_temp.antwoord(req, 200, '{"sent":0,"failed":0,"gone":1,"goneEndpoints":["https://push.test/b1"]}');
  perform private.bak_push_check();
  select count(*) into n from public.bak_push_subscriptions where endpoint = 'https://push.test/b1';
  if n <> 0 then raise exception 'het verlopen abonnement werd niet gewist'; end if;
  r := pg_temp.rij(b, 'bak:3');
  if r.confirmed_at is null or r.last_error <> 'abonnement verlopen' then raise exception 'wekker 3: %', r; end if;
  select count(*) into n from public.bak_push_subscriptions where user_id = a::uuid;
  if n <> 1 then raise exception 'het abonnement van een ander werd gewist'; end if;

  -- 5. Een deel kwam aan, een deel mislukte: bevestigd, GEEN nieuwe poging (zou dubbele meldingen geven).
  insert into public.bak_push_subscriptions (user_id, endpoint, p256dh, auth) values (a::uuid, 'https://push.test/a2', 'p', 'a');
  perform pg_temp.rem(a, 'bak:4', interval '-1 minute');
  req := private.bak_send_due();
  perform pg_temp.antwoord(req, 200, '{"sent":1,"failed":1,"gone":0,"goneEndpoints":[]}');
  perform private.bak_push_check();
  r := pg_temp.rij(a, 'bak:4');
  if r.confirmed_at is null or r.attempts <> 1 then raise exception 'gedeeltelijk gelukt moet bevestigd zijn: %', r; end if;

  -- 6. Time-out van pg_net: opnieuw proberen.
  perform pg_temp.rem(a, 'bak:5', interval '-1 minute');
  req := private.bak_send_due();
  perform pg_temp.antwoord(req, null, null, true);
  perform private.bak_push_check();
  r := pg_temp.rij(a, 'bak:5');
  if r.sent_at is not null or r.attempts <> 1 or r.last_error is null then raise exception 'na een time-out moet de wekker opnieuw klaarstaan: %', r; end if;
  req := private.bak_send_due();
  if req is null or (pg_temp.rij(a, 'bak:5')).attempts <> 2 then raise exception 'tweede poging na time-out niet verstuurd'; end if;
  perform pg_temp.antwoord(req, 200, '{"sent":1,"failed":0,"gone":0,"goneEndpoints":[]}');
  perform private.bak_push_check();
  if (pg_temp.rij(a, 'bak:5')).confirmed_at is null then raise exception 'wekker 5 niet bevestigd na de herkansing'; end if;

  -- 7. Nooit een antwoord (de aanvraag ging verloren): na 5 minuten opnieuw proberen.
  perform pg_temp.rem(a, 'bak:6', interval '-1 minute');
  req := private.bak_send_due();
  update public.bak_reminders set sent_at = now() - interval '6 minutes' where user_id = a::uuid and id = 'bak:6';
  perform private.bak_push_check();
  r := pg_temp.rij(a, 'bak:6');
  if r.sent_at is not null or r.last_error <> 'geen antwoord van de server' then raise exception 'zonder antwoord na 5 minuten moet er opnieuw geprobeerd worden: %', r; end if;

  -- 8. Zonder toestel: blijft staan, en verloopt na 30 minuten MET een reden (niet stil).
  perform pg_temp.rem(z, 'bak:7', interval '-1 minute');
  if private.bak_send_due() is not null and (pg_temp.rij(z, 'bak:7')).sent_at is not null then raise exception 'zonder toestel mocht er niets verstuurd worden'; end if;
  update public.bak_reminders set due_at = now() - interval '31 minutes' where user_id = z::uuid and id = 'bak:7';
  perform private.bak_send_due();
  r := pg_temp.rij(z, 'bak:7');
  if r.sent_at is null or r.last_error <> 'geen toestel voor meldingen' then raise exception 'wekker 7 moet verlopen zijn met een reden: %', r; end if;

  -- 9. Meer dan 30 minuten te laat wordt niet meer verstuurd, ook niet met een toestel.
  perform pg_temp.rem(a, 'bak:8', interval '-31 minutes');
  perform private.bak_send_due();
  r := pg_temp.rij(a, 'bak:8');
  if r.last_error <> 'te laat' or r.request_id is not null then raise exception 'te late wekker: %', r; end if;

  -- 11. De app past een wekker aan (zelfde id, andere tekst of tijd) en zet daarbij enkel sent_at weer op leeg: de oude
  --     bevestiging en poging mogen een nieuwe verzending niet blokkeren, en mislukt die, dan volgt een herkansing.
  perform pg_temp.rem(a, 'bak:10', interval '-1 minute');
  req := private.bak_send_due();
  perform pg_temp.antwoord(req, 200, '{"sent":1,"failed":0,"gone":0,"goneEndpoints":[]}');
  perform private.bak_push_check();
  if (pg_temp.rij(a, 'bak:10')).confirmed_at is null then raise exception 'wekker 10 niet bevestigd'; end if;
  update public.bak_reminders set sent_at = null, body = 'Nu: vouwen (aangepast)', due_at = now() - interval '1 minute' where user_id = a::uuid and id = 'bak:10';
  req := private.bak_send_due();
  if req is null then raise exception 'een aangepaste wekker werd niet opnieuw verstuurd'; end if;
  r := pg_temp.rij(a, 'bak:10');
  if r.confirmed_at is not null or r.attempts <> 1 then raise exception 'de oude bevestiging blokkeert de nieuwe verzending: %', r; end if;
  perform pg_temp.antwoord(req, 500, 'storing');
  perform private.bak_push_check();
  r := pg_temp.rij(a, 'bak:10');
  if r.sent_at is not null or r.last_error is null then raise exception 'mislukte verzending van een aangepaste wekker wordt niet herkanst: %', r; end if;

  -- 10. Een wekker in de toekomst wacht.
  perform pg_temp.rem(a, 'bak:9', interval '10 minutes');
  perform private.bak_send_due();
  if (pg_temp.rij(a, 'bak:9')).sent_at is not null then raise exception 'een wekker in de toekomst werd verstuurd'; end if;
end $$;

-- Aangemelde gebruikers en anonieme bezoekers kunnen de functies niet aanroepen.
do $$
begin
  if has_function_privilege('authenticated', 'private.bak_push_check()', 'execute') or has_function_privilege('anon', 'private.bak_send_due()', 'execute') then
    raise exception 'de wekker-functies zijn te bereiken voor gebruikers';
  end if;
  if (select count(*) from cron.planned where name = 'crumbly-wekkers-controle') < 1 then raise exception 'de controle is niet gepland'; end if;
end $$;

select 'alles ok' as resultaat;
rollback;
