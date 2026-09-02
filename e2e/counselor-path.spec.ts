import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Counselor path', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
  });

  test('counselor nav and dashboard load', async ({ page }) => {
    await expect(page.locator('[data-counselor-nav]').first()).toBeVisible();
    await expect(page.locator('#counselorDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#counselorDashboardBody')).not.toContainText('Counselor record not found');
  });

  test('counselor dashboard shows schedule sections', async ({ page }) => {
    const body = page.locator('#counselorDashboardBody');
    await expect(body).toContainText(/Today|Appointments|Upcoming|Messages/i);
  });

  test('counselor overview is not cluttered by workspace widget grid', async ({ page }) => {
    await expect(page.locator('#counselorDashboardBody #fluxWidgetGrid_counselorDashboard')).toHaveCount(0);
  });

  test('counselor caseload tools live on workspace tab', async ({ page }) => {
    await page.locator('[data-tab="counselorWorkspace"]').first().click();
    await expect(page.locator('#counselorWorkspace.panel.active')).toBeVisible();
    await expect(page.locator('#counselorWorkspaceBody .cw-tabs')).toBeVisible();
  });

  /*
   * counselorDashboard is the panel a counselor lands on, and its stat strip
   * rendered all four counts unconditionally — so the first thing they ever
   * saw was "0 0 0 0". The teacher dashboard had the same fault and was fixed
   * first. Two tests rather than one, because "hide it when empty" is easy to
   * write in a way that also hides it when there is something to say.
   */
  test('the stat strip is gone when every count is zero', async ({ page }) => {
    await expect(page.locator('#counselorDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#counselorDashboard .teacher-stats')).toHaveCount(0);
    // What replaces it says more than a zero did, and is still there.
    await expect(page.locator('#counselorDashboardBody')).toContainText(/No pending requests/i);
  });

  test('a count that has something to say still shows', async ({ page }) => {
    await expect(page.locator('#counselorDashboard.panel.active')).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as {
        FluxE2e: { getMockClient: () => { from: (t: string) => unknown } };
      };
      const client = w.FluxE2e.getMockClient();
      const realFrom = client.from.bind(client);
      // A thenable that swallows the query-builder calls, like the harness's own.
      const canned = (rows: unknown[]) => {
        const api: Record<string, unknown> = {};
        ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'order', 'limit'].forEach((m) => {
          api[m] = () => api;
        });
        api.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok);
        return api;
      };
      client.from = (table: string) => {
        if (table === 'counselor_appointments') {
          return canned([
            { id: 'e2e-appt-1', status: 'pending', date: '2099-01-01', time_slot: '09:00', student_id: 'e2e-student' },
          ]);
        }
        if (table === 'flux_messages') {
          return canned([
            { id: 'm1', content: 'hi', sender_id: 'e2e-student', thread_id: 't1', created_at: '2099-01-01T09:00:00Z' },
            { id: 'm2', content: 'hello', sender_id: 'e2e-student', thread_id: 't2', created_at: '2099-01-01T10:00:00Z' },
          ]);
        }
        return realFrom(table);
      };
    });

    await page.evaluate(() =>
      (window as unknown as { renderCounselorDashboard: () => Promise<void> }).renderCounselorDashboard(),
    );

    const strip = page.locator('#counselorDashboard .teacher-stats');
    await expect(strip).toBeVisible();
    const tiles = await strip.locator('.teacher-stat-card').allTextContents();
    // Only the two with something to report — not four, and not none.
    expect(tiles).toHaveLength(2);
    expect(tiles.join(' | ')).toContain('Pending requests');
    expect(tiles.join(' | ')).toContain('Unread messages');
    expect(tiles.join(' | ')).not.toContain('Upcoming');
  });
});
