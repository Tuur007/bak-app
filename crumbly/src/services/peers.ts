// Koppelen met het account van de ander (enkel lezen). De databankclient komt als parameter binnen,
// zodat dit getest kan worden met een nepclient (tests/peers.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPeers, linkErrorText, type LinkedRow, type LinkRow, type PeerData } from '../domain/peers';

export async function fetchPeers(client: SupabaseClient, me: string, now: Date = new Date()): Promise<PeerData[]> {
  const links = await client.from('bak_links').select('user_a, user_b, created_at');
  if (links.error) throw new Error(links.error.message);
  const list = (links.data ?? []) as LinkRow[];
  if (list.length === 0) return [];
  const rows = await client.rpc('bak_get_linked', { p_feeds: 60 });
  if (rows.error) throw new Error(rows.error.message);
  return buildPeers(list, (rows.data ?? []) as LinkedRow[], me, now.toISOString());
}

/**
 * Je koppelcode. Bestaat er nog een geldige, ongebruikte code, dan krijg je die terug (ook op een ander
 * toestel van hetzelfde account). Met `fresh` komt er een nieuwe en vervalt de oude.
 */
export async function createLinkCode(client: SupabaseClient, fresh = false): Promise<{ code: string } | { error: string }> {
  const { data, error } = fresh ? await client.rpc('bak_create_link_code', { p_new: true }) : await client.rpc('bak_create_link_code');
  if (error) return { error: linkErrorText(error.message) };
  return { code: String(data) };
}

export interface MyLinkCode {
  code: string;
  expiresAt: string;
}

/** Je geldige, ongebruikte koppelcode, of null. Fouten (bv. oudere databank) tellen als "geen code". */
export async function myLinkCode(client: SupabaseClient): Promise<MyLinkCode | null> {
  try {
    const { data, error } = await client.rpc('bak_my_link_code');
    if (error) return null;
    const row = (Array.isArray(data) ? data[0] : data) as { code?: unknown; expires_at?: unknown } | null | undefined;
    if (!row || typeof row.code !== 'string' || typeof row.expires_at !== 'string') return null;
    return { code: row.code, expiresAt: row.expires_at };
  } catch {
    return null;
  }
}

export async function redeemLinkCode(client: SupabaseClient, code: string): Promise<{ ok: true } | { error: string }> {
  const trimmed = code.trim();
  if (trimmed.length === 0) return { error: 'Vul de code van de ander in.' };
  const { error } = await client.rpc('bak_redeem_link_code', { p_code: trimmed });
  if (error) return { error: linkErrorText(error.message) };
  return { ok: true };
}

/** Verbreekt de koppeling met `peer`. Beide kanten mogen dat. */
export async function unlinkPeer(client: SupabaseClient, me: string, peer: string): Promise<{ ok: true } | { error: string }> {
  const [a, b] = me < peer ? [me, peer] : [peer, me];
  const { error } = await client.from('bak_links').delete().eq('user_a', a).eq('user_b', b);
  if (error) return { error: linkErrorText(error.message) };
  return { ok: true };
}
