-- Crumbly: wekkers gaan niet meer ongemerkt verloren.
--
-- Vroeger markeerde private.bak_send_due() een wekker als verstuurd VOOR de verzending en keek nooit naar het
-- antwoord van de pushroute. Mislukte de route (storing, time-out) of was er geen toestel, dan was de melding
-- stilletjes weg. Verlopen abonnementen (410/404) bleven eeuwig in de tabel staan.
--
-- Nu:
-- 1. bak_send_due() verstuurt enkel als de gebruiker een toestel heeft, onthoudt het aanvraag-nummer van pg_net en
--    telt de pogingen (hoogstens 3).
-- 2. bak_push_check() leest elke minuut de antwoorden. Verlopen abonnementen worden gewist. Kwam er niets aan
--    (fout, time-out of geen antwoord), dan volgt een nieuwe poging zolang de wekker niet meer dan 30 minuten te
--    laat is. Kwam hij bij minstens een toestel aan, dan is hij bevestigd (geen dubbele meldingen).
-- 3. Wat niet lukte, blijft zichtbaar in last_error, in plaats van te verdwijnen.
--
-- Raakt enkel bak_*-tabellen en private-functies van Crumbly. TOEGEPAST op 6 november 2026 na Tuurs ok
-- (gecontroleerd). Test: supabase/tests/crumbly_wekkers_betrouwbaar_test.sql (lokaal, met nagemaakte pg_net).

alter table public.bak_reminders
  add column if not exists attempts integer not null default 0,
  add column if not exists batch_id uuid,
  add column if not exists request_id bigint,
  add column if not exists confirmed_at timestamptz,
  add column if not exists last_error text check (last_error is null or length(last_error) <= 200);

create index if not exists bak_reminders_request_idx on public.bak_reminders (request_id) where request_id is not null and confirmed_at is null;

create or replace function private.bak_send_due()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
  v_batch uuid := gen_random_uuid();
  v_payload jsonb;
  v_req bigint;
begin
  -- Zonder geheimen in de kluis doen we niets (en blijven de wekkers staan).
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'bak_push_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'bak_push_url';
  if v_secret is null or v_url is null then
    return null;
  end if;

  -- Meer dan 30 minuten te laat helpt niemand meer. Noteer waarom, in plaats van het stil te laten verdwijnen.
  update public.bak_reminders r
  set sent_at = now(),
      last_error = case
        when not exists (select 1 from public.bak_push_subscriptions s where s.user_id = r.user_id) then 'geen toestel voor meldingen'
        when r.attempts > 0 then coalesce(r.last_error, 'niet aangekomen')
        else 'te laat'
      end
  where r.sent_at is null and r.due_at <= now() - interval '30 minutes';

  -- Aan de beurt: alleen met een toestel (anders blijft de wekker staan, voor het geval er nog een toestel bijkomt).
  with due as (
    select r.user_id, r.id
    from public.bak_reminders r
    -- Een wekker met een oude bevestiging is door de app aangepast en opnieuw klaargezet (sent_at leeg): die telt opnieuw.
    where r.sent_at is null and r.due_at <= now() and (r.attempts < 3 or r.confirmed_at is not null)
      and exists (select 1 from public.bak_push_subscriptions s where s.user_id = r.user_id)
    for update skip locked
  )
  update public.bak_reminders r
  set sent_at = now(),
      attempts = case when r.confirmed_at is not null then 1 else r.attempts + 1 end,
      confirmed_at = null, batch_id = v_batch, request_id = null, last_error = null
  from due
  where r.user_id = due.user_id and r.id = due.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'tag', d.id, 'title', d.title, 'body', d.body, 'url', d.url,
    'subs', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
      from public.bak_push_subscriptions s where s.user_id = d.user_id
    )
  )), '[]'::jsonb)
  into v_payload
  from public.bak_reminders d
  where d.batch_id = v_batch;

  if jsonb_array_length(v_payload) = 0 then
    return null;
  end if;

  v_req := net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 20000
  );
  update public.bak_reminders set request_id = v_req where batch_id = v_batch;
  return v_req;
end;
$$;

-- Leest de antwoorden van de pushroute en beslist per aanvraag: bevestigd, opnieuw proberen, of opgeven.
create or replace function private.bak_push_check()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  q record;
  v_resp record;
  v_body jsonb;
  v_sent integer;
  v_failed integer;
  v_outcome text;
  v_msg text;
  v_done integer := 0;
begin
  for q in
    select distinct r.request_id
    from public.bak_reminders r
    where r.request_id is not null and r.confirmed_at is null and r.sent_at is not null
  loop
    v_outcome := null;
    v_msg := null;
    select * into v_resp from net._http_response where id = q.request_id;

    if not found then
      -- Nog geen antwoord. Na 5 minuten nemen we aan dat de aanvraag verloren ging.
      if exists (select 1 from public.bak_reminders x where x.request_id = q.request_id and x.confirmed_at is null and x.sent_at < now() - interval '5 minutes') then
        v_outcome := 'fout';
        v_msg := 'geen antwoord van de server';
      else
        continue;
      end if;
    elsif v_resp.timed_out is true or v_resp.status_code is null or v_resp.status_code not between 200 and 299 then
      v_outcome := 'fout';
      v_msg := left('server gaf ' || coalesce(v_resp.status_code::text, coalesce(v_resp.error_msg, 'geen antwoord')), 120);
    else
      begin
        v_body := v_resp.content::jsonb;
      exception when others then
        v_body := null;
      end;
      v_sent := coalesce((v_body ->> 'sent')::integer, 0);
      v_failed := coalesce((v_body ->> 'failed')::integer, 0);
      -- Verlopen abonnementen (404/410) wissen: die komen nooit meer aan.
      if jsonb_typeof(v_body -> 'goneEndpoints') = 'array' then
        delete from public.bak_push_subscriptions s
        where s.endpoint in (select jsonb_array_elements_text(v_body -> 'goneEndpoints'));
      end if;
      if v_sent > 0 then
        v_outcome := 'ok';
      elsif v_failed > 0 then
        v_outcome := 'fout';
        v_msg := 'verzenden mislukt';
      else
        v_outcome := 'geen';
        v_msg := 'abonnement verlopen';
      end if;
    end if;

    if v_outcome = 'ok' then
      update public.bak_reminders set confirmed_at = now(), last_error = null where request_id = q.request_id and confirmed_at is null;
    elsif v_outcome = 'geen' then
      update public.bak_reminders set confirmed_at = now(), last_error = v_msg where request_id = q.request_id and confirmed_at is null;
    else
      -- Opnieuw proberen zolang het kan: hoogstens 3 pogingen en niet meer dan 30 minuten te laat.
      update public.bak_reminders
      set sent_at = null, request_id = null, batch_id = null, last_error = v_msg
      where request_id = q.request_id and confirmed_at is null and attempts < 3 and due_at > now() - interval '30 minutes';
      update public.bak_reminders
      set confirmed_at = now(), last_error = left('mislukt: ' || v_msg, 200)
      where request_id = q.request_id and confirmed_at is null;
    end if;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

revoke all on function private.bak_send_due() from public, anon, authenticated;
revoke all on function private.bak_push_check() from public, anon, authenticated;

-- De controle draait elke minuut, net als het versturen.
select cron.schedule('crumbly-wekkers-controle', '* * * * *', 'select private.bak_push_check()');
