import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The dashboard's schedule conflicts card (flux-syllabus-conflict.js) printed a
 * task's class key, so a student read "CLS1789088891591 has a test and
 * homework due". It names the class now, including Canvas classes, whose ids
 * are fractional, and a key that lost its fraction somewhere. Tasks with no
 * class are not a clash within one subject.
 */

test('the conflicts list names the class, never its id', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00'));
  await gotoScenario(page, 'student-semester');
  const msgs = await page.evaluate(() => {
    const w = window as any;
    const canvasId = 1789088891591.4237;
    w.classes = [
      { id: canvasId, name: 'AP Biology', color: '#22aa66' },
      { id: 42, name: 'World History', color: '#3366ff' },
    ];
    const t = (id: number, name: string, subject: string, type: string) => ({ id, name, subject, type, date: '2026-10-26', done: false, priority: 'med' });
    w.tasks.push(
      t(9701, 'Cell test', 'CLS' + canvasId, 'test'),
      t(9702, 'Cell worksheet', 'CLS' + canvasId, 'hw'),
      t(9703, 'Essay', 'CLS42', 'test'),
      t(9704, 'Reading', 'CLS1789088891591', 'reading'),   // same Canvas class, fraction lost
      t(9705, 'WW1 quiz', 'CLS42', 'quiz'),
      t(9706, 'Loose test', '', 'test'),
      t(9707, 'Loose homework', '', 'hw'),
    );
    return w.FluxSyllabusConflict.detectConflicts().filter((i: any) => i.kind === 'subject_clash').map((i: any) => i.message);
  });
  expect(msgs.join(' | ')).not.toMatch(/CLS\d/);
  expect(msgs.some((m: string) => m.includes('AP Biology has a test and homework due'))).toBe(true);
  // History has a test and a quiz but no homework: not a clash. No-class tasks never clash together.
  expect(msgs.some((m: string) => m.includes('World History'))).toBe(false);
  expect(msgs.some((m: string) => /general/i.test(m))).toBe(false);
});
