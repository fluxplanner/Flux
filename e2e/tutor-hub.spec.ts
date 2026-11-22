import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
 * Flux Tutor's hub (flux-tutor-hub.js): setting up subjects, Home, the
 * sidebar, the Daily 5, Mistakes, Blurting, and the Flux AI screens (marking,
 * the tutor chat, coursework feedback) with the ai-proxy faked. The checks on
 * what Flux AI may say are unit-tested in test/unit/tutor-ai.test.mjs.
 */

const SESSION = () => JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '00000000-0000-0000-0000-000000000001', user_metadata: { full_name: 'Sam Student' } } });

async function signIn(page: Page) {
  await page.addInitScript((s) => { localStorage.setItem('flux_tutor_session', s); }, SESSION());
  // Cloud sync has no table in tests: answer as if it did not exist yet.
  await page.route('**/rest/v1/flux_tutor_sync**', (route) => route.fulfill({ status: 404, json: { code: 'PGRST205', message: 'not here' } }));
}
async function setUp(page: Page) {
  await page.goto('/teacher.html');
  await expect(page.getByRole('heading', { name: 'Set up your IB' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Biology' }).check();
  await page.getByRole('combobox', { name: 'Level for Biology' }).selectOption('HL');
  await page.getByRole('checkbox', { name: 'Physics' }).check();
  await page.locator('#ftSession').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Start studying' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
}
async function studyUnit(page: Page, subject: string, unit: string) {
  await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: new RegExp('^' + subject) }).click();
  await page.getByRole('button', { name: 'Study ' + unit }).click();
  await expect(page).toHaveURL(/#set\/[^/]+\/guide$/);
}

test.describe('Flux Tutor hub', () => {
  test('setting up: subjects and levels, Home, the sidebar, and no accessibility problems', async ({ page }) => {
    await setUp(page);
    await expect(page.getByText('Until your exams')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My subjects' })).toBeVisible();
    await expect(page.locator('.ft-subj-tile')).toHaveCount(2);
    await expect(page.locator('.ft-checklist .is-done')).toHaveCount(2);
    const side = page.getByRole('navigation', { name: 'Flux Tutor' });
    for (const name of ['Home', 'Question bank', 'Daily 5', 'Tutor chat', 'Teach it back', 'Blurting', 'Mock orals', 'IA', 'EE', 'TOK', 'Progress']) {
      await expect(side.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(side.locator('.ft-side-subj')).toContainText(['Biology', 'Physics']);
    const axe = await new AxeBuilder({ page }).include('#teacherApp').include('#ftSide').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // Biology is HL, so its HL-only units show.
    await side.getByRole('link', { name: /^Biology/ }).click();
    await expect(page.locator('.ft-unit', { hasText: 'Origins of cells' })).toBeVisible();
  });

  test('a unit, the Daily 5 and Mistakes: a wrong answer comes back to fix', async ({ page }) => {
    await setUp(page);
    await studyUnit(page, 'Biology', 'Cell structure');
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Daily 5' }).click();
    await expect(page.getByText('Question 1 of')).toBeVisible();
    await page.getByRole('button', { name: "I don't know" }).click();
    await expect(page.locator('.ft-feedback')).toBeVisible();
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: /^Mistakes/ }).click();
    const mistake = page.locator('.ft-mistake').first();
    await expect(mistake).toBeVisible();
    await mistake.getByRole('button', { name: 'Show the answer' }).click();
    await page.locator('.ft-mistake').first().getByRole('button', { name: 'I had it right' }).click();
    await expect(page.locator('#ftLive')).toContainText('Fixed');
    // Answers count on Home and give XP.
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Home' }).click();
    await expect(page.locator('.ft-hstat').nth(1)).toContainText('2');
    await expect(page.locator('#ftTopStats')).toContainText('Level');
  });

  test('blurting shows what was recalled and missed; missed terms go to Mistakes', async ({ page }) => {
    await setUp(page);
    await studyUnit(page, 'Biology', 'Cell structure');
    await page.getByRole('navigation', { name: 'Study set' }).getByRole('link', { name: 'Practice', exact: true }).click();
    await page.locator('.ft-modes-grid a[href$="/blurt"]').click();
    await page.locator('#ftBlurtText').fill('Ribosomes are the sites of protein synthesis. A prokaryote has no nucleus.');
    await page.getByRole('button', { name: 'Check what I remembered' }).click();
    await expect(page.locator('.ft-blurt-score')).toContainText('recalled');
    await expect(page.getByRole('heading', { name: 'You left out' })).toBeVisible();
    await expect(page.locator('.ft-side-link', { hasText: 'Mistakes' }).locator('.ft-side-badge')).toBeVisible();
  });

  test('Flux AI marks a written answer only on words the student wrote, and the mark is saved', async ({ page }) => {
    await signIn(page);
    let calls = 0;
    await page.route('**/functions/v1/ai-proxy', async (route) => {
      calls++;
      const body = JSON.parse(route.request().postData() || '{}');
      const user = String(body.messages[1].content);
      const n = (user.match(/^\d+\. /gm) || []).length;
      const points = Array.from({ length: n }, (_, i) => (i === 0 ? { n: 1, met: true, evidence: 'protein synthesis', note: 'Right.' } : { n: i + 1, met: true, evidence: 'words the student never wrote', note: 'x' }));
      await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify({ points, wrong: [], comment: 'A good start.', next: 'Add the second point.', model: 'Full answer.', confidence: 'high' }) }] } });
    });
    await setUp(page);
    await studyUnit(page, 'Biology', 'Cell structure');
    await page.getByRole('navigation', { name: 'Study set' }).getByRole('link', { name: 'Practice', exact: true }).click();
    await page.locator('.ft-modes-grid a[href$="/ib"]').click();
    await page.getByRole('button', { name: 'Make the questions' }).click();
    const q = page.locator('.ft-ib-q').first();
    await q.locator('textarea').fill('It is where protein synthesis happens.');
    await q.getByRole('button', { name: 'Mark it with Flux AI' }).click();
    const mark = page.locator('.ft-aimark').first();
    await expect(mark).toContainText(/Flux AI: 1 of \d/);
    await expect(mark.locator('.is-met')).toHaveCount(1);
    await expect(mark).toContainText('Your words');
    expect(calls).toBe(1);
  });

  test('tutor chat cites the notes, marks what is beyond them, and keeps the chat', async ({ page }) => {
    await signIn(page);
    let sent = '';
    await page.route('**/functions/v1/ai-proxy', async (route) => {
      sent = route.request().postData() || '';
      await route.fulfill({ json: { content: [{ type: 'text', text: 'Ribosomes make proteins [1].\n\nBeyond your notes: they were found in the 1950s [1].' }] } });
    });
    await setUp(page);
    await studyUnit(page, 'Biology', 'Cell structure');
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Tutor chat' }).click();
    await page.locator('#ftChatIn').fill('What do ribosomes do?');
    await page.getByRole('button', { name: 'Send' }).click();
    const reply = page.locator('.ft-msg--ai').last();
    await expect(reply).toContainText('Ribosomes make proteins');
    await expect(reply.locator('.ft-cite-num')).toHaveCount(1);
    await expect(reply.locator('.ft-beyond')).toContainText('1950s');
    expect(sent).toContain('Passages from my notes');
    await page.reload();
    await expect(page.locator('.ft-msg--me')).toContainText('What do ribosomes do?');
  });

  test('coursework feedback: per criterion, quotes checked against the draft, never rewritten', async ({ page }) => {
    await signIn(page);
    await page.route('**/functions/v1/ai-proxy', async (route) => {
      await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify({ criteria: [{ id: 'RD', mark: 4, working: ['A focused question.'], fixes: [{ quote: 'temperature affects catalase', advice: 'Give the range of temperatures.' }] }, { id: 'DA', mark: 3 }, { id: 'CO', mark: 2 }, { id: 'EV', mark: 1 }], priorities: ['Add uncertainties.'], summary: 'A solid start.' }) }] } });
    });
    await setUp(page);
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'IA', exact: true }).click();
    await page.locator('#ftCDraft').fill(('My research question is how temperature affects catalase activity. ').repeat(20));
    await page.getByRole('button', { name: 'Get feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Predicted 10 / 24' })).toBeVisible();
    await expect(page.locator('.ft-fixes q')).toContainText('temperature affects catalase');
    await expect(page.getByText('not an IB mark')).toBeVisible();
  });

  test('the planner calendar can read Tutor\'s exam dates', async ({ page }) => {
    await setUp(page);
    const agenda = await page.evaluate(() => JSON.parse(localStorage.getItem('flux_tutor_agenda') || 'null'));
    expect(agenda && agenda.items.some((x: any) => x.kind === 'exam' && /IB exams begin/.test(x.title))).toBe(true);
  });

  test('fits a 390px phone: the sidebar is a drawer and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setUp(page);
    await expect(page.locator('#ftSide')).not.toBeInViewport();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('#ftSide')).toBeInViewport();
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Progress' }).click();
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
