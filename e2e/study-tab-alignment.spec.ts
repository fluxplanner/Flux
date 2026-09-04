import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The sliding highlight behind the active Study Tools sub-tab must actually sit
 * under the tab it is highlighting.
 *
 * It didn't. Measured across every subject and every sub-tab, 71 of 84 were
 * out — the worst by 32px, which is what "off centre on some of the tabs"
 * looks like once you find the number behind it.
 *
 * Cause: the highlight was positioned one frame after render
 * (requestAnimationFrame), but flux-iconify replaces each emoji icon with an
 * <svg class="fxi"> on a setTimeout(…, 32) — a tick later. The SVG is ~4px
 * narrower than the emoji, so every tab shrank after the highlight had already
 * recorded its width, and the drift accumulated left to right.
 *
 * The tell was which tabs were correct: 〜Waves, ⊞Matrix, ∑Formulas, ƂIPA —
 * every one whose icon is a plain text glyph iconify never touches. Those sat
 * at exactly 0, which is why it was "some of the tabs" and not all of them.
 *
 * This walks the whole grid rather than spot-checking, because the drift is
 * positional: tab 1 of a subject can be perfect while tab 9 is 30px out.
 */

/* Astronomy folded into Physics and Civics into Global Politics; Visual Arts
   added; the shared Languages pill split into French, German and Spanish. The
   three language pills are worth sweeping specifically: their tabs carry 🔍 🗣
   📋 💬, all four of which iconify swaps, so they are exactly the shape of tab
   strip this test exists for. */
const SUBJECTS = ['chemistry', 'physics', 'biology', 'math', 'cs',
  'history', 'glopo', 'psychology', 'econ', 'english', 'french', 'german',
  'spanish', 'music', 'art'];

/*
 * The snap, specifically.
 *
 * Correcting the highlight after the icon swap was the wrong fix: the
 * correction interrupted the click's own 0.32s slide, which is what you saw as
 * a snap. Chemistry never showed it, because its tabs use text glyphs
 * (⊞ ◎ ± ∑) that iconify leaves alone — which is what identified the cause.
 *
 * So this asserts the cause is gone rather than the symptom is hidden: a tab's
 * width must not change when its emoji becomes an SVG. If width is stable
 * there is nothing to correct, so there is nothing that can interrupt.
 */
test('an icon turning into an SVG does not change its tab width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
  await expect(page.locator('#fshChemTabs')).toBeVisible();

  for (const sid of ['art', 'psychology', 'biology']) {
    const { before, after, swapped } = await page.evaluate(async (s) => {
      const hub = (window as unknown as { fluxStudyHub: { selectSubject: (i: string) => void } }).fluxStudyHub;
      const labels = () => [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')]
        .map((b2) => (b2.textContent || '').trim()).join('|');
      const widths = () => [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')]
        .map((b2) => (b2 as HTMLElement).offsetWidth);
      const wasShowing = labels();
      hub.selectSubject(s);
      /* Wait for *this* subject's tabs, pre-swap.

         Two things to get past. The stage is built a frame after
         selectSubject now (so the pill lights before the panel), and
         flux-iconify swaps icons ~32ms after that. Waiting only for "no SVG
         present" was wrong: the page starts on Chemistry, whose tabs are text
         glyphs and never contain an SVG, so the wait fell straight through and
         measured Chemistry against Art. Requiring the labels to have changed
         first pins it to the right subject. */
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const now = labels();
        if (now && now !== wasShowing && !document.querySelector('#fshChemTabs .fsh-ct-ico svg.fxi')) break;
        await new Promise((r) => setTimeout(r, 4));
      }
      const b = widths();
      // Well past flux-iconify's setTimeout(…, 32) flush.
      await new Promise((r) => setTimeout(r, 500));
      return {
        before: b,
        after: widths(),
        // Prove the swap actually happened, or this passes for the wrong reason.
        swapped: document.querySelectorAll('#fshChemTabs .fsh-ct-ico svg.fxi').length,
      };
    }, sid);

    expect(swapped, `${sid}: no icon was swapped, so this proves nothing`).toBeGreaterThan(0);
    expect(after, `${sid}: tab widths changed when icons became SVGs`).toEqual(before);
  }
});

test('the highlight sits under the tab it highlights, on every sub-tab of every subject', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
  await expect(page.locator('#toolbox.panel.active')).toBeVisible();
  await expect(page.locator('#fshChemTabs')).toBeVisible();

  const offenders: string[] = [];
  let checked = 0;

  for (const sid of SUBJECTS) {
    const count = await page.evaluate(async (s) => {
      const hub = (window as unknown as { fluxStudyHub?: { selectSubject: (i: string) => void } }).fluxStudyHub;
      if (!hub) return 0;
      hub.selectSubject(s);
      await new Promise((r) => setTimeout(r, 500));
      return document.querySelectorAll('#fshChemTabs .fsh-chem-tab').length;
    }, sid);

    // A subject rendering no tabs would let this pass vacuously.
    expect(count, `${sid} rendered no sub-tabs`).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const r = await page.evaluate(async (args) => {
        const { idx, s } = args as { idx: number; s: string };
        const btns = [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')] as HTMLElement[];
        if (!btns[idx]) return null;
        btns[idx].click();
        // Comfortably past the 0.32s glide transition.
        await new Promise((res) => setTimeout(res, 650));
        /* Some sub-tabs are reference chips that navigate away on purpose
           (mode:'link' in renderLegacyTool) — "Translation" and all three
           astronomy ones do. Measuring after that reads a hidden strip and
           reports a fake failure, so come back: the chosen tool is persisted,
           so re-entering re-renders with the same tab active and the highlight
           positioned the normal way. */
        const w = window as unknown as { nav: (t: string) => void; fluxStudyHub: { selectSubject: (i: string) => void } };
        if (!document.querySelector('#toolbox.panel.active')) {
          w.nav('toolbox');
          await new Promise((res) => setTimeout(res, 400));
          w.fluxStudyHub.selectSubject(s);
          await new Promise((res) => setTimeout(res, 650));
        }
        const measure = () => {
          const g = document.getElementById('fshTabGlide');
          const a = document.querySelector('#fshChemTabs .fsh-chem-tab.active') as HTMLElement;
          if (!g || !a) return { tab: '?', dLeft: 999, dWidth: 999 };
          const gr = g.getBoundingClientRect(), ar = a.getBoundingClientRect();
          // Guard against measuring a collapsed strip and "passing" on zeros.
          if (ar.width < 2) return { tab: (a.textContent || '').trim(), dLeft: 999, dWidth: 999 };
          return {
            tab: (a.textContent || '').trim().slice(0, 28),
            dLeft: Math.round(gr.left - ar.left),
            dWidth: Math.round(gr.width - ar.width),
          };
        };
        /* Measured twice, and only a disagreement that survives the second read
           counts. Under a loaded machine this occasionally catches the strip
           mid-layout and reports one tab as 16px out — which then passes on
           every rerun, because the highlight was on its way to the right place
           rather than parked in the wrong one. The defect being guarded is a
           permanent misalignment, and a permanent misalignment cannot be
           settled by waiting, so a second read cannot hide one. */
        const first = measure();
        if (Math.abs(first.dLeft) <= 1 && Math.abs(first.dWidth) <= 1) return first;
        await new Promise((res) => setTimeout(res, 300));
        return measure();
      }, { idx: i, s: sid });

      if (!r) continue;
      checked++;
      if (Math.abs(r.dLeft) > 1 || Math.abs(r.dWidth) > 1) {
        offenders.push(`${sid} › ${r.tab}: left off by ${r.dLeft}px, width off by ${r.dWidth}px`);
      }
    }
  }

  expect(checked, 'no tabs were measured').toBeGreaterThan(50);
  expect(offenders, `highlight misaligned on ${offenders.length}/${checked} sub-tabs:\n${offenders.join('\n')}`).toEqual([]);
});
