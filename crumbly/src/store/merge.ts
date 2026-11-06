// Gegevens uit de cloud samenvoegen met wat op het toestel staat. Per item wint de
// laatste wijziging (updatedAt). Puur, zodat het getest kan worden (tests/merge.test.ts).

import type { AwayPeriod, Bake, Feed, Recipe, Settings, Starter } from '../domain/types';

export type Kind = 'starter' | 'feed' | 'recipe' | 'bake' | 'away' | 'settings';

export interface RemoteItem {
  id: string;
  kind: Kind;
  data: unknown;
  updated_at: string;
}

export interface MergeTarget {
  seeded: boolean;
  starter: Starter | null;
  feeds: Feed[];
  recipes: Recipe[];
  bakes: Bake[];
  away: AwayPeriod[];
  settings: Settings;
}

type Stamped = { id: string; updatedAt: string };

const hasTime = (d: unknown): d is { updatedAt: string } =>
  !!d && typeof d === 'object' && typeof (d as { updatedAt?: unknown }).updatedAt === 'string';

const isStamped = (d: unknown): d is Stamped => hasTime(d) && typeof (d as { id?: unknown }).id === 'string';

/** Is `remote` nieuwer dan `local`? Gelijk = lokaal houden. */
export const remoteWins = (local: { updatedAt: string } | null | undefined, remote: { updatedAt: string }): boolean =>
  !local || remote.updatedAt > local.updatedAt;

/** Past de items toe op `s` (mag een immer-draft zijn). Geeft terug hoeveel er veranderden. */
export function mergeRemote(s: MergeTarget, items: RemoteItem[]): number {
  let changed = 0;
  const upsert = <T extends Stamped>(list: T[], d: Stamped): void => {
    const i = list.findIndex((x) => x.id === d.id);
    if (i < 0) { list.push(d as T); changed++; }
    else if (remoteWins(list[i], d)) { list[i] = d as T; changed++; }
  };
  for (const it of items) {
    const d = it.data;
    // De instellingen hebben geen eigen id in hun gegevens (de rij heeft er wel een): enkel de tijd telt.
    if (it.kind === 'settings') {
      if (hasTime(d) && remoteWins(s.settings, d)) { s.settings = d as unknown as Settings; changed++; }
      continue;
    }
    if (!isStamped(d)) continue;
    switch (it.kind) {
      case 'starter':
        if (remoteWins(s.starter, d)) { s.starter = d as unknown as Starter; changed++; }
        s.seeded = true;
        break;
      case 'feed': upsert(s.feeds, d); break;
      case 'recipe': upsert(s.recipes, d); break;
      case 'bake': upsert(s.bakes, d); break;
      case 'away': upsert(s.away, d); break;
    }
  }
  return changed;
}
