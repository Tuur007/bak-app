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
  /** Vast voeduur ("18:00"): Crumbly noteert de voeding dan zelf. */
  autoFeedAt?: string;
  /** Vanaf welke dag (YYYY-MM-DD) automatisch genoteerd wordt; nooit met terugwerkende kracht daarvoor. */
  autoFeedSince?: string;
  /** Van wie deze starter afgesplitst is (bv. "Jean Flore"), enkel ter herinnering. */
  splitFrom?: string;
  /** Dag van het splitsen (YYYY-MM-DD). De leeftijd blijft tellen vanaf `startedOn`. */
  splitOn?: string;
  updatedAt: string;
}

export interface Feed {
  id: Id;
  fedAt: string;
  /** Moment dat de starter op zijn piek was (verdubbeld), als je dat aanduidde. */
  peakAt?: string;
  ratio: string;
  note?: string;
  /** Door Crumbly genoteerd op het vaste voeduur. */
  auto?: boolean;
  /** De verdubbeltijd is een schatting uit een antwoord ("binnen 6 u"). */
  peakApprox?: boolean;
  /** De gebruiker zei: niet bekeken. */
  peakSkipped?: boolean;
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
  /** Duurt langer als het koeler is (bv. bulk op de aanrecht). */
  tempSensitive?: boolean;
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
  /** De tijden gelden bij zoveel graden in de keuken (leeg = niet aanpassen aan de temperatuur). */
  refTempC?: number;
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
  /** Kleine JPEG als data-URL (zie src/services/photo.ts). */
  photo?: string;
  at: string;
}

export interface Bake {
  id: Id;
  recipeId: Id;
  recipeName: string;
  /** Momentopname van de ratio's op het moment van plannen. */
  hydration: number;
  /** Keukentemperatuur waarmee de tijden zijn berekend, als het recept daar rekening mee houdt. */
  kitchenTempC?: number;
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
  /** Eerste-keer-hulp is gezien. */
  onboarded?: boolean;
  /** Laatst gebruikte keukentemperatuur. */
  kitchenTempC?: number;
  /** Hoeveel keer langer het duurt per 10 graden koeler (grove vuistregel, aanpasbaar). */
  tempDoubling?: number;
  updatedAt: string;
}
