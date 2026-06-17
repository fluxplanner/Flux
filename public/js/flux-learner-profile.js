/**
 * flux-learner-profile.js — Flux learns HOW each student communicates & understands.
 *
 * Every message a student sends Flux (typed or voice-dictated) is a sample of how
 * they speak and think. This module quietly profiles those habits — message
 * length, vocabulary level, tone, and explicit "I don't get it / simpler please"
 * signals — and tells the AI how to pitch its answers so the student actually
 * comprehends. No training; it's an adaptive instruction layer over the prompt.
 *
 * Private by design: only derived metrics live in the user's own synced data
 * (save/load) — never the message text itself.
 *
 * window.FluxLearnerProfile = { record(text), appendToSystem(system), profile(), stats() }
 */
(function () {
  'use strict';

  var KEY = 'flux_learner_profile';
  var ALPHA = 0.15; // EMA weight — recent messages matter a bit more

  function load_(k, f) { try { return typeof load === 'function' ? load(k, f) : f; } catch (e) { return f; } }
  function save_(k, v) { try { if (typeof save === 'function') save(k, v); } catch (e) {} }

  function blank() {
    return {
      n: 0,            // messages sampled
      avgWords: 0,     // EMA of words per message
      avgWordLen: 0,   // EMA of letters per word (vocabulary proxy)
      simplify: 0,     // "explain simpler / I don't get it" signals
      deepDive: 0,     // "why / how / prove / derive" signals
      casual: 0,       // casual/emoji/slang markers
      formal: 0,       // formal markers
      // Comprehension feedback loop — did Flux's explanations actually land?
      clarity: 0.5,        // EMA 0..1: how well recent answers are understood
      confusionStreak: 0,  // consecutive answers that left them confused
      confused: 0,         // total "still don't get it" follow-ups
      resolved: 0,         // total "got it / makes sense" follow-ups
      awaiting: false,     // next message is feedback on the last answer
      updatedAt: null,
    };
  }
  // Read stored profile, back-filling fields added after the user's blob was saved.
  function get() {
    var p = load_(KEY, null);
    if (!p || typeof p !== 'object') return blank();
    var b = blank();
    for (var k in b) if (p[k] === undefined) p[k] = b[k];
    return p;
  }
  function ema(prev, target, a) { a = a || 0.3; return (typeof prev !== 'number') ? target : prev + a * (target - prev); }

  var SIMPLIFY = /\b(simpl(er|y)|don'?t (get|understand)|confus|easier|eli5|dumb it down|in plain|too (hard|complex)|what does .* mean|explain again|lost)\b/i;
  var DEEP = /\b(why|how come|prove|derive|in depth|deeper|rigorous|step[- ]by[- ]step|show your work|explain the reasoning)\b/i;
  var CASUAL = /\b(lol|lmao|idk|gonna|wanna|kinda|ok so|umm|bro|pls|plz|ty|thx)\b|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  var FORMAL = /\b(furthermore|therefore|however|regarding|kindly|could you please|i would like)\b/i;
  // The student signalling Flux's *previous* answer finally clicked.
  var RESOLVED = /\b(got it|get it now|makes sense|make sense|i see|oh+ i see|i understand|understood|that helps|thanks?,? that|clearer now|clear now|gotcha|that works|ohh+|ahh+|now i get)\b/i;

  function record(text) {
    text = String(text || '').trim();
    if (text.length < 2 || text[0] === '/') return; // skip blanks + slash commands
    var p = get();
    // Comprehension feedback: if Flux just answered, read this turn as a verdict
    // on whether that explanation landed. Only explicit signals move the needle —
    // a fresh, unrelated question matches neither pattern and is left neutral.
    if (p.awaiting) {
      if (RESOLVED.test(text)) { p.clarity = ema(p.clarity, 1); p.confusionStreak = 0; p.resolved++; }
      else if (SIMPLIFY.test(text)) { p.clarity = ema(p.clarity, 0); p.confusionStreak++; p.confused++; }
    }
    var words = text.split(/\s+/).filter(Boolean);
    var w = words.length;
    var letters = words.join('').replace(/[^a-zA-Z]/g, '').length;
    var wl = w ? letters / w : 0;
    p.avgWords = p.n ? p.avgWords + ALPHA * (w - p.avgWords) : w;
    p.avgWordLen = p.n ? p.avgWordLen + ALPHA * (wl - p.avgWordLen) : wl;
    if (SIMPLIFY.test(text)) p.simplify++;
    if (DEEP.test(text)) p.deepDive++;
    try { if (CASUAL.test(text)) p.casual++; } catch (e) {}
    if (FORMAL.test(text)) p.formal++;
    p.awaiting = true; // Flux is about to answer — the next turn judges how clear it was.
    p.n++;
    p.updatedAt = new Date().toISOString();
    save_(KEY, p);
  }

  /** Derive human-readable traits from the raw counters. */
  function profile() {
    var p = get();
    var struggling = p.confusionStreak >= 2 || p.clarity < 0.4;
    // Surface as soon as there's signal, or earlier if explanations are clearly missing.
    if (p.n < 4 && !struggling) return null;
    var level = p.avgWordLen >= 5.2 ? 'advanced' : p.avgWordLen <= 4.0 ? 'foundational' : 'on-level';
    var length = p.avgWords <= 8 ? 'terse' : p.avgWords >= 22 ? 'detailed' : 'moderate';
    var wantsSimple = p.simplify >= Math.max(2, p.deepDive + 1);
    var wantsDepth = p.deepDive >= Math.max(2, p.simplify + 1);
    var tone = p.casual > p.formal * 1.5 ? 'casual' : p.formal > p.casual * 1.5 ? 'formal' : 'neutral';
    return {
      n: p.n, level: level, length: length, wantsSimple: wantsSimple, wantsDepth: wantsDepth, tone: tone,
      clarity: p.clarity, confusionStreak: p.confusionStreak, struggling: struggling,
    };
  }

  /** Inject an adaptive instruction so Flux meets the student where they are. */
  function appendToSystem(system) {
    try {
      var t = profile();
      if (!t) return system;
      var bits = [];
      if (t.level === 'foundational') bits.push('uses simple language — define jargon, use concrete everyday examples, short sentences');
      else if (t.level === 'advanced') bits.push('writes at a high level — you can use precise terminology and move faster');
      if (t.wantsSimple) bits.push('often asks for simpler explanations — lead with the plain-English idea before any formalism');
      if (t.wantsDepth) bits.push('likes depth and reasoning — show the "why", not just the answer');
      if (t.length === 'terse') bits.push('writes briefly — keep answers tight unless they ask for more');
      if (t.tone === 'casual') bits.push('writes casually — a warm, conversational tone lands best');
      // Comprehension comes first: if recent explanations didn't land, lead with a change of tactics.
      if (t.struggling) {
        bits.unshift('IMPORTANT — recent explanations have NOT been landing for this student. Change your approach this time: open with a concrete real-world analogy, break the idea into small numbered steps, avoid jargon, and finish by checking their understanding with one quick question or worked example');
      }
      if (!bits.length) return system;
      return system + '\n\n<learner_profile>\nAdapt to how this student communicates and understands: ' +
        bits.join('; ') + '. Match their level so they actually get it.\n</learner_profile>';
    } catch (e) { return system; }
  }

  function stats() { return { raw: get(), traits: profile() }; }
  function reset() { save_(KEY, blank()); }

  /* ───────── transparency card: "How Flux explains to you" ───────── */

  var LEVEL_TXT = { foundational: 'Plain-language, concrete examples', 'on-level': 'Balanced explanations', advanced: 'Precise, moves quickly' };
  var LENGTH_TXT = { terse: 'Keeps it short', moderate: 'Medium-length', detailed: 'Thorough answers' };
  var TONE_TXT = { casual: 'Warm & conversational', neutral: 'Neutral tone', formal: 'Formal tone' };

  function chip(label) { return '<span class="flp-chip">' + label + '</span>'; }

  function ensureStyles() {
    if (document.getElementById('flpStyles')) return;
    var s = document.createElement('style');
    s.id = 'flpStyles';
    s.textContent =
      '.flp-card .flp-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
      '.flp-card .flp-head h3{margin:0}' +
      '.flp-ico{font-size:1.2rem;color:var(--accent)}' +
      '.flp-sub,.flp-empty{font-size:.8rem;color:var(--muted2);line-height:1.6;margin:0 0 12px}' +
      '.flp-empty{margin-bottom:0}' +
      '.flp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}' +
      '.flp-chip{font-size:.74rem;padding:4px 10px;border-radius:999px;background:rgba(var(--accent-rgb),.12);color:var(--accent);border:1px solid rgba(var(--accent-rgb),.22)}' +
      '.flp-clarity-top{display:flex;justify-content:space-between;font-size:.74rem;color:var(--muted2);margin-bottom:5px}' +
      '.flp-meter{height:7px;border-radius:999px;background:var(--card2);overflow:hidden}' +
      '.flp-meter>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent),rgba(var(--accent-rgb),.6));transition:width .4s ease}' +
      '.flp-clarity-note{font-size:.72rem;color:var(--muted);margin-top:6px}' +
      '.flp-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap}' +
      '.flp-n{font-size:.72rem;color:var(--muted);font-family:"JetBrains Mono",monospace}' +
      '.flp-reset{padding:6px 12px;font-size:.76rem}';
    document.head.appendChild(s);
  }

  function renderCard(host) {
    host = host || document.getElementById('fluxLearnerCard');
    if (!host) return;
    ensureStyles();
    var t = profile();
    if (!t) {
      host.innerHTML = '<div class="card flp-card"><div class="flp-head">' +
        '<span class="flp-ico" aria-hidden="true">✦</span><h3>How Flux explains to you</h3></div>' +
        '<p class="flp-empty">Flux is still getting to know how you learn. Chat with Flux AI a few times and it will start adapting its explanations to your style — pitched to your level, and clearer when something doesn\'t click.</p></div>';
      return;
    }
    var chips = [chip(LEVEL_TXT[t.level]), chip(LENGTH_TXT[t.length]), chip(TONE_TXT[t.tone])];
    if (t.wantsSimple) chips.push(chip('Leads with the simple idea'));
    if (t.wantsDepth) chips.push(chip('Shows the reasoning'));
    var clarityPct = Math.round((typeof t.clarity === 'number' ? t.clarity : 0.5) * 100);
    var clarityLabel = t.struggling ? 'Flux is simplifying — recent answers needed another pass'
      : clarityPct >= 70 ? 'Explanations are landing well'
      : 'Explanations are landing okay';
    host.innerHTML = '<div class="card flp-card"><div class="flp-head">' +
      '<span class="flp-ico" aria-hidden="true">✦</span><h3>How Flux explains to you</h3></div>' +
      '<p class="flp-sub">Flux quietly adapts to how you write and what helps you understand. It only keeps these summary traits — never your messages.</p>' +
      '<div class="flp-chips">' + chips.join('') + '</div>' +
      '<div class="flp-clarity"><div class="flp-clarity-top"><span>Comprehension</span><span>' + clarityPct + '%</span></div>' +
      '<div class="flp-meter"><i style="width:' + clarityPct + '%"></i></div>' +
      '<div class="flp-clarity-note">' + clarityLabel + '</div></div>' +
      '<div class="flp-foot"><span class="flp-n">Learned from ' + t.n + ' message' + (t.n === 1 ? '' : 's') + '</span>' +
      '<button type="button" class="btn-sec flp-reset">Reset what Flux learned</button></div></div>';
    var btn = host.querySelector('.flp-reset');
    if (btn) btn.addEventListener('click', function () {
      reset();
      renderCard(host);
      try { if (typeof showToast === 'function') showToast('Reset — Flux will learn your style again from scratch.', 'info'); } catch (e) {}
    });
  }

  window.FluxLearnerProfile = { record: record, appendToSystem: appendToSystem, profile: profile, stats: stats, reset: reset, renderCard: renderCard };
})();
