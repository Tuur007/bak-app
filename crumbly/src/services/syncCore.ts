// De kern van de synchronisatie, zonder winkel of netwerk in het bestand zelf: de databank-client
// en de toegang tot de gegevens komen binnen als parameters. Zo kan ze getest worden met een
// nepdatabank (tests/sync.test.ts). `sync.ts` koppelt ze aan de echte winkel en Supabase.

import type { SupabaseClient } from '@supabase/supabase-js';
import { diffReminders, type Reminder, type StoredReminder } from '../domain/reminders';
import type { PeerData } from '../domain/peers';
import type { RemoteItem } from '../store/merge';
import { fetchPeers } from './peers';

export interface SyncIO {
  /** Sleutels van wijzigingen die nog niet verstuurd zijn. */
  dirty(): string[];
  /** Het item bij een sleutel (null als het niet meer bestaat). */
  itemFor(key: string): RemoteItem | null;
  clearDirty(keys: string[]): void;
  lastPulledAt(): string | null;
  /** Id van het laatst opgehaalde item: samen met de servertijd de cursor (rijen kunnen dezelfde servertijd hebben). */
  lastPulledId?(): string | null;
  /**
   * `serverTime` is de servertijd van het laatste opgehaalde item; null = enkel samenvoegen, de cursor niet verzetten
   * (bv. de cloudversie na een geweigerde wijziging). `lastId` hoort bij `serverTime`.
   */
  applyRemote(items: RemoteItem[], serverTime: string | null, lastId?: string | null): void;
  /** De wekkers die nu zouden moeten klaarstaan. */
  wantedReminders(): Reminder[];
  /** De starters van gekoppelde accounts (enkel lezen, apart van je eigen gegevens). */
  applyPeers?(peers: PeerData[]): void;
}

const PAGE = 500;
const MAX_PAGES = 20;
/** Hoever vóór de cursor een ophaalronde begint (zie hieronder). */
const OVERLAP_MS = 30_000;

/**
 * `userId` is wie ik ben (voor de gekoppelde starters), `dataId` op wiens gegevens ik werk: mijn eigen, of die van de
 * eigenaar van het gezin waarvan ik lid ben.
 */
export async function runSync(client: SupabaseClient, userId: string, io: SyncIO, dataId: string = userId): Promise<{ pushed: number; pulled: number }> {
  // 1. Eigen wijzigingen versturen
  const keys = io.dirty();
  const rows: (RemoteItem & { user_id: string; deleted_at: string | null })[] = [];
  const sentAt = new Map<string, string>(); // sleutel -> `updated_at` zoals verstuurd
  const rejected = new Set<string>(); // sleutels waarvoor de databank een nieuwere versie bewaarde
  for (const k of keys) {
    const it = io.itemFor(k);
    if (!it) continue;
    const deleted = (it.data as { deletedAt?: string }).deletedAt ?? null;
    rows.push({ ...it, user_id: dataId, deleted_at: deleted });
    sentAt.set(k, it.updated_at);
  }
  if (rows.length > 0) {
    // select(): de databank geeft de rijen terug zoals ze bewaard werden. Een oudere wijziging wordt door de trigger
    // geweigerd en dan komt de nieuwere cloudversie terug: die nemen we meteen over, anders blijft dit toestel op een
    // verouderde versie werken (de ophaalronde komt er niet meer langs als de cursor al voorbij die rij staat).
    const { data: stored, error } = await client.from('bak_items').upsert(rows, { onConflict: 'user_id,id' }).select('id, kind, data, updated_at, server_updated_at');
    if (error) throw new Error(error.message);
    const kept = ((stored ?? []) as RemoteItem[]).filter((r) => {
      const sent = sentAt.get(`${r.kind}:${r.id}`);
      return sent !== undefined && r.updated_at !== sent;
    });
    for (const r of kept) rejected.add(`${r.kind}:${r.id}`);
    if (kept.length > 0) io.applyRemote(kept, null);
  }
  // Enkel wat nog onveranderd is, is verstuurd. Is een item tijdens het versturen opnieuw aangepast, dan blijft het
  // in de wachtrij, anders gaat die tweede wijziging verloren.
  io.clearDirty(keys.filter((k) => {
    const it = io.itemFor(k);
    const sent = sentAt.get(k);
    return !it || sent === undefined || rejected.has(k) || it.updated_at === sent;
  }));

  // 2. Nieuwe wijzigingen ophalen, op servertijd (niet de klok van het toestel), in porties.
  // - Pagineren met een samengestelde cursor (servertijd, id): een bulk-upsert geeft alle rijen dezelfde servertijd
  //   (now() is binnen één transactie constant), en met enkel de tijd zouden rijen op een paginagrens wegvallen.
  // - De eerste pagina begint iets vóór de cursor: een transactie die begon vóór de vorige ophaalronde maar pas erna
  //   werd vastgelegd, heeft een oudere servertijd. Opnieuw ophalen is veilig (samenvoegen verandert dan niets).
  const startAt = io.lastPulledAt();
  let at: string | null = startAt === null ? null : new Date(new Date(startAt).getTime() - OVERLAP_MS).toISOString();
  let id: string | null = null;
  let pulled = 0;
  let seenAny = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    // Altijd op de eigenaar van de gegevens filteren: een lid ziet via de RLS ook zijn eigen rijen, en die mogen niet door elkaar.
    let q = client.from('bak_items').select('id, kind, data, updated_at, server_updated_at').eq('user_id', dataId).order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE);
    if (at !== null && id === null) q = q.gt('server_updated_at', at);
    else if (at !== null && id !== null) q = q.or(`server_updated_at.gt.${at},and(server_updated_at.eq.${at},id.gt.${id})`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const list = (data ?? []) as (RemoteItem & { server_updated_at: string })[];
    if (list.length === 0) break;
    const last = list[list.length - 1];
    at = last.server_updated_at;
    id = last.id;
    seenAny = true;
    io.applyRemote(list, at, id);
    pulled += list.length;
    if (list.length < PAGE) break;
  }
  // Eerste keer en niets op te halen: noteer toch dat er opgehaald werd (vanaf het begin), zodat de app
  // niet blijft wachten op gegevens die er niet zijn.
  if (startAt === null && !seenAny) io.applyRemote([], '1970-01-01T00:00:00.000Z', null);

  // 3. Wekkers: enkel verschillen
  await syncReminders(client, io.wantedReminders());

  // 4. Gekoppelde starters (enkel lezen). Mislukt dit, dan blijft de laatste stand staan en
  // faalt de gewone sync niet.
  if (io.applyPeers) {
    try {
      io.applyPeers(await fetchPeers(client, userId));
    } catch {
      /* de vorige stand blijft */
    }
  }
  return { pushed: rows.length, pulled };
}

export async function syncReminders(client: SupabaseClient, wanted: Reminder[]): Promise<void> {
  const { data, error } = await client.from('bak_reminders').select('id, due_at, title, body, url').is('sent_at', null);
  if (error) throw new Error(error.message);
  const { remove, upsert } = diffReminders((data ?? []) as StoredReminder[], wanted.slice(0, 200));
  if (remove.length > 0) {
    const del = await client.from('bak_reminders').delete().is('sent_at', null).in('id', remove);
    if (del.error) throw new Error(del.error.message);
  }
  if (upsert.length > 0) {
    const up = await client.from('bak_reminders').upsert(
      upsert.map((r) => ({ id: r.id, due_at: r.dueAt, title: r.title, body: r.body, url: r.url, sent_at: null })),
      { onConflict: 'user_id,id' },
    );
    if (up.error) throw new Error(up.error.message);
  }
}
