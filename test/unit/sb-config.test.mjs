/* The Supabase anon key, URL and owner id live in public/js/flux-sb-config.js
   only. A second pasted copy can drift — a wrong owner id silently demotes the
   owner — so no other script may carry the raw key. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../public/js/', import.meta.url);
const KEY_TAIL = 'qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

test('only flux-sb-config.js holds the raw anon key', () => {
  const offenders = readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'flux-sb-config.js')
    .filter((f) => readFileSync(new URL(f, DIR), 'utf8').includes(KEY_TAIL));
  assert.deepEqual(offenders, []);
});

test('flux-sb-config.js defines every field consumers read', () => {
  const win = {};
  new Function('window', readFileSync(new URL('flux-sb-config.js', DIR), 'utf8'))(win);
  for (const k of ['url', 'anon', 'sessionKey', 'ownerUid']) assert.ok(win.FluxSB[k], k);
  assert.ok(win.FluxSB.anon.endsWith(KEY_TAIL));
});
