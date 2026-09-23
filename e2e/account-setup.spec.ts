import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * "Choose how you sign in" — the one screen that cannot be skipped.
 *
 * Eight accounts were converted off Google. They carry a password nobody chose
 * and a name derived from a Gmail address, so until this is filled in those
 * people are signing in with credentials they were handed.
 *
 * Two things have to hold. It must appear for exactly those accounts — showing
 * it to the three who already picked their own password is a wall for no
 * reason — and it must not be dismissable, because a skipped prompt leaves the
 * handed-out password in use forever.
 *
 * Who sees it is read off the account rather than a hardcoded list: the
 * converted eight are exactly the accounts still holding a google identity.
 * These tests drive that rule directly, since the fixture user is neither.
 *
 * Nothing here reaches the network — every case is refused client-side.
 */

type Win = {
  currentUser: { identities?: { provider: string }[]; user_metadata?: Record<string, unknown> };
  fluxMaybeShowAccountSetup: () => boolean;
  fluxSubmitAccountSetup: () => Promise<void>;
  fluxAccountSetupPreview: () => void;
};

const setAccount = (page: import('@playwright/test').Page, provider: string, done: boolean) =>
  page.evaluate(([p, d]) => {
    const w = window as unknown as Win;
    w.currentUser.identities = [{ provider: p as string }];
    w.currentUser.user_metadata = d ? { flux_setup_done: true } : {};
    document.getElementById('accountSetupModal')!.style.display = 'none';
  }, [provider, done] as [string, boolean]);

test.describe('Account setup prompt', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await gotoScenario(page, 'teacher-workflow');
    await page.waitForFunction(() => typeof (window as unknown as Win).fluxMaybeShowAccountSetup === 'function'
      && !!(window as unknown as { currentUser?: unknown }).currentUser, null, { timeout: 20000 });
  });

  test('it asks the converted accounts, and only them', async ({ page }) => {
    await setAccount(page, 'email', false);
    expect(await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup()),
      'someone who chose their own password was asked again').toBe(false);

    await setAccount(page, 'google', false);
    expect(await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup()),
      'a converted account was not asked').toBe(true);
    await expect(page.locator('#accountSetupModal')).toBeVisible();

    await setAccount(page, 'google', true);
    expect(await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup()),
      'it came back after being completed').toBe(false);
  });

  test('there is no way out of it', async ({ page }) => {
    await setAccount(page, 'google', false);
    await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup());
    await expect(page.locator('#accountSetupModal')).toBeVisible();

    // No close control, and no overlay-click handler like the other modals have.
    const affordances = await page.evaluate(() => {
      const m = document.getElementById('accountSetupModal')!;
      return {
        closeBtn: !!m.querySelector('.modal-close,[onclick*="close"],[aria-label="Close"]'),
        overlayClick: !!m.getAttribute('onclick'),
      };
    });
    expect(affordances.closeBtn, 'it has a close button').toBe(false);
    expect(affordances.overlayClick, 'clicking the backdrop dismisses it').toBe(false);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#accountSetupModal'), 'Escape dismissed it').toBeVisible();

    await page.locator('#accountSetupModal').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await expect(page.locator('#accountSetupModal'), 'a backdrop click dismissed it').toBeVisible();
  });

  test('every way of filling it in wrong says what is wrong', async ({ page }) => {
    await setAccount(page, 'google', false);
    await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup());

    const attempt = (name: string, pw: string, pw2: string) => page.evaluate(async ([n, p, q]) => {
      const w = window as unknown as Win;
      (document.getElementById('accountSetupName') as HTMLInputElement).value = n;
      (document.getElementById('accountSetupPw') as HTMLInputElement).value = p;
      (document.getElementById('accountSetupPw2') as HTMLInputElement).value = q;
      await w.fluxSubmitAccountSetup();
      return document.getElementById('accountSetupError')?.textContent || '';
    }, [name, pw, pw2] as [string, string, string]);

    expect(await attempt('', '', '')).toMatch(/name/i);
    expect(await attempt('!!! ???', 'Goodpass9', 'Goodpass9'),
      'a name that normalises to nothing was accepted').toMatch(/letters or numbers/i);
    expect(await attempt('Jane Doe', '', '')).toMatch(/password/i);
    // The one that locks someone out: a typo in a password with no reset link.
    expect(await attempt('Jane Doe', 'Goodpass9', 'Goodpass8'),
      'two different passwords were accepted').toMatch(/not the same/i);

    // Still open — nothing was saved by any of those.
    await expect(page.locator('#accountSetupModal')).toBeVisible();
  });

  test('it shows the name you will actually type, not the one you typed', async ({ page }) => {
    await setAccount(page, 'google', false);
    await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup());
    const preview = await page.evaluate(() => {
      const w = window as unknown as Win;
      (document.getElementById('accountSetupName') as HTMLInputElement).value = 'José Álvarez';
      w.fluxAccountSetupPreview();
      return document.getElementById('accountSetupPreview')?.textContent || '';
    });
    /* Accents fold to plain letters rather than being dropped — without that
       step this reads "jos.lvarez", which loses the letters, not the accents. */
    expect(preview).toContain('jose.alvarez');
  });

  test('it fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAccount(page, 'google', false);
    await page.evaluate(() => (window as unknown as Win).fluxMaybeShowAccountSetup());
    const box = await page.evaluate(() => {
      const c = document.querySelector('#accountSetupModal .modal-card') as HTMLElement;
      const r = c.getBoundingClientRect();
      return { overflowsRight: r.right > window.innerWidth + 1, width: Math.round(r.width) };
    });
    expect(box.overflowsRight, 'the dialog hangs off the side of a phone').toBe(false);
    expect(box.width).toBeGreaterThan(200);
  });
});
