import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C9 — Seasons happy path: focus sessions earn XP through the real
 * FluxBus event, unlocks land in the Settings card, applying an unlocked
 * accent changes the CSS var, locked cosmetics can't be applied, and
 * flag-off is fully inert.
 */

test.describe('Seasons & streak cosmetics', () => {
  test('session_ended earns XP behind the flag; flag off is inert', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      // Flag off: bus event must not touch the store.
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_seasons: false };
      await w.FluxFeatureFlags.load({ force: true });
      w.FluxBus.emit('session_ended', { mins: 25 });
      const off = w.load(w.FluxSeasons._key, null);
      // Flag on: same event earns.
      w.FLUX_EXPERIMENTS.enable_seasons = true;
      await w.FluxFeatureFlags.load({ force: true });
      w.FluxBus.emit('session_ended', { mins: 25 });
      const on = w.load(w.FluxSeasons._key, null);
      return { off, on };
    });
    expect(r.off).toBeNull();
    expect(r.on.xp).toBe(10);
    expect(r.on.streak).toBe(1);
  });

  test('settings card shows streak, locked and unlocked cosmetics', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_seasons: true };
      await w.FluxFeatureFlags.load({ force: true });
      const season = w.FluxSeasons.seasonOf(w.todayStr());
      const first = w.FluxSeasons.SEASONS[season][0];
      w.save(w.FluxSeasons._key, { xp: 30, streak: 4, lastDay: w.todayStr(), earnedToday: {}, unlocks: [first.id] });
      w.nav('settings');
      w.FluxSeasons.injectSettingsCard();
    });
    const card = page.locator('#fluxSeasonsCard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Streak: 4 days');
    await expect(card).toContainText('Rest days never break your streak');
    await expect(card).toContainText('Never tied to grades');
    await expect(card.locator('[data-season-apply]')).toHaveCount(1); // one unlocked
    // Locked cosmetics render as dashed, non-clickable spans with their XP
    // threshold. (The emoji itself gets swapped to an SVG by the iconify
    // walker, so assert structure + threshold text, not the glyph.)
    await expect(card.locator('span[style*="dashed"]')).toHaveCount(3);
    await expect(card).toContainText('· 60');
  });

  test('applying an unlocked accent changes the CSS var; locked ids are rejected', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_seasons: true };
      await w.FluxFeatureFlags.load({ force: true });
      const season = w.FluxSeasons.seasonOf(w.todayStr());
      const [first, second] = w.FluxSeasons.SEASONS[season];
      w.save(w.FluxSeasons._key, { xp: 30, streak: 1, lastDay: w.todayStr(), earnedToday: {}, unlocks: [first.id] });
      const applied = w.FluxSeasons.applyCosmetic(first.id);
      const accent = document.documentElement.style.getPropertyValue('--accent').trim();
      const lockedRejected = w.FluxSeasons.applyCosmetic(second.id) === false;
      return { applied, accent, expected: first.hex, lockedRejected };
    });
    expect(r.applied).toBe(true);
    expect(r.accent.toLowerCase()).toBe(r.expected.toLowerCase());
    expect(r.lockedRejected).toBe(true);
  });
});
