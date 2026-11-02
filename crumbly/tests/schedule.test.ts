import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bakesHitByAway, delayOpen, endOf, findFittingEnd, fitsHome, homeConflicts, markDone, planBackward, shiftForReturn, stepState, totalMinutes } from '../src/domain/schedule.ts';
import { buildReminders } from '../src/domain/reminders.ts';
import type { AwayPeriod, Bake, HomeWindow, ProcessStep, Settings, Starter } from '../src/domain/types.ts';

const P = (name: string, minutes: number, kind: 'hand' | 'wacht', work = 5): ProcessStep => ({ id: name, name, minutes, kind, workMinutes: kind === 'hand' ? work : undefined, alarm: kind === 'hand' });
const process = [P('Mengen', 60, 'hand', 15), P('Bulk', 240, 'wacht'), P('Vormen', 30, 'hand', 10), P('Koelkast', 720, 'hand', 2), P('Bakken', 45, 'hand', 5)];
const t = (s: string) => new Date(s);

test('terugrekenen: de laatste stap eindigt op het gekozen uur', () => {
  const end = t('2026-11-07T13:00:00');
  const steps = planBackward(process, end);
  assert.equal(endOf(steps).getTime(), end.getTime());
  assert.equal(new Date(steps[0].startAt).getTime(), end.getTime() - totalMinutes(process) * 60000);
});

test('stap aan de beurt, afvinken en uitstellen', () => {
  const steps = planBackward(process, t('2026-11-07T13:00:00'));
  const now = new Date(new Date(steps[0].startAt).getTime() + 5 * 60000);
  let st = stepState(steps, now);
  assert.equal(st.index, 0);
  assert.equal(st.due, true);
  const done = markDone(steps, 'Mengen', now);
  st = stepState(done, now);
  assert.equal(st.step?.name, 'Bulk');
  const later = delayOpen(done, 30);
  assert.equal(new Date(later[0].startAt).getTime(), new Date(steps[0].startAt).getTime(), 'afgevinkte stap blijft staan');
  assert.equal(endOf(later).getTime(), t('2026-11-07T13:30:00').getTime());
});

test('pas later thuis: eerste handwerk voor thuiskomst schuift, de rest mee', () => {
  const steps = planBackward(process, t('2026-11-07T13:00:00'));
  const vormen = new Date(steps[2].startAt);
  const back = new Date(vormen.getTime() + 60 * 60000);
  const r = shiftForReturn(markDone(steps, 'Mengen', t('2026-11-06T00:00:00')), back);
  assert.ok(r);
  assert.equal(r!.deltaMin, 60);
  assert.equal(new Date(r!.steps[2].startAt).getTime(), back.getTime());
  assert.equal(endOf(r!.steps).getTime(), t('2026-11-07T14:00:00').getTime());
});

test('thuis-momenten: conflicten en passend eindmoment zoeken', () => {
  const windows: HomeWindow[] = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [{ day, from: '06:00', to: '10:00' }, { day, from: '16:00', to: '24:00' }]);
  assert.equal(fitsHome(t('2026-11-06T17:30:00'), 15, windows), true);
  assert.equal(fitsHome(t('2026-11-06T12:00:00'), 15, windows), false);
  const bad = planBackward(process, t('2026-11-07T13:00:00'));
  assert.ok(homeConflicts(bad, windows).length > 0);
  const end = findFittingEnd(process, t('2026-11-07T13:00:00'), windows, t('2026-11-05T00:00:00'));
  assert.ok(end);
  assert.equal(homeConflicts(planBackward(process, end!), windows).length, 0);
});

test('geen thuis-momenten ingesteld = geen conflicten', () => {
  assert.equal(homeConflicts(planBackward(process, t('2026-11-07T13:00:00')), []).length, 0);
});

const bake = (steps = planBackward(process, t('2026-11-07T13:00:00'))): Bake => ({ id: 'b', recipeId: 'r', recipeName: 'Bâtard', hydration: 72, steps, endAt: endOf(steps).toISOString(), status: 'gepland', createdAt: '', updatedAt: '' });

test('weg: welke bakken worden geraakt', () => {
  const away: AwayPeriod = { id: 'a', from: '2026-11-06T00:00:00.000Z', to: '2026-11-09T00:00:00.000Z', starterInFridge: true, muteFeedReminders: true, updatedAt: '' };
  assert.equal(bakesHitByAway([bake()], away).length, 1);
  assert.equal(bakesHitByAway([bake()], { ...away, from: '2026-12-01T00:00:00Z', to: '2026-12-02T00:00:00Z' }).length, 0);
});

test('wekkers: enkel toekomstige stappen met bel, voedingsmelding stil tijdens weg', () => {
  const starter: Starter = { id: 's', name: 'Jean', startedOn: '2026-10-16', defaultRatio: '1:5:5', feedIntervalHours: 24, thresholdHours: 6, streakNeeded: 3, location: 'kamer', updatedAt: '' };
  const settings: Settings = { homeWindows: [], feedReminder: true, updatedAt: '' };
  const feeds = [{ id: 'f', fedAt: '2026-11-05T08:00:00.000Z', ratio: '1:5:5', updatedAt: '' }];
  const now = t('2026-11-05T10:00:00Z');
  const r = buildReminders({ bakes: [bake()], feeds, starter, settings, away: [] }, now);
  assert.equal(r.filter((x) => x.id.startsWith('bak:')).length, 4); // de wachtstap heeft geen bel
  assert.equal(r.filter((x) => x.id.startsWith('voeden:')).length, 1);
  const away: AwayPeriod = { id: 'a', from: '2026-11-06T00:00:00Z', to: '2026-11-08T00:00:00Z', starterInFridge: true, muteFeedReminders: true, updatedAt: '' };
  const r2 = buildReminders({ bakes: [], feeds, starter, settings, away: [away] }, now);
  assert.equal(r2.length, 0);
});

test('passend moment zoeken kijkt tot een week vooruit (weekend)', () => {
  // Enkel 's avonds thuis op weekdagen, het weekend de hele dag: een lang schema past pas in het weekend.
  const windows: HomeWindow[] = [1, 2, 3, 4, 5].map((day) => ({ day, from: '17:30', to: '23:30' })).concat([0, 6].map((day) => ({ day, from: '07:00', to: '23:30' })));
  const long = [P('Starter voeden', 300, 'hand'), P('Mengen', 60, 'hand', 15), P('Bulk', 240, 'wacht'), P('Vormen', 30, 'hand', 10), P('Koelkast', 720, 'hand', 2), P('Bakken', 45, 'hand', 5)];
  const end = findFittingEnd(long, t('2026-11-04T12:00:00'), windows, t('2026-11-02T21:00:00'));
  assert.ok(end, 'vindt een moment');
  assert.equal(homeConflicts(planBackward(long, end!), windows).length, 0);
});

test('wekkers: enkel wat verandert gaat naar de server', async () => {
  const { diffReminders } = await import('../src/domain/reminders.ts');
  const w = [
    { id: 'a', dueAt: '2026-11-05T10:00:00.000Z', title: 'Bâtard', body: 'Nu: vouwen 1', url: '/plan' },
    { id: 'b', dueAt: '2026-11-05T11:00:00.000Z', title: 'Bâtard', body: 'Nu: vouwen 2', url: '/plan' },
  ];
  const existing = [
    { id: 'a', due_at: '2026-11-05T10:00:00+00:00', title: 'Bâtard', body: 'Nu: vouwen 1', url: '/plan' },
    { id: 'b', due_at: '2026-11-05T10:30:00+00:00', title: 'Bâtard', body: 'Nu: vouwen 2', url: '/plan' },
    { id: 'c', due_at: '2026-11-05T12:00:00+00:00', title: 'Bâtard', body: 'oud', url: '/plan' },
  ];
  const d = diffReminders(existing, w);
  assert.deepEqual(d.remove, ['c']);
  assert.deepEqual(d.upsert.map((x) => x.id), ['b']);
});
