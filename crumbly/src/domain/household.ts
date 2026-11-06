// Gezin: meerdere accounts werken op de gegevens van één eigenaar (starter, voedingen, recepten, bakken).
// Wie lid is, leest en schrijft in de app de rijen van de eigenaar. Puur en getest (tests/household.test.ts).

export interface HouseholdMemberRow {
  owner: string;
  member: string;
  display_name: string;
  joined_at: string;
}

export interface HouseholdMember {
  userId: string;
  name: string;
  joinedAt: string;
}

export type HouseholdRole = 'geen' | 'eigenaar' | 'lid';

export interface HouseholdState {
  role: HouseholdRole;
  /** Van wie zijn de gegevens waarop ik werk: de eigenaar (als lid) of mijzelf. */
  dataId: string;
  members: HouseholdMember[];
  /** Mijn naam binnen het gezin (als lid). */
  myName: string | null;
}

export const NO_HOUSEHOLD = (me: string): HouseholdState => ({ role: 'geen', dataId: me, members: [], myName: null });

/** Bepaalt wie ik ben in het gezin, uit de rijen die ik mag zien (eigen lidmaatschap of leden van mijn gezin). */
export function buildHousehold(me: string, rows: HouseholdMemberRow[]): HouseholdState {
  const mine = rows.find((r) => r.member === me);
  if (mine) return { role: 'lid', dataId: mine.owner, members: [], myName: mine.display_name };
  const members = rows
    .filter((r) => r.owner === me)
    .map((r) => ({ userId: r.member, name: r.display_name, joinedAt: r.joined_at }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  return members.length > 0 ? { role: 'eigenaar', dataId: me, members, myName: null } : NO_HOUSEHOLD(me);
}

/**
 * Op wiens gegevens werk ik? Lukt het ophalen van het gezin niet (geen verbinding, migratie ontbreekt), dan
 * blijven we bij wat het toestel al had: een lid verspringt niet ineens naar zijn eigen, lege gegevens.
 */
export function resolveDataId(me: string, fetched: HouseholdState | null, lastDataId: string | null): string {
  if (fetched) return fetched.dataId;
  return lastDataId ?? me;
}

/** Naam waaronder iemand voedt: het lid zijn naam, de eigenaar zijn gekozen naam, en enkel als er een gezin is. */
export function feederName(h: HouseholdState | null, ownerName: string | null): string | undefined {
  if (!h || h.role === 'geen') return undefined;
  const name = h.role === 'lid' ? h.myName : ownerName;
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 40) : undefined;
}

export function householdErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('klopt niet') || m.includes('verlopen')) return 'Deze code klopt niet of is verlopen. Vraag om een nieuwe.';
  if (m.includes('eigen code')) return 'Dit is je eigen code. Geef ze aan de ander.';
  if (m.includes('vul je naam')) return 'Vul je naam in.';
  if (m.includes('al in een gezin')) return 'Je zit al in een gezin. Verlaat dat eerst.';
  if (m.includes('leden in jouw gezin')) return 'Er zitten al leden in jouw gezin. Zet die eerst weg.';
  if (m.includes('zelf in het gezin')) return 'Je zit zelf in het gezin van iemand anders, dus je kan geen code maken.';
  if (m.includes('does not exist') || m.includes('could not find the function') || m.includes('schema cache')) return 'Gezin delen staat nog niet klaar in de databank.';
  return `Gezin delen mislukte: ${message}`;
}
