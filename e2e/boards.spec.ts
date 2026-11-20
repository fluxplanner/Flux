import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Boards (D9 acceptance). Plain must be untouched, every board must keep
 * --muted text at 4.5:1 on a card, body's background is never painted, and
 * the picker works from the keyboard.
 */

const BOARDS = ['grid', 'dots', 'lined', 'graph', 'blueprint', 'chalk', 'cork', 'linen', 'aurora', 'topo', 'waves', 'stars'];

async function openLayout(page: Page) {
  await page.evaluate(() => { const w = window as any; w.nav?.('settings'); const t = [...document.querySelectorAll('.stab')].find((b) => /Layout/.test(b.textContent || '')); w.switchStab?.('appearance', t); });
  await expect(page.locator('#fxBoardsCard')).toBeVisible();
}

/* Composite: board base → scrim → card, then contrast of --muted on the result.
   The base colour is the flattest, worst-case reading of each board. */
async function mutedContrast(page: Page) {
  return page.evaluate(() => {
    // Chrome reports color-mix() results as color(srgb r g b / a) in 0–1, not rgba().
    const parse = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); const k = /^color\(srgb/.test(c) ? 255 : 1; return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m[3] ?? 1 }; };
    // Resolve the scrim's calc() by letting the browser compute it on a probe.
    const resolve = (v: string) => { const d = document.createElement('i'); d.style.backgroundColor = v; document.body.appendChild(d); const out = getComputedStyle(d).backgroundColor; d.remove(); return out; };
    const over = (top: any, bot: any) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const lum = (c: any) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const app = document.getElementById('app')!;
    const base = parse(getComputedStyle(app, '::before').backgroundColor);
    const scrim = parse(resolve(getComputedStyle(app).getPropertyValue('--bg-scrim').trim()));
    const card = document.querySelector('#fxBoardsCard') as HTMLElement;
    const surface = over(parse(getComputedStyle(card).backgroundColor), over(scrim, base));
    const fg = parse(getComputedStyle(card.querySelector('.fx-hint') as HTMLElement).color);
    const a = lum(fg), b = lum(surface);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

test.describe('Boards', () => {
  test('plain leaves the shell untouched', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const r = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute('data-flux-bg'),
      before: getComputedStyle(document.getElementById('app')!, '::before').content,
    }));
    expect(r).toEqual({ attr: null, before: 'none' });
  });

  for (const theme of ['dark', 'light']) {
    test(`all 12 boards keep muted text at 4.5:1 and leave body alone (${theme})`, async ({ page }) => {
      await gotoScenario(page, 'student-semester');
      // Use the app's own switch: it also swaps the colour tokens, not just the attribute.
      await page.evaluate((t) => { (window as any).applyTheme(t); }, theme);
      await openLayout(page);
      const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundImage + '|' + getComputedStyle(document.body).backgroundColor);
      const plainBody = await bodyBg();
      for (const id of BOARDS) {
        await page.locator(`#fxBoardsCard .fx-bg-tile[data-board-id="${id}"]`).click();
        await expect(page.locator('html')).toHaveAttribute('data-flux-bg', id);
        expect(await mutedContrast(page), id).toBeGreaterThanOrEqual(4.5);
        expect(await bodyBg()).toBe(plainBody);
      }
    });
  }

  test('keyboard: one tab stop, arrows move, Enter picks, aria-pressed follows', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openLayout(page);
    await expect(page.locator('#fxBoardsCard .fx-bg-tile[tabindex="0"]')).toHaveCount(1);
    await page.locator('#fxBoardsCard .fx-bg-tile[data-board-id="plain"]').focus();
    await page.keyboard.press('ArrowRight');
    const grid = page.locator('#fxBoardsCard .fx-bg-tile[data-board-id="grid"]');
    await expect(grid).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(grid).toHaveAttribute('aria-pressed', 'true');
    await expect(grid).toBeFocused();
  });

  test('sliders, persistence, low-end, print and reset', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openLayout(page);
    await page.locator('#fxBoardsCard .fx-bg-tile[data-board-id="aurora"]').click();
    await page.locator('#fxBoardsCard input[data-bg="blur"]').fill('6');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('app')!, '::before').filter)).toBe('blur(6px)');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flux_board') || 'null'))).toMatchObject({ id: 'aurora', blur: 6 });

    await page.evaluate(() => document.documentElement.setAttribute('data-flux-lowend', '1'));
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('app')!, '::before').filter)).toBe('none');
    await page.evaluate(() => document.documentElement.removeAttribute('data-flux-lowend'));

    await page.emulateMedia({ media: 'print' });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('app')!, '::before').display)).toBe('none');
    await page.emulateMedia({ media: 'screen' });

    await page.locator('#fxBoardsCard [data-bg-reset]').click();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-flux-bg'))).toBeNull();
  });

  test('a hand-edited value cannot inject into the selector', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => { localStorage.setItem('flux_board', JSON.stringify({ id: '"] body{display:none', strength: 'x', blur: 999, dim: -3 })); (window as any).FluxBoards.apply(); });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-flux-bg'))).toBeNull();
  });
});
