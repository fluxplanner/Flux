import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * A student pastes their Schoology calendar link and the work appears as tasks.
 * The server function is faked here, and the link is a test value only.
 */

const LINK = 'webcal://school.example.org/calendar/feed.ics?token=test';

function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:hw-1', 'SUMMARY:Schoology Essay', `DTSTART;VALUE=DATE:${day(5)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:quiz-1', 'SUMMARY:Schoology Quiz', `DTSTART;VALUE=DATE:${day(6)}`, 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:off-1', 'SUMMARY:No School', `DTSTART;VALUE=DATE:${day(7)}`, 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

async function openCard(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('canvas'));
  await expect(page.locator('#fluxSchoologyCard')).toBeVisible();
  await page.locator('#fluxSchoologyCard summary').click();
}

const schoologyTasks = (page: Page) => page.evaluate(() =>
  (window as any).tasks.filter((t: any) => t.schoologyUid).map((t: any) => t.name).sort());

test('connecting imports the work, and a second sync adds nothing', async ({ page }) => {
  let sent: any = null;
  await page.route('**/functions/v1/schoology-feed', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ics }) });
  });
  await openCard(page);

  await page.locator('#fluxSchoologyUrl').fill(LINK);
  await page.locator('#fluxSchoologyConnect').click();

  await expect(page.locator('#fluxSchoologySync')).toBeVisible();
  expect(sent).toEqual({ url: LINK });
  expect(await schoologyTasks(page)).toEqual(['Schoology Essay', 'Schoology Quiz']);

  await page.locator('#fluxSchoologySync').click();
  await expect(page.locator('#fluxSchoologyStatus')).toContainText('Last synced');
  expect(await schoologyTasks(page)).toEqual(['Schoology Essay', 'Schoology Quiz']);

  /* The imported work reaches the real task list on screen. */
  await page.evaluate(() => (window as any).nav('dashboard'));
  await expect(page.getByText('Schoology Essay').locator('visible=true').first()).toBeVisible();
  expect(await page.evaluate(() =>
    (window as any).tasks.find((t: any) => t.schoologyUid === 'hw-1').urgencyScore)).toEqual(expect.any(Number));
});

test('a bad link explains itself and is not saved', async ({ page }) => {
  await page.route('**/functions/v1/schoology-feed', (route) => route.fulfill({
    status: 422, contentType: 'application/json',
    body: JSON.stringify({ error: "That link didn't return a calendar. Copy it from Schoology again." }),
  }));
  await openCard(page);

  await page.locator('#fluxSchoologyUrl').fill('https://school.example.org/not-a-calendar');
  await page.locator('#fluxSchoologyConnect').click();

  await expect(page.locator('#fluxSchoologyErr')).toContainText("didn't return a calendar");
  await expect(page.locator('#fluxSchoologyUrl')).toHaveValue('https://school.example.org/not-a-calendar');
  expect(await page.evaluate(() => (window as any).FluxSchoology.isConnected())).toBe(false);
});

test('disconnecting keeps the imported tasks', async ({ page }) => {
  await page.route('**/functions/v1/schoology-feed', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ics }),
  }));
  await openCard(page);
  await page.locator('#fluxSchoologyUrl').fill(LINK);
  await page.locator('#fluxSchoologyConnect').click();
  await expect(page.locator('#fluxSchoologyOff')).toBeVisible();

  await page.locator('#fluxSchoologyOff').click();

  await expect(page.locator('#fluxSchoologyConnect')).toBeAttached();
  expect(await schoologyTasks(page)).toEqual(['Schoology Essay', 'Schoology Quiz']);
});
