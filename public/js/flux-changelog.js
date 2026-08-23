/**
 * Flux · Change log — the "What's changed" card in Settings.
 *
 * Reads public/data/changelog.json, which `npm run changelog` generates from
 * git history (see scripts/build-changelog.mjs). Nothing here is hand-written:
 * regenerating the JSON is what updates this view.
 *
 * Renders newest-first, grouped by month, with type filters. The list is capped
 * and grows on demand — there are ~475 entries and painting them all into the
 * Settings panel would undo the tab-switch work.
 *
 * Self-contained IIFE. Exposes window.FluxChangelog.
 */
(function () {
  'use strict';

  var DATA_URL = 'public/data/changelog.json';
  var PAGE = 25;

  var state = { data: null, filter: 'All', shown: PAGE, loading: false, failed: false };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Colour per type, reusing the app's existing semantic vars so the card
     follows the active theme rather than hardcoding a palette. */
  var TYPE_TONE = {
    Added: 'var(--green, #37c98a)',
    Fixed: 'var(--accent)',
    Performance: 'var(--yellow, #f4a13f)',
    Accessibility: 'var(--purple, #a06eff)',
    Removed: 'var(--red, #f2545b)',
    Changed: 'var(--muted2)',
    Housekeeping: 'var(--muted)'
  };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function monthLabel(ymd) {
    var p = String(ymd).split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }

  /** "23 Aug" — compact, unambiguous, no locale surprises. */
  function dayLabel(ymd) {
    var p = String(ymd).split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1].slice(0, 3);
  }

  function visibleEntries() {
    var all = (state.data && state.data.entries) || [];
    if (state.filter === 'All') return all;
    return all.filter(function (e) { return e.type === state.filter; });
  }

  function renderFilters() {
    var host = $('changelogFilters');
    if (!host || !state.data) return;
    var counts = {};
    (state.data.entries || []).forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    // Only offer filters that would actually match something.
    var types = ['All'].concat(Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }));
    host.innerHTML = types.map(function (t) {
      var n = t === 'All' ? (state.data.entries || []).length : counts[t];
      var on = state.filter === t;
      return '<button type="button" class="flux-changelog-chip' + (on ? ' active' : '') + '"'
        + ' data-cl-type="' + esc(t) + '" aria-pressed="' + (on ? 'true' : 'false') + '">'
        + esc(t) + ' <span class="flux-changelog-chip-n">' + n + '</span></button>';
    }).join('');
  }

  function renderList() {
    var host = $('changelogList');
    if (!host) return;

    if (state.failed) {
      host.innerHTML = '<p class="flux-changelog-empty">Could not load the change log. '
        + 'Run <code>npm run changelog</code> to generate it.</p>';
      return;
    }
    if (!state.data) { host.innerHTML = '<p class="flux-changelog-empty">Loading…</p>'; return; }

    var list = visibleEntries();
    if (!list.length) { host.innerHTML = '<p class="flux-changelog-empty">Nothing under this filter.</p>'; return; }

    var slice = list.slice(0, state.shown);
    var html = '';
    var lastMonth = '';
    slice.forEach(function (e) {
      var m = String(e.date).slice(0, 7);
      if (m !== lastMonth) {
        lastMonth = m;
        html += '<h4 class="flux-changelog-month">' + esc(monthLabel(e.date)) + '</h4>';
      }
      html += '<div class="flux-changelog-row">'
        + '<span class="flux-changelog-dot" style="background:' + (TYPE_TONE[e.type] || 'var(--muted)') + '" aria-hidden="true"></span>'
        + '<span class="flux-changelog-type" style="color:' + (TYPE_TONE[e.type] || 'var(--muted)') + '">' + esc(e.type) + '</span>'
        + '<span class="flux-changelog-title">' + esc(e.title) + '</span>'
        + '<time class="flux-changelog-date" datetime="' + esc(e.date) + '">' + esc(dayLabel(e.date)) + '</time>'
        + '</div>';
    });
    host.innerHTML = html;

    var more = $('changelogMore');
    if (more) {
      var remaining = list.length - slice.length;
      more.style.display = remaining > 0 ? '' : 'none';
      more.textContent = remaining > 0
        ? 'Show ' + Math.min(remaining, PAGE) + ' more (' + remaining + ' left)'
        : '';
    }
  }

  function renderMeta() {
    var el = $('changelogMeta');
    if (!el || !state.data) return;
    var d = state.data;
    el.textContent = d.total + ' changes since ' + monthLabel(d.firstCommit)
      + ' · updated ' + d.generated;
  }

  function render() { renderMeta(); renderFilters(); renderList(); }

  function wire() {
    var card = $('changelogCard');
    if (!card || card.__clWired) return;
    card.__clWired = true;

    var filters = $('changelogFilters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('.flux-changelog-chip');
        if (!b) return;
        state.filter = b.getAttribute('data-cl-type');
        state.shown = PAGE; // a new filter starts from the top
        render();
      });
    }
    var more = $('changelogMore');
    if (more) {
      more.addEventListener('click', function () { state.shown += PAGE; renderList(); });
    }
  }

  /** Fetched once per session, lazily — Settings is not the first tab anyone opens. */
  function load() {
    if (state.data || state.loading) { render(); return; }
    state.loading = true;
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) { state.data = j; state.failed = false; })
      .catch(function () { state.failed = true; })
      .then(function () { state.loading = false; render(); });
  }

  function renderChangelog() {
    if (!$('changelogCard')) return;
    wire();
    load();
  }

  window.FluxChangelog = { render: renderChangelog };
})();
