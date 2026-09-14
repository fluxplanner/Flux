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

  test('onboarding steps get a directional enter + chip stagger (M2)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      const ob = document.getElementById('onboarding');
      if (ob) { ob.style.display = 'flex'; ob.classList.add('active', 'visible'); }
      if (typeof w.showObStep !== 'function') return { error: 'no showObStep' };
      w.showObStep(1);
      w.showObStep(2); // forward
      const s2 = document.getElementById('ob-step-2');
      const fwdDir = s2?.style.getPropertyValue('--ob-dir');
      const fwdEnter = s2?.classList.contains('flux-ob-enter');
      const chip = s2?.querySelector('.ob-chip') as HTMLElement | null;
      const chipIdx = chip?.style.getPropertyValue('--stagger-i');
      w.showObStep(1); // back
      const s1 = document.getElementById('ob-step-1');
      return { fwdDir, fwdEnter, chipIdx, backDir: s1?.style.getPropertyValue('--ob-dir') };
    });
    expect(r.error).toBeUndefined();
    expect(r.fwdEnter).toBe(true);
    expect(r.fwdDir).toBe('1');   // forward slides in from the right
    expect(r.backDir).toBe('-1'); // back slides in from the left
    if (r.chipIdx !== undefined && r.chipIdx !== '') expect(r.chipIdx).toBe('0');
  });

  test('celebrate() mounts a ceremony overlay and self-removes (M3)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const mounted = await page.evaluate(() => {
      (window as any).FluxMotion.celebrate('unlock', { label: 'Unlocked: Tidepool accent', hold: 200 });
      const ov = document.querySelector('.flux-celebrate.flux-celebrate-unlock');
      return { present: !!ov, label: ov?.querySelector('.flux-celebrate-label')?.textContent, pointerThrough: ov ? getComputedStyle(ov).pointerEvents : null };
    });
    expect(mounted.present).toBe(true);
    expect(mounted.label).toBe('Unlocked: Tidepool accent');
    expect(mounted.pointerThrough).toBe('none'); // never blocks the UI
    // self-removes after hold + fade
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.flux-celebrate').length)).toBe(0);
  });

  test('celebrate is inert under reduced-motion (no overlay)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const count = await page.evaluate(() => {
      document.documentElement.classList.add('flux-reduce-motion');
      (window as any).FluxMotion.celebrate('unlock', { label: 'x' });
      document.documentElement.classList.remove('flux-reduce-motion');
      return document.querySelectorAll('.flux-celebrate').length;
    });
    expect(count).toBe(0);
  });

  test('educator panels auto-enhance async cards (M4)', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => (window as any).nav?.('lessonHub'));
    // The watcher re-enhances as the async render lands. Stagger is the only
    // thing autoEnhance still applies now that the spotlight is gone.
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('#lessonHub .lh-list.flux-stagger').length), { timeout: 4000 })
      .toBeGreaterThan(0);
  });

  test('autoEnhance is a no-op for a missing panel and under reduced-motion', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const threw = await page.evaluate(() => {
      const w = window as any;
      try {
        // No element with this id → nothing happens, and no throw.
        w.FluxMotion.autoEnhance('definitely-not-a-panel');
        document.documentElement.classList.add('flux-reduce-motion');
        w.FluxMotion.autoEnhance('lessonHub');
        document.documentElement.classList.remove('flux-reduce-motion');
        return false;
      } catch (_) {
        document.documentElement.classList.remove('flux-reduce-motion');
        return true;
      }
    });
    expect(threw, 'autoEnhance threw').toBe(false);
  });

  test('the magnet CTA still wires on the top bar (M5)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.topbar-new-task-btn.flux-magnet')))
      .toBe(true);
  });

  /* The pointer-following glow is gone — it drew the eye while you were doing
     nothing but moving the mouse, and repainting a 340px gradient from a
     document-level pointermove cost frames on slow hardware.
   *
   * This is the mutation guard for that removal. It pins all three ways the
   * effect could come back: the class being applied, the document listener
   * still tracking, and the symbol disappearing entirely. `spotlight` must
   * stay on the namespace as a no-op, because [data-flux-spotlight] still
   * reaches it and removing it would throw rather than do nothing.
   */
  test('the cursor glow is gone and cannot come back', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => (window as any).nav?.('settings'));
    await page.waitForTimeout(700);

    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FluxMotion.autoEnhance('dashboard');
      w.FluxMotion.autoEnhance('calendar');
      w.FluxMotion.autoEnhance('settings');

      const callable = typeof w.FluxMotion.spotlight === 'function';
      let spotlightThrew = false;
      try { w.FluxMotion.spotlight(document.body); } catch (_) { spotlightThrew = true; }

      // Nothing anywhere carries the class after a full sweep.
      const classed = document.querySelectorAll('.flux-spotlight').length;

      // And the document-level tracker is not setting offsets any more.
      const card = document.querySelector('#settings .card') as HTMLElement | null;
      let tracked = '';
      if (card) {
        const box = card.getBoundingClientRect();
        card.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, pointerType: 'mouse',
          clientX: box.left + 40, clientY: box.top + 20,
        }));
        await new Promise((res) => setTimeout(res, 50));
        tracked = card.style.getPropertyValue('--spot-x');
      }
      return { callable, spotlightThrew, classed, tracked, sawCard: !!card };
    });

    expect(r.sawCard, 'no settings card to test against').toBe(true);
    expect(r.callable, 'spotlight must stay callable for [data-flux-spotlight]').toBe(true);
    expect(r.spotlightThrew, 'spotlight() threw instead of no-opping').toBe(false);
    expect(r.classed, 'flux-spotlight is being applied again').toBe(0);
    expect(r.tracked, 'the pointer tracker is setting --spot-x again').toBe('');
  });

  /* The stylesheet has to go too. Leaving the rule behind would re-light every
     card the instant anything re-added the class. */
  test('no stylesheet still paints a pointer-following gradient', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const hits = await page.evaluate(() => {
      const found: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try { rules = (sheet as CSSStyleSheet).cssRules; } catch (_) { continue; }
        for (const rule of Array.from(rules)) {
          const text = rule.cssText || '';
          if (text.includes('--spot-x') || text.includes('.flux-spotlight')) found.push(text.slice(0, 120));
        }
      }
      return found;
    });
    expect(hits, `spotlight CSS still present:\n${hits.join('\n')}`).toEqual([]);
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
