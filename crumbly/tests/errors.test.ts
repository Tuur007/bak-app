import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError, NETWORK_TEXT } from '../src/domain/errors.ts';
import { linkErrorText } from '../src/domain/peers.ts';

test('netwerkfouten van Safari, Chrome en Firefox worden gewone taal', () => {
  for (const m of ['TypeError: Load failed', 'TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'The Internet connection appears to be offline.']) {
    assert.equal(friendlyError(m), NETWORK_TEXT, m);
    assert.equal(linkErrorText(m), NETWORK_TEXT, m);
  }
});

test('andere fouten blijven zoals ze zijn', () => {
  assert.equal(friendlyError('permission denied'), 'permission denied');
  assert.match(linkErrorText('Deze code klopt niet of is verlopen'), /verlopen/);
});
