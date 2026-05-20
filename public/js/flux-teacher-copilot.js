/**
 * Teacher copilot — class-scoped AI side panel (aggregates in context, no student names).
 * Flag: enable_teacher_copilot (default off).
 */
(function () {
  'use strict';

  let _messages = [];
  let _classCtx = null;
  let _open = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_teacher_copilot', false);
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

  function formatReply(raw) {
    if (typeof window.fmtAI === 'function') return window.fmtAI(raw);
    return esc(raw).replace(/\n/g, '<br>');
  }

  function contextSummary(ctx) {
    if (!ctx) return 'No class selected — choose a class for scoped advice.';
    const parts = [
      ctx.className ? `Class: ${ctx.className}` : '',
      ctx.subject ? `Subject: ${ctx.subject}` : '',
      ctx.schedule ? `Schedule: ${ctx.schedule}` : '',
      ctx.enrolled != null ? `${ctx.enrolled} students enrolled` : '',
      ctx.assignmentCount != null ? `${ctx.assignmentCount} assignments` : '',
      ctx.dueSoonCount != null ? `${ctx.dueSoonCount} due within 3 days` : '',
      ctx.pendingReview != null ? `${ctx.pendingReview} submissions to review` : '',
      ctx.pendingJoins != null && ctx.pendingJoins > 0 ? `${ctx.pendingJoins} pending join requests` : '',
    ].filter(Boolean);
    return parts.join(' · ') || 'Class context loaded.';
  }

  function buildContextFromView({ cls, assignments, rosterStudents, rosterPending }) {
    if (!cls) return null;
    const enrolled = (rosterStudents || []).length;
    const asgs = assignments || [];
    const dueSoon = asgs.filter((a) => {
      if (!a.due_date) return false;
      const due = new Date(`${a.due_date}T12:00:00`);
      const now = new Date();
      return due >= now && due <= new Date(Date.now() + 3 * 86400000);
    });
    let pendingReview = 0;
    asgs.forEach((a) => {
      pendingReview += (a.student_completions || []).filter((c) => c.status === 'submitted').length;
    });
    const sched =
      typeof window.fluxFormatTeacherClassSchedule === 'function'
        ? window.fluxFormatTeacherClassSchedule(cls)
        : '';
    return {
      classId: cls.id,
      className: cls.class_name || 'Class',
      subject: cls.subject || '',
      schedule: sched,
      enrolled,
      assignmentCount: asgs.length,
      dueSoonCount: dueSoon.length,
      pendingReview,
      pendingJoins: (rosterPending || []).length,
      assignmentTitles: asgs.slice(0, 8).map((a) => a.title).filter(Boolean),
    };
  }

  function systemPrompt(ctx) {
    const block = ctx
      ? `Current class context (aggregates only — do not invent student names or grades):\n${contextSummary(ctx)}\n${
          ctx.assignmentTitles?.length
            ? `Recent assignment titles: ${ctx.assignmentTitles.join('; ')}`
            : ''
        }`
      : 'No class is selected. Give general teaching advice and suggest the teacher pick a class for specifics.';
    return (
      'You are Flux Teacher Copilot — a concise instructional coach for K-12 teachers. ' +
      'Use the class context when provided. Prefer bullet points. No diagnosis of students. ' +
      'Do not claim to see individual student identities. Keep replies under 250 words unless asked for detail.\n\n' +
      block
    );
  }

  async function chat(userText, ctx) {
    const messages = [
      { role: 'system', content: systemPrompt(ctx) },
      ..._messages.slice(-12).map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: userText },
    ];
    if (typeof window.fluxAuthHeaders !== 'function' || typeof API === 'undefined' || !API.ai) {
      throw new Error('AI unavailable');
    }
    const res = await fetch(API.ai, {
      method: 'POST',
      headers: await window.fluxAuthHeaders(),
      body: JSON.stringify({ messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return String(data.content?.[0]?.text || '').trim();
  }

  function ensureShell() {
    if (document.getElementById('fluxTeacherCopilotPanel')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'fluxTeacherCopilotBackdrop';
    backdrop.className = 'flux-tcopilot-backdrop';
    backdrop.addEventListener('click', close);

    const panel = document.createElement('div');
    panel.id = 'fluxTeacherCopilotPanel';
    panel.className = 'flux-tcopilot-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Teacher copilot');
    panel.innerHTML = `
      <header class="flux-tcopilot-head">
        <div>
          <h2 class="flux-tcopilot-title">Teacher copilot</h2>
          <p class="flux-tcopilot-sub">Class-scoped · aggregates only</p>
        </div>
        <button type="button" class="flux-tcopilot-close" data-tcopilot-close aria-label="Close">✕</button>
      </header>
      <div class="flux-tcopilot-scope">
        <label for="fluxTcopilotClass">Class scope</label>
        <select id="fluxTcopilotClass" class="flux-tcopilot-select"><option value="">General (no class)</option></select>
        <p id="fluxTcopilotContext" class="flux-tcopilot-context"></p>
      </div>
      <div class="flux-tcopilot-chips">
        <button type="button" class="flux-tcopilot-chip" data-prompt="What should I prioritize in this class today?">Today's focus</button>
        <button type="button" class="flux-tcopilot-chip" data-prompt="Draft a short class announcement (2-3 sentences) based on current workload.">Draft announce</button>
        <button type="button" class="flux-tcopilot-chip" data-prompt="Suggest a 5-minute warm-up aligned to my next lesson.">Warm-up idea</button>
      </div>
      <div id="fluxTcopilotMessages" class="flux-tcopilot-messages"></div>
      <div class="flux-tcopilot-compose">
        <textarea id="fluxTcopilotInput" class="flux-tcopilot-input" rows="3" placeholder="Ask about this class…" maxlength="1200"></textarea>
        <button type="button" id="fluxTcopilotSend" class="flux-tcopilot-send">Send</button>
        <p class="flux-tcopilot-foot">Not shared with students · review AI output before use</p>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    panel.querySelector('[data-tcopilot-close]')?.addEventListener('click', close);
    panel.querySelector('#fluxTcopilotSend')?.addEventListener('click', () => send());
    panel.querySelector('#fluxTcopilotInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    panel.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = panel.querySelector('#fluxTcopilotInput');
        if (inp) inp.value = btn.getAttribute('data-prompt') || '';
        send();
      });
    });
    panel.querySelector('#fluxTcopilotClass')?.addEventListener('change', onClassSelect);
  }

  function ensureFab() {
    if (!enabled() || document.getElementById('fluxTeacherCopilotFab')) return;
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'fluxTeacherCopilotFab';
    fab.className = 'flux-tcopilot-fab';
    fab.textContent = '✦ Copilot';
    fab.title = 'Teacher copilot';
    fab.addEventListener('click', () => open());
    document.body.appendChild(fab);
  }

  function renderMessages() {
    const el = document.getElementById('fluxTcopilotMessages');
    if (!el) return;
    if (!_messages.length) {
      el.innerHTML =
        '<div class="flux-tcopilot-msg flux-tcopilot-msg--bot">Ask about lesson pacing, announcements, or what to review — context uses class aggregates only.</div>';
      return;
    }
    el.innerHTML = _messages
      .map((m) => {
        const cls = m.role === 'user' ? 'flux-tcopilot-msg--user' : 'flux-tcopilot-msg--bot';
        const body = m.role === 'user' ? esc(m.text) : formatReply(m.text);
        return `<div class="flux-tcopilot-msg ${cls}">${body}</div>`;
      })
      .join('');
    el.scrollTop = el.scrollHeight;
  }

  function updateContextLine() {
    const line = document.getElementById('fluxTcopilotContext');
    if (line) line.textContent = contextSummary(_classCtx);
  }

  async function loadClassOptions(preselectId) {
    const sel = document.getElementById('fluxTcopilotClass');
    if (!sel) return;
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const uid =
      typeof window.currentUser !== 'undefined' && window.currentUser
        ? window.currentUser.id
        : null;
    if (!sb || !uid) return;
    try {
      const { data } = await sb
        .from('teacher_classes')
        .select('id,class_name,subject,class_code,period,time_start,time_end,days')
        .eq('teacher_id', uid)
        .eq('active', true)
        .order('class_name');
      const rows = data || [];
      sel.innerHTML =
        '<option value="">General (no class)</option>' +
        rows
          .map(
            (c) =>
              `<option value="${esc(c.id)}"${preselectId === c.id ? ' selected' : ''}>${esc(c.class_name || 'Class')}</option>`,
          )
          .join('');
    } catch (_) {}
  }

  async function loadContextForClassId(classId) {
    if (!classId) {
      _classCtx = null;
      updateContextLine();
      return;
    }
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const uid =
      typeof window.currentUser !== 'undefined' && window.currentUser ? window.currentUser.id : null;
    if (!sb || !uid) return;
    try {
      const classRes = await sb
        .from('teacher_classes')
        .select('*')
        .eq('id', classId)
        .eq('teacher_id', uid)
        .maybeSingle();
      const cls = classRes.data;
      if (!cls) return;
      const [asgRes, stuRes] = await Promise.all([
        sb
          .from('teacher_assignments')
          .select('id,title,due_date,student_completions(status)')
          .eq('class_id', classId)
          .eq('teacher_id', uid),
        sb.from('teacher_students').select('student_id').eq('teacher_id', uid).eq('class_code', cls.class_code || ''),
      ]);
      let rosterPending = [];
      if (window.FluxTeacherRosterV2?.loadPendingForClass) {
        rosterPending = await window.FluxTeacherRosterV2.loadPendingForClass(sb, uid, classId);
      }
      const students = window.FluxTeacherRosterV2?.filterStudentsForClass
        ? window.FluxTeacherRosterV2.filterStudentsForClass(stuRes.data || [], cls)
        : stuRes.data || [];
      _classCtx = buildContextFromView({
        cls,
        assignments: asgRes.data || [],
        rosterStudents: students,
        rosterPending,
      });
      updateContextLine();
    } catch (e) {
      console.warn('[FluxTeacherCopilot] loadContext', e);
    }
  }

  function onClassSelect() {
    const id = document.getElementById('fluxTcopilotClass')?.value || '';
    loadContextForClassId(id || null);
  }

  async function send() {
    const inp = document.getElementById('fluxTcopilotInput');
    const text = inp?.value?.trim();
    if (!text) return;
    const btn = document.getElementById('fluxTcopilotSend');
    if (btn) btn.disabled = true;
    if (inp) inp.value = '';
    _messages.push({ role: 'user', text });
    renderMessages();
    const think = document.createElement('div');
    think.className = 'flux-tcopilot-msg flux-tcopilot-msg--bot';
    think.innerHTML = '<div class="flux-tcopilot-thinking"><span></span><span></span><span></span></div>';
    document.getElementById('fluxTcopilotMessages')?.appendChild(think);
    try {
      const reply = await chat(text, _classCtx);
      think.remove();
      _messages.push({ role: 'assistant', text: reply });
      renderMessages();
    } catch (e) {
      think.remove();
      _messages.push({
        role: 'assistant',
        text: e.message || 'Could not reach Flux AI. Check your connection or daily limit.',
      });
      renderMessages();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function open(ctx) {
    if (!enabled()) return;
    ensureShell();
    ensureFab();
    _open = true;
    document.body.classList.add('flux-tcopilot-open');
    await loadClassOptions(ctx?.classId || _classCtx?.classId || '');
    if (ctx?.classId) {
      const sel = document.getElementById('fluxTcopilotClass');
      if (sel) sel.value = ctx.classId;
      if (ctx.className && ctx.enrolled != null) {
        _classCtx = ctx;
        updateContextLine();
      } else {
        await loadContextForClassId(ctx.classId);
      }
    } else if (_classCtx?.classId) {
      await loadContextForClassId(_classCtx.classId);
    } else {
      updateContextLine();
    }
    renderMessages();
  }

  function close() {
    _open = false;
    document.body.classList.remove('flux-tcopilot-open');
  }

  function toggle() {
    if (_open) close();
    else open();
  }

  function dashboardButtonHtml() {
    if (!enabled()) return '';
    return '<button type="button" class="teacher-action-btn" data-action="teacher-copilot"><span>✦</span> Copilot</button>';
  }

  function classButtonHtml() {
    if (!enabled()) return '';
    return '<button type="button" class="teacher-action-btn flux-tcopilot-class-btn" id="tcvCopilot">✦ Copilot</button>';
  }

  function install() {
    if (!enabled()) return false;
    ensureFab();
    return true;
  }

  window.FluxTeacherCopilot = {
    enabled,
    open,
    close,
    toggle,
    buildContextFromView,
    dashboardButtonHtml,
    classButtonHtml,
    install,
  };
})();
