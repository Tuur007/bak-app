// Een brood- of zuurdesemrecept uit gewone tekst omzetten naar een recept met bakschema.
// De tekst komt van plakken of van "Tekst scannen" op de iPhone (een foto van de bladzijde).
//
// Twee soorten ingrediënten worden herkend:
//   - als zin:   "500 g tarwebloem"
//   - als tabel: "tarwebloem 680 88" onder een kop "Ingrediënten  gram  %" (zoals in Kometen Brood),
//                ook "water 500 + 60 73" (twee hoeveelheden) en een somrij ("meelmix 770 100", wordt overgeslagen).
//
// De bereiding wordt gelezen als genummerde stappen ("1 Maak ...", "2. Voeg ..."). Elke zin met een
// tijd wordt een stap; handwerk zonder tijd wordt samengevoegd; "Herhaal ... twee keer" herhaalt de
// vorige rust- en handstap. Het bakschema is een EERSTE VOORSTEL: wat geschat is, komt als waarschuwing
// terug. Getest in tests/recipeText.test.ts, ook op de echte tekst van het boek.

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
// tabelrij: naam, gram (eventueel "500 + 60") en een percentage
const TABLE_RE = new RegExp(`^\\s*(?:[-*•·–]\\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' \\-]*?)\\s+${NUM}(?:\\s*\\+\\s*${NUM})?\\s+${NUM}\\s*%?\\s*$`);
const HEADING_ING = /^\s*(ingredi[eë]nten|wat heb je nodig|benodigdheden)\b.*$/i;
const HEADING_STEPS = /^\s*(bereiding|bereidingswijze|werkwijze|instructies|methode|stappen|zo maak je het)\s*:?\s*$/i;
// "Kneden (ca. 4 uur)", "Rijzen (overnacht)": een kop met een opmerking tussen haakjes, zonder punt
const PHASE_HEADING = /^\s*[A-ZÀ-Ý][A-Za-zÀ-ÿ ]{2,30}\s*\([^)]*\)\s*$/;

const toNum = (s: string): number => Number(s.replace(',', '.'));
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const WORD_NUM: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6 };

/** Aantal minuten in een stuk tekst, of null. Bereiken ("4 tot 5 uur") nemen we het gemiddelde van. */
export function durationMinutes(text: string): { minutes: number; range: boolean; guessed: boolean } | null {
  const m = /(\d+(?:[.,]\d+)?)(?:\s*(?:tot|à|-|–|of)\s*(\d+(?:[.,]\d+)?))?\s*(minuten|minuut|min\b|uren|uur|u\b)/i.exec(text);
  if (m) {
    const unit = m[3].toLowerCase().startsWith('m') ? 1 : 60;
    const a = toNum(m[1]);
    const b = m[2] ? toNum(m[2]) : a;
    return { minutes: Math.round(((a + b) / 2) * unit), range: !!m[2] && b !== a, guessed: false };
  }
  if (/\b(hele nacht|een nacht|'s nachts|s nachts|overnacht|nachtje|volgende ochtend|volgende morgen|tot morgen)\b/i.test(text)) return { minutes: 720, range: false, guessed: true };
  if (/\b(een )?half ?uur(tje)?\b/i.test(text)) return { minutes: 30, range: false, guessed: false };
  if (/\been kwartier\b/i.test(text)) return { minutes: 15, range: false, guessed: false };
  const w = /\b(een|twee|drie|vier|vijf|zes|zeven|acht) (uur|uren)\b/i.exec(text);
  if (w) return { minutes: ({ ...WORD_NUM, zeven: 7, acht: 8 } as Record<string, number>)[w[1].toLowerCase()] * 60, range: false, guessed: false };
  return null;
}

function parseIngredientLine(line: string): { grams: number; rest: string } | null {
  const m = ING_RE.exec(line);
  if (!m) return null;
  const n = toNum(m[1]);
  const unit = m[2].toLowerCase().replace('.', '');
  const rest = m[3].trim().replace(/[.;,]\s*$/, '');
  if (unit === 'kg') return { grams: n * 1000, rest };
  if (unit === 'g' || unit === 'gr' || unit === 'gram' || unit === 'ml') return { grams: n, rest };
  if (unit === 'cl') return { grams: n * 10, rest };
  if (unit === 'dl') return { grams: n * 100, rest };
  if (unit === 'l') return { grams: n * 1000, rest };
  return { grams: 0, rest }; // el, tl: geen gram
}

// Uitleg of opmerking, geen handeling
const INFO = /^(na (de|het|elke)|het (brood|deeg) is|bak zo ook|let op|tip\b|dit |deze |zo |zie )/i;

const WAIT_WORDS = /\b(laat|laten|rijs|rijst|rijzen|rust|rusten|koelkast|afkoel\w*|wacht|staan|fermenteer\w*|proef|autolyse)\b/i;

function stepKind(text: string, minutes: number): 'hand' | 'wacht' {
  return WAIT_WORDS.test(text) && minutes >= 15 ? 'wacht' : 'hand';
}

/** Zinnen van een tekstblok. Afkortingen als "blz." en "ca." breken een zin niet af. */
function sentences(text: string): string[] {
  const flat = text.replace(/\s*\n\s*/g, ' ').replace(/\b(blz|ca|bv|nr|enz)\./gi, '$1').trim();
  return flat.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý'"])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Splits een zin in stukken met elk hoogstens één tijd ("bak 20 minuten met deksel en 25 minuten zonder").
 * Stukken zonder tijd worden bij het vorige gevoegd, met het scheidingsteken uit de tekst. Een
 * eenwoordstuk vooraan ("Bak daarna zonder deksel ...") wordt het werkwoord van het volgende stuk.
 */
function splitByDuration(sentence: string): string[] {
  const parts = sentence.split(/(\s*(?:,|;|\ben\b|\bdaarna\b|\bvervolgens\b|\bdan\b)\s+)/i);
  const out: string[] = [];
  let carry = '';
  for (let i = 0; i < parts.length; i += 2) {
    const piece = parts[i];
    const sep = i > 0 ? parts[i - 1] : '';
    if (!piece.trim()) continue;
    if (out.length === 0 && !durationMinutes(piece) && piece.trim().split(/\s+/).length === 1 && i + 2 < parts.length) {
      carry = `${piece.trim()} `;
      continue;
    }
    if (out.length > 0 && !durationMinutes(piece)) out[out.length - 1] += `${/en\b/i.test(sep) ? ' en ' : /,/.test(sep) ? ', ' : ' '}${piece}`;
    else { out.push(`${carry}${piece}`); carry = ''; }
  }
  if (out.length === 0 && carry) out.push(carry.trim());
  return out;
}

function shortName(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[.;,]\s*$/, '');
  const cut = t.split(/\s\(zie\b/i)[0];
  if (cut.length <= 70) return cap(cut);
  const w = cut.slice(0, 67).replace(/\s+\S*$/, '');
  return `${cap(w)}...`;
}

/** Genummerde stappen: de regels vanaf "1 Hoofdletter..." met oplopende nummers. */
function numberedBlocks(lines: string[]): { start: number; blocks: string[] } | null {
  const starts: number[] = [];
  let expect = 1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(\d{1,2})\s*[.)]?\s+(?=[A-ZÀ-Ý])/.exec(lines[i]);
    if (m && Number(m[1]) === expect) { starts.push(i); expect++; }
  }
  if (starts.length < 2) return null;
  const blocks = starts.map((st, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    return lines
      .slice(st, end)
      .filter((l) => !PHASE_HEADING.test(l))
      .join('\n')
      .replace(/^\s*\d{1,2}\s*[.)]?\s+/, '')
      .trim();
  });
  return { start: starts[0], blocks };
}

export function parseRecipeText(input: string): ParsedRecipe {
  const warnings: string[] = [];
  const ignored: string[] = [];
  const lines = input.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);

  // --- naam
  let name = '';
  const first = nonEmpty[0];
  if (first && first.length <= 60 && !ING_RE.test(first) && !HEADING_ING.test(first) && !HEADING_STEPS.test(first) && !/^\d+\s*[.)]/.test(first)) name = first.replace(/[:.]\s*$/, '');

  // --- secties
  const numbered = numberedBlocks(lines);
  const stepsAt = numbered ? numbered.start : lines.findIndex((l) => HEADING_STEPS.test(l));
  const ingLines = (stepsAt >= 0 ? lines.slice(0, stepsAt) : lines).filter(Boolean);
  const tableMode = ingLines.some((l) => /\bgram\b/i.test(l) && /%/.test(l));
  const stepSource: string[] = numbered
    ? numbered.blocks
    : [stepsAt >= 0 ? lines.slice(stepsAt + 1).join('\n') : lines.filter((l) => l && !ING_RE.test(l) && !HEADING_ING.test(l) && l !== name).join('\n')];

  // --- aantal broden
  const loaves = /voor\s+(\d+|twee|drie|vier)\s+broden?/i.exec(input);
  if (loaves) {
    const n = WORD_NUM[loaves[1].toLowerCase()] ?? Number(loaves[1]);
    if (n > 1) warnings.push(`Dit recept is voor ${n} broden. Wil je er minder bakken, schaal dan in het recept het deeggewicht.`);
  }

  // --- ingrediënten
  const flours: Flour[] = [];
  let waterG = 0;
  let starterG = 0;
  let saltG = 0;
  let starterHydration = 100;
  const addIngredient = (rest: string, grams: number, line: string): void => {
    const low = rest.toLowerCase();
    if (/starter|desem|levain|zuurdesem|zuurdeeg|moederdeeg/.test(low)) {
      starterG += grams;
      const h = /(\d+)\s*%\s*(?:hydratatie|water)/i.exec(line);
      if (h) starterHydration = Number(h[1]);
    } else if (/zout/.test(low)) {
      if (grams > 0) saltG += grams;
      else { ignored.push(line); warnings.push('Het zout staat in lepels. Vul het in gram in (ongeveer 6 g per afgestreken theelepel, maar weeg het liefst).'); }
    } else if (/\bwater\b/.test(low) && grams > 0) {
      waterG += grams;
    } else if (/(bloem|meel|volkoren|spelt|rogge|tarwe|durum|griesmeel)/.test(low) && grams > 0) {
      flours.push({ id: newId(), name: cap(rest.replace(/\s*\(.*?\)\s*$/, '').trim() || rest), grams });
    } else {
      ignored.push(line);
    }
  };
  for (const l of ingLines) {
    if (tableMode) {
      const t = TABLE_RE.exec(l);
      if (t) {
        const grams = toNum(t[2]) + (t[3] ? toNum(t[3]) : 0);
        const pct = toNum(t[4]);
        if (pct === 100) continue; // somrij ("meelmix 770 100"): niet nog eens meetellen
        addIngredient(t[1].trim(), grams, l);
        continue;
      }
    }
    const ing = parseIngredientLine(l);
    if (ing) addIngredient(ing.rest, ing.grams, l);
  }
  if (flours.length === 0) warnings.push('Ik vond geen meel in gram. Vul het meel zelf in.');
  if (waterG === 0) warnings.push('Ik vond geen water in gram of ml. Vul het water zelf in.');
  if (starterG === 0) warnings.push('Ik vond geen starter of desem in gram. Vul de starter zelf in.');
  if (saltG === 0 && !warnings.some((w) => w.startsWith('Het zout'))) warnings.push('Ik vond geen zout in gram. Vul het zout zelf in.');

  // --- stappen
  const process: ProcessStep[] = [];
  let guessedHand = 0;
  let guessedWait = 0;
  let ranges = 0;
  let nights = 0;
  let repeated = 0;

  const push = (text: string, minutes: number, kind: 'hand' | 'wacht', detail: string, extra?: { guessed?: boolean }): ProcessStep => {
    const rise = kind === 'wacht' && /(rijs|rijz|bulk)/i.test(text) && !/koelkast/i.test(text);
    const step: ProcessStep = {
      id: newId(),
      name: shortName(text),
      minutes,
      kind,
      workMinutes: kind === 'hand' ? Math.min(minutes, /bak|oven/i.test(text) ? 5 : 10) : undefined,
      tempSensitive: rise || undefined,
      detail: detail.length > 0 ? detail : undefined,
      alarm: kind === 'hand',
    };
    process.push(step);
    if (extra?.guessed) (kind === 'hand' ? guessedHand++ : guessedWait++);
    return step;
  };

  for (const block of stepSource) {
    const detail = block.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const startIndex = process.length;
    let plainMade = false; // dit blok heeft al een handstap zonder tijd
    for (const sentence of sentences(block)) {
      // 1. "Herhaal deze handeling nog twee keer": herhaal wat in dit blok al is gemaakt
      const rep = /herhaal[^.]*?\b(een|twee|drie|vier|vijf|\d+)\s*(?:keer|maal|x)\b/i.exec(sentence);
      if (rep) {
        const n = WORD_NUM[rep[1].toLowerCase()] ?? Number(rep[1]);
        const cycle = process.slice(startIndex);
        for (let k = 0; k < n && cycle.length > 0; k++) {
          for (const c of cycle) process.push({ ...c, id: newId() });
        }
        repeated += n;
        plainMade = true;
        continue;
      }
      // 2. zin met een tijd (of meerdere): stap(pen)
      const d = durationMinutes(sentence);
      if (d) {
        let prevVerb = '';
        for (const chunk of splitByDuration(sentence)) {
          let text = chunk.replace(/\s+/g, ' ').trim().replace(/[.;,]\s*$/, '');
          if (!text) continue;
          if (/^\d/.test(text) && prevVerb) text = `${prevVerb} ${text}`;
          prevVerb = /^[A-Za-zÀ-ÿ]+$/.test(text.split(' ')[0]) ? text.split(' ')[0] : prevVerb;
          const dc = durationMinutes(text);
          if (!dc) {
            // stuk zonder tijd vóór de tijd: handwerk, samengevoegd met het vorige handwerk
            if (!plainMade && !INFO.test(text)) { push(text, 5, 'hand', detail, { guessed: true }); plainMade = true; }
            continue;
          }
          if (dc.range) ranges++;
          if (dc.guessed) nights++;
          const kind = stepKind(text, dc.minutes);
          push(text, dc.minutes, kind, detail);
          if (kind === 'wacht') plainMade = false;
        }
        continue;
      }
      // 3. voorverwarmen of "laat ... heet worden": geen tijd in het recept
      if (/voorverwarm|heet worden/i.test(sentence) && /laat|heet worden/i.test(sentence)) {
        push('Wachten tot de oven en de pan heet zijn', 45, 'wacht', detail, { guessed: true });
        warnings.push('Het voorverwarmen heeft geen tijd in het recept. Ik rekende 45 minuten; pas aan naar je oven.');
        plainMade = false;
        continue;
      }
      // 4. wachten tot iets klaar is, zonder tijd ("laat rusten totdat het aan is")
      if (/\b(totdat|tot)\b/i.test(sentence) && WAIT_WORDS.test(sentence)) {
        push(sentence, 60, 'wacht', detail, { guessed: true });
        warnings.push('Bij "totdat het deeg klaar is" staat geen tijd. Ik rekende 60 minuten; jij kijkt naar het deeg.');
        plainMade = false;
        continue;
      }
      // 5. gewone handeling: één handstap per blok (de eerste, langste zin geeft de naam)
      if (!plainMade && /^[A-ZÀ-Ý]/.test(sentence) && sentence.length >= 25 && !INFO.test(sentence)) {
        push(sentence, 5, 'hand', detail, { guessed: true });
        plainMade = true;
      }
    }
  }

  if (process.length === 0) warnings.push('Ik vond geen stappen. Plak ook de bereiding, of voeg de stappen zelf toe.');
  if (guessedHand > 0) warnings.push(`Voor ${guessedHand} ${guessedHand === 1 ? 'handeling' : 'handelingen'} zonder tijd rekende ik 5 minuten. Pas aan waar nodig.`);
  if (ranges > 0) warnings.push('Bij een tijd als "15 à 20 minuten" nam ik het midden. Kijk of dat past.');
  if (nights > 0) warnings.push('"Een nacht" of "tot de volgende ochtend" telt voor mij als 12 uur. Pas aan naar wat jij doet.');
  if (repeated > 0) warnings.push('"Herhaal ..." heb ik uitgeschreven als herhaalde stappen. Kijk of het aantal klopt.');
  if (process.length > 0) warnings.push('Controleer de tijden en de volgorde: dit is een voorstel uit de tekst, geen zekerheid.');

  return { name, flours, waterG, starterG, starterHydration, saltG, process, warnings: Array.from(new Set(warnings)), ignored };
}
