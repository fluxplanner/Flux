import { test, expect, type Page, type Locator } from '@playwright/test';

/*
 * Synara for a keyboard, switch or screen-reader user, and for anyone
 * reading it on a dim phone: where focus lands when something closes, the
 * skip link, what the check-in says out loud, and contrast in both themes.
 * Then what it tells students about itself (no notes meant for developers,
 * privacy copy that matches what it does, a manifest for the home screen),
 * and sync on a computer two students share.
 * Real clicks and real key presses throughout, as in synara.spec.ts.
 */

async function withExampleData(page: Page) {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
}

/** Right after the emergency card opens or its timer buttons change, a
    second tap on Close, "It stopped", "Log this seizure" or "Reset" is
    ignored for 0.7 s (safety.js); a test that means to press one waits. */
async function settled(page: Page) {
  await expect(page.locator('#emergency')).not.toHaveAttribute('data-settling', 'true');
}

/** WCAG contrast of an element's text against the solid fills behind it. */
function contrastOf(el: Element): number {
  const parse = (c: string) => {
    const m = (c.match(/[\d.]+/g) || []).map(Number);
    return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
  };
  type C = ReturnType<typeof parse>;
  const over = (t: C, base: C): C => ({
    r: t.r * t.a + base.r * (1 - t.a), g: t.g * t.a + base.g * (1 - t.a), b: t.b * t.a + base.b * (1 - t.a), a: 1,
  });
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c: C) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const layers: C[] = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
  }
  let bg = layers.pop() || { r: 255, g: 255, b: 255, a: 1 };
  while (layers.length) bg = over(layers.pop()!, bg);
  let fg = parse(getComputedStyle(el).color);
  if (fg.a < 1) fg = over(fg, bg);
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function expectContrast(target: Locator, min: number, what: string) {
  const ratio = await target.evaluate(contrastOf);
  expect(ratio, `${what}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
}

test.describe('Synara: focus and keyboard', () => {
  test('closing the emergency card hands focus back to SOS, by Escape or Close', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    // The welcome had nothing to return to: the top of the screen, not <body>.
    await expect(page.locator('#screen')).toBeFocused();

    const sos = page.locator('.sos-btn');
    await sos.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#emergency')).toBeHidden();
    await expect(sos).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
    await settled(page);
    await page.locator('#emergency [data-action="close-emergency"]').click();
    await expect(page.locator('#emergency')).toBeHidden();
    await expect(sos).toBeFocused();
  });

  test('logging from the timer, then closing the form, comes back to SOS', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    await page.locator('.sos-btn').click();
    const card = page.locator('#emergency[data-open="true"]');
    await card.locator('[data-action="timer-start"]').click();
    await settled(page);
    await card.locator('[data-action="timer-stop"]').click();
    await settled(page);
    await card.locator('[data-action="timer-log"]').click();
    await expect(page.locator('#sheet[data-open="true"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('.sos-btn')).toBeFocused();
  });

  test('reopening the card after "It stopped" puts focus on "Log this seizure"', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    await page.locator('.sos-btn').click();
    const card = page.locator('#emergency[data-open="true"]');
    await card.locator('[data-action="timer-start"]').click();
    await settled(page);
    await card.locator('[data-action="timer-stop"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#emergency')).toBeHidden();

    await page.locator('.sos-btn').click();
    await expect(card.locator('[data-action="timer-log"]')).toBeFocused();
  });

  test('a running timer is never out of sight: the app says so and opens it again', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    const banner = page.locator('.timer-banner');
    await expect(banner).toBeHidden();

    await page.locator('.sos-btn').click();
    const card = page.locator('#emergency[data-open="true"]');
    await card.locator('[data-action="timer-start"]').click();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Seizure timer still running');

    // A reload mid-seizure keeps the count, and the banner with it.
    await page.reload();
    await expect(banner).toBeVisible();

    await banner.click();
    await expect(card.locator('[data-action="timer-stop"]')).toBeFocused();
    await settled(page);
    await card.locator('[data-action="timer-stop"]').click();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.locator('#emergency')).toBeHidden();
    await expect(banner).toBeHidden();
  });

  test('the skip link moves focus to the screen, stays on the same tab, and goes inert under a sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await withExampleData(page);
    await page.locator('.tab[data-to="safety"]').click();
    await page.reload();
    await expect(page.locator('.screen-inner[data-route="safety"]')).toBeVisible();

    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#screen')).toBeFocused();
    expect(new URL(page.url()).hash).toBe('#/safety');
    await expect(page.locator('.screen-inner[data-route="safety"]')).toBeVisible();

    // Under a sheet, Tab and Shift+Tab stay in the sheet: the skip link is
    // part of the app behind it, not a way out of the dialog.
    await page.locator('[data-action="contact-open"]').first().click();
    await expect(page.locator('#sheet[data-open="true"]')).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      await expect(skip).not.toBeFocused();
    }
  });

  test('a confirm opened from a sheet keeps its backdrop, and tapping outside cancels it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    await page.locator('.tab[data-to="safety"]').click();
    const rows = page.locator('.screen-inner[data-route="safety"] .contact-row');
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();

    await page.locator('[data-action="contact-open"][data-id]').first().click();
    await page.locator('#sheet [data-action="contact-delete"]').click();
    await expect(page.locator('#sheet-title')).toHaveText('Delete this contact?');
    await page.waitForTimeout(600); // past the first sheet's 300ms exit
    await expect(page.locator('#backdrop')).toBeVisible();

    await page.locator('#backdrop').click({ position: { x: 195, y: 60 } });
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(rows).toHaveCount(before);
  });

  test('the check-in stepper speaks its new value from a live region that stays put', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    await page.locator('.tab[data-to="track"]').click();
    await page.locator('[data-action="checkin-open"]').click();
    await expect(page.locator('#sheet[data-open="true"]')).toBeVisible();

    const live = page.locator('.sleep-n[aria-live="polite"]');
    await live.evaluate((n) => n.setAttribute('data-e2e-same-node', ''));
    const more = page.getByRole('button', { name: 'Half an hour more' });
    // Half-hour steps, from whatever today's check-in already says.
    const next = Math.round((Number(await page.locator('[data-sleep-hours]').textContent()) + 0.5) * 2) / 2;
    await more.click();
    await expect(page.locator('[data-sleep-hours]')).toHaveText(String(next));
    // The same node, so screen readers announce the change; "hours" in words.
    await expect(page.locator('.sleep-n[data-e2e-same-node]')).toHaveCount(1);
    await expect(live).toContainText('hours');
    await expect(more).toBeFocused();

    const stressed = page.getByRole('button', { name: '4, Stressed' });
    await stressed.click();
    await expect(stressed).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '2, Fine' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-stress-hint]')).toHaveText('Stressed');
    await expect(stressed).toBeFocused();

    await page.locator('#ci-notes').fill('Exams this week');
    await page.locator('.sheet [data-action="checkin-save"]').click();
    await expect(page.locator('#sheet')).toBeHidden();
    const saved = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('synara.v2')!);
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return s.checkins[key];
    });
    expect(saved).toMatchObject({ sleepHours: next, stress: 4, notes: 'Exams this week' });
  });

  test('Log and Patterns are toggle buttons, not tabs that ignore arrow keys', async ({ page }) => {
    await withExampleData(page);
    await page.locator('.tab[data-to="track"]').click();
    await expect(page.getByRole('tab')).toHaveCount(0);
    const patterns = page.getByRole('button', { name: 'Patterns' });
    await expect(patterns).toHaveAttribute('aria-pressed', 'false');
    await patterns.click();
    await expect(page.getByRole('button', { name: 'Patterns' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Synara: contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`text clears WCAG AA in ${scheme} mode, and AAA on the emergency card's button`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 390, height: 844 });
      await withExampleData(page);

      // The theme picker's own "Dark" button once took on dark-mode ink.
      await page.locator('.tab[data-to="you"]').click();
      for (const t of ['system', 'light', 'dark']) {
        await expectContrast(page.locator(`.segment[data-theme="${t}"]`), 4.5, `theme option ${t}`);
      }
      await expectContrast(page.locator('.kv-k').first(), 4.5, 'care detail label');
      await expectContrast(page.locator('.disclaimer span').first(), 4.5, 'disclaimer');

      // Calendar days carry their status in dark ink and a glyph, not hue alone.
      await page.locator('.tab[data-to="meds"]').click();
      for (const s of ['taken', 'late', 'missed']) {
        const day = page.locator(`.cal-day[data-status="${s}"]`).first();
        await expectContrast(day, 4.5, `${s} day`);
        expect(await day.evaluate((d) => getComputedStyle(d, '::before').content), `${s} glyph`).not.toBe('none');
      }
      await expectContrast(page.locator('.cal-dow').first(), 4.5, 'weekday');
      await page.locator('.dose-row .tick').first().click();
      await expectContrast(page.locator('.tick[data-status="taken"]').first(), 4.5, 'taken tick');

      await page.locator('.tab[data-to="track"]').click();
      await expectContrast(page.getByRole('button', { name: 'Log a seizure' }), 4.5, 'primary button');
      await expectContrast(page.locator('.pill-warn').first(), 4.5, 'trigger pill');

      await page.locator('.sos-btn').click();
      const card = page.locator('#emergency[data-open="true"]');
      await expect(card).toBeVisible();
      await expectContrast(card.locator('.em-timer-clock'), 3, 'idle 0:00');
      await expectContrast(card.locator('[data-action="timer-start"]'), 7, 'Start timer');
      await card.locator('.em-close').hover();
      await expectContrast(card.locator('.em-close'), 4.5, 'Close, under the pointer');
    });
  }

  test('the app bar title wraps on a phone instead of ending in "…"', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 8, 15, 0));
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    const title = page.locator('.appbar-t');
    await expect(title).toHaveText('Good afternoon, Maya');
    expect(await title.evaluate((t) => t.scrollWidth <= t.clientWidth)).toBe(true);
    await page.locator('.tab[data-to="safety"]').click();
    const sub = page.locator('.appbar-s');
    expect(await sub.evaluate((t) => t.scrollWidth <= t.clientWidth)).toBe(true);
  });
});

test.describe('Synara: what it says about itself', () => {
  test('no notes meant for developers, and privacy copy that matches what it does', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/synara.html');
    await expect(page.locator('#welcome .welcome-note')).toContainText('unless you turn on encrypted sync');
    await page.getByRole('button', { name: 'Look around with example data' }).click();
    await expect(page.locator('#welcome')).toBeHidden();

    for (const route of ['safety', 'you']) {
      await page.locator(`.tab[data-to="${route}"]`).click();
      const text = await page.locator('#screen').innerText();
      for (const dev of ['React Native', 'HIPAA', 'COPPA', 'student project', 'not built yet']) {
        expect(text, `"${dev}" on ${route}`).not.toContain(dev);
      }
    }

    // Sync is off here, and the data card says what that means, Google Fonts included.
    await expect(page.locator('.list-row-static .row-t', { hasText: /^Stored on this device$/ })).toBeVisible();
    const data = page.locator('section[aria-labelledby="data-h"] .disclaimer');
    await expect(data).toContainText('an encrypted copy is kept in your Flux account');
    await expect(data).toContainText('Google Fonts');
    await expect(page.locator('section[aria-labelledby="rem-h"] .disclaimer')).toContainText('only remind you while it');

    // About reads as sentences, not the source file's line breaks.
    const about = page.locator('section[aria-labelledby="about-h"] p').first();
    expect(await about.evaluate((p) => getComputedStyle(p).whiteSpace)).toBe('normal');
    await expect(about).toContainText('built around school life');
  });

  test('a manifest makes it an app on the home screen, with the emergency card as a shortcut', async ({ page, request }) => {
    await page.goto('/synara.html');
    const url = new URL((await page.locator('link[rel="manifest"]').getAttribute('href'))!, page.url());
    const res = await request.get(url.href);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.display).toBe('standalone');
    expect(new URL(m.start_url, url).pathname).toBe('/synara.html');
    const sos = m.shortcuts.find((s: { url: string }) => new URL(s.url, url).hash === '#/sos');
    expect(sos, 'an "Emergency card" shortcut to #/sos').toBeTruthy();
    expect(new URL(sos.url, url).pathname).toBe('/synara.html');
    for (const icon of m.icons) {
      expect((await request.get(new URL(icon.src, url).href)).ok(), icon.src).toBe(true);
    }
    // And the browser reads it without complaint.
    const cdp = await page.context().newCDPSession(page);
    const parsed = await cdp.send('Page.getAppManifest');
    expect(parsed.errors).toEqual([]);
  });
});

test.describe('Synara: sync on a shared computer', () => {
  type Row = { ciphertext: string; iv: string; version: number; updated_at: string } | null;

  test('a second student signed in to Flux never gets the first one\'s record, or loses their own', async ({ page }) => {
    // One browser, one Flux sign-in at a time, a vault per account.
    const rows: Record<string, Row> = { 'student-a': null, 'student-b': null };
    let who = 'student-a';
    let writes = 0;
    await page.exposeFunction('__vault', (op: string, arg: { ciphertext: string; iv: string }) => {
      if (op === 'account') return { id: who, email: `${who}@example.com` };
      if (op === 'get') return rows[who];
      if (op === 'put') {
        writes += 1;
        rows[who] = { ciphertext: arg.ciphertext, iv: arg.iv, version: 1, updated_at: new Date(Date.UTC(2027, 0, 1, 0, 0, writes)).toISOString() };
        return { updated_at: rows[who]!.updated_at };
      }
      if (op === 'remove') { rows[who] = null; return true; }
      return null;
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __vault: (op: string, arg?: unknown) => Promise<unknown>; FluxSynaraVault: unknown };
      w.FluxSynaraVault = {
        account: () => w.__vault('account'),
        get: () => w.__vault('get'),
        put: (r: unknown) => w.__vault('put', r),
        remove: () => w.__vault('remove'),
      };
    });

    // Student A turns sync on.
    await page.setViewportSize({ width: 1280, height: 900 });
    await withExampleData(page);
    await page.locator('.tab[data-to="you"]').click();
    await page.getByRole('button', { name: /Sync across your devices/ }).click();
    await page.getByRole('button', { name: 'Start syncing from this device' }).click();
    await expect(page.locator('.sync-key code')).toBeVisible();
    await page.locator('.sheet [data-action="close-sheet"]').first().click();
    await expect(page.locator('#sheet')).toBeHidden();
    expect(rows['student-a']).not.toBeNull();
    await expect(page.locator('.list-row-static .row-t', { hasText: 'with encrypted sync' })).toBeVisible();

    // Student B, who syncs from their own phone, signs in to Flux here.
    const bRow = { ciphertext: 'B-OWN-COPY', iv: 'B-IV', version: 1, updated_at: '2027-02-01T00:00:00.000Z' };
    rows['student-b'] = { ...bRow };
    who = 'student-b';

    // A change to the record in this browser (A's) goes nowhere near B's
    // account, and no "which copy should Synara keep?" asks B to overwrite
    // their own synced copy with it.
    await page.locator('[data-action="profile-edit"]').first().click();
    await page.locator('#p-name').fill('Maya E.');
    await page.locator('.sheet [data-action="profile-save"]').last().click();
    await expect(page.locator('.row-s', { hasText: 'different Flux account' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sheet')).toBeHidden();
    expect(rows['student-b']).toEqual(bRow);

    // A signs back in: syncing carries on where it left off.
    who = 'student-a';
    const before = writes;
    await page.getByRole('button', { name: /Sync across your devices/ }).click();
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect.poll(() => writes).toBeGreaterThan(before);
    expect(rows['student-b']).toEqual(bRow);
  });
});
