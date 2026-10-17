import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoScenario } from './helpers';

/*
 * Study tools ▸ Spanish / French / German ▸ Verb drill: conjuguemos-style
 * conjugation practice, assignment links and score codes.
 *
 * The marking, codes and links are unit-tested in test/unit/verb-drill; these
 * drive the planner the way a student and a teacher would. Answers come from
 * the drill's own question seam (FluxVerbDrill._current), which is the
 * engine's answer — the thing under test here is the page, not the tables.
 */

type Q = { verb: string; tense: string; person: number; pronoun: string; answers: string[] };
const current = (page: Page) => page.evaluate(() => (window as any).FluxVerbDrill._current() as Q);

async function openDrill(page: Page, subject = 'spanish', scenarioUrl?: string) {
  if (scenarioUrl) {
    await page.goto(scenarioUrl);
    await expect(page.locator('#app')).toHaveClass(/visible/);
  } else {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
    await page.evaluate((s) => (window as any).fluxStudyHub.openTool(s, 'verbs'), subject);
  }
  await expect(page.locator('#fvdRoot')).toBeVisible();
}

/** Choose one tense, a set (or a custom list), pronouns and a count, then start. */
async function setUp(page: Page, o: { tense: string; set?: string; custom?: string; persons?: number[]; count: number; exact?: boolean }) {
  const tenses = page.locator('input[name="fvdPtense"]');
  for (let i = 0; i < await tenses.count(); i++) {
    const t = tenses.nth(i);
    if ((await t.getAttribute('value')) === o.tense) await t.check(); else await t.uncheck();
  }
  await page.locator('#fvdPset').selectOption(o.custom ? 'custom' : (o.set || 'regular'));
  if (o.custom) await page.locator('#fvdPcustom').fill(o.custom);
  if (o.persons) {
    const ps = page.locator('input[name="fvdPperson"]');
    for (let i = 0; i < 6; i++) {
      if (o.persons.includes(i)) await ps.nth(i).check(); else await ps.nth(i).uncheck();
    }
  }
  await page.locator('input[name="fvdPmode"][value="count"]').check();
  await page.locator('#fvdPcount').selectOption(String(o.count));
  if (o.exact) await page.locator('#fvdPexact').check(); else await page.locator('#fvdPexact').uncheck();
  await page.locator('#fvdStart').click();
  await expect(page.locator('#fvdIn')).toBeFocused();
}

async function answerAll(page: Page, n: number, wrongAt: number[] = []) {
  for (let i = 0; i < n; i++) {
    const q = await current(page);
    await page.locator('#fvdIn').fill(wrongAt.includes(i) ? 'zzz' : q.answers[0]);
    await page.keyboard.press('Enter');
    if (wrongAt.includes(i)) {
      await expect(page.locator('#fvdFb')).toHaveClass(/is-no/);
      await expect(page.locator('#fvdFb')).toContainText(q.answers[0]);
      await expect(page.locator('#fvdIn')).toBeFocused();
      await page.keyboard.press('Enter');
    }
  }
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).include('#fvdRoot').analyze();
  return r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 3) }));
}

test.describe('Verb drill', () => {
  test('a practice round: Enter checks, focus stays put, mistakes are shown and can be practised', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openDrill(page);
    await expect(page.locator('#fshChemTabs [data-tool="verbs"]')).toHaveClass(/active/);
    await expect(page.locator('#fvdLive')).toHaveAttribute('aria-live', 'polite');
    await setUp(page, { tense: 'present', set: 'irregular', count: 5 });

    // A right answer moves straight on and says so.
    const q0 = await current(page);
    await page.locator('#fvdIn').fill(q0.answers[0]);
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-ok/);
    await expect(page.locator('#fvdScore')).toHaveText('1 right');
    await expect(page.locator('#fvdIn')).toBeFocused();
    await expect(page.locator('#fvdIn')).toHaveValue('');

    // Then one wrong (shown, Enter to go on) and three right.
    const missed = await current(page);
    await answerAll(page, 4, [0]);

    await expect(page.locator('#fvdResH')).toHaveText('Round over');
    await expect(page.locator('#fvdResH')).toBeFocused();
    await expect(page.locator('.fvd-big')).toContainText('4');
    await expect(page.locator('.fvd-res-line')).toContainText('5 answered · 80% accuracy');
    await expect(page.locator('.fvd-results .fvd-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.fvd-results .fvd-table')).toContainText(missed.answers[0]);

    await page.locator('[data-act="mistakes"]').click();
    await expect(page.locator('#fvdIn')).toBeFocused();
    const again = await current(page);
    expect([again.verb, again.tense, again.person]).toEqual([missed.verb, missed.tense, missed.person]);
    await page.locator('#fvdIn').fill(again.answers[0]);
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdResH')).toHaveText('Mistakes practised');
    expect(errors).toEqual([]);
  });

  test('accent keys type at the cursor and keep focus in the answer box', async ({ page }) => {
    await openDrill(page, 'french');
    await expect(page.locator('.fvd-key')).toHaveCount(0);
    await setUp(page, { tense: 'present', set: 'regular', count: 5 });
    const keys = await page.locator('.fvd-key').allTextContents();
    expect(keys).toEqual(['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'œ']);
    const input = page.locator('#fvdIn');
    await input.fill('ab');
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1));
    await page.locator('.fvd-key', { hasText: 'ç' }).click();
    await expect(input).toHaveValue('açb');
    await expect(input).toBeFocused();
    await page.keyboard.type('x');
    await expect(input).toHaveValue('açxb');
  });

  test('exact accents: a missing accent is wrong when required and allowed (but named) when not', async ({ page }) => {
    await openDrill(page);
    // vosotros only, present of hablar: habláis.
    await setUp(page, { tense: 'present', custom: 'hablar', persons: [4], count: 5, exact: true });
    await page.locator('#fvdIn').fill('hablais');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-no/);
    await expect(page.locator('#fvdFb')).toContainText('Accents count');
    await expect(page.locator('#fvdFb')).toContainText('habláis');
    await page.locator('[data-act="end"]').click();
    await page.locator('[data-act="settings"]').click();
    await setUp(page, { tense: 'present', custom: 'hablar', persons: [4], count: 5, exact: false });
    await page.locator('#fvdIn').fill('hablais');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-ok/);
    await expect(page.locator('#fvdFb')).toContainText('Watch the accents: habláis');
  });

  test('assignment link → student round → score code → teacher checker, with a tampered code flagged', async ({ page, browser }) => {
    // The teacher makes the link.
    await openDrill(page);
    await page.locator('#fvdTab-teach').click();
    await expect(page.locator('.fvd-honest')).toContainText('not cheat-proof');
    await page.locator('#fvdTtitle').fill('Semana 5: el presente');
    const tenses = page.locator('input[name="fvdTtense"]');
    for (let i = 0; i < await tenses.count(); i++) {
      if ((await tenses.nth(i).getAttribute('value')) === 'present') await tenses.nth(i).check(); else await tenses.nth(i).uncheck();
    }
    await page.locator('#fvdTcount').selectOption('5');
    await page.locator('#fvdTgoal').fill('4');
    await page.getByRole('button', { name: 'Make link' }).click();
    const link = await page.locator('#fvdLink').inputValue();
    expect(link).toMatch(/#verbs=[A-Za-z0-9_-]+$/);
    const hash = link.slice(link.indexOf('#'));

    // A student opens it on their own device (guest planner) and does it.
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await openDrill(p2, 'spanish', `/?e2e=1&scenario=student-semester${hash}`);
    await expect(p2.locator('#fvdAsgH')).toHaveText('Semana 5: el presente');
    await expect(p2.locator('.fvd-dl')).toContainText('5 questions');
    expect(await p2.evaluate(() => location.hash), 'the link is taken out of the address bar').toBe('');
    await p2.locator('[data-act="start-asg"]').click();
    await answerAll(p2, 5);
    await expect(p2.locator('.fvd-badge')).toContainText('Goal reached');
    await p2.locator('#fvdName').fill('Ana Pérez');
    await p2.getByRole('button', { name: 'Get my score code' }).click();
    const sent = await p2.locator('#fvdCode').inputValue();
    expect(sent).toMatch(/^Ana Pérez · Semana 5: el presente · 5 right of 5 \(100%\) · .+ · FV1\./);
    // Listed under My results with the code, for copying again later.
    await p2.locator('#fvdTab-mine').click();
    await expect(p2.locator('.fvd-list')).toContainText('Semana 5');
    await other.close();

    // The teacher pastes it, plus a copy with the score edited.
    const code = sent.slice(sent.indexOf('FV1.'));
    const tampered = code.replace('.5.5.', '.9.9.');
    await page.locator('#fvdCheckAsg').selectOption({ label: 'Semana 5: el presente (Spanish)' });
    await page.locator('#fvdCodes').fill(`From Ana: ${sent}\nFrom Ben: ${tampered}`);
    await page.getByRole('button', { name: 'Check codes' }).click();
    const rows = page.locator('#fvdCheckTable tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Ana Pérez');
    await expect(rows.nth(0)).toContainText('Matches this assignment');
    await expect(rows.nth(0)).toContainText('Met');
    await expect(rows.nth(1)).toContainText('Changed or incomplete');
    await expect(rows.nth(1)).toHaveClass(/is-flag/);
  });

  test('history and best scores survive a reload, inside the synced language-practice record', async ({ page }) => {
    await openDrill(page, 'german');
    await setUp(page, { tense: 'present', set: 'regular', count: 5 });
    await answerAll(page, 5, [2]);
    await expect(page.locator('#fvdResH')).toBeVisible();
    await page.reload();
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await page.evaluate(() => (window as any).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
    await page.evaluate(() => (window as any).fluxStudyHub.openTool('german', 'verbs'));
    await expect(page.locator('#fvdBest')).toContainText('Your best with these settings: 4 right of 5');
    await page.locator('#fvdTab-mine').click();
    await expect(page.locator('#fvdHistory tbody tr')).toHaveCount(1);
    await expect(page.locator('#fvdHistory')).toContainText('4');
    const slice = await page.evaluate(() => (window as any).FluxLangPractice.getCloudSlice());
    expect(slice.verbs.history).toHaveLength(1);
    expect(slice.verbs.history[0].lang).toBe('de');
  });

  test('fits a 390px phone with no sideways scroll, and has no serious axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDrill(page);
    expect(await sideways(page), 'setup scrolls sideways').toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
    await setUp(page, { tense: 'preterite', set: 'irregular', count: 5 });
    expect(await sideways(page), 'play scrolls sideways').toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
    await answerAll(page, 5, [0, 1]);
    expect(await sideways(page), 'results scroll sideways').toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
    await page.locator('#fvdTab-teach').click();
    expect(await sideways(page), 'teacher view scrolls sideways').toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
  });

  test('a timed round counts down and ends by itself', async ({ page }) => {
    await openDrill(page);
    const tenses = page.locator('input[name="fvdPtense"]');
    for (let i = 0; i < await tenses.count(); i++) {
      if ((await tenses.nth(i).getAttribute('value')) === 'present') await tenses.nth(i).check(); else await tenses.nth(i).uncheck();
    }
    await page.locator('input[name="fvdPmode"][value="time"]').check();
    await page.locator('#fvdPminutes').selectOption('1');
    await page.locator('#fvdStart').click();
    await expect(page.locator('#fvdClock')).toHaveText('1:00');
    const q = await current(page);
    await page.locator('#fvdIn').fill(q.answers[0]);
    await page.keyboard.press('Enter');
    await page.evaluate(() => (window as any).FluxVerbDrill._endIn(300));
    await expect(page.locator('#fvdResH')).toHaveText('Round over');
    await expect(page.locator('.fvd-res-line')).toContainText('1:00');
  });
  test('the light theme reads clearly too (axe, including contrast)', async ({ page }) => {
    await openDrill(page, 'french');
    await page.evaluate(() => (window as any).applyTheme('light'));
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
    expect(await axe(page)).toEqual([]);
    await setUp(page, { tense: 'passeCompose', set: 'etre', count: 5 });
    await page.locator('#fvdIn').fill('zzz');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fvdFb')).toHaveClass(/is-no/);
    expect(await axe(page)).toEqual([]);
    await page.locator('[data-act="end"]').click();
    expect(await axe(page)).toEqual([]);
  });
});
