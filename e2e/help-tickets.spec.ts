import { test, expect, type Page } from '@playwright/test';
import { gotoScenario, watchForViolations, assertNoCspOrConsoleViolations } from './helpers';

/*
 * C11 — Student → counselor help tickets (client contract).
 *
 * Same shape as ask-teacher.spec.ts: the live insert runs through the real
 * student-scoped RLS (the anon boundary is pinned in rls-boundary.spec.ts,
 * which now covers flux_help_tickets + flux_help_ticket_notes). Here we pin the
 * client contract — and in particular the promises this feature makes:
 *
 *   · an urgent ticket ALWAYS gets an immediate answer carrying crisis lines
 *     and a real, named next-school-morning time — never silence, never a
 *     vague "soon",
 *   · the daily rate limit never stands between a student and an escalation,
 *   · status is visible to the student as the counselor moves it,
 *   · an urgent ticket sorts above every inferred risk signal and cannot be
 *     dismissed out of the queue.
 */

/** 1 = Mon … 5 = Fri. Specs walk to a weekday rather than hardcoding a
 *  calendar date, which silently rots. */
const WEEKDAY = { MON: 1, TUE: 2, WED: 3, FRI: 5 };

/** `extra` covers flags this feature interoperates with but does not own —
 *  notably enable_counselor_risk_queue, which independently gates the outreach
 *  queue's own rendering. */
async function enableFlag(page: Page, extra: Record<string, boolean> = {}) {
  await page.evaluate(async (more) => {
    const w = window as any;
    w.FLUX_EXPERIMENTS = {
      ...(w.FLUX_EXPERIMENTS || {}),
      enable_counselor_help_tickets: true,
      ...more,
    };
    await w.FluxFeatureFlags.load({ force: true });
  }, extra);
}

/** Reset the harness ticket store so specs are order-independent. */
async function resetStore(page: Page, rows: unknown[] = []) {
  await page.evaluate((seed) => { (window as any).__fluxE2EHelpTickets = seed; }, rows);
}

test.describe('Help tickets — the urgent promise', () => {
  test('urgent acknowledgement carries crisis lines AND a named next-school-morning time', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate((wd) => {
      const w = window as any;
      const at = (weekday: number, hour: number, minute = 0) => {
        const d = new Date(2026, 7, 1, hour, minute, 0, 0); // walk forward from Aug 1 2026
        while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
        return d;
      };
      const wedLate = at(wd.WED, 23);
      const wedDawn = at(wd.WED, 6);
      const wedAfterSchool = at(wd.WED, 16);
      const friEvening = at(wd.FRI, 18);
      const tueMidday = at(wd.TUE, 11);
      // The exact minutes where IAE's 7:45–2:35 disagrees with a naive 8–3.
      const justAfterFirstBell = at(wd.TUE, 7, 50);
      const justAfterLastBell = at(wd.TUE, 14, 40);
      return {
        wedText: w.FluxHelpTickets.urgentAcknowledgement(wedLate),
        wedWindow: w.FluxHelpTickets.nextCounselorWindow(wedLate).label,
        dawnWindow: w.FluxHelpTickets.nextCounselorWindow(wedDawn).label,
        dawnInHours: w.FluxHelpTickets.nextCounselorWindow(wedDawn).inHours,
        afterSchoolWindow: w.FluxHelpTickets.nextCounselorWindow(wedAfterSchool).label,
        friWindow: w.FluxHelpTickets.nextCounselorWindow(friEvening).label,
        tueInHours: w.FluxHelpTickets.nextCounselorWindow(tueMidday).inHours,
        tueText: w.FluxHelpTickets.urgentAcknowledgement(tueMidday),
        afterFirstBellInHours: w.FluxHelpTickets.nextCounselorWindow(justAfterFirstBell).inHours,
        afterLastBellInHours: w.FluxHelpTickets.nextCounselorWindow(justAfterLastBell).inHours,
        afterLastBellWindow: w.FluxHelpTickets.nextCounselorWindow(justAfterLastBell).label,
      };
    }, WEEKDAY);

    // 6am on a school day: the desk opens later this morning, not tomorrow.
    expect(r.dawnInHours).toBe(false);
    expect(r.dawnWindow).toBe('this morning at 7:45 AM');

    // 4pm: the desk is already empty, so this must not claim "today".
    expect(r.afterSchoolWindow).toBe('tomorrow morning at 7:45 AM');

    // 11pm Wednesday: the honest answer is Thursday morning, said out loud.
    expect(r.wedWindow).toBe('tomorrow morning at 7:45 AM');
    expect(r.wedText).toContain('tomorrow morning at 7:45 AM');
    expect(r.wedText).toContain('School is closed right now');

    // Friday evening must not promise Saturday.
    expect(r.friWindow).toBe('Monday morning at 7:45 AM');

    // IAE's real bells, to the minute: 7:50 is in, 2:40 is out. Under the old
    // whole-hour 8:00–3:00 both of these answered the opposite way.
    expect(r.afterFirstBellInHours).toBe(true);
    expect(r.afterLastBellInHours).toBe(false);
    expect(r.afterLastBellWindow).toBe('tomorrow morning at 7:45 AM');

    // Midday on a school day: someone is actually there.
    expect(r.tueInHours).toBe(true);
    expect(r.tueText).toContain('on campus today');

    // Crisis resources appear on BOTH — in hours and out of hours.
    for (const text of [r.wedText, r.tueText]) {
      expect(text).toContain('988');
      expect(text).toContain('741741');
      expect(text).toContain('911');
      expect(text).toContain('You did the right thing');
    }
  });

  test('urgent acknowledgement renders as a real dialog, not a dismissible toast', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await enableFlag(page);
    const r = await page.evaluate((wd) => {
      const w = window as any;
      const d = new Date(2026, 7, 1, 23, 0, 0, 0);
      while (d.getDay() !== wd.WED) d.setDate(d.getDate() + 1);
      w.FluxHelpTickets.openUrgentAcknowledgement(d);
      const modal = document.getElementById('fluxHelpTicketAckModal');
      return {
        present: !!modal,
        role: modal?.getAttribute('role'),
        ariaModal: modal?.getAttribute('aria-modal'),
        labelled: !!modal?.getAttribute('aria-labelledby'),
        text: modal?.textContent || '',
      };
    }, WEEKDAY);
    expect(r.present).toBe(true);
    // buildEduModal's a11y contract, inherited rather than hand-rolled.
    expect(r.role).toBe('dialog');
    expect(r.ariaModal).toBe('true');
    expect(r.labelled).toBe(true);
    expect(r.text).toContain('988');
    expect(r.text).toContain('tomorrow morning at 7:45 AM');
  });
});

test.describe('Help tickets — student side', () => {
  test('composeTicket carries topic, body and urgency verbatim', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const w = window as any;
      return {
        normal: w.FluxHelpTickets.composeTicket({
          topic: 'workload', body: '  I keep falling behind in 3rd period.  ', urgency: 'normal',
        }),
        urgent: w.FluxHelpTickets.composeTicket({ topic: 'personal', body: 'x', urgency: 'urgent' }),
        bogus: w.FluxHelpTickets.composeTicket({ topic: 'not-a-topic', body: 'y', urgency: 'whatever' }),
      };
    });
    expect(r.normal).toEqual({
      topic: 'workload', body: 'I keep falling behind in 3rd period.', urgency: 'normal', status: 'open',
    });
    expect(r.urgent.urgency).toBe('urgent');
    // Unknown values fall back to safe defaults rather than reaching the DB and
    // tripping a CHECK constraint.
    expect(r.bogus.topic).toBe('other');
    expect(r.bogus.urgency).toBe('normal');
  });

  test('student submits a ticket and immediately sees it as Open', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    await resetStore(page);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const res = await w.FluxHelpTickets.submitTicket(
        { id: 'e2e-counselor-001', name: 'E2E Counselor' },
        { topic: 'schedule', body: 'Can I switch out of 2nd period?', urgency: 'normal' },
      );
      const mine = await w.FluxHelpTickets.loadStudentTickets(w.getSB(), w.currentUser.id);
      const host = document.createElement('div');
      host.id = 'htStudentHost';
      document.body.appendChild(host);
      w.FluxHelpTickets.renderStudentTickets(host, mine);
      return { ok: res.ok, count: mine.length, status: mine[0]?.status };
    });

    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.status).toBe('open');
    await expect(page.locator('#htStudentHost')).toContainText('Open');
    await expect(page.locator('#htStudentHost')).toContainText('Can I switch out of 2nd period?');
  });

  test('rate limit refuses kindly at 3/day — and points to the urgent escape hatch', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    await resetStore(page);

    const r = await page.evaluate(async () => {
      const w = window as any;
      w.save(w.FluxHelpTickets._key, { date: w.todayStr(), count: 3 });
      const left = w.FluxHelpTickets.ticketsLeftToday();
      const copy = w.FluxHelpTickets.rateLimitCopy();
      // Urgent must still get through with the limit exhausted.
      const urgent = await w.FluxHelpTickets.submitTicket(
        { id: 'e2e-counselor-001', name: 'E2E Counselor' },
        { topic: 'personal', body: 'I really need to talk to someone.', urgency: 'urgent' },
      );
      return { left, copy, urgentOk: urgent.ok, stillZero: w.FluxHelpTickets.ticketsLeftToday() };
    });

    expect(r.left).toBe(0);
    // Calm, non-punitive, and it names the way through.
    expect(r.copy).toMatch(/daily limit|lost in a pile/i);
    expect(r.copy).toMatch(/tomorrow/i);
    expect(r.copy).toMatch(/urgent messages are never limited/i);
    // The limit does not gate an escalation, and an urgent send does not burn a slot.
    expect(r.urgentOk).toBe(true);
    expect(r.stillZero).toBe(0);
  });

  test('a student only ever queries their own tickets', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    // Server-side this is guaranteed by the student_id = auth.uid() policy (anon
    // boundary pinned in rls-boundary.spec.ts). Here we pin the client half:
    // the read is student-scoped, never a bare select.
    await resetStore(page, [
      { id: 'a-1', student_id: 'student-a', counselor_id: 'e2e-counselor-001', topic: 'workload', body: 'Mine', urgency: 'normal', status: 'open', created_at: '2026-08-04T15:00:00.000Z' },
      { id: 'b-1', student_id: 'student-b', counselor_id: 'e2e-counselor-001', topic: 'personal', body: 'Not yours', urgency: 'urgent', status: 'open', created_at: '2026-08-04T16:00:00.000Z' },
    ]);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const mine = await w.FluxHelpTickets.loadStudentTickets(w.getSB(), 'student-a');
      return { count: mine.length, bodies: mine.map((t: any) => t.body) };
    });

    expect(r.count).toBe(1);
    expect(r.bodies).toEqual(['Mine']);
    expect(r.bodies).not.toContain('Not yours');
  });
});

test.describe('Help tickets — counselor side', () => {
  test('counselor sees the ticket in triage, urgent pinned above the rest', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    await resetStore(page, [
      { id: 'old-normal', student_id: 'student-a', counselor_id: 'e2e-counselor-001', topic: 'schedule', body: 'Schedule question', urgency: 'normal', status: 'open', created_at: '2026-08-05T09:00:00.000Z' },
      { id: 'urgent-1', student_id: 'student-b', counselor_id: 'e2e-counselor-001', topic: 'personal', body: 'I need help tonight.', urgency: 'urgent', status: 'open', created_at: '2026-08-04T23:00:00.000Z' },
    ]);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const tickets = await w.FluxHelpTickets.loadCounselorTickets(w.getSB(), 'e2e-counselor-001');
      const host = document.createElement('div');
      host.id = 'htTriageHost';
      document.body.appendChild(host);
      w.FluxHelpTickets.renderTriage(host, tickets, { 'student-a': 'Jordan P.', 'student-b': 'Priya S.' });
      return {
        order: [...host.querySelectorAll('[data-ht-row]')].map((el) => el.getAttribute('data-ht-row')),
        firstUrgency: host.querySelector('[data-ht-row]')?.getAttribute('data-ht-urgency'),
      };
    });

    // Older, but urgent — it still leads.
    expect(r.order).toEqual(['urgent-1', 'old-normal']);
    expect(r.firstUrgency).toBe('urgent');
    await expect(page.locator('#htTriageHost')).toContainText('Priya S.');
    await expect(page.locator('#htTriageHost')).toContainText('URGENT');
    await expect(page.locator('#htTriageHost')).toContainText('1 urgent');
  });

  test('status moves open → in_progress → resolved, and the student sees each step', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    await resetStore(page, [
      { id: 'tkt-1', student_id: 'student-a', counselor_id: 'e2e-counselor-001', topic: 'workload', body: 'Falling behind.', urgency: 'normal', status: 'open', assigned_to: null, created_at: '2026-08-05T09:00:00.000Z' },
    ]);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const sb = w.getSB();
      const studentSees = async () =>
        (await w.FluxHelpTickets.loadStudentTickets(sb, 'student-a'))[0];

      const atOpen = await studentSees();
      await w.FluxHelpTickets.setStatus(sb, 'tkt-1', 'in_progress');
      const atProgress = await studentSees();
      await w.FluxHelpTickets.setStatus(sb, 'tkt-1', 'resolved');
      const atResolved = await studentSees();

      const host = document.createElement('div');
      host.id = 'htStatusHost';
      document.body.appendChild(host);
      w.FluxHelpTickets.renderStudentTickets(host, [atResolved]);

      return {
        open: atOpen.status,
        progress: atProgress.status,
        assigned: atProgress.assigned_to,
        acknowledged: !!atProgress.acknowledged_at,
        resolved: atResolved.status,
        resolvedAt: !!atResolved.resolved_at,
        progressLabel: w.FluxHelpTickets.STATUS_LABELS.in_progress,
      };
    });

    expect(r.open).toBe('open');
    expect(r.progress).toBe('in_progress');
    expect(r.resolved).toBe('resolved');
    // Picking it up assigns it and timestamps the acknowledgement.
    expect(r.assigned).toBe('00000000-0000-4000-8000-0000000000e2');
    expect(r.acknowledged).toBe(true);
    expect(r.resolvedAt).toBe(true);
    // The student-facing wording is plain, not jargon.
    expect(r.progressLabel).toBe('Counselor is on it');
    await expect(page.locator('#htStatusHost')).toContainText('Resolved');
  });

  test('urgent ticket reaches the top of the risk queue and is not dismissible there', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page, { enable_counselor_risk_queue: true });
    await resetStore(page, [
      { id: 'urgent-1', student_id: 'student-b', counselor_id: 'e2e-counselor-001', topic: 'personal', body: 'I need help tonight.', urgency: 'urgent', status: 'open', created_at: '2026-08-04T23:00:00.000Z' },
      { id: 'resolved-urgent', student_id: 'student-c', counselor_id: 'e2e-counselor-001', topic: 'personal', body: 'Handled already.', urgency: 'urgent', status: 'resolved', created_at: '2026-08-03T23:00:00.000Z' },
    ]);

    const r = await page.evaluate(async () => {
      const w = window as any;
      const urgentItems = await w.FluxHelpTickets.loadUrgentQueueItems(w.getSB(), 'e2e-counselor-001');
      // Mix with a genuine high-severity inferred signal to prove the ordering.
      const queue = {
        items: [
          { key: 's:1', studentId: 'student-a', displayName: 'Jordan P.', signalId: 'mood_low', signalLabel: 'Low mood pattern', severity: 'high', detail: 'Multiple low check-ins.' },
          ...urgentItems,
        ].sort((a: any, b: any) => {
          const order: any = { urgent: -1, high: 0, medium: 1, low: 2 };
          return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
        }),
      };
      const host = document.createElement('div');
      host.id = 'htQueueHost';
      document.body.appendChild(host);
      host.innerHTML = w.FluxCounselorRiskQueue.renderSection(queue);
      const rows = [...host.querySelectorAll('[data-risk-key]')];
      return {
        urgentCount: urgentItems.length,
        firstKey: rows[0]?.getAttribute('data-risk-key'),
        firstText: rows[0]?.textContent || '',
        firstHasDismiss: !!rows[0]?.querySelector('[data-risk-dismiss]'),
        firstHasOpenTicket: !!rows[0]?.querySelector('[data-risk-ticket]'),
        secondKey: rows[1]?.getAttribute('data-risk-key'),
      };
    });

    // Resolved urgent tickets drop out; only the live one is queued.
    expect(r.urgentCount).toBe(1);
    expect(r.firstKey).toBe('ticket:urgent-1');
    expect(r.firstText).toContain('Urgent help request');
    // It outranks a high-severity inferred signal…
    expect(r.secondKey).toBe('s:1');
    // …and cannot be swiped away — that would be the silent drop.
    expect(r.firstHasDismiss).toBe(false);
    expect(r.firstHasOpenTicket).toBe(true);
  });
});

test.describe('Help tickets — flag + hygiene', () => {
  test('flag off: composer inert, no triage, no urgent queue items', async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
    await resetStore(page, [
      { id: 'urgent-1', student_id: 'student-b', counselor_id: 'e2e-counselor-001', topic: 'personal', body: 'Hidden while off.', urgency: 'urgent', status: 'open', created_at: '2026-08-04T23:00:00.000Z' },
    ]);
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_counselor_help_tickets: false };
      await w.FluxFeatureFlags.load({ force: true });
      const opened = w.FluxHelpTickets.openComposer({ id: 'e2e-counselor-001', name: 'E2E Counselor' });
      const urgent = await w.FluxHelpTickets.loadUrgentQueueItems(w.getSB(), 'e2e-counselor-001');
      const triage = await w.FluxHelpTickets.injectCounselorTriage(w.getSB(), 'e2e-counselor-001');
      return {
        enabled: w.FluxHelpTickets.enabled(),
        opened: !!opened,
        modal: !!document.getElementById('fluxHelpTicketModal'),
        urgentCount: urgent.length,
        triage: !!triage,
      };
    });
    expect(r.enabled).toBe(false);
    expect(r.opened).toBe(false);
    expect(r.modal).toBe(false);
    expect(r.urgentCount).toBe(0);
    expect(r.triage).toBe(false);
  });

  test('composer opens and sends with zero console errors and zero CSP violations', async ({ page }) => {
    await watchForViolations(page);
    await gotoScenario(page, 'counselor-path');
    await enableFlag(page);
    await resetStore(page);

    await page.evaluate(() => {
      const w = window as any;
      w.FluxHelpTickets.openComposer({ id: 'e2e-counselor-001', name: 'E2E Counselor' });
    });

    const modal = page.locator('#fluxHelpTicketModal');
    await expect(modal).toBeVisible();
    // Crisis resources surface the moment "urgent" is ticked — before sending.
    await expect(modal.locator('[data-ht-crisis]')).toHaveCount(0);
    await expect(modal.locator('#fluxHtLimit')).toContainText('3 of 3 messages left today');
    await modal.locator('#fluxHtUrgent').check();
    await expect(modal.locator('[data-ht-crisis]')).toContainText('988');
    // The quota counter must not survive ticking urgent — urgent is never counted.
    await expect(modal.locator('#fluxHtLimit')).toContainText("Urgent messages aren't limited");

    await modal.locator('#fluxHtBody').fill('I need to talk to someone.');
    await modal.locator('#fluxHtSend').click();

    // Composer closes; the acknowledgement takes over.
    await expect(page.locator('#fluxHelpTicketModal')).toHaveCount(0);
    await expect(page.locator('#fluxHelpTicketAckModal')).toBeVisible();
    await expect(page.locator('#fluxHelpTicketAckModal')).toContainText('988');

    // Escape closes the top overlay (buildEduModal + FluxOverlays contract).
    await page.keyboard.press('Escape');
    await expect(page.locator('#fluxHelpTicketAckModal')).toHaveCount(0);

    assertNoCspOrConsoleViolations(page);
  });
});
