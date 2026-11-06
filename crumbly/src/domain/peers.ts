// De starter van een gekoppeld account (enkel lezen). Wat de ander deelt, komt via de functie
// bak_get_linked binnen en blijft apart van je eigen gegevens: het gaat nooit in `dirty`, nooit
// naar de server en nooit door mergeRemote (die zou je eigen starter overschrijven, want
// iedere starter heeft hetzelfde vaste id). Getest in tests/peers.test.ts.

import type { Feed, Starter } from './types';

export interface PeerData {
  /** Account van de ander. */
  userId: string;
  /** Moment van koppelen. */
  linkedAt: string;
  starter: Starter | null;
  /** Laatste voedingen, oudste eerst, zonder verwijderde. */
  feeds: Feed[];
  /** Wanneer we dit voor het laatst ophaalden. */
  pulledAt: string;
}

export interface LinkRow {
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface LinkedRow {
  owner: string;
  id: string;
  kind: string;
  data: unknown;
  updated_at: string;
}

const isStamped = (d: unknown): d is { id: string; updatedAt: string } =>
  !!d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' && typeof (d as { updatedAt?: unknown }).updatedAt === 'string';

/** De ander uit een koppeling, gezien vanuit `me`. */
export function peerOf(link: LinkRow, me: string): string {
  return link.user_a === me ? link.user_b : link.user_a;
}

/** Zet koppelingen en opgehaalde rijen om naar één blok per gekoppeld account. */
export function buildPeers(links: LinkRow[], rows: LinkedRow[], me: string, pulledAt: string): PeerData[] {
  return links
    .map((l) => {
      const userId = peerOf(l, me);
      const mine = rows.filter((r) => r.owner === userId);
      const starters = mine
        .filter((r) => r.kind === 'starter' && isStamped(r.data))
        .map((r) => r.data as Starter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const feeds = mine
        .filter((r) => r.kind === 'feed' && isStamped(r.data) && typeof (r.data as Feed).fedAt === 'string' && !(r.data as Feed).deletedAt)
        .map((r) => r.data as Feed)
        .sort((a, b) => a.fedAt.localeCompare(b.fedAt));
      return { userId, linkedAt: l.created_at, starter: starters[0] ?? null, feeds, pulledAt };
    })
    .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
}

/**
 * Naam waaronder de ander in de app staat: de naam van haar of zijn starter. Heet die hetzelfde als
 * de jouwe, dan zetten we er "(de andere)" achter, zodat altijd duidelijk is van wie het is.
 */
export function peerName(peer: PeerData, ownName: string | undefined): string {
  const name = peer.starter?.name?.trim();
  if (!name) return 'Gekoppelde starter';
  return ownName && name.toLowerCase() === ownName.trim().toLowerCase() ? `${name} (de andere)` : name;
}

/** Vertaalt een foutmelding van de databank naar iets leesbaars. */
export function linkErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('klopt niet') || m.includes('verlopen')) return 'Deze code klopt niet of is verlopen. Vraag de ander om een nieuwe.';
  if (m.includes('eigen code')) return 'Dit is je eigen code. Geef ze aan de ander.';
  if (m.includes('does not exist') || m.includes('could not find the function') || m.includes('schema cache'))
    return 'Koppelen staat nog niet klaar in de databank.';
  return `Koppelen mislukte: ${message}`;
}
