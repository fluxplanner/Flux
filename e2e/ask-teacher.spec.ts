import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C10 — Ask-Your-Teacher happy path (client contract).
 *
 * The live send runs through the existing participant-only messaging RLS
 * (manual QA row); here we pin: the composed card is exactly what the
 * preview shows, the rate limit counts down with calm copy, the edit-modal
 * chip appears only for teacher-linked class tasks, the triage queue
 * renders name + task line only, and flag-off is inert.
 */

test.describe('Ask-Your-Teacher (client contract)', () => {
  test('composeMessage carries task, class, due date, and what-I-tried verbatim', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const msg = await page.evaluate(() => {
      const w = window as any;
      return w.FluxAskTeacher.composeMessage(
        { name: 'Lab report: enzymes', date: '2026-07-15' },
        { name: 'AP Biology' },
        'Re-read ch. 7, stuck on the discussion section',
      );
    });
    expect(msg).toContain('Question about: Lab report: enzymes (AP Biology · due 2026-07-15)');
    expect(msg).toContain('What I tried: Re-read ch. 7, stuck on the discussion section');
  });

  test('rate limit: 3 per day, then calm refusal copy', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_ask_teacher: true };
      await w.FluxFeatureFlags.load({ force: true });
      w.save(w.FluxAskTeacher._key, { date: w.todayStr(), count: 3 });
      const left = w.FluxAskTeacher.asksLeftToday();
      // A rate-limited openForTask returns false without a modal.
      w.classes.length = 0;
      w.classes.push({ id: 3, name: 'AP Biology', teacherClassCode: 'BIO-1' });
      w.tasks.unshift({ id: 555001, name: 'Lab report', subject: 'CLS3', done: false });
      const opened = await w.FluxAskTeacher.openForTask(555001);
      return { left, opened, modal: !!document.getElementById('fluxAskTeacherModal') };
    });
    expect(r.left).toBe(0);
    expect(r.opened).toBe(false);
    expect(r.modal).toBe(false);
    await expect(page.locator('#toastLive, .toast').first()).toContainText(/ask fresh tomorrow|catch them in class/i);
  });

  test('edit-modal chip appears only for teacher-linked class tasks', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_ask_teacher: true };
      await w.FluxFeatureFlags.load({ force: true });
      w.classes.length = 0;
      w.classes.push({ id: 3, name: 'AP Biology', teacherClassCode: 'BIO-1' });
      w.classes.push({ id: 4, name: 'Art', teacherClassCode: '' });
      w.tasks.unshift({ id: 555002, name: 'Linked task', subject: 'CLS3', done: false, subtasks: [] });
      w.tasks.unshift({ id: 555003, name: 'Unlinked task', subject: 'CLS4', done: false, subtasks: [] });
      w.openEdit(555002);
      const linked = !!document.getElementById('fluxAskTeacherChip');
      w.openEdit(555003);
      const unlinked = !!document.getElementById('fluxAskTeacherChip');
      return { linked, unlinked };
    });
    expect(r.linked).toBe(true);
    expect(r.unlinked).toBe(false);
  });

  test('triage queue renders student + task line only, with messages CTA', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.id = 'atQueueHost';
      document.body.appendChild(host);
      w.FluxAskTeacher.renderQueue(host, [
        { student: 'Jordan P.', line: 'Lab report: enzymes (AP Biology · due 2026-07-15)' },
        { student: 'Priya S.', line: 'Quiz prep (Chemistry)' },
      ]);
    });
    const host = page.locator('#atQueueHost');
    await expect(host).toContainText('Student questions');
    await expect(host).toContainText('Jordan P.');
    await expect(host).toContainText('Lab report: enzymes');
    await expect(host.locator('[data-at-open]')).toBeVisible();
  });

  test('flag off: no chip, openForTask inert', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_ask_teacher: false };
      await w.FluxFeatureFlags.load({ force: true });
      w.classes.length = 0;
      w.classes.push({ id: 3, name: 'AP Biology', teacherClassCode: 'BIO-1' });
      w.tasks.unshift({ id: 555004, name: 'Linked task', subject: 'CLS3', done: false, subtasks: [] });
      w.openEdit(555004);
      const chip = !!document.getElementById('fluxAskTeacherChip');
      const opened = await w.FluxAskTeacher.openForTask(555004);
      return { chip, opened };
    });
    expect(r.chip).toBe(false);
    expect(r.opened).toBe(false);
  });
});
