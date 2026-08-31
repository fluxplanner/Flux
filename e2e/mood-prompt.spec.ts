import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The twice-daily mood check-in.
 *
 * Two things matter here and both are easy to get wrong.
 *
 * 1. It must not nag. Each window resolves at most once a day and dismissing
 *    counts as resolving, so the ceiling is two cards a day. A regression that
 *    re-asks after a dismissal would be the most annoying bug in the app, and
 *    it would only surface for real users the following morning.
 *
 * 2. A one-tap mood must MERGE into the day's record. The Mood tab writes
 *    mood + stress + sleep together; the prompt writes only a mood. Before the
 *    fluxPersistMood refactor the write replaced the whole entry, so tapping a
 *    face would have wiped the sleep and stress already logged that day.
 */

async function gotoApp(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav?.('dashboard'));
  await page.waitForTimeout(600);
  // Clean slate, and no card left over from the install timer.
  await page.evaluate(() => {
    (window as any).save('flux_mood_prompt_v1', {});
    (window as any).FluxMoodPrompt.close();
  });
}

/** Force a window open regardless of the wall-clock hour the suite runs at. */
async function showWindow(page: import('@playwright/test').Page, which: 'AM' | 'PM') {
  return page.evaluate((w) => {
    const M = (window as any).FluxMoodPrompt;
    M._show(M._windows[w]);
  }, which);
}

test.describe('Mood check-in prompt', () => {
  test('offers a one-tap check-in with a way out', async ({ page }) => {
    await gotoApp(page);
    await showWindow(page, 'AM');

    const res = await page.evaluate(() => {
      const card = document.getElementById('fluxMoodPrompt')!;
      return {
        title: card.querySelector('.fmp-title')!.textContent,
        ask: card.querySelector('.fmp-ask')!.textContent,
        faces: [...card.querySelectorAll('.fmp-face')].map((b) => b.getAttribute('data-v')),
        hasDismiss: !!card.querySelector('[data-fmp="later"]'),
        hasFullForm: !!card.querySelector('[data-fmp="full"]'),
      };
    });

    expect(res.title).toBe('Morning check-in');
    expect(res.ask).toBe('How are you starting today?');
    expect(res.faces).toEqual(['1', '2', '3', '4', '5']);
    // Both escape hatches matter: something that appears twice a day must be
    // dismissible, and must not trap you in the short version.
    expect(res.hasDismiss).toBe(true);
    expect(res.hasFullForm).toBe(true);
  });

  test('a one-tap mood merges into the day rather than replacing it', async ({ page }) => {
    await gotoApp(page);

    const res = await page.evaluate(async () => {
      const p = (n: number) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      // A full check-in already logged today, the way the Mood tab writes it.
      (window as any).fluxPersistMood({ mood: 5, stress: 7, sleep: 6.5 });
      const before = (window as any).moodHistory.find((m: any) => m.date === today);

      const M = (window as any).FluxMoodPrompt;
      M._show(M._windows.AM);
      document.querySelector<HTMLElement>('#fluxMoodPrompt .fmp-face[data-v="2"]')!.click();
      await new Promise((r) => setTimeout(r, 300));

      const after = (window as any).moodHistory.find((m: any) => m.date === today);
      return { before, after, closed: !document.getElementById('fluxMoodPrompt') };
    });

    expect(res.after.mood).toBe(2);
    // The whole point of the refactor: these must survive.
    expect(res.after.stress).toBe(res.before.stress);
    expect(res.after.sleep).toBe(res.before.sleep);
    // And the reading is attributed to the window it came from.
    expect(res.after.moodAm).toBe(2);
    expect(res.closed).toBe(true);
  });

  test('never asks the same window twice in a day — answered or dismissed', async ({ page }) => {
    await gotoApp(page);

    const res = await page.evaluate(async () => {
      const M = (window as any).FluxMoodPrompt;
      const out: Record<string, boolean> = {};

      // Answered.
      M._show(M._windows.AM);
      document.querySelector<HTMLElement>('#fluxMoodPrompt .fmp-face[data-v="4"]')!.click();
      await new Promise((r) => setTimeout(r, 250));
      M.check();
      await new Promise((r) => setTimeout(r, 250));
      out.answeredDoesNotReask = !document.getElementById('fluxMoodPrompt');

      // Dismissed.
      (window as any).save('flux_mood_prompt_v1', {});
      M._show(M._windows.AM);
      document.querySelector<HTMLElement>('#fluxMoodPrompt [data-fmp="later"]')!.click();
      await new Promise((r) => setTimeout(r, 250));
      out.dismissClosed = !document.getElementById('fluxMoodPrompt');
      M.check();
      await new Promise((r) => setTimeout(r, 250));
      out.dismissedDoesNotReask = !document.getElementById('fluxMoodPrompt');

      // Escape counts as dismissing.
      (window as any).save('flux_mood_prompt_v1', {});
      M._show(M._windows.AM);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      M.check();
      await new Promise((r) => setTimeout(r, 250));
      out.escapedDoesNotReask = !document.getElementById('fluxMoodPrompt');
      return out;
    });

    expect(res.answeredDoesNotReask).toBe(true);
    expect(res.dismissClosed).toBe(true);
    expect(res.dismissedDoesNotReask).toBe(true);
    expect(res.escapedDoesNotReask).toBe(true);
  });

  test('morning and evening are tracked separately', async ({ page }) => {
    await gotoApp(page);

    const res = await page.evaluate(async () => {
      const M = (window as any).FluxMoodPrompt;
      M._show(M._windows.AM);
      document.querySelector<HTMLElement>('#fluxMoodPrompt .fmp-face[data-v="3"]')!.click();
      await new Promise((r) => setTimeout(r, 250));
      const afterAm = M._state();
      // Evening is still unresolved, so it can ask later the same day — but
      // not in the same breath. Answering anything buys a minute of quiet,
      // so the evening card must be refused right now...
      const pmQuietRightAfter = M._shouldAsk(M._windows.PM);
      // ...and offered once that minute has passed. Rewinding the stamp is how
      // real time would arrive, without making the test sleep through it.
      (window as any).save('flux_mood_prompt_v1', { ...afterAm, at: Date.now() - 120000 });
      const pmStillOpen = M._shouldAsk(M._windows.PM);
      M._show(M._windows.PM);
      const pmTitle = document.querySelector('.fmp-title')!.textContent;
      const pmAsk = document.querySelector('.fmp-ask')!.textContent;
      document.querySelector<HTMLElement>('#fluxMoodPrompt .fmp-face[data-v="5"]')!.click();
      await new Promise((r) => setTimeout(r, 250));
      const p = (n: number) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const entry = (window as any).moodHistory.find((m: any) => m.date === today);
      return { afterAm, pmQuietRightAfter, pmStillOpen, pmTitle, pmAsk, afterPm: M._state(), entry };
    });

    expect(res.afterAm.am).toBeTruthy();
    expect(res.afterAm.pm).toBeFalsy();
    expect(res.pmQuietRightAfter).toBe(false);
    expect(res.pmStillOpen).toBe(true);
    expect(res.pmTitle).toBe('Evening check-in');
    expect(res.pmAsk).toBe('How did today go?');
    expect(res.afterPm.pm).toBeTruthy();
    // Both readings survive on the record; the headline mood is the latest.
    expect(res.entry.moodAm).toBe(3);
    expect(res.entry.moodPm).toBe(5);
    expect(res.entry.mood).toBe(5);
  });

  test('stays quiet on the Mood tab, where the real form already is', async ({ page }) => {
    await gotoApp(page);

    const res = await page.evaluate(async () => {
      const M = (window as any).FluxMoodPrompt;
      (window as any).nav('mood');
      await new Promise((r) => setTimeout(r, 700));
      const onMood = M._shouldAsk(M._windows.AM);
      (window as any).nav('dashboard');
      await new Promise((r) => setTimeout(r, 700));
      const elsewhere = M._shouldAsk(M._windows.AM);
      return { onMood, elsewhere };
    });

    expect(res.onMood).toBe(false);
    expect(res.elsewhere).toBe(true);
  });

  test('the full-form link resolves the window and navigates', async ({ page }) => {
    await gotoApp(page);
    await showWindow(page, 'AM');

    const res = await page.evaluate(async () => {
      const M = (window as any).FluxMoodPrompt;
      document.querySelector<HTMLElement>('#fluxMoodPrompt [data-fmp="full"]')!.click();
      await new Promise((r) => setTimeout(r, 800));
      return {
        closed: !document.getElementById('fluxMoodPrompt'),
        onMoodTab: !!document.getElementById('mood')?.classList.contains('active'),
        resolved: !!M._state().am,
      };
    });

    expect(res.closed).toBe(true);
    expect(res.onMoodTab).toBe(true);
    // Being asked again the moment you arrive at the full form would be absurd.
    expect(res.resolved).toBe(true);
  });

  test('the Mood tab check-in still works after the shared-persist refactor', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('mood'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(async () => {
      (window as any).save('flux_mood_today', 5);
      (document.getElementById('stressSlider') as HTMLInputElement).value = '8';
      (document.getElementById('sleepHours') as HTMLInputElement).value = '5';
      (window as any).saveMoodEntry();
      await new Promise((r) => setTimeout(r, 300));
      const p = (n: number) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const entry = (window as any).moodHistory.find((m: any) => m.date === today);
      const burnout = document.getElementById('burnoutAlert') as HTMLElement | null;
      return { entry, burnoutShown: burnout ? burnout.style.display : null };
    });

    expect(res.entry.mood).toBe(5);
    expect(res.entry.stress).toBe(8);
    expect(res.entry.sleep).toBe(5);
    // High stress + low sleep still raises the burnout notice.
    expect(res.burnoutShown).toBe('block');
  });
});
