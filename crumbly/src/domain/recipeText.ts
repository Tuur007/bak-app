// Een brood- of zuurdesemrecept uit gewone tekst omzetten naar een recept met bakschema.
// De tekst komt van plakken of van "Tekst scannen" op de iPhone (een foto van de bladzijde).
//
// Ingrediënten worden betrouwbaar herkend (hoeveelheid + eenheid + naam). Het bakschema is een
// EERSTE VOORSTEL: elke zin met een tijd wordt een stap, en alles wat geschat is, komt als
// waarschuwing terug zodat de gebruiker het nakijkt. Getest in tests/recipeText.test.ts.

import { newId } from './ids';
import type { Flour, ProcessStep } from './types';

export interface ParsedRecipe {
  name: string;
  flours: Flour[];
  waterG: number;
  starterG: number;
  starterHydration: number;
  saltG: number;
  process: ProcessStep[];
  /** Wat de gebruiker moet nakijken. */
  warnings: string[];
  /** Ingrediënten die we niet herkenden (zaden, melk, ...). */
  ignored: string[];
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const ING_RE = new RegExp(`^\\s*(?:[-*•·–]\\s*)?${NUM}\\s*(kg|gram|gr\\.?|g|ml|dl|cl|l|el|tl|eetlepels?|theelepels?|koffielepels?)(?![a-zà-ÿ])\\.?\\s*(?:van\\s+(?:de|het|een)\\s+)?(.+)$`, 'i');
const HEADING_ING = /^\s*(ingredi[eë]nten|wat heb je nodig|benodigdheden)\s*:?\s*$/i;
const HEADING_STEPS = /^\s*(bereiding|bereidingswijze|werkwijze|instructies|methode|stappen|zo maak je het)\s*:?\s*$/i;

/** Is dit een zin uit de bereiding (met een tijd) en geen ingrediënt? Voorkomt valse waarschuwingen. */
const stepsAt_isStep = (l: string): boolean => durationMinutes(l) !== null && /\b(laat|bak|meng|vouw|rust|rijs|verwarm)\w*/i.test(l);

const toNum = (s: string): number => Number(s.replace(',', '.'));

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/** "1½ dl", "½ kg" en "1/2 theelepel" worden "1.5 dl", "0.5 kg" en "0.5 theelepel". */
export function normalizeNumbers(text: string): string {
  const round = (n: number): string => String(Math.round(n * 1000) / 1000);
  return text
    .replace(/(?:(\d+)\s?)?([½¼¾⅓⅔⅛])/g, (_m, whole: string | undefined, f: string) => round((whole ? Number(whole) : 0) + FRACTIONS[f]))
    .replace(/(^|[^\d/.,])(\d+)\s*\/\s*(\d+)(?=\s*(?:kg|gram|gr|g|ml|dl|cl|l|el|tl|eetlepels?|theelepels?|koffielepels?|kopjes?|kop)(?![a-zà-ÿ]))/gi, (_m, pre: string, a: string, b: string) => (Number(b) > 0 ? pre + round(Number(a) / Number(b)) : _m));
}
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Aantal minuten in een stuk tekst, of null. Bereiken ("4 tot 5 uur") nemen we het gemiddelde van. */
export function durationMinutes(text: string): { minutes: number; range: boolean; guessed: boolean } | null {
  // "1 uur en 30 minuten", "1u30", "1 u 30"
  const comp = /(\d+(?:[.,]\d+)?)\s*(?:uur|uren|u)\s*(?:en\s*)?(\d{1,2})\s*(?:minuten|minuut|min\b)?(?![\d])/i.exec(text);
  if (comp && (/\b(minuten|minuut|min)\b/i.test(comp[0]) || /u\s*\d{2}\b/i.test(comp[0]))) {
    return { minutes: Math.round(toNum(comp[1]) * 60 + Number(comp[2])), range: false, guessed: false };
  }
  if (/\banderhalf\s*uur\b/i.test(text)) return { minutes: 90, range: false, guessed: false };
  const m = /(\d+(?:[.,]\d+)?)(?:\s*(?:tot|à|-|–|of)\s*(\d+(?:[.,]\d+)?))?\s*(minuten|minuut|min\b|uren|uur|u\b)/i.exec(text);
  if (m) {
    const unit = m[3].toLowerCase().startsWith('m') ? 1 : 60;
    const a = toNum(m[1]);
    const b = m[2] ? toNum(m[2]) : a;
    return { minutes: Math.round(((a + b) / 2) * unit), range: !!m[2] && b !== a, guessed: false };
  }
  if (/\b(hele nacht|een nacht|'s nachts|s nachts|overnacht|nachtje)\b/i.test(text)) return { minutes: 720, range: false, guessed: true };
  if (/\b(een )?half ?uur(tje)?\b/i.test(text)) return { minutes: 30, range: false, guessed: false };
  if (/\been kwartier\b/i.test(text)) return { minutes: 15, range: false, guessed: false };
  const words: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8 };
  const w = /\b(een|twee|drie|vier|vijf|zes|zeven|acht) (uur|uren)\b/i.exec(text);
  if (w) return { minutes: words[w[1].toLowerCase()] * 60, range: false, guessed: false };
  return null;
}

// "Bloem 500 g", "Water: 350 ml", "bloem T65 500 g (bio)": de hoeveelheid staat achter de naam.
const ING_NAME_FIRST_RE = new RegExp(`^\\s*(?:[-*•·–]\\s*)?([a-zà-ÿ][^\\d]*?(?:\\s+[a-zà-ÿ]+\\d+[a-zà-ÿ]*)?)\\s*[:\\-–]?\\s*(?<![\\d.,])${NUM}\\s*(kg|gram|gr\\.?|g|ml|dl|cl|l|el|tl|eetlepels?|theelepels?|koffielepels?)(?![a-zà-ÿ])\\.?\\s*(\\(.*?\\))?\\s*$`, 'i');

export function parseIngredientLine(rawLine: string): { grams: number; rest: string; unit: string } | null {
  const line = normalizeNumbers(rawLine);
  let m = ING_RE.exec(line);
  let nameFirst = false;
  if (!m) {
    const nf = ING_NAME_FIRST_RE.exec(line);
    if (!nf) return null;
    nameFirst = true;
    m = [nf[0], nf[2], nf[3], `${nf[1].trim()}${nf[4] ? ` ${nf[4]}` : ''}`] as unknown as RegExpExecArray;
  }
  void nameFirst;
  const n = toNum(m[1]);
  const unit = m[2].toLowerCase().replace('.', '');
  const rest = m[3].trim().replace(/[.;,]\s*$/, '');
  if (/^(kg)$/.test(unit)) return { grams: n * 1000, rest, unit };
  if (/^(g|gr|gram)$/.test(unit)) return { grams: n, rest, unit };
  if (unit === 'ml') return { grams: n, rest, unit };
  if (unit === 'cl') return { grams: n * 10, rest, unit };
  if (unit === 'dl') return { grams: n * 100, rest, unit };
  if (unit === 'l') return { grams: n * 1000, rest, unit };
  return { grams: 0, rest, unit }; // el, tl: geen gram
}

const WAIT_WORDS = /\b(laat|laten|rijs|rijst|rijzen|rust|rusten|koelkast|afkoel\w*|wacht|staan|fermenteer\w*|proef|autolyse)\b/i;

function stepKind(text: string, minutes: number): 'hand' | 'wacht' {
  return WAIT_WORDS.test(text) && minutes >= 15 ? 'wacht' : 'hand';
}

function splitSentences(text: string): string[] {
  // Genummerde stappen? Dan is elk nummer een stap (ook als de regels midden in een zin breken).
  if (/(^|\n)\s*\d+\s*[.)]\s+\S/.test(text)) {
    return text
      .split(/\n\s*(?=\d+\s*[.)]\s+\S)/)
      .map((s) => s.replace(/^\s*\d+\s*[.)]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
  }
  const flat = text.replace(/\s*\n\s*/g, ' ').trim();
  return flat.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/).map((s) => s.trim()).filter(Boolean);
}

/** Splits een zin met meer dan één tijd ("bak 20 minuten met deksel en 25 minuten zonder") in stukken met elk één tijd. */
function splitByDuration(sentence: string): string[] {
  // "1 uur en 30 minuten" is één tijd: de 'en' mag daar niet splitsen.
  const KEEP = '\u0001';
  const protectedText = sentence.replace(/(\d+(?:[.,]\d+)?\s*(?:uur|uren|u))\s+en\s+(?=\d)/gi, `$1${KEEP}`);
  const pieces = protectedText.split(/\s*(?:,|;|\ben\b|\bdaarna\b|\bvervolgens\b|\bdan\b)\s+/i).filter(Boolean).map((p) => p.split(KEEP).join(' en '));
  const out: string[] = [];
  for (const p of pieces) {
    if (out.length > 0 && !durationMinutes(p)) out[out.length - 1] += ` en ${p}`;
    else out.push(p);
  }
  // "Laat daarna 2 uur rijzen": het werkwoord alleen ('Laat') is geen eigen stap, plak het aan het volgende stuk.
  if (out.length >= 2 && !durationMinutes(out[0]) && out[0].trim().split(/\s+/).length <= 2 && durationMinutes(out[1])) {
    out.splice(0, 2, `${out[0]} ${out[1]}`);
  }
  return out;
}

const COUNT_WORDS: Record<string, number> = { twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6 };

/** "Vouw het deeg 4 keer, elk half uur" -> 4 vouwstappen met elk een half uur ertussen. Null als de zin zo niet is. */
function repeatedSteps(sentence: string): { name: string; times: number; every: number } | null {
  const m = /^(.*?)\b(\d+|twee|drie|vier|vijf|zes)\s*(?:keer|maal|x)\b[\s,;]*(?:(?:en\s+)?(?:telkens|steeds)\s+)?(?:elk|elke|om de|iedere|per)\s+(.+)$/i.exec(sentence.replace(/[.;,]\s*$/, ''));
  if (!m) return null;
  const times = /^\d+$/.test(m[2]) ? Number(m[2]) : COUNT_WORDS[m[2].toLowerCase()];
  const every = durationMinutes(m[3]);
  if (!every || !times || times < 2 || times > 8) return null;
  const name = m[1].trim().replace(/[,;]$/, '').trim();
  return name ? { name, times, every: every.minutes } : null;
}

export function parseRecipeText(input: string): ParsedRecipe {
  const warnings: string[] = [];
  const ignored: string[] = [];
  const lines = input.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);

  // --- naam
  let name = '';
  const first = nonEmpty[0];
  if (first && first.length <= 60 && !parseIngredientLine(first) && !HEADING_ING.test(first) && !HEADING_STEPS.test(first) && !/^\d+\s*[.)]/.test(first)) name = first.replace(/[:.]\s*$/, '');

  // --- secties
  const stepsAt = lines.findIndex((l) => HEADING_STEPS.test(l));
  const ingLines = (stepsAt >= 0 ? lines.slice(0, stepsAt) : lines).filter(Boolean);
  const stepText = stepsAt >= 0
    ? lines.slice(stepsAt + 1).join('\n')
    : lines.filter((l) => l && !parseIngredientLine(l) && !HEADING_ING.test(l) && l !== name).join('\n');

  // --- ingrediënten
  const flours: Flour[] = [];
  let waterG = 0;
  let starterG = 0;
  let saltG = 0;
  let starterHydration = 100;
  for (const l of ingLines) {
    const ing = parseIngredientLine(l);
    if (!ing) {
      // Een hoeveelheid in een eenheid die we niet kennen (kopjes, cups, snufje): niet stil overslaan.
      if (/^\s*(?:[-*•·–]\s*)?(?:\d|[½¼¾])/.test(l) && /(bloem|meel|water|zout|starter|desem|levain)/i.test(l) && !stepsAt_isStep(l)) {
        ignored.push(l);
        warnings.push(`"${l.trim()}" staat niet in gram of ml. Wissel het om en vul het zelf in.`);
      }
      continue;
    }
    const low = ing.rest.toLowerCase();
    if (/starter|desem|levain|zuurdesem|zuurdeeg|moederdeeg/.test(low)) {
      starterG += ing.grams;
      const h = /(\d+)\s*%\s*(?:hydratatie|water)/i.exec(l);
      if (h) starterHydration = Number(h[1]);
    } else if (/\bzout\b/.test(low)) {
      if (ing.grams > 0) saltG += ing.grams;
      else { ignored.push(l); warnings.push('Het zout staat in lepels. Vul het in gram in (ongeveer 6 g per afgestreken theelepel, maar weeg het liefst).'); }
    } else if (/\bwater\b/.test(low) && ing.grams > 0) {
      waterG += ing.grams;
    } else if (/(bloem|meel|volkoren|spelt|rogge|tarwe|durum|griesmeel)/.test(low) && ing.grams > 0) {
      flours.push({ id: newId(), name: cap(ing.rest.replace(/\s*\(.*?\)\s*$/, '').trim() || ing.rest), grams: ing.grams });
    } else {
      ignored.push(l);
    }
  }
  if (flours.length === 0) warnings.push('Ik vond geen meel in gram. Vul het meel zelf in.');
  if (waterG === 0) warnings.push('Ik vond geen water in gram of ml. Vul het water zelf in.');
  if (starterG === 0) warnings.push('Ik vond geen starter of desem in gram. Vul de starter zelf in.');
  if (saltG === 0 && !warnings.some((w) => w.startsWith('Het zout'))) warnings.push('Ik vond geen zout in gram. Vul het zout zelf in.');

  // --- stappen
  const process: ProcessStep[] = [];
  let guessedTimes = 0;
  let ranges = 0;
  let nights = 0;
  let waitsWithoutTime = 0;
  let repeats = 0;
  for (const sentence of splitSentences(stepText)) {
    const rep = repeatedSteps(sentence);
    if (rep) {
      repeats++;
      for (let i = 1; i <= rep.times; i++) {
        process.push({ id: newId(), name: cap(`${rep.name} (${i} van ${rep.times})`), minutes: rep.every, kind: 'hand', workMinutes: 5, alarm: true, check: `Herhaling uit "${sentence.replace(/[.;,]\s*$/, '')}": controleer het aantal en de tijd ertussen.` });
      }
      continue;
    }
    const chunks = splitByDuration(sentence);
    let prevVerb = '';
    for (const chunk of chunks) {
      let text = chunk.replace(/\s+/g, ' ').trim().replace(/[.;,]\s*$/, '');
      if (!text) continue;
      // Een stuk dat met een getal begint ("25 minuten zonder") erft het werkwoord van het vorige stuk.
      if (/^\d/.test(text) && prevVerb) text = `${prevVerb} ${text}`;
      prevVerb = /^[A-Za-zÀ-ÿ]+$/.test(text.split(' ')[0]) ? text.split(' ')[0] : prevVerb;
      const d = durationMinutes(text);
      // Een stap die wacht maar geen tijd noemt ("laat het deeg rijzen tot het verdubbeld is") is geen handstap van
      // 5 minuten met een wekker: het is een wachtstap met een voorlopige tijd die de gebruiker invult.
      const waitsNoTime = !d && /\b(laat|laten|rijs|rijst|rijzen|rust|rusten|staan|fermenteer\w*)\b/i.test(text);
      const minutes = d ? d.minutes : waitsNoTime ? 60 : 5;
      if (!d) guessedTimes++;
      if (waitsNoTime) waitsWithoutTime++;
      if (d?.range) ranges++;
      if (d?.guessed) nights++;
      const kind = d ? stepKind(text, minutes) : waitsNoTime ? 'wacht' : 'hand';
      const rise = kind === 'wacht' && /(rijs|rijz|bulk)/i.test(text) && !/koelkast/i.test(text);
      const check = waitsNoTime
        ? 'Geen tijd in het recept: vul zelf in hoe lang dit duurt (ik zette 1 uur).'
        : !d
          ? 'Geen tijd in het recept: ik zette 5 minuten.'
          : d.range
            ? 'Het recept geeft een bereik: ik nam het midden.'
            : d.guessed
              ? '"Een nacht" telt als 12 uur: pas aan naar wat jij doet.'
              : undefined;
      process.push({
        id: newId(),
        name: cap(text.length > 70 ? `${text.slice(0, 67)}...` : text),
        minutes,
        kind,
        workMinutes: kind === 'hand' ? Math.min(minutes, /bak|oven/i.test(text) ? 5 : 10) : undefined,
        tempSensitive: rise || undefined,
        alarm: kind === 'hand',
        ...(check ? { check } : {}),
      });
    }
    if (/vouw/i.test(sentence) && splitByDuration(sentence).length > 1) warnings.push('Controleer het vouwschema: vouwmomenten en rijstijd overlappen vaak.');
  }
  if (process.length === 0) warnings.push('Ik vond geen stappen. Plak ook de bereiding, of voeg de stappen zelf toe.');
  if (waitsWithoutTime > 0) warnings.push(`${waitsWithoutTime} ${waitsWithoutTime === 1 ? 'wachtstap noemt' : 'wachtstappen noemen'} geen tijd ("laat rijzen tot het verdubbeld is"). Ik zette er voorlopig 1 uur bij: vul de echte tijd in, anders klopt je schema niet.`);
  if (guessedTimes - waitsWithoutTime > 0) warnings.push(`${guessedTimes - waitsWithoutTime} ${guessedTimes - waitsWithoutTime === 1 ? 'stap had' : 'stappen hadden'} geen tijd. Ik zette er 5 minuten bij; pas aan waar nodig.`);
  if (repeats > 0) warnings.push('Een herhaling ("4 keer, elk half uur") werd meerdere stappen. Controleer het aantal en de tijden.');
  if (ranges > 0) warnings.push('Bij een tijd als "4 tot 5 uur" nam ik het midden. Kijk of dat past.');
  if (nights > 0) warnings.push('"Een nacht" telt voor mij als 12 uur. Pas aan naar wat jij doet.');
  if (process.length > 0) warnings.push('Controleer de tijden en de volgorde: dit is een voorstel uit de tekst, geen zekerheid.');

  return { name, flours, waterG, starterG, starterHydration, saltG, process, warnings: Array.from(new Set(warnings)), ignored };
}
