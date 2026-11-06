// Waar staat de starter: op kamertemperatuur of in de koelkast, en sinds wanneer. Elke verplaatsing
// komt in `starter.locationLog`, zodat Crumbly weet welke voedingen in de koelkast gebeurden en de
// gekoppelde ander het ook ziet. Puur en getest (tests/location.test.ts).

import type { AwayPeriod, Feed, LocationMove, ProcessStep, Starter, StarterLocation } from './types';

const HOUR = 3_600_000;
export const DEFAULT_FRIDGE_FEED_DAYS = 7;
const MAX_LOG = 200;

const t = (iso: string): number => new Date(iso).getTime();

/** De verplaatsingen, oudste eerst, zonder rommel. */
export function moves(starter: Starter): LocationMove[] {
  return (starter.locationLog ?? [])
    .filter((m) => (m.location === 'kamer' || m.location === 'koelkast') && Number.isFinite(t(m.at)))
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Wat je aan `updateStarter` geeft om de starter te verplaatsen. Hetzelfde als nu: niets. */
export function moveStarter(starter: Starter, to: StarterLocation, at: Date): Partial<Starter> | null {
  if (starter.location === to) return null;
  const log = [...moves(starter), { at: at.toISOString(), location: to }].slice(-MAX_LOG);
  return { location: to, locationLog: log };
}

/** Waar stond de starter op moment `at`? Voor de eerste verplaatsing: het tegenovergestelde ervan. */
export function locationAt(starter: Starter, at: Date | string): StarterLocation {
  const when = typeof at === 'string' ? t(at) : at.getTime();
  const list = moves(starter);
  if (list.length === 0) return starter.location;
  let loc: StarterLocation = list[0].location === 'kamer' ? 'koelkast' : 'kamer';
  for (const m of list) {
    if (t(m.at) <= when) loc = m.location;
    else break;
  }
  return loc;
}

/** Sinds wanneer staat hij waar hij nu staat (null = onbekend, nooit verplaatst). */
export function locationSince(starter: Starter): string | null {
  const list = moves(starter).filter((m) => m.location === starter.location);
  return list.length > 0 ? list[list.length - 1].at : null;
}

/** Om de hoeveel uur voeden, volgens de plek: in de koelkast veel minder vaak. */
export function feedIntervalHours(starter: Starter): number {
  if (starter.location === 'koelkast') return Math.max(1, starter.fridgeFeedDays ?? DEFAULT_FRIDGE_FEED_DAYS) * 24;
  return starter.feedIntervalHours;
}

/**
 * Telt deze voeding mee voor "klaar om te bakken"? Niet als ze in de koelkast gebeurde, en niet de eerste
 * voeding nadat hij uit de koelkast kwam: een koude starter verdubbelt trager en zou de reeks onterecht breken.
 */
export function countsForReadiness(starter: Starter, feed: Feed, allFeeds: Feed[]): boolean {
  if (locationAt(starter, feed.fedAt) === 'koelkast') return false;
  const fed = t(feed.fedAt);
  const lastOut = moves(starter).filter((m) => m.location === 'kamer' && t(m.at) <= fed).pop();
  if (!lastOut) return true;
  // Was er tussen het uithalen en deze voeding al een andere voeding? Dan is dit niet de eerste.
  const out = t(lastOut.at);
  const earlier = allFeeds.some((f) => f.id !== feed.id && !f.deletedAt && t(f.fedAt) >= out && t(f.fedAt) < fed);
  return earlier;
}

/**
 * "Ik ben weg" met de starter in de koelkast: noteer dat hij bij vertrek in de koelkast ging. Enkel als er
 * sinds het vertrek nog niets genoteerd werd (wat je zelf deed, wint). Geeft de wijziging, of null.
 */
export function awayFridgeMove(starter: Starter, away: AwayPeriod[], now: Date): Partial<Starter> | null {
  const started = away
    .filter((a) => !a.deletedAt && a.starterInFridge && t(a.from) <= now.getTime() && t(a.to) > now.getTime())
    .sort((a, b) => a.from.localeCompare(b.from))
    .pop();
  if (!started) return null;
  if (moves(starter).some((m) => t(m.at) >= t(started.from))) return null;
  if (starter.location === 'koelkast') return null;
  return moveStarter(starter, 'koelkast', new Date(started.from));
}

/** Net terug van een reis met de starter in de koelkast (binnen 2 dagen) en hij staat er nog: herinner eraan. */
export function backFromAwayWithFridge(starter: Starter, away: AwayPeriod[], now: Date): AwayPeriod | null {
  if (starter.location !== 'koelkast') return null;
  return (
    away
      .filter((a) => !a.deletedAt && a.starterInFridge && t(a.to) <= now.getTime() && now.getTime() - t(a.to) < 48 * HOUR)
      .sort((a, b) => a.to.localeCompare(b.to))
      .pop() ?? null
  );
}

export type LogEntry =
  | { kind: 'voeding'; at: string; feed: Feed }
  | { kind: 'plek'; at: string; location: StarterLocation };

/** Voedingen en verplaatsingen samen, nieuwste eerst: het logboek van de starter. */
export function starterLog(starter: Starter, feeds: Feed[], limit = 14): LogEntry[] {
  const entries: LogEntry[] = [
    ...feeds.filter((f) => !f.deletedAt).map((f) => ({ kind: 'voeding' as const, at: f.fedAt, feed: f })),
    ...moves(starter).map((m) => ({ kind: 'plek' as const, at: m.at, location: m.location })),
  ];
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function locationLabel(loc: StarterLocation): string {
  return loc === 'koelkast' ? 'in de koelkast' : 'op kamertemperatuur';
}

/** Eerste stap van een bak als de starter in de koelkast staat: eruit halen en laten opwarmen (vuistregel: 2 uur). */
export function fridgeOutStep(name: string): ProcessStep {
  return { id: 'koelkast-uit', name: `${name} uit de koelkast halen en laten opwarmen`, minutes: 120, kind: 'hand', workMinutes: 1, alarm: true };
}

/** Het bakschema voor deze starter: met de koelkaststap ervoor als hij in de koelkast staat. */
export function bakeProcess(process: ProcessStep[], starter: Starter | null): ProcessStep[] {
  return starter?.location === 'koelkast' ? [fridgeOutStep(starter.name), ...process] : process;
}
