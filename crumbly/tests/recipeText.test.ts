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
  assert.equal(by(/Verwarm/).minutes, 5, 'zonder tijd: 5 minuten geschat');
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
  assert.match(hand.check ?? '', /5 minuten/);
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
  assert.deepEqual(r.process.map((p) => [p.kind, p.minutes]), [['hand', 5], ['wacht', 30], ['hand', 5], ['hand', 5], ['wacht', 270], ['hand', 5], ['wacht', 720], ['hand', 5], ['hand', 20], ['hand', 25]]);
});
