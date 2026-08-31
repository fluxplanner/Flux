import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Clock / stopwatch / countdown / alarms, added alongside the Pomodoro timer.
 *
 * The load-bearing property is that none of these count a counter down. They
 * store an absolute epoch timestamp and derive the number on screen from
 * Date.now(), because a background tab is throttled to about one tick per
 * second — and a sleeping laptop to none at all — so a decrementing counter
 * silently loses time and an alarm built on one never rings. Several of these
 * tests assert that specifically, comparing what the module reports against
 * real elapsed wall-clock time rather than against tick counts.
 */

async function gotoTimer(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav?.('timer'));
  await page.waitForTimeout(700);
}

test.describe('Timer tab — time tools', () => {
  test('adds four tools without disturbing the Pomodoro timer', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => ({
      tabs: [...document.querySelectorAll('#fluxTimeTools [data-ftt-view]')]
        .map((b) => (b as HTMLElement).textContent!.trim()),
      focusVisible: (document.getElementById('timerFocusSection') as HTMLElement)?.style.display !== 'none',
      // The existing timer keeps its own markup, ids and handlers.
      pomodoro: {
        display: document.getElementById('tDisplay')?.textContent,
        ring: !!document.getElementById('timerRing'),
        startBtn: !!document.getElementById('timerBtn'),
        modes: [...document.querySelectorAll('#timerFocusSection .tmode-btn')]
          .map((b) => (b as HTMLElement).textContent!.trim()),
      },
    }));

    expect(res.tabs).toEqual(['Focus', 'Clock', 'Stopwatch', 'Countdown', 'Alarms']);
    expect(res.focusVisible, 'Focus must stay the default view').toBe(true);
    expect(res.pomodoro.display).toBe('25:00');
    expect(res.pomodoro.ring).toBe(true);
    expect(res.pomodoro.startBtn).toBe(true);
    expect(res.pomodoro.modes).toEqual(['Pomodoro', 'Short Break', 'Long Break']);
  });

  test('stopwatch measures real elapsed time, not ticks', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('stopwatch');
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-toggle"]')!.click();
      const t0 = Date.now();
      await new Promise((r) => setTimeout(r, 1200));
      // Lap reads through the same Date.now() path the display does.
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-lap"]')!.click();
      const wall = Date.now() - t0;
      return { lap: T._state().stopwatch.laps[0], wall, running: T._state().stopwatch.startedAt > 0 };
    });

    expect(res.running).toBe(true);
    // Within 150ms of true wall-clock time. A tick-counting stopwatch throttled
    // by the browser would drift far outside this.
    expect(Math.abs(res.lap - res.wall)).toBeLessThan(150);
  });

  test('stopwatch pause keeps its total, reset clears it', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('stopwatch');
      const btn = () => document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-toggle"]')!;
      btn().click();
      await new Promise((r) => setTimeout(r, 600));
      btn().click();                                   // pause
      const paused = T._state().stopwatch.accumMs;
      await new Promise((r) => setTimeout(r, 400));    // time passes while paused
      const stillPaused = T._state().stopwatch.accumMs;
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-reset"]')!.click();
      const after = T._state().stopwatch;
      return { paused, stillPaused, afterMs: after.accumMs, afterLaps: after.laps.length };
    });

    expect(res.paused).toBeGreaterThan(400);
    // Paused means paused — the accumulated total must not creep.
    expect(res.stillPaused).toBe(res.paused);
    expect(res.afterMs).toBe(0);
    expect(res.afterLaps).toBe(0);
  });

  test('countdown counts from an absolute end time', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('countdown');
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="cd-preset"][data-mins="5"]')!.click();
      await new Promise((r) => setTimeout(r, 300));
      const cd = T._state().countdown;
      return {
        running: cd.running,
        remaining: cd.endsAt - Date.now(),
        total: cd.totalMs,
        shown: document.getElementById('fttCdDisplay')?.textContent,
        hasBar: !!document.getElementById('fttCdBar'),
      };
    });

    expect(res.running).toBe(true);
    expect(res.total).toBe(300000);
    // Derived from endsAt, so this is true remaining time, not a tick count.
    expect(res.remaining).toBeGreaterThan(298000);
    expect(res.remaining).toBeLessThanOrEqual(300000);
    expect(res.shown).toMatch(/^4:5\d$/);
    expect(res.hasBar).toBe(true);
  });

  test('an alarm that came due while you were away still rings, once', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      const hhmm = (d: Date) =>
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const past = new Date(Date.now() - 90 * 60 * 1000);
      const future = new Date(Date.now() + 90 * 60 * 1000);

      S.alarms.length = 0;
      // Due 90 minutes ago and never fired — the laptop-was-shut case.
      S.alarms.push({ id: 'past', time: hhmm(past), days: [], enabled: true, label: 'Missed', lastFired: '' });
      // Not due for another 90 minutes.
      S.alarms.push({ id: 'future', time: hhmm(future), days: [], enabled: true, label: 'Later', lastFired: '' });

      T._fireDue();
      const a = () => S.alarms.find((x: any) => x.id === 'past');
      const stamp = a().lastFired;
      T._fireDue();                                    // must not ring twice today
      const fut = S.alarms.find((x: any) => x.id === 'future');

      return {
        rang: stamp !== '',
        disarmed: a().enabled === false,               // one-off alarms switch off
        noDoubleFire: a().lastFired === stamp,
        futureUntouched: fut.enabled === true && fut.lastFired === '',
      };
    });

    expect(res.rang).toBe(true);
    expect(res.disarmed).toBe(true);
    expect(res.noDoubleFire).toBe(true);
    expect(res.futureUntouched).toBe(true);
  });

  test('a repeating alarm only rings on its own days', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const hhmm = String(past.getHours()).padStart(2, '0') + ':' + String(past.getMinutes()).padStart(2, '0');
      const today = new Date().getDay();
      const otherDay = (today + 3) % 7;

      S.alarms.length = 0;
      S.alarms.push({ id: 'today', time: hhmm, days: [today], enabled: true, label: '', lastFired: '' });
      S.alarms.push({ id: 'other', time: hhmm, days: [otherDay], enabled: true, label: '', lastFired: '' });
      T._fireDue();

      const t = S.alarms.find((x: any) => x.id === 'today');
      const o = S.alarms.find((x: any) => x.id === 'other');
      return {
        todayRang: t.lastFired !== '',
        otherRang: o.lastFired !== '',
        // Repeating alarms stay armed for next week.
        todayStillEnabled: t.enabled === true,
      };
    });

    expect(res.todayRang).toBe(true);
    expect(res.otherRang).toBe(false);
    expect(res.todayStillEnabled).toBe(true);
  });

  test('adding an alarm for a time already past today does not ring immediately', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      S.alarms.length = 0;
      T.setView('alarms');
      const past = new Date(Date.now() - 60 * 60 * 1000);
      (document.getElementById('fttAlTime') as HTMLInputElement).value =
        String(past.getHours()).padStart(2, '0') + ':' + String(past.getMinutes()).padStart(2, '0');
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="al-add"]')!.click();
      T._fireDue();
      return { added: S.alarms.length, stillEnabled: S.alarms[0].enabled };
    });

    expect(res.added).toBe(1);
    // Stamped as already-fired on save, so an 07:00 alarm set at 09:00 waits for
    // tomorrow instead of going off in your hand.
    expect(res.stillEnabled).toBe(true);
  });

  test('a half-written cloud slice never wipes your alarms', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      T.applyFromCloud({ alarms: [{ id: 'x', time: '07:30', days: [1], enabled: true, label: 'Bus', lastFired: '' }] });
      const after: Record<string, number> = {};
      T.applyFromCloud({});                        // no alarms key
      after.missing = T._state().alarms.length;
      T.applyFromCloud({ alarms: null });           // wrong type
      after.nulled = T._state().alarms.length;
      T.applyFromCloud(null);                       // no record at all
      after.noRecord = T._state().alarms.length;
      T.applyFromCloud({ alarms: [{ nonsense: true }, { time: '08:15' }] });
      after.junk = T._state().alarms.length;
      return after;
    });

    expect(res.missing).toBe(1);
    expect(res.nulled).toBe(1);
    expect(res.noRecord).toBe(1);
    // Entries with no usable time are dropped; the one valid entry survives.
    expect(res.junk).toBe(1);
  });

  test('full screen mirrors the one real timer rather than running a second one', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('focus');
      (window as any).toggleTimer();               // start the real Pomodoro
      await new Promise((r) => setTimeout(r, 400));
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="fs-open"]')!.click();
      await new Promise((r) => setTimeout(r, 400));

      const realBtn = () => document.getElementById('timerBtn')!.textContent!.trim();
      const fsBtn = () => document.getElementById('fttFsToggle')!.textContent!.trim();
      const out: any = {
        opened: !document.getElementById('fttFocusFs')!.hidden,
        bodyLocked: document.body.classList.contains('ftt-fs-on'),
        mirrors: document.getElementById('fttFsTime')!.textContent === document.getElementById('tDisplay')!.textContent,
        labelsAgreeRunning: realBtn() === fsBtn(),
      };

      // Pausing from inside the overlay must drive the real timer, not a copy.
      document.querySelector<HTMLElement>('#fttFocusFs [data-ftt="fs-toggle"]')!.click();
      await new Promise((r) => setTimeout(r, 400));
      out.labelsAgreePaused = realBtn() === fsBtn();
      const frozen = document.getElementById('tDisplay')!.textContent;
      await new Promise((r) => setTimeout(r, 900));
      out.reallyPaused = document.getElementById('tDisplay')!.textContent === frozen;

      document.querySelector<HTMLElement>('#fttFocusFs [data-ftt="fs-reset"]')!.click();
      await new Promise((r) => setTimeout(r, 400));
      out.resetReal = document.getElementById('tDisplay')!.textContent;
      out.resetOverlay = document.getElementById('fttFsTime')!.textContent;
      return out;
    });

    expect(res.opened).toBe(true);
    expect(res.bodyLocked).toBe(true);
    expect(res.mirrors).toBe(true);
    expect(res.labelsAgreeRunning).toBe(true);
    expect(res.labelsAgreePaused).toBe(true);
    // The decisive one: a duplicated timer would keep counting here.
    expect(res.reallyPaused).toBe(true);
    expect(res.resetReal).toBe('25:00');
    expect(res.resetOverlay).toBe('25:00');
  });

  test('full screen covers the viewport and is centred', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.openFocusFullscreen();
      await new Promise((r) => setTimeout(r, 400));
      const fs = document.getElementById('fttFocusFs')!.getBoundingClientRect();
      const inner = document.querySelector('.ftt-fs-inner')!.getBoundingClientRect();
      return {
        covers: Math.round(fs.width) === window.innerWidth && Math.round(fs.height) === window.innerHeight,
        innerCentreX: Math.round(inner.left + inner.width / 2),
        innerCentreY: Math.round(inner.top + inner.height / 2),
        viewCentreX: Math.round(window.innerWidth / 2),
        viewCentreY: Math.round(window.innerHeight / 2),
      };
    });

    expect(res.covers).toBe(true);
    expect(Math.abs(res.innerCentreX - res.viewCentreX)).toBeLessThanOrEqual(1);
    expect(Math.abs(res.innerCentreY - res.viewCentreY)).toBeLessThanOrEqual(1);
  });

  test('Escape and Exit both leave full screen', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      const el = () => document.getElementById('fttFocusFs')!;
      T.openFocusFullscreen();
      await new Promise((r) => setTimeout(r, 300));
      const openedOnce = !el().hidden;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const afterEsc = { hidden: el().hidden, unlocked: !document.body.classList.contains('ftt-fs-on') };

      T.openFocusFullscreen();
      await new Promise((r) => setTimeout(r, 300));
      const openedTwice = !el().hidden;
      document.querySelector<HTMLElement>('#fttFocusFs [data-ftt="fs-exit"]')!.click();
      await new Promise((r) => setTimeout(r, 300));
      return { openedOnce, afterEsc, openedTwice, afterExit: el().hidden };
    });

    expect(res.openedOnce).toBe(true);
    expect(res.afterEsc.hidden).toBe(true);
    // Body scroll must be handed back, or the app is left unusable underneath.
    expect(res.afterEsc.unlocked).toBe(true);
    expect(res.openedTwice).toBe(true);
    expect(res.afterExit).toBe(true);
  });

  test('alarm labels are escaped, not executed', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      S.alarms.length = 0;
      S.alarms.push({
        id: 'xss', time: '07:30', days: [], enabled: true,
        label: '<img src=x onerror="window.__fttPwned=1">', lastFired: '',
      });
      T.setView('alarms');
      return {
        injectedImg: !!document.querySelector('#fluxTimeTools img'),
        pwned: !!(window as any).__fttPwned,
        renderedText: document.querySelector('#fluxTimeTools .ftt-alarm-meta')?.textContent || '',
      };
    });

    expect(res.injectedImg).toBe(false);
    expect(res.pwned).toBe(false);
    expect(res.renderedText).toContain('<img');
  });
});
