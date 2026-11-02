# Wekkers (meldingen) instellen

**Status:** nog niet ingesteld. Zonder dit werkt Crumbly volledig, alleen zonder meldingen:
de uren staan altijd in het bakplan.

## Hoe het werkt
1. De app zet de komende wekkers (bakstappen met een bel, en eventueel de voeding) in
   `bak_reminders`, telkens na een wijziging.
2. Elke minuut kijkt de database (`pg_cron`, `private.bak_send_due()`) of er wekkers aan de beurt
   zijn. Alleen dan roept ze `/api/push/send` op de site aan, met een geheim.
3. De route verstuurt de melding naar elk toestel van die gebruiker (web-push).
Een melding kan een paar minuten later komen. Wat meer dan 30 minuten te laat is, vervalt.

Op een iPhone werkt dit enkel als Crumbly op het beginscherm staat (iOS 16.4 of nieuwer), en de
toestemming komt uit een tik op "Meldingen aanzetten" in Instellingen. Of het in België
betrouwbaar werkt, moet op haar toestel getest worden.

## 1. Sleutels maken en in Vercel zetten
```
npx web-push generate-vapid-keys
```
Vercel (project crumbly), Production en Preview:

| Naam | Waarde |
| --- | --- |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | de publieke sleutel |
| `VAPID_PRIVATE_KEY` | de private sleutel (geheim) |
| `CRON_SECRET` | willekeurige tekst van minstens 32 tekens (geheim) |
| `CONTACT_EMAIL` | contactadres voor de push-diensten |

Daarna opnieuw deployen (`EXPO_PUBLIC_` wordt bij het bouwen ingevuld).

## 2. Geheimen in de kluis van Supabase
```sql
select vault.create_secret('<hetzelfde als CRON_SECRET>', 'bak_push_secret');
select vault.create_secret('https://<crumbly-domein>/api/push/send', 'bak_push_url');
```

## 3. Planning aanzetten
`supabase/migrations/20261102120100_crumbly_wekkers.sql` uitvoeren (na Tuurs ok).
Uitzetten: `select cron.unschedule('crumbly-wekkers');`
