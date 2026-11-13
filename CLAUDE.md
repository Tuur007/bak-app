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
  Samenvoegen is puur: `src/store/merge.ts` (getest). Let op: de instellingen hebben geen `id` in hun gegevens;
  ze worden enkel op `updatedAt` vergeleken (vroeger vielen ze weg, waardoor het welkomscherm telkens terugkwam).
  `ownerId`: de gegevens op het toestel horen bij één account; meldt een ander account zich aan, dan begint de
  app opnieuw met de startgegevens (`claimForAccount`, in `sync.ts`). Het welkomscherm schrijft enkel wat je
  echt aanpaste en verdwijnt zodra `onboarded` uit de cloud binnenkomt.
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
  `app/koppelen.tsx`); de koppelcode staat in `src/ui/Koppelen.tsx` (ook in Instellingen). Een geldige code blijft bestaan (migratie
  `20261106130000_crumbly_koppelcode_blijft.sql`, toegepast):
  `bak_create_link_code()` geeft je bestaande code terug, enkel `p_new => true` maakt een nieuwe; `bak_my_link_code()` toont
  ze op elk toestel. `Starter.splitFrom/splitOn` noteert waarvan je gesplitst bent.
- Koelkast of kamertemperatuur (`src/domain/location.ts`, getest): elke verplaatsing in `starter.locationLog`
  (geen databankwijziging, gaat mee met de starter, ook naar de gekoppelde ander). In de koelkast: voeden om de
  `fridgeFeedDays` (standaard 7) dagen, geen vraag naar verdubbeling, geen automatische voeding. Voedingen in de
  koelkast en de eerste na het uithalen tellen niet mee voor "klaar om te bakken" (`countsForReadiness`).
  "Ik ben weg" met de starter in de koelkast noteert de verplaatsing bij vertrek (`awayFridgeMove`); bij terugkomst
  een herinnering op het startscherm. Een bak met de starter in de koelkast begint met "uit de koelkast halen"
  (`bakeProcess`, ook in de voorvertoning). Bediening: `LocationControl` in `src/ui/StarterActions.tsx` (startscherm
  en starterscherm), samen met "Gevoed" met ongedaan maken (`useFeedWithUndo`) en het logboek (`StarterLog`).
- Gezin (samen op één starter, `bak_household_members` + `bak_household_codes`, migratie
  `20261106140000_crumbly_gezin.sql`, test `supabase/tests/crumbly_gezin_test.sql`): een lid werkt op de rijen van de
  eigenaar (`user_id` = eigenaar). De RLS van `bak_items` krijgt extra regels (select/insert/update voor leden, nooit
  delete: wissen is `deleted_at`); de eigen-rijen-regel blijft. Gezinscode (eenmalig, 1 dag) via
  `bak_create_household_code` / `bak_join_household(code, naam)`. In de app: `src/domain/household.ts`,
  `src/services/household.ts`, `src/ui/Gezin.tsx` (scherm Delen). `sync.ts` bepaalt eerst `dataId` (eigen id of die van de
  eigenaar); de pull filtert altijd op `user_id = dataId` (anders komen de eigen rijen van een lid door die van de
  eigenaar, ze hebben dezelfde vaste id's). `claimForAccount(dataId)` wist het toestel bij een andere gegevensbron.
  Wekkers en meldingen blijven per account. `Feed.by` = wie voedde (enkel met een gezin; lid: naam uit het
  lidmaatschap, eigenaar: `user_metadata.crumbly_name`). Gekoppelde starters (`bak_links`) blijven apart en enkel kijken.
- Synchronisatie (`syncCore.ts`, regressietests `tests/sync_betrouwbaar.test.ts`): de upsert vraagt de bewaarde rij terug
  (een geweigerde oudere wijziging brengt de cloudversie mee terug), een item dat tijdens het versturen opnieuw werd
  aangepast blijft in de wachtrij, en het ophalen pagineert op (servertijd, id) met een overlap van 30 s (now() is
  per transactie constant). De cursor is `lastPulledAt` + `lastPulledId` en gaat nooit achteruit. Tijden altijd als
  MOMENT vergelijken (`sameInstant`): de app stuurt `…123Z`, PostgREST geeft `…123+00:00` terug; als tekst zijn die
  verschillend. Begrijpt de server de samengestelde `or`-cursor niet, dan valt de sync terug op `gte` (best effort).
- Receptparser (`recipeText.ts`): onzekere stappen hebben `ProcessStep.check`; een uit tekst gemaakt recept is een
  concept (`recipeDraft.ts`) dat pas in de editor wordt bewaard. Een wachtstap zonder tijd is een wachtstap van 1 uur
  zonder wekker, nooit een handstap van 5 minuten.
  Getest met een echte bladzijde uit het bakboek van de zus (classic bâtard): genummerde stappen zonder punt ("1 Maak"),
  tussenkoppen ("Kneden (ca. 4 uur)") zijn geen stap, "500 + 60" telt op, zeezout is zout, een tabel met kolom "gram",
  handelingen zonder tijd in één alinea worden één handstap (één wekker), uitleg zonder opdracht gaat naar de notities,
  "herhaal nog twee keer", vouwen binnen de bulk, voorverwarmen 45 minuten (nakijken), "bij 24 °C" wordt `refTempC`.
- Opfrissen (blz. 44 van haar boek, enkel in de weken dat ze bakt): staat de starter in de koelkast, dan kiest ze in de
  planner 0, 2 of 3 dagen opfrissen (`refreshSteps` in `location.ts`): elke ochtend uit de koelkast, na 2 uur voeden
  1:2:2 met lauw water, 2 uur later terug in de koelkast; op de knedag een theelepel bewaren (1:10:10). Stappen met
  `starterAction` noteren bij het afvinken zelf de verplaatsing of de voeding (`setStepDone`). Een voeding na minstens
  90 minuten opwarmen telt mee voor "klaar om te bakken" (`countsForReadiness`).
- Wekkers: de planning wist geen wekker waarvan het uur voorbij is (de server herkanst). Migratie
  `20261106150000_crumbly_wekkers_betrouwbaar.sql` (herkansing, controle van antwoorden, verlopen abonnementen wissen)
  staat in de databank (net als `20261106160000_crumbly_gezin_ketting.sql`, toegepast 6 november 2026); de proef met een
  echte melding op een iPhone moet nog. `refreshPushSubscription` herstelt een weggevallen abonnement bij het openen.
- Vastgelopen synchronisatie (13 november 2026, "ik zie de voeding van Louise niet"): `src/services/runGuard.ts` (getest).
  Elk verzoek naar Supabase krijgt 20 seconden (`fetchWithTimeout`, in `supabase.ts`), en een ronde die langer dan 90
  seconden "bezig" is vervalt (`createRunGuard`, in `sync.ts`). Vroeger bleef één hangend verzoek (de iPhone pauzeert de
  app) alle volgende rondes blokkeren tot de app herlaadde. Een automatische voeding heeft een vast id per moment
  (`autoFeedId`) en de voedingstijd als wijzigingstijd, zodat twee toestellen van één gezin ze niet dubbel noteren.
- Foutmeldingen in gewone taal: `src/domain/errors.ts` (netwerkfout, VPN).
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
CI (`.github/workflows/ci.yml`) draait dit bij elke PR en bij een wijziging op main, plus de databanktests
(`crumbly/supabase/tests/run-local.sh`: lege Postgres met nagemaakte Supabase-onderdelen, alle migraties en tests).
Welke migraties echt in de databank staan: `crumbly/docs/databank-status.md`. Nog te testen op een echte iPhone:
`crumbly/docs/iphone-test.md`.

## Bekende grenzen
- Niet getest op een echte iPhone (meldingen in België, beginscherm, toetsenbord).
- Het voorbeeldrecept en de tijden zijn een vertrekpunt, geen advies.
- `npm audit` meldt bekende kwetsbaarheden, vooral in Expo-bouwhulpmiddelen; oplossen vraagt een Expo-upgrade.
