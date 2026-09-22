import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The owner is recognised by account id, not by email address.
 *
 * isOwner() used to compare emails, and the owner's email changed when the
 * accounts moved off Google — azfermohammed21@gmail.com became
 * azfer.mohammed@users.fluxplanner.app. From that moment isOwner() returned
 * false and every owner control disappeared: the Admin nav group, the
 * More-sheet slot, the master backlog card, the Owner control panel.
 *
 * Nothing threw, because each of those is written as "show this if owner". An
 * owner who is not recognised looks exactly like a student, which is why it
 * went unnoticed until the controls were missed.
 *
 * The future-rename case matters most here. The account setup prompt lets the
 * owner rename themselves, so a check tied to any particular address is one
 * rename away from breaking again. The id is the only stable thing.
 */

const OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
const OLD_OWNER_EMAIL = 'azfermohammed21@gmail.com';

type Win = {
  currentUser: { id?: string; email?: string };
  isOwner: () => boolean;
  getMyRole: () => string;
  canAccessMasterBacklog?: () => boolean;
  renderSidebars?: () => void;
};

async function asUser(page: import('@playwright/test').Page, id: string, email: string) {
  return page.evaluate(async ([i, e]) => {
    const w = window as unknown as Win;
    w.currentUser.id = i;
    w.currentUser.email = e;
    try { w.renderSidebars?.(); } catch { /* nav rebuild is best-effort */ }
    await new Promise((r) => setTimeout(r, 350));
    const labels = [...document.querySelectorAll('#sidebar .nav-item, .mob-drawer .nav-item')]
      .map((b) => (b.querySelector('.nl')?.textContent || '').trim());
    return {
      isOwner: w.isOwner(),
      role: w.getMyRole(),
      adminNav: labels.some((l) => /owner control|dev panel/i.test(l)),
      backlog: typeof w.canAccessMasterBacklog === 'function' ? w.canAccessMasterBacklog() : null,
    };
  }, [id, email] as [string, string]);
}

test.describe('Owner identity', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await gotoScenario(page, 'teacher-workflow');
    await page.waitForFunction(
      () => typeof (window as unknown as Win).isOwner === 'function'
        && !!(window as unknown as { currentUser?: unknown }).currentUser,
      null, { timeout: 20000 });
  });

  test('the owner keeps their controls after being renamed', async ({ page }) => {
    const r = await asUser(page, OWNER_UID, 'azfer.mohammed@users.fluxplanner.app');
    expect(r.isOwner, 'the renamed owner was not recognised').toBe(true);
    expect(r.role).toBe('owner');
    expect(r.adminNav, 'the Admin nav group is missing').toBe(true);
    expect(r.backlog, 'the master backlog is locked to the owner').toBe(true);
  });

  test('and after any future rename, because the id never moves', async ({ page }) => {
    // The setup prompt lets the owner choose a new name; this must survive it.
    const r = await asUser(page, OWNER_UID, 'something.else.entirely@users.fluxplanner.app');
    expect(r.isOwner, 'a later rename would lock the owner out again').toBe(true);
    expect(r.adminNav).toBe(true);
  });

  test('the old email still works, so a restored backup is not locked out', async ({ page }) => {
    const r = await asUser(page, 'not-the-owner-id', OLD_OWNER_EMAIL);
    expect(r.isOwner, 'the pre-conversion fallback was dropped').toBe(true);
  });

  test('and nobody else is let in', async ({ page }) => {
    const r = await asUser(page, '11111111-2222-3333-4444-555555555555', 'jane.doe@users.fluxplanner.app');
    expect(r.isOwner, 'a student was treated as the owner').toBe(false);
    expect(r.role).toBe('user');
    expect(r.adminNav, 'a student can see the Admin nav group').toBe(false);
    expect(r.backlog, 'a student can reach the master backlog').toBe(false);
  });
});
