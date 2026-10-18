import { test, expect, type Page } from '@playwright/test';

/*
 * Synara's patterns are the part of the app most likely to be believed.
 * These check what a student actually sees: the Home card says it is a
 * pattern, not proof; a dose missed AFTER a seizure (often because of
 * it) is never reported as coming before it; a real pattern says how
 * often a missed dose turns up anyway; and the seizure history counts
 * days the way the header does.
 *
 * Real clicks throughout, as in synara.spec.ts. Records are written to
 * storage directly, built in the page against a fixed clock. The pure
 * logic is covered in test/unit/synara-insights.test.mjs.
 */

test.use({ timezoneId: 'America/Chicago' });

async function withExampleData(page: Page) {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
}

/**
 * 60 days of one medication at 8 AM and 8 PM, every dose logged taken,
 * and three seizures. 'after': each at 7 AM, with that evening's dose
 * missed. 'before': each at 3 PM, with the evening before's dose missed.
 */
function storeRecord(kind: 'before' | 'after') {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const doses: Record<string, Record<string, { status: string; at: string }>> = {};
  for (let back = 60; back >= 1; back--) {
    doses[day(back)] = {
      'med_lev|08:00': { status: 'taken', at: `${day(back)}T08:05` },
      'med_lev|20:00': { status: 'taken', at: `${day(back)}T20:05` },
    };
  }
  const seizures = [5, 20, 40].map((back) => {
    const missed = kind === 'after' ? back : back + 1;
    doses[day(missed)]['med_lev|20:00'] = { status: 'missed', at: `${day(missed)}T23:00` };
    return { id: `sz_${back}`, at: `${day(back)}T${kind === 'after' ? '07:00' : '15:00'}`, duration: 60 };
  });
  localStorage.setItem('synara.v2', JSON.stringify({
    v: 3,
    profile: { name: 'Riley Ellison' },
    meds: [{
      id: 'med_lev', name: 'Levetiracetam', dose: '500 mg', added: day(60),
      schedule: [{ from: day(60), times: ['08:00', '20:00'] }],
    }],
    doses, seizures, checkins: {}, contacts: [], card: {}, settings: {},
  }));
}

/** Synara at noon on Wed Oct 7, 2026, holding the record `kind` describes. */
async function openWith(page: Page, kind: 'before' | 'after') {
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00-05:00'));
  await page.goto('/synara.html');
  await page.evaluate(storeRecord, kind);
  await page.reload();
  await expect(page.locator('#welcome')).toBeHidden();
}

async function openPatterns(page: Page) {
  await page.locator('.tab[data-to="track"]').click();
  // Log / Patterns are a pair of aria-pressed buttons (synara-a11y.spec.ts).
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await expect(page.locator('#patterns-h')).toBeVisible();
}

test.describe('Synara patterns', () => {
  test('Home’s one insight says it is a pattern, not proof, and leads to the rest', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await withExampleData(page);

    const card = page.locator('section[aria-labelledby="insight-h"]');
    // The example data's planted pattern is real enough to report: 3 of 4,
    // against about one ordinary 48 hours in five.
    await expect(card.locator('.insight-t')).toHaveText('3 of your 4 seizures came after a missed or late dose');
    await expect(card.locator('.insight-d')).toContainText('That doesn\'t show the dose caused the seizure.');
    await expect(card.locator('.insight-e')).toHaveText('3/4 seizures · 75% vs 19% otherwise');
    await expect(card.locator('.hint')).toHaveText('A pattern in your log, not proof of a cause. Talk it over with your neurologist.');

    await card.getByRole('button', { name: 'All patterns' }).click();
    await expect(page.locator('#patterns-h')).toBeVisible();
    await expect(page.locator('.disclaimer')).toContainText('not medical conclusions');
    // "Most" means more than half: the demo's 2 of 4 in the afternoon isn't.
    await expect(page.locator('.insight-t', { hasText: /^Most of your seizures/ })).toHaveCount(0);
  });

  test('a dose missed after a seizure is never reported as coming before it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openWith(page, 'after');

    // Home still shows a pattern (all three at 7 AM), with its note, but not this one.
    const card = page.locator('section[aria-labelledby="insight-h"]');
    await expect(card.locator('.insight-t')).toHaveText('Most of your seizures happened early in the morning (4am–8am)');
    await expect(card.locator('.hint')).toBeVisible();

    await openPatterns(page);
    await expect(page.locator('.insight-t').first()).toBeVisible();
    await expect(page.locator('.insight-t', { hasText: 'missed or late dose' })).toHaveCount(0);
  });

  test('a dose missed before each seizure is reported, against how often one is missed otherwise', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openWith(page, 'before');
    await openPatterns(page);

    const ins = page.locator('.insight', { hasText: 'came after a missed or late dose' });
    await expect(ins.locator('.insight-t')).toHaveText('3 of your 3 seizures came after a missed or late dose');
    await expect(ins.locator('.insight-d')).toContainText('less than 48 hours after a dose marked missed or late');
    await expect(ins.locator('.insight-d')).toContainText('of your 48-hour stretches without a seizure had one');
    await expect(ins.locator('.insight-d')).toContainText('don\'t change how you take your medicine on your own');
    await expect(ins.locator('.insight-e')).toHaveText(/^3\/3 seizures · 100% vs \d+% otherwise$/);
  });

  test('the seizure history counts days the way the header does', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Just after midnight on Wed Oct 7: the last seizure was Sunday afternoon.
    await page.clock.setFixedTime(new Date('2026-10-07T01:27:00-05:00'));
    await page.goto('/synara.html');
    await page.evaluate(() => {
      localStorage.setItem('synara.v2', JSON.stringify({
        v: 3, profile: { name: 'Riley Ellison' }, meds: [], doses: {}, checkins: {},
        contacts: [], card: {}, settings: { noMeds: true },
        seizures: [
          { id: 'sz_a', at: '2026-10-04T15:40', duration: 95 },
          { id: 'sz_b', at: '2026-09-26T09:00', duration: 60 },
        ],
      }));
    });
    await page.reload();

    await expect(page.locator('.stat', { hasText: 'Days since last seizure' }).locator('.stat-n')).toHaveText('3');
    await page.locator('.tab[data-to="track"]').click();
    await expect(page.locator('#appbar .appbar-s')).toHaveText('2 entries · 3 days since the last');
    const rows = page.locator('.log-entry .row-s');
    await expect(rows.nth(0)).toHaveText('Sun, Oct 4 at 3:40 PM · 3 days ago');   // was "2 days ago"
    await expect(rows.nth(1)).toHaveText('Sat, Sep 26 at 9:00 AM · 11 days ago');
  });
});
