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
  /** `serverTime` is de servertijd van het laatste opgehaalde item. */
  applyRemote(items: RemoteItem[], serverTime: string): void;
  /** De wekkers die nu zouden moeten klaarstaan. */
  wantedReminders(): Reminder[];
  /** De starters van gekoppelde accounts (enkel lezen, apart van je eigen gegevens). */
  applyPeers?(peers: PeerData[]): void;
}

const PAGE = 500;
const MAX_PAGES = 20;

export async function runSync(client: SupabaseClient, userId: string, io: SyncIO): Promise<{ pushed: number; pulled: number }> {
  // 1. Eigen wijzigingen versturen
  const keys = io.dirty();
  const rows: (RemoteItem & { user_id: string; deleted_at: string | null })[] = [];
  for (const k of keys) {
    const it = io.itemFor(k);
    if (!it) continue;
    const deleted = (it.data as { deletedAt?: string }).deletedAt ?? null;
    rows.push({ ...it, user_id: userId, deleted_at: deleted });
  }
  if (rows.length > 0) {
    const { error } = await client.from('bak_items').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw new Error(error.message);
  }
  io.clearDirty(keys);

  // 2. Nieuwe wijzigingen ophalen, op servertijd (niet de klok van het toestel), in porties
  let since = io.lastPulledAt();
  let pulled = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = client.from('bak_items').select('id, kind, data, updated_at, server_updated_at').order('server_updated_at', { ascending: true }).limit(PAGE);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const list = (data ?? []) as (RemoteItem & { server_updated_at: string })[];
    if (list.length === 0) break;
    since = list[list.length - 1].server_updated_at;
    io.applyRemote(list, since);
    pulled += list.length;
    if (list.length < PAGE) break;
  }
  // Eerste keer en niets op te halen: noteer toch dat er opgehaald werd (vanaf het begin), zodat de app
  // niet blijft wachten op gegevens die er niet zijn.
  if (since === null) io.applyRemote([], '1970-01-01T00:00:00.000Z');

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
