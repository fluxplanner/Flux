import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Calendar's day panel has one add button.
 *
 * It used to have two, and the split was backwards: "+ Task" opened a dialog
 * with a name, a subject and a priority — no date, no time, no notes — while
 * "+ Event" opened the full one, which has carried a Task/Event/EC switcher the
 * whole time. So the button named after what you wanted did strictly less, and
 * a task added from the calendar quietly lost its time and notes.
 *
 * These pin the merged behaviour: the poorer path stays gone, and the surviving
 * dialog really does save every field it shows.
 */

const TYPE_ROWS: Record<string, string[]> = {
  task: ['Title', 'Date', 'Subject', 'Priority', 'Notes'],
  event: ['Title', 'Date', 'Notes'],
  ec: ['Extracurricular', 'Title', 'Date', 'Notes'],
};

async function openDialog(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('calendar'));
  await page.waitForTimeout(800);
  await page.locator('.cal-day[data-cal-date]').nth(14).click();
  await page.waitForTimeout(300);
  await page.locator('#calAddEventBtn').click();
  await expect(page.locator('#addEventModal')).toBeVisible();
}

test.describe('Calendar add dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await gotoScenario(page, 'student-semester');
  });

  test('the day panel offers one add button, and the poorer task dialog is gone', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('calendar'));
    await page.waitForTimeout(800);
    await page.locator('.cal-day[data-cal-date]').nth(14).click();
    await page.waitForTimeout(300);

    const labels = await page.evaluate(() => [...document.querySelectorAll('.cal-selected-actions button')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => b.textContent?.trim() || ''));
    expect(labels, 'the add button should not be named after only one of the things it adds')
      .not.toContain('+ Task');
    expect(labels).toContain('+ Add');

    // The old path is deleted, not merely unhooked — a second add-task route
    // that still compiles is one something wires back up by accident.
    const ghosts = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return ['openAddForDate', 'showCalAddModal', 'submitCalTask'].filter((f) => typeof w[f] === 'function');
    });
    expect(ghosts, `${ghosts.join(', ')} still exist`).toEqual([]);
    expect(await page.locator('#calAddBtn').count(), '#calAddBtn is back').toBe(0);
  });

  test('a task keeps its time and notes — the fields the old dialog dropped', async ({ page }) => {
    await openDialog(page);
    await page.fill('#addEventTitle', 'Guard task');
    await page.fill('#addEventTime', '14:30');
    await page.fill('#addEventNotes', 'guard notes');
    await page.selectOption('#addEventPriority', 'high');
    await page.locator('#addEventPrimaryBtn').click();
    await expect(page.locator('#addEventModal')).toBeHidden();

    const saved = await page.evaluate(() => {
      const t = (JSON.parse(localStorage.getItem('tasks') || '[]') as Record<string, unknown>[])
        .find((x) => x.name === 'Guard task');
      return t ? { date: t.date, time: t.time, priority: t.priority, notes: t.notes } : null;
    });
    expect(saved, 'the task was not saved at all').not.toBeNull();
    expect(saved!.date, 'the selected day did not reach the task').toBeTruthy();
    expect(saved!.time).toBe('14:30');
    expect(saved!.notes).toBe('guard notes');
    expect(saved!.priority).toBe('high');
  });

  test('an event saves its own fields', async ({ page }) => {
    await openDialog(page);
    await page.locator('#addEventTypeEvent').click();
    await page.fill('#addEventTitle', 'Guard event');
    await page.fill('#addEventTime', '09:15');
    await page.locator('#addEventPrimaryBtn').click();
    await expect(page.locator('#addEventModal')).toBeHidden();

    const ev = await page.evaluate(() => (JSON.parse(localStorage.getItem('flux_events') || '[]') as Record<string, unknown>[])
      .find((x) => x.title === 'Guard event') || null);
    expect(ev, 'the event was not saved').not.toBeNull();
    expect(ev!.time).toBe('09:15');
    expect(ev!.date).toBeTruthy();
  });

  test('an empty title is refused instead of saving a blank row', async ({ page }) => {
    await openDialog(page);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tasks') || '[]').length);
    await page.locator('#addEventPrimaryBtn').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#addEventModal'), 'the dialog closed on an empty title').toBeVisible();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tasks') || '[]').length);
    expect(after, 'a nameless task was saved').toBe(before);
  });

  test('each type shows the fields it needs and hides the ones it does not', async ({ page }) => {
    await openDialog(page);
    for (const [type, expected] of Object.entries(TYPE_ROWS)) {
      await page.evaluate((t) => (window as unknown as { setAddEventType: (x: string) => void }).setAddEventType(t), type);
      await page.waitForTimeout(200);
      const shown = await page.evaluate(() => [...document.querySelectorAll('#addEventModal .mrow')]
        .filter((r) => getComputedStyle(r).display !== 'none')
        .map((r) => r.querySelector('label')?.textContent?.trim() || ''));
      for (const row of expected) {
        expect(shown, `${type} is missing the ${row} field`).toContain(row);
      }
      // Priority is meaningless for something that is not a task.
      if (type !== 'task') {
        expect(shown, `${type} should not ask for a task priority`).not.toContain('Priority');
      }
    }
  });

  test('the dialog fits a phone and lines its labels up consistently', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDialog(page);
    const r = await page.evaluate(() => {
      const card = document.querySelector('#addEventModal .modal-card') as HTMLElement;
      const gaps = ([...card.querySelectorAll('label')] as HTMLElement[])
        .filter((l) => getComputedStyle(l.parentElement as HTMLElement).display !== 'none')
        .map((l) => {
          const ctrl = (l.parentElement as HTMLElement).querySelector('input,select,textarea,button') as HTMLElement | null;
          return ctrl ? Math.round(ctrl.getBoundingClientRect().top - l.getBoundingClientRect().bottom) : -1;
        })
        .filter((n) => n >= 0);
      const cr = card.getBoundingClientRect();
      return { gaps, overflowsRight: cr.right > window.innerWidth + 1, width: Math.round(cr.width) };
    });
    expect(r.overflowsRight, 'the dialog hangs off the side of a phone').toBe(false);
    expect(r.gaps.length, 'no rows were measured, so this asserted nothing').toBeGreaterThan(4);
    // One rhythm, not "close enough" — uneven gaps are what makes a form look untidy.
    expect(new Set(r.gaps).size, `label-to-control gaps vary: ${r.gaps.join(', ')}`).toBe(1);
  });
});
