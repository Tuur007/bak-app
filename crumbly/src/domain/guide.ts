// Uitleg in eigen woorden: een starter opbouwen en een eenvoudig pannenbrood. De hoeveelheden en tijden
// zijn een bekend vertrekpunt, geen vaste regel: de starter en het deeg beslissen.

import { newId } from './ids';
import type { ProcessStep, Recipe } from './types';

export interface GuideDay { day: string; todo: string }

/** Een starter van nul opbouwen, dag voor dag. */
export const STARTER_DAYS: GuideDay[] = [
  { day: 'Dag 1', todo: 'Meng 50 g meel met 50 g lauw water (weeg het water af). Laat 24 uur op kamertemperatuur staan, met het deksel los op het potje.' },
  { day: 'Dag 2', todo: 'Roer 30 g meel en 30 g lauw water door het mengsel van gisteren.' },
  { day: 'Dag 3', todo: 'Hetzelfde als dag 2: 30 g meel en 30 g lauw water erbij.' },
  { day: 'Dag 4', todo: 'Haal 75 g weg. Voeg 50 g meel en 50 g water toe aan wat overblijft.' },
  { day: 'Dag 5', todo: 'Haal 100 g weg. Voeg 75 g meel en 75 g water toe aan wat overblijft.' },
  { day: 'Dag 6', todo: 'Is hij binnen 24 uur verdubbeld en blijft hij drijven in de drijftest? Dan is hij klaar. Zo niet, voed hem nog eens.' },
];

export const STARTER_GUIDE_NOTES: string[] = [
  'Zet een elastiekje om het potje op de hoogte van de starter. Zo zie je goed of hij verdubbeld is.',
  'Dit schema is één van de vele die bestaan. Jouw starter mag trager of sneller gaan, en dat hangt vooral af van de temperatuur in de keuken.',
  'Drijftest: een theelepeltje starter in een glas water. Blijft het drijven, dan is hij klaar.',
  'Is de starter actief, dan kan hij gerust één of twee weken in de koelkast zonder dat je hem voedt. Hij gaat dan op een laag pitje.',
  'Wil je bakken? Haal hem de ochtend ervoor uit de koelkast, voed hem en laat hem op kamertemperatuur staan. Maak het deeg die avond.',
];

const step = (name: string, minutes: number, kind: 'hand' | 'wacht', opts: Partial<ProcessStep> = {}): ProcessStep => ({
  id: newId(),
  name,
  minutes,
  kind,
  workMinutes: kind === 'hand' ? opts.workMinutes ?? 5 : undefined,
  alarm: kind === 'hand',
  ...opts,
});

/** Eenvoudig pannenbrood: deeg 's avonds, een nacht op de keuken, 's ochtends bakken in een gietijzeren pan. */
export function panBreadSteps(): ProcessStep[] {
  return [
    step('Starter voeden', 600, 'hand', {
      workMinutes: 5,
      starterAction: 'voeden',
      feedRatio: '1:5:5',
      tip: 'Voed de starter in de ochtend en laat hem op kamertemperatuur staan tot je het deeg maakt.',
    }),
    step('Deeg maken: water, starter en zout, daarna het meel', 30, 'hand', {
      workMinutes: 20,
      tip: 'Meng eerst het water met de starter en het zout. Roer het meel er daarna door tot je een deegbol hebt. Mag nog wat plakkerig zijn. Het laatste stukje doe je met natte handen, dan plakt het minder. Gebruik meel van goede kwaliteit.',
    }),
    step('Deeg rust in dezelfde kom (met een vochtige theedoek erover)', 30, 'wacht'),
    step('Stretch & fold, dan laten rusten', 600, 'hand', {
      workMinutes: 5,
      tempSensitive: true,
      tip: 'Eén keer trekken en vouwen: pak een kant van het deeg, rek het omhoog en vouw het over het deeg heen. Draai de kom een kwartslag en herhaal rondom. Daarna een nacht op kamertemperatuur, met een licht vochtige theedoek erover. In een warme keuken gaat het sneller.',
    }),
    step("Stretch & fold, dan in het rijsmandje. Oven voorverwarmen op 230°, pan erin", 60, 'hand', {
      workMinutes: 15,
      tip: 'Nog één keer trekken en vouwen, dan het deeg een uurtje laten rusten in het rijsmandje onder de theedoek. Ondertussen verwarmt de oven voor op 230° met de gietijzeren pan erin.',
    }),
    step('Bakken met deksel', 30, 'hand', { workMinutes: 5, tip: 'Deeg in de hete gietijzeren pan, deksel erop.' }),
    step('Deksel eraf, verder bakken', 20, 'hand', { workMinutes: 1 }),
    step('Brood uit de pan, nog 5 minuten op het rooster in de oven', 5, 'hand', {
      workMinutes: 2,
      check: 'Dit was kort beschreven ("nog 5 min uit de pan, op het rooster"). Kijk na of het brood hier in de oven blijft.',
    }),
    step('Afkoelen', 60, 'wacht', { tip: 'Het moeilijkste deel: laat het brood minstens een uur afkoelen voor je het snijdt.' }),
  ];
}

export function panBreadRecipe(nowIso: string = new Date().toISOString()): Recipe {
  return {
    id: newId(),
    name: 'Pannenbrood met nachtrust',
    source: 'Voorbeeld in eigen woorden: pas de tijden aan je keuken aan',
    flours: [{ id: newId(), name: 'Bloem', grams: 500 }],
    waterG: 375,
    starterG: 60,
    starterHydration: 100,
    saltG: 11,
    process: panBreadSteps(),
    notes: 'Kies degelijke bloem. Een starter van ongeveer 60 g mag iets meer zijn. Bak het brood in een gietijzeren pan met deksel.',
    updatedAt: nowIso,
  };
}
