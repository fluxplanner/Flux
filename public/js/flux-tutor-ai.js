/* ============================================================================
   FLUX TUTOR · AI  ·  flux-tutor-ai.js
   Flux AI inside Flux Tutor: an examiner that marks written answers against
   the markscheme, new exam-style questions written from the student's notes,
   a tutor to chat with, "Teach it back", a check of a blurt, mock orals, and
   criterion-by-criterion feedback on IA, EE and TOK drafts.

   HOW IT STAYS HONEST
   -------------------
   - Marking: the examiner may only give a mark when it quotes the words in
     the student's answer that earn it, and the quote is checked here against
     the answer. A mark with no real quote is not given. The same answer to
     the same question is marked once and remembered, so asking again gives
     the same mark.
   - Questions: every markscheme point must name the passage of the notes it
     comes from; a point naming no real passage throws the question away.
   - Chat: answers cite the notes' passages as [1], [2]. Anything from beyond
     the notes has to sit in its own paragraph that says so, and is shown that
     way.
   - Coursework: feedback only. The examiner is told never to rewrite the
     student's work, and quotes it points at must really be in the draft.

   The prompt builders and the parsers below are plain functions with no DOM
   and no network, so test/unit/tutor-ai.test.mjs runs them in a bare VM.

   SIGNING IN
   ----------
   Flux AI needs a Flux account (the server meters it per person). A planner
   session in this browser is borrowed while it is fresh; otherwise the
   student signs in here, and that session is Tutor's own (its own key, its
   own refresh), so Tutor never rotates the planner's refresh token.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxTutorAI) return;

  const ENABLED = true;
  const OWN_KEY = 'flux_tutor_session';
  const PLANNER_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
  const CACHE_KEY = 'flux_tutor_ai_cache.v1';
  const CACHE_MAX = 150;
  const USER_DOMAIN = 'users.fluxplanner.app';
  function SB() { return root.FluxSB || {}; }

  /* ── Small helpers ──────────────────────────────────────────────────── */

  function str(v, max) { return typeof v === 'string' ? (max ? v.slice(0, max) : v) : ''; }
  function plainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function hash(text) {
    let h = 0x811c9dc5;
    const s = String(text == null ? '' : text);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** Lower case, straight quotes, one space: how quotes are matched against the student's text. */
  function flat(s) {
    return String(s || '').toLowerCase()
      .replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .replace(/[^\p{L}\p{N}'"%.,;:=+\-/ ]+/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  /** Is `quote` (ignoring case, spacing and punctuation at its ends) in `text`? */
  function quoted(text, quote) {
    const q = flat(quote).replace(/^[\s.,;:'"-]+|[\s.,;:'"-]+$/g, '');
    if (q.length < 2) return false;
    return flat(text).indexOf(q) >= 0;
  }
  /** The JSON object in a model's reply (which may wrap it in a code fence or a sentence). */
  function parseJson(text) {
    const t = String(text || '').replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(t); } catch (_) { /* look for the object */ }
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { return null; }
  }
  function clampInt(v, lo, hi, dflt) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function strs(v, max, len) { return list(v).filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim().slice(0, len)); }
  function wordsIn(text) { const m = String(text || '').match(/[\p{L}\p{N}]+/gu); return m ? m.length : 0; }

  /* ── IB command terms ───────────────────────────────────────────────── */

  const COMMANDS = {
    Calculate: { level: 1, meaning: 'Obtain a numerical answer showing the relevant stages in the working.' },
    Define: { level: 1, meaning: 'Give the precise meaning of a word, phrase, concept or physical quantity.' },
    Identify: { level: 1, meaning: 'Provide an answer from a number of possibilities.' },
    List: { level: 1, meaning: 'Give a sequence of brief answers with no explanation.' },
    State: { level: 1, meaning: 'Give a specific name, value or other brief answer without explanation or calculation.' },
    Outline: { level: 2, meaning: 'Give a brief account or summary.' },
    Describe: { level: 2, meaning: 'Give a detailed account.' },
    Distinguish: { level: 2, meaning: 'Make clear the differences between two or more concepts or items.' },
    Estimate: { level: 2, meaning: 'Obtain an approximate value.' },
    Analyse: { level: 3, meaning: 'Break down in order to bring out the essential elements or structure.' },
    Compare: { level: 3, meaning: 'Give an account of the similarities between two (or more) items, referring to both of them throughout.' },
    'Compare and contrast': { level: 3, meaning: 'Give an account of similarities and differences between two (or more) items, referring to both of them throughout.' },
    Deduce: { level: 3, meaning: 'Reach a conclusion from the information given.' },
    Explain: { level: 3, meaning: 'Give a detailed account including reasons or causes.' },
    Predict: { level: 3, meaning: 'Give an expected result.' },
    Suggest: { level: 3, meaning: 'Propose a solution, hypothesis or other possible answer.' },
    Discuss: { level: 3, meaning: 'Offer a considered and balanced review that includes a range of arguments, factors or hypotheses, supported by appropriate evidence.' },
    Evaluate: { level: 3, meaning: 'Make an appraisal by weighing up the strengths and limitations.' },
    'To what extent': { level: 3, meaning: 'Consider the merits or otherwise of an argument or concept, with a clear and balanced conclusion supported by evidence.' },
  };

  /* ── Coursework and orals: the IB's assessment criteria ─────────────── */

  /*
   * Criteria as the current subject guides give them. The screen tells the
   * student to check their own guide, since a school may still be on an older
   * one. kind: 'written' (paste a draft) or 'oral' (a spoken mock with an
   * examiner asking follow-up questions).
   */
  const COMPONENTS = [
    { id: 'tok-essay', group: 'TOK', kind: 'written', name: 'TOK essay', words: 1600, note: 'One mark out of 10 for the whole essay.',
      criteria: [{ id: 'TOK', name: 'A clear, coherent and critical exploration of the prescribed title', max: 10,
        bands: 'Excellent 9–10: focused on the title throughout, links to areas of knowledge clear, effective real examples, counterclaims explored, implications drawn. Very good 7–8. Good 5–6. Adequate 3–4: some links to the title, examples not always effective. Rudimentary 1–2.' }] },
    { id: 'tok-exhibition', group: 'TOK', kind: 'written', name: 'TOK exhibition', words: 950, note: 'Three objects, one IA prompt, one mark out of 10.',
      criteria: [{ id: 'TOK', name: 'How well the exhibition shows TOK in the world around us', max: 10,
        bands: 'Excellent 9–10: three objects and their real-world contexts identified, links to the IA prompt clearly explained, each inclusion justified with evidence and specific to the object. Good 5–6. Adequate 3–4. Rudimentary 1–2.' }] },
    { id: 'ee', group: 'EE', kind: 'written', name: 'Extended essay', words: 4000, note: 'Criteria for first assessment 2027 (out of 30).',
      criteria: [
        { id: 'A', name: 'Framework for the essay', max: 6, bands: 'Topic and research question clear and focused; methods and sources appropriate and justified; structure supports the argument.' },
        { id: 'B', name: 'Knowledge and understanding', max: 6, bands: 'Relevant, accurate knowledge of the topic and its context; subject terms and concepts used precisely.' },
        { id: 'C', name: 'Analysis and line of argument', max: 6, bands: 'Sources and data analysed, not just described; a coherent argument that answers the research question.' },
        { id: 'D', name: 'Discussion and evaluation', max: 8, bands: 'Conclusions supported by the analysis; strengths and limitations of the research and its sources weighed.' },
        { id: 'E', name: 'Reflection', max: 4, bands: 'Reflection on the research process, choices made and what was learned.' },
      ] },
    { id: 'sci-ia', group: 'IA', kind: 'written', name: 'Science IA (Biology, Chemistry, Physics)', words: 3000, note: 'Criteria for first assessment 2025 (out of 24).',
      criteria: [
        { id: 'RD', name: 'Research design', max: 6, bands: 'Focused research question in context; methodology appropriate and described so it could be repeated; variables, controls, safety and data collection explained.' },
        { id: 'DA', name: 'Data analysis', max: 6, bands: 'Recording and processing clear, precise and accurate; uncertainties considered; processing fits the question; tables and graphs clear.' },
        { id: 'CO', name: 'Conclusion', max: 6, bands: 'Conclusion relevant to the research question and justified by the data; compared with accepted scientific context.' },
        { id: 'EV', name: 'Evaluation', max: 6, bands: 'Weaknesses and limitations of the method explained with their effect; realistic, relevant improvements and extensions.' },
      ] },
    { id: 'math-ia', group: 'IA', kind: 'written', name: 'Maths exploration (AA or AI)', words: 0, note: '12–20 pages, out of 20.',
      criteria: [
        { id: 'A', name: 'Presentation', max: 4, bands: 'Coherent, well organised and concise, with an introduction, aim and conclusion.' },
        { id: 'B', name: 'Mathematical communication', max: 4, bands: 'Correct notation, symbols and terminology; key terms defined; graphs and tables labelled; consistent throughout.' },
        { id: 'C', name: 'Personal engagement', max: 3, bands: 'Clear evidence of personal engagement: own ideas, independent thinking, creativity.' },
        { id: 'D', name: 'Reflection', max: 3, bands: 'Critical reflection on results, methods and limitations throughout, not just at the end.' },
        { id: 'E', name: 'Use of mathematics', max: 6, bands: 'Mathematics relevant, correct and at the level of the course; understanding shown, not just results.' },
      ] },
    { id: 'econ-ia', group: 'IA', kind: 'written', name: 'Economics IA commentary', words: 800, note: 'One commentary. Check the criteria against your guide.',
      criteria: [
        { id: 'A', name: 'Diagrams', max: 3, bands: 'Relevant, accurate diagrams, fully explained and linked to the article.' },
        { id: 'B', name: 'Terminology', max: 2, bands: 'Relevant economic terms used appropriately throughout.' },
        { id: 'C', name: 'Application', max: 3, bands: 'Economic theory applied effectively to the article.' },
        { id: 'D', name: 'Analysis', max: 3, bands: 'Effective economic analysis relating to the article.' },
        { id: 'E', name: 'Key concept', max: 3, bands: 'The chosen key concept identified and used effectively.' },
        { id: 'F', name: 'Evaluation', max: 3, bands: 'Judgements supported by effective, balanced reasoning.' },
      ] },
    { id: 'lit-essay', group: 'IA', kind: 'written', name: 'English A HL essay', words: 1500, note: '1200–1500 words, out of 20.',
      criteria: [
        { id: 'A', name: 'Knowledge, understanding and interpretation', max: 5, bands: 'Thorough knowledge of the work; persuasive interpretation supported by well-chosen references.' },
        { id: 'B', name: 'Analysis and evaluation', max: 5, bands: 'Insightful analysis of how the writer\'s choices shape meaning.' },
        { id: 'C', name: 'Focus, organization and development', max: 5, bands: 'Effectively organised, coherent and well developed line of inquiry.' },
        { id: 'D', name: 'Language', max: 5, bands: 'Clear, carefully chosen, accurate language; register and style effective.' },
      ] },
    { id: 'custom', group: 'IA', kind: 'written', name: 'Another IA (paste the criteria)', words: 0, note: 'Paste the criteria from your subject guide or your teacher, one per line, like "A. Research design (6)".', criteria: [] },
    { id: 'eng-io', group: 'Oral', kind: 'oral', name: 'English A individual oral', words: 0, note: '10 minutes on a global issue, then 5 minutes of questions. Out of 40.',
      opener: 'Tell me the global issue you have chosen and the two works you will use. Then begin your oral.',
      criteria: [
        { id: 'A', name: 'Knowledge, understanding and interpretation', max: 10, bands: 'Knowledge of both works and how they present the global issue, supported by references.' },
        { id: 'B', name: 'Analysis and evaluation', max: 10, bands: 'How the authors\' choices present the global issue.' },
        { id: 'C', name: 'Focus and organization', max: 10, bands: 'A balanced, focused and well structured oral.' },
        { id: 'D', name: 'Language', max: 10, bands: 'Clear, accurate, varied language with a suitable register.' },
      ] },
    { id: 'langb-io', group: 'Oral', kind: 'oral', name: 'Language B individual oral', words: 0, note: 'A visual stimulus linked to a theme, then a conversation. Out of 30. Answer in the language you study.',
      opener: 'Describe the image you have chosen and link it to the theme and to the culture of the language you study.',
      criteria: [
        { id: 'A', name: 'Language', max: 12, bands: 'Vocabulary and grammar varied and accurate; pronunciation and intonation clear.' },
        { id: 'B1', name: 'Message: visual stimulus', max: 6, bands: 'Presentation relevant to the stimulus and linked to the target culture.' },
        { id: 'B2', name: 'Message: conversation', max: 6, bands: 'Answers relevant, developed and detailed.' },
        { id: 'C', name: 'Interactive skills', max: 6, bands: 'Understands and keeps the conversation going naturally.' },
      ] },
  ];

  /* ── Signing in and calling Flux AI ─────────────────────────────────── */

  function readLs(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (_) { return null; }
  }
  function writeLs(key, v) {
    try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* storage blocked */ }
  }
  function pack(j) {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || (now + (j.expires_in || 3600)),
      user: j.user ? { id: j.user.id, user_metadata: j.user.user_metadata || {} } : null,
    };
  }
  let refreshing = null;
  function refreshOwn(s) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const res = await fetch(SB().url + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { apikey: SB().anon, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        if (!res.ok) { writeLs(OWN_KEY, null); return null; }
        const next = pack(await res.json());
        writeLs(OWN_KEY, next);
        return next;
      } catch (_) {
        return null;
      } finally {
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
    return refreshing;
  }
  /** The planner's session in this browser, when fresh. */
  function plannerSession() {
    const p = readLs(PLANNER_KEY);
    const ps = p && (p.currentSession || p);
    return ps && ps.access_token && ps.expires_at && ps.expires_at - 60 > Date.now() / 1000 ? ps : null;
  }
  /** { token, user } for this browser, or null when the student needs to sign in. Never prompts. */
  async function session() {
    const now = Math.floor(Date.now() / 1000);
    let own = readLs(OWN_KEY);
    if (own && own.access_token) {
      if (!own.expires_at || own.expires_at - 60 < now) own = own.refresh_token ? await refreshOwn(own) : null;
      if (own && own.access_token) return { token: own.access_token, user: own.user || null };
    }
    const ps = plannerSession();
    return ps ? { token: ps.access_token, user: ps.user || null } : null;
  }
  async function token() { const s = await session(); return s ? s.token : ''; }
  /** Whether a sign-in is known in this browser (without refreshing it). */
  function signedIn() {
    const own = readLs(OWN_KEY);
    return !!(own && own.refresh_token) || !!plannerSession();
  }
  function user() {
    const own = readLs(OWN_KEY);
    const ps = plannerSession();
    return (own && own.user) || (ps && ps.user) || null;
  }
  function userName() {
    const meta = (user() && user().user_metadata) || {};
    return String(meta.full_name || meta.name || '').trim();
  }
  function normalizeUsername(raw) {
    return String(raw || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
      .replace(/\.{2,}/g, '.').replace(/^[.\-_]+|[.\-_]+$/g, '');
  }
  async function signIn(name, password) {
    const raw = String(name || '').trim();
    const folded = normalizeUsername(raw);
    const email = raw.indexOf('@') > 0 ? raw.toLowerCase() : (folded ? folded + '@' + USER_DOMAIN : '');
    if (!email) return { error: 'Type the name you sign in to Flux with.' };
    if (!password) return { error: 'Type your password.' };
    let res;
    try {
      res = await fetch(SB().url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: SB().anon, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (_) {
      return { error: 'Could not reach Flux. Check your connection and try again.' };
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) return { error: 'That name and password do not match a Flux account.' };
      if (res.status === 429) return { error: 'Too many tries. Wait a minute and try again.' };
      return { error: 'Sign-in did not work (' + res.status + '). Try again.' };
    }
    writeLs(OWN_KEY, pack(j));
    return { ok: true };
  }
  /** Signs Tutor's own session out on this device only (scope=local: other devices stay signed in). */
  function signOut() {
    const own = readLs(OWN_KEY);
    writeLs(OWN_KEY, null);
    if (own && own.access_token) {
      fetch(SB().url + '/auth/v1/logout?scope=local', {
        method: 'POST', headers: { apikey: SB().anon, Authorization: 'Bearer ' + own.access_token },
      }).catch(() => {});
    }
  }

  class AiError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  function errorFor(status, body) {
    const code = body && body.error;
    if (status === 401 || code === 'auth_required') return new AiError('signin', 'Sign in to Flux to use Flux AI. It is free.');
    if (status === 429 && (code === 'daily_limit_reached' || code === 'guest_daily_limit')) return new AiError('limit', 'You have used today\'s Flux AI. It comes back tomorrow, and everything else in Flux Tutor still works.');
    if (status === 429) return new AiError('busy', 'Flux AI is busy right now. Wait a few seconds and try again.');
    if (status === 413) return new AiError('big', 'That is too long for Flux AI in one go. Try a shorter part.');
    return new AiError('down', 'Flux AI is not available right now (' + status + '). Try again in a minute.');
  }
  /**
   * One request to Flux AI. opts: { system, messages, json, onDelta(textSoFar) }.
   * With onDelta the reply streams in. Resolves to the reply's text.
   */
  async function call(opts) {
    if (!ENABLED) throw new AiError('off', 'Flux AI is switched off.');
    const tok = await token();
    if (!tok) throw new AiError('signin', 'Sign in to Flux to use Flux AI. It is free.');
    const stream = typeof opts.onDelta === 'function' && !opts.json;
    const body = { messages: [{ role: 'system', content: opts.system }].concat(opts.messages) };
    if (opts.json) body.responseFormat = 'json_object';
    if (stream) body.stream = true;
    let res;
    try {
      res = await fetch(SB().url + '/functions/v1/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: SB().anon },
        body: JSON.stringify(body),
      });
    } catch (_) {
      throw new AiError('offline', 'Could not reach Flux AI. Check your connection.');
    }
    if (!res.ok) throw errorFor(res.status, await res.json().catch(() => null));
    const type = res.headers.get('content-type') || '';
    if (stream && type.indexOf('text/event-stream') >= 0 && res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let text = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j = null;
          try { j = JSON.parse(data); } catch (_) { continue; }
          if (j && typeof j.delta === 'string') { text += j.delta; opts.onDelta(text); }
          else if (j && j.error) throw new AiError('down', 'Flux AI stopped part way. Try again.');
        }
      }
      return text;
    }
    const data = await res.json().catch(() => null);
    const text = (data && data.content && data.content[0] && data.content[0].text) || '';
    if (stream && text) opts.onDelta(text);
    return text;
  }

  /* ── Remembered results (same answer, same mark) ────────────────────── */

  function cacheGet(key) {
    const c = readLs(CACHE_KEY);
    return c && plainObject(c[key]) ? c[key].v : null;
  }
  function cachePut(key, value) {
    const c = readLs(CACHE_KEY) || {};
    c[key] = { t: Date.now(), v: value };
    const keys = Object.keys(c);
    if (keys.length > CACHE_MAX) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - CACHE_MAX).forEach((k) => { delete c[k]; });
    writeLs(CACHE_KEY, c);
  }
  async function cached(kind, payload, run) {
    const key = kind + ':' + hash(JSON.stringify(payload));
    const hit = cacheGet(key);
    if (hit) return Object.assign({}, hit, { fromCache: true });
    const out = await run();
    if (out && !out.failed) cachePut(key, out);
    return out;
  }

  function passagesBlock(passages) {
    return passages.map((p, i) => '[' + (i + 1) + '] ' + String(p.text).slice(0, 700)).join('\n');
  }

  /* ── 1. The examiner: marking a written answer ──────────────────────── */

  const MARK_SYSTEM = [
    'You are a strict, fair IB examiner marking one written answer against its markscheme.',
    'Rules:',
    '- Each markscheme point is worth one mark. Award it only when the answer clearly makes that point; correct paraphrase counts, a vague or partly wrong mention does not.',
    '- For every point you award, copy into "evidence" the exact words from the student\'s answer that earn it (a short phrase, copied character for character). If you cannot quote it, do not award it.',
    '- Judge the science or argument, not spelling or style. Respect the command term: "Explain" needs reasons, "Compare" needs both items, "Define" needs precision.',
    '- If the answer contains a wrong statement, put it in "wrong".',
    'Reply ONLY with JSON in this shape:',
    '{"points":[{"n":1,"met":true,"evidence":"…","note":"under 20 words: why, or what is missing"}],"wrong":["…"],"comment":"two sentences an examiner would write","next":"the one thing to add for full marks","model":"a full-mark answer in 1-4 sentences","confidence":"high|medium|low"}',
  ].join('\n');

  function markPrompt(q, answer) {
    const term = COMMANDS[q.command] || { meaning: '' };
    return [
      'Question (' + q.marks + ' mark' + (q.marks === 1 ? '' : 's') + '): ' + q.prompt,
      'Command term "' + q.command + '": ' + term.meaning,
      'Markscheme:',
      q.scheme.map((p, i) => (i + 1) + '. ' + p.text).join('\n'),
      '',
      'Student\'s answer:',
      '"""' + String(answer || '').slice(0, 4000) + '"""',
    ].join('\n');
  }
  /**
   * The examiner's reply, checked: a point counts only with a real quote from
   * the answer. Returns { awarded, marks, points:[{ met, claimed, evidence, note }],
   * wrong, comment, next, model, confidence } or { failed: true }.
   */
  function parseMark(text, q, answer) {
    const j = parseJson(text);
    if (!plainObject(j) || !Array.isArray(j.points)) return { failed: true };
    const points = q.scheme.map((p, i) => {
      const got = j.points.find((x) => plainObject(x) && Number(x.n) === i + 1) || j.points[i] || {};
      const evidence = str(got.evidence, 400).trim();
      const said = got.met === true || got.met === 'true';
      const verified = said && quoted(answer, evidence);
      return { met: verified, claimed: said, evidence: verified ? evidence : '', note: str(got.note, 240).trim() };
    });
    const awarded = Math.min(q.marks, points.filter((p) => p.met).length);
    const confidence = ['high', 'medium', 'low'].includes(j.confidence) ? j.confidence : 'medium';
    return {
      awarded,
      marks: q.marks,
      points,
      wrong: strs(j.wrong, 4, 300),
      comment: str(j.comment, 600).trim(),
      next: str(j.next, 400).trim(),
      model: str(j.model, 900).trim(),
      // An award the examiner could not back with a quote lowers how sure it is.
      confidence: points.some((p) => p.claimed && !p.met) ? 'low' : confidence,
    };
  }
  function markAnswer(q, answer) {
    const a = String(answer || '').trim();
    if (!a) return Promise.resolve({ awarded: 0, marks: q.marks, points: q.scheme.map(() => ({ met: false, claimed: false, evidence: '', note: '' })), wrong: [], comment: 'No answer was written.', next: '', model: '', confidence: 'high' });
    return cached('mark', { p: q.prompt, s: q.scheme.map((x) => x.text), a }, async () => {
      const text = await call({ system: MARK_SYSTEM, messages: [{ role: 'user', content: markPrompt(q, a) }], json: true });
      return parseMark(text, q, a);
    });
  }

  /* ── 2. New exam-style questions from the notes ─────────────────────── */

  const QGEN_SYSTEM = [
    'You write IB exam-style written questions (like Paper 2) from a student\'s own notes, given as numbered passages.',
    'Rules:',
    '- Use only what the passages say. Every markscheme point must be a fact from one passage; give that passage\'s number as "p".',
    '- Use real IB command terms (Define, State, Identify, Outline, Describe, Distinguish, Explain, Compare, Compare and contrast, Suggest, Deduce, Analyse, Discuss, Evaluate, To what extent). Pick the term the notes can support.',
    '- Marks = number of markscheme points (1 to 6). Higher-mark questions use higher-order command terms.',
    '- Vary them: different parts of the notes, different command terms. Make them read like a real exam, with context where it helps.',
    'Reply ONLY with JSON: {"questions":[{"command":"Explain","prompt":"…","scheme":[{"text":"one markable point","p":2}]}]}',
  ].join('\n');
  function questionsPrompt(passages, opts) {
    const o = opts || {};
    return 'Programme: ' + (o.programme === 'MYP' ? 'IB MYP' : 'IB Diploma (DP)') + (o.subject ? ', ' + o.subject : '') + (o.hl === false ? ' SL' : o.hl ? ' HL' : '') + '.\n'
      + 'Write ' + clampInt(o.count, 1, 10, 4) + ' questions'
      + (o.level === 1 ? ' that test recall (1–2 marks each)' : o.level === 2 ? ' that test understanding (2–4 marks each)' : o.level === 3 ? ' that test application and evaluation (4–6 marks each)' : ' of mixed difficulty')
      + '.\n\nPassages:\n' + passagesBlock(passages);
  }
  /** Validated questions in Flux Tutor's question shape, or []. */
  function parseQuestions(text, passages, opts) {
    const o = opts || {};
    const j = parseJson(text);
    if (!plainObject(j) || !Array.isArray(j.questions)) return [];
    const out = [];
    j.questions.forEach((raw, i) => {
      if (!plainObject(raw)) return;
      const command = Object.keys(COMMANDS).find((k) => k.toLowerCase() === String(raw.command || '').trim().toLowerCase());
      const prompt = str(raw.prompt, 600).trim();
      if (!command || prompt.length < 8) return;
      const scheme = list(raw.scheme).filter(plainObject).map((pt) => {
        const n = Number(pt.p);
        const src = Number.isInteger(n) && n >= 1 && n <= passages.length ? passages[n - 1] : null;
        const t = str(pt.text, 400).trim();
        return src && t ? { text: t, ref: src.ref || null, sentenceId: src.sentenceId || '', source: src.text } : null;
      });
      // A point with no real passage: the whole question goes.
      if (!scheme.length || scheme.some((x) => !x) || scheme.length > 6) return;
      out.push({
        id: 'ai' + hash(prompt) + i,
        conceptIds: [],
        command,
        level: COMMANDS[command].level,
        programme: o.programme === 'MYP' ? 'MYP' : 'DP',
        paper: 2,
        prompt,
        marks: scheme.length,
        scheme,
        ai: true,
      });
    });
    return out;
  }
  async function makeQuestions(passages, opts) {
    const text = await call({ system: QGEN_SYSTEM, messages: [{ role: 'user', content: questionsPrompt(passages, opts) }], json: true });
    return parseQuestions(text, passages, opts);
  }

  /* ── 3. The tutor chat ──────────────────────────────────────────────── */

  const BEYOND = 'Beyond your notes:';
  function chatSystem(ctx) {
    const c = ctx || {};
    return [
      'You are Flux Tutor, a patient, encouraging IB tutor for a ' + (c.programme === 'MYP' ? 'MYP' : 'DP') + ' student' + (c.subject ? ' studying ' + c.subject : '') + (c.topic ? ' (' + c.topic + ')' : '') + '.',
      'You are given numbered passages from the student\'s own notes. Answer from them first and cite them like [2] or [1][3] at the end of the sentence that uses them.',
      'If you need knowledge the passages do not give, you may use what you know, but put all of it in one separate paragraph that begins exactly "' + BEYOND + '". Never cite a passage for something it does not say.',
      'Style: short and clear (under 160 words unless the student asks for more), plain words, one idea per sentence. You may use short bullet lines starting with "- ". No headings, no tables, no LaTeX.',
      'When asked to quiz, ask one question at a time and wait for the answer. When the student answers, say what was right, what was missing, then the full answer.',
      'Use IB command terms correctly. Never write coursework (IA, EE, TOK) for the student; explain and give feedback instead.',
    ].join('\n');
  }
  function chatMessages(history, passages, question) {
    const msgs = list(history).slice(-8).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
      .map((m) => ({ role: m.role, content: String(m.text).slice(0, 2000) }));
    msgs.push({ role: 'user', content: (passages.length ? 'Passages from my notes:\n' + passagesBlock(passages) + '\n\n' : 'My notes have nothing on this.\n\n') + 'My question: ' + String(question).slice(0, 1200) });
    return msgs;
  }
  /**
   * A chat reply split for drawing: [{ beyond, lines:[{ parts:[{ text } | { cite: n }], bullet }] }].
   * Citations to passages that do not exist, or inside "Beyond your notes", are dropped.
   */
  function parseChat(text, count) {
    const paras = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let beyond = false;
    return paras.map((p0) => {
      let p = p0;
      if (p.indexOf(BEYOND) === 0) { beyond = true; p = p.slice(BEYOND.length).trim(); }
      const lines = p.split('\n').filter((l) => l.trim()).map((line0) => {
        const bullet = /^\s*[-•*]\s+/.test(line0);
        const line = line0.replace(/^\s*[-•*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/, '');
        const parts = [];
        let last = 0;
        line.replace(/\[(\d{1,2})\]/g, (m, n, at) => {
          if (at > last) parts.push({ text: line.slice(last, at) });
          const k = Number(n);
          if (!beyond && k >= 1 && k <= count) parts.push({ cite: k });
          last = at + m.length;
          return m;
        });
        if (last < line.length) parts.push({ text: line.slice(last) });
        return { parts, bullet };
      });
      return { beyond, lines };
    });
  }
  function chat(history, passages, question, ctx, onDelta) {
    return call({ system: chatSystem(ctx), messages: chatMessages(history, passages, question), onDelta });
  }

  /* ── 4. Teach it back ───────────────────────────────────────────────── */

  const TEACH_SYSTEM = [
    'A student is teaching you a topic, as if you were a classmate who missed the lesson. Check their explanation against the passages from their notes.',
    'Reply ONLY with JSON: {"score":3,"right":["what they got right"],"missing":["important ideas from the passages they left out"],"wrong":[{"quote":"exact words from their explanation that are wrong","fix":"the correct idea","p":1}],"question":"one curious follow-up question a classmate would ask next","praise":"one short encouraging sentence"}',
    'score is 0 to 5: 5 = complete and accurate, 3 = main idea right with gaps, 1 = mostly missing or wrong. Each list at most 4 items, each under 25 words. Copy "quote" exactly from their explanation.',
  ].join('\n');
  function parseTeach(text, explanation, count) {
    const j = parseJson(text);
    if (!plainObject(j)) return { failed: true };
    return {
      score: clampInt(j.score, 0, 5, 0),
      right: strs(j.right, 4, 240),
      missing: strs(j.missing, 4, 240),
      wrong: list(j.wrong).filter((w) => plainObject(w) && quoted(explanation, w.quote)).slice(0, 4)
        .map((w) => ({ quote: str(w.quote, 240).trim(), fix: str(w.fix, 300).trim(), p: clampInt(w.p, 0, count, 0) })),
      question: str(j.question, 300).trim(),
      praise: str(j.praise, 200).trim(),
    };
  }
  function teachBack(topic, passages, explanation) {
    const e = String(explanation || '').trim();
    return cached('teach', { t: topic, e, p: passages.map((x) => x.text) }, async () => {
      const text = await call({ system: TEACH_SYSTEM, json: true, messages: [{ role: 'user', content: 'Topic: ' + topic + '\n\nPassages:\n' + passagesBlock(passages) + '\n\nMy explanation:\n"""' + e.slice(0, 3000) + '"""' }] });
      return parseTeach(text, e, passages.length);
    });
  }

  /* ── 5. Checking a blurt ────────────────────────────────────────────── */

  const BLURT_SYSTEM = [
    'A student wrote down everything they remember about a topic from memory. Compare it with the passages from their notes.',
    'Reply ONLY with JSON: {"wrong":[{"quote":"exact words from what they wrote that are wrong","fix":"the correct idea","p":1}],"tip":"one sentence on what to revise first"}',
    'Only list real errors, not things left out. At most 5. Copy "quote" exactly.',
  ].join('\n');
  function parseBlurt(text, blurt, count) {
    const j = parseJson(text);
    if (!plainObject(j)) return { failed: true };
    return {
      wrong: list(j.wrong).filter((w) => plainObject(w) && quoted(blurt, w.quote)).slice(0, 5)
        .map((w) => ({ quote: str(w.quote, 240).trim(), fix: str(w.fix, 300).trim(), p: clampInt(w.p, 0, count, 0) })),
      tip: str(j.tip, 300).trim(),
    };
  }
  function checkBlurt(topic, passages, blurt) {
    const b = String(blurt || '').trim();
    return cached('blurt', { t: topic, b, p: passages.map((x) => x.text) }, async () => {
      const text = await call({ system: BLURT_SYSTEM, json: true, messages: [{ role: 'user', content: 'Topic: ' + topic + '\n\nPassages:\n' + passagesBlock(passages) + '\n\nWhat I wrote:\n"""' + b.slice(0, 4000) + '"""' }] });
      return parseBlurt(text, b, passages.length);
    });
  }

  /* ── 6. Coursework feedback (IA, EE, TOK) ───────────────────────────── */

  const DRAFT_MAX = 26000;
  const COURSE_SYSTEM = [
    'You are an experienced IB moderator giving feedback on a student\'s coursework draft, criterion by criterion.',
    'Academic honesty: never rewrite the student\'s work and never write sentences for them to copy. Give feedback, point to where, and explain what an examiner looks for.',
    'For each criterion give the mark you would award now (a whole number from 0 to its maximum), what already works, and the fixes that would gain the most marks. When a fix is about a specific part, copy a short exact quote from the draft into "quote".',
    'Be honest: do not inflate marks. If the draft is short or missing a section, say so.',
    'Reply ONLY with JSON: {"criteria":[{"id":"A","mark":4,"working":["…"],"fixes":[{"quote":"…","advice":"…"}]}],"priorities":["the three changes that would gain the most marks, most important first"],"summary":"two sentences"}',
  ].join('\n');
  /** Parses criteria the student pasted ("A. Name (6)", "Criterion B: … 4 marks") into [{ id, name, max }]. */
  function customCriteria(text) {
    const out = [];
    String(text || '').split(/\n+/).forEach((line) => {
      const m = line.match(/^\s*(?:criterion\s+)?([A-Z]{1,2}\d?)\s*[.:)\-–]\s*(.{3,120}?)\s*[(\[:\-–]?\s*(\d{1,2})\s*(?:marks?)?\s*[)\]]?\s*$/i);
      if (m && out.length < 8) out.push({ id: m[1].toUpperCase(), name: m[2].trim().replace(/[\s(\[:\-–]+$/, ''), max: Math.max(1, Math.min(40, Number(m[3]))), bands: '' });
    });
    return out;
  }
  function criteriaFor(component, extra) {
    return component.id === 'custom' ? customCriteria(extra) : component.criteria;
  }
  function coursePrompt(component, draft, criteria) {
    return 'Component: ' + component.name + (component.words ? ' (word limit ' + component.words + ')' : '') + '\nCriteria:\n'
      + criteria.map((k) => k.id + '. ' + k.name + ' (out of ' + k.max + ')' + (k.bands ? ': ' + k.bands : '')).join('\n')
      + '\n\nDraft (' + wordsIn(draft) + ' words):\n"""' + String(draft).slice(0, DRAFT_MAX) + '"""';
  }
  function parseCourse(text, criteria, draft) {
    const j = parseJson(text);
    if (!plainObject(j) || !Array.isArray(j.criteria)) return { failed: true };
    const rows = criteria.map((k) => {
      const got = j.criteria.find((x) => plainObject(x) && String(x.id).toUpperCase() === k.id.toUpperCase()) || {};
      return {
        id: k.id, name: k.name, max: k.max,
        mark: clampInt(got.mark, 0, k.max, 0),
        working: strs(got.working, 4, 300),
        fixes: list(got.fixes).filter(plainObject).slice(0, 5).map((f) => {
          const q = str(f.quote, 240).trim();
          return { quote: q && quoted(draft, q) ? q : '', advice: str(f.advice, 400).trim() };
        }).filter((f) => f.advice),
      };
    });
    return {
      rows,
      total: rows.reduce((n, r) => n + r.mark, 0),
      max: rows.reduce((n, r) => n + r.max, 0),
      priorities: strs(j.priorities, 3, 300),
      summary: str(j.summary, 600).trim(),
    };
  }
  /** Checks that need no AI: length, and parts the component expects. */
  function courseChecks(component, draft) {
    const d = String(draft || '');
    const words = wordsIn(d);
    const out = [];
    if (component.words) {
      if (words > component.words) out.push({ kind: 'warn', text: words + ' words: over the ' + component.words + '-word limit. Examiners stop reading at the limit.' });
      else if (words < component.words * 0.6) out.push({ kind: 'info', text: words + ' words: well under the ' + component.words + '-word limit, so there is room to develop it.' });
      else out.push({ kind: 'good', text: words + ' of ' + component.words + ' words.' });
    }
    const has = (re) => re.test(d);
    if (component.id === 'sci-ia' || component.id === 'ee') {
      if (!has(/research question|\bRQ\b|to what extent|how does|what is the effect|what effect/i)) out.push({ kind: 'warn', text: 'No research question found. State it clearly near the start.' });
    }
    if (component.id === 'sci-ia') {
      if (!has(/uncertaint|±|\+\/-/i)) out.push({ kind: 'warn', text: 'No uncertainties mentioned. Data analysis expects them.' });
      if (!has(/independent variable|dependent variable|controlled variable|control variable/i)) out.push({ kind: 'info', text: 'Variables are not named as independent, dependent and controlled.' });
      if (!has(/evaluat|limitation|weakness/i)) out.push({ kind: 'warn', text: 'No evaluation of weaknesses or limitations found.' });
    }
    if (component.id === 'ee' || component.id === 'tok-essay' || component.id === 'lit-essay') {
      if (!has(/bibliograph|works cited|references|\(\s*\p{Lu}\p{L}+[^)]*\d{4}\s*\)/iu)) out.push({ kind: 'warn', text: 'No references or bibliography found. Every source must be cited.' });
    }
    if (component.id === 'tok-essay') {
      if (!has(/areas? of knowledge|natural sciences|human sciences|history|the arts|mathematics/i)) out.push({ kind: 'info', text: 'No area of knowledge named. Most strong essays explore two.' });
      if (!has(/however|on the other hand|counterclaim|counter-claim|a critic might|one could argue/i)) out.push({ kind: 'info', text: 'No counterclaim signposted. Exploring counterclaims is part of the top band.' });
    }
    if (component.id === 'math-ia' && !has(/conclusion/i)) out.push({ kind: 'info', text: 'No conclusion found. Presentation expects an introduction, an aim and a conclusion.' });
    return out;
  }
  async function courseFeedback(component, draft, extra) {
    const criteria = criteriaFor(component, extra);
    if (!criteria.length) return { failed: true, message: 'Paste the criteria with a letter, a name and the marks on each line, like "A. Research design (6)".' };
    const d = String(draft || '');
    return cached('course', { c: component.id, k: criteria, d }, async () => {
      const text = await call({ system: COURSE_SYSTEM, json: true, messages: [{ role: 'user', content: coursePrompt(component, d, criteria) }] });
      return parseCourse(text, criteria, d);
    });
  }

  /* ── 7. Mock orals ──────────────────────────────────────────────────── */

  function oralSystem(component, ctx) {
    const c = ctx || {};
    return [
      'You are an IB examiner running a mock ' + component.name + '. ' + component.note,
      c.language ? 'Speak only in ' + c.language + '.' : '',
      'Ask one question at a time, like a real examiner: short, open, and following up on what the student just said (ask them to develop, justify, give an example, or connect to the global issue or theme). Do not lecture and do not give feedback until asked.',
      'Reply with only your next question or prompt, in one or two sentences.',
    ].filter(Boolean).join('\n');
  }
  function oralMessages(turns) {
    return list(turns).slice(-16).map((t) => ({ role: t.role === 'examiner' ? 'assistant' : 'user', content: String(t.text).slice(0, 3000) }));
  }
  function oralNext(component, turns, ctx, onDelta) {
    return call({ system: oralSystem(component, ctx), messages: oralMessages(turns).concat(turns.length ? [] : [{ role: 'user', content: 'Start the oral.' }]), onDelta });
  }
  async function oralMark(component, turns) {
    const transcript = list(turns).map((t) => (t.role === 'examiner' ? 'Examiner: ' : 'Student: ') + t.text).join('\n').slice(0, DRAFT_MAX);
    const said = list(turns).filter((t) => t.role !== 'examiner').map((t) => t.text).join('\n');
    const text = await call({ system: COURSE_SYSTEM.replace('coursework draft', 'mock oral (a transcript of what they said)'), json: true,
      messages: [{ role: 'user', content: coursePrompt(component, transcript, component.criteria) }] });
    return parseCourse(text, component.criteria, said);
  }

  root.FluxTutorAI = {
    ENABLED, COMMANDS, COMPONENTS, BEYOND, DRAFT_MAX, AiError,
    session, token, signedIn, signIn, signOut, user, userName, call,
    // Pure pieces (tested on their own).
    parseJson, quoted, flat, hash, wordsIn,
    markPrompt, parseMark, markAnswer,
    questionsPrompt, parseQuestions, makeQuestions,
    chatSystem, chatMessages, parseChat, chat,
    parseTeach, teachBack,
    parseBlurt, checkBlurt,
    customCriteria, criteriaFor, coursePrompt, parseCourse, courseChecks, courseFeedback,
    oralNext, oralMark,
  };
})();
