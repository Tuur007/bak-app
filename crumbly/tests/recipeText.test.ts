import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { durationMinutes, parseRecipeText } from '../src/domain/recipeText.ts';
import { recipeRatios } from '../src/domain/ratios.ts';

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
  assert.equal(by(/Verwarm/).minutes, 5, 'zonder tijd: 5 minuten geschat');
  assert.ok(r.warnings.some((w) => /zonder tijd/.test(w)));
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

// Een recept zoals in Kometen Brood: ingrediënten als tabel (gram en %), genummerde stappen met kopjes
// en "herhaal ... twee keer". De tekst in de fixture is zelf geschreven met dezelfde opbouw.
const TABEL = readFileSync(join(process.cwd(), 'tests/fixtures/tabelrecept.txt'), 'utf8');

test('tabel met ingrediënten: gram, "500 + 60", en de somrij telt niet dubbel', () => {
  const r = parseRecipeText(TABEL);
  assert.equal(r.name, 'Basisbrood');
  assert.deepEqual(r.flours.map((f) => [f.name, f.grams]), [['Tarwebloem', 680], ['Roggemeel', 90]]);
  assert.equal(r.waterG, 560);
  assert.equal(r.starterG, 150);
  assert.equal(r.saltG, 15);
  const q = recipeRatios(r);
  assert.deepEqual([Math.round(q.hydration), Math.round(q.saltPct)], [73, 2], 'zoals de percentages in het boek');
  assert.equal(r.ignored.length, 0);
  assert.ok(r.warnings.some((w) => /voor 2 broden/.test(w)));
});

test('genummerde stappen: kopjes en uitleg worden geen stap, "herhaal twee keer" geeft drie vouwrondes', () => {
  const r = parseRecipeText(TABEL);
  const names = r.process.map((s) => s.name);
  assert.ok(!names.some((n) => /^Kneden|^Rijzen|^Bakken/.test(n)), 'kopjes zijn geen stap');
  assert.ok(!names.some((n) => /^Na de derde|^Bak zo ook|gaar is/.test(n)), 'uitleg is geen stap');
  const rests = r.process.filter((s) => s.kind === 'wacht' && s.minutes === 45 && /rusten/i.test(s.name));
  assert.equal(rests.length, 3, 'drie keer 45 minuten rusten');
  assert.equal(r.process.filter((s) => /stretch/i.test(s.name)).length, 3);
  assert.ok(r.process.length >= 18 && r.process.length <= 26, `een leesbaar aantal stappen, kreeg ${r.process.length}`);
});

test('tabelrecept: tijden en de nacht kloppen', () => {
  const r = parseRecipeText(TABEL);
  const wait = (m: number) => r.process.filter((s) => s.kind === 'wacht' && s.minutes === m).length;
  assert.equal(wait(15), 2, 'eerste rust en afkoelen');
  assert.equal(wait(30), 2);
  assert.equal(wait(720), 1, 'tot de volgende ochtend in de koelkast');
  assert.ok(r.process.some((s) => s.kind === 'hand' && s.minutes === 15 && /^Bak/.test(s.name)), '15 minuten bakken met deksel');
  assert.ok(r.process.some((s) => s.kind === 'hand' && s.minutes === 18), '15 à 20 minuten zonder deksel: het midden');
  assert.ok(r.process.every((s) => s.detail && s.detail.length > 0), 'elke stap bewaart de uitleg uit het recept');
  const night = r.process.find((s) => s.minutes === 720)!;
  assert.equal(night.tempSensitive, undefined, 'koelkast is niet temperatuurgevoelig');
  assert.ok(r.warnings.some((w) => /totdat het deeg klaar is/.test(w)), 'geen tijd bij "totdat het aan is": geschat en gemeld');
  assert.ok(r.warnings.some((w) => /voorverwarmen/.test(w)));
});
