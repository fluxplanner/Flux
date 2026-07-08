import { test, expect } from '@playwright/test';
import { gotoScenario, watchForViolations, assertNoCspOrConsoleViolations } from './helpers';

// Stored-XSS probe. User-controlled strings (task titles, note bodies) must be
// rendered as TEXT, never as live HTML. The payload's onerror handler sets a
// global tripwire; if it ever runs, the render path injected raw HTML.
const PAYLOAD = '<img src=x onerror="window.__xss=1">';

test.describe('Stored XSS is neutralised', () => {
  test('malicious task title + note body render as text and never execute', async ({ page }) => {
    await watchForViolations(page);
    await gotoScenario(page, 'student-semester');

    // tripwire starts clean
    await page.evaluate(() => { (window as unknown as { __xss?: unknown }).__xss = undefined; });

    // 1) Task titled with the payload, via the real create path (addTask()).
    const taskResult = await page.evaluate((payload) => {
      const nameEl = document.getElementById('taskName') as HTMLInputElement | null;
      const add = (window as unknown as { addTask?: () => void }).addTask;
      if (!nameEl || typeof add !== 'function') return { ok: false, reason: 'addTask() unavailable' };
      nameEl.value = payload;
      add();
      const list = document.getElementById('taskList');
      return {
        ok: true,
        textShown: !!list && list.textContent!.includes(payload),
        injectedImg: list ? list.querySelectorAll('img[src="x"]').length : -1,
      };
    }, PAYLOAD);
    expect(taskResult.ok, taskResult.reason).toBeTruthy();
    expect(taskResult.injectedImg, 'payload injected a live <img> into the task list').toBe(0);
    expect(taskResult.textShown, 'task title should appear verbatim as text').toBe(true);

    // 2) Note whose title + body carry the payload, rendered into the notes list.
    const noteResult = await page.evaluate((payload) => {
      const notes = (window as unknown as { notes?: unknown[] }).notes;
      const render = (window as unknown as { renderNotesList?: () => void }).renderNotesList;
      if (!Array.isArray(notes) || typeof render !== 'function') {
        return { ok: false, reason: 'notes render path unavailable' };
      }
      notes.unshift({
        id: 987654321, title: payload, body: payload, subject: '',
        starred: false, flashcards: [], createdAt: Date.now(), updatedAt: Date.now(),
      });
      render();
      const nl = document.getElementById('notesList');
      return {
        ok: true,
        textShown: !!nl && nl.textContent!.includes(payload),
        injectedImg: nl ? nl.querySelectorAll('img[src="x"]').length : -1,
      };
    }, PAYLOAD);
    expect(noteResult.ok, noteResult.reason).toBeTruthy();
    expect(noteResult.injectedImg, 'payload injected a live <img> into the notes list').toBe(0);
    expect(noteResult.textShown, 'note title should appear verbatim as text').toBe(true);

    // 3) The onerror handler must never have fired, anywhere in the document.
    const fired = await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss);
    expect(fired, 'onerror payload executed — stored XSS!').toBeUndefined();
    const injectedTotal = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length);
    expect(injectedTotal, 'a payload <img src=x> exists somewhere in the DOM').toBe(0);

    // 4) No CSP violations / console errors during the probe.
    assertNoCspOrConsoleViolations(page);
  });
});
