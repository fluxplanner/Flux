/* ════════════════════════════════════════════════════════════════════════════
 * FluxI18nDOM — self-controlled full-page translator (no third-party widget).
 *
 * Why this exists: the dot-keyed FluxI18n dictionary only covers ~5% of the UI,
 * and the Google Translate widget couldn't reliably translate Flux's dynamic,
 * heavily-observed DOM. This module owns translation end to end:
 *
 *   1. STATIC: reverse-map FluxI18n.STRINGS (which already ships real es/fr/ar
 *      translations) into source-English → target-phrase dictionaries, then
 *      translate matching text nodes directly.
 *   2. AI FALLBACK (optional): batch any visible English strings the static map
 *      doesn't cover through the Flux AI proxy, cache results in localStorage
 *      keyed by (locale, text). Off unless enable_locale_ai_fallback flag is on.
 *   3. LIVE: a cooperative MutationObserver re-translates nodes Flux renders
 *      after the initial pass. We tag translated nodes + skip our own writes to
 *      avoid feedback loops.
 *
 * Translation is reversible: we stash each node's original English in a WeakMap,
 * so switching back to English restores source text without a reload.
 *
 * Public API on window.FluxI18nDOM:
 *   .translatePage(locale?)   translate the whole document to locale (or current)
 *   .restoreEnglish()         undo all translations in place
 *   .refresh()                re-run on current locale (after big re-renders)
 *   .stats()                  { applied, missed, cached }  (debugging)
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const AI_FALLBACK_FLAG = 'enable_locale_ai_fallback';
  const CACHE_PREFIX = 'flux_i18n_aicache_v1_'; // + locale

  // Attributes/props whose *value* is user-visible and worth translating.
  const ATTR_TARGETS = ['placeholder', 'title', 'aria-label'];

  // Skip these elements entirely (code, math, user data, controls we shouldn't touch).
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'TEXTAREA', 'INPUT',
    'SELECT', 'OPTION', 'NOSCRIPT', 'SVG', 'PATH', 'CANVAS', 'VIDEO', 'AUDIO',
  ]);
  // Skip subtrees explicitly marked do-not-translate (user content, monospace data).
  const SKIP_SELECTOR = '[data-no-i18n], [translate="no"], .notranslate, .mono, [contenteditable="true"], #aiInput, .ai-input-field';

  const originals = new WeakMap();   // textNode → original English
  const attrOriginals = new WeakMap(); // element → { attr: originalValue }
  let _observer = null;
  let _currentLocale = 'en-US';
  let _dict = null;                  // active source→target map
  let _stats = { applied: 0, missed: 0, cached: 0 };
  let _misses = new Set();           // uncovered English phrases (for AI fallback)
  let _writing = false;             // guard so observer ignores our own writes

  /* ───────── helpers ───────── */

  function fi() { return window.FluxI18n; }
  function localeEnabled() {
    try { return !!(fi() && fi().enabled && fi().enabled()); } catch (_) { return false; }
  }
  function aiFallbackEnabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(AI_FALLBACK_FLAG, false); } catch (_) { return false; }
  }
  function norm(s) {
    // Normalize whitespace for matching but remember original spacing separately.
    return String(s).replace(/\s+/g, ' ').trim();
  }

  /* ───────── reverse-map dictionary builder ─────────
     FluxI18n.STRINGS is { localeId: { dotKey: phrase } }. The 'en-US' table is
     the source. For a target locale, map en phrase → target phrase for every
     key present in BOTH tables (and actually different). Placeholders like
     {n} are preserved because we only match keys whose phrase has no vars, OR
     we treat them as opaque (skip phrases containing { } to avoid mangling). */
  function buildDict(localeId) {
    const S = fi() && fi().STRINGS;
    if (!S || !S['en-US'] || !S[localeId]) return new Map();
    const en = S['en-US'];
    const tgt = S[localeId];
    const map = new Map();
    Object.keys(tgt).forEach((key) => {
      const enPhrase = en[key];
      const tgtPhrase = tgt[key];
      if (typeof enPhrase !== 'string' || typeof tgtPhrase !== 'string') return;
      if (enPhrase === tgtPhrase) return;            // untranslated key — skip
      if (/\{[a-z0-9_]+\}/i.test(enPhrase)) return;  // has vars — skip (risky to match)
      const k = norm(enPhrase);
      if (k.length < 2) return;
      // Prefer the first mapping; don't let a later duplicate English phrase win.
      if (!map.has(k)) map.set(k, tgtPhrase);
    });
    return map;
  }

  /* ───────── AI cache ───────── */

  function loadCache(localeId) {
    try {
      const raw = (window.FluxStorage && window.FluxStorage.load)
        ? window.FluxStorage.load(CACHE_PREFIX + localeId, null)
        : JSON.parse(localStorage.getItem(CACHE_PREFIX + localeId) || 'null');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (_) { return {}; }
  }
  function saveCache(localeId, obj) {
    try {
      if (window.FluxStorage && window.FluxStorage.save) window.FluxStorage.save(CACHE_PREFIX + localeId, obj);
      else localStorage.setItem(CACHE_PREFIX + localeId, JSON.stringify(obj));
    } catch (_) {}
  }

  /* ───────── core: translate one text string ───────── */

  function translateText(text, dict, cache) {
    const key = norm(text);
    if (!key) return null;
    // Don't translate pure numbers, codes, times, single punctuation.
    if (/^[\d\s.,:;!?%$#@()\-+/*=]+$/.test(key)) return null;
    if (dict.has(key)) { _stats.applied++; return reSpace(text, dict.get(key)); }
    if (cache && cache[key]) { _stats.cached++; return reSpace(text, cache[key]); }
    _stats.missed++;
    _misses.add(key);
    return null;
  }

  // Preserve leading/trailing whitespace of the original node text.
  function reSpace(original, translated) {
    const lead = (original.match(/^\s*/) || [''])[0];
    const trail = (original.match(/\s*$/) || [''])[0];
    return lead + translated + trail;
  }

  /* ───────── DOM walking ───────── */

  // For text-node content: skip inert tags + do-not-translate subtrees.
  function shouldSkip(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.matches && el.matches(SKIP_SELECTOR)) return true;
      el = el.parentElement;
    }
    return false;
  }

  // For attributes (placeholder/title/aria-label): form controls like INPUT and
  // SELECT have translatable *attribute values* even though we skip their text
  // content. Only honor the do-not-translate selector + a few truly inert tags.
  const ATTR_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'CANVAS']);
  function shouldSkipAttrs(el) {
    let cur = el;
    while (cur) {
      if (ATTR_SKIP_TAGS.has(cur.tagName)) return true;
      if (cur.matches && cur.matches(SKIP_SELECTOR)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function walkAndTranslate(root, dict, cache) {
    if (!root) return;
    // 1) Text nodes
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkip(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    let cur;
    while ((cur = tw.nextNode())) textNodes.push(cur);
    textNodes.forEach((n) => {
      if (!originals.has(n)) originals.set(n, n.nodeValue);
      const src = originals.get(n);
      const out = translateText(src, dict, cache);
      if (out != null && out !== n.nodeValue) n.nodeValue = out;
    });

    // 2) Attributes on elements (form controls included — see shouldSkipAttrs)
    const elTW = document.createTreeWalker(root.nodeType === 1 ? root : document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (shouldSkipAttrs(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const els = [];
    if (root.nodeType === 1) els.push(root);
    let e;
    while ((e = elTW.nextNode())) els.push(e);
    els.forEach((el) => {
      ATTR_TARGETS.forEach((attr) => {
        const v = el.getAttribute && el.getAttribute(attr);
        if (!v || !v.trim()) return;
        let store = attrOriginals.get(el);
        if (!store) { store = {}; attrOriginals.set(el, store); }
        if (!(attr in store)) store[attr] = v;
        const out = translateText(store[attr], dict, cache);
        if (out != null && out !== v) el.setAttribute(attr, out.trim());
      });
    });
  }

  /* ───────── public: translate / restore ───────── */

  function translatePage(localeArg) {
    const locale = localeArg || (fi() && fi().getLocale && fi().getLocale()) || 'en-US';
    _currentLocale = locale;
    if (/^en/i.test(locale)) { restoreEnglish(); startObserver(); return; }
    if (!localeEnabled()) return;
    _dict = buildDict(locale);
    const cache = loadCache(locale);
    _stats = { applied: 0, missed: 0, cached: 0 };
    _misses = new Set();
    _writing = true;
    try { walkAndTranslate(document.body, _dict, cache); } finally { _writing = false; }
    startObserver();
    // Fire AI fallback for misses if enabled (async, best-effort).
    if (aiFallbackEnabled() && _misses.size) {
      scheduleAIFallback(locale);
    }
  }

  function restoreEnglish() {
    // Flip locale FIRST so the live observer stops re-translating mid-restore.
    _currentLocale = 'en-US';
    _writing = true;
    try {
      // Restore text nodes — we can't enumerate a WeakMap, so re-walk and look up.
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = tw.nextNode())) {
        if (originals.has(n)) {
          const orig = originals.get(n);
          if (n.nodeValue !== orig) n.nodeValue = orig;
        }
      }
      const elTW = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
      let el;
      while ((el = elTW.nextNode())) {
        const store = attrOriginals.get(el);
        if (store) {
          Object.keys(store).forEach((attr) => {
            if (el.getAttribute(attr) !== store[attr]) el.setAttribute(attr, store[attr]);
          });
        }
      }
    } finally { _writing = false; }
  }

  function refresh() {
    translatePage(_currentLocale);
  }

  /* ───────── live observer ───────── */

  function startObserver() {
    if (_observer || !window.MutationObserver) return;
    _observer = new MutationObserver((mutations) => {
      if (_writing) return;                 // ignore our own writes
      if (/^en/i.test(_currentLocale)) return;
      if (!_dict) return;
      const cache = loadCache(_currentLocale);
      const roots = new Set();
      mutations.forEach((m) => {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1 || node.nodeType === 3) roots.add(node);
          });
        } else if (m.type === 'characterData' && m.target) {
          roots.add(m.target);
        }
      });
      if (!roots.size) return;
      _writing = true;
      try {
        roots.forEach((node) => {
          if (node.nodeType === 3) {
            if (shouldSkip(node)) return;
            if (!originals.has(node)) originals.set(node, node.nodeValue);
            const out = translateText(originals.get(node), _dict, cache);
            if (out != null && out !== node.nodeValue) node.nodeValue = out;
          } else {
            walkAndTranslate(node, _dict, cache);
          }
        });
      } finally { _writing = false; }
    });
    _observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ───────── AI batch fallback (optional, cached) ───────── */

  let _aiTimer = null;
  let _aiInFlight = false;          // don't overlap requests
  let _aiFailures = 0;             // consecutive failures → circuit breaker
  let _aiDisabledUntil = 0;       // timestamp; skip fallback until then
  const AI_MAX_FAILURES = 3;
  const AI_BACKOFF_MS = 5 * 60 * 1000; // 5 min cool-off after repeated failures
  const _aiSent = new Set();       // phrases already sent this session (don't resend)

  function scheduleAIFallback(locale) {
    if (Date.now() < _aiDisabledUntil) return; // circuit open
    clearTimeout(_aiTimer);
    _aiTimer = setTimeout(() => runAIFallback(locale), 800);
  }

  async function runAIFallback(locale) {
    if (_aiInFlight) return;
    if (Date.now() < _aiDisabledUntil) return;
    const url = (window.API && window.API.ai) || '';
    if (!url || !_misses.size) return;
    const cache = loadCache(locale);
    // Only send phrases we don't already have cached AND haven't sent this
    // session (prevents re-sending strings the model returned untranslated).
    const pending = [..._misses].filter((p) => !cache[p] && !_aiSent.has(p)).slice(0, 60);
    if (!pending.length) return;
    pending.forEach((p) => _aiSent.add(p));
    const langName = ({ 'es-US': 'Spanish', 'fr-FR': 'French', 'ar-SA': 'Arabic' })[locale] || locale;
    _aiInFlight = true;
    try {
      const headers = (typeof window.fluxAuthHeaders === 'function')
        ? await window.fluxAuthHeaders() : { 'Content-Type': 'application/json' };
      const sys = `You are a UI string translator. Translate each numbered English UI string to ${langName}. Keep it short and natural for an app interface. Preserve any {placeholder} tokens, punctuation, and emoji exactly. Respond ONLY with a JSON object mapping the original string to its translation. No commentary.`;
      const userMsg = pending.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const res = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify({ system: sys, messages: [{ role: 'user', content: userMsg }] }),
      });
      if (!res.ok) {
        // Track failures; open the circuit after repeated errors so we stop
        // hammering a broken/rate-limited endpoint.
        _aiFailures++;
        if (_aiFailures >= AI_MAX_FAILURES) {
          _aiDisabledUntil = Date.now() + AI_BACKOFF_MS;
          _aiFailures = 0;
          console.warn('[FluxI18nDOM] AI translation fallback paused 5m after repeated errors');
        }
        _aiInFlight = false;
        return;
      }
      _aiFailures = 0; // success resets the breaker
      const data = await res.json().catch(() => null);
      const txt = data && data.content && data.content[0] && data.content[0].text;
      if (txt) {
        let parsed = null;
        try {
          const jsonStart = txt.indexOf('{');
          const jsonEnd = txt.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) parsed = JSON.parse(txt.slice(jsonStart, jsonEnd + 1));
        } catch (_) { parsed = null; }
        if (parsed && typeof parsed === 'object') {
          let added = 0;
          Object.keys(parsed).forEach((k) => {
            const nk = norm(k);
            if (nk && typeof parsed[k] === 'string' && parsed[k].trim()) { cache[nk] = parsed[k].trim(); added++; }
          });
          if (added) {
            saveCache(locale, cache);
            refresh(); // re-run so freshly-cached strings get applied
          }
        }
      }
    } catch (_) {
      // Network/parse error — count toward the circuit breaker too.
      _aiFailures++;
      if (_aiFailures >= AI_MAX_FAILURES) { _aiDisabledUntil = Date.now() + AI_BACKOFF_MS; _aiFailures = 0; }
    } finally {
      _aiInFlight = false;
    }
  }

  /* ───────── wire to locale changes + boot ───────── */

  document.addEventListener('flux-locale-change', (e) => {
    const loc = (e && e.detail && e.detail.locale) || (fi() && fi().getLocale && fi().getLocale());
    translatePage(loc);
  });

  function boot() {
    if (!localeEnabled()) return;
    const loc = (fi() && fi().getLocale && fi().getLocale()) || 'en-US';
    if (!/^en/i.test(loc)) {
      // Defer slightly so first render settles before we translate.
      setTimeout(() => translatePage(loc), 400);
    } else {
      startObserver(); // ready for an in-session switch
    }
  }

  window.FluxI18nDOM = {
    translatePage,
    restoreEnglish,
    refresh,
    stats: () => ({ ..._stats, misses: _misses.size }),
    _buildDict: buildDict, // exposed for tests
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
