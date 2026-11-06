import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildHousehold, feederName, householdErrorText, NO_HOUSEHOLD, resolveDataId, type HouseholdMemberRow } from '../src/domain/household.ts';
import { createHouseholdCode, fetchHousehold, joinHousehold, myHouseholdCode, removeMembership } from '../src/services/household.ts';
import { feedSummary } from '../src/domain/location.ts';

const TUUR = '11111111-1111-4111-8111-111111111111';
const LOUISE = '22222222-2222-4222-8222-222222222222';
const row = (member: string, name: string, joined = '2026-11-06T09:00:00Z'): HouseholdMemberRow => ({ owner: TUUR, member, display_name: name, joined_at: joined });

test('geen rijen: geen gezin, ik werk op mijn eigen gegevens', () => {
  assert.deepEqual(buildHousehold(TUUR, []), NO_HOUSEHOLD(TUUR));
});

test('lid: ik werk op de gegevens van de eigenaar, met mijn naam', () => {
  const h = buildHousehold(LOUISE, [row(LOUISE, 'Louise')]);
  assert.equal(h.role, 'lid');
  assert.equal(h.dataId, TUUR);
  assert.equal(h.myName, 'Louise');
});

test('eigenaar: ik zie mijn leden, oudste eerst, en werk op mijn eigen gegevens', () => {
  const h = buildHousehold(TUUR, [row(LOUISE, 'Louise', '2026-11-07T09:00:00Z'), row('33333333-3333-4333-8333-333333333333', 'Oma', '2026-11-06T09:00:00Z')]);
  assert.equal(h.role, 'eigenaar');
  assert.equal(h.dataId, TUUR);
  assert.deepEqual(h.members.map((m) => m.name), ['Oma', 'Louise']);
});

test('gegevens: lukt het ophalen van het gezin niet, dan blijft het toestel bij de laatste gegevens', () => {
  assert.equal(resolveDataId(LOUISE, null, TUUR), TUUR, 'een lid verspringt niet naar zijn eigen lege gegevens');
  assert.equal(resolveDataId(LOUISE, null, null), LOUISE, 'nog nooit gesynchroniseerd: mijn eigen');
  assert.equal(resolveDataId(LOUISE, buildHousehold(LOUISE, []), TUUR), LOUISE, 'verlaten: terug naar mijn eigen');
  assert.equal(resolveDataId(LOUISE, buildHousehold(LOUISE, [row(LOUISE, 'Louise')]), LOUISE), TUUR, 'net bij het gezin gekomen');
});

test('naam bij een voeding: enkel als er een gezin is', () => {
  assert.equal(feederName(null, 'Tuur'), undefined);
  assert.equal(feederName(NO_HOUSEHOLD(TUUR), 'Tuur'), undefined, 'alleen: geen naam erbij');
  assert.equal(feederName(buildHousehold(LOUISE, [row(LOUISE, 'Louise')]), null), 'Louise');
  assert.equal(feederName(buildHousehold(TUUR, [row(LOUISE, 'Louise')]), ' Tuur '), 'Tuur');
  assert.equal(feederName(buildHousehold(TUUR, [row(LOUISE, 'Louise')]), null), undefined, 'eigenaar zonder naam');
});

test('een voeding toont wie ze noteerde', () => {
  const f = { id: 'f', fedAt: '2026-11-06T08:00:00Z', ratio: '1:5:5', by: 'Louise', updatedAt: '' };
  assert.match(feedSummary(f), /door Louise/);
  assert.doesNotMatch(feedSummary({ ...f, by: undefined }), /door/);
});

test('foutmeldingen in gewone taal', () => {
  assert.match(householdErrorText('Deze code klopt niet of is verlopen'), /verlopen/);
  assert.match(householdErrorText('Je zit al in een gezin. Verlaat dat eerst'), /Verlaat/);
  assert.match(householdErrorText('Could not find the function public.bak_join_household in the schema cache'), /nog niet klaar/);
});

function client(over: { rows?: HouseholdMemberRow[]; rpc?: Record<string, { data?: unknown; error?: string }> } = {}) {
  const calls: unknown[][] = [];
  const c = {
    from(table: string) {
      return {
        select: async () => ({ data: over.rows ?? [], error: null, table }),
        delete: () => { const eqs: Record<string, string> = {}; const q = { eq(k: string, v: string) { eqs[k] = v; if (Object.keys(eqs).length === 2) { calls.push(['delete', table, eqs]); return Promise.resolve({ error: null }); } return q; } }; return q; },
      };
    },
    async rpc(name: string, args?: unknown) { calls.push([name, args]); const r = over.rpc?.[name]; return r?.error ? { data: null, error: { message: r.error } } : { data: r?.data ?? null, error: null }; },
  };
  return { c: c as unknown as SupabaseClient, calls };
}

test('fetchHousehold, codes, joinen en verlaten roepen de juiste functies aan', async () => {
  const k = client({ rows: [row(LOUISE, 'Louise')], rpc: { bak_create_household_code: { data: 'ABCDEF1234' }, bak_my_household_code: { data: [{ code: 'ABCDEF1234', expires_at: '2026-11-07T09:00:00Z' }] } } });
  assert.equal((await fetchHousehold(k.c, LOUISE)).role, 'lid');
  assert.deepEqual(await createHouseholdCode(k.c), { ok: true, code: 'ABCDEF1234' });
  assert.deepEqual(await myHouseholdCode(k.c), { code: 'ABCDEF1234', expiresAt: '2026-11-07T09:00:00Z' });
  assert.deepEqual(await joinHousehold(k.c, ' abcdef1234 ', ' Louise '), { ok: true });
  assert.deepEqual(await removeMembership(k.c, TUUR, LOUISE), { ok: true });
  assert.deepEqual(k.calls.filter((x) => x[0] === 'bak_join_household'), [['bak_join_household', { p_code: 'abcdef1234', p_name: 'Louise' }]]);
  assert.deepEqual(k.calls.at(-1), ['delete', 'bak_household_members', { owner: TUUR, member: LOUISE }]);
});

test('joinen: lege invoer en fouten van de databank', async () => {
  assert.deepEqual(await joinHousehold(client().c, '', 'Louise'), { error: 'Vul de gezinscode in.' });
  assert.deepEqual(await joinHousehold(client().c, 'ABC', '  '), { error: 'Vul je naam in.' });
  const r = await joinHousehold(client({ rpc: { bak_join_household: { error: 'Deze code klopt niet of is verlopen' } } }).c, 'ABC', 'Louise');
  assert.ok('error' in r && /verlopen/.test(r.error));
  const net = await joinHousehold(client({ rpc: { bak_join_household: { error: 'TypeError: Load failed' } } }).c, 'ABC', 'Louise');
  assert.ok('error' in net && /VPN/.test(net.error));
  assert.equal(await myHouseholdCode(client().c), null, 'oudere databank: geen code, geen fout');
});
