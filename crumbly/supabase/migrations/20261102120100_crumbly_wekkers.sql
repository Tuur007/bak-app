-- Crumbly: wekkers versturen. Elke minuut kijkt de database of er wekkers aan de beurt zijn.
-- Enkel dan roept ze de route /api/push/send op de site aan (pg_net), met een geheim.
--
-- Vereist twee geheimen in de kluis (Vault), NIET in de repo:
--   bak_push_secret  hetzelfde als CRON_SECRET in Vercel (project crumbly)
--   bak_push_url     https://<crumbly-domein>/api/push/send
-- Zie docs/meldingen-instellen.md. NIET TOEGEPAST: pas na Tuurs ok.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function private.bak_send_due()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
  v_payload jsonb;
begin
  -- Zonder geheimen in de kluis doen we niets (en blijven de wekkers staan).
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'bak_push_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'bak_push_url';
  if v_secret is null or v_url is null then
    return null;
  end if;

  -- Wat te laat is (meer dan 30 minuten), sturen we niet meer: dat helpt niemand.
  update public.bak_reminders set sent_at = now()
  where sent_at is null and due_at <= now() - interval '30 minutes';

  with due as (
    update public.bak_reminders r
    set sent_at = now()
    where r.sent_at is null and r.due_at <= now()
    returning r.user_id, r.id, r.title, r.body, r.url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tag', d.id, 'title', d.title, 'body', d.body, 'url', d.url,
    'subs', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
      from public.bak_push_subscriptions s where s.user_id = d.user_id
    )
  )), '[]'::jsonb)
  into v_payload
  from due d;

  if jsonb_array_length(v_payload) = 0 then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function private.bak_send_due() from public, anon, authenticated;

select cron.schedule('crumbly-wekkers', '* * * * *', 'select private.bak_send_due()');
