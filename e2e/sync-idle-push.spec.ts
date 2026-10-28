import { test, expect } from '@playwright/test';
import { bootSignedIn } from './helpers';

/*
 * "Everything is unsynced and I have to finish tasks multiple times on
 * different devices."
 *
 * With Canvas connected, the row's `integrations` carried updatedAt: Date.now(),
 * read on every push — so the payload never matched what was last sent and the
 * device rewrote the row every 2.5s, forever. Every other device's write then
 * found the row moved, lost the race, and its ticks never stuck.
 */
test('a device with Canvas connected stops writing once nothing has changed', async ({ page }) => {
  test.setTimeout(60_000);
  const tasks = [{ id: 1, name: 'Essay', done: false, createdAt: 1 }];
  const boot = await bootSignedIn(page, {
    tasks,
    cloud: {
      tasks, onboarded: true,
      integrations: { canvasToken: 'test-token', canvasHost: 'school.instructure.com', canvasUrl: 'https://school.instructure.com' },
    } as any,
  });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveClass(/visible/);
  await expect.poll(() => boot.state.pulls, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(4000);   // first pull merged, any catch-up push sent
  const settled = boot.state.pushes;
  await page.waitForTimeout(10_000); // four push ticks with nothing to send
  expect(boot.state.pushes - settled, 'idle device kept rewriting the row').toBe(0);
});
