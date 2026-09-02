import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Extracurriculars was five long cards in one column, mixing "what I do after
 * school" with "where I'm applying", and its two AI helpers sat four cards
 * apart with nothing saying they answered different questions. It is now two
 * sub-sections, Activities and Colleges.
 *
 * The risk worth a test is the cards other modules inject. flux-opportunities
 * appends to #goals .flux-stack, which is now the wrapper holding *both*
 * panes — a card added there sits outside either one and shows under Colleges
 * as well as Activities, which looks like a bug and can't be switched away.
 */
test.describe('Extracurriculars sections', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'goals');
    await expect(page.locator('#goals.panel.active')).toBeVisible();
  });

  test('splits into Activities and Colleges, and switching swaps the pane', async ({ page }) => {
    const before = await page.evaluate(() => ({
      tabs: [...document.querySelectorAll('#goals .stab')].map((b) => b.textContent!.trim()),
      panes: [...document.querySelectorAll('#goals .spane')].map((p) => ({
        id: p.id,
        on: p.classList.contains('active'),
        cards: [...p.querySelectorAll(':scope > .card')].map((c) => c.querySelector('h3')?.textContent?.trim()),
      })),
    }));

    expect(before.tabs).toEqual(['Activities', 'Colleges']);
    expect(before.panes.map((p) => p.id)).toEqual(['ecpane-activities', 'ecpane-colleges']);
    // Activities opens by default — it is the half you fill in first.
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
    expect(after.panes).toEqual(['ecpane-activities:false', 'ecpane-colleges:true']);
    expect(after.tabs).toEqual(['Activities:false', 'Colleges:true']);
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
});
