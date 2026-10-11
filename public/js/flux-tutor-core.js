/* ============================================================================
   FLUX TUTOR · CORE  ·  flux-tutor-core.js
   Everything about a Flux Tutor study set that is not drawing: reading the
   student's notes into cited sentences, the study guide (outline, key terms,
   key facts, section summaries), questions and answer checking, mastery, the
   Learn session, practice tests, "Ask your notes" search, the study plan, and
   the saved-set model (validation, migration from the first beta, export and
   import).

   No DOM and no network here, so the unit tests run it in a bare VM
   (test/unit/tutor-core.test.mjs) and teacher.html loads it as a plain script.

   GROUNDING RULE
   --------------
   Flux AI is paused, so nothing here writes new sentences about the subject.
   Every explanation, definition, example and answer is text copied from the
   student's own material (or typed by the student into the study guide), with
   where it came from (file, page, paragraph). The only text Flux adds is the
   framing ("Fill in the missing word", "Your notes say…"). A "false"
   true-or-false statement is a source sentence with one key term swapped for
   another key term from the same notes; the feedback always shows the real
   sentence. When the notes do not cover something, the functions say so (an
   empty result or `covered: false`) rather than guessing.

   ANSWER CHECKING
   ---------------
   Rules only: exact or normalised match (case, accents, punctuation, a leading
   article, plural/singular), other names the notes give ("ATP (adenosine
   triphosphate)", "also called …"), and a spelling slip of a letter or two.
   It cannot judge reasoning, and the copy says so.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxTutor) return;

  const VERSION = 2;
  const LIMITS = {
    title: 160,
    subject: 100,
    sourceName: 180,
    sourceText: 200000,
    sources: 20,
    url: 500,
    term: 160,
    def: 1500,
    fact: 1500,
    terms: 500,
    facts: 500,
    removed: 3000,
    tests: 25,
    testQuestions: 60,
    steps: 150,
    answer: 2400,
    legacyNote: 2400,
    planDays: 45,
  };
  const KINDS = ['Notes', 'Photo', 'PDF', 'Word', 'Text', 'Sample'];
  const QTYPES = ['mc', 'mcdef', 'tf', 'cloze', 'written', 'match'];
  const VERDICTS = ['correct', 'close', 'partial', 'incorrect', 'skipped', 'empty'];
  const TERM_KINDS = ['definition', 'mention', 'user'];
  const MASTERED = 3;
  const MAX_LEVEL = 4;
  const DAY = 86400000;

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function str(value, max) {
    if (typeof value !== 'string') return '';
    return max ? value.slice(0, max) : value;
  }
  function strList(value, maxItems, maxLen) {
    if (!Array.isArray(value)) return [];
    return value.filter((v) => typeof v === 'string' && v.trim()).slice(0, maxItems).map((v) => v.slice(0, maxLen));
  }
  function clampInt(value, lo, hi, dflt) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
  }
  function posInt(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
  }
  function clampNum(value, lo, hi, dflt) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : (dflt == null ? 0 : dflt);
  }
  function isoOr(value, dflt) {
    if (typeof value !== 'string' || value.length > 40) return dflt;
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : dflt;
  }
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  function safeKey(key) {
    return typeof key === 'string' && /^[A-Za-z0-9_.:#-]{1,120}$/.test(key) && !BAD_KEYS.has(key);
  }
  /** FNV-1a, 32 bit, as 8 hex digits. */
  function hashText(text) {
    let h = 0x811c9dc5;
    const s = String(text == null ? '' : text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** A repeatable random stream (mulberry32), so questions do not reshuffle on reload. */
  function seeded(seed) {
    let a = parseInt(hashText(seed), 16) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    const out = list.slice();
    const r = rnd || Math.random;
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const v = value.trim().slice(0, LIMITS.url);
    if (typeof URL === 'function') {
      try {
        const url = new URL(v);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
      } catch (_) { return ''; }
    }
    return /^https?:\/\/[^\s<>"']+$/i.test(v) ? v : '';
  }
  function cap(text) {
    const s = String(text || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function plainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  /* ── Dates (local calendar days, "YYYY-MM-DD") ──────────────────────── */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(t) {
    const d = t instanceof Date ? t : new Date(t == null ? Date.now() : t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function isYmd(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  function dayNum(s) {
    const [y, m, d] = s.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / DAY);
  }
  function addDays(s, n) {
    const t = new Date((dayNum(s) + n) * DAY);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }

  /* ── Words ──────────────────────────────────────────────────────────── */

  const STOP = new Set(('a an the of to in on at by for from with as is are was were be been being am it its this that these those or and but if so than then there their they them we you your our us he she his her him i me my do does did not no yes can could will would shall should may might must has have had into onto over under about also just very more most such only own same other some any each every all both either neither nor too out up down off per via etc '
    + 'above after again against around because before between came cannot doing each enough even few further get give goes good great having here how itself like made make many much near need never now often rather really since thing through until upon way what when where which while who whom whose why yet once one two three gets got using used use uses during although though however unlike within without whether toward towards across along among').split(/\s+/).filter(Boolean));
  const QUESTION_WORDS = new Set(('explain describe define definition what whats how why which when where who whom whose does do did is are was were tell list give name state identify outline summarize summarise discuss compare contrast evaluate analyse analyze example examples mean means meaning about between difference differences happen happens happened work works affect affects role say says said note notes my me mention mentions mentioned anything something know find show please').split(' '));
  const GENERIC = new Set(('note notes example examples answer answers question questions remember tip tips hint hints summary definition definitions key important homework due date name class period teacher page pages chapter unit section lesson warning reminder review objective objectives goal goals aim aims vocabulary vocab topic topics title source sources figure fig table diagram introduction conclusion overview agenda today quiz test exam worksheet reading part step steps therefore thing things way ways type types kind kinds lot lots people person time times year years process glossary key terms term facts fact')
    .split(' ').map(stem));
  const ARTICLES = new Set(['a', 'an', 'the']);

  const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*(?:-[\p{L}\p{N}]+)*/gu;
  /** Words with their positions in the text, lower-cased. */
  function tokenize(text) {
    const s = String(text || '');
    const out = [];
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(s))) out.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
    return out;
  }
  function words(text) { return tokenize(text).map((t) => t.w); }

  /** A light English stemmer: enough that "cells", "divides" and "dividing" meet "cell" and "divide". */
  function stem(word) {
    let w = String(word || '').toLowerCase().replace(/['’]s$/, '').replace(/['’]/g, '');
    if (w.length <= 3 || /\d/.test(w)) return w;
    if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
    else if (/(?:ss|x|ch|sh|z)es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !/(?:ss|us|is|ys)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) w = w.slice(0, -2);
    if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
    if (w.length >= 4 && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz|ff)$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  function isContent(w) {
    return w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w);
  }
  function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** For comparing answers: case, accents, punctuation and a leading article do not count. */
  function norm(s) {
    return stripAccents(String(s == null ? '' : s).toLowerCase())
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      .replace(/^(?:the|a|an) /, '');
  }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }
  /** Edit distance where swapping two neighbouring letters ("recieve") is one slip, not two. */
  function osa(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev2 = null;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
      }
      prev2 = prev;
      prev = cur;
    }
    return prev[n];
  }
  function indexOfSeq(hay, needle, from) {
    if (!needle.length || needle.length > hay.length) return -1;
    outer: for (let i = from || 0; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  }
  function countSeq(hay, needle) {
    let n = 0;
    let i = indexOfSeq(hay, needle, 0);
    while (i >= 0) { n++; i = indexOfSeq(hay, needle, i + needle.length); }
    return n;
  }
  function termStems(label) {
    const toks = tokenize(label);
    while (toks.length > 1 && ARTICLES.has(toks[0].w)) toks.shift();
    return toks.map((t) => stem(t.w));
  }

  /* ── Reading sources ────────────────────────────────────────────────── */

  const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };
  /** Tidy pasted, OCR and PDF text: line endings, ligatures, words broken over a line. */
  function normalizeText(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')
      .replace(/­/g, '')
      .replace(/[ﬀ-ﬄ]/g, (c) => LIGATURES[c])
      .replace(/[​-‍﻿]/g, '')
      .replace(/[ \t\f\v]+\n/g, '\n')
      .replace(/[ \t\f\v]{2,}/g, ' ')
      .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * PDF text arrives as visual lines. A line that ends a sentence and is
   * clearly shorter than the page's usual line is the end of a paragraph, so a
   * blank line goes after it: that is what makes "page 3 · paragraph 2" mean
   * something for a PDF.
   */
  function pdfLinesToText(lines) {
    const clean = (lines || []).map((l) => String(l || '').replace(/\s+/g, ' ').trim());
    const lengths = clean.filter((l) => l.length > 20).map((l) => l.length).sort((a, b) => a - b);
    const typical = lengths.length ? lengths[Math.floor(lengths.length * 0.75)] : 0;
    const out = [];
    clean.forEach((line) => {
      if (!line) {
        if (out.length && out[out.length - 1] !== '') out.push('');
        return;
      }
      out.push(line);
      if (typical && /[.!?:]["'”’)]*$/.test(line) && line.length < typical * 0.7) out.push('');
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const PAGE_RE = /^(?:[-–—=]+\s*)?(?:page|p\.)\s*(\d{1,4})(?:\s*[-–—=]+)?$/i;
  const MARKER_RE = /^\[[^\]]{1,240}\]$/;
  const BULLET_RE = /^\s*(?:[-*•▪◦·‣–—+]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)](?=\s))\s+/;
  const ABBR_END = /(?:\b(?:e\.g|i\.e|etc|vs|approx|dr|mr|mrs|ms|prof|st|no|fig|figs|cf|al|ca|jr|sr|vol|pp|ch|sec|eq|u\.s|u\.k|a\.m|p\.m)\.)$/i;
  const INITIAL_END = /(?:^|\s)\p{Lu}\.$/u;
  const GLOSS_LINE = /^[^\s:–—][^:–—]{0,48}?\s[-–—]\s\S/;

  function splitPages(text) {
    const segs = [];
    let cur = { page: null, lines: [] };
    text.split('\n').forEach((line) => {
      const m = PAGE_RE.exec(line.trim());
      if (m) {
        if (cur.lines.join('').trim()) segs.push(cur);
        cur = { page: Number(m[1]), lines: [] };
        return;
      }
      cur.lines.push(line);
    });
    if (cur.lines.join('').trim()) segs.push(cur);
    return segs.map((s) => ({ page: s.page, text: s.lines.join('\n').trim() }));
  }
  function isBullet(line) { return BULLET_RE.test(line); }
  function endsTerminal(line) { return /[.!?:;]["'”’)\]]*$/.test(line); }
  function headingLike(line) {
    if (/^#{1,6}\s+\S/.test(line)) return true;
    const t = line.trim();
    if (!t || t.length > 70 || isBullet(t)) return false;
    if (/\s[-–—]\s/.test(t) || /[=→]/.test(t)) return false;
    const n = tokenize(t).length;
    if (!n || n > 8) return false;
    if (/[.!?,;]["'”’)]*$/.test(t)) return false;
    if (/:\s+\S/.test(t)) return false;
    return true;
  }
  function cleanHeading(line) {
    return line.replace(/^#{1,6}\s+/, '').replace(/[*_`]+/g, '').replace(/:\s*$/, '').trim();
  }
  /** Lines wrapped by a PDF or a narrow page belong together; list items and glossary lines do not. */
  function shouldJoin(prev, next) {
    if (isBullet(next) || endsTerminal(prev) || /^#{1,6}\s/.test(next)) return false;
    if (/^[^:]{1,40}:\s/.test(next) || GLOSS_LINE.test(next)) return false;
    if (GLOSS_LINE.test(prev) || /^[^:]{1,40}:\s/.test(prev)) return /^[\p{Ll}(]/u.test(next) && tokenize(prev).length >= 9;
    const n = tokenize(prev).length;
    if (/^[\p{Ll}(]/u.test(next)) return n >= 3;
    return n >= 9;
  }
  function cleanLine(line) {
    return line.replace(BULLET_RE, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  }
  /** Sentences in one line of text, without breaking "e.g." or "3.5". (No look-behind: older Safari.) */
  function splitSentences(text) {
    const s = String(text || '');
    const parts = [];
    const re = /[.!?…]+["'”’)\]]*\s+(?=["'“‘(\[]?[\p{Lu}\p{N}])/gu;
    let last = 0;
    let m;
    while ((m = re.exec(s))) {
      const end = m.index + m[0].replace(/\s+$/, '').length;
      parts.push(s.slice(last, end));
      last = m.index + m[0].length;
    }
    parts.push(s.slice(last));
    const out = [];
    parts.forEach((p) => {
      const prev = out[out.length - 1];
      if (prev && (ABBR_END.test(prev) || INITIAL_END.test(prev))) out[out.length - 1] = prev + ' ' + p;
      else out.push(p);
    });
    return out.map((x) => x.trim()).filter(Boolean);
  }

  function copyRef(ref) {
    if (!ref) return null;
    const out = { sourceId: ref.sourceId || '', source: ref.source || 'Your notes', kind: ref.kind || 'Notes', page: ref.page || null, para: ref.para || null };
    if (ref.edited) out.edited = true;
    return out;
  }

  /**
   * The student's sources as sections, paragraphs and sentences, each carrying
   * where it came from: { sourceId, source (name), kind, page, para }.
   */
  function buildCorpus(sources) {
    const corpus = {
      paragraphs: [], sentences: [], headings: [], sections: [], bold: [],
      byId: Object.create(null), paraById: Object.create(null), sectionById: Object.create(null),
      df: new Map(), stemIndex: new Map(), N: 0, sourceCount: 0,
    };
    (Array.isArray(sources) ? sources : []).forEach((src, si) => {
      if (!src || typeof src.text !== 'string' || !src.text.trim()) return;
      corpus.sourceCount++;
      const base = {
        sourceId: str(src.id, 80) || 'src' + si,
        source: str(src.name, LIMITS.sourceName) || 'Your notes',
        kind: KINDS.includes(src.kind) ? src.kind : 'Notes',
      };
      const text = normalizeText(src.text);
      const hasTop = /^#\s+\S/m.test(text);
      let section = null;
      const open = (title, level, page) => {
        const ref = Object.assign({}, base, { page, para: null });
        section = { id: base.sourceId + '#' + (corpus.sections.length + 1), title, level, ref, sourceId: base.sourceId, source: base.source, paraIds: [], sentenceIds: [] };
        corpus.sections.push(section);
        corpus.sectionById[section.id] = section;
        if (level > 0) corpus.headings.push({ text: title, level, ref, sectionId: section.id, order: corpus.sentences.length });
      };
      splitPages(text).forEach((seg) => {
        const blocks = seg.text.split(/\n[ \t]*\n/);
        let lastBlock = -1;
        blocks.forEach((b, i) => { if (b.trim()) lastBlock = i; });
        let paraNo = 0;
        let units = [];
        const flush = () => {
          if (!units.length) return;
          if (!section) open(base.source, 0, seg.page);
          paraNo += 1;
          const ref = Object.assign({}, base, { page: seg.page, para: paraNo });
          const para = { id: base.sourceId + ':' + (seg.page || 0) + ':' + paraNo, ref, sectionId: section.id, sentences: [] };
          units.forEach((unit) => {
            const boldRe = /\*\*([^*\n]{2,60})\*\*|__([^_\n]{2,60})__/g;
            let bm;
            while ((bm = boldRe.exec(unit.raw))) corpus.bold.push((bm[1] || bm[2]).trim());
            splitSentences(cleanLine(unit.raw)).forEach((textPart, k) => {
              const toks = tokenize(textPart);
              if (!toks.length) return;
              const sent = {
                id: para.id + '.' + (para.sentences.length + 1),
                text: textPart,
                paraId: para.id,
                sectionId: section.id,
                section: section.title,
                ref,
                order: corpus.sentences.length,
                toks,
                stems: toks.map((t) => stem(t.w)),
                wc: toks.length,
                lineStart: k === 0,
                bullet: k === 0 && unit.bullet,
              };
              para.sentences.push(sent);
              corpus.sentences.push(sent);
              corpus.byId[sent.id] = sent;
              section.sentenceIds.push(sent.id);
            });
          });
          if (para.sentences.length) {
            corpus.paragraphs.push(para);
            corpus.paraById[para.id] = para;
            section.paraIds.push(para.id);
          } else paraNo -= 1;
          units = [];
        };
        blocks.forEach((block, bi) => {
          const lines = block.split('\n').map((l) => l.trim()).filter((l) => l && !MARKER_RE.test(l));
          lines.forEach((line, li) => {
            const md = /^(#{1,6})\s+(\S.*)$/.exec(line);
            if (md) {
              flush();
              const title = cleanHeading(md[2]);
              if (title) open(title, md[1].length, seg.page);
              return;
            }
            if (li === 0 && headingLike(line) && (lines.length > 1 || bi < lastBlock)) {
              flush();
              const title = cleanHeading(line);
              if (title) open(title, hasTop ? 2 : 1, seg.page);
              return;
            }
            const prev = units[units.length - 1];
            if (prev && shouldJoin(prev.raw, line)) prev.raw += ' ' + line;
            else units.push({ raw: line, bullet: isBullet(line) });
          });
          flush();
        });
      });
    });
    corpus.sentences.forEach((s, i) => {
      new Set(s.stems).forEach((st) => {
        corpus.df.set(st, (corpus.df.get(st) || 0) + 1);
        let list = corpus.stemIndex.get(st);
        if (!list) { list = []; corpus.stemIndex.set(st, list); }
        list.push(i);
      });
    });
    corpus.N = corpus.sentences.length;
    return corpus;
  }
  function idf(corpus, st) {
    return Math.log((corpus.N + 1) / ((corpus.df.get(st) || 0) + 0.5));
  }
  /** "Biology notes.pdf · page 3 · paragraph 2" */
  function formatRef(ref) {
    if (!ref) return 'Your study guide';
    if (ref.edited) return 'Your study guide (written by you)';
    const bits = [ref.source || 'Your notes'];
    if (ref.page) bits.push('page ' + ref.page);
    if (ref.para) bits.push('paragraph ' + ref.para);
    return bits.join(' · ');
  }
  function passage(sent) {
    return { text: sent.text, ref: copyRef(sent.ref), sentenceId: sent.id };
  }
  /** Is there enough here to study from? */
  function measure(corpus) {
    const wordsCount = corpus.sentences.reduce((n, s) => n + s.wc, 0);
    const usable = corpus.sentences.filter((s) => s.wc >= 5).length;
    return { sentences: corpus.N, words: wordsCount, usable, enough: usable >= 3 && wordsCount >= 30 };
  }

  /* ── Finding terms ──────────────────────────────────────────────────── */

  const BAD_TERM_START = /^(?:it|its|this|that|these|those|there|here|they|them|he|she|we|you|i|which|what|who|whom|whose|one|each|some|many|most|all|both|another|such|their|his|her|our|your|my|any|every|no|none|other|others|few|several|also|then|so|thus|but|and|or|if|when|while|because|since|although|how|why|where|in|on|at|for|from|with|by|of|to|as|during|after|before|today|now)\b/i;
  const REST_BAD = /^(?:not|also|often|usually|always|never|very|still|then|now|found|used|made|located|stored|produced|caused|formed|called|known|named|termed|given|taken|seen|shown|done|being|able|likely|important|responsible|split|set|put|cut|held|kept|left|lost|built|brought|sent|spent|bound|due|about|going|on|in|at|for|to|from|by|with|more|less|much|too|so|only|just|one|two|three)\b/i;
  const VERBISH_TERM = /\b(?:is|are|was|were|has|have|had|will|can|could|should|would|may|might|must|do|does|did|been|being)\b/i;
  // "X is formed by …", "X was found in …", "X is broken down": a passive, not a definition.
  // ("Magma is molten rock" and "Organelles are specialised structures" stay definitions.)
  const PASSIVE_RE = /^\p{L}+(?:ed|en)(?:[.,;:]|$|\s+(?:by|in|on|at|from|to|into|onto|with|as|when|during|through|down|up|out|off|over|under|after|before|because|for|and|or|if|until|via|between|within)\b)/iu;
  // "Ribosomes are tiny structures that build proteins": a description of what the term is.
  const DESCRIBES_RE = /^(?:[\p{L}\p{N}'’-]+\s+){1,5}(?:that|which|where|who|whose|used|made|found|consisting|containing)\b/iu;

  function cleanTerm(term) {
    let t = String(term || '').replace(/[*_`]+/g, '').replace(/^[\s"'“‘]+|[\s"'”’:,]+$/g, '');
    // Brackets only go when they do not pair up: "ATP (adenosine triphosphate)" keeps its other name.
    if (/^\(/.test(t) && !/\)/.test(t)) t = t.slice(1);
    while (/\)$/.test(t) && (t.match(/\(/g) || []).length < (t.match(/\)/g) || []).length) t = t.slice(0, -1).trim();
    return t.replace(/^[\s"'“‘]+|[\s"'”’:,]+$/g, '').replace(/^(?:an?|the)\s+/i, '').trim();
  }
  const NAME_ABBR_RE = /\b(St|Mt|Ft|Dr|Mr|Mrs|Ms|Jr|Sr)\.(?=\s+\p{Lu}|$)/gu;
  function termOk(term, maxWords) {
    const t = String(term || '').trim();
    if (!t || t.length > 60 || /[.!?;"“”=→]/.test(t.replace(NAME_ABBR_RE, '$1'))) return false;
    if (!/\p{L}/u.test(t)) return false;
    const w = words(t);
    if (!w.length || w.length > maxWords) return false;
    if (BAD_TERM_START.test(t) || VERBISH_TERM.test(t)) return false;
    if (w.every((x) => STOP.has(x) || /^\d+$/.test(x) || GENERIC.has(stem(x)))) return false;
    return true;
  }
  /** "Term (ABC)" → { term, aliases: ['ABC'] }. */
  function splitAcronym(term) {
    const m = /^(.+?)\s*\(([^)]{1,40})\)$/.exec(term);
    if (!m) return { term, aliases: [] };
    return { term: m[1].trim(), aliases: m[2].trim() ? [m[2].trim()] : [] };
  }
  function tidyDef(text) {
    let d = String(text || '').trim().replace(/^[:\-–—=,]\s*/, '');
    d = cap(d);
    if (d && !/[.!?…)"”’]$/.test(d)) d += '.';
    return d;
  }

  /**
   * Is this sentence a definition? Returns { term, aliases, def, strength } or null.
   * strength 3: glossary lines ("Term: …", "Term – …"), "… is defined as …", "… means …", "… refers to …"
   *          2: "… is a/an/the …", "… is called Term"
   *          1: any other "X is …"
   * opts.lineStart: the sentence begins its line (glossary patterns need that).
   */
  function findDefinition(text, opts) {
    const lineStart = !opts || opts.lineStart !== false;
    const t = String(text || '').trim();
    if (!t || /\?["'”’)]*$/.test(t)) return null;
    const body = t.replace(/[.!]+["'”’)]*$/, '').trim();
    let m;
    if (lineStart) {
      m = /^([^:=–—]{1,60}?)\s*(?::|=|\s[-–—]\s|\s?[–—]\s?)\s*(\S.{3,})$/.exec(body);
      if (m && !/\s[-–—]\s/.test(m[1])) {
        const parts = splitAcronym(cleanTerm(m[1]));
        if (termOk(parts.term, 5) && words(m[2]).length >= 2) return { term: parts.term, aliases: parts.aliases, def: m[2].trim(), strength: 3 };
      }
    }
    m = /^(.{2,70}?)\s+(?:is|are)\s+defined\s+as\s+(.{4,})$/i.exec(body)
      || /^(.{2,70}?)\s+(?:means|refers\s+to|is\s+(?:the\s+)?(?:term|word|name)\s+(?:for|given\s+to))\s+(.{4,})$/i.exec(body);
    if (m) {
      const parts = splitAcronym(cleanTerm(m[1]));
      if (termOk(parts.term, 5)) return { term: parts.term, aliases: parts.aliases, def: m[2].trim(), strength: 3 };
    }
    m = /^(.{12,}?)\s+(?:is|are)\s+(?:called|known\s+as|termed|named)\s+["“]?([^,;:"”]{2,50}?)["”]?$/i.exec(body);
    if (m) {
      const term = cleanTerm(m[2]);
      const lead = m[1].trim();
      if (termOk(term, 4) && words(lead).length >= 4 && !/^(?:it|this|that|they|these|those|he|she)\b/i.test(lead)) {
        // "When magma reaches the surface it is called lava": the clause only
        // makes sense as the whole sentence, so the whole sentence is the description.
        if (/^(?:when|if|once|after|as soon as|whenever)\b/i.test(lead) || /\b(?:it|they|this|these|that|those)$/i.test(lead)) {
          return { term, aliases: [], def: body, strength: 2 };
        }
        return { term, aliases: [], def: lead, strength: 2 };
      }
    }
    m = /^(.{2,60}?)\s+(?:is|are|was|were)\s+(.{6,})$/i.exec(body);
    if (m) {
      const parts = splitAcronym(cleanTerm(m[1]));
      const rest = m[2].trim().replace(/^:\s*/, '');
      if (termOk(parts.term, 5) && !REST_BAD.test(rest) && !PASSIVE_RE.test(rest) && words(rest).length >= 3) {
        const strong = /^(?:a|an|the|one|any|when|how|where)\b/i.test(rest) || DESCRIBES_RE.test(rest);
        return { term: parts.term, aliases: parts.aliases, def: rest, strength: strong ? 2 : 1 };
      }
    }
    return null;
  }

  /** Where in this sentence the term (or one of its other names) is written. */
  function findSpan(sentOrText, stemLists) {
    const toks = typeof sentOrText === 'string' ? tokenize(sentOrText) : sentOrText.toks;
    const text = typeof sentOrText === 'string' ? sentOrText : sentOrText.text;
    const st = typeof sentOrText === 'string' ? toks.map((t) => stem(t.w)) : sentOrText.stems;
    for (const target of stemLists) {
      if (!target.length) continue;
      const i = indexOfSeq(st, target, 0);
      if (i >= 0) {
        const start = toks[i].start;
        const end = toks[i + target.length - 1].end;
        return { start, end, surface: text.slice(start, end), count: countSeq(st, target) };
      }
    }
    return null;
  }
  function conceptStems(c) {
    return [c.stems].concat((c.aliases || []).map(termStems)).filter((s) => s && s.length);
  }
  /** Sentences that use the term or one of its other names. */
  function mentionsOf(corpus, probe) {
    const lists = conceptStems(probe);
    const hits = new Set();
    lists.forEach((target) => {
      const idx = corpus.stemIndex.get(target[0]);
      if (!idx) return;
      idx.forEach((i) => { if (!hits.has(i) && indexOfSeq(corpus.sentences[i].stems, target, 0) >= 0) hits.add(i); });
    });
    return Array.from(hits).sort((a, b) => a - b).map((i) => corpus.sentences[i]);
  }

  // Names in capitals, including ones with a title or "St." in them: "Mount St. Helens", "Dr. Jane Goodall".
  const CAPS_RE = /(^|[^\p{L}\p{N}'’])((?:(?:St|Mt|Ft|Dr|Mr|Mrs|Ms)\.|\p{Lu}[\p{Ll}'’-]*\p{Ll})(?:[ \t]+(?:(?:of|the|de|du|des|von|van|der|da|di|la|le|el|al|bin|ibn)[ \t]+)?(?:(?:St|Mt|Ft|Dr|Mr|Mrs|Ms|Jr|Sr)\.|\p{Lu}[\p{L}'’-]*))+)/gu;
  const ACRO_RE = /(^|[^\p{L}\p{N}])(\p{Lu}{2,6})s?(?![\p{L}\p{N}])/gu;
  const EXPLAIN_RE = /\b(?:because|cause[sd]?|lead(?:s|ing)? to|result(?:s|ing)? in|so that|therefore|which means|in order to|allows?|helps?|depends? on|produces?|converts?|when|if)\b/i;
  const EXAMPLE_RE = /\b(?:for example|for instance|e\.g\.|such as|an example|example of|examples? include|imagine|suppose|consider)\b/i;
  const WORKED_RE = /\d|=|\bstep\s*\d|\bfirst\b.+\bthen\b/i;
  const FOLLOW_RE = /^(?:it|this|these|they|that|its|their|such|so|therefore|thus|as a result|for example|for instance|e\.g\.|here|then)\b/i;

  /** The capitalised names in a sentence: "Robert Hooke", "Treaty of Versailles". */
  function capitalisedNames(sent) {
    const out = [];
    CAPS_RE.lastIndex = 0;
    let m;
    while ((m = CAPS_RE.exec(sent.text))) {
      const start = m.index + m[1].length;
      let parts = m[2].split(/[ \t]+/);
      if (start === 0 || /^["'“‘(]?$/.test(sent.text.slice(0, start).trim())) {
        while (parts.length && (STOP.has(parts[0].toLowerCase()) || QUESTION_WORDS.has(parts[0].toLowerCase()) || GENERIC.has(stem(parts[0])))) parts = parts.slice(1);
      } else {
        while (parts.length && GENERIC.has(stem(parts[0]))) parts = parts.slice(1);
      }
      while (parts.length && /^(?:of|the|de|du|des|von|van|der|da|di|la|le|el|al|bin|ibn)$/.test(parts[parts.length - 1])) parts.pop();
      const caps = parts.filter((p) => /^\p{Lu}/u.test(p));
      if (caps.length >= 2) out.push(parts.join(' '));
    }
    return out;
  }

  function capFirstIfLower(label) {
    return label === label.toLowerCase() ? cap(label) : label;
  }

  /** The best sentence to describe a term that the notes never define outright. */
  function describingSentence(mentions) {
    const ranked = mentions.filter((s) => s.wc >= 6 && s.wc <= 45 && !/\?["'”’)]*$/.test(s.text)).slice().sort((a, b) => {
      const sa = (FOLLOW_RE.test(a.text) ? -3 : 0) + (EXPLAIN_RE.test(a.text) ? 1 : 0) + (/\d/.test(a.text) ? 1 : 0) - Math.abs(a.wc - 18) / 10;
      const sb = (FOLLOW_RE.test(b.text) ? -3 : 0) + (EXPLAIN_RE.test(b.text) ? 1 : 0) + (/\d/.test(b.text) ? 1 : 0) - Math.abs(b.wc - 18) / 10;
      return sb - sa || a.order - b.order;
    });
    return ranked[0] || null;
  }

  /**
   * Key terms with definitions, in the order the notes introduce them.
   * Each: { id, term, surface, def, kind: 'definition'|'mention', aliases, ref, sentenceId, order }
   * 'mention' terms (bold or capitalised names the notes never define) carry
   * the sentence that best describes them instead of a definition.
   */
  function extractTerms(corpus, opts) {
    // Every clear definition is kept (up to `max`); weaker finds (a bare "X is …",
    // a name the notes never define) fill in up to about one per six sentences.
    const max = (opts && opts.max) || 150;
    const extra = (opts && opts.extra) || Math.max(6, Math.round(corpus.N / 6));
    const cands = new Map();
    const get = (label) => {
      const clean = cleanTerm(label);
      const stems = termStems(clean);
      if (!stems.length) return null;
      const key = stems.join(' ');
      let c = cands.get(key);
      if (!c) {
        c = { key, stems, label: clean, def: null, bold: 0, caps: 0, acro: 0, aliases: new Set() };
        cands.set(key, c);
      }
      return c;
    };
    corpus.sentences.forEach((s) => {
      const d = findDefinition(s.text, { lineStart: s.lineStart });
      if (!d) return;
      const c = get(d.term);
      if (!c) return;
      if (!c.def || d.strength > c.def.strength) {
        c.def = { text: d.def, sentence: s, strength: d.strength };
        c.label = cleanTerm(d.term);
      }
      (d.aliases || []).forEach((a) => { if (termOk(a, 5)) c.aliases.add(a); });
    });
    corpus.bold.forEach((b) => {
      const label = cleanTerm(b);
      if (termOk(label, 6)) { const c = get(label); if (c) { c.bold++; if (!c.def) c.label = label; } }
    });
    corpus.sentences.forEach((s) => {
      capitalisedNames(s).forEach((name) => {
        if (!termOk(name, 6)) return;
        const c = get(name);
        if (c) { c.caps++; if (!c.def && !c.bold) c.label = name; }
      });
      ACRO_RE.lastIndex = 0;
      let m;
      while ((m = ACRO_RE.exec(s.text))) {
        const a = m[2];
        if (/^[IVXLCDM]+$/.test(a) || STOP.has(a.toLowerCase()) || GENERIC.has(stem(a))) continue;
        const c = get(a);
        if (c) { c.acro++; if (!c.def) c.label = a; }
      }
    });

    const list = [];
    cands.forEach((c) => {
      if (c.stems.every((st) => STOP.has(st))) return;
      if (c.stems.length === 1 && GENERIC.has(c.stems[0])) return;
      const probe = { stems: c.stems, aliases: Array.from(c.aliases) };
      const mentions = mentionsOf(corpus, probe);
      let keep = false;
      if (c.def && c.def.strength >= 2) keep = true;
      else if (c.def && c.stems.length <= 3 && (c.bold || c.caps || c.acro >= 2 || mentions.length >= 2)) keep = true;
      else if (c.bold && mentions.length) keep = true;
      else if (c.caps && mentions.length) keep = true;
      else if (c.acro >= 2) keep = true;
      if (!keep) return;
      // Other names the notes give: "X, also called Y" / "X (ABC)".
      mentions.forEach((s) => {
        const span = findSpan(s, [c.stems]);
        if (!span) return;
        const after = s.text.slice(span.end);
        let m = /^,?\s+(?:also\s+(?:called|known\s+as)|or\s+simply)\s+["“]?([\p{L}][\p{L}\p{N}-]*(?:\s+[\p{L}\p{N}-]+){0,2})/iu.exec(after);
        if (m && termOk(cleanTerm(m[1]), 3)) c.aliases.add(cleanTerm(m[1]));
        m = /^\s*\(([\p{Lu}][\p{Lu}\p{N}]{1,7}s?)\)/u.exec(after);
        if (m) c.aliases.add(m[1]);
      });
      let sentence = c.def ? c.def.sentence : describingSentence(mentions);
      if (!sentence) return;
      const label = capFirstIfLower(c.label);
      const span = findSpan(sentence, [c.stems]);
      const surface = span ? span.surface : c.label;
      const score = (c.def ? 3 + c.def.strength * 2 : 0) + c.bold * 2 + (c.caps ? 1 : 0) + Math.min(mentions.length, 6) * 0.5;
      list.push({
        id: 't' + hashText(c.key),
        key: c.key,
        term: label.slice(0, LIMITS.term),
        surface,
        def: c.def ? tidyDef(c.def.text) : sentence.text,
        kind: c.def ? 'definition' : 'mention',
        aliases: Array.from(c.aliases).filter((a) => norm(a) !== norm(label)).slice(0, 6),
        ref: copyRef(sentence.ref),
        sentenceId: sentence.id,
        order: c.def ? sentence.order : (mentions[0] ? mentions[0].order : sentence.order),
        score,
        strength: c.def ? c.def.strength : 0,
        stems: c.stems,
        mentionCount: mentions.length,
      });
    });
    // A shorter name inside a longer one with the same sentences ("Hooke" in "Robert Hooke") is not a new term.
    list.sort((a, b) => b.score - a.score || a.order - b.order);
    const kept = [];
    const usedDefSentence = new Set();
    list.forEach((t) => {
      if (t.kind === 'definition' && usedDefSentence.has(t.sentenceId)) return;
      // ("Triple Alliance" is still its own term beside "Alliances": it is the longer, more exact name.)
      const redundant = t.kind === 'mention' && kept.some((k) => indexOfSeq(k.stems, t.stems, 0) >= 0);
      if (redundant) return;
      if (t.kind === 'definition') usedDefSentence.add(t.sentenceId);
      kept.push(t);
    });
    let weak = 0;
    const chosen = kept.filter((t) => {
      if (t.kind === 'definition' && t.strength >= 2) return true;
      weak++;
      return weak <= extra;
    });
    return chosen.slice(0, max).sort((a, b) => a.order - b.order).map((t) => {
      delete t.score; delete t.stems; delete t.mentionCount; delete t.strength;
      return t;
    });
  }

  /* ── Key facts ──────────────────────────────────────────────────────── */

  const YEAR_RE = /\b(?:1[0-9]{3}|20[0-9]{2})s?\b|\b\d{1,4}\s?(?:BC|BCE|AD|CE)\b|\b(?:\d{1,2}(?:st|nd|rd|th)|[a-z]+)\s+century\b/i;
  const MONTH_RE = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/;
  const NUMBER_RE = /\d|\b(?:half|twice|double|triple|percent|million|billion|thousand|hundred|dozen)\b/i;
  const CAUSE_RE = /\b(?:because|due to|caus(?:e|es|ed|ing)|lead(?:s|ing)? to|led to|result(?:s|ed|ing)? in|as a result|therefore|so that|consequently|which means|thus|in order to|increas(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|reduc(?:e|es|ed|ing)|prevent(?:s|ed|ing)?|trigger(?:s|ed)?)\b/i;

  function factTags(text) {
    const tags = [];
    if (YEAR_RE.test(text) || MONTH_RE.test(text)) tags.push('date');
    else if (NUMBER_RE.test(text)) tags.push('number');
    if (CAUSE_RE.test(text)) tags.push('cause');
    return tags;
  }

  /** Sentences that carry a date, a number, or a cause and its effect. */
  function extractFacts(corpus, terms, opts) {
    const max = (opts && opts.max) || Math.max(5, Math.min(80, Math.round(corpus.N / 5)));
    const defIds = new Set((terms || []).filter((t) => t.kind === 'definition').map((t) => t.sentenceId));
    const termStemLists = (terms || []).map((t) => termStems(t.term)).filter((s) => s.length);
    const scored = [];
    corpus.sentences.forEach((s) => {
      if (defIds.has(s.id) || s.wc < 5 || s.wc > 50 || /\?["'”’)]*$/.test(s.text)) return;
      const tags = factTags(s.text);
      if (!tags.length) return;
      // A list number ("1.") or a page number is not a fact.
      if (tags.length === 1 && tags[0] === 'number' && !/\d.*\p{L}|\p{L}.*\d/u.test(s.text.replace(/^\d+[.)]\s*/, ''))) return;
      let score = (tags.includes('date') ? 3 : 0) + (tags.includes('number') ? 2 : 0) + (tags.includes('cause') ? 2 : 0);
      termStemLists.forEach((ts) => { if (indexOfSeq(s.stems, ts, 0) >= 0) score += 0.6; });
      if (FOLLOW_RE.test(s.text)) score -= 1;
      score -= Math.abs(s.wc - 18) / 25;
      scored.push({ s, tags, score });
    });
    scored.sort((a, b) => b.score - a.score || a.s.order - b.s.order);
    return scored.slice(0, max).sort((a, b) => a.s.order - b.s.order).map((x) => ({
      id: 'f' + hashText(norm(x.s.text)),
      text: x.s.text,
      tags: x.tags,
      ref: copyRef(x.s.ref),
      sentenceId: x.s.id,
      order: x.s.order,
    }));
  }

  /* ── Outline and summaries ──────────────────────────────────────────── */

  /** The top sentences of a section: the ones that share the most of its important words. */
  function summarizeSection(corpus, section) {
    const sents = section.sentenceIds.map((id) => corpus.byId[id]).filter((s) => s && s.wc >= 5 && !/\?["'”’)]*$/.test(s.text));
    if (sents.length < 2) return sents.slice(0, 1).map(passage);
    const tf = new Map();
    sents.forEach((s) => s.stems.forEach((st, i) => {
      if (!isContent(s.toks[i].w)) return;
      tf.set(st, (tf.get(st) || 0) + 1);
    }));
    const k = sents.length < 6 ? 1 : sents.length < 15 ? 2 : 3;
    const scored = sents.map((s, i) => {
      let score = 0;
      const seen = new Set();
      s.stems.forEach((st, j) => {
        if (seen.has(st) || !isContent(s.toks[j].w)) return;
        seen.add(st);
        score += Math.log(1 + (tf.get(st) || 0)) * Math.max(0.1, idf(corpus, st));
      });
      score = score / Math.sqrt(Math.max(6, s.wc));
      if (i === 0) score *= 1.25;
      if (findDefinition(s.text, { lineStart: s.lineStart })) score *= 1.15;
      if (FOLLOW_RE.test(s.text)) score *= 0.7;
      return { s, score };
    });
    scored.sort((a, b) => b.score - a.score || a.s.order - b.s.order);
    return scored.slice(0, k).sort((a, b) => a.s.order - b.s.order).map((x) => passage(x.s));
  }

  /**
   * The outline: one entry per heading (or per file when a file has none),
   * each with a short summary of its top sentences.
   */
  function buildOutline(corpus) {
    const out = [];
    corpus.sections.forEach((sec) => {
      if (sec.level === 0 && !sec.paraIds.length) return;
      out.push({
        id: 'o' + hashText(sec.id + '|' + sec.title),
        sectionId: sec.id,
        title: sec.title.slice(0, 200),
        level: sec.level === 0 ? 1 : Math.min(sec.level, 4),
        ref: copyRef(sec.ref),
        sentences: sec.sentenceIds.length,
        summary: sec.sentenceIds.length ? summarizeSection(corpus, sec) : [],
      });
    });
    return out;
  }

  function sourcesHash(sources) {
    return hashText((sources || []).map((s) => (s.name || '') + '\u0001' + (s.text || '')).join('\u0002'));
  }

  /** The automatic study guide for a set of sources. */
  function buildGuide(sources, opts) {
    const corpus = opts && opts.corpus ? opts.corpus : buildCorpus(sources);
    const terms = extractTerms(corpus);
    const facts = extractFacts(corpus, terms);
    return {
      builtAt: (opts && opts.now) || new Date().toISOString(),
      hash: sourcesHash(sources),
      outline: buildOutline(corpus),
      terms,
      facts,
      removed: [],
    };
  }

  /**
   * Rebuilt from changed notes, a guide keeps the student's work: terms and
   * facts they edited or added stay, and ones they deleted do not come back.
   */
  function mergeGuide(prev, fresh) {
    if (!prev) return fresh;
    const removed = new Set(prev.removed || []);
    const merge = (oldList, newList) => {
      const prevById = new Map((oldList || []).map((x) => [x.id, x]));
      const out = [];
      const seen = new Set();
      (newList || []).forEach((x) => {
        if (removed.has(x.id)) return;
        const p = prevById.get(x.id);
        out.push(p && p.edited ? p : x);
        seen.add(x.id);
      });
      (oldList || []).forEach((x) => {
        if (seen.has(x.id) || removed.has(x.id)) return;
        if (x.kind === 'user' || x.edited) out.push(x);
      });
      return out;
    };
    return Object.assign({}, fresh, {
      terms: merge(prev.terms, fresh.terms),
      facts: merge(prev.facts, fresh.facts),
      removed: Array.from(removed).slice(-LIMITS.removed),
    });
  }

  /* Editing the guide. Each returns what the UI needs to undo. */
  function guideList(guide, what) { return what === 'facts' ? guide.facts : guide.terms; }
  function addTerm(guide, term, def) {
    const t = String(term || '').trim().slice(0, LIMITS.term);
    const d = String(def || '').trim().slice(0, LIMITS.def);
    if (!t || !d) return null;
    const item = { id: uid('u'), term: t, surface: t, def: d, kind: 'user', aliases: [], ref: null, sentenceId: '', order: 1e9, edited: true };
    guide.terms.push(item);
    return item;
  }
  function addFact(guide, text) {
    const t = String(text || '').trim().slice(0, LIMITS.fact);
    if (!t) return null;
    const item = { id: uid('u'), text: t, tags: factTags(t), ref: null, sentenceId: '', order: 1e9, kind: 'user', edited: true };
    guide.facts.push(item);
    return item;
  }
  function editItem(guide, what, id, patch) {
    const item = guideList(guide, what).find((x) => x.id === id);
    if (!item) return null;
    const before = JSON.parse(JSON.stringify(item));
    if (what === 'terms') {
      if (typeof patch.term === 'string' && patch.term.trim()) { item.term = patch.term.trim().slice(0, LIMITS.term); item.surface = item.term; }
      if (typeof patch.def === 'string' && patch.def.trim()) item.def = patch.def.trim().slice(0, LIMITS.def);
    } else if (typeof patch.text === 'string' && patch.text.trim()) {
      item.text = patch.text.trim().slice(0, LIMITS.fact);
      item.tags = factTags(item.text);
    }
    if (JSON.stringify(before) !== JSON.stringify(item)) item.edited = true;
    return before;
  }
  function removeItem(guide, what, id) {
    const list = guideList(guide, what);
    const index = list.findIndex((x) => x.id === id);
    if (index < 0) return null;
    const item = list.splice(index, 1)[0];
    if (item.kind !== 'user') guide.removed = (guide.removed || []).concat(item.id).slice(-LIMITS.removed);
    return { item, index };
  }
  function restoreItem(guide, what, removed) {
    if (!removed || !removed.item) return;
    const list = guideList(guide, what);
    if (list.some((x) => x.id === removed.item.id)) return;
    list.splice(Math.min(removed.index, list.length), 0, removed.item);
    guide.removed = (guide.removed || []).filter((id) => id !== removed.item.id);
  }

  /* ── Concepts: the guide's terms, linked to the notes ───────────────── */

  /**
   * What Learn, the tests and the cards work from: each key term with its
   * definition and every sentence in the notes that uses it.
   */
  function conceptsFromGuide(corpus, guide) {
    return ((guide && guide.terms) || []).filter((t) => t && t.term && t.def).map((t) => {
      const stems = termStems(t.term);
      const aliases = (t.aliases || []).filter((a) => a && norm(a) !== norm(t.term));
      if (t.surface && norm(t.surface) !== norm(t.term)) aliases.push(t.surface);
      const mentions = stems.length ? mentionsOf(corpus, { stems, aliases }).map((s) => s.id) : [];
      const sent = t.sentenceId ? corpus.byId[t.sentenceId] : null;
      const fromNotes = !!sent && !t.edited;
      return {
        id: t.id,
        label: t.term,
        surface: t.surface || t.term,
        stems,
        aliases,
        kind: t.kind,
        def: t.def,
        definition: {
          text: t.def,
          full: fromNotes ? sent.text : t.def,
          sentenceId: fromNotes ? sent.id : '',
          ref: fromNotes ? copyRef(sent.ref) : { source: 'Your study guide', edited: true },
        },
        mentions,
        sectionId: sent ? sent.sectionId : '',
        order: sent ? sent.order : 1e9,
      };
    });
  }
  /**
   * The parts of the notes (one per heading) with the terms that belong to
   * each, for "pick topics". Terms the student added go in a last group.
   * Returns [{ id, title, level, ref, conceptIds }], in the notes' order.
   */
  function topicsFor(corpus, concepts) {
    const bySection = new Map();
    const own = [];
    (concepts || []).forEach((c) => {
      if (c.sectionId && corpus.sectionById[c.sectionId]) {
        if (!bySection.has(c.sectionId)) bySection.set(c.sectionId, []);
        bySection.get(c.sectionId).push(c.id);
      } else own.push(c.id);
    });
    const out = [];
    corpus.sections.forEach((sec) => {
      const ids = bySection.get(sec.id);
      if (ids && ids.length) out.push({ id: sec.id, title: sec.title, level: sec.level || 1, ref: copyRef(sec.ref), conceptIds: ids });
    });
    if (own.length) out.push({ id: '', title: 'Terms you added', level: 1, ref: null, conceptIds: own });
    return out;
  }
  function sentencesOf(corpus, ids) {
    return (ids || []).map((id) => corpus.byId[id]).filter(Boolean);
  }
  function defPassage(corpus, c) {
    const s = c.definition.sentenceId ? corpus.byId[c.definition.sentenceId] : null;
    if (s) return passage(s);
    return { text: c.definition.full, ref: c.definition.ref, sentenceId: '' };
  }

  /* ── Questions ──────────────────────────────────────────────────────── */

  function blankRegexSafe(text) { return String(text || ''); }
  function maskTerm(text, concept) {
    let out = String(text || '');
    const lists = conceptStems(concept);
    for (let guard = 0; guard < 8; guard++) {
      const span = findSpan(out, lists);
      if (!span) break;
      out = out.slice(0, span.start) + '_____' + out.slice(span.end);
    }
    return out;
  }
  /** The description of a term with the term itself hidden. */
  function cluePhrase(c) {
    const masked = maskTerm(c.definition.text, c);
    return cap(masked);
  }
  function clueOk(text) {
    return words(String(text || '').replace(/_+/g, ' ')).filter((w) => !STOP.has(w)).length >= 2;
  }
  function acceptFor(c, surface) {
    return Array.from(new Set([surface, c.label, c.surface].concat(c.aliases || []).filter(Boolean)));
  }
  /** Other terms in the notes that share a word with this one or are spelled nearly the same. */
  function rivalsFor(c, pool) {
    const mine = new Set(c.stems);
    const label = norm(c.label);
    const out = [];
    (pool || []).forEach((o) => {
      if (o.id === c.id || out.length >= 8) return;
      const name = norm(o.label);
      if (!name || name === label) return;
      if (o.stems.some((st) => mine.has(st)) || osa(name, label) <= 3) out.push(o.label);
    });
    return out;
  }
  /** How many times the term or any of its other names appears in a sentence. */
  function occurrences(sent, lists) {
    return lists.reduce((n, l) => n + countSeq(sent.stems, l), 0);
  }
  function goodLength(s) { return s.wc >= 6 && s.wc <= 40; }
  function inlineLabel(other, atStart, surfaceWas) {
    let label = other.surface || other.label;
    if (atStart) return cap(label);
    if (/^\p{Lu}/u.test(label) && !/^\p{Lu}/u.test(surfaceWas || '') && label.slice(1) === label.slice(1).toLowerCase()) {
      label = label.charAt(0).toLowerCase() + label.slice(1);
    }
    return label;
  }
  function others(c, pool) {
    return (pool || []).filter((o) => o.id !== c.id && norm(o.label) !== norm(c.label)
      && indexOfSeq(o.stems, c.stems, 0) < 0 && indexOfSeq(c.stems, o.stems, 0) < 0);
  }
  /** Distractors that look like the answer: same part of the notes and kind first. */
  function rankDistractors(c, list, rnd) {
    return shuffle(list, rnd).sort((a, b) => {
      const sa = (a.sectionId && a.sectionId === c.sectionId ? 2 : 0) + (a.kind === c.kind ? 1 : 0) - Math.abs(a.stems.length - c.stems.length) * 0.5;
      const sb = (b.sectionId && b.sectionId === c.sectionId ? 2 : 0) + (b.kind === c.kind ? 1 : 0) - Math.abs(b.stems.length - c.stems.length) * 0.5;
      return sb - sa;
    });
  }
  function base(type, c, prompt, source) {
    return { id: '', type, conceptId: c ? c.id : '', concept: c ? c.label : '', prompt, source };
  }

  /** Fill the blank in a sentence from the notes. */
  function makeCloze(corpus, c, pool, rnd, avoid) {
    const lists = conceptStems(c);
    const ranked = sentencesOf(corpus, c.mentions).filter((s) => goodLength(s) && !(avoid && avoid.has(s.id)))
      .map((s) => ({ s, span: findSpan(s, lists) }))
      // Only sentences that name the term once: an "ATP (adenosine triphosphate)" sentence would give it away.
      .filter((x) => x.span && occurrences(x.s, lists) === 1 && words(x.s.text).length - words(x.span.surface).length >= 4)
      .sort((a, b) => Math.abs(a.s.wc - 16) - Math.abs(b.s.wc - 16) || a.s.order - b.s.order);
    if (!ranked.length) return null;
    const pick = ranked[Math.floor((rnd ? rnd() : 0) * Math.min(3, ranked.length))];
    const q = base('cloze', c, words(pick.span.surface).length > 1 ? 'Fill in the missing words' : 'Fill in the missing word', passage(pick.s));
    q.before = pick.s.text.slice(0, pick.span.start);
    q.after = pick.s.text.slice(pick.span.end);
    q.answer = pick.span.surface;
    q.accept = acceptFor(c, pick.span.surface);
    q.others = rivalsFor(c, pool);
    return q;
  }

  /** Type the term the description belongs to. */
  function makeWritten(corpus, c, pool) {
    const clue = cluePhrase(c);
    if (!clueOk(clue)) return null;
    const q = base('written', c, 'Type the term from your notes that matches this', defPassage(corpus, c));
    q.stem = clue;
    q.answer = c.label;
    q.accept = acceptFor(c, c.surface);
    q.others = rivalsFor(c, pool);
    return q;
  }

  /** Which term matches this description? */
  function makeChoice(corpus, c, pool, rnd) {
    const clue = cluePhrase(c);
    if (!clueOk(clue)) return null;
    const distract = rankDistractors(c, others(c, pool), rnd);
    if (distract.length < 2) return null;
    const opts = [c.label];
    distract.forEach((o) => { if (opts.length < 4 && !opts.some((x) => norm(x) === norm(o.label))) opts.push(o.label); });
    if (opts.length < 3) return null;
    const q = base('mc', c, 'Which term from your notes matches this description?', defPassage(corpus, c));
    q.stem = clue;
    q.options = shuffle(opts, rnd);
    q.answer = c.label;
    return q;
  }

  function shortDef(o) {
    const d = cluePhrase(o);
    return d.length > 240 ? d.slice(0, 237).replace(/\s+\S*$/, '') + '…' : d;
  }
  /** Which description matches this term? */
  function makeDefChoice(corpus, c, pool, rnd) {
    const right = shortDef(c);
    if (!clueOk(right)) return null;
    const distract = rankDistractors(c, others(c, pool), rnd).filter((o) => clueOk(shortDef(o)));
    if (distract.length < 2) return null;
    const opts = [right];
    distract.forEach((o) => { const d = shortDef(o); if (opts.length < 4 && !opts.some((x) => norm(x) === norm(d))) opts.push(d); });
    if (opts.length < 3) return null;
    const q = base('mcdef', c, 'Which description matches “' + c.label + '” in your notes?', defPassage(corpus, c));
    q.stem = c.label;
    q.options = shuffle(opts, rnd);
    q.answer = right;
    return q;
  }

  /**
   * True or false. A false statement is a sentence from the notes with this
   * term swapped for another key term (or a term paired with another term's
   * definition); the feedback shows what the notes really say.
   */
  function makeTrueFalse(corpus, c, pool, rnd, avoid, forceTruth) {
    const r = rnd || Math.random;
    const lists = conceptStems(c);
    if (!corpus.knownText) corpus.knownText = new Set(corpus.sentences.map((s) => norm(s.text)));
    const known = corpus.knownText;
    const swaps = shuffle(others(c, pool), r);
    const wantFalse = forceTruth == null ? r() < 0.5 : !forceTruth;
    const cand = sentencesOf(corpus, c.mentions).filter((s) => s.wc >= 6 && s.wc <= 35 && !(avoid && avoid.has(s.id)))
      .map((s) => ({ s, span: findSpan(s, lists) }))
      .filter((x) => x.span && occurrences(x.s, lists) === 1)
      .sort((a, b) => Math.abs(a.s.wc - 14) - Math.abs(b.s.wc - 14) || a.s.order - b.s.order);
    if (cand.length) {
      const pick = cand[Math.floor(r() * Math.min(3, cand.length))];
      if (wantFalse) {
        for (const other of swaps) {
          if (conceptStems(other).some((t) => indexOfSeq(pick.s.stems, t, 0) >= 0)) continue;
          const label = inlineLabel(other, pick.span.start === 0, pick.span.surface);
          const statement = pick.s.text.slice(0, pick.span.start) + label + pick.s.text.slice(pick.span.end);
          if (known.has(norm(statement))) continue;
          const q = base('tf', c, 'True or false, according to your notes?', passage(pick.s));
          q.statement = statement;
          q.answer = 'false';
          q.note = 'Your notes say “' + pick.span.surface + '” here, not “' + label + '”.';
          q.swapped = other.id;
          return q;
        }
      }
      const q = base('tf', c, 'True or false, according to your notes?', passage(pick.s));
      q.statement = pick.s.text;
      q.answer = 'true';
      q.note = 'This is what your notes say.';
      return q;
    }
    // No sentence to use: pair the term with its own definition or another term's.
    const right = shortDef(c);
    if (!clueOk(right)) return null;
    if (wantFalse) {
      const other = swaps.find((o) => clueOk(shortDef(o)) && norm(shortDef(o)) !== norm(right));
      if (other) {
        const q = base('tf', c, 'True or false, according to your notes?', defPassage(corpus, c));
        q.statement = c.label + ': ' + shortDef(other);
        q.answer = 'false';
        q.note = 'In your notes that describes “' + other.label + '”, not “' + c.label + '”.';
        q.swapped = other.id;
        return q;
      }
    }
    const q = base('tf', c, 'True or false, according to your notes?', defPassage(corpus, c));
    q.statement = c.label + ': ' + right;
    q.answer = 'true';
    q.note = 'This is how your study guide describes it.';
    return q;
  }

  /** Match three or four terms to their descriptions. */
  function makeMatch(corpus, list, rnd) {
    const picked = [];
    (list || []).forEach((c) => {
      if (picked.length >= 4) return;
      const d = shortDef(c);
      if (!clueOk(d)) return;
      if (picked.some((p) => norm(p.term) === norm(c.label) || norm(p.def) === norm(d)
        || indexOfSeq(p.stems, c.stems, 0) >= 0 || indexOfSeq(c.stems, p.stems, 0) >= 0)) return;
      picked.push({ conceptId: c.id, term: c.label, def: d, stems: c.stems });
    });
    if (picked.length < 3) return null;
    const q = base('match', null, 'Match each description to its term', null);
    q.pairs = shuffle(picked, rnd).map((p) => ({ conceptId: p.conceptId, term: p.term, def: p.def }));
    q.options = shuffle(picked.map((p) => p.term), rnd);
    q.conceptIds = picked.map((p) => p.conceptId);
    q.sources = picked.map((p) => { const c = list.find((x) => x.id === p.conceptId); return defPassage(corpus, c); });
    return q;
  }

  const TYPES_BY_LEVEL = [
    ['mc', 'tf', 'mcdef', 'cloze', 'written'],
    ['mcdef', 'tf', 'cloze', 'mc', 'written'],
    ['cloze', 'written', 'mcdef', 'tf', 'mc'],
    ['written', 'cloze', 'mcdef', 'tf', 'mc'],
    ['written', 'cloze', 'tf', 'mcdef', 'mc'],
  ];
  function typesForLevel(level) {
    return TYPES_BY_LEVEL[clampInt(level, 0, MAX_LEVEL, 0)].slice();
  }
  /** A question of the wanted type, or the next type that this term can support. */
  function questionFor(corpus, c, pool, wanted, rnd, avoid) {
    const order = [wanted].concat(['mc', 'tf', 'mcdef', 'cloze', 'written'].filter((t) => t !== wanted));
    for (const type of order) {
      let q = null;
      if (type === 'mc') q = makeChoice(corpus, c, pool, rnd);
      else if (type === 'mcdef') q = makeDefChoice(corpus, c, pool, rnd);
      else if (type === 'tf') q = makeTrueFalse(corpus, c, pool, rnd, avoid);
      else if (type === 'cloze') q = makeCloze(corpus, c, pool, rnd, avoid);
      else if (type === 'written') q = makeWritten(corpus, c, pool);
      if (q) return q;
    }
    return null;
  }

  /* ── Checking answers ───────────────────────────────────────────────── */

  function contentStems(text) {
    return tokenize(text).map((t) => t.w).filter((w) => !ARTICLES.has(w)).map(stem);
  }
  function answerWords(text) {
    return norm(text).split(' ').filter((w) => w && !ARTICLES.has(w));
  }
  /**
   * How many spelling slips separate an answer from the expected one, or
   * Infinity when it is not a slip at all. Each word may be one letter out
   * (two for words of 12+ letters), at most two slips in all, numbers must be
   * exact, and the words must line up: "anaerobic" is not a slip for
   * "aerobic", and "1915" is not a slip for "1914".
   */
  function slips(given, expected) {
    const g = answerWords(given);
    const a = answerWords(expected);
    if (!g.length || !a.length) return Infinity;
    if (g.length !== a.length) return g.join('') === a.join('') ? 1 : Infinity;
    let total = 0;
    for (let i = 0; i < a.length; i++) {
      if (g[i] === a[i] || stem(g[i]) === stem(a[i])) continue;
      if (/\d/.test(a[i]) || /\d/.test(g[i])) return Infinity;
      const allow = a[i].length >= 12 ? 2 : a[i].length >= 5 ? 1 : 0;
      const d = osa(g[i], a[i]);
      if (d > allow) return Infinity;
      total += d;
    }
    return total <= 2 ? total : Infinity;
  }
  function sameAnswer(given, alt) {
    const a = norm(alt);
    if (!a) return false;
    if (norm(given) === a) return true;
    const gs = contentStems(given).join(' ');
    return !!gs && gs === contentStems(alt).join(' ');
  }
  /**
   * accepted: the answer and its other names. others: other terms from the
   * same notes that look or sound alike, so that naming a different term is
   * never passed as a spelling slip or as part of the answer.
   */
  function checkTerm(given, accepted, others) {
    const rivals = (others || []).filter((o) => o && !accepted.some((a) => norm(a) === norm(o)));
    if (accepted.some((alt) => sameAnswer(given, alt))) return { verdict: 'correct', score: 1 };
    const rival = rivals.find((o) => sameAnswer(given, o));
    if (rival) return { verdict: 'incorrect', score: 0, note: '“' + rival.trim() + '” is a different term in your notes.' };
    let best = null;
    accepted.forEach((alt) => {
      const d = slips(given, alt);
      if (d < Infinity && (!best || d < best.d)) best = { d, alt };
    });
    const nearest = rivals.reduce((m, o) => Math.min(m, slips(given, o)), Infinity);
    if (best && best.d < nearest) return { verdict: 'close', score: 1, note: 'Check the spelling: ' + best.alt.trim() };
    if (nearest < Infinity) return { verdict: 'incorrect', score: 0 };
    const main = accepted[0] || '';
    const want = contentStems(main).filter((st) => !STOP.has(st));
    if (want.length > 1) {
      const have = new Set(contentStems(given));
      const hit = want.filter((st) => have.has(st)).length;
      if (hit) return { verdict: 'partial', score: Math.round(hit / want.length * 100) / 100, note: 'Part of it: the full answer is “' + main.trim() + '”.' };
    }
    return { verdict: 'incorrect', score: 0 };
  }

  /**
   * Check an answer by rules. Returns
   *   { verdict: 'correct'|'close'|'partial'|'incorrect'|'empty', score 0–1, note?, perConcept? }
   * 'close' counts as right (a spelling slip). For matching, `given` is
   * { conceptId: chosen term } and perConcept says which pairs were right.
   */
  function checkAnswer(q, given) {
    const question = q || {};
    if (question.type === 'match') {
      const g = plainObject(given) ? given : {};
      const perConcept = {};
      let right = 0;
      let answered = 0;
      (question.pairs || []).forEach((p) => {
        const v = typeof g[p.conceptId] === 'string' ? g[p.conceptId] : '';
        if (v) answered++;
        const ok = !!v && norm(v) === norm(p.term);
        perConcept[p.conceptId] = ok;
        if (ok) right++;
      });
      const total = (question.pairs || []).length || 1;
      if (!answered) return { verdict: 'empty', score: 0, perConcept };
      return { verdict: right === total ? 'correct' : right ? 'partial' : 'incorrect', score: Math.round(right / total * 100) / 100, perConcept, right, total };
    }
    const g = String(given == null ? '' : given).trim();
    if (!g) return { verdict: 'empty', score: 0 };
    if (question.type === 'mc' || question.type === 'mcdef') {
      return g === question.answer || norm(g) === norm(question.answer) ? { verdict: 'correct', score: 1 } : { verdict: 'incorrect', score: 0 };
    }
    if (question.type === 'tf') {
      const v = norm(g);
      const said = v === 'true' || v === 't' || v === 'yes' ? 'true' : v === 'false' || v === 'f' || v === 'no' ? 'false' : '';
      return said && said === question.answer ? { verdict: 'correct', score: 1 } : { verdict: 'incorrect', score: 0 };
    }
    if (question.type === 'cloze' || question.type === 'written') {
      return checkTerm(g, [question.answer].concat(question.accept || []).filter(Boolean), question.others);
    }
    return { verdict: 'incorrect', score: 0 };
  }
  function isRight(verdict) { return verdict === 'correct' || verdict === 'close'; }
  /** The answer, written out, for feedback and reviews. */
  function answerText(q) {
    if (!q) return '';
    if (q.type === 'tf') return q.answer === 'true' ? 'True' : 'False';
    if (q.type === 'match') return (q.pairs || []).map((p) => p.term + ' — ' + p.def).join('\n');
    return q.answer || '';
  }

  /* ── Mastery ────────────────────────────────────────────────────────── */

  function newMastery() {
    return { level: 0, seen: 0, right: 0, wrong: 0, streak: 0, lastAt: '' };
  }
  /**
   * One answer's effect on a term: right moves it up a level, wrong moves it
   * down (two levels from mastered, so a forgotten term really comes back).
   */
  function applyResult(m0, verdict, nowIso) {
    const m = Object.assign(newMastery(), m0 || {});
    if (verdict === 'skipped' || verdict === 'empty' || !verdict) return m;
    m.seen++;
    m.lastAt = nowIso || new Date().toISOString();
    if (isRight(verdict)) {
      m.right++;
      m.streak++;
      m.level = Math.min(MAX_LEVEL, m.level + 1);
    } else if (verdict === 'partial') {
      m.streak = 0;
    } else {
      m.wrong++;
      m.streak = 0;
      m.level = Math.max(0, m.level - (m.level >= MASTERED ? 2 : 1));
    }
    return m;
  }
  function statusOf(m) {
    if (!m || !m.seen) return 'new';
    if (m.level >= MASTERED) return 'mastered';
    if (m.wrong > m.right && m.level < 2) return 'weak';
    return 'learning';
  }
  /** Bigger is weaker: what Learn, tests and the plan bring back most. */
  function weakness(m) {
    if (!m || !m.seen) return 2.5;
    return (MAX_LEVEL - m.level) + m.wrong * 0.6 - m.right * 0.15;
  }
  function masterySummary(concepts, mastery) {
    const out = { total: 0, mastered: 0, learning: 0, weak: 0, fresh: 0, percent: 0 };
    let sum = 0;
    (concepts || []).forEach((c) => {
      const id = c.id || c;
      const m = mastery && mastery[id];
      out.total++;
      const st = statusOf(m);
      if (st === 'mastered') out.mastered++;
      else if (st === 'weak') out.weak++;
      else if (st === 'learning') out.learning++;
      else out.fresh++;
      sum += m ? Math.min(m.level, MASTERED) / MASTERED : 0;
    });
    out.percent = out.total ? Math.round(sum / out.total * 100) : 0;
    return out;
  }

  /* ── Learn ──────────────────────────────────────────────────────────── */

  /** A sentence plus the next one when it carries the same idea on ("This…", "For example…"). */
  function withContext(corpus, sent, maxWords) {
    const para = corpus.paraById[sent.paraId];
    const out = [sent];
    if (!para) return out;
    const i = para.sentences.indexOf(sent);
    const next = para.sentences[i + 1];
    if (next && sent.wc + next.wc <= (maxWords || 60) && FOLLOW_RE.test(next.text)) out.push(next);
    return out;
  }
  /** What the notes say about a term: its definition and the sentence that carries it on. */
  function explanationFor(corpus, c) {
    const s = c.definition.sentenceId ? corpus.byId[c.definition.sentenceId] : null;
    if (s) return withContext(corpus, s, 60).map(passage);
    const out = [{ text: c.definition.full, ref: c.definition.ref, sentenceId: '' }];
    const first = sentencesOf(corpus, c.mentions).filter((x) => x.wc >= 6)[0];
    if (first && norm(first.text) !== norm(c.definition.full)) out.push(passage(first));
    return out;
  }

  /** A short quick check (3–5 questions) on the chosen terms. */
  function buildCheck(corpus, chosen, pool, rnd) {
    const out = [];
    if (!chosen.length) return out;
    const used = new Set();
    const target = Math.min(5, Math.max(3, chosen.length));
    const order = ['mc', 'cloze', 'tf', 'mcdef'];
    for (let i = 0; out.length < target && i < target * 3; i++) {
      const c = chosen[i % chosen.length];
      if (out.filter((q) => q.conceptId === c.id).length >= Math.ceil(target / chosen.length)) continue;
      const q = questionFor(corpus, c, pool, order[i % order.length], rnd, used);
      if (!q) continue;
      if (q.source && q.source.sentenceId) used.add(q.source.sentenceId);
      q.id = 'k' + (out.length + 1);
      out.push(q);
    }
    return out;
  }

  /**
   * Start a Learn session on some terms. Returns
   * { id, seed, startedAt, topics, phase: 'check'|'learn'|'done', check, queue, steps, index }
   */
  function startLearn(corpus, concepts, topicIds, mastery, opts) {
    const o = opts || {};
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const chosen = (topicIds || []).map((id) => byId.get(id)).filter(Boolean);
    const seed = o.seed || uid('L');
    const rnd = seeded(seed + ':check');
    const questions = o.skipCheck ? [] : buildCheck(corpus, chosen, concepts, rnd);
    const session = {
      id: uid('learn-'),
      seed,
      startedAt: o.now || new Date().toISOString(),
      topics: chosen.map((c) => c.id),
      phase: questions.length ? 'check' : 'learn',
      check: { questions, answers: {}, index: 0 },
      queue: [],
      steps: [],
      index: -1,
      doneAt: '',
    };
    if (!questions.length) planQueue(session, mastery);
    return session;
  }
  /** Weakest first, and terms the quick check showed you know go last. */
  function planQueue(session, mastery) {
    const checkWrong = new Set();
    const checkRight = new Set();
    session.check.questions.forEach((q) => {
      const a = session.check.answers[q.id];
      if (!a) return;
      (isRight(a.verdict) ? checkRight : checkWrong).add(q.conceptId);
    });
    const order = session.topics.map((id, i) => ({ id, i }));
    order.sort((a, b) => {
      const sa = (checkWrong.has(a.id) ? 3 : 0) - (checkRight.has(a.id) && !checkWrong.has(a.id) ? 3 : 0) + weakness(mastery && mastery[a.id]);
      const sb = (checkWrong.has(b.id) ? 3 : 0) - (checkRight.has(b.id) && !checkWrong.has(b.id) ? 3 : 0) + weakness(mastery && mastery[b.id]);
      return sb - sa || a.i - b.i;
    });
    session.queue = order.map((x) => x.id);
    session.phase = 'learn';
    session.index = -1;
  }
  function record(given, res, nowIso) {
    const out = { given: typeof given === 'string' ? given.slice(0, LIMITS.answer) : given, verdict: res.verdict, score: res.score || 0, at: nowIso || new Date().toISOString() };
    if (res.note) out.note = res.note;
    if (res.perConcept) out.perConcept = res.perConcept;
    return out;
  }
  /** Answer a quick-check question; mastery is updated in place. */
  function answerCheck(session, mastery, qid, given, nowIso) {
    const q = session.check.questions.find((x) => x.id === qid);
    if (!q) return null;
    const res = checkAnswer(q, given);
    const verdict = res.verdict === 'empty' ? 'incorrect' : res.verdict;
    session.check.answers[qid] = record(given, Object.assign({}, res, { verdict }), nowIso);
    if (mastery && q.conceptId) mastery[q.conceptId] = applyResult(mastery[q.conceptId], verdict, nowIso);
    return session.check.answers[qid];
  }
  function finishCheck(session, mastery) {
    planQueue(session, mastery);
  }
  function currentStep(session) {
    return session && session.index >= 0 ? session.steps[session.index] || null : null;
  }
  function insertAt(list, at, id) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    list.splice(Math.max(0, Math.min(at, list.length)), 0, id);
  }
  /**
   * Move on. Walks forward through steps already seen, then makes the next
   * one from the queue. Returns the step, or null when the session is done.
   */
  function nextStep(session, corpus, concepts, mastery0, nowIso) {
    if (!session || session.phase !== 'learn') return null;
    const mastery = mastery0 || {};
    if (session.index < session.steps.length - 1) {
      session.index++;
      return session.steps[session.index];
    }
    // Moving on without answering is a skip: the term goes to the back of the line, not lost.
    const open = currentStep(session);
    if (open && !open.rec) skipStep(session, nowIso);
    const byId = new Map(concepts.map((c) => [c.id, c]));
    session.queue = session.queue.filter((id) => byId.has(id));
    if (!session.queue.length || session.steps.length >= LIMITS.steps) {
      session.phase = 'done';
      session.doneAt = nowIso || new Date().toISOString();
      return null;
    }
    const n = session.steps.length;
    const rnd = seeded(session.seed + ':' + n);
    // Every fifth step, when a few terms are already under way, match several at once.
    const ready = session.queue.filter((id) => (mastery[id] && mastery[id].level >= 1));
    if (n > 0 && n % 5 === 4 && ready.length >= 3) {
      const group = ready.slice(0, 4).map((id) => byId.get(id));
      const q = makeMatch(corpus, group, rnd);
      if (q) {
        q.id = 'q' + (n + 1);
        q.conceptIds.forEach((id) => { const i = session.queue.indexOf(id); if (i >= 0) session.queue.splice(i, 1); });
        const step = { id: 's' + (n + 1), conceptIds: q.conceptIds.slice(), teach: false, explain: [], q, rec: null, help: { simpler: false, examples: 0 } };
        session.steps.push(step);
        session.index = session.steps.length - 1;
        return step;
      }
    }
    const id = session.queue.shift();
    const c = byId.get(id);
    const earlier = session.steps.filter((s) => s.conceptIds.length === 1 && s.conceptIds[0] === id);
    const avoid = new Set();
    earlier.slice(-2).forEach((s) => { if (s.q && s.q.source && s.q.source.sentenceId) avoid.add(s.q.source.sentenceId); });
    const level = mastery[id] ? mastery[id].level : 0;
    const types = typesForLevel(level);
    const wanted = types[earlier.length % Math.min(3, types.length)];
    const teach = !earlier.length;
    const explain = explanationFor(corpus, c);
    if (teach) explain.forEach((p) => { if (p.sentenceId) avoid.add(p.sentenceId); });
    let q = questionFor(corpus, c, concepts, wanted, rnd, avoid);
    if (!q) q = questionFor(corpus, c, concepts, wanted, rnd, null);
    if (!q) {
      // Nothing to ask about this term: let the session carry on without it.
      return nextStep(session, corpus, concepts, mastery, nowIso);
    }
    q.id = 'q' + (n + 1);
    const step = { id: 's' + (n + 1), conceptIds: [id], teach, explain, q, rec: null, help: { simpler: false, examples: 0 } };
    session.steps.push(step);
    session.index = session.steps.length - 1;
    return step;
  }
  /** Weak terms come back sooner: wrong in 2 steps, part-right in 3, right in 4, mastered not at all. */
  function requeue(session, id, verdict, level) {
    if (isRight(verdict) && level >= MASTERED) {
      const i = session.queue.indexOf(id);
      if (i >= 0) session.queue.splice(i, 1);
      return;
    }
    const gap = verdict === 'incorrect' ? 2 : verdict === 'partial' ? 3 : 4;
    insertAt(session.queue, gap, id);
  }
  /** Answer the current step. Mastery is updated in place. Returns the record. */
  function answerStep(session, mastery0, given, nowIso) {
    const mastery = mastery0 || {};
    const step = currentStep(session);
    if (!step || step.rec) return step ? step.rec : null;
    const res = checkAnswer(step.q, given);
    const now = nowIso || new Date().toISOString();
    if (step.q.type === 'match') {
      const verdict = res.verdict === 'empty' ? 'incorrect' : res.verdict;
      step.rec = record(given, Object.assign({}, res, { verdict }), now);
      step.conceptIds.forEach((id) => {
        const v = res.perConcept && res.perConcept[id] ? 'correct' : 'incorrect';
        mastery[id] = applyResult(mastery[id], v, now);
        requeue(session, id, v, mastery[id].level);
      });
      return step.rec;
    }
    const verdict = res.verdict === 'empty' ? 'incorrect' : res.verdict;
    step.rec = record(given, Object.assign({}, res, { verdict }), now);
    const id = step.conceptIds[0];
    mastery[id] = applyResult(mastery[id], verdict, now);
    requeue(session, id, verdict, mastery[id].level);
    return step.rec;
  }
  /** "I'm not sure": shows the answer and counts as not yet. */
  function dontKnow(session, mastery0, nowIso) {
    const mastery = mastery0 || {};
    const step = currentStep(session);
    if (!step || step.rec) return null;
    const now = nowIso || new Date().toISOString();
    step.rec = { given: '', verdict: 'incorrect', score: 0, at: now, unsure: true };
    step.conceptIds.forEach((id) => {
      mastery[id] = applyResult(mastery[id], 'incorrect', now);
      requeue(session, id, 'incorrect', mastery[id].level);
    });
    return step.rec;
  }
  /** Skip: no mark either way; the term goes to the back of the line. */
  function skipStep(session, nowIso) {
    const step = currentStep(session);
    if (!step || step.rec) return null;
    step.rec = { given: '', verdict: 'skipped', score: 0, at: nowIso || new Date().toISOString() };
    step.conceptIds.forEach((id) => insertAt(session.queue, session.queue.length, id));
    return step.rec;
  }
  /**
   * Another question on the same term(s), next. An unanswered step is left
   * unmarked. Call nextStep afterwards to get the new question.
   */
  function repeatStep(session, nowIso) {
    const step = currentStep(session);
    if (!step || session.phase !== 'learn') return false;
    if (!step.rec) step.rec = { given: '', verdict: 'skipped', score: 0, at: nowIso || new Date().toISOString() };
    // A step further on that is still open goes to the back first, so it is not lost.
    const last = session.steps[session.steps.length - 1];
    if (last && last !== step && !last.rec) {
      last.rec = { given: '', verdict: 'skipped', score: 0, at: nowIso || new Date().toISOString() };
      last.conceptIds.forEach((id) => insertAt(session.queue, session.queue.length, id));
    }
    step.conceptIds.slice().reverse().forEach((id) => insertAt(session.queue, 0, id));
    session.index = session.steps.length - 1;
    return true;
  }
  /** Back to the step before (already answered steps are shown as they were). */
  function backStep(session) {
    if (session && session.index > 0) session.index--;
    return currentStep(session);
  }
  /** Is the step on screen the newest one (so it can still be answered)? */
  function atLatest(session) {
    return !!session && session.index === session.steps.length - 1;
  }
  function learnSummary(session, concepts, mastery) {
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const answered = session.steps.filter((s) => s.rec && s.rec.verdict !== 'skipped');
    const right = answered.filter((s) => isRight(s.rec.verdict)).length;
    const topics = session.topics.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id).label, status: statusOf(mastery[id]), level: mastery[id] ? mastery[id].level : 0 }));
    return {
      answered: answered.length,
      right,
      topics,
      mastered: topics.filter((t) => t.status === 'mastered').length,
      shaky: topics.filter((t) => t.status !== 'mastered').map((t) => t.id),
    };
  }

  /* ── Simpler, and another example ───────────────────────────────────── */

  function plainness(s) {
    const long = s.toks.filter((t) => t.w.length >= 10).length;
    const avg = s.toks.reduce((n, t) => n + t.w.length, 0) / Math.max(1, s.wc);
    const commas = (s.text.match(/[,;()]/g) || []).length;
    return s.wc + long * 4 + avg * 2 + commas * 2 + (s.wc < 5 ? 20 : 0);
  }
  /**
   * "Simpler": the shortest, plainest sentences the notes have about the
   * term, and the notes' own definitions of the other key terms they use.
   * Nothing is reworded.
   */
  function simplerFor(corpus, c, concepts, shownIds) {
    const shown = new Set(shownIds || []);
    let pool = sentencesOf(corpus, c.mentions).filter((s) => s.wc >= 4);
    const defSent = c.definition.sentenceId ? corpus.byId[c.definition.sentenceId] : null;
    if (defSent && !pool.includes(defSent)) pool.push(defSent);
    const ranked = pool.slice().sort((a, b) => plainness(a) - plainness(b) || a.order - b.order);
    const picked = [];
    if (defSent && ranked[0] && plainness(defSent) <= plainness(ranked[0]) + 12) picked.push(defSent);
    ranked.forEach((s) => { if (picked.length < 2 && !picked.includes(s)) picked.push(s); });
    const shownSents = Array.from(shown).map((id) => corpus.byId[id]).filter(Boolean);
    const currentBest = Math.min.apply(null, shownSents.map(plainness).concat([Infinity]));
    const plainer = picked.some((s) => !shown.has(s.id) && plainness(s) < currentBest);
    const textStems = new Set();
    picked.concat(shownSents).forEach((s) => s.stems.forEach((st) => textStems.add(st)));
    if (!picked.length) c.stems.forEach((st) => textStems.add(st));
    const terms = (concepts || []).filter((o) => o.id !== c.id && o.stems.length && o.stems.every((st) => textStems.has(st)))
      .slice(0, 3)
      .map((o) => ({ id: o.id, term: o.label, text: o.definition.full, ref: o.definition.ref }));
    const sentences = picked.length ? picked.map(passage) : [{ text: c.definition.full, ref: c.definition.ref, sentenceId: '' }];
    return {
      sentences,
      terms,
      plainer,
      note: plainer ? '' : 'This is already the plainest way your notes put “' + c.label + '”.',
    };
  }
  /**
   * "Another example": other passages that use the term, examples and worked
   * examples first. Empty when the notes have no more.
   */
  function examplesFor(corpus, c, shownIds) {
    const shown = new Set(shownIds || []);
    const pool = sentencesOf(corpus, c.mentions).filter((s) => !shown.has(s.id) && s.wc >= 4);
    const score = (s) => (EXAMPLE_RE.test(s.text) ? 5 : 0) + (WORKED_RE.test(s.text) ? 2 : 0) + (EXPLAIN_RE.test(s.text) ? 1 : 0);
    const ranked = pool.slice().sort((a, b) => score(b) - score(a) || a.order - b.order);
    const out = [];
    const taken = new Set();
    ranked.forEach((s) => {
      if (taken.has(s.id) || out.length >= 10) return;
      const group = withContext(corpus, s, 70).filter((x) => !shown.has(x.id) && !taken.has(x.id));
      group.forEach((x) => taken.add(x.id));
      if (group.length) out.push({ example: EXAMPLE_RE.test(s.text), sentences: group.map(passage) });
    });
    return out;
  }

  /* ── Practice test ──────────────────────────────────────────────────── */

  /**
   * A mixed practice test. opts: { count, types: ['mc','tf','written','match'],
   * focus: 'all'|'weak', seed }. Weak terms are more likely to be asked.
   */
  function buildPracticeTest(corpus, concepts, mastery, opts) {
    const o = opts || {};
    const rnd = seeded(o.seed || uid('T'));
    const count = clampInt(o.count, 1, LIMITS.testQuestions, 10);
    const types = (Array.isArray(o.types) ? o.types : ['mc', 'tf', 'written', 'match']).filter((t) => ['mc', 'tf', 'written', 'match'].includes(t));
    if (!types.length) types.push('mc');
    let pool = concepts.slice();
    if (o.focus === 'weak') {
      const weak = pool.filter((c) => statusOf(mastery && mastery[c.id]) !== 'mastered');
      if (weak.length >= 2) pool = weak;
    }
    if (!pool.length) return [];
    // Weighted shuffle: weaker terms tend to come first.
    const ordered = pool.map((c) => ({ c, k: Math.pow(rnd(), 1 / (1 + weakness(mastery && mastery[c.id]))) }))
      .sort((a, b) => b.k - a.k).map((x) => x.c);
    const out = [];
    const used = new Set();
    const asked = new Map();
    const singles = types.filter((t) => t !== 'match');
    let matchDone = 0;
    let i = 0;
    let guard = 0;
    while (out.length < count && guard++ < count * 6) {
      const slotType = types[out.length % types.length];
      if (slotType === 'match') {
        if (matchDone < (singles.length ? Math.max(1, Math.floor(count / 8)) : count) && concepts.length >= 3) {
          const group = shuffle(ordered, rnd).slice(0, 4);
          const q = makeMatch(corpus, group, rnd);
          if (q) { matchDone++; q.id = 'p' + (out.length + 1); out.push(q); continue; }
        }
        if (!singles.length) { if (matchDone >= 1) break; singles.push('mc'); }
      }
      const c = ordered[i % ordered.length];
      i++;
      const times = asked.get(c.id) || 0;
      if (times >= 2 && i < ordered.length * 3) continue;
      let type = slotType === 'match' ? singles[out.length % singles.length] : slotType;
      if (type === 'written') type = (times + out.length) % 2 ? 'cloze' : 'written';
      if (type === 'mc' && rnd() < 0.35) type = 'mcdef';
      const q = questionFor(corpus, c, concepts, type, rnd, used);
      if (!q) continue;
      if (q.source && q.source.sentenceId) used.add(q.source.sentenceId);
      asked.set(c.id, times + 1);
      q.id = 'p' + (out.length + 1);
      out.push(q);
    }
    return out;
  }
  /** Mark a whole test. answers: { [qid]: given }. */
  function gradePracticeTest(questions, answers) {
    let right = 0;
    const results = (questions || []).map((q) => {
      const given = answers ? answers[q.id] : undefined;
      const res = checkAnswer(q, given);
      const verdict = res.verdict === 'empty' ? 'incorrect' : res.verdict;
      const score = isRight(verdict) ? 1 : verdict === 'partial' ? (q.type === 'match' ? res.score : 0) : 0;
      right += score;
      return { qid: q.id, verdict, score, note: res.note || '', perConcept: res.perConcept || null, blank: res.verdict === 'empty' };
    });
    const total = (questions || []).length;
    right = Math.round(right * 100) / 100;
    return { right, total, pct: total ? Math.round(right / total * 100) : 0, results };
  }

  /* ── Ask your notes (BM25) ──────────────────────────────────────────── */

  function buildSearchIndex(corpus) {
    const docs = corpus.paragraphs.map((p) => {
      const tf = new Map();
      let len = 0;
      p.sentences.forEach((s) => s.stems.forEach((st, i) => {
        if (!isContent(s.toks[i].w)) return;
        len++;
        tf.set(st, (tf.get(st) || 0) + 1);
      }));
      return { para: p, tf, len };
    });
    const df = new Map();
    docs.forEach((d) => d.tf.forEach((_, st) => df.set(st, (df.get(st) || 0) + 1)));
    const avg = docs.reduce((n, d) => n + d.len, 0) / Math.max(1, docs.length);
    return { docs, df, N: docs.length, avg: avg || 1 };
  }
  function queryStems(query) {
    const seen = new Set();
    const out = [];
    tokenize(query).forEach((t) => {
      if (!isContent(t.w) || QUESTION_WORDS.has(t.w)) return;
      const st = stem(t.w);
      if (seen.has(st)) return;
      seen.add(st);
      out.push({ word: t.w, stem: st });
    });
    return out;
  }
  /**
   * "What do my notes say about …?" Ranks paragraphs with BM25 on stemmed
   * words. covered is false when no paragraph has enough of the question's
   * words; `missing` lists words the notes never use.
   */
  function searchNotes(corpus, index, query, concepts) {
    const q = queryStems(query);
    if (!q.length) return { empty: true, covered: false, words: [], stems: [], missing: [], results: [], related: [], terms: [] };
    const idx = index || buildSearchIndex(corpus);
    const k1 = 1.2;
    const b = 0.75;
    const missing = q.filter((x) => !idx.df.has(x.stem)).map((x) => x.word);
    const scored = [];
    idx.docs.forEach((d) => {
      let score = 0;
      const matched = [];
      q.forEach((x) => {
        const f = d.tf.get(x.stem);
        if (!f) return;
        matched.push(x.stem);
        const df = idx.df.get(x.stem) || 0;
        const w = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
        score += w * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / idx.avg));
      });
      if (matched.length) scored.push({ d, score, matched });
    });
    scored.sort((a, b2) => b2.matched.length - a.matched.length || b2.score - a.score || a.d.para.sentences[0].order - b2.d.para.sentences[0].order);
    const need = q.length === 1 ? 1 : Math.max(2, Math.ceil(q.length / 2));
    const best = scored[0];
    const covered = !!best && best.matched.length >= Math.min(need, q.length);
    const toResult = (x) => {
      const sents = x.d.para.sentences;
      const hitSet = new Set(x.matched);
      let show = sents;
      if (sents.length > 5) show = sents.filter((s) => s.stems.some((st) => hitSet.has(st))).slice(0, 5);
      return {
        paraId: x.d.para.id,
        ref: copyRef(x.d.para.ref),
        section: (corpus.sectionById[x.d.para.sectionId] || {}).title || '',
        score: Math.round(x.score * 100) / 100,
        matched: x.matched.slice(),
        trimmed: show.length < sents.length,
        sentences: show.map(passage),
      };
    };
    const results = covered ? scored.filter((x) => x.matched.length >= Math.min(need, q.length)).sort((a, b2) => b2.score - a.score).slice(0, 5).map(toResult) : [];
    const related = covered ? [] : scored.slice(0, 3).map(toResult);
    const stemSet = new Set(q.map((x) => x.stem));
    const terms = (concepts || []).filter((c) => c.stems.length && c.stems.every((st) => stemSet.has(st)))
      .slice(0, 3).map((c) => ({ id: c.id, term: c.label, def: c.def, ref: c.definition.ref }));
    return { empty: false, covered, words: q.map((x) => x.word), stems: q.map((x) => x.stem), missing, results, related, terms };
  }
  /** A text split into plain and matched pieces, for highlighting (the UI escapes each piece). */
  function highlightSegments(text, stems) {
    const s = String(text || '');
    const want = new Set(stems || []);
    const out = [];
    let at = 0;
    tokenize(s).forEach((t) => {
      if (!want.has(stem(t.w))) return;
      if (t.start > at) out.push({ text: s.slice(at, t.start), hit: false });
      out.push({ text: s.slice(t.start, t.end), hit: true });
      at = t.end;
    });
    if (at < s.length) out.push({ text: s.slice(at), hit: false });
    return out;
  }

  /* ── Study plan ─────────────────────────────────────────────────────── */

  /**
   * Spread the terms over the days before an exam: learn the weakest first,
   * review them a day, three days and a week later (weak ones more often),
   * and finish with a practice test. opts: { concepts:[{id,label}], mastery,
   * examDate:'YYYY-MM-DD', today:'YYYY-MM-DD' }.
   */
  function buildStudyPlan(opts) {
    const o = opts || {};
    if (!isYmd(o.examDate) || !isYmd(o.today)) return { ok: false, reason: 'no-date', days: [] };
    const left = daysBetween(o.today, o.examDate);
    if (left < 0) return { ok: false, reason: 'past', daysLeft: left, days: [] };
    const concepts = (o.concepts || []).slice();
    const mastery = o.mastery || {};
    const labelOf = new Map(concepts.map((c) => [c.id, c.label]));
    const names = (ids) => {
      const list = ids.map((id) => labelOf.get(id)).filter(Boolean);
      return list.length > 4 ? list.slice(0, 4).join(', ') + ' and ' + (list.length - 4) + ' more' : list.join(', ');
    };
    const itemId = (date, type, ids) => date + ':' + type + ':' + hashText(ids.slice().sort().join('|'));
    const days = [];
    const span = Math.min(left, LIMITS.planDays);
    for (let i = 0; i < Math.max(1, span); i++) days.push({ date: addDays(o.today, i), items: [] });
    const add = (dayIndex, type, ids, label) => {
      const d = days[Math.max(0, Math.min(days.length - 1, dayIndex))];
      if (type === 'review' || type === 'learn') {
        const ex = d.items.find((x) => x.type === type);
        if (ex) {
          ids.forEach((id) => { if (!ex.conceptIds.includes(id)) ex.conceptIds.push(id); });
          return;
        }
      }
      d.items.push({ id: '', type, label: label || '', conceptIds: ids.slice() });
    };
    const ranked = concepts.map((c, i) => ({ c, i, w: weakness(mastery[c.id]), st: statusOf(mastery[c.id]) }))
      .sort((a, b) => b.w - a.w || a.i - b.i);
    const toLearn = ranked.filter((x) => x.st !== 'mastered').map((x) => x.c.id);
    const known = ranked.filter((x) => x.st === 'mastered').map((x) => x.c.id);
    const weakIds = new Set(ranked.filter((x) => x.st === 'weak' || (mastery[x.c.id] && mastery[x.c.id].wrong > 0)).map((x) => x.c.id));
    if (left === 0) {
      if (toLearn.length) add(0, 'review', toLearn.slice(0, 8));
      add(0, 'cards', [], 'Flashcards: everything due');
      add(0, 'test', [], 'Short practice test');
    } else {
      const last = days.length - 1;
      const learnDays = Math.max(1, days.length >= 3 ? Math.floor(days.length * 0.6) : days.length);
      const per = Math.max(1, Math.ceil(toLearn.length / learnDays));
      for (let d = 0; d < learnDays; d++) {
        const chunk = toLearn.slice(d * per, (d + 1) * per);
        if (!chunk.length) break;
        add(d, 'learn', chunk);
        const gaps = chunk.some((id) => weakIds.has(id)) ? [1, 2, 4, 7] : [1, 3, 7];
        gaps.forEach((g) => {
          if (d + g >= last && days.length > 2) return;
          const ids = g === 2 || g === 4 ? chunk.filter((id) => weakIds.has(id)) : chunk;
          if (ids.length && d + g <= last) add(d + g, 'review', ids);
        });
      }
      if (known.length) add(Math.min(last, Math.max(0, Math.floor(days.length / 2))), 'review', known);
      if (days.length >= 2) {
        add(last, 'test', [], 'Practice test: everything');
        if (weakIds.size) add(last, 'review', Array.from(weakIds));
      }
      days.forEach((d) => { if (!d.items.length) d.items.push({ id: '', type: 'cards', label: 'Flashcards: what’s due today', conceptIds: [] }); });
    }
    days.forEach((d) => d.items.forEach((it) => {
      if (it.type === 'learn') it.label = 'Learn: ' + names(it.conceptIds);
      if (it.type === 'review') it.label = 'Review: ' + names(it.conceptIds);
      it.id = itemId(d.date, it.type, it.conceptIds.length ? it.conceptIds : [it.label]);
    }));
    return { ok: true, daysLeft: left, truncated: left > LIMITS.planDays, examDate: o.examDate, days: days.filter((d) => d.items.length) };
  }

  /* ── The saved study set ────────────────────────────────────────────── */

  function newSource(name, kind, text) {
    return {
      id: uid('src-'),
      name: str(name, LIMITS.sourceName) || 'Your notes',
      kind: KINDS.includes(kind) ? kind : 'Notes',
      text: str(text, LIMITS.sourceText),
      addedAt: new Date().toISOString(),
    };
  }
  function newSet(opts) {
    const now = new Date().toISOString();
    const o = opts || {};
    return {
      v: VERSION,
      id: uid('set-'),
      title: str(o.title, LIMITS.title),
      subject: str(o.subject, LIMITS.subject),
      examDate: isYmd(o.examDate) ? o.examDate : '',
      link: safeUrl(o.link),
      createdAt: now,
      updatedAt: now,
      studiedAt: '',
      deletedAt: '',
      sources: [],
      guide: null,
      mastery: {},
      learn: null,
      tests: [],
      cards: {},
      flashDeckId: '',
      plan: null,
      planDone: {},
      legacy: null,
    };
  }

  function normRef(r) {
    if (!plainObject(r)) return null;
    const out = {
      sourceId: str(r.sourceId, 80),
      source: str(r.source, LIMITS.sourceName) || 'Your notes',
      kind: KINDS.includes(r.kind) ? r.kind : 'Notes',
      page: posInt(r.page),
      para: posInt(r.para),
    };
    if (r.edited === true) out.edited = true;
    return out;
  }
  function normPassage(p) {
    if (!plainObject(p) || typeof p.text !== 'string' || !p.text.trim()) return null;
    return { text: p.text.slice(0, 3000), ref: normRef(p.ref), sentenceId: str(p.sentenceId, 200) };
  }
  function normTerm(t) {
    if (!plainObject(t)) return null;
    const term = str(t.term, LIMITS.term).trim();
    const def = str(t.def, LIMITS.def).trim();
    if (!term || !def) return null;
    const out = {
      id: safeKey(t.id) ? t.id : uid('u'),
      term,
      surface: str(t.surface, LIMITS.term) || term,
      def,
      kind: TERM_KINDS.includes(t.kind) ? t.kind : 'user',
      aliases: strList(t.aliases, 8, 80),
      ref: normRef(t.ref),
      sentenceId: str(t.sentenceId, 200),
      order: clampNum(t.order, 0, 1e9, 1e9),
    };
    if (t.edited === true) out.edited = true;
    return out;
  }
  function normFact(f) {
    if (!plainObject(f)) return null;
    const text = str(f.text, LIMITS.fact).trim();
    if (!text) return null;
    const out = {
      id: safeKey(f.id) ? f.id : uid('u'),
      text,
      tags: strList(f.tags, 3, 10).filter((x) => ['date', 'number', 'cause'].includes(x)),
      ref: normRef(f.ref),
      sentenceId: str(f.sentenceId, 200),
      order: clampNum(f.order, 0, 1e9, 1e9),
    };
    if (f.kind === 'user') out.kind = 'user';
    if (f.edited === true) out.edited = true;
    return out;
  }
  function normGuide(g) {
    if (!plainObject(g)) return null;
    const seenT = new Set();
    const seenF = new Set();
    return {
      builtAt: isoOr(g.builtAt, new Date().toISOString()),
      hash: str(g.hash, 16),
      outline: (Array.isArray(g.outline) ? g.outline : []).slice(0, 400).filter(plainObject).map((o) => ({
        id: safeKey(o.id) ? o.id : uid('o'),
        sectionId: str(o.sectionId, 200),
        title: str(o.title, 200) || 'Section',
        level: clampInt(o.level, 1, 4, 1),
        ref: normRef(o.ref),
        sentences: clampInt(o.sentences, 0, 100000, 0),
        summary: (Array.isArray(o.summary) ? o.summary : []).slice(0, 4).map(normPassage).filter(Boolean),
      })),
      terms: (Array.isArray(g.terms) ? g.terms : []).slice(0, LIMITS.terms).map(normTerm).filter((t) => t && !seenT.has(t.id) && seenT.add(t.id)),
      facts: (Array.isArray(g.facts) ? g.facts : []).slice(0, LIMITS.facts).map(normFact).filter((f) => f && !seenF.has(f.id) && seenF.add(f.id)),
      removed: strList(g.removed, LIMITS.removed, 120).filter(safeKey),
    };
  }
  function normMastery(m) {
    if (!plainObject(m)) return null;
    return {
      level: clampInt(m.level, 0, MAX_LEVEL, 0),
      seen: clampInt(m.seen, 0, 1e6, 0),
      right: clampInt(m.right, 0, 1e6, 0),
      wrong: clampInt(m.wrong, 0, 1e6, 0),
      streak: clampInt(m.streak, 0, 1e6, 0),
      lastAt: isoOr(m.lastAt, ''),
    };
  }
  function normMap(obj, fn, max) {
    const out = {};
    if (!plainObject(obj)) return out;
    Object.keys(obj).slice(0, max || 2000).forEach((k) => {
      if (!safeKey(k)) return;
      const v = fn(obj[k]);
      if (v != null) out[k] = v;
    });
    return out;
  }
  function normQuestion(q) {
    if (!plainObject(q) || !QTYPES.includes(q.type)) return null;
    const out = {
      id: safeKey(q.id) ? q.id : uid('q'),
      type: q.type,
      conceptId: safeKey(q.conceptId) ? q.conceptId : '',
      concept: str(q.concept, 200),
      prompt: str(q.prompt, 400),
      source: normPassage(q.source),
    };
    if (q.type === 'mc' || q.type === 'mcdef') {
      out.stem = str(q.stem, 3000);
      out.options = strList(q.options, 6, 600);
      out.answer = str(q.answer, 600);
      if (out.options.length < 2 || !out.options.includes(out.answer)) return null;
    } else if (q.type === 'tf') {
      out.statement = str(q.statement, 3000);
      out.answer = q.answer === 'true' || q.answer === 'false' ? q.answer : '';
      out.note = str(q.note, 600);
      if (!out.answer || !out.statement) return null;
    } else if (q.type === 'cloze') {
      out.before = str(q.before, 3000);
      out.after = str(q.after, 3000);
      out.answer = str(q.answer, 200);
      out.accept = strList(q.accept, 12, 200);
      out.others = strList(q.others, 8, 200);
      if (!out.answer) return null;
    } else if (q.type === 'written') {
      out.stem = str(q.stem, 3000);
      out.answer = str(q.answer, 200);
      out.accept = strList(q.accept, 12, 200);
      out.others = strList(q.others, 8, 200);
      if (!out.answer) return null;
    } else if (q.type === 'match') {
      out.pairs = (Array.isArray(q.pairs) ? q.pairs : []).slice(0, 6).filter((p) => plainObject(p) && safeKey(p.conceptId) && typeof p.term === 'string' && typeof p.def === 'string')
        .map((p) => ({ conceptId: p.conceptId, term: p.term.slice(0, 200), def: p.def.slice(0, 600) }));
      out.options = strList(q.options, 6, 200);
      out.conceptIds = out.pairs.map((p) => p.conceptId);
      out.sources = (Array.isArray(q.sources) ? q.sources : []).slice(0, 6).map(normPassage).filter(Boolean);
      if (out.pairs.length < 2) return null;
    }
    return out;
  }
  function normRecord(r) {
    if (!plainObject(r)) return null;
    const out = {
      given: typeof r.given === 'string' ? r.given.slice(0, LIMITS.answer) : (plainObject(r.given) ? normMap(r.given, (v) => (typeof v === 'string' ? v.slice(0, 200) : null), 10) : ''),
      verdict: VERDICTS.includes(r.verdict) ? r.verdict : 'incorrect',
      score: clampNum(r.score, 0, 1, 0),
      at: isoOr(r.at, ''),
    };
    if (typeof r.note === 'string' && r.note) out.note = r.note.slice(0, 600);
    if (plainObject(r.perConcept)) out.perConcept = normMap(r.perConcept, (v) => (v === true ? true : v === false ? false : null), 10);
    if (r.unsure === true) out.unsure = true;
    return out;
  }
  function normLearn(l) {
    if (!plainObject(l)) return null;
    const phase = ['check', 'learn', 'done'].includes(l.phase) ? l.phase : 'learn';
    const check = plainObject(l.check) ? l.check : {};
    const questions = (Array.isArray(check.questions) ? check.questions : []).slice(0, 8).map(normQuestion).filter(Boolean);
    const steps = (Array.isArray(l.steps) ? l.steps : []).slice(0, LIMITS.steps).filter(plainObject).map((s) => {
      const q = normQuestion(s.q);
      if (!q) return null;
      return {
        id: safeKey(s.id) ? s.id : uid('s'),
        conceptIds: strList(s.conceptIds, 6, 120).filter(safeKey),
        teach: s.teach === true,
        explain: (Array.isArray(s.explain) ? s.explain : []).slice(0, 4).map(normPassage).filter(Boolean),
        q,
        rec: s.rec ? normRecord(s.rec) : null,
        help: { simpler: !!(s.help && s.help.simpler === true), examples: clampInt(s.help && s.help.examples, 0, 50, 0) },
      };
    }).filter((s) => s && s.conceptIds.length);
    const out = {
      id: safeKey(l.id) ? l.id : uid('learn-'),
      seed: str(l.seed, 60) || uid('L'),
      startedAt: isoOr(l.startedAt, new Date().toISOString()),
      topics: strList(l.topics, 200, 120).filter(safeKey),
      phase: phase === 'check' && !questions.length ? 'learn' : phase,
      check: { questions, answers: normMap(check.answers, normRecord, 20), index: clampInt(check.index, 0, Math.max(0, questions.length - 1), 0) },
      queue: strList(l.queue, 400, 120).filter(safeKey),
      steps,
      index: clampInt(l.index, -1, steps.length - 1, steps.length - 1),
      doneAt: isoOr(l.doneAt, ''),
    };
    if (!out.topics.length) return null;
    return out;
  }
  function normTest(t) {
    if (!plainObject(t)) return null;
    return {
      id: safeKey(t.id) ? t.id : uid('test-'),
      at: isoOr(t.at, new Date().toISOString()),
      right: clampNum(t.right, 0, 1000, 0),
      total: clampInt(t.total, 0, 1000, 0),
      pct: clampInt(t.pct, 0, 100, 0),
      seconds: clampInt(t.seconds, 0, 1e6, 0),
      timed: clampInt(t.timed, 0, 600, 0),
      missed: (Array.isArray(t.missed) ? t.missed : []).slice(0, LIMITS.testQuestions).filter(plainObject).map((x) => ({
        prompt: str(x.prompt, 3000),
        answer: str(x.answer, 3000),
        given: str(x.given, LIMITS.answer),
        source: normPassage(x.source),
      })),
    };
  }
  function normCardState(s) {
    if (!plainObject(s) || !['learning', 'relearning', 'review'].includes(s.state)) return null;
    const out = { state: s.state };
    ['S', 'D', 'due', 'ivl', 'reps', 'lapses', 'last', 'first'].forEach((k) => {
      const n = Number(s[k]);
      if (Number.isFinite(n)) out[k] = n;
    });
    if (!Number.isFinite(out.due)) return null;
    return out;
  }
  function normPlan(p) {
    if (!plainObject(p) || !isYmd(p.examDate)) return null;
    return {
      builtAt: isoOr(p.builtAt, new Date().toISOString()),
      builtOn: isYmd(p.builtOn) ? p.builtOn : '',
      examDate: p.examDate,
      days: (Array.isArray(p.days) ? p.days : []).slice(0, LIMITS.planDays + 1).filter((d) => plainObject(d) && isYmd(d.date)).map((d) => ({
        date: d.date,
        items: (Array.isArray(d.items) ? d.items : []).slice(0, 12).filter(plainObject).map((it) => ({
          id: str(it.id, 120),
          type: ['learn', 'review', 'test', 'cards'].includes(it.type) ? it.type : 'review',
          label: str(it.label, 400),
          conceptIds: strList(it.conceptIds, 200, 120).filter(safeKey),
        })).filter((it) => it.id && it.label),
      })),
    };
  }

  /**
   * A study set from storage or an imported file, made safe to use: right
   * types, sizes capped, unknown fields dropped. Returns null when it is not a set.
   */
  function normalizeSet(raw) {
    if (!plainObject(raw)) return null;
    const out = newSet();
    const now = out.createdAt;
    out.id = safeKey(raw.id) ? raw.id : out.id;
    out.title = str(raw.title, LIMITS.title);
    out.subject = str(raw.subject, LIMITS.subject);
    out.examDate = isYmd(raw.examDate) ? raw.examDate : '';
    out.link = safeUrl(raw.link || raw.url);
    out.createdAt = isoOr(raw.createdAt, now);
    out.updatedAt = isoOr(raw.updatedAt, out.createdAt);
    out.studiedAt = isoOr(raw.studiedAt, '');
    out.deletedAt = isoOr(raw.deletedAt, '');
    const seenSrc = new Set();
    out.sources = (Array.isArray(raw.sources) ? raw.sources : []).filter(plainObject).slice(0, LIMITS.sources).map((s) => {
      let id = safeKey(s.id) ? s.id : uid('src-');
      if (seenSrc.has(id)) id = uid('src-');
      seenSrc.add(id);
      return {
        id,
        name: str(s.name, LIMITS.sourceName) || 'Your notes',
        kind: KINDS.includes(s.kind) ? s.kind : 'Notes',
        text: str(s.text, LIMITS.sourceText),
        addedAt: isoOr(s.addedAt, out.createdAt),
      };
    });
    out.guide = normGuide(raw.guide);
    out.mastery = normMap(raw.mastery, normMastery);
    out.learn = normLearn(raw.learn);
    out.tests = (Array.isArray(raw.tests) ? raw.tests : []).slice(-LIMITS.tests).map(normTest).filter(Boolean);
    out.cards = normMap(raw.cards, normCardState);
    out.flashDeckId = typeof raw.flashDeckId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.flashDeckId) ? raw.flashDeckId : '';
    out.plan = normPlan(raw.plan);
    out.planDone = normMap(raw.planDone, (v) => (v === true ? true : null), 3000);
    if (plainObject(raw.legacy)) {
      out.legacy = {
        from: str(raw.legacy.from, 80),
        notes: (Array.isArray(raw.legacy.notes) ? raw.legacy.notes : []).slice(0, 60)
          .filter((n) => plainObject(n) && typeof n.text === 'string' && n.text.trim())
          .map((n) => ({ label: str(n.label, 200), prompt: str(n.prompt, 3000), text: n.text.slice(0, LIMITS.legacyNote) })),
      };
    }
    return out;
  }

  function cloneSet(set, title) {
    const copy = normalizeSet(JSON.parse(JSON.stringify(set)));
    const now = new Date().toISOString();
    copy.id = uid('set-');
    copy.title = str(title != null ? title : (set.title || 'Untitled study set') + ' (copy)', LIMITS.title);
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.deletedAt = '';
    copy.flashDeckId = '';
    return copy;
  }
  /** Has the notes' text changed since the guide was built? */
  function guideStale(set) {
    return !set.guide || set.guide.hash !== sourcesHash(set.sources);
  }
  function hasNotes(set) {
    return (set.sources || []).some((s) => s.text && s.text.trim());
  }
  function wordCount(text) {
    const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
    return m ? m.length : 0;
  }
  /**
   * What a library card shows, without reading the notes: size, how many
   * terms are mastered, when it was last studied, days to the exam.
   * today: 'YYYY-MM-DD' (defaults to the device's date).
   */
  function summarizeSet(set, today) {
    const s = set || {};
    const terms = (s.guide && Array.isArray(s.guide.terms)) ? s.guide.terms : [];
    const m = masterySummary(terms, s.mastery || {});
    const day = isYmd(today) ? today : ymd();
    const tests = Array.isArray(s.tests) ? s.tests : [];
    const lastTest = tests.length ? tests[tests.length - 1] : null;
    return {
      id: s.id || '',
      title: s.title || '',
      subject: s.subject || '',
      examDate: s.examDate || '',
      daysLeft: isYmd(s.examDate) ? daysBetween(day, s.examDate) : null,
      createdAt: s.createdAt || '',
      updatedAt: s.updatedAt || '',
      studiedAt: s.studiedAt || '',
      sources: (s.sources || []).length,
      words: (s.sources || []).reduce((n, src) => n + wordCount(src && src.text), 0),
      hasGuide: !!s.guide,
      terms: m.total,
      mastered: m.mastered,
      learning: m.learning,
      weak: m.weak,
      fresh: m.fresh,
      percent: m.percent,
      lastTestPct: lastTest ? lastTest.pct : null,
      sample: (s.sources || []).some((src) => src && src.kind === 'Sample'),
    };
  }

  /* ── Flashcards inside Tutor, and "Send to Flux Flashcards" ─────────── */

  /**
   * The set's cards: one per key term, with its saved memory state `s` (the
   * same FSRS state Flux Flashcards keeps, so FluxFlash.preview/review work
   * on { s } directly). Returns [{ id, term, def, ref, s }].
   */
  function cardList(set) {
    const terms = (set && set.guide && set.guide.terms) || [];
    const cards = (set && set.cards) || {};
    return terms.filter((t) => t && t.term && t.def).map((t) => ({
      id: t.id, term: t.term, def: t.def, ref: t.ref || null,
      s: Object.prototype.hasOwnProperty.call(cards, t.id) ? cards[t.id] : null,
    }));
  }
  /** Due cards first (most overdue first), then up to newLimit (20) new ones. now: ms. */
  function cardQueue(set, now, newLimit) {
    const t = Number.isFinite(now) ? now : Date.now();
    const list = cardList(set);
    const due = list.filter((c) => c.s && c.s.state && Number(c.s.due) <= t).sort((a, b) => a.s.due - b.s.due);
    const fresh = list.filter((c) => !c.s || !c.s.state).slice(0, newLimit == null ? 20 : newLimit);
    return due.concat(fresh);
  }
  function cardCounts(set, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const out = { total: 0, fresh: 0, due: 0, later: 0 };
    cardList(set).forEach((c) => {
      out.total++;
      if (!c.s || !c.s.state) out.fresh++;
      else if (Number(c.s.due) <= t) out.due++;
      else out.later++;
    });
    return out;
  }
  /**
   * The deck to hand Flux Flashcards (FluxFlash.putDeck): the key terms as
   * cards. When the set was sent before, `existing` is that deck: its title,
   * its cards' memory and stars and any cards added in Flashcards are kept,
   * definitions are brought up to date and new terms are added.
   * Returns { deck, added, updated } (deck has no id when there is no existing deck).
   */
  function flashDeckFrom(set, existing) {
    const s = set || {};
    const examAt = isYmd(s.examDate) ? new Date(s.examDate + 'T09:00:00').getTime() : null;
    const terms = cardList(s);
    const base0 = plainObject(existing) && Array.isArray(existing.cards) ? existing : null;
    const cards = base0 ? base0.cards.map((c) => Object.assign({}, c)) : [];
    const byTerm = new Map(cards.map((c, i) => [norm(c.term), i]));
    let added = 0;
    let updated = 0;
    terms.forEach((t) => {
      const k = norm(t.term);
      if (byTerm.has(k)) {
        const c = cards[byTerm.get(k)];
        if (c.def !== t.def) { c.def = t.def; updated++; }
        return;
      }
      cards.push({ term: t.term, def: t.def, star: false });
      byTerm.set(k, cards.length - 1);
      added++;
    });
    const deck = base0
      ? Object.assign({}, base0, { cards, examAt: base0.examAt || examAt })
      : { title: (s.title || 'Flux Tutor terms').slice(0, 160), desc: 'Key terms from your Flux Tutor study set' + (s.subject ? ' (' + s.subject.slice(0, 80) + ')' : '') + '.', examAt, cards };
    return { deck, added, updated };
  }

  /* ── The first beta (flux_teacher.beta.v1) ──────────────────────────── */

  // The first beta's own split and prompts, kept so the answers it saved
  // can be shown beside the text they answered.
  function legacyParagraphs(text) {
    const blocks = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const lines = blocks.length ? blocks : String(text || '').split(/\n/).map((p) => p.trim()).filter(Boolean);
    return lines.slice(0, 16);
  }
  function legacyPrompts(s) {
    const found = [];
    if (str(s.question).trim()) found.push(s.question.trim());
    (str(s.material).match(/[^\n.!?]{3,240}\?/g) || []).forEach((q) => found.push(q.trim()));
    const supplied = Array.from(new Map(found.map((q) => [q.toLowerCase(), q])).values()).slice(0, 6);
    const topic = str(s.topic).trim();
    return supplied.concat([
      'Explain “' + topic + '” in your own words, without copying the source.',
      'Which detail or example from your material best supports your explanation?',
      'What part still feels unclear, and what would you ask your teacher about it?',
    ]).slice(0, 8);
  }
  function kindOfName(name, attachments) {
    const hit = (attachments || []).find((a) => a && a.name === name);
    const kind = hit && typeof hit.kind === 'string' ? hit.kind : '';
    if (KINDS.includes(kind)) return kind;
    if (/\.pdf$/i.test(name)) return 'PDF';
    if (/\.docx$/i.test(name)) return 'Word';
    if (/\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i.test(name)) return 'Photo';
    return 'Text';
  }
  /** The beta kept every file in one box under "[file name]" lines; split it back into sources. */
  function splitLegacyMaterial(material, attachments, sourceTitle) {
    const names = new Set((Array.isArray(attachments) ? attachments : []).map((a) => a && a.name).filter((n) => typeof n === 'string'));
    const out = [];
    let cur = { name: str(sourceTitle, LIMITS.sourceName).trim() || 'Your notes', kind: 'Notes', lines: [] };
    String(material || '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
      const m = /^\[(.+)\]$/.exec(line.trim());
      if (m && names.has(m[1])) {
        if (cur.lines.join('\n').trim()) out.push(cur);
        cur = { name: m[1], kind: kindOfName(m[1], attachments), lines: [] };
        return;
      }
      cur.lines.push(line);
    });
    if (cur.lines.join('\n').trim()) out.push(cur);
    return out.map((s) => newSource(s.name, s.kind, s.lines.join('\n').trim()));
  }
  /**
   * The first beta saved one draft and one session under
   * flux_teacher.beta.v1. Each becomes a study set; every word the student
   * wrote (warm-up, explanations, practice answers, teach-back) is kept.
   */
  function migrateLegacy(raw) {
    if (!plainObject(raw)) return [];
    const out = [];
    const s = plainObject(raw.session) && typeof raw.session.topic === 'string' ? raw.session : null;
    if (s) {
      const set = newSet({ title: s.topic.trim() || 'Study session', subject: str(s.subject), link: s.sourceUrl });
      set.sources = splitLegacyMaterial(s.material, s.attachments, s.sourceTitle);
      const notes = [];
      if (str(s.question).trim()) notes.push({ label: 'The question you were studying', prompt: '', text: s.question });
      if (str(s.warmup).trim()) notes.push({ label: 'What you knew at the start', prompt: '', text: s.warmup });
      const paras = legacyParagraphs(s.material);
      const explain = plainObject(s.explain) ? s.explain : {};
      Object.keys(explain).sort((a, b) => Number(a) - Number(b)).forEach((k) => {
        if (typeof explain[k] === 'string' && explain[k].trim()) {
          notes.push({ label: 'Your explanation of section ' + (Number(k) + 1), prompt: paras[Number(k)] || '', text: explain[k] });
        }
      });
      const prompts = legacyPrompts(s);
      const answers = plainObject(s.answers) ? s.answers : {};
      Object.keys(answers).sort((a, b) => Number(a) - Number(b)).forEach((k) => {
        if (typeof answers[k] === 'string' && answers[k].trim()) {
          notes.push({ label: 'Your practice answer', prompt: prompts[Number(k)] || '', text: answers[k] });
        }
      });
      if (str(s.teachback).trim()) notes.push({ label: 'Your teach-back', prompt: '', text: s.teachback });
      const conf = { again: 'I need to revisit it', 'getting-there': 'I am getting there', 'teach-it': 'I could teach this' }[s.confidence];
      if (conf) notes.push({ label: 'How ready you felt', prompt: '', text: conf });
      set.legacy = { from: 'flux_teacher.beta.v1', notes };
      if (isoOr(s.completedAt, '')) set.studiedAt = isoOr(s.completedAt, '');
      out.push(normalizeSet(set));
    }
    const d = plainObject(raw.draft) ? raw.draft : null;
    if (d) {
      const fields = ['topic', 'subject', 'sourceTitle', 'sourceUrl', 'material', 'question'];
      const has = fields.some((k) => typeof d[k] === 'string' && d[k].trim());
      const same = s && ['topic', 'material', 'question'].every((k) => str(d[k]).trim() === str(s[k]).trim());
      if (has && !same) {
        const set = newSet({ title: str(d.topic).trim() || 'Untitled draft', subject: str(d.subject), link: d.sourceUrl });
        set.sources = splitLegacyMaterial(d.material, d.attachments, d.sourceTitle);
        set.legacy = { from: 'flux_teacher.beta.v1 (draft)', notes: str(d.question).trim() ? [{ label: 'The question you were studying', prompt: '', text: d.question }] : [] };
        out.push(normalizeSet(set));
      }
    }
    return out.filter(Boolean);
  }

  /* ── Export and import ──────────────────────────────────────────────── */

  function exportSet(set) {
    return { format: 'flux-tutor-set', version: VERSION, app: 'Flux Tutor', exportedAt: new Date().toISOString(), set: normalizeSet(set) };
  }
  function exportLibrary(sets) {
    return { format: 'flux-tutor-library', version: VERSION, app: 'Flux Tutor', exportedAt: new Date().toISOString(), sets: (sets || []).map(normalizeSet).filter(Boolean) };
  }
  /**
   * Read a file someone picked to import. Returns { sets, skipped, error }.
   * Only Flux Tutor exports (one set or a library backup) and the first
   * beta's saved data are accepted; anything else gets a plain reason.
   */
  const IMPORT_MAX_CHARS = 40 * 1024 * 1024;
  function parseImport(text) {
    if (typeof text === 'string' && text.length > IMPORT_MAX_CHARS) {
      return { sets: [], skipped: 0, error: 'This file is too big to be a Flux Tutor export (over 40 MB).' };
    }
    let data;
    try { data = JSON.parse(String(text || '')); } catch (_) {
      return { sets: [], skipped: 0, error: 'This file is not a Flux Tutor export. Choose a .json file that Flux Tutor saved.' };
    }
    if (!plainObject(data)) return { sets: [], skipped: 0, error: 'This file is not a Flux Tutor export.' };
    let raw;
    if (data.format === 'flux-tutor-set') raw = [data.set];
    else if (data.format === 'flux-tutor-library') raw = Array.isArray(data.sets) ? data.sets : [];
    else if (data.draft || data.session) {
      const sets = migrateLegacy(data);
      return sets.length ? { sets, skipped: 0, error: '' } : { sets: [], skipped: 0, error: 'This file has no study sets that Flux Tutor can read.' };
    } else return { sets: [], skipped: 0, error: 'This file is not a Flux Tutor export.' };
    if (Number(data.version) > VERSION) {
      return { sets: [], skipped: 0, error: 'This file was saved by a newer version of Flux Tutor. Reload the page to update, then try again.' };
    }
    const sets = raw.slice(0, 500).map(normalizeSet).filter((s) => s && (s.title || s.sources.length));
    const skipped = raw.length - sets.length;
    if (!sets.length) return { sets: [], skipped, error: 'This file has no study sets that Flux Tutor can read.' };
    sets.forEach((s) => { s.deletedAt = ''; });
    return { sets, skipped, error: '' };
  }

  function mdQuote(text) {
    return String(text || '').split('\n').map((l) => '> ' + l).join('\n');
  }
  /** The study guide as a Markdown file: for printing or a notes app. */
  function toMarkdown(set) {
    const s = normalizeSet(set);
    const out = [];
    out.push('# ' + (s.title || 'Untitled study set'), '');
    out.push([s.subject, s.examDate ? 'Exam ' + s.examDate : '', 'Flux Tutor study guide'].filter(Boolean).join(' · '));
    const g = s.guide;
    if (g && g.outline.length) {
      out.push('', '## Outline', '');
      g.outline.forEach((o) => {
        out.push('  '.repeat(o.level - 1) + '- **' + o.title + '**');
        o.summary.forEach((p) => out.push('  '.repeat(o.level) + '- ' + p.text + ' _(' + formatRef(p.ref) + ')_'));
      });
    }
    if (g && g.terms.length) {
      out.push('', '## Key terms', '');
      g.terms.forEach((t) => out.push('- **' + t.term + '**: ' + t.def + ' _(' + formatRef(t.ref || (t.edited ? { edited: true } : null)) + ')_'));
    }
    if (g && g.facts.length) {
      out.push('', '## Key facts', '');
      g.facts.forEach((f) => out.push('- ' + f.text + ' _(' + formatRef(f.ref || (f.edited ? { edited: true } : null)) + ')_'));
    }
    if (s.legacy && s.legacy.notes.length) {
      out.push('', '## From the first Flux Tutor beta', '');
      s.legacy.notes.forEach((n) => {
        out.push('**' + n.label + '**', '');
        if (n.prompt) out.push(mdQuote(n.prompt), '');
        out.push(n.text, '');
      });
    }
    out.push('', '## Sources', '');
    s.sources.forEach((src) => out.push('### ' + src.name + ' (' + src.kind + ')', '', src.text.trim() || '(empty)', ''));
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /* ── A built-in sample, for trying it out ───────────────────────────── */

  const SAMPLE = {
    title: 'Sample: Cells and energy',
    subject: 'Biology',
    sources: [{
      name: 'Sample biology notes',
      kind: 'Sample',
      text: [
        '# Cells and energy',
        '',
        '## Cell structure',
        'The cell is the basic unit of life. Organelles are specialised structures inside a cell that each carry out a particular job.',
        '',
        'The nucleus is the organelle that contains the cell\'s DNA and controls its activities. Ribosomes are tiny structures that build proteins. Mitochondria are the organelles where aerobic respiration releases energy from glucose.',
        '',
        'The cell membrane is a thin layer that controls what enters and leaves the cell. Plant cells also have a cell wall. The cell wall is a rigid layer made of cellulose that supports the cell. Chloroplasts are organelles in plant cells that carry out photosynthesis.',
        '',
        '## The history of cell theory',
        'In 1665, Robert Hooke looked at thin slices of cork through a microscope and called the tiny boxes he saw "cells". In 1838 and 1839, Matthias Schleiden and Theodor Schwann proposed that all living things are made of cells. In 1855, Rudolf Virchow argued that all cells come from existing cells.',
        '',
        '## Photosynthesis',
        'Photosynthesis is the process plants use to make glucose from carbon dioxide and water using light energy. It takes place in the chloroplasts. Chlorophyll is the green pigment that absorbs light energy.',
        '',
        'The word equation for photosynthesis is: carbon dioxide + water → glucose + oxygen. Oxygen is released as a by-product. For example, the bubbles that rise from pondweed in bright light are oxygen.',
        '',
        'Because light provides the energy, the rate of photosynthesis increases as light intensity increases, until another factor runs short. A limiting factor is the condition in shortest supply that stops the rate rising any further. Carbon dioxide concentration and temperature can also be limiting factors.',
        '',
        '## Respiration',
        'Aerobic respiration is the release of energy from glucose using oxygen. It produces carbon dioxide and water. Anaerobic respiration is the release of energy from glucose without oxygen.',
        '',
        'During hard exercise, muscles may not get enough oxygen, so they respire anaerobically. In human muscles, anaerobic respiration produces lactic acid. Anaerobic respiration releases much less energy than aerobic respiration: about 2 ATP per glucose molecule, compared with about 30 to 32 ATP for aerobic respiration.',
        '',
        'ATP (adenosine triphosphate) is the molecule cells use to store and transfer energy. Muscle cells contain many mitochondria because they need a lot of ATP.',
        '',
        '## Moving substances',
        'Diffusion is the net movement of particles from an area of higher concentration to an area of lower concentration. Osmosis is the diffusion of water across a partially permeable membrane. Active transport moves substances against a concentration gradient, so it needs energy from respiration.',
        '',
        '## Glossary',
        'Enzyme – a protein that speeds up chemical reactions without being used up.',
        'Glucose – a sugar that cells use as their main source of energy.',
      ].join('\n'),
    }],
  };
  function sampleSet() {
    const set = newSet({ title: SAMPLE.title, subject: SAMPLE.subject });
    set.sources = SAMPLE.sources.map((s) => newSource(s.name, s.kind, s.text));
    return set;
  }

  root.FluxTutor = {
    VERSION, LIMITS, KINDS, QTYPES, MASTERED, MAX_LEVEL,
    uid, hashText, seeded, shuffle, safeUrl, cap, ymd, isYmd, addDays, daysBetween,
    tokenize, words, stem, norm, lev, normalizeText, pdfLinesToText, splitSentences,
    buildCorpus, formatRef, measure, mentionsOf,
    findDefinition, extractTerms, extractFacts, buildOutline, buildGuide, mergeGuide, sourcesHash,
    addTerm, addFact, editItem, removeItem, restoreItem,
    conceptsFromGuide, topicsFor, explanationFor, maskTerm,
    makeCloze, makeWritten, makeChoice, makeDefChoice, makeTrueFalse, makeMatch, questionFor, typesForLevel,
    checkAnswer, isRight, answerText, slips, osa,
    newMastery, applyResult, statusOf, weakness, masterySummary,
    startLearn, answerCheck, finishCheck, nextStep, currentStep, answerStep, dontKnow, skipStep, repeatStep, backStep, atLatest, learnSummary,
    simplerFor, examplesFor,
    buildPracticeTest, gradePracticeTest,
    buildSearchIndex, searchNotes, highlightSegments,
    buildStudyPlan,
    newSet, newSource, normalizeSet, cloneSet, guideStale, hasNotes, summarizeSet, wordCount,
    cardList, cardQueue, cardCounts, flashDeckFrom,
    migrateLegacy, splitLegacyMaterial,
    exportSet, exportLibrary, parseImport, toMarkdown,
    SAMPLE, sampleSet,
  };
})();
