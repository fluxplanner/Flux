import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * User text must render inert. Task titles and note titles are plain text, so
 * the payload has to show literally. Note bodies are rich text, so they keep
 * their formatting but lose anything active (scripts, on*= handlers).
 *
 * Every payload bumps window.__xss if it ever runs.
 */

const IMG = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const ATTR = 'x" onmouseover="window.__xss=1" data-x="';
const SCRIPT = '<script>window.__xss=(window.__xss||0)+1<\/script>';

async function xssFired(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => (window as any).__xss || 0);
}

test.describe('User text renders inert', () => {
  test('a task titled with an onerror img shows literally and never runs', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(([img, attr]) => {
      const w = window as any;
      w.tasks.push({ id: 9701, name: img, done: false, priority: 'med', date: '' },
                   { id: 9702, name: attr, done: false, priority: 'med', date: '' });
      w.renderTasks();
    }, [IMG, ATTR]);
    const row = page.locator('#taskList .task-item', { hasText: 'onerror' });
    await expect(row.locator('.task-text')).toContainText(IMG);
    await expect(row.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('#taskList [onmouseover]')).toHaveCount(0);
    expect(await xssFired(page)).toBe(0);
  });

  test('FluxEsc.richText keeps formatting and drops scripts and handlers', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const out = await page.evaluate(([img, script]) =>
      (window as any).FluxEsc.richText('<b>kept bold</b>' + script + img + '<a href="javascript:alert(1)">l</a>'), [IMG, SCRIPT]);
    expect(out).toContain('<b>kept bold</b>');
    expect(out).not.toMatch(/<script|onerror|javascript:/i);
    expect(await xssFired(page)).toBe(0);
  });

  test('a note with <script> and an onerror img opens inert, title shown literally', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(([img, script]) => {
      const notes = JSON.parse(localStorage.getItem('flux_notes') || '[]');
      notes.unshift({ id: 9801, title: img, body: '<b>kept bold</b>' + script + img, createdAt: Date.now(), updatedAt: Date.now(), flashcards: [] });
      localStorage.setItem('flux_notes', JSON.stringify(notes));
    }, [IMG, SCRIPT]);
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).openNote === 'function' && typeof (window as any).renderNotesList === 'function');
    await page.waitForTimeout(700);
    await page.evaluate(() => { const w = window as any; w.nav?.('notes'); w.renderNotesList(); });
    const card = page.locator('#notesList .note-card', { hasText: 'onerror' });
    await expect(card.locator('.note-title')).toContainText(IMG);
    await expect(card.locator('img')).toHaveCount(0);
    await page.evaluate(() => (window as any).openNote(9801));
    const editor = page.locator('#noteEditor');
    await expect(editor.locator('b')).toHaveText('kept bold');
    await expect(editor.locator('script')).toHaveCount(0);
    await expect(editor.locator('[onerror]')).toHaveCount(0);
    expect(await xssFired(page)).toBe(0);
  });

  test('FluxEsc.html escapes all five characters', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const out = await page.evaluate(() => (window as any).FluxEsc.html(`<a href="x" title='y'>&</a>`));
    expect(out).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
});
