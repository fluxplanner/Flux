import { test, expect, type Page } from '@playwright/test';

/*
 * Synara's safety card: the emergency screen a teacher uses mid-seizure, its
 * timer, and the printed copy in the front office's binder. Real clicks, as in
 * synara.spec.ts. First aid follows the Epilepsy Foundation ("Stay, Safe,
 * Side") and the CDC.
 */

async function withExampleData(page: Page) {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
}

async function openEmergency(page: Page) {
  await page.locator('.sos-btn').click();
  const card = page.locator('#emergency[data-open="true"]');
  await expect(card).toBeVisible();
  return card;
}

/** One block of the emergency card, by its exact heading. */
function block(page: Page, heading: string) {
  return page.locator('#emergency .em-block').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

/** Right after the card opens or its buttons change, a second tap on Close,
    "It stopped", "Log this seizure" or "Reset" is ignored for 0.7 s
    (safety.js), so a test that means to press one waits that out. */
async function settled(page: Page) {
  await expect(page.locator('#emergency')).not.toHaveAttribute('data-settling', 'true');
}

test.describe('Synara first aid', () => {
  test('a seizure past 5 minutes keeps Call 911 up after "It stopped"', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    const card = await openEmergency(page);
    const timer = card.locator('.em-timer');

    await card.getByRole('button', { name: 'Start timer' }).click();
    await expect(timer).toHaveAttribute('data-state', 'running');
    await expect(timer.locator('[data-timer-hint]')).toContainText('from when it began');

    // Whoever starts it usually arrived late: each "+1 min" counts the time
    // already gone, and at five minutes the box turns red, once, with Call 911.
    const earlier = card.getByRole('button', { name: '+1 min — it began earlier' });
    for (let i = 0; i < 5; i++) await earlier.click();
    await expect(timer).toHaveAttribute('data-state', 'over');
    await expect(timer.getByRole('link', { name: /Over 5 minutes — call 911 now/ })).toHaveAttribute('href', 'tel:911');
    // Still there: a late arrival may need more than five minutes added.
    await expect(earlier).toBeVisible();

    // It ending doesn't make it safe: 5 minutes or more still needs 911,
    // and the call button takes focus.
    await settled(page);
    await card.getByRole('button', { name: 'It stopped' }).click();
    await expect(timer).toHaveAttribute('data-state', 'over');
    await expect(timer.locator('[data-timer-hint]')).toContainText('call 911 if no one has yet');
    const call = timer.getByRole('link', { name: 'Call 911', exact: true });
    await expect(call).toHaveAttribute('href', 'tel:911');
    await expect(call).toBeFocused();
    await expect(timer.getByRole('button', { name: 'Log this seizure' })).toBeVisible();
  });

  for (const width of [320, 390, 1280]) {
    test(`seven taps on "+1 min" at ${width}px never stop the timer or close the card`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await withExampleData(page);
      const card = await openEmergency(page);
      const timer = card.locator('.em-timer');
      await card.getByRole('button', { name: 'Start timer' }).click();
      await settled(page);

      // Someone who arrived seven minutes late taps the same spot, fast.
      const earlier = card.getByRole('button', { name: '+1 min — it began earlier' });
      const box = (await earlier.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      for (let i = 0; i < 7; i++) {
        await page.mouse.click(x, y);
        expect(await page.evaluate(([px, py]) =>
          document.elementFromPoint(px, py)?.closest('[data-action]')?.getAttribute('data-action'), [x, y]),
        `tap ${i + 1} would land on something else`).toBe('timer-earlier');
      }
      await expect(timer).toHaveAttribute('data-state', 'over');
      await expect(timer.locator('[data-timer-clock]')).toHaveText(/^7:\d\d$/);
      await expect(card.getByRole('button', { name: 'It stopped' })).toBeVisible();
      await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
      await expect(page.locator('#sheet')).toBeHidden();
    });
  }

  test('seven Enters on "+1 min" keep it running, with focus where it was', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    const card = await openEmergency(page);
    const timer = card.locator('.em-timer');
    await card.getByRole('button', { name: 'Start timer' }).click();
    const earlier = card.getByRole('button', { name: '+1 min — it began earlier' });
    await earlier.focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press('Enter');
    await expect(timer).toHaveAttribute('data-state', 'over');
    await expect(timer.locator('[data-timer-clock]')).toHaveText(/^7:\d\d$/);
    await expect(earlier).toBeFocused();
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
    await expect(page.locator('#sheet')).toBeHidden();
  });

  test('a double tap never lands on the button that replaced the one tapped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);

    // SOS sits where the card's Close does: the second tap must not close it.
    await page.locator('.sos-btn').dblclick();
    const card = page.locator('#emergency[data-open="true"]');
    await expect(card).toBeVisible();

    // Start, twice: "It stopped" comes up under the finger.
    const timer = card.locator('.em-timer');
    await card.getByRole('button', { name: 'Start timer' }).dblclick();
    await expect(timer).toHaveAttribute('data-state', 'running');

    // "It stopped", twice: "Log this seizure" comes up under the finger.
    await settled(page);
    await card.getByRole('button', { name: 'It stopped' }).dblclick();
    await expect(timer).toHaveAttribute('data-state', 'stopped');
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
    await expect(page.locator('#sheet')).toBeHidden();
  });

  test('a short seizure ends calmly, and the timer works with storage blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() { throw new DOMException('blocked', 'SecurityError'); },
      });
    });
    await withExampleData(page);
    const card = await openEmergency(page);
    const timer = card.locator('.em-timer');
    await card.getByRole('button', { name: 'Start timer' }).click();
    await expect(timer).toHaveAttribute('data-state', 'running');
    await card.getByRole('button', { name: '+1 min — it began earlier' }).click();
    await expect(timer.locator('[data-timer-clock]')).toHaveText(/^1:\d\d$/);
    await settled(page);
    await card.getByRole('button', { name: 'It stopped' }).click();
    await expect(timer).toHaveAttribute('data-state', 'stopped');
    await expect(timer.getByRole('link', { name: /Call 911/ })).toHaveCount(0);
    await expect(timer.getByRole('button', { name: 'Log this seizure' })).toBeFocused();
  });

  test('the card covers wandering seizures, rescue plans and every reason to call 911', async ({ page }) => {
    await page.goto('/synara.html');
    await page.getByRole('button', { name: 'Set it up for me' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Go to Synara' }).click();
    await expect(page.locator('#welcome')).toBeHidden();

    await openEmergency(page);
    const todo = block(page, 'What to do right now');
    await expect(todo).toContainText('help them down to the floor');
    await expect(todo).toContainText('confused or wandering');
    await expect(todo).toContainText('seizure action plan');
    const ems = block(page, 'Call 911 if');
    for (const reason of ['longer than 5 minutes', 'different from their usual', 'pregnant', 'Rescue medicine was given']) {
      await expect(ems).toContainText(reason);
    }
    // EF and CDC: nothing in their mouth, with no exception. Rescue medicine
    // is the action plan's step, not a bystander's reading of "Do NOT".
    const doNot = block(page, 'Do NOT');
    await expect(doNot).toContainText('Do NOT put anything in their mouth. They cannot swallow their tongue.');
    await expect(doNot).not.toContainText('exception');
  });

  test('a card that got the "only exception" wording, untouched, goes back to the plain line', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('synara.v2')) return;
      localStorage.setItem('synara.v2', JSON.stringify({
        v: 3, meds: [], doses: {}, seizures: [], checkins: {}, contacts: [],
        card: {
          doNot: [
            'Do NOT put anything in their mouth — they cannot swallow their tongue. Rescue medicine from their seizure plan is the only exception.',
            'Do NOT hold them down or try to stop the movements.',
            'Do NOT give food, drink, or pills until they are fully awake.',
            'Do NOT crowd them — ask other people to step back.',
          ],
        },
      }));
    });
    await page.goto('/synara.html#/safety');
    await page.locator('.sos-btn').click();
    const doNot = block(page, 'Do NOT');
    await expect(doNot).toContainText('Do NOT put anything in their mouth. They cannot swallow their tongue.');
    await expect(doNot).not.toContainText('exception');
  });

  test('a card made before these steps existed gets them, unless it was edited', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('synara.v2')) return;
      localStorage.setItem('synara.v2', JSON.stringify({
        v: 3, meds: [], doses: {}, seizures: [], checkins: {}, contacts: [],
        card: {
          during: [
            'Stay with them and start timing the seizure.',
            'Move anything hard or sharp out of the way.',
            'Put something soft under their head.',
            'Loosen anything tight around their neck.',
            'If they are not aware or not awake, gently turn them onto their side.',
            'Stay calm and speak normally — they may be able to hear you.',
          ],
          callEms: ['Call Mom, then 911 if it lasts 5 minutes.'],
        },
      }));
    });
    await page.goto('/synara.html#/safety');
    await expect(page.locator('section[aria-labelledby="sec-during"]')).toContainText('confused or wandering');
    await expect(page.locator('.ems-card')).toHaveText(/Call Mom, then 911/);
  });

  test('clearing "Call 911 if" brings the standard steps back instead of dropping them', async ({ page }) => {
    await withExampleData(page);
    await page.locator('.tab[data-to="safety"]').click();
    await page.getByRole('button', { name: 'Edit when to call 911' }).click();
    await expect(page.locator('.sheet .hint')).toContainText('Clear it all to go back to the standard steps');
    await page.locator('#card-text').fill('');
    await page.locator('.sheet [data-action="card-save"]').click();
    await expect(page.locator('#toast')).toContainText('standard steps are back');
    await expect(page.locator('.ems-card')).toContainText('The seizure lasts longer than 5 minutes.');

    const card = await openEmergency(page);
    await expect(card.locator('.em-block h3')).toContainText(['What to do right now', 'Call 911 if', 'Do NOT']);
  });

  test('every contact shows a number to read, and an extension dials after a pause', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);
    await page.locator('.tab[data-to="safety"]').click();

    // On a phone the "First call" pill used to squeeze this to "Mom · (5…".
    const first = page.locator('.contact-row', { hasText: 'Dana Ellison' }).locator('.contact-ph');
    await expect(first).toHaveText('(555) 014-2007');
    expect(await first.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right <= el.closest('.contact-main')!.getBoundingClientRect().right + 1;
    }), 'the number runs past its row').toBe(true);

    await page.getByRole('button', { name: 'Edit Nurse Ruiz' }).click();
    await page.locator('#c-phone').fill('(555) 018-8300 ext. 214');
    await page.locator('.sheet-foot [data-action="contact-save"]').click();
    await expect(page.getByRole('link', { name: 'Call Nurse Ruiz' })).toHaveAttribute('href', 'tel:5550188300,214');

    // A teacher on a laptop can't dial from the page, so the numbers are on it.
    await openEmergency(page);
    const others = block(page, 'Other contacts');
    await expect(others).toContainText('Dad · (555) 014-2019');
    await expect(others).toContainText('School nurse · (555) 018-8300 ext. 214');
  });

  test('rescue medication and blood type reach the emergency card and the printed card', async ({ page }) => {
    await withExampleData(page);
    await page.locator('.tab[data-to="you"]').click();
    await page.getByRole('button', { name: 'Edit your details' }).click();
    await page.getByLabel('Rescue medication').fill('Midazolam nasal spray, one spray at 5 minutes. Nurse’s office, top drawer.');
    await page.locator('.sheet-foot [data-action="profile-save"]').click();

    const card = await openEmergency(page);
    const rescue = block(page, 'Rescue medication');
    await expect(rescue).toContainText('Midazolam nasal spray');
    await expect(rescue).toContainText('Only give it if you are trained to');
    await expect(block(page, 'Medical details')).toContainText('O+');
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();

    await page.locator('.tab[data-to="safety"]').click();
    await page.evaluate(() => { window.print = () => {}; });
    await page.getByRole('button', { name: 'Print for school' }).click();
    const pc = page.locator('#print-card .pc');
    await expect(pc.locator('.pc-rescue')).toContainText('Midazolam nasal spray');
    await expect(pc.locator('.pc-facts')).toContainText('O+');
    await expect(pc.locator('.pc-sub')).toHaveText('she/her · 11th grade · Rosewood High School');
    // Who to call comes before the steps, so it is never pushed onto page two.
    expect(await pc.locator('h2').allTextContents()).toEqual([
      'Who to call', 'Rescue medication', 'What their seizures look like',
      'What to do', 'Afterwards', 'Do NOT', 'Call 911 if',
    ]);
    await expect(pc.locator('.pc-contacts tr').first()).toContainText('Dana Ellison');
    await expect(pc.locator('.pc-foot')).toContainText(`${new Date().getFullYear()}`);
  });

  test('the example card prints on one page, dated, with "confirm with their neurologist" at the top', async ({ page }) => {
    await withExampleData(page);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    const head = page.locator('#print-card .pc-head');
    await expect(head).toContainText(`Printed`);
    await expect(head).toContainText(`${new Date().getFullYear()}`);
    await expect(head).toContainText('confirm with the student\'s neurologist');
    for (const format of ['Letter', 'A4'] as const) {
      const pdf = (await page.pdf({ format })).toString('latin1');
      const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
      expect(pages, `${format}: the example card runs onto a second page`).toBe(1);
    }
  });

  test('printing from the browser menu prints the current card, numbered and dark on white', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await withExampleData(page);
    await page.locator('.tab[data-to="safety"]').click();
    await page.getByRole('button', { name: 'Edit For teachers' }).click();
    await page.locator('#card-text').fill('Send a student for Nurse Ruiz. Keep the class calm.');
    await page.locator('.sheet [data-action="card-save"]').click();

    // Ctrl+P never presses the button: the card must already be there, current.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    const pc = page.locator('#print-card .pc');
    await expect(pc).toBeVisible();
    await expect(pc.locator('.pc-roles')).toContainText('Send a student for Nurse Ruiz');
    const look = await pc.evaluate((el) => ({
      steps: getComputedStyle(el.querySelector('ol:not(.pc-not):not(.pc-if)')!).listStyleType,
      name: getComputedStyle(el.querySelector('.pc-name')!).color,
      heading: getComputedStyle(el.querySelector('h2')!).color,
    }));
    expect(look).toEqual({ steps: 'decimal', name: 'rgb(17, 17, 17)', heading: 'rgb(17, 17, 17)' });
  });

  test('#/sos on a device that has never run Synara shows the card first, then the welcome', async ({ page }) => {
    await page.goto('/synara.html#/sos');
    const card = page.locator('#emergency[data-open="true"]');
    await expect(card).toBeVisible();
    await expect(page.locator('#welcome')).toBeHidden();
    await expect(card.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
    await expect(block(page, 'What to do right now')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBeNull();

    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set it up for me' })).toBeVisible();

    // Closed by accident: the welcome leads back, by its button or Escape,
    // and until the intro is done a reload brings the card back too.
    await expect(page).toHaveURL(/#\/sos$/);
    await page.keyboard.press('Escape');
    await expect(card).toBeVisible();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await page.getByRole('button', { name: 'Back to the emergency card' }).click();
    await expect(card).toBeVisible();
    await page.reload();
    await expect(card).toBeVisible();
    await expect(page.locator('#welcome')).toBeHidden();

    // Once there is a record, #/sos is just the Safety tab again.
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await page.getByRole('button', { name: 'Look around with example data' }).click();
    await expect(page).toHaveURL(/#\/safety$/);
  });

  test('on a fresh device the welcome waits while the timer runs, and never puts up the example card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/synara.html#/sos');
    const card = page.locator('#emergency[data-open="true"]');
    const timer = card.locator('.em-timer');
    await card.getByRole('button', { name: 'Start timer' }).click();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();

    // Not the welcome: the app, with the timer's banner to get back.
    await expect(page.locator('#welcome')).toBeHidden();
    const banner = page.locator('.timer-banner');
    await expect(banner).toBeVisible();

    // A reload mid-seizure lands on the card, still counting.
    await page.reload();
    await expect(card).toBeVisible();
    await expect(timer).toHaveAttribute('data-state', 'running');

    // Stopped and not logged yet: still no welcome.
    await settled(page);
    await card.getByRole('button', { name: 'It stopped' }).click();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.locator('#welcome')).toBeHidden();

    // Reset, and the card closed: now the welcome.
    await page.locator('.sos-btn').click();
    await settled(page);
    await card.getByRole('button', { name: 'Reset timer' }).click();
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.locator('#welcome')).toBeVisible();
  });

  test('a seizure logged from the card on a fresh device is kept, and the welcome never wipes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/synara.html#/sos');
    const card = page.locator('#emergency[data-open="true"]');
    await card.getByRole('button', { name: 'Start timer' }).click();
    await settled(page);
    await card.getByRole('button', { name: 'It stopped' }).click();
    await settled(page);
    await card.getByRole('button', { name: 'Log this seizure' }).click();
    await page.locator('.sheet-foot .btn-primary').click();
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('#welcome')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('synara.v2') || '{}'));
    expect(saved.seizures).toHaveLength(1);
    await expect(page).toHaveURL(/#\/safety$/);
  });

  test('the welcome on a fresh device has its own way to the emergency card', async ({ page }) => {
    await page.goto('/synara.html');
    await page.locator('#welcome').getByRole('button', { name: 'Open emergency card' }).click();
    const card = page.locator('#emergency[data-open="true"]');
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
    await settled(page);
    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.getByRole('button', { name: 'Set it up for me' })).toBeVisible();
  });

  test('a rescue plan of several sentences is kept whole, and one too long is refused, not cut', async ({ page }) => {
    await withExampleData(page);
    await page.locator('.tab[data-to="you"]').click();
    const plan = 'Valtoco (diazepam nasal spray) 10 mg: one spray in one nostril if a seizure lasts 5 minutes or longer, ' +
      'or 3 or more seizures within 1 hour. Do NOT give a second dose unless at least 4 hours have passed. ' +
      'Call 911 after giving it. Kept in the nurse\'s office, top drawer.';
    expect(plan.length).toBeGreaterThan(200);
    await page.getByRole('button', { name: 'Edit your details' }).click();
    const box = page.getByLabel('Rescue medication');
    await box.fill(plan);
    await expect(page.locator('[data-rescue-count]')).toHaveText(`${plan.length} of 600 characters`);
    await page.locator('.sheet-foot [data-action="profile-save"]').click();
    await expect(page.locator('#sheet')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('synara.v2')!).profile.rescueMed)).toBe(plan);
    await page.locator('.sos-btn').click();
    await expect(block(page, 'Rescue medication')).toContainText('Call 911 after giving it. Kept in the nurse\'s office, top drawer.');
    await settled(page);
    await page.locator('#emergency [data-action="close-emergency"]').click();

    await page.getByRole('button', { name: 'Edit your details' }).click();
    await box.fill(plan.repeat(3));
    await expect(page.locator('[data-rescue-count]')).toContainText('too many to save');
    await page.locator('.sheet-foot [data-action="profile-save"]').click();
    await expect(page.locator('#toast')).toContainText('too long to save');
    await expect(page.locator('#sheet[data-open="true"]')).toBeVisible();
    await expect(box).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('synara.v2')!).profile.rescueMed)).toBe(plan);
  });
});
