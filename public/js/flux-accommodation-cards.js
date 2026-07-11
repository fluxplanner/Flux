/**
 * C5 — Accommodation Cards (flag enable_accommodation_cards).
 *
 * Counselor-managed accommodations, surfaced privacy-safely:
 *   - Counselor: manager card in the Counselor Workspace (add/edit/delete
 *     within their school; consent_state set WITH the student per the
 *     P4-CONSENT framework)
 *   - Teacher: aggregate kind chips per class ("2 students: extended time")
 *     via SECURITY DEFINER RPC — no names, no notes. Tapping shows
 *     consented details (audited server-side) or an "ask counselor" CTA.
 *   - Student: "What staff can see about me" transparency panel in
 *     Settings (tier-card style from the consent UI), incl. the audit
 *     trail of who viewed consented details.
 *
 * All render functions accept injected data so the e2e client contract
 * runs without a live counselor session.
 */
(function () {
  'use strict';
  if (window.FluxAccommodations) return;

  const FLAG = 'enable_accommodation_cards';
  const KINDS = ['Extended time', 'Preferential seating', 'Breaks as needed', 'Reduced workload', 'Reader/scribe', 'Quiet testing space', 'Other'];

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function mySchool() {
    try { return String(window.FluxRole?.profile?.school || '').trim(); } catch (_) { return ''; }
  }
  function myRole() {
    try { return typeof getMyRole === 'function' ? getMyRole() : (window.FluxRole?.current || ''); } catch (_) { return ''; }
  }

  /* ── data layer (thin; RLS/RPCs do the enforcement) ── */

  async function counselorList() {
    const sb = client();
    if (!sb) return [];
    const { data } = await sb.from('flux_student_accommodations')
      .select('id,student_id,kind,note,consent_state,updated_at')
      .order('updated_at', { ascending: false });
    return data || [];
  }

  async function counselorStudents() {
    const sb = client();
    if (!sb) return [];
    // Same-school student directory (RLS scopes rows).
    const { data } = await sb.from('user_roles')
      .select('user_id,display_name')
      .eq('role', 'student')
      .limit(400);
    return (data || []).filter((r) => r.display_name);
  }

  async function counselorSave(row) {
    const sb = client();
    const school = mySchool();
    if (!sb || !school) return { ok: false, error: 'no_school' };
    const rec = {
      student_id: row.studentId,
      school,
      kind: String(row.kind || '').slice(0, 80),
      note: row.note ? String(row.note).slice(0, 500) : null,
      consent_state: row.consentState === 'staff_visible' ? 'staff_visible' : 'private',
      created_by: window.currentUser?.id,
      updated_at: new Date().toISOString(),
    };
    const q = row.id
      ? sb.from('flux_student_accommodations').update(rec).eq('id', row.id)
      : sb.from('flux_student_accommodations').insert(rec);
    const { error } = await q;
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function counselorDelete(id) {
    const sb = client();
    if (!sb) return { ok: false };
    const { error } = await sb.from('flux_student_accommodations').delete().eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function teacherChips(classCode) {
    const sb = client();
    if (!sb) return { ok: false, error: 'no_client' };
    const { data, error } = await sb.rpc('flux_teacher_accommodation_chips', { p_class_code: classCode });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function teacherDetails(classCode) {
    const sb = client();
    if (!sb) return { ok: false, error: 'no_client' };
    const { data, error } = await sb.rpc('flux_teacher_accommodation_details', { p_class_code: classCode });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function studentMine() {
    const sb = client();
    if (!sb) return { rows: [], views: 0 };
    const { data } = await sb.from('flux_student_accommodations')
      .select('id,kind,note,consent_state,updated_at');
    let views = 0;
    try {
      const { count } = await sb.from('flux_accommodation_audit')
        .select('id', { count: 'exact', head: true });
      views = count || 0;
    } catch (_) {}
    return { rows: data || [], views };
  }

  /* ── teacher: chips per class + detail modal ── */

  function renderTeacherChips(host, classCode, chips) {
    const total = chips.reduce((a, c) => a + (c.n || 0), 0);
    if (!total) { host.innerHTML = ''; return; }
    host.innerHTML = chips.map((c) =>
      `<button type="button" class="fac-chip" data-class-code="${esc(classCode)}" style="border:1px solid rgba(var(--accent-rgb),.3);background:rgba(var(--accent-rgb),.08);color:var(--text2);border-radius:999px;padding:3px 10px;font-size:.7rem;cursor:pointer;margin:2px 4px 2px 0">${c.n} student${c.n === 1 ? '' : 's'}: ${esc(c.kind.toLowerCase())}</button>`
    ).join('');
    host.querySelectorAll('.fac-chip').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const res = await teacherDetails(classCode);
        openDetailModal(res.ok ? (res.details || []) : []);
      });
    });
  }

  function openDetailModal(details) {
    try { window.FluxTelemetry?.track?.('accommodation_details_opened', {}); } catch (_) {}
    document.getElementById('facDetailModal')?.remove();
    const m = document.createElement('div');
    m.id = 'facDetailModal';
    m.className = 'modal-overlay';
    m.style.display = 'flex';
    const body = details.length
      ? details.map((d) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>${esc(d.student)}</strong> · ${esc(d.kind)}${d.note ? `<div style="font-size:.78rem;color:var(--muted2);margin-top:2px">${esc(d.note)}</div>` : ''}</div>`).join('')
      : `<div style="font-size:.82rem;color:var(--muted2)">No consented details to show. These students haven't shared specifics with staff — <strong>ask their counselor</strong> for guidance on supporting them.</div>`;
    m.innerHTML = `<div class="modal-card" style="max-width:460px">
      <div class="modal-title">Accommodations${details.length ? '' : ' — aggregate only'}</div>
      ${body}
      <div style="font-size:.68rem;color:var(--muted);margin-top:10px">${details.length ? 'Students can see that details were viewed (audited).' : ''}</div>
      <div class="mactions" style="margin-top:10px"><button type="button" class="btn-sec" data-act="close">Close</button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    m.querySelector('[data-act="close"]').addEventListener('click', () => m.remove());
  }

  async function injectTeacherCard() {
    if (!enabled() || myRole() !== 'teacher') return;
    const panel = document.getElementById('teacherDashboard');
    if (!panel || document.getElementById('fluxAccomTeacher')) return;
    const sb = client();
    if (!sb || !window.currentUser) return;
    const { data: myClasses } = await sb.from('teacher_classes')
      .select('class_code,class_name').eq('teacher_id', window.currentUser.id).eq('active', true);
    if (!myClasses || !myClasses.length) return;
    const card = document.createElement('div');
    card.id = 'fluxAccomTeacher';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;padding:14px';
    card.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Accommodations</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:8px">Aggregate needs per class — details only where students consented (views are audited).</div>
      ${myClasses.map((c) => `<div style="margin-top:6px"><div style="font-size:.78rem;font-weight:700">${esc(c.class_name)}</div><div data-fac-class="${esc(c.class_code)}"></div></div>`).join('')}`;
    panel.appendChild(card);
    for (const c of myClasses) {
      const host = card.querySelector(`[data-fac-class="${CSS.escape(c.class_code)}"]`);
      const res = await teacherChips(c.class_code);
      if (res.ok && host) renderTeacherChips(host, c.class_code, res.chips || []);
    }
  }

  /* ── counselor: manager card ── */

  async function injectCounselorCard() {
    if (!enabled() || myRole() !== 'counselor') return;
    const panel = document.getElementById('counselorWorkspace') || document.getElementById('counselorDashboard');
    if (!panel || document.getElementById('fluxAccomCounselor')) return;
    const [rows, students] = await Promise.all([counselorList(), counselorStudents()]);
    const nameOf = new Map(students.map((s) => [s.user_id, s.display_name]));
    const card = document.createElement('div');
    card.id = 'fluxAccomCounselor';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;padding:16px';
    card.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Accommodations</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:10px">Teachers see aggregate chips only; per-student detail requires the consent you record here (set it WITH the student) and every view is audited.</div>
      <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;align-items:end">
        <label style="font-size:.72rem;color:var(--muted)">Student
          <select data-fac-student style="width:100%;margin-top:4px">${students.map((s) => `<option value="${esc(s.user_id)}">${esc(s.display_name)}</option>`).join('')}</select>
        </label>
        <label style="font-size:.72rem;color:var(--muted)">Kind
          <select data-fac-kind style="width:100%;margin-top:4px">${KINDS.map((k) => `<option>${esc(k)}</option>`).join('')}</select>
        </label>
        <label style="font-size:.72rem;color:var(--muted);grid-column:span 2">Note (never shown without consent)
          <input data-fac-note placeholder="e.g. 1.5x time on assessments" style="width:100%;margin-top:4px">
        </label>
        <label style="font-size:.72rem;color:var(--muted)">Visibility
          <select data-fac-consent style="width:100%;margin-top:4px">
            <option value="private">Private — aggregate chip only</option>
            <option value="staff_visible">Staff visible — student consented</option>
          </select>
        </label>
        <button type="button" data-fac-save style="padding:6px 14px">Save</button>
      </div>
      <div data-fac-list style="margin-top:12px">${rows.map((r) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--border);font-size:.78rem">
          <div style="flex:1"><strong>${esc(nameOf.get(r.student_id) || 'Student')}</strong> · ${esc(r.kind)}${r.note ? ` <span style="color:var(--muted2)">— ${esc(r.note)}</span>` : ''}</div>
          <span style="font-size:.64rem;padding:2px 8px;border-radius:8px;${r.consent_state === 'staff_visible' ? 'background:rgba(16,217,160,.12);color:var(--green)' : 'background:rgba(255,255,255,.06);color:var(--muted2)'}">${r.consent_state === 'staff_visible' ? 'staff visible' : 'private'}</span>
          <button type="button" data-fac-del="${esc(r.id)}" style="background:none;border:none;color:var(--muted);cursor:pointer">✕</button>
        </div>`).join('') || '<div style="font-size:.76rem;color:var(--muted)">None recorded yet.</div>'}</div>`;
    panel.appendChild(card);
    card.querySelector('[data-fac-save]').addEventListener('click', async () => {
      const r = await counselorSave({
        studentId: card.querySelector('[data-fac-student]').value,
        kind: card.querySelector('[data-fac-kind]').value,
        note: card.querySelector('[data-fac-note]').value.trim(),
        consentState: card.querySelector('[data-fac-consent]').value,
      });
      showToast?.(r.ok ? 'Accommodation saved' : 'Failed: ' + r.error, r.ok ? 'success' : 'error');
      if (r.ok) { card.remove(); injectCounselorCard(); }
    });
    card.querySelectorAll('[data-fac-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = await counselorDelete(b.dataset.facDel);
      showToast?.(r.ok ? 'Removed' : 'Failed', r.ok ? 'success' : 'error');
      if (r.ok) { card.remove(); injectCounselorCard(); }
    }));
  }

  /* ── student: transparency panel in Settings ── */

  function renderStudentPanel(host, rows, viewCount) {
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">What staff can see about me</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:10px">Accommodations your counselor recorded. Teachers of your classes see anonymous counts; the details below are shared only where marked, and every detail view is logged.</div>
      ${rows.length ? rows.map((r) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);font-size:.8rem">
          <div style="flex:1"><strong>${esc(r.kind)}</strong>${r.note ? `<div style="font-size:.72rem;color:var(--muted2)">${esc(r.note)}</div>` : ''}</div>
          <span style="font-size:.64rem;padding:2px 8px;border-radius:8px;${r.consent_state === 'staff_visible' ? 'background:rgba(16,217,160,.12);color:var(--green)' : 'background:rgba(255,255,255,.06);color:var(--muted2)'}">${r.consent_state === 'staff_visible' ? 'shared with my teachers' : 'private — count only'}</span>
        </div>`).join('') : '<div style="font-size:.78rem;color:var(--muted)">Nothing on file. Only your counselor can add accommodations.</div>'}
      ${viewCount ? `<div style="font-size:.7rem;color:var(--muted);margin-top:8px">Staff viewed your shared details ${viewCount} time${viewCount === 1 ? '' : 's'} (audited).</div>` : ''}
      <div style="font-size:.7rem;color:var(--muted2);margin-top:8px">Want something changed? Talk to your counselor — sharing is always your call.</div>`;
  }

  async function injectStudentPanel() {
    if (!enabled() || myRole() === 'teacher' || myRole() === 'counselor' || myRole() === 'admin') return;
    const panel = document.getElementById('spane-privacy') || document.getElementById('settings');
    if (!panel || document.getElementById('fluxAccomStudent')) return;
    if (!window.currentUser) return;
    const { rows, views } = await studentMine();
    if (!rows.length) return; // nothing on file — no empty card noise
    const host = document.createElement('div');
    host.id = 'fluxAccomStudent';
    host.className = 'card';
    host.style.cssText = 'margin-top:14px;padding:16px';
    panel.appendChild(host);
    renderStudentPanel(host, rows, views);
  }

  function boot() {
    document.addEventListener('flux-nav', (e) => {
      const p = e?.detail?.panel;
      if (!enabled()) return;
      if (p === 'teacherDashboard') setTimeout(injectTeacherCard, 500);
      if (p === 'counselorWorkspace' || p === 'counselorDashboard') setTimeout(injectCounselorCard, 500);
      if (p === 'settings') setTimeout(injectStudentPanel, 500);
    });
    // C5 supersedes P8.2's classroom_accommodations cheat-sheet (which shows
    // full need_to_know text to roster teachers with no consent gate or
    // audit). Districts must run ONE system — see P39 doc for the migration.
    setTimeout(() => {
      try {
        if (enabled() && window.FluxFeatureFlags?.isEnabled('classroom_accommodations', false)) {
          console.warn('[FluxAccommodations] Both enable_accommodation_cards (C5) and classroom_accommodations (P8.2 beta) are on — disable the P8.2 cheat-sheet; C5 is the consent-safe successor (docs/P39-ACCOMMODATION-CARDS.md).');
        }
      } catch (_) {}
    }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxAccommodations = {
    FLAG, enabled, KINDS,
    counselorList, counselorSave, counselorDelete,
    teacherChips, teacherDetails, studentMine,
    renderTeacherChips, openDetailModal, renderStudentPanel,
    injectTeacherCard, injectCounselorCard, injectStudentPanel,
  };
})();
