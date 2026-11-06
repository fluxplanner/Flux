import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/* Strip types here: CI's Node 20 cannot import .ts directly. */
const src = readFileSync(new URL('../../supabase/functions/_shared/mcp.ts', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export function isAllowedRedirectUri'));
const js = transformSync(body, { loader: 'ts', format: 'esm' }).code;
const { isAllowedRedirectUri } = await import('data:text/javascript,' + encodeURIComponent(js));

test('script and data addresses are refused even when the host looks local', () => {
  assert.equal(isAllowedRedirectUri('javascript://localhost/%0Aalert(1)'), false);
  assert.equal(isAllowedRedirectUri('data://localhost/x'), false);
  assert.equal(isAllowedRedirectUri('http://example.com/cb'), false);
  assert.equal(isAllowedRedirectUri('not a url'), false);
});

test('Claude redirects still work', () => {
  assert.equal(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(isAllowedRedirectUri('http://localhost:6274/callback'), true);
  assert.equal(isAllowedRedirectUri('http://127.0.0.1:33418/cb'), true);
});
