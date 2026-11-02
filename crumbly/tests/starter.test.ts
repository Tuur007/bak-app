import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageDays, earliestBakeDay, formatHours, hoursToPeak, nextFeedDue, peakSeries, readiness } from '../src/domain/starter.ts';
import type { Feed, Starter } from '../src/domain/types.ts';

const starter: Starter = { id: 's', name: 'Jean', startedOn: '2026-10-16', defaultRatio: '1:5:5', feedIntervalHours: 24, thresholdHours: 6, streakNeeded: 3, location: 'kamer', updatedAt: '' };
const at = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).toISOString();
const feed = (d: string, peakAfter?: number): Feed => ({ id: d, fedAt: at(d, 8), peakAt: peakAfter ? new Date(new Date(at(d, 8)).getTime() + peakAfter * 3600000).toISOString() : undefined, ratio: '1:5:5', updatedAt: '' });

test('dag 17 op 2 november als je op 16 oktober startte', () => {
  assert.equal(ageDays('2026-10-16', new Date('2026-11-02T10:00:00')), 17);
});

test('uren tot piek', () => {
  assert.equal(hoursToPeak(feed('2026-11-01', 5.5)), 5.5);
  assert.equal(hoursToPeak(feed('2026-11-01')), null);
});

test('klaar na 3 keer op rij binnen 6 uur, niet te jong', () => {
  const feeds = [feed('2026-10-29', 8), feed('2026-10-30', 5.5), feed('2026-10-31', 5), feed('2026-11-01', 4.5)];
  const r = readiness(starter, feeds, new Date('2026-11-02T10:00:00'));
  assert.equal(r.streak, 3);
  assert.equal(r.ready, true);
});

test('een trage meting breekt de reeks; een open voeding telt niet mee', () => {
  const feeds = [feed('2026-10-30', 5), feed('2026-10-31', 7), feed('2026-11-01', 5), feed('2026-11-02')];
  const r = readiness(starter, feeds, new Date('2026-11-02T12:00:00'));
  assert.equal(r.streak, 1);
  assert.equal(r.ready, false);
  assert.equal(r.waitingForPeak, true);
  assert.equal(r.lastHours, 5);
});

test('te jong: nooit klaar voor dag 14, ook met een goede reeks', () => {
  const young = { ...starter, startedOn: '2026-10-25' };
  const feeds = [feed('2026-10-30', 5), feed('2026-10-31', 5), feed('2026-11-01', 5)];
  const r = readiness(young, feeds, new Date('2026-11-02T10:00:00'));
  assert.equal(r.tooYoung, true);
  assert.equal(r.ready, false);
  const e = earliestBakeDay(young, feeds, new Date('2026-11-02T10:00:00'));
  assert.equal(e?.getDate(), 8); // 25 okt + 14 dagen
});

test('vroegste bakdag: ontbrekende voedingen tellen door', () => {
  const feeds = [feed('2026-10-31', 7), feed('2026-11-01', 5)];
  const e = earliestBakeDay(starter, feeds, new Date('2026-11-02T10:00:00'));
  assert.equal(e?.getDate(), 4); // nog 2 keer nodig
});

test('volgende voeding en grafiekpunten', () => {
  const feeds = [feed('2026-11-01', 5), feed('2026-11-02')];
  assert.equal(nextFeedDue(starter, feeds)?.toISOString(), new Date(at('2026-11-03', 8)).toISOString());
  assert.deepEqual(peakSeries(feeds).map((p) => p.hours), [5]);
});

test('uren tonen', () => {
  assert.equal(formatHours(6.5), '6 u 30');
  assert.equal(formatHours(5), '5 u');
  assert.equal(formatHours(0.5), '30 min');
});

test('een verdubbeling binnen een half uur telt niet (vergissing)', () => {
  const f = { id: 'x', fedAt: '2026-11-02T08:00:00.000Z', peakAt: '2026-11-02T08:01:00.000Z', ratio: '1:5:5', updatedAt: '' };
  assert.equal(hoursToPeak(f), null);
  assert.equal(readiness(starter, [f], new Date('2026-11-02T10:00:00')).streak, 0);
});
