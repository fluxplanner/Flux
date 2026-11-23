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

  test('coursework feedback: one criterion at a time, held to its level, quotes checked against the draft', async ({ page }) => {
    await signIn(page);
    const marks: Record<string, any> = {
      RD: { level: '3-4', mark: 6, met: ['A focused question.'], missing: ['No context for the question.'], evidence: ['temperature affects catalase'], fixes: [{ quote: 'temperature affects catalase', advice: 'Give the range of temperatures.' }] },
      DA: { level: '3-4', mark: 3 }, CO: { level: '1-2', mark: 2 }, EV: { level: '1-2', mark: 1 },
    };
    let calls = 0;
    await page.route('**/functions/v1/ai-proxy', async (route) => {
      calls++;
      const user = String(JSON.parse(route.request().postData() || '{}').messages[1].content);
      const id = (user.match(/Criterion (\w+)\./) || [])[1];
      await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify(marks[id]) }] } });
    });
    await setUp(page);
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'IA', exact: true }).click();
    await page.locator('#ftCDraft').fill(('My research question is how temperature affects catalase activity. ').repeat(20));
    await page.getByRole('button', { name: 'Get feedback' }).click();
    // RD said 6 but chose the 3-4 level, so it is held at 4: 4 + 3 + 2 + 1.
    await expect(page.getByRole('heading', { name: 'Predicted 10 / 24' })).toBeVisible();
    expect(calls).toBe(4);
    await expect(page.locator('.ft-crit').first()).toContainText('Level 3–4');
    await expect(page.locator('.ft-crit').first()).toContainText('To reach level 5–6');
    await expect(page.locator('.ft-fixes q').first()).toContainText('temperature affects catalase');
    await expect(page.getByText('not an IB mark')).toBeVisible();
  });

  test('record a lesson: the transcript builds up, Flux AI makes notes that cite it, and they become a study set', async ({ page }) => {
    await signIn(page);
    await page.addInitScript(() => {
      const w = window as any;
      w.__mic = { current: null, runs: 0 };
      class FakeRec {
        lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
        onresult: any = null; onerror: any = null; onend: any = null; results: any[] = [];
        start() { w.__mic.runs++; w.__mic.current = this; }
        stop() { setTimeout(() => this.onend && this.onend(), 20); }
        abort() { this.stop(); }
      }
      w.SpeechRecognition = FakeRec;
      w.__mic.say = (text: string) => { const r = w.__mic.current; const res: any = [{ transcript: text }]; res.isFinal = true; r.results.push(res); r.onresult({ resultIndex: r.results.length - 1, results: r.results }); };
      w.__mic.end = () => { const r = w.__mic.current; r.onend(); };
    });
    await page.route('**/functions/v1/ai-proxy', (route) => route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify({
      title: 'Photosynthesis', points: [{ text: 'Photosynthesis happens in the chloroplast.', s: [1] }],
      terms: [{ term: 'Chlorophyll', def: 'The green pigment that absorbs light.', s: [1] }], exam: [{ text: 'Learn the equation.', s: [1] }], tasks: [],
    }) }] } }));
    await setUp(page);
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Record a lesson' }).click();
    await expect(page.getByRole('heading', { name: 'Record a lesson' })).toBeVisible();
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => {
      const m = (window as any).__mic;
      m.say('today we are looking at photosynthesis which happens in the chloroplast');
      m.say('chlorophyll is the green pigment that absorbs light and you need to learn the equation for the test');
    });
    // The browser ends a run after a pause: listening starts again by itself.
    const runs = await page.evaluate(() => (window as any).__mic.runs);
    await page.evaluate(() => (window as any).__mic.end());
    await expect.poll(() => page.evaluate(() => (window as any).__mic.runs)).toBe(runs + 1);
    await page.evaluate(() => (window as any).__mic.say('so remember light energy is converted into chemical energy in glucose'));
    await expect(page.locator('#ftLText')).toHaveValue(/chloroplast\nchlorophyll[\s\S]*glucose$/);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Carry on recording' })).toBeVisible();
    // Saved as it grows: a reload keeps it.
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.locator('#ftLText')).toHaveValue(/glucose$/);

    await page.getByRole('button', { name: 'Make notes with Flux AI' }).click();
    const notes = page.locator('.ft-lesson-notes');
    await expect(notes).toContainText('Photosynthesis happens in the chloroplast.');
    await expect(notes.locator('dt')).toContainText('Chlorophyll');
    await notes.locator('.ft-cite-num').first().click();
    await expect(page.locator('#ftSeg-1')).toBeFocused();
    await expect(page).toHaveURL(/#lesson$/);
    await page.getByRole('button', { name: 'Save as a study set' }).click();
    await expect(page).toHaveURL(/#set\/[^/]+\/guide$/);
  });

  test('a transcript file from another app (WebVTT) can be opened instead of recording', async ({ page }) => {
    await setUp(page);
    await page.goto('/teacher.html#lesson');
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nMitosis has four stages.\n\n2\n00:00:04.000 --> 00:00:08.000\nProphase is when the chromosomes condense and become visible.';
    await page.locator('input[type=file][data-hub-change="lesson-file"]').setInputFiles({ name: 'Biology lesson.vtt', mimeType: 'text/vtt', buffer: Buffer.from(vtt) });
    await expect(page.locator('#ftLText')).toHaveValue('Mitosis has four stages.\nProphase is when the chromosomes condense and become visible.');
    await expect(page.locator('#ftLTitle')).toHaveValue('Biology lesson');
  });

  test('mock oral microphone: words fill the box, late words never come back after sending, errors are explained', async ({ page }) => {
    await signIn(page);
    // A fake microphone the test drives: window.__mic.say(text) / .fail(code).
    await page.addInitScript(() => {
      const w = window as any;
      w.__mic = { runs: 0, aborted: 0, current: null };
      class FakeRec {
        lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
        onresult: any = null; onerror: any = null; onend: any = null;
        results: any[] = [];
        start() { w.__mic.runs++; w.__mic.current = this; }
        stop() { setTimeout(() => this.onend && this.onend(), 30); }
        abort() { w.__mic.aborted++; setTimeout(() => { this.onerror && this.onerror({ error: 'aborted' }); this.onend && this.onend(); }, 30); }
      }
      w.SpeechRecognition = FakeRec;
      w.__mic.say = (text: string) => { const r = w.__mic.current; r.results.push([{ transcript: text }]); r.onresult({ results: r.results }); };
      w.__mic.fail = (code: string) => { const r = w.__mic.current; r.onerror({ error: code }); r.onend(); };
    });
    await page.route('**/functions/v1/ai-proxy', (route) => route.fulfill({ json: { content: [{ type: 'text', text: 'Why did you choose that work?' }] } }));
    await setUp(page);
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Mock orals' }).click();
    await page.getByRole('button', { name: 'Start the oral' }).click();
    const box = page.locator('#ftOralIn');
    await expect(box).toBeVisible();

    await page.getByRole('button', { name: 'Speak' }).click();
    await expect(page.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#ftMicMsg')).toContainText('Listening');
    await page.evaluate(() => { (window as any).__mic.say('My global issue is'); (window as any).__mic.say('climate change.'); });
    await expect(box).toHaveValue('My global issue is climate change.');

    // Send while still listening: words the browser hands over late are thrown away.
    await page.getByRole('button', { name: 'Answer' }).click();
    await page.evaluate(() => (window as any).__mic.say('stray words'));
    await expect(page.locator('.ft-msg--me')).toContainText('My global issue is climate change.');
    await expect(page.locator('.ft-msg--ai').last()).toContainText('Why did you choose that work?');
    await expect(page.locator('#ftOralIn')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Speak' })).toHaveAttribute('aria-pressed', 'false');

    // Microphone blocked: say why, and go back to Speak.
    await page.getByRole('button', { name: 'Speak' }).click();
    await page.evaluate(() => (window as any).__mic.fail('not-allowed'));
    await expect(page.locator('#ftMicMsg')).toContainText('not allowed to use your microphone');
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible();

    // Typing while listening takes over: later words do not overwrite the edit.
    await page.getByRole('button', { name: 'Speak' }).click();
    await page.locator('#ftOralIn').fill('I typed this');
    await page.evaluate(() => (window as any).__mic.say('overwrite'));
    await expect(page.locator('#ftOralIn')).toHaveValue('I typed this');

    // Leaving the screen stops listening.
    await page.getByRole('button', { name: 'Speak' }).click();
    const before = await page.evaluate(() => (window as any).__mic.aborted);
    await page.getByRole('navigation', { name: 'Flux Tutor' }).getByRole('link', { name: 'Home' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__mic.aborted)).toBe(before + 1);
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
