import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRatios, factorForDoughWeight, feedAmounts, formatPct, parseFeedRatio, roundGrams, scaleFormula } from '../src/domain/ratios.ts';

const close = (a: number, b: number, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);

test('hydratatie telt het water uit de starter mee, alles op totaal meel', () => {
  const r = computeRatios({ flourG: 500, waterG: 350, starterG: 100, starterHydration: 100, saltG: 10 });
  close(r.totalFlour, 550);
  close(r.totalWater, 400);
  close(r.hydration, 72.73);
  close(r.starterPct, 18.18);
  close(r.saltPct, 1.82);
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
