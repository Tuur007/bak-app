import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPeers, linkErrorText, peerName, peerOf, type LinkedRow, type LinkRow } from '../src/domain/peers.ts';
import { createLinkCode, fetchPeers, myLinkCode, redeemLinkCode, unlinkPeer } from '../src/services/peers.ts';
import { mergeRemote, type MergeTarget } from '../src/store/merge.ts';
import { defaultSettings, defaultStarter } from '../src/domain/defaults.ts';

const ME = '22222222-2222-4222-8222-222222222222';
const HER = '11111111-1111-4111-8111-111111111111';
const link: LinkRow = { user_a: HER, user_b: ME, created_at: '2026-11-06T09:00:00Z' };

const starterRow = (owner: string, name: string, updatedAt: string): LinkedRow => ({
  owner, id: '00000000-0000-4000-8000-0000000057a7', kind: 'starter', updated_at: updatedAt,
  data: { id: '00000000-0000-4000-8000-0000000057a7', name, startedOn: '2026-10-16', updatedAt },
});
const feedRow = (owner: string, id: string, fedAt: string, extra: object = {}): LinkedRow => ({
  owner, id, kind: 'feed', updated_at: fedAt, data: { id, fedAt, ratio: '1:5:5', updatedAt: fedAt, ...extra },
});

test('peerOf geeft de ander, van welke kant ook', () => {
  assert.equal(peerOf(link, ME), HER);
  assert.equal(peerOf(link, HER), ME);
});

test('buildPeers: starter en voedingen van de ander, voedingen oudste eerst', () => {
  const rows = [
    feedRow(HER, 'f2', '2026-11-05T18:00:00Z'),
    starterRow(HER, 'Jean Flore', '2026-11-05T10:00:00Z'),
    feedRow(HER, 'f1', '2026-11-04T18:00:00Z'),
  ];
  const [p] = buildPeers([link], rows, ME, '2026-11-06T10:00:00Z');
  assert.equal(p.userId, HER);
  assert.equal(p.starter?.name, 'Jean Flore');
  assert.deepEqual(p.feeds.map((f) => f.id), ['f1', 'f2']);
  assert.equal(p.pulledAt, '2026-11-06T10:00:00Z');
});

test('buildPeers: rijen van andere eigenaars, verwijderde voedingen en rommel vallen weg', () => {
  const rows: LinkedRow[] = [
    starterRow('derde', 'Vreemd', '2026-11-05T10:00:00Z'),
    feedRow(HER, 'weg', '2026-11-04T18:00:00Z', { deletedAt: '2026-11-04T19:00:00Z' }),
    { owner: HER, id: 'x', kind: 'feed', updated_at: 'x', data: 'kapot' },
    { owner: HER, id: 'y', kind: 'recipe', updated_at: 'x', data: { id: 'y', updatedAt: 'x' } },
  ];
  const [p] = buildPeers([link], rows, ME, 'nu');
  assert.equal(p.starter, null);
  assert.deepEqual(p.feeds, []);
});

test('buildPeers: zonder koppelingen geen peers', () => {
  assert.deepEqual(buildPeers([], [starterRow(HER, 'Jean', 'a')], ME, 'nu'), []);
});

test('peerName: de naam van de starter, met "(de andere)" bij dezelfde naam', () => {
  const [p] = buildPeers([link], [starterRow(HER, 'Jean Flore', 'a')], ME, 'nu');
  assert.equal(peerName(p, 'Jean Tuur'), 'Jean Flore');
  assert.equal(peerName(p, 'jean flore'), 'Jean Flore (de andere)');
  const [leeg] = buildPeers([link], [], ME, 'nu');
  assert.equal(peerName(leeg, 'Jean Tuur'), 'Gekoppelde starter');
});

test('linkErrorText: leesbare meldingen', () => {
  assert.match(linkErrorText('Deze code klopt niet of is verlopen'), /verlopen/);
  assert.match(linkErrorText('Dit is je eigen code: geef ze aan de ander'), /eigen code/);
  assert.match(linkErrorText('boem'), /boem/);
});

test('de starter van de ander overschrijft nooit je eigen starter (zelfde vaste id)', () => {
  // Wat bak_get_linked teruggeeft gaat via buildPeers, niet via mergeRemote: de winkel van jezelf blijft heel.
  const own = defaultStarter('2026-11-05T11:00:00Z');
  own.name = 'Jean Tuur';
  const target: MergeTarget = { seeded: true, starter: own, feeds: [], recipes: [], bakes: [], away: [], settings: defaultSettings() };
  buildPeers([link], [starterRow(HER, 'Jean Flore', '2026-11-06T09:00:00Z')], ME, 'nu');
  assert.equal(target.starter?.name, 'Jean Tuur');
  // ter vergelijking: dezelfde rij door mergeRemote zou wel overschrijven. Daarom lopen peers apart.
  mergeRemote(target, [{ id: 'x', kind: 'starter', updated_at: 'n', data: starterRow(HER, 'Jean Flore', '2026-11-06T09:00:00Z').data }]);
  assert.equal(target.starter?.name, 'Jean Flore');
});

// Nepclient met de aanroepen die fetchPeers en co gebruiken.
function fakeClient(opts: { links?: LinkRow[]; rows?: LinkedRow[]; rpcError?: string; linksError?: string }) {
  const calls: string[] = [];
  const deletes: Record<string, string>[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select: async () => (opts.linksError ? { data: null, error: { message: opts.linksError } } : { data: opts.links ?? [], error: null }),
        delete: () => {
          const eqs: Record<string, string> = {};
          const q = { eq(c: string, v: string) { eqs[c] = v; if (Object.keys(eqs).length === 2) deletes.push(eqs); return Object.keys(eqs).length === 2 ? Promise.resolve({ error: null }) : q; } };
          return q;
        },
      };
    },
    async rpc(name: string) {
      calls.push(`rpc:${name}`);
      if (opts.rpcError) return { data: null, error: { message: opts.rpcError } };
      if (name === 'bak_get_linked') return { data: opts.rows ?? [], error: null };
      return { data: null, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls, deletes };
}

test('fetchPeers: zonder koppeling wordt de functie niet eens aangeroepen', async () => {
  const f = fakeClient({ links: [] });
  assert.deepEqual(await fetchPeers(f.client, ME), []);
  assert.deepEqual(f.calls, ['from:bak_links']);
});

test('fetchPeers: haalt koppelingen en rijen op', async () => {
  const f = fakeClient({ links: [link], rows: [starterRow(HER, 'Jean Flore', 'a')] });
  const peers = await fetchPeers(f.client, ME, new Date('2026-11-06T10:00:00Z'));
  assert.equal(peers.length, 1);
  assert.equal(peers[0].starter?.name, 'Jean Flore');
  assert.deepEqual(f.calls, ['from:bak_links', 'rpc:bak_get_linked']);
});

test('fetchPeers: een fout wordt doorgegeven (sync vangt ze op)', async () => {
  await assert.rejects(fetchPeers(fakeClient({ linksError: 'kapot' }).client, ME), /kapot/);
  await assert.rejects(fetchPeers(fakeClient({ links: [link], rpcError: 'kapot' }).client, ME), /kapot/);
});

test('redeemLinkCode: lege code en fout van de databank', async () => {
  assert.deepEqual(await redeemLinkCode(fakeClient({}).client, '  '), { error: 'Vul de code van de ander in.' });
  const r = await redeemLinkCode(fakeClient({ rpcError: 'Deze code klopt niet of is verlopen' }).client, 'ABC');
  assert.ok('error' in r && /verlopen/.test(r.error));
  assert.deepEqual(await redeemLinkCode(fakeClient({}).client, 'abc'), { ok: true });
});

test('unlinkPeer: gebruikt het genormaliseerde paar (kleinste eerst), ongeacht wie ontkoppelt', async () => {
  const a = fakeClient({});
  await unlinkPeer(a.client, ME, HER);
  const b = fakeClient({});
  await unlinkPeer(b.client, HER, ME);
  assert.deepEqual(a.deletes[0], { user_a: HER, user_b: ME });
  assert.deepEqual(b.deletes[0], { user_a: HER, user_b: ME });
});

// Nepclient voor de koppelcode: onthoudt met welke argumenten de functies aangeroepen worden.
function codeClient(answers: Record<string, { data: unknown; error: { message: string } | null }>) {
  const calls: [string, unknown][] = [];
  const client = { async rpc(name: string, args?: unknown) { calls.push([name, args]); return answers[name] ?? { data: null, error: { message: 'Could not find the function in the schema cache' } }; } };
  return { client: client as unknown as SupabaseClient, calls };
}

test('createLinkCode: gewoon vragen gebruikt geen parameter (bestaande code terug), nieuwe code met p_new', async () => {
  const c = codeClient({ bak_create_link_code: { data: 'ABCDEF1234', error: null } });
  assert.deepEqual(await createLinkCode(c.client), { code: 'ABCDEF1234' });
  assert.deepEqual(await createLinkCode(c.client, true), { code: 'ABCDEF1234' });
  assert.deepEqual(c.calls, [['bak_create_link_code', undefined], ['bak_create_link_code', { p_new: true }]]);
});

test('myLinkCode: leest de geldige code, of null', async () => {
  const ok = codeClient({ bak_my_link_code: { data: [{ code: 'ABCDEF1234', expires_at: '2026-11-07T07:24:04Z' }], error: null } });
  assert.deepEqual(await myLinkCode(ok.client), { code: 'ABCDEF1234', expiresAt: '2026-11-07T07:24:04Z' });
  assert.equal(await myLinkCode(codeClient({ bak_my_link_code: { data: [], error: null } }).client), null);
  // oudere databank zonder de functie: geen code, geen fout
  assert.equal(await myLinkCode(codeClient({}).client), null);
});
