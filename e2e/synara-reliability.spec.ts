import { test, expect, type Page } from '@playwright/test';

/*
 * Synara when things go wrong: storage that is full or blocked, a tab left
 * open past midnight, the clocks changing, a phone that only shows
 * notifications through a service worker, and no signal at all. The
 * emergency card has to open through every one of them.
 *
 * Real clicks throughout, as in synara.spec.ts.
 */

async function withExampleData(page: Page) {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
}

/** Through the intro with nothing filled in, to an empty record. */
async function freshRecord(page: Page) {
  await page.goto('/synara.html');
  const welcome = page.locator('#welcome');
  await page.getByRole('button', { name: 'Set it up for me' }).click();
  await expect(welcome.getByRole('heading', { name: 'First, a little about you' })).toBeVisible();
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await expect(welcome.getByRole('heading', { name: /You’re not alone/ })).toBeVisible();
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: 'Go to Synara' }).click();
  await expect(welcome).toBeHidden();
}

/** Add a medication taken at 8:00 AM and 11:30 PM, through the sheet. */
async function addMedication(page: Page) {
  await page.locator('.next-dose [data-action="med-open"]').click();
  await page.locator('#med-name').fill('Levetiracetam');
  await page.getByRole('button', { name: 'Add another time' }).click();
  await page.locator('[data-time-index="1"]').fill('23:30');
  await page.locator('.sheet-foot [data-action="med-save"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
}

/** Every write of Synara's record throws, as when the browser's storage is full. */
function storageFull() {
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key === 'synara.v2' && !(window as unknown as { __roomAgain?: boolean }).__roomAgain) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    return setItem.call(this, key, value);
  };
}

test.describe('Synara with storage that is full or blocked', () => {
  test('a full storage still opens the app and the emergency card, and says changes aren’t saving', async ({ page }) => {
    await withExampleData(page);
    // A record from the release before, which the app would normally save
    // back in the current shape as it starts.
    const before = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('synara.v2')!);
      delete s.settings.fluxLink; delete s.settings.noMeds; delete s.settings.setupHidden;
      localStorage.setItem('synara.v2', JSON.stringify(s));
      return localStorage.getItem('synara.v2');
    });
    await page.addInitScript(storageFull);

    await page.goto('/synara.html#/sos');
    const card = page.locator('#emergency[data-open="true"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.em-name')).toHaveText('Maya Ellison');
    // A second tap on Close right after the card opens is ignored for 0.7 s.
    await expect(page.locator('#emergency')).not.toHaveAttribute('data-settling', 'true');
    await card.locator('[data-action="close-emergency"]').click();

    await expect(page.locator('.save-notice')).toContainText('Changes aren’t saving right now');
    await page.locator('.sos-btn').click();
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBe(before);
  });

  test('a save that fails changes nothing on screen, and the next one saves what was tapped', async ({ page }) => {
    await withExampleData(page);
    await page.locator('.tab[data-to="meds"]').click();
    const first = page.locator('.split-main [data-action="dose-cycle"]').first();
    const med = await first.getAttribute('data-med');
    const time = await first.getAttribute('data-time');
    const tick = page.locator(`.split-main [data-action="dose-cycle"][data-med="${med}"][data-time="${time}"]`);
    await expect(tick).toHaveAttribute('data-status', 'pending');

    await page.evaluate(storageFull);
    for (let i = 0; i < 2; i++) {
      await tick.click();
      await expect(page.locator('#toast')).toContainText('Could not save');
      await expect(tick).toHaveAttribute('data-status', 'pending');
    }
    await expect(page.locator('.save-notice')).toContainText('Changes aren’t saving right now');

    // Room again: one tap is "taken", as it shows, not a third step along.
    await page.evaluate(() => { (window as unknown as { __roomAgain: boolean }).__roomAgain = true; });
    await tick.click();
    await expect(tick).toHaveAttribute('data-status', 'taken');
    await expect(page.locator('.save-notice')).toHaveCount(0);
    const day = await tick.getAttribute('data-day');
    const saved = await page.evaluate(([d, k]) => JSON.parse(localStorage.getItem('synara.v2')!).doses[d!][k!].status, [day, `${med}|${time}`]);
    expect(saved).toBe('taken');
  });

  test('with storage blocked on a new device, the example still opens, says it isn’t saving, and SOS works', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('Blocked', 'SecurityError'); };
    });
    await withExampleData(page);
    const notice = page.locator('.save-notice');
    await expect(notice).toContainText('Not saving on this device');

    // Everything entered so far can still be kept.
    const download = page.waitForEvent('download');
    await notice.getByRole('button', { name: 'Download a backup' }).click();
    expect((await download).suggestedFilename()).toMatch(/^synara-maya-ellison-.*\.json$/);

    await page.locator('.sos-btn').click();
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
  });

  test('a failed save during the intro is said on top of it, not underneath', async ({ page }) => {
    await page.goto('/synara.html');
    await page.getByRole('button', { name: 'Set it up for me' }).click();
    await page.getByLabel('What should we call you?').fill('Riley');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'You’re not alone, Riley' })).toBeVisible();

    await page.evaluate(storageFull);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    const toast = page.locator('#toast');
    await expect(toast).toContainText('Could not save');
    const onTop = await toast.evaluate((t) => {
      // The toast ignores the pointer; let it be found for this one check.
      t.style.pointerEvents = 'auto';
      const r = t.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      t.style.pointerEvents = '';
      return !!hit && t.contains(hit);
    });
    expect(onTop, 'the toast is hidden under the welcome screen').toBe(true);
  });
});

test.describe('Synara reminders', () => {
  test.use({ timezoneId: 'America/Chicago' });

  test('a tab left open overnight reminds the next morning, on the hour even when the clocks go back', async ({ page }) => {
    await page.addInitScript(() => {
      // A browser without a service worker, so each reminder is made by
      // the page and can be seen here with the time it appeared.
      delete (Navigator.prototype as unknown as { serviceWorker?: unknown }).serviceWorker;
      const shown: string[] = [];
      (window as unknown as { __shown: string[] }).__shown = shown;
      class FakeNotification {
        static permission = 'default';
        static async requestPermission() { FakeNotification.permission = 'granted'; return 'granted'; }
        constructor(title: string, opts: { body: string }) {
          shown.push(`${new Date().toLocaleString('sv-SE').slice(0, 16)} ${opts.body}`);
        }
        close() {}
      }
      Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true, writable: true });
    });
    // 11:20 PM on Oct 31, 2026: the clocks go back an hour at 2 AM.
    await page.clock.install({ time: new Date('2026-10-31T23:20:00-05:00') });
    await freshRecord(page);
    await addMedication(page);

    await page.locator('.tab[data-to="you"]').click();
    const reminders = page.locator('[data-action="reminders-toggle"]');
    await reminders.click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');

    // Through the night to 8:05 AM standard time: 9 h 45 min of real time.
    await page.clock.runFor((9 * 60 + 45) * 60 * 1000);
    expect(await page.evaluate(() => (window as unknown as { __shown: string[] }).__shown)).toEqual([
      '2026-10-31 23:30 Levetiracetam — 11:30 PM',
      '2026-11-01 08:00 Levetiracetam — 8:00 AM',
    ]);
  });

  test('where the page can’t show notifications, the test goes through the service worker', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await page.addInitScript(() => {
      // Chrome on Android: permission granted, but the page's own
      // notifications are refused.
      class AndroidNotification {
        static permission = 'granted';
        static async requestPermission() { return 'granted'; }
        constructor() { throw new TypeError("Failed to construct 'Notification': Illegal constructor."); }
      }
      Object.defineProperty(window, 'Notification', { value: AndroidNotification, configurable: true, writable: true });
      // The headless browser CI runs has no notification backend, so a real
      // registration.showNotification() rejects there. Record what reaches
      // the service worker instead; whether Synara routes the test there is
      // what this checks.
      const shown: string[] = [];
      ServiceWorkerRegistration.prototype.showNotification = function (title: string) { shown.push(title); return Promise.resolve(); };
      ServiceWorkerRegistration.prototype.getNotifications = function () { return Promise.resolve(shown.map((title) => ({ title }))) as never; };
    });
    await withExampleData(page);
    await page.evaluate(() => navigator.serviceWorker.ready);

    await page.locator('.tab[data-to="you"]').click();
    await page.locator('[data-action="reminders-toggle"]').click();
    await page.getByRole('button', { name: /Send a test notification/ }).click();
    await expect(page.locator('#toast')).toContainText('Test sent');
    const shown = await page.evaluate(async () =>
      (await (await navigator.serviceWorker.getRegistration())!.getNotifications()).map((n) => n.title));
    expect(shown).toContain('Synara reminders are on');
  });

  test('a restored backup doesn’t say reminders are on until this device allows them', async ({ page }) => {
    await page.addInitScript(() => {
      class FakeNotification {
        static permission = 'default';
        static async requestPermission() { FakeNotification.permission = 'granted'; return 'granted'; }
        close() {}
      }
      Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true, writable: true });
    });
    await withExampleData(page);
    await page.locator('.tab[data-to="you"]').click();
    await expect(page.locator('[data-action="flux-link-toggle"]')).toHaveAttribute('aria-checked', 'false');
    const file = page.locator('input[data-change="data-import"]');

    // Not a backup: said before anything is offered for replacing.
    await file.setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.locator('#toast')).toContainText('isn\'t a Synara backup');
    await expect(page.locator('#sheet')).toBeHidden();

    // A backup from a phone where reminders were on.
    const backup = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('synara.v2')!);
      s.settings.remindersOn = true;
      return JSON.stringify(s);
    });
    await file.setInputFiles({ name: 'synara-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await expect(page.locator('#toast')).toContainText('Backup restored');

    const reminders = page.locator('[data-action="reminders-toggle"]');
    await expect(reminders).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#rem-label + .row-s')).toHaveText(/Not allowed on this device yet/);
    await reminders.click();
    await expect(reminders).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#toast')).toContainText('Reminders on');
  });
});

test.describe('Synara’s next-dose card', () => {
  test.use({ timezoneId: 'America/Chicago' });

  test('a dose hours away has no “Mark taken”, and last night’s late dose can still be logged after midnight', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-08T23:20:00-05:00') });
    await freshRecord(page);
    await addMedication(page);

    // Added at 11:20 PM: this morning's 8 AM dose was never tracked, so
    // it isn't "15h overdue". Tonight's is ten minutes away.
    const card = page.locator('.next-dose');
    await expect(card).toContainText('11:30 PM');
    await expect(card).not.toContainText('overdue');

    // 12:10 AM: 40 minutes late, still inside its hour.
    await page.clock.runFor(50 * 60 * 1000);
    await expect(card).toContainText('Take it now');
    await expect(card).toContainText('11:30 PM');
    await card.getByRole('button', { name: 'Mark taken' }).click();
    await expect(page.locator('#toast')).toContainText('Marked taken');
    const lastNight = await page.evaluate(() => {
      const { doses, meds } = JSON.parse(localStorage.getItem('synara.v2')!);
      return doses['2026-10-08'][`${meds[0].id}|23:30`].status;
    });
    expect(lastNight).toBe('taken');

    // Next is 8 AM, almost eight hours off: nothing to tap by mistake.
    await expect(card).toContainText('8:00 AM');
    await expect(card.getByRole('button', { name: 'Mark taken' })).toHaveCount(0);
  });
});

test('the emergency card opens with no signal after one visit', async ({ page, context }) => {
  await withExampleData(page);
  // Flux's service worker takes the page over and keeps it, and its files.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect.poll(() => page.evaluate(async () => {
    const own = document.querySelectorAll('script[src*="flux-synara"], link[href*="flux-synara"]');
    const files = [location.pathname, ...[...own].map((n) => n.getAttribute('src') || n.getAttribute('href')!)];
    return (await Promise.all(files.map((f) => caches.match(f)))).every(Boolean);
  }), { timeout: 15_000 }).toBe(true);
  const url = page.url().split('#')[0];

  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto(url + '#/sos');
  await expect(offline.locator('#emergency[data-open="true"]')).toBeVisible();
  await expect(offline.locator('.em-name')).toHaveText('Maya Ellison');
});
