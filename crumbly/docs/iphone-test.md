# Wat nog op een echte iPhone getest moet worden

Het stappenplan om dit met twee personen te doen staat in `praktijktest-twee-iphones.md`; dit is de korte afvinklijst.

Alles hieronder is in de code en met nagebootste omgevingen getest, **niet** op een echt toestel. Een wekker die niet
afgaat is het ergste wat een bakplanner kan doen, dus loop dit eenmaal door op haar iPhone (iOS 16.4 of nieuwer), met
Crumbly vanaf het beginscherm geopend. Zet na elke proef een vinkje.

## Voorbereiding
- [ ] Crumbly staat op het beginscherm (Deel, Zet op beginscherm) en je bent aangemeld.
- [ ] Instellingen, **Meldingen aanzetten**, toestemming gegeven.
- [ ] Instellingen, **Stuur mij een testmelding**: binnen een minuut komt er een melding.

## Meldingen
- [ ] **Vergrendeld scherm**: plan een bak met een stap over 5 minuten (handwerk, met bel). Vergrendel de iPhone. De melding komt op het vergrendelde scherm.
- [ ] **App volledig afgesloten** (omhoog vegen in de appkiezer): de melding komt toch.
- [ ] **Energiebesparing aan**: de melding komt, eventueel een paar minuten later. Noteer de vertraging.
- [ ] **Concentratie of Niet storen aan**: noteer of de melding komt of wordt tegengehouden (dat is een iOS-instelling, geen fout van Crumbly).
- [ ] **Geen internet op het uur zelf** (vliegtuigstand), daarna internet terug: de melding komt zodra het toestel weer verbinding heeft, of niet meer als hij meer dan 30 minuten te laat is. Het bakplan toont de uren altijd.
- [ ] **Meerdere meldingen kort na elkaar** (twee stappen met 2 minuten ertussen): beide komen, in de goede volgorde.
- [ ] **Melding aantikken** opent het bakplan (`/plan`), ook als de app dicht was.
- [ ] **Gemiste melding**: negeer een melding en open de app 10 minuten later. Het bakplan toont de stap als "nu" of voorbij, en niets staat dubbel.

## Na de wijziging "wekkers betrouwbaar" (zie `databank-status.md`)
- [ ] Zet meldingen uit en weer aan: er komt een nieuw abonnement, de testmelding werkt weer.
- [ ] Verwijder Crumbly van het beginscherm en zet het terug: aanmelden, meldingen aanzetten, testmelding.
- [ ] Controleer na een proef in Supabase: `select id, attempts, confirmed_at, last_error from public.bak_reminders order by due_at desc limit 10;`. Een gelukte wekker heeft `confirmed_at` en geen `last_error`; een mislukte toont waarom.

## Starter en voeden
- [ ] Voeden met de knop: de voeding staat meteen in het logboek, met "Ongedaan maken".
- [ ] Een voeding op de iPhone verschijnt op de iPad (en omgekeerd) binnen twee minuten.
- [ ] Offline voeden (vliegtuigstand), daarna online: de voeding komt in de cloud en staat niet dubbel.
- [ ] De VPN aan: de app zegt in gewone taal dat er geen verbinding is.

## Recept uit het boek
- [ ] "Tekst scannen" (cameraicoon in het tekstvak) op een bladzijde uit haar boek: de ingrediënten en tijden kloppen, of de afwijkingen staan bij "Nakijken".
- [ ] Een stap zonder tijd krijgt een wachttijd van 1 uur en de markering "Nakijken"; na het invullen van de echte tijd verdwijnt de markering.

## Noteer
Per proef: toestel, iOS-versie, wat er gebeurde en hoe laat. Een melding die niet kwam: kijk eerst of de wekker in
`bak_reminders` stond en wat `last_error` zegt, dan pas aan de iPhone.
