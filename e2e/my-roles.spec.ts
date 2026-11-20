import { test, expect, type Page } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Settings › Account › Your roles (flux-my-roles.js): someone given a role by
 * the owner can see it, in plain words. The harness answers flux_my_roles()
 * from window.__fluxE2ERpc. The pop-up on being given a role is written by a
 * database trigger and shown by flux-owner-messages.js; that it reaches the
 * person is tested here through the same message table.
 */

const ROLES = [
  { name: 'Aorta <b>partners</b>', color: '#e4776b', permissions: ['app:aorta', 'tab:mood', 'perk:tester'], added_at: '2026-11-08T00:00:00Z' },
  { name: 'Readers', color: 'red;background:url(x)', permissions: [], added_at: '2026-11-08T00:00:00Z' },
];

async function openAccount(page: Page) {
  await openSidebarTab(page, 'settings');
  await page.evaluate(() => (window as unknown as { switchStab: (id: string) => void }).switchStab('account'));
  await expect(page.locator('#spane-account')).toBeVisible();
}

test('someone with roles sees each one and what it allows, as text', async ({ page }) => {
  await page.addInitScript((roles) => {
    (window as unknown as { __fluxE2ERpc: unknown }).__fluxE2ERpc = { flux_my_roles: roles };
  }, ROLES);
  await gotoScenario(page, 'teacher-workflow');
  await openAccount(page);
  const card = page.locator('#fluxMyRolesCard');
  await expect(card).toBeVisible();
  await expect(card.locator('.fx-my-role')).toHaveCount(2);
  await expect(card).toContainText('Aorta <b>partners</b>');
  await expect(card).toContainText('See Aorta Project · See the Mood tab · Tester mode');
  await expect(card).toContainText('Nothing switched on yet');
  // A colour that is not a plain #rrggbb never reaches the style attribute.
  expect(await card.locator('span[aria-hidden]').nth(1).getAttribute('style')).toContain('#7c5cff');
});

test('someone without a role sees no roles card', async ({ page }) => {
  await gotoScenario(page, 'teacher-workflow');
  await openAccount(page);
  await expect(page.locator('#fluxMyRolesCard')).toBeHidden();
});

test('the new-role message pops up after sign-in', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __fluxE2EOwnerMessages: unknown[] }).__fluxE2EOwnerMessages = [{
      id: 'm1', recipient_id: '00000000-0000-4000-8000-0000000000e2', title: 'You have a new role: Testers',
      body: 'The Flux owner gave you the "Testers" role. See what it lets you do in Settings › Account › Your roles.',
      created_at: '2026-11-08T00:00:00Z', created_by: 'roles', read_at: null,
    }];
  });
  await gotoScenario(page, 'teacher-workflow');
  await expect(page.locator('#fluxBroadcastPopup')).toContainText('You have a new role: Testers', { timeout: 10_000 });
});
