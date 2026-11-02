// Sync met Supabase: eerst eigen wijzigingen weg (upsert in bak_items), dan nieuwe
// wijzigingen ophalen. Laatste wijziging wint. Daarna de wekkers bijwerken
// (bak_reminders), die de server als melding verstuurt.

import { buildReminders, diffReminders, type StoredReminder } from '../domain/reminders';
import { itemForKey, useCrumbly, type RemoteItem } from '../store/store';
import { supabase } from './supabase';

export type SyncStatus =
  | { kind: 'uit'; reason: string }
  | { kind: 'bezig' }
  | { kind: 'ok'; at: string }
  | { kind: 'fout'; message: string };

let running = false;
let lastStatus: SyncStatus = { kind: 'uit', reason: 'Nog niet gesynchroniseerd.' };
const listeners = new Set<(s: SyncStatus) => void>();

function emit(s: SyncStatus): void {
  lastStatus = s;
  listeners.forEach((l) => l(s));
}

export function getSyncStatus(): SyncStatus {
  return lastStatus;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('does not exist') || m.includes('could not find the table') || m.includes('schema cache');
}

export async function syncNow(): Promise<SyncStatus> {
  if (!supabase) {
    emit({ kind: 'uit', reason: 'Sync is niet ingesteld (geen Supabase-gegevens). Alles staat veilig op dit toestel.' });
    return lastStatus;
  }
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    emit({ kind: 'uit', reason: 'Meld je aan om je gegevens te bewaren in de cloud.' });
    return lastStatus;
  }
  if (running) return lastStatus;
  running = true;
  emit({ kind: 'bezig' });
  try {
    const userId = sess.session.user.id;
    const state = useCrumbly.getState();
    const keys = [...state.dirty];
    const rows: (RemoteItem & { user_id: string; deleted_at: string | null })[] = [];
    for (const k of keys) {
      const it = itemForKey(state, k);
      if (!it) continue;
      const deleted = (it.data as { deletedAt?: string }).deletedAt ?? null;
      rows.push({ ...it, user_id: userId, deleted_at: deleted });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('bak_items').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw new Error(error.message);
    }
    useCrumbly.getState().clearDirty(keys);

    // Ophalen op servertijd (niet de klok van het toestel), in porties.
    let since = useCrumbly.getState().lastPulledAt;
    for (let page = 0; page < 20; page++) {
      let q = supabase.from('bak_items').select('id, kind, data, updated_at, server_updated_at').order('server_updated_at', { ascending: true }).limit(500);
      if (since) q = q.gt('server_updated_at', since);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const list = (data ?? []) as (RemoteItem & { server_updated_at: string })[];
      if (list.length === 0) break;
      since = list[list.length - 1].server_updated_at;
      useCrumbly.getState().applyRemote(list, since);
      if (list.length < 500) break;
    }
    const pulledAt = new Date().toISOString();

    await syncReminders();
    emit({ kind: 'ok', at: pulledAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    emit({
      kind: 'fout',
      message: isMissingTable(message)
        ? 'De tabellen voor Crumbly staan nog niet in de databank. Je gegevens blijven op dit toestel.'
        : `Sync mislukt: ${message}`,
    });
  } finally {
    running = false;
  }
  return lastStatus;
}

/** Breng de openstaande wekkers op de server in lijn met de huidige lijst (enkel verschillen). */
async function syncReminders(): Promise<void> {
  if (!supabase) return;
  const s = useCrumbly.getState();
  const wanted = buildReminders({ bakes: s.bakes, feeds: s.feeds, starter: s.starter, settings: s.settings, away: s.away }, new Date()).slice(0, 200);
  const { data, error } = await supabase.from('bak_reminders').select('id, due_at, title, body, url').is('sent_at', null);
  if (error) throw new Error(error.message);
  const { remove, upsert } = diffReminders((data ?? []) as StoredReminder[], wanted);
  if (remove.length > 0) {
    const del = await supabase.from('bak_reminders').delete().is('sent_at', null).in('id', remove);
    if (del.error) throw new Error(del.error.message);
  }
  if (upsert.length > 0) {
    const up = await supabase.from('bak_reminders').upsert(
      upsert.map((r) => ({ id: r.id, due_at: r.dueAt, title: r.title, body: r.body, url: r.url, sent_at: null })),
      { onConflict: 'user_id,id' },
    );
    if (up.error) throw new Error(up.error.message);
  }
}
