// Een uit tekst gemaakt recept is eerst een CONCEPT: het staat nog niet in je recepten tot je het nagekeken hebt
// en op "Bewaar" tikt. Dit houdt het concept even vast tussen het plakscherm en de editor. Niet bewaard: sluit je
// het scherm, dan is het concept weg.

import type { Recipe } from './types';

export interface RecipeDraft {
  recipe: Recipe;
  warnings: string[];
  ignored: string[];
}

let current: RecipeDraft | null = null;

export function setRecipeDraft(d: RecipeDraft): void {
  current = d;
}

/** Het concept bekijken zonder het te wissen (een scherm kan zijn startwaarde twee keer berekenen). */
export function peekRecipeDraft(): RecipeDraft | null {
  return current;
}

export function clearRecipeDraft(): void {
  current = null;
}

/** Aantal stappen dat nog nagekeken moet worden (markering `check`). */
export function stepsToCheck(recipe: Pick<Recipe, 'process'>): number {
  return recipe.process.filter((s) => !!s.check).length;
}
