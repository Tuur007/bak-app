import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runSync, syncReminders, type SyncIO } from '../src/services/syncCore.ts';
import type { Reminder } from '../src/domain/reminders.ts';
import type { RemoteItem } from '../src/store/merge.ts';

// Een kleine nepdatabank met het gedrag dat ertoe doet: sleutel (user_id, id), de trigger die een
// oudere wijziging negeert, servertijd per rij, en de filters die de app gebruikt.
type Row = Record<string, unknown>;
class FakeDb {
  tables: Record<string, Row[]> = { bak_items: [], bak_reminders: [] };
  clock = 1_000;
  failOn: string | null = null;
  calls: string[] = [];
  from(table: string) { return new Query(this, table); }
}
class Query {
  private op: 'select' | 'delete' | 'upsert' = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private rows: Row[] = [];
  private conflict = 'user_id,id';
  private lim = Infinity;
  private sortBy: string | null = null;
  constructor(private db: FakeDb, private table: string) {}
  select() { this.op = 'select'; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(rows: Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.rows = rows; if (opts?.onConflict) this.conflict = opts.onConflict; return this; }
  order(col: string) { this.sortBy = col; return this; }
  limit(n: number) { this.lim = n; return this; }
  gt(col: string, v: string) { this.filters.push((r) => String(r[col]) > v); return this; }
  is(col: string, v: null) { this.filters.push((r) => (r[col] ?? null) === v); return this; }
  in(col: string, vs: string[]) { this.filters.push((r) => vs.includes(String(r[col]))); return this; }
  then(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => void) { resolve(this.exec()); }
  private exec(): { data: Row[] | null; error: { message: string } | null } {
    const t = this.db.tables[this.table];
    this.db.calls.push(`${this.op}:${this.table}`);
    if (this.db.failOn === `${this.op}:${this.table}`) return { data: null, error: { message: 'boem' } };
    if (this.op === 'upsert') {
      const keys = this.conflict.split(',');
      for (const r of this.rows) {
        const i = t.findIndex((x) => keys.every((k) => x[k] === r[k]));
        if (i >= 0) {
          // de trigger: een oudere wijziging overschrijft nooit een nieuwere
          if (this.table === 'bak_items' && String(r.updated_at) < String(t[i].updated_at)) continue;
          t[i] = { ...t[i], ...r, ...(this.table === 'bak_items' ? { server_updated_at: String(++this.db.clock) } : {}) };
        } else t.push({ ...r, ...(this.table === 'bak_items' ? { server_updated_at: String(++this.db.clock) } : {}) });
      }
      return { data: null, error: null };
    }
    const hit = t.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === 'delete') { this.db.tables[this.table] = t.filter((r) => !hit.includes(r)); return { data: null, error: null }; }
    const sorted = this.sortBy ? [...hit].sort((a, b) => String(a[this.sortBy!]).localeCompare(String(b[this.sortBy!]), undefined, { numeric: true })) : hit;
    return { data: sorted.slice(0, this.lim), error: null };
  }
}

const asClient = (db: FakeDb): SupabaseClient => db as unknown as SupabaseClient;
const item = (id: string, kind: RemoteItem['kind'], updatedAt: string): RemoteItem => ({ id, kind, data: { id, updatedAt }, updated_at: updatedAt });

function makeIO(over: { dirty?: string[]; items?: Record<string, RemoteItem>; wantedReminders?: () => Reminder[] } = {}) {
  const log = { cleared: [] as string[], applied: [] as RemoteItem[], serverTime: null as string | null };
  let since: string | null = null;
  const io: SyncIO = {
    dirty: () => over.dirty ?? [],
    itemFor: (k) => over.items?.[k] ?? null,
    clearDirty: (k) => { log.cleared.push(...k); },
    lastPulledAt: () => since,
    applyRemote: (items, t) => { log.applied.push(...items); log.serverTime = t; since = t; },
    wantedReminders: over.wantedReminders ?? (() => []),
  };
  return { io, log };
}

test('eigen wijzigingen worden verstuurd met user_id, daarna pas gewist', async () => {
  const db = new FakeDb();
  const { io, log } = makeIO({ dirty: ['feed:f1', 'bake:b1'], items: { 'feed:f1': item('f1', 'feed', '2026-11-02T10:00:00Z'), 'bake:b1': item('b1', 'bake', '2026-11-02T11:00:00Z') } });
  const r = await runSync(asClient(db), 'u1', io);
  assert.equal(r.pushed, 2);
  assert.deepEqual(db.tables.bak_items.map((x) => [x.user_id, x.id]), [['u1', 'f1'], ['u1', 'b1']]);
  assert.deepEqual(log.cleared.sort(), ['bake:b1', 'feed:f1']);
});

test('mislukt versturen: de fout komt boven en niets wordt als verstuurd gemarkeerd', async () => {
  const db = new FakeDb();
  db.failOn = 'upsert:bak_items';
  const { io, log } = makeIO({ dirty: ['feed:f1'], items: { 'feed:f1': item('f1', 'feed', '2026-11-02T10:00:00Z') } });
  await assert.rejects(() => runSync(asClient(db), 'u1', io), /boem/);
  assert.deepEqual(log.cleared, [], 'wijziging blijft in de wachtrij');
});

test('ophalen op servertijd: eerst alles, daarna enkel wat nieuw is', async () => {
  const db = new FakeDb();
  db.tables.bak_items = [
    { user_id: 'u1', id: 'a', kind: 'feed', data: { id: 'a', updatedAt: '1' }, updated_at: '1', server_updated_at: '10' },
    { user_id: 'u1', id: 'b', kind: 'feed', data: { id: 'b', updatedAt: '2' }, updated_at: '2', server_updated_at: '20' },
  ];
  const { io, log } = makeIO();
  let r = await runSync(asClient(db), 'u1', io);
  assert.equal(r.pulled, 2);
  assert.equal(log.serverTime, '20');
  db.tables.bak_items.push({ user_id: 'u1', id: 'c', kind: 'feed', data: { id: 'c', updatedAt: '3' }, updated_at: '3', server_updated_at: '30' });
  r = await runSync(asClient(db), 'u1', io);
  assert.equal(r.pulled, 1, 'enkel het nieuwe item');
  assert.equal(log.applied.at(-1)?.id, 'c');
});

test('een oudere lokale wijziging overschrijft de nieuwere in de databank niet', async () => {
  const db = new FakeDb();
  db.tables.bak_items = [{ user_id: 'u1', id: 'f1', kind: 'feed', data: { id: 'f1', v: 'nieuw' }, updated_at: '2026-11-03T10:00:00Z', server_updated_at: '5' }];
  const { io } = makeIO({ dirty: ['feed:f1'], items: { 'feed:f1': { id: 'f1', kind: 'feed', data: { id: 'f1', v: 'oud' }, updated_at: '2026-11-01T10:00:00Z' } } });
  await runSync(asClient(db), 'u1', io);
  assert.equal((db.tables.bak_items[0].data as { v: string }).v, 'nieuw');
});

const rem = (id: string, due: string, body = 'Nu: vouwen'): Reminder => ({ id, dueAt: due, title: 'Bâtard', body, url: '/plan' });

test('wekkers: nieuwe erbij, verdwenen weg, ongewijzigde met rust gelaten', async () => {
  const db = new FakeDb();
  db.tables.bak_reminders = [
    { user_id: 'u1', id: 'a', due_at: '2026-11-05T10:00:00+00:00', title: 'Bâtard', body: 'Nu: vouwen', url: '/plan', sent_at: null },
    { user_id: 'u1', id: 'oud', due_at: '2026-11-05T09:00:00+00:00', title: 'Bâtard', body: 'Nu: vouwen', url: '/plan', sent_at: null },
    { user_id: 'u1', id: 'verstuurd', due_at: '2026-11-01T09:00:00+00:00', title: 'Bâtard', body: 'x', url: '/plan', sent_at: '2026-11-01T09:00:10Z' },
  ];
  await syncReminders(asClient(db), [rem('a', '2026-11-05T10:00:00.000Z'), rem('b', '2026-11-05T11:00:00.000Z')]);
  assert.deepEqual(db.tables.bak_reminders.map((r) => r.id).sort(), ['a', 'b', 'verstuurd']);
  assert.ok(db.calls.filter((c) => c === 'upsert:bak_reminders').length === 1, 'enkel b is geschreven');
});

test('testmeldingen worden door de planning nooit gewist', async () => {
  const db = new FakeDb();
  db.tables.bak_reminders = [{ user_id: 'u1', id: 'test:123', due_at: '2026-11-05T10:00:00+00:00', title: 'Crumbly', body: 'Test', url: '/', sent_at: null }];
  await syncReminders(asClient(db), []);
  assert.equal(db.tables.bak_reminders.length, 1);
});

test('gekoppelde starters: een fout bij het ophalen laat de gewone sync niet falen', async () => {
  const db = new FakeDb(); // heeft geen tabel bak_links: het ophalen van peers faalt
  const { io } = makeIO({ dirty: ['feed:f1'], items: { 'feed:f1': item('f1', 'feed', '2026-11-02T10:00:00Z') } });
  let applied = 0;
  io.applyPeers = () => { applied++; };
  const r = await runSync(asClient(db), 'u1', io);
  assert.equal(r.pushed, 1);
  assert.equal(applied, 0, 'de vorige stand blijft staan');
});

test('gekoppelde starters: zonder koppelingen wordt de lijst leeggemaakt', async () => {
  const db = new FakeDb();
  db.tables.bak_links = [];
  const { io } = makeIO();
  let got: unknown = 'niet aangeroepen';
  io.applyPeers = (p) => { got = p; };
  await runSync(asClient(db), 'u1', io);
  assert.deepEqual(got, []);
});

test('eerste sync zonder iets op te halen: toch genoteerd als opgehaald', async () => {
  const db = new FakeDb();
  const { io, log } = makeIO();
  await runSync(asClient(db), 'u1', io);
  assert.equal(log.serverTime, '1970-01-01T00:00:00.000Z');
});
