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
  };

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
    FO.processAssistantReply = function (rawReply, toolsRun) {
      const calls = FO.parseFluxTools(rawReply);
      if (calls.length) {
        try { FO.thinkingStep && FO.thinkingStep('Running Flux tools…'); } catch (e) {}
        const results = calls.map((c) => ({ name: c.name, result: FO.executeTool(c.name, c.args) }));
        renderToolCard(results);
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

    const origAug = FO.augmentSystemPrompt;
    FO.augmentSystemPrompt = function (base, userText) {
      return origAug.call(FO, base, userText) + `
## Agent loop (how your tools actually run)
Your \`\`\`flux_tool\`\`\` blocks execute client-side immediately after your reply. Their outputs are then sent back to you in a follow-up message that starts with "TOOL RESULTS" — read it and continue: either call more tools or give the final answer. Plan for this loop:
- To act on live data, call a read tool first (listTasks/searchNotes/getPlannerStats), wait for TOOL RESULTS, then call write tools with real ids.
- When you only need to act, you may call a write tool directly (addTask/updateTask/completeTask/addNote) and then confirm to the student in the SAME reply — short, no fluff.
- Never call deleteTask unless the student explicitly asked to delete that task.
- At most 4 tool rounds per question; don't repeat identical calls.
- Tool blocks are invisible to the student. Everything outside them is your visible answer.`;
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
      if (FO && FO.TOOL_DEFS) Object.values(TOOLS).forEach((tl) => { if (!FO.TOOL_DEFS.some((d) => d.name === tl.def.name)) FO.TOOL_DEFS.push(tl.def); });
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
