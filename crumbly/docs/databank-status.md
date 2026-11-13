# Databank: wat staat er echt

De SQL-bestanden in `supabase/migrations/` zijn wat we *willen*. Of de databank ze ook heeft, controleer je in Supabase
(project `lvxvmubvvlujjmhdqzrk`, gedeeld met Recepten, Tuin en Op reis). Stand gecontroleerd op **6 november 2026**
(enkel gelezen, niets gewijzigd; de laatste twee migraties zijn die avond na Tuurs ok toegepast en daarna gecontroleerd):

| Migratie | Inhoud | Stand |
| --- | --- | --- |
| `20261102120000_crumbly.sql` | `bak_items`, `bak_reminders`, `bak_push_subscriptions`, trigger `bak_items_guard` | toegepast |
| `20261102120100_crumbly_wekkers.sql` | `private.bak_send_due()`, pg_cron-taak `crumbly-wekkers` (elke minuut), kluisgeheimen `bak_push_secret` en `bak_push_url` | toegepast |
| `20261106120000_crumbly_koppelen.sql` | `bak_links`, `bak_link_codes`, `bak_create_link_code`, `bak_redeem_link_code`, `bak_get_linked` | toegepast |
| `20261106140000_crumbly_gezin.sql` | `bak_household_members`, `bak_household_codes`, extra regels op `bak_items`, functies voor het gezin | toegepast |
| `20261106130000_crumbly_koppelcode_blijft.sql` | blijvende koppelcode, `bak_my_link_code` | toegepast (vastgesteld op 13 november 2026: `bak_my_link_code()` en `bak_create_link_code(p_new boolean)` staan in de databank) |
| `20261106150000_crumbly_wekkers_betrouwbaar.sql` | herkansing en controle van wekkers, verlopen abonnementen wissen | toegepast (6 november 2026; kolommen, functies en pg_cron-taak `crumbly-wekkers-controle` staan er, beide taken lopen zonder fout). De proef met een echte melding op een toestel moet nog. |
| `20261106160000_crumbly_gezin_ketting.sql` | `bak_join_household` weigert een code van iemand die zelf al in een gezin zit (geen ketting) | toegepast (6 november 2026) |

De migraties van Supabase zelf (`list_migrations`) tonen deze niet: ze zijn via de SQL-editor uitgevoerd. Vergelijk daarom
de objecten, niet de lijst.

## Zelf controleren (alleen lezen)
```sql
-- tabellen, beveiliging en rechten
select c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as regels
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'bak\_%' order by 1;

-- functies, en voor wie ze uitgevoerd mogen worden (anon hoort er nooit tussen)
select n.nspname, p.proname, pg_get_function_arguments(p.oid) as args, p.prosecdef as security_definer,
       (select string_agg(distinct r.rolname, ',') from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
        join pg_roles r on r.oid = x.grantee where x.privilege_type='EXECUTE') as execute_voor
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname like 'bak\_%' order by 1,2;

-- planning en geheimen (enkel de namen, nooit de waarden)
select jobname, schedule, active from cron.job where jobname like 'crumbly%';
select name from vault.secrets where name like 'bak\_%';
```
Verwacht na de eerste vier migraties: 7 tabellen met RLS aan (`bak_items`, `bak_reminders`, `bak_push_subscriptions`,
`bak_links`, `bak_link_codes`, `bak_household_members`, `bak_household_codes`), geen enkele functie uitvoerbaar voor `anon`,
en `bak_items` met 4 regels (je eigen rijen plus 3 voor het gezin).

## Bekende aandachtspunten (nog niet aangepast in de databank)
- **Tabelrechten voor `anon`.** `bak_items`, `bak_reminders` en `bak_push_subscriptions` hebben door de standaardrechten van
  Supabase alle tabelrechten voor `anon`. De RLS laat `anon` niets zien of doen (alle regels gelden enkel voor
  `authenticated`), dus er is geen lek, maar de rechten zelf zijn overbodig. Netter:
  ```sql
  revoke all on public.bak_items, public.bak_reminders, public.bak_push_subscriptions from anon;
  ```
- **`bak_items_guard` en `now()`.** `server_updated_at` is de starttijd van de transactie, dus alle rijen van één bulk-upsert
  hebben dezelfde waarde. De app houdt daar rekening mee (cursor op servertijd en id, overlappend venster), dus de trigger
  hoeft niet te veranderen.
