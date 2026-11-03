import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustForTemperature, timeFactor } from '../src/domain/temperature.ts';
import { finishWaitNow, markDone, planBackward, stepHeadline, endOf } from '../src/domain/schedule.ts';
import type { ProcessStep } from '../src/domain/types.ts';

const P = (id: string, minutes: number, kind: 'hand' | 'wacht', tempSensitive = false): ProcessStep => ({ id, name: id, minutes, kind, workMinutes: kind === 'hand' ? 5 : undefined, tempSensitive: tempSensitive || undefined, alarm: kind === 'hand' });
const proc = [P('Mengen', 30, 'hand'), P('Bulk', 240, 'wacht', true), P('Vormen', 30, 'hand'), P('Koelkast', 600, 'wacht')];

test('10 graden koeler = dubbel zo lang, warmer = korter, begrensd', () => {
  assert.equal(timeFactor(24, 14), 2);
  assert.equal(timeFactor(24, 24), 1);
  assert.ok(Math.abs(timeFactor(24, 34) - 0.5) < 1e-9);
  assert.equal(timeFactor(24, -20), 2.5, 'nooit meer dan 2,5 keer langer');
  assert.equal(timeFactor(24, 80), 0.5, 'nooit minder dan de helft');
  assert.equal(timeFactor(NaN, 20), 1);
  assert.equal(timeFactor(24, 20, 3), Math.pow(3, 0.4));
});

test('enkel temperatuurgevoelige stappen veranderen, op 5 minuten afgerond', () => {
  const r = adjustForTemperature(proc, 24, 21);
  assert.equal(r.process.find((s) => s.id === 'Bulk')!.minutes, 295); // 240 x 1,23 = 295,6 -> 295
  assert.equal(r.process.find((s) => s.id === 'Koelkast')!.minutes, 600);
  assert.deepEqual(r.changes.map((c) => [c.id, c.from, c.to]), [['Bulk', 240, 295]]);
});

test('zonder referentietemperatuur of keukentemperatuur verandert er niets', () => {
  assert.equal(adjustForTemperature(proc, undefined, 21).process, proc);
  assert.equal(adjustForTemperature(proc, 24, undefined).changes.length, 0);
});

test('"deeg is klaar": de volgende stap begint nu en de rest schuift mee', () => {
  const steps = planBackward(proc, new Date('2026-11-07T13:00:00'));
  const bulk = steps[1];
  const early = new Date(new Date(steps[2].startAt).getTime() - 40 * 60000); // 40 min te vroeg klaar
  const out = finishWaitNow(steps, bulk.id, early);
  assert.equal(out[1].doneAt, early.toISOString());
  assert.equal(out[2].startAt, early.toISOString());
  assert.equal(endOf(out).getTime(), endOf(steps).getTime() - 40 * 60000);
  const late = new Date(new Date(steps[2].startAt).getTime() + 25 * 60000);
  assert.equal(endOf(finishWaitNow(steps, bulk.id, late)).getTime(), endOf(steps).getTime() + 25 * 60000);
});

test('kop: wachtstap bezig telt af tot het einde van het wachten', () => {
  const fresh = planBackward(proc, new Date('2026-11-07T13:00:00'));
  const steps = markDone(fresh, 'Mengen', new Date(fresh[0].startAt));
  const during = new Date(new Date(steps[1].startAt).getTime() + 60 * 60000);
  const h = stepHeadline(steps, during)!;
  assert.equal(h.label, 'Wachten');
  assert.equal(h.waiting, true);
  assert.equal(h.nextName, 'Vormen');
  assert.equal(h.msUntil, new Date(steps[2].startAt).getTime() - during.getTime());
  const before = stepHeadline(fresh, new Date(new Date(fresh[0].startAt).getTime() - 3600000))!;
  assert.equal(before.label, 'Volgende stap');
  const handDue = stepHeadline(fresh, new Date(new Date(fresh[0].startAt).getTime() + 60000))!;
  assert.equal(handDue.label, 'Nu');
});

test('rijzen herkennen, afkoelen niet', async () => {
  const { isDoughRise } = await import('../src/domain/schedule.ts');
  assert.equal(isDoughRise({ name: 'Bulk laten rijzen' }), true);
  assert.equal(isDoughRise({ name: 'Laatste rijs' }), true);
  assert.equal(isDoughRise({ name: 'Wat dan ook', tempSensitive: true }), true);
  assert.equal(isDoughRise({ name: 'Afkoelen' }), false);
  assert.equal(isDoughRise({ name: 'Oven voorverwarmen' }), false);
});
