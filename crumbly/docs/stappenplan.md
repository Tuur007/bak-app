# Stappenplan om Crumbly af te werken (voor Tuur)

Wat al klaar is: de app, de databank (tabellen en wekker-functie), het Vercel-project en de testlink.
Wat nog moet, in deze volgorde. Elke stap duurt een paar minuten.

## Stap 1. Redirect-URL in Supabase (2 min)
Waarom: anders stuurt de bevestigingsmail van een nieuw account naar de Recepten-app.
1. supabase.com, project **Apps DIY projects**.
2. Links **Authentication**, dan **URL Configuration**.
3. Bij **Redirect URLs**: **Add URL**, vul `https://crumbly.vercel.app` in, bewaar.
4. Laat de **Site URL** zoals hij is (die is van de Recepten-app).

## Stap 2. Sleutels voor de meldingen (5 min)
Waarom: zonder sleutels komen er geen wekkers op de iPhone. De rest van de app werkt wel.
1. Open een terminal in de map van de repo `bak-app` (Node 18 of nieuwer).
2. `node crumbly/scripts/meldingen-sleutels.mjs`
3. Het script toont **stap A** (drie waarden voor Vercel) en **stap B** (twee regels SQL).
4. Vercel: project **crumbly**, **Settings**, **Environment Variables**. Voeg de drie toe voor
   **Production** en **Preview**; `VAPID_PRIVATE_KEY` en `CRON_SECRET` als **Sensitive**.
5. Supabase, **SQL Editor**, nieuwe query: plak de twee regels van stap B en klik **Run**.
6. Sluit de terminal. De sleutels staan nergens anders bewaard.

## Stap 3. Opnieuw bouwen (1 min)
Waarom: de publieke sleutel wordt bij het bouwen in de app gezet.
Vercel, project crumbly, **Deployments**, bij de bovenste (branch `claude/crumbly-v1`) de drie
puntjes, **Redeploy**. Of zeg het aan Claude, die doet het.

## Stap 4. Zelf testen op je iPhone (15 min)
1. Open in Safari de testlink: https://crumbly-git-claude-crumbly-v1-tuur007s-projects.vercel.app
   (meld je aan bij Vercel als dat gevraagd wordt).
2. **Deel**, **Zet op beginscherm**, open Crumbly vanaf het beginscherm.
3. Tandwiel rechtsboven, **Account maken** (of aanmelden met je bestaande account).
4. Tik **Jean is gevoed**. Ga naar **Plan**, plan een bak, zet bij een stap binnen 5 minuten de bel aan.
5. Instellingen, **Meldingen aanzetten**, sta meldingen toe.
6. Sluit de app en wacht: binnen een paar minuten na het uur van die stap hoort er een melding te komen.
7. Opruimen na het testen: annuleer de bak (Plan, **Bak annuleren**). Je account mag blijven.
   Let op: wat je hier aanmaakt staat echt in de databank.

## Stap 5. Live zetten voor je zus
1. Zeg **merge** tegen Claude (pas als stap 4 goed ging). Dan komt Crumbly op https://crumbly.vercel.app.
2. Je zus opent dat adres in Safari, **Zet op beginscherm**, maakt een account en zet de meldingen aan.
3. Haar eerste taak in de app: haar eigen recept invullen (Recepten), en haar thuis-momenten
   (Instellingen). De voorbeelden zijn maar een vertrekpunt.
