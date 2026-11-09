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
  /** Uitleg uit de bereiding die geen stap is ("het brood is gaar als ..."): komt in de notities van het recept. */
  notes: string[];
  /** "Bulk 4 uur bij 24 °C": de temperatuur waarbij de tijden van het recept gelden. */
  refTempC?: number;
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const ING_RE = new RegExp(`^\\s*(?:[-*•·–]\\s*)?${NUM}\\s*(kg|gram|gr\\.?|g|ml|dl|cl|l|el|tl|eetlepels?|theelepels?|koffielepels?)(?![a-zà-ÿ])\\.?\\s*(?:van\\s+(?:de|het|een)\\s+)?(.+)$`, 'i');
const HEADING_ING = /^\s*(ingredi[eë]nten|wat heb je nodig|benodigdheden)\b[^.]{0,24}$/i;
/** Een kolomkop "gram" (bv. "Ingrediënten gram %"): dan staan de hoeveelheden in gram zonder eenheid per regel. */
const TABLE_GRAMS = /^\s*(?:ingredi[eë]nten\s+)?(?:gram|gr|g)\b\s*(?:%|procent)?\s*$/i;
/** Een subtotaal in een tabel ("meelmix 770 100") is geen extra meel. */
const SUBTOTAL = /^(meelmix|meelmengsel|totaal|totaal deeg|deeg|deeggewicht)$/i;
/** "500 + 60" -> 560 (water in twee keer toevoegen). */
const sumPlus = (text: string): string => text.replace(/(\d+(?:[.,]\d+)?)(?:\s*\+\s*(\d+(?:[.,]\d+)?))+/g, (m) => String(m.split('+').reduce((a, x) => a + Number(x.trim().replace(',', '.')), 0)));
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
  if (/\b(hele nacht|een nacht|'s nachts|s nachts|overnacht|nachtje|volgende ochtend|tot de volgende dag)\b/i.test(text)) return { minutes: 720, range: false, guessed: true };
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
  const line = sumPlus(normalizeNumbers(rawLine));
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

const WAIT_WORDS = /\b(laat|laten|rijs|rijst|rijzen|rust|rusten|koelkast|afkoel\w*|wacht|staan|fermenteer\w*|proef|autolyse|bulk\w*)\b/i;
/** Een wachtstap zonder tijd ("laat rijzen tot het verdubbeld is"): enkel met woorden over rijzen of rusten. Een losse
 * "laat" is te weinig ("laat de pan door en door heet worden" is geen wachtstap). */
const WAIT_NO_TIME = /\b(rijs|rijst|rijzen|rust|rusten|staan|fermenteer\w*|bulk\w*)\b/i;
const PREHEAT = /\b(voorverwarm\w*|verwarm\w*\b.*\boven\b)/i;
/** Een zin die met een opdracht begint ("Meng", "Vorm", "Laat", ...). Andere zinnen zonder tijd zijn uitleg. */
const IMPERATIVE = /^(meng|mix|voeg|kneed|vorm|vouw|bol|verdeel|stort|leg|zet|haal|bak|verwarm|score|kerf|snij|snijd|spuit|besproei|doe|dek|bedek|giet|strooi|bestuif|keer|draai|laat|weeg|roer|neem|maak|verwijder|wacht|rek|plaats|smeer|klop|schep|controleer|kijk|duw|druk|knijp|was|vet)\b/i;
const PREHEAT_MINUTES = 45;
const NAME_MAX = 80;

/** "1 Maak", "1. Meng", "1) Laat": een genummerde stap (de eerste). */
const NUMBERED_FIRST = /^\s*1\s*[.)]?\s+[A-ZÀ-Ý]/;
const NUMBERED_SPLIT = /\n\s*(?=\d+\s*[.)]?\s+[A-ZÀ-Ý])/;
const NUMBERED_ANY = /(^|\n)\s*\d+\s*[.)]?\s+[A-ZÀ-Ý]/;

/** Een tussenkop in de bereiding ("Kneden (ca. 4 uur)", "Rijzen (overnacht)", "Bakken (volgende dag)"): geen stap. */
function isSectionHeading(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 40 || /^\d/.test(l) || /[.!?:;]$/.test(l)) return false;
  return /^(kneden|mengen|deeg maken|rijzen|narijzen|bulk\w*|vormen|bakken|afbakken|de bulk|het bakken|voorbereiding|starter|levain|desem)\b/i.test(l);
}

/** "tarwebloem 680 88" onder een kolom "gram": 680 gram (de tweede kolom is het bakkerspercentage). */
function parseTableLine(rawLine: string): { grams: number; rest: string; unit: string } | null {
  const m = /^\s*(?:[-*•·–]\s*)?([a-zà-ÿ][a-zà-ÿ'’\s-]*?)\s+(\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)*)(?:\s+\d+(?:[.,]\d+)?\s*%?)?\s*$/i.exec(rawLine);
  if (!m) return null;
  const grams = Number(sumPlus(m[2]).replace(',', '.'));
  return Number.isFinite(grams) && grams > 0 ? { grams, rest: m[1].trim(), unit: 'g' } : null;
}

function stepKind(text: string, minutes: number): 'hand' | 'wacht' {
  return WAIT_WORDS.test(text) && minutes >= 15 ? 'wacht' : 'hand';
}

/** Genummerde stappen worden alinea's (ook als de regels midden in een zin breken); anders is de hele tekst één alinea. */
function paragraphs(rawText: string): { text: string; numbered: boolean }[] {
  // Afgebroken woorden van een gescande bladzijde ("kamer-\ntemperatuur") weer aan elkaar.
  const text = rawText.replace(/([a-zà-ÿ])-\s*\n\s*(?=[a-zà-ÿ])/g, '$1');
  if (NUMBERED_ANY.test(text)) {
    return text
      .split(NUMBERED_SPLIT)
      .map((s) => s.replace(/^\s*\d+\s*[.)]?\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
      .map((t) => ({ text: t, numbered: true }));
  }
  const flat = text.replace(/\s*\n\s*/g, ' ').trim();
  return flat ? [{ text: flat, numbered: false }] : [];
}

function sentencesOf(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý(])/).map((s) => s.trim()).filter(Boolean);
}

/** Verwijzingen ("(zie handtechniek ... op blz. 71)", "(zie hiernaast)") horen niet in de naam van een stap. */
const tidy = (s: string): string => s.replace(/\s*\(zie[^)]*\)/gi, '').replace(/\s+/g, ' ').trim();

function stepName(text: string): string {
  const t = tidy(text).split(';')[0].replace(/[.;,]\s*$/, '').trim();
  return cap(t.length > NAME_MAX ? `${t.slice(0, NAME_MAX - 3)}...` : t);
}

/**
 * Splits een zin in stukken met elk hoogstens één tijd ("bak 20 minuten met deksel en 25 minuten zonder"). Stukken zonder
 * tijd hangen aan het vorige stuk; een begin zonder tijd ("Meng bloem en water") blijft een eigen stuk. De oorspronkelijke
 * leestekens blijven staan.
 */
function splitByDuration(sentence: string): string[] {
  // "1 uur en 30 minuten" is één tijd: de 'en' mag daar niet splitsen.
  const KEEP = '\u0001';
  const protectedText = sentence.replace(/(\d+(?:[.,]\d+)?\s*(?:uur|uren|u))\s+en\s+(?=\d)/gi, `$1${KEEP}`);
  const tokens = protectedText.split(/(\s*(?:,|;|\ben\b|\bdaarna\b|\bvervolgens\b|\bdan\b)\s+)/i).map((p) => p.split(KEEP).join(' en '));
  const out: string[] = [];
  let sep = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 1) { sep = t; continue; }
    if (!t) continue;
    const has = !!durationMinutes(t);
    const prevHas = out.length > 0 && !!durationMinutes(out[out.length - 1]);
    if (out.length > 0 && (!has || !prevHas)) {
      // zonder tijd: bij het vorige stuk. Met tijd na een begin zonder tijd: eigen stuk (actie, dan wachten).
      if (!has) out[out.length - 1] += `${sep}${t}`;
      else out.push(t);
    } else out.push(t);
  }
  // "Laat daarna 2 uur rijzen": een los "Laat" is geen eigen stap, plak het aan het volgende stuk.
  if (out.length >= 2 && /^(laat|laten)\b/i.test(out[0].trim()) && !durationMinutes(out[0]) && out[0].trim().split(/\s+/).length <= 2 && durationMinutes(out[1])) {
    const glue = /\bdaarna\b/i.test(sentence) && !/daarna/i.test(out[0]) ? ' daarna ' : ' ';
    out.splice(0, 2, `${out[0]}${glue}${out[1]}`);
  }
  return out;
}

const COUNT_WORDS: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6 };
const countOf = (s: string): number => (/^\d+$/.test(s) ? Number(s) : COUNT_WORDS[s.toLowerCase()] ?? 0);

/** "Vouw het deeg 4 keer, elk half uur" -> 4 vouwstappen met elk een half uur ertussen. Null als de zin zo niet is. */
function repeatedSteps(sentence: string): { name: string; times: number; every: number } | null {
  const m = /^(.*?)\b(\d+|twee|drie|vier|vijf|zes)\s*(?:keer|maal|x)\b[\s,;]*(?:(?:en\s+)?(?:telkens|steeds)\s+)?(?:elk|elke|om de|om het|iedere|per)\s+(.+)$/i.exec(sentence.replace(/[.;,]\s*$/, ''));
  if (!m) return null;
  const times = countOf(m[2]);
  const every = durationMinutes(m[3]);
  if (!every || !times || times < 2 || times > 8) return null;
  const name = m[1].trim().replace(/[,;]$/, '').trim();
  return name ? { name, times, every: every.minutes } : null;
}

/** "Bulk 4 à 5 uur, met 4 keer stretch and fold om het halfuur": de vouwmomenten vallen BINNEN de bulk. */
function foldsInBulk(sentence: string): { bulkName: string; bulk: number; what: string; times: number; every: number } | null {
  const m = /^(.*?)\b(\d+|twee|drie|vier|vijf|zes)\s*(?:keer|maal|x)\s+(.+?)\s+(?:elk|elke|om de|om het|iedere|per)\s+(.+)$/i.exec(sentence.replace(/[.;]\s*$/, ''));
  if (!m) return null;
  const pre = m[1].replace(/[\s,;]*(met|en|waarbij|tijdens)?\s*$/i, '').trim();
  const bulk = durationMinutes(pre);
  const every = durationMinutes(m[4]);
  const times = countOf(m[2]);
  if (!bulk || !every || times < 1 || times > 8 || bulk.minutes <= times * every.minutes) return null;
  return { bulkName: pre, bulk: bulk.minutes, what: m[3].trim(), times, every: every.minutes };
}

/** "bij 24 °C" in een zin over rijzen: de temperatuur waarbij de tijden van het recept gelden. */
function findRefTemp(text: string): number | undefined {
  for (const sentence of text.replace(/\s*\n\s*/g, ' ').split(/(?<=[.!?;])\s+/)) {
    if (!/(rijs|rijz|bulk|ferment|kamertemperatuur|rust)/i.test(sentence)) continue;
    const m = /\bbij\s*(\d{2})(?:[.,]\d)?\s*(?:°\s*c?|graden)/i.exec(sentence);
    if (m) {
      const t = Number(m[1]);
      if (t >= 15 && t <= 32) return t;
    }
  }
  return undefined;
}

interface Built { process: ProcessStep[]; warnings: string[]; notes: string[] }

function buildSteps(text: string): Built {
  const process: ProcessStep[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  let ranges = 0;
  let nights = 0;
  let waitsWithoutTime = 0;
  let repeats = 0;
  let estimated = 0;
  let preheats = 0;
  let twoLoaves = false;
  let bulkFolds = 0;
  const hand = (name: string, minutes: number, work: number, extra: Partial<ProcessStep> = {}): ProcessStep =>
    ({ id: newId(), name: stepName(name), minutes, kind: 'hand', workMinutes: work, alarm: true, ...extra });

  for (const para of paragraphs(text)) {
    const paraStart = process.length;
    let blockStart = paraStart;
    // Een handstap zonder eigen tijd in deze alinea: volgende handelingen zonder tijd horen erbij (één wekker, niet vijf).
    let open: { step: ProcessStep; sentence: number; preheat: boolean } | null = null;
    const sentences = sentencesOf(para.text);
    for (let si = 0; si < sentences.length; si++) {
      const clean = tidy(sentences[si]);
      if (!clean) continue;
      if (/\bzo ook\b.*\bander\w*\b|\btweede brood\b/i.test(clean) && !durationMinutes(clean)) {
        twoLoaves = true;
        notes.push(clean);
        continue;
      }
      // "Herhaal deze handeling nog twee keer": de stappen van deze alinea (of de laatste handeling) nog zoveel keer.
      const rep = /\bherhaal\b[^.]*?\b(?:nog\s+)?(\d+|een|twee|drie|vier|vijf)\s*(?:keer|maal)\b/i.exec(clean);
      if (rep && !durationMinutes(clean)) {
        const n = countOf(rep[1]);
        const block = process.slice(para.numbered ? paraStart : blockStart);
        if (n >= 1 && n <= 6 && block.length > 0) {
          const total = n + 1;
          let k = 0;
          const label = (s: ProcessStep, i: number): ProcessStep => (s.kind === 'hand' ? { ...s, name: `${s.name.replace(/\.\.\.$/, '')} (${i} van ${total})` } : s);
          const firstHand = block.findIndex((s) => s.kind === 'hand');
          process.splice(process.length - block.length, block.length, ...block.map((s, j) => (j === firstHand ? label(s, 1) : s)));
          for (let c = 2; c <= total; c++) {
            for (const [j, s] of block.entries()) process.push(j === firstHand ? label({ ...s, id: newId() }, c) : { ...s, id: newId() });
            k++;
          }
          void k;
          repeats++;
          open = null;
          continue;
        }
      }
      if (!durationMinutes(clean) && !IMPERATIVE.test(clean) && !WAIT_NO_TIME.test(clean) && !PREHEAT.test(clean)) {
        notes.push(clean.replace(/[.;]\s*$/, '') + '.');
        continue;
      }
      const fb = foldsInBulk(clean);
      if (fb) {
        for (let i = 1; i <= fb.times; i++) {
          process.push(hand(`${fb.what} (${i} van ${fb.times})`, fb.every, 5, i === 1 ? { check: `Vouwen tijdens de bulk uit "${clean.replace(/[.;]\s*$/, '')}": controleer het aantal en de tijd ertussen.` } : {}));
        }
        process.push({ id: newId(), name: 'Bulk verder laten rijzen', minutes: fb.bulk - fb.times * fb.every, kind: 'wacht', tempSensitive: true, alarm: false });
        if (durationMinutes(fb.bulkName)?.range) ranges++;
        bulkFolds++;
        open = null;
        blockStart = process.length;
        continue;
      }
      const r = repeatedSteps(clean);
      if (r) {
        repeats++;
        blockStart = process.length;
        for (let i = 1; i <= r.times; i++) {
          process.push(hand(`${r.name} (${i} van ${r.times})`, r.every, 5, { check: `Herhaling uit "${clean.replace(/[.;,]\s*$/, '')}": controleer het aantal en de tijd ertussen.` }));
        }
        open = null;
        continue;
      }
      const pieces = durationMinutes(clean) ? splitByDuration(clean) : [clean];
      let prevVerb = '';
      for (const raw of pieces) {
        let piece = raw.replace(/\s+/g, ' ').trim().replace(/[.;,]\s*$/, '');
        if (!piece) continue;
        // Een stuk dat met een getal begint ("25 minuten zonder") erft het werkwoord van het vorige stuk.
        if (/^\d/.test(piece) && prevVerb) piece = `${prevVerb} ${piece}`;
        prevVerb = /^[A-Za-zÀ-ÿ]+$/.test(piece.split(' ')[0]) ? piece.split(' ')[0] : prevVerb;
        const d = durationMinutes(piece);
        const preheat = !d && PREHEAT.test(piece);
        const waitsNoTime = !d && !preheat && WAIT_NO_TIME.test(piece);
        if (!d && !preheat && !waitsNoTime) {
          // Handeling zonder tijd: bij de open handstap van deze alinea, anders een nieuwe (met wekker).
          if (open) continue;
          const st = hand(piece, 5, 5);
          process.push(st);
          if (para.numbered === false) blockStart = process.length - 1;
          open = { step: st, sentence: si, preheat: false };
          estimated++;
          continue;
        }
        if (preheat) {
          if (open?.preheat) continue;
          const st = hand(piece, PREHEAT_MINUTES, 5, { check: `Geen tijd in het recept voor het voorverwarmen: ik zette ${PREHEAT_MINUTES} minuten. Met een gietijzeren pan erin duurt het vaak langer.` });
          process.push(st);
          open = { step: st, sentence: si, preheat: true };
          preheats++;
          continue;
        }
        if (waitsNoTime) {
          waitsWithoutTime++;
          process.push({ id: newId(), name: stepName(piece), minutes: 60, kind: 'wacht', tempSensitive: /(rijs|rijz|rust|bulk|ferment)/i.test(piece) && !/koelkast/i.test(piece) ? true : undefined, alarm: false, check: 'Geen tijd in het recept: vul zelf in hoe lang dit duurt (ik zette 1 uur).' });
          open = null;
          continue;
        }
        // met een tijd
        const dur = d!;
        if (dur.range) ranges++;
        if (dur.guessed) nights++;
        const minutes = dur.minutes;
        const kind = stepKind(piece, minutes);
        const check = dur.range ? 'Het recept geeft een bereik: ik nam het midden.' : dur.guessed ? '"Een nacht" telt als 12 uur: pas aan naar wat jij doet.' : undefined;
        if (kind === 'hand' && open && !open.preheat && open.sentence === si && process[process.length - 1] === open.step) {
          // "Zet de pan in de oven en bak 15 minuten": één handstap met die tijd.
          const upTo = clean.indexOf(raw.trim());
          const mergedName = upTo >= 0 ? clean.slice(0, upTo + raw.trim().length) : `${open.step.name} ${raw.trim()}`;
          const merged = hand(mergedName, minutes, Math.min(minutes, /bak|oven/i.test(piece) ? 5 : 10), check ? { check } : {});
          process[process.length - 1] = merged;
          estimated--;
          open = null;
          continue;
        }
        const tempSensitive = kind === 'wacht' && !/koelkast/i.test(piece) && (/(rijs|rijz|bulk|ferment)/i.test(piece) || (/kamertemperatuur/i.test(piece) && minutes >= 30));
        process.push({
          id: newId(),
          name: stepName(piece),
          minutes,
          kind,
          workMinutes: kind === 'hand' ? Math.min(minutes, /bak|oven/i.test(piece) ? 5 : 10) : undefined,
          tempSensitive: tempSensitive || undefined,
          alarm: kind === 'hand',
          ...(check ? { check } : {}),
        });
        if (kind === 'hand' && !para.numbered) blockStart = process.length - 1;
        open = null;
      }
    }
  }
  if (process.length === 0) warnings.push('Ik vond geen stappen. Plak ook de bereiding, of voeg de stappen zelf toe.');
  if (waitsWithoutTime > 0) warnings.push(`${waitsWithoutTime} ${waitsWithoutTime === 1 ? 'wachtstap noemt' : 'wachtstappen noemen'} geen tijd ("laat rijzen tot het verdubbeld is"). Ik zette er voorlopig 1 uur bij: vul de echte tijd in, anders klopt je schema niet.`);
  if (preheats > 0) warnings.push(`Het voorverwarmen heeft geen tijd in het recept: ik zette ${PREHEAT_MINUTES} minuten. Pas het aan aan je oven.`);
  if (estimated > 0) warnings.push(`${estimated} ${estimated === 1 ? 'handeling noemt' : 'handelingen noemen'} geen tijd: ik rekende met 5 minuten werk. Duurt het bij jou langer, pas het aan.`);
  if (repeats > 0) warnings.push('Een herhaling ("herhaal nog twee keer", "4 keer, elk half uur") werd meerdere stappen. Controleer het aantal en de tijden.');
  if (bulkFolds > 0) warnings.push('De vouwmomenten vallen binnen de bulk: na het laatste vouwen rijst het deeg verder. Controleer het aantal en de tijden.');
  if (ranges > 0) warnings.push('Bij een tijd als "4 tot 5 uur" nam ik het midden. Kijk of dat past.');
  if (nights > 0) warnings.push('"Een nacht" telt voor mij als 12 uur. Pas aan naar wat jij doet.');
  if (twoLoaves) warnings.push('Het recept bakt twee broden na elkaar. Het schema rekent met één: tel voor het tweede brood zo\'n 35 minuten bij.');
  if (notes.length > 0) warnings.push('Uitleg uit de bereiding die geen stap is, staat bij de notities van het recept.');
  if (process.length > 0) warnings.push('Controleer de tijden en de volgorde: dit is een voorstel uit de tekst, geen zekerheid.');
  return { process, warnings, notes };
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
  let stepsAt = lines.findIndex((l) => HEADING_STEPS.test(l));
  if (stepsAt < 0) {
    // Geen kop "Bereiding": begin bij stap 1, of bij de tussenkop er net boven ("Kneden (ca. 4 uur)").
    const one = lines.findIndex((l) => NUMBERED_FIRST.test(l));
    if (one >= 0) {
      let prev = one - 1;
      while (prev >= 0 && !lines[prev]) prev--;
      stepsAt = prev >= 0 && isSectionHeading(lines[prev]) ? prev : one;
    }
  }
  const ingLines = (stepsAt >= 0 ? lines.slice(0, stepsAt) : lines).filter(Boolean);
  const stepText = stepsAt >= 0
    ? lines.slice(HEADING_STEPS.test(lines[stepsAt]) ? stepsAt + 1 : stepsAt).filter((l, i, all) => !isSectionHeading(l) || !all.slice(i + 1).some((n) => n.trim() !== '')).join('\n')
    : lines.filter((l) => l && !parseIngredientLine(l) && !HEADING_ING.test(l) && l !== name).join('\n');

  // --- ingrediënten
  const flours: Flour[] = [];
  let waterG = 0;
  let starterG = 0;
  let saltG = 0;
  let starterHydration = 100;
  const tableGrams = ingLines.some((l) => TABLE_GRAMS.test(l));
  for (const l of ingLines) {
    if (TABLE_GRAMS.test(l) || HEADING_ING.test(l)) continue;
    const ing = parseIngredientLine(l) ?? (tableGrams ? parseTableLine(l) : null);
    if (ing && SUBTOTAL.test(ing.rest.trim())) continue;
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
    } else if (/zout\b/.test(low)) {
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
  const built = buildSteps(stepText);
  warnings.push(...built.warnings);
  const process = built.process;
  const refTempC = findRefTemp(stepText);
  return { name, flours, waterG, starterG, starterHydration, saltG, process, warnings: Array.from(new Set(warnings)), ignored, notes: built.notes, ...(refTempC !== undefined ? { refTempC } : {}) };
}
