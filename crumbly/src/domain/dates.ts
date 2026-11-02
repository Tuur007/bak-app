// Datums en uren tonen, in het Nederlands, in de tijdzone van het toestel.

const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export const pad = (n: number): string => String(n).padStart(2, '0');

export function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** "vandaag", "morgen", "gisteren" of "vr 6 nov" */
export function fmtDay(d: Date, now: Date): string {
  if (sameDay(d, now)) return 'vandaag';
  if (sameDay(d, addDays(now, 1))) return 'morgen';
  if (sameDay(d, addDays(now, -1))) return 'gisteren';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "vandaag 17:30" of "za 7 nov 11:30" */
export function fmtDayTime(d: Date, now: Date): string {
  return `${fmtDay(d, now)} ${fmtTime(d)}`;
}

/** "maandag 2 november" */
export function fmtLongDate(d: Date): string {
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function dayName(day: number): string {
  return DAYS_LONG[day] ?? '';
}

export function dayShort(day: number): string {
  return DAYS[day] ?? '';
}

/** Lokale datum als YYYY-MM-DD */
export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Duur in minuten -> "45 min", "2 u", "12 u 30" */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} u` : `${h} u ${pad(r)}`;
}

/** Aftellen: "12:40" of "1:05:00" */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}

/** Datum met een uur erop: dag van `day`, tijd "HH:MM". */
export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
