import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Sign-up rejects guessable passwords.
 *
 * Supabase's breached-password check (HaveIBeenPwned) is a paid feature and
 * this project is not on that plan, so the check is ours. That makes it worth
 * pinning: there is no server-side backstop to catch a regression here, and
 * the failure mode is silent — a weak password is accepted and nothing looks
 * wrong until an account is taken.
 *
 * The rule this file exists to protect: strength is enforced at sign-up ONLY.
 * Enforcing it at sign-in would lock out every account created before the
 * check, with no way to get in and change the password.
 */

const reason = (page: import('@playwright/test').Page, pw: string, name = 'Alex Rivera') =>
  page.evaluate(
    ([p, n]) => (window as unknown as {
      fluxWeakPasswordReason: (a: string, b: string) => string;
    }).fluxWeakPasswordReason(p, n),
    [pw, name] as const,
  );

test.describe('Weak password rejection', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
  });

  test('the rule lives on window so both sign-up forms share it', async ({ page }) => {
    // flux-staff-platform.js reads this global; if it stops being exported the
    // staff form silently falls back to a bare length check.
    const type = await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).fluxWeakPasswordReason);
    expect(type).toBe('function');
  });

  test('short, repeated, sequential and common passwords are all refused', async ({ page }) => {
    for (const pw of [
      'Ab1!xy',        // 6 chars — under the 8 minimum
      'aaaaaaaa',      // one character repeated
      'qwertyuiop',    // a run straight off the keyboard
      '123456789',     // a run of digits
      'password123',   // perennial favourite
      'welcome123',
    ]) {
      expect(await reason(page, pw), `expected "${pw}" to be refused`).not.toBe('');
    }
  });

  test('a password built from your own name is refused', async ({ page }) => {
    expect(await reason(page, 'alexrivera99', 'Alex Rivera')).toContain('your own name');
    // Punctuation and case in the typed name must not let it through.
    expect(await reason(page, 'Alex.Rivera!', 'alex rivera')).toContain('your own name');
  });

  test('a password built from "Flux" is refused', async ({ page }) => {
    expect(await reason(page, 'fluxplanner1', 'Alex Rivera')).toContain('Flux');
  });

  test('a reasonable password is accepted', async ({ page }) => {
    for (const pw of ['purple-lamp-47', 'Tr0mbone!Garden', 'hxkq28fjWm']) {
      expect(await reason(page, pw), `expected "${pw}" to be accepted`).toBe('');
    }
  });

  test('every refusal is a plain sentence, not a code', async ({ page }) => {
    // Students read these. No regex, no jargon, no "must match pattern".
    for (const pw of ['short', 'password123', 'alexrivera']) {
      const msg = await reason(page, pw);
      expect(msg).not.toBe('');
      expect(msg).toMatch(/[.!]$/);
      expect(msg).not.toMatch(/regex|pattern|invalid|error|[{}\\^$]/i);
    }
  });

  /* No test drives the visible sign-up form here, and that is not an
     oversight: the e2e harness signs every scenario in (there is no 'guest'
     entry in SCENARIOS — it falls through to student-semester), so
     #loginScreen is never on screen for a spec to type into. The two
     assertions below cover the same wiring from the source instead. The form
     itself was checked by hand against a real unauthenticated load. */

  test('sign-in is not gated on strength, so weak accounts can still get in', async ({ page }) => {
    // The guard is inside handleEmailAuth's signup branch. If it ever moves
    // out, everyone who predates the check is locked out permanently.
    const src = await page.evaluate(() => String(
      (window as unknown as { handleEmailAuth?: () => void }).handleEmailAuth ?? '',
    ));
    expect(src, 'handleEmailAuth should be reachable for this assertion').not.toBe('');
    const guard = src.indexOf('fluxWeakPasswordReason');
    expect(guard, 'handleEmailAuth must consult fluxWeakPasswordReason').toBeGreaterThan(-1);
    // The nearest preceding mode test must be the signup one.
    expect(src.slice(0, guard)).toMatch(/signup['"]?\s*\)?\s*\{?[^}]*$/);
  });
});
