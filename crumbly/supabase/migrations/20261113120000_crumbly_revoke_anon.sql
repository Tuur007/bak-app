-- Niet-aangemelde bezoekers (rol anon) hebben geen enkel recht nodig op de tabellen van Crumbly. De regels per rij
-- lieten hen al niets zien of doen, dus dit verandert niets voor de app; het haalt enkel overbodige rechten weg
-- (door de standaardrechten van Supabase stonden ze er toch op). Toegepast op 13 november 2026, na een test in een
-- teruggedraaide transactie (anon: geen rechten meer; authenticated: select, insert, update en delete ongewijzigd).
revoke all on public.bak_items, public.bak_reminders, public.bak_push_subscriptions from anon;
