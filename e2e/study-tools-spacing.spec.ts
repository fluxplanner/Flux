import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Vertical spacing between the cards inside a Study Tools panel.
 *
 * The bug: .fsh-chem-body is a plain block and .fsh-card carries no margin, so
 * a tool that renders one card looked right and a tool that renders two or
 * three glued them edge to edge — the second card's border sat exactly on the
 * first's. Chemistry escaped it because its panels set their own margins,
 * which is why the subject everything else gets compared against looked fine.
 *
 * A sweep of all 15 subjects and every tool found 14 tools affected, in
 * exactly two containers. The pairs below are that list, so this fails if the
 * rule is dropped, and the last test is the other half of the story: the fix
 * had to *not* apply inside .fsh-tools-grid, which already spaces its cards
 * with `gap` and would have gone to 36px under a descendant selector.
 */

const MIN_GAP = 12;   // the rule sets 18px; this leaves room for sub-pixel work

type Case = { sid: string; tool: string; label: string };
const STACKED: Case[] = [
  { sid: 'english', tool: 'rh-situation', label: 'Rhetorical situation' },
  { sid: 'english', tool: 'rh-devices', label: 'Rhetorical devices' },
  { sid: 'english', tool: 'rh-essays', label: 'Rhetoric essays' },
  { sid: 'psychology', tool: 'biology', label: 'Psych biology' },
  { sid: 'psychology', tool: 'thinking', label: 'Psych thinking' },
  { sid: 'math', tool: 'ab-limits', label: 'Calculus limits' },
  { sid: 'math', tool: 'ab-apps', label: 'Calculus applications' },
  { sid: 'glopo', tool: 'structure', label: 'Government structure' },
  { sid: 'music', tool: 'orc-transpose', label: 'Transposition' },
  { sid: 'music', tool: 'orc-score', label: 'Score order' },
  { sid: 'music', tool: 'orc-markings', label: 'Markings' },
  { sid: 'art', tool: 'analyse', label: 'Analysing a work' },
  { sid: 'art', tool: 'elements', label: 'Elements & principles' },
  { sid: 'art', tool: 'course', label: 'The three tasks' },
];

/** Gaps between the top-level cards of the open tool panel. */
async function topLevelCardGaps(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const body = document.getElementById('fshSubBody') || document.getElementById('fshChemBody');
    if (!body) return null;
    // The two containers a tool stacks cards into: the panel body itself, and
    // the .fsh-panel wrapper some tools render inside it.
    const host = body.children.length === 1 && (body.firstElementChild as HTMLElement).classList.contains('fsh-panel')
      ? (body.firstElementChild as HTMLElement)
      : body;
    const cards = [...host.children].filter((c) => c.classList.contains('fsh-card')) as HTMLElement[];
    const gaps: number[] = [];
    for (let i = 1; i < cards.length; i++) {
      gaps.push(+(cards[i].getBoundingClientRect().top - cards[i - 1].getBoundingClientRect().bottom).toFixed(1));
    }
    return { count: cards.length, gaps };
  });
}

async function openTool(page: import('@playwright/test').Page, sid: string, tool: string) {
  await page.evaluate((id) => (window as any).fluxStudyHub.selectSubject(id), sid);
  const tab = page.locator(`#fshChemTabs [data-tool="${tool}"]`).first();
  await expect(tab, `no "${tool}" tab under ${sid}`).toBeVisible();
  await tab.click();

  /* Poll until the panel stops changing, rather than waiting for the first
     card to appear.
     Clicking a tab detaches #fshSubBody and puts a fresh node in its place,
     then renders into it, so "a card is visible" can be satisfied by the
     *previous* tool's card in the instant before the swap. Under four parallel
     workers that window opens wide enough to measure through: this test read a
     three-card panel as one card roughly one run in thirty.
     Two identical consecutive reads means the render has finished. If a tool
     genuinely drops to a single card the loop simply runs out and the count
     assertion below reports it, so this hides nothing. */
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const n = await page.evaluate(() => {
      const b = document.getElementById('fshSubBody');
      return b ? b.querySelectorAll('.fsh-card').length : -1;
    });
    if (n > 0 && n === last) return;
    last = n;
    await page.waitForTimeout(100);
  }
}

test.describe('Study Tools panel spacing', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
  });

  for (const c of STACKED) {
    test(`${c.sid} · ${c.label}: stacked cards are not touching`, async ({ page }) => {
      await openTool(page, c.sid, c.tool);
      const m = await topLevelCardGaps(page);

      expect(m, 'no panel body').not.toBeNull();
      // If a tool is ever rewritten to a single card this stops being a
      // meaningful check, and saying so beats passing vacuously.
      expect(m!.count, `${c.sid}/${c.tool} no longer stacks 2+ cards — update this list`).toBeGreaterThan(1);
      for (const gap of m!.gaps) {
        expect(gap, `cards in ${c.sid}/${c.tool} are ${gap}px apart`).toBeGreaterThanOrEqual(MIN_GAP);
      }
    });
  }

  test('the grid that already had spacing was not doubled', async ({ page }) => {
    // Chemistry's Tools tab lays six cards out in .fsh-tools-grid with
    // gap:18px. A descendant rule would have added another 18 on top.
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('chemistry'));
    await page.locator('#fshChemTabs [data-tab="tools"]').first().click();
    await expect(page.locator('.fsh-tools-grid').first()).toBeVisible();

    const rowGap = await page.evaluate(() => {
      const grid = document.querySelector('.fsh-tools-grid') as HTMLElement;
      const cards = [...grid.children] as HTMLElement[];
      // Two columns, so card[2] is directly below card[0].
      if (cards.length < 3) return null;
      return +(cards[2].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom).toFixed(0);
    });

    expect(rowGap, 'grid rows should keep the grid gap, not gain a margin too').toBe(18);
  });
});
