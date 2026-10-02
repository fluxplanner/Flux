import { test, expect } from '@playwright/test';
import { gotoScenario, watchForViolations, assertNoCspOrConsoleViolations } from './helpers';

test.describe('Teacher workflow path', () => {
  test.beforeEach(async ({ page }) => {
    await watchForViolations(page);
    await gotoScenario(page, 'teacher-workflow');
  });

  test.afterEach(async ({ page }) => {
    assertNoCspOrConsoleViolations(page);
  });

  test('teacher nav and dashboard shell load', async ({ page }) => {
    // Was [data-teacher-nav], which in the drawn sidebar is only Rosters —
    // hidden while class joining is off (test below). Lesson Hub is teachers'.
    await expect(page.locator('#sidebar [data-role-tab="teacher"][data-tab="lessonHub"]')).toBeVisible();
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
    // Was /E2E Teacher|No classes yet/. Three separate things were called
    // "classes" — this card, the sidebar entry, and the timetable on School
    // Info — so the join-code one is now plainly a roster.
    await expect(page.locator('#teacherDashboardBody')).toContainText(/Good (morning|afternoon|evening)/i);
  });

  /*
   * Class joining is off (FLUX_SCHOOL_JOIN_ENABLED), so no student can be on a
   * roster. Everything that would send to one — New assignment, rosters,
   * announcements, the parent contact log that asks which student — is hidden
   * rather than offered and leading nowhere (Azfer, 2026-10-02: "Hide them").
   */
  test('nothing on the teacher side reaches for students while joining is off', async ({ page }) => {
    const body = page.locator('#teacherDashboardBody');
    await expect(body).toContainText(/Good (morning|afternoon|evening)/i);
    await expect(body.locator('#teacherDashModulesMount .flux-widget-cell').first()).toBeVisible();
    for (const action of ['new-assignment', 'new-class', 'new-announcement']) {
      await expect(body.locator(`[data-action="${action}"]`)).toHaveCount(0);
    }
    await expect(body).not.toContainText(/Class rosters|Recent submissions|Announcements/);
    await expect(body.locator('#fluxWidget_classroom_parent_log, #fluxWidget_classroom_oops_broadcast')).toHaveCount(0);
    await expect(page.locator('#sidebar .nav-item[onclick*="openTeacherClassesPanel"]')).toBeHidden();
    await page.evaluate(() => (window as any).nav('lessonHub'));
    await expect(page.locator('#lessonHub.panel.active')).toBeVisible();
    await expect(page.locator('#lhBroadcastBtn')).toHaveCount(0);
  });

  test('Lesson Hub\'s Exit ticket puts a question up, and Another changes it', async ({ page }) => {
    await page.evaluate(() => (window as any).nav('lessonHub'));
    await page.locator('#lhExitTicketBtn').click();
    const q = page.locator('#lhExitQ');
    await expect(page.locator('#lhExit')).toBeVisible();
    const first = (await q.innerText()).trim();
    expect(first.length).toBeGreaterThan(10);
    await page.locator('#lhExitAgain').click();
    await expect(q).not.toHaveText(first);
    await page.locator('#lhExitClose').click();
    await expect(page.locator('#lhExit')).toBeHidden();
  });

  test('sign-up\'s class step fills the teaching timetable, not an empty roster', async ({ page }) => {
    await page.evaluate(() => (window as any).runTeacherOnboarding());
    await page.locator('#toWelcomeNext').click();
    await page.locator('#to_name').fill('Ms. Park');
    await page.locator('#to_subject').fill('Chemistry');
    await page.locator('#toProfileNext').click();
    await expect(page.locator('#eduOnboardContainer')).toContainText('The classes you teach');
    const row = page.locator('.class-builder-row').first();
    await row.locator('.cb-name').fill('AP Chemistry');
    await row.locator('.cb-period').fill('A1');
    await row.locator('.cb-room').fill('204');
    await page.locator('#toClassesNext').click();
    await expect(page.locator('#teacherClassCodes')).toContainText('AP Chemistry');
    await expect(page.locator('#teacherClassCodes')).not.toContainText(/code/i);
    const saved = await page.evaluate(() => (window as any).FluxTeacherClasses.list()
      .filter((c: any) => c.name === 'AP Chemistry').map((c: any) => [c.period, c.days, c.room]));
    expect(saved).toEqual([[1, 'A Day', '204']]);
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
