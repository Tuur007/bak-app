# Praktijktest op twee echte iPhones

Voor Tuur en zijn zus. Alles wat een computer kan nagaan is gedaan (zie het eindrapport in de pull request). Dit is wat
alleen op echte toestellen kan: meldingen, het beginscherm, offline gebruik, de camera en synchronisatie tussen mensen.
Reken op ongeveer een uur, verspreid over een dag (de meldingen vragen wachten). Noteer bij elke stap een vinkje of wat er
misging. De korte afvinklijst staat in `iphone-test.md`; dit is het stappenplan.

**Wie is wie:** *A* = Tuur (iPhone, eventueel ook zijn iPad), *B* = zijn zus (iPhone). Louise doet blok 7 mee als ze er is.
**Zet de VPN uit** op beide toestellen: een VPN kan Crumbly van de server afsluiten (de app zegt dat dan in gewone taal).

## Blok 0: voorbereiding (A en B, 10 minuten)
1. Open Safari op https://crumbly.vercel.app. Deel, **Zet op beginscherm**, open Crumbly voortaan **vanaf het beginscherm** (meldingen werken enkel zo).
2. Meld je aan met je eigen account (of maak er een). Staat het scherm op "Crumbly" en komt er niets: noteer het en probeer de app helemaal af te sluiten en opnieuw te openen.
3. Geef je starter een eigen naam (bv. "Jeanine" en "Jean"), via de knop op het startscherm.
4. Instellingen, **Meldingen aanzetten**, toestemming geven. Daarna **Stuur mij een testmelding**: binnen een minuut moet er een melding komen.
   - [ ] A: testmelding kwam, na ... minuten
   - [ ] B: testmelding kwam, na ... minuten

## Blok 1: dagelijks gebruik (A en B, 10 minuten)
1. Tik op **"... is gevoed"**: er verschijnt "Voeding genoteerd" met "Ongedaan maken". Tik op ongedaan maken: de voeding is weg. Voed opnieuw.
2. Tik op **In de koelkast gezet**, daarna **Uit de koelkast gehaald**. Het logboek (tabblad Starters) toont beide momenten.
3. Open **Recepten**, bekijk de hydratatie van een recept en pas het water aan: de percentages veranderen mee.
4. Plan een bak: tabblad **Plan**, kies een recept, kies een eindtijd morgen, **Plan deze bak**. Kijk of de uren kloppen met wat je zelf zou doen.
   - [ ] A  - [ ] B

## Blok 2: recept uit haar kookboek (B, 15 minuten)
1. Recepten, **Recept uit mijn boek omzetten**. Tik in het tekstvak, kies **Tekst scannen** (cameraicoon) en richt de iPhone op de bladzijde. Tik op **Voeg in**.
   Lukt dat niet: houd je vinger op de tekst in een foto in de Foto's-app, kopieer en plak.
2. Bekijk wat Crumbly gevonden heeft. Kloppen meel, water, starter en zout in gram? Staan er stappen onder "Kijk dit na"?
3. **Nakijken en verbeteren**: er is nog niets bewaard. Pas aan wat niet klopt (vooral stappen zonder tijd: Crumbly zette 1 uur of 5 minuten) en tik op **Bewaar**.
4. Plan een bak met dit recept. Waarschuwt het plan nog voor stappen die je niet nakeek?
   Noteer: welke dingen herkende Crumbly niet goed? (Een foto van de bladzijde erbij helpt de volgende ronde.)
   - [ ] meel/water/starter/zout juist herkend  - [ ] tijden juist  - [ ] iets fout: ...

## Blok 3: meldingen echt testen (A en B, verspreid over een dag)
Plan voor elke proef een stap met een bel over 5 minuten en doe dan wat erbij staat. Kijk daarna of de melding komt en hoe laat.
| Proef | A | B |
| --- | --- | --- |
| iPhone vergrendeld, app open op de achtergrond | | |
| App volledig afgesloten (omhoog vegen) | | |
| Energiebesparing aan | | |
| Niet storen of een Concentratie aan (noteer of de melding wordt tegengehouden) | | |
| Twee stappen met 2 minuten ertussen: komen beide, in de goede volgorde? | | |
| Melding aantikken opent het bakplan | | |
| Een melding negeren en de app 10 minuten later openen | | |
Gaat een melding niet af? Zeg het meteen aan Claude of Tuur met het uur: de databank bewaart waarom (`last_error`), en probeert het tot 3 keer opnieuw.

## Blok 4: offline gebruik (A of B, 10 minuten)
1. Zet het toestel in **vliegtuigstand**. Open Crumbly.
2. Voed twee keer, zet de starter in de koelkast, plan een bak. Alles moet gewoon werken; bovenaan kan een melding over de verbinding staan.
3. Zet de vliegtuigstand uit. Binnen twee minuten verdwijnt die melding. Open Instellingen: staat er "Alles is verstuurd"?
4. Controleer op een tweede toestel (blok 5) dat de twee voedingen er staan en **niet dubbel**.
   - [ ] werkt offline  - [ ] niets dubbel  - [ ] niets kwijt

## Blok 5: synchronisatie tussen toestellen (A met iPhone en iPad)
1. Meld je op de iPad aan met hetzelfde account. De gegevens verschijnen; je krijgt het welkomscherm **niet** opnieuw en je naam staat nog goed.
2. Voed op de iPhone: binnen twee minuten staat de voeding op de iPad. En omgekeerd.
3. Pas op beide toestellen tegelijk **dezelfde voeding** aan (andere tijd): na een synchronisatie staat overal de laatst gemaakte wijziging.
4. Hernoem de starter op de iPad: de iPhone toont de nieuwe naam.
   - [ ] voeding komt over  - [ ] hernoemen komt over  - [ ] geen welkomscherm  - [ ] geen dubbels

## Blok 6: elkaars starter zien (A en B)
1. A: knop **Delen** op het startscherm, **Maak een koppelcode**, **Deel de code** naar B (WhatsApp).
2. B: Delen, onder "Koppelen met een ander account" de code invullen, **Koppel**. Daarna zien beiden de starter van de ander op het startscherm, met "Gekoppeld, enkel kijken".
3. B voedt: A ziet de nieuwe voeding binnen twee minuten, maar kan niets aan haar starter aanpassen. En omgekeerd.
4. Probeer als A je **eigen** code in te vullen: de app legt uit dat die voor de ander is.
5. Op beide telefoons: de code opnieuw openen toont dezelfde code (de blijvende koppelcode). (De SQL daarvoor staat sinds 6 november 2026 in Supabase.)
   - [ ] gekoppeld  - [ ] zien elkaars voeding  - [ ] niets aan te passen bij de ander

## Blok 7: samen op één starter, een gezin (A en Louise)
1. A: Delen, **Maak een gezinscode** en vul je eigen naam in. Geef de code aan Louise.
2. Louise (eigen account, eigen iPhone): Delen, de gezinscode en haar naam invullen, **Ga bij het gezin**. Ze ziet nu Jeanine en de gegevens van A.
3. Louise voedt: bij de voeding staat "door Louise", en A ziet dat. A voedt: er staat "door Tuur".
4. Louise gebruikt de koelkastknop: A ziet het.
5. Louise verlaat het gezin: ze werkt weer op haar eigen (lege) gegevens, A heeft niets verloren.
   - [ ] zelfde gegevens  - [ ] namen bij voedingen  - [ ] verlaten lukt

## Blok 8: brood, foto en back-up (A of B, 10 minuten)
1. Na een echte bak: tabblad **Broden**, vul korstkleur, kruim en een zin voor de volgende keer in en voeg een **foto** toe. Het brood staat in de lijst, de zin op het startscherm.
2. Instellingen, **Back-up downloaden**. Bewaar het bestand.
3. Pas daarna iets aan (bv. hernoem de starter). Plak de inhoud van de back-up bij **Terugzetten** en bevestig: de oude naam is terug, ook op je andere toestel.
   - [ ] foto werkt  - [ ] back-up gedownload  - [ ] terugzetten werkt

## Wat doorsturen
- Het uur en de uitkomst van elke proef, en welk toestel en welke iOS-versie.
- Een schermafbeelding bij alles wat vreemd leek (zeker een scherm dat niet opent, of "Crumbly" dat blijft staan).
- Bij een melding die niet kwam: het uur dat ze had moeten komen.
