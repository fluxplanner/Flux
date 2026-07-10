/**
 * C3 — Sub-Plan Generator (flag enable_sub_plans).
 *
 * Upgrades Lesson Hub's "Sub-plan template" button (which copies plain text
 * to the clipboard) into: a clean printable page + an unguessable share code
 * a substitute opens READ-ONLY with no account (48h expiry; every view is
 * audited server-side — see 20260710110000_sub_plans.sql).
 *
 * Data: today's classes (times/rooms) + the Lesson Hub state store
 * (flux_lesson_state_v1: per-period notes / attendance / materials).
 * Template sections: schedule, per-period plan, "if you finish early",
 * emergency info placeholders, teacher contact preference.
 *
 * Flag off: this module never intercepts the button — legacy clipboard
 * behavior remains byte-identical.
 */
(function () {
  'use strict';
  if (window.FluxSubPlans) return;

  const FLAG = 'enable_sub_plans';
  const STATE_KEY = 'flux_lesson_state_v1'; // Lesson Hub's existing store

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function todayISO() { return typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10); }

  /* ── payload ── */

  function buildPayload() {
    const cls = (window.classes || []).slice().sort((a, b) => (a.period || 0) - (b.period || 0));
    const state = ls(STATE_KEY, {});
    const today = todayISO();
    let teacher = 'Your teacher';
    try { teacher = (window.FluxRole?.profile?.display_name) || ls('flux_user_name', '') || teacher; } catch (_) {}
    let contact = '';
    try { contact = ls('flux_teacher_school_' + (window.currentUser?.id || 'anon'), {}).extension || ''; } catch (_) {}
    return {
      teacher,
      date: today,
      sections: cls.map((c) => {
        const s = state[today + '__P' + c.period] || {};
        return {
          period: String(c.periodLabel || ('P' + c.period)),
          name: c.name || 'Class',
          room: c.room || '',
          time: (c.timeStart && c.timeEnd) ? `${c.timeStart} – ${c.timeEnd}` : '',
          plan: s.notes || '',
          materials: Array.isArray(s.materials) ? s.materials : [],
          attendance: s.attendance || '',
        };
      }),
      finishEarly: 'If students finish early: silent reading, review flashcards, or work on upcoming assignments. No new material.',
      emergency: 'Emergency procedures: see the red folder by the door. Fire → nearest exit; lockdown → lights off, door locked, out of sight. Front office: dial 0.',
      contact: contact ? `Reach me at extension ${contact} or via the front office.` : 'Reach me via the front office.',
    };
  }

  /* ── printable page ── */

  function planHtml(p) {
    return `
      <h1>Sub plan — ${esc(p.teacher)} — ${esc(p.date)}</h1>
      <h2>Schedule</h2>
      <table><tr><th>Period</th><th>Class</th><th>Room</th><th>Time</th></tr>
        ${(p.sections || []).map((s) => `<tr><td>${esc(s.period)}</td><td>${esc(s.name)}</td><td>${esc(s.room)}</td><td>${esc(s.time)}</td></tr>`).join('')}
      </table>
      ${(p.sections || []).map((s) => `
        <h2>${esc(s.period)} · ${esc(s.name)}${s.room ? ' · Rm ' + esc(s.room) : ''}</h2>
        <p class="plan">${esc(s.plan || 'See lesson notes on the desk.')}</p>
        ${(s.materials || []).length ? `<p><strong>Materials:</strong> ${s.materials.map(esc).join(', ')}</p>` : ''}
      `).join('')}
      <h2>If you finish early</h2><p>${esc(p.finishEarly)}</p>
      <h2>Emergency info</h2><p>${esc(p.emergency)}</p>
      <h2>Contact</h2><p>${esc(p.contact)}</p>`;
  }

  const PRINT_CSS = `body{font:14px/1.6 system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:20px;border-bottom:2px solid #111;padding-bottom:6px}h2{font-size:15px;margin:18px 0 4px}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 8px;text-align:left;font-size:13px}
    .plan{white-space:pre-wrap;background:#f5f5f5;padding:8px;border-radius:6px}`;

  function openPrintView(p) {
    const w = window.open('', '_blank', 'noopener,width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><title>Sub plan ${esc(p.date)}</title><style>${PRINT_CSS}</style>${planHtml(p)}`);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 300);
  }

  /* ── publish / fetch ── */

  function makeCode() {
    const a = new Uint8Array(10);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  }

  async function publish(p) {
    const sb = client();
    if (!sb || !window.currentUser) return { ok: false, error: 'not_signed_in' };
    const code = makeCode();
    const { error } = await sb.from('flux_sub_plans').insert({
      teacher_id: window.currentUser.id,
      date: p.date,
      payload: p,
      code,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    const url = new URL(location.href);
    url.search = '?subplan=' + code;
    url.hash = '';
    return { ok: true, code, url: url.toString() };
  }

  async function fetchByCode(code) {
    const sb = client();
    if (!sb) return { ok: false, error: 'no_client' };
    try {
      const { data, error } = await sb.rpc('flux_get_sub_plan', { p_code: String(code || '') });
      if (error) return { ok: false, error: error.message };
      return data || { ok: false, error: 'empty' };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /* ── teacher modal ── */

  function openComposer() {
    const p = buildPayload();
    const m = document.createElement('div');
    m.id = 'fluxSubPlanModal';
    m.className = 'modal-overlay';
    m.style.display = 'flex';
    m.innerHTML = `<div class="modal-card" style="max-width:620px;max-height:82vh;overflow:auto">
      <div class="modal-title">Sub plan — ${esc(p.date)}</div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:10px">${p.sections.length} period${p.sections.length === 1 ? '' : 's'} · pulled from today's Lesson Hub notes. Print it, or publish a read-only link that expires in 48 hours.</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:.8rem;max-height:300px;overflow:auto">
        ${p.sections.map((s) => `<div style="margin-bottom:8px"><strong>${esc(s.period)} ${esc(s.name)}</strong>${s.time ? ' · ' + esc(s.time) : ''}<br><span style="color:var(--muted2)">${esc(s.plan || 'See lesson notes on the desk.')}</span></div>`).join('')}
      </div>
      <div id="fluxSubPlanShare" style="margin-top:10px;font-size:.8rem"></div>
      <div class="mactions" style="margin-top:12px">
        <button type="button" class="btn-sec" data-act="close">Close</button>
        <button type="button" class="btn-sec" data-act="print">Print</button>
        <button type="button" data-act="publish">Publish share code</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    try { window.FluxA11y?.trapFocus?.(m); } catch (_) {}
    const close = () => { try { window.FluxA11y?.releaseFocus?.(m); } catch (_) {} m.remove(); };
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('[data-act="close"]').addEventListener('click', close);
    m.querySelector('[data-act="print"]').addEventListener('click', () => openPrintView(p));
    m.querySelector('[data-act="publish"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const r = await publish(p);
      const out = m.querySelector('#fluxSubPlanShare');
      if (r.ok) {
        out.innerHTML = `Share link (expires in 48h): <a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(r.url)}</a>`;
        try { await navigator.clipboard?.writeText(r.url); showToast?.('Share link copied', 'success'); } catch (_) {}
        try { window.FluxTelemetry?.track?.('sub_plan_published', {}); } catch (_) {}
      } else {
        out.textContent = 'Publish failed: ' + r.error;
        btn.disabled = false;
      }
    });
  }

  /* ── substitute viewer (?subplan=CODE — no account) ── */

  function renderViewer(res) {
    const host = document.createElement('div');
    host.id = 'fluxSubPlanViewer';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;color:#111;overflow:auto';
    if (!res.ok) {
      host.innerHTML = `<div style="max-width:560px;margin:18vh auto;padding:0 20px;font:16px/1.6 system-ui,sans-serif;text-align:center">
        <h1 style="font-size:1.3rem">Sub plan unavailable</h1>
        <p>${res.error === 'expired' ? 'This share link has expired (links last 48 hours). Ask the teacher for a fresh one.' : 'That code was not found. Double-check the link.'}</p></div>`;
    } else {
      host.innerHTML = `<div style="max-width:720px;margin:0 auto;padding:24px 16px"><style>${PRINT_CSS.replace(/body\{[^}]*\}/, '')}</style>${planHtml(res.payload || {})}
        <button onclick="window.print()" style="margin:16px 0;padding:10px 18px;font-size:14px;cursor:pointer">Print</button></div>`;
    }
    document.body.appendChild(host);
  }

  async function maybeShowViewer() {
    const code = new URLSearchParams(location.search).get('subplan');
    if (!code) return;
    // The viewer must not wait for auth/app boot — subs have no account.
    const res = await fetchByCode(code);
    renderViewer(res);
  }

  /* ── boot ── */

  function boot() {
    maybeShowViewer();
    // Capture-phase upgrade of the Lesson Hub button; flag off ⇒ never fires.
    document.addEventListener('click', (e) => {
      if (!enabled()) return;
      const btn = e.target.closest?.('#lhSubPlanBtn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      openComposer();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxSubPlans = { FLAG, enabled, buildPayload, publish, fetchByCode, openComposer, renderViewer, planHtml };
})();
