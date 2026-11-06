-- Nagemaakte Supabase-onderdelen voor een LOKALE Postgres, om de Crumbly-tests buiten Supabase te draaien:
-- auth (gebruikers en auth.uid()), private, vault, cron en pg_net. Gebruik het nooit in het echte project.
create schema if not exists auth;
create schema if not exists private;
create schema if not exists vault;
create schema if not exists cron;
create schema if not exists net;

create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;

-- vault: de twee geheimen die de wekker-functie leest
create table if not exists vault.decrypted_secrets (name text primary key, decrypted_secret text);
insert into vault.decrypted_secrets values ('bak_push_secret', 'geheim-voor-de-test'), ('bak_push_url', 'https://crumbly.test/api/push/send') on conflict do nothing;

-- cron: enkel onthouden wat gepland werd
create table if not exists cron.planned (name text, schedule text, command text);
create or replace function cron.schedule(job text, sched text, cmd text) returns bigint language sql as $$ insert into cron.planned values (job, sched, cmd) returning 1::bigint $$;

-- pg_net: een aanvraag krijgt een nummer en een antwoord komt pas als de test er een zet
create sequence if not exists net.request_seq;
create table if not exists net._http_response (id bigint primary key, status_code integer, content text, timed_out boolean, error_msg text, created timestamptz default now());
create table if not exists net._calls (id bigint primary key, url text, body jsonb, headers jsonb);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$
declare v_id bigint := nextval('net.request_seq');
begin
  insert into net._calls values (v_id, url, body, headers);
  return v_id;
end $$;
