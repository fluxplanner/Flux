import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C4 — Grade GPS happy path: cards render in the School panel with
 * sparkline + level chip + weighted GPA (A1's level field), manual grades
 * record, weights save, and "Protect my A" proposes study blocks through
 * the A4 proposal card (nothing applied until Apply). Flag off = no residue.
 */

const seed = async (page: import('@playwright/test').Page, on: boolean) => {
  await page.evaluate(async (flagOn) => {
    const w = window as any;
    w.FLUX_EXPERIMENTS = {
      ...(w.FLUX_EXPERIMENTS || {}),
      enable_grade_gps: flagOn,
      enable_ai_action_confirm: flagOn, // A4 card is the plan surface
    };
    if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
    w.classes.length = 0;
    w.classes.push({ id: 7, period: 1, name: 'AP Biology', level: 'AP', room: '204', days: '' });
    w.save('flux_classes', w.classes);
    // History: rising trajectory + weights + an upcoming quiz in 4 days.
    w.save(w.FluxGradeGPS._key, {
      byClass: {
        7: {
          history: [
            { date: '2026-07-01', score: 88.2 },
            { date: '2026-07-05', score: 90.1 },
            { date: '2026-07-09', score: 92.4 },
          ],
          weights: [{ name: 'Quizzes', weight: 15 }, { name: 'Tests', weight: 40 }],
          target: 93,
        },
      },
    });
    const due = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);
    w.tasks.unshift({ id: 777001, name: 'Quiz: photosynthesis', date: due, subject: 'CLS7', priority: 'med', type: 'quiz', estTime: 0, difficulty: 3, notes: '', subtasks: [], done: false, rescheduled: 0, createdAt: Date.now() });
    w.nav('school');
    w.FluxGradeGPS.renderCards();
  }, on);
  // nav('school') also schedules a snapshot+re-render ~300ms later; let it
  // settle so interactions don't race a DOM rebuild (typed input would be
  // wiped between fill() and click()).
  await page.waitForTimeout(600);
};

test.describe('Grade GPS', () => {
  test('cards render trajectory, level chip, and weighted GPA', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await seed(page, true);
    const card = page.locator('#fluxGradeGps');
    await expect(card).toBeVisible();
    await expect(card).toContainText('AP Biology');
    await expect(card).toContainText('92.4%');
    // A1 level feeds weighted GPA: 92.4 → 3.7 + 1.0 AP boost = 4.7
    await expect(card).toContainText('weighted GPA 4.7');
    await expect(card.locator('svg')).toHaveCount(1); // sparkline
    await expect(card).toContainText('2 categories');
  });

  test('manual grade records a history point', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await seed(page, true);
    const row = page.locator('.fgg-row[data-class-id="7"]');
    await row.locator('[data-fgg-grade]').fill('94.5');
    await row.locator('[data-fgg-act="record"]').click();
    await expect(page.locator('#fluxGradeGps')).toContainText('94.5%');
  });

  test('Protect my A proposes study blocks through the A4 card — nothing applied until Apply', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await seed(page, true);
    const before = await page.evaluate(() => (window as any).tasks.length);
    await page.locator('.fgg-row[data-class-id="7"] [data-fgg-act="protect"]').click();
    await expect(page.locator('.flux-ai-proposal')).toBeVisible({ timeout: 10_000 });
    // Quiz = 15% → 2 blocks proposed, none created yet.
    await expect(page.locator('.flux-ai-proposal')).toContainText('Study block');
    expect(await page.evaluate(() => (window as any).tasks.length)).toBe(before);
    await page.locator('.flux-ai-prop-apply').click();
    await expect.poll(async () => page.evaluate(() => (window as any).tasks.length)).toBeGreaterThan(before);
    const paced = await page.evaluate(() => {
      const w = window as any;
      const blocks = w.tasks.filter((t: any) => /^Study block/.test(t.name));
      const quiz = w.tasks.find((t: any) => t.id === 777001);
      return blocks.every((b: any) => b.date && b.date < quiz.date);
    });
    expect(paced).toBe(true);
  });

  test('flag off: no card, no residue', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await seed(page, false);
    await expect(page.locator('#fluxGradeGps')).toHaveCount(0);
  });
});
