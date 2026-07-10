import { test, expect } from '@playwright/test';

/*
 * ai-proxy edge-function boundary (LIVE). Two checks:
 *
 *   - Unauthenticated POST must be rejected with 401 (no auth header). We send
 *     an empty body so no AI call is ever made — auth is verified before the
 *     body is parsed, so this can't reach the upstream model.
 *
 *   - One authenticated POST returns either a well-formed reply
 *     ({ content: [{ type:'text', text }] }, 200) or the documented
 *     daily_limit_reached shape (429). Exactly one call — never loop the quota.
 */

const SB_URL = process.env.SB_URL || 'https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON = process.env.SB_ANON ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
const AI_PROXY = `${SB_URL}/functions/v1/ai-proxy`;

test('ai-proxy rejects an unauthenticated call with 401', async () => {
  const res = await fetch(AI_PROXY, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // empty — auth is checked before the body, so no AI call
  });
  expect(res.status, `expected 401, got ${res.status}: ${(await res.text()).slice(0, 160)}`).toBe(401);
});

/*
 * P0 A5 — hardened auth boundary. Gated on AI_PROXY_HARDENED=1 until the
 * updated ai-proxy/gemini-proxy functions + 20260709110000_flux_ai_guard.sql
 * are deployed (same pattern as the P4.3 get_benchmarks gate): these assert
 * the NEW behavior and would fail against the old deployment.
 */
test.describe('ai-proxy hardened auth (P0 A5)', () => {
  test.skip(process.env.AI_PROXY_HARDENED !== '1',
    'Set AI_PROXY_HARDENED=1 once the A5 functions + flux_ai_guard migration are deployed.');

  test('garbage Bearer token is 401 even with payments off', async () => {
    const res = await fetch(AI_PROXY, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: 'Bearer not-a-real-jwt',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] }),
    });
    expect(res.status).toBe(401);
  });

  test('guest (anon-key Bearer) passes auth but is body-validated — no silent free ride', async () => {
    // Empty body: proves the anon-key guest path exists (past the 401) while
    // never reaching a provider. 400 = guest allowed; 401 = guests disabled
    // via AI_PROXY_ALLOW_GUESTS=false. Both are safe states.
    const res = await fetch(AI_PROXY, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect([400, 401, 429]).toContain(res.status);
  });

  test('guest vision is refused with auth_required', async () => {
    const res = await fetch(AI_PROXY, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'what is this' }],
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/png',
      }),
    });
    const body = await res.json().catch(() => ({}));
    // 401 auth_required (guest vision blocked) or 429 (guest cap already hit
    // for this CI runner's IP today) — never 200.
    expect([401, 429]).toContain(res.status);
    if (res.status === 401) expect(body.error).toBe('auth_required');
  });
});

test.describe('ai-proxy authenticated call', () => {
  const email = process.env.FLUX_TEST_USER_A_EMAIL;
  const password = process.env.FLUX_TEST_USER_A_PASSWORD;
  test.skip(!email || !password, 'Set FLUX_TEST_USER_A_EMAIL/PASSWORD to run the authenticated ai-proxy check.');

  test('returns a well-formed reply or the daily_limit_reached shape', async () => {
    const auth = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const session = await auth.json();
    expect(session.access_token, `sign-in failed: ${auth.status}`).toBeTruthy();

    // Exactly one call. Minimal prompt to keep the metered request tiny.
    const res = await fetch(AI_PROXY, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], stream: false }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 429) {
      expect(body.error, `429 without daily_limit_reached: ${JSON.stringify(body).slice(0, 200)}`)
        .toBe('daily_limit_reached');
      return;
    }
    expect(res.status, `unexpected status ${res.status}: ${JSON.stringify(body).slice(0, 200)}`).toBe(200);
    expect(Array.isArray(body.content), `reply not well-formed: ${JSON.stringify(body).slice(0, 200)}`)
      .toBeTruthy();
    expect(typeof body.content[0]?.text).toBe('string');
  });
});
