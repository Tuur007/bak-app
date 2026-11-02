// Starter: leeftijd, uren tot verdubbeling en een EERLIJKE schatting of hij klaar is om
// mee te bakken. Regel (uit bakkersbronnen, zie rapport): verdubbelt betrouwbaar binnen
// een paar uur na het voeden, meerdere keren op rij; een jonge starter heeft vaak minstens
// 14 dagen nodig. De drempel en het aantal keer zijn instelbaar. Getest in tests/starter.test.ts.

import type { Feed, Starter } from './types';

const HOUR = 3_600_000;
const DAY = 86_400_000;
export const MIN_AGE_DAYS = 14;

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "2026-10-16" -> lokale middernacht */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Dag 17 als je op 16 oktober startte en het 2 november is. */
export function ageDays(startedOn: string, now: Date): number {
  return Math.max(0, Math.round((dayStart(now) - parseDay(startedOn).getTime()) / DAY));
}

/** Sneller dan dit kan een starter niet verdubbelen: zo'n meting is een vergissing. */
export const MIN_PEAK_HOURS = 0.5;

export function hoursToPeak(feed: Feed): number | null {
  if (!feed.peakAt) return null;
  const h = (new Date(feed.peakAt).getTime() - new Date(feed.fedAt).getTime()) / HOUR;
  return Number.isFinite(h) && h >= MIN_PEAK_HOURS ? h : null;
}

export function liveFeeds(feeds: Feed[]): Feed[] {
  return feeds.filter((f) => !f.deletedAt).sort((a, b) => a.fedAt.localeCompare(b.fedAt));
}

export interface Readiness {
  /** Aantal laatste gemeten voedingen op rij binnen de drempel. */
  streak: number;
  needed: number;
  ready: boolean;
  /** Uren tot piek bij de laatste meting. */
  lastHours: number | null;
  measured: number;
  /** De laatste voeding wacht nog op "piek bereikt". */
  waitingForPeak: boolean;
  ageDays: number;
  tooYoung: boolean;
}

export function readiness(starter: Starter, feeds: Feed[], now: Date): Readiness {
  const list = liveFeeds(feeds);
  const last = list[list.length - 1];
  const measuredList = list.filter((f) => hoursToPeak(f) !== null);
  let streak = 0;
  for (let i = measuredList.length - 1; i >= 0; i--) {
    const h = hoursToPeak(measuredList[i]);
    if (h !== null && h <= starter.thresholdHours) streak++;
    else break;
  }
  const age = ageDays(starter.startedOn, now);
  const lastMeasured = measuredList[measuredList.length - 1];
  return {
    streak,
    needed: starter.streakNeeded,
    ready: streak >= starter.streakNeeded && age >= MIN_AGE_DAYS,
    lastHours: lastMeasured ? hoursToPeak(lastMeasured) : null,
    measured: measuredList.length,
    waitingForPeak: !!last && !last.peakAt,
    ageDays: age,
    tooYoung: age < MIN_AGE_DAYS,
  };
}

/**
 * Vroegst mogelijke bakdag (schatting): niet voor dag 14, en nog minstens zoveel
 * voedingen als er op rij ontbreken. Null als hij al klaar lijkt.
 */
export function earliestBakeDay(starter: Starter, feeds: Feed[], now: Date): Date | null {
  const r = readiness(starter, feeds, now);
  if (r.ready) return null;
  const minDay = parseDay(starter.startedOn).getTime() + MIN_AGE_DAYS * DAY;
  const missing = Math.max(0, r.needed - r.streak);
  const intervalDays = Math.max(1, Math.round(starter.feedIntervalHours / 24));
  const byStreak = dayStart(now) + missing * intervalDays * DAY;
  return new Date(Math.max(minDay, byStreak, dayStart(now)));
}

export function nextFeedDue(starter: Starter, feeds: Feed[]): Date | null {
  const list = liveFeeds(feeds);
  const last = list[list.length - 1];
  if (!last) return null;
  return new Date(new Date(last.fedAt).getTime() + starter.feedIntervalHours * HOUR);
}

/** Punten voor de grafiek: de laatste n gemeten voedingen. */
export function peakSeries(feeds: Feed[], n = 10): { at: string; hours: number }[] {
  return liveFeeds(feeds)
    .map((f) => ({ at: f.fedAt, hours: hoursToPeak(f) }))
    .filter((p): p is { at: string; hours: number } => p.hours !== null)
    .slice(-n);
}

/** 6,5 uur -> "6 u 30" */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} min`;
  return mm === 0 ? `${hh} u` : `${hh} u ${String(mm).padStart(2, '0')}`;
}
