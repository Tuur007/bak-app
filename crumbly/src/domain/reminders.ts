// Welke wekkers (meldingen) er moeten klaarstaan. Wordt naar de server gestuurd, die ze
// op tijd als push-melding verstuurt. Getest in tests/schedule.test.ts.

import { liveFeeds, nextFeedDue } from './starter';
import { isAwayAt } from './schedule';
import type { AwayPeriod, Bake, Feed, Settings, Starter } from './types';

export interface Reminder {
  id: string;
  dueAt: string;
  title: string;
  body: string;
  url: string;
}

export function buildReminders(
  input: { bakes: Bake[]; feeds: Feed[]; starter: Starter | null; settings: Settings; away: AwayPeriod[] },
  now: Date,
): Reminder[] {
  const out: Reminder[] = [];
  for (const b of input.bakes) {
    if (b.deletedAt || b.status !== 'gepland') continue;
    for (const s of b.steps) {
      if (s.doneAt || !s.alarm) continue;
      const due = new Date(s.startAt);
      if (due.getTime() <= now.getTime()) continue;
      out.push({ id: `bak:${b.id}:${s.id}`, dueAt: due.toISOString(), title: b.recipeName, body: `Nu: ${s.name.toLowerCase()}`, url: '/plan' });
    }
  }
  const st = input.starter;
  if (st && input.settings.feedReminder && liveFeeds(input.feeds).length > 0) {
    const due = nextFeedDue(st, input.feeds);
    const muted = due !== null && input.away.some((p) => p.muteFeedReminders) && isAwayAt(input.away.filter((p) => p.muteFeedReminders), due);
    if (due && due.getTime() > now.getTime() && !muted) {
      out.push({ id: `voeden:${due.toISOString()}`, dueAt: due.toISOString(), title: st.name, body: `Tijd om ${st.name} te voeden`, url: '/jean' });
    }
  }
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export interface StoredReminder {
  id: string;
  due_at: string;
  title: string;
  body: string;
  url: string;
}

/** Wat er op de server moet veranderen: welke openstaande wekkers weg, welke nieuw of anders. */
export function diffReminders(existing: StoredReminder[], wanted: Reminder[]): { remove: string[]; upsert: Reminder[] } {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const wantedIds = new Set(wanted.map((w) => w.id));
  const remove = existing.filter((e) => !wantedIds.has(e.id)).map((e) => e.id);
  const upsert = wanted.filter((w) => {
    const e = byId.get(w.id);
    return !e || new Date(e.due_at).getTime() !== new Date(w.dueAt).getTime() || e.title !== w.title || e.body !== w.body || e.url !== w.url;
  });
  return { remove, upsert };
}
