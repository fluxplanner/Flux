import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Slow devices must actually be recognised as slow.
 *
 * The boot script in index.html flags weak hardware with
 * `html[data-flux-lowend="1"]`, which is what lets flux-lowend.css drop the
 * GPU-heavy effects. Its original test was `<=2 cores || <=2GB RAM || iOS<=12`
 * — iPhone 6-era — and a school iPad passes all three: Safari does not expose
 * `navigator.deviceMemory` at all, it reports 4 cores, and it runs a current
 * iPadOS. So the exact devices the check existed for were the ones it never
 * caught, and they rendered with the full desktop animation budget. Measured
 * at 6x CPU throttle, one umbrella click in Study Tools cost 25 main-thread
 * freezes totalling ~2.0s undetected, against a single 91ms freeze once the
 * flag is set.
 *
 * These tests pin the three cases that matter: a tablet is caught, a laptop is
 * not, and anyone who disagrees can still override it.
 */

/** Stand in for an iPad: Safari exposes no deviceMemory and reports 4 cores. */
async function fakeHardware(page: Page, cores: number, lowendPref?: string) {
  await page.addInitScript(
    ({ cores, lowendPref }: { cores: number; lowendPref: string | null }) => {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => cores,
        configurable: true,
      });
      try {
        delete (Navigator.prototype as unknown as Record<string, unknown>).deviceMemory;
      } catch { /* not deletable here — the <=2GB clause simply won't fire */ }
      if (lowendPref !== null) {
        try { localStorage.setItem('flux_lowend_mode', lowendPref); } catch { /* blocked */ }
      }
    },
    { cores, lowendPref: lowendPref ?? null },
  );
}

const lowendFlag = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-flux-lowend'));

test.describe('Slow devices get the lighter build', () => {
  test.describe('on a touch device with few cores', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } });

    test('a school iPad is recognised as low-end', async ({ page }) => {
      await fakeHardware(page, 4);
      await gotoScenario(page, 'student-semester');
      expect(await lowendFlag(page)).toBe('1');
    });

    test('an explicit opt-out still wins', async ({ page }) => {
      await fakeHardware(page, 4, '0');
      await gotoScenario(page, 'student-semester');
      expect(await lowendFlag(page)).toBeNull();
    });
  });

  test('a laptop is left alone', async ({ page }) => {
    // Default project has no touch and a fine pointer.
    await fakeHardware(page, 10);
    await gotoScenario(page, 'student-semester');
    expect(await lowendFlag(page)).toBeNull();
  });
});
