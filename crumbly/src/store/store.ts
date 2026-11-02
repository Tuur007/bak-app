// Eén store voor alle gegevens. Lokaal (op het toestel) is de bron: alles werkt ook
// zonder netwerk. Elke wijziging komt in `dirty`; de sync (src/services/sync.ts) stuurt
// die naar Supabase zodra je aangemeld en online bent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { defaultSettings, defaultStarter, exampleRecipe } from '../domain/defaults';
import { newId } from '../domain/ids';
import { computeRatios } from '../domain/ratios';
import { delayOpen, endOf, markDone, planBackward, shiftForReturn, undoDone } from '../domain/schedule';
import { liveFeeds } from '../domain/starter';
import { mergeRemote, type Kind, type RemoteItem } from './merge';
import type { AwayPeriod, Bake, BakeResult, Feed, PlannedStep, Recipe, Settings, Starter } from '../domain/types';

export type { Kind, RemoteItem } from './merge';
export const SETTINGS_ID = '00000000-0000-4000-8000-00000000c0de';

export interface CrumblyState {
  seeded: boolean;
  starter: Starter | null;
  feeds: Feed[];
  recipes: Recipe[];
  bakes: Bake[];
  away: AwayPeriod[];
  settings: Settings;
  dirty: string[];
  lastPulledAt: string | null;

  seedIfEmpty: () => void;
  updateStarter: (patch: Partial<Starter>) => void;
  feedNow: (at?: Date) => void;
  markPeak: (at?: Date) => void;
  updateFeed: (id: string, patch: Partial<Feed>) => void;
  deleteFeed: (id: string) => void;
  saveRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  planBake: (recipeId: string, end: Date) => string | null;
  setStepDone: (bakeId: string, stepId: string, done: boolean) => void;
  setStepAlarm: (bakeId: string, stepId: string, alarm: boolean) => void;
  delayBake: (bakeId: string, minutes: number) => void;
  shiftBakeForReturn: (bakeId: string, returnAt: Date) => number;
  cancelBake: (bakeId: string) => void;
  finishBake: (bakeId: string, result: Omit<BakeResult, 'at'>) => void;
  addAway: (p: Omit<AwayPeriod, 'id' | 'updatedAt'>) => void;
  deleteAway: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  applyRemote: (items: RemoteItem[], pulledAt: string) => void;
  clearDirty: (keys: string[]) => void;
  replaceAll: (data: BackupData) => void;
}

export interface BackupData {
  starter: Starter | null;
  feeds: Feed[];
  recipes: Recipe[];
  bakes: Bake[];
  away: AwayPeriod[];
  settings: Settings;
}

const nowIso = (): string => new Date().toISOString();
const key = (kind: Kind, id: string): string => `${kind}:${id}`;

export const useCrumbly = create<CrumblyState>()(
  persist(
    immer((set, get) => {
      const touch = (s: CrumblyState, kind: Kind, id: string): void => {
        const k = key(kind, id);
        if (!s.dirty.includes(k)) s.dirty.push(k);
      };
      const withBake = (bakeId: string, fn: (b: Bake) => void): void => {
        set((s) => {
          const b = s.bakes.find((x) => x.id === bakeId);
          if (!b) return;
          fn(b);
          b.endAt = endOf(b.steps).toISOString();
          b.updatedAt = nowIso();
          touch(s, 'bake', b.id);
        });
      };

      return {
        seeded: false,
        starter: null,
        feeds: [],
        recipes: [],
        bakes: [],
        away: [],
        settings: defaultSettings(new Date(0).toISOString()),
        dirty: [],
        lastPulledAt: null,

        seedIfEmpty: () =>
          set((s) => {
            if (s.seeded) return;
            // Vaste id's en een tijd in 1970: echte gegevens uit de cloud winnen altijd.
            s.starter = defaultStarter();
            const r = exampleRecipe();
            if (!s.recipes.some((x) => x.id === r.id)) s.recipes.push(r);
            s.settings = defaultSettings();
            s.seeded = true;
            touch(s, 'starter', s.starter.id);
            touch(s, 'recipe', r.id);
            touch(s, 'settings', SETTINGS_ID);
          }),

        updateStarter: (patch) =>
          set((s) => {
            if (!s.starter) return;
            Object.assign(s.starter, patch, { updatedAt: nowIso() });
            touch(s, 'starter', s.starter.id);
          }),

        feedNow: (at = new Date()) =>
          set((s) => {
            const f: Feed = { id: newId(), fedAt: at.toISOString(), ratio: s.starter?.defaultRatio ?? '1:5:5', updatedAt: nowIso() };
            s.feeds.push(f);
            touch(s, 'feed', f.id);
          }),

        markPeak: (at = new Date()) =>
          set((s) => {
            const open = liveFeeds(s.feeds).filter((f) => !f.peakAt).pop();
            if (!open) return;
            const f = s.feeds.find((x) => x.id === open.id);
            if (!f) return;
            f.peakAt = at.toISOString();
            f.updatedAt = nowIso();
            touch(s, 'feed', f.id);
          }),

        updateFeed: (id, patch) =>
          set((s) => {
            const f = s.feeds.find((x) => x.id === id);
            if (!f) return;
            Object.assign(f, patch, { updatedAt: nowIso() });
            touch(s, 'feed', id);
          }),

        deleteFeed: (id) =>
          set((s) => {
            const f = s.feeds.find((x) => x.id === id);
            if (!f) return;
            f.deletedAt = nowIso();
            f.updatedAt = f.deletedAt;
            touch(s, 'feed', id);
          }),

        saveRecipe: (r) =>
          set((s) => {
            const copy: Recipe = { ...r, isExample: false, updatedAt: nowIso() };
            const i = s.recipes.findIndex((x) => x.id === r.id);
            if (i >= 0) s.recipes[i] = copy;
            else s.recipes.push(copy);
            touch(s, 'recipe', r.id);
          }),

        deleteRecipe: (id) =>
          set((s) => {
            const r = s.recipes.find((x) => x.id === id);
            if (!r) return;
            r.deletedAt = nowIso();
            r.updatedAt = r.deletedAt;
            touch(s, 'recipe', id);
          }),

        planBake: (recipeId, end) => {
          const r = get().recipes.find((x) => x.id === recipeId && !x.deletedAt);
          if (!r) return null;
          const flourG = r.flours.reduce((a, f) => a + f.grams, 0);
          const ratios = computeRatios({ flourG, waterG: r.waterG, starterG: r.starterG, starterHydration: r.starterHydration, saltG: r.saltG });
          const steps: PlannedStep[] = planBackward(r.process, end).map((p) => ({ ...p, id: newId() }));
          const t = nowIso();
          const b: Bake = {
            id: newId(), recipeId: r.id, recipeName: r.name, hydration: ratios.hydration, steps,
            endAt: endOf(steps).toISOString(), status: 'gepland', createdAt: t, updatedAt: t,
          };
          set((s) => {
            s.bakes.push(b);
            touch(s, 'bake', b.id);
          });
          return b.id;
        },

        setStepDone: (bakeId, stepId, done) =>
          withBake(bakeId, (b) => {
            b.steps = done ? markDone(b.steps, stepId, new Date()) : undoDone(b.steps, stepId);
          }),

        setStepAlarm: (bakeId, stepId, alarm) =>
          withBake(bakeId, (b) => {
            const st = b.steps.find((x) => x.id === stepId);
            if (st) st.alarm = alarm;
          }),

        delayBake: (bakeId, minutes) => withBake(bakeId, (b) => { b.steps = delayOpen(b.steps, minutes); }),

        shiftBakeForReturn: (bakeId, returnAt) => {
          let delta = 0;
          withBake(bakeId, (b) => {
            const r = shiftForReturn(b.steps, returnAt);
            if (r) { b.steps = r.steps; delta = r.deltaMin; }
          });
          return delta;
        },

        cancelBake: (bakeId) => withBake(bakeId, (b) => { b.status = 'geannuleerd'; }),

        finishBake: (bakeId, result) =>
          withBake(bakeId, (b) => {
            b.status = 'klaar';
            b.result = { ...result, at: nowIso() };
          }),

        addAway: (p) =>
          set((s) => {
            const a: AwayPeriod = { ...p, id: newId(), updatedAt: nowIso() };
            s.away.push(a);
            touch(s, 'away', a.id);
          }),

        deleteAway: (id) =>
          set((s) => {
            const a = s.away.find((x) => x.id === id);
            if (!a) return;
            a.deletedAt = nowIso();
            a.updatedAt = a.deletedAt;
            touch(s, 'away', id);
          }),

        updateSettings: (patch) =>
          set((s) => {
            Object.assign(s.settings, patch, { updatedAt: nowIso() });
            touch(s, 'settings', SETTINGS_ID);
          }),

        // Laatste wijziging wint (per item). Lokale wijzigingen die nog niet verstuurd
        // zijn en nieuwer zijn, blijven staan.
        applyRemote: (items, pulledAt) =>
          set((s) => {
            mergeRemote(s, items);
            s.lastPulledAt = pulledAt;
          }),

        clearDirty: (keys) => set((s) => { s.dirty = s.dirty.filter((k) => !keys.includes(k)); }),

        replaceAll: (data) =>
          set((s) => {
            s.starter = data.starter;
            s.feeds = data.feeds;
            s.recipes = data.recipes;
            s.bakes = data.bakes;
            s.away = data.away;
            s.settings = data.settings;
            s.seeded = true;
            s.dirty = [];
            if (data.starter) touch(s, 'starter', data.starter.id);
            data.feeds.forEach((x) => touch(s, 'feed', x.id));
            data.recipes.forEach((x) => touch(s, 'recipe', x.id));
            data.bakes.forEach((x) => touch(s, 'bake', x.id));
            data.away.forEach((x) => touch(s, 'away', x.id));
            touch(s, 'settings', SETTINGS_ID);
          }),
      };
    }),
    {
      name: 'crumbly.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        seeded: s.seeded, starter: s.starter, feeds: s.feeds, recipes: s.recipes, bakes: s.bakes,
        away: s.away, settings: s.settings, dirty: s.dirty, lastPulledAt: s.lastPulledAt,
      }),
    },
  ),
);

/** Item voor de sync, op basis van een dirty-sleutel. */
export function itemForKey(s: CrumblyState, k: string): RemoteItem | null {
  const [kind, id] = k.split(':') as [Kind, string];
  let data: { updatedAt: string } | null | undefined = null;
  switch (kind) {
    case 'starter': data = s.starter?.id === id ? s.starter : null; break;
    case 'settings': data = s.settings; break;
    case 'feed': data = s.feeds.find((x) => x.id === id); break;
    case 'recipe': data = s.recipes.find((x) => x.id === id); break;
    case 'bake': data = s.bakes.find((x) => x.id === id); break;
    case 'away': data = s.away.find((x) => x.id === id); break;
  }
  if (!data) return null;
  return { id, kind, data, updated_at: data.updatedAt };
}

export function backupOf(s: CrumblyState): BackupData {
  return { starter: s.starter, feeds: s.feeds, recipes: s.recipes, bakes: s.bakes, away: s.away, settings: s.settings };
}

// Let op: selecteer in componenten de ruwe lijst (s.bakes) en filter daarna met deze
// functies. Een selector die telkens een nieuwe lijst teruggeeft, laat zustand eindeloos
// opnieuw tekenen.
export function liveRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) => !r.deletedAt);
}

export function plannedBakes(bakes: Bake[]): Bake[] {
  return bakes.filter((b) => !b.deletedAt && b.status === 'gepland').sort((a, b) => a.endAt.localeCompare(b.endAt));
}
