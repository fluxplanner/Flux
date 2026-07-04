/* ════════════════════════════════════════════════════════════════════
   FLUX · Brain — the trainable knowledge layer for Flux AI.

   Three parts:
   1. PLAYBOOK — distilled planning + study-science heuristics injected
      into every chat system prompt (the "pre-trained" smarts).
   2. LEARNED NOTES — durable facts/preferences the student teaches Flux
      ("remember that I have swim practice Tuesdays"). The model emits a
      ```remember block; we persist it and inject it every chat.
   3. SETTINGS CARD — Settings → AI → "Teach Flux": view, add, toggle,
      and delete everything Flux has learned.

   Storage: localStorage 'flux_brain_notes' = [{id,text,on,ts}]
   API: window.FluxBrain = { prompt, remember, notes, remove, toggle }
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxBrain) return;

  var KEY = 'flux_brain_notes';
  var MAX_NOTES = 60;
  var MAX_NOTE_LEN = 240;

  function loadNotes() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function saveNotes(n) {
    try { localStorage.setItem(KEY, JSON.stringify(n.slice(0, MAX_NOTES))); } catch (e) {}
  }

  /* ── 1. Playbook — compact, high-leverage, always on ───────────── */
  var PLAYBOOK = [
    'PLANNING HEURISTICS:',
    '- Triage by (due date × grade weight × student energy), not by list order. A quiz tomorrow beats an essay in ten days unless the essay is >20% of the grade.',
    '- Break anything estimated over 45 min into named sub-steps with their own mini-deadlines. Vague tasks ("study bio") never get done; concrete ones ("redo the 6 Krebs-cycle flashcards, then explain it aloud once") do.',
    '- Schedule hard-thinking work in the student\'s best hours (check their mood/energy data if present); put low-effort admin (emails, packing, forms) in dead gaps between classes.',
    '- Always leave one buffer block per day empty. A plan with zero slack fails on the first surprise.',
    '- If a task has been rescheduled 3+ times, stop rescheduling it — either shrink it to a 10-minute starter version, or tell the student honestly to drop it.',
    'STUDY SCIENCE (use these, name them casually, never lecture about them):',
    '- Retrieval beats rereading: turn notes into questions; quiz, don\'t skim.',
    '- Spacing beats cramming: for an exam in N days, plan ~3 touches: now, N/2, and the day before. Match Flux flashcards/SRS when relevant.',
    '- Interleave related problem types inside one session; block-practice only when first learning a skill.',
    '- For math/physics: worked example → cover it → re-derive from scratch → then a fresh variant with different numbers.',
    '- For essays: thesis sentence first, evidence bullets second, prose last. Never start by "writing the intro".',
    'WHEN THE STUDENT IS OVERWHELMED:',
    '- First shrink the horizon to today. Pick the 1-3 items that actually matter, name what is being deliberately dropped or deferred, and say why that is safe.',
    '- Offer the 10-minute rule for avoidance: commit to only 10 minutes of the dreaded task; starting is the whole battle.',
    'TOOLS: When a Flux tool or skill can do the job (plan my day, flashcards, timers, Canvas lookups), call it instead of describing it. Prefer one decisive tool call over asking clarifying questions you can answer from planner data.',
    'MEMORY: When the student tells you something worth remembering for future sessions (a standing commitment, a preference, a goal, how they like answers), append at the very end of your reply:',
    '```remember',
    'one short third-person note, max 200 chars',
    '```',
    'Only save durable facts, never one-off tasks (those are task actions). Never announce that you saved it beyond a single short clause.'
  ].join('\n');

  /* ── 2. Prompt assembly ────────────────────────────────────────── */
  function prompt() {
    var out = '\n<flux_training>\n' + PLAYBOOK + '\n';
    var notes = loadNotes().filter(function (n) { return n.on !== false; });
    if (notes.length) {
      out += '\nTHINGS THE STUDENT TAUGHT YOU (treat as true, apply without being asked):\n';
      out += notes.map(function (n) { return '- ' + n.text; }).join('\n') + '\n';
    }
    out += '</flux_training>\n';
    return out;
  }

  function remember(text, opts) {
    text = String(text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NOTE_LEN);
    if (!text) return false;
    var notes = loadNotes();
    var dup = notes.some(function (n) { return n.text.toLowerCase() === text.toLowerCase(); });
    if (dup) return false;
    notes.unshift({ id: Date.now(), text: text, on: true, ts: Date.now() });
    saveNotes(notes);
    renderCard();
    if (!(opts && opts.silent) && typeof window.showToast === 'function') {
      window.showToast('Flux will remember that', 'success');
    }
    return true;
  }

  function remove(id) {
    saveNotes(loadNotes().filter(function (n) { return n.id !== id; }));
    renderCard();
  }
  function toggle(id) {
    var notes = loadNotes();
    notes.forEach(function (n) { if (n.id === id) n.on = n.on === false; });
    saveNotes(notes);
    renderCard();
  }

  /* ── capture ```remember blocks from AI replies ────────────────── */
  var RE_REMEMBER = /```remember\s*([\s\S]*?)(?:```|$)/gi;
  function scanReply(reply) {
    if (!reply || reply.indexOf('remember') === -1) return;
    var m;
    RE_REMEMBER.lastIndex = 0;
    while ((m = RE_REMEMBER.exec(reply)) !== null) {
      var text = (m[1] || '').trim();
      if (text) remember(text);
    }
  }

  // Wrap the global action executor so remember-blocks are captured on
  // every AI reply without touching the chat pipeline.
  function hookExec() {
    var orig = window.execActions;
    if (typeof orig !== 'function' || orig.__fluxBrainWrapped) { setTimeout(hookExec, 800); return; }
    var wrapped = function (reply) {
      try { scanReply(reply); } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__fluxBrainWrapped = true;
    window.execActions = wrapped;
  }

  // Strip remember-blocks from rendered chat bubbles (fmtAI shows raw text).
  function hookFmt() {
    var orig = window.fmtAI;
    if (typeof orig !== 'function' || orig.__fluxBrainWrapped) { setTimeout(hookFmt, 800); return; }
    var wrapped = function (text) {
      try { if (typeof text === 'string') text = text.replace(RE_REMEMBER, '').trim(); } catch (e) {}
      return orig.call(this, text);
    };
    wrapped.__fluxBrainWrapped = true;
    window.fmtAI = wrapped;
  }

  /* ── 3. Settings card (Settings → AI) ──────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderCard() {
    var mount = document.getElementById('fluxBrainSettingsMount');
    if (!mount) return;
    var notes = loadNotes();
    var rows = notes.map(function (n) {
      var off = n.on === false;
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<button type="button" class="toggle' + (off ? '' : ' on') + '" aria-label="Toggle note" aria-pressed="' + (!off) + '" style="transform:scale(.8)" onclick="FluxBrain.toggle(' + n.id + ')"></button>' +
        '<div style="flex:1;font-size:.8rem;line-height:1.45;' + (off ? 'opacity:.45;text-decoration:line-through' : '') + '">' + esc(n.text) + '</div>' +
        '<button type="button" class="btn-sec" style="padding:3px 9px;font-size:.72rem" onclick="FluxBrain.remove(' + n.id + ')">Remove</button>' +
        '</div>';
    }).join('');
    mount.innerHTML =
      '<div class="card">' +
      '<h3>Teach Flux</h3>' +
      '<p style="font-size:.78rem;color:var(--muted2);line-height:1.55;margin:0 0 12px">Flux keeps a small set of facts it has learned about you and applies them in every chat. Teach it in conversation ("remember that…") or add a note here. Notes stay on this device.</p>' +
      '<div style="max-height:260px;overflow-y:auto">' + (rows || '<div style="font-size:.78rem;color:var(--muted);padding:6px 0">Nothing learned yet. Try telling Flux: "Remember that I have practice on Tuesdays and Thursdays."</div>') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<input type="text" id="fluxBrainNewNote" maxlength="' + MAX_NOTE_LEN + '" placeholder="e.g. I take AP Chem — prefer harder practice problems" style="flex:1;margin:0" onkeydown="if(event.key===\'Enter\')FluxBrain.addFromInput()">' +
      '<button type="button" onclick="FluxBrain.addFromInput()" style="padding:8px 16px">Teach</button>' +
      '</div>' +
      '</div>';
  }

  function addFromInput() {
    var el = document.getElementById('fluxBrainNewNote');
    if (!el || !el.value.trim()) return;
    remember(el.value, { silent: true });
    el.value = '';
  }

  window.FluxBrain = {
    prompt: prompt,
    remember: remember,
    remove: remove,
    toggle: toggle,
    notes: loadNotes,
    addFromInput: addFromInput,
    scanReply: scanReply,
    render: renderCard
  };

  function start() {
    hookExec();
    hookFmt();
    renderCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
