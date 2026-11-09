import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationMinutes, normalizeNumbers, parseIngredientLine, parseRecipeText } from '../src/domain/recipeText.ts';

const SAMPLE1 = `Klassieke bâtard

Ingrediënten
500 g tarwebloem (T65)
350 g water
100 g actieve zuurdesemstarter
10 g zout

Bereiding
1. Meng bloem en water en laat 30 minuten rusten (autolyse).
2. Voeg de starter en het zout toe en kneed 5 minuten.
3. Laat 4 tot 5 uur rijzen bij kamertemperatuur.
4. Vorm het deeg tot een bâtard en laat 12 uur rijzen in de koelkast.
5. Verwarm de oven voor op 250 graden met de pan erin.
6. Bak 20 minuten met deksel en 25 minuten zonder.`;

test('ingrediënten: meel, water, starter en zout in gram', () => {
  const r = parseRecipeText(SAMPLE1);
  assert.equal(r.name, 'Klassieke bâtard');
  assert.deepEqual(r.flours.map((f) => [f.name, f.grams]), [['Tarwebloem', 500]]);
  assert.equal(r.waterG, 350);
  assert.equal(r.starterG, 100);
  assert.equal(r.saltG, 10);
  assert.equal(r.starterHydration, 100);
});

test('stappen: tijden, wachten of handwerk, en splitsen bij twee tijden in één zin', () => {
  const r = parseRecipeText(SAMPLE1);
  const by = (re: RegExp) => r.process.find((s) => re.test(s.name))!;
  assert.equal(by(/autolyse/).minutes, 30);
  assert.equal(by(/autolyse/).kind, 'wacht');
  assert.equal(by(/autolyse/).tempSensitive, undefined, 'een rustpauze is niet temperatuurgevoelig');
  assert.ok(r.process.some((s) => s.name === 'Meng bloem en water'), 'woordjes blijven staan bij het splitsen');
  assert.equal(by(/kneed/i).minutes, 5);
  assert.equal(by(/kneed/i).kind, 'hand');
  const rise = by(/4 tot 5 uur/);
  assert.equal(rise.minutes, 270, 'bereik: het midden');
  assert.equal(rise.kind, 'wacht');
  assert.equal(rise.tempSensitive, true, 'rijzen bij kamertemperatuur is temperatuurgevoelig');
  const fridge = by(/12 uur/);
  assert.equal(fridge.minutes, 720);
  assert.equal(fridge.tempSensitive, undefined, 'koelkast is niet temperatuurgevoelig');
  assert.deepEqual(r.process.filter((s) => /^Bak/.test(s.name)).map((s) => [s.name, s.minutes]), [['Bak 20 minuten met deksel', 20], ['Bak 25 minuten zonder', 25]]);
  assert.equal(by(/Verwarm/).minutes, 45, 'voorverwarmen zonder tijd: 45 minuten geschat (5 minuten was te kort voor een oven met pan)');
  assert.match(by(/Verwarm/).check ?? '', /voorverwarm/i);
  assert.ok(r.warnings.some((w) => /geen tijd/.test(w)));
  assert.ok(r.warnings.some((w) => /midden/.test(w)));
  assert.ok(r.warnings.some((w) => /Controleer de tijden/.test(w)), 'altijd nakijken');
});

test('zonder kopjes, lepels en ml, regels die midden in de zin breken', () => {
  const r = parseRecipeText(`Volkorenbrood
500g volkorenmeel
325 ml water
80 g levain
1 el zout
Meng alles en laat het deeg een uur
rusten. Vouw het deeg en laat het daarna een nacht rijzen in de koelkast.`);
  assert.equal(r.flours[0].grams, 500);
  assert.equal(r.waterG, 325);
  assert.equal(r.starterG, 80);
  assert.equal(r.saltG, 0);
  assert.ok(r.warnings.some((w) => /zout staat in lepels/i.test(w)));
  assert.ok(r.process.some((s) => s.minutes === 60 && s.kind === 'wacht'), 'een uur rusten');
  assert.ok(r.process.some((s) => s.minutes === 720), 'een nacht = 12 uur');
  assert.ok(r.warnings.some((w) => /nacht/i.test(w)));
});

test('kg en liter, meerdere meelsoorten, hydratatie van de starter', () => {
  const r = parseRecipeText(`Bereiding
Ingrediënten
0,8 kg tarwebloem
200 g roggemeel
0,7 l water
200 g zuurdesem (50% hydratatie)
20 g zout
zaadjes naar smaak`.replace('Bereiding\nIngrediënten', 'Ingrediënten'));
  assert.deepEqual(r.flours.map((f) => f.grams), [800, 200]);
  assert.equal(r.waterG, 700);
  assert.equal(r.starterHydration, 50);
  assert.equal(r.starterG, 200);
});

test('een tekst zonder bruikbare gegevens geeft duidelijke waarschuwingen en geen crash', () => {
  const r = parseRecipeText('Gewoon wat tekst zonder recept.');
  assert.equal(r.flours.length, 0);
  assert.ok(r.warnings.some((w) => /geen meel/.test(w)));
  assert.ok(r.warnings.some((w) => /geen water/.test(w)));
  const empty = parseRecipeText('');
  assert.equal(empty.process.length, 0);
});

test('tijden herkennen', () => {
  assert.equal(durationMinutes('30 minuten')?.minutes, 30);
  assert.equal(durationMinutes('2 uur')?.minutes, 120);
  assert.equal(durationMinutes('1,5 uur')?.minutes, 90);
  assert.equal(durationMinutes('een half uur')?.minutes, 30);
  assert.equal(durationMinutes('twee uur')?.minutes, 120);
  assert.equal(durationMinutes('250 graden'), null);
  assert.equal(durationMinutes('8 - 10 uur')?.minutes, 540);
});

const BASIS = 'Brood\n500 g bloem\n350 g water\n100 g starter\n10 g zout\nBereiding\n';

test('ingrediënten met de hoeveelheid achteraan (naam eerst, ook met dubbele punt en type)', () => {
  const r = parseRecipeText('Landbrood\nBloem 500 g\nWater: 350 ml\nStarter 100 g\nZout 10 g\nBereiding\nLaat 4 uur rijzen.');
  assert.deepEqual([r.flours[0].grams, r.waterG, r.starterG, r.saltG], [500, 350, 100, 10]);
  assert.equal(r.warnings.some((w) => /Ik vond geen/.test(w)), false);
  assert.deepEqual(parseIngredientLine('bloem T65 500 g'), { grams: 500, rest: 'bloem T65', unit: 'g' });
  assert.equal(parseIngredientLine('Bloem 500 g')?.grams, 500, 'het getal wordt niet in tweeën geknipt (50 en 0)');
  assert.equal(parseIngredientLine('Water 350'), null, 'zonder eenheid geen ingrediënt');
});

test('breuken: ½, 1½ en 1/2', () => {
  assert.equal(normalizeNumbers('1½ dl water ½ kg bloem 1/2 theelepel'), '1.5 dl water 0.5 kg bloem 0.5 theelepel');
  assert.equal(normalizeNumbers('op 5/11 gestart'), 'op 5/11 gestart', 'een datum blijft een datum');
  const r = parseRecipeText('Brood\n1½ dl water\n½ kg tarwebloem\n100 g starter\n10 g zout\nBereiding\nLaat 2 uur rijzen.');
  assert.equal(r.waterG, 150);
  assert.equal(r.flours[0].grams, 500);
});

test('samengestelde tijden: 1 uur en 30 minuten, 1u30, anderhalf uur', () => {
  assert.equal(durationMinutes('Laat 1 uur en 30 minuten rijzen')?.minutes, 90);
  assert.equal(durationMinutes('Rust 1u30')?.minutes, 90);
  assert.equal(durationMinutes('Laat anderhalf uur staan')?.minutes, 90);
  assert.equal(durationMinutes('Rust 2 uur 15 min')?.minutes, 135);
  assert.equal(durationMinutes('Laat 4 tot 5 uur rijzen')?.minutes, 270, 'een bereik blijft het midden');
  assert.equal(durationMinutes('Laat 1,5 uur rijzen')?.minutes, 90);
  const r = parseRecipeText(`${BASIS}Laat 1 uur en 30 minuten rijzen. Rust nog 1u30.`);
  assert.deepEqual(r.process.map((p) => p.minutes), [90, 90], 'geen losse stap van 60 en 30');
});

test('een wachtstap zonder tijd is geen handstap van 5 minuten met een wekker', () => {
  const r = parseRecipeText(`${BASIS}Meng alles. Laat het deeg rijzen tot het verdubbeld is. Vorm het brood.`);
  const wait = r.process.find((p) => /rijzen/.test(p.name))!;
  assert.equal(wait.kind, 'wacht');
  assert.equal(wait.alarm, false);
  assert.equal(wait.minutes, 60);
  assert.match(wait.check ?? '', /Geen tijd/);
  assert.ok(r.warnings.some((w) => /geen tijd/.test(w) && /1 uur/.test(w)));
  const hand = r.process.find((p) => /Vorm/.test(p.name))!;
  assert.equal(hand.kind, 'hand');
  // Een handeling zonder tijd krijgt 5 minuten werk, zonder markering: de duur van een handeling is de werktijd. Een
  // markering per handeling gaf bij een echte bladzijde uit een bakboek 16 stappen om na te kijken.
  assert.equal(hand.check, undefined);
  assert.ok(r.warnings.some((w) => /handeling(en)? noem/.test(w) && /5 minuten/.test(w)));
});

test('onzekere stappen worden gemarkeerd: bereik en een nacht', () => {
  const r = parseRecipeText(`${BASIS}Laat 4 tot 5 uur rijzen. Laat het een hele nacht in de koelkast staan.`);
  assert.match(r.process[0].check ?? '', /bereik/);
  assert.match(r.process[1].check ?? '', /12 uur/);
  assert.equal(parseRecipeText(`${BASIS}Laat 3 uur rijzen.`).process[0].check, undefined, 'een duidelijke tijd heeft geen markering');
});

test('herhaling: "4 keer, elk half uur" wordt vier vouwstappen, geen onzin', () => {
  const r = parseRecipeText(`${BASIS}Vouw het deeg 4 keer, elk half uur. Laat daarna 2 uur rijzen.`);
  assert.deepEqual(r.process.map((p) => [p.kind, p.minutes]), [['hand', 30], ['hand', 30], ['hand', 30], ['hand', 30], ['wacht', 120]]);
  assert.match(r.process[0].name, /\(1 van 4\)/);
  assert.match(r.process[0].check ?? '', /Herhaling/);
  assert.ok(r.warnings.some((w) => /herhaling/i.test(w)));
});

test('eenheden die we niet kennen (kopjes) worden niet stil overgeslagen', () => {
  const r = parseRecipeText(`Brood\n3 kopjes bloem\n1 kopje water\n100 g starter\n10 g zout\nBereiding\nLaat 3 uur rijzen.`);
  assert.ok(r.warnings.some((w) => /3 kopjes bloem/.test(w) && /niet in gram/.test(w)));
  assert.ok(r.ignored.includes('3 kopjes bloem'));
  // een stap met een tijd is geen ingrediënt, ook al staat er 'water' in
  const ok = parseRecipeText(`${BASIS}2 uur wachten. Giet 1 kop water erbij en laat 10 minuten rusten.`);
  assert.equal(ok.warnings.some((w) => /niet in gram/.test(w)), false);
});

test('"Laat daarna 2 uur rijzen" is één stap', () => {
  const r = parseRecipeText(`${BASIS}Meng alles. Laat daarna 2 uur rijzen.`);
  assert.deepEqual(r.process.map((p) => [p.kind, p.minutes]), [['hand', 5], ['wacht', 120]]);
});

test('bestaande werkende voorbeelden blijven hetzelfde', () => {
  const r = parseRecipeText(SAMPLE1);
  // Bewust veranderd: "Voeg de starter en het zout toe en kneed 5 minuten" is één handstap (één wekker, niet twee), en
  // voorverwarmen krijgt 45 minuten in plaats van 5.
  assert.deepEqual(r.process.map((p) => [p.kind, p.minutes]), [['hand', 5], ['wacht', 30], ['hand', 5], ['wacht', 270], ['hand', 5], ['wacht', 720], ['hand', 45], ['hand', 20], ['hand', 25]]);
  assert.ok(r.process.some((p) => p.name === 'Voeg de starter en het zout toe en kneed 5 minuten'));
});

// Een echte bladzijde uit een Nederlandstalig bakboek (classic bâtard, eigen samenvatting van de opbouw): genummerde
// stappen zonder punt ("1 Maak"), tussenkopjes met een tijd ("Kneden (ca. 4 uur)"), water als "500 + 60", zeezout,
// "herhaal deze handeling nog twee keer", "tot het 'aan' is", "tot de volgende ochtend in de koelkast" en voorverwarmen.
const BOEK = `Classic bâtard

Ingrediënten
voor de meelmix
tarwebloem 680 g
roggemeel 90 g
water 500 + 60 g
actieve zuurdesem 150 g
grof zeezout 15 g

Kneden (ca. 4 uur)
1 Maak de meelmix. Meng in een ruime kom de meelmix met 500 gram water en mix met de hand tot een homogene bol. Dek de kom af met een schone theedoek en laat het deeg 15 minuten rusten op kamertemperatuur.
2 Voeg 60 gram water, de actieve zuurdesem en het zout toe en mix opnieuw tot een homogene bol. Stort het deeg op een vochtig werkblad en vorm er met vochtige handen een bol van. Zet de kom eroverheen en laat 30 minuten rusten.
3 Doe een stretch & fold, van 3 tot 6 folds, totdat het deeg op spanning staat (zie handtechniek 'stretch & folds' op blz. 71). Zet de kom eroverheen en laat 45 minuten rusten op kamertemperatuur. Herhaal deze handeling nog twee keer. Na de derde rustperiode heeft het deeg een zachte, droge buitenkant.
4 Verdeel het deeg in twee gelijke stukken. Bol beide stukken deeg op (zie handtechniek 'opbollen' op blz. 71) en laat afgedekt met een theedoek 30 minuten rusten.
5 Vorm het deeg op een met bloem bestoven werkblad en met droge handen tot twee bâtards (zie handtechniek 'deeg vormen' op blz. 72). Leg het deeg met de naad naar boven in met bloem bestoven rijsmanden en dek af met de theedoeken.

Rijzen (overnacht)
6 Laat het deeg rusten op een warme en tochtvrije plek totdat het 'aan' is; het deeg is dan zo'n 1 centimeter omhoog gekomen. Dek, zodra dat het geval is, de rijsmanden af met de theedoeken en laat het deeg tot de volgende ochtend in de koelkast rijzen.

Bakken (volgende dag)
7 Verwarm de volgende dag de oven voor op 230 °C. Zet een gietijzeren pan met deksel tijdens het voorverwarmen in de oven en laat door en door heet worden.
8 Stort het deeg uit één van de rijsmanden midden op een stuk bakpapier. Score met een scherp mesje het deeg (zie hiernaast). Haal de gietijzeren pan (voorzichtig!) uit de oven en leg het deeg met bakpapier en al in de hete pan. Spuit om waterdamp te creëren het deeg goed vochtig met de plantenspuit. Doe snel de deksel weer op de pan om de stoom te behouden.
9 Zet de pan in de oven en bak het brood 15 minuten. Bak daarna zonder deksel nog 15 à 20 minuten, tot er een mooie korst is ontstaan. Het brood is gaar als de kerntemperatuur net boven de 98 °C uitkomt. Laat het brood op een rooster minimaal 15 minuten afkoelen voordat je het aansnijdt. Bak zo ook het andere brood.`;

test('bakboek: ingrediënten met "500 + 60", zeezout en een tussenkop', () => {
  const r = parseRecipeText(BOEK);
  assert.equal(r.name, 'Classic bâtard');
  assert.deepEqual(r.flours.map((f) => [f.name, f.grams]), [['Tarwebloem', 680], ['Roggemeel', 90]]);
  assert.equal(r.waterG, 560, '500 + 60 telt op');
  assert.equal(r.starterG, 150);
  assert.equal(r.saltG, 15, 'grof zeezout is zout');
  assert.equal(r.warnings.some((w) => /Ik vond geen/.test(w)), false);
});

test('bakboek: een schema dat klopt met het boek', () => {
  const r = parseRecipeText(BOEK);
  const steps = r.process;
  // geen tussenkop als stap ("Kneden (ca. 4 uur)" is geen handstap van 4 uur)
  assert.equal(steps.some((s) => /Kneden|Rijzen \(overnacht\)|Bakken \(volgende dag\)/.test(s.name)), false);
  // drie keer stretch & fold met 45 minuten rust, temperatuurgevoelig
  const folds = steps.filter((s) => /stretch & fold/i.test(s.name));
  assert.equal(folds.length, 3, 'herhaal nog twee keer = drie keer');
  assert.match(folds[2].name, /3 van 3/);
  const foldRests = steps.filter((s) => s.kind === 'wacht' && s.minutes === 45);
  assert.equal(foldRests.length, 3);
  assert.ok(foldRests.every((s) => s.tempSensitive), 'rust op kamertemperatuur tijdens de bulk');
  // de autolyse van 15 minuten is geen fermentatie
  assert.equal(steps.find((s) => s.kind === 'wacht' && s.minutes === 15 && /rusten/.test(s.name))?.tempSensitive, undefined);
  // vormen is een handstap met een wekker; "tot het aan is" is een wachtstap zonder tijd die nagekeken moet worden
  assert.ok(steps.some((s) => /^Vorm/.test(s.name) && s.kind === 'hand' && s.alarm));
  const aan = steps.find((s) => /aan' is/.test(s.name))!;
  assert.equal(aan.kind, 'wacht');
  assert.ok(aan.check);
  // in de koelkast tot de volgende ochtend: een geschatte nacht, met een handstap (en wekker) ervoor
  const night = steps.find((s) => /volgende ochtend/.test(s.name))!;
  assert.equal(night.minutes, 720);
  assert.ok(night.check);
  assert.equal(night.tempSensitive, undefined);
  // voorverwarmen heeft een eigen geschatte tijd, en "laat door en door heet worden" is geen wachtstap van 1 uur
  const oven = steps.find((s) => /Verwarm/.test(s.name))!;
  assert.equal(oven.minutes, 45);
  assert.match(oven.check ?? '', /voorverwarm/i);
  assert.equal(steps.some((s) => /heet worden/.test(s.name) && s.kind === 'wacht'), false);
  // bakken: 15 met deksel, 15 à 20 zonder, 15 afkoelen
  assert.ok(steps.some((s) => /bak het brood 15 minuten/i.test(s.name) && s.minutes === 15));
  assert.ok(steps.some((s) => /zonder deksel/.test(s.name) && s.minutes === 18));
  assert.ok(steps.some((s) => /afkoelen/.test(s.name) && s.kind === 'wacht' && s.minutes === 15));
  // uitleg is geen stap, maar komt in de notities
  assert.equal(steps.some((s) => /kerntemperatuur|zachte, droge buitenkant|andere brood/.test(s.name)), false);
  assert.ok(r.notes.some((n) => /kerntemperatuur/.test(n)));
  assert.ok(r.warnings.some((w) => /twee broden/.test(w)));
  // geen verwijzingen naar bladzijden in de namen, en niet tientallen wekkers
  assert.equal(steps.some((s) => /blz\./.test(s.name)), false);
  assert.ok(steps.filter((s) => s.alarm).length <= 12, `te veel wekkers: ${steps.filter((s) => s.alarm).length}`);
  // totale duur: ongeveer 4 uur kneden + rijzen + nacht + bakken (geen 22 uur door geraden stappen)
  const total = steps.reduce((a, s) => a + s.minutes, 0);
  assert.ok(total > 17 * 60 && total < 21 * 60, `totaal ${total} min`);
});

test('bakboek als tabel: kolom "gram" zonder eenheid per regel, met percentages en een subtotaal', () => {
  const r = parseRecipeText(`Classic bâtard\nIngrediënten gram %\nvoor de meelmix\ntarwebloem 680 88\nroggemeel 90 12\nmeelmix 770 100\nwater 500 + 60 73\nactieve zuurdesem 150 20\ngrof zeezout 15 2\nKneden (ca. 4 uur)\n1 Maak de meelmix en laat 15 minuten rusten.`);
  assert.deepEqual(r.flours.map((f) => f.grams), [680, 90], 'het subtotaal "meelmix" telt niet mee');
  assert.equal(r.waterG, 560);
  assert.equal(r.starterG, 150);
  assert.equal(r.saltG, 15);
});

test('bulk met vouwen erin: vouwen tijdens de bulk, niet erna', () => {
  const r = parseRecipeText(`${BASIS}1. Bulk 4 à 5 uur bij 24°C, met 4 keer stretch and fold om het halfuur.\n2. Vorm en laat een nacht rijzen in de koelkast.`);
  assert.deepEqual(r.process.slice(0, 5).map((p) => [p.kind, p.minutes]), [['hand', 30], ['hand', 30], ['hand', 30], ['hand', 30], ['wacht', 150]]);
  assert.match(r.process[0].name, /stretch and fold \(1 van 4\)/i);
  assert.equal(r.process[4].tempSensitive, true);
  assert.equal(r.refTempC, 24, '"bij 24°C" is de temperatuur van het recept');
  const vorm = r.process.find((p) => /^Vorm/.test(p.name))!;
  assert.equal(vorm.kind, 'hand', 'vormen is handwerk met een wekker, geen wachtstap');
  assert.ok(vorm.alarm);
  assert.ok(r.process.some((p) => p.kind === 'wacht' && p.minutes === 720));
});

test('gescande bladzijde: regels breken midden in een zin en woorden zijn afgebroken', () => {
  const scan = `Classic bâtard\nIngrediënten\ntarwebloem 680 g\nwater 500 + 60 g\nactieve zuurdesem 150 g\ngrof zeezout 15 g\nKneden (ca. 4 uur)\n1 Maak de meelmix. Dek de kom af en laat het deeg\n15 minuten rusten op kamer-\ntemperatuur.\n2 Doe een stretch & fold. Zet de kom eroverheen en laat 45\nminuten rusten op kamertemperatuur. Herhaal deze handeling nog\ntwee keer.`;
  const r = parseRecipeText(scan);
  assert.ok(r.process.some((s) => /kamertemperatuur/.test(s.name) && s.minutes === 15), 'afgebroken woord weer heel');
  assert.equal(r.process.filter((s) => /stretch & fold/.test(s.name)).length, 3, 'herhaling over een regelbreuk');
  assert.equal(r.process.filter((s) => s.kind === 'wacht' && s.minutes === 45).length, 3);
});
