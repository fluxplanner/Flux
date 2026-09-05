import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The rule that decides whether a cloud list may replace the local one.
 *
 * The bug it exists for: syncFromCloud() assigned every collection straight
 * across — `if(d.colleges){colleges=d.colleges}` — and `[]` is truthy in
 * JavaScript. So an empty array in the cloud row replaced a populated local
 * list, and since the pull runs every 8 seconds the item was gone from
 * localStorage too, seconds after it was added. That is the reported
 * "colleges and activities disappear when it refreshes".
 *
 * These assertions are written as the four situations rather than as calls,
 * because the property that matters is directional: an empty cloud list must
 * never win, and a non-empty one always must. Getting that backwards is
 * silent data loss, which is exactly what happened.
 */
test.describe('Cloud pull cannot delete a local list', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
  });

  test('an empty cloud list never replaces a populated local one', async ({ page }) => {
    const res = await page.evaluate(() => {
      const f = (window as any).cloudListWins as (a: unknown, b: unknown) => boolean;
      if (typeof f !== 'function') return null;
      const local = [{ id: 1, name: 'Michigan' }];
      return {
        // The exact shape of the bug: cloud has nothing, local has a college.
        emptyOverPopulated: f([], local),
        // Both empty — nothing to lose, so it may apply.
        emptyOverEmpty: f([], []),
        // Real data arriving must still land, or sync would do nothing at all.
        populatedOverEmpty: f([{ id: 2, name: 'Purdue' }], []),
        populatedOverPopulated: f([{ id: 2, name: 'Purdue' }], local),
        // A missing or malformed field is not a list and must be ignored.
        missing: f(undefined, local),
        notAnArray: f({ 0: 'x' }, local),
      };
    });

    expect(res, 'cloudListWins is not defined — the guard is missing').not.toBeNull();

    expect(res!.emptyOverPopulated,
      'an empty cloud list overwrote a populated local one — this is the data-loss bug').toBe(false);
    expect(res!.missing, 'an absent field was treated as a list').toBe(false);
    expect(res!.notAnArray, 'a non-array was treated as a list').toBe(false);

    // The other direction matters just as much: over-guarding would silently
    // stop sync working, which is a different bug that looks like this one.
    expect(res!.populatedOverEmpty, 'real cloud data failed to apply').toBe(true);
    expect(res!.populatedOverPopulated, 'real cloud data failed to apply').toBe(true);
    expect(res!.emptyOverEmpty).toBe(true);
  });

  test('the guard is in the shipped bundle, not just the source', async ({ page }) => {
    /* Flux serves minified bundles, so a fix made in public/js and never built
       does nothing at all. This reads what the page actually loaded. */
    const src = await page.evaluate(async () => {
      const tag = [...document.querySelectorAll('script[src]')]
        .map((s) => (s as HTMLScriptElement).src)
        .find((s) => /flux-core\.[0-9a-f]{8}\.js$/.test(s));
      if (!tag) return null;
      return (await fetch(tag)).text();
    });

    expect(src, 'could not find the core bundle').not.toBeNull();
    for (const key of ['flux_colleges', 'flux_goals', 'flux_ec_schools', 'flux_ec_goals', 'flux_extras']) {
      expect(src!.includes(key), `${key} is not in the shipped bundle at all`).toBe(true);
    }
    expect(src!.includes('cloudListWins'),
      'the guard is not in the shipped bundle — was npm run build:web skipped?').toBe(true);
  });
});
