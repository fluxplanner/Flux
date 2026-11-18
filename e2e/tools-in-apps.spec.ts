import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The free tool pages are not Suite apps (Azfer, 2026-11-18): each opens
 * inside the app it fits, through public/js/flux-tool-embed.js, and the rest
 * sit in the planner's Study tools.
 */

const HOSTS: [string, string, string][] = [
  ['periodic.html', 'balance.html', 'Balance'],
  ['grapher.html', 'data.html', 'Statistics'],
  ['grapher.html', 'lab.html', 'Lab helper'],
  ['pixel.html', 'paper.html', 'Graph paper'],
  ['flashcards.html', 'spell.html', 'Spelling'],
];

for (const [host, tool, title] of HOSTS) {
  test(`${host} opens ${title} in a sheet, without the tool's own header`, async ({ page }) => {
    await page.goto('/' + host);
    await page.locator(`[data-flux-tool="${tool}"]`).click();
    const sheet = page.getByRole('dialog', { name: title });
    await expect(sheet).toBeVisible();
    const frame = page.frameLocator('.ftx-sheet iframe');
    await expect(frame.locator('h1').first()).toBeVisible();
    await expect(frame.locator('header.top')).toBeHidden();
    await page.getByRole('button', { name: 'Close ' + title }).click();
    await expect(sheet).toHaveCount(0);
  });
}

test('Balance works inside the Periodic Table', async ({ page }) => {
  await page.goto('/periodic.html');
  await page.locator('[data-flux-tool="balance.html"]').click();
  const f = page.frameLocator('.ftx-sheet iframe');
  await f.locator('#eqIn').fill('H2 + O2 -> H2O');
  await f.locator('#eqForm button').click();
  await expect(f.locator('#eqOut .ft-big')).toHaveText('2H₂ + O₂ → 2H₂O');
});

test('the Suite no longer lists the tool pages', async ({ page }) => {
  await page.goto('/suite.html');
  for (const t of ['paper', 'units', 'cite', 'balance', 'formulae', 'score', 'timer', 'plan', 'data', 'lab', 'spell', 'timetable']) {
    await expect(page.locator(`#apps .app--${t}`)).toHaveCount(0);
  }
});

test('the planner Study tools hold the rest, drawn inline at full height', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 950 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('toolbox'));
  await expect(page.locator('#fshGroups')).toBeVisible();
  for (const [sid, tid, file] of [['organise', 'page-score', 'score.html'], ['labgraph', 'page-units', 'units.html'], ['english', 'page-cite', 'cite.html']]) {
    await page.evaluate(([s, t]) => (window as any).fluxStudyHub.openTool(s, t), [sid, tid]);
    const sel = `iframe.ftx-frame[src="${file}?embed=1#embed"]`;
    await expect(page.locator(sel)).toBeVisible();
    await expect(page.frameLocator(sel).locator('h1')).toBeVisible();
  }
  // The frame grows to its page and stops: no runaway height.
  await page.waitForTimeout(800);
  const h1 = await page.locator('iframe.ftx-frame').last().evaluate((f) => (f as HTMLElement).offsetHeight);
  await page.waitForTimeout(800);
  const h2 = await page.locator('iframe.ftx-frame').last().evaluate((f) => (f as HTMLElement).offsetHeight);
  expect(h1).toBeGreaterThan(300);
  expect(h2).toBe(h1);
});
