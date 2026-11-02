// Gegevensmodel van Crumbly. Alle tijden zijn ISO-strings (UTC); tonen gebeurt in de
// tijdzone van het toestel.

export type Id = string;

export interface Starter {
  id: Id;
  name: string;
  /** Startdatum, als YYYY-MM-DD. */
  startedOn: string;
  /** Standaardverhouding starter:meel:water, bv. "1:5:5". */
  defaultRatio: string;
  /** Om de hoeveel uur je voedt (voor "volgende voeding"). */
  feedIntervalHours: number;
  /** Klaar-drempel: verdubbeld binnen zoveel uur. */
  thresholdHours: number;
  /** Zoveel keer op rij binnen de drempel = klaar om te bakken. */
  streakNeeded: number;
  location: 'kamer' | 'koelkast';
  updatedAt: string;
}

export interface Feed {
  id: Id;
  fedAt: string;
  /** Moment dat de starter op zijn piek was (verdubbeld), als je dat aanduidde. */
  peakAt?: string;
  ratio: string;
  note?: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Flour {
  id: Id;
  name: string;
  grams: number;
}

export type StepKind = 'hand' | 'wacht';

export interface ProcessStep {
  id: Id;
  name: string;
  /** Duur tot de volgende stap begint, in minuten. */
  minutes: number;
  kind: StepKind;
  /** Handwerk in minuten (enkel voor kind 'hand'); de rest van `minutes` is wachten. */
  workMinutes?: number;
  alarm: boolean;
}

export interface Recipe {
  id: Id;
  name: string;
  source?: string;
  flours: Flour[];
  waterG: number;
  starterG: number;
  /** Hydratatie van de starter in procent (100 = evenveel meel als water). */
  starterHydration: number;
  saltG: number;
  process: ProcessStep[];
  notes?: string;
  isExample?: boolean;
  updatedAt: string;
  deletedAt?: string;
}

export interface PlannedStep extends ProcessStep {
  startAt: string;
  doneAt?: string;
}

export type CrumbKind = 'dicht' | 'gelijkmatig' | 'open';

export interface BakeResult {
  /** 0 = bleek ... 3 = donker. */
  crust: number;
  crumb: CrumbKind;
  nextTime: string;
  at: string;
}

export interface Bake {
  id: Id;
  recipeId: Id;
  recipeName: string;
  /** Momentopname van de ratio's op het moment van plannen. */
  hydration: number;
  steps: PlannedStep[];
  /** Moment dat het brood klaar is (einde van de laatste stap). */
  endAt: string;
  status: 'gepland' | 'klaar' | 'geannuleerd';
  result?: BakeResult;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface HomeWindow {
  /** 0 = zondag ... 6 = zaterdag (zoals Date.getDay()). */
  day: number;
  /** "HH:MM" */
  from: string;
  /** "HH:MM"; "24:00" mag. */
  to: string;
}

export interface AwayPeriod {
  id: Id;
  from: string;
  to: string;
  starterInFridge: boolean;
  muteFeedReminders: boolean;
  updatedAt: string;
  deletedAt?: string;
}

export interface Settings {
  homeWindows: HomeWindow[];
  feedReminder: boolean;
  updatedAt: string;
}
