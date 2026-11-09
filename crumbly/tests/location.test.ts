import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awayFridgeMove, backFromAwayWithFridge, countsForReadiness, feedIntervalHours, locationAt, locationSince, moveStarter, starterLog } from '../src/domain/location.ts';
import { dueAutoFeeds, feedToAsk, nextFeedDue, readiness } from '../src/domain/starter.ts';
import type { AwayPeriod, Feed, Starter } from '../src/domain/types.ts';

const base: Starter = { id: 's', name: 'Jean', startedOn: '2026-10-01', defaultRatio: '1:5:5', feedIntervalHours: 24, thresholdHours: 6, streakNeeded: 3, location: 'kamer', updatedAt: '' };
const iso = (d: string, h = 8) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).toISOString();
const feed = (d: string, peakAfter?: number, h = 8): Feed => ({ id: `${d}-${h}`, fedAt: iso(d, h), peakAt: peakAfter ? new Date(new Date(iso(d, h)).getTime() + peakAfter * 3600000).toISOString() : undefined, ratio: '1:5:5', updatedAt: '' });
const moved = (s: Starter, to: 'kamer' | 'koelkast', at: string): Starter => ({ ...s, ...moveStarter(s, to, new Date(at)) });

test('verplaatsen noteert het moment; hetzelfde opnieuw kiezen doet niets', () => {
  const s = moved(base, 'koelkast', iso('2026-11-01', 18));
  assert.equal(s.location, 'koelkast');
  assert.deepEqual(s.locationLog, [{ at: iso('2026-11-01', 18), location: 'koelkast' }]);
  assert.equal(moveStarter(s, 'koelkast', new Date()), null);
  assert.equal(locationSince(s), iso('2026-11-01', 18));
});

test('waar stond hij op een moment', () => {
  let s = moved(base, 'koelkast', iso('2026-11-01', 18));
  s = moved(s, 'kamer', iso('2026-11-05', 9));
  assert.equal(locationAt(s, iso('2026-11-01', 8)), 'kamer', 'voor de eerste verplaatsing');
  assert.equal(locationAt(s, iso('2026-11-03', 8)), 'koelkast');
  assert.equal(locationAt(s, iso('2026-11-06', 8)), 'kamer');
  assert.equal(locationAt(base, iso('2026-11-03')), 'kamer', 'nooit verplaatst: de huidige plek');
});

test('voedingsritme volgt de plek: in de koelkast om de 7 dagen, instelbaar', () => {
  assert.equal(feedIntervalHours(base), 24);
  const fridge = moved(base, 'koelkast', iso('2026-11-01', 18));
  assert.equal(feedIntervalHours(fridge), 168);
  assert.equal(feedIntervalHours({ ...fridge, fridgeFeedDays: 5 }), 120);
  const next = nextFeedDue(fridge, [feed('2026-11-01', undefined, 17)]);
  assert.equal(next?.toISOString(), new Date(new Date(iso('2026-11-01', 17)).getTime() + 168 * 3600000).toISOString());
});

test('klaar om te bakken: koelkastvoedingen en de eerste voeding na het uithalen tellen niet mee', () => {
  // Drie goede voedingen, dan koelkast (trage voeding), eruit, eerste voeding traag, dan weer goed.
  let s = moved(base, 'koelkast', iso('2026-11-03', 18));
  s = moved(s, 'kamer', iso('2026-11-06', 7));
  const feeds = [feed('2026-10-31', 5), feed('2026-11-01', 5), feed('2026-11-02', 5), feed('2026-11-04', 20), feed('2026-11-06', 10), feed('2026-11-07', 5)];
  const r = readiness(s, feeds, new Date(iso('2026-11-08', 10)));
  assert.equal(r.streak, 4, 'de trage koelkast- en opwarmvoeding breken de reeks niet');
  assert.equal(countsForReadiness(s, feeds[3], feeds), false, 'in de koelkast');
  assert.equal(countsForReadiness(s, feeds[4], feeds), false, 'eerste na het uithalen');
  assert.equal(countsForReadiness(s, feeds[5], feeds), true);
  // Zonder logboek telt alles zoals vroeger: de trage voeding breekt de reeks.
  assert.equal(readiness(base, feeds, new Date(iso('2026-11-08', 10))).streak, 1);
});

test('in de koelkast wacht Crumbly niet op een verdubbeling en stelt het er geen vraag over', () => {
  const s = moved(base, 'koelkast', iso('2026-11-01', 18));
  const f = feed('2026-11-02', undefined, 8);
  assert.equal(readiness(s, [f], new Date(iso('2026-11-02', 14))).waitingForPeak, false);
  assert.equal(feedToAsk([f], new Date(iso('2026-11-02', 14)), s), null);
  assert.equal(feedToAsk([f], new Date(iso('2026-11-02', 14)), base)?.id, f.id, 'op kamertemperatuur wel');
});

test('automatisch voeden slaat de dagen in de koelkast over, ook achteraf', () => {
  let s: Starter = { ...base, autoFeedAt: '08:00', autoFeedSince: '2026-11-01' };
  s = moved(s, 'koelkast', iso('2026-11-02', 20));
  s = moved(s, 'kamer', iso('2026-11-05', 6));
  const due = dueAutoFeeds(s, [], [], new Date(iso('2026-11-06', 9)));
  const days = due.map((d) => new Date(d).getDate());
  assert.deepEqual(days, [1, 2, 5, 6], '3 en 4 november stond hij in de koelkast');
});

test('ik ben weg met de starter in de koelkast: bij vertrek genoteerd, wat je zelf deed wint', () => {
  const away: AwayPeriod[] = [{ id: 'a', from: iso('2026-11-10', 9), to: iso('2026-11-14', 18), starterInFridge: true, muteFeedReminders: true, updatedAt: '' }];
  assert.equal(awayFridgeMove(base, away, new Date(iso('2026-11-09', 9))), null, 'nog niet vertrokken');
  const patch = awayFridgeMove(base, away, new Date(iso('2026-11-11', 9)));
  assert.equal(patch?.location, 'koelkast');
  assert.equal(patch?.locationLog?.[0].at, iso('2026-11-10', 9));
  const already = { ...base, ...patch };
  assert.equal(awayFridgeMove(already, away, new Date(iso('2026-11-12', 9))), null, 'al genoteerd');
  // Zelf eruit gehaald tijdens de reis (bv. vroeger terug): niet opnieuw in de koelkast zetten.
  const out = moved(already as Starter, 'kamer', iso('2026-11-12', 9));
  assert.equal(awayFridgeMove(out, away, new Date(iso('2026-11-13', 9))), null);
  // Terug en hij staat er nog: herinnering, maar niet meer na 2 dagen.
  assert.equal(backFromAwayWithFridge(already as Starter, away, new Date(iso('2026-11-15', 9)))?.id, 'a');
  assert.equal(backFromAwayWithFridge(already as Starter, away, new Date(iso('2026-11-17', 9))), null);
  assert.equal(backFromAwayWithFridge(out, away, new Date(iso('2026-11-15', 9))), null, 'al uitgehaald');
});

test('logboek: voedingen en verplaatsingen samen, nieuwste eerst, zonder verwijderde', () => {
  const s = moved(base, 'koelkast', iso('2026-11-02', 20));
  const log = starterLog(s, [feed('2026-11-01'), feed('2026-11-03'), { ...feed('2026-11-04'), deletedAt: 'x' }]);
  assert.deepEqual(log.map((e) => e.kind), ['voeding', 'plek', 'voeding']);
});

test('opfrissen: een voeding na minstens anderhalf uur opwarmen telt wel mee, ook als het de eerste is', () => {
  // Woensdag tot vrijdag: 7 uur uit de koelkast, 9 uur voeden (verdubbeld na 2 uur), 11 uur terug in de koelkast.
  let s = moved(base, 'koelkast', iso('2026-11-08', 18));
  const feeds: Feed[] = [];
  for (const d of ['2026-11-11', '2026-11-12', '2026-11-13']) {
    s = moved(s, 'kamer', iso(d, 7));
    feeds.push(feed(d, 2, 9));
    s = moved(s, 'koelkast', iso(d, 11));
  }
  for (const f of feeds) assert.equal(countsForReadiness(s, f, feeds), true);
  const r = readiness(s, feeds, new Date(iso('2026-11-14', 7)));
  assert.equal(r.streak, 3);
  assert.equal(r.ready, true, 'drie keer verdubbeld binnen 6 uur na het opfrissen: klaar voor zaterdag');
});

test('opfrissen in het bakschema: per dag uit de koelkast, voeden 1:2:2, terug in de koelkast; daarna de knedag', async () => {
  const { bakeProcess, refreshSteps } = await import('../src/domain/location.ts');
  const { planBackward } = await import('../src/domain/schedule.ts');
  const steps = refreshSteps('Jean', 3);
  assert.equal(steps.length, 9);
  assert.deepEqual(steps.slice(0, 3).map((x) => x.starterAction), ['uit-koelkast', 'voeden', 'in-koelkast']);
  assert.equal(steps[1].feedRatio, '1:2:2');
  assert.ok(steps.every((x) => x.alarm));
  const dough = [{ id: 'd1', name: 'Mengen', minutes: 60, kind: 'hand' as const, alarm: true }];
  const fridge = moved(base, 'koelkast', iso('2026-11-08', 18));
  assert.equal(bakeProcess(dough, base, 3).length, 1, 'starter op kamertemperatuur: niets ervoor');
  assert.equal(bakeProcess(dough, fridge, 0).length, 2, 'zonder opfrissen: enkel uithalen');
  const p = bakeProcess(dough, fridge, 3);
  assert.deepEqual(p.slice(9, 11).map((x) => x.starterAction), ['uit-koelkast', 'voeden'], 'knedag: uithalen, een theelepel bewaren voor volgende week');
  // Kneden zaterdag 9:00 -> de opfrisdagen beginnen woensdag, donderdag en vrijdag om 7:00 (2 uur voor het kneden, min het bewaren).
  const plan = planBackward(p, new Date('2026-11-14T10:00:00'));
  const outs = plan.filter((x) => x.starterAction === 'uit-koelkast').map((x) => new Date(x.startAt));
  assert.deepEqual(outs.map((d) => [d.getDate(), d.getHours(), d.getMinutes()]), [[11, 6, 55], [12, 6, 55], [13, 6, 55], [14, 6, 55]]);
  assert.equal(plan[1].starterAction, 'voeden', 'de actie blijft bij het plannen behouden');
});
