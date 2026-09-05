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

    /*
     * Pinned to midday, and pinned only after the app has booted so the page
     * loads against the real clock.
     *
     * This test used to derive its two alarms from `Date.now() ± 90 minutes`
     * and keep only the HH:MM. That reads fine until the suite runs shortly
     * after midnight: at 01:26 UTC — which is exactly when CI ran it and it
     * failed — "90 minutes ago" is 23:56 *yesterday*, and fireDueAlarms only
     * compares within the current day, so the alarm correctly did not ring and
     * the test reported a bug that was not there. The same wrap hits the other
     * end after 22:30, where "90 minutes from now" lands in tomorrow's small
     * hours and reads as already due.
     *
     * The product behaviour is the right one — being ambushed at 1am by an
     * alarm you set for last night is worse than missing it — so the clock is
     * fixed here rather than the rule loosened there.
     */
    await page.clock.setFixedTime(new Date('2026-03-10T12:00:00'));

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();

      S.alarms.length = 0;
      // Due at half ten and never fired — the laptop-was-shut case.
      S.alarms.push({ id: 'past', time: '10:30', days: [], enabled: true, label: 'Missed', lastFired: '' });
      // Not due until half one.
      S.alarms.push({ id: 'future', time: '13:30', days: [], enabled: true, label: 'Later', lastFired: '' });

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

    // Midday, for the same midnight-wrap reason as the test above.
    await page.clock.setFixedTime(new Date('2026-03-10T12:00:00'));

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      const hhmm = '11:00';
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

    /* Midday again. This one asserts an alarm does *not* ring, so the midnight
       wrap made it pass for the wrong reason rather than fail — the quieter
       and more misleading half of the same fault. */
    await page.clock.setFixedTime(new Date('2026-03-10T12:00:00'));

    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const S = T._state();
      S.alarms.length = 0;
      T.setView('alarms');
      (document.getElementById('fttAlTime') as HTMLInputElement).value = '11:00';
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
      /* Poll rather than compare once. The overlay copies #tDisplay on the
         next paint, so a single sample taken as the real timer ticks over can
         catch the two one second apart — a mirror that is briefly behind, not
         a second timer, which is what this test is actually about. Reading
         once passed until the suite grew enough to slow the paint down. */
      const mirrored = async () => {
        for (let i = 0; i < 20; i++) {
          if (document.getElementById('fttFsTime')!.textContent
            === document.getElementById('tDisplay')!.textContent) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };
      const out: any = {
        opened: !document.getElementById('fttFocusFs')!.hidden,
        bodyLocked: document.body.classList.contains('ftt-fs-on'),
        mirrors: await mirrored(),
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

  /* "the stopwatch milliseconds are counting weird - it's skipping numbers and
     jumping". They were: everything repainted on one 250ms interval, so the
     hundredths digit advanced about 25 at a time.

     This counts how many DIFFERENT values the display takes over one second.

     Picking the threshold honestly. The old interval fired 4 times a second,
     so it could not exceed ~5 distinct values in a second no matter what.
     Driven by requestAnimationFrame an idle machine gives 50-60. Four
     Playwright workers competing for the CPU starve rAF badly — a first cut of
     this test sampled 500ms and asserted >10, and got 9 under full-suite load
     while passing alone. That was a badly calibrated test, not a regression.

     So: a full second, and a floor of 6. Anything above 5 is impossible on the
     old interval, and the worst observed contention still clears it three
     times over. Frame rate is the machine's business; the point being proved
     is only that the display is no longer chained to a 250ms tick. */
  test('the stopwatch counts smoothly rather than jumping in quarter-seconds', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('stopwatch');
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-toggle"]')!.click();

      const seen = new Set<string>();
      const start = performance.now();
      await new Promise<void>((done) => {
        function sample() {
          const el = document.getElementById('fttSwDisplay');
          if (el) seen.add(el.textContent || '');
          if (performance.now() - start < 1000) requestAnimationFrame(sample);
          else done();
        }
        requestAnimationFrame(sample);
      });

      const text = document.getElementById('fttSwDisplay')!.textContent || '';
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="sw-reset"]')!.click();
      return { distinct: seen.size, text };
    });

    // Four repaints a second cannot exceed ~5 distinct values in one second.
    expect(res.distinct).toBeGreaterThan(6);
    // And it is still a stopwatch: M:SS.cc
    expect(res.text).toMatch(/^\d+:\d{2}\.\d{2}$/);
  });

  /* "I like the focus timer popout but make that for every timer thingy." */
  test('every timer view can pop out full screen, with its own controls', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      const out: Record<string, any> = {};
      for (const view of ['clock', 'stopwatch', 'countdown', 'focus', 'alarms']) {
        T.setView(view);
        out[view] = { hasLaunch: !!document.querySelector('#fluxTimeTools [data-ftt="fs-open"]') };
      }
      for (const view of ['clock', 'stopwatch', 'countdown', 'focus']) {
        T.setView(view);
        document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="fs-open"]')!.click();
        const el = document.getElementById('fttFocusFs')!;
        out[view].mode = el.getAttribute('data-mode');
        out[view].actions = [...el.querySelectorAll('[data-ftt]')].map((b) => b.getAttribute('data-ftt'));
        out[view].ring = !!el.querySelector('.ftt-fs-ring');
        T.closeFocusFullscreen();
      }
      return out;
    });

    // Alarms is the one view with nothing worth showing across a room.
    expect(res.alarms.hasLaunch).toBe(false);
    expect(res.clock.hasLaunch).toBe(true);
    expect(res.stopwatch.hasLaunch).toBe(true);
    expect(res.countdown.hasLaunch).toBe(true);
    expect(res.focus.hasLaunch).toBe(true);

    // Each opens as itself, not as the Focus timer wearing a different hat.
    expect(res.clock.mode).toBe('clock');
    expect(res.stopwatch.mode).toBe('stopwatch');
    expect(res.countdown.mode).toBe('countdown');
    expect(res.focus.mode).toBe('focus');

    // Controls match the tool.
    expect(res.stopwatch.actions).toEqual(expect.arrayContaining(['sw-toggle', 'sw-lap', 'sw-reset', 'fs-exit']));
    expect(res.focus.actions).toEqual(expect.arrayContaining(['fs-toggle', 'fs-reset', 'fs-exit']));
    // The clock is a readout, so Exit is the only thing to press.
    expect(res.clock.actions).toEqual(['fs-exit']);

    // A ring needs a total to count against; two of these have none.
    expect(res.countdown.ring).toBe(true);
    expect(res.focus.ring).toBe(true);
    expect(res.stopwatch.ring).toBe(false);
    expect(res.clock.ring).toBe(false);
  });

  test('the stopwatch can be driven without leaving full screen', async ({ page }) => {
    await gotoTimer(page);

    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.setView('stopwatch');
      T.openFocusFullscreen('stopwatch');
      const q = (a: string) => document.querySelector<HTMLElement>(`#fttFocusFs [data-ftt="${a}"]`)!;

      q('sw-toggle').click();
      const running = !!T._state().stopwatch.startedAt;
      const labelWhileRunning = document.getElementById('fttFsToggle')!.textContent;
      await new Promise((r) => setTimeout(r, 120));

      q('sw-lap').click();
      const laps = T._state().stopwatch.laps.length;
      const sub = document.getElementById('fttFsSub')!.textContent || '';

      q('sw-toggle').click();
      const paused = !T._state().stopwatch.startedAt;

      q('sw-reset').click();
      const after = T._state().stopwatch;
      T.closeFocusFullscreen();
      return { running, labelWhileRunning, laps, sub, paused, afterAccum: after.accumMs, afterLaps: after.laps.length };
    });

    expect(res.running).toBe(true);
    expect(res.labelWhileRunning).toBe('Pause');
    expect(res.laps).toBe(1);
    expect(res.sub).toContain('Lap 1');
    expect(res.paused).toBe(true);
    // Reset clears the total and the laps, from full screen as from the page.
    expect(res.afterAccum).toBe(0);
    expect(res.afterLaps).toBe(0);
  });

  test("the staff Classroom timer drives this countdown, it doesn't keep its own", async ({ page }) => {
    // It used to run `remaining -= 1` on a setInterval, which drifts and — the
    // part that matters when it is projected on a wall — stops entirely once
    // the teacher switches to their slides.
    await gotoTimer(page);
    const res = await page.evaluate(() => {
      const T = (window as any).FluxTimeTools;
      const C = (window as any).FluxClassroomTools;
      const mount = document.createElement('div');
      document.body.appendChild(mount);
      C.renderClassroomTimer(mount);

      const presets = [...mount.querySelectorAll<HTMLButtonElement>('.flux-timer-preset')].map((b) =>
        b.getAttribute('data-secs'),
      );
      // No second display of its own to drift out of step with the real one.
      const ownDisplay = !!mount.querySelector('.flux-class-timer-display');

      const before = Date.now();
      mount.querySelector<HTMLButtonElement>('[data-secs="300"]')!.click();
      const cd = T._state().countdown;
      const fsOpen = !document.getElementById('fttFocusFs')?.hidden;
      const fsMode = document.querySelector('.ftt-fs')?.getAttribute('data-mode');

      T.closeFocusFullscreen();
      mount.remove();
      return {
        presets,
        ownDisplay,
        running: cd.running,
        totalMs: cd.totalMs,
        label: cd.label,
        // A deadline, not a counter: five minutes ahead of when we clicked.
        deadlineAhead: cd.endsAt - before,
        fsOpen,
        fsMode,
      };
    });

    expect(res.presets).toEqual(['120', '300', '600', '900']);
    expect(res.ownDisplay).toBe(false);
    expect(res.running).toBe(true);
    expect(res.totalMs).toBe(300_000);
    expect(res.label).toBe('Classroom timer');
    // endsAt is Date.now() + ms computed a few ms *after* `before` is read, so
    // the gap is 300s plus that handler time — never less. My first version of
    // this asserted <= 300_000 and failed at 300_004, which was the test being
    // wrong about the direction, not the timer being wrong.
    expect(res.deadlineAhead).toBeGreaterThanOrEqual(300_000);
    expect(res.deadlineAhead).toBeLessThan(301_000);
    // And it opens full screen, which is the point of a timer on a projector.
    expect(res.fsOpen).toBe(true);
    expect(res.fsMode).toBe('countdown');
  });

  /* Full screen as something you leave running.
   *
   * Two things follow from that: the machine must not fall asleep while you
   * are looking at it, and after a while there should be nothing on screen
   * but the time. Both are asserted against the clock, which is the view most
   * likely to be left up for an hour.
   */
  test('full screen asks to keep the screen awake, and releases it on exit', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    /* Record the calls rather than trusting the browser to grant a real lock:
       headless Chromium may refuse one, and what matters is that Flux asks and
       then gives it back. Installed before the overlay opens. */
    await page.evaluate(() => {
      const w = window as any;
      w.__wake = { requests: 0, releases: 0 };
      /* defineProperty, not assignment. navigator.wakeLock is an accessor on
         Navigator.prototype in Chromium, so `navigator.wakeLock = …` is
         silently dropped and the test measures a stub nothing ever calls. */
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: () => {
            w.__wake.requests++;
            return Promise.resolve({
              release: () => { w.__wake.releases++; return Promise.resolve(); },
              addEventListener: () => {},
            });
          },
        },
      });
    });

    const res = await page.evaluate(async () => {
      const w = window as any;
      w.FluxTimeTools.openFocusFullscreen('clock');
      await new Promise((r) => setTimeout(r, 300));
      const afterOpen = w.__wake.requests;
      document.querySelector<HTMLElement>('[data-ftt="fs-exit"]')?.click();
      await new Promise((r) => setTimeout(r, 300));
      return { afterOpen, releases: w.__wake.releases };
    });

    expect(res.afterOpen, 'full screen never asked for a wake lock').toBeGreaterThan(0);
    expect(res.releases, 'the wake lock was never released on exit').toBeGreaterThan(0);
  });

  test('the chrome fades out when the cursor stops, and the time never does', async ({ page }) => {
    await gotoScenario(page, 'student-semester');

    const res = await page.evaluate(async () => {
      const w = window as any;
      w.FluxTimeTools.openFocusFullscreen('clock');
      await new Promise((r) => setTimeout(r, 200));
      const el = document.getElementById('fttFocusFs')!;
      const op = (sel: string) => {
        const n = el.querySelector(sel);
        return n ? getComputedStyle(n).opacity : null;
      };

      /* The date, not the label. The clock's label slot now holds the
         student's own line and is left out entirely when there isn't one —
         a full-screen clock captioned "CLOCK" was noise. The date is the
         chrome this test is really about. */
      const busy = { idle: el.classList.contains('is-idle'), label: op('.ftt-fs-sub') };

      /* The idle threshold is three seconds; wait past it without touching
         anything. Deliberately a real wait — the whole feature is "what
         happens when you do nothing", so there is nothing to fast-forward. */
      await new Promise((r) => setTimeout(r, 3600));
      const idle = {
        idle: el.classList.contains('is-idle'),
        label: op('.ftt-fs-sub'),
        actions: op('.ftt-fs-actions'),
        hint: op('.ftt-fs-hint'),
        time: op('.ftt-fs-time'),
        cursor: getComputedStyle(el).cursor,
      };

      // Any movement brings it straight back.
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
      await new Promise((r) => setTimeout(r, 100));
      const woken = { idle: el.classList.contains('is-idle') };

      document.querySelector<HTMLElement>('[data-ftt="fs-exit"]')?.click();
      return { busy, idle, woken };
    });

    // Visible to start with.
    expect(res.busy.idle).toBe(false);
    expect(res.busy.label).toBe('1');

    // Faded after three seconds of nothing — except the time.
    expect(res.idle.idle, 'the overlay never went idle').toBe(true);
    expect(res.idle.label).toBe('0');
    expect(res.idle.actions).toBe('0');
    expect(res.idle.hint).toBe('0');
    expect(res.idle.time, 'the time faded out too, which is the one thing that must not').toBe('1');
    expect(res.idle.cursor, 'the cursor stayed visible').toBe('none');

    // And back on the first movement.
    expect(res.woken.idle).toBe(false);
  });
});

/* ── the customisable clock ──────────────────────────────────────────────────
 *
 * "allow users to customize the font, color, background, etc. literally
 * EVERYTHING to make it their own", plus a screensaver that keeps the date and
 * a window you can drag onto a second monitor.
 *
 * The thing worth testing is not that a button flips a boolean — it is that
 * one saved description reaches three surfaces that share no DOM: the card on
 * the Timer tab, the full-screen overlay, and clock.html in its own window.
 * Each of those is checked against the same style below.
 *
 * The other half is that `color` and `bg` are written into a style property
 * and arrive from a URL fragment, so both ends validate what they are given.
 */
test.describe('Clock appearance', () => {
  const STYLE = {
    font: 'serif', weight: 900, size: 160, track: 4,
    color: '#f0b429', bg: '#000000', glow: true,
    seconds: false, hour24: true, showDate: true, showZones: false,
    label: 'Deep work', keepInfo: true, drift: true,
  };

  async function openClockView(page: import('@playwright/test').Page) {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('timer'));
    await page.evaluate(() => (window as any).FluxTimeTools.setView('clock'));
    await expect(page.locator('#fttClockFace')).toBeVisible();
  }

  test('every control writes through to the saved style and to the face', async ({ page }) => {
    await openClockView(page);

    const res = await page.evaluate(async (want) => {
      const T = (window as any).FluxTimeTools;
      (document.getElementById('fttCustom') as HTMLDetailsElement).open = true;

      const misses: string[] = [];
      const hit = (key: string, val?: string) => {
        const sel = val === undefined
          ? `[data-ftt-clock="${key}"]`
          : `[data-ftt-clock="${key}"][data-val="${val}"]`;
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) { misses.push('missing ' + sel); return; }
        el.click();
      };

      hit('font', want.font);
      hit('weight', String(want.weight));
      hit('color', want.color);
      hit('bg', want.bg);
      // Toggles flip whatever is there, so each is clicked only to reach `want`.
      (['glow', 'seconds', 'hour24', 'showZones', 'keepInfo', 'drift'] as const).forEach((k) => {
        if (T._state().clock[k] !== (want as any)[k]) hit(k);
      });

      // Sliders and the free-text line go through `input`, not a click.
      const fire = (id: string, value: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (!el) { misses.push('missing #' + id); return; }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      fire('fttClockSize', String(want.size));
      fire('fttClockTrack', String(want.track));
      fire('fttClockLabel', want.label);

      await new Promise((r) => setTimeout(r, 200));
      const face = document.getElementById('fttClockFace')!;
      return {
        misses,
        saved: T._state().clock,
        vars: {
          ink: face.style.getPropertyValue('--fttc-ink'),
          bg: face.style.getPropertyValue('--fttc-bg'),
          scale: face.style.getPropertyValue('--fttc-scale'),
          track: face.style.getPropertyValue('--fttc-track'),
          weight: face.style.getPropertyValue('--fttc-weight'),
          font: face.style.getPropertyValue('--fttc-font'),
        },
        glowAttr: face.getAttribute('data-clock-glow'),
        driftAttr: face.getAttribute('data-clock-drift'),
        time: document.getElementById('fttClockTime')!.textContent,
        labelLine: face.querySelector('.ftt-face-label')?.textContent,
      };
    }, STYLE);

    expect(res.misses, 'controls that were not on the page').toEqual([]);
    expect(res.saved).toMatchObject(STYLE);

    // …and the saved values are actually on the element, not just in memory.
    expect(res.vars.ink).toBe('#f0b429');
    expect(res.vars.bg).toBe('#000000');
    expect(res.vars.scale).toBe('1.6');
    expect(res.vars.track).toBe('4px');
    expect(res.vars.weight).toBe('900');
    expect(res.vars.font).toContain('serif');
    expect(res.glowAttr).toBe('1');
    expect(res.driftAttr).toBe('1');
    expect(res.labelLine).toBe('Deep work');

    // 24-hour with seconds off: "17:05", never "5:05:09 PM".
    expect(res.time).toMatch(/^\d{2}:\d{2}$/);
  });

  test('a style survives a reload', async ({ page }) => {
    await openClockView(page);
    await page.evaluate((want) => {
      const T = (window as any).FluxTimeTools;
      Object.keys(want).forEach((k) => T._setClock(k, (want as any)[k]));
    }, STYLE);

    await page.reload();
    await expect(page.locator('#app')).toHaveClass(/visible/);
    const saved = await page.evaluate(() => (window as any).FluxTimeTools._state().clock);
    expect(saved).toMatchObject(STYLE);
  });

  test('full screen wears the same style', async ({ page }) => {
    await openClockView(page);

    const res = await page.evaluate(async (want) => {
      const T = (window as any).FluxTimeTools;
      Object.keys(want).forEach((k) => T._setClock(k, (want as any)[k]));
      T.openFocusFullscreen('clock');
      await new Promise((r) => setTimeout(r, 250));

      const el = document.getElementById('fttFocusFs')!;
      const time = document.getElementById('fttFsTime')!;
      const cs = getComputedStyle(time);
      const out = {
        mode: el.getAttribute('data-mode'),
        keep: el.classList.contains('ftt-keepinfo'),
        drift: el.getAttribute('data-clock-drift'),
        glow: el.getAttribute('data-clock-glow'),
        colour: cs.color,
        family: cs.fontFamily,
        weight: cs.fontWeight,
        bg: getComputedStyle(el).backgroundColor,
        label: document.getElementById('fttFsLbl')?.textContent,
        text: time.textContent,
      };
      T.closeFocusFullscreen();
      return out;
    }, STYLE);

    expect(res.mode).toBe('clock');
    expect(res.keep, 'keepInfo did not reach the overlay').toBe(true);
    expect(res.drift).toBe('1');
    expect(res.glow).toBe('1');
    expect(res.colour).toBe('rgb(240, 180, 41)');      // #f0b429
    expect(res.bg).toBe('rgb(0, 0, 0)');
    expect(res.family).toContain('serif');
    expect(res.weight).toBe('900');
    // The custom line replaces the "CLOCK" label rather than joining it.
    expect(res.label).toBe('Deep work');
    expect(res.text).toMatch(/^\d{2}:\d{2}$/);
  });

  /* The screensaver, and the reason both behaviours exist. Deliberately two
     runs of the same three-second wait rather than one clever test: the whole
     feature is "what happens when you do nothing", so there is nothing to
     fast-forward past. */
  test('idle: keepInfo holds the date on screen, off it fades', async ({ page }) => {
    await openClockView(page);

    const measure = async (keepInfo: boolean) => page.evaluate(async (keep) => {
      const T = (window as any).FluxTimeTools;
      T._setClock('showDate', true);
      T._setClock('keepInfo', keep);
      T.openFocusFullscreen('clock');
      await new Promise((r) => setTimeout(r, 3600));
      const el = document.getElementById('fttFocusFs')!;
      const op = (sel: string) => {
        const n = el.querySelector(sel);
        return n ? getComputedStyle(n as HTMLElement).opacity : 'gone';
      };
      /* The fade is a 0.55s transition starting three seconds in, so the wait
         above normally clears it — but under parallel workers the timers slip
         and a value gets read mid-fade. Wait for it to stop moving instead of
         assuming enough time has passed.

         Every value that is about to be asserted goes into the signature, not
         just one: with keepInfo on, the date never moves at all, so watching
         only the date exited immediately while the buttons were still fading
         and the read came back at 0.008. */
      const sig = () => [op('.ftt-fs-sub'), op('.ftt-fs-time'),
        op('.ftt-fs-actions'), op('.ftt-fs-hint')].join('|');
      for (let i = 0; i < 25; i++) {
        const before = sig();
        await new Promise((r) => setTimeout(r, 80));
        if (sig() === before) break;
      }
      const out = {
        idle: el.classList.contains('is-idle'),
        date: op('.ftt-fs-sub'),
        time: op('.ftt-fs-time'),
        actions: op('.ftt-fs-actions'),
        hint: op('.ftt-fs-hint'),
      };
      T.closeFocusFullscreen();
      return out;
    }, keepInfo);

    const off = await measure(false);
    expect(off.idle, 'never went idle').toBe(true);
    expect(off.date, 'the date should fade when keepInfo is off').toBe('0');
    expect(off.time).toBe('1');

    const on = await measure(true);
    expect(on.idle, 'never went idle').toBe(true);
    expect(on.date, 'the date should stay when keepInfo is on').toBe('1');
    expect(on.time).toBe('1');
    // The controls are chrome, not information — they go either way, so what
    // is left on the monitor is a clock and not a row of buttons.
    expect(on.actions).toBe('0');
    expect(on.hint).toBe('0');
  });

  /* Closing and immediately reopening used to close the second one too.
     Leaving native fullscreen is asynchronous, so the fullscreenchange it
     produces landed after the reopen, and the handler that exists to catch
     "the user pressed Esc" read it as exactly that. Nobody could hit the
     window by hand, but the staff Classroom timer does it whenever a second
     preset is clicked — the timer opened and vanished. */
  test('reopening full screen right after closing it stays open', async ({ page }) => {
    await openClockView(page);
    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.openFocusFullscreen('clock');
      await new Promise((r) => setTimeout(r, 150));
      T.closeFocusFullscreen();
      T.openFocusFullscreen('clock');           // same tick, before the echo
      await new Promise((r) => setTimeout(r, 400));
      const el = document.getElementById('fttFocusFs')!;
      const out = { open: !el.hidden, onBody: document.body.classList.contains('ftt-fs-on') };
      T.closeFocusFullscreen();
      return out;
    });
    expect(res.open, 'the reopened overlay closed itself').toBe(true);
    expect(res.onBody).toBe(true);
  });

  /* The other half of the guard above. It ignores fullscreenchange for a
     moment after opening, so this proves the case it must still catch: the
     browser dropping out of fullscreen on its own — F11, the system control —
     has to take the overlay with it, or it sits over the app with no way out.
     Escape is not this path; it has its own keydown handler. */
  test('leaving fullscreen by F11 still closes the overlay', async ({ page }) => {
    await openClockView(page);
    const res = await page.evaluate(async () => {
      const T = (window as any).FluxTimeTools;
      T.openFocusFullscreen('clock');
      const openedNow = !document.getElementById('fttFocusFs')!.hidden;
      // Past the settling window, so this reads as a real change and not as
      // our own plumbing.
      await new Promise((r) => setTimeout(r, 800));

      /* F11 leaves fullscreen *first* and fires the event afterwards, so
         document.fullscreenElement is already null by the time the handler
         runs. Whether the earlier requestFullscreen() was granted varies by
         browser and by whether there was a user gesture, so both are covered:
         if we really are in fullscreen, leave it for real and let the browser
         fire its own event; if the request was refused there is nothing to
         leave and a synthetic event is the same thing the handler would see. */
      if (document.fullscreenElement) await document.exitFullscreen();
      else document.dispatchEvent(new Event('fullscreenchange'));
      await new Promise((r) => setTimeout(r, 150));
      const el = document.getElementById('fttFocusFs')!;
      const out = { openedNow, closed: el.hidden, bodyClear: !document.body.classList.contains('ftt-fs-on') };
      T.closeFocusFullscreen();
      return out;
    });
    expect(res.openedNow).toBe(true);
    expect(res.closed, 'the overlay stayed up after the browser left fullscreen').toBe(true);
    expect(res.bodyClear, 'the page was left unable to scroll').toBe(true);
  });

  test('"open in its own window" carries the whole style to clock.html', async ({ page, context }) => {
    await openClockView(page);
    await page.evaluate((want) => {
      const T = (window as any).FluxTimeTools;
      Object.keys(want).forEach((k) => T._setClock(k, (want as any)[k]));
      T._state().worldClocks.length = 0;
      T._state().worldClocks.push('Europe/London');
    }, STYLE);

    const popupPromise = context.waitForEvent('page');
    await page.locator('#fluxTimeTools [data-ftt="clock-window"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    /* `npx serve` rewrites /clock.html to /clock, so the extension is not
       reliably in the URL the popup ends up on — what matters is that it is
       the clock page and that the whole style rode along in the fragment. */
    expect(new URL(popup.url()).pathname).toMatch(/\/clock(\.html)?$/);
    const payload = JSON.parse(decodeURIComponent(new URL(popup.url()).hash.slice(1)));
    expect(payload.style).toMatchObject(STYLE);
    expect(payload.zones).toEqual(['Europe/London']);

    // And the window renders it, rather than merely receiving it.
    const shown = await popup.evaluate(() => ({
      label: document.getElementById('label')!.textContent,
      colour: getComputedStyle(document.getElementById('time')!).color,
      family: getComputedStyle(document.getElementById('time')!).fontFamily,
      weight: getComputedStyle(document.getElementById('time')!).fontWeight,
      bg: getComputedStyle(document.body).backgroundColor,
      keep: document.body.getAttribute('data-keep'),
      glow: document.body.getAttribute('data-glow'),
      time: document.getElementById('time')!.textContent,
      dateShown: !(document.getElementById('date') as HTMLElement).hidden,
    }));
    expect(shown.label).toBe('Deep work');
    expect(shown.colour).toBe('rgb(240, 180, 41)');
    expect(shown.family).toContain('serif');
    expect(shown.weight).toBe('900');
    expect(shown.bg).toBe('rgb(0, 0, 0)');
    expect(shown.keep).toBe('1');
    expect(shown.glow).toBe('1');
    expect(shown.dateShown).toBe(true);
    expect(shown.time).toMatch(/^\d{2}:\d{2}$/);
    await popup.close();
  });

  test('the clock window keeps the time right and never lets the screen sleep', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__wake = { requests: 0 };
      // A prototype accessor in Chromium, so assignment is silently dropped.
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: () => {
            w.__wake.requests++;
            return Promise.resolve({ release: () => Promise.resolve(), addEventListener: () => {} });
          },
        },
      });
    });
    await page.goto('/clock.html#' + encodeURIComponent(JSON.stringify({
      style: { ...STYLE, seconds: true, hour24: false }, zones: [],
    })));
    await expect(page.locator('#time')).toBeVisible();

    const res = await page.evaluate(async () => {
      const first = document.getElementById('time')!.textContent!;
      // Derived from Date.now() at paint time, so it must advance on its own.
      await new Promise((r) => setTimeout(r, 1400));
      return {
        first,
        second: document.getElementById('time')!.textContent!,
        wake: (window as any).__wake.requests,
      };
    });

    expect(res.second, 'the clock stopped ticking').not.toBe(res.first);
    expect(res.second).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(res.wake, 'the clock window never asked to keep the screen awake').toBeGreaterThan(0);
  });

  /* `bg` and `color` end up in a style property, and the fragment is the one
     input a stranger can hand you — "open this clock link". Anything that is
     not a colour or one of our own gradients has to be dropped rather than
     tidied into something plausible. */
  test('a tampered fragment cannot inject styling', async ({ page }) => {
    const hostile = {
      style: {
        font: '../evil', weight: 1234, size: 99999, track: -9999,
        color: 'red; position:fixed; inset:0',
        bg: 'url(javascript:alert(1))',
        glow: 'yes', seconds: 'no', label: 'x'.repeat(500),
      },
      zones: ['Not/AZone', 42, 'Europe/London'],
    };
    await page.goto('/clock.html#' + encodeURIComponent(JSON.stringify(hostile)));
    await expect(page.locator('#time')).toBeVisible();

    const res = await page.evaluate(() => ({
      ink: document.body.style.getPropertyValue('--fttc-ink'),
      bg: document.body.style.getPropertyValue('--fttc-bg'),
      scale: document.body.style.getPropertyValue('--fttc-scale'),
      weight: document.body.style.getPropertyValue('--fttc-weight'),
      family: getComputedStyle(document.getElementById('time')!).fontFamily,
      label: document.getElementById('label')!.textContent!.length,
      // 'yes' is not a boolean, so glow keeps its default of off.
      glow: document.body.getAttribute('data-glow'),
      zoneRows: document.querySelectorAll('#zones div').length,
      time: document.getElementById('time')!.textContent,
    }));

    expect(res.ink, 'a non-colour reached the style property').toBe('');
    expect(res.bg, 'a url() reached the style property').toBe('');
    expect(res.scale, 'size was not clamped').toBe('2.2');      // 220% ceiling
    expect(res.weight, 'an invalid weight was accepted').toBe('700');
    expect(res.family, 'an unknown font key was accepted').toContain('JetBrains Mono');
    expect(res.label, 'the label was not truncated').toBe(60);
    expect(res.glow).toBe('0');
    expect(res.zoneRows, 'a bad time zone was kept').toBe(1);
    // And through all of that it is still a working clock.
    expect(res.time).toMatch(/\d{1,2}:\d{2}/);
  });

  test('the style syncs with the account, and a bad one from the cloud is cleaned', async ({ page }) => {
    await openClockView(page);
    const res = await page.evaluate((want) => {
      const T = (window as any).FluxTimeTools;
      Object.keys(want).forEach((k) => T._setClock(k, (want as any)[k]));
      const slice = JSON.parse(JSON.stringify(T.getCloudSlice()));

      // A row that has been tampered with on its way through the database.
      T.applyFromCloud({
        alarms: [], worldClocks: [],
        clock: { font: 'mono', color: 'expression(alert(1))', size: -40, keepInfo: 'true' },
      });
      return { slice, after: T._state().clock };
    }, STYLE);

    expect(res.slice.clock, 'the appearance does not travel with the account').toMatchObject(STYLE);
    // Cleaned the same way a local load is: keep what is valid, drop the rest.
    expect(res.after.font).toBe('mono');
    expect(res.after.color).toBe('');
    expect(res.after.size).toBe(40);          // clamped to the floor
    expect(res.after.keepInfo).toBe(false);   // a string is not a boolean
  });

  test('reset puts every option back', async ({ page }) => {
    await openClockView(page);
    const res = await page.evaluate(async (want) => {
      const T = (window as any).FluxTimeTools;
      Object.keys(want).forEach((k) => T._setClock(k, (want as any)[k]));
      const changed = { ...T._state().clock };
      document.querySelector<HTMLElement>('#fluxTimeTools [data-ftt="clock-reset"]')!.click();
      await new Promise((r) => setTimeout(r, 150));
      const face = document.getElementById('fttClockFace')!;
      return {
        changed,
        reset: T._state().clock,
        ink: face.style.getPropertyValue('--fttc-ink'),
        bg: face.style.getPropertyValue('--fttc-bg'),
      };
    }, STYLE);

    expect(res.changed.font).toBe('serif');
    expect(res.reset).toMatchObject({
      font: 'mono', weight: 700, size: 100, track: -2, color: '', bg: '',
      glow: false, seconds: true, hour24: false, showDate: true,
      showZones: false, label: '', keepInfo: false, drift: false,
    });
    // Cleared off the element too, not just out of the object — otherwise the
    // old colour stays on screen until the next full render.
    expect(res.ink).toBe('');
    expect(res.bg).toBe('');
  });
});
