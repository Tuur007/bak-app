# Gebruikersaudit Crumbly, 6 november 2026

Wat kan er beter, bekeken door de ogen van de drie mensen die Crumbly gebruiken: **de zus** (hoofdgebruiker, bakt),
**Tuur** (gebruikt de app ook) en **Louise** (gebruikt de app ook, let vooral op tijden en overzicht).

Werkwijze: de webversie (`npx expo export --platform web`) lokaal gestart en doorgelopen met Playwright in een
iPhone-venster (390 x 844, Nederlands, tijdzone Brussel), daarna de code achter elk scherm gelezen, en ten slotte extern
onderzoek (vergelijkbare apps, vakinhoud, iOS, toegankelijkheid, privacy). Er is niets aan de code of de databank
veranderd. `npm test` (113 tests) en `npm run typecheck` zijn groen. Schermafbeeldingen staan in `docs/audit-2026-11-06/`.

Ernst: **blokkerend** (je komt er niet uit of je verliest iets) · **hinderlijk** · **kleinigheid** · **kans** (een
extra die meer waarde geeft). Voor wie: zus / Tuur / Louise / allen.

---

## Stand na de eerste opruimronde (6 november 2026)

De kleine bevindingen zonder databankwijziging zijn opgelost in dezelfde PR: **B1** (een nieuwe starter begint vandaag,
dus "Dag 0"), **B2** (`NumberField`: tijdens het typen blijft je tekst staan, pas bij het verlaten van het veld wordt
een leeg of onmogelijk getal teruggezet), **B6** (een bak blijft standaard gepland bij "Ik ben weg"), **B7** (recept
verwijderen vraagt bevestiging; *Sluiten* met niet bewaarde wijzigingen nog niet), **B9** (de knop "Gevoed" staat ook
tijdens een bak onder de stapkaart), **B10** ("Zet in de koelkast" en "Haal uit de koelkast"), **B11** (Meldingen staan
bovenaan in Instellingen; de vraag in het welkomscherm nog niet), **B13** (aanmeldtekst), **B14** (`mut` is
donkerder, veldranden en lege schakelaars halen 3:1, de knoppen "Niet gevoed" en "Niet bekeken" zijn omlijnd),
**B16** (een lege naam wordt "Jean"), **B17** (knop "Kies het back-upbestand") en **B21** ("Volgend brood").
**B23 (gemist in de eerste versie van deze audit, daarna door Tuur gemeld): het welkomscherm vraagt niet of je bij een
gezin komt.** Wie met iemand aan één starter werkt (Tuur en zijn vrouw), kreeg als eerste scherm toch "Hoe heet hij?" en
een startdatum, en moest zelf bedenken dat ze eerst naar Instellingen, Delen moest. Nu begint het welkomscherm met één
vraag: "Werk je samen met iemand?". "Ja" vraagt de gezinscode en je eigen naam (dezelfde knop als in Delen,
`GezinJoin`) en zet je meteen op de starter van de ander, zonder naam of datum te vragen. "Nee" gaat naar de vragen
over een eigen starter. Wie al in een gezin zit, krijgt het welkomscherm niet. Op het startscherm staat de regel "Werk je
samen met iemand ... Open Delen" niet meer voor gezinsleden. Getest met een nagemaakte databank (aanmelden, code,
joinen, herladen), niet met het echte gezin.
Les voor volgende audits: de eerste-keer-route moet per gebruiker en per manier van samenwerken worden doorlopen
(eigen starter, gezin, koppelen), vanaf een leeg toestel met een nieuw account, en niet alleen zonder account.
Niet gedaan: B3, B4, B5, B8, B12, B15, B18 tot B20, B22 en de kansen. De tekst hieronder is de stand van de audit zelf.

---

## 1. Samenvatting

- **Sterkst:** eerlijk over wat een schatting is, wekkers die zeggen wanneer ze niet kunnen afgaan, voeden met één tik
  en ongedaan maken, werkt offline, volledig Nederlands en rustig vormgegeven. Alle tikdoelen zijn minstens 44 px.
- **Zwakst:** de app is gebouwd voor één bakker. Met drie mensen in een gezin delen ze ongewild wekkers en instellingen,
  en een nieuwe gebruiker (Louise) begint met een starter die al weken oud is.
- **Top 5 die het meeste verschil maakt:**
  1. Een nieuw account krijgt een vaste startdatum (16 oktober 2026) in plaats van vandaag (B1).
  2. Getallenvelden kun je niet leegmaken: je typt "12" en er staat "112" (B2).
  3. In een gezin krijgt iedereen elke wekker van elke bak, en de thuis-momenten zijn gedeeld (B3).
  4. Een recept uit het boek wordt soms een verkeerd schema: vouwen na de bulk, en vormen zonder wekker (B5).
  5. Voeden, de meest gebruikte knop, staat onder de vouw en verdwijnt tijdens een bak (B9).

---

## 2. Bevindingen

### Blokkerend

**B1. Een nieuw account begint met een starter van weken oud**
- Voor wie: Louise, en iedereen die nieuw begint.
- Waar: `src/domain/defaults.ts:18` (`startedOn: '2026-10-16'`), `app/welkom.tsx:64-66`.
- Wat je ervaart: "Ik begin vandaag, maar Crumbly zegt *Dag 21 met Jean*. Volgende maand staat er *Dag 50*. Om de
  juiste datum te zetten moet ik vijftig keer op *+1 dag* tikken."
- Bewijs: de schermafbeelding `1-welkom-startdatum.png` toont vrijdag 16 oktober als startdatum. De regel "minstens 14
  dagen oud" voor "klaar om te bakken" is dan meteen voldaan, dus de schatting voor de eerste bakdag klopt niet.
- Oorzaak: de startgegevens zijn één keer voor de zus gemaakt met een vaste datum.
- Voorstel: zet `startedOn` bij het aanmaken op vandaag. De tijd 1970 blijft gewoon in `updatedAt`. Vervang de knoppen
  -1/+1 dag door een datumkiezer (`<input type="date">` geeft op de iPhone de gewone kalender). Inspanning klein, geen
  databankwijziging.
- Bron: eigen test en code.

**B2. Getallenvelden kun je niet leegmaken**
- Voor wie: allen.
- Waar: `app/(tabs)/jean.tsx:109, 171-174` (velden "Voeden om de (uur)", "Klaar binnen (uur)", "Zoveel keer op rij",
  "In de koelkast voeden om de (dagen)"), en hetzelfde patroon in `app/recept/[id].tsx` en `app/instellingen.tsx:129`.
- Wat je ervaart: "Ik wil 24 van 12 maken. Ik wis het getal, er staat meteen een 1. Ik typ 24 en er staat 124."
- Bewijs: in de test gaf twee keer wissen "1", en daarna "12" typen gaf **112**. Het gevolg was meteen zichtbaar: de
  schatting "klaar om te bakken" sprong van 9 naar 21 november, omdat Crumbly dacht dat de starter om de 112 uur gevoed
  wordt.
- Oorzaak: elke toetsaanslag wordt meteen omgezet en begrensd (`Math.max(1, num(v))`), en het veld toont de begrensde
  waarde terug.
- Voorstel: laat het veld tijdens het typen tekst bijhouden en controleer pas bij het verlaten van het veld. Leeg of
  onzin geeft de vorige waarde terug, met een korte uitleg. Inspanning klein (één `NumberField` in `kit.tsx`), geen
  databankwijziging.
- Bron: eigen test.

**B4. Niet verstuurde wijzigingen gaan verloren als er een ander account (of een gezin) binnenkomt**
- Voor wie: allen, vooral wie toestellen deelt (Louise en Tuur), en wie offline voedt.
- Waar: `src/services/sync.ts:76` roept `claimForAccount` aan vóór het versturen; `src/store/store.ts:352-379` maakt dan
  `dirty` leeg.
- Wat je ervaart: "Ik heb op de trein gevoed zonder internet. Thuis ga ik bij het gezin van mijn zus, en mijn voeding is
  weg." Of: Louise meldt zich even aan op de iPad van Tuur, en wat Tuur offline noteerde, verdwijnt.
- Oorzaak: bij een andere gegevensbron begint het toestel opnieuw met de startgegevens, zonder eerst de openstaande
  wijzigingen te versturen.
- Voorstel: verstuur eerst de openstaande wijzigingen van het vorige account. Lukt dat niet (offline), wissel dan niet
  en zeg in gewone taal: "Er staan nog 3 wijzigingen op dit toestel. Maak eerst verbinding." Inspanning middel, geen
  databankwijziging. Voeg een regressietest toe in `tests/sync_betrouwbaar.test.ts`.
- Bron: code (niet live nagespeeld: dat vraagt twee echte accounts).

### Hinderlijk

**B3. In een gezin krijgt iedereen alle wekkers, en de thuis-momenten zijn gedeeld**
- Voor wie: zus, Tuur en Louise, als ze samen in één gezin zitten.
- Waar: `src/services/sync.ts:86-89` bouwt de wekkers van elk toestel uit de gedeelde bakken; `bak_items` met
  `kind = settings` hoort in een gezin bij de eigenaar, dus thuis-momenten, keukentemperatuur en "herinnering om te
  voeden" gelden voor iedereen.
- Wat je ervaart: Tuur: "Mijn zus plant een brood en ik krijg om 23:15 *Nu: vormen*." Louise: "De planner zegt dat ik
  op weekdagen pas om 17:30 thuis ben, maar dat zijn de uren van mijn zus." Bij voeden krijgen alle drie dezelfde
  herinnering, ook als er al iemand gevoed heeft.
- Oorzaak: wekkers zijn per account, maar ze worden gemaakt uit gedeelde gegevens. Instellingen zijn één gedeelde rij.
- Voorstel: houd thuis-momenten, keukentemperatuur en meldingskeuzes per persoon (op het toestel, of per account). Geef
  een bak een eigenaar: "wekkers voor mij" of "voor iedereen", met standaard enkel voor wie plant. Laat een
  voedingsherinnering vervallen zodra iemand in het gezin voedde (dat gebeurt nu al vanzelf na de sync, maar enkel als
  die op tijd loopt). Inspanning middel. Dit kan zonder databankwijziging als de persoonlijke instellingen op het toestel
  blijven; per account bewaren vraagt een kleine migratie.
- Bron: code (niet live getest).

**B5. Een recept uit het boek wordt soms een verkeerd schema**
- Voor wie: zus vooral (zij zet recepten om).
- Waar: `src/domain/recipeText.ts:205-255`.
- Wat je ervaart: "Ik plakte mijn recept. Het bakplan laat mij vouwen *na* de bulk, de bulk staat als 10 minuten
  handwerk, en voor het vormen gaat er geen wekker af."
- Bewijs: proef met een gewoon recept ("Bulk 4 à 5 uur bij 24°C, met 4 keer stretch and fold om het halfuur. Vorm en
  laat een nacht rijzen in de koelkast."), zie `3-recept-uit-tekst-schema.png` en `4-bakplan.png`:
  - de bulk wordt een *handstap* van 4 u 30, niet gevoelig voor temperatuur;
  - "4 keer stretch and fold" wordt één stap van 30 minuten *ná* de bulk (het Engelse woord wordt niet als herhaling
    herkend);
  - "Vorm en laat een nacht rijzen" wordt één wachtstap: het vormen krijgt geen wekker;
  - "bij 24°C" wordt niet gebruikt als temperatuur van het recept;
  - er komt geen stap "starter voeden" voor het mengen, dus geen wekker om de levain te maken.
  De waarschuwingen zijn er wel, maar ze zijn algemeen ("controleer de volgorde").
- Voorstel: herken "stretch and fold", "coil fold" en "vouwen" als herhaling *binnen* de bulk; splits "vorm en laat
  rijzen" in een handstap en een wachtstap; lees "bij 24 °C" als `refTempC`; voeg standaard "Starter voeden" toe als het
  recept levain of starter gebruikt (met de vraag hoe lang de starter er zelf over doet, zie K1). Zet onzekere stappen
  bovenaan in het rood en noem ze bij naam. Inspanning middel, geen databankwijziging. Voeg dit recept toe aan
  `tests/recipeText.test.ts`.
- Bron: eigen test.

**B6. "Ik ben weg (meerdere dagen)" annuleert je bak standaard**
- Voor wie: allen.
- Waar: `app/weg.tsx:64` (`cancelHit` staat op `true`).
- Wat je ervaart: "Ik vulde in dat ik weg ben en tikte op *Bewaar*. Mijn geplande brood was weg." Zie
  `5-weg-bak-annuleren-staat-aan.png`: de keuze staat onderaan, al aangezet.
- Voorstel: zet de keuze standaard uit, of vraag het met twee knoppen ("Bak annuleren" / "Bak houden"). Inspanning
  klein.
- Bron: eigen test.

**B7. Weg is weg: recept verwijderen en de editor sluiten zonder vraag**
- Voor wie: allen.
- Waar: `app/recept/[id].tsx:98, 176`.
- Wat je ervaart: "Ik tikte per ongeluk op *Recept verwijderen*." Of: "Ik paste tien minuten tijden aan, tikte op
  *Sluiten* en alles was weg." Een recept uit tekst dat nog niet bewaard is, gaat bij *Sluiten* ook verloren.
- Voorstel: vraag bevestiging bij verwijderen (zoals bij "Bak annuleren"), of toon 15 seconden "Ongedaan maken" zoals bij
  voeden. Vraag bij *Sluiten* met niet bewaarde wijzigingen: "Wijzigingen bewaren?". Inspanning klein.
- Bron: code.

**B8. Het broden-logboek is eenrichtingsverkeer**
- Voor wie: zus vooral (wil leren van vorige broden), Louise (overzicht).
- Waar: `app/(tabs)/broden.tsx`.
- Wat je ervaart: "Ik vergat een foto. Achteraf toevoegen kan niet, en een tikfout verbeteren ook niet." En: "Ik bakte
  zonder plan, dat brood kan ik niet noteren." Wie niets kiest, bewaart toch "bruin" en "gelijkmatig". De zin
  "Vergelijkingen tussen broden verschijnen pas na 5 broden" belooft iets wat de app niet heeft.
- Voorstel: maak een bewaard brood aanpasbaar (foto, korst, kruim, zin) en verwijderbaar; voeg "Brood noteren zonder
  plan" toe; laat korst en kruim leeg tot je kiest; toon bij het plannen van een recept "Vorige keer met dit recept:
  ...". Schrap de belofte over vergelijkingen of bouw ze (zie K3). Inspanning middel, geen databankwijziging.
- Bron: eigen test en code.

**B9. Voeden staat onder de vouw, en verdwijnt tijdens een bak**
- Voor wie: allen (voeden is de meest gebruikte handeling).
- Waar: `app/(tabs)/index.tsx:108-157`.
- Wat je ervaart: "Ik open de app om te zeggen dat ik gevoed heb, en moet eerst scrollen." Zie
  `2-vandaag-voeden-onder-de-vouw.png`: bovenaan staan het starteroverzicht, "Eigen naam kiezen", "Delen" en de boog;
  de knop staat onderaan. Tijdens een bak vervangt de stapkaart de voedingskaart volledig, terwijl je tijdens het bakken
  juist ook voedt (levain, en daarna de starter terug op ritme).
- Voorstel: zet bovenaan Vandaag één regel met de belangrijkste handeling ("Gevoed", of "Nu: vormen"). Toon de knop
  "Gevoed" ook tijdens een bak, klein onder de stapkaart. Zet "Delen" en "Eigen naam kiezen" lager, of toon ze enkel de
  eerste dagen. Inspanning klein.
- Bron: eigen test.

**B11. De meldingen zijn moeilijk te vinden, en de voedingsherinnering staat standaard uit**
- Voor wie: allen.
- Waar: `app/instellingen.tsx:185-192`, `src/domain/defaults.ts:81` (`feedReminder: false`), `app/welkom.tsx`.
- Wat je ervaart: "Waarom krijg ik nooit een melding om te voeden?" Het welkomscherm vraagt het niet, en in Instellingen
  staat "Wekkers en meldingen" pas na Account, Gezin en Koppelen.
- Voorstel: zet Meldingen bovenaan in Instellingen. Vraag in het welkomscherm: "Wil je een melding als het tijd is om
  te voeden?", met de knop om meldingen aan te zetten (iOS vraagt toestemming enkel na een tik). Inspanning klein.
- Bron: code. Extern: [iOS vraagt toestemming voor meldingen enkel na een tik van de gebruiker](https://www.mobiloud.com/blog/progressive-web-apps-ios/).

**B12. Gezin en koppelen zijn twee ideeën die op elkaar lijken**
- Voor wie: alle drie, op het moment dat ze beslissen hoe ze samenwerken.
- Waar: `app/koppelen.tsx`, `src/ui/Gezin.tsx`, `src/ui/Koppelen.tsx`, `src/ui/StarterOverview.tsx:87`.
- Wat je ervaart: "Moet ik een gezinscode of een koppelcode maken? Ze zien er hetzelfde uit (bv. 3F9A12BC07)." Een lid
  leest "Je werkt in het gezin van de eigenaar" zonder te zien wie dat is. Het welkomscherm stelt "Jean Tuur en Jean
  Flore" voor, ook voor Louise.
- Voorstel: begin het scherm Delen met één vraag en twee grote keuzes: "Wij zorgen samen voor één starter" (gezin) of
  "Ik wil enkel meekijken naar een andere starter" (koppelen). Toon daarna enkel wat bij die keuze hoort. Noem de
  eigenaar bij naam. Gebruik een ander codeformaat per soort (bv. "G-" ervoor), zodat een verkeerde code meteen een
  duidelijke fout geeft. Maak het voorbeeld in het welkomscherm neutraal ("bv. Jean van Louise"). Inspanning middel,
  geen databankwijziging.
- Bron: code.

**B14. Enkele kleuren halen het contrast niet**
- Voor wie: allen, zeker bij fel licht in de keuken.
- Waar: `src/ui/kit.tsx` en `src/ui/theme.ts`.
- Bewijs (berekend met de WCAG-formule):
  - terracotta tekst op blush, **3,65:1**: de knoppen "Niet gevoed" en "Niet bekeken" in de dagelijkse vraag
    (`PeakQuestion.tsx:24-25`). Dat is precies wat de huisstijl verbiedt;
  - grijze notitietekst (`mut`) op blush, **4,29:1**: alle kleine uitleg in blush-kaarten (moet 4,5:1 zijn);
  - de rand van invoervelden en de uit-stand van een schakelaar (`line` op kaart), **1,34:1**: WCAG 1.4.11 vraagt 3:1
    voor onderdelen die je moet zien om ze te bedienen.
- Voorstel: ghost-knoppen op blush in inkt of bordeaux; notities op blush in inkt; veldranden en de lege schakelaar
  in `mut` (5,9:1). Inspanning klein.
- Bron: eigen meting. Extern: [WCAG 1.4.11 (3:1 voor bedieningsonderdelen)](https://w3c.github.io/wcag21/understanding/non-text-contrast).

**B15. Tekst groter zetten op de iPhone doet niets**
- Voor wie: allen, zeker van op afstand op het aanrecht.
- Waar: alle lettergroottes staan vast in pixels (`src/ui/kit.tsx:18-27`). Kleine labels zijn 11-12 px, ook de
  tabbalk.
- Bewijs: in de test bleef de pagina bij 200% tekst gelijk.
- Voorstel: koppel de basisgrootte aan de iOS-instelling "Tekstgrootte" (`font: -apple-system-body` op de root en
  verder relatieve maten), en zet labels en de tabbalk op minstens 13 px. Test daarna de grootste stand, want lay-outs
  kunnen dan breken. Inspanning middel.
- Bron: eigen test. Extern: [Dynamic Type op het web via -apple-system-body](https://frontendmasters.com/blog/letting-ios-text-size-setting-affect-font-size-on-the-web/),
  [Vispero over tekstgrootte op iOS](https://vispero.com/resources/text-resizing-web-pages-ios-using-dynamic-type/).

**B17. Een back-up terugzetten kan op de iPhone bijna niet**
- Voor wie: allen (op het moment dat het misloopt).
- Waar: `app/instellingen.tsx:135-160`.
- Wat je ervaart: "Ik moet de inhoud van een bestand plakken? Hoe open ik dat bestand?" Met foto's erin is de tekst
  bovendien honderden kilobytes groot.
- Voorstel: een knop "Kies het back-upbestand" (`<input type="file">` opent de Bestanden-app). Zeg bij het downloaden
  waar het bestand terechtkomt (Bestanden, Downloads). Inspanning klein.
- Bron: code.

**B10. "In de koelkast gezet" leest als een melding, niet als een knop**
- Voor wie: Louise en Tuur vooral (lezen de app minder vaak).
- Waar: `src/ui/StarterActions.tsx:52`.
- Wat je ervaart: "Staat hij nu in de koelkast of niet?" De regel erboven zegt "Staat op kamertemperatuur", de omrande
  knop eronder zegt "In de koelkast gezet".
- Voorstel: "Zet in de koelkast" en "Haal uit de koelkast", met de stand als gewone tekst erboven. Inspanning klein.
- Bron: eigen test.

### Kleinigheden

**B16. Een lege naam mag.** Wis je de naam van de starter, dan staat er "Dag 21 met " (`app/(tabs)/jean.tsx:149`).
Houd de vorige naam als het veld leeg is. Klein. Voor allen.

**B18. Thuis-momenten uit en weer aan zetten wist je eigen uren** (`app/instellingen.tsx:89-93`). De keuze in het
welkomscherm ("weekdagen na 17:30") verschilt ook van de standaard (ook 6:30 tot 8:00). Bewaar de uren als de schakelaar
uit staat. Klein. Voor Louise vooral (plant graag precies).

**B19. "Dag 21" staat twee keer bovenaan** (klein label en titel), en na een jaar staat er "Dag 400 met Jean". Toon na
een paar maanden "Jean, 1 jaar en 2 maanden", of de datum van vandaag als titel. Klein. Voor allen.

**B20. Er zijn drie manieren om "verdubbeld" te noteren** (knop "Verdubbeld", "Eerder verdubbeld? Kies het uur" en de
dagelijkse vraag), en de expertvelden ("Klaar binnen (uur)", "Zoveel keer op rij") staan open in "Over Jean". Zet die
velden achter "Meer instellingen" en kies één hoofdweg (de dagelijkse vraag). Middel. Voor Louise en Tuur vooral.

**B21. De kaart "Eerste brood" blijft na tientallen broden.** Noem ze "Volgend brood" zodra er een brood in het
logboek staat (`app/(tabs)/index.tsx:166-181`). Klein.

**B13. Het aanmeldscherm zegt "Zelfde account als de Recepten-app"** (`src/ui/AuthForm.tsx:44`). Voor Louise betekent
dat niets, en het kan verwarren of ze een nieuw account mag maken. Schrijf "Heb je al een account voor Recepten of
Tuin? Gebruik dat. Anders maak je hier een nieuw." Klein.

**B22. Een gekoppelde starter van iemand in een gezin toont mogelijk oude gegevens** (vermoeden).
`bak_get_linked` geeft de eigen rijen van de gekoppelde persoon. Zit die persoon in een gezin, dan werkt hij of zij op de
rijen van de eigenaar en zie jij een starter die niet meer bijgehouden wordt. Live controleren; dan ofwel de
gezinsstarter tonen, ofwel uitleggen. Middel, vraagt mogelijk een databankwijziging.

### Kansen (uit de vergelijking met andere apps)

**K1. Plan de voeding van de starter mee, met zijn eigen snelheid.** Apps als S.D Timer Pro en Sourdough Timer rekenen
terug vanaf het bakuur tot het moment van de voeding, zodat de starter op zijn piek is als je mengt. Crumbly kent de
echte snelheid van de starter al (uren tot verdubbeling). Gebruik die voor de stap "Starter voeden": "Jean doet er
gemiddeld 5 u over, voed hem om 12:00." Middel. Voor de zus.

**K2. Toon na het voeden wanneer de piek verwacht wordt.** BakeReady toont "heeft honger, stijgt, bijna op zijn piek,
over zijn piek". Crumbly kan na een voeding één regel tonen: "Verwacht verdubbeld rond 15:30 (op basis van de laatste
keren)". Dat helpt ook bij de dagelijkse vraag. Klein. Voor allen.

**K3. Leer van vorige broden per recept.** Logboeken in andere apps beoordelen ook smaak en rijs, en filteren per
recept. Crumbly kan bij "Plan deze bak" de zin "volgende keer" en de foto van het vorige brood met dit recept tonen.
Middel. Voor de zus.

**K4. Een weekoverzicht.** Voedingen, bakstappen en "weg" in één lijst per dag. Dit is vooral nuttig voor Louise (wie
doet wat wanneer) en in een gezin. Middel.

Bewust niet overnemen: foto-analyse met AI van het brood (CrumbKeep), reclame, betaalde extra's en badges. Dat past niet
bij een kleine app voor één gezin.

---

## 3. Wat al goed is (behouden)

- Eerlijk: de app zegt overal dat tijden schattingen zijn ("Het deeg beslist"), en een recept uit tekst wordt pas
  bewaard na nakijken.
- De wekkers zijn eerlijk: het bakplan zegt waarom de bel niet zal afgaan (`alarmState.ts`), en je kan een testmelding
  sturen.
- Voeden met één tik en 15 seconden "Ongedaan maken".
- Werkt offline: na het herladen zonder internet opende de app gewoon, met de gegevens.
- Snel: de eerste weergave na 0,4 s (lokaal); de bundel is 1,6 MB, of 0,45 MB gecomprimeerd.
- Geen fouten in de console tijdens de hele doorloop.
- Alle knoppen en velden zijn minstens 44 px hoog. Er zijn geen emoji en er staat geen Engels in de app.
- Het scherm blijft aan als er binnen het halfuur een stap komt (`useWakeLock`). Dat werkt op het beginscherm vanaf
  iOS 18.4.
- Voorzichtige keuzes in het gezin: wissen kan niet (enkel `deleted_at`), ontkoppelen en "Nieuwe code" vragen eerst
  bevestiging.

---

## 4. Vergelijking met andere apps

De bronnen zijn vooral beschrijvingen in de App Store en Google Play. Onafhankelijke reviews vond ik niet.

| Wat zij hebben | Crumbly | Oordeel |
| --- | --- | --- |
| Schema terugrekenen vanaf het bakuur, met keukentemperatuur ([Sourdough Timer](https://play.google.com/store/apps/details?id=com.sdtimer.free)) | ja (terugrekenen, temperatuur als het recept die heeft) | aanwezig |
| Voedingsuur zo kiezen dat de starter op zijn piek is ([S.D Timer Pro](https://apps.apple.com/il/app/s-d-timer-pro/id6760554281)) | vaste stap van 5 u in het voorbeeld, ontbreekt bij een recept uit tekst | **overnemen** (K1) |
| Status "honger, stijgt, bijna piek, over piek" ([BakeReady](https://apps.apple.com/app/id6785357199)) | enkel "klaar om te bakken" | **aanpassen** (K2) |
| Herinneringen anders in de koelkast (wekelijks) dan op het aanrecht ([BakeReady](https://mwm.ai/apps/bakeready-sourdough-tracker/6785357199), [Surdeg](https://mwm.ai/apps/surdeg/6766092580)) | ja (`fridgeFeedDays`) | aanwezig |
| Logboek met foto en beoordeling van korst, kruim, smaak en rijs ([Sourdough Tracker: Starter Log](https://mwm.ai/apps/sourdough-tracker-log-crumb/6760582503)) | korst, kruim, zin, foto, maar niet aan te passen | **aanpassen** (B8, K3) |
| Meerdere starters, kalender ([overzicht](https://appshunter.io/ios/topics/sourdough-tracker)) | één eigen starter plus gekoppelde (enkel kijken) | weekoverzicht als kans (K4) |
| Offline, zonder aanmelden ([LoafLab](https://mwm.ai/apps/loaflab-sourdough-planner/6762065648)) | offline ja, aanmelden verplicht | bewust zo (sync en gezin) |
| Foto-analyse met AI ([CrumbKeep](https://mwm.ai/apps/sourdough-starter-tracker-pro/6788656504)) | nee | **bewust niet** |
| Samen op één starter, met wie voedde | ja (gezin, `Feed.by`) | Crumbly heeft dit, de andere apps die ik vond niet |

---

## 5. Controle van de vakinhoud

| Aanname in Crumbly | Wat de bronnen zeggen | Oordeel |
| --- | --- | --- |
| Per 10 graden koeler duurt rijzen 2 keer langer (`tempDoubling` 2) | De tijd verdubbelt per ongeveer 8 °C ([The Sourdough Journey](https://thesourdoughjourney.com/?p=3236)), per 5 °C ([Weekend Bakery](https://www.weekendbakery.com/posts/the-temperature-equation-timing-your-fermentation/)) of per 10 °F, ongeveer 5,5 °C. Allemaal met de kanttekening dat het deeg beslist. | **Grof, en aan de korte kant.** Bij 6 graden koeler rekent Crumbly 1,5 keer langer, de 8 °C-regel 1,7 keer en de 5 °C-regel 2,3 keer. Voorstel: standaard 2,4 per 10 graden (dat is de 8 °C-regel), en de uitleg zo houden. |
| Voorbeeldrecept: bulk ongeveer 4 uur na het toevoegen van de starter, zonder temperatuur | Met 20% starter ongeveer 4 tot 5 uur bij 24 °C en 7 tot 8 uur bij 20 °C (samengevat door [The Sourdough Journey](https://thesourdoughjourney.com/?p=3236)) | **Optimistisch voor een Belgische keuken in de winter.** Geef het voorbeeld `refTempC` 24, zodat de temperatuuraanpassing meteen werkt. |
| In de koelkast om de 7 dagen voeden | King Arthur: ongeveer één keer per week ([King Arthur](https://www.kingarthurbaking.com/learn/guides/sourdough/maintain)); anderen zeggen ook om de twee weken | **Klopt.** |
| "Weg": in de koelkast houdt de starter het 2 tot 3 weken | Wekelijks voeden is de regel, maar een paar weken is haalbaar ([fridge.com](https://fridge.com/blogs/news/how-often-do-you-feed-sourdough-starter-in-the-fridge)) | **Klopt grosso modo**, en het staat er als tip. |
| Klaar: 3 keer op rij verdubbeld binnen 6 uur, en minstens 14 dagen oud | 2 tot 3 keer op rij binnen 4 tot 8 uur (sommigen 8 tot 12 uur). Ten vroegste dag 7, dag 14 is veiliger ([Pantry Mama](https://www.pantrymama.com/how-do-you-know-when-your-starter-is-ready-to-bake-with), [Crumbwise](https://wild-crumb.pages.dev/blog/sourdough-starter-complete-guide)) | **Klopt, aan de voorzichtige kant.** Dat is goed voor een beginner. Let op: B1 zet de leeftijd verkeerd, zodat de regel van 14 dagen niets meer zegt. |
| Hydratatie op het totale meel, met meel en water uit de starter | Gangbare bakkerspraktijk. Dit heb ik niet extern opgezocht. | Eigen vakkennis, niet getoetst. |

---

## 6. Platformrisico's op iOS

| Risico | Kans | Wat de gebruiker merkt | Bron |
| --- | --- | --- | --- |
| Meldingen werken enkel vanaf het beginscherm. In iOS 26 moet "Open als webapp" aan blijven staan voor die site. | middel | Geen enkele wekker. De app zegt al "zet Crumbly op je beginscherm", maar noemt de schakelaar "Open als webapp" niet. | [Michael Tsai, Web Apps in iOS 26](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/), [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios/) |
| Push is op iOS minder betrouwbaar, en abonnementen kunnen wegvallen | middel | Een wekker die niet komt. Crumbly herstelt het abonnement bij het openen (`refreshPushSubscription`) en de server herkanst. De proef op een echte iPhone moet nog. | [webscraft](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en) (ervaring van ontwikkelaars, geen officiële bron) |
| Meldingen hebben geen knoppen ("Gedaan") en geen afbeeldingen | zeker | Je moet de app openen om een stap af te vinken | [progressivewebapps.com](https://progressivewebapps.com/background/ios-web-push/) |
| Gegevens in Safari en op het beginscherm zijn gescheiden. De 7-dagenregel geldt voor Safari, niet voor apps op het beginscherm. | laag (met account) | Wie eerst in Safari begon, ziet op het beginscherm opnieuw "Meld je aan". Zonder sync zou je gegevens kwijt zijn. | [iTnews](https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833), [WebKit-bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350) |
| Het scherm aan houden werkt op het beginscherm pas vanaf iOS 18.4 | laag (iOS 26) | Het scherm valt toch uit; nog niet op een toestel bevestigd | [Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock), [WebKit-bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) |
| Tekstgrootte van iOS wordt genegeerd | zeker | Kleine letters, zie B15 | zie B15 |

---

## 7. Privacy en technische bronnen

- **Je gegevens meenemen:** dat kan (Back-up downloaden). Terugzetten is onhandig, zie B17.
- **Je gegevens wissen:** in de app kan dat niet. De werkafspraak zegt terecht dat een account (`auth.users`) vanuit
  Crumbly nooit gewist wordt, want het is gedeeld met Recepten, Tuin en Op reis. Een gebruiker verwacht wel een weg.
  Aandachtspunt, geen juridisch advies: de AVG kent het recht op wissen (art. 17) en op overdraagbaarheid (art. 20).
  Voorstel: "Wis mijn Crumbly-gegevens" (zet `deleted_at` op de eigen rijen en verlaat gezin en koppelingen), plus een
  zin over wie je contacteert om het hele account te laten wissen. Ter vergelijking: Apple eist voor apps in de App
  Store dat je je account in de app kan wissen. Dat geldt niet voor een webapp, maar het zegt wat mensen verwachten.
  Bronnen: [Apple, richtlijn 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion),
  [Kamerstuk over art. 17 en 20](https://zoek.officielebekendmakingen.nl/dossier/kst-34851-4.odt).
- **Wat de ander ziet:** bij koppelen staat duidelijk "Recepten, bakken en broden blijven privé". Bij het gezin staat
  ook wat gedeeld wordt. Niet vermeld: dat de **naam** die je kiest bij elke voeding komt, en dat je e-mailadres in
  Instellingen zichtbaar is voor wie je telefoon gebruikt. Dat is in orde, maar zeg bij "Jouw naam in het gezin" dat de
  anderen hem zien.
- **Meldingen:** op het vergrendelscherm staan de naam van het recept en de stap ("Desem van oma: Nu: vormen"). Dat is
  onschuldig.
- **`npm audit`:** 18 meldingen (5 hoog, geen kritieke) in `expo-router`/`expo-constants`, `image-size`, `postcss` en
  `decode-uri-component`/`query-string`. Die zitten in bouwhulpmiddelen of in het lezen van een adres in je eigen browser.
  Het echte risico voor deze app is klein. `api/push/send.js` (de enige servercode) gebruikt `web-push`, en daar zit geen
  melding op. Oplossen vraagt een Expo-upgrade (zoals CLAUDE.md al zegt).
- **Taal:** de teksten zijn vriendelijk en in gewone woorden. Sommige uitleg is lang, bv. "Foto van de bladzijde?"
  (60 woorden) en de uitleg bij temperatuur. Richtlijnen voor taalniveau B1 houden zinnen op 15 tot 20 woorden, met één
  gedachte per zin ([iplo](https://iplo.nl/digitaal-stelsel/toepasbare-regels/maken-testen/schrijfwijzer/schrijftips-taalniveau-b1/),
  [Lezen & Schrijven](https://www.lezenenschrijven.nl/sites/default/files/2025-10/202510_LES_checklist_LekkerDuidelijkSchrijven_V6.pdf)).
  Er is geen specifiek Vlaamse richtlijn gevonden.

---

## 8. Verschillen tussen de gebruikers

| Onderwerp | Zus | Tuur | Louise |
| --- | --- | --- | --- |
| Begin | heeft al een starter en gegevens | idem, of lid van het gezin | nieuw: last van B1 (startdatum) en B13 (aanmeldtekst) |
| Wekkers in een gezin | wil ze voor haar eigen bak | krijgt ze ongevraagd (B3) | krijgt ze ongevraagd (B3) |
| Thuis-momenten | de gedeelde uren zijn van haar | moet met haar uren leven (B3) | idem, en plant graag precies (B18) |
| Recept uit het boek | gebruikt dit het meest (B5) | zelden | zelden |
| Overzicht | denkt per bak | denkt per voeding | wil een weekbeeld (K4) |
| Delen | kiest gezin of koppelen | idem | weet niet welke van de twee (B12) |
| Toestel delen | nee | misschien (iPad) | misschien: last van B4 |

---

## 9. Voorstel voor de volgorde

1. **PR "kleine dingen, grote winst"** (een halve dag, geen databank): B1, B2, B16, B6, B7, B10, B14.
2. **PR "Vandaag en Instellingen"**: B9, B11, B19, B21, B13.
3. **PR "Gezin per persoon"** (beslissing nodig, zie open vragen): B3, B4, en B12 als je toch in die schermen werkt.
4. **PR "Recept uit tekst"**: B5, plus het voorbeeldrecept met `refTempC` 24 en de temperatuurregel (hoofdstuk 5).
5. **PR "Broden en back-up"**: B8, B17.
6. **PR "Groter lezen"**: B15 (apart, want het raakt elk scherm).
7. **Later, als je dat wil**: K1 tot K4, en "Wis mijn Crumbly-gegevens".

---

## 10. Wat ik niet kon testen

Getest is de webversie zonder Supabase (lokaal), in Chromium in een iPhone-venster. Niet getest:

- Een echte iPhone: meldingen in België, het beginscherm, "Tekst scannen", het toetsenbord, VoiceOver, het scherm dat
  aan blijft, het gedrag na een week niet openen.
- Alles met een account: aanmelden, sync tussen toestellen, gezin, koppelen en wekkers. Dat vraagt testaccounts en
  schrijft in de gedeelde databank, en dat mag niet zonder Tuurs ok.
- Lange teksten en grote tekstgrootte op een echt toestel.

**Afvinklijst om zelf te proberen** (vul `docs/iphone-test.md` aan):
- [ ] Louise maakt een nieuw account: welke startdatum en welke "Dag" ziet ze? (B1)
- [ ] Tuur gaat bij het gezin van de zus. De zus plant een bak: krijgt Tuur de wekkers? Welke thuis-momenten ziet hij? (B3)
- [ ] Voed offline (vliegtuigstand), meld je af en meld je aan met een ander account. Is de voeding na het terug
      aanmelden met het eerste account in de cloud? (B4)
- [ ] Instellingen van de iPhone, Toegankelijkheid, Tekstgrootte op de grootste stand: verandert Crumbly mee? (B15)
- [ ] Zet bij Crumbly op het beginscherm "Open als webapp" uit: zegt Crumbly dat de bel niet zal afgaan?
- [ ] Back-up downloaden: waar staat het bestand, en kan je het terugzetten? (B17)

---

## 11. Open vragen aan Tuur

1. Hoe werken jullie drie samen: één gezin op de starter van de zus, ieder een eigen starter met koppelingen, of een mix?
   Dat bepaalt hoe dringend B3 en B12 zijn.
2. In een gezin: wie moet de wekkers van een bak krijgen, enkel wie plant of iedereen?
3. Bakt Louise zelf, of kijkt ze vooral mee? Kijkt ze mee, dan is "enkel kijken" (koppelen) misschien genoeg, en is K4
   (weekoverzicht) interessanter dan de baktools.
4. Wissen van gegevens: is "Wis mijn Crumbly-gegevens" (zonder het account) goed, en bij wie kan iemand terecht om het
   hele account te laten wissen?
5. Welke kansen (K1 tot K4) zijn de moeite waard?
6. Mag de standaard temperatuurregel naar 2,4 keer per 10 graden (de 8 °C-regel), of wil je eerst zien wat de zus in haar
   keuken meet?
