// Sync met Supabase: eerst eigen wijzigingen weg (upsert in bak_items), dan nieuwe
// wijzigingen ophalen. Laatste wijziging wint. Daarna de wekkers bijwerken
// (bak_reminders), die de server als melding verstuurt.

import { useEffect, useState } from 'react';
import { buildReminders } from '../domain/reminders';
import { itemForKey, useCrumbly } from '../store/store';
import { supabase } from './supabase';
import { runSync } from './syncCore';

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
    await runSync(supabase, userId, {
      dirty: () => [...useCrumbly.getState().dirty],
      itemFor: (k) => itemForKey(useCrumbly.getState(), k),
      clearDirty: (keys) => useCrumbly.getState().clearDirty(keys),
      lastPulledAt: () => useCrumbly.getState().lastPulledAt,
      applyRemote: (items, serverTime) => useCrumbly.getState().applyRemote(items, serverTime),
      wantedReminders: () => {
        const s = useCrumbly.getState();
        return buildReminders({ bakes: s.bakes, feeds: s.feeds, starter: s.starter, settings: s.settings, away: s.away }, new Date());
      },
    });
    emit({ kind: 'ok', at: new Date().toISOString() });
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

/** De laatste synchronisatie-uitkomst, om te tonen. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}
