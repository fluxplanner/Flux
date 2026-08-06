/**
 * C10 — Ask-Your-Teacher Handoff (flag enable_ask_teacher).
 *
 * On any task linked to a class with a joined teacher class: "Ask my
 * teacher" composes a CONTEXT CARD — task, class, due date, "what I
 * tried" — fully student-editable before send, then delivers it through
 * the existing staff-messaging pipeline (fluxEnsureThreadAndSend →
 * flux_threads/flux_messages, participant-only RLS). The handoff is
 * student-initiated, so the card's content is consented by construction;
 * nothing is sent the student didn't see in the preview.
 *
 * Teacher side: a triage queue card in Lesson Hub groups marker-prefixed
 * asks from the last 7 days by student (name + task line only) with an
 * "Open messages" CTA. Rate limit: 3 asks per student per day
 * (flux_ask_teacher_v1, registered) with calm copy when reached.
 */
(function () {
  'use strict';
  if (window.FluxAskTeacher) return;

  const FLAG = 'enable_ask_teacher';
  const KEY = 'flux_ask_teacher_v1';
  const MARKER = '📚 Question about:';
  const DAILY_LIMIT = 3;

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function todayISO() { return typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10); }

  /* ── rate limit (per student per day) ── */

  function asksLeftToday() {
    const s = ls(KEY, null) || {};
    if (s.date !== todayISO()) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - (s.count || 0));
  }
  function recordAsk() {
    const s = ls(KEY, null) || {};
    const today = todayISO();
    lsSave(KEY, { date: today, count: s.date === today ? (s.count || 0) + 1 : 1 });
  }

  /* ── task → class → teacher resolution ── */

  function classForTask(task) {
    if (!task || !/^CLS/.test(String(task.subject || ''))) return null;
    const id = Number(String(task.subject).slice(3));
    return (window.classes || []).find((c) => c.id === id) || null;
  }

  async function teacherForClass(cls) {
    const sb = client();
    if (!sb || !cls || !cls.teacherClassCode) return null;
    try {
      const { data } = await sb.from('teacher_classes')
        .select('teacher_id, class_name')
        .eq('class_code', cls.teacherClassCode).eq('active', true).maybeSingle();
      return data?.teacher_id ? data : null;
    } catch (_) { return null; }
  }

  /** The exact message body — nothing hidden beyond what the preview shows. */
  function composeMessage(task, cls, tried) {
    const due = task.date ? ` · due ${task.date}` : '';
    const lines = [
      `${MARKER} ${task.name} (${cls.name}${due})`,
      '',
      `What I tried: ${String(tried || '').trim() || '(not filled in)'}`,
    ];
    return lines.join('\n').slice(0, 2000);
  }

  /* ── student composer ── */

  async function openForTask(taskId) {
    if (!enabled()) return false;
    const task = (window.tasks || []).find((t) => t.id === taskId);
    const cls = classForTask(task);
    if (!task || !cls) return false;
    if (!asksLeftToday()) {
      showToast?.("You've reached today's 3 teacher questions — collect your thoughts and ask fresh tomorrow, or catch them in class.", 'info', 7000);
      return false;
    }
    const teacher = await teacherForClass(cls);
    if (!teacher) {
      showToast?.('No joined teacher class found for ' + cls.name + ' — join with a class code first (School tab).', 'info', 7000);
      return false;
    }
    const m = document.createElement('div');
    m.id = 'fluxAskTeacherModal';
    m.className = 'modal-overlay';
    m.style.display = 'flex';
    m.innerHTML = `<div class="modal-card" style="max-width:520px">
      <div class="modal-title">Ask my teacher</div>
      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:10px">Your teacher sees exactly the card below — edit it before sending. ${asksLeftToday()} of ${DAILY_LIMIT} questions left today.</div>
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:.82rem">
        <div><strong>${esc(task.name)}</strong> · ${esc(cls.name)}${task.date ? ' · due ' + esc(task.date) : ''}</div>
        <label style="display:block;font-size:.72rem;color:var(--muted);margin-top:10px">What I tried
          <textarea data-at-tried rows="3" placeholder="e.g. Re-read ch. 7 and tried problems 1–4, stuck on the last step of #3" style="width:100%;margin-top:4px;font-size:.8rem"></textarea>
        </label>
      </div>
      <div class="mactions" style="margin-top:12px">
        <button type="button" class="btn-sec" data-at-cancel>Cancel</button>
        <button type="button" data-at-send>Send to my teacher</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    try { window.FluxA11y?.trapFocus?.(m); } catch (_) {}
    const close = () => { try { window.FluxA11y?.releaseFocus?.(m); } catch (_) {} m.remove(); };
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('[data-at-cancel]').addEventListener('click', close);
    m.querySelector('[data-at-send]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const tried = m.querySelector('[data-at-tried]').value;
      const ok = typeof fluxEnsureThreadAndSend === 'function'
        && await fluxEnsureThreadAndSend(teacher.teacher_id, composeMessage(task, cls, tried));
      if (ok) {
        recordAsk();
        try { window.FluxTelemetry?.track?.('ask_teacher_sent', {}); } catch (_) {}
        showToast?.('Sent — your teacher will see it in Messages.', 'success');
        close();
      } else {
        btn.disabled = false;
        showToast?.('Could not send right now — try again in a moment.', 'error');
      }
    });
    return true;
  }

  /* ── edit-modal chip (wraps the global openEdit) ── */

  function decorateEditModal(taskId) {
    document.getElementById('fluxAskTeacherChip')?.remove();
    if (!enabled()) return;
    const task = (window.tasks || []).find((t) => t.id === taskId);
    const cls = classForTask(task);
    if (!task || !cls || !cls.teacherClassCode) return;
    const anchor = document.getElementById('editNotes');
    if (!anchor || !anchor.parentElement) return;
    const chip = document.createElement('button');
    chip.id = 'fluxAskTeacherChip';
    chip.type = 'button';
    chip.className = 'btn-sec';
    chip.style.cssText = 'margin-top:8px;padding:6px 12px;font-size:.76rem';
    chip.textContent = '🙋 Ask my teacher about this';
    chip.addEventListener('click', () => openForTask(taskId));
    anchor.parentElement.appendChild(chip);
  }

  function wireOpenEdit() {
    if (typeof window.openEdit !== 'function' || window.openEdit._askWired) return;
    const orig = window.openEdit;
    const wrapped = function (id) {
      const r = orig.apply(this, arguments);
      try { decorateEditModal(id); } catch (_) {}
      return r;
    };
    wrapped._askWired = true;
    window.openEdit = wrapped;
  }

  /* ── teacher triage queue (Lesson Hub) ── */

  function renderQueue(host, items) {
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Student questions</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:6px">Asked from tasks in your classes this week.</div>
      ${items.length ? items.map((q) => `
        <div style="display:flex;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid var(--border);font-size:.78rem">
          <strong style="white-space:nowrap">${esc(q.student)}</strong>
          <span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.line)}</span>
        </div>`).join('') : '<div style="font-size:.76rem;color:var(--muted)">No open questions. 🎉</div>'}
      <button type="button" class="btn-sec" data-at-open style="margin-top:10px;padding:5px 12px;font-size:.74rem">Open messages</button>`;
    host.querySelector('[data-at-open]').addEventListener('click', () => { try { nav('staffMessages'); } catch (_) {} });
  }

  async function injectQueue() {
    if (!enabled()) return;
    const role = (() => { try { return typeof getMyRole === 'function' ? getMyRole() : ''; } catch (_) { return ''; } })();
    if (role !== 'teacher') return;
    const panel = document.getElementById('lessonHub');
    if (!panel) return;
    document.getElementById('fluxAskQueue')?.remove();
    const sb = client();
    if (!sb || !window.currentUser) return;
    let items = [];
    try {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: msgs } = await sb.from('flux_messages')
        .select('sender_id, content, created_at')
        .eq('recipient_id', window.currentUser.id)
        .gte('created_at', since)
        .like('content', MARKER + '%')
        .order('created_at', { ascending: false })
        .limit(30);
      if (msgs && msgs.length) {
        const ids = [...new Set(msgs.map((x) => x.sender_id))];
        const names = typeof fluxFetchStudentNames === 'function'
          ? await fluxFetchStudentNames(sb, ids) : {};
        items = msgs.map((x) => ({
          student: names[x.sender_id]?.display_name || 'Student',
          line: String(x.content).split('\n')[0].replace(MARKER, '').trim(),
        }));
      }
    } catch (_) {}
    const host = document.createElement('div');
    host.id = 'fluxAskQueue';
    host.className = 'card';
    host.style.cssText = 'margin-top:14px;padding:14px';
    panel.appendChild(host);
    renderQueue(host, items);
  }

  function boot() {
    wireOpenEdit();
    setTimeout(wireOpenEdit, 2000);
    document.addEventListener('flux-nav', (e) => {
      if (e?.detail?.panel === 'lessonHub' && enabled()) setTimeout(injectQueue, 500);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxAskTeacher = {
    FLAG, enabled, MARKER, DAILY_LIMIT,
    asksLeftToday, composeMessage, classForTask,
    openForTask, renderQueue, injectQueue,
    _key: KEY,
  };
})();
