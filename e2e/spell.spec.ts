import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('spell.html', /Flux Spell/);

test('a missed word comes back until it is right', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).speechSynthesis; });
  await page.goto('/spell.html');
  await page.fill('#spList', 'rhythm');
  await page.click('#spStart');
  await expect(page.locator('#spPrompt')).toContainText('Hint: r');
  await page.fill('#spAns', 'rythm');
  await page.click('#spForm button[type=submit]');
  await expect(page.locator('#spOut')).toContainText('Not quite');
  await page.fill('#spAns', 'rhythm');
  await page.click('#spForm button[type=submit]');
  await expect(page.locator('#spPrompt')).toHaveText('Done: 0 right first time out of 1.');
  await expect(page.locator('#spOut')).toContainText('rhythm');
});

test('homophones and punctuation mark an answer', async ({ page }) => {
  await page.goto('/spell.html');
  await page.click('#tab-homo');
  await page.locator('#hoOpts button').first().click();
  await expect(page.locator('#hoOut')).not.toBeEmpty();
  await page.click('#tab-punc');
  await page.locator('#puOpts [data-ok="1"]').click();
  await expect(page.locator('#puOut')).toContainText('Right');
});
