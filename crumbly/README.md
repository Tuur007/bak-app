# Crumbly

Zuurdesem bijhouden: je starter, je recepten, je bakplan met uren en wekkers, en je broden.
Een webapp om op het beginscherm van een iPhone te zetten.

## Lokaal draaien
```
npm install
npx expo start --web
```
Zonder `.env` werkt alles lokaal (zonder sync en meldingen). Met `.env` (zie `.env.example`)
synchroniseert de app met Supabase.

## Testen
```
npm test          # rekenkern: ratio's, starter, schema, wekkers
npm run typecheck
npx expo export --platform web   # bouwt dist/
```

## Online zetten (Vercel)
- Nieuw Vercel-project op deze repo, Root Directory = `crumbly`. De rest staat in `vercel.json`.
- Omgevingsvariabelen: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (zelfde als de
  Recepten-app), en voor meldingen `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `CRON_SECRET`.

## Databank
Migraties in `supabase/migrations/`; welke er in het echte project staan, zie `docs/databank-status.md` (met de
leesopdrachten om dat zelf na te gaan). Eerst de test in de SQL-editor (draait zichzelf terug), dan pas de migratie.
Meldingen: `docs/meldingen-instellen.md`. Wat nog op een echte iPhone getest moet worden: `docs/iphone-test.md`.
