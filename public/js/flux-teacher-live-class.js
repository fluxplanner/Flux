/**
 * Teacher Start Class — immersive live session overlay.
 * Flag: enable_live_class_mode (default off).
 */
(function () {
  'use strict';

  const STORE_KEY = 'flux_live_class_session_v1';
  let _tick = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_live_class_mode', false);
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

  function loadSession() {
    try {
      const fs = window.FluxStorage;
      let raw = null;
      if (fs && typeof fs.load === 'function') raw = fs.load(STORE_KEY, null);
      else if (typeof load === 'function') raw = load(STORE_KEY, null);
      if (!raw || !raw.classId || !raw.startedAt) return null;
      return raw;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.save === 'function') fs.save(STORE_KEY, session);
      else if (typeof save === 'function') save(STORE_KEY, session);
    } catch (_) {}
  }

  function clearSession() {
    try {
      const fs = window.FluxStorage;
      if (fs && typeof fs.remove === 'function') fs.remove(STORE_KEY);
      else if (typeof save === 'function') save(STORE_KEY, null);
    } catch (_) {}
  }

  function formatElapsed(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function buildContextFromView({ cls, assignments, rosterStudents, rosterPending }) {
    const enrolled = (rosterStudents || []).length;
    const pending = (rosterPending || []).length;
    const asgs = (assignments || []).map((a) => {
      const subs = (a.student_completions || []).filter(
        (c) => c.status === 'submitted' || c.status === 'graded',
      ).length;
      const toReview = (a.student_completions || []).filter((c) => c.status === 'submitted').length;
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        due_date: a.due_date,
        subs,
        toReview,
        denom: Math.max(enrolled, 1),
      };
    });
    const dueSoon = asgs.filter((a) => {
      if (!a.due_date) return false;
      const due = new Date(`${a.due_date}T12:00:00`);
      const now = new Date();
      return due >= now && due <= new Date(Date.now() + 3 * 86400000);
    });
    const pendingReview = asgs.reduce((s, a) => s + a.toReview, 0);
    const sched =
      typeof window.fluxFormatTeacherClassSchedule === 'function'
        ? window.fluxFormatTeacherClassSchedule(cls)
        : '';
    return {
      classId: cls.id,
      className: cls.class_name || 'Class',
      classCode: cls.class_code || '',
      subject: cls.subject || '',
      schedule: sched,
      enrolled,
      pending,
      assignments: asgs,
      dueSoonCount: dueSoon.length,
      pendingReview,
    };
  }

  function renderAgendaList(ctx) {
    const items = (ctx.assignments || []).slice(0, 6);
    if (!items.length) {
      return '<p class="flux-live-class-empty">No assignments posted for this class yet.</p>';
    }
    return `<ul class="flux-live-class-agenda">${items
      .map((a) => {
        const pct = Math.round((a.subs / a.denom) * 100);
        const due = a.due_date
          ? new Date(`${a.due_date}T12:00:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'No due date';
        return `<li class="flux-live-class-agenda-row">
          <div class="flux-live-class-agenda-top">
            <span class="flux-live-class-agenda-type">${esc(a.type || 'task')}</span>
            <span class="flux-live-class-agenda-due">${esc(due)}</span>
          </div>
          <div class="flux-live-class-agenda-title">${esc(a.title || 'Assignment')}</div>
          <div class="flux-live-class-agenda-bar"><div style="width:${pct}%"></div></div>
          <div class="flux-live-class-agenda-meta">${a.subs}/${a.denom} turned in${a.toReview ? ` · ${a.toReview} to review` : ''}</div>
        </li>`;
      })
      .join('')}</ul>`;
  }

  function stopTick() {
    if (_tick) {
      clearInterval(_tick);
      _tick = null;
    }
  }

  function close() {
    stopTick();
    document.getElementById('fluxLiveClassOverlay')?.remove();
    document.body.classList.remove('flux-live-class-active');
  }

  function endClass() {
    clearSession();
    close();
    if (typeof window.showToast === 'function') {
      window.showToast('Class session ended', 'info', 2000);
    }
  }

  function open(ctx) {
    if (!enabled() || !ctx?.classId) return;
    close();
    document.getElementById('teacherClassPanel')?.remove();

    const existing = loadSession();
    const startedAt =
      existing && existing.classId === ctx.classId && existing.startedAt
        ? existing.startedAt
        : new Date().toISOString();
    const session = {
      classId: ctx.classId,
      className: ctx.className,
      classCode: ctx.classCode,
      startedAt,
      notes: existing && existing.classId === ctx.classId ? existing.notes || '' : '',
    };
    saveSession(session);

    const overlay = document.createElement('div');
    overlay.id = 'fluxLiveClassOverlay';
    overlay.className = 'flux-live-class-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Start Class');

    overlay.innerHTML = `
      <div class="flux-live-class-shell">
        <header class="flux-live-class-head">
          <div class="flux-live-class-head-main">
            <p class="flux-live-class-kicker">Live class</p>
            <h1 class="flux-live-class-title">${esc(ctx.className)}</h1>
            <p class="flux-live-class-sub">${esc(ctx.subject || '')}${ctx.schedule ? ` · ${esc(ctx.schedule)}` : ''}</p>
          </div>
          <div class="flux-live-class-timer-wrap">
            <div class="flux-live-class-timer" id="fluxLiveClassTimer" aria-live="polite">0:00</div>
            <div class="flux-live-class-timer-label">Elapsed</div>
          </div>
          <button type="button" class="flux-live-class-end" id="fluxLiveClassEnd">End class</button>
        </header>

        <div class="flux-live-class-stats">
          <div class="flux-live-class-stat"><span class="flux-live-class-stat-n">${ctx.enrolled}</span><span class="flux-live-class-stat-l">Enrolled</span></div>
          <div class="flux-live-class-stat"><span class="flux-live-class-stat-n">${ctx.dueSoonCount}</span><span class="flux-live-class-stat-l">Due ≤3d</span></div>
          <div class="flux-live-class-stat ${ctx.pendingReview ? 'flux-live-class-stat--alert' : ''}"><span class="flux-live-class-stat-n">${ctx.pendingReview}</span><span class="flux-live-class-stat-l">To review</span></div>
          ${ctx.pending ? `<div class="flux-live-class-stat flux-live-class-stat--warn"><span class="flux-live-class-stat-n">${ctx.pending}</span><span class="flux-live-class-stat-l">Join pending</span></div>` : ''}
        </div>

        <div class="flux-live-class-grid">
          <section class="flux-live-class-panel">
            <h2 class="flux-live-class-panel-title">Class agenda</h2>
            ${renderAgendaList(ctx)}
          </section>
          <section class="flux-live-class-panel">
            <h2 class="flux-live-class-panel-title">Session notes</h2>
            <p class="flux-live-class-panel-hint">Private to this device — not shared with students.</p>
            <textarea id="fluxLiveClassNotes" class="flux-live-class-notes" rows="8" placeholder="Lesson goals, reminders, exit ticket…" maxlength="2000">${esc(session.notes)}</textarea>
            <div class="flux-live-class-actions">
              <button type="button" class="flux-live-class-action" id="fluxLiveClassCopyCode">Copy code ${esc(ctx.classCode)}</button>
              <button type="button" class="flux-live-class-action" id="fluxLiveClassNewAsg">+ Assignment</button>
              <button type="button" class="flux-live-class-action" id="fluxLiveClassAnnounce">Announce</button>
              ${window.FluxTeacherLessonAI?.enabled?.() ? '<button type="button" class="flux-live-class-action" id="fluxLiveClassLessonAi">✨ Lesson plan</button>' : ''}
              ${window.FluxTeacherCopilot?.enabled?.() ? '<button type="button" class="flux-live-class-action" id="fluxLiveClassCopilot">✦ Copilot</button>' : ''}
            </div>
          </section>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.classList.add('flux-live-class-active');

    const tick = () => {
      const el = document.getElementById('fluxLiveClassTimer');
      if (!el) return;
      el.textContent = formatElapsed(Date.now() - new Date(startedAt).getTime());
    };
    tick();
    stopTick();
    _tick = setInterval(tick, 1000);

    overlay.querySelector('#fluxLiveClassEnd')?.addEventListener('click', endClass);
    overlay.querySelector('#fluxLiveClassCopyCode')?.addEventListener('click', () => {
      const code = ctx.classCode || '';
      if (!code) return;
      const done = () => {
        if (typeof window.showToast === 'function') window.showToast('Class code copied', 'success', 1600);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(() => {});
    });
    overlay.querySelector('#fluxLiveClassNewAsg')?.addEventListener('click', () => {
      if (typeof window.openCreateAssignmentModal === 'function') window.openCreateAssignmentModal(ctx.classId);
    });
    overlay.querySelector('#fluxLiveClassAnnounce')?.addEventListener('click', () => {
      if (typeof window.openTeacherAnnouncementModal === 'function') window.openTeacherAnnouncementModal();
    });
    overlay.querySelector('#fluxLiveClassLessonAi')?.addEventListener('click', () => {
      if (typeof window.FluxTeacherLessonAI?.open === 'function') {
        window.FluxTeacherLessonAI.open({
          classId: ctx.classId,
          className: ctx.className,
          subject: ctx.subject,
        });
      }
    });
    overlay.querySelector('#fluxLiveClassCopilot')?.addEventListener('click', () => {
      if (typeof window.FluxTeacherCopilot?.open === 'function') {
        window.FluxTeacherCopilot.open(ctx);
      }
    });
    const notesEl = overlay.querySelector('#fluxLiveClassNotes');
    notesEl?.addEventListener(
      'input',
      () => {
        saveSession({ ...session, notes: notesEl.value.slice(0, 2000) });
      },
      { passive: true },
    );

    try {
      if (typeof window.FluxBus !== 'undefined') {
        window.FluxBus.emit('live_class_started', { class_id: ctx.classId });
      }
    } catch (_) {}
  }

  function resumeChipHtml() {
    const s = loadSession();
    if (!enabled() || !s) return '';
    return `<button type="button" id="fluxLiveClassResume" class="flux-live-class-resume" title="Resume live class">
      <span class="flux-live-class-resume-dot" aria-hidden="true"></span>
      Live: ${esc(s.className || 'Class')}
    </button>`;
  }

  function wireResumeChip(host) {
    if (!host || !enabled()) return;
    host.querySelector('#fluxLiveClassResume')?.addEventListener('click', () => {
      const sid = loadSession()?.classId;
      if (typeof window.openTeacherClassView === 'function' && sid) {
        window.openTeacherClassView(sid, { autoStartLive: true });
      }
    });
  }

  function startButtonHtml() {
    if (!enabled()) return '';
    return '<button type="button" id="tcvStartClass" class="teacher-action-btn flux-live-class-start-btn">▶ Start Class</button>';
  }

  function install() {
    if (!enabled()) return false;
    return true;
  }

  window.FluxTeacherLiveClass = {
    STORE_KEY,
    enabled,
    loadSession,
    buildContextFromView,
    open,
    close,
    endClass,
    startButtonHtml,
    resumeChipHtml,
    wireResumeChip,
    install,
  };
})();
