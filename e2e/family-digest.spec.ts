import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C6 — Family Digest happy path (client contract).
 *
 * The weekly cron (family-digest edge function) runs server-side; RLS on
 * flux_family_digests is covered by RLS_AUDIT §15 probes. Here we pin the
 * student-facing consent surface: digest controls render per ACTIVE link
 * only when the flag is on, defaults are conservative, and the copy is
 * honest about what's shared.
 */

const CONTROLS_HTML_PROBE = async (page: import('@playwright/test').Page, flagOn: boolean) => {
  return page.evaluate(async (on) => {
    const w = window as any;
    w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_family_digest: on, enable_parent_portal: true };
    await w.FluxFeatureFlags.load({ force: true });
    const host = document.createElement('div');
    host.id = 'fdTestHost';
    document.body.appendChild(host);
    const inv = { link_id: 'link-1', invite_code: 'ABCD1234', status: 'active', visibility_tier: 'basic' };
    const html = w.FluxParentPortal?._digestControlsHtml
      ? w.FluxParentPortal._digestControlsHtml(inv, null)
      : '';
    host.innerHTML = html;
    return html;
  }, flagOn);
};

test.describe('Family digest (client contract)', () => {
  test('flag on: controls render with conservative defaults and honest copy', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const html = await CONTROLS_HTML_PROBE(page, true);
    expect(html).toContain('Weekly family digest');
    const host = page.locator('#fdTestHost');
    // Opt-in defaults OFF (consent-first).
    await expect(host.locator('[data-dg-opt]')).not.toBeChecked();
    // Conservative default categories: wins + upcoming, both visible/checked.
    await expect(host.locator('[data-dg-cat="wins"]')).toBeChecked();
    await expect(host.locator('[data-dg-cat="upcoming"]')).toBeChecked();
    // Language choices for the guardian.
    await expect(host.locator('[data-dg-lang] option')).toHaveCount(3);
    // Honest, calm copy — grades never included, revocable anytime.
    await expect(host).toContainText('Never includes grades');
    await expect(host).toContainText('You can stop this anytime');
  });

  test('flag off: no digest controls in the family-sharing UI', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const html = await CONTROLS_HTML_PROBE(page, false);
    expect(html).toBe('');
  });

  test('pending links never show digest controls (active links only)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const html = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_family_digest: true, enable_parent_portal: true };
      await w.FluxFeatureFlags.load({ force: true });
      return w.FluxParentPortal?._digestControlsHtml
        ? w.FluxParentPortal._digestControlsHtml({ link_id: 'link-2', status: 'pending' }, null)
        : null;
    });
    expect(html).toBe('');
  });
});
