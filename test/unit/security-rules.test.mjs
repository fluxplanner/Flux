import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/* Strip types here: CI's Node 20 cannot import .ts directly. */
const src = readFileSync(new URL('../../supabase/functions/_shared/security-rules.ts', import.meta.url), 'utf8');
const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
const { evaluate, formatAlert, THRESHOLDS } = await import('data:text/javascript,' + encodeURIComponent(js));

const signals = (scan) => evaluate(scan).map((a) => a.signal);

test('a quiet scan raises nothing', () => {
  assert.deepEqual(evaluate({}), []);
  assert.deepEqual(evaluate({
    failed_logins: { total: 3, top_usernames: [{ username: 'tester', n: 2 }], top_ips: [{ ip: '203.0.113.9', n: 3, usernames: 1 }] },
    power_grants: [], rls_missing: [],
    ai_usage: { near_cap: [{ kind: 'user', count: 250, cap: 300, ratio: 0.83 }], guest_buckets_today: 4, ai_messages_today: 20, ai_messages_7d_avg: 15 },
  }), []);
});

test('ten wrong passwords for one name is critical', () => {
  const [a] = evaluate({ failed_logins: { total: 10, top_usernames: [{ username: 'tester', n: THRESHOLDS.failedPerUsername }], top_ips: [] } });
  assert.equal(a.signal, 'failed_logins');
  assert.equal(a.severity, 'critical');
  assert.match(a.lines[0], /tester/);
});

test('one address trying many names is critical (credential stuffing)', () => {
  const [a] = evaluate({ failed_logins: { total: 6, top_usernames: [], top_ips: [{ ip: '203.0.113.9', n: 6, usernames: 6 }] } });
  assert.equal(a.severity, 'critical');
});

test('a climbing burst keeps one fingerprint', () => {
  const at = (n) => evaluate({ failed_logins: { total: n, top_usernames: [{ username: 'tester', n }], top_ips: [] } })[0].fingerprint;
  assert.equal(at(12), at(14));
});

test('a role you gave is a warning; one you did not give is critical', () => {
  const mine = evaluate({ power_grants: [{ id: 1, action_type: 'role_set', role: 'teacher', by_owner: true, target: 'ms.k' }] })[0];
  assert.equal(mine.severity, 'warning');
  const theirs = evaluate({ power_grants: [{ id: 2, action_type: 'role_change', role: 'admin', by_owner: false, target: 'x' }] })[0];
  assert.equal(theirs.severity, 'critical');
  assert.match(theirs.lines[0], /not by you/);
  const self = evaluate({ power_grants: [{ id: 3, action_type: 'role_set', role: 'admin', by_owner: false, self_granted: true }] })[0];
  assert.match(self.lines[0], /themselves/);
});

test('any change to the platform owner list is critical, even by the owner', () => {
  const [a] = evaluate({ power_grants: [{ id: 4, action_type: 'owner_added', by_owner: true, target: 'someone' }] });
  assert.equal(a.severity, 'critical');
  assert.match(a.lines[0], /platform owner added/);
});

test('a table without access rules is critical', () => {
  const [a] = evaluate({ rls_missing: ['secrets_table'] });
  assert.equal(a.signal, 'rls_missing');
  assert.equal(a.severity, 'critical');
});

test('AI: a hit cap, a spike and a guest flood each alert', () => {
  assert.deepEqual(signals({ ai_usage: { near_cap: [{ kind: 'user', count: 301, cap: 300, ratio: 1.0 }] } }), ['ai_usage']);
  assert.deepEqual(signals({ ai_usage: { ai_messages_today: 400, ai_messages_7d_avg: 100 } }), ['ai_usage']);
  assert.deepEqual(signals({ ai_usage: { ai_messages_today: 40, ai_messages_7d_avg: 5 } }), [], 'below the floor');
  assert.deepEqual(signals({ ai_usage: { guest_buckets_today: THRESHOLDS.guestBuckets } }), ['ai_usage']);
});

test('messages fit in Discord and name the problem', () => {
  const grants = Array.from({ length: 40 }, (_, i) => ({ id: i, action_type: 'role_set', role: 'teacher', by_owner: false, target: 'user' + i }));
  const text = formatAlert(evaluate({ power_grants: grants })[0]);
  assert.ok(text.length <= 2000);
  assert.match(text, /^🚨 \*\*Flux: /);
  assert.match(text, /and 25 more/);
});
