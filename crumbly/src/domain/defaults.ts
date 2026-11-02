// Startgegevens bij de eerste keer openen. Het voorbeeldrecept en schema zijn
// voorbeelden: ze moeten aangepast worden aan het eigen recept.

import { newId } from './ids';
import type { ProcessStep, Recipe, Settings, Starter } from './types';

// Startgegevens hebben een vaste id en een tijd in 1970. Zo wint elke echte gegeven uit
// de cloud altijd van de startgegevens van een nieuw toestel (laatste wijziging wint), en
// komen er geen dubbele starters of voorbeeldrecepten bij een tweede toestel.
export const SEED_TIME = '1970-01-01T00:00:00.000Z';
export const STARTER_ID = '00000000-0000-4000-8000-0000000057a7';
export const EXAMPLE_RECIPE_ID = '00000000-0000-4000-8000-00000000ba7a';

export function defaultStarter(nowIso: string = SEED_TIME): Starter {
  return {
    id: STARTER_ID,
    name: 'Jean',
    startedOn: '2026-10-16',
    defaultRatio: '1:5:5',
    feedIntervalHours: 24,
    thresholdHours: 6,
    streakNeeded: 3,
    location: 'kamer',
    updatedAt: nowIso,
  };
}

const s = (name: string, minutes: number, kind: 'hand' | 'wacht', workMinutes?: number): ProcessStep => ({
  id: newId(),
  name,
  minutes,
  kind,
  workMinutes: kind === 'hand' ? workMinutes ?? 5 : undefined,
  alarm: kind === 'hand',
});

/** Voorbeeldschema voor een bâtard met koude rijs. Tijden zijn een vertrekpunt. */
export function batardProcess(): ProcessStep[] {
  return [
    s('Starter voeden', 300, 'hand', 5),
    s('Mengen (meel en water)', 45, 'hand', 15),
    s('Starter en zout erbij', 30, 'hand', 10),
    s('Vouwen 1', 30, 'hand', 5),
    s('Vouwen 2', 30, 'hand', 5),
    s('Vouwen 3', 30, 'hand', 5),
    s('Vouwen 4', 5, 'hand', 5),
    s('Bulk laten rijzen', 150, 'wacht'),
    s('Vormen', 30, 'hand', 15),
    s('In de koelkast (koude rijs)', 720, 'hand', 2),
    s('Oven aan met de pot erin', 45, 'hand', 2),
    s('Bakken met deksel', 20, 'hand', 5),
    s('Deksel eraf, verder bakken', 25, 'hand', 1),
    s('Afkoelen', 60, 'wacht'),
  ];
}

export function exampleRecipe(nowIso: string = SEED_TIME): Recipe {
  return {
    id: EXAMPLE_RECIPE_ID,
    name: 'Klassieke bâtard',
    source: 'Voorbeeld: vervang door je eigen recept',
    flours: [{ id: newId(), name: 'Bloem', grams: 500 }],
    waterG: 350,
    starterG: 100,
    starterHydration: 100,
    saltG: 10,
    process: batardProcess(),
    isExample: true,
    updatedAt: nowIso,
  };
}

export function defaultSettings(nowIso: string = SEED_TIME): Settings {
  // Voorbeeld: weekdagen thuis vanaf 17:30, weekend de hele dag. Aan te passen.
  const week = [1, 2, 3, 4, 5].flatMap((day) => [
    { day, from: '06:30', to: '08:00' },
    { day, from: '17:30', to: '23:30' },
  ]);
  const weekend = [0, 6].map((day) => ({ day, from: '07:00', to: '23:30' }));
  return { homeWindows: [...week, ...weekend], feedReminder: false, updatedAt: nowIso };
}
