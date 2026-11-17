import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('timer.html', /Flux Timer/);

test('countdown runs out, stopwatch laps, tap tempo sets the speed', async ({ page }) => {
  await page.clock.install();
  await page.goto('/timer.html');
  await page.fill('#cdMin', '0');
  await page.fill('#cdSec', '3');
  await expect(page.locator('#cdFace')).toHaveText('00:03');
  await page.click('#cdGo');
  await page.clock.runFor(3500);
  await expect(page.locator('#cdFace')).toHaveText('00:00');
  await expect(page.locator('#cdSay')).toHaveText('Time is up.');
  await page.click('#tab-sw');
  await page.click('#swGo');
  await page.clock.runFor(1500);
  await page.click('#swLap');
  await expect(page.locator('#swLaps li')).toHaveCount(1);
  // At least the 1.5s run; real click time can add a little.
  const sec = parseFloat((await page.locator('#swFace').textContent())!.slice(3));
  expect(sec).toBeGreaterThanOrEqual(1.4); // tenths are floored
  await page.click('#tab-metro');
  for (let i = 0; i < 4; i++) { await page.click('#mtTap'); await page.clock.runFor(500); }
  // Clicks take a little real time too, so about 120.
  await expect(page.locator('#mtFace')).toHaveText(/^1(0[5-9]|1\d|2[0-5]) bpm$/);
  await page.click('#tab-int');
  await page.fill('#inWork', '2'); await page.fill('#inRest', '1'); await page.fill('#inRounds', '2');
  await page.click('#inGo');
  await expect(page.locator('#inPhase')).toHaveText('Work · round 1 of 2');
  await page.clock.runFor(2200);
  await expect(page.locator('#inPhase')).toHaveText('Rest · round 1 of 2');
  await page.clock.runFor(4000);
  await expect(page.locator('#inPhase')).toHaveText('Done — 2 rounds');
});
