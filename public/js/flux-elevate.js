/**
 * Flux · Elevate — high-impact UX layer
 *
 * Layered enhancements that build on existing infrastructure:
 *   1. Smart contextual greeting (time/streak/workload aware)
 *   2. Streak ring widget in dashboard hero
 *   3. Auto-save micro-indicator for notes/textareas
 *   4. Milestone celebrations (5/10/25/50/100/250/500/1000 lifetime tasks)
 *   5. First-visit keyboard hint rail
 *   6. Illustrated empty states (task list)
 *   7. Quick-command chip toolbar on dashboard
 *   8. "Due today" badge auto-tag
 *
 * Self-contained IIFE — exposes window.FluxElevate.
 * Respects prefers-reduced-motion and existing FluxStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY_LIFETIME = 'flux_elv_lifetime_done';
  var STORAGE_KEY_LAST_MS  = 'flux_elv_last_milestone';
  var STORAGE_KEY_HINT_SEEN= 'flux_elv_hints_seen_v1';
  var STORAGE_KEY_CMD_RAIL = 'flux_elv_cmd_rail_dismissed_v1';

  var MILESTONES = [
    { n: 5,    title: 'First five down',           sub: 'You\'re building momentum.', emoji: '🌱' },
    { n: 10,   title: 'Ten tasks crushed',         sub: 'Habits are forming.',        emoji: '⚡' },
    { n: 25,   title: 'Quarter-century of focus',  sub: 'You show up every day.',    emoji: '🚀' },
    { n: 50,   title: 'Half a hundred',            sub: 'Consistency is your edge.', emoji: '🔥' },
    { n: 100,  title: 'Centurion',                 sub: 'A hundred completed tasks. Wild.', emoji: '🏆' },
    { n: 250,  title: 'Two-fifty club',            sub: 'You\'re a Flux power user.', emoji: '💎' },
    { n: 500,  title: 'Five hundred milestone',    sub: 'Genuinely impressive.',      emoji: '👑' },
    { n: 1000, title: 'Thousand-task legend',      sub: 'You built a planet of focus.', emoji: '🌌' },
  ];

  function motionOk() {
    if (document.documentElement.classList.contains('flux-reduce-motion')) return false;
    try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return true; }
  }

  function load(key, def) {
    try {
      if (window.FluxStorage && typeof window.FluxStorage.load === 'function') {
        var v = window.FluxStorage.load(key, def);
        return v == null ? def : v;
      }
      var raw = localStorage.getItem(key);
      if (raw == null || raw === '') return def;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    } catch (_) { return def; }
  }
  function save(key, val) {
    try {
      if (window.FluxStorage && typeof window.FluxStorage.save === 'function') {
        return window.FluxStorage.save(key, val);
      }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  /* ── 1. Smart contextual greeting ──────────────────────────── */
  function getTodayStr() {
    var d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }

  function computeContext() {
    var tasks = Array.isArray(window.tasks) ? window.tasks : [];
    var today = getTodayStr();
    var todayTasks = tasks.filter(function (t) { return !t.done && t.date === today; });
    var overdue = tasks.filter(function (t) {
      if (t.done || !t.date) return false;
      return t.date < today;
    });
    var streak = 0;
    try {
      if (window.FluxProgressStreak && typeof FluxProgressStreak.current === 'function') {
        streak = FluxProgressStreak.current() | 0;
      } else if (typeof window.computeStreak === 'function') {
        streak = window.computeStreak() | 0;
      } else {
        // Inline fallback: consecutive days with at least one completed task
        var doneByDay = {};
        tasks.forEach(function (t) {
          if (!t.done) return;
          var ts = t.completedAt || t.updatedAt || t.createdAt;
          if (!ts) return;
          var k = new Date(ts).toISOString().slice(0,10);
          doneByDay[k] = (doneByDay[k] || 0) + 1;
        });
        var d = new Date(); d.setHours(0,0,0,0);
        while (doneByDay[d.toISOString().slice(0,10)]) {
          streak++; d.setDate(d.getDate() - 1);
        }
      }
    } catch (_) {}
    return {
      tasks: tasks, today: today,
      todayCount: todayTasks.length,
      overdueCount: overdue.length,
      streak: streak,
    };
  }

  function smartSubLine(ctx) {
    var parts = [];
    if (ctx.streak >= 2) parts.push('<span class="flux-elv-chip flux-elv-chip--warm">🔥 ' + ctx.streak + '‑day streak</span>');
    if (ctx.todayCount > 0) parts.push('<span class="flux-elv-chip">' + ctx.todayCount + ' due today</span>');
    if (ctx.overdueCount > 0) parts.push('<span class="flux-elv-chip flux-elv-chip--warm">' + ctx.overdueCount + ' overdue</span>');
    if (!parts.length) parts.push('<span class="flux-elv-chip flux-elv-chip--ok">Clear runway</span>');
    var msg;
    if (ctx.overdueCount > 0) msg = 'Knock out the overdue first — quick wins unlock momentum.';
    else if (ctx.todayCount > 3) msg = 'Big day. Start with the highest-priority one.';
    else if (ctx.todayCount > 0) msg = 'Few things to ship today. You\'ve got this.';
    else if (ctx.streak >= 7)    msg = 'A week of focus locked in. Keep the flow.';
    else                         msg = 'Quiet board. Plan tomorrow, or rest well.';
    return parts.join(' ') + ' <span style="opacity:.85">' + msg + '</span>';
  }

  function injectGreeting() {
    var greetEl = document.getElementById('dashGreeting');
    if (!greetEl) return false;
    var ctx = computeContext();
    // The app already renders the H1 greeting itself (with gradient + shimmer); don't fight over it.
    // We just append a context-aware subline + hero strip below.
    // Subline (only update if changed to avoid layout thrash)
    var hero = greetEl.closest('.dash-v2-greet') || greetEl.parentElement;
    if (hero) {
      var sub = hero.querySelector('.flux-elv-greet-sub');
      var subHtml = smartSubLine(ctx);
      if (!sub) {
        sub = document.createElement('div');
        sub.className = 'flux-elv-greet-sub';
        sub.innerHTML = subHtml;
        // Insert directly after dash-hero-row if available, else after greet
        var row = hero.querySelector('.dash-hero-row');
        if (row && row.parentElement === hero) row.insertAdjacentElement('afterend', sub);
        else greetEl.insertAdjacentElement('afterend', sub);
      } else if (sub.dataset.elvSub !== subHtml) {
        sub.innerHTML = subHtml;
      }
      sub.dataset.elvSub = subHtml;
    }
    // Hero strip with streak ring (compact)
    injectHeroStrip(hero, ctx);
    return true;
  }

  /* ── 2. Streak ring in hero strip ──────────────────────────── */
  function streakRingSvg(streak, target) {
    var t = target || 7;
    var pct = Math.min(streak / t, 1);
    var r = 24, c = 2 * Math.PI * r;
    var off = c * (1 - pct);
    return ''
      + '<svg viewBox="0 0 56 56" aria-hidden="true">'
      +   '<defs><linearGradient id="fluxElvStreakGrad" x1="0%" y1="0%" x2="100%" y2="100%">'
      +     '<stop offset="0%" stop-color="var(--accent,#00C2FF)"/>'
      +     '<stop offset="60%" stop-color="var(--purple,#7C5CFF)"/>'
      +     '<stop offset="100%" stop-color="var(--green,#22FF88)"/>'
      +   '</linearGradient></defs>'
      +   '<circle class="flux-elv-streak-ring__track" cx="28" cy="28" r="' + r + '"/>'
      +   '<circle class="flux-elv-streak-ring__fill"  cx="28" cy="28" r="' + r + '" '
      +          'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/>'
      + '</svg>'
      + '<div class="flux-elv-streak-ring__num">' + streak + '</div>'
      + (streak >= 3 ? '<span class="flux-elv-streak-ring__fire">🔥</span>' : '');
  }

  function injectHeroStrip(hero, ctx) {
    if (!hero) return;
    var sub = hero.querySelector('.flux-elv-greet-sub');
    var anchor = sub || hero.querySelector('.dash-mob-date-row') || hero.lastElementChild;
    if (!anchor) return;
    var strip = hero.querySelector('.flux-elv-hero-strip');
    var doneToday = (ctx.tasks || []).filter(function (t) {
      if (!t.done) return false;
      var ts = t.completedAt || t.updatedAt;
      if (!ts) return false;
      return new Date(ts).toISOString().slice(0,10) === ctx.today;
    }).length;
    var html = ''
      + '<div class="flux-elv-streak-ring" title="' + ctx.streak + '-day streak">' + streakRingSvg(ctx.streak) + '</div>'
      + '<div class="flux-elv-hero-strip-item"><span class="micro">Done today</span> <b>' + doneToday + '</b></div>'
      + '<div class="flux-elv-hero-strip-divider"></div>'
      + '<div class="flux-elv-hero-strip-item"><span class="micro">Due</span> <b>' + ctx.todayCount + '</b></div>'
      + (ctx.overdueCount > 0
          ? '<div class="flux-elv-hero-strip-divider"></div>'
          + '<div class="flux-elv-hero-strip-item" style="color:var(--gold,#f5a623)"><span class="micro">Overdue</span> <b>' + ctx.overdueCount + '</b></div>'
          : '');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'flux-elv-hero-strip';
      strip.innerHTML = html;
      anchor.insertAdjacentElement('afterend', strip);
    } else if (strip.dataset.elvHtml !== html) {
      strip.innerHTML = html;
    }
    strip.dataset.elvHtml = html;
  }

  /* ── 3. Auto-save indicator ─────────────────────────────────── */
  var _savePill;
  function showSavePill(text) {
    if (!_savePill) {
      _savePill = document.createElement('div');
      _savePill.className = 'flux-elv-save-pill';
      document.body.appendChild(_savePill);
    }
    _savePill.textContent = text || 'Saved';
    _savePill.classList.add('visible');
    clearTimeout(_savePill._hideTimer);
    _savePill._hideTimer = setTimeout(function () {
      _savePill.classList.remove('visible');
    }, 1400);
  }

  function hookAutoSave() {
    // Heuristic: watch any textarea or input inside .panel that has data-auto-save
    // OR matches known note editors / settings inputs. We do NOT save anything ourselves
    // — we just react to input events (existing app already auto-saves these targets).
    var SELECTORS = [
      'textarea#noteContent',
      'textarea#lessonNotes',
      'textarea[data-auto-save]',
      'input[data-auto-save]',
      'textarea.note-textarea',
      '#mn_body',
      '.flux-mn-body',
      'textarea#editNotes',
    ].join(',');
    var debounce = null;
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.matches || !t.matches(SELECTORS)) return;
      clearTimeout(debounce);
      debounce = setTimeout(function () { showSavePill('✓ Saved'); }, 750);
    }, true);
  }

  /* ── 4. Milestone celebration ──────────────────────────────── */
  function countLifetimeDone() {
    var tasks = Array.isArray(window.tasks) ? window.tasks : [];
    var stored = load(STORAGE_KEY_LIFETIME, null);
    var doneNow = tasks.filter(function (t) { return t.done; }).length;
    // Lifetime should be monotonic: take max(stored, doneNow).
    var lifetime = Math.max(stored | 0, doneNow);
    if (lifetime !== (stored | 0)) save(STORAGE_KEY_LIFETIME, lifetime);
    return lifetime;
  }

  function maybeFireMilestone() {
    var n = countLifetimeDone();
    var last = load(STORAGE_KEY_LAST_MS, 0) | 0;
    var hit = null;
    for (var i = 0; i < MILESTONES.length; i++) {
      var m = MILESTONES[i];
      if (n >= m.n && last < m.n) { hit = m; break; }
    }
    if (!hit) return;
    save(STORAGE_KEY_LAST_MS, hit.n);
    showMilestone(hit, n);
  }

  function showMilestone(m, n) {
    var ok = motionOk();
    var overlay = document.createElement('div');
    overlay.className = 'flux-elv-milestone';
    overlay.innerHTML =
      '<div class="flux-elv-milestone__card">'
      +   '<div class="flux-elv-milestone__num">' + m.n + '</div>'
      +   '<div class="flux-elv-milestone__label">Milestone Unlocked ' + m.emoji + '</div>'
      +   '<div class="flux-elv-milestone__title">' + escHtml(m.title) + '</div>'
      +   '<div class="flux-elv-milestone__sub">' + escHtml(m.sub) + '</div>'
      +   '<button class="flux-elv-milestone__btn" type="button">Keep going</button>'
      + '</div>';
    document.body.appendChild(overlay);
    function close() {
      overlay.classList.remove('visible');
      setTimeout(function () { overlay.remove(); }, 350);
    }
    overlay.querySelector('.flux-elv-milestone__btn').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    });
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
      if (ok) fireConfetti();
    });
    // Auto-close after 6.5s
    setTimeout(close, 6500);
    // Forward to existing toast for the announce/log
    try {
      if (typeof window.showToast === 'function') window.showToast('🎉 ' + m.title + ' (' + m.n + ' tasks)', 'success', 4000);
    } catch (_) {}
  }

  function fireConfetti() {
    var colors = ['#00C2FF', '#7C5CFF', '#22FF88', '#F5A623', '#FF6B9D', '#4DDBFF'];
    var count = Math.min(72, Math.round(window.innerWidth / 22));
    for (var i = 0; i < count; i++) {
      (function (i) {
        var p = document.createElement('div');
        p.className = 'flux-elv-confetti';
        var startX = (Math.random() * 100) + 'vw';
        var driftX  = (Math.random() * 280 - 140) + 'px';
        var dur     = (2.4 + Math.random() * 1.6).toFixed(2) + 's';
        var rot     = (Math.random() * 360) + 'deg';
        var delay   = (Math.random() * 0.45).toFixed(2) + 's';
        p.style.cssText = ''
          + 'left:' + startX + ';top:-20px;'
          + 'background:' + colors[i % colors.length] + ';'
          + 'transform:rotate(' + rot + ');'
          + '--xt:' + driftX + ';--dur:' + dur + ';'
          + 'animation-delay:' + delay + ';';
        document.body.appendChild(p);
        p.addEventListener('animationend', function () { p.remove(); }, { once: true });
      })(i);
    }
  }

  /* ── Hook task completion → milestone check ─────────────────── */
  function hookTaskComplete() {
    var pending = null;
    function maybeCheck() {
      clearTimeout(pending);
      pending = setTimeout(maybeFireMilestone, 600);
    }
    document.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.type !== 'checkbox') return;
      // Only react to task-style checkboxes
      if (cb.classList && (
            cb.classList.contains('task-item-check')
         || cb.classList.contains('st-task-cb')
         || cb.closest('.task-item')
         || cb.closest('[data-task-id]'))) {
        if (cb.checked) maybeCheck();
      }
    }, true);
    // Also re-check periodically as a safety net (tasks could be updated programmatically)
    setInterval(maybeCheck, 12000);
  }

  /* ── 5. First-visit hint rail ──────────────────────────────── */
  function maybeShowHintRail() {
    if (load(STORAGE_KEY_HINT_SEEN, false)) return;
    // Skip on mobile (narrow). Guard against innerWidth=0 from headless captures.
    if (window.innerWidth > 0 && window.innerWidth < 700) return;
    // Only show after the user has been around for a moment
    setTimeout(function () {
      if (document.getElementById('fluxElvHintRail')) return;
      if (document.querySelector('.cmd-palette-overlay,.flux-prompt-overlay,#cmdPalette')) return;
      var rail = document.createElement('div');
      rail.id = 'fluxElvHintRail';
      rail.className = 'flux-elv-hint-rail';
      var isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      var mod = isMac ? '⌘' : 'Ctrl';
      rail.innerHTML =
        '<span class="flux-elv-hint-rail__item"><span class="flux-elv-hint-rail__kbd">' + mod + ' K</span> <b>Commands</b></span>'
      + '<span class="flux-elv-hint-rail__item"><span class="flux-elv-hint-rail__kbd">N</span> <b>New task</b></span>'
      + '<span class="flux-elv-hint-rail__item"><span class="flux-elv-hint-rail__kbd">/</span> <b>Flux AI</b></span>'
      + '<span class="flux-elv-hint-rail__item"><span class="flux-elv-hint-rail__kbd">?</span> <b>All shortcuts</b></span>'
      + '<button class="flux-elv-hint-rail__close" type="button" aria-label="Dismiss">✕</button>';
      document.body.appendChild(rail);
      rail.querySelector('.flux-elv-hint-rail__close').addEventListener('click', function () {
        dismissHintRail(rail);
      });
      requestAnimationFrame(function () { rail.classList.add('visible'); });
      // Auto-dismiss after 18s OR on Cmd+K usage
      var auto = setTimeout(function () { dismissHintRail(rail); }, 18000);
      var onKey = function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
          clearTimeout(auto); dismissHintRail(rail);
          document.removeEventListener('keydown', onKey, true);
        }
      };
      document.addEventListener('keydown', onKey, true);
    }, 2200);
  }

  function dismissHintRail(rail) {
    if (!rail) return;
    rail.classList.remove('visible');
    setTimeout(function () { rail.remove(); }, 400);
    save(STORAGE_KEY_HINT_SEEN, true);
  }

  /* ── 6. Empty state polish: enhance the existing .flux-empty-smart card ── */
  function polishEmptyState() {
    var existing = document.querySelector('#taskList .flux-empty-smart');
    if (!existing || existing.dataset.elvPolished === '1') return;
    var icon = existing.querySelector('.empty-icon');
    if (icon && !icon.querySelector('svg')) {
      icon.innerHTML = ''
      + '<svg class="flux-elv-empty-art" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56" aria-hidden="true">'
      +   '<defs><linearGradient id="fluxElvEmptyGSVG" x1="0%" y1="0%" x2="100%" y2="100%">'
      +     '<stop offset="0%" stop-color="var(--accent,#00C2FF)"/>'
      +     '<stop offset="100%" stop-color="var(--purple,#7C5CFF)"/>'
      +   '</linearGradient></defs>'
      +   '<rect x="10" y="14" width="44" height="40" rx="8" fill="rgba(255,255,255,0.04)" stroke="url(#fluxElvEmptyGSVG)" stroke-width="2.2"/>'
      +   '<circle cx="22" cy="28" r="3" fill="url(#fluxElvEmptyGSVG)"/>'
      +   '<rect x="29" y="26" width="20" height="4" rx="2" fill="rgba(255,255,255,.18)"/>'
      +   '<circle cx="22" cy="40" r="3" fill="rgba(34,255,136,.85)"/>'
      +   '<path d="M19.5 40l2 2 4-4" stroke="#0a0d18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
      +   '<rect x="29" y="38" width="14" height="4" rx="2" fill="rgba(255,255,255,.1)"/>'
      + '</svg>';
      icon.classList.add('flux-elv-empty__art');
    }
    existing.dataset.elvPolished = '1';
  }

  /* ── 7. Quick-command chip toolbar (dashboard) ─────────────── */
  function injectCmdRail() {
    if (load(STORAGE_KEY_CMD_RAIL, false)) return;
    var hero = document.querySelector('#dashboard .dash-v2-greet');
    if (!hero) return;
    if (hero.parentElement.querySelector('.flux-elv-cmd-rail')) return;
    var isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    var mod = isMac ? '⌘' : 'Ctrl';
    var rail = document.createElement('div');
    rail.className = 'flux-elv-cmd-rail';
    rail.innerHTML =
      '<button class="flux-elv-cmd-chip" type="button" data-elv-act="quick"><span class="flux-elv-cmd-chip__icon">＋</span> Quick add <span class="flux-elv-cmd-chip__kbd">N</span></button>'
    + '<button class="flux-elv-cmd-chip" type="button" data-elv-act="palette"><span class="flux-elv-cmd-chip__icon">⌘</span> Command palette <span class="flux-elv-cmd-chip__kbd">' + mod + 'K</span></button>'
    + '<button class="flux-elv-cmd-chip" type="button" data-elv-act="ai"><span class="flux-elv-cmd-chip__icon">✦</span> Ask Flux AI <span class="flux-elv-cmd-chip__kbd">/</span></button>'
    + '<button class="flux-elv-cmd-chip" type="button" data-elv-act="focus"><span class="flux-elv-cmd-chip__icon">⏱</span> Focus timer <span class="flux-elv-cmd-chip__kbd">T</span></button>'
    + '<button class="flux-elv-cmd-chip" type="button" data-elv-act="shortcuts"><span class="flux-elv-cmd-chip__icon">⌨</span> Shortcuts <span class="flux-elv-cmd-chip__kbd">?</span></button>'
    + '<button class="flux-elv-cmd-chip" type="button" data-elv-act="dismiss" style="margin-left:auto;color:var(--muted2,#7b809a)" title="Hide this rail">✕</button>';
    hero.insertAdjacentElement('afterend', rail);
    rail.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-elv-act]'); if (!btn) return;
      var a = btn.dataset.elvAct;
      try {
        if (a === 'quick')      (window.fluxOpenQuickAdd || window.openQuickAdd || function(){})();
        else if (a === 'palette') (window.openCommandPalette || function(){})();
        else if (a === 'ai')      { if (window.nav) window.nav('ai'); setTimeout(function(){ document.getElementById('aiInput')?.focus(); }, 150); }
        else if (a === 'focus')   { if (window.nav) window.nav('timer'); }
        else if (a === 'shortcuts') (window.openShortcutOverlay || function(){})();
        else if (a === 'dismiss') {
          save(STORAGE_KEY_CMD_RAIL, true);
          rail.remove();
          try { if (window.showToast) window.showToast('Quick-command rail hidden — re-enable from Settings', 'info', 2400); } catch (_) {}
        }
      } catch (_) {}
    });
  }

  /* ── 8. Tag tasks due today ────────────────────────────────── */
  function tagDueTodayTasks() {
    var today = getTodayStr();
    var items = document.querySelectorAll('#taskList .task-item');
    items.forEach(function (el) {
      var id = el.getAttribute('data-task-id'); if (!id) return;
      var t = (window.tasks || []).find(function (x) { return String(x.id) === String(id); });
      if (!t || t.done) { el.classList.remove('flux-elv-due-today'); return; }
      el.classList.toggle('flux-elv-due-today', t.date === today);
    });
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Observer + boot ──────────────────────────────────────── */
  var _scheduled = false;
  function schedule() {
    if (_scheduled) return;
    _scheduled = true;
    requestAnimationFrame(function () {
      _scheduled = false;
      try { injectGreeting(); } catch (_) {}
      try { injectCmdRail(); } catch (_) {}
      try { polishEmptyState(); } catch (_) {}
      try { tagDueTodayTasks(); } catch (_) {}
    });
  }

  function init() {
    hookAutoSave();
    hookTaskComplete();
    // Initial seed of lifetime counter (don't fire on existing legacy completes)
    if (load(STORAGE_KEY_LIFETIME, null) == null) {
      var seed = (window.tasks || []).filter(function (t) { return t.done; }).length;
      save(STORAGE_KEY_LIFETIME, seed);
      save(STORAGE_KEY_LAST_MS, MILESTONES.reduce(function (acc, m) { return seed >= m.n ? m.n : acc; }, 0));
    }
    var obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    schedule();
    maybeShowHintRail();
    // Refresh greeting every 10 min and on visibility change so it stays contextual
    setInterval(schedule, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.FluxElevate = {
    refresh: schedule,
    showSavePill: showSavePill,
    fireMilestone: function (n) {
      var m = MILESTONES.find(function (x) { return x.n === n; }) || MILESTONES[0];
      showMilestone(m, n);
    },
    resetHints: function () {
      save(STORAGE_KEY_HINT_SEEN, false);
      save(STORAGE_KEY_CMD_RAIL, false);
    },
    confetti: fireConfetti,
  };
})();
