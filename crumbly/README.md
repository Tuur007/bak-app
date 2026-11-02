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
  `CRON_SECRET`, `CONTACT_EMAIL`.

## Databank
Migraties in `supabase/migrations/` (nog niet toegepast). Eerst `supabase/tests/crumbly_test.sql`
in de SQL-editor (draait zichzelf terug), dan de migraties. Meldingen: `docs/meldingen-instellen.md`.
