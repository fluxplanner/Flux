import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Every dashboard task must be clickable — including the first and the last.
 *
 * Regression guard for a bug that shipped twice. The Report button was
 * `position: fixed` at bottom-left, so it sat on top of the task list at a
 * fixed screen band. Whichever row landed in that band had its checkbox
 * covered and read as dead: the row looks completely normal, you click it,
 * nothing happens, and scrolling does not help because the button does not
 * scroll. The first attempt at a fix only nudged it sideways (it went from
 * covering the sign-in line to covering the tasks); the second only padded the
 * bottom of the scroller, which rescued the last row while every other row
 * still died on the way past.
 *
 * These tests assert the property that actually matters and is independent of
 * where any given widget is parked: a click aimed at a task's checkbox must
 * land on that task, and must toggle it. They hit-test rather than trusting
 * Playwright's own click, because Playwright reports success for a click that
 * an overlay swallowed.
 */

const CHECK = '.task-item .check';

test.describe('Dashboard tasks are clickable', () => {
  test('nothing is parked on top of the first or last task', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await expect(page.locator('#dashboard .task-item').first()).toBeVisible();

    const covered = await page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>('#dashboard .task-item')];
      const probe = (row: HTMLElement) => {
        const cb = row.querySelector<HTMLElement>('.check');
        if (!cb) return null;
        const r = cb.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || row.contains(top)) return null;
        return `${(row.textContent || '').trim().slice(0, 30)} ← covered by ` +
          `${top.tagName}#${top.id || '-'}.${(top.className || '-').toString().slice(0, 40)}`;
      };
      return rows.map(probe).filter(Boolean);
    });

    expect(covered, `task rows whose checkbox is covered:\n${covered.join('\n')}`).toEqual([]);
  });

  test('clicking the first task actually ticks it off', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    const first = page.locator(`#dashboard ${CHECK}`).first();
    await expect(first).toBeVisible();

    const doneCount = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('tasks'));
      const list: Array<{ done?: boolean }> = JSON.parse(localStorage.getItem(key!) || '[]');
      return list.filter((t) => t.done).length;
    });

    expect(await doneCount()).toBe(0);
    await first.click();
    await expect.poll(doneCount).toBe(1);
  });

  test('the Report button sits in the sidebar, not over the content', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    const fab = page.locator('#fluxReportFab');
    await expect(fab).toBeVisible();

    // In normal flow inside the sidebar it cannot overlap the task list; the
    // old `position: fixed` is exactly what made it a click sink.
    const placement = await page.evaluate(() => {
      const b = document.getElementById('fluxReportFab')!;
      return {
        inSidebar: !!b.closest('.sidebar-footer'),
        position: getComputedStyle(b).position,
      };
    });
    expect(placement.inSidebar).toBe(true);
    expect(placement.position).toBe('static');
  });
});
