import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * OriginKit motion primitives — client contract.
 *
 * Verifies the module extends FluxAnim, auto-wires data attributes, and —
 * critically — that reduced-motion / perf / lowend hard-disable it
 * regardless of the flag (student-system safety). Visual correctness is
 * eyeballed in the preview; this pins the wiring + kill switches.
 */

test.describe('OriginKit motion primitives', () => {
  test('module loads, extends FluxAnim, and the greeting shimmers', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      const greet = document.getElementById('dashGreeting');
      return {
        loaded: !!w.FluxMotion,
        active: w.FluxMotion?.active(),
        extendsAnim: typeof w.FluxAnim?.borderBeam === 'function' && typeof w.FluxAnim?.tiltCard === 'function',
        greetShimmer: greet?.classList.contains('flux-shimmer-text') && greet?.classList.contains('flux-shimmer-live'),
        flagOn: w.FluxFeatureFlags?.isEnabled('enable_originkit_motion', true),
      };
    });
    expect(r.loaded).toBe(true);
    expect(r.active).toBe(true);
    expect(r.extendsAnim).toBe(true);
    expect(r.greetShimmer).toBe(true);
    expect(r.flagOn).toBe(true);
  });

  test('reduced-motion, perf mode, and lowend each hard-disable regardless of flag', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      const de = document.documentElement;
      de.classList.add('flux-reduce-motion');
      const reduced = w.FluxMotion.active();
      de.classList.remove('flux-reduce-motion');
      de.setAttribute('data-flux-perf', 'on');
      const perf = w.FluxMotion.active();
      de.removeAttribute('data-flux-perf');
      de.setAttribute('data-flux-lowend', '1');
      const lowend = w.FluxMotion.active();
      de.removeAttribute('data-flux-lowend');
      return { reduced, perf, lowend, restored: w.FluxMotion.active() };
    });
    expect(r.reduced).toBe(false);
    expect(r.perf).toBe(false);
    expect(r.lowend).toBe(false);
    expect(r.restored).toBe(true);
  });

  test('flag off disables active() (district kill switch)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const off = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_originkit_motion: false };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      return w.FluxMotion.active();
    });
    expect(off).toBe(false);
  });

  test('countUp lands exactly on the parsed target (incl. suffix)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const text = await page.evaluate(async () => {
      const w = window as any;
      const el = document.createElement('b');
      el.textContent = '57+';
      document.body.appendChild(el);
      w.FluxMotion.countUp(el);
      await new Promise((res) => setTimeout(res, 1300));
      return el.textContent;
    });
    expect(text).toBe('57+');
  });

  test('tiltCard wiring is idempotent (no double-bind)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      const el = document.createElement('div');
      document.body.appendChild(el);
      w.FluxMotion.tiltCard(el);
      const first = el.dataset.fluxTiltWired;
      w.FluxMotion.tiltCard(el); // second call must be a no-op
      return { wired: first, hasClass: el.classList.contains('flux-tilt') };
    });
    expect(r.wired).toBe('1');
    expect(r.hasClass).toBe(true);
  });
});
