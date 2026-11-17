import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The checks every free tool page shares (paper.html, units.html …): it
 * renders with its own title, works at 390px in the dark and light themes,
 * has no serious axe findings, logs no errors, and asks nothing of any other
 * host — the pages promise to work offline with no account.
 */

/** Signed in with the light theme, the way flux-theme-carry.js applies it. */
export async function useLightTheme(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('sb-lfigdijuqmbensebnevo-auth-token', JSON.stringify({ access_token: 't', user: { id: 'u-light' } }));
    localStorage.setItem('flux_theme', '"light"');
  });
}

export function toolPageBasics(file: string, title: RegExp) {
  test.describe(`${file} basics`, () => {
    for (const theme of ['dark', 'light'] as const) {
      test(`renders at 390px in the ${theme} theme, axe clean, nothing fetched elsewhere`, async ({ page }) => {
        const errors: string[] = [];
        const foreign: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Content Security Policy.*report/i.test(m.text())) errors.push(m.text()); });
        page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) foreign.push(r.url()); });
        if (theme === 'light') await useLightTheme(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/' + file);
        await expect(page).toHaveTitle(title);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('.ft-back')).toHaveAttribute('href', 'suite.html');
        if (theme === 'light') expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll').toBe(true);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['color-contrast']).analyze();
        expect(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
        await page.waitForTimeout(200);
        expect(errors).toEqual([]);
        expect(foreign).toEqual([]);
      });
    }
  });
}
