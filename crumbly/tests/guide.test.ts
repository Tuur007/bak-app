import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panBreadRecipe, panBreadSteps, STARTER_DAYS } from '../src/domain/guide.ts';
import { recipeRatios } from '../src/domain/ratios.ts';
import { planBackward } from '../src/domain/schedule.ts';

test('pannenbrood: hoeveelheden en ratio', () => {
  const r = panBreadRecipe('2026-11-11T10:00:00.000Z');
  assert.equal(r.flours[0].grams, 500);
  assert.equal(r.waterG, 375);
  assert.equal(r.starterG, 60);
  assert.equal(r.saltG, 11);
  const q = recipeRatios(r);
  // water uit de starter telt mee: (375 + 30) / (500 + 30)
  assert.ok(Math.abs(q.hydration - (405 / 530) * 100) < 0.5, String(q.hydration));
});

test('pannenbrood: stappen kloppen en de uitleg gaat mee naar het bakplan', () => {
  const steps = panBreadSteps();
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
  assert.ok(steps.every((s) => s.minutes > 0));
  assert.ok(steps.filter((s) => s.kind === 'wacht').every((s) => !s.alarm), 'geen wekker op een wachtstap');
  const baking = steps.filter((s) => /bakken|afkoelen/i.test(s.name));
  assert.deepEqual(baking.map((s) => s.minutes), [30, 20, 60]);
  const planned = planBackward(steps, new Date('2026-11-14T09:00:00Z'));
  assert.equal(planned.find((s) => s.name === 'Afkoelen')?.tip, steps.find((s) => s.name === 'Afkoelen')?.tip);
  assert.ok(planned.some((s) => s.check), 'de onzekere stap blijft gemarkeerd');
});

test('startschema heeft zes dagen', () => {
  assert.equal(STARTER_DAYS.length, 6);
});
