import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Extracurriculars was five long cards in one column, mixing "what I do after
 * school" with "where I'm applying", and its two AI helpers sat four cards
 * apart with nothing saying they answered different questions. It is now the
 * College Prep tab, in three sub-sections: Activities, Colleges, Test scores.
 *
 * Test scores arrived last, moved off the Profile tab where it had been
 * sitting four cards down under "Academic Stats" — the first thing said about
 * it was "I couldn't find the SAT ACT stuff anywhere".
 *
 * The risk worth a test is the cards other modules inject. flux-opportunities
 * appends to #goals .flux-stack, which is the wrapper holding *all* the
 * panes — a card added there sits outside every one of them and shows under
 * Colleges as well as Activities, which looks like a bug and can't be switched
 * away.
 */
test.describe('College Prep sections', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'goals');
    await expect(page.locator('#goals.panel.active')).toBeVisible();
  });

  test('splits into Activities, Colleges and Test scores, and switching swaps the pane', async ({ page }) => {
    const before = await page.evaluate(() => ({
      tabs: [...document.querySelectorAll('#goals .stab')].map((b) => b.textContent!.trim()),
      panes: [...document.querySelectorAll('#goals .spane')].map((p) => ({
        id: p.id,
        on: p.classList.contains('active'),
        cards: [...p.querySelectorAll(':scope > .card')].map((c) => c.querySelector('h3')?.textContent?.trim()),
      })),
    }));

    expect(before.tabs).toEqual(['Activities', 'Colleges', 'Test scores']);
    expect(before.panes.map((p) => p.id)).toEqual(['ecpane-activities', 'ecpane-colleges', 'ecpane-scores']);
    // Activities opens by default — it is the part you fill in first.
    expect(before.panes[0].on).toBe(true);
    expect(before.panes[0].cards).toContain('My Activities');
    expect(before.panes[0].cards).toContain('Goals & Milestones');
    expect(before.panes[1].cards).toContain('Target Schools');

    const after = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#goals .stab')].find(
        (b) => b.textContent!.trim() === 'Colleges',
      ) as HTMLButtonElement;
      btn.click();
      return {
        panes: [...document.querySelectorAll('#goals .spane')].map((p) => p.id + ':' + p.classList.contains('active')),
        tabs: [...document.querySelectorAll('#goals .stab')].map(
          (b) => b.textContent!.trim() + ':' + b.getAttribute('aria-selected'),
        ),
      };
    });
    expect(after.panes).toEqual(['ecpane-activities:false', 'ecpane-colleges:true', 'ecpane-scores:false']);
    expect(after.tabs).toEqual(['Activities:false', 'Colleges:true', 'Test scores:false']);
  });

  test('injected cards land inside a section, not floating outside both', async ({ page }) => {
    // flux-opportunities injects on a 150ms timer once the panel is visible.
    await page.waitForFunction(() => !!document.getElementById('foppGoalsCard'), null, { timeout: 10_000 });
    const placement = await page.evaluate(() => {
      const stack = document.querySelector('#goals .flux-stack')!;
      return {
        opportunities: document.getElementById('foppGoalsCard')?.closest('.spane')?.id || 'outside a section',
        // Anything directly under .flux-stack that is not a pane shows on both
        // tabs at once.
        strays: [...stack.children].filter((c) => !c.classList.contains('spane')).map((c) => c.id || c.className),
      };
    });
    expect(placement.opportunities).toBe('ecpane-activities');
    expect(placement.strays).toEqual([]);
  });

  test('Settings and Extracurriculars tab strips do not clear each other', async ({ page }) => {
    // switchEcSection and switchStab both work by clearing every .stab and
    // .spane before setting one. If either forgot to scope its query, opening
    // a section in one panel would blank the other.
    const state = await page.evaluate(() => {
      const w = window as unknown as { switchEcSection: (id: string) => void; switchStab: (id: string) => void };
      w.switchEcSection('colleges');
      w.switchStab('help');
      return {
        ec: document.querySelector('#goals .spane.active')?.id,
        settings: document.querySelector('#settings .spane.active')?.id,
      };
    });
    expect(state.ec).toBe('ecpane-colleges');
    expect(state.settings).toBe('spane-help');
  });

  /*
   * An activity keeps the colour you pick for it.
   *
   * Activities were coloured by TYPE, so every club read the same shade and
   * nothing told one from another at a glance. Classes had a picker in both
   * their add and edit forms; activities had none at all.
   *
   * Three things must hold, and the last two are the ones that quietly rot:
   * the colour is saved, re-opening the activity loads it back into the input
   * (otherwise an edit repaints it with whatever the field happened to show),
   * and clearing the form resets to the default rather than blanking it —
   * '' is not a valid <input type=color> value, so a blank leaves the
   * browser's own black behind.
   */
  test('an activity keeps the colour you pick, on save and on re-open', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('goals'));
    await page.waitForTimeout(900);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const picker = document.getElementById('extraColor') as HTMLInputElement | null;
      if (!picker) return { noPicker: true } as Record<string, unknown>;
      (document.getElementById('extraName') as HTMLInputElement).value = 'Colour Probe Club';
      picker.value = '#ff00ff';
      w.addExtra();
      await new Promise((r2) => setTimeout(r2, 300));

      /* Read it back from storage, not a window global — `extras` is a closure
         variable and window.extras is undefined, so a naive lookup finds
         nothing and everything below would fail for the wrong reason. */
      const saved = (w.load('flux_extras', []) as Array<Record<string, unknown>>)
        .find((x) => x.name === 'Colour Probe Club');
      const row = [...document.querySelectorAll('#extrasList > div')]
        .find((d) => (d.textContent || '').includes('Colour Probe Club')) as HTMLElement | undefined;
      const stripe = row ? getComputedStyle(row).borderLeftColor : 'NO ROW';

      let reopened = 'n/a';
      if (saved) {
        w.editExtra(saved.id);
        await new Promise((r2) => setTimeout(r2, 200));
        reopened = (document.getElementById('extraColor') as HTMLInputElement).value;
      }
      w.cancelEditExtra();
      const cleared = (document.getElementById('extraColor') as HTMLInputElement).value;
      return { noPicker: false, savedColor: saved?.color ?? 'NOT SAVED', stripe, reopened, cleared };
    });

    expect(r.noPicker, 'the activity form has no colour picker').toBe(false);
    expect(r.savedColor, 'the chosen colour was not stored on the activity').toBe('#ff00ff');
    expect(r.stripe, 'the activity row does not show its colour').toBe('rgb(255, 0, 255)');
    expect(r.reopened, 'editing an activity did not load its saved colour').toBe('#ff00ff');
    expect(r.cleared, 'clearing the form left the browser default instead of ours').toBe('#fbbf24');
  });
});
