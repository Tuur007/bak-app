// De pushroute (api/push/send.js) met een nagemaakte web-push: wat komt aan, wat mislukt, wat is verlopen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SECRET = 'x'.repeat(40);

type Behaviour = (endpoint: string) => { ok: true } | { statusCode?: number; code?: string };
let behaviour: Behaviour = () => ({ ok: true });
const calls: { endpoint: string; opts: Record<string, unknown> }[] = [];

// web-push vervangen voor het script geladen wordt
const webpushPath = require.resolve('web-push');
require.cache[webpushPath] = {
  id: webpushPath, filename: webpushPath, loaded: true, children: [], paths: [],
  exports: {
    setVapidDetails: () => undefined,
    sendNotification: async (sub: { endpoint: string }, _payload: string, opts: Record<string, unknown>) => {
      calls.push({ endpoint: sub.endpoint, opts });
      const r = behaviour(sub.endpoint);
      if (!('ok' in r)) throw Object.assign(new Error('push'), r);
    },
  },
} as unknown as NodeJS.Module;
const handler = require('../api/push/send.js') as (req: unknown, res: unknown) => Promise<unknown>;

function run(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }, method = 'POST') {
  process.env.CRON_SECRET = SECRET;
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  return new Promise<{ status: number; json: Record<string, unknown> | null }>((resolve) => {
    const res = {
      statusCode: 200,
      status(c: number) { this.statusCode = c; return this; },
      json(j: Record<string, unknown>) { resolve({ status: this.statusCode, json: j }); },
      send() { resolve({ status: this.statusCode, json: null }); },
    };
    void handler({ method, headers, body }, res);
  });
}

const sub = (n: string) => ({ endpoint: `https://push.test/${n}`, p256dh: 'p', auth: 'a' });
const item = (subs: ReturnType<typeof sub>[]) => ({ tag: 'bak:1', title: 'Bâtard', body: 'Nu: vouwen', url: '/plan', subs });

test('zonder het juiste geheim doet de route niets', async () => {
  calls.length = 0;
  assert.equal((await run([item([sub('a')])], { authorization: 'Bearer fout' })).status, 401);
  assert.equal((await run([item([sub('a')])], {})).status, 401);
  assert.equal((await run([item([sub('a')])], { authorization: `Bearer ${SECRET}` }, 'GET')).status, 405);
  assert.equal(calls.length, 0);
});

test('ongeldige gegevens worden geweigerd (geen http-adres, url zonder schuine streep)', async () => {
  assert.equal((await run([item([{ ...sub('a'), endpoint: 'http://push.test/a' }])])).status, 400);
  assert.equal((await run([{ ...item([sub('a')]), url: 'plan' }])).status, 400);
  assert.equal((await run('geen lijst')).status, 400);
});

test('verzenden: aangekomen, verlopen (404/410) en mislukt worden apart geteld, met de foutcode', async () => {
  calls.length = 0;
  behaviour = (e) => (e.endsWith('/ok') ? { ok: true } : e.endsWith('/weg') ? { statusCode: 410 } : e.endsWith('/stuk') ? { statusCode: 503 } : { code: 'ETIMEDOUT' });
  const r = await run([item([sub('ok'), sub('weg'), sub('stuk'), sub('traag')])]);
  assert.equal(r.status, 200);
  assert.equal(r.json?.sent, 1);
  assert.equal(r.json?.failed, 2);
  assert.equal(r.json?.gone, 1);
  assert.deepEqual(r.json?.goneEndpoints, ['https://push.test/weg']);
  assert.deepEqual(r.json?.errors, { '503': 1, ETIMEDOUT: 1 });
});

test('elke verzending heeft een time-out onder die van pg_net en een korte levensduur', async () => {
  calls.length = 0;
  behaviour = () => ({ ok: true });
  await run([item([sub('a')])]);
  assert.equal(calls[0].opts.timeout, 10000);
  assert.equal(calls[0].opts.TTL, 1800);
  assert.equal(calls[0].opts.urgency, 'high');
});

test('meerdere wekkers en toestellen in één aanvraag', async () => {
  calls.length = 0;
  behaviour = () => ({ ok: true });
  const r = await run([item([sub('a'), sub('b')]), { ...item([sub('c')]), tag: 'bak:2' }]);
  assert.equal(r.json?.sent, 3);
  assert.equal(calls.length, 3);
});
