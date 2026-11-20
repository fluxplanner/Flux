import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { toolPageBasics } from './tool-page';

toolPageBasics('timetable.html', /Flux Timetable/);

test('a preset A/B schedule becomes a calendar file that skips holidays', async ({ page }) => {
  await page.goto('/timetable.html');
  await page.selectOption('#ttPreset', 'iae');
  await page.click('#ttLoad');
  await expect(page.locator('#ttPattern')).toHaveValue('ab');
  await expect(page.locator('#ttRows tr')).toHaveCount(8);
  await page.locator('#ttRows [data-k="name"]').first().fill('Chemistry');
  await page.locator('#ttRows [data-k="name"]').first().press('Tab');
  // Monday 9 to Friday 13 March 2026, with Wednesday off: 4 school days, A B A B.
  await page.fill('#ttStart', '2026-03-09'); await page.fill('#ttEnd', '2026-03-13');
  await page.fill('#ttOff', '2026-03-11'); await page.locator('#ttOff').dispatchEvent('change');
  const dl = page.waitForEvent('download');
  await page.click('#ttIcs');
  const file = await (await dl).path();
  const ics = readFileSync(file!, 'utf8');
  expect(ics).toContain('SUMMARY:Chemistry (A1)');
  expect(ics).not.toContain('DTSTART:20260311');
  expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(16);
  // Thursday is the second A day (Mon A, Tue B, Thu A, Fri B).
  expect(ics).toContain('DTSTART:20260312T074500');
  await expect(page.locator('#ttOut')).toContainText('4 school days');
});
