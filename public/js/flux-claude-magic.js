/**
 * Flux Claude Code Magic
 * Micro-interactions, counter animations, particle bursts, and
 * all the little "alive" touches that make the app feel polished.
 *
 * Self-contained IIFE — exposes window.FluxMagic for external callers.
 * Respects prefers-reduced-motion and the flux-reduce-motion class.
 */
(function () {
  'use strict';

  /* ── Reduced motion guard ─────────────────────────────────── */
  function motionOk() {
    if (document.documentElement.classList.contains('flux-reduce-motion')) return false;
    try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return true; }
  }

  /* ── Counter animation ─────────────────────────────────────── */
  function animateCounter(el, to, opts) {
    if (!el) return;
    var o = opts || {};
    var from = o.from != null ? o.from : 0;
    var duration = o.duration != null ? o.duration : 900;
    var suffix = o.suffix || '';
    var prefix = o.prefix || '';
    if (!motionOk()) { el.textContent = prefix + to + suffix; return; }

    var start = null;
    var range = to - from;
    function ease(t) { return 1 - Math.pow(1 - t, 3); } // easeOutCubic

    function tick(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      el.textContent = prefix + Math.round(from + range * ease(progress)) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = prefix + to + suffix;
        el.classList.add('flux-counter-pop');
        setTimeout(function () { el.classList.remove('flux-counter-pop'); }, 400);
      }
    }
    requestAnimationFrame(tick);
  }

  /* ── Ripple effect ─────────────────────────────────────────── */
  function createRipple(btn, clientX, clientY) {
    if (!btn || !motionOk()) return;
    btn.classList.add('flux-ripple-host');
    var rect = btn.getBoundingClientRect();
    var x = (clientX || rect.left + rect.width / 2) - rect.left;
    var y = (clientY || rect.top + rect.height / 2) - rect.top;
    var size = Math.max(rect.width, rect.height) * 2.2;
    var r = document.createElement('span');
    r.className = 'flux-ripple';
    r.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px';
    btn.appendChild(r);
    r.addEventListener('animationend', function () { r.remove(); }, { once: true });
  }

  function applyRipples() {
    document.addEventListener('click', function (e) {
      var target = e.target && e.target.closest && e.target.closest(
        'button,.edu-action-btn,.onboard-next-btn,.onboard-skip-btn,.btn-sec'
      );
      if (target) createRipple(target, e.clientX, e.clientY);
    }, true);
  }

  /* ── Particle burst ─────────────────────────────────────────── */
  var COLORS = ['var(--accent)','var(--green)','var(--purple)','var(--gold)','#4ddbff'];

  function particleBurst(x, y, opts) {
    if (!motionOk()) return;
    var o = opts || {};
    var count = o.count != null ? o.count : 12;
    var colors = o.colors || COLORS;
    for (var i = 0; i < count; i++) {
      (function(i) {
        var p = document.createElement('div');
        p.className = 'flux-particle';
        var angle = (i / count) * Math.PI * 2 + (Math.random() - .5) * .6;
        var dist = 40 + Math.random() * 65;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist - 22;
        var dur = (.35 + Math.random() * .3).toFixed(2);
        p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + colors[i % colors.length] + ';--dx:' + dx + 'px;--dy:' + dy + 'px;--dur:' + dur + 's';
        document.body.appendChild(p);
        p.addEventListener('animationend', function () { p.remove(); }, { once: true });
      })(i);
    }
    // Ring
    var ring = document.createElement('div');
    ring.className = 'flux-celebrate-ring';
    ring.style.cssText = 'left:' + x + 'px;top:' + y + 'px';
    document.body.appendChild(ring);
    ring.addEventListener('animationend', function () { ring.remove(); }, { once: true });
  }

  /* ── Stagger list children ─────────────────────────────────── */
  function staggerIn(container, delayStep) {
    if (!container || !motionOk()) return;
    var step = delayStep != null ? delayStep : 55;
    var items = container.children;
    for (var i = 0; i < items.length; i++) {
      items[i].style.animationDelay = (i * step) + 'ms';
    }
    container.classList.add('flux-stagger-in');
  }

  /* ── Skeleton loader ───────────────────────────────────────── */
  function skeleton(el, lines) {
    if (!el) return;
    var n = lines != null ? lines : 3;
    var widths = ['wide', 'medium', 'short'];
    el.innerHTML = Array.from({ length: n }, function (_, i) {
      return '<div class="flux-skeleton flux-skel-line flux-skel-line--' + widths[i % 3] + '"></div>';
    }).join('');
  }

  /* ── Animate staff profile stat numbers ─────────────────────── */
  function animateStaffStats() {
    document.querySelectorAll('.staff-profile-stat__n').forEach(function (el) {
      var text = el.textContent.trim();
      var m = text.match(/^(\d+)/);
      if (!m) return;
      var to = parseInt(m[1], 10);
      var suffix = text.slice(m[0].length);
      el.textContent = '0' + suffix;
      setTimeout(function () {
        animateCounter(el, to, { suffix: suffix, duration: 850 });
      }, 120 + Math.random() * 80);
    });
  }

  /* ── Task completion particle hook ──────────────────────────── */
  function hookTaskComplete() {
    document.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.type !== 'checkbox') return;
      if (!cb.classList.contains('st-task-cb') && !cb.classList.contains('task-item-check') && !cb.getAttribute('aria-label')) return;
      if (!cb.checked) return;
      var rect = cb.getBoundingClientRect();
      particleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 9 });
    });
  }

  /* ── Enter-key submit helper ─────────────────────────────────── */
  function enableEnterSubmit(inputId, btnId) {
    var inp = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (!inp || !btn || inp.dataset.magicEnter) return;
    inp.dataset.magicEnter = '1';
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
    });
  }

  /* ── Auto-apply ripples to newly appended buttons ────────────── */
  applyRipples();

  /* ── Patch staff tasks panel on render ───────────────────────── */
  var _staffTasksPatched = false;
  function tryPatchStaffTasks() {
    var inp = document.getElementById('stNewTitle');
    var btn = document.getElementById('stAddBtn');
    if (inp && btn && !inp.dataset.magicEnter) {
      enableEnterSubmit('stNewTitle', 'stAddBtn');
      _staffTasksPatched = true;
    }
    // Stagger task list rows
    var list = document.getElementById('stList');
    if (list && !list.dataset.staggered) {
      list.dataset.staggered = '1';
      var rows = list.querySelectorAll('.st-task-row');
      rows.forEach(function (row, i) {
        row.style.animationDelay = (i * 40) + 'ms';
        row.style.opacity = '0';
        row.style.animation = 'fluxFadeUp .35s cubic-bezier(.22,1,.36,1) ' + (i * 40) + 'ms both';
      });
    }
  }

  /* ── Patch staff profile stats ───────────────────────────────── */
  function tryPatchStaffProfileStats() {
    var el = document.getElementById('staffProfileStats');
    if (!el || el.dataset.magicApplied || !el.children.length) return;
    var nums = el.querySelectorAll('.staff-profile-stat__n');
    if (!nums.length) return;
    el.dataset.magicApplied = '1';
    animateStaffStats();
  }

  /* ── Patch staff hub card entrance ───────────────────────────── */
  function tryPatchStaffHub() {
    var hub = document.getElementById('staffHub');
    if (!hub || hub.dataset.magicApplied) return;
    var grid = hub.querySelector('.spd-grid');
    if (!grid) return;
    hub.dataset.magicApplied = '1';
    staggerIn(grid, 80);
    // Typewriter greeting
    setTimeout(function () {
      var greet = hub.querySelector('.spd-hello');
      if (greet && !greet.dataset.typed && motionOk()) {
        var full = greet.textContent;
        greet.textContent = '';
        greet.dataset.typed = '1';
        var i = 0;
        (function tick() {
          if (i < full.length) {
            greet.textContent += full[i++];
            setTimeout(tick, 18 + Math.random() * 14);
          }
        })();
      }
    }, 150);
  }

  /* ── Patch meeting notes card list ─────────────────────────── */
  function tryPatchMeetingNotes() {
    var panel = document.getElementById('staffMeetingNotes');
    if (!panel || panel.dataset.magicApplied) return;
    var inner = panel.querySelector('[style*="max-width"]');
    if (!inner) return;
    // Find card list and add class
    var cards = inner.querySelectorAll('.card');
    if (!cards.length) return;
    panel.dataset.magicApplied = '1';
    inner.classList.add('flux-mn-list');
  }

  /* ── Patch school feed card list ─────────────────────────────── */
  function tryPatchSchoolFeed() {
    var panel = document.getElementById('schoolFeedPanel');
    if (!panel || panel.dataset.magicApplied) return;
    var inner = panel.querySelector('[style*="max-width"]');
    if (!inner) return;
    var cards = inner.querySelectorAll('.card');
    if (!cards.length) return;
    panel.dataset.magicApplied = '1';
    inner.classList.add('flux-feed-list');
  }

  /* ── Patch student profile stats ────────────────────────────── */
  function tryPatchStudentProfileStats() {
    var el = document.getElementById('profileStats');
    if (!el || el.dataset.magicApplied || !el.children.length) return;
    el.dataset.magicApplied = '1';
    // Animate each stat number
    var statDivs = el.querySelectorAll('[style*="1.4rem"]');
    statDivs.forEach(function (div) {
      var text = div.textContent.trim();
      var m = text.match(/^(\d+)/);
      if (!m) return;
      var to = parseInt(m[1], 10);
      var suffix = text.slice(m[0].length);
      div.textContent = '0' + suffix;
      div.classList.add('flux-counter');
      setTimeout(function () {
        animateCounter(div, to, { suffix: suffix, duration: 750 });
      }, 80 + Math.random() * 60);
    });
    // Stagger badges
    var badgeEl = document.getElementById('profileBadges');
    if (badgeEl) staggerIn(badgeEl, 60);
  }

  /* ── Patch student dashboard (streak ring, hero) ──────────────── */
  function tryPatchStudentDash() {
    var hero = document.querySelector('.dash-hero');
    if (!hero || hero.dataset.magicApplied) return;
    hero.dataset.magicApplied = '1';
    // Subtle entrance
    hero.style.opacity = '0';
    hero.style.transform = 'translateY(12px)';
    hero.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.style.opacity = '';
        hero.style.transform = '';
      });
    });
  }

  /* ── Add "Enter" to meeting notes modal title ─────────────────── */
  function tryPatchMeetingModal() {
    var titleInput = document.getElementById('mn_title');
    var saveBtn = document.getElementById('mn_save');
    if (titleInput && saveBtn && !titleInput.dataset.magicEnter) {
      titleInput.dataset.magicEnter = '1';
      titleInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
      });
    }
  }

  /* ── Patch educator dashboard stats ─────────────────────────── */
  function tryPatchDashboardStats() {
    var roots = document.querySelectorAll('.lh-root,.cm-root,.ao-root,.sw-root');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (root.dataset.magicApplied) continue;
      root.dataset.magicApplied = '1';
      var nums = root.querySelectorAll('.lh-stat-num,.ao-stat-num,.sw-stat-num');
      nums.forEach(function (el, idx) {
        var text = el.textContent.trim();
        var m = text.match(/^(\d+)/);
        if (!m) return;
        var to = parseInt(m[1], 10);
        var suffix = text.slice(m[0].length);
        el.textContent = '0' + suffix;
        el.classList.add('flux-counter');
        setTimeout(function () {
          animateCounter(el, to, { suffix: suffix, duration: 700 });
        }, 60 + idx * 80);
      });
      var cards = root.querySelectorAll('.lh-class-card,.cm-card,.ao-sub-row,.ao-walk-row,.sw-ticket,.sw-peer,.ao-dir-row');
      cards.forEach(function (card, idx) {
        if (card.style.animation) return;
        card.style.opacity = '0';
        card.style.animation = 'fluxFadeUp .35s cubic-bezier(.22,1,.36,1) ' + (idx * 45) + 'ms both';
      });
    }
  }

  /* ── Patch booking modal ──────────────────────────────────────── */
  function tryPatchBookingModal() {
    var modal = document.getElementById('bookApptModal');
    if (!modal || modal.dataset.magicApplied) return;
    modal.dataset.magicApplied = '1';
    var chips = modal.querySelectorAll('.date-chip');
    chips.forEach(function (chip, idx) {
      chip.style.opacity = '0';
      chip.style.animation = 'fluxFadeUp .3s cubic-bezier(.22,1,.36,1) ' + (idx * 35) + 'ms both';
    });
  }

  /* ── MutationObserver to watch for panel renders ─────────────── */
  var _observer = new MutationObserver(function () {
    tryPatchStaffTasks();
    tryPatchStaffProfileStats();
    tryPatchStudentProfileStats();
    tryPatchStudentDash();
    tryPatchStaffHub();
    tryPatchMeetingNotes();
    tryPatchSchoolFeed();
    tryPatchMeetingModal();
    tryPatchDashboardStats();
    tryPatchBookingModal();
  });

  /* ── Init ─────────────────────────────────────────────────────── */
  function init() {
    hookTaskComplete();
    _observer.observe(document.body, { childList: true, subtree: true });
    // Run initial patches in case panels are already loaded
    tryPatchStaffTasks();
    tryPatchStaffProfileStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Inline prompt modal (replaces browser prompt()) ──────────── */
  function fluxPrompt(label, defaultVal, opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var id = 'fluxPrompt' + Date.now();
      var overlay = document.createElement('div');
      overlay.id = id;
      overlay.className = 'flux-prompt-overlay';
      overlay.innerHTML =
        '<div class="flux-prompt-card">' +
          '<div class="flux-prompt-label">' + escHtml(label || 'Enter value') + '</div>' +
          (o.type === 'select'
            ? '<select class="flux-prompt-input" id="' + id + '_inp">' +
              (o.options || []).map(function (opt) {
                var val = typeof opt === 'string' ? opt : opt.value;
                var lbl = typeof opt === 'string' ? opt : opt.label;
                var sel = val === defaultVal ? ' selected' : '';
                return '<option value="' + escHtml(val) + '"' + sel + '>' + escHtml(lbl) + '</option>';
              }).join('') + '</select>'
            : '<input class="flux-prompt-input" id="' + id + '_inp" placeholder="' +
              escHtml(o.placeholder || '') + '" value="' + escHtml(defaultVal || '') + '"' +
              (o.type === 'time' ? ' type="time"' : '') + '>') +
          '<div class="flux-prompt-actions">' +
            '<button class="flux-prompt-cancel" type="button">Cancel</button>' +
            '<button class="flux-prompt-ok" type="button">' + escHtml(o.okLabel || 'OK') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      var inp = document.getElementById(id + '_inp');
      var ok = overlay.querySelector('.flux-prompt-ok');
      var cancel = overlay.querySelector('.flux-prompt-cancel');
      function done(val) { overlay.remove(); resolve(val); }
      ok.addEventListener('click', function () { done(inp.value); });
      cancel.addEventListener('click', function () { done(null); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) done(null); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(inp.value); } if (e.key === 'Escape') done(null); });
      requestAnimationFrame(function () {
        overlay.classList.add('flux-prompt-visible');
        inp.focus();
        if (inp.tagName === 'INPUT' && inp.select) inp.select();
      });
    });
  }

  function fluxForm(title, fields, opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var id = 'fluxForm' + Date.now();
      var overlay = document.createElement('div');
      overlay.id = id;
      overlay.className = 'flux-prompt-overlay';
      var fieldsHtml = fields.map(function (f, i) {
        var fid = id + '_f' + i;
        if (f.type === 'select') {
          return '<div class="flux-prompt-field"><label>' + escHtml(f.label) + '</label>' +
            '<select class="flux-prompt-input" id="' + fid + '">' +
            (f.options || []).map(function (opt) {
              var val = typeof opt === 'string' ? opt : opt.value;
              var lbl = typeof opt === 'string' ? opt : opt.label;
              return '<option value="' + escHtml(val) + '"' + (val === f.value ? ' selected' : '') + '>' + escHtml(lbl) + '</option>';
            }).join('') + '</select></div>';
        }
        return '<div class="flux-prompt-field"><label>' + escHtml(f.label) + '</label>' +
          '<input class="flux-prompt-input" id="' + fid + '" placeholder="' +
          escHtml(f.placeholder || '') + '" value="' + escHtml(f.value || '') + '"' +
          (f.type === 'time' ? ' type="time"' : '') +
          (f.required ? ' required' : '') + '></div>';
      }).join('');
      overlay.innerHTML =
        '<div class="flux-prompt-card flux-prompt-card--form">' +
          '<div class="flux-prompt-title">' + escHtml(title || '') + '</div>' +
          fieldsHtml +
          '<div class="flux-prompt-actions">' +
            '<button class="flux-prompt-cancel" type="button">Cancel</button>' +
            '<button class="flux-prompt-ok" type="button">' + escHtml(o.okLabel || 'Save') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      function done(result) { overlay.remove(); resolve(result); }
      function submit() {
        var vals = {};
        for (var i = 0; i < fields.length; i++) {
          var el = document.getElementById(id + '_f' + i);
          var v = el ? el.value.trim() : '';
          if (fields[i].required && !v) { el.focus(); el.style.borderColor = 'var(--red,#ff4d6d)'; return; }
          vals[fields[i].key || fields[i].label] = v;
        }
        done(vals);
      }
      overlay.querySelector('.flux-prompt-ok').addEventListener('click', submit);
      overlay.querySelector('.flux-prompt-cancel').addEventListener('click', function () { done(null); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) done(null); });
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
        if (e.key === 'Escape') done(null);
      });
      requestAnimationFrame(function () {
        overlay.classList.add('flux-prompt-visible');
        var first = document.getElementById(id + '_f0');
        if (first) {
          first.focus();
          if (first.tagName === 'INPUT' && first.select) first.select();
        }
      });
    });
  }

  /* ── Smooth panel transitions ───────────────────────────────────── */
  function hookPanelTransitions() {
    if (!motionOk()) return;
    var origNav = window.nav;
    if (typeof origNav !== 'function') return;
    window.nav = function (panel) {
      var panels = document.querySelectorAll('.panel');
      panels.forEach(function (p) {
        if (p.style.display !== 'none' && !p.hidden) {
          p.style.opacity = '0';
          p.style.transform = 'translateY(8px)';
        }
      });
      setTimeout(function () {
        origNav(panel);
        var active = document.querySelectorAll('.panel');
        active.forEach(function (p) {
          if (p.style.display !== 'none' && !p.hidden) {
            p.style.transition = 'opacity .25s ease, transform .25s cubic-bezier(.22,1,.36,1)';
            p.style.opacity = '1';
            p.style.transform = 'none';
          }
        });
      }, 80);
    };
  }

  /* ── Public API ───────────────────────────────────────────────── */
  window.FluxMagic = {
    counter: animateCounter,
    ripple: createRipple,
    particles: particleBurst,
    stagger: staggerIn,
    skeleton: skeleton,
    enableEnterSubmit: enableEnterSubmit,
    animateStaffStats: animateStaffStats,
    motionOk: motionOk,
    prompt: fluxPrompt,
    form: fluxForm,
  };

  hookPanelTransitions();
})();
