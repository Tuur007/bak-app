// Regressietests voor de betrouwbaarheid van de synchronisatie. De nepdatabank volgt PostgreSQL waar het telt:
// - 'now()' is binnen één opdracht (transactie) voor alle rijen hetzelfde: een bulk-upsert geeft gelijke servertijden;
// - de trigger weigert een oudere wijziging stilletjes en bewaart de nieuwere rij;
// - upsert(...).select() geeft de rijen zoals ze opgeslagen werden;
// - sorteren op meerdere kolommen en een `or`-filter met `and(...)`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runSync, type SyncIO } from '../src/services/syncCore.ts';
import { mergeRemote, type MergeTarget, type RemoteItem } from '../src/store/merge.ts';
import { defaultSettings, defaultStarter } from '../src/domain/defaults.ts';
import type { Feed } from '../src/domain/types.ts';

type Row = Record<string, unknown>;

/** PostgREST geeft timestamptz terug als "2026-11-06T10:00:00.123+00:00", niet als "...123Z" zoals de app ze stuurt. */
function asPostgrest(r: Row): Row {
  const conv = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/Z$/, '+00:00') : v);
  return { ...r, updated_at: conv(r.updated_at), server_updated_at: conv(r.server_updated_at) };
}

class Db {
  items: Row[] = [];
  /** De 'transactietijd' van de volgende opdracht (ISO). */
  now = '2026-11-06T10:00:00.000Z';
  /** Een server die de samengestelde `or`-cursor niet begrijpt (antwoordt met een fout). */
  failOr = false;
  /** Wordt aangeroepen midden in een upsert (na het lezen, voor het antwoord): een gebruiker die intussen iets wijzigt. */
  duringPush: (() => void) | null = null;
  from(table: string) { return new Q(this, table); }
}
// Postgres vergelijkt tijden als momenten, niet als tekst: "…Z" en "…+00:00" zijn hetzelfde moment.
const TIME_COLS = new Set(['server_updated_at', 'updated_at']);
const cmp = (col: string, a: unknown, b: unknown): number => {
  if (TIME_COLS.has(col)) return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  return String(a).localeCompare(String(b));
};

class Q {
  private op: 'select' | 'upsert' = 'select';
  private rows: Row[] = [];
  private filters: ((r: Row) => boolean)[] = [];
  private orders: string[] = [];
  private lim = Infinity;
  private returning = false;
  private failed = false;
  constructor(private db: Db, private table: string) {}
  select() { if (this.op === 'upsert') this.returning = true; else this.op = 'select'; return this; }
  upsert(rows: Row[]) { this.op = 'upsert'; this.rows = rows; return this; }
  eq(c: string, v: string) { this.filters.push((r) => cmp(c, r[c], v) === 0); return this; }
  gte(c: string, v: string) { this.filters.push((r) => cmp(c, r[c], v) >= 0); return this; }
  gt(c: string, v: string) { this.filters.push((r) => cmp(c, r[c], v) > 0); return this; }
  order(c: string) { this.orders.push(c); return this; }
  limit(n: number) { this.lim = n; return this; }
  is() { return this; }
  // enkel de vorm die de app gebruikt: "a.gt.X,and(a.eq.X,b.gt.Y)"
  or(expr: string) {
    if (this.db.failOr) { this.failed = true; return this; }
    const m = expr.match(/^(\w+)\.gt\.(.+?),and\((\w+)\.eq\.(.+?),(\w+)\.gt\.(.+)\)$/);
    if (!m) throw new Error(`or-filter niet ondersteund: ${expr}`);
    const [, c1, v1, c2, v2, c3, v3] = m;
    this.filters.push((r) => cmp(c1, r[c1], v1) > 0 || (cmp(c2, r[c2], v2) === 0 && cmp(c3, r[c3], v3) > 0));
    return this;
  }
  then(resolve: (v: { data: Row[] | null; error: { message: string } | null }) => void) { resolve(this.exec()); }
  private exec() {
    if (this.table === 'bak_reminders') return { data: [], error: null };
    if (this.table === 'bak_links') return { data: [], error: null };
    if (this.failed) return { data: null, error: { message: 'unknown filter syntax' } };
    if (this.op === 'upsert') {
      const stored: Row[] = [];
      for (const r of this.rows) {
        const i = this.db.items.findIndex((x) => x.user_id === r.user_id && x.id === r.id);
        if (i >= 0) {
          // de trigger: een oudere wijziging verandert niets; de bestaande rij blijft staan
          if (cmp('updated_at', r.updated_at, this.db.items[i].updated_at) >= 0) this.db.items[i] = { ...r, server_updated_at: this.db.now };
        } else this.db.items.push({ ...r, server_updated_at: this.db.now });
        stored.push(asPostgrest({ ...this.db.items.find((x) => x.user_id === r.user_id && x.id === r.id)! }));
      }
      this.db.duringPush?.();
      this.db.duringPush = null;
      return { data: this.returning ? stored : null, error: null };
    }
    let list = this.db.items.filter((r) => this.filters.every((f) => f(r)));
    list = [...list].sort((a, b) => {
      for (const c of this.orders) { const d = cmp(c, a[c], b[c]); if (d !== 0) return d; }
      return 0;
    });
    return { data: list.slice(0, this.lim).map((r) => asPostgrest({ id: r.id, kind: r.kind, data: r.data, updated_at: r.updated_at, server_updated_at: r.server_updated_at })), error: null };
  }
}
const asClient = (db: Db): SupabaseClient => db as unknown as SupabaseClient;


// Een toestel: lokale winkel in het klein (de echte winkel gebruikt dezelfde samenvoeging).
class Device {
  state: MergeTarget = { seeded: true, starter: defaultStarter(), feeds: [], recipes: [], bakes: [], away: [], settings: defaultSettings() };
  dirty: string[] = [];
  cursorAt: string | null = null;
  cursorId: string | null = null;
  edit(feed: Feed): void {
    const i = this.state.feeds.findIndex((f) => f.id === feed.id);
    if (i >= 0) this.state.feeds[i] = feed; else this.state.feeds.push(feed);
    if (!this.dirty.includes(`feed:${feed.id}`)) this.dirty.push(`feed:${feed.id}`);
  }
  feed(id: string): Feed | undefined { return this.state.feeds.find((f) => f.id === id); }
  io(): SyncIO {
    return {
      dirty: () => [...this.dirty],
      itemFor: (k) => {
        const f = this.feed(k.split(':')[1]);
        return f ? { id: f.id, kind: 'feed', data: f, updated_at: f.updatedAt } : null;
      },
      clearDirty: (keys) => { this.dirty = this.dirty.filter((k) => !keys.includes(k)); },
      lastPulledAt: () => this.cursorAt,
      lastPulledId: () => this.cursorId,
      applyRemote: (items: RemoteItem[], serverTime: string | null, lastId?: string | null) => {
        mergeRemote(this.state, items);
        if (serverTime !== null && (this.cursorAt === null || new Date(serverTime).getTime() >= new Date(this.cursorAt).getTime())) { this.cursorAt = serverTime; this.cursorId = lastId ?? null; }
      },
      wantedReminders: () => [],
    } as SyncIO;
  }
  sync(db: Db): Promise<{ pushed: number; pulled: number }> { return runSync(asClient(db), 'u1', this.io()); }
}
const feed = (id: string, by: string, updatedAt: string): Feed => ({ id, fedAt: '2026-11-06T08:00:00.000Z', ratio: '1:5:5', by, updatedAt });

test('een geweigerde oudere wijziging (klok loopt achter): het toestel krijgt de nieuwere cloudversie terug', async () => {
  const db = new Db();
  const a = new Device(); const b = new Device();
  // B voedt om 10:00 volgens zijn klok en synchroniseert.
  b.edit(feed('f1', 'B', '2026-11-06T10:00:00.000Z')); await b.sync(db);
  // A haalt dat op (zijn cursor staat nu voorbij die rij), en wijzigt dan: zijn klok loopt achter, dus 09:55.
  await a.sync(db);
  assert.equal(a.feed('f1')?.by, 'B');
  a.edit(feed('f1', 'A', '2026-11-06T09:55:00.000Z'));
  db.now = '2026-11-06T10:05:00.000Z';
  await a.sync(db);
  // De databank bewaart B's (nieuwere) versie; A moet die ook tonen, niet blijven bij zijn geweigerde wijziging.
  assert.equal(db.items.find((r) => r.id === 'f1')?.updated_at, '2026-11-06T10:00:00.000Z');
  assert.equal(a.feed('f1')?.by, 'B', 'toestel A werkt niet langer op een verouderde versie');
  assert.deepEqual(a.dirty, []);
});

test('een wijziging tijdens het versturen blijft in de wachtrij (gaat niet verloren)', async () => {
  const db = new Db();
  const a = new Device();
  a.edit(feed('f1', 'A', '2026-11-06T10:00:00.000Z'));
  // Terwijl de upsert onderweg is, past de gebruiker dezelfde voeding opnieuw aan.
  db.duringPush = () => a.edit(feed('f1', 'A2', '2026-11-06T10:00:30.000Z'));
  await a.sync(db);
  assert.deepEqual(a.dirty, ['feed:f1'], 'de nieuwere lokale wijziging is nog niet verstuurd');
  db.now = '2026-11-06T10:01:00.000Z';
  await a.sync(db);
  assert.equal((db.items.find((r) => r.id === 'f1')?.data as Feed).by, 'A2', 'de tweede wijziging komt alsnog in de cloud');
  assert.deepEqual(a.dirty, []);
});

test('ophalen in pagina\'s: rijen met dezelfde servertijd worden niet overgeslagen', async () => {
  const db = new Db();
  // Eén bulk-upsert van 1200 rijen: allemaal dezelfde servertijd (zoals now() in één transactie).
  for (let i = 0; i < 1200; i++) {
    db.items.push({ user_id: 'u1', id: `id-${String(i).padStart(5, '0')}`, kind: 'feed', data: feed(`id-${String(i).padStart(5, '0')}`, 'X', '2026-11-06T09:00:00.000Z'), updated_at: '2026-11-06T09:00:00.000Z', server_updated_at: '2026-11-06T09:00:00.000Z' });
  }
  const a = new Device();
  const r = await a.sync(db);
  assert.equal(a.state.feeds.length, 1200, 'alle 1200 rijen staan op het toestel');
  assert.ok(r.pulled >= 1200);
});

test('een rij die later vastgelegd wordt maar een iets oudere servertijd heeft, wordt toch opgehaald', async () => {
  const db = new Db();
  const a = new Device();
  db.items.push({ user_id: 'u1', id: 'nieuw', kind: 'feed', data: feed('nieuw', 'B', '2026-11-06T09:59:50.000Z'), updated_at: '2026-11-06T09:59:50.000Z', server_updated_at: '2026-11-06T10:00:10.000Z' });
  await a.sync(db);
  assert.equal(new Date(a.cursorAt!).getTime(), new Date('2026-11-06T10:00:10.000Z').getTime());
  // Een transactie die om 10:00:00 begon, wordt pas na de ophaalronde vastgelegd.
  db.items.push({ user_id: 'u1', id: 'laat', kind: 'feed', data: feed('laat', 'C', '2026-11-06T09:59:55.000Z'), updated_at: '2026-11-06T09:59:55.000Z', server_updated_at: '2026-11-06T10:00:00.000Z' });
  await a.sync(db);
  assert.equal(a.feed('laat')?.by, 'C', 'de late rij is opgehaald dankzij het overlappende venster');
});

test('tweede toestel: gelijktijdige wijzigingen van verschillende voedingen komen allebei overal terecht', async () => {
  const db = new Db();
  const a = new Device(); const b = new Device();
  a.edit(feed('fa', 'A', '2026-11-06T10:00:00.000Z'));
  b.edit(feed('fb', 'B', '2026-11-06T10:00:01.000Z'));
  await a.sync(db); db.now = '2026-11-06T10:00:05.000Z'; await b.sync(db); db.now = '2026-11-06T10:00:10.000Z'; await a.sync(db);
  for (const d of [a, b]) {
    assert.equal(d.feed('fa')?.by, 'A');
    assert.equal(d.feed('fb')?.by, 'B');
  }
});

test('dezelfde voeding op twee toestellen: de laatste wijziging wint, op beide toestellen', async () => {
  const db = new Db();
  const a = new Device(); const b = new Device();
  a.edit(feed('f', 'A', '2026-11-06T10:00:00.000Z')); await a.sync(db);
  db.now = '2026-11-06T10:01:00.000Z'; await b.sync(db);
  a.edit(feed('f', 'A2', '2026-11-06T10:02:00.000Z'));
  b.edit(feed('f', 'B2', '2026-11-06T10:03:00.000Z'));
  db.now = '2026-11-06T10:04:00.000Z'; await a.sync(db);
  db.now = '2026-11-06T10:05:00.000Z'; await b.sync(db);
  db.now = '2026-11-06T10:06:00.000Z'; await a.sync(db);
  assert.equal(a.feed('f')?.by, 'B2');
  assert.equal(b.feed('f')?.by, 'B2');
  assert.equal((db.items.find((r) => r.id === 'f')?.data as Feed).by, 'B2');
});

test('begrijpt de server de samengestelde cursor niet, dan valt de sync terug op "vanaf dezelfde servertijd" en lukt het toch', async () => {
  const db = new Db();
  db.failOr = true;
  // 700 rijen met verschillende servertijden: meer dan één pagina, de tweede pagina gebruikt de samengestelde cursor.
  for (let i = 0; i < 700; i++) {
    const t = new Date(Date.UTC(2026, 10, 6, 9, 0, 0, i * 7)).toISOString();
    db.items.push({ user_id: 'u1', id: `id-${String(i).padStart(5, '0')}`, kind: 'feed', data: feed(`id-${String(i).padStart(5, '0')}`, 'X', t), updated_at: t, server_updated_at: t });
  }
  const a = new Device();
  await a.sync(db);
  assert.equal(a.state.feeds.length, 700, 'alle rijen staan op het toestel, ook zonder de samengestelde cursor');
});

test('de terugval loopt niet eindeloos als een hele pagina dezelfde servertijd heeft', async () => {
  const db = new Db();
  db.failOr = true;
  for (let i = 0; i < 1200; i++) {
    db.items.push({ user_id: 'u1', id: `id-${String(i).padStart(5, '0')}`, kind: 'feed', data: feed(`id-${String(i).padStart(5, '0')}`, 'X', '2026-11-06T09:00:00.000Z'), updated_at: '2026-11-06T09:00:00.000Z', server_updated_at: '2026-11-06T09:00:00.000Z' });
  }
  const a = new Device();
  const r = await a.sync(db); // moet eindigen (best effort: dit geval vraagt de samengestelde cursor)
  assert.ok(r.pulled >= 500);
});
