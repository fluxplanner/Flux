/**
 * C11 — Student → counselor help tickets (flag enable_counselor_help_tickets).
 *
 * The Ask-Your-Teacher handoff (C10) with three differences, all forced by who
 * is on the receiving end:
 *
 *   1. Routed to the student's ASSIGNED counselor (student_counselors link),
 *      not a class teacher. Same student-initiated shape, so the ticket's
 *      contents are consented by construction — nothing is sent the student
 *      did not type. Same 3/day rate limit with calm refusal copy.
 *
 *   2. Durable status. A teacher question is a message and lives in Messages;
 *      a counselor request needs to be *tracked* — open → in_progress →
 *      resolved, with an assignee — and the student needs to see where it
 *      stands rather than wondering into the void. Hence flux_help_tickets.
 *
 *   3. An urgent path. If a student marks a ticket urgent at 11pm, something
 *      must answer; silence is the one unacceptable outcome. So urgent tickets:
 *        · are NEVER rate-limited (the limit exists to protect attention, not
 *          to gate a kid in trouble),
 *        · get an immediate on-screen acknowledgement carrying crisis-line
 *          resources AND an honest, specific "a counselor sees this at
 *          <next school morning>" — we name a real time rather than implying
 *          someone is watching the queue overnight, because a promise the
 *          school cannot keep is worse than no promise,
 *        · pin to the top of the counselor risk queue regardless of consent
 *          tier (asking for help by name is its own consent).
 *
 * Counselor-private notes live in a separate table with no student-facing RLS
 * policy at all — see the migration.
 */
(function () {
  'use strict';
  if (window.FluxHelpTickets) return;

  const FLAG = 'enable_counselor_help_tickets';
  const KEY = 'flux_help_tickets_v1';
  const DAILY_LIMIT = 3;
  const BODY_MAX = 2000;

  /* IAE's bell hours, as minutes past midnight. These drive a promise made to a
   * student in the urgent acknowledgement ("a counselor will see this at …"),
   * so they must match the school this is actually deployed to — point it at a
   * school with different hours and the copy starts lying. */
  const SCHOOL_START_MIN = 7 * 60 + 45;   // 7:45 AM — first bell
  const SCHOOL_END_MIN = 14 * 60 + 35;    // 2:35 PM — after this the desk is empty

  const TOPICS = [
    { id: 'schedule', label: 'My schedule or classes' },
    { id: 'workload', label: 'Stress or workload' },
    { id: 'personal', label: 'Something personal' },
    { id: 'college', label: 'College or after graduation' },
    { id: 'other', label: 'Something else' },
  ];

  /* US crisis lines. These are shown on every urgent ticket and on the
   * rate-limit refusal — anywhere a student might otherwise hit a dead end. */
  const CRISIS_RESOURCES = [
    { action: 'Call or text 988', detail: 'Suicide & Crisis Lifeline — free, confidential, 24/7' },
    { action: 'Text HOME to 741741', detail: 'Crisis Text Line — 24/7' },
    { action: 'Call 911', detail: "If you're in immediate danger" },
  ];

  const STATUS_LABELS = {
    open: 'Open',
    in_progress: 'Counselor is on it',
    resolved: 'Resolved',
  };
  const STATUS_ORDER = { open: 0, in_progress: 1, resolved: 2 };

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }
  function uid() {
    try { return (window.currentUser && window.currentUser.id) || ''; } catch (_) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function todayISO() {
    return typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
  }
  function schoolName() {
    try { return window.FluxRole?.profile?.school || 'International Academy East'; } catch (_) {
      return 'International Academy East';
    }
  }

  /* ── rate limit (per student per day) ──
   * Normal tickets only — see the urgency check in openComposer's send handler. */

  function ticketsLeftToday() {
    const s = ls(KEY, null) || {};
    if (s.date !== todayISO()) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - (s.count || 0));
  }
  function recordTicket() {
    const s = ls(KEY, null) || {};
    const today = todayISO();
    lsSave(KEY, { date: today, count: s.date === today ? (s.count || 0) + 1 : 1 });
  }

  /* ── "when will a human actually see this" ──
   * The honest answer, computed rather than hand-waved. */

  function isSchoolDay(d) {
    const day = d.getDay();
    return day >= 1 && day <= 5; // Mon–Fri
  }

  /** Minutes past midnight, so 7:45 and 2:35 are expressible. */
  function minutesOfDay(d) {
    return d.getHours() * 60 + d.getMinutes();
  }

  /** Hand-built so the string is stable across ICU versions (no U+202F surprises). */
  function clockLabel(mins) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  /**
   * When a counselor will next be at the desk, relative to `now`.
   * Returns { inHours, at: Date, label } — label is student-facing prose.
   */
  function nextCounselorWindow(now) {
    const ref = now instanceof Date ? new Date(now.getTime()) : new Date();
    const mins = minutesOfDay(ref);

    if (isSchoolDay(ref) && mins >= SCHOOL_START_MIN && mins < SCHOOL_END_MIN) {
      return { inHours: true, at: new Date(ref.getTime()), label: 'today' };
    }

    const at = new Date(ref.getTime());
    at.setHours(Math.floor(SCHOOL_START_MIN / 60), SCHOOL_START_MIN % 60, 0, 0);
    // Before the bell on a school day? Then it's this morning. Otherwise roll
    // forward to the next weekday.
    if (!(isSchoolDay(ref) && mins < SCHOOL_START_MIN)) {
      do { at.setDate(at.getDate() + 1); } while (!isSchoolDay(at));
    }

    const dayDelta = Math.round(
      (new Date(at.getFullYear(), at.getMonth(), at.getDate()) -
        new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) / 864e5,
    );
    let when;
    if (dayDelta === 0) when = 'this morning';
    else if (dayDelta === 1) when = 'tomorrow morning';
    else when = at.toLocaleDateString('en-US', { weekday: 'long' }) + ' morning';

    return { inHours: false, at, label: `${when} at ${clockLabel(SCHOOL_START_MIN)}` };
  }

  /**
   * The immediate auto-reply for an urgent ticket. Two jobs, in this order:
   * tell them help exists RIGHT NOW (crisis lines), and tell them exactly when
   * a person from their own school will read what they wrote.
   */
  function urgentAcknowledgement(now) {
    const w = nextCounselorWindow(now);
    const lead = w.inHours
      ? 'Thanks for telling us. Your counselor is on campus today and will see this shortly.'
      : `Thanks for telling us. School is closed right now — a counselor will see this ${w.label}.`;
    const lines = [
      lead,
      '',
      'Right now, if you need someone:',
      ...CRISIS_RESOURCES.map((r) => `• ${r.action} — ${r.detail}`),
      '',
      'You did the right thing by reaching out.',
    ];
    return lines.join('\n');
  }

  function crisisBlockHtml(heading) {
    return `<div data-ht-crisis style="margin-top:12px;padding:12px;border-radius:12px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.28)">
      <div style="font-size:.78rem;font-weight:700;margin-bottom:6px">${esc(heading)}</div>
      <ul style="margin:0;padding-left:18px;font-size:.76rem;line-height:1.6;color:var(--text2)">
        ${CRISIS_RESOURCES.map((r) => `<li><strong>${esc(r.action)}</strong> — ${esc(r.detail)}</li>`).join('')}
      </ul>
    </div>`;
  }

  /* ── ticket composition ──
   * The exact row that gets inserted. Nothing is added that the student did
   * not see in the composer. */

  function composeTicket(input) {
    const topic = TOPICS.some((t) => t.id === input?.topic) ? input.topic : 'other';
    const urgency = input?.urgency === 'urgent' ? 'urgent' : 'normal';
    return {
      topic,
      body: String(input?.body || '').trim().slice(0, BODY_MAX),
      urgency,
      status: 'open',
    };
  }

  function topicLabel(id) {
    return (TOPICS.find((t) => t.id === id) || { label: 'Something else' }).label;
  }

  /* ── student composer ── */

  function rateLimitCopy() {
    return "That's 3 messages to your counselor today — the daily limit keeps your notes from getting lost in a pile. You can send more tomorrow, or catch them at their office. If this can't wait, send it as urgent instead: urgent messages are never limited.";
  }

  async function submitTicket(counselor, draft, opts) {
    const sb = client();
    if (!sb || !counselor?.id || !uid()) return { ok: false, error: 'not signed in' };
    const t = composeTicket(draft);
    if (!t.body) return { ok: false, error: 'empty' };
    try {
      const { error } = await sb.from('flux_help_tickets').insert({
        student_id: uid(),
        counselor_id: counselor.id,
        school: schoolName(),
        topic: t.topic,
        body: t.body,
        urgency: t.urgency,
        status: 'open',
      });
      if (error) return { ok: false, error: error.message };
    } catch (e) {
      return { ok: false, error: e?.message || 'send failed' };
    }
    // Only normal tickets burn a slot — the limit must never gate an escalation.
    if (t.urgency !== 'urgent') recordTicket();
    try { window.FluxTelemetry?.track?.('help_ticket_sent', { urgency: t.urgency }); } catch (_) {}
    return {
      ok: true,
      urgency: t.urgency,
      acknowledgement: t.urgency === 'urgent' ? urgentAcknowledgement(opts?.now) : '',
    };
  }

  /** Post-send screen for an urgent ticket — never a toast that can be missed. */
  function openUrgentAcknowledgement(now) {
    const w = nextCounselorWindow(now);
    const lead = w.inHours
      ? 'Your counselor is on campus today and will see this shortly.'
      : `School is closed right now — a counselor will see this <strong>${esc(w.label)}</strong>.`;
    if (typeof window.buildEduModal !== 'function') {
      if (typeof window.showToast === 'function') window.showToast(urgentAcknowledgement(now), 'info', 12000);
      return null;
    }
    return window.buildEduModal('fluxHelpTicketAckModal', `
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
        <h3 style="margin:0;font-size:1rem;font-weight:800">Your message is in</h3>
        <button type="button" class="edu-modal-close" style="margin-left:auto" aria-label="Close">✕</button>
      </div>
      <p style="font-size:.85rem;line-height:1.55;margin:0 0 4px">Thanks for telling us. ${lead}</p>
      ${crisisBlockHtml('Right now, if you need someone:')}
      <p style="font-size:.82rem;color:var(--muted2);margin:14px 0 0">You did the right thing by reaching out.</p>
      <button type="button" class="edu-modal-close" style="width:100%;margin-top:16px;padding:12px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-weight:700;cursor:pointer">Close</button>
    `);
  }

  function openComposer(counselor, opts) {
    if (!enabled()) return null;
    if (!counselor?.id) return null;
    if (document.getElementById('fluxHelpTicketModal')) return null;
    if (typeof window.buildEduModal !== 'function') return null;

    const left = ticketsLeftToday();
    const who = counselor.name || 'your counselor';
    const modal = window.buildEduModal('fluxHelpTicketModal', `
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:6px">
        <h3 style="margin:0;font-size:1rem;font-weight:800">Ask ${esc(who)} for help</h3>
        <button type="button" class="edu-modal-close" style="margin-left:auto" aria-label="Close">✕</button>
      </div>
      <p style="font-size:.78rem;color:var(--muted2);margin:0 0 14px;line-height:1.5">
        Only ${esc(who)} sees this. You'll be able to check its status here after you send.
      </p>
      <div class="mrow" style="margin-bottom:10px">
        <label for="fluxHtTopic" style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:4px">What's this about?</label>
        <select id="fluxHtTopic" style="width:100%;background:var(--card2);border:1px solid var(--border2);border-radius:10px;padding:9px 12px;color:var(--text);font-family:inherit;font-size:.85rem">
          ${TOPICS.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}
        </select>
      </div>
      <div class="mrow" style="margin-bottom:10px">
        <label for="fluxHtBody" style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:4px">What's going on?</label>
        <textarea id="fluxHtBody" rows="4" maxlength="${BODY_MAX}" placeholder="Say as much or as little as you want."
          style="width:100%;background:var(--card2);border:1px solid var(--border2);border-radius:10px;padding:9px 12px;color:var(--text);font-family:inherit;font-size:.85rem"></textarea>
      </div>
      <label style="display:flex;gap:9px;align-items:flex-start;font-size:.8rem;cursor:pointer;padding:10px;border-radius:10px;background:var(--card2);border:1px solid var(--border2)">
        <input type="checkbox" id="fluxHtUrgent" style="margin-top:2px;flex-shrink:0">
        <span>This can't wait — I need help soon.
          <span style="display:block;font-size:.72rem;color:var(--muted2);margin-top:2px">Urgent messages go to the top of your counselor's queue and are never limited.</span>
        </span>
      </label>
      <div id="fluxHtCrisis" hidden></div>
      <div id="fluxHtError" class="edu-modal-error" style="display:none;margin-top:12px"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" class="edu-modal-close" style="flex:1;padding:11px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-weight:700;cursor:pointer">Cancel</button>
        <button type="button" id="fluxHtSend" style="flex:1;padding:11px;border-radius:12px;border:none;background:var(--accent);color:#0a0d18;font-weight:700;cursor:pointer">Send</button>
      </div>
      <p id="fluxHtLimit" style="font-size:.72rem;color:var(--muted2);margin:10px 0 0;text-align:center">${left} of ${DAILY_LIMIT} messages left today</p>
    `);

    const urgentBox = modal.querySelector('#fluxHtUrgent');
    const crisisHost = modal.querySelector('#fluxHtCrisis');
    const limitLine = modal.querySelector('#fluxHtLimit');
    // Crisis resources appear the moment they reach for "urgent" — before they
    // send, not only after. A student in trouble should not have to complete a
    // form to find a phone number.
    //
    // The quota counter also has to go: urgent sends are never counted, so
    // leaving "N of 3 left" on screen would show a student in crisis a limit
    // that does not apply to them.
    urgentBox?.addEventListener('change', () => {
      if (urgentBox.checked) {
        crisisHost.innerHTML = crisisBlockHtml("If you need someone right now, don't wait for a reply:");
        crisisHost.hidden = false;
        if (limitLine) limitLine.textContent = "Urgent messages aren't limited.";
      } else {
        crisisHost.innerHTML = '';
        crisisHost.hidden = true;
        if (limitLine) limitLine.textContent = `${ticketsLeftToday()} of ${DAILY_LIMIT} messages left today`;
      }
    });

    // buildEduModal owns close (FluxOverlays pop + focus restore); drive it
    // through its own button rather than removing the node behind its back.
    const closeModal = () => modal.querySelector('.edu-modal-close')?.click();

    modal.querySelector('#fluxHtSend')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const body = modal.querySelector('#fluxHtBody')?.value || '';
      const urgency = urgentBox?.checked ? 'urgent' : 'normal';
      const errEl = modal.querySelector('#fluxHtError');
      const showErr = (msg) => {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.style.display = 'block';
      };

      if (!body.trim()) {
        showErr('Add a sentence or two so your counselor knows how to help.');
        return;
      }
      // The limit protects a counselor's attention; it must never stand between
      // a student and an escalation.
      if (urgency !== 'urgent' && !ticketsLeftToday()) {
        closeModal();
        if (typeof window.showToast === 'function') window.showToast(rateLimitCopy(), 'info', 9000);
        return;
      }

      btn.disabled = true;
      const res = await submitTicket(
        counselor,
        { topic: modal.querySelector('#fluxHtTopic')?.value, body, urgency },
        opts,
      );
      if (!res.ok) {
        btn.disabled = false;
        showErr('Could not send right now — try again in a moment.');
        return;
      }
      closeModal();
      if (urgency === 'urgent') openUrgentAcknowledgement(opts?.now);
      else if (typeof window.showToast === 'function') {
        window.showToast('Sent — your counselor will see it, and you can track it here.', 'success');
      }
      try { await refreshStudentSection(); } catch (_) {}
    });

    return modal;
  }

  /* ── student-side: my tickets + their status ── */

  async function loadStudentTickets(sb, studentId) {
    if (!sb || !studentId) return [];
    try {
      const { data } = await sb.from('flux_help_tickets')
        .select('id,topic,body,urgency,status,created_at,resolved_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    } catch (_) { return []; }
  }

  function statusPillHtml(status) {
    const s = STATUS_LABELS[status] ? status : 'open';
    const tone = { open: 'var(--muted2)', in_progress: 'var(--accent)', resolved: 'var(--green,#3ddc97)' }[s];
    return `<span data-ht-status="${esc(s)}" style="font-size:.68rem;font-weight:700;color:${tone};white-space:nowrap">${esc(STATUS_LABELS[s])}</span>`;
  }

  function renderStudentTickets(host, tickets) {
    if (!host) return;
    const items = tickets || [];
    host.innerHTML = `
      <div style="font-size:.78rem;font-weight:700;margin-bottom:2px">My messages to my counselor</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:8px">You'll see the status change here as your counselor picks it up.</div>
      ${items.length ? items.map((t) => `
        <div data-ht-ticket="${esc(t.id)}" style="display:flex;gap:8px;align-items:baseline;padding:7px 0;border-top:1px solid var(--border);font-size:.78rem">
          <span style="white-space:nowrap;color:var(--text2)">${esc(topicLabel(t.topic))}</span>
          ${t.urgency === 'urgent' ? '<span style="font-size:.66rem;font-weight:700;color:var(--red,#ff4d6d);white-space:nowrap">Urgent</span>' : ''}
          <span style="flex:1;color:var(--muted2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(t.body || '').slice(0, 60))}</span>
          ${statusPillHtml(t.status)}
        </div>`).join('')
        : '<div style="font-size:.76rem;color:var(--muted)">Nothing sent yet.</div>'}`;
  }

  /** Mounted into the student's "My counselor" card by renderMyCounselorSection. */
  async function injectStudentSection(host, counselor) {
    if (!enabled() || !host || !counselor?.id || !uid()) return null;
    host.querySelector('#fluxHelpTicketBlock')?.remove();

    const block = document.createElement('div');
    block.id = 'fluxHelpTicketBlock';
    block.style.cssText = 'margin-top:14px;padding:12px;border-radius:12px;background:var(--card2);border:1px solid var(--border)';
    block.innerHTML = `
      <button type="button" id="fluxHtOpen" style="width:100%;padding:10px;font-size:.82rem;border-radius:10px;border:1px solid var(--border2);background:var(--card);color:var(--text);font-weight:700;cursor:pointer">Ask for help</button>
      <div id="fluxHtList" style="margin-top:12px"></div>`;
    host.appendChild(block);

    block.querySelector('#fluxHtOpen')?.addEventListener('click', () => openComposer(counselor));
    renderStudentTickets(block.querySelector('#fluxHtList'), await loadStudentTickets(client(), uid()));
    return block;
  }

  async function refreshStudentSection() {
    const list = document.getElementById('fluxHtList');
    if (!list) return;
    renderStudentTickets(list, await loadStudentTickets(client(), uid()));
  }

  /* ── counselor-side: triage ── */

  /**
   * Urgent-and-unresolved first, then by status, then newest first. An urgent
   * ticket cannot be buried by a pile of newer routine ones.
   */
  function sortForTriage(tickets) {
    return [...(tickets || [])].sort((a, b) => {
      const au = a.urgency === 'urgent' && a.status !== 'resolved' ? 0 : 1;
      const bu = b.urgency === 'urgent' && b.status !== 'resolved' ? 0 : 1;
      if (au !== bu) return au - bu;
      const as = STATUS_ORDER[a.status] ?? 9;
      const bs = STATUS_ORDER[b.status] ?? 9;
      if (as !== bs) return as - bs;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  async function loadCounselorTickets(sb, counselorDbId) {
    if (!sb || !counselorDbId) return [];
    try {
      const { data } = await sb.from('flux_help_tickets')
        .select('id,student_id,topic,body,urgency,status,assigned_to,created_at')
        .eq('counselor_id', counselorDbId)
        .order('created_at', { ascending: false })
        .limit(50);
      return sortForTriage(data || []);
    } catch (_) { return []; }
  }

  async function setStatus(sb, ticketId, status) {
    if (!sb || !ticketId || !STATUS_LABELS[status]) return { ok: false };
    const nowIso = new Date().toISOString();
    const patch = { status, updated_at: nowIso };
    if (status === 'in_progress') {
      patch.acknowledged_at = nowIso;
      if (uid()) patch.assigned_to = uid();
    }
    if (status === 'resolved') patch.resolved_at = nowIso;
    try {
      const { error } = await sb.from('flux_help_tickets').update(patch).eq('id', ticketId);
      if (error) return { ok: false, error: error.message };
    } catch (e) { return { ok: false, error: e?.message || 'update failed' }; }
    return { ok: true, status };
  }

  /**
   * Unlike the C10 teacher queue (name + task line only, because it renders on
   * a projector-adjacent classroom screen), the counselor triage shows the body:
   * this IS the destination, it is their own RLS-scoped caseload, and triage
   * without content is not triage.
   */
  function renderTriage(host, tickets, names) {
    if (!host) return;
    const items = sortForTriage(tickets);
    const nameOf = (id) => (names && names[id]) || 'Student';
    const urgentCount = items.filter((t) => t.urgency === 'urgent' && t.status !== 'resolved').length;

    host.innerHTML = `
      <section class="flux-help-tickets-section" aria-label="Help requests">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
          <h3 style="margin:0;font-size:.95rem;font-weight:800">Help requests</h3>
          <span style="font-size:.72rem;color:${urgentCount ? 'var(--red,#ff4d6d)' : 'var(--muted2)'}">${urgentCount ? `${urgentCount} urgent · ` : ''}${items.length} total</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted2);margin-bottom:8px">Students who asked you directly. Urgent first.</div>
        ${items.length ? items.map((t) => `
          <article data-ht-row="${esc(t.id)}" data-ht-urgency="${esc(t.urgency)}"
            style="padding:10px 0;border-top:1px solid var(--border)${t.urgency === 'urgent' && t.status !== 'resolved' ? ';border-left:3px solid var(--red,#ff4d6d);padding-left:10px' : ''}">
            <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap">
              <strong style="font-size:.82rem">${esc(nameOf(t.student_id))}</strong>
              ${t.urgency === 'urgent' ? '<span style="font-size:.66rem;font-weight:700;color:var(--red,#ff4d6d)">URGENT</span>' : ''}
              <span style="font-size:.72rem;color:var(--muted2)">${esc(topicLabel(t.topic))}</span>
              ${statusPillHtml(t.status)}
            </div>
            <p style="font-size:.78rem;color:var(--text2);margin:5px 0 7px;line-height:1.45">${esc(String(t.body || '').slice(0, 220))}${String(t.body || '').length > 220 ? '…' : ''}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${t.status === 'open' ? `<button type="button" data-ht-start="${esc(t.id)}" style="font-size:.7rem;padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text);cursor:pointer">I'm on it</button>` : ''}
              ${t.status !== 'resolved' ? `<button type="button" data-ht-resolve="${esc(t.id)}" style="font-size:.7rem;padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text);cursor:pointer">Resolve</button>` : ''}
              <button type="button" data-ht-msg="${esc(t.student_id)}" style="font-size:.7rem;padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text);cursor:pointer">Message</button>
            </div>
          </article>`).join('')
          : '<div style="font-size:.76rem;color:var(--muted)">No help requests right now.</div>'}
      </section>`;
  }

  function wireTriage(host, sb, onChange) {
    if (!host) return;
    const move = async (id, status) => {
      const res = await setStatus(sb, id, status);
      if (!res.ok) {
        if (typeof window.showToast === 'function') window.showToast('Could not update that ticket — try again.', 'error');
        return;
      }
      if (typeof onChange === 'function') onChange();
    };
    host.querySelectorAll('[data-ht-start]').forEach((b) =>
      b.addEventListener('click', () => move(b.getAttribute('data-ht-start'), 'in_progress')));
    host.querySelectorAll('[data-ht-resolve]').forEach((b) =>
      b.addEventListener('click', () => move(b.getAttribute('data-ht-resolve'), 'resolved')));
    host.querySelectorAll('[data-ht-msg]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-ht-msg');
        if (id && window.FluxMessaging?.openThreadById) window.FluxMessaging.openThreadById(id);
      }));
  }

  async function loadStudentNames(sb, ids) {
    const map = {};
    const list = [...new Set((ids || []).filter(Boolean))];
    if (!sb || !list.length) return map;
    try {
      const { data } = await sb.from('user_roles').select('user_id,display_name').in('user_id', list);
      (data || []).forEach((r) => { map[r.user_id] = r.display_name || 'Student'; });
    } catch (_) {}
    return map;
  }

  /** Mounted into #counselorHelpTicketsMount by renderCounselorDashboard. */
  async function injectCounselorTriage(sb, counselorDbId) {
    if (!enabled()) return null;
    const mount = document.getElementById('counselorHelpTicketsMount');
    if (!mount || !sb || !counselorDbId) return null;
    const tickets = await loadCounselorTickets(sb, counselorDbId);
    const names = await loadStudentNames(sb, tickets.map((t) => t.student_id));
    renderTriage(mount, tickets, names);
    wireTriage(mount, sb, () => injectCounselorTriage(sb, counselorDbId));
    mount.hidden = false;
    return mount;
  }

  /* ── risk-queue bridge ──
   * Urgent tickets surface at the top of the counselor outreach queue. They are
   * NOT consent-gated: a student who files a named request has consented by the
   * act of filing it. They are also not dismissible from the queue — an urgent
   * wellbeing flag gets resolved on the ticket, not swiped away here. */
  async function loadUrgentQueueItems(sb, counselorDbId, names) {
    if (!enabled() || !sb || !counselorDbId) return [];
    let rows = [];
    try {
      const { data } = await sb.from('flux_help_tickets')
        .select('id,student_id,topic,body,urgency,status,created_at')
        .eq('counselor_id', counselorDbId)
        .eq('urgency', 'urgent')
        .order('created_at', { ascending: false })
        .limit(20);
      rows = (data || []).filter((t) => t.status !== 'resolved');
    } catch (_) { return []; }
    const nameMap = names || (await loadStudentNames(sb, rows.map((r) => r.student_id)));
    return rows.map((t) => ({
      key: `ticket:${t.id}`,
      ticketId: t.id,
      studentId: t.student_id,
      displayName: nameMap[t.student_id] || 'Student',
      wellnessTier: false,
      signalId: 'help_ticket_urgent',
      signalLabel: 'Urgent help request',
      severity: 'urgent',
      detail: `Asked for help directly (${topicLabel(t.topic)}): "${String(t.body || '').slice(0, 120)}"`,
    }));
  }

  window.FluxHelpTickets = {
    FLAG, DAILY_LIMIT, BODY_MAX, TOPICS, CRISIS_RESOURCES,
    SCHOOL_START_MIN, SCHOOL_END_MIN, STATUS_LABELS,
    enabled, ticketsLeftToday, recordTicket, rateLimitCopy,
    nextCounselorWindow, urgentAcknowledgement, isSchoolDay,
    composeTicket, topicLabel, submitTicket,
    openComposer, openUrgentAcknowledgement,
    loadStudentTickets, renderStudentTickets, injectStudentSection, refreshStudentSection,
    loadCounselorTickets, sortForTriage, setStatus, renderTriage, wireTriage, injectCounselorTriage,
    loadUrgentQueueItems,
    _key: KEY,
  };
})();
