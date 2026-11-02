# Crumbly (bak-app) — Claude Code context

Zuurdesem-app voor de zus van Tuur: starter (Jean), recepten op de gram, bakplan met uren
en wekkers, "ik ben weg", en een logboek van de broden. Eén gebruiker. Webapp op het
beginscherm van haar iPhone (iOS 26). Onderzoek en ontwerp: `rapport/`, `mockups/`, `voor-zus/`.
De app zelf staat in `crumbly/`.

## Werkafspraak (zoals de Recepten- en Tuin-app)
- Elke wijziging via een PR. Geef Tuur de testlink van Vercel (branch-link), pas als de
  deployment `READY` is.
- **Mergen enkel na een uitdrukkelijk "merge" van Tuur.**
- **Databankwijzigingen** (gedeeld project `lvxvmubvvlujjmhdqzrk`, ook Recepten, Tuin en
  Op reis) staan meteen live: eerst testen in een teruggedraaide transactie
  (`crumbly/supabase/tests/`), pas toepassen na Tuurs ok. Raak geen tabellen van de andere
  apps aan. Een account (rij in `auth.users`) wordt vanuit deze app nooit gewist.

## Stack
Expo 54 + expo-router 6, React 19.1, RN 0.81.5 (enkel web gebruikt), TS strict,
Zustand 5 + Immer + persist (AsyncStorage = localStorage op web), Supabase.
`babel.config.js` zet `unstable_transformImportMeta` aan: zustand 5 gebruikt `import.meta`.
Lettertypes: Young Serif (titels) en Figtree; importeer per gewicht (`@expo-google-fonts/figtree/700Bold`),
anders komen alle gewichten in de bundel.

## Huisstijl: look A "Scandi terracotta" (`crumbly/src/ui/theme.ts`)
Kalkwit #F6F0E6, kaart #FCF9F4, inkt #2A2522, terracotta #B04E33 (actie), donkergroen
#2F4A3E (structuur), bordeaux #6B2737 (punch: nu, let op, wekker aan), blush #EBD2C4.
Terracotta nooit als kleine tekst op blush (3,7:1). Boog als speelse vorm.
Regels: geen emoji, geen Engels in de app, 8px-raster, tikdoel minstens 44 px, geen
gradients of harde schaduwen. Icoon: tarwe-aar met boog (`crumbly/public/icons/icon.svg`).

## Architectuur
- `src/domain/`: pure logica, getest (`npm test`): ratio's (alles op totaal meel, water uit
  de starter telt mee), starter (klaar-schatting), schema (terugrekenen, schuiven, thuis-momenten,
  weg), wekkers.
- `src/store/store.ts`: lokaal de bron van waarheid (werkt offline). Wijzigingen in `dirty`.
  Selecteer in componenten de ruwe lijst (`s.bakes`) en filter daarna: een selector die
  telkens een nieuwe lijst geeft, laat zustand eindeloos hertekenen.
- `src/services/sync.ts`: upsert naar `bak_items` (sleutel user_id+id), ophalen op
  `server_updated_at`, laatste wijziging wint (ook in de databank, trigger). Daarna de
  openstaande wekkers vervangen in `bak_reminders`.
- Meldingen: `bak_push_subscriptions` + `private.bak_send_due()` (pg_cron elke minuut) ->
  `api/push/send.js` (Vercel, web-push). Zie `crumbly/docs/meldingen-instellen.md`.
- Tijden altijd als absolute momenten; aftellen rekent vanaf de klok (iOS pauzeert timers).

## Testen
`cd crumbly && npm test && npm run typecheck`. Webbouw: `npx expo export --platform web`.
