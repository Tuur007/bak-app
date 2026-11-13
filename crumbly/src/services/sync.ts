// Sync met Supabase: eerst eigen wijzigingen weg (upsert in bak_items), dan nieuwe
// wijzigingen ophalen. Laatste wijziging wint. Daarna de wekkers bijwerken
// (bak_reminders), die de server als melding verstuurt.

import { useEffect, useState } from 'react';
import { friendlyError, NETWORK_TEXT } from '../domain/errors';
import { buildReminders } from '../domain/reminders';
import { itemForKey, useCrumbly } from '../store/store';
import { resolveDataId, type HouseholdState } from '../domain/household';
import { fetchHousehold } from './household';
import { supabase } from './supabase';
import { createRunGuard } from './runGuard';
import { runSync } from './syncCore';

export type SyncStatus =
  | { kind: 'uit'; reason: string }
  | { kind: 'bezig' }
  | { kind: 'ok'; at: string }
  | { kind: 'fout'; message: string };

// Eén ronde tegelijk; een ronde die blijft hangen (iPhone pauzeert de app midden in een verzoek) vervalt na een
// tijd, anders synchroniseert het toestel nooit meer tot de app herlaadt.
const guard = createRunGuard();
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
  // getSession ververst een verlopen sessie via het netwerk en kan lang wachten: geef na 15 seconden op.
  const result = await Promise.race([supabase.auth.getSession(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000))]);
  if (!result) {
    emit({ kind: 'fout', message: NETWORK_TEXT });
    return lastStatus;
  }
  const sess = result.data;
  if (!sess.session) {
    emit({ kind: 'uit', reason: 'Meld je aan om je gegevens te bewaren in de cloud.' });
    return lastStatus;
  }
  const token = guard.begin();
  if (token === null) return lastStatus;
  emit({ kind: 'bezig' });
  try {
    const userId = sess.session.user.id;
    // Op wiens gegevens werk ik: mijn eigen, of die van de eigenaar van het gezin waarvan ik lid ben. Lukt het
    // ophalen van het gezin niet, dan blijf ik bij wat dit toestel al had (zie resolveDataId).
    let household: HouseholdState | null = null;
    try {
      household = await fetchHousehold(supabase, userId);
    } catch {
      household = null;
    }
    const meta = sess.session.user.user_metadata as { crumbly_name?: unknown } | undefined;
    const ownerName = typeof meta?.crumbly_name === 'string' ? meta.crumbly_name : null;
    const dataId = resolveDataId(userId, household, useCrumbly.getState().ownerId);
    // Gegevens van een ander (ook mijn eigen als ik in een gezin kom) gaan nooit door elkaar.
    useCrumbly.getState().claimForAccount(dataId);
    if (household) useCrumbly.getState().setHousehold(household, ownerName);
    await runSync(supabase, userId, {
      dirty: () => [...useCrumbly.getState().dirty],
      itemFor: (k) => itemForKey(useCrumbly.getState(), k),
      clearDirty: (keys) => useCrumbly.getState().clearDirty(keys),
      lastPulledAt: () => useCrumbly.getState().lastPulledAt,
      lastPulledId: () => useCrumbly.getState().lastPulledId,
      applyRemote: (items, serverTime, lastId) => useCrumbly.getState().applyRemote(items, serverTime, lastId),
      applyPeers: (peers) => useCrumbly.getState().setPeers(peers),
      wantedReminders: () => {
        const s = useCrumbly.getState();
        return buildReminders({ bakes: s.bakes, feeds: s.feeds, starter: s.starter, settings: s.settings, away: s.away }, new Date());
      },
    }, dataId);
    if (guard.isCurrent(token)) emit({ kind: 'ok', at: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Een opgegeven ronde die later toch nog faalt, mag de uitkomst van de nieuwe ronde niet overschrijven.
    if (guard.isCurrent(token)) emit({
      kind: 'fout',
      message: isMissingTable(message)
        ? 'De tabellen voor Crumbly staan nog niet in de databank. Je gegevens blijven op dit toestel.'
        : friendlyError(message) === message ? `Synchroniseren mislukt: ${message}` : friendlyError(message),
    });
  } finally {
    guard.end(token);
  }
  return lastStatus;
}

/** De laatste synchronisatie-uitkomst, om te tonen. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}
