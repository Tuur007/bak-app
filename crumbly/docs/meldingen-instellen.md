# Wekkers (meldingen) instellen

**Status:** alles staat ingesteld (2 november 2026): tabellen, wekker-functie, sleutels in Vercel en geheimen in de kluis. Of de meldingen op de iPhone in België betrouwbaar aankomen, is nog te testen. Zonder dit werkt Crumbly volledig, alleen zonder meldingen:
de uren staan altijd in het bakplan.

## Hoe het werkt
1. De app zet de komende wekkers (bakstappen met een bel, en eventueel de voeding) in
   `bak_reminders`, telkens na een wijziging.
2. Elke minuut kijkt de database (`pg_cron`, `private.bak_send_due()`) of er wekkers aan de beurt
   zijn. Alleen dan roept ze `/api/push/send` op de site aan, met een geheim.
3. De route verstuurt de melding naar elk toestel van die gebruiker (web-push).
Een melding kan een paar minuten later komen. Wat meer dan 30 minuten te laat is, vervalt.

**Betrouwbaarheid** (migratie `20261106150000_crumbly_wekkers_betrouwbaar.sql`, na toepassen): de database leest elke minuut de
antwoorden van de route (`private.bak_push_check()`, taak `crumbly-wekkers-controle`). Verlopen abonnementen (404/410) worden gewist.
Kwam er niets aan (fout, time-out, geen antwoord), dan volgt een nieuwe poging, hoogstens 3, zolang de wekker niet meer dan 30
minuten te laat is. Kwam hij bij minstens één toestel aan, dan is hij bevestigd en volgt er geen herhaling (geen dubbele meldingen).
Wat niet lukte, blijft zichtbaar in `bak_reminders.last_error`. Zonder die migratie wordt een wekker vóór het verzenden als
verstuurd gemarkeerd en gaat hij bij een storing stilletjes verloren. De app zelf herstelt een weggevallen abonnement bij het
openen (`refreshPushSubscription`).

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

Daarna opnieuw deployen (`EXPO_PUBLIC_` wordt bij het bouwen ingevuld).

## 2. Geheimen in de kluis van Supabase
```sql
select vault.create_secret('<hetzelfde als CRON_SECRET>', 'bak_push_secret');
select vault.create_secret('https://crumbly.vercel.app/api/push/send', 'bak_push_url');
```

## 3. Planning
Staat al aan (`crumbly-wekkers`, elke minuut). Zonder de geheimen uit stap 2 doet ze niets.
Uitzetten: `select cron.unschedule('crumbly-wekkers');`

## Testen
Instellingen, **Meldingen aanzetten**, daarna **Stuur mij een testmelding**. Binnen een minuut moet er een melding komen.
Komt er niets: kijk of Crumbly op het beginscherm staat, of je aangemeld bent, en of de geheimen in de kluis staan
(`select name from vault.decrypted_secrets where name like 'bak_push%'` moet twee rijen geven).
