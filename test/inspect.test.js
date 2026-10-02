import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from '../src/inspect.js';
test('reports status and shape without printing body values or cookies', async () => {
  const result = await inspect('https://example.invalid', async (_, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response('{"private":"do-not-print"}', {headers: {'Content-Type': 'application/json', 'Set-Cookie': 'session=secret'}});
  });
  assert.equal(result.jsonShape, 'object');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(JSON.stringify(result).includes('do-not-print'), false);
});
test('caps response inspection at 64 KiB', async () => {
  const result = await inspect('https://example.invalid', async () => new Response('x'.repeat(100000)));
  assert.equal(result.bytesRead, 65536);
  assert.equal(result.truncated, true);
});
test('rejects non-HTTP URLs and embedded credentials', async () => {
  await assert.rejects(inspect('file:///etc/passwd'), /HTTP/);
  await assert.rejects(inspect('https://user:password@example.invalid'), /credentials/);
});
test('keeps redirects and empty responses visible', async () => {
  const redirect = await inspect('https://example.invalid', async () => new Response(null, {status: 302, headers: {Location: '/next'}}));
  assert.equal(redirect.status, 302);
  const empty = await inspect('https://example.invalid', async () => new Response(null, {status: 204}));
  assert.equal(empty.bytesRead, 0);
  assert.equal(empty.jsonShape, null);
});
