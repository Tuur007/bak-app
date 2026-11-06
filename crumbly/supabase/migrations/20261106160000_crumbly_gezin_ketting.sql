-- Crumbly: geen ketting van gezinnen. Een gezinscode die iemand maakte VOOR hij zelf lid werd van een ander gezin, bleef
-- tot een dag geldig. Wie zo'n code gebruikte, kwam dan in het gezin van iemand die zelf al lid is: A is lid van B en
-- C wordt lid van A, terwijl niemand op de gegevens van A werkt. Nu weigert bak_join_household zo'n code.
-- Verder identiek aan 20261106140000_crumbly_gezin.sql. Raakt enkel bak_*. TOEGEPAST op 6 november 2026 na Tuurs ok
-- (gecontroleerd). Test: supabase/tests/crumbly_gezin_ketting_test.sql.

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
  if exists (select 1 from public.bak_household_members where member = v_row.owner) then
    raise exception 'Deze code hoort bij iemand die zelf in een gezin zit. Vraag een nieuwe code aan de eigenaar van dat gezin';
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

revoke all on function public.bak_join_household(text, text) from public, anon;
grant execute on function public.bak_join_household(text, text) to authenticated;
