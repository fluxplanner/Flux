/**
 * flux-benchmarks.js — client for the anonymized population priors.
 *
 * Fetches public.flux_benchmarks (via get_benchmarks RPC), injects the priors
 * into the AI system prompt so answers reason WITH what the whole user base has
 * taught Flux, and surfaces an opt-in toggle controlling whether THIS student's
 * anonymized stats contribute to the aggregate. Degrades silently when the
 * table/RPC aren't deployed yet.
 *
 * Privacy: reading benchmarks (aggregate, non-identifying) is always on;
 * contributing is opt-in (default OFF) and only ever sends counts/ratios via the
 * server-side aggregator — never raw text.
 *
 * window.FluxBenchmarks = { appendToSystem, consent, setConsent, get, refresh }
 */
(function () {
  'use strict';

  var _cache = null, _fetched = 0;
  var TTL = 6 * 3600 * 1000;

  function sb() { try { return typeof getSB === 'function' ? getSB() : null; } catch (e) { return null; } }
  function load_(k, f) { try { return typeof load === 'function' ? load(k, f) : f; } catch (e) { return f; } }
  function save_(k, v) { try { if (typeof save === 'function') save(k, v); } catch (e) {} }

  function consent() {
    var s = load_('settings', {}) || {};
    return !!s.share_anon_stats;
  }
  function setConsent(on) {
    var s = load_('settings', {}) || {};
    s.share_anon_stats = !!on;
    save_('settings', s);
    return s.share_anon_stats;
  }

  function refresh() {
    var client = sb();
    if (!client || typeof client.rpc !== 'function') return Promise.resolve(null);
    return client.rpc('get_benchmarks').then(function (res) {
      if (res.error) return null;
      _cache = res.data || []; _fetched = Date.now();
      return _cache;
    }).catch(function () { return null; });
  }

  function get() {
    if (!_cache || Date.now() - _fetched > TTL) refresh();
    return _cache || [];
  }

  /** Inject priors into an AI system prompt (called from sendAI). */
  function appendToSystem(system) {
    try {
      var b = get();
      if (!b || !b.length) return system;
      var lines = b.filter(function (r) { return r && r.label; }).map(function (r) { return '- ' + r.label; });
      if (!lines.length) return system;
      return system + '\n\n<population_priors>\nAnonymized patterns across Flux students (use as gentle context, the student\'s own data wins):\n' +
        lines.join('\n') + '\n</population_priors>';
    } catch (e) { return system; }
  }

  /* opt-in toggle card injected into Settings → Data & info */
  function injectToggle() {
    var pane = document.getElementById('spane-data');
    if (!pane || document.getElementById('fbConsentCard')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'fbConsentCard';
    card.innerHTML = '<h3>Help Flux learn (anonymous)</h3>' +
      '<p class="ssub" style="margin:0 0 10px;line-height:1.55">Share <strong>anonymous</strong> study patterns (counts only — never your notes, task names, or identity) so Flux\'s predictions get sharper for everyone. Off by default. You can turn this off anytime.</p>' +
      '<div class="srow" style="border:none"><div><div class="slabel">Contribute anonymous stats</div>' +
      '<div class="ssub">Aggregated with 20+ students before anything is computed.</div></div>' +
      '<button type="button" class="toggle' + (consent() ? ' on' : '') + '" id="fbConsentToggle" aria-pressed="' + consent() + '"></button></div>';
    var first = pane.querySelector('.card');
    if (first) pane.insertBefore(card, first.nextSibling); else pane.appendChild(card);
    var btn = card.querySelector('#fbConsentToggle');
    if (btn) btn.addEventListener('click', function () {
      var on = setConsent(!consent());
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      try { if (typeof showToast === 'function') showToast(on ? 'Thanks — sharing anonymous stats' : 'No longer contributing stats', 'success'); } catch (e) {}
    });
  }

  function boot() {
    refresh();
    var settings = document.getElementById('settings');
    if (settings && window.MutationObserver) {
      new MutationObserver(function () { if (settings.classList.contains('active')) injectToggle(); }).observe(settings, { childList: true, subtree: true });
    }
    setTimeout(injectToggle, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxBenchmarks = { appendToSystem: appendToSystem, consent: consent, setConsent: setConsent, get: get, refresh: refresh };
})();
