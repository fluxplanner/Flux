import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Owner → one person pop-up messages.
 *
 * The owner could already broadcast to everybody; this is the same pop-up
 * addressed to a single account. The parts worth pinning are the ones that
 * would otherwise fail quietly:
 *
 *   · read_at is stamped, so the message does not reappear on every sign-in.
 *     It lives in the database rather than localStorage precisely so it
 *     survives a device change, which a per-device "seen" flag would not.
 *   · the eyebrow says what kind of message it is. It was hardcoded to
 *     BROADCAST, and a personal note labelled BROADCAST reads like a mistake.
 *   · the broadcast still says BROADCAST — that label was made configurable,
 *     not repurposed, and both existing callers pass no `kind`.
 *
 * The mock Supabase client keeps a real store for this table (seeded through
 * window.__fluxE2EOwnerMessages), so writes are genuinely read back rather
 * than assumed.
 */

// Must match E2E_USER_ID in flux-e2e-harness.js — the harness signs the test
// session in as this account, and RLS in production keys on exactly this id.
const E2E_USER = '00000000-0000-4000-8000-0000000000e2';

test.describe('Owner direct messages', () => {
  test('an unread message pops up, and is not shown twice', async ({ page }) => {
    await page.addInitScript((uid: string) => {
      (window as unknown as Record<string, unknown>).__fluxE2EOwnerMessages = [{
        id: 'e2e-dm-1',
        recipient_id: uid,
        title: 'Quick note',
        body: 'Nice work on the recital last night.',
        created_at: '2026-09-04T12:00:00Z',
        created_by: 'owner@example.com',
        read_at: null,
      }];
    }, E2E_USER);

    await gotoScenario(page, 'teacher-workflow');

    const popup = page.locator('#fluxBroadcastPopup');
    await expect(popup).toBeVisible({ timeout: 8000 });
    await expect(popup).toContainText('Quick note');
    await expect(popup).toContainText('Nice work on the recital last night.');
    // Not "BROADCAST" — this one is addressed to them.
    await expect(popup).toContainText('MESSAGE FOR YOU');

    // Stamped as delivered, in the store rather than on the device.
    const readAt = await page.evaluate(
      () => (window as unknown as { __fluxE2EOwnerMessages: Array<{ read_at: string | null }> })
        .__fluxE2EOwnerMessages[0].read_at,
    );
    expect(readAt).toBeTruthy();

    // Dismiss, ask again, and it must not come back.
    await popup.locator('#fluxBroadcastClose').click();
    await expect(popup).toHaveCount(0);
    const shown = await page.evaluate(() =>
      (window as unknown as { FluxOwnerMessages: { checkInbox: (f: boolean) => Promise<number> } })
        .FluxOwnerMessages.checkInbox(true),
    );
    expect(shown).toBe(0);
  });

  test('a message for somebody else never arrives', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__fluxE2EOwnerMessages = [{
        id: 'e2e-dm-2',
        recipient_id: 'some-other-account',
        title: 'Not for you',
        body: 'Private.',
        created_at: '2026-09-04T12:00:00Z',
        read_at: null,
      }];
    });
    await gotoScenario(page, 'teacher-workflow');
    await page.waitForTimeout(2000);
    await expect(page.locator('#fluxBroadcastPopup')).toHaveCount(0);
  });

  test('sending writes a row addressed to the person picked', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    const ok = await page.evaluate(() =>
      (window as unknown as { FluxOwnerMessages: { send: (r: string, t: string, b: string) => Promise<boolean> } })
        .FluxOwnerMessages.send('someone-123', 'Well done', 'Great effort this term.'),
    );
    expect(ok).toBe(true);

    const row = await page.evaluate(() =>
      (window as unknown as { __fluxE2EOwnerMessages: Array<Record<string, unknown>> })
        .__fluxE2EOwnerMessages[0]);
    expect(row.recipient_id).toBe('someone-123');
    expect(row.title).toBe('Well done');
    expect(row.body).toBe('Great effort this term.');
    // Unread until the recipient actually sees it.
    expect(row.read_at).toBeNull();
  });

  test('an empty message is refused rather than sent blank', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    const res = await page.evaluate(async () => {
      const M = (window as unknown as {
        FluxOwnerMessages: { send: (r: string, t: string, b: string) => Promise<boolean> };
      }).FluxOwnerMessages;
      return {
        noBody: await M.send('someone-123', 'Title', '   '),
        noRecipient: await M.send('', 'Title', 'Body'),
        rows: ((window as unknown as { __fluxE2EOwnerMessages?: unknown[] }).__fluxE2EOwnerMessages || []).length,
      };
    });
    expect(res.noBody).toBe(false);
    expect(res.noRecipient).toBe(false);
    expect(res.rows).toBe(0);
  });

  test('the broadcast pop-up still says BROADCAST', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    // The label became configurable; the existing callers pass no `kind`, so
    // their wording must be untouched.
    await page.evaluate(() =>
      (window as unknown as { fluxShowSignInPopup: (o: Record<string, string>) => void })
        .fluxShowSignInPopup({ title: 'Everyone', body: 'Hello all' }),
    );
    const popup = page.locator('#fluxBroadcastPopup');
    await expect(popup).toContainText('BROADCAST');
    await expect(popup).not.toContainText('MESSAGE FOR YOU');
  });
});
