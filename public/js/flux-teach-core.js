/* ============================================================================
   FLUX TEACH · CORE  ·  flux-teach-core.js
   Teaches a skill instead of testing it: the method, a worked example shown a
   step at a time, then problems of your own with the working as hints, until
   every variant of the skill has been met and got right.

   WHY GENERATED, NOT WRITTEN
   --------------------------
   Flux AI is paused and Flux Tutor promises not to make things up. A problem
   generator computes its own answer and its own working from the numbers it
   picked, so the solution is correct by construction and there are as many
   fresh problems as a student wants. Subjects where the skill is a method
   (structuring an essay, reading a source) get the method written out and
   drills drawn from fixed, checked banks.

   SHAPES
   ------
   A skill:   { id, unit, title, method: [step…], variants: [{ id, name, gen(r) }] }
              `unit` is a flux-ib-syllabus.js unit id ('physics:A.1'); a skill
              may list several (`units`).
   A problem: { q, answer, type: 'num' | 'text' | 'choice', options?, accept?,
                tol?, sf?, unit?, steps: [line…], note? }
              num answers are checked to `abs` (absolute), `sf` significant
              figures or `tol` (relative, default 0.01); `dp` sets how many
              decimal places the answer is shown with. Text answers are also
              checked against `accept`.
   Text in q / steps / method may use x^{2}, x_{1} and *bold*; the UI renders
   them, so content never carries HTML.

   No DOM here, so test/unit/teach-core.test.mjs runs every generator in a VM.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxTeach) return;

  var SKILLS = [];
  var BY_ID = {};

  function register(list) {
    (list || []).forEach(function (s) {
      if (!s || !s.id || BY_ID[s.id]) return;
      s.units = s.units || (s.unit ? [s.unit] : []);
      s.method = s.method || [];
      s.variants = (s.variants || []).filter(function (v) { return v && typeof v.gen === 'function'; });
      if (!s.variants.length) return;
      SKILLS.push(s);
      BY_ID[s.id] = s;
    });
  }

  /* ── Random numbers: seeded, so a problem can be shown again exactly ── */
  function rng(seed) {
    var a = (typeof seed === 'number' ? seed : hash(String(seed == null ? Date.now() : seed))) >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var r = {
      next: next,
      /** Integer in [lo, hi]. */
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      /** Integer in [lo, hi], never 0. */
      nz: function (lo, hi) { var v; do { v = r.int(lo, hi); } while (v === 0); return v; },
      /** A multiple of step in [lo, hi]. */
      step: function (lo, hi, st) { return round(lo + st * Math.floor(next() * (Math.floor((hi - lo) / st + 1e-9) + 1)), 10); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      sign: function () { return next() < 0.5 ? -1 : 1; },
      shuffle: function (list) {
        var a2 = list.slice();
        for (var i = a2.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = a2[i]; a2[i] = a2[j]; a2[j] = t; }
        return a2;
      },
      /** n distinct picks. */
      sample: function (list, n) { return r.shuffle(list).slice(0, n); },
    };
    return r;
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ── Numbers ──────────────────────────────────────────────────────── */
  function round(x, dp) { var p = Math.pow(10, dp || 0); return Math.round(x * p) / p; }
  /** x to n significant figures, as a number. */
  function sig(x, n) {
    if (!isFinite(x) || x === 0) return x;
    var d = Math.ceil(Math.log10(Math.abs(x)));
    var p = Math.pow(10, (n || 3) - d);
    return Math.round(x * p) / p;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  /** "3/4", "−2", "5/2" in lowest terms. */
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    n /= g; d /= g;
    return (d === 1 ? String(n) : n + '/' + d).replace(/^-/, '−');
  }
  /**
   * A number for reading: 3 s.f. by default, ×10^{n} for very large or small
   * magnitudes, no trailing zeros, a real minus sign.
   */
  function num(x, sf) {
    if (typeof x !== 'number' || !isFinite(x)) return String(x);
    if (x === 0) return '0';
    var n = sf || 3;
    var mag = Math.floor(Math.log10(Math.abs(x)));
    var out;
    if (mag >= 6 || mag <= -4) {
      var m = sig(x / Math.pow(10, mag), n);
      if (Math.abs(m) >= 10) { m /= 10; mag += 1; }
      out = trim(m.toFixed(Math.max(0, n - 1))) + '×10^{' + mag + '}';
    } else {
      var v = sig(x, n);
      var dp = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
      out = trim(v.toFixed(Math.min(dp, 10)));
    }
    return out.replace(/^-/, '−');
  }
  function trim(s) { return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s; }
  /** A given value as written, to at most dp decimal places. */
  function show(x, dp) { var d = dp == null ? 6 : dp; return trim(round(x, d).toFixed(d)).replace(/^-/, '−'); }

  /** Read a typed number: 3.5, -2, 3/4, 2.1e5, 2.1×10^5, 2.1 x 10^-3, "45 m/s", "12%". */
  function parseNum(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase()
      .replace(/[−–—]/g, '-').replace(/,/g, '').replace(/\s+/g, ' ');
    if (!s) return NaN;
    var m = s.match(/^(-?\d*\.?\d+)\s*(?:[x×*]|times)\s*10\s*(?:\^|\*\*)\s*\{?\(?([-+]?\d+)\)?\}?/);
    if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
    m = s.match(/^(-?\d*\.?\d+)\s*e\s*([-+]?\d+)/);
    if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
    m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)(?![\d.])/);
    if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
    m = s.match(/^(-?\d*\.?\d+)/);
    if (m) return parseFloat(m[1]);
    return NaN;
  }
  function fold(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, "'").replace(/[−–—]/g, '-').replace(/\s+/g, ' ').replace(/[.!?;]+$/, '').trim();
  }
  function squash(s) { return fold(s).replace(/[\s*^{}()]/g, ''); }

  /**
   * Mark an answer. { ok, close?, note } — close is a right method with the
   * wrong rounding or sign, worth saying so.
   */
  function check(p, given) {
    if (given == null || String(given).trim() === '') return { ok: false, empty: true, note: '' };
    if (p.type === 'choice') {
      var gi = typeof given === 'number' ? given : parseInt(given, 10);
      return { ok: p.options[gi] === p.answer, note: '' };
    }
    if (p.type === 'num') {
      var g = parseNum(given), a = p.answer;
      if (!isFinite(g)) return { ok: false, note: 'Type a number, like 3.5, 2/3 or 4.2×10^5.' };
      if (p.abs != null) {
        if (Math.abs(g - a) <= p.abs + 1e-12) return { ok: true, note: '' };
      } else if (p.sf) {
        // Within half a unit in the last significant figure: either rounding of an exact half counts.
        var place = Math.pow(10, Math.floor(Math.log10(Math.abs(a || 1))) - p.sf + 1);
        if (Math.abs(g - a) <= place * 0.5 * (1 + 1e-9)) return { ok: true, note: '' };
      } else {
        var tol = p.tol == null ? 0.01 : p.tol;
        var diff = Math.abs(g - a);
        if (a === 0 ? diff < 1e-9 : diff <= Math.abs(a) * tol + 1e-12) return { ok: true, note: '' };
      }
      if (a !== 0 && Math.abs(g - a) <= Math.abs(a) * 0.05) return { ok: false, close: true, note: 'Close: check your rounding, or a value you rounded too early.' };
      if (a !== 0 && Math.abs(g + a) <= Math.abs(a) * 0.01) return { ok: false, close: true, note: 'Right size, wrong sign.' };
      return { ok: false, note: '' };
    }
    var all = [p.answer].concat(p.accept || []);
    if (all.some(function (x) { return squash(x) === squash(given); })) {
      var exact = all.some(function (x) { return String(x).trim().toLowerCase() === String(given).trim().toLowerCase(); });
      return { ok: true, note: exact || !/[^\x00-\x7f]/.test(String(p.answer)) ? '' : 'Mind the accents: ' + p.answer };
    }
    return { ok: false, note: '' };
  }

  /**
   * The answer as the page prints it: p.dp decimal places (money), a whole
   * number as it is, p.sf significant figures, else 4 s.f. — always a form
   * check() marks right.
   */
  function answerText(p) {
    if (p.type !== 'num') return String(p.answer);
    var a = p.answer;
    if (p.dp != null) return a.toFixed(p.dp).replace(/^-/, '−');
    if (Number.isInteger(a) && Math.abs(a) < 1e7) return String(a).replace(/^-/, '−');
    return num(a, p.sf || 4);
  }

  /* ── Problems ─────────────────────────────────────────────────────── */
  /** Variant v of skill s; the seed is kept on the problem so it can be rebuilt. */
  function make(s, v, seed) {
    var skill = typeof s === 'string' ? BY_ID[s] : s;
    var variant = typeof v === 'string' ? skill.variants.filter(function (x) { return x.id === v; })[0] : v;
    variant = variant || skill.variants[0];
    var sd = seed == null ? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) : seed;
    for (var tries = 0; tries < 40; tries++) {
      var p = variant.gen(rng(sd + tries * 7919));
      if (!p) continue;
      p.type = p.type || (typeof p.answer === 'number' ? 'num' : 'text');
      if (p.type === 'num' && !isFinite(p.answer)) continue;
      if (p.type === 'choice' && (!p.options || p.options.indexOf(p.answer) < 0)) continue;
      p.steps = p.steps || [];
      p.skill = skill.id;
      p.variant = variant.id;
      p.seed = sd + tries * 7919;
      return p;
    }
    throw new Error('Could not make a problem for ' + skill.id + '/' + variant.id);
  }
  /** Multiple choice from a right answer and distractors; duplicates dropped, at most 5. */
  function choice(answer, wrong, r) {
    var seen = {}, opts = [];
    [answer].concat(wrong).forEach(function (o) { var k = String(o); if (!seen[k] && opts.length < 5) { seen[k] = 1; opts.push(k); } });
    return { type: 'choice', answer: String(answer), options: r ? r.shuffle(opts) : opts };
  }

  /* ── Progress ─────────────────────────────────────────────────────── */
  var KEY = 'flux_teach.v1';
  var STREAK = 3;
  function readAll() { try { return JSON.parse(root.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function writeAll(d) { try { root.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private window */ } }
  function progress(skillId) {
    var p = readAll()[skillId] || {};
    return { right: p.right || 0, wrong: p.wrong || 0, streak: p.streak || 0, met: p.met || {}, at: p.at || 0 };
  }
  /** Only answers made without the full working shown are recorded (the UI decides). */
  function record(skillId, variantId, ok) {
    var all = readAll();
    var p = all[skillId] || { right: 0, wrong: 0, streak: 0, met: {} };
    p.met = p.met || {};
    if (ok) { p.right++; p.streak++; p.met[variantId] = (p.met[variantId] || 0) + 1; }
    else { p.wrong++; p.streak = 0; }
    p.at = Date.now();
    all[skillId] = p;
    writeAll(all);
    return progress(skillId);
  }
  /** Mastered = every variant got right at least once and the last three right. */
  function mastery(skillId) {
    var s = BY_ID[skillId];
    if (!s) return { pct: 0, mastered: false, met: 0, of: 0, streak: 0 };
    var p = progress(skillId);
    var met = s.variants.filter(function (v) { return p.met[v.id]; }).length;
    var of = s.variants.length;
    var pct = Math.min(1, (met / of) * 0.8 + Math.min(p.streak, STREAK) / STREAK * 0.2);
    return { pct: pct, mastered: met === of && p.streak >= STREAK, met: met, of: of, streak: p.streak, started: p.right + p.wrong > 0 };
  }
  /** Next variant: the next one not yet met, so every iteration comes up; then any but the last. */
  function nextVariant(skillId, after, r) {
    var s = BY_ID[skillId];
    var p = progress(skillId);
    var unmet = s.variants.filter(function (v) { return !p.met[v.id]; });
    if (unmet.length) {
      var ids = s.variants.map(function (v) { return v.id; });
      var from = after ? ids.indexOf(after) : -1;
      for (var k = 1; k <= ids.length; k++) {
        var cand = s.variants[(from + k) % ids.length];
        if (!p.met[cand.id]) return cand;
      }
    }
    var pool = s.variants.length > 1 ? s.variants.filter(function (v) { return v.id !== after; }) : s.variants;
    return (r || rng()).pick(pool);
  }
  function reset(skillId) { var all = readAll(); delete all[skillId]; writeAll(all); }

  function forUnit(unitId) { return SKILLS.filter(function (s) { return s.units.indexOf(unitId) >= 0; }); }
  function forSubject(subjectId) { return SKILLS.filter(function (s) { return s.units.some(function (u) { return u.split(':')[0] === subjectId; }); }); }

  root.FluxTeach = {
    register: register,
    skills: function () { return SKILLS.slice(); },
    skill: function (id) { return BY_ID[id] || null; },
    forUnit: forUnit,
    forSubject: forSubject,
    make: make,
    check: check,
    choice: choice,
    answerText: answerText,
    mastery: mastery,
    progress: progress,
    record: record,
    nextVariant: nextVariant,
    reset: reset,
    // helpers for content files
    rng: rng, round: round, sig: sig, gcd: gcd, frac: frac, num: num, show: show, parseNum: parseNum, fold: fold,
  };
})();
