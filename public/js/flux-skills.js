/* ════════════════════════════════════════════════════════════════════════════
 * FluxSkills — registry of callable mini-tools (Claude-style)
 *
 * A Skill is a small named command the user (or the AI) can invoke. Skills
 * declare their slash name, args, and a runner. The AI proxy can return a
 * fenced ```skill``` block to trigger one; the user can type `/<slash>` in the
 * AI input; both go through the same dispatcher.
 *
 * Skills live in a registry so adding a new one is one entry.
 *
 * Public API on window.FluxSkills:
 *   .register(spec)              add a skill
 *   .all([{role}])               list registered skills
 *   .get(slug)                   single
 *   .run(slug, args, ctx)        execute
 *   .parse(text)                 returns {slug, args} or null
 *   .runInput(text, ctx)         parse + run in one call
 *   .openPalette()               open the command palette UI
 *
 * Each skill: { id, name, slash, description, args[], role?, runner }
 * runner(args, ctx) → Promise<{ ok, message?, render?: htmlString }>
 *
 * Built-in 50 skills wired below. AI-backed skills route through window.API.ai
 * via fluxCallAI() helper (centralized + .ok + shape-validated).
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const registry = new Map();
  const order = [];

  /* ───────── Helpers ───────── */

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function aiURL() {
    return (window.API && window.API.ai) || '';
  }
  async function fluxCallAI({ system, user, context }) {
    const url = aiURL();
    if (!url) throw new Error('AI is offline.');
    const headers = (typeof window.fluxAuthHeaders === 'function')
      ? await window.fluxAuthHeaders()
      : { 'Content-Type': 'application/json' };
    const body = {
      system: system || '',
      messages: [
        ...(context ? [{ role: 'user', content: 'Context:\n' + String(context).slice(0, 8000) }] : []),
        { role: 'user', content: String(user || '') },
      ],
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('AI error ' + res.status);
    const data = await res.json().catch(() => null);
    const txt = data && data.content && data.content[0] && typeof data.content[0].text === 'string' ? data.content[0].text : '';
    return txt.trim();
  }
  function getTasks() {
    try { return Array.isArray(window.tasks) ? window.tasks : []; } catch (_) { return []; }
  }
  function getNotes() {
    try { return Array.isArray(window.notes) ? window.notes : []; } catch (_) { return []; }
  }
  function showToast(msg, tone) {
    try { if (typeof window.showToast === 'function') window.showToast(msg, tone || 'info'); } catch (_) {}
  }
  function navTo(panel) {
    try { if (typeof window.nav === 'function') window.nav(panel); } catch (_) {}
  }

  /* ───────── Registry ───────── */

  function register(spec) {
    if (!spec || !spec.id || !spec.slash || typeof spec.runner !== 'function') {
      throw new Error('skill spec needs {id, slash, runner}');
    }
    if (registry.has(spec.id)) return;
    const frozen = Object.freeze({
      id: spec.id,
      name: spec.name || spec.id,
      slash: spec.slash.startsWith('/') ? spec.slash : '/' + spec.slash,
      description: spec.description || '',
      category: spec.category || 'general',
      role: spec.role || null,
      args: spec.args || [],
      requiresConnector: spec.requiresConnector || null,
      icon: spec.icon || '⚡',
      runner: spec.runner,
    });
    registry.set(spec.id, frozen);
    order.push(spec.id);
  }

  function all(opts) {
    const role = opts && opts.role;
    return order.map((id) => registry.get(id)).filter((s) => {
      if (!s) return false;
      if (role && s.role && s.role !== role) return false;
      return true;
    });
  }

  function get(idOrSlash) {
    if (!idOrSlash) return null;
    if (registry.has(idOrSlash)) return registry.get(idOrSlash);
    const slash = idOrSlash.startsWith('/') ? idOrSlash : '/' + idOrSlash;
    for (const s of registry.values()) if (s.slash === slash) return s;
    return null;
  }

  /** Parse a user input line into { slug, args, raw }. Returns null if not a skill call. */
  function parse(text) {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    const m = t.match(/^(\/[a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i);
    if (!m) return null;
    return { slash: m[1].toLowerCase(), args: (m[2] || '').trim() };
  }

  async function run(slugOrId, args, ctx) {
    const spec = get(slugOrId);
    if (!spec) return { ok: false, message: 'Unknown skill: ' + slugOrId };
    try {
      const r = await spec.runner(typeof args === 'string' ? args : (args || ''), ctx || {});
      return r || { ok: true };
    } catch (e) {
      console.warn('[FluxSkills] runner failed', slugOrId, e);
      return { ok: false, message: e && e.message ? e.message : 'Skill failed.' };
    }
  }

  async function runInput(text, ctx) {
    const parsed = parse(text);
    if (!parsed) return { ok: false, message: 'Not a slash command.' };
    return run(parsed.slash, parsed.args, ctx);
  }

  /* ════════════════════════════════════════════════════════════════════════
   * Built-in skills — 50 total, grouped by category. Most lean on the AI
   * proxy; a handful run purely client-side (navigation, sync, etc.).
   * ════════════════════════════════════════════════════════════════════════ */

  /* ───────── Planning ───────── */

  register({
    id: 'plan', name: 'Plan my week', slash: '/plan', category: 'planning', icon: '🧭',
    description: 'Build a 7-day study plan from your open tasks.',
    runner: async (args) => {
      const tasks = getTasks().filter((t) => !t.done).slice(0, 60);
      const summary = tasks.map((t) => `- ${t.text || t.title || ''}${t.due ? ' (due ' + t.due + ')' : ''}${t.estTime ? ` ~${t.estTime}m` : ''}`).join('\n') || '(no open tasks)';
      const txt = await fluxCallAI({
        system: 'You are Flux, a study planner. Build a realistic 7-day plan from the tasks. Group by day, include warm-ups + breaks. Use bullets.',
        user: 'Plan my week.' + (args ? ' Extra context: ' + args : ''),
        context: 'Open tasks:\n' + summary,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'optimize', name: 'Optimize schedule', slash: '/optimize', category: 'planning', icon: '🎯',
    description: 'Review your current week and suggest improvements.',
    runner: async () => {
      const tasks = getTasks().filter((t) => !t.done).slice(0, 50);
      const summary = tasks.map((t) => `- ${t.text || t.title || ''}${t.due ? ' (due ' + t.due + ')' : ''}`).join('\n');
      const txt = await fluxCallAI({
        system: 'Spot 3 concrete improvements to this week. Bullet form, terse.',
        user: 'Optimize.',
        context: summary,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'fix', name: 'Catch up', slash: '/fix', category: 'planning', icon: '🛠',
    description: 'Help me catch up on overdue work.',
    runner: async () => {
      const overdue = getTasks().filter((t) => !t.done && t.due && new Date(t.due) < new Date()).slice(0, 30);
      if (!overdue.length) return { ok: true, render: '✓ You have nothing overdue.' };
      const summary = overdue.map((t) => `- ${t.text || t.title || ''} (due ${t.due})`).join('\n');
      const txt = await fluxCallAI({
        system: 'Suggest a recovery sequence: which to drop, defer, batch. Be honest.',
        user: 'Catch up plan.',
        context: 'Overdue:\n' + summary,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'balance', name: 'Balance subjects', slash: '/balance', category: 'planning', icon: '⚖️',
    description: 'Redistribute work to balance subject load.',
    runner: async () => {
      const tasks = getTasks().filter((t) => !t.done);
      const bySub = tasks.reduce((acc, t) => { const s = t.subject || 'misc'; acc[s] = (acc[s] || 0) + 1; return acc; }, {});
      const txt = await fluxCallAI({
        system: 'Given the per-subject task counts, suggest which subjects need more attention this week and why. Bullets.',
        user: 'Balance my subjects.',
        context: JSON.stringify(bySub),
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'freeup', name: 'Free 2 hours', slash: '/freeup', category: 'planning', icon: '🕒',
    description: 'Carve out a 2-hour focus block today.',
    runner: async () => {
      const txt = await fluxCallAI({
        system: 'Find a realistic 2-hour focus block today. Suggest which tasks to defer to make room. Be specific.',
        user: 'Free up 2 hours today.',
        context: getTasks().filter((t)=>!t.done).slice(0,20).map((t)=>`- ${t.text||t.title||''} (~${t.estTime||30}m)`).join('\n'),
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'timebox', name: 'Time-box task', slash: '/timebox', category: 'planning', icon: '📦',
    description: 'Break a task into 25-minute sprints.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /timebox <task name>' };
      const txt = await fluxCallAI({
        system: 'Break the task into 25-minute Pomodoro sprints with concrete sub-goals per sprint.',
        user: `Timebox: ${args}`,
      });
      return { ok: true, render: txt };
    },
  });

  /* ───────── Study ───────── */

  register({
    id: 'summarize', name: 'Summarize', slash: '/summarize', category: 'study', icon: '📝',
    description: 'Summarize the current note (or pasted text).',
    runner: async (args) => {
      const text = args || (getNotes()[0] && (getNotes()[0].body || ''));
      if (!text) return { ok: false, message: 'Open a note first or paste text after /summarize.' };
      const txt = await fluxCallAI({
        system: 'Summarize in 5 tight bullets. No filler.',
        user: 'Summarize.',
        context: text,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'flashcards', name: 'Flashcards', slash: '/flashcards', category: 'study', icon: '🃏',
    description: 'Generate flashcards from the current note.',
    runner: async () => {
      if (typeof window.generateFlashcardsFromNote === 'function') {
        try { window.generateFlashcardsFromNote(); return { ok: true, render: 'Opening note flashcards…' }; } catch (e) { return { ok: false, message: e.message }; }
      }
      return { ok: false, message: 'Open a note first.' };
    },
  });

  register({
    id: 'quizme', name: 'Quiz me', slash: '/quiz-me', category: 'study', icon: '❓',
    description: 'Self-test on a note.',
    runner: async (args) => {
      const text = args || (getNotes()[0] && (getNotes()[0].body || ''));
      if (!text) return { ok: false, message: 'Open a note or paste text.' };
      const txt = await fluxCallAI({
        system: 'Quiz the student with 5 questions. Number them. Then say "Reply with answers and I will grade."',
        user: 'Quiz.',
        context: text,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'explain', name: 'Explain', slash: '/explain', category: 'study', icon: '💡',
    description: 'Explain a topic at the chosen level (ELI5 / HS / college).',
    runner: async (args) => {
      const m = args.match(/^(eli5|hs|college)\s+(.+)$/i);
      const level = m ? m[1].toLowerCase() : 'hs';
      const topic = m ? m[2] : args;
      if (!topic) return { ok: false, message: 'Usage: /explain [eli5|hs|college] <topic>' };
      const tone = level === 'eli5' ? 'A 10-year-old can follow.' : level === 'college' ? 'College-level rigor.' : 'High-school level.';
      const txt = await fluxCallAI({ system: 'Explain clearly. ' + tone, user: 'Explain: ' + topic });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'example', name: 'Worked example', slash: '/example', category: 'study', icon: '🔢',
    description: 'Give a worked example of a concept.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /example <topic>' };
      const txt = await fluxCallAI({ system: 'Show a fully worked example with each step numbered.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'proof', name: 'Prove', slash: '/proof', category: 'study', icon: '📐',
    description: 'Generate a step-by-step proof.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /proof <statement>' };
      const txt = await fluxCallAI({ system: 'Generate a clean step-by-step proof. Number lines. Label each step.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'cite', name: 'Citation', slash: '/cite', category: 'study', icon: '📚',
    description: 'Generate a citation (MLA/APA/Chicago).',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /cite <URL or title> [style]' };
      const m = args.match(/\s+(mla|apa|chicago)$/i);
      const style = m ? m[1].toUpperCase() : 'APA';
      const ref = m ? args.replace(m[0], '').trim() : args;
      const txt = await fluxCallAI({ system: `Format an accurate ${style} citation for the source. Output only the citation.`, user: ref });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'outline', name: 'Outline essay', slash: '/outline', category: 'study', icon: '📝',
    description: 'Outline an essay from a thesis/prompt.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /outline <thesis or prompt>' };
      const txt = await fluxCallAI({ system: 'Build a 5-section essay outline with topic sentences for each paragraph.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'expand', name: 'Expand outline', slash: '/expand', category: 'study', icon: '📄',
    description: 'Turn an outline into a draft.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /expand <outline>' };
      const txt = await fluxCallAI({ system: 'Expand the outline into a complete first draft. Keep claims tight; cite [TBD] for sources.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'critique', name: 'Critique draft', slash: '/critique', category: 'study', icon: '🔍',
    description: 'Critique a draft with specific revisions.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /critique <paste draft>' };
      const txt = await fluxCallAI({ system: 'Give 5 specific, actionable revisions. Cite paragraph/line. No fluff.', user: args });
      return { ok: true, render: txt };
    },
  });

  /* ───────── Productivity ───────── */

  register({
    id: 'inbox', name: 'Gmail inbox', slash: '/inbox', category: 'productivity', icon: '📥', requiresConnector: 'google',
    description: 'Pull actionable items from Gmail into tasks.',
    runner: async () => {
      if (typeof window.fluxGmailEducatorSync === 'function') {
        try { window.fluxGmailEducatorSync(); return { ok: true, render: 'Pulling Gmail…' }; } catch (e) { return { ok: false, message: e.message }; }
      }
      return { ok: false, message: 'Connect Google in Settings → Connectors first.' };
    },
  });

  register({
    id: 'sync', name: 'Force sync', slash: '/sync', category: 'productivity', icon: '🔄',
    description: 'Force a push + pull to the cloud.',
    runner: async () => {
      try {
        if (window.FluxSync && typeof window.FluxSync.now === 'function') {
          await window.FluxSync.now();
          return { ok: true, render: '✓ Synced.' };
        }
      } catch (e) { return { ok: false, message: e.message }; }
      return { ok: false, message: 'Sync API unavailable.' };
    },
  });

  register({
    id: 'triage', name: 'Triage tasks', slash: '/triage', category: 'productivity', icon: '🚦',
    description: 'Sort tasks by urgency × effort.',
    runner: async () => {
      const open = getTasks().filter((t) => !t.done).slice(0, 60);
      if (!open.length) return { ok: true, render: 'Nothing open to triage.' };
      const summary = open.map((t) => `- ${t.text || t.title || ''} due:${t.due || '—'} est:${t.estTime || '?'}m`).join('\n');
      const txt = await fluxCallAI({
        system: 'Triage into 4 buckets: Do now / Schedule / Delegate / Drop. List 3-5 per bucket. Be ruthless.',
        user: 'Triage.', context: summary,
      });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'snooze', name: 'Snooze tasks', slash: '/snooze', category: 'productivity', icon: '😴',
    description: 'Defer N tasks by D days.',
    runner: async (args) => {
      const m = args.match(/^(\d+)\s*(?:tasks?)?\s*(?:by\s+)?(\d+)\s*(?:days?)?/i);
      if (!m) return { ok: false, message: 'Usage: /snooze <N> <days>' };
      const n = parseInt(m[1], 10);
      const days = parseInt(m[2], 10);
      const tasks = getTasks().filter((t) => !t.done && t.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, n);
      tasks.forEach((t) => {
        const d = new Date(t.due);
        d.setDate(d.getDate() + days);
        t.due = d.toISOString().slice(0, 10);
      });
      try { window.save && window.save('flux_tasks', window.tasks); } catch (_) {}
      try { window.renderTasks && window.renderTasks(); } catch (_) {}
      return { ok: true, render: `✓ Snoozed ${tasks.length} task(s) by ${days} day(s).` };
    },
  });

  register({
    id: 'recur', name: 'Recurring', slash: '/recur', category: 'productivity', icon: '🔁',
    description: 'Make the most recent task recurring (daily/weekly/etc.).',
    runner: async (args) => {
      const cad = (args || '').toLowerCase().trim() || 'weekly';
      const last = getTasks()[0];
      if (!last) return { ok: false, message: 'No tasks yet.' };
      last.recur = cad;
      try { window.save && window.save('flux_tasks', window.tasks); } catch (_) {}
      return { ok: true, render: `✓ Set "${last.text || last.title || ''}" to ${cad}.` };
    },
  });

  /* ───────── Wellness ───────── */

  register({
    id: 'breathe', name: 'Breathing', slash: '/breathe', category: 'wellness', icon: '🌬',
    description: 'Start a 4-7-8 breathing session.',
    runner: async () => {
      navTo('mood');
      setTimeout(() => { try { window.startBreathing && window.startBreathing(); } catch (_) {} }, 200);
      return { ok: true, render: 'Starting 4-7-8 breathing…' };
    },
  });

  register({
    id: 'break', name: 'Break', slash: '/break', category: 'wellness', icon: '☕',
    description: 'Start a Pomodoro short break.',
    runner: async () => {
      navTo('timer');
      setTimeout(() => { try { window.setTMode && window.setTMode('short'); window.startTimer && window.startTimer(); } catch (_) {} }, 200);
      return { ok: true, render: 'Starting 5-minute break.' };
    },
  });

  register({
    id: 'checkin', name: 'Mood check-in', slash: '/checkin', category: 'wellness', icon: '🫀',
    description: 'Open the mood + energy check-in.',
    runner: async () => { navTo('mood'); return { ok: true, render: 'Check-in opened.' }; },
  });

  register({
    id: 'sleep', name: 'Sleep insights', slash: '/sleep', category: 'wellness', icon: '😴',
    description: 'Show sleep history insights.',
    runner: async () => {
      let mh = [];
      try { mh = JSON.parse(localStorage.getItem('flux_mood') || '[]'); } catch (_) {}
      if (!mh.length) return { ok: false, message: 'No sleep data yet. Save a check-in first.' };
      const avg = mh.slice(-14).reduce((s, x) => s + (x.sleep || 0), 0) / Math.min(14, mh.length);
      return { ok: true, render: `Last 14d avg sleep: ${avg.toFixed(1)}h.` };
    },
  });

  /* ───────── Educator / staff ───────── */

  register({
    id: 'grade', name: 'Gradebook summary', slash: '/grade', category: 'educator', icon: '📊', role: 'teacher',
    description: 'Summarize current gradebook trends.',
    runner: async () => {
      const txt = await fluxCallAI({ system: 'Summarize gradebook trends. Identify 3 students with concerning patterns. Be specific but non-judgmental.', user: 'Gradebook summary.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'atrisk', name: 'At-risk students', slash: '/atrisk', category: 'educator', icon: '⚠️', role: 'teacher',
    description: 'List at-risk students with reasons.',
    runner: async () => {
      const txt = await fluxCallAI({ system: 'List likely at-risk students based on planner signals. For each, give 1 sentence of evidence and 1 concrete next step.', user: 'At-risk.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'lesson', name: 'Lesson outline', slash: '/lesson', category: 'educator', icon: '📚', role: 'teacher',
    description: 'Generate a lesson outline.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /lesson <topic> [duration]' };
      const txt = await fluxCallAI({ system: 'Build a lesson outline: objectives, hook, instruction (15m), practice (15m), exit ticket. Use bullets.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'handouts', name: 'Handout', slash: '/handouts', category: 'educator', icon: '🖨', role: 'teacher',
    description: 'Print-ready handout for a topic.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /handouts <topic>' };
      const txt = await fluxCallAI({ system: 'Create a one-page student handout. Include title, key terms, 3 worked examples, 5 practice problems. Plain text suitable for paste into Docs.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'parent', name: 'Parent email', slash: '/parent', category: 'educator', icon: '✉️', role: 'teacher',
    description: 'Draft a parent email.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /parent <topic>' };
      const txt = await fluxCallAI({ system: 'Draft a warm, professional parent email. 3 short paragraphs. End with one specific ask.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'meeting', name: 'Meeting notes', slash: '/meeting', category: 'educator', icon: '📝', role: 'staff',
    description: 'Summarize meeting notes into action items.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Paste meeting notes after /meeting' };
      const txt = await fluxCallAI({ system: 'From these meeting notes, extract: 1) Decisions, 2) Action items (owner, due), 3) Open questions.', user: 'Summarize.', context: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'iep', name: 'IEP helper', slash: '/iep', category: 'educator', icon: '🤝', role: 'counselor',
    description: 'IEP/504 helper (drafts, not advice).',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /iep <prompt>' };
      const txt = await fluxCallAI({ system: 'Draft IEP/504 language. Use neutral, strengths-based phrasing. Output is a DRAFT — flag any assertion that needs verification.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'sub', name: 'Sub plan', slash: '/sub', category: 'educator', icon: '🪑', role: 'teacher',
    description: 'Generate a substitute plan from this week.',
    runner: async () => {
      const txt = await fluxCallAI({ system: 'Generate a one-day substitute plan: bell schedule, attendance check, lesson activities (with timing), expected behavior, contacts.', user: 'Sub plan for tomorrow.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'duty', name: 'Duty roster', slash: '/duty', category: 'educator', icon: '🪪', role: 'staff',
    description: 'Show this week\'s duty roster.',
    runner: async () => { navTo('staffWorkboard'); return { ok: true, render: 'Opening staff workboard.' }; },
  });

  /* ───────── Counselor ───────── */

  register({
    id: 'college', name: 'College list', slash: '/college', category: 'counselor', icon: '🎓', role: 'counselor',
    description: 'Build a reach/match/safety college list.',
    runner: async (args) => {
      const txt = await fluxCallAI({ system: 'Suggest 3 reach, 4 match, 3 safety colleges with one-line reasons each.', user: args || 'General profile.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'essay', name: 'Common App essay', slash: '/essay', category: 'counselor', icon: '✍️', role: 'student',
    description: 'Help with a Common App essay prompt.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /essay <prompt or topic>' };
      const txt = await fluxCallAI({ system: 'Help draft a Common App essay outline (650 words). 3 thematic beats, anecdote + reflection structure.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'sat', name: 'SAT/ACT plan', slash: '/sat', category: 'counselor', icon: '📈', role: 'student',
    description: 'Build a study plan for a target SAT/ACT date.',
    runner: async (args) => {
      const txt = await fluxCallAI({ system: 'Build a week-by-week study plan up to the test date. Mix concepts, drills, full practice tests.', user: args || 'Test in 3 months.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'scholarship', name: 'Scholarships', slash: '/scholarship', category: 'counselor', icon: '💰', role: 'student',
    description: 'Match scholarships to a profile.',
    runner: async (args) => {
      const txt = await fluxCallAI({ system: 'Suggest 5 scholarships that match the profile. Include eligibility, deadline, $, application URL placeholder.', user: args || 'General' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'visit', name: 'Schedule visit', slash: '/visit', category: 'counselor', icon: '🏛', role: 'student',
    description: 'Add a college visit to the calendar.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /visit <school> <date>' };
      try {
        const t = { id: Date.now(), text: 'Visit ' + args, due: new Date(Date.now() + 86400000).toISOString().slice(0, 10), category: 'college' };
        if (Array.isArray(window.tasks)) { window.tasks.unshift(t); window.save && window.save('flux_tasks', window.tasks); window.renderTasks && window.renderTasks(); }
      } catch (_) {}
      return { ok: true, render: 'Added: visit ' + args };
    },
  });

  /* ───────── Admin ───────── */

  register({
    id: 'announce', name: 'Announce', slash: '/announce', category: 'admin', icon: '📣', role: 'admin',
    description: 'Draft a schoolwide announcement.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /announce <topic>' };
      const txt = await fluxCallAI({ system: 'Draft a brief, clear schoolwide announcement. Friendly tone, includes when/what/where/who.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'report', name: 'Weekly digest', slash: '/report', category: 'admin', icon: '📊', role: 'admin',
    description: 'Generate a weekly admin digest.',
    runner: async () => {
      const txt = await fluxCallAI({ system: 'Generate a 5-section weekly admin digest: highlights, concerns, staff, students, action.', user: 'Digest.' });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'roster', name: 'Roster import', slash: '/roster', category: 'admin', icon: '📋', role: 'admin',
    description: 'Import a class roster (CSV).',
    runner: async () => { navTo('adminOps'); return { ok: true, render: 'Opening admin ops.' }; },
  });

  register({
    id: 'policy', name: 'Policy lookup', slash: '/policy', category: 'admin', icon: '📖', role: 'staff',
    description: 'Look up school policy by question.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /policy <question>' };
      const txt = await fluxCallAI({ system: 'Answer policy questions for educators. Cite the policy section if available; otherwise say "verify with admin".', user: args });
      return { ok: true, render: txt };
    },
  });

  /* ───────── Tools / integrations ───────── */

  register({
    id: 'canvas', name: 'Canvas: today', slash: '/canvas', category: 'tools', icon: '🅒', requiresConnector: 'canvas',
    description: 'Show Canvas assignments due today.',
    runner: async () => { navTo('canvas'); return { ok: true, render: 'Opening Canvas hub.' }; },
  });

  register({
    id: 'docs', name: 'New Google Doc', slash: '/docs', category: 'tools', icon: '📄', requiresConnector: 'google',
    description: 'Create a new Google Doc with current context.',
    runner: async (args) => {
      try { window.open('https://docs.google.com/document/create?title=' + encodeURIComponent(args || 'Untitled — Flux'), '_blank'); } catch (_) {}
      return { ok: true, render: 'Opened a new Google Doc tab.' };
    },
  });

  register({
    id: 'cal', name: 'Calendar', slash: '/cal', category: 'tools', icon: '📅',
    description: 'Open the calendar panel.',
    runner: async () => { navTo('calendar'); return { ok: true, render: 'Opening calendar.' }; },
  });

  register({
    id: 'research', name: 'Research', slash: '/research', category: 'tools', icon: '🔍',
    description: 'Synthesize Wikipedia + Brave + Reddit results.',
    runner: async (args) => {
      if (!args) return { ok: false, message: 'Usage: /research <query>' };
      const txt = await fluxCallAI({ system: 'Synthesize a short research brief: claim, evidence (3 bullets), opposing view, caveats. Cite sources by name.', user: args });
      return { ok: true, render: txt };
    },
  });

  register({
    id: 'screenshot', name: 'Screenshot', slash: '/screenshot', category: 'tools', icon: '📸',
    description: 'Annotate current tab (via extension).',
    runner: async () => {
      return { ok: true, render: 'Open the Flux browser extension to capture + annotate the current tab.' };
    },
  });

  register({
    id: 'translate', name: 'Translate', slash: '/translate', category: 'tools', icon: '🌐',
    description: 'Translate the current panel content.',
    runner: async (args) => {
      const target = args || 'Spanish';
      const text = (document.querySelector('.main-content .panel.active')?.innerText || '').slice(0, 6000);
      if (!text) return { ok: false, message: 'Nothing to translate.' };
      const txt = await fluxCallAI({ system: `Translate the input into ${target}. Preserve formatting.`, user: 'Translate.', context: text });
      return { ok: true, render: txt };
    },
  });

  /* ───────── Special: /help, /sk, /palette ───────── */

  register({
    id: 'help', name: 'Help', slash: '/help', category: 'meta', icon: 'ℹ️',
    description: 'List all available skills.',
    runner: async () => {
      const role = (window.FluxRole && window.FluxRole.current) || 'student';
      const list = all({ role });
      const grouped = list.reduce((acc, s) => { (acc[s.category] = acc[s.category] || []).push(s); return acc; }, {});
      let html = '<div class="flux-skills-help">';
      Object.keys(grouped).forEach((cat) => {
        html += `<div style="margin-top:8px"><div style="font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">${escHtml(cat)}</div>`;
        html += grouped[cat].map((s) => `<div style="display:flex;gap:8px;font-size:.85rem;padding:4px 0"><span>${s.icon}</span><code style="color:var(--accent)">${escHtml(s.slash)}</code><span style="color:var(--muted2)">${escHtml(s.description)}</span></div>`).join('');
        html += '</div>';
      });
      html += '</div>';
      return { ok: true, render: html, raw: true };
    },
  });

  /* ════════════════════════════════════════════════════════════════════════
   * Command palette (Cmd/Ctrl+K)
   * ════════════════════════════════════════════════════════════════════════ */

  function openPalette() {
    let p = document.getElementById('fluxSkillPalette');
    if (p) { p.classList.add('open'); p.querySelector('input')?.focus(); return; }
    p = document.createElement('div');
    p.id = 'fluxSkillPalette';
    p.className = 'flux-skill-palette';
    p.innerHTML = `
      <div class="flux-skill-palette-card">
        <input type="text" class="flux-skill-palette-input" placeholder="Type a skill: /plan, /summarize, /flashcards…" autocomplete="off" />
        <div class="flux-skill-palette-list" role="listbox"></div>
        <div class="flux-skill-palette-foot">↵ run · esc close · ↑↓ navigate</div>
      </div>
      <div class="flux-skill-palette-backdrop"></div>
    `;
    document.body.appendChild(p);

    const input = p.querySelector('input');
    const list = p.querySelector('.flux-skill-palette-list');
    const backdrop = p.querySelector('.flux-skill-palette-backdrop');
    const role = (window.FluxRole && window.FluxRole.current) || 'student';
    let items = all({ role });
    let cursor = 0;

    function render(q) {
      const filtered = q ? items.filter((s) => (s.slash + ' ' + s.name + ' ' + s.description).toLowerCase().includes(q.toLowerCase())) : items;
      if (cursor >= filtered.length) cursor = 0;
      list.innerHTML = filtered.map((s, i) => `
        <button type="button" class="flux-skill-palette-item ${i === cursor ? 'active' : ''}" data-slash="${s.slash}">
          <span style="font-size:1rem">${s.icon}</span>
          <div style="min-width:0;flex:1">
            <div style="display:flex;gap:8px;align-items:center"><code style="color:var(--accent);font-weight:700">${escHtml(s.slash)}</code><span style="font-weight:600">${escHtml(s.name)}</span></div>
            <div style="color:var(--muted2);font-size:.7rem;margin-top:2px">${escHtml(s.description)}</div>
          </div>
        </button>
      `).join('') || '<div style="padding:16px;color:var(--muted)">No skill matches.</div>';
    }

    function close() { p.classList.remove('open'); }

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', async (e) => {
      const buttons = [...list.querySelectorAll('.flux-skill-palette-item')];
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, buttons.length - 1); render(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); render(input.value); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const target = buttons[cursor];
        if (target) {
          const slash = target.getAttribute('data-slash');
          close();
          const args = input.value.startsWith(slash) ? input.value.slice(slash.length).trim() : '';
          const r = await run(slash, args, { source: 'palette' });
          showResult(r);
        }
      }
    });
    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-slash]');
      if (!btn) return;
      const slash = btn.getAttribute('data-slash');
      close();
      const r = await run(slash, '', { source: 'palette' });
      showResult(r);
    });
    backdrop.addEventListener('click', close);

    setTimeout(() => p.classList.add('open'), 0);
    render('');
    input.focus();
  }

  function showResult(r) {
    if (!r) return;
    if (r.ok === false) { showToast(r.message || 'Skill failed', 'warn'); return; }
    if (typeof r.render !== 'string') { showToast(r.message || 'Done.', 'success'); return; }
    // Modal-ish result
    const overlay = document.createElement('div');
    overlay.className = 'flux-skill-result-overlay';
    overlay.innerHTML = `
      <div class="flux-skill-result-card">
        <button type="button" class="flux-skill-result-close" aria-label="Close">×</button>
        <div class="flux-skill-result-body">${r.raw ? r.render : `<pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:.92rem;line-height:1.6">${escHtml(r.render)}</pre>`}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 240); };
    overlay.querySelector('.flux-skill-result-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    setTimeout(() => document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } }), 0);
  }

  /* ───────── Boot ───────── */

  function bindShortcut() {
    document.addEventListener('keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        openPalette();
      }
    });
  }
  bindShortcut();

  /* AI integration — parse ```skill``` blocks from AI responses */
  document.addEventListener('flux-ai-response', async (e) => {
    const text = e?.detail?.text || '';
    const m = text.match(/```skill\s*(\{[\s\S]*?\})\s*```/);
    if (!m) return;
    let payload;
    try { payload = JSON.parse(m[1]); } catch (_) { return; }
    if (!payload || !payload.id) return;
    await run(payload.id, payload.args || '', { source: 'ai' });
  });

  /* App.js already exposes window.FluxSkills (a different earlier registry).
   * Mount under FluxSkillsV2 to avoid overwriting it, and also bridge a few
   * aliases on the existing object when present. */
  const api = {
    register, all, get, run, runInput, parse,
    openPalette, showResult,
  };
  window.FluxSkillsV2 = api;
  /* Mirror non-conflicting helpers onto the original namespace so callers can
   * use either. Don't clobber legacy keys (register/parseSkillCalls/etc). */
  if (window.FluxSkills && typeof window.FluxSkills === 'object') {
    if (typeof window.FluxSkills.openPalette !== 'function') window.FluxSkills.openPalette = openPalette;
    if (typeof window.FluxSkills.runInput !== 'function') window.FluxSkills.runInput = runInput;
    if (typeof window.FluxSkills.all !== 'function') window.FluxSkills.all = all;
  } else {
    window.FluxSkills = api;
  }
})();
