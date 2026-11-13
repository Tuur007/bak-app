import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunGuard, fetchWithTimeout } from '../src/services/runGuard';
import { isNetworkError } from '../src/domain/errors';

test('één ronde tegelijk: een tweede begint niet zolang de eerste loopt', () => {
  const g = createRunGuard(60_000);
  const a = g.begin(1000);
  assert.notEqual(a, null);
  assert.equal(g.begin(2000), null);
  g.end(a!);
  assert.notEqual(g.begin(3000), null);
});

test('een vastgelopen ronde blokkeert de volgende niet voor altijd', () => {
  // Louise voedt, het scherm gaat dicht, het verzoek komt nooit terug. De volgende ochtend moet de app weer synchroniseren.
  const g = createRunGuard(60_000);
  const hung = g.begin(0)!;
  assert.equal(g.begin(59_000), null, 'binnen de minuut wachten we nog');
  const next = g.begin(8 * 3_600_000);
  assert.notEqual(next, null, 'daarna mag een nieuwe ronde beginnen');
  assert.equal(g.isCurrent(hung), false, 'de oude ronde telt niet meer');
  assert.equal(g.isCurrent(next!), true);
});

test('een opgegeven ronde die toch nog eindigt, geeft de nieuwe niet vrij', () => {
  const g = createRunGuard(60_000);
  const hung = g.begin(0)!;
  const next = g.begin(100_000)!;
  g.end(hung);
  assert.equal(g.begin(100_001), null, 'de nieuwe ronde loopt nog');
  g.end(next);
  assert.notEqual(g.begin(100_002), null);
});

test('een verzoek dat nooit antwoordt, eindigt met een netwerkfout', async () => {
  const never = (_i: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
  const f = fetchWithTimeout(never, 20);
  await assert.rejects(f('https://voorbeeld.test'), (e: Error) => isNetworkError(e.message));
});

test('een gewoon antwoord komt ongewijzigd door', async () => {
  const ok = async (): Promise<Response> => new Response('ja', { status: 200 });
  const r = await fetchWithTimeout(ok, 1000)('https://voorbeeld.test');
  assert.equal(await r.text(), 'ja');
});

import { autoFeedId } from '../src/domain/ids';

test('automatische voeding: hetzelfde moment geeft op elk toestel hetzelfde id', () => {
  const a = autoFeedId('2026-11-12T16:30:00.000Z');
  assert.equal(a, autoFeedId('2026-11-12T16:30:00.000Z'));
  assert.notEqual(a, autoFeedId('2026-11-13T16:30:00.000Z'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});
