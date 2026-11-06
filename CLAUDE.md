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
  Startgegevens (Jean, voorbeeldrecept, instellingen) hebben vaste id's en tijd 1970
  (`src/domain/defaults.ts`), zodat echte gegevens uit de cloud altijd winnen op een nieuw toestel.
  Samenvoegen is puur: `src/store/merge.ts` (getest).
  Selecteer in componenten de ruwe lijst (`s.bakes`) en filter daarna: een selector die
  telkens een nieuwe lijst geeft, laat zustand eindeloos hertekenen.
- `src/services/sync.ts`: upsert naar `bak_items` (sleutel user_id+id), ophalen op
  `server_updated_at`, laatste wijziging wint (ook in de databank, trigger). Daarna de
  openstaande wekkers vervangen in `bak_reminders`.
- Account: eerst aanmelden voor je iets van de app ziet (`AanmeldScherm` in `app/_layout.tsx`, formulier in
  `src/ui/AuthForm.tsx`; zonder Supabase-gegevens, bv. lokaal testen, geldt dit niet). Services in `src/services/auth.ts`.
  Zelfde `auth.users` als Recepten, Tuin en Op reis. De bevestigingsmail stuurt terug naar de site
  als `https://crumbly.vercel.app` in Supabase, Authentication, URL Configuration, Redirect URLs staat.
- Foto van het brood: verkleind tot 480 px JPEG (data-URL) in `BakeResult.photo`, synct mee
  in `bak_items` (geen opslagbucket). Ongeveer 2 MB per jaar bij een brood per week.
- Wekkers naar de server: enkel verschillen (`diffReminders`); ids die met `test:` beginnen (de
  testmelding in Instellingen) worden nooit door de planning gewist. De sync-kern staat in
  `src/services/syncCore.ts` (getest met een nepdatabank in `tests/sync.test.ts`), `sync.ts` koppelt ze
  aan de winkel en Supabase. Mislukt synchroniseren verschijnt op het startscherm.
- Eerlijke wekkers: `src/services/alarmState.ts` zegt of de bel echt kan afgaan (account, meldingen aan,
  beginscherm). Het bakplan toont anders een uitleg. Instellingen heeft "Stuur mij een testmelding".
- Stapkaart (`src/ui/StepCard.tsx`, logica in `stepHeadline`): "Nu", "Wachten" (telt af tot het einde van het
  wachten, met de controle "is het deeg klaar?") en "Volgende stap". "Deeg is klaar" laat de volgende stap nu
  beginnen en schuift de rest mee (`finishWaitNow`).
- Keukentemperatuur (`src/domain/temperature.ts`): enkel als een recept `refTempC` heeft, en enkel voor
  stappen met `tempSensitive`. Grove vuistregel (per 10 graden koeler `tempDoubling` keer langer, standaard 2),
  geen gemeten tabel; aanpasbaar in Instellingen. Een gebruiker die zelf andere waarden ziet, wint.
- Minder werk voor de gebruiker (feedback van zus, 3 november): `starter.autoFeedAt` laat Crumbly de dagelijkse
  voeding zelf noteren (`dueAutoFeeds`, nooit met terugwerkende kracht voor de startdag, niet tijdens weg, een
  verwijderde voeding komt niet terug), en `PeakQuestion` stelt één vraag per dag ("binnen 4/6/8 u", `feedToAsk`).
  Antwoorden zijn schattingen (`peakApprox`). Een recept uit het boek omzetten: `src/domain/recipeText.ts`
  (plakken of "Tekst scannen" op de iPhone), altijd met waarschuwingen om na te kijken.
- Eerste keer: `app/welkom.tsx` (naam en startdatum van de starter, thuis-momenten, eigen recept, uitleg van
  de woorden uit `src/domain/glossary.ts`). `settings.onboarded` synct mee, zodat een tweede toestel niet opnieuw begint.
- Koppelen (twee accounts, enkel lezen): `bak_links` + `bak_link_codes` + functies `bak_create_link_code`,
  `bak_redeem_link_code`, `bak_get_linked` (migratie `20261106120000_crumbly_koppelen.sql`, test
  `supabase/tests/crumbly_koppelen_test.sql`). De ander krijgt enkel `starter`- en `feed`-rijen, via de functie; de
  RLS van `bak_items` blijft eigen rijen. Lokaal staat dat apart in `store.peers` (`src/domain/peers.ts`,
  `src/services/peers.ts`), nooit in `dirty` en nooit door `mergeRemote` (alle starters hebben hetzelfde vaste id en
  zouden de eigen starter overschrijven). Tabblad Starter heeft een keuze tussen eigen en gekoppelde starter
  (`PeerView`); het startscherm toont bovenaan wie welke starter heeft (`StarterOverview`, met naam kiezen en weg naar
  `app/koppelen.tsx`); de koppelcode staat in `src/ui/Koppelen.tsx` (ook in Instellingen). `Starter.splitFrom/splitOn` noteert waarvan je gesplitst bent.
- Meldingen: `bak_push_subscriptions` + `private.bak_send_due()` (pg_cron elke minuut) ->
  `api/push/send.js` (Vercel, web-push). Zie `crumbly/docs/meldingen-instellen.md`.
- Tijden altijd als absolute momenten; aftellen rekent vanaf de klok (iOS pauzeert timers).

## Online
Vercel-project `crumbly` (team tuur007s-projects), Root Directory `crumbly`, Node 22.
Productie: https://crumbly.vercel.app (na merge naar main). Previews achter de Vercel-login.
Databank: tabellen en wekker-functie staan live (2 november 2026). Kluisgeheimen en VAPID-sleutels: zie
`crumbly/docs/meldingen-instellen.md`.

## Testen
`cd crumbly && npm test && npm run typecheck`. Webbouw: `npx expo export --platform web`.
CI (`.github/workflows/ci.yml`) draait dit bij elke PR en bij een wijziging op main.

## Bekende grenzen
- Niet getest op een echte iPhone (meldingen in België, beginscherm, toetsenbord).
- Het voorbeeldrecept en de tijden zijn een vertrekpunt, geen advies.
- `npm audit` meldt bekende kwetsbaarheden, vooral in Expo-bouwhulpmiddelen; oplossen vraagt een Expo-upgrade.
