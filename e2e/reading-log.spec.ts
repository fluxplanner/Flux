import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootSignedIn, gotoScenario, openSidebarTab, type BootTask } from './helpers';

/*
 * Reading log (flux-reading-log.js), asked for by a literature teacher:
 * a dashboard card with "Log today", and its own page with the daily log,
 * books, quotes, the teacher's weekly goal, a streak, and a printout for a
 * chosen range. The counting and merging are unit tested in
 * test/unit/reading-log.test.mjs; this checks the screens, printing, the
 * dashboard section switch, and that the log goes up to the account and
 * comes back merged with another device's entries.
 */

const card = (page: Page) => page.locator('#readingLogCard');

async function today(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).FluxReadingLogCore.ymd(new Date()));
}
async function shift(page: Page, ymd: string, n: number): Promise<string> {
  return page.evaluate(([d, k]) => (window as any).FluxReadingLogCore.addDays(d, k), [ymd, n] as const);
}

test.describe('Reading log', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-dashboard-widgets');
    await expect(page.locator('#dashboard.panel.active')).toBeVisible();
  });

  test('the dashboard card adds a book, logs today, and shows the week against the goal', async ({ page }) => {
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole('heading', { name: 'Reading log' })).toBeVisible();
    await expect(card(page)).toContainText('Read today to start a streak');

    // No books yet: the card asks what you are reading.
    const title = card(page).getByLabel('What are you reading?');
    await card(page).getByRole('button', { name: 'Add book' }).click();
    await expect(card(page).locator('#frlQuickBookMsg')).toHaveText(/type the title/i);
    await title.fill('Macbeth');
    await card(page).getByRole('button', { name: 'Add book' }).click();
    await expect(card(page).locator('#frlQuickBook')).toHaveValue(/.+/);
    await expect(card(page).getByLabel('Minutes')).toBeFocused();

    // Nothing filled in is refused, in words.
    await card(page).getByRole('button', { name: 'Log today' }).click();
    await expect(card(page).locator('#frlQuickMsg')).toHaveText(/minutes you read, the pages, or both/i);

    await card(page).getByLabel('Minutes').fill('25');
    await card(page).getByLabel('Pages').fill('12');
    await card(page).getByRole('button', { name: 'Log today' }).click();
    await expect(card(page).locator('#frlQuickMsg')).toHaveText('Logged 25 minutes and 12 pages of Macbeth for today.');
    await expect(card(page)).toContainText('Today: 25 min, 12 pages');
    await expect(card(page)).toContainText('Read today: day 1 of a streak');
    await expect(card(page).getByLabel('Minutes')).toHaveValue('');

    // No goal yet: the card offers to set one, which opens the page's goal form.
    await card(page).getByRole('button', { name: 'Set your weekly goal' }).click();
    await expect(page.locator('#readingLog.panel.active')).toBeVisible();
    await expect(page.locator('#topbarTitle')).toHaveText('Reading log');
    await expect(page.locator('#frlGoalAmount')).toBeFocused();
    await page.locator('#frlGoalAmount').fill('60');
    await page.getByRole('button', { name: 'Save goal' }).click();
    await expect(page.locator('#frlGoalMsg')).toHaveText('Goal saved: 60 minutes a week.');

    await page.evaluate(() => (window as any).nav('dashboard'));
    const bar = card(page).getByRole('progressbar', { name: 'Weekly reading goal' });
    await expect(bar).toHaveAttribute('aria-valuetext', '25 of 60 minutes, 42 percent');
    await expect(card(page)).toContainText('35 minutes to go');

    // It survives a reload (saved through the app's own storage).
    await page.reload();
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect(card(page)).toContainText('25 of 60 minutes');
  });

  test('the page: books, entries with from–to pages, edit, delete with a check, quotes, tabs by keyboard', async ({ page }) => {
    const t = await today(page);
    const y = await shift(page, t, -1);
    await page.evaluate(() => (window as any).FluxReadingLog.open('books'));
    await expect(page.locator('#readingLog.panel.active')).toBeVisible();

    // A book, with its length, so the page can say how far through it you are.
    await page.locator('#frlBookTitle').fill('Beloved');
    await page.locator('#frlBookAuthor').fill('Toni Morrison');
    await page.locator('#frlBookPages').fill('320');
    await page.getByRole('button', { name: 'Save book' }).click();
    await expect(page.locator('#frlBookMsg')).toHaveText('Added Beloved.');
    await expect(page.locator('#frlBooks')).toContainText('Toni Morrison');
    await expect(page.locator('#frlBooks')).toContainText('Not logged yet');

    // Tabs move with the arrow keys and say which one is open.
    await page.locator('#frlTab-books').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#frlTab-log')).toBeFocused();
    await expect(page.locator('#frlTab-log')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#frlPane-log')).toBeVisible();
    await expect(page.locator('#frlPane-books')).toBeHidden();

    // From page 1 to page 30 counts as 30 pages.
    await page.locator('#frlEntryDate').fill(y);
    await page.locator('#frlEntryFrom').fill('1');
    await page.locator('#frlEntryTo').fill('30');
    await expect(page.locator('#frlEntryPagesHint')).toHaveText('That counts as 30 pages (both pages included).');
    await page.locator('#frlEntryMin').fill('40');
    await page.locator('#frlEntryNote').fill('The ghost arrives');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Saved: Beloved, yesterday.');
    // A date in the future is refused.
    await page.locator('#frlEntryDate').fill(await shift(page, t, 2));
    await page.locator('#frlEntryMin').fill('10');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText(/in the future/);
    await page.locator('#frlEntryDate').fill(t);
    await page.locator('#frlEntryFrom').fill('31');
    await page.locator('#frlEntryTo').fill('45');
    await page.locator('#frlEntryMin').fill('20');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Saved: Beloved, today.');

    const entries = page.locator('#frlEntries');
    await expect(entries.locator('.frl-day-h').first()).toContainText('Today');
    await expect(entries).toContainText('pages 1 to 30 · 30 pages · 40 min');
    await expect(entries).toContainText('The ghost arrives');
    await expect(page.locator('#frlSummary')).toContainText('2 days');   // the streak

    // Edit yesterday's entry.
    await entries.getByRole('button', { name: /^Edit entry: Beloved/ }).last().click();
    await expect(page.locator('#frlEntryH')).toHaveText('Edit entry');
    await expect(page.locator('#frlEntryH')).toBeFocused();
    await page.locator('#frlEntryMin').fill('50');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#frlEntryMsg')).toHaveText('Entry updated: Beloved, yesterday.');
    await expect(entries).toContainText('50 min');

    // Delete asks first; "Keep" keeps it, and focus goes back.
    const del = entries.getByRole('button', { name: /^Delete entry: Beloved/ }).first();
    await del.click();
    await expect(entries.getByRole('group', { name: 'Delete this entry?' })).toBeVisible();
    await expect(entries.getByRole('button', { name: 'Keep' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(entries.locator('.frl-row')).toHaveCount(2);
    await entries.getByRole('button', { name: /^Delete entry: Beloved/ }).first().click();
    await entries.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(entries.locator('.frl-row')).toHaveCount(1);
    await expect(page.locator('#frlEntriesH')).toBeFocused();

    // Book progress: furthest page reached of 320.
    await page.locator('#frlTab-books').click();
    await expect(page.locator('#frlBooks')).toContainText('Page 30 of 320 (9%)');

    // A quote, saved from the book's own "Add quote".
    await page.getByRole('button', { name: 'Save a quote from Beloved' }).click();
    await expect(page.locator('#frlPane-quotes')).toBeVisible();
    await expect(page.locator('#frlQuoteText')).toBeFocused();
    await page.locator('#frlQuoteText').fill('Definitions belong to the definers, not the defined.');
    await page.locator('#frlQuotePage').fill('225');
    await page.locator('#frlQuoteWhy').fill('Who gets to name things is power.');
    await page.getByRole('button', { name: 'Save quote' }).click();
    await expect(page.locator('#frlQuotes')).toContainText('Definitions belong to the definers');
    await expect(page.locator('#frlQuotes')).toContainText('Page 225');
    await expect(page.locator('#frlQuotes')).toContainText('Why it matters: Who gets to name things is power.');

    // Finishing a book fills in today's date, and a rating shows.
    await page.locator('#frlTab-books').click();
    await page.getByRole('button', { name: 'Edit Beloved' }).click();
    await page.locator('#frlBookStatus').selectOption('finished');
    await expect(page.locator('#frlBookFinished')).toHaveValue(t);
    await page.locator('#frlBookRating').selectOption('5');
    await page.locator('#frlBookReflection').fill('Hard to read and impossible to forget.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#frlBooks')).toContainText('Finished');
    await expect(page.locator('#frlBooks')).toContainText('Rated 5 out of 5');
    await expect(page.locator('#frlBooks')).toContainText('Page 320 of 320 (100%)');

    // Deleting a book says what goes with it.
    await page.getByRole('button', { name: 'Delete Beloved' }).click();
    await expect(page.locator('#frlBooks').getByRole('group')).toHaveAccessibleName('Delete Beloved and its 1 log entry and 1 quote?');
    await page.locator('#frlBooks').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('#frlBooks')).toContainText('No books yet');
    const left = await page.evaluate(() => {
      const s = (window as any).FluxReadingLog.state();
      const live = (l: any[]) => l.filter((x) => !x.deleted).length;
      return { books: live(s.books), entries: live(s.entries), quotes: live(s.quotes), tombstones: s.entries.length };
    });
    expect(left).toEqual({ books: 0, entries: 0, quotes: 0, tombstones: 2 });
  });

  test('prints a clean log for the chosen dates, with only those dates in it', async ({ page }) => {
    const t = await today(page);
    const ws = await page.evaluate((d) => (window as any).FluxReadingLogCore.weekStart(d, 1), t);
    const before = await shift(page, ws, -3);
    await page.evaluate(([d0, d1]) => {
      const w = window as any;
      const id = w.FluxReadingLog.addBook({ title: 'Jane Eyre', author: 'Charlotte Brontë', totalPages: 500 });
      const s = w.FluxReadingLog.state();
      s.entries.push({ id: 'e1', date: d0, bookId: id, minutes: 30, fromPage: 1, toPage: 20, note: 'Red room', updated: 1 });
      s.entries.push({ id: 'e2', date: d1, bookId: id, minutes: 99, pages: 7, note: 'Too early', updated: 1 });
      s.quotes.push({ id: 'q1', bookId: id, text: 'I am no bird', page: '253', why: 'Freedom', date: d0, updated: 1 });
      s.goal = { unit: 'minutes', amount: 60, weekStartsOn: 1, updated: 1 };
      w.save(w.FluxReadingLog.KEY, s);
      w.FluxReadingLog.render();
    }, [ws, before] as const);
    await page.evaluate(() => {
      const w = window as any;
      w.__printed = [];
      w.print = () => {
        w.__printed.push({ cls: document.body.classList.contains('frl-printing'), html: document.getElementById('frlPrintRoot')?.innerHTML || '' });
      };
      w.FluxReadingLog.open('print');
    });
    await expect(page.locator('#frlPane-print')).toBeVisible();
    // Defaults to this week.
    await expect(page.locator('#frlPrintFrom')).toHaveValue(ws);
    await expect(page.locator('#frlPrintSummary')).toHaveText('This printout covers 7 days: 1 entry, 30 minutes, 20 pages, read on 1 day, and 1 quote.');
    await page.locator('#frlPrintName').fill('Ada Student');
    await page.locator('#frlPrintClass').fill('English 10');
    await page.getByRole('button', { name: 'Print or save as PDF' }).click();

    const printed = await page.evaluate(() => (window as any).__printed);
    expect(printed).toHaveLength(1);
    expect(printed[0].cls).toBe(true);
    const html: string = printed[0].html;
    expect(html).toContain('Ada Student');
    expect(html).toContain('English 10');
    expect(html).toContain('Jane Eyre');
    expect(html).toContain('Red room');
    expect(html).not.toContain('Too early');
    expect(html).toContain('I am no bird');
    expect(html).toContain('Student signature');
    expect(html).toContain('Parent or guardian signature');
    expect(html).toMatch(/Total:<\/strong> 30 minutes, 20 pages, read on 1 day out of 7/);

    // On paper only the log shows; on screen nothing changed.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#frlPrintRoot')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('#frlPrintRoot h1')).toHaveText('Reading log');
    await expect(page.locator('#frlPrintRoot .frl-p-table tbody tr')).toHaveCount(2);   // the week line + one day
    const ink = await page.locator('#frlPrintRoot .frl-p').evaluate((el) => getComputedStyle(el).color);
    expect(ink).toBe('rgb(0, 0, 0)');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('body')).not.toHaveClass(/frl-printing/);
    await expect(page.locator('#frlPrintRoot')).toBeHidden();

    // The name is remembered for next time.
    expect(await page.evaluate(() => (window as any).FluxReadingLog.state().prefs.name)).toBe('Ada Student');

    // "Everything" widens the range to the first entry.
    await page.getByRole('button', { name: 'Everything' }).click();
    await expect(page.locator('#frlPrintFrom')).toHaveValue(before);
    await expect(page.locator('#frlPrintSummary')).toContainText('2 entries');
  });

  test('works at 390px, in light and dark, with no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const w = window as any;
      const id = w.FluxReadingLog.addBook({ title: 'A Very Long Book Title That Goes On And On Without Stopping', totalPages: 300 });
      w.FluxReadingLog.render();
      return id;
    });
    await expect(card(page)).toBeVisible();
    await card(page).getByLabel('Minutes').fill('15');
    await card(page).getByRole('button', { name: 'Log today' }).click();
    await expect(card(page).locator('#frlQuickMsg')).toContainText('Logged 15 minutes');
    for (const theme of ['dark', 'light']) {
      await page.evaluate((k) => (window as any).applyTheme?.(k), theme);
      for (const where of ['dashboard', 'log', 'books', 'quotes', 'print']) {
        if (where === 'dashboard') await page.evaluate(() => (window as any).nav('dashboard'));
        else await page.evaluate((w) => (window as any).FluxReadingLog.open(w), where);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sideways, `${theme} ${where}`).toBeLessThanOrEqual(0);
        const root = where === 'dashboard' ? '#readingLogCard' : '#frlRoot';
        const overflow = await page.locator(root).evaluate((el) => {
          const r = el.getBoundingClientRect();
          // Click ripples are drawn larger than their button and clipped by it.
          return [...el.querySelectorAll('*')].filter((c) => !c.closest('[class*="ripple"]')).filter((c) => {
            const b = (c as HTMLElement).getBoundingClientRect();
            return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1) && (c as HTMLElement).offsetParent !== null;
          }).map((c) => c.id || c.className).slice(0, 5);
        });
        expect(overflow, `${theme} ${where}`).toEqual([]);
      }
      // Text follows the theme: dark text on light, light text on dark.
      await page.evaluate(() => (window as any).FluxReadingLog.open('log'));
      const lum = await page.locator('#frlSumH').evaluate((el) => {
        const m = getComputedStyle(el).color.match(/\d+/g)!.map(Number);
        return (m[0] + m[1] + m[2]) / 3;
      });
      if (theme === 'light') expect(lum).toBeLessThan(110);
      else expect(lum).toBeGreaterThan(160);
    }
  });

  test('no serious accessibility problems on the card or the page', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as any;
      w.FluxReadingLog.addBook({ title: 'Macbeth' });
    });
    for (const sel of ['#readingLogCard']) {
      const r = await new AxeBuilder({ page }).include(sel).analyze();
      const bad = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    for (const tab of ['log', 'books', 'quotes', 'print']) {
      await page.evaluate((w) => (window as any).FluxReadingLog.open(w), tab);
      await page.waitForTimeout(700);   // let the panel's entrance settle: half-faded text reads as low contrast
      const r = await new AxeBuilder({ page }).include('#readingLog').analyze();
      const bad = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(bad.map((v) => `${tab} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });

  test('the card can be hidden and brought back from Settings, Layout', async ({ page }) => {
    await expect(card(page)).toBeVisible();
    await card(page).getByRole('button', { name: 'Hide the reading log card from the dashboard' }).click();
    await expect(card(page)).toHaveClass(/flux-dash-user-hidden/);
    await expect(card(page)).toBeHidden();
    await openSidebarTab(page, 'settings');
    await page.evaluate(() => (window as any).switchStab('appearance'));
    await page.evaluate(() => (window as any).FluxPersonal?.renderPanelLayoutSettings?.());
    const box = page.locator('#fluxPanelLayoutSettings label').filter({ hasText: 'Reading log' }).locator('input');
    await expect(box).not.toBeChecked();
    await box.check();
    await page.evaluate(() => (window as any).nav('dashboard'));
    await expect(card(page)).toBeVisible();
  });

  test('Study tools, English, Literature opens the reading log', async ({ page }) => {
    await page.evaluate(() => (window as any).nav('toolbox'));
    await page.waitForTimeout(600);
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('english'));
    await page.locator('#fshUnits .fsh-unit[data-unit="literature"]').click();
    await page.locator('#fshChemTabs [data-tool="lit-reading-log"]').click();
    await page.locator('#fshStage').getByRole('button', { name: 'Open reading log' }).click();
    await expect(page.locator('#readingLog.panel.active')).toBeVisible();
    await expect(page.locator('#frlSumH')).toBeFocused();
  });
});

/* ── Sync: up to the account and back, merged with another device ─────── */

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TASKS: BootTask[] = Array.from({ length: 2 }, (_, i) => ({
  id: 8100 + i, name: `Boot task ${i}`, date: day(i + 1), priority: 'med', type: 'hw',
  done: false, subtasks: [], createdAt: 1_700_000_000_000 + i,
}));

async function openSignedIn(page: Page) {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveClass(/visible/);
  await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 15_000 });
}
/** Outside ?e2e=1 the morning/evening mood card can open on a timer; it is not what this test is about. */
async function noMoodCard(page: Page) {
  await page.evaluate(() => (window as any).FluxMoodPrompt?.close?.());
}

test('the log goes up to the account and comes back merged with another device\'s entries', async ({ page }) => {
  const localDay = new Date();
  const ymd = `${localDay.getFullYear()}-${String(localDay.getMonth() + 1).padStart(2, '0')}-${String(localDay.getDate()).padStart(2, '0')}`;
  const BOOK = { id: 'bshared', title: 'The Odyssey', author: 'Homer', status: 'reading', updated: 1000 };
  // The phone logged this morning; the laptop logged too, before it synced.
  const phone = { books: [BOOK], entries: [{ id: 'ephone1', date: ymd, bookId: 'bshared', minutes: 15, updated: 2000 }], quotes: [] };
  const laptop = { books: [BOOK], entries: [{ id: 'elaptop1', date: ymd, bookId: 'bshared', minutes: 20, updated: 2100 }], quotes: [] };
  const boot = await bootSignedIn(page, {
    tasks: TASKS,
    cloud: { tasks: TASKS, onboarded: true, readingLog: phone },
    extraLocal: { flux_reading_log_v1: laptop },
  });
  await openSignedIn(page);

  const ids = (log: any) => (log?.entries || []).filter((e: any) => !e.deleted).map((e: any) => e.id).sort();
  // Both entries here, and both pushed up.
  await expect.poll(() => page.evaluate(() => (window as any).FluxReadingLog.state().entries.map((e: any) => e.id).sort()), { timeout: 15_000 })
    .toEqual(['elaptop1', 'ephone1']);
  await expect.poll(() => ids((boot.state.cloud as any).readingLog), { timeout: 20_000 }).toEqual(['elaptop1', 'ephone1']);
  await expect(card(page)).toContainText('Today: 35 min');

  // The phone logs again (writing the row) while the student logs here from the card.
  await page.waitForTimeout(500);
  boot.writeElsewhere((row: any) => ({
    ...row,
    readingLog: { ...row.readingLog, entries: [...row.readingLog.entries, { id: 'ephone2', date: ymd, bookId: 'bshared', minutes: 10, updated: Date.now() }] },
  }));
  await noMoodCard(page);
  await card(page).getByLabel('Minutes').fill('5');
  await card(page).getByRole('button', { name: 'Log today' }).click();
  await expect(card(page).locator('#frlQuickMsg')).toContainText('Logged 5 minutes of The Odyssey');

  // Nothing lost on either side: four entries, here and in the account.
  await expect.poll(async () => {
    const here = await page.evaluate(() => (window as any).FluxReadingLog.state().entries.filter((e: any) => !e.deleted).length);
    return { here, cloud: ids((boot.state.cloud as any).readingLog).length };
  }, { timeout: 30_000 }).toEqual({ here: 4, cloud: 4 });
  const cloudIds = ids((boot.state.cloud as any).readingLog);
  expect(cloudIds).toEqual(expect.arrayContaining(['elaptop1', 'ephone1', 'ephone2']));
  await expect(card(page)).toContainText('Today: 50 min');

  // A deletion here reaches the account as a tombstone, not a missing item that could come back.
  await page.evaluate(() => {
    const w = window as any;
    w.FluxReadingLog.open('log');
  });
  await noMoodCard(page);
  await page.locator('#frlEntries').getByRole('button', { name: /^Delete entry: The Odyssey/ }).first().click();
  await page.locator('#frlEntries').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => ids((boot.state.cloud as any).readingLog).length, { timeout: 30_000 }).toBe(3);
  const tomb = ((boot.state.cloud as any).readingLog.entries as any[]).filter((e) => e.deleted);
  expect(tomb).toHaveLength(1);
});
