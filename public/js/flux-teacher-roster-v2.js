/**
 * Teacher roster v2 — class-scoped roster tab, copy code, per-class pending joins.
 * Flag: enable_teacher_roster_v2 (default off).
 * Student join: when on, creates pending class_join_requests (teacher approves).
 */
(function () {
  'use strict';

  const _countsByClassId = new Map();

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_roster_v2', false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normCode(code) {
    return String(code || '')
      .trim()
      .toUpperCase();
  }

  /** Only students enrolled in this class_code (teacher-owned). */
  function filterStudentsForClass(students, cls) {
    if (!cls) return [];
    const code = normCode(cls.class_code);
    const teacherId = cls.teacher_id;
    return (students || []).filter((s) => {
      if (!s || s.active === false) return false;
      if (teacherId && s.teacher_id && s.teacher_id !== teacherId) return false;
      if (code && normCode(s.class_code) !== code) return false;
      return true;
    });
  }

  async function loadPendingForClass(sb, teacherId, classId) {
    if (!sb || !teacherId || !classId) return [];
    try {
      const { data } = await sb
        .from('class_join_requests')
        .select('id,created_at,student_id,student_note')
        .eq('teacher_id', teacherId)
        .eq('class_id', classId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return data || [];
    } catch (_) {
      return [];
    }
  }

  async function prefetchRosterCounts(sb, teacherId, classesRows) {
    _countsByClassId.clear();
    if (!sb || !teacherId || !classesRows?.length) return;
    const codeToClassId = {};
    classesRows.forEach((c) => {
      const code = normCode(c.class_code);
      if (code && c.id) codeToClassId[code] = c.id;
    });
    try {
      const { data: roster } = await sb
        .from('teacher_students')
        .select('class_code,active')
        .eq('teacher_id', teacherId)
        .eq('active', true);
      (roster || []).forEach((r) => {
        const cid = codeToClassId[normCode(r.class_code)];
        if (!cid) return;
        const cur = _countsByClassId.get(cid) || { enrolled: 0, pending: 0 };
        cur.enrolled += 1;
        _countsByClassId.set(cid, cur);
      });
    } catch (_) {}
    try {
      const ids = classesRows.map((c) => c.id).filter(Boolean);
      if (ids.length) {
        const { data: pending } = await sb
          .from('class_join_requests')
          .select('class_id')
          .eq('teacher_id', teacherId)
          .eq('status', 'pending')
          .in('class_id', ids);
        (pending || []).forEach((p) => {
          if (!p.class_id) return;
          const cur = _countsByClassId.get(p.class_id) || { enrolled: 0, pending: 0 };
          cur.pending += 1;
          _countsByClassId.set(p.class_id, cur);
        });
      }
    } catch (_) {}
  }

  function formatClassCardMeta(classId) {
    if (!enabled() || !classId) return '';
    const c = _countsByClassId.get(classId);
    if (!c) return '';
    const parts = [];
    if (c.enrolled) parts.push(`${c.enrolled} enrolled`);
    if (c.pending) parts.push(`${c.pending} pending`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }

  function displayName(nameMap, studentId) {
    const meta = nameMap?.[studentId] || {};
    return meta.display_name || `Student ${String(studentId || '').slice(0, 6)}`;
  }

  function renderStudentsTabHtml({ cls, students, pending, nameMap }) {
    const code = esc(cls?.class_code || '');
    const enrolled = students?.length || 0;
    const pend = pending?.length || 0;

    const pendingHtml =
      pend > 0
        ? `<div class="flux-roster-pending-block">
        <p class="flux-roster-pending-title">Waiting to join (${pend})</p>
        ${pending
          .map((r) => {
            const sn = esc(displayName(nameMap, r.student_id));
            return `<div class="flux-roster-pending-row" data-roster-pending="${esc(r.id)}">
            <div class="flux-roster-pending-name">${sn}</div>
            ${r.student_note ? `<div class="flux-roster-pending-note">“${esc(r.student_note)}”</div>` : ''}
            <div class="flux-roster-pending-actions">
              <button type="button" class="teacher-action-btn primary flux-roster-approve" data-jr="${esc(r.id)}">Approve</button>
              <button type="button" class="teacher-action-btn flux-roster-reject" data-jr="${esc(r.id)}" style="border-color:rgba(255,77,109,.35);color:var(--red)">Reject</button>
            </div>
          </div>`;
          })
          .join('')}
      </div>`
        : '';

    const listHtml =
      enrolled === 0 && pend === 0
        ? `<div class="teacher-empty"><div class="te-icon">👥</div><div class="te-title">No students yet</div><div class="te-sub">Share your class code — students appear here after they join or you approve a request.</div></div>`
        : students
            .map((s) => {
              const dn = displayName(nameMap, s.student_id);
              const meta = nameMap?.[s.student_id] || {};
              const joined = s.joined_at
                ? new Date(s.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '';
              return `<div class="flux-roster-student-row">
              <div class="flux-roster-avatar">${esc((dn[0] || 'S').toUpperCase())}</div>
              <div style="flex:1">
                <div style="font-size:.85rem;font-weight:600">${esc(dn)}</div>
                <div class="flux-roster-student-meta">${meta.grade_level ? `Grade ${esc(String(meta.grade_level))}` : 'Student'}${joined ? ` · Joined ${esc(joined)}` : ''}</div>
              </div>
              <button type="button" class="tcv-msg-btn" data-stu="${esc(s.student_id)}" style="padding:5px 10px;font-size:.75rem">Message</button>
            </div>`;
            })
            .join('');

    return `
      <div class="flux-roster-code-card">
        <div>
          <p class="flux-roster-code-label">Class join code</p>
          <div class="flux-roster-code-value" data-roster-code>${code}</div>
          <p style="font-size:.7rem;color:var(--muted2);margin:6px 0 0">Students enter this in School → Join a Teacher Class</p>
        </div>
        <div class="flux-roster-code-actions">
          <button type="button" class="flux-roster-copy-btn" data-roster-copy>Copy code</button>
        </div>
      </div>
      <div class="flux-roster-stats">
        <span class="flux-roster-stat-pill">${enrolled} enrolled</span>
        ${pend ? `<span class="flux-roster-stat-pill flux-roster-stat-pill--pending">${pend} pending</span>` : ''}
      </div>
      ${pendingHtml}
      ${listHtml}`;
  }

  function wireStudentsTab(host, { classId }) {
    if (!host || !enabled()) return;
    host.querySelector('[data-roster-copy]')?.addEventListener('click', () => {
      const code = host.querySelector('[data-roster-code]')?.textContent?.trim();
      if (!code) return;
      const done = () => {
        if (typeof window.showToast === 'function') window.showToast('Class code copied', 'success', 1800);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(() => {});
      } else if (typeof window.showToast === 'function') {
        window.showToast(code, 'info', 3000);
      }
    });
    host.querySelectorAll('.flux-roster-approve').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof window.resolveJoinRequest === 'function') {
          window.resolveJoinRequest(btn.getAttribute('data-jr'), 'approved', classId);
        }
      });
    });
    host.querySelectorAll('.flux-roster-reject').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof window.resolveJoinRequest === 'function') {
          window.resolveJoinRequest(btn.getAttribute('data-jr'), 'rejected', classId);
        }
      });
    });
  }

  function joinButtonHtml() {
    if (!enabled()) return null;
    return '🔗 Join a Teacher Class (request approval)';
  }

  async function submitStudentJoinRequest(sb, userId, code, note) {
    const norm = normCode(code);
    if (norm.length !== 6) return { ok: false, error: 'invalid_code' };
    const preview =
      typeof window.fluxLookupClassByCode === 'function'
        ? await window.fluxLookupClassByCode(sb, norm)
        : null;
    if (!preview?.id) return { ok: false, error: 'invalid_code' };

    try {
      const { data: enr } = await sb
        .from('teacher_students')
        .select('id')
        .eq('student_id', userId)
        .eq('class_code', preview.class_code)
        .eq('active', true)
        .maybeSingle();
      if (enr?.id) return { ok: false, error: 'already_enrolled', className: preview.class_name };
    } catch (_) {}

    try {
      const { data: existing } = await sb
        .from('class_join_requests')
        .select('id,status')
        .eq('class_id', preview.id)
        .eq('student_id', userId)
        .maybeSingle();
      if (existing?.status === 'pending') {
        return { ok: false, error: 'pending_exists', className: preview.class_name };
      }
    } catch (_) {}

    const { error } = await sb.from('class_join_requests').insert({
      class_id: preview.id,
      student_id: userId,
      teacher_id: preview.teacher_id,
      student_note: note || null,
      status: 'pending',
    });
    if (error) {
      if (String(error.message || '').includes('duplicate')) {
        return { ok: false, error: 'pending_exists', className: preview.class_name };
      }
      return { ok: false, error: 'request_failed', message: error.message };
    }
    return { ok: true, className: preview.class_name, classId: preview.id, classCode: preview.class_code };
  }

  window.FluxTeacherRosterV2 = {
    enabled,
    filterStudentsForClass,
    loadPendingForClass,
    prefetchRosterCounts,
    formatClassCardMeta,
    renderStudentsTabHtml,
    wireStudentsTab,
    joinButtonHtml,
    submitStudentJoinRequest,
  };
})();
