import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The sliding highlight, outside Study Tools.
 *
 * Flux already had a generic morphing pill — the thing that slides behind the
 * sidebar item and the Settings tabs. It was never a Study-Tools-only trick;
 * the pill's group list was simply hand-maintained, and most of the planner's
 * tab strips had never been added to it. So they jumped.
 *
 * Adding a group needs three things to line up: the entry in PILL_GROUPS, the
 * host being a positioning context, and the active item's own background being
 * suppressed. Miss the third and you get two highlights — one appearing
 * instantly under your click and one sliding towards it. Miss the first and
 * nothing happens at all. Both are asserted below.
 *
 * The strips are built here rather than navigated to. What is under test is
 * the pill system's coverage of these selectors, and reaching the real teacher
 * class panel or the Canvas viewer would make this a test of those flows
 * instead — slower, and it would fail for reasons that have nothing to do with
 * the highlight.
 */

/* Both axes. Several of these strips wrap (.cv-tabs and .school-work-tabs
   both set flex-wrap), so the third tab can sit on a second row and the pill
   travels down rather than across — an x-only probe reads that as "it never
   moved" and blames the wiring for a working animation. */
type Probe = { placed: string | null; x: number; y: number; activeBg: string; pillCount: number };

async function probeStrip(
  page: import('@playwright/test').Page,
  hostClass: string,
  itemClass: string,
) {
  return page.evaluate(
    async (args: { hostClass: string; itemClass: string }) => {
      const { hostClass, itemClass } = args;
      document.getElementById('pillProbe')?.remove();
      const wrap = document.createElement('div');
      wrap.id = 'pillProbe';
      // On screen and laid out — a hidden host gives zero-size rects, which
      // placePill deliberately skips, and the test would pass on nothing.
      wrap.style.cssText = 'position:fixed;top:40px;left:40px;width:600px;z-index:99999';
      wrap.innerHTML =
        `<div class="${hostClass}">`
        + `<button class="${itemClass} active" data-i="0">First tab</button>`
        + `<button class="${itemClass}" data-i="1">Second tab</button>`
        + `<button class="${itemClass}" data-i="2">Third tab</button>`
        + '</div>';
      document.body.appendChild(wrap);

      const host = wrap.firstElementChild as HTMLElement;
      /* Force the strip visible. Some of these are display:none until their
         panel decides to show them (School Info's is), and placePill
         deliberately skips a zero-size target — so without this the probe
         would be asserting against a strip nobody can see, and would pass or
         fail on whether the strip happens to be shown rather than on whether
         the pill is wired up. */
      host.style.display = 'flex';
      const items = () => [...host.querySelectorAll('.' + itemClass)] as HTMLElement[];
      const pill = () => host.querySelector('.flux-morph-pill') as HTMLElement | null;
      const posOf = (el: HTMLElement | null) => {
        if (!el) return { x: NaN, y: NaN };
        const h = host.getBoundingClientRect(), r = el.getBoundingClientRect();
        return { x: r.left - h.left, y: r.top - h.top };
      };

      /* Polled, not timed. The sync runs behind two rAFs plus a 150ms
         fallback timer and then a 340ms spring, and under a loaded machine
         rAF gets starved — a fixed wait failed a different strip on every
         run. Waiting for the condition instead of for the clock. */
      const until = async (ok: () => boolean, ms = 4000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (ok()) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };

      const clear = (el: HTMLElement) => /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(el).backgroundColor);

      // A click is what the pill system listens for.
      items()[0].click();
      /* Both conditions, because they land at different moments: the pill is
         positioned by script, while the active tab's background going
         transparent is a :has() rule re-evaluating once the pill is in the
         DOM. Reading between the two reports a settled UI as a broken one. */
      await until(() => pill()?.dataset.placed === '1' && clear(items()[0]));
      const p1 = posOf(pill());
      const first: Probe = {
        placed: pill()?.dataset.placed ?? null,
        x: p1.x, y: p1.y,
        activeBg: getComputedStyle(items()[0]).backgroundColor,
        pillCount: host.querySelectorAll('.flux-morph-pill').length,
      };

      /* Move the active class the way the owning module would, then ask the
         pill system to re-sync through the event it already listens for.

         Deliberately not a synthetic click here. Two of these strips —
         .cv-tab and .school-work-tab — have delegated click handlers in their
         owning modules, so clicking a fake button runs real app code that
         re-renders around it, and the pill was being measured mid-teardown.
         The click path is covered anyway: PILL_ITEM_SELECTOR is derived from
         the group list, and the five strips without delegated handlers are
         driven by a real click above. */
      items()[0].classList.remove('active');
      items()[2].classList.add('active');
      document.dispatchEvent(new Event('flux-nav'));
      // Wait for it to actually leave the first tab rather than for a clock.
      await until(() => {
        const p = posOf(pill());
        return Math.hypot(p.x - p1.x, p.y - p1.y) > 10 && clear(items()[2]);
      });
      const p2 = posOf(pill());
      const second: Probe = {
        placed: pill()?.dataset.placed ?? null,
        x: p2.x, y: p2.y,
        activeBg: getComputedStyle(items()[2]).backgroundColor,
        pillCount: host.querySelectorAll('.flux-morph-pill').length,
      };

      /* Whatever is active *now*, not items[2]. Some strips have a delegated
         click handler in their owning module that reacts to any click on
         their item class and moves the active tab itself — .cv-tab and
         .school-work-tab both do. Asserting against index 2 would then be
         testing my assumption about which tab is active rather than the thing
         that actually matters: that the pill is under whichever one is. */
      const activeNow = host.querySelector('.' + itemClass + '.active') as HTMLElement | null;
      const target = posOf(activeNow);
      const activeIndex = activeNow ? items().indexOf(activeNow) : -1;
      wrap.remove();
      return { first, second, target, activeIndex };
    },
    { hostClass, itemClass },
  );
}

const STRIPS: Array<[string, string, string]> = [
  ['class-tabs', 'class-tab', 'teacher class panel'],
  ['cv-tabs', 'cv-tab', 'Canvas viewer'],
  ['efm-tabs', 'efm-tab', 'educator platform'],
  ['g-hub-tabs', 'g-hub-tab', 'Google hub'],
  ['ao-dir-tabs', 'ao-dir-tab', 'staff directory'],
  ['school-work-tabs', 'school-work-tab', 'School Info'],
  ['ref-tool-tabs', 'ref-tool-tab', 'reference tools'],
  ['cm-filter-strip', 'cm-filter', 'staff class filter'],
  ['fnb-viewtabs', 'fnb-viewtab', 'notebook view switch'],
  ['flp-themes', 'flp-theme', 'language practice topics'],
];

test.describe('the sliding highlight reaches the rest of the planner', () => {
  for (const [hostClass, itemClass, where] of STRIPS) {
    test(`${where} (.${hostClass}) gets a pill that moves`, async ({ page }) => {
      await gotoScenario(page, 'student-semester');
      // The motion module adds this to <html> once it has booted.
      await page.waitForFunction(
        () => document.documentElement.classList.contains('flux-apple-motion'),
        null,
        { timeout: 15000 },
      );

      const res = await probeStrip(page, hostClass, itemClass);

      expect(res.first.pillCount, 'no morph pill was inserted').toBe(1);
      expect(res.first.placed, 'the pill was inserted but never positioned').toBe('1');
      /* Transparent, so the pill is the only highlight on screen. A colour
         here means the tab you clicked lights up instantly *and* the pill
         slides towards it. */
      expect(res.first.activeBg, 'the active tab kept its own background')
        .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

      /* It followed the active tab. Distance only — not final coordinates.
         This strip is injected into a fixed-position probe rather than sitting
         in the container it was designed for, so its exact resting rect here
         is a property of the probe, not of the pill. Where the pill *stops* is
         shared geometry with the sidebar and Settings pills that have shipped
         for months; what this change could actually break is whether these
         strips are wired up at all, which is what everything else here
         asserts. */
      const travelled = Math.hypot(res.second.x - res.first.x, res.second.y - res.first.y);
      expect(res.activeIndex, 'no tab ended up active').toBe(2);
      expect(travelled, `the pill never followed the active tab ${JSON.stringify(res)}`)
        .toBeGreaterThan(10);
      // Still one pill, not one per sync.
      expect(res.second.pillCount).toBe(1);
      expect(res.second.activeBg, 'the newly active tab kept its own background')
        .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    });
  }

  /* The sidebar, against the real thing rather than a probe.
     It had a pill sliding behind it the whole time and nobody could see it:
     .nav-item.active declares its own background with !important in two
     stylesheets, so the highlight appeared instantly under the click and the
     pill travelled underneath it, invisible. A probe would not have caught
     that — the bug was in the real element's cascade, not in the wiring. */
  test('the sidebar highlight is the pill, and it moves', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(
      () => document.documentElement.classList.contains('flux-apple-motion'),
      null,
      { timeout: 15000 },
    );

    const res = await page.evaluate(async () => {
      const host = document.querySelector('#sidebar .nav-scroll, #sidebar .sidebar-nav') as HTMLElement;
      const pill = () => host.querySelector('.flux-morph-pill') as HTMLElement | null;
      const activeItem = () => host.querySelector('.nav-item.active') as HTMLElement | null;
      const y = (el: HTMLElement | null) =>
        el ? el.getBoundingClientRect().top - host.getBoundingClientRect().top : NaN;
      const until = async (ok: () => boolean, ms = 5000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (ok()) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };

      const nav = (window as unknown as { nav: (t: string) => void }).nav;
      nav('dashboard');
      await until(() => pill()?.dataset.placed === '1' && !!activeItem());
      const startY = y(pill());
      const bgBefore = getComputedStyle(activeItem()!).backgroundColor;
      // The 3px accent bar has to travel with the pill rather than teleport.
      const barOnItem = getComputedStyle(activeItem()!, '::before').opacity;

      nav('settings');
      /* Wait for it to *arrive*, not merely to leave. The spring runs ~340ms,
         so a probe that fires the moment the pill has travelled 8px catches it
         part-way down the sidebar and reports a 50px error in a highlight that
         lands perfectly. Settling on the target is also the thing worth
         asserting. */
      await until(() => Math.abs(y(pill()) - startY) > 8 && Math.abs(y(pill()) - y(activeItem())) < 1);
      const endY = y(pill());

      return {
        pillCount: host.querySelectorAll('.flux-morph-pill').length,
        startY,
        endY,
        bgBefore,
        bgAfter: getComputedStyle(activeItem()!).backgroundColor,
        barOnItem,
        // Where the pill stopped vs where the newly active item actually is.
        offBy: Math.abs(y(pill()) - y(activeItem())),
        activeLabel: activeItem()?.textContent?.trim().slice(0, 20) ?? null,
      };
    });

    expect(res.pillCount, 'the sidebar has no morph pill').toBe(1);
    /* The heart of it: with the item's own background still painting, the
       slide is invisible no matter how well the pill animates. */
    expect(res.bgBefore, 'the active nav item is still painting its own background')
      .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(res.bgAfter).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    // The accent bar is on the pill now, so the item's own one is hidden.
    expect(res.barOnItem).toBe('0');
    expect(Math.abs(res.endY - res.startY), 'the sidebar pill never moved')
      .toBeGreaterThan(8);
    // And it landed on the item, not near it.
    expect(res.offBy, `pill is not under the active item (${JSON.stringify(res)})`)
      .toBeLessThan(2);
  });

  /* Study Tools' two rows. These are the ones Azfer looks at most, and they
     are also the only strips in the planner whose active state is a solid
     accent fill with near-black text — so they get an accent-filled pill
     rather than the neutral one. If that pill ever falls back to grey, the
     label on it becomes unreadable, which is what the fill check is for. */
  test('the Study Tools umbrella row and subject rail slide too', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(
      () => document.documentElement.classList.contains('flux-apple-motion'),
      null,
      { timeout: 15000 },
    );
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
    await expect(page.locator('#fshRail .fsh-pill').first()).toBeVisible();

    const res = await page.evaluate(async () => {
      const until = async (ok: () => boolean, ms = 5000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (ok()) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };
      const probe = async (hostSel: string, itemSel: string, clickIndex: number) => {
        const host = document.querySelector(hostSel) as HTMLElement;
        const pill = () => host.querySelector('.flux-morph-pill') as HTMLElement | null;
        const active = () => host.querySelector(itemSel + '.active') as HTMLElement | null;
        const x = (el: HTMLElement | null) =>
          el ? el.getBoundingClientRect().left - host.getBoundingClientRect().left : NaN;

        const ready = await until(() => pill()?.dataset.placed === '1');
        if (!ready) return { error: `no pill was ever placed in ${hostSel}` };
        const startX = x(pill());
        const fill = getComputedStyle(pill()!).backgroundImage;

        const items = [...host.querySelectorAll(itemSel)] as HTMLElement[];
        items[clickIndex].click();
        // Arrived, not merely departed — see the sidebar test above.
        await until(() => Math.abs(x(pill()) - startX) > 8 && Math.abs(x(pill()) - x(active())) < 1);

        return {
          error: null as string | null,
          pillCount: host.querySelectorAll('.flux-morph-pill').length,
          moved: Math.abs(x(pill()) - startX),
          activeBg: getComputedStyle(active()!).backgroundColor,
          // A gradient, not "none" — the accent fill survived onto the pill.
          fillIsGradient: /gradient/.test(fill),
          offBy: Math.abs(x(pill()) - x(active())),
        };
      };

      const groups = await probe('#fshGroups', '.fsh-group', 2);
      const rail = await probe('#fshRail', '.fsh-pill', 1);
      return { groups, rail };
    });

    for (const [name, r] of Object.entries(res)) {
      expect(r.error, `${name}: ${r.error}`).toBeNull();
      expect(r.pillCount, `${name}: expected exactly one pill`).toBe(1);
      expect(r.fillIsGradient, `${name}: the pill lost its accent fill`).toBe(true);
      expect(r.activeBg, `${name}: the active item kept its own background`)
        .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(r.moved, `${name}: the pill never moved`).toBeGreaterThan(8);
      expect(r.offBy, `${name}: the pill is not under the active item`).toBeLessThan(2);
    }
  });
});
