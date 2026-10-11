import { test, expect } from '@playwright/test';

/**
 * Dropdowns on Windows. Chrome there draws an open <select>'s list itself,
 * with the select's text colour on the system's own background unless the
 * page says it is dark. Flux's standalone pages give their selects light
 * text on a see-through fill, so on Windows the options came out white on
 * white. Every page here must declare color-scheme: dark and give options a
 * solid fill. (The planner sets its own scheme per theme.)
 */
const PAGES = ['composer.html#beats', 'composer.html#dp', 'periodic.html', 'grapher.html', 'calculator.html', 'flashcards.html', 'pixel.html', 'hub.html', 'partners.html'];

test('every dropdown on the standalone pages has a readable list', async ({ page }) => {
  const bad: string[] = [];
  let checked = 0;
  for (const p of PAGES) {
    await page.goto('/' + p);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const opaque = (c: string) => !/rgba\(.*,\s*0(\.\d+)?\)$|transparent/.test(c) && !/\/\s*0(\.\d+)?\)$/.test(c);
      return {
        scheme: getComputedStyle(document.documentElement).colorScheme,
        unreadable: [...document.querySelectorAll('select option')]
          .filter((o) => !opaque(getComputedStyle(o).backgroundColor)).length,
        options: document.querySelectorAll('select option').length,
      };
    });
    checked += r.options;
    if (!/dark/.test(r.scheme)) bad.push(`${p}: color-scheme is ${r.scheme}`);
    if (r.unreadable) bad.push(`${p}: ${r.unreadable} options have no solid fill`);
  }
  expect(checked, 'no options were found, so this checked nothing').toBeGreaterThan(20);
  expect(bad).toEqual([]);
});
