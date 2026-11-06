// Het gezin in de databank: wie werkt op wiens gegevens. De databankclient komt als parameter binnen
// (getest in tests/household.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildHousehold, householdErrorText, type HouseholdMemberRow, type HouseholdState } from '../domain/household';
import { friendlyError, isNetworkError } from '../domain/errors';

export async function fetchHousehold(client: SupabaseClient, me: string): Promise<HouseholdState> {
  const { data, error } = await client.from('bak_household_members').select('owner, member, display_name, joined_at');
  if (error) throw new Error(error.message);
  return buildHousehold(me, (data ?? []) as HouseholdMemberRow[]);
}

type Result<T> = ({ ok: true } & T) | { error: string };

const fail = (message: string): { error: string } => ({ error: isNetworkError(message) ? friendlyError(message) : householdErrorText(message) });

export async function createHouseholdCode(client: SupabaseClient): Promise<Result<{ code: string }>> {
  const { data, error } = await client.rpc('bak_create_household_code');
  if (error) return fail(error.message);
  return { ok: true, code: String(data) };
}

export interface HouseholdCode {
  code: string;
  expiresAt: string;
}

export async function myHouseholdCode(client: SupabaseClient): Promise<HouseholdCode | null> {
  try {
    const { data, error } = await client.rpc('bak_my_household_code');
    if (error) return null;
    const row = (Array.isArray(data) ? data[0] : data) as { code?: unknown; expires_at?: unknown } | null | undefined;
    if (!row || typeof row.code !== 'string' || typeof row.expires_at !== 'string') return null;
    return { code: row.code, expiresAt: row.expires_at };
  } catch {
    return null;
  }
}

export async function joinHousehold(client: SupabaseClient, code: string, name: string): Promise<Result<object>> {
  if (code.trim() === '') return { error: 'Vul de gezinscode in.' };
  if (name.trim() === '') return { error: 'Vul je naam in.' };
  const { error } = await client.rpc('bak_join_household', { p_code: code.trim(), p_name: name.trim() });
  if (error) return fail(error.message);
  return { ok: true };
}

/** Een lid verlaat het gezin, of de eigenaar zet een lid weg (beide mogen). */
export async function removeMembership(client: SupabaseClient, owner: string, member: string): Promise<Result<object>> {
  const { error } = await client.from('bak_household_members').delete().eq('owner', owner).eq('member', member);
  if (error) return fail(error.message);
  return { ok: true };
}
