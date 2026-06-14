/**
 * flux-curriculum.js — per-curriculum "Core requirements" tracker on the
 * profile. IB DP students get CAS / EE / TOK reminders; MYP, AP, and A-Level
 * get their own core components. Each item cycles To-do → In progress → Done
 * on click; progress is saved in synced user data (flux_curriculum_progress).
 *
 * Injects a card into #profile via a debounced MutationObserver (same pattern
 * as flux-office-hours), so it survives renderProfile re-renders. Reads the
 * user's program from the saved profile. Self-contained IIFE.
 */
(function () {
  'use strict';

  var KEY = 'flux_curriculum_progress';

  // Core components per curriculum. Each item: { id, name, detail }.
  var CURRICULA = {
    'IB DP': {
      label: 'IB Diploma — Core',
      groups: [
        { name: 'Theory of Knowledge (TOK)', items: [
          { id: 'tok_exhibition', name: 'TOK Exhibition', detail: '3 objects + 950-word commentary' },
          { id: 'tok_essay', name: 'TOK Essay', detail: '1,600 words on a prescribed title' },
        ] },
        { name: 'Extended Essay (EE)', items: [
          { id: 'ee_topic', name: 'Pick subject & supervisor', detail: 'Lock your EE subject early' },
          { id: 'ee_rq', name: 'Research question', detail: 'Focused, arguable, researchable' },
          { id: 'ee_draft', name: 'First full draft', detail: 'For supervisor feedback' },
          { id: 'ee_final', name: 'Final essay', detail: '4,000 words + reflections (RPPF)' },
        ] },
        { name: 'CAS', items: [
          { id: 'cas_outcomes', name: '7 learning outcomes', detail: 'Evidence each one' },
          { id: 'cas_project', name: 'CAS project', detail: 'Month-long collaborative project' },
          { id: 'cas_portfolio', name: 'Reflections & portfolio', detail: 'Ongoing across both years' },
        ] },
      ],
    },
    'IB MYP': {
      label: 'IB MYP — Core',
      groups: [
        { name: 'Projects', items: [
          { id: 'myp_personal', name: 'Personal Project', detail: 'MYP year 5 — report + product' },
          { id: 'myp_community', name: 'Community Project', detail: 'MYP 3/4 — service-based' },
        ] },
        { name: 'Service', items: [
          { id: 'myp_saa', name: 'Service as Action', detail: 'Ongoing service & reflections' },
        ] },
      ],
    },
    'AP': {
      label: 'AP — Reminders',
      groups: [
        { name: 'Exams', items: [
          { id: 'ap_register', name: 'Register for AP exams', detail: 'Fall deadline via your coordinator' },
          { id: 'ap_frq', name: 'Practice FRQs', detail: 'Past free-response by unit' },
        ] },
      ],
    },
    'A-Level': {
      label: 'A-Level — Reminders',
      groups: [
        { name: 'Coursework', items: [
          { id: 'al_nea', name: 'NEA / coursework', detail: 'Non-exam assessment deadlines' },
          { id: 'al_epq', name: 'EPQ (if taking)', detail: 'Extended Project Qualification' },
        ] },
      ],
    },
  };

  var STATES = ['todo', 'doing', 'done'];
  var STATE_LABEL = { todo: 'To-do', doing: 'In progress', done: 'Done' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load_(k, d) { try { return (typeof load === 'function') ? load(k, d) : d; } catch (e) { return d; } }
  function save_(k, v) { try { if (typeof save === 'function') save(k, v); } catch (e) {} }

  function progress() { var p = load_(KEY, {}); return (p && typeof p === 'object') ? p : {}; }

  function userPrograms() {
    var p = load_('profile', {}) || {};
    var raw = p.program;
    try { if (typeof window.normalizeProgramList === 'function') return window.normalizeProgramList(raw); } catch (e) {}
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) return [raw];
    return [];
  }

  // Map the user's programs to the curricula we have cores for (DP + MYP can
  // both show if both are present).
  function activeCurricula() {
    var progs = userPrograms();
    var out = [];
    progs.forEach(function (pr) {
      var key = String(pr || '').trim();
      if (CURRICULA[key] && out.indexOf(key) < 0) out.push(key);
      else if (/A[\s-]?Level/i.test(key) && out.indexOf('A-Level') < 0) out.push('A-Level');
    });
    return out;
  }

  function nextState(s) {
    var i = STATES.indexOf(s);
    return STATES[(i + 1 + STATES.length) % STATES.length] || 'todo';
  }

  function cardHtml() {
    var keys = activeCurricula();
    if (!keys.length) return '';
    var prog = progress();
    var sections = keys.map(function (key) {
      var c = CURRICULA[key];
      var total = 0, done = 0;
      var groupsHtml = c.groups.map(function (g) {
        var rows = g.items.map(function (it) {
          total++;
          var st = prog[it.id] || 'todo';
          if (st === 'done') done++;
          return '<button type="button" class="fxc-item fxc-' + st + '" data-fxc-id="' + esc(it.id) + '">' +
            '<span class="fxc-check" aria-hidden="true"></span>' +
            '<span class="fxc-main"><span class="fxc-name">' + esc(it.name) + '</span>' +
            '<span class="fxc-detail">' + esc(it.detail) + '</span></span>' +
            '<span class="fxc-state">' + STATE_LABEL[st] + '</span>' +
          '</button>';
        }).join('');
        return '<div class="fxc-group"><div class="fxc-group-name">' + esc(g.name) + '</div>' + rows + '</div>';
      }).join('');
      var pct = total ? Math.round(done / total * 100) : 0;
      return '<div class="fxc-curric">' +
        '<div class="fxc-curric-head"><span>' + esc(c.label) + '</span>' +
        '<span class="fxc-pct">' + done + '/' + total + '</span></div>' +
        '<div class="fxc-bar"><div class="fxc-bar-fill" style="width:' + pct + '%"></div></div>' +
        groupsHtml + '</div>';
    }).join('');
    return '<div class="card fxc-card" id="fluxCurriculumCard" data-student-profile-only>' +
      '<h3>Core requirements</h3>' +
      '<p class="fxc-sub">Tap an item to cycle To-do → In progress → Done. Synced to your account.</p>' +
      sections + '</div>';
  }

  function inject() {
    var panel = document.getElementById('profile');
    if (!panel) return;
    var keys = activeCurricula();
    var existing = document.getElementById('fluxCurriculumCard');
    if (!keys.length) { if (existing) existing.remove(); return; }
    var html = cardHtml();
    if (!html) return;
    if (existing) {
      var tmp0 = document.createElement('div'); tmp0.innerHTML = html;
      existing.parentNode.replaceChild(tmp0.firstChild, existing);
      return;
    }
    // Insert after the Academic Stats card if present, else append to the panel.
    var stats = document.getElementById('profileStats');
    var anchorCard = stats ? stats.closest('.card') : null;
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var card = tmp.firstChild;
    if (anchorCard && anchorCard.parentNode) anchorCard.parentNode.insertBefore(card, anchorCard.nextSibling);
    else panel.appendChild(card);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fxc-id]');
    if (!btn) return;
    var id = btn.getAttribute('data-fxc-id');
    var prog = progress();
    prog[id] = nextState(prog[id] || 'todo');
    save_(KEY, prog);
    inject(); // re-render to update state + progress bar
  });

  var _t = null;
  function schedule() { clearTimeout(_t); _t = setTimeout(inject, 80); }

  function boot() {
    var panel = document.getElementById('profile');
    if (panel && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (!document.getElementById('fluxCurriculumCard') && document.getElementById('profileStats')) schedule();
      });
      try { mo.observe(panel, { childList: true, subtree: true }); } catch (e) {}
    }
    inject();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxCurriculum = { inject: inject, _active: activeCurricula, _curricula: CURRICULA };
})();
