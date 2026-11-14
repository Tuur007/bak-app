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

/**
 * Afvinken. Vink je de eerstvolgende stap af vóór de volgende stap gepland staat, dan begint die volgende nu en schuift
 * de rest evenveel vroeger mee (zoals bij "deeg is klaar"): zo klopt de timer ook als je vroeger begon dan gepland.
 * Vink je later af, dan blijft het schema zoals het was (ook als je achteraf alles afvinkt om het brood te noteren).
 * Een stap die niet de eerstvolgende is, wordt enkel afgevinkt.
 */
export function completeStep(steps: PlannedStep[], id: string, now: Date): PlannedStep[] {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0 || steps[i].doneAt) return steps;
  const plain = markDone(steps, id, now);
  if (i !== firstOpenIndex(steps)) return plain;
  const next = steps[i + 1];
  if (!next || next.doneAt) return plain;
  const delta = Math.round((now.getTime() - new Date(next.startAt).getTime()) / MIN);
  if (delta >= 0) return plain;
  // Eerst schuiven (de stap zelf staat nog open en schuift mee, zodat ze niet na haar eigen afvinkmoment begint), dan afvinken.
  return markDone(shiftFrom(steps, i, delta), id, now).map((s) => (s.id === id ? { ...s, shiftedEarlier: -delta } : s));
}

/** Een afgevinkte stap weer openzetten. Was het schema bij het afvinken vroeger geschoven, dan schuift het terug. */
export function reopenStep(steps: PlannedStep[], id: string): PlannedStep[] {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0) return steps;
  const back = steps[i].shiftedEarlier ?? 0;
  const reopened = steps.map((s, j) => {
    if (j !== i) return s;
    const { doneAt: _d, shiftedEarlier: _s, ...rest } = s;
    return rest;
  });
  return back > 0 ? shiftFrom(reopened, i, back) : reopened;
}

/** "Nu beginnen": de eerste open stap begint nu en alles erna schuift mee. Doet niets als ze al aan de beurt is. */
export function startNow(steps: PlannedStep[], now: Date): PlannedStep[] {
  const i = firstOpenIndex(steps);
  if (i < 0) return steps;
  const delta = Math.round((now.getTime() - new Date(steps[i].startAt).getTime()) / MIN);
  return delta >= 0 ? steps : shiftFrom(steps, i, delta);
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

/**
 * "Het deeg is klaar": de wachtstap is nu af en de volgende stap begint nu (ook als dat
 * eerder of later is dan gepland). Alle stappen daarna schuiven evenveel mee.
 */
export function finishWaitNow(steps: PlannedStep[], id: string, now: Date): PlannedStep[] {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0) return steps;
  const done = steps.map((s, j) => (j === i ? { ...s, doneAt: now.toISOString() } : s));
  const next = steps[i + 1];
  if (!next) return done;
  const delta = Math.round((now.getTime() - new Date(next.startAt).getTime()) / MIN);
  return delta === 0 ? done : shiftFrom(done, i + 1, delta);
}

export interface StepHeadline {
  /** "Nu", "Wachten" of "Volgende stap" */
  label: 'Nu' | 'Wachten' | 'Volgende stap';
  title: string;
  /** Milliseconden tot het moment waarop het ertoe doet; null = nu. */
  msUntil: number | null;
  /** Dat moment, om te tonen als het nog ver weg is. */
  at: Date | null;
  /** Wat daarna komt. */
  nextName: string | null;
  /** De wachtstap is bezig: tijd om naar het deeg te kijken. */
  waiting: boolean;
}

/** Wat het startscherm en het plan tonen voor de eerste openstaande stap. */
export function stepHeadline(steps: PlannedStep[], now: Date): StepHeadline | null {
  const st = stepState(steps, now);
  if (!st.step) return null;
  const nextName = st.next?.name ?? null;
  if (st.step.kind === 'wacht' && st.due) {
    // Bezig met wachten: het gaat om het einde van het wachten (begin van de volgende stap).
    const end = st.next ? new Date(st.next.startAt) : new Date(new Date(st.step.startAt).getTime() + st.step.minutes * MIN);
    return { label: 'Wachten', title: st.step.name, msUntil: Math.max(0, end.getTime() - now.getTime()), at: end, nextName, waiting: true };
  }
  if (st.due) return { label: 'Nu', title: st.step.name, msUntil: null, at: null, nextName, waiting: false };
  return { label: 'Volgende stap', title: st.step.name, msUntil: st.msUntil, at: new Date(st.step.startAt), nextName, waiting: false };
}

/** Gaat het om rijzen van deeg (dan is "kijk naar het deeg" de juiste hulp), niet om afkoelen of wachten op de oven. */
export function isDoughRise(step: { name: string; tempSensitive?: boolean }): boolean {
  return !!step.tempSensitive || /rijs|rijz|bulk|proef|proof|rust(?!en)/i.test(step.name);
}
