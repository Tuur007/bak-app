// Bakkerspercentages. Alles op het TOTALE meel: het meel in het recept plus het meel
// in de starter. Hydratatie telt het water uit de starter mee. Deterministisch, getest
// in tests/ratios.test.ts.

export interface Formula {
  flourG: number;
  waterG: number;
  starterG: number;
  /** Hydratatie van de starter in procent. */
  starterHydration: number;
  saltG: number;
}

export interface Ratios {
  totalFlour: number;
  totalWater: number;
  /** In procent. */
  hydration: number;
  starterPct: number;
  saltPct: number;
  doughWeight: number;
}

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

export function starterParts(starterG: number, starterHydration: number): { flour: number; water: number } {
  const s = safe(starterG);
  const h = Number.isFinite(starterHydration) && starterHydration >= 0 ? starterHydration : 100;
  const flour = s / (1 + h / 100);
  return { flour, water: s - flour };
}

export function computeRatios(f: Formula): Ratios {
  const sp = starterParts(f.starterG, f.starterHydration);
  const totalFlour = safe(f.flourG) + sp.flour;
  const totalWater = safe(f.waterG) + sp.water;
  const pct = (x: number): number => (totalFlour > 0 ? (x / totalFlour) * 100 : 0);
  return {
    totalFlour,
    totalWater,
    hydration: pct(totalWater),
    starterPct: pct(safe(f.starterG)),
    saltPct: pct(safe(f.saltG)),
    doughWeight: safe(f.flourG) + safe(f.waterG) + safe(f.starterG) + safe(f.saltG),
  };
}

/** Praktisch afronden: vanaf 20 g op hele grammen, daaronder op halve. */
export function roundGrams(g: number): number {
  if (!Number.isFinite(g) || g <= 0) return 0;
  return g >= 20 ? Math.round(g) : Math.round(g * 2) / 2;
}

export function scaleFormula(f: Formula, factor: number): Formula {
  const k = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    flourG: roundGrams(f.flourG * k),
    waterG: roundGrams(f.waterG * k),
    starterG: roundGrams(f.starterG * k),
    starterHydration: f.starterHydration,
    saltG: roundGrams(f.saltG * k),
  };
}

export function factorForDoughWeight(f: Formula, targetG: number): number {
  const w = computeRatios(f).doughWeight;
  return w > 0 && targetG > 0 ? targetG / w : 1;
}

/** "72,7%" */
export function formatPct(x: number): string {
  if (!Number.isFinite(x)) return '-';
  return `${(Math.round(x * 10) / 10).toString().replace('.', ',')}%`;
}

/** "1:5:5" -> [1,5,5]; ongeldig -> null */
export function parseFeedRatio(r: string): [number, number, number] | null {
  const parts = r.split(':').map((p) => Number(p.trim().replace(',', '.')));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p) || p <= 0)) return null;
  return [parts[0], parts[1], parts[2]];
}

/** Grammen meel en water voor een voeding bij een gegeven hoeveelheid starter. */
export function feedAmounts(ratio: string, starterG: number): { flour: number; water: number } | null {
  const p = parseFeedRatio(ratio);
  if (!p || !(starterG > 0)) return null;
  return { flour: roundGrams((starterG / p[0]) * p[1]), water: roundGrams((starterG / p[0]) * p[2]) };
}

/** Ratio's van een recept (alle meelsoorten samen). */
export function recipeRatios(r: { flours: { grams: number }[]; waterG: number; starterG: number; starterHydration: number; saltG: number }): Ratios {
  const flourG = r.flours.reduce((a, f) => a + (Number.isFinite(f.grams) ? f.grams : 0), 0);
  return computeRatios({ flourG, waterG: r.waterG, starterG: r.starterG, starterHydration: r.starterHydration, saltG: r.saltG });
}
