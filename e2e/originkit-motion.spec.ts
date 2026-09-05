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
    // The watcher re-enhances as the async render lands.
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('#lessonHub .lh-class-card.flux-spotlight').length), { timeout: 4000 })
      .toBeGreaterThan(0);
    const staggered = await page.evaluate(() => document.querySelectorAll('#lessonHub .lh-list.flux-stagger').length);
    expect(staggered).toBeGreaterThan(0);
  });

  /* Renamed: "unlisted" used to mean "absent from the ENHANCE map", and those
     panels are enhanced now — that allowlist was the reason the glow was
     inconsistent. What still has to be a no-op is a panel id that matches no
     element at all, and reduced-motion, which must stay inert everywhere. */
  test('autoEnhance is a no-op for a missing panel and under reduced-motion', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      // No element with this id → nothing happens, and no throw.
      w.FluxMotion.autoEnhance('definitely-not-a-panel');
      // reduced-motion → inert even for a listed panel
      document.documentElement.classList.add('flux-reduce-motion');
      w.FluxMotion.autoEnhance('lessonHub');
      const enhancedUnderReduce = document.querySelectorAll('#lessonHub .flux-spotlight').length;
      document.documentElement.classList.remove('flux-reduce-motion');
      return { enhancedUnderReduce };
    });
    expect(r.enhancedUnderReduce).toBe(0);
  });

  test('student panels get the broad spotlight sweep + magnet CTA (M5)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    // top-bar New Task button auto-wires magnet
    await expect
      .poll(() => page.evaluate(() => !!document.querySelector('.topbar-new-task-btn.flux-magnet')))
      .toBe(true);
    await page.evaluate(() => (window as any).nav?.('settings'));
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('#settings .card.flux-spotlight').length), { timeout: 4000 })
      .toBeGreaterThan(0);
  });

  /* The line is drawn around cards, not around panels.
   *
   * It used to be around panels: the enhance map was an allowlist, so the
   * dashboard and calendar got no glow at all, and moving between screens the
   * effect came and went for no reason a user could see. Every panel is
   * enhanced now, and what keeps the busy views calm is that ".card" matches
   * the containers rather than the rows inside them — a task item and a
   * calendar day keep their own hover states and gain nothing.
   */
  test('every panel gets the glow, but rows inside busy views do not', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      w.FluxMotion.autoEnhance('dashboard');
      w.FluxMotion.autoEnhance('calendar');
      return {
        // Individual data rows: still untouched.
        taskRowSpot: document.querySelectorAll('#taskList .task-item.flux-spotlight').length,
        calDaySpot: document.querySelectorAll('#calendar .cal-day.flux-spotlight').length,
        // The panels' own cards: now lit, where before they were skipped.
        dashCardSpot: document.querySelectorAll('#dashboard .card.flux-spotlight').length,
        calCardSpot: document.querySelectorAll('#calendar .card.flux-spotlight').length,
      };
    });
    expect(r.taskRowSpot, 'task rows should not each get a spotlight').toBe(0);
    expect(r.calDaySpot, 'calendar days should not each get a spotlight').toBe(0);
    expect(r.dashCardSpot, 'the dashboard is still being skipped').toBeGreaterThan(0);
    expect(r.calCardSpot, 'the calendar panel is still being skipped').toBeGreaterThan(0);
  });

  /* One listener for the whole app rather than one per card. That is what
     makes covering every panel affordable, and it is invisible from outside —
     so it is asserted directly, by checking the glow still tracks on a card
     that has nothing bound to it. */
  test('the pointer tracking is delegated, so any card responds', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => (window as any).nav?.('settings'));
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('#settings .card.flux-spotlight').length), { timeout: 4000 })
      .toBeGreaterThan(0);

    const moved = await page.evaluate(async () => {
      const card = document.querySelector('#settings .card.flux-spotlight') as HTMLElement;
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, pointerType: 'mouse',
        clientX: r.left + 40, clientY: r.top + 20,
      }));
      await new Promise((res) => setTimeout(res, 50));
      return {
        x: card.style.getPropertyValue('--spot-x'),
        y: card.style.getPropertyValue('--spot-y'),
      };
    });

    // The offsets are relative to the card, and only the document-level
    // listener could have set them — nothing is bound to the card itself.
    expect(moved.x).toBe('40px');
    expect(moved.y).toBe('20px');
  });

  /* Touch is excluded on purpose: with no hover, the pointer sits wherever
     you last tapped and the glow becomes a smudge parked behind your finger. */
  test('a touch pointer does not drag the glow around', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => (window as any).nav?.('settings'));
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('#settings .card.flux-spotlight').length), { timeout: 4000 })
      .toBeGreaterThan(0);

    const x = await page.evaluate(async () => {
      const card = document.querySelector('#settings .card.flux-spotlight') as HTMLElement;
      card.style.removeProperty('--spot-x');
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, pointerType: 'touch',
        clientX: r.left + 90, clientY: r.top + 30,
      }));
      await new Promise((res) => setTimeout(res, 50));
      return card.style.getPropertyValue('--spot-x');
    });
    expect(x).toBe('');
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
