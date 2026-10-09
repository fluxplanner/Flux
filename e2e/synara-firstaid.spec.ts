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
    await expect(timer.getByRole('link', { name: 'Call 911 now' })).toHaveAttribute('href', 'tel:911');
    await expect(earlier).toHaveCount(0);

    // It ending doesn't make it safe: 5 minutes or more still needs 911.
    await card.getByRole('button', { name: 'It stopped' }).click();
    await expect(timer).toHaveAttribute('data-state', 'over');
    await expect(timer.locator('[data-timer-hint]')).toContainText('call 911 if no one has yet');
    await expect(timer.getByRole('link', { name: 'Call 911' })).toHaveAttribute('href', 'tel:911');
    await expect(timer.getByRole('button', { name: 'Log this seizure' })).toBeVisible();
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
    await card.getByRole('button', { name: 'It stopped' }).click();
    await expect(timer).toHaveAttribute('data-state', 'stopped');
    await expect(timer.getByRole('link', { name: /Call 911/ })).toHaveCount(0);
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
    await expect(block(page, 'Do NOT')).toContainText('Rescue medicine from their seizure plan is the only exception');
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

    await card.locator('[data-action="close-emergency"]').click();
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set it up for me' })).toBeVisible();
  });
});
