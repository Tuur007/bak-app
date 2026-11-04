import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRatios, factorForDoughWeight, feedAmounts, formatPct, parseFeedRatio, roundGrams, scaleFormula } from '../src/domain/ratios.ts';

const close = (a: number, b: number, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);

test('zoals in het boek: percentages op het meel in het recept (Kometen Brood: 73 / 20 / 2)', () => {
  const r = computeRatios({ flourG: 770, waterG: 560, starterG: 150, starterHydration: 100, saltG: 15 });
  close(r.hydration, 72.73);
  close(r.starterPct, 19.48);
  close(r.saltPct, 1.95);
  assert.equal(Math.round(r.hydration), 73);
  assert.equal(Math.round(r.starterPct), 19); // het boek rondt 19,5 op naar 20
});

test('met de starter meegerekend (de echte hydratatie)', () => {
  const r = computeRatios({ flourG: 500, waterG: 350, starterG: 100, starterHydration: 100, saltG: 10 });
  close(r.totalFlour, 550);
  close(r.totalWater, 400);
  close(r.hydrationTotal, 72.73);
  close(r.starterPctTotal, 18.18);
  close(r.saltPctTotal, 1.82);
  close(r.hydration, 70);
  close(r.starterPct, 20);
  close(r.saltPct, 2);
  assert.equal(r.doughWeight, 960);
});

test('starter met 50% hydratatie', () => {
  const r = computeRatios({ flourG: 400, waterG: 300, starterG: 90, starterHydration: 50, saltG: 9 });
  close(r.totalFlour, 460);
  close(r.totalWater, 330);
});

test('lege of foute invoer geeft nullen, geen NaN', () => {
  const r = computeRatios({ flourG: 0, waterG: NaN, starterG: -5, starterHydration: 100, saltG: 0 });
  assert.equal(r.hydration, 0);
  assert.equal(r.doughWeight, 0);
});

test('schalen en afronden', () => {
  assert.equal(roundGrams(10.3), 10.5);
  assert.equal(roundGrams(123.4), 123);
  const f = scaleFormula({ flourG: 500, waterG: 350, starterG: 100, starterHydration: 100, saltG: 10 }, 2);
  assert.deepEqual([f.flourG, f.waterG, f.starterG, f.saltG], [1000, 700, 200, 20]);
  close(factorForDoughWeight({ flourG: 500, waterG: 350, starterG: 100, starterHydration: 100, saltG: 10 }, 1920), 2);
});

test('procent tonen met komma', () => {
  assert.equal(formatPct(72.727), '72,7%');
  assert.equal(formatPct(NaN), '-');
});

test('voedingsverhouding', () => {
  assert.deepEqual(parseFeedRatio('1:5:5'), [1, 5, 5]);
  assert.equal(parseFeedRatio('1:5'), null);
  assert.deepEqual(feedAmounts('1:5:5', 20), { flour: 100, water: 100 });
});
