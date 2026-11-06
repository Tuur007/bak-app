-- Crumbly: een geldige koppelcode blijft bestaan.
-- Vroeger maakte elke tik op "Maak een koppelcode" een nieuwe code en verviel de vorige. Met twee
-- toestellen op hetzelfde account (iPhone en iPad) verdween zo de code die je net doorgaf.
-- Nu geeft bak_create_link_code de bestaande, nog geldige en ongebruikte code terug; enkel met
-- p_new = true komt er een nieuwe (en vervalt de oude). bak_my_link_code toont je geldige code.
-- Raakt geen tabellen van andere apps aan. NIET TOEGEPAST: pas na Tuurs ok.

-- De oude functie zonder parameter weg, anders zijn er twee versies en weet de API niet welke.
drop function if exists public.bak_create_link_code();

create or replace function public.bak_create_link_code(p_new boolean default false)
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
  if not coalesce(p_new, false) then
    select c.code into v_code from public.bak_link_codes c
    where c.user_id = v_me and c.used_at is null and c.expires_at > now()
    order by c.created_at desc
    limit 1;
    if v_code is not null then
      return v_code;
    end if;
  end if;
  delete from public.bak_link_codes where user_id = v_me and used_at is null;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.bak_link_codes (code, user_id) values (v_code, v_me);
  return v_code;
end;
$$;

-- Je geldige, ongebruikte code (of niets).
create or replace function public.bak_my_link_code()
returns table (code text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.expires_at from public.bak_link_codes c
  where c.user_id = (select auth.uid()) and c.used_at is null and c.expires_at > now()
  order by c.created_at desc
  limit 1;
$$;

revoke all on function public.bak_create_link_code(boolean) from public, anon;
revoke all on function public.bak_my_link_code() from public, anon;
grant execute on function public.bak_create_link_code(boolean) to authenticated;
grant execute on function public.bak_my_link_code() to authenticated;

-- De API meteen de nieuwe functies laten kennen.
notify pgrst, 'reload schema';
