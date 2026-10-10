import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoScenario } from './helpers';

/*
 * Plan my week: the open work fitted into the next seven days around study
 * hours, classes, events and rest days, approved by the student, then kept up
 * during the week. The scheduling rules are unit-tested in
 * test/unit/week-plan.test.mjs; this drives the dialog a student uses.
 *
 * The clock is installed (and keeps running) at 10:00 on Monday 5 October
 * 2026. Study hours are the suggested ones: weekdays 4–9 PM, Saturday off.
 * Wednesday is a rest day; soccer is Tuesdays and Thursdays at 5 PM.
 */
const SEED = [
  { id: 881001, name: 'Algebra homework', date: '2026-10-07', estTime: 45, type: 'hw', priority: 'high' },
  { id: 881002, name: 'History essay', date: '2026-10-09', estTime: 90, type: 'essay', priority: 'med' },
  { id: 881003, name: 'Lab write-up', date: '2026-10-08', estTime: 0, type: 'lab', priority: 'med' },
  { id: 881004, name: 'Worksheet', date: '2026-10-05', time: '15:00', estTime: 20, type: 'hw', priority: 'med' },
  { id: 881005, name: 'Reading log', date: '', estTime: 30, type: 'reading', priority: 'low' },
];

async function setup(page: Page, width = 1440, height = 900) {
  await page.clock.install({ time: new Date('2026-10-05T10:00:00') });
  await page.setViewportSize({ width, height });
  await gotoScenario(page, 'student-semester');
  await page.evaluate((seed) => {
    const w = window as any;
    w.tasks = seed.map((t: any) => ({ subject: '', difficulty: 3, notes: '', subtasks: [], done: false, rescheduled: 0, createdAt: 1, ...t }));
    w.save('tasks', w.tasks);
    w.save('flux_weekly_events', [{ id: 'wk-soccer', title: 'Soccer', time: '17:00', weekdays: [2, 4], enabled: true, scope: 'outside' }]);
    w.save('flux_rest_days_v1', [{ date: '2026-10-07', kind: 'lazy' }]);
    w.renderTasks();
  }, SEED);
}

/** The study blocks in the planner, in time order. */
const blocks = (page: Page) => page.evaluate(() => (window as any).tasks
  .filter((t: any) => t.weekBlock)
  .map((t: any) => ({ id: t.id, of: t.planOf, name: t.name, date: t.date, time: t.time, min: t.estTime, done: !!t.done, key: t.weekBlock.key, pinned: !!t.weekBlock.pinned }))
  .sort((a: any, b: any) => (a.date + a.time < b.date + b.time ? -1 : 1)));
/** The tasks the student made, exactly as stored. */
const parents = (page: Page) => page.evaluate(() => JSON.stringify((window as any).tasks
  .filter((t: any) => t.planOf == null)
  .map((t: any) => ({ id: t.id, name: t.name, date: t.date, time: t.time, estTime: t.estTime, type: t.type, priority: t.priority, notes: t.notes, done: t.done }))));

const modal = (page: Page) => page.locator('#planWeekModal');
const block = (page: Page, name: string) => modal(page).locator('.pw-block', { hasText: name });

test.describe('Plan my week', () => {
  test('confirm time, see why, move and remove, approve; then tick off, plan again without duplicates, undo', async ({ page }) => {
    await setup(page);
    const before = await parents(page);

    // ── Step 1: open from the dashboard and confirm study time ──
    await page.locator('#dashPlanWeekBtn').click();
    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator('#pwSub')).toHaveText('Step 1 of 2 · Your time');
    await expect(modal(page).locator('.pw-note').first()).toContainText('suggestion');
    await expect(modal(page).locator('.pw-day[data-date="2026-10-07"]')).toContainText('Rest day');
    await expect(modal(page).locator('.pw-day[data-date="2026-10-06"] .pw-commit')).toContainText('Soccer');
    await expect(modal(page).locator('#pwMax')).toHaveValue('120'); // from the daily goal (2 h)
    await modal(page).locator('[data-act="propose"]').click();

    // ── Step 2: the proposal, by day, each with a reason ──
    await expect(modal(page).locator('#pwSub')).toHaveText('Step 2 of 2 · Your plan');
    await expect(modal(page).locator('.pw-block')).toHaveCount(4);
    const mon = modal(page).locator('section.pw-pday', { has: page.locator('#pwd-2026-10-05') });
    await expect(mon.locator('.pw-block').first()).toContainText('Algebra homework');
    await expect(mon.locator('.pw-block').first().locator('.pw-b-time')).toHaveText('4:00 – 4:45 PM');
    await expect(block(page, 'History essay').first().locator('.pw-b-why')).toHaveText('Due Fri, ~90 min left, split over 2 days');
    // No estimate: a usual time for a lab, labelled, and around soccer.
    await expect(block(page, 'Lab write-up').locator('.pw-b-why')).toHaveText('Due Thu, no estimate, so ~60 min');
    await expect(block(page, 'Lab write-up').locator('.pw-b-time')).toHaveText('6:15 – 7:15 PM');
    // What couldn't be scheduled, and why.
    const unsched = modal(page).locator('.pw-unsched');
    await expect(unsched.locator('li', { hasText: 'Worksheet' })).toContainText('Due today at 3:00 PM, before your study time starts.');
    await expect(unsched.locator('li', { hasText: 'Reading log' })).toContainText('No due date yet');
    // Nothing is written until it's approved.
    expect(await blocks(page)).toEqual([]);

    // ── Move one block, remove another ──
    await block(page, 'Lab write-up').locator('[data-act="edit"]').click();
    await expect(page.locator('#pwEdDay')).toBeFocused();
    await page.locator('#pwEdDay').selectOption('2026-10-09');
    await page.locator('#pwEdStart').fill('16:00');
    await modal(page).locator('[data-act="save-edit"]').click();
    const fri = modal(page).locator('section.pw-pday', { has: page.locator('#pwd-2026-10-09') });
    await expect(fri.locator('.pw-block', { hasText: 'Lab write-up' }).locator('.pw-b-time')).toHaveText('4:00 – 5:00 PM');
    // Anywhere is allowed; Flux only says what's off about it.
    await expect(fri.locator('.pw-b-warn')).toHaveText('After it’s due');
    await expect(page.locator('#pwLive')).toContainText('Moved to Fri, Oct 9 4:00 PM. After it’s due.');

    await mon.locator('.pw-block', { hasText: 'History essay' }).locator('[data-act="remove"]').click();
    await expect(modal(page).locator('.pw-block')).toHaveCount(3);
    await expect(unsched.locator('li', { hasText: 'History essay' })).toContainText('You took 45 min');

    // ── Approve ──
    await expect(modal(page).locator('[data-act="approve"]')).toHaveText('Approve plan (3 blocks)');
    await modal(page).locator('[data-act="approve"]').click();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.locator('#undoSnackbar')).toContainText('Added 3 study blocks');

    let b = await blocks(page);
    expect(b.map((x) => [x.name, x.date, x.time, x.min, x.pinned])).toEqual([
      ['Algebra homework · Study', '2026-10-05', '16:00', 45, false],
      ['History essay · Study', '2026-10-08', '16:00', 45, false],
      ['Lab write-up · Study', '2026-10-09', '16:00', 60, true],
    ]);
    // The tasks themselves were not touched.
    expect(await parents(page)).toBe(before);

    // In Tasks, each block says when it is; the task it's for says how far along.
    await expect(page.locator('.task-item .task-chip-plan', { hasText: '4:00 PM · Study' })).toHaveCount(3);
    await expect(page.locator('.task-item[data-task-id="881002"] .task-chip-plan')).toHaveText('This week · 0/1 done');
    // On the calendar.
    await page.evaluate(() => (window as any).nav('calendar'));
    await expect(page.locator('.cal-day[data-cal-date="2026-10-09"] .cal-task-bar', { hasText: 'Lab write-up · Study · 4p' })).toHaveCount(1);

    // ── During the week: open from the calendar, tick one off ──
    await page.locator('#calPlanWeekBtn').click();
    await expect(modal(page).locator('#pwSub')).toHaveText('This week');
    await expect(modal(page).locator('.pw-block')).toHaveCount(3);
    const algebraId = b[0].id;
    await modal(page).locator(`[data-act="done"][data-id="${algebraId}"]`).check();
    await expect.poll(async () => (await blocks(page)).find((x) => x.id === algebraId)?.done).toBe(true);
    await expect(modal(page).locator('.pw-intro')).toContainText('1 of 3 blocks done');

    // ── Plan again: done and moved blocks stay, only what's missing is added ──
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(block(page, 'Algebra homework').locator('.pw-tag')).toHaveText('Done');
    await expect(block(page, 'Lab write-up').locator('.pw-b-why')).toHaveText('You moved this one');
    await expect(block(page, 'History essay')).toHaveCount(2);
    await expect(modal(page).locator('[data-act="approve"]')).toHaveText('Approve changes');
    const beforeAgain = await page.evaluate(() => JSON.stringify((window as any).tasks));
    await modal(page).locator('[data-act="approve"]').click();
    await expect(page.locator('#undoSnackbar')).toContainText('Added 1 study block');

    b = await blocks(page);
    expect(b).toHaveLength(4);
    expect(new Set(b.map((x) => x.key)).size).toBe(4);
    expect(b.filter((x) => x.of === 881002).map((x) => [x.date, x.time])).toEqual([['2026-10-06', '16:00'], ['2026-10-08', '16:00']]);
    expect(b.find((x) => x.of === 881003)).toMatchObject({ date: '2026-10-09', time: '16:00', pinned: true });

    // ── Undo puts the planner back exactly as it was ──
    await page.locator('#undoSnackbar button', { hasText: 'Undo' }).click();
    await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).tasks))).toBe(beforeAgain);
    expect((await blocks(page)).filter((x) => x.of === 881002)).toHaveLength(1);

    // ── Planning twice in a row changes nothing and never duplicates ──
    await page.locator('#calPlanWeekBtn').click();
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await modal(page).locator('[data-act="approve"]').click();
    const once = await blocks(page);
    await page.locator('#calPlanWeekBtn').click();
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(modal(page).locator('.pw-actions [data-act="close"]')).toHaveText('Nothing to change · Close');
    await modal(page).locator('.pw-actions [data-act="close"]').click();
    expect(await blocks(page)).toEqual(once);
    expect(await parents(page)).toBe(before);
  });

  test('moving a block in the week view keeps it there; finishing the task clears what is left', async ({ page }) => {
    await setup(page);
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="propose"]').click();
    await modal(page).locator('[data-act="approve"]').click();
    const essay = (await blocks(page)).filter((x) => x.of === 881002);
    expect(essay).toHaveLength(2);

    await page.locator('#dashPlanWeekBtn').click();
    await block(page, 'History essay').first().locator('[data-act="edit"]').click();
    await page.locator('#pwEdDay').selectOption('2026-10-06');
    await page.locator('#pwEdStart').fill('19:30');
    await modal(page).locator('[data-act="save-move"]').click();
    await expect(page.locator('#undoSnackbar')).toContainText('Block moved');
    const moved = (await blocks(page)).find((x) => x.id === essay[0].id)!;
    expect([moved.date, moved.time, moved.pinned]).toEqual(['2026-10-06', '19:30', true]);

    // Planning again leaves it where it was put.
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(block(page, 'History essay').filter({ hasText: 'You moved this one' })).toHaveCount(1);
    await modal(page).locator('[data-act="close"]').first().click();

    // A study block moved on the calendar or in Edit counts as moved too.
    await page.evaluate((id) => { const t = (window as any).tasks.find((x: any) => x.id === id); t.date = '2026-10-11'; t.time = '15:00'; }, essay[1].id);
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(block(page, 'History essay').filter({ hasText: 'You moved this one' })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);

    // Finishing the essay itself clears its unfinished blocks.
    await page.evaluate(() => (window as any).toggleTask(881002));
    await expect.poll(async () => (await blocks(page)).filter((x) => x.of === 881002 && !x.done).length).toBe(0);
    // (The essay had an estimate, so Flux asks how long it really took.)
    await page.locator('#fluxEffortSkip').click();

    // Work finished some other way (a sync, say) no longer needs its blocks,
    // even one the student moved: planning again offers to take it off.
    await page.evaluate(() => {
      const w = window as any;
      const lab = w.tasks.find((x: any) => x.weekBlock && x.planOf === 881003);
      lab.time = '19:00';
      w.tasks.find((x: any) => x.id === 881003).done = true;
    });
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(block(page, 'Lab write-up')).toHaveCount(0);
    await expect(modal(page).locator('.pw-note', { hasText: 'no longer needed' })).toHaveText('1 unfinished block is no longer needed and will be taken off.');
    await modal(page).locator('[data-act="approve"]').click();
    expect((await blocks(page)).filter((x) => x.of === 881003)).toEqual([]);
  });

  test('week view: Escape only closes the editor, a move onto a rest day is flagged, Ctrl+Z undoes it here', async ({ page }) => {
    await setup(page);
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="propose"]').click();
    await modal(page).locator('[data-act="approve"]').click();
    const all = await blocks(page);
    const algebra = all.find((x) => x.of === 881001)!;
    await page.locator('#dashPlanWeekBtn').click();
    await expect(modal(page).locator('#pwSub')).toHaveText('This week');
    const row = modal(page).locator(`.pw-block[data-key="${algebra.key}"]`);
    await expect(row.locator('.pw-b-why')).toHaveText('Due Wed, ~45 min left');

    // Escape closes the editor and does nothing else: the app's own Escape
    // handlers used to close the dialog too, or press "Remove unfinished blocks".
    await row.locator('[data-act="edit"]').click();
    await expect(page.locator('#pwEdDay')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pwEdDay')).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await expect(row.locator('[data-act="edit"]')).toBeFocused();
    expect(await blocks(page)).toEqual(all);

    // Anywhere is allowed; a rest day is flagged, on the block and out loud.
    await row.locator('[data-act="edit"]').click();
    await page.locator('#pwEdDay').selectOption('2026-10-07');
    await modal(page).locator('[data-act="save-move"]').click();
    await expect(row.locator('.pw-b-warn')).toHaveText('That’s a rest day');
    await expect(page.locator('#pwLive')).toContainText('That’s a rest day.');
    expect((await blocks(page)).find((x) => x.id === algebra.id)).toMatchObject({ date: '2026-10-07', pinned: true });

    // Ctrl+Z is the app's undo, and the dialog shows the result.
    await row.locator('[data-act="edit"]').focus();
    await page.keyboard.press('Control+z');
    await expect(row.locator('.pw-b-warn')).toHaveCount(0);
    expect(await blocks(page)).toEqual(all);

    // With focus outside the dialog, Escape still closes it properly.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).FluxOverlays.anyOpen())).toBe(false);
    expect(await blocks(page)).toEqual(all);

    // A day on, Monday's block is missed and its reason still reads right.
    await page.clock.fastForward('24:00:00');
    await page.locator('#dashPlanWeekBtn').click();
    await expect(modal(page).locator('#pwdMissed')).toBeVisible();
    await expect(row.locator('.pw-b-why')).toHaveText('Due tomorrow, ~45 min left');

    // Planning again fits it back in. Even if it had been moved before it was
    // missed, where the plan puts it now is the plan's, not "moved".
    await page.evaluate((id) => { (window as any).tasks.find((t: any) => t.id === id).weekBlock.pinned = true; }, algebra.id);
    await modal(page).locator('[data-act="to-avail"]').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(block(page, 'Algebra homework').locator('.pw-was')).toHaveText('Missed Mon, Oct 5 4:00 PM');
    await modal(page).locator('[data-act="approve"]').click();
    expect((await blocks(page)).find((x) => x.id === algebra.id)).toMatchObject({ date: '2026-10-06', pinned: false });
  });

  test('Ctrl+Z on the suggestion takes back a move or removal there, never a change made elsewhere', async ({ page }) => {
    await setup(page);
    // Something done elsewhere first, which the app's undo would take back.
    await page.evaluate(() => (window as any).toggleTask(881003));
    const lab = () => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 881003).done);
    expect(await lab()).toBe(true);

    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="propose"]').click();
    await expect(modal(page).locator('.pw-block')).toHaveCount(3);
    const algebra = block(page, 'Algebra homework');
    await expect(algebra.locator('.pw-b-time')).toHaveText('4:00 – 4:45 PM');

    await algebra.locator('[data-act="edit"]').click();
    await page.locator('#pwEdStart').fill('18:00');
    await modal(page).locator('[data-act="save-edit"]').click();
    await expect(algebra.locator('.pw-b-time')).toHaveText('6:00 – 6:45 PM');
    await block(page, 'History essay').first().locator('[data-act="remove"]').click();
    await expect(modal(page).locator('.pw-block')).toHaveCount(2);

    await page.locator('#pwTitle').focus();
    await page.keyboard.press('Control+z');
    await expect(modal(page).locator('.pw-block')).toHaveCount(3);
    await expect(modal(page).locator('.pw-unsched')).not.toContainText('You took');
    await page.keyboard.press('Control+z');
    await expect(algebra.locator('.pw-b-time')).toHaveText('4:00 – 4:45 PM');
    await expect(algebra.locator('.pw-b-why')).not.toContainText('You moved');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#pwLive')).toHaveText('Nothing to undo. Nothing changes until you approve.');
    expect(await lab()).toBe(true);
    expect(await blocks(page)).toEqual([]);
  });

  test('an educator\'s Work and Personal blocks stay apart: planning one never takes the other\'s off', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
      const w = window as any;
      w.tasks.find((t: any) => t.id === 881002).scope = 'outside';
      w.__mode = 'all';
      w.fluxTaskVisibleInMode = (t: any) => w.__mode === 'all' || (w.__mode === 'work') === !(t && t.scope === 'outside');
    });
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="propose"]').click();
    await modal(page).locator('[data-act="approve"]').click();
    const essay = (await blocks(page)).filter((x) => x.of === 881002);
    expect(essay).toHaveLength(2);

    // In Work mode the essay (Personal) and its blocks are out of sight, and left alone.
    await page.evaluate(() => { (window as any).__mode = 'work'; });
    await page.locator('#dashPlanWeekBtn').click();
    await expect(block(page, 'History essay')).toHaveCount(0);
    await modal(page).locator('[data-act="clear"]').click();
    await expect.poll(async () => (await blocks(page)).filter((x) => x.of === 881002)).toEqual(essay);
    await modal(page).locator('[data-act="propose"]').click();
    await expect(modal(page).locator('.pw-note', { hasText: 'no longer needed' })).toHaveCount(0);
    await modal(page).locator('[data-act="approve"]').click();
    expect((await blocks(page)).filter((x) => x.of === 881002)).toEqual(essay);
  });

  test('keyboard and screen reader: focus moves in, stays in, and comes back; no serious axe findings', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).nav('calendar'));
    const opener = page.locator('#calPlanWeekBtn');
    // The calendar may still be settling; wait until focus stays on the button.
    await expect(async () => { await opener.focus(); await expect(opener).toBeFocused({ timeout: 300 }); }).toPass();
    await page.keyboard.press('Enter');
    await expect(modal(page).locator('[role="dialog"]')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#pwTitle')).toBeFocused();
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.getElementById('planWeekModal')?.contains(document.activeElement))).toBe(true);

    const scan = async () => {
      const r = await new AxeBuilder({ page }).include('#planWeekModal').analyze();
      return r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 4) }));
    };
    expect(await scan()).toEqual([]);
    await modal(page).locator('[data-act="propose"]').click();
    await expect(page.locator('#pwTitle')).toBeFocused();
    await expect(page.locator('#pwLive')).toContainText('study blocks suggested');
    expect(await scan()).toEqual([]);
    // Every block action names the block it acts on.
    const labels = await modal(page).locator('.pw-b-acts button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => /^(Change|Remove) .+, .+ \d{1,2}:\d{2} [AP]M$/.test(l))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('on a phone: fits the screen, and the plan can be approved', async ({ page }) => {
    await setup(page, 390, 844);
    await page.locator('#dashPlanWeekBtn').click();
    await modal(page).locator('[data-act="propose"]').click();
    // Measured once the card's entrance spring has settled.
    await page.waitForFunction(() => document.querySelector('#planWeekModal .pw-card')!.getAnimations().every((a) => a.playState !== 'running'));
    const fits = await page.evaluate(() => {
      const card = document.querySelector('#planWeekModal .pw-card') as HTMLElement;
      const body = document.getElementById('pwBody')!;
      const r = card.getBoundingClientRect();
      return { left: r.left >= 0, right: r.right <= window.innerWidth, noSideScroll: body.scrollWidth <= body.clientWidth + 1 };
    });
    expect(fits).toEqual({ left: true, right: true, noSideScroll: true });
    await expect(modal(page).locator('[data-act="approve"]')).toBeInViewport();
    await modal(page).locator('[data-act="approve"]').click();
    expect((await blocks(page)).length).toBe(4);
  });
});
