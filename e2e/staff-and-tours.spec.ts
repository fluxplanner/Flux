import { expect, test, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The tutorials, the login page and the staff workspace, checked against what
 * the planner actually has.
 *
 * The tour used to be one fixed list: it walked students to Flux AI and Notes
 * (both gone from the sidebar), told them to link Google Calendar (paused),
 * pointed at hidden buttons, and gave teachers the student steps. The login
 * page advertised an AI tutor, AI flashcards and integrations that are off.
 * These specs pin the fixes: every tour step names something on screen, and
 * the login page names nothing the planner cannot do.
 */

async function startTour(page: Page) {
  await page.evaluate(() => (window as any).resetPlannerTour());
  await expect(page.locator('.ftour-card')).toBeVisible({ timeout: 5000 });
}

/** Walks the tour to the end, returning each step's title. */
async function walkTour(page: Page): Promise<string[]> {
  const titles: string[] = [];
  for (let i = 0; i < 20; i++) {
    const card = page.locator('.ftour-card');
    if (!(await card.count())) break;
    titles.push((await page.locator('.ftour-title').textContent())?.trim() || '');
    await page.locator('.ftour-next').click();
    await page.waitForTimeout(250);
  }
  return titles;
}

test.describe('planner tour', () => {
  test('a student is walked through the tabs they actually have', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await startTour(page);
    const titles = await walkTour(page);
    expect(titles[0]).toBe('Dashboard');
    for (const t of ['Calendar', 'Time', 'School Info', 'Study tools', 'College Prep', 'Mood', 'Settings']) {
      expect(titles, `no step for ${t}`).toContain(t);
    }
    for (const gone of ['Flux AI', 'Notes & flashcards', 'Task views']) {
      expect(titles, `the tour still describes ${gone}`).not.toContain(gone);
    }
    // Every step was countable up front, so the counter never overshot.
    await expect(page.locator('.ftour')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('flux_tour_completed'))).toBe('true');
    // Finishing brings you back to the dashboard rather than leaving you on Settings.
    await expect(page.locator('#dashboard.panel.active')).toBeVisible();
  });

  test('each step opens the tab it describes, and Back goes back', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await startTour(page);
    await page.locator('.ftour-next').click(); // New task
    await page.locator('.ftour-next').click(); // Calendar
    await expect(page.locator('.ftour-title')).toHaveText('Calendar');
    await expect(page.locator('#calendar.panel.active')).toBeVisible();
    await expect(page.locator('.ftour-count')).toContainText('3 of');
    await page.locator('.ftour-back').click();
    await expect(page.locator('.ftour-title')).toHaveText('New task');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ftour')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('flux_tour_completed'))).toBe('true');
  });

  test('a teacher gets their own steps, not the student list', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await startTour(page);
    const titles = await walkTour(page);
    for (const t of ['Work and Personal', 'Work hub', 'Messages', 'Lesson Hub', 'Resources', 'Rosters']) {
      expect(titles, `no step for ${t}`).toContain(t);
    }
    for (const studentOnly of ['Study tools', 'College Prep', 'Mood', 'School Info']) {
      expect(titles).not.toContain(studentOnly);
    }
  });

  test('a counselor tour covers Meetings and Caseload tools', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await startTour(page);
    const titles = await walkTour(page);
    expect(titles).toContain('Meetings');
    expect(titles).toContain('Caseload tools');
    expect(titles).not.toContain('Lesson Hub');
  });

  test('on a phone the tour uses the bottom bar and the More button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await startTour(page);
    const titles = await walkTour(page);
    expect(titles).toContain('More');
    expect(titles.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('onboarding', () => {
  test('the last step shows where things are, and unticking the tour skips it', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).showOnboarding(6));
    const step = page.locator('#ob-step-6');
    await expect(step).toBeVisible();
    // It used to ask which tools to "connect": G Suite, Notion, Slack…
    await expect(step).not.toContainText(/Google connects|Notion|Slack|AI profile/);
    await expect(step.locator('.ob-ready-row:visible')).toHaveCount(5);
    await page.evaluate(() => localStorage.removeItem('flux_tour_completed'));
    await page.locator('#obWantTour').uncheck();
    await page.locator('#obFinishBtn').click();
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.ftour')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('flux_tour_completed'))).toBe('true');
  });

  test('"what you will use first" offers tabs that exist', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).showOnboarding(2));
    const chips = page.locator('#obFeatureChips .ob-chip');
    await expect(chips).not.toContainText(['Flux AI']);
    const feats = await chips.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.feat));
    expect(feats).not.toContain('ai');
    expect(feats).not.toContain('notes');
    expect(feats).toContain('toolbox');
  });
});

test.describe('login page', () => {
  test('names nothing the planner cannot do', async ({ page }) => {
    await page.goto('/');
    const login = page.locator('#loginScreen');
    await expect(login).toBeVisible({ timeout: 15000 });
    const text = (await login.innerText()).replace(/\s+/g, ' ');
    for (const gone of ['Flux AI tutor', 'Flux AI Tutor', 'ask Flux AI', 'AI flashcards', 'Tagged notes', 'iCal feeds',
      'Vision import', 'Vision Import', 'AI actions', 'app integrations', 'Gradebook', 'Notion', 'Obsidian']) {
      expect(text, `login page still advertises "${gone}"`).not.toContain(gone);
    }
    await expect(login).toContainText('16');
    await expect(login).toContainText('study subjects');
  });

  test('the teachers tab rotates staff lines, not student ones', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 15000 });
    await page.locator('#lxAudTeacher').click();
    const line = page.locator('#loginDemoLineLeft');
    await expect(line).toContainText('bell by bell');
    await expect(line).not.toContainText('bell by bell', { timeout: 7000 });
    await expect(line).not.toContainText(/SAT|Pomodoro|superscores/);
  });
});

test.describe('staff workspace', () => {
  test('every Workspace row has an icon, and the counselor has no duplicate Calendar', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    const rows = page.locator('#sidebar [data-role-group="staff"] .nav-item:visible');
    const n = await rows.count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('.ni svg'), `row ${i} has no icon`).toHaveCount(1);
    }
    const calendars = page.locator('#sidebar .nav-item:visible', { hasText: /^Calendar$/ });
    await expect(calendars).toHaveCount(1);
    await expect(page.locator('#modeDesc')).toHaveText('Counselor tools');
  });

  test('staff pages keep the same gutter as the rest of the planner', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    for (const tab of ['lessonHub', 'teacherResources', 'staffMessages']) {
      await page.evaluate((t) => (window as any).nav(t), tab);
      await page.waitForTimeout(700);
      const gap = await page.evaluate((t) => {
        const p = document.getElementById(t)!;
        const h = p.querySelector('.flux-page-header') as HTMLElement;
        return h.getBoundingClientRect().left - p.getBoundingClientRect().left;
      }, tab);
      expect(gap, `${tab} content is flush against the sidebar`).toBeGreaterThanOrEqual(20);
    }
    await expect(page.locator('#topbarTitle')).toHaveText('Messages');
  });

  test('the group maker splits a class into even groups and keeps them', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    const names = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
    await page.evaluate((list) => (window as any).FluxTeacherClasses.setStudents(92001, list), names);
    await page.evaluate(() => (window as any).nav('teacherDashboard'));
    const cell = page.locator('.flux-widget-cell[data-widget-id="classroom_group_maker"]');
    await expect(cell).toBeVisible();
    await cell.locator('#fluxGroupClass').selectOption('92001');
    await cell.locator('[data-gm-mode="size"]').click();
    await cell.locator('#fluxGroupMake').click();
    const groups = cell.locator('.flux-gm-group');
    // 10 names in groups of at most 3: four groups, sizes 3,3,2,2.
    await expect(groups).toHaveCount(4);
    const sizes = await groups.evaluateAll((els) => els.map((e) => e.querySelectorAll('.flux-gm-names span').length));
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    // Redrawing the dashboard keeps the split instead of reshuffling the room.
    const read = () => page.locator('.flux-widget-cell[data-widget-id="classroom_group_maker"] .flux-gm-group')
      .evaluateAll((els) => els.map((e) => [...e.querySelectorAll('.flux-gm-names span')].map((s) => s.textContent).join(',')));
    const before = await read();
    await page.evaluate(() => (window as any).nav('lessonHub'));
    await page.evaluate(() => (window as any).nav('teacherDashboard'));
    await expect(page.locator('.flux-widget-cell[data-widget-id="classroom_group_maker"] .flux-gm-group')).toHaveCount(4);
    expect(await read()).toEqual(before);
  });

  test('quick-grade cards move on with a tap and can be removed', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => {
      const w = window as any;
      w.FluxMagic = w.FluxMagic || {};
      w.FluxMagic.prompt = async () => 'Ch 4 quiz';
    });
    const qg = page.locator('.flux-widget-cell[data-widget-id="classroom_quick_grade"]');
    await expect(qg).toBeVisible();
    await qg.locator('.flux-qg-add').click();
    const toGrade = qg.locator('.flux-qg-col[data-col="To grade"]');
    await expect(toGrade.locator('.flux-qg-card')).toHaveCount(1);
    await expect(toGrade.locator('.flux-qg-count')).toHaveText('1');
    await toGrade.locator('[data-qg-next]').click();
    await expect(qg.locator('.flux-qg-col[data-col="Graded"] .flux-qg-card')).toContainText('Ch 4 quiz');
    await expect(qg.locator('.flux-qg-col[data-col="To grade"] .flux-qg-card')).toHaveCount(0);
    await qg.locator('.flux-qg-col[data-col="Graded"] [data-qg-del]').click();
    await expect(qg.locator('.flux-qg-card')).toHaveCount(0);
  });

  test('teacher resources narrow as you type and by subject', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => (window as any).nav('teacherResources'));
    const panel = page.locator('#teacherResources');
    await expect(panel.locator('.ftr-card').first()).toBeVisible();
    const all = await panel.locator('.ftr-card:visible').count();
    await panel.locator('#ftrQ').fill('phet');
    await expect(panel.locator('.ftr-card:visible')).toHaveCount(1);
    await expect(panel.locator('.ftr-card:visible')).toContainText('PhET');
    await panel.locator('#ftrQ').fill('');
    await panel.locator('.ftr-chip', { hasText: 'Mathematics' }).click();
    const maths = await panel.locator('.ftr-card:visible').count();
    expect(maths).toBeGreaterThan(0);
    expect(maths).toBeLessThan(all);
    await expect(panel.locator('.ftr-group:visible')).toHaveCount(1);
  });

  test('Rosters jumps to the class rosters instead of the top of the dashboard', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => (window as any).nav('lessonHub'));
    await page.locator('#sidebar .nav-item[onclick*="openTeacherClassesPanel"]').click();
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#teacherDashboard .teacher-main-grid > .teacher-col').first()).toHaveClass(/fx-staff-flash/, { timeout: 4000 });
  });
});
