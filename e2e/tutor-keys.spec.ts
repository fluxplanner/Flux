import { test, expect } from '@playwright/test';

/*
 * Flux Tutor keeps study sets in this browser only. Where IndexedDB is not
 * available they live in localStorage ('flux_tutor…', and the first beta's
 * 'flux_teacher.beta.v1'), and the planner wipes localStorage on sign-out,
 * on an account switch and when its data is cleared. Like Synara's, those
 * keys belong to another app and stay.
 */
test('clearing the planner keeps Flux Tutor\'s saved sets', async ({ page }) => {
  await page.goto('/?e2e=1&scenario=student-semester');
  await expect(page.locator('#app')).toHaveClass(/visible/);
  const kept = await page.evaluate(() => {
    localStorage.setItem('flux_tutor.v2.set.abc', '{"id":"abc","title":"Cells"}');
    localStorage.setItem('flux_teacher.beta.v1', '{"notes":"beta"}');
    localStorage.setItem('flux_tutor_theme', 'light');
    localStorage.setItem('flux_some_planner_key', '1');
    (window as any).fluxClearLocalStorageKeepingApps();
    return ['flux_tutor.v2.set.abc', 'flux_teacher.beta.v1', 'flux_tutor_theme', 'flux_some_planner_key'].map((k) => localStorage.getItem(k));
  });
  expect(kept).toEqual(['{"id":"abc","title":"Cells"}', '{"notes":"beta"}', 'light', null]);
});
