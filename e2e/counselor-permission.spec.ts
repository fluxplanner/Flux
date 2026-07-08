import { test, expect } from '@playwright/test';

/*
 * Counselor / student permission edges against the LIVE Supabase project
 * (raw PostgREST, public anon key, READ-ONLY). Two directions:
 *
 *   - A student must not read another student's counselor/wellness rows, and
 *     must not read counselor-private tables at all (role boundary). Uses the
 *     two student test users A/B; skipped if their creds are unset.
 *
 *   - A counselor role may read the counselor tables per policy (the API must
 *     not forbid it). Uses an optional counselor test user; skipped if unset.
 *
 * No writes, no auth mutation. The anon key is already public (shipped client).
 */

const SB_URL = process.env.SB_URL || 'https://lfigdijuqmbensebnevo.supabase.co';
const SB_ANON = process.env.SB_ANON ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';

// Wellness/counselor rows keyed off a student.
const WELLNESS_TABLES = [
  'student_wellness_snapshots',
  'student_counselor_checkins',
];
// Tables that hold counselor-private data a student must never see.
const COUNSELOR_ONLY_TABLES = [
  'staff_counselor_private_notes',
  'counselor_referrals',
  'counselor_copilot_audit',
  'counselor_consent_audit',
];

type Creds = { email: string; password: string };
function cred(prefix: string): Creds | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
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

async function selectAll(table: string, token: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*&limit=10`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
  const rows = res.ok ? await res.json() : null;
  return { status: res.status, rows: Array.isArray(rows) ? rows : null };
}
async function ownRowIds(table: string, token: string): Promise<string[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=5`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r) => r.id).filter((v) => v != null) : [];
}

test.describe('Counselor/student permission edges', () => {
  const a = cred('FLUX_TEST_USER_A');
  const b = cred('FLUX_TEST_USER_B');

  test.describe('a student cannot cross the boundary', () => {
    test.skip(
      !a || !b,
      'Set FLUX_TEST_USER_A_* and FLUX_TEST_USER_B_* to run student permission edges.',
    );

    test("student A cannot read student B's wellness/counselor rows", async () => {
      const [ua, ub] = await Promise.all([signIn(a!), signIn(b!)]);
      const leaks: string[] = [];
      for (const table of WELLNESS_TABLES) {
        const bIds = await ownRowIds(table, ub.token);
        if (bIds.length === 0) continue;
        const inList = `(${bIds.map((id) => `"${id}"`).join(',')})`;
        const res = await fetch(
          `${SB_URL}/rest/v1/${table}?select=*&id=in.${encodeURIComponent(inList)}`,
          { headers: { apikey: SB_ANON, Authorization: `Bearer ${ua.token}` } },
        );
        if (res.status >= 400) continue;
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) leaks.push(`${table}: leaked ${rows.length}`);
      }
      expect(leaks, `student read another student's wellness rows:\n${leaks.join('\n')}`).toEqual([]);
    });

    test('a student cannot read counselor-private tables at all', async () => {
      const ua = await signIn(a!);
      const seen: string[] = [];
      for (const table of COUNSELOR_ONLY_TABLES) {
        const { status, rows } = await selectAll(table, ua.token);
        if (status >= 400) continue; // denied outright — fine
        if (rows && rows.length > 0) seen.push(`${table}: student saw ${rows.length} row(s)`);
      }
      expect(seen, `student read counselor-private data:\n${seen.join('\n')}`).toEqual([]);
    });
  });

  test.describe('a counselor may read per policy', () => {
    const counselor = cred('FLUX_TEST_COUNSELOR');
    test.skip(
      !counselor,
      'Set FLUX_TEST_COUNSELOR_EMAIL/PASSWORD to run the counselor positive-permission check.',
    );

    test('counselor role is not forbidden from counselor tables', async () => {
      const uc = await signIn(counselor!);
      for (const table of [...WELLNESS_TABLES, 'student_counselors']) {
        const { status } = await selectAll(table, uc.token);
        // Policy permits counselors to read — a healthy read is 2xx (rows or []),
        // never a 401/403 for the counselor role.
        expect(status, `counselor was forbidden from ${table} (status ${status})`).toBeLessThan(400);
      }
    });
  });
});
