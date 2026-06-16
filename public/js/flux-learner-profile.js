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
      updatedAt: null,
    };
  }
  function get() { var p = load_(KEY, null); return (p && typeof p === 'object') ? p : blank(); }

  var SIMPLIFY = /\b(simpl(er|y)|don'?t (get|understand)|confus|easier|eli5|dumb it down|in plain|too (hard|complex)|what does .* mean|explain again|lost)\b/i;
  var DEEP = /\b(why|how come|prove|derive|in depth|deeper|rigorous|step[- ]by[- ]step|show your work|explain the reasoning)\b/i;
  var CASUAL = /\b(lol|lmao|idk|gonna|wanna|kinda|ok so|umm|bro|pls|plz|ty|thx)\b|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  var FORMAL = /\b(furthermore|therefore|however|regarding|kindly|could you please|i would like)\b/i;

  function record(text) {
    text = String(text || '').trim();
    if (text.length < 2 || text[0] === '/') return; // skip blanks + slash commands
    var p = get();
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
    p.n++;
    p.updatedAt = new Date().toISOString();
    save_(KEY, p);
  }

  /** Derive human-readable traits from the raw counters. */
  function profile() {
    var p = get();
    if (p.n < 4) return null; // not enough signal yet
    var level = p.avgWordLen >= 5.2 ? 'advanced' : p.avgWordLen <= 4.0 ? 'foundational' : 'on-level';
    var length = p.avgWords <= 8 ? 'terse' : p.avgWords >= 22 ? 'detailed' : 'moderate';
    var wantsSimple = p.simplify >= Math.max(2, p.deepDive + 1);
    var wantsDepth = p.deepDive >= Math.max(2, p.simplify + 1);
    var tone = p.casual > p.formal * 1.5 ? 'casual' : p.formal > p.casual * 1.5 ? 'formal' : 'neutral';
    return { n: p.n, level: level, length: length, wantsSimple: wantsSimple, wantsDepth: wantsDepth, tone: tone };
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
      if (!bits.length) return system;
      return system + '\n\n<learner_profile>\nAdapt to how this student communicates and understands: ' +
        bits.join('; ') + '. Match their level so they actually get it.\n</learner_profile>';
    } catch (e) { return system; }
  }

  function stats() { return { raw: get(), traits: profile() }; }

  window.FluxLearnerProfile = { record: record, appendToSystem: appendToSystem, profile: profile, stats: stats };
})();
