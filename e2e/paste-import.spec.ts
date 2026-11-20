import { test, expect } from '@playwright/test';

/**
 * "Paste a list": an assignment sheet pasted into the Import hub becomes tasks.
 * The line-by-line rules are unit-tested (test/unit/paste-import.test.mjs); this
 * covers what only the real planner can show: the planner's own date reading,
 * the review step, saving, and spotting what is already in the list.
 */
const SHEET = [
  'Assignment\tDue Date\tPoints',
  'Bio lab report\t11/20\t50 pts',
  '- [ ] Vocab quiz Nov 22 (10 pts)',
  '',
  '11/23',
  '• Essay outline',
  'Someday:',
  '- Clean locker',
].join('\n');

test('a pasted sheet becomes tasks, after a review step', async ({ page }) => {
  await page.goto('/?e2e=1&scenario=guest');
  await page.waitForFunction(() => !!(window as any).FluxPasteImport && typeof (window as any).openImportHub === 'function');
  const before = await page.evaluate(() => (window as any).tasks.length);

  await page.evaluate(() => (window as any).openImportHub());
  await page.locator('.fih-card', { hasText: 'Paste a list' }).click();
  await page.fill('#fpiText', SHEET);

  const rows = page.locator('.fpi-row');
  await expect(rows).toHaveCount(4);
  const read = await rows.evaluateAll((rs) => rs.map((r) => [
    (r.querySelector('.fpi-name') as HTMLInputElement).value,
    (r.querySelector('.fpi-date') as HTMLInputElement).value.slice(5),
  ]));
  expect(read).toEqual([
    ['Bio lab report', '11-20'],
    ['Vocab quiz', '11-22'],
    ['Essay outline', '11-23'], // dated by the line above it
    ['Clean locker', ''],       // the "Someday:" heading ends that date
  ]);
  // Nothing is saved while reviewing.
  expect(await page.evaluate(() => (window as any).tasks.length)).toBe(before);

  await rows.nth(3).locator('.fpi-check').uncheck();
  await expect(page.locator('#fpiAdd')).toHaveText('Add 3 tasks');
  await page.locator('#fpiAdd').click();
  await expect(page.locator('#fluxPasteImportModal')).toHaveCount(0);

  const added = await page.evaluate((n) => (window as any).tasks.slice(0, (window as any).tasks.length - n).map((t: any) => t.name), before);
  expect(added).toEqual(['Bio lab report', 'Vocab quiz', 'Essay outline']);

  // Pasting the same sheet again: what is already there starts unticked.
  await page.evaluate((s) => (window as any).FluxPasteImport.open(s), 'Bio lab report 11/20\nSomething new');
  await expect(page.locator('.fpi-row').nth(0).locator('.fpi-check')).not.toBeChecked();
  await expect(page.locator('.fpi-row').nth(0)).toContainText('Already in your list');
  await expect(page.locator('.fpi-row').nth(1).locator('.fpi-check')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#fluxPasteImportModal')).toHaveCount(0);
});
