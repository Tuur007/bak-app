// Bakschema: plannen vanaf een eindtijd (terugrekenen) of een starttijd, stappen
// verschuiven, passen in de momenten dat je thuis bent, en "ik ben weg".
// Alle tijden zijn absolute momenten, zodat het schema klopt ook als de app een
// tijd dicht was. Getest in tests/schedule.test.ts.

import type { AwayPeriod, Bake, HomeWindow, PlannedStep, ProcessStep } from './types';

const MIN = 60_000;

export function totalMinutes(process: ProcessStep[]): number {
  return process.reduce((s, p) => s + Math.max(0, p.minutes), 0);
}

export function planForward(process: ProcessStep[], start: Date): PlannedStep[] {
  let t = start.getTime();
  return process.map((p) => {
    const step: PlannedStep = { ...p, startAt: new Date(t).toISOString() };
    t += Math.max(0, p.minutes) * MIN;
    return step;
  });
}

/** Terugrekenen: het brood is klaar op `end` (einde van de laatste stap). */
export function planBackward(process: ProcessStep[], end: Date): PlannedStep[] {
  return planForward(process, new Date(end.getTime() - totalMinutes(process) * MIN));
}

export function endOf(steps: PlannedStep[]): Date {
  const last = steps[steps.length - 1];
  if (!last) return new Date(NaN);
  return new Date(new Date(last.startAt).getTime() + Math.max(0, last.minutes) * MIN);
}

export function workMinutes(step: ProcessStep): number {
  if (step.kind === 'wacht') return 0;
  return Math.min(step.minutes, step.workMinutes ?? 5);
}

export function shiftFrom(steps: PlannedStep[], index: number, deltaMin: number): PlannedStep[] {
  return steps.map((s, i) =>
    i >= index && !s.doneAt ? { ...s, startAt: new Date(new Date(s.startAt).getTime() + deltaMin * MIN).toISOString() } : s,
  );
}

export function firstOpenIndex(steps: PlannedStep[]): number {
  return steps.findIndex((s) => !s.doneAt);
}

export interface StepState {
  index: number;
  step: PlannedStep | null;
  /** De stap is aan de beurt (starttijd voorbij). */
  due: boolean;
  /** Milliseconden tot de starttijd (negatief als hij voorbij is). */
  msUntil: number;
  /** De stap erna, als die er is. */
  next: PlannedStep | null;
}

export function stepState(steps: PlannedStep[], now: Date): StepState {
  const index = firstOpenIndex(steps);
  if (index < 0) return { index: -1, step: null, due: false, msUntil: 0, next: null };
  const step = steps[index];
  const msUntil = new Date(step.startAt).getTime() - now.getTime();
  return { index, step, due: msUntil <= 0, msUntil, next: steps[index + 1] ?? null };
}

export function markDone(steps: PlannedStep[], id: string, at: Date): PlannedStep[] {
  return steps.map((s) => (s.id === id ? { ...s, doneAt: at.toISOString() } : s));
}

export function undoDone(steps: PlannedStep[], id: string): PlannedStep[] {
  return steps.map((s) => {
    if (s.id !== id) return s;
    const { doneAt: _drop, ...rest } = s;
    return rest;
  });
}

/** "Deeg nog niet klaar": alle open stappen schuiven `minutes` op. */
export function delayOpen(steps: PlannedStep[], minutes: number): PlannedStep[] {
  const i = firstOpenIndex(steps);
  return i < 0 ? steps : shiftFrom(steps, i, minutes);
}

/**
 * "Ik ben pas om ... thuis": de eerste open handwerkstap voor dat moment schuift naar
 * het moment van thuiskomst, alles erna schuift mee. Geeft null als niets moet schuiven.
 */
export function shiftForReturn(steps: PlannedStep[], returnAt: Date): { steps: PlannedStep[]; deltaMin: number } | null {
  const idx = steps.findIndex((s) => !s.doneAt && s.kind === 'hand' && new Date(s.startAt).getTime() < returnAt.getTime());
  if (idx < 0) return null;
  const deltaMin = Math.ceil((returnAt.getTime() - new Date(steps[idx].startAt).getTime()) / MIN);
  if (deltaMin <= 0) return null;
  return { steps: shiftFrom(steps, idx, deltaMin), deltaMin };
}

// ---------------------------------------------------------------- thuis-momenten

export function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Valt [start, start+duur] volledig binnen een thuis-moment van die dag? */
export function fitsHome(start: Date, durationMin: number, windows: HomeWindow[]): boolean {
  if (windows.length === 0) return true;
  const day = start.getDay();
  const from = start.getHours() * 60 + start.getMinutes();
  const to = from + durationMin;
  return windows.some((w) => w.day === day && hhmmToMin(w.from) <= from && to <= hhmmToMin(w.to));
}

/** Open handwerkstappen die buiten je thuis-momenten vallen. */
export function homeConflicts(steps: PlannedStep[], windows: HomeWindow[]): PlannedStep[] {
  if (windows.length === 0) return [];
  return steps.filter((s) => !s.doneAt && s.kind === 'hand' && !fitsHome(new Date(s.startAt), workMinutes(s), windows));
}

/**
 * Dichtstbijzijnde eindtijd (in stappen van 15 min, eerst later dan vroeger) waarbij al
 * het handwerk thuis valt en niets voor `notBefore` begint. Null als niets past binnen
 * `maxHours` (standaard een week, zodat ook het weekend meetelt).
 */
export function findFittingEnd(
  process: ProcessStep[],
  desiredEnd: Date,
  windows: HomeWindow[],
  notBefore: Date,
  maxHours = 7 * 24,
): Date | null {
  const stepMin = 15;
  for (let k = 0; k <= (maxHours * 60) / stepMin; k++) {
    for (const sign of k === 0 ? [1] : [1, -1]) {
      const end = new Date(desiredEnd.getTime() + sign * k * stepMin * MIN);
      const steps = planBackward(process, end);
      if (new Date(steps[0]?.startAt ?? end.toISOString()).getTime() < notBefore.getTime()) continue;
      if (homeConflicts(steps, windows).length === 0) return end;
    }
  }
  return null;
}

// ---------------------------------------------------------------- weg

export function activeAway(periods: AwayPeriod[], now: Date): AwayPeriod | null {
  const t = now.getTime();
  return periods.find((p) => !p.deletedAt && new Date(p.from).getTime() <= t && t < new Date(p.to).getTime()) ?? null;
}

export function upcomingAway(periods: AwayPeriod[], now: Date): AwayPeriod[] {
  return periods
    .filter((p) => !p.deletedAt && new Date(p.to).getTime() > now.getTime())
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** Geplande bakken met handwerk tijdens de afwezigheid. */
export function bakesHitByAway(bakes: Bake[], period: AwayPeriod): Bake[] {
  const from = new Date(period.from).getTime();
  const to = new Date(period.to).getTime();
  return bakes.filter(
    (b) =>
      !b.deletedAt &&
      b.status === 'gepland' &&
      b.steps.some((s) => {
        if (s.doneAt || s.kind !== 'hand') return false;
        const t = new Date(s.startAt).getTime();
        return t >= from && t < to;
      }),
  );
}

export function isAwayAt(periods: AwayPeriod[], at: Date): boolean {
  return activeAway(periods, at) !== null;
}
