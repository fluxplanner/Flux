import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Teacher workflow path', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
  });

  test('teacher nav and dashboard shell load', async ({ page }) => {
    await expect(page.locator('[data-teacher-nav]').first()).toBeVisible();
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#teacherDashboardBody')).toContainText(/E2E Teacher|No classes yet/i);
  });

  test('teacher can open classes action', async ({ page }) => {
    const newClass = page.locator('#teacherDashboardBody [data-action="new-class"]').first();
    await expect(newClass).toBeVisible();
    await newClass.click();
    await expect(page.locator('#createClassModal, [id*="ClassModal"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('student dashboard never renders under the work dashboard', async ({ page }) => {
    // Reproduce the leak: in Work mode, force-activate the student #dashboard
    // panel (as a stale nav / hydration race would), then route through nav().
    // The role-routing gate must bounce it to the teacher dashboard so no
    // student UI shows for staff.
    const res = await page.evaluate(async () => {
      const fr = (window as any).FluxRole;
      if (fr?.setMode) fr.setMode('work');
      await new Promise((r) => setTimeout(r, 200));

      // Gate check is the authoritative guard — assert it denies #dashboard.
      const gate = (window as any).FluxRoleRouting?.check?.('dashboard');

      // End-to-end: simulate the leak then nav, confirm role dashboard wins.
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById('dashboard')?.classList.add('active');
      (window as any).nav?.('dashboard');
      await new Promise((r) => setTimeout(r, 400));

      const dash = document.getElementById('dashboard')!;
      const dashRect = dash.getBoundingClientRect();
      const dashCs = getComputedStyle(dash);
      return {
        gateOk: gate?.ok,
        gateFallback: gate?.fallbackId,
        activePanels: [...document.querySelectorAll('.panel.active')].map((p) => p.id),
        studentDashPaints: dashCs.display !== 'none' && dashRect.height > 0,
      };
    });

    // Gate denies the student dashboard for a work-mode teacher → teacherDashboard.
    expect(res.gateOk).toBe(false);
    expect(res.gateFallback).toBe('teacherDashboard');
    // After nav(), the role dashboard is active and the student one isn't painting.
    expect(res.activePanels).toContain('teacherDashboard');
    expect(res.activePanels).not.toContain('dashboard');
    expect(res.studentDashPaints).toBe(false);
  });
});
