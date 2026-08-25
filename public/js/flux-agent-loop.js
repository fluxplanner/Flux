/**
 * Flux Agent Loop — makes Flux AI agentic (Claude-style act → observe → continue).
 *
 * Additive layer over flux-ai-orchestrator.js. Three jobs:
 *
 *  1. TOOLS — registers a full planner tool belt (tasks CRUD, notes, stats,
 *     navigation, Study Hub bridge) into FluxOrchestrator's existing
 *     ```flux_tool``` registry, so the model can read AND change the planner.
 *
 *  2. LOOP — wraps FluxOrchestrator.executeTool to buffer each tool result for
 *     the current turn. app.js sendAI() drains the buffer and feeds results
 *     back to the model as a hidden "TOOL RESULTS" message, so the model sees
 *     what its tools returned and can keep reasoning — the missing half of the
 *     agent loop (results used to render as a card and go nowhere).
 *
 *  3. ASK ANYWHERE — window.askFlux(prompt, opts) global + a floating
 *     "✦ Ask Flux" chip on text selection, so every panel can hand context to
 *     Flux in one tap.
 *
 * Depends on app.js globals (tasks, notes, save, syncKey, render*, nav,
 * calcUrgency, getSubjects, sendAI, openFluxAgent) — all guarded.
 */
(function () {
  'use strict';
  if (window.FluxAgentLoop) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strip = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const todayISO = () => (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10));

  /* ════════════════════════ 1. PLANNER TOOL BELT ═══════════════════════ */

  const haveTasks = () => typeof tasks !== 'undefined' && Array.isArray(tasks);
  const haveNotes = () => typeof notes !== 'undefined' && Array.isArray(notes);
  function persistTasks() {
    try { save('tasks', tasks); } catch (e) {}
    try { if (typeof syncKey === 'function') syncKey('tasks', tasks); } catch (e) {}
    try { if (typeof renderTasks === 'function') renderTasks(); } catch (e) {}
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (e) {}
    try { if (typeof renderStats === 'function') renderStats(); } catch (e) {}
  }
  function persistNotes() {
    try { save('flux_notes', notes); } catch (e) {}
    try { if (typeof syncKey === 'function') syncKey('notes', notes); } catch (e) {}
    try { if (typeof renderNotesList === 'function') renderNotesList(); } catch (e) {}
  }
  function findTask(ref) {
    if (!haveTasks() || ref == null) return null;
    const byId = tasks.find((t) => String(t.id) === String(ref));
    if (byId) return byId;
    const q = String(ref).toLowerCase();
    return tasks.find((t) => !t.done && (t.name || '').toLowerCase().includes(q)) ||
           tasks.find((t) => (t.name || '').toLowerCase().includes(q)) || null;
  }
  const taskRow = (t) => ({
    id: t.id, name: t.name, date: t.date || '', priority: t.priority || 'med',
    subject: t.subject || '', type: t.type || '', estTime: t.estTime || 0,
    done: !!t.done, notes: (t.notes || '').slice(0, 140),
  });

  const TOOLS = {
    listTasks: {
      def: { name: 'listTasks', description: 'List planner tasks. filter: "today"|"overdue"|"week"|"all"|"done"; optional subject key; limit (default 20).', params: '{filter?,subject?,limit?}' },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        a = a || {};
        const today = todayISO();
        const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        let list = tasks.slice();
        const f = a.filter || 'all';
        if (f === 'today') list = list.filter((t) => !t.done && t.date === today);
        else if (f === 'overdue') list = list.filter((t) => !t.done && t.date && t.date < today);
        else if (f === 'week') list = list.filter((t) => !t.done && t.date && t.date >= today && t.date <= week);
        else if (f === 'done') list = list.filter((t) => t.done);
        else list = list.filter((t) => !t.done);
        if (a.subject) list = list.filter((t) => (t.subject || '') === a.subject);
        const limit = Math.min(Math.max(+a.limit || 20, 1), 50);
        return { ok: true, count: list.length, tasks: list.slice(0, limit).map(taskRow) };
      },
    },
    addTask: {
      def: { name: 'addTask', description: 'Add a task. name required; date YYYY-MM-DD; priority high|med|low; type hw|test|quiz|project|essay|lab|reading|other.', params: '{name,date?,priority?,subject?,type?,estTime?,notes?}' },
      run(a) {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        if (!a || !a.name) return { ok: false, error: 'name required' };
        const t = {
          id: Date.now() + Math.random(), name: String(a.name).slice(0, 200), date: a.date || '',
          priority: ['high', 'med', 'low'].includes(a.priority) ? a.priority : 'med',
          subject: a.subject || '', type: a.type || 'hw', estTime: +a.estTime || 0,
          notes: a.notes || '', subtasks: [], done: false, rescheduled: 0, createdAt: Date.now(),
        };
        try { if (typeof calcUrgency === 'function') t.urgencyScore = calcUrgency(t); } catch (e) {}
        tasks.unshift(t);
        persistTasks();
        return { ok: true, task: taskRow(t) };
      },
    },
    updateTask: {
      def: { name: 'updateTask', description: 'Update fields on a task found by id (preferred, copy from snapshot) or fuzzy name.', params: '{id|name, set:{name?,date?,priority?,subject?,type?,estTime?,notes?}}' },
      run(a) {
        const t = findTask(a && (a.id != null ? a.id : a.name));
        if (!t) return { ok: false, error: 'task not found' };
        const set = (a && a.set) || {};
        ['name', 'date', 'priority', 'subject', 'type', 'notes'].forEach((k) => { if (set[k] != null) t[k] = set[k]; });
        if (set.estTime != null) t.estTime = +set.estTime || 0;
        try { if (typeof calcUrgency === 'function') t.urgencyScore = calcUrgency(t); } catch (e) {}
        persistTasks();
        return { ok: true, task: taskRow(t) };
      },
    },
    completeTask: {
      def: { name: 'completeTask', description: 'Mark a task done by id or fuzzy name.', params: '{id|name}' },
      run(a) {
        const t = findTask(a && (a.id != null ? a.id : a.name));
        if (!t) return { ok: false, error: 'task not found' };
        t.done = true; t.completedAt = Date.now();
        persistTasks();
        try { if (typeof FluxBus !== 'undefined' && FluxBus.emit) FluxBus.emit('task_completed', t); } catch (e) {}
        return { ok: true, task: taskRow(t) };
      },
    },
    deleteTask: {
      def: { name: 'deleteTask', description: 'Delete one task by exact id. Refuses fuzzy matches — destructive.', params: '{id}' },
      run(a) {
        if (!haveTasks() || !a || a.id == null) return { ok: false, error: 'id required' };
        const i = tasks.findIndex((t) => String(t.id) === String(a.id));
        if (i < 0) return { ok: false, error: 'task not found' };
        const [t] = tasks.splice(i, 1);
        persistTasks();
        return { ok: true, deleted: taskRow(t) };
      },
    },
    addNote: {
      def: { name: 'addNote', description: 'Create a planner note (plain text body; newlines preserved).', params: '{title,body,subject?}' },
      run(a) {
        if (!haveNotes()) return { ok: false, error: 'notes unavailable' };
        if (!a || !a.body) return { ok: false, error: 'body required' };
        const n = {
          id: Date.now(), title: String(a.title || 'Flux note').slice(0, 140),
          body: esc(String(a.body)).replace(/\n/g, '<br>'),
          subject: a.subject || '', starred: false, flashcards: [],
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        notes.unshift(n);
        persistNotes();
        return { ok: true, noteId: n.id, title: n.title };
      },
    },
    searchNotes: {
      def: { name: 'searchNotes', description: 'Search notes by text in title/body. Returns id, title, preview.', params: '{query,limit?}' },
      run(a) {
        if (!haveNotes()) return { ok: false, error: 'notes unavailable' };
        const q = String((a && a.query) || '').toLowerCase();
        if (!q) return { ok: false, error: 'query required' };
        const hits = notes.filter((n) => ((n.title || '') + ' ' + strip(n.body || '')).toLowerCase().includes(q));
        const limit = Math.min(Math.max(+(a && a.limit) || 6, 1), 12);
        return { ok: true, count: hits.length, notes: hits.slice(0, limit).map((n) => ({ id: n.id, title: n.title || 'Untitled', preview: strip(n.body || '').slice(0, 160) })) };
      },
    },
    readNote: {
      def: { name: 'readNote', description: 'Read full note text by id or title substring.', params: '{id|title}' },
      run(a) {
        if (!haveNotes()) return { ok: false, error: 'notes unavailable' };
        let n = null;
        if (a && a.id != null) n = notes.find((x) => String(x.id) === String(a.id));
        if (!n && a && a.title) { const q = String(a.title).toLowerCase(); n = notes.find((x) => (x.title || '').toLowerCase().includes(q)); }
        if (!n) return { ok: false, error: 'note not found' };
        return { ok: true, id: n.id, title: n.title || 'Untitled', body: strip(n.body || '').slice(0, 6000) };
      },
    },
    getPlannerStats: {
      def: { name: 'getPlannerStats', description: 'Fresh counts: pending, due today, overdue, done today, next-7-day minutes.', params: '{}' },
      run() {
        if (!haveTasks()) return { ok: false, error: 'tasks unavailable' };
        const today = todayISO();
        const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        const pending = tasks.filter((t) => !t.done);
        const doneToday = tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === today);
        return {
          ok: true,
          pending: pending.length,
          dueToday: pending.filter((t) => t.date === today).length,
          overdue: pending.filter((t) => t.date && t.date < today).length,
          doneToday: doneToday.length,
          weekLoadMin: pending.filter((t) => t.date && t.date >= today && t.date <= week).reduce((s, t) => s + (+t.estTime || 30), 0),
          noteCount: haveNotes() ? notes.length : 0,
        };
      },
    },
    navigate: {
      def: { name: 'navigate', description: 'Open a planner tab for the student. panel: dashboard|calendar|toolbox|notes|timer|school|goals|settings|canvas.', params: '{panel}' },
      run(a) {
        const ok = ['dashboard', 'calendar', 'toolbox', 'notes', 'timer', 'school', 'goals', 'settings', 'canvas'];
        const p = a && a.panel;
        if (!ok.includes(p)) return { ok: false, error: 'panel must be one of ' + ok.join('|') };
        try { if (typeof nav === 'function') { nav(p); return { ok: true, opened: p }; } } catch (e) {}
        return { ok: false, error: 'nav unavailable' };
      },
    },
    addSubtasks: {
      def: { name: 'addSubtasks', description: 'Break an EXISTING task into subtasks (checklist under that task). parent: task id or fuzzy name. ALWAYS use this — never separate top-level addTask calls — when the student asks to break down / split / plan out a task they already have.', params: '{parent, subtasks:[string|{text}]}' },
      run(a) {
        const t = findTask(a && (a.parent != null ? a.parent : a.name));
        if (!t) return { ok: false, error: 'parent task not found — call listTasks first and use a real id' };
        const items = ((a && a.subtasks) || [])
          .map((s) => (typeof s === 'string' ? s : (s && (s.text || s.name)) || ''))
          .map((s) => String(s).trim().slice(0, 200))
          .filter(Boolean);
        if (!items.length) return { ok: false, error: 'subtasks required' };
        const dates = spreadDatesBefore(t.date, items.length);
        t.subtasks = (t.subtasks || []).concat(items.map((text, i) => {
          const row = { text, done: false };
          if (dates[i]) row.date = dates[i]; // advisory pacing only; UI shows checklist
          return row;
        }));
        persistTasks();
        return { ok: true, task: taskRow(t), subtaskCount: t.subtasks.length, paced: dates.filter(Boolean).length ? dates : undefined };
      },
    },
  };

  /**
   * Spread n work sessions across the open (non-rest) days strictly before
   * dueDate — never dump everything on today. Rest days come from the app's
   * REST_DAYS_KEY machinery via isBreak().
   */
  function spreadDatesBefore(dueDate, n) {
    const out = new Array(n).fill('');
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return out;
    const today = todayISO();
    const open = [];
    const d = new Date(today + 'T12:00:00');
    for (let i = 0; i < 28 && open.length < n; i++) {
      const s = d.toISOString().slice(0, 10);
      if (s >= dueDate) break;
      let rest = false;
      try { rest = typeof isBreak === 'function' && isBreak(s); } catch (e) {}
      if (!rest) open.push(s);
      d.setDate(d.getDate() + 1);
    }
    if (!open.length) return out;
    for (let i = 0; i < n; i++) out[i] = open[Math.min(open.length - 1, Math.floor((i * open.length) / n))];
    return out;
  }

  /* ═══════════ P0 A4 — propose-then-confirm plumbing (flagged) ══════════ */

  const MUTATING = new Set(['addTask', 'updateTask', 'completeTask', 'deleteTask', 'addNote', 'addSubtasks']);
  function confirmFlagOn() {
    /* The fallback must be true. isEnabled(key, fallback) returns the caller's
       fallback *before* it consults the client defaults, so passing false here
       meant the default of true was never reached and writes kept applying
       silently — the Apply/Cancel card never appeared. Defaulting to true also
       fails safe: if flags cannot be resolved at all, Flux asks rather than
       editing the planner unannounced. */
    try { return !!(window.FluxFeatureFlags && FluxFeatureFlags.isEnabled('enable_ai_action_confirm', true)); } catch (e) { return true; }
  }
  /**
   * Every write is proposed, never applied straight away.
   *
   * This used to let a single creation through unconfirmed and only stopped to
   * ask for bulk writes or edits of existing items. That still meant Flux could
   * put something in the planner the student never agreed to, and an item
   * appearing on its own is exactly what erodes trust in the planner's
   * contents. The instruction is that Flux may change the planner but has to
   * ask first — so it asks every time.
   */
  function needsConfirm(writes) {
    return writes.length > 0;
  }
  let _lastApply = null;
  let _proposeImpl = null; // set by wireOrchestrator (A4 card renderer)
  function beginUndoGroup() {
    _lastApply = { tasksJson: '', noteIds: [] };
    try { if (haveTasks()) _lastApply.tasksJson = JSON.stringify(tasks); } catch (e) {}
  }
  function undoLastAIChanges() {
    if (!_lastApply) return;
    try {
      if (_lastApply.tasksJson && haveTasks()) {
        const prev = JSON.parse(_lastApply.tasksJson);
        tasks.length = 0;
        Array.prototype.push.apply(tasks, prev);
        persistTasks();
      }
    } catch (e) {}
    try {
      if (_lastApply.noteIds.length && haveNotes()) {
        for (const id of _lastApply.noteIds) {
          const i = notes.findIndex((n) => String(n.id) === String(id));
          if (i >= 0) notes.splice(i, 1);
        }
        persistNotes();
      }
    } catch (e) {}
    _lastApply = null;
    try { if (typeof showToast === 'function') showToast('↩ AI changes undone', 'info'); } catch (e) {}
  }

  /* Study Hub bridge — every fluxStudyHub AI tool becomes a flux_tool. */
  function bridgeStudyTools() {
    const hub = window.fluxStudyHub;
    if (!hub || !hub.aiManifest || !hub.tools) return 0;
    let n = 0;
    hub.aiManifest.forEach((m) => {
      if (TOOLS[m.name]) return;
      TOOLS[m.name] = {
        def: { name: m.name, description: '[Study] ' + (m.description || m.name), params: JSON.stringify(m.params || {}) },
        run: (a) => {
          const fn = hub.tools[m.name];
          if (!fn) return { ok: false, error: 'study tool missing' };
          const out = fn(a && Object.keys(a).length === 1 && a.arg != null ? a.arg : a);
          return { ok: true, result: out };
        },
      };
      n++;
    });
    return n;
  }

  /* ═══════════════ wire into FluxOrchestrator (defs + exec + prompt) ═══ */

  let _wired = false;
  function wireOrchestrator() {
    const FO = window.FluxOrchestrator;
    if (_wired || !FO || !FO.TOOL_DEFS || !FO.executeTool) return false;
    _wired = true;

    bridgeStudyTools();
    Object.values(TOOLS).forEach((t) => {
      // addSubtasks is advertised lazily in augmentSystemPrompt, gated on
      // enable_ai_action_confirm (flags load async; prompt build is per-send).
      if (t.def.name === 'addSubtasks') return;
      if (!FO.TOOL_DEFS.some((d) => d.name === t.def.name)) FO.TOOL_DEFS.push(t.def);
    });

    const origExec = FO.executeTool;
    FO.executeTool = function (name, args) {
      let out;
      if (TOOLS[name]) {
        try { out = TOOLS[name].run(args || {}); }
        catch (err) { out = { ok: false, error: err.message || String(err) }; }
      } else {
        out = origExec.call(FO, name, args);
      }
      _turn.push({ name, result: out });
      return out;
    };

    // The orchestrator's own processAssistantReply calls its closure-internal
    // executeTool, bypassing the wrap above — replace it with an equivalent
    // that goes through FO.executeTool so new tools run AND results buffer.
    //
    // With enable_ai_action_confirm on, mutating calls become a PROPOSAL the
    // student applies or cancels instead of executing silently (P0 A4: one
    // reply once created 7 top-level high-priority tasks all due today and
    // flipped the user into Recovery Mode).
    FO.processAssistantReply = function (rawReply, toolsRun) {
      const calls = FO.parseFluxTools(rawReply);
      if (calls.length) {
        try { FO.thinkingStep && FO.thinkingStep('Running Flux tools…'); } catch (e) {}
        const writes = calls.filter((c) => MUTATING.has(c.name));
        const reads = calls.filter((c) => !MUTATING.has(c.name));
        // Reads always run — they feed the agent loop.
        const readResults = reads.map((c) => ({ name: c.name, result: FO.executeTool(c.name, c.args) }));
        if (readResults.length) renderToolCard(readResults);
        if (writes.length && confirmFlagOn() && needsConfirm(writes)) {
          renderProposalCard(writes);
          // Tell the model its calls are queued so the loop round doesn't
          // re-issue them.
          writes.forEach((c) => _turn.push({ name: c.name, result: { ok: true, queued: 'proposal', note: 'Shown to the student as a proposal to Apply/Cancel. Do NOT repeat these calls; ask the student to review the card.' } }));
        } else if (writes.length) {
          // Snapshot BEFORE executing so the Undo chip restores prior state.
          if (confirmFlagOn()) beginUndoGroup();
          const writeResults = writes.map((c) => {
            const r = FO.executeTool(c.name, c.args);
            if (confirmFlagOn() && c.name === 'addNote' && r && r.ok && r.noteId != null && _lastApply) _lastApply.noteIds.push(r.noteId);
            return { name: c.name, result: r };
          });
          renderToolCard(writeResults);
          // Even auto-applied single creations get an inline Undo chip.
          if (confirmFlagOn()) {
            const okCount = writeResults.filter((r) => r.result && r.result.ok).length;
            if (okCount) renderUndoChip('Flux made ' + okCount + ' change' + (okCount === 1 ? '' : 's'));
          }
        }
        toolsRun.push.apply(toolsRun, calls.map((c) => c.name));
      }
      const forDisplay = FO.stripFluxTools(rawReply);
      try { FO.updateScratchFromAssistant && FO.updateScratchFromAssistant(forDisplay); } catch (e) {}
      try { if (forDisplay && FO.recordRecommendation) FO.recordRecommendation(forDisplay, toolsRun); } catch (e) {}
    };
    function renderToolCard(results) {
      const wrap = document.getElementById('aiMsgs');
      if (!wrap || !results.length) return;
      const div = document.createElement('div');
      div.className = 'ai-msg bot flux-tool-card-wrap';
      const body = results.map((r) => `<div class="flux-tool-card"><div class="flux-tool-card-title">${esc(r.name)}</div><pre class="flux-tool-pre">${esc(JSON.stringify(r.result, null, 2))}</pre></div>`).join('');
      div.innerHTML = `<div class="ai-av bot">⚙</div><div class="ai-bub bot flux-tool-bub"><div class="flux-tool-card-h">Tool results</div>${body}</div>`;
      wrap.appendChild(div);
      const sc = document.getElementById('aiMsgsWrap');
      if (sc) setTimeout(() => { sc.scrollTop = sc.scrollHeight; }, 30);
    }

    /* ─────────── P0 A4: propose-then-confirm for mutating calls ─────────── */

    function describeCall(c) {
      const a = c.args || {};
      switch (c.name) {
        case 'addTask': return '＋ Add task “' + (a.name || '?') + '”' + (a.date ? ' · due ' + a.date : '') + ' · ' + (a.priority || 'med');
        case 'addNote': return '＋ Add note “' + (a.title || 'Flux note') + '”';
        case 'updateTask': return '✎ Update “' + (a.name || a.id || '?') + '” → ' + JSON.stringify(a.set || {}).slice(0, 120);
        case 'completeTask': return '✓ Complete “' + (a.name || a.id || '?') + '”';
        case 'deleteTask': return '✕ Delete task #' + (a.id != null ? a.id : '?');
        case 'addSubtasks': {
          const n = (a.subtasks || []).length;
          return '⑂ ' + n + ' subtask' + (n === 1 ? '' : 's') + ' under “' + (a.parent || '?') + '” (spread before its due date)';
        }
        default: return c.name;
      }
    }

    function renderProposalCard(writes) {
      const wrap = document.getElementById('aiMsgs');
      if (!wrap) return;
      const div = document.createElement('div');
      div.className = 'ai-msg bot flux-tool-card-wrap flux-ai-proposal';
      const rows = writes.map((c, i) =>
        `<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 2px;cursor:pointer;font-size:.82rem">
          <input type="checkbox" checked data-prop-idx="${i}" style="margin-top:2px;accent-color:var(--accent)">
          <span>${esc(describeCall(c))}</span>
        </label>`).join('');
      div.innerHTML = `<div class="ai-av bot">✦</div><div class="ai-bub bot flux-tool-bub">
        <div class="flux-tool-card-h">Flux proposes ${writes.length} change${writes.length === 1 ? '' : 's'} — review before anything happens</div>
        <div class="flux-ai-proposal-rows">${rows}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button type="button" class="flux-ai-prop-apply" style="flex:1;padding:8px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:.8rem;cursor:pointer">Apply</button>
          <button type="button" class="flux-ai-prop-cancel" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border2);background:var(--card2);color:var(--text);font-size:.8rem;cursor:pointer">Cancel</button>
        </div>
      </div>`;
      wrap.appendChild(div);
      const sc = document.getElementById('aiMsgsWrap');
      if (sc) setTimeout(() => { sc.scrollTop = sc.scrollHeight; }, 30);
      const applyBtn = div.querySelector('.flux-ai-prop-apply');
      const cancelBtn = div.querySelector('.flux-ai-prop-cancel');
      const finish = (html) => {
        div.querySelector('.flux-ai-proposal-rows').style.opacity = '.55';
        applyBtn.parentElement.outerHTML = `<div style="margin-top:10px;font-size:.78rem;color:var(--muted)">${html}</div>`;
      };
      cancelBtn.addEventListener('click', () => finish('Cancelled — nothing changed.'));
      applyBtn.addEventListener('click', () => {
        const picked = writes.filter((_, i) => div.querySelector(`[data-prop-idx="${i}"]`)?.checked);
        if (!picked.length) { finish('Nothing selected — no changes made.'); return; }
        beginUndoGroup();
        const results = picked.map((c) => {
          const r = FO.executeTool(c.name, c.args);
          if (c.name === 'addNote' && r && r.ok && r.noteId != null) _lastApply.noteIds.push(r.noteId);
          return { name: c.name, ok: !!(r && r.ok), error: r && r.error };
        });
        const okCount = results.filter((r) => r.ok).length;
        const failCount = results.length - okCount;
        finish(`Applied ${okCount} change${okCount === 1 ? '' : 's'}${failCount ? ` · ${failCount} failed` : ''} · <button type="button" class="flux-ai-undo-link" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:700;font-size:.78rem;padding:0">Undo AI changes</button>`);
        div.querySelector('.flux-ai-undo-link')?.addEventListener('click', undoLastAIChanges);
      });
    }

    function renderUndoChip(label) {
      const wrap = document.getElementById('aiMsgs');
      if (!wrap) return;
      const div = document.createElement('div');
      div.className = 'flux-agent-round flux-ai-undo-chip';
      div.innerHTML = `${esc(label)} · <button type="button" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:700;font-size:inherit;padding:0">Undo</button>`;
      div.querySelector('button').addEventListener('click', () => { undoLastAIChanges(); div.remove(); });
      wrap.appendChild(div);
    }


    // C4 (Grade GPS) and other surfaces reuse the exact A4 proposal-card +
    // apply/undo machinery for programmatic bulk changes. Stored on a
    // module slot — wireOrchestrator can run before the bottom export exists.
    _proposeImpl = function (calls) {
      const writes = (calls || []).filter((c) => c && MUTATING.has(c.name));
      if (!writes.length) return false;
      renderProposalCard(writes);
      return true;
    };

    const origAug = FO.augmentSystemPrompt;
    FO.augmentSystemPrompt = function (base, userText) {
      let extra = `
## Agent loop (how your tools actually run)
Your \`\`\`flux_tool\`\`\` blocks execute client-side immediately after your reply. Their outputs are then sent back to you in a follow-up message that starts with "TOOL RESULTS" — read it and continue: either call more tools or give the final answer. Plan for this loop:
- To act on live data, call a read tool first (listTasks/searchNotes/getPlannerStats), wait for TOOL RESULTS, then call write tools with real ids.
- When you only need to act, you may call a write tool directly (addTask/updateTask/completeTask/addNote) and then confirm to the student in the SAME reply — short, no fluff.
- Never call deleteTask unless the student explicitly asked to delete that task.
- At most 4 tool rounds per question; don't repeat identical calls.
- Tool blocks are invisible to the student. Everything outside them is your visible answer.`;
      if (confirmFlagOn()) {
        if (!FO.TOOL_DEFS.some((d) => d.name === 'addSubtasks')) FO.TOOL_DEFS.push(TOOLS.addSubtasks.def);
        extra += `
## Changing the planner (confirm-first rules)
- Breaking down / splitting / planning out an EXISTING task ("my lab report") → call addSubtasks with that task as parent. NEVER create separate top-level tasks for pieces of an existing task.
- Never mass-assign due dates of today or priority high. Work spreads across open days before the deadline (rest days are respected automatically); priorities inherit from the parent or default to med.
- Bulk or modifying tool calls are shown to the student as a PROPOSAL card they Apply or Cancel. When TOOL RESULTS says "queued: proposal", the changes are NOT applied yet — summarize the plan, ask them to review the card, and do NOT re-issue the calls.`;
      }
      return origAug.call(FO, base, userText) + extra;
    };
    return true;
  }

  /* ═══════════════════════ 2. TURN RESULT BUFFER ═══════════════════════ */

  let _turn = [];
  function beginTurn() { _turn = []; }
  function takeTurnResults() { const r = _turn; _turn = []; return r; }

  /* ═══════════════════════ 3. ASK FLUX ANYWHERE ════════════════════════ */

  /**
   * window.askFlux("question", {context, send, placeholder})
   *  - context: extra text appended under the question (selection, task, page…)
   *  - send: true → submits immediately; false (default) → prefills for review
   */
  function askFlux(prompt, opts) {
    opts = opts || {};
    let text = String(prompt || '').trim();
    if (opts.context) text += (text ? '\n\n' : '') + 'Context:\n' + String(opts.context).trim().slice(0, 4000);
    if (typeof openFluxAgent === 'function') openFluxAgent({ prefill: text, placeholder: opts.placeholder });
    else if (typeof nav === 'function') { nav('ai'); setTimeout(() => { const i = document.getElementById('aiInput'); if (i) { i.value = text; i.focus(); } }, 180); }
    if (opts.send) {
      setTimeout(() => {
        const btn = document.getElementById('aiSendBtn');
        if (typeof sendAI === 'function' && btn && !btn.disabled) sendAI();
      }, 320);
    }
    return true;
  }

  /* Floating "✦ Ask Flux" chip on text selection (outside inputs + AI panel). */
  function initSelectionChip() {
    if (document.getElementById('fluxAskSelChip')) return;
    const chip = document.createElement('button');
    chip.id = 'fluxAskSelChip';
    chip.type = 'button';
    chip.innerHTML = '✦ Ask Flux';
    chip.setAttribute('aria-label', 'Ask Flux AI about the selected text');
    document.body.appendChild(chip);
    let selText = '';

    function hide() { chip.classList.remove('on'); }
    document.addEventListener('selectionchange', () => {
      clearTimeout(chip._t);
      chip._t = setTimeout(() => {
        try {
          const sel = window.getSelection();
          const txt = sel ? String(sel).trim() : '';
          if (!txt || txt.length < 12 || txt.length > 4000 || sel.rangeCount === 0) return hide();
          const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
          if (!node) return hide();
          if (node.closest('input, textarea, [contenteditable="true"], #ai, .ai-msg, #fluxAskSelChip')) return hide();
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (!rect || (!rect.width && !rect.height)) return hide();
          selText = txt;
          chip.style.left = Math.max(8, Math.min(window.innerWidth - 130, rect.left + rect.width / 2 - 56)) + 'px';
          chip.style.top = Math.max(8, rect.top - 42) + 'px';
          chip.classList.add('on');
        } catch (e) { hide(); }
      }, 180);
    });
    chip.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection
    chip.addEventListener('click', () => {
      hide();
      askFlux('Explain or help me with this:', { context: selText });
    });
    document.addEventListener('scroll', hide, true);
  }

  /* Delegated [data-ask-flux] support: any element can declare a question. */
  function initDelegation() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-ask-flux]');
      if (!el) return;
      e.preventDefault();
      askFlux(el.dataset.askFlux || '', { context: el.dataset.askFluxContext || '', send: el.dataset.askFluxSend === '1' });
    });
  }

  /* ═══════════════════════════════ boot ════════════════════════════════ */

  function boot() {
    if (!wireOrchestrator()) {
      // orchestrator loads with defer too — retry briefly
      let tries = 0;
      const t = setInterval(() => { if (wireOrchestrator() || ++tries > 40) clearInterval(t); }, 250);
    }
    // study hub may register its AI tools after first wire — re-bridge later
    setTimeout(() => {
      if (!_wired) return;
      const n = bridgeStudyTools();
      if (!n) return;
      const FO = window.FluxOrchestrator;
      if (FO && FO.TOOL_DEFS) Object.values(TOOLS).forEach((tl) => { if (tl.def.name !== 'addSubtasks' && !FO.TOOL_DEFS.some((d) => d.name === tl.def.name)) FO.TOOL_DEFS.push(tl.def); });
    }, 1500);
    initSelectionChip();
    initDelegation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.askFlux = askFlux;
  window.FluxAgentLoop = {
    MAX_ROUNDS: 4,
    beginTurn,
    takeTurnResults,
    askFlux,
    undoLastAIChanges,
    proposeChanges(calls) { return _proposeImpl ? _proposeImpl(calls) : false; },
    tools: TOOLS,
    registerTool(name, def, run) {
      if (!name || TOOLS[name] || typeof run !== 'function') return false;
      TOOLS[name] = { def: Object.assign({ name }, def), run };
      const FO = window.FluxOrchestrator;
      if (FO && FO.TOOL_DEFS && !FO.TOOL_DEFS.some((d) => d.name === name)) FO.TOOL_DEFS.push(TOOLS[name].def);
      return true;
    },
  };
})();
