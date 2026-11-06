import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, defaultStarter, exampleRecipe, EXAMPLE_RECIPE_ID, STARTER_ID } from '../src/domain/defaults.ts';
import { mergeRemote, stampForRestore, type MergeTarget, type RemoteItem } from '../src/store/merge.ts';

function freshDevice(): MergeTarget {
  // Wat een nieuw toestel aanmaakt bij de eerste opstart.
  return { seeded: true, starter: defaultStarter(), feeds: [], recipes: [exampleRecipe()], bakes: [], away: [], settings: defaultSettings() };
}

const item = (kind: RemoteItem['kind'], data: object): RemoteItem => ({ id: (data as { id: string }).id, kind, data, updated_at: (data as { updatedAt: string }).updatedAt });

test('tweede toestel: echte starter, instellingen en recept uit de cloud winnen van de startgegevens', () => {
  const s = freshDevice();
  const realStarter = { ...defaultStarter('2026-11-02T10:00:00.000Z'), name: 'Jean', thresholdHours: 5, startedOn: '2026-10-16' };
  const realSettings = { ...defaultSettings('2026-11-02T10:00:00.000Z'), homeWindows: [{ day: 6, from: '08:00', to: '22:00' }], id: undefined } as unknown as ReturnType<typeof defaultSettings>;
  const realRecipe = { ...exampleRecipe('2026-11-02T10:00:00.000Z'), name: 'Bâtard uit Kometen Brood', isExample: false };
  mergeRemote(s, [
    item('starter', realStarter),
    { id: '00000000-0000-4000-8000-00000000c0de', kind: 'settings', data: realSettings, updated_at: realSettings.updatedAt },
    item('recipe', realRecipe),
  ]);
  assert.equal(s.starter?.thresholdHours, 5);
  assert.equal(s.settings.homeWindows.length, 1);
  assert.equal(s.recipes.length, 1, 'geen dubbel voorbeeldrecept');
  assert.equal(s.recipes[0].name, 'Bâtard uit Kometen Brood');
});

test('startgegevens hebben vaste id’s, dus geen dubbels', () => {
  assert.equal(defaultStarter().id, STARTER_ID);
  assert.equal(exampleRecipe().id, EXAMPLE_RECIPE_ID);
  assert.equal(defaultStarter().updatedAt, '1970-01-01T00:00:00.000Z');
});

test('een nieuwere lokale wijziging blijft staan; een nieuw item komt erbij', () => {
  const s = freshDevice();
  s.feeds.push({ id: 'f1', fedAt: '2026-11-02T08:00:00.000Z', ratio: '1:5:5', updatedAt: '2026-11-02T12:00:00.000Z' });
  mergeRemote(s, [
    item('feed', { id: 'f1', fedAt: '2026-11-02T07:00:00.000Z', ratio: '1:5:5', updatedAt: '2026-11-02T11:00:00.000Z' }),
    item('feed', { id: 'f2', fedAt: '2026-11-03T08:00:00.000Z', ratio: '1:5:5', updatedAt: '2026-11-03T08:00:00.000Z' }),
  ]);
  assert.equal(s.feeds.find((f) => f.id === 'f1')?.fedAt, '2026-11-02T08:00:00.000Z');
  assert.equal(s.feeds.length, 2);
});

test('rommel uit de cloud wordt genegeerd', () => {
  const s = freshDevice();
  const n = mergeRemote(s, [{ id: 'x', kind: 'feed', data: null, updated_at: '' }, { id: 'y', kind: 'bake', data: { nope: 1 }, updated_at: '' }]);
  assert.equal(n, 0);
});

test('instellingen uit de cloud (zonder id in de gegevens, zoals in de databank) komen binnen: welkom niet opnieuw', () => {
  const s = freshDevice();
  assert.equal(s.settings.onboarded, undefined);
  // Zo staan de instellingen echt in bak_items.data: geen id, wel updatedAt.
  const cloud = { homeWindows: [], feedReminder: false, onboarded: true, updatedAt: '2026-11-06T07:10:54.306Z' };
  mergeRemote(s, [{ id: '00000000-0000-4000-8000-00000000c0de', kind: 'settings', data: cloud, updated_at: cloud.updatedAt }]);
  assert.equal(s.settings.onboarded, true);
});

test('instellingen zonder tijd worden genegeerd', () => {
  const s = freshDevice();
  mergeRemote(s, [{ id: 'x', kind: 'settings', data: { onboarded: true }, updated_at: 'x' }]);
  assert.equal(s.settings.onboarded, undefined);
});

test('back-up terugzetten: de teruggezette gegevens winnen van nieuwere cloudgegevens', () => {
  // De back-up is van 1 november, de cloud is intussen aangepast (3 november).
  const backup = { starter: { ...defaultStarter('2026-11-01T10:00:00.000Z'), name: 'Jeanine' }, feeds: [{ id: 'f1', fedAt: '2026-11-01T08:00:00.000Z', ratio: '1:5:5', updatedAt: '2026-11-01T08:00:00.000Z' }], recipes: [], bakes: [], away: [], settings: defaultSettings('2026-11-01T10:00:00.000Z') };
  const stamped = stampForRestore(backup, '2026-11-06T12:00:00.000Z');
  assert.equal(stamped.starter?.updatedAt, '2026-11-06T12:00:00.000Z');
  assert.equal(stamped.feeds[0].updatedAt, '2026-11-06T12:00:00.000Z');
  assert.equal(stamped.settings.updatedAt, '2026-11-06T12:00:00.000Z');
  // Wat er in de back-up stond verandert niet, enkel de tijd.
  assert.equal(stamped.starter?.name, 'Jeanine');
  // De cloud (3 november) overschrijft de teruggezette starter niet meer.
  const device: MergeTarget = { seeded: true, starter: stamped.starter, feeds: stamped.feeds, recipes: [], bakes: [], away: [], settings: stamped.settings };
  mergeRemote(device, [item('starter', { ...defaultStarter('2026-11-03T09:00:00.000Z'), name: 'Jeanine II' })]);
  assert.equal(device.starter?.name, 'Jeanine', 'de nieuwere cloudversie van vóór het terugzetten wint niet');
  // Zonder nieuwe tijd (het oude gedrag) zou de cloud wel winnen.
  const old: MergeTarget = { seeded: true, starter: backup.starter, feeds: [], recipes: [], bakes: [], away: [], settings: backup.settings };
  mergeRemote(old, [item('starter', { ...defaultStarter('2026-11-03T09:00:00.000Z'), name: 'Jeanine II' })]);
  assert.equal(old.starter?.name, 'Jeanine II');
});

test('back-up terugzetten: wat verwijderd was blijft verwijderd, en een ontbrekende starter blijft ontbreken', () => {
  const backup = { starter: null, feeds: [{ id: 'f1', fedAt: 'x', ratio: '1:5:5', updatedAt: 'a', deletedAt: '2026-11-01T09:00:00.000Z' }], recipes: [], bakes: [], away: [], settings: defaultSettings('a') };
  const s = stampForRestore(backup, '2026-11-06T12:00:00.000Z');
  assert.equal(s.starter, null);
  assert.equal(s.feeds[0].deletedAt, '2026-11-01T09:00:00.000Z');
});
