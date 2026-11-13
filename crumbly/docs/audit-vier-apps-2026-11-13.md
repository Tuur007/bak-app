# Audit van de vier apps, 13 november 2026

Crumbly, Recepten, Op Pad en Tuin. De audit zelf las alleen. Daarna zijn, op vraag van Tuur, de punten met
**[opgelost]** aangepast in een PR per app; in de databank is niets gewijzigd. Wat een databankwijziging vraagt
(R2) wacht op Tuurs ok.

## Samenvatting

- De rechten in de databank zitten goed. Elke tabel heeft beveiliging per rij, gevoelige kolommen (rol, gezin) zijn
  niet aan te passen door een gebruiker, de opslagmappen zijn privé. Ik vond geen manier waarop het ene gezin
  gegevens van het andere kan lezen of wijzigen.
- Het grootste probleem zit in de synchronisatie en komt in drie apps terug: een verzoek dat blijft hangen
  (iPhone zet de app op pauze) blokkeert alle volgende synchronisaties tot de app helemaal herlaadt. In Crumbly is
  dat de oorzaak van "ik zie de voeding van Louise niet".
- Twee lijsten lezen zonder door te bladeren en worden bij 1000 rijen stil afgekapt (Recepten, Op Pad). Dat bijt
  nu nog niet, maar komt dichterbij.
- Alle bestaande tests, typecontroles en de webbouw van Tuin en Op Pad slagen.

Gedraaide controles: Crumbly 121 tests, typecontrole en webbouw; Recepten alle testbestanden, typecontrole en
webbouw; Op Pad 328 tests, typecontrole, webbouw en de browsertest op telefoonformaat (349 van 349, met nagebootste
databank); Tuin 111 tests, lint en bouw. Alles geslaagd. Op Pad heeft geen automatische controle bij een PR: de
tests draaien enkel als iemand ze zelf start.

Ernst: **lek of verlies** / **stuk** / **hinderlijk** / **klein**. "Bevestigd" betekent: gezien in de databank of
het exacte codepad gelezen. Wat ik enkel vermoed staat apart.

## Voorgestelde volgorde

1. Vastlopende synchronisatie oplossen in Crumbly, dan dezelfde oplossing in Recepten en Op Pad (C1, R1, O2).
2. Dubbele automatische voedingen in een gezin (C2), samen met 1 in dezelfde Crumbly-PR.
3. Weekplanner: zelf iets typen (Recepten, zie onderaan).
4. Doorbladeren bij het ophalen (R3, O1) voor de grens bereikt wordt.
5. Recepten: een oude wachtende wijziging mag geen nieuwere overschrijven (R2).
6. De kleinere punten per app.

---

## Crumbly

### C1. Voedingen van de ander komen niet of een dag te laat door: **stuk**, bevestigd [opgelost]
- Wat je merkt: Louise voedt, jij ziet het niet, en omgekeerd.
- Wat de databank toont: Louise zit sinds 6 november correct in jouw gezin en de rechten laten haar lezen en
  schrijven. Haar voeding van 11 november 22:09 kwam pas op 12 november 22:09 in de databank aan, een dag later,
  terwijl ze de ochtend ertussen de app nog gebruikte (antwoord op de vraag over verdubbelen om 08:07). Haar toestel
  heeft die dag dus niets verstuurd en ook niets opgehaald.
- Oorzaak in de code: `src/services/sync.ts` (regel 59-60) laat geen tweede synchronisatie starten zolang er een
  "bezig" is, en er staat geen tijdslimiet op de verzoeken (`src/services/supabase.ts`). Blijft één verzoek hangen,
  dan blijft "bezig" staan tot de app helemaal herlaadt. Op een iPhone gebeurt dat als het scherm dichtgaat terwijl
  er een verzoek loopt, en de app synchroniseert net 2 seconden na elke wijziging.
- Eerlijk: het hangen zelf heb ik niet op een iPhone kunnen uitlokken. De vertraging van een dag staat in de
  databank en het blokkerende codepad is zeker.
- Oplossing: een tijdslimiet van 20 seconden per verzoek, en een "bezig" die na een minuut vervalt. Klein (een
  halve dag met tests).
- Tot dan: de app volledig sluiten (wegvegen) en opnieuw openen brengt alles door. Jullie hoeven geen nieuwe
  gezinscode te gebruiken.

### C2. Automatische voeding wordt in een gezin dubbel genoteerd: **hinderlijk**, bevestigd in de code [opgelost]
- `ensureAutoFeeds` (`src/store/store.ts` 207-220) draait op elk toestel voor het ophalen en geeft elke voeding een
  willekeurig id. Openen jij en Louise allebei de app na het voeduur, dan staan er twee voedingen.
- Nog niet in jullie gegevens te zien (het vaste voeduur staat pas sinds 12 november aan en Jeanine staat in de koelkast).
- Oplossing: een vast id per dag, zodat de twee samenvallen. Klein.

### C3. Bij jouw voedingen staat geen naam: **klein**, bevestigd
- Voedingen van Louise dragen "Louise", die van jou niets: je hebt als eigenaar nog geen naam gekozen. Louise ziet
  dus niet dat jij het was. Oplossing: de naam vragen zodra er een gezin is.

### C4. Verplaatsing kan verloren gaan bij gelijktijdig aanpassen: **klein**, bevestigd in de code
- De starter is één rij waarbij de laatste wijziging wint. Zet Louise hem in de koelkast terwijl jij een instelling
  van de starter aanpast, dan verdwijnt een van beide.

### C5. Documentatie loopt achter: **klein**, bevestigd [opgelost]
- `docs/databank-status.md` zegt dat de migratie "koppelcode blijft" niet is toegepast. De functies
  `bak_my_link_code` en `bak_create_link_code(p_new)` staan wel in de databank.

### C6. Overbodige rechten voor niet-aangemelde bezoekers: **klein**, bekend
- `bak_items`, `bak_reminders`, `bak_push_subscriptions`: geen lek (de regels per rij houden alles tegen), wel netter om in te trekken.

### Niet bevestigd / niet nagekeken
- Een echte melding op een iPhone. De server verstuurt wel: 3 wekkers verzonden in 7 dagen, geen achterstallige, de
  geplande taken lopen zonder fout.
- De schermen zelf in een browser doorlopen (geen nagebootste databank voor Crumbly; opzetten is een dag werk).

### Verbeteringen
1. Op het startscherm tonen wanneer er laatst gesynchroniseerd is, met een knop, zodat je een probleem zelf ziet.
2. Een melding naar de ander als iemand gevoed heeft ("Louise heeft Jeanine gevoed").
3. De eigenaar een naam laten kiezen bij het maken van een gezin.

---

## Recepten

### R1. Wachtrij kan blijven hangen: **stuk**, bevestigd in de code, niet in de gegevens [opgelost]
- Zelfde patroon als C1: `services/sync/queue.ts` (346-355) laat geen tweede ronde toe zolang er een loopt, zonder
  tijdslimiet. Hangt een verzoek, dan gaan wijzigingen (boodschap, weekplanning, recept) niet naar het gezin tot de
  app herlaadt. Ophalen bij terugkeren wacht op die ronde en blijft dan ook uit.
- Oplossing: dezelfde als in Crumbly. Klein.

### R2. Een oude wachtende wijziging overschrijft een nieuwere: **verlies**, bevestigd in de code
- Een recept wordt als hele rij naar de cloud geschreven, zonder controle op wie het laatst wijzigde
  (`queue.ts`, `executeRow`). Past Louise een recept aan en stuurt jouw toestel daarna nog een oudere wijziging
  door (bv. na een dag zonder bereik, of na R1), dan is haar versie weg. Voor boodschappen hetzelfde: die hebben
  geen wijzigingstijd.
- Oplossing: in de databank een regel "oudere wijziging wordt geweigerd" zoals Crumbly al heeft. Databankwijziging,
  middelgroot.

### R3. Ophalen wordt bij 1000 rijen stil afgekapt: **stuk op termijn**, bevestigd [opgelost: doorbladeren; opruimen van gewiste rijen blijft open]
- `pullAll` (`services/sync/supabaseSync.ts` 138-144) haalt alles in één keer. De databank geeft hoogstens 1000
  rijen terug. Gewiste rijen blijven bestaan en tellen mee: boodschappen staan na een maand op 97 rijen waarvan 63
  gewist, recepten op 205. Aan dit tempo raken de boodschappen de grens binnen het jaar; dan ontbreken er op een
  nieuw toestel zonder melding.
- Oplossing: doorbladeren, en gewiste boodschappen na 30 dagen opruimen (stond al als open beslissing). Klein tot middel.

### R4. Verzameling: twee mensen tegelijk, één toevoeging weg: **hinderlijk**, bevestigd in de code
- Bij elke wijziging worden alle koppelingen gewist en opnieuw geschreven, in twee losse stappen.

### R5. Afgevinkte boodschappen springen even terug bij het opstarten: **klein**, bevestigd in de code
- Bij de start lopen ophalen en versturen naast elkaar; bij terugkeren en bij nieuw bereik staat de volgorde wel goed.

### R6. Databank: **klein**
- Functies `my_family_id` en `is_family_owner` zijn uitvoerbaar zonder aanmelden (geven dan niets terug, geen lek).
- De regels van de oudste tabellen gelden voor rol "public" in plaats van "authenticated" (zelfde uitkomst, minder net).
- Controle op gelekte wachtwoorden staat uit (bekend: betalend plan).

### Niet nagekeken
- De schermen in een browser doorlopen; import van websites; de kookmodus.

### Verbeteringen
1. Zelf iets typen in de weekplanner (hieronder uitgewerkt).
2. Regelmatig ophalen terwijl de app openstaat (nu enkel bij terugkeren en via de live-verbinding, die op een iPhone wegvalt).
3. In Instellingen tonen wanneer er laatst gesynchroniseerd is.

---

## Op Pad

### O1. Een lijst met meer dan 1000 plekken wordt stil afgekapt: **stuk op termijn**, bevestigd [opgelost]
- `listTripPlaces` (`src/features/plekken/api.ts` 64-71) bladert niet door, `listAllPlaces` vlak eronder wel. Je
  grootste lijst telt nu 470 plekken. Oplossing: dezelfde lus gebruiken. Klein.

### O2. Wachtrij van het plan kan blijven hangen: **stuk**, bevestigd in de code [opgelost]
- `flushPlan` (`src/features/planning/sync.ts`) heeft hetzelfde patroon als C1. De paklijst is volgens de code op
  dezelfde manier gebouwd; dat bestand heb ik niet apart gelezen.

### O3. Een geweigerde wijziging verdwijnt uit de wachtrij: **hinderlijk**, bevestigd in de code
- Bij een fout die geen netwerkfout is (bv. even een serverfout) krijg je een melding en is "Geweest" of het uur weg.
  Voor een tijdelijke serverfout zou opnieuw proberen beter zijn.

### O4. Twee mensen passen dezelfde plek aan: laatste wint voor alle velden: **klein**, bevestigd in de code

### Verbeteringen
1. O1 en O2 oplossen voor de volgende reis.
2. Bij een tijdelijke serverfout de wijziging laten wachten in plaats van weggooien.

---

## Tuin

### T1. Niemand krijgt de dagelijkse melding: **hinderlijk**, bevestigd in de databank
- Er staat geen enkel meldingsabonnement. De dagelijkse taak draait elke ochtend zonder fout, maar heeft niemand om
  naar te sturen. Meldingen moeten per toestel aangezet worden in Instellingen.

### T2. Plant toevoegen kan half lukken: **hinderlijk**, bevestigd in de code [opgelost]
- `createPlant` (`src/app/(app)/planten/actions.ts`): de plant wordt bewaard, daarna de gietbeurt. Faalt die tweede
  stap, dan krijg je "opslaan lukte niet" terwijl de plant er al staat; opnieuw proberen geeft een dubbele plant.
  Een fout bij de plant zelf toont de Engelse tekst van de databank.

### T3. Een foto die niet uploadt, verdwijnt zonder melding: **klein**, bevestigd in de code

### T4. Niet bevestigd: tijdelijk geen verbinding met Supabase stuurt je naar het inlogscherm
- `src/lib/supabase/session.ts` behandelt "kan de gebruiker niet ophalen" als "niet aangemeld".

### Opmerking
- De app wordt amper gebruikt: 1 huishouden, 2 leden, 1 plant, 1 taak. Fouten hier wegen minder dan in de andere drie.

---

## Over de apps heen
- Hetzelfde "bezig"-patroon zonder tijdslimiet zit in Crumbly, Recepten en Op Pad. Eén oplossing, drie keer toepassen.
- Geen enkele app zet een tijdslimiet op verzoeken naar de databank.
- Crumbly weigert oudere wijzigingen in de databank; Recepten niet (R2).
- Crumbly en Op Pad bladeren door bij het ophalen; Recepten en één functie van Op Pad niet.

---

## Uitwerking: zelf iets typen in de weekplanner (Recepten) [gebouwd]

Kan zonder databankwijziging. Een vakje in de week bevat nu het id van een recept. Vrije tekst kan in hetzelfde
vakje, met een herkenbaar begin (bv. `tekst:biefstuk met boontjes en aardappelen`).

- De huidige app in productie kent zo'n waarde niet en toont het vakje als leeg; er gaat niets stuk. Na de merge
  zien alle toestellen de tekst.
- Synchroniseren en "een ander past dezelfde week aan" werken al per vakje, dus de tekst blijft staan.
- "Zet de week op de lijst" slaat onbekende ids al over, dus ook vrije tekst. De kookmodus idem.
- Aan te passen: het kiesvenster van de weekplanner (invoerveld bovenaan naast de receptenlijst), het tonen van het
  vakje, het startscherm (vrije tekst als avondeten telt als gepland, dus geen voorstel "vanavond"), tests en een
  bericht "wat is er nieuw".
- Werk: ongeveer een dag.
