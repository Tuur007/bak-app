// Rijstijd en keukentemperatuur. Een GROVE vuistregel, geen gemeten tabel: per 10 graden koeler
// duurt rijzen ongeveer `doubling` keer langer (standaard 2). Wie het anders ziet, past de factor
// aan in de instellingen. Enkel stappen die als temperatuurgevoelig staan aangeduid veranderen,
// en enkel als het recept zegt bij hoeveel graden zijn tijden gelden (`refTempC`).
// Getest in tests/temperature.test.ts.

import type { ProcessStep } from './types';

export const DEFAULT_DOUBLING = 2;
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.5;

/** Factor op de tijd: > 1 = langer (koeler dan het recept), < 1 = korter (warmer). */
export function timeFactor(refC: number, actualC: number, doubling: number = DEFAULT_DOUBLING): number {
  if (!Number.isFinite(refC) || !Number.isFinite(actualC)) return 1;
  const d = Number.isFinite(doubling) && doubling > 1 ? doubling : DEFAULT_DOUBLING;
  const f = Math.pow(d, (refC - actualC) / 10);
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, f));
}

const round5 = (min: number): number => Math.max(5, Math.round(min / 5) * 5);

export interface AdjustedProcess {
  process: ProcessStep[];
  /** Per stap-id: oorspronkelijke en nieuwe duur, enkel voor stappen die veranderden. */
  changes: { id: string; name: string; from: number; to: number }[];
  factor: number;
}

export function adjustForTemperature(
  process: ProcessStep[],
  refC: number | undefined,
  actualC: number | undefined,
  doubling?: number,
): AdjustedProcess {
  if (refC === undefined || actualC === undefined) return { process, changes: [], factor: 1 };
  const factor = timeFactor(refC, actualC, doubling);
  const changes: AdjustedProcess['changes'] = [];
  const out = process.map((s) => {
    if (!s.tempSensitive) return s;
    const to = round5(s.minutes * factor);
    if (to === s.minutes) return s;
    changes.push({ id: s.id, name: s.name, from: s.minutes, to });
    return { ...s, minutes: to };
  });
  return { process: out, changes, factor };
}
