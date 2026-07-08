import { test, expect } from '@playwright/test';

/*
 * RLS boundary checks against the LIVE Supabase project, via raw PostgREST with
 * the public anon key. Two layers:
 *
 *   1. Anonymous baseline (always runs): an unauthenticated anon request must
 *      never return rows from any high-risk table — RLS should filter to empty
 *      (200 + []) or reject (4xx).
 *
 *   2. Cross-user isolation (needs two seeded test users): signed in as user A,
 *      querying user B's own row ids must return nothing. This is the real
 *      "A cannot read B" guarantee. Skipped with a clear message when the
 *      FLUX_TEST_USER_A/B_* env vars are not set.
 *
 * These hit production read-only; the anon key is already public (shipped in the
 * client). No writes, no auth mutation.
 */

// Public client values (identical to app.js SB_URL / SB_ANON — safe to embed).
const SB_URL = process.env.SB_URL || 'https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON = process.env.SB_ANON ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

// Highest-risk tables, grouped by the categories called out for this audit.
// `user_data` holds the synced tasks + notes blob (PK `id` == the owner's uid).
const HIGH_RISK_TABLES = [
  'user_data',                     // tasks + notes (per-user JSON blob)
  'flux_messages',                 // staff messages
  'student_wellness_snapshots',    // wellness
  'student_counselor_checkins',    // wellness / counselor
  'counselor_referrals',           // counselor
  'staff_counselor_private_notes', // counselor
  'teacher_student_notes',         // teacher notes on students
  'office_hour_bookings',          // bookings
  'counselor_appointments',        // bookings
];

type Creds = { email: string; password: string };
function cred(letter: 'A' | 'B'): Creds | null {
  const email = process.env[`FLUX_TEST_USER_${letter}_EMAIL`];
  const password = process.env[`FLUX_TEST_USER_${letter}_PASSWORD`];
  return email && password ? { email, password } : null;
}

async function signIn({ email, password }: Creds): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`sign-in failed for ${email}: ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  }
  return { token: body.access_token, userId: body.user.id };
}

/** Read up to `limit` row ids visible to `token` in `table` (RLS-scoped). */
async function ownRowIds(table: string, token: string, limit = 5): Promise<string[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=${limit}`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r) => r.id).filter((v) => v != null) : [];
}

test.describe('RLS: anonymous baseline (no auth may read any user rows)', () => {
  for (const table of HIGH_RISK_TABLES) {
    test(`anon cannot read ${table}`, async () => {
      const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*&limit=5`, {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      });
      if (res.status >= 400) return; // 4xx rejection is an acceptable outcome
      expect(res.status, `unexpected status for ${table}`).toBeLessThan(300);
      const rows = await res.json();
      expect(Array.isArray(rows), `${table} did not return an array`).toBeTruthy();
      expect(rows.length, `anon read ${rows.length} row(s) from ${table} — RLS LEAK`).toBe(0);
    });
  }
});

test.describe('RLS: cross-user isolation (A must not read B)', () => {
  const a = cred('A');
  const b = cred('B');
  test.skip(
    !a || !b,
    'Set FLUX_TEST_USER_A_EMAIL/PASSWORD and FLUX_TEST_USER_B_EMAIL/PASSWORD to run the two-user RLS isolation checks.',
  );

  test('user A cannot select user B rows on any high-risk table', async () => {
    const [ua, ub] = await Promise.all([signIn(a!), signIn(b!)]);
    expect(ua.userId, 'A and B resolved to the same user — need two distinct accounts').not.toBe(ub.userId);

    let exercised = 0;
    const leaks: string[] = [];
    for (const table of HIGH_RISK_TABLES) {
      const bIds = await ownRowIds(table, ub.token);
      if (bIds.length === 0) continue; // B has no rows here — isolation not exercised
      exercised++;
      const inList = `(${bIds.map((id) => `"${id}"`).join(',')})`;
      const res = await fetch(
        `${SB_URL}/rest/v1/${table}?select=*&id=in.${encodeURIComponent(inList)}`,
        { headers: { apikey: SB_ANON, Authorization: `Bearer ${ua.token}` } },
      );
      if (res.status >= 400) continue; // 4xx = denied, fine
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        leaks.push(`${table}: A read ${rows.length} of B's row(s)`);
      }
    }
    expect(leaks, `RLS cross-user LEAK:\n${leaks.join('\n')}`).toEqual([]);
    expect(exercised, 'no B-owned rows found in any table — seed the B test user to exercise isolation')
      .toBeGreaterThan(0);
  });
});
