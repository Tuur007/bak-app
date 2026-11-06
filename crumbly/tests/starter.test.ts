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

import { dueAutoFeeds, feedToAsk } from '../src/domain/starter.ts';

test('automatisch noteren: elke dag op het vaste uur, vanaf de startdag, nooit daarvoor', () => {
  const auto = { ...starter, autoFeedAt: '18:00', autoFeedSince: '2026-11-01' };
  const now = new Date('2026-11-03T19:00:00');
  const due = dueAutoFeeds(auto, [], [], now);
  assert.deepEqual(due.map((d) => new Date(d).getDate()), [1, 2, 3]);
  assert.equal(new Date(due[0]).getHours(), 18);
  assert.deepEqual(dueAutoFeeds(auto, [], [], new Date('2026-11-03T17:00:00')).map((d) => new Date(d).getDate()), [1, 2], 'vandaag pas na 18:00');
});

test('automatisch noteren: niet dubbel, niet terug na verwijderen, niet tijdens weg, niet in de koelkast', () => {
  const auto = { ...starter, autoFeedAt: '18:00', autoFeedSince: '2026-11-01' };
  const now = new Date('2026-11-03T19:00:00');
  const manual = { id: 'm', fedAt: new Date('2026-11-02T17:30:00').toISOString(), ratio: '1:5:5', updatedAt: '' };
  assert.deepEqual(dueAutoFeeds(auto, [manual], [], now).map((d) => new Date(d).getDate()), [1, 3], 'een eigen voeding op 2 nov telt');
  const removed = { ...manual, deletedAt: new Date().toISOString() };
  assert.deepEqual(dueAutoFeeds(auto, [removed], [], now).map((d) => new Date(d).getDate()), [1, 3], 'verwijderd komt niet terug');
  const away = [{ id: 'a', from: new Date('2026-11-02T00:00:00').toISOString(), to: new Date('2026-11-04T00:00:00').toISOString(), starterInFridge: true, muteFeedReminders: true, updatedAt: '' }];
  assert.deepEqual(dueAutoFeeds(auto, [], away, now).map((d) => new Date(d).getDate()), [1]);
  assert.deepEqual(dueAutoFeeds({ ...auto, location: 'koelkast' }, [], [], now), []);
  assert.deepEqual(dueAutoFeeds(starter, [], [], now), [], 'uit zolang er geen vast uur is');
  assert.deepEqual(dueAutoFeeds({ ...auto, autoFeedSince: '2026-09-01' }, [], [], now).length, 15, 'hoogstens twee weken terug');
});

test('de ene vraag van de dag gaat over de laatste voeding van 3 tot 30 uur geleden zonder antwoord', () => {
  const now = new Date('2026-11-03T10:00:00');
  const f = (id: string, h: number, extra: object = {}) => ({ id, fedAt: new Date(now.getTime() - h * 3600000).toISOString(), ratio: '1:5:5', updatedAt: '', ...extra });
  assert.equal(feedToAsk([f('a', 2)], now), null, 'te vers');
  assert.equal(feedToAsk([f('a', 5)], now)?.id, 'a');
  assert.equal(feedToAsk([f('a', 40)], now), null, 'te oud');
  assert.equal(feedToAsk([f('a', 26), f('b', 2)], now)?.id, 'a', 'de verse is nog te vers, de vorige wacht op antwoord');
  assert.equal(feedToAsk([f('a', 5, { peakAt: now.toISOString() })], now), null, 'al beantwoord');
  assert.equal(feedToAsk([f('a', 5, { peakSkipped: true })], now), null, 'niet bekeken');
  assert.equal(feedToAsk([f('a', 5, { deletedAt: 'x' })], now), null);
});

test('een nieuwe starter begint vandaag, niet op een vaste datum uit het verleden', async () => {
  const { defaultStarter } = await import('../src/domain/defaults');
  const { toDayString } = await import('../src/domain/dates');
  assert.equal(defaultStarter().startedOn, toDayString(new Date()));
  assert.equal(defaultStarter('1970-01-01T00:00:00.000Z', '2026-10-16').startedOn, '2026-10-16');
});
