/** Willekeurige id (UUID v4 waar mogelijk). */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Vast id voor een automatisch genoteerde voeding: hetzelfde moment geeft op elk toestel hetzelfde id. Zo noteren
 * twee toestellen van één gezin dezelfde voeding niet elk apart (bij het samenvoegen vallen ze samen).
 */
export function autoFeedId(atIso: string): string {
  const minutes = Math.floor(new Date(atIso).getTime() / 60_000);
  return `a0f00000-0000-4000-8000-${minutes.toString(16).padStart(12, '0')}`;
}
