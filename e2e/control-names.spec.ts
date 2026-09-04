import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Controls that say what they are.
 *
 * Two faults, found by walking every panel at laptop width and listing every
 * button and link whose accessible name resolved to nothing:
 *
 *  1. The five mood faces under "How are you feeling today?" were *empty*
 *     elements — no text, no innerHTML, no ::before, no ::after. The commit
 *     that moved Flux to monochrome SVG icons deleted their emoji and put
 *     nothing back, and flux-iconify can only swap an emoji it can see. So the
 *     check-in shipped as five identical blank circles: unusable with a screen
 *     reader and unusable with working eyes. Restoring them surfaced a second
 *     fault underneath: 😕 and 😞 both resolve to the `frown` icon, so steps 1
 *     and 2 of a five-point scale drew the same face and the scale only really
 *     offered four. Step 1 is now 😰 (an open-mouthed dismayed face) in all five
 *     places that draw this scale. Adding a shallower frown to the icon set was
 *     tried first and rejected — at the 22px these paint at, a smaller dip is
 *     not a different face. Hence the assertion below is on distinct path data
 *     rather than on any particular icon.
 *
 *  2. Five on/off switches had no name. A `.toggle` is an empty <button> whose
 *     pill and knob are painted in CSS, and the label sitting beside it isn't
 *     associated with it, so they announced as "button" — four in a row in
 *     Notifications, indistinguishable. Two switches in Appearance already
 *     carried aria-label and aria-pressed, so this was the house pattern being
 *     applied unevenly rather than a decision.
 *
 * The sweep is kept general on purpose: it fails on any *new* unnamed control,
 * not just the ones that were wrong.
 */

const PANELS = [
  'dashboard', 'calendar', 'school', 'notes', 'timer', 'canvas',
  'profile', 'goals', 'mood', 'toolbox', 'settings',
];

/* Mirrors how a browser resolves an accessible name, for the cases Flux uses:
   aria-label, aria-labelledby, title, or visible text. Deliberately generous —
   anything it accepts, a screen reader would too. */
function unnamedIn(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel: string) => {
    const root = document.querySelector(sel);
    if (!root) return [`MISSING ROOT ${sel}`];
    const out: string[] = [];
    root.querySelectorAll('button, a[href], [role=button], [role=switch]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const lb = el.getAttribute('aria-labelledby');
      const labelledBy = lb ? document.getElementById(lb)?.textContent?.trim() : '';
      if (el.getAttribute('aria-label') || el.getAttribute('title') || labelledBy || /[A-Za-z0-9]/.test(txt)) return;
      out.push(
        el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') +
          '.' + (el.className || '').toString().trim().split(/\s+/).slice(0, 2).join('.') +
          '  ' + (el.getAttribute('onclick') || '(listener)').slice(0, 40),
      );
    });
    return out;
  }, selector);
}

test.describe('Every control says what it is', () => {
  test('the mood faces are five different faces, each with a name', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('mood'));
    // flux-iconify swaps on a 32ms setTimeout after the mutation, not rAF.
    await page.waitForTimeout(1000);

    const faces = await page.evaluate(() =>
      [...document.querySelectorAll('.mood-btn')].map((b) => ({
        label: b.getAttribute('aria-label') || '',
        // The path data is what makes one face different from the next.
        path: b.querySelector('svg path')?.getAttribute('d') || '',
        painted: (b.textContent || '').trim().length > 0 || !!b.querySelector('svg'),
      })),
    );

    expect(faces).toHaveLength(5);
    for (const f of faces) {
      expect(f.painted, 'a mood button rendered nothing at all').toBe(true);
      expect(f.label).not.toBe('');
    }
    // All five were the same blank circle before; now they must differ.
    expect(new Set(faces.map((f) => f.path)).size).toBe(5);
    expect(new Set(faces.map((f) => f.label)).size).toBe(5);
  });

  test('choosing a mood announces itself as chosen', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('mood'));

    const btns = page.locator('.mood-btn');
    await btns.nth(3).click();
    // The selected face is drawn with a coloured ring — no use to a screen
    // reader unless aria-pressed moves with it.
    expect(await btns.nth(3).getAttribute('aria-pressed')).toBe('true');
    expect(await btns.nth(0).getAttribute('aria-pressed')).toBe('false');

    await btns.nth(0).click();
    expect(await btns.nth(0).getAttribute('aria-pressed')).toBe('true');
    expect(await btns.nth(3).getAttribute('aria-pressed')).toBe('false');
  });

  /* Sits here rather than in its own file because it is the same five buttons
     and the same active/aria-pressed pair: once the faces were visible, the
     fact that a saved check-in still opened with nothing selected stopped
     being invisible and started looking like the save had failed. */
  test('a check-in saved today is still shown as chosen when you come back', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    // The date comes from the app's own todayStr(), not a fresh Date() — a
    // fixture that computes midnight independently drifts past it. Sibling
    // specs went red four times on exactly that.
    await page.evaluate(() => {
      const w = window as unknown as { moodHistory: unknown[]; todayStr: () => string; save: (k: string, v: unknown) => void };
      const entry = { date: w.todayStr(), mood: 2, stress: 3, sleep: 7 };
      w.moodHistory = [entry];
      w.save('flux_mood', [entry]);
    });

    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('mood'));
    const btns = page.locator('.mood-btn');
    await expect(btns.nth(1)).toHaveClass(/active/);
    expect(await btns.nth(1).getAttribute('aria-pressed')).toBe('true');
    // And only that one.
    const active = await page.evaluate(() => document.querySelectorAll('.mood-btn.active').length);
    expect(active).toBe(1);
  });

  test('yesterday\'s check-in does not masquerade as today\'s', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => {
      const w = window as unknown as { moodHistory: unknown[]; todayStr: () => string; save: (k: string, v: unknown) => void };
      // One day back from whatever the app calls today.
      const d = new Date(w.todayStr() + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const entry = { date: y, mood: 5, stress: 3, sleep: 7 };
      w.moodHistory = [entry];
      w.save('flux_mood', [entry]);
    });
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('mood'));
    const active = await page.evaluate(() => document.querySelectorAll('.mood-btn.active').length);
    expect(active).toBe(0);
  });

  test('no unnamed button or link on any panel', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoScenario(page, 'student-semester');

    const bad: string[] = [];
    for (const panel of PANELS) {
      await page.evaluate((p) => (window as unknown as { nav: (t: string) => void }).nav(p), panel);
      await page.waitForTimeout(400);
      for (const f of await unnamedIn(page, 'body')) bad.push(panel + ': ' + f);
    }
    expect(bad, `controls with no accessible name:\n${bad.join('\n')}`).toEqual([]);
  });

  test('no unnamed control in any settings section', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('settings'));
    await page.waitForTimeout(400);

    // Only the active pane is laid out, so each has to be brought forward in
    // turn — the same reason the tap-size sweep in settings-sections.spec.ts
    // walks them one at a time.
    const panes = await page.evaluate(() => [...document.querySelectorAll('.spane')].map((p) => p.id));
    expect(panes.length).toBeGreaterThan(1);

    const bad: string[] = [];
    for (const id of panes) {
      await page.evaluate((pid) => {
        document.querySelectorAll('.spane').forEach((p) => p.classList.remove('active'));
        document.getElementById(pid)?.classList.add('active');
      }, id);
      await page.waitForTimeout(200);
      for (const f of await unnamedIn(page, `#${id}`)) bad.push(id + ': ' + f);
    }
    expect(bad, `settings controls with no accessible name:\n${bad.join('\n')}`).toEqual([]);
  });

  test('the switches report on or off, not just their name', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('settings'));
    await page.evaluate(() => {
      document.querySelectorAll('.spane').forEach((p) => p.classList.remove('active'));
      document.getElementById('spane-notifications')?.classList.add('active');
    });

    const panic = page.locator('#panicToggle');
    const before = await panic.getAttribute('aria-pressed');
    const onBefore = await panic.evaluate((el) => el.classList.contains('on'));
    // The claim and the paint have to agree to begin with.
    expect(before).toBe(String(onBefore));

    await panic.click();
    const after = await panic.getAttribute('aria-pressed');
    const onAfter = await panic.evaluate((el) => el.classList.contains('on'));
    expect(after).toBe(String(onAfter));
    expect(after).not.toBe(before);
  });
});
