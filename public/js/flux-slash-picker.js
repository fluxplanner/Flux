/**
 * flux-slash-picker.js — Discord-style slash-command autocomplete for Flux AI.
 *
 * When the user types "/" at the start of the AI input, a filterable popup of
 * available commands appears above the composer. Arrow keys move the
 * selection, Enter/Tab/click accepts it (fills "/slash " so the user can add
 * args), Esc closes. Commands come from the FluxSkills registry; a small set
 * of built-in planner commands is always included.
 *
 * Self-contained IIFE, no imports. Attaches to #aiInput whenever it appears.
 */
(function () {
  'use strict';

  var INPUT_ID = 'aiInput';
  var pop = null;        // popup element
  var rows = [];         // current filtered commands
  var sel = 0;           // selected index
  var boundInput = null; // the input we're attached to

  /* Built-ins always present even if FluxSkills hasn't registered them. */
  var BUILTINS = [
    { slash: '/plan', name: 'Plan my week', description: 'Build a study plan around your tasks and deadlines', category: 'planning' },
    { slash: '/optimize', name: 'Optimize schedule', description: 'Rebalance today around energy and priorities', category: 'planning' },
    { slash: '/fix', name: 'Catch up', description: 'Recover from overdue or missed work', category: 'planning' },
    { slash: '/ask', name: 'Ask another AI', description: 'Route a question to your connected Claude/GPT/Gemini key', category: 'ai' },
    { slash: '/summarize', name: 'Summarize', description: 'Summarize a note, page, or pasted text', category: 'study' },
    { slash: '/flashcards', name: 'Flashcards', description: 'Generate flashcards from material', category: 'study' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICONS = {
    planning: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    study: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    ai: '<path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6M6 6l3.2 3.2M14.8 14.8 18 18M18 6l-3.2 3.2M9.2 14.8 6 18"/>',
    _default: '<path d="m13 2-3 7h6l-3 7"/><circle cx="12" cy="12" r="9"/>',
  };
  function iconFor(cat) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[cat] || ICONS._default) + '</svg>';
  }

  /** Collect commands from the FluxSkills registry merged with built-ins. */
  function allCommands() {
    var out = [];
    var seen = {};
    function push(c) {
      if (!c || !c.slash) return;
      var slash = c.slash[0] === '/' ? c.slash : '/' + c.slash;
      if (seen[slash]) return;
      seen[slash] = 1;
      out.push({ slash: slash, name: c.name || slash, description: c.description || '', category: c.category || '' });
    }
    try {
      var reg = (window.FluxSkillsV2 && window.FluxSkillsV2.all) ? window.FluxSkillsV2.all()
        : (window.FluxSkills && typeof window.FluxSkills.all === 'function' ? window.FluxSkills.all() : []);
      (reg || []).forEach(push);
    } catch (_) {}
    BUILTINS.forEach(push);
    out.sort(function (a, b) { return a.slash.localeCompare(b.slash); });
    return out;
  }

  /** If the input is mid-slash-command (no space yet), return the partial term. */
  function slashTerm(val) {
    var m = /^\/([a-z0-9_-]*)$/i.exec(val || '');
    return m ? m[1].toLowerCase() : null;
  }

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'flux-slash-pop';
    pop.id = 'fluxSlashPop';
    pop.setAttribute('role', 'listbox');
    pop.addEventListener('mousedown', function (e) {
      // mousedown (not click) so the input doesn't blur first
      var row = e.target.closest('[data-slash]');
      if (!row) return;
      e.preventDefault();
      accept(row.getAttribute('data-slash'));
    });
    document.body.appendChild(pop);
    return pop;
  }

  function hide() {
    if (pop) pop.style.display = 'none';
    rows = [];
  }

  function position() {
    if (!pop || !boundInput) return;
    var r = boundInput.getBoundingClientRect();
    pop.style.left = r.left + 'px';
    pop.style.width = Math.max(280, r.width) + 'px';
    // place above the input; flip below if not enough room
    var h = pop.offsetHeight || 240;
    var top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    pop.style.top = top + 'px';
  }

  function render(term) {
    var cmds = allCommands().filter(function (c) {
      if (!term) return true;
      return c.slash.indexOf(term) >= 0 || (c.name || '').toLowerCase().indexOf(term) >= 0;
    });
    rows = cmds;
    if (!cmds.length) { hide(); return; }
    if (sel >= cmds.length) sel = 0;
    ensurePop();
    pop.innerHTML =
      '<div class="flux-slash-head">COMMANDS</div>' +
      cmds.map(function (c, i) {
        return '<div class="flux-slash-row' + (i === sel ? ' sel' : '') + '" role="option" data-slash="' + esc(c.slash) + '" data-i="' + i + '">' +
          '<span class="flux-slash-ico">' + iconFor(c.category) + '</span>' +
          '<span class="flux-slash-main"><span class="flux-slash-cmd">' + esc(c.slash) + '</span>' +
          (c.description ? '<span class="flux-slash-desc">' + esc(c.description) + '</span>' : '') + '</span>' +
          '<span class="flux-slash-name">' + esc(c.name) + '</span>' +
        '</div>';
      }).join('');
    pop.style.display = 'block';
    position();
    scrollSel();
  }

  function scrollSel() {
    if (!pop) return;
    var el = pop.querySelector('.flux-slash-row.sel');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function move(d) {
    if (!rows.length) return;
    sel = (sel + d + rows.length) % rows.length;
    pop.querySelectorAll('.flux-slash-row').forEach(function (el, i) {
      el.classList.toggle('sel', i === sel);
    });
    scrollSel();
  }

  function accept(slash) {
    if (!boundInput) return;
    boundInput.value = slash + ' ';
    hide();
    boundInput.focus();
    // move caret to end + fire input so any listeners update
    try {
      boundInput.selectionStart = boundInput.selectionEnd = boundInput.value.length;
      boundInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {}
  }

  function isOpen() { return pop && pop.style.display === 'block' && rows.length > 0; }

  function onInput() {
    var term = slashTerm(boundInput.value);
    if (term === null) { hide(); return; }
    sel = 0;
    render(term);
  }

  function onKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); move(-1); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (rows[sel]) accept(rows[sel].slash);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation(); hide();
    }
  }

  function attach(input) {
    if (!input || input === boundInput) return;
    boundInput = input;
    input.addEventListener('input', onInput);
    // capture phase so we intercept Enter before the send handler
    input.addEventListener('keydown', onKeydown, true);
    input.addEventListener('blur', function () { setTimeout(hide, 120); });
  }

  function boot() {
    var input = document.getElementById(INPUT_ID);
    if (input) attach(input);
    // Re-attach if the input gets replaced (panel re-render)
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () {
        var el = document.getElementById(INPUT_ID);
        if (el && el !== boundInput) attach(el);
      });
      try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    window.addEventListener('resize', function () { if (isOpen()) position(); });
    window.addEventListener('scroll', function () { if (isOpen()) position(); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxSlashPicker = { _all: allCommands, _term: slashTerm };
})();
