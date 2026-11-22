/* ============================================================================
   FLUX TUTOR · HUB  ·  flux-tutor-hub.js
   Everything in Flux Tutor that is about the student rather than one study
   set: the sidebar, Home (exam countdown, streak, today's plan, setting up),
   My subjects, the question bank, the Daily 5, Mistakes, the Flux AI tutor
   chat, Teach it back and Blurting pickers, coursework feedback (IA, EE, TOK),
   mock orals, Progress (XP, levels, predicted grades) and the study plan that
   meets the Flux Planner.

   flux-teacher-app.js owns routing and the study sets; for a hub view it calls
   FluxTutorHub.render(view, params) with the `api` it handed over at start
   (FluxTutorHub.attach). This file keeps the student's profile:

   PROFILE (localStorage flux_tutor_profile.v1)
     { v: 1, programme: 'DP'|'MYP', subjects: [{ id, level: 'HL'|'SL' }],
       session: 'YYYY-05'|'YYYY-11', ee: subject id, xp, steps: { [step]: true },
       answered: { 'YYYY-MM-DD': n }, right: { 'YYYY-MM-DD': n },
       daily: { day, done, right }, updatedAt }

   THE PLANNER
   -----------
   Reads the planner's tasks in this browser (localStorage "tasks") to show
   upcoming tests and coursework deadlines, and writes "flux_tutor_agenda"
   (exam dates and today's study) that flux-tutor-link.js draws on the
   planner's calendar. It never writes the planner's own keys.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxTutorHub) return;

  const T = window.FluxTutor;
  const AI = window.FluxTutorAI || null;
  const IB = window.FluxIbSyllabus || null;
  const PROFILE_KEY = 'flux_tutor_profile.v1';
  const CHAT_KEY = 'flux_tutor_chats.v1';
  const COURSE_KEY = 'flux_tutor_coursework.v1';
  const AGENDA_KEY = 'flux_tutor_agenda';
  const VIEWS = ['home', 'setup', 'subject', 'bank', 'daily', 'mistakes', 'chat', 'tool', 'coursework', 'oral', 'progress', 'plan'];
  let api = null;

  /* ── Icons (line style, like the rest of Flux) ──────────────────────── */

  const IC = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    plan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8.5 15.5l2 2 4-4"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20"/>',
    bank: '<path d="M9 3h6v3H9z"/><path d="M8 4.5H6V21h12V4.5h-2"/><path d="m9 13 2 2 4-4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4.5-4-6.5-4.5-11-2.5 2-4 4.5-4 7-1-1-1.5-2-1.5-3.5C6.5 9.5 5 12 5 15c0 4.3 3 7 7 7Z"/>',
    star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.1A8 8 0 1 1 21 12Z"/>',
    teach: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-1a5 5 0 0 1 10 0v1"/><path d="M15 4h6v8h-6M17 15l2-3"/>',
    blurt: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    ia: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    ee: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4Z"/><path d="M8 9h8M8 13h6"/>',
    tok: '<circle cx="12" cy="12" r="9"/><path d="M12 7v2M12 12v5"/><path d="M9 12h3"/>',
    progress: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
    redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    cards: '<rect x="2" y="7" width="15" height="13" rx="2"/><path d="M7 3h13a2 2 0 0 1 2 2v11"/>',
    lessons: '<path d="M12 3 2.5 8 12 13l9.5-5L12 3Z"/><path d="M6.5 11v5.2c3.1 2.4 7.9 2.4 11 0V11"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/>',
    planner: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><path d="M7 14h4M7 17h7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    library: '<path d="M4 4v16M8 4v16M12 4l4 16M17 4h3v16h-3"/>',
  };
  function ic(name, size) {
    const s = size || 18;
    return '<svg class="ft-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[name] || '') + '</svg>';
  }
  function esc(v) { return api.esc(v); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function today() { return T.ymd(); }

  /* ── Storage ────────────────────────────────────────────────────────── */

  function readLs(key, dflt) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : dflt; } catch (_) { return dflt; }
  }
  function writeLs(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (_) { return false; }
  }
  const LEVELS = ['HL', 'SL'];
  function normProfile(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const ids = IB ? new Set(IB.subjects().map((s) => s.id)) : new Set();
    const map = (o) => {
      const out = {};
      if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (T.isYmd(k) && Number(o[k]) > 0) out[k] = Math.min(1e5, Math.round(Number(o[k]))); });
      return out;
    };
    return {
      v: 1,
      programme: p.programme === 'MYP' ? 'MYP' : 'DP',
      subjects: (Array.isArray(p.subjects) ? p.subjects : []).filter((s) => s && ids.has(s.id)).slice(0, 12)
        .map((s) => ({ id: s.id, level: LEVELS.includes(s.level) ? s.level : 'SL' })),
      session: /^\d{4}-(05|11)$/.test(p.session) ? p.session : '',
      ee: ids.has(p.ee) ? p.ee : '',
      xp: Math.max(0, Math.min(1e7, Math.round(Number(p.xp) || 0))),
      steps: p.steps && typeof p.steps === 'object' ? Object.keys(p.steps).reduce((o, k) => { if (/^[a-zA-Z-]{2,20}$/.test(k) && p.steps[k] === true) o[k] = true; return o; }, {}) : {},
      answered: map(p.answered),
      right: map(p.right),
      daily: p.daily && T.isYmd(p.daily.day) ? { day: p.daily.day, done: !!p.daily.done, right: Math.max(0, Math.min(5, Number(p.daily.right) || 0)) } : null,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
    };
  }
  let profileCache = null;
  function profile() {
    if (!profileCache) profileCache = normProfile(readLs(PROFILE_KEY, null));
    return profileCache;
  }
  function saveProfile() {
    const p = profile();
    p.updatedAt = new Date().toISOString();
    writeLs(PROFILE_KEY, p);
    try { window.dispatchEvent(new CustomEvent('flux-tutor:profile', { detail: p })); } catch (_) { /* old browsers */ }
  }
  window.addEventListener('storage', (e) => { if (e.key === PROFILE_KEY) profileCache = null; });

  /* ── XP and levels ──────────────────────────────────────────────────── */

  const XP = { right: 10, tried: 3, step: 25, daily: 40, exam: 60, ai: 5 };
  /** Level n starts at 60·n·(n−1) XP: 0, 120, 360, 720, … */
  function levelOf(xp) {
    let n = 1;
    while (60 * (n + 1) * n <= xp) n++;
    const base = 60 * n * (n - 1);
    const next = 60 * (n + 1) * n;
    return { level: n, into: xp - base, span: next - base };
  }
  function gain(n) {
    if (!n) return;
    const p = profile();
    const before = levelOf(p.xp).level;
    p.xp += n;
    const after = levelOf(p.xp).level;
    saveProfile();
    paintTop();
    if (after > before && api) api.toast('Level ' + after + '. Keep going.');
  }
  function bump(map, n) {
    const d = today();
    map[d] = (map[d] || 0) + n;
    const days = Object.keys(map).sort();
    days.slice(0, Math.max(0, days.length - 400)).forEach((k) => { delete map[k]; });
  }
  function sumMap(m) { return Object.keys(m || {}).reduce((n, k) => n + m[k], 0); }
  function weekSum(m) {
    let n = 0;
    for (let i = 0; i < 7; i++) n += (m || {})[T.addDays(today(), -i)] || 0;
    return n;
  }
  function step(id) {
    const p = profile();
    if (!id || p.steps[id]) return;
    p.steps[id] = true;
    saveProfile();
    gain(XP.step);
  }
  /**
   * What the study screens report. kind: 'answer' { right } | 'exam' | 'ai'
   * | 'studied' | 'step' { step }. Counts questions and gives XP.
   */
  function track(kind, data) {
    const d = data || {};
    const p = profile();
    if (kind === 'answer') {
      bump(p.answered, 1);
      if (d.right) bump(p.right, 1);
      gain(d.right ? XP.right : XP.tried);
      if (sumMap(p.answered) >= 10) step('ten');
    } else if (kind === 'exam') gain(XP.exam);
    else if (kind === 'ai') { gain(XP.ai); step('ai'); }
    else if (kind === 'studied') step('first');
    else if (kind === 'step') step(d.step);
  }

  /* ── Exams ──────────────────────────────────────────────────────────── */

  /** Roughly the first day of the session: May exams start late April, November ones late October. */
  function sessionStart(session) {
    if (!/^\d{4}-(05|11)$/.test(session || '')) return '';
    const y = Number(session.slice(0, 4));
    return session.slice(5) === '05' ? y + '-04-24' : y + '-10-20';
  }
  function sessionLabel(session) {
    if (!session) return '';
    return (session.slice(5) === '05' ? 'May ' : 'November ') + session.slice(0, 4);
  }
  function sessionOptions(current) {
    const y = new Date().getFullYear();
    const out = [];
    for (let yy = y; yy <= y + 3; yy++) ['05', '11'].forEach((m) => { const s = yy + '-' + m; if (T.daysBetween(today(), sessionStart(s)) > -30) out.push(s); });
    if (current && !out.includes(current)) out.unshift(current);
    return out.slice(0, 7).map((s) => '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + esc(sessionLabel(s)) + '</option>').join('');
  }

  /* ── The planner, read only ─────────────────────────────────────────── */

  const DEADLINE_RE = /\b(test|quiz|exam|mock|paper|assessment|IA|EE|TOK|essay|oral|presentation|lab|draft|deadline)\b/i;
  function plannerTasks() {
    const tasks = readLs('tasks', []);
    if (!Array.isArray(tasks)) return [];
    const subjects = readLs('subjects', {}) || {};
    const d0 = today();
    return tasks.filter((t) => t && !t.done && T.isYmd(t.date) && T.daysBetween(d0, t.date) >= 0 && T.daysBetween(d0, t.date) <= 60
      && (['test', 'quiz', 'project', 'essay', 'lab'].includes(t.type) || DEADLINE_RE.test(String(t.name || ''))))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 8)
      .map((t) => {
        const sub = subjects && typeof subjects === 'object' && t.subject ? subjects[t.subject] : null;
        const subName = sub && typeof sub === 'object' ? String(sub.name || '') : '';
        const ib = IB && subName ? IB.find(subName) : null;
        return { name: String(t.name || 'Untitled').slice(0, 120), date: t.date, type: String(t.type || ''), subject: subName.slice(0, 60), ib: ib ? ib.id : '' };
      });
  }
  function plannerSubjects() {
    const s = readLs('subjects', null);
    if (!s || typeof s !== 'object' || !IB) return [];
    return Object.keys(s).map((k) => (s[k] && typeof s[k] === 'object' ? s[k].name : '')).filter(Boolean)
      .map((n) => IB.find(n)).filter(Boolean).map((x) => x.id).filter((v, i, a) => a.indexOf(v) === i);
  }
  /** Exam dates and today's study for the planner's calendar (flux-tutor-link.js). */
  function writeAgenda(metas) {
    const items = [];
    (metas || []).forEach((m) => {
      if (m.examDate && m.daysLeft != null && m.daysLeft >= 0) items.push({ date: m.examDate, kind: 'exam', title: (m.title || 'Study set') + ' exam', href: 'teacher.html' + api.setHash(m.id, 'plan') });
      if (m.cardsDue > 0) items.push({ date: today(), kind: 'study', title: plural(m.cardsDue, 'flashcard') + ' due: ' + (m.title || 'Study set'), href: 'teacher.html' + api.setHash(m.id, 'cards') });
    });
    const p = profile();
    if (p.session) items.push({ date: sessionStart(p.session), kind: 'exam', title: 'IB exams begin (' + sessionLabel(p.session) + ')', href: 'teacher.html#home' });
    writeLs(AGENDA_KEY, { v: 1, updatedAt: new Date().toISOString(), items: items.slice(0, 60) });
  }

  /* ── Data from the study sets ───────────────────────────────────────── */

  async function fullSets(filter, max) {
    const metas = api.metas().filter(filter || (() => true)).slice(0, max || 40);
    const out = [];
    for (const m of metas) {
      const s = await api.getSet(m.id);
      if (s && !s.deletedAt) out.push(s);
    }
    return out;
  }
  const corpusCache = new Map();
  function worked(set) {
    const key = T.sourcesHash(set.sources) + '|' + (set.guide ? (set.guide.terms || []).length + ':' + (set.guide.hash || '') : '');
    let w = corpusCache.get(set.id);
    if (!w || w.key !== key) {
      const corpus = T.buildCorpus(set.sources);
      const concepts = set.guide ? T.conceptsFromGuide(corpus, set.guide) : [];
      w = { key, corpus, concepts, index: null };
      corpusCache.set(set.id, w);
    }
    if (!w.index) w.index = T.buildSearchIndex(w.corpus);
    return w;
  }
  function subjectName(id) {
    const s = IB && IB.subjects().find((x) => x.id === id);
    return s ? s.name : '';
  }
  function setSubjectId(m) {
    if (m.unit) return m.unit.split(':')[0];
    const s = IB && m.subject ? IB.find(m.subject) : null;
    return s ? s.id : '';
  }
  function unitCode(u) { return /\d/.test(u.code) && !/^\d+$/.test(u.code) ? u.code : ''; }

  /* ── The frame: sidebar and top strip ───────────────────────────────── */

  const SUBJECT_COLORS = ['#7dd3fc', '#a5b4fc', '#86efac', '#fda4af', '#fcd34d', '#c4b5fd', '#5eead4', '#fdba74', '#f9a8d4', '#93c5fd', '#bef264', '#fca5a5'];
  function colorFor(i) { return SUBJECT_COLORS[i % SUBJECT_COLORS.length]; }

  function sideHtml(active) {
    const p = profile();
    const link = (hash, icon, label, on, extra) => '<li><a class="ft-side-link' + (on ? ' is-on' : '') + '" href="' + hash + '"' + (on ? ' aria-current="page"' : '') + '>' + ic(icon, 17) + '<span class="ft-side-text">' + esc(label) + '</span>' + (extra || '') + '</a></li>';
    const metas = api.metas();
    const mist = metas.reduce((n, m) => n + (Number(m.mistakes) || 0), 0);
    const due = metas.reduce((n, m) => n + (Number(m.cardsDue) || 0), 0);
    const badge = (n, what) => (n ? '<span class="ft-side-badge" title="' + esc(plural(n, what)) + '">' + (n > 99 ? '99+' : n) + '<span class="ft-visually-hidden"> ' + esc(n === 1 ? what : what + 's') + '</span></span>' : '');
    const dailyDone = p.daily && p.daily.day === today() && p.daily.done;
    const subj = p.subjects.map((s, i) => '<li><a class="ft-side-link ft-side-subj' + (active === 'subject:' + s.id ? ' is-on' : '') + '" href="#subject/' + esc(s.id) + '"' + (active === 'subject:' + s.id ? ' aria-current="page"' : '') + '><span class="ft-dot" style="background:' + colorFor(i) + '"></span><span class="ft-side-text">' + esc(subjectName(s.id).replace(/^MYP /, '')) + '</span>'
      + (p.programme === 'DP' ? '<span class="ft-side-lvl">' + esc(s.level) + '</span>' : '') + '</a></li>').join('');
    return '<nav class="ft-side-nav" aria-label="Flux Tutor">'
      + '<ul>' + link('#home', 'home', 'Home', active === 'home') + link('#plan', 'plan', 'Study plan', active === 'plan') + '</ul>'
      + '<p class="ft-side-sec">Study</p><ul>'
      + link('#library', 'library', 'Notes and study sets', active === 'library' || active === 'set')
      + (window.FluxTeach ? link('#learn', 'lessons', 'Lessons', active === 'learn') : '')
      + link('#bank', 'bank', 'Question bank', active === 'bank')
      + link('#daily', 'bolt', 'Daily 5', active === 'daily', dailyDone ? '<span class="ft-side-done" title="Done today">' + ic('check', 14) + '<span class="ft-visually-hidden"> done today</span></span>' : '')
      + link('#tool/cards', 'cards', 'Flashcards', active === 'tool:cards', badge(due, 'card due'))
      + link('#mistakes', 'redo', 'Mistakes', active === 'mistakes', badge(mist, 'mistake'))
      + '</ul>'
      + '<p class="ft-side-sec">Flux AI</p><ul>'
      + link('#chat', 'chat', 'Tutor chat', active === 'chat')
      + link('#tool/teach', 'teach', 'Teach it back', active === 'tool:teach')
      + link('#tool/blurt', 'blurt', 'Blurting', active === 'tool:blurt')
      + link('#oral', 'mic', 'Mock orals', active === 'oral')
      + '</ul>'
      + '<p class="ft-side-sec">Write and get marked</p><ul>'
      + link('#coursework/IA', 'ia', 'IA', active === 'coursework:IA')
      + (p.programme === 'DP' ? link('#coursework/EE', 'ee', 'EE', active === 'coursework:EE') + link('#coursework/TOK', 'tok', 'TOK', active === 'coursework:TOK') : '')
      + '</ul>'
      + '<p class="ft-side-sec">My subjects <a class="ft-side-edit" href="#setup">Edit</a></p>'
      + (subj ? '<ul>' + subj + '</ul>' : '<p class="ft-side-empty"><a href="#setup">Add your subjects</a></p>')
      + '<ul class="ft-side-foot">' + link('#progress', 'progress', 'Progress', active === 'progress') + '</ul>'
      + '</nav>';
  }
  function topHtml() {
    const p = profile();
    const s = T.studyStreak(api.metas().map((m) => m.activity).concat([p.answered]));
    const lv = levelOf(p.xp);
    return '<a class="ft-top-pill" href="#progress" title="Study streak">' + ic('flame', 15) + '<span>' + s.current + '</span><span class="ft-visually-hidden"> day streak</span></a>'
      + '<a class="ft-top-pill" href="#progress" title="' + p.xp + ' XP">' + ic('star', 15) + '<span>Level ' + lv.level + '</span></a>'
      + '<a class="ft-top-pill ft-top-pill--xp" href="#progress" title="XP">' + ic('bolt', 15) + '<span>' + p.xp + '</span><span class="ft-visually-hidden"> XP</span></a>';
  }
  function paintTop() {
    const el = document.getElementById('ftTopStats');
    if (el && api) el.innerHTML = topHtml();
  }
  /** Draws the sidebar for the current screen (the router calls it on every screen). */
  function frame(active) {
    const side = document.getElementById('ftSide');
    if (side && api) side.innerHTML = sideHtml(active);
    paintTop();
    document.body.classList.remove('ft-side-open');
    const menu = document.getElementById('ftMenuBtn');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }

  /* ── Sign in to Flux (for Flux AI) ──────────────────────────────────── */

  function aiReady() { return !!(AI && AI.ENABLED && AI.signedIn()); }
  function signInCard(why) {
    if (!AI || !AI.ENABLED) return '<p class="ft-notice">' + ic('sparkle', 17) + '<span>Flux AI is switched off right now. The rest of Flux Tutor still works.</span></p>';
    return '<div class="ft-signin"><p><strong>' + esc(why || 'Sign in to use Flux AI.') + '</strong> It is free with your Flux account, the same one as the Flux Planner.</p>'
      + '<form class="ft-signin-form" data-hub-form="signin" novalidate>'
      + '<div class="ft-field"><label class="ft-label" for="ftSiName">Flux username</label><input class="ft-input" id="ftSiName" name="name" autocomplete="username" autocapitalize="off" spellcheck="false"></div>'
      + '<div class="ft-field"><label class="ft-label" for="ftSiPass">Password</label><input class="ft-input" id="ftSiPass" name="password" type="password" autocomplete="current-password"></div>'
      + '<div class="ft-row"><button type="submit" class="ft-btn">Sign in</button><a class="ft-btn ft-btn--quiet" href="index.html">Make a free account</a></div>'
      + '<p class="ft-error" role="alert" id="ftSiError"></p></form></div>';
  }
  async function doSignIn(form) {
    const err = form.querySelector('#ftSiError');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const res = await AI.signIn(form.elements.name.value, form.elements.password.value);
    btn.disabled = false;
    if (res.error) { err.textContent = res.error; return; }
    step('signin');
    api.toast('Signed in. Flux AI is ready.');
    try { window.dispatchEvent(new CustomEvent('flux-tutor:signin')); } catch (_) { /* old browsers */ }
    rerender();
  }
  function aiErrorHtml(e) {
    if (e && e.code === 'signin') return signInCard('Your sign-in ran out. Sign in again to use Flux AI.');
    return '<p class="ft-alert" role="alert">' + esc((e && e.message) || 'Flux AI is not available right now.') + '</p>';
  }

  /* ── Rendering ──────────────────────────────────────────────────────── */

  let current = { view: 'home', params: {} };
  const ui = { chat: null, chatBusy: false, bank: { subject: '' }, daily: null, mist: null, course: null, oral: null };
  function root() { return api.root; }
  function rerender() { if (api && api.isHubView()) render(current.view, current.params); }

  function render(view, params) {
    const changed = current.view !== view || JSON.stringify(current.params) !== JSON.stringify(params || {});
    current = { view, params: params || {} };
    if (changed) { if (view !== 'daily') ui.daily = null; if (view !== 'mistakes') ui.mist = null; }
    const p = profile();
    let html = '';
    let active = view;
    switch (view) {
      case 'setup': html = setupView(false); break;
      case 'subject': html = subjectView(current.params.id); active = 'subject:' + current.params.id; break;
      case 'bank': html = bankView(); break;
      case 'daily': html = dailyView(); break;
      case 'mistakes': html = mistakesView(); break;
      case 'chat': html = chatView(); break;
      case 'tool': html = toolView(current.params.id); active = 'tool:' + (TOOLS[current.params.id] ? current.params.id : 'teach'); break;
      case 'coursework': { const g = ['IA', 'EE', 'TOK'].includes(current.params.id) ? current.params.id : 'IA'; html = courseView(g); active = 'coursework:' + g; break; }
      case 'oral': html = oralView(); break;
      case 'progress': html = progressView(); break;
      case 'plan': html = planView(); break;
      default:
        active = 'home';
        html = !p.subjects.length && !p.steps.skipSetup ? setupView(true) : homeView();
    }
    frame(active);
    document.title = titleFor(view) + ' · Flux Tutor';
    root().innerHTML = '<div class="ft-hub ft-hub--' + esc(view) + '">' + html + '</div>';
    if (view === 'daily' && !ui.daily) startDaily();
    if (view === 'mistakes' && !ui.mist) loadMistakes();
    if (view === 'chat') { const log = document.getElementById('ftChatLog'); if (log) log.scrollTop = log.scrollHeight; }
    if (view === 'home') writeAgenda(api.metas());
  }
  function titleFor(view) {
    return { home: 'Home', setup: 'Your subjects', subject: subjectName(current.params.id) || 'Subject', bank: 'Question bank', daily: 'Daily 5', mistakes: 'Mistakes', chat: 'Tutor chat', tool: (TOOLS[current.params.id] || TOOLS.teach).title, coursework: current.params.id || 'IA', oral: 'Mock orals', progress: 'Progress', plan: 'Study plan' }[view] || 'Flux Tutor';
  }

  /* ── Setup ──────────────────────────────────────────────────────────── */

  function setupView(first) {
    const p = profile();
    if (!IB) return '<p class="ft-alert" role="alert">The IB subject list did not load. Reload the page.</p>';
    const fromPlanner = plannerSubjects();
    const chosen = new Map(p.subjects.map((s) => [s.id, s.level]));
    if (!p.subjects.length) fromPlanner.forEach((id) => chosen.set(id, 'SL'));
    const groups = {};
    IB.subjects().forEach((s) => {
      const myp = /^MYP /.test(s.name);
      if ((p.programme === 'MYP') !== myp) return;
      (groups[s.group] || (groups[s.group] = [])).push(s);
    });
    return '<section class="ft-setup" aria-labelledby="ftScreenTitle">'
      + (first ? '<p class="ft-kicker">Welcome to Flux Tutor</p>' : '')
      + '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + (first ? 'Set up your IB' : 'Your subjects and exams') + '</h1>'
      + '<p class="ft-lead">Pick your programme and subjects. Flux Tutor builds your home, question bank and study plan around them' + (fromPlanner.length && !p.subjects.length ? '. Subjects from your Flux Planner are already ticked' : '') + '.</p>'
      + '<form class="ft-panel" data-hub-form="setup" novalidate>'
      + '<fieldset class="ft-fieldset"><legend class="ft-label">Programme</legend><div class="ft-seg">'
      + ['DP', 'MYP'].map((x) => '<label class="ft-seg-opt"><input type="radio" name="programme" value="' + x + '"' + (p.programme === x ? ' checked' : '') + ' data-hub-change="programme"><span>' + (x === 'DP' ? 'Diploma (DP)' : 'Middle Years (MYP)') + '</span></label>').join('')
      + '</div></fieldset>'
      + '<fieldset class="ft-fieldset"><legend class="ft-label">Subjects' + (p.programme === 'DP' ? ' and level' : '') + '</legend>'
      + Object.keys(groups).map((g) => '<p class="ft-setup-group">' + esc(g) + '</p><div class="ft-subj-grid">' + groups[g].map((s) => {
        const on = chosen.has(s.id);
        return '<div class="ft-subj-opt"><label class="ft-check ft-check--plain"><input type="checkbox" name="subject" value="' + esc(s.id) + '"' + (on ? ' checked' : '') + '> <span>' + esc(s.name.replace(/^MYP /, '')) + '</span></label>'
          + (p.programme === 'DP' ? '<select class="ft-select ft-select--mini" name="level-' + esc(s.id) + '" aria-label="Level for ' + esc(s.name) + '">' + LEVELS.map((l) => '<option' + ((chosen.get(s.id) || 'SL') === l ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' : '')
          + '</div>';
      }).join('') + '</div>').join('')
      + '</fieldset>'
      + '<div class="ft-grid">'
      + '<div class="ft-field"><label class="ft-label" for="ftSession">Exam session</label><select class="ft-select" id="ftSession" name="session"><option value="">Not sure yet</option>' + sessionOptions(p.session) + '</select></div>'
      + (p.programme === 'DP' ? '<div class="ft-field"><label class="ft-label" for="ftEe">Extended essay subject</label><select class="ft-select" id="ftEe" name="ee"><option value="">Not chosen yet</option>'
        + IB.subjects().filter((s) => !/^MYP /.test(s.name)).map((s) => '<option value="' + esc(s.id) + '"' + (p.ee === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>' : '')
      + '</div>'
      + '<div class="ft-row"><button type="submit" class="ft-btn ft-btn--big">' + (first ? 'Start studying' : 'Save') + '</button>'
      + (first ? '<button type="button" class="ft-btn ft-btn--quiet" data-hub="skip-setup">Skip for now</button>' : '') + '</div>'
      + '</form></section>';
  }
  function saveSetup(form) {
    const p = profile();
    const fd = new FormData(form);
    p.programme = fd.get('programme') === 'MYP' ? 'MYP' : 'DP';
    p.subjects = fd.getAll('subject').map(String).slice(0, 12).map((id) => ({ id, level: fd.get('level-' + id) === 'HL' ? 'HL' : 'SL' }));
    p.session = String(fd.get('session') || '');
    p.ee = String(fd.get('ee') || '');
    profileCache = normProfile(p);
    saveProfile();
    const q = profile();
    if (q.subjects.length) step('subjects');
    if (q.session) step('session');
    if (q.ee) step('ee');
    api.toast('Saved. Flux Tutor is set up for ' + plural(q.subjects.length, 'subject') + '.');
    api.go('#home');
  }

  /* ── Home ───────────────────────────────────────────────────────────── */

  function greeting() {
    const h = new Date().getHours();
    const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = (AI && AI.userName()) || '';
    return part + (name ? ', ' + name.split(/\s+/)[0] : '');
  }
  function homeView() {
    const p = profile();
    const metas = api.metas();
    const streak = T.studyStreak(metas.map((m) => m.activity).concat([p.answered]));
    const start = sessionStart(p.session);
    const left = start ? T.daysBetween(today(), start) : null;
    const span = p.programme === 'DP' ? 640 : 300;
    const donePct = start ? Math.max(0, Math.min(100, Math.round((span - left) / span * 100))) : 0;
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = T.addDays(today(), -i);
      const any = (p.answered[d] || 0) + metas.reduce((n, m) => n + ((m.activity || {})[d] || 0), 0);
      const day = new Date(d + 'T12:00:00');
      week.push('<li class="' + (any ? 'is-on' : '') + (i === 0 ? ' is-today' : '') + '" title="' + esc(day.toLocaleDateString(undefined, { weekday: 'long' })) + (any ? ': studied' : '') + '"><span class="ft-week-bar"></span><span class="ft-week-d" aria-hidden="true">' + 'SMTWTFS'[day.getDay()] + '</span></li>');
    }
    const answered = sumMap(p.answered);
    const tiles = '<div class="ft-home-stats">'
      + '<div class="ft-hstat"><p class="ft-hstat-label">Until your exams</p>'
      + (left != null ? '<p class="ft-hstat-num">' + (left >= 0 ? '<small>about</small> ' + left + ' <small>days</small>' : 'Under way') + '</p><div class="ft-meter"><span style="width:' + donePct + '%"></span></div><p class="ft-help">' + esc(sessionLabel(p.session)) + ' · ' + donePct + '% of the ' + p.programme + ' done</p>'
        : '<p class="ft-hstat-num">—</p><p class="ft-help"><a href="#setup">Choose your exam session</a></p>') + '</div>'
      + '<div class="ft-hstat"><p class="ft-hstat-label">Questions answered</p><p class="ft-hstat-num">' + answered + '</p><p class="ft-help">' + weekSum(p.answered) + ' this week' + (answered ? ' · ' + Math.round(sumMap(p.right) / answered * 100) + '% right' : '') + '</p></div>'
      + '<div class="ft-hstat"><p class="ft-hstat-label">' + ic('flame', 15) + ' Study streak</p><p class="ft-hstat-num">' + streak.current + ' <small>' + (streak.current === 1 ? 'day' : 'days') + '</small></p><ol class="ft-week" aria-label="Days studied in the last week">' + week.join('') + '</ol></div>'
      + '</div>';
    const dailyDone = p.daily && p.daily.day === today() && p.daily.done;
    return '<header class="ft-home-head"><div><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(greeting()) + '</h1>'
      + '<p class="ft-lead">' + esc(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })) + '</p></div>'
      + '<a class="ft-btn' + (dailyDone ? ' ft-btn--quiet' : '') + '" href="#daily">' + ic(dailyDone ? 'check' : 'bolt', 17) + (dailyDone ? 'Daily 5 done' : 'Today\'s Daily 5') + '</a></header>'
      + tiles
      + todayHtml(metas)
      + plannerHtml()
      + setupChecklist()
      + subjectsHtml()
      + toolsHtml();
  }
  function todayHtml(metas) {
    const items = [];
    const due = metas.filter((m) => m.cardsDue > 0).sort((a, b) => b.cardsDue - a.cardsDue);
    if (due.length) items.push({ icon: 'cards', title: plural(due.reduce((n, m) => n + m.cardsDue, 0), 'flashcard') + ' due', sub: due.slice(0, 2).map((m) => m.title).join(', '), href: api.setHash(due[0].id, 'cards') });
    const mist = metas.filter((m) => m.mistakes > 0);
    if (mist.length) items.push({ icon: 'redo', title: plural(mist.reduce((n, m) => n + m.mistakes, 0), 'mistake') + ' to fix', sub: 'Questions you got wrong, ready to try again', href: '#mistakes' });
    const exams = metas.filter((m) => m.daysLeft != null && m.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
    if (exams.length) items.push({ icon: 'plan', title: exams[0].daysLeft === 0 ? 'Exam today: ' + exams[0].title : exams[0].title + ' in ' + plural(exams[0].daysLeft, 'day'), sub: 'Open today\'s study plan', href: api.setHash(exams[0].id, 'plan') });
    const resume = metas.filter((m) => m.studiedAt).sort((a, b) => (a.studiedAt < b.studiedAt ? 1 : -1))[0];
    if (resume) items.push({ icon: 'book', title: 'Carry on: ' + (resume.title || 'Study set'), sub: resume.terms ? resume.mastered + ' of ' + plural(resume.terms, 'term') + ' known' : 'Pick up where you left off', href: api.setHash(resume.id, 'learn') });
    if (!items.length) return '';
    return '<section class="ft-home-sec" aria-labelledby="ftTodayTitle"><h2 class="ft-h2" id="ftTodayTitle">Today</h2><ul class="ft-today">'
      + items.slice(0, 4).map((x) => '<li><a href="' + esc(x.href) + '">' + ic(x.icon, 20) + '<span class="ft-today-t"><strong>' + esc(x.title) + '</strong><span class="ft-help">' + esc(x.sub) + '</span></span>' + ic('arrow', 16) + '</a></li>').join('')
      + '</ul></section>';
  }
  function plannerHtml() {
    const tasks = plannerTasks();
    if (!tasks.length) return '';
    return '<section class="ft-home-sec" aria-labelledby="ftPlanTitle"><div class="ft-sec-head"><h2 class="ft-h2" id="ftPlanTitle">Coming up in your planner</h2><a class="ft-link" href="index.html">Open Flux Planner</a></div>'
      + '<ul class="ft-deadlines">' + tasks.map(deadlineRow).join('') + '</ul></section>';
  }
  function deadlineRow(t) {
    const days = T.daysBetween(today(), t.date);
    return '<li><span class="ft-dl-when' + (days <= 3 ? ' is-soon' : '') + '">' + (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days + ' days') + '</span>'
      + '<span class="ft-dl-name"><strong>' + esc(t.name) + '</strong>' + (t.subject ? '<span class="ft-help">' + esc(t.subject) + '</span>' : '') + '</span>'
      + (t.ib ? '<a class="ft-mini ft-mini--go" href="#subject/' + esc(t.ib) + '?test=' + esc(t.date) + '">Revise for it</a>' : '<a class="ft-mini" href="#bank">Practise</a>') + '</li>';
  }
  const SETUP_STEPS = [
    ['subjects', 'Add your subjects', '#setup'],
    ['session', 'Choose your exam session', '#setup'],
    ['ee', 'Choose your extended essay subject', '#setup', 'DP'],
    ['first', 'Open your first unit', '#bank'],
    ['ten', 'Answer 10 questions', '#daily'],
    ['signin', 'Sign in to unlock Flux AI', '#chat'],
    ['ai', 'Get an answer marked by Flux AI', '#bank'],
    ['draft', 'Get feedback on an IA, EE or TOK draft', '#coursework/IA', 'DP'],
  ];
  function setupChecklist() {
    const p = profile();
    if (aiReady() && !p.steps.signin) { p.steps.signin = true; saveProfile(); }
    const steps = SETUP_STEPS.filter((s) => !s[3] || s[3] === p.programme);
    const done = steps.filter((s) => p.steps[s[0]]).length;
    if (done === steps.length || p.steps.hideChecklist) return '';
    return '<section class="ft-home-sec" aria-labelledby="ftSetupTitle"><div class="ft-sec-head"><h2 class="ft-h2" id="ftSetupTitle">Finish setting up</h2><span class="ft-help">' + done + ' of ' + steps.length + ' done</span></div>'
      + '<ol class="ft-checklist">' + steps.map((s) => {
        const on = !!p.steps[s[0]];
        return '<li class="' + (on ? 'is-done' : '') + '"><a href="' + s[2] + '">' + ic(on ? 'check' : 'circle', 18) + '<span class="ft-check-t">' + esc(s[1]) + (on ? '<span class="ft-visually-hidden"> (done)</span>' : '') + '</span><span class="ft-xp">' + (on ? '+' + XP.step + ' XP earned' : '+' + XP.step + ' XP') + '</span></a></li>';
      }).join('') + '</ol><button type="button" class="ft-link-btn" data-hub="hide-checklist">Hide this list</button></section>';
  }
  function subjectsHtml() {
    const p = profile();
    if (!p.subjects.length) return '<section class="ft-home-sec"><h2 class="ft-h2">My subjects</h2><p class="ft-help"><a href="#setup">Add your subjects</a> to see them here.</p></section>';
    const metas = api.metas();
    return '<section class="ft-home-sec" aria-labelledby="ftSubjTitle"><div class="ft-sec-head"><h2 class="ft-h2" id="ftSubjTitle">My subjects</h2><a class="ft-link" href="#setup">Change subjects</a></div>'
      + '<ul class="ft-subj-tiles">' + p.subjects.map((s, i) => {
        const sub = IB.subjects().find((x) => x.id === s.id);
        const mine = metas.filter((m) => setSubjectId(m) === s.id);
        const started = new Set(mine.map((m) => m.unit).filter(Boolean)).size;
        const total = sub ? sub.units.filter((u) => !(s.level === 'SL' && u.hl && p.programme === 'DP')).length : 0;
        const pred = mine.filter((m) => m.predicted && m.predicted.confidence !== 'low');
        const grade = pred.length ? T.gradeFor(Math.round(pred.reduce((n, m) => n + m.predicted.pct, 0) / pred.length)) : null;
        return '<li class="ft-subj-tile" style="--c:' + colorFor(i) + '"><a href="#subject/' + esc(s.id) + '"><span class="ft-subj-name">' + esc(sub ? sub.name.replace(/^MYP /, '') : s.id) + '</span>'
          + '<span class="ft-subj-meta">' + (p.programme === 'DP' ? esc(s.level) + ' · ' : '') + started + ' of ' + total + ' units started</span>'
          + (grade ? '<span class="ft-subj-grade" title="Predicted grade"><span class="ft-visually-hidden">Predicted grade </span>' + grade + '</span>' : '')
          + '<span class="ft-subj-go">Open ' + ic('arrow', 14) + '</span></a></li>';
      }).join('') + '</ul></section>';
  }
  function toolsHtml() {
    const p = profile();
    const tool = (href, icon, name, desc) => '<li><a href="' + href + '">' + ic(icon, 22) + '<strong>' + esc(name) + '</strong><span class="ft-help">' + esc(desc) + '</span></a></li>';
    return '<section class="ft-home-sec" aria-labelledby="ftToolsTitle"><h2 class="ft-h2" id="ftToolsTitle">Study tools</h2><ul class="ft-tools">'
      + tool('#chat', 'chat', 'Tutor chat', 'Ask anything. Answers cite your notes.')
      + tool('#bank', 'bank', 'Question bank', 'Exam-style questions, marked by Flux AI.')
      + tool('#tool/teach', 'teach', 'Teach it back', 'Explain a topic and see what you missed.')
      + tool('#tool/blurt', 'blurt', 'Blurting', 'Write all you remember, then check it.')
      + tool('#oral', 'mic', 'Mock orals', 'An examiner who asks follow-up questions.')
      + (p.programme === 'DP' ? tool('#coursework/IA', 'ia', 'IA, EE and TOK feedback', 'Criterion by criterion, never written for you.') : tool('#coursework/IA', 'ia', 'Coursework feedback', 'Paste your criteria and your draft.'))
      + '</ul></section>';
  }

  /* ── A subject ──────────────────────────────────────────────────────── */

  function subjectView(sid) {
    const sub = IB && IB.subjects().find((s) => s.id === sid);
    if (!sub) return '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Subject not found</h1><p class="ft-help"><a href="#home">Back home</a></p>';
    const p = profile();
    const lvl = p.programme === 'DP' ? ((p.subjects.find((s) => s.id === sid) || {}).level || '') : '';
    const metas = api.metas().filter((m) => setSubjectId(m) === sid);
    const byUnit = new Map();
    metas.forEach((m) => { if (m.unit && !byUnit.has(m.unit)) byUnit.set(m.unit, m); });
    const test = T.isYmd(current.params.test) ? current.params.test : '';
    const groups = [];
    sub.units.forEach((u) => {
      if (lvl === 'SL' && u.hl) return;
      let g = groups[groups.length - 1];
      if (!g || g.name !== u.section) groups.push(g = { name: u.section, units: [] });
      g.units.push(u);
    });
    const shown = groups.reduce((n, g) => n + g.units.length, 0);
    const started = groups.reduce((n, g) => n + g.units.filter((u) => byUnit.has(u.id)).length, 0);
    const known = metas.reduce((n, m) => n + (m.mastered || 0), 0);
    const terms = metas.reduce((n, m) => n + (m.terms || 0), 0);
    const own = metas.filter((m) => !m.unit);
    return '<header class="ft-subj-head"><p class="ft-kicker">' + esc(sub.group) + (lvl ? ' · ' + esc(lvl) : '') + '</p>'
      + '<h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(sub.name) + '</h1>'
      + '<p class="ft-lead">' + started + ' of ' + shown + ' units started' + (terms ? ' · ' + known + ' of ' + plural(terms, 'term') + ' known' : '') + (lvl === 'SL' ? ' · HL-only units hidden' : '') + '</p>'
      + '<div class="ft-row"><a class="ft-btn" href="#chat?subject=' + esc(sid) + '">' + ic('chat', 17) + 'Ask the tutor</a>'
      + '<a class="ft-btn ft-btn--quiet" href="#bank?subject=' + esc(sid) + '">' + ic('bank', 17) + 'Question bank</a></div></header>'
      + (test ? '<p class="ft-notice">' + ic('planner', 17) + '<span>Your planner has a deadline on ' + esc(new Date(test + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })) + '. Open each unit it covers and give it that exam date in Study plan. Flux Tutor then spreads the revision over the days left.</span></p>' : '')
      + groups.map((g) => '<h2 class="ft-h3 ft-syl-sec">' + esc(g.name) + '</h2><ul class="ft-units">' + g.units.map((u) => unitRow(u, byUnit.get(u.id), sid, false)).join('') + '</ul>').join('')
      + (own.length ? '<h2 class="ft-h3 ft-syl-sec">Your own notes</h2><ul class="ft-units">' + own.map((m) => '<li class="ft-unit is-started"><span class="ft-unit-code"></span><span class="ft-unit-name">' + esc(m.title || 'Untitled study set') + '</span><span class="ft-unit-acts"><a class="ft-mini ft-mini--go" href="' + esc(api.setHash(m.id, '')) + '">Open</a></span></li>').join('') + '</ul>' : '');
  }
  function unitRow(u, m, sid, bank) {
    const has = window.FluxIbNotes && window.FluxIbNotes.has(u.id);
    const lessons = !bank && window.FluxTeach ? window.FluxTeach.forUnit(u.id) : [];
    const pct = m && m.terms ? Math.round(m.mastered / m.terms * 100) : 0;
    let acts = '';
    if (lessons.length) acts += '<a class="ft-mini" href="#learn/' + esc(sid) + (lessons.length === 1 ? '/' + esc(lessons[0].id) : '') + '" aria-label="Lessons for ' + esc(u.title) + '">Lessons</a>';
    if (m) {
      acts += bank ? '<a class="ft-mini" href="' + esc(api.setHash(m.id, 'exam')) + '" aria-label="Mock exam on ' + esc(u.title) + '">Mock exam</a><a class="ft-mini ft-mini--go" href="' + esc(api.setHash(m.id, 'ib')) + '" aria-label="Questions on ' + esc(u.title) + '">Questions</a>'
        : '<a class="ft-mini" href="' + esc(api.setHash(m.id, 'ib')) + '" aria-label="Practise ' + esc(u.title) + '">Practise</a><a class="ft-mini ft-mini--go" href="' + esc(api.setHash(m.id, '')) + '" aria-label="Open ' + esc(u.title) + '">Open</a>';
    } else {
      acts += '<button type="button" class="ft-mini ft-mini--go" data-hub="unit" data-unit="' + esc(u.id) + '"' + (bank && has ? ' data-tab="ib"' : '') + ' aria-label="' + (has ? (bank ? 'Questions on ' : 'Study ') : 'Add notes for ') + esc(u.title) + '">' + (has ? (bank ? 'Questions' : 'Study') : 'Add notes') + '</button>';
    }
    return '<li class="ft-unit' + (m ? ' is-started' : '') + '"><span class="ft-unit-code">' + esc(unitCode(u)) + '</span>'
      + '<span class="ft-unit-name"><span>' + esc(u.title) + (u.hl ? ' <span class="ft-chip ft-chip--hl">HL</span>' : '') + '</span>'
      + (m && m.terms ? '<span class="ft-unit-meter" role="img" aria-label="' + pct + '% of terms known"><span style="width:' + pct + '%"></span></span>' : '') + '</span>'
      + '<span class="ft-unit-acts">' + acts + '</span></li>';
  }

  /* ── Question bank ──────────────────────────────────────────────────── */

  function bankView() {
    const p = profile();
    const subjects = p.subjects.length ? p.subjects.map((s) => s.id) : (IB ? IB.subjects().filter((s) => (p.programme === 'MYP') === /^MYP /.test(s.name)).map((s) => s.id) : []);
    let sid = current.params.subject || ui.bank.subject || subjects[0] || '';
    if (!subjects.includes(sid) && subjects.length) sid = subjects[0];
    ui.bank.subject = sid;
    const sub = IB && IB.subjects().find((s) => s.id === sid);
    const lvl = p.programme === 'DP' ? ((p.subjects.find((s) => s.id === sid) || {}).level || '') : '';
    const metas = api.metas();
    const byUnit = new Map();
    metas.forEach((m) => { if (m.unit && !byUnit.has(m.unit)) byUnit.set(m.unit, m); });
    const mine = metas.filter((m) => !m.unit && m.hasGuide);
    return '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Question bank</h1>'
      + '<p class="ft-lead">Exam-style questions for every unit, with IB command terms and marks. Write your answer and Flux AI marks it like an examiner, point by point, quoting the words that earned each mark. Flux AI also writes fresh questions from your notes whenever you want more.</p></header>'
      + '<div class="ft-picks" role="group" aria-label="Subject">' + subjects.map((id) => '<button type="button" class="ft-pick' + (id === sid ? ' is-on' : '') + '" aria-pressed="' + (id === sid) + '" data-hub="bank-subject" data-id="' + esc(id) + '">' + esc(subjectName(id).replace(/^MYP /, '')) + '</button>').join('') + '</div>'
      + (sub ? '<ul class="ft-units ft-units--bank">' + sub.units.filter((u) => !(lvl === 'SL' && u.hl)).map((u) => unitRow(u, byUnit.get(u.id), sid, true)).join('') + '</ul>' : '')
      + (mine.length ? '<h2 class="ft-h3 ft-syl-sec">From your own notes</h2><ul class="ft-units">' + mine.map((m) => '<li class="ft-unit is-started"><span class="ft-unit-code"></span><span class="ft-unit-name">' + esc(m.title || 'Untitled study set') + '</span><span class="ft-unit-acts"><a class="ft-mini ft-mini--go" href="' + esc(api.setHash(m.id, 'ib')) + '">Questions</a></span></li>').join('') + '</ul>' : '');
  }

  /* ── Daily 5 ────────────────────────────────────────────────────────── */

  function dailyView() {
    const d = ui.daily;
    const head = '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Daily 5</h1><p class="ft-lead">Five quick questions from your study sets, weakest terms first. A new five every day, worth ' + XP.daily + ' XP.</p></header>';
    if (!d) return head + '<p class="ft-help" role="status">Picking today\'s questions…</p>';
    if (d.empty) return head + '<div class="ft-empty"><p><strong>No study sets yet.</strong> Open a unit in <a href="#bank">the question bank</a> or <a href="#library">add your notes</a>, and the Daily 5 fills from them.</p></div>';
    if (d.i >= d.qs.length) {
      return head + '<section class="ft-panel ft-center"><p class="ft-big-score">' + d.right + ' / ' + d.qs.length + '</p><p class="ft-lead">' + (d.right === d.qs.length ? 'All of them. Brilliant.' : d.right * 2 >= d.qs.length ? 'Good work.' : 'The ones you missed are in Mistakes, ready for another go.') + '</p>'
        + '<div class="ft-row ft-row--center"><a class="ft-btn" href="#home">Back home</a>' + (d.right < d.qs.length ? '<a class="ft-btn ft-btn--quiet" href="#mistakes">See my mistakes</a>' : '') + '</div></section>';
    }
    const it = d.qs[d.i];
    const rec = d.rec;
    return head + '<div class="ft-meter" role="progressbar" aria-label="Daily 5" aria-valuemin="0" aria-valuemax="' + d.qs.length + '" aria-valuenow="' + d.i + '"><span style="width:' + Math.round(d.i / d.qs.length * 100) + '%"></span></div>'
      + '<p class="ft-help">Question ' + (d.i + 1) + ' of ' + d.qs.length + ' · ' + esc(it.title) + '</p>'
      + '<form class="ft-panel ft-q" data-hub-form="daily" novalidate>' + api.questionBody(it.q, 'ftDaily', { given: rec ? rec.given : undefined, locked: !!rec, rec })
      + (rec ? api.feedbackHtml(it.q, rec) + '<div class="ft-row"><button type="button" class="ft-btn" data-hub="daily-next">' + (d.i + 1 < d.qs.length ? 'Next question' : 'See my score') + '</button></div>'
        : '<div class="ft-row"><button type="submit" class="ft-btn">Check</button><button type="button" class="ft-btn ft-btn--quiet" data-hub="daily-unsure">I don\'t know</button></div>')
      + '</form>';
  }
  async function startDaily() {
    ui.daily = { loading: true, qs: [], i: 0 };
    const sets = await fullSets((m) => m.hasGuide, 8);
    const usable = sets.filter((s) => s.guide && s.guide.terms && s.guide.terms.length >= 2);
    if (!usable.length) { ui.daily = { empty: true }; if (current.view === 'daily') rerender(); return; }
    const seedDay = today();
    const qs = [];
    let k = 0;
    while (qs.length < 5 && k < 25) {
      const set = usable[k % usable.length];
      const w = worked(set);
      const got = w.concepts.length >= 2 ? T.buildPracticeTest(w.corpus, w.concepts, set.mastery, { count: 1, types: ['mc', 'tf', 'written'], focus: 'weak', seed: seedDay + set.id + k }) : [];
      if (got[0] && !qs.some((x) => T.questionText(x.q) === T.questionText(got[0]))) qs.push({ setId: set.id, title: set.title || 'Study set', q: got[0] });
      k++;
    }
    ui.daily = qs.length ? { qs, i: 0, right: 0, rec: null } : { empty: true };
    if (current.view === 'daily') rerender();
  }
  function conceptIdsOf(q) {
    if (Array.isArray(q.conceptIds) && q.conceptIds.length) return q.conceptIds;
    return q.conceptId ? [q.conceptId] : [];
  }
  async function answerDaily(form, unsure) {
    const d = ui.daily;
    const it = d && d.qs && d.qs[d.i];
    if (!it || d.rec) return;
    const given = unsure ? '' : api.readGiven(form, it.q);
    if (!unsure && api.blank(it.q, given)) { api.announce('Answer first, or press I don\'t know.'); return; }
    const res = unsure ? { verdict: 'incorrect' } : T.checkAnswer(it.q, given);
    const right = !unsure && T.isRight(res.verdict);
    d.rec = Object.assign({}, res, { given, unsure });
    if (right) d.right++;
    const set = await api.getSet(it.setId);
    if (set) {
      const now = new Date().toISOString();
      conceptIdsOf(it.q).forEach((id) => { set.mastery[id] = T.applyResult(set.mastery[id], unsure ? 'incorrect' : res.verdict, now); });
      if (!right) T.logMistake(set, { kind: 'test', prompt: T.questionText(it.q), given: typeof given === 'string' ? given : '', answer: T.answerText(it.q), conceptIds: conceptIdsOf(it.q) });
      set.studiedAt = now;
      T.logActivity(set);
      await api.saveSet(set);
    }
    track('answer', { right });
    rerender();
    const next = root().querySelector('[data-hub="daily-next"]');
    if (next) next.focus();
  }
  function nextDaily() {
    const d = ui.daily;
    d.i++;
    d.rec = null;
    if (d.i >= d.qs.length) {
      const p = profile();
      if (!(p.daily && p.daily.day === today() && p.daily.done)) {
        p.daily = { day: today(), done: true, right: d.right };
        saveProfile();
        gain(XP.daily);
      }
    }
    rerender();
    const f = root().querySelector('.ft-q input, .ft-big-score');
    if (f && f.focus) f.focus();
  }

  /* ── Mistakes ───────────────────────────────────────────────────────── */

  function mistakesView() {
    const head = '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Mistakes</h1><p class="ft-lead">Every question you got wrong, in one place. Answer each in your head, then check: get it right and it leaves the list.</p></header>';
    const m = ui.mist;
    if (!m || m.loading) return head + '<p class="ft-help" role="status">Gathering your mistakes…</p>';
    if (!m.items.length) return head + '<div class="ft-empty"><p><strong>Nothing to fix.</strong> Questions you get wrong anywhere in Flux Tutor show up here.</p></div>';
    return head + '<ol class="ft-mistakes">' + m.items.map((x) => {
      const open = m.open === x.id;
      return '<li class="ft-mistake' + (open ? ' is-open' : '') + '" id="ftMis-' + esc(x.id) + '"><div class="ft-mis-top"><span class="ft-chip">' + esc(x.title) + '</span>' + (x.count > 1 ? '<span class="ft-chip ft-chip--warn">Missed ' + x.count + ' times</span>' : '') + '</div>'
        + '<p class="ft-mis-q">' + esc(x.prompt) + '</p>'
        + (open
          ? '<p class="ft-help">Your last answer: ' + esc(x.given || '(none)') + '</p><p class="ft-answer-line">Answer: <strong>' + esc(x.answer) + '</strong></p>' + (x.why ? '<p class="ft-note">' + esc(x.why) + '</p>' : '')
            + '<div class="ft-row"><button type="button" class="ft-btn" data-hub="mis-fixed" data-set="' + esc(x.setId) + '" data-id="' + esc(x.id) + '">' + ic('check', 16) + 'I had it right</button><button type="button" class="ft-btn ft-btn--quiet" data-hub="mis-close">Not yet</button></div>'
          : '<div class="ft-row"><button type="button" class="ft-btn ft-btn--quiet ft-btn--small" data-hub="mis-open" data-id="' + esc(x.id) + '">Show the answer</button><a class="ft-mini" href="' + esc(api.setHash(x.setId, 'learn')) + '">Learn it</a></div>')
        + '</li>';
    }).join('') + '</ol>';
  }
  async function loadMistakes() {
    ui.mist = { loading: true, items: [] };
    const sets = await fullSets((m) => m.mistakes > 0, 40);
    const items = [];
    sets.forEach((s) => T.openMistakes(s).forEach((x) => items.push(Object.assign({ setId: s.id, title: s.title || 'Study set' }, x))));
    items.sort((a, b) => (b.count - a.count) || (a.at < b.at ? 1 : -1));
    ui.mist = { items: items.slice(0, 150), open: '' };
    if (current.view === 'mistakes') rerender();
  }
  async function fixMistake(setId, id) {
    const set = await api.getSet(setId);
    if (set) { T.fixMistake(set, id); await api.saveSet(set); }
    ui.mist.items = ui.mist.items.filter((x) => x.id !== id);
    track('answer', { right: true });
    rerender();
    api.announce('Fixed. ' + plural(ui.mist.items.length, 'mistake') + ' left.');
  }

  /* ── Tutor chat ─────────────────────────────────────────────────────── */

  function chats() {
    const c = readLs(CHAT_KEY, null);
    return c && Array.isArray(c.threads) ? c : { threads: [] };
  }
  function saveChats(c) {
    c.threads = c.threads.slice(-20).map((t) => Object.assign(t, { msgs: t.msgs.slice(-40) }));
    if (!writeLs(CHAT_KEY, c)) { c.threads = c.threads.slice(-5); writeLs(CHAT_KEY, c); }
  }
  function chatView() {
    const p = profile();
    const subj = current.params.subject || '';
    if (!ui.chat || ui.chat.subject !== subj) {
      const t = chats().threads.filter((x) => x.subject === subj).slice(-1)[0];
      ui.chat = { subject: subj, id: t ? t.id : '', msgs: t ? t.msgs.slice() : [], streaming: '', passages: [] };
    }
    const sname = subjectName(subj);
    const quick = ['Explain the hardest idea in my notes simply', 'Quiz me with one exam-style question', 'What key terms must I know?', 'Make me a one-page cheat sheet'];
    const log = ui.chat.msgs.map(msgHtml).join('') + (ui.chatBusy ? (ui.chat.streaming ? msgHtml({ role: 'assistant', text: ui.chat.streaming, passages: ui.chat.passages, live: true }) : '<div class="ft-msg ft-msg--ai"><p class="ft-msg-who">' + ic('sparkle', 14) + ' Flux Tutor</p><p class="ft-typing" role="status">Reading your notes…</p></div>') : '');
    const ids = p.subjects.length ? p.subjects.map((s) => s.id) : (IB ? IB.subjects().map((s) => s.id) : []);
    return '<header class="ft-chat-head"><div><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Tutor chat</h1>'
      + '<p class="ft-lead">Ask anything about ' + (sname ? esc(sname) : 'your subjects') + '. Flux Tutor answers from your study sets first and shows which passages it used. Anything from beyond your notes is marked.</p></div>'
      + '<div class="ft-field ft-field--inline"><label class="ft-label" for="ftChatSubj">About</label><select class="ft-select" id="ftChatSubj" data-hub-change="chat-subject"><option value="">All my study sets</option>'
      + ids.map((id) => '<option value="' + esc(id) + '"' + (id === subj ? ' selected' : '') + '>' + esc(subjectName(id)) + '</option>').join('') + '</select></div></header>'
      + (aiReady() ? '' : signInCard('Sign in to chat with Flux AI.'))
      + '<div class="ft-chat"><div class="ft-chat-log" id="ftChatLog">' + (log || '<div class="ft-chat-empty"><p>Try one of these, or ask your own question.</p><ul class="ft-chat-quick">' + quick.map((q) => '<li><button type="button" class="ft-pick" data-hub="chat-quick" data-q="' + esc(q) + '"' + (aiReady() ? '' : ' disabled') + '>' + esc(q) + '</button></li>').join('') + '</ul></div>') + '</div>'
      + '<form class="ft-chat-form" data-hub-form="chat" novalidate><label class="ft-visually-hidden" for="ftChatIn">Your question</label>'
      + '<textarea class="ft-textarea" id="ftChatIn" name="q" rows="2" maxlength="1200" placeholder="Ask Flux Tutor…"' + (aiReady() ? '' : ' disabled') + '></textarea>'
      + '<button type="submit" class="ft-btn ft-btn--icon" aria-label="Send"' + (aiReady() && !ui.chatBusy ? '' : ' disabled') + '>' + ic('send', 18) + '</button></form>'
      + (ui.chat.msgs.length ? '<div class="ft-row"><button type="button" class="ft-link-btn" data-hub="chat-new">Start a new chat</button></div>' : '')
      + '</div>';
  }
  function msgHtml(m) {
    if (m.role === 'user') return '<div class="ft-msg ft-msg--me"><p>' + esc(m.text) + '</p></div>';
    if (m.role === 'error') return '<div class="ft-msg ft-msg--err">' + aiErrorHtml(m.err) + '</div>';
    const passages = m.passages || [];
    const paras = AI.parseChat(m.text, passages.length);
    const body = paras.map((para) => {
      let html = '';
      let inList = false;
      para.lines.forEach((ln) => {
        const inner = ln.parts.map((pt) => (pt.cite ? '<a class="ft-cite-num" href="' + esc(passages[pt.cite - 1].href || '#') + '" title="' + esc(passages[pt.cite - 1].label) + '">[' + pt.cite + ']</a>' : esc(pt.text))).join('');
        if (ln.bullet && !inList) { html += '<ul>'; inList = true; }
        if (!ln.bullet && inList) { html += '</ul>'; inList = false; }
        html += ln.bullet ? '<li>' + inner + '</li>' : '<p>' + inner + '</p>';
      });
      if (inList) html += '</ul>';
      return para.beyond ? '<div class="ft-beyond"><p class="ft-beyond-label">' + ic('info', 14) + ' Beyond your notes: check it in your textbook</p>' + html + '</div>' : html;
    }).join('');
    const src = passages.length && !m.live ? '<details class="ft-msg-src"><summary>' + plural(passages.length, 'passage') + ' from your notes</summary><ol>' + passages.map((x) => '<li><a href="' + esc(x.href) + '">' + esc(x.label) + '</a>: ' + esc(x.text.slice(0, 260)) + (x.text.length > 260 ? '…' : '') + '</li>').join('') + '</ol></details>' : '';
    return '<div class="ft-msg ft-msg--ai"><p class="ft-msg-who">' + ic('sparkle', 14) + ' Flux Tutor</p>' + body + src
      + (!m.live ? '<div class="ft-msg-acts"><button type="button" class="ft-mini" data-hub="chat-quick" data-q="Explain that more simply">Simpler</button><button type="button" class="ft-mini" data-hub="chat-quick" data-q="Give me an example">Example</button><button type="button" class="ft-mini" data-hub="chat-quick" data-q="Quiz me on that">Quiz me</button></div>' : '') + '</div>';
  }
  /** The best passages for a question, across the study sets in scope. */
  async function retrieve(question, subj) {
    const sets = await fullSets((m) => m.words > 0 && (!subj || setSubjectId(m) === subj), 40);
    const hits = [];
    sets.forEach((s) => {
      const w = worked(s);
      const r = T.searchNotes(w.corpus, w.index, question, w.concepts);
      if (r.empty) return;
      (r.covered ? r.results : (r.related || [])).slice(0, 3).forEach((x, i) => {
        const text = x.sentences.map((p) => p.text).join(' ');
        const src = x.ref && x.ref.sourceId ? 'src=' + encodeURIComponent(x.ref.sourceId) + '&find=' + encodeURIComponent(text.slice(0, 80)) : '';
        hits.push({ text, score: (r.covered ? 1 : 0.5) * (Number(x.score) || 1) - i * 0.01, label: (s.title || 'Study set') + ' · ' + T.formatRef(x.ref), href: api.setHash(s.id, 'notes', src) });
      });
    });
    return hits.sort((a, b) => b.score - a.score).slice(0, 6);
  }
  async function sendChat(text) {
    const q = String(text || '').trim().slice(0, 1200);
    if (!q || ui.chatBusy || !aiReady()) return;
    const c = ui.chat;
    c.msgs.push({ role: 'user', text: q });
    ui.chatBusy = true;
    c.streaming = '';
    rerender();
    // Follow-ups ("simpler", "quiz me") keep the last answer's passages.
    const last = c.msgs.slice(0, -1).reverse().find((m) => m.role === 'assistant');
    let passages = await retrieve(q, c.subject);
    if (passages.length < 2 && last && last.passages && last.passages.length) passages = last.passages;
    c.passages = passages;
    const history = c.msgs.slice(0, -1).filter((m) => m.role !== 'error');
    let paint = 0;
    try {
      const reply = await AI.chat(history, passages, q, { programme: profile().programme, subject: subjectName(c.subject) }, (t) => {
        c.streaming = t;
        if (paint) return;
        paint = setTimeout(() => { paint = 0; if (current.view === 'chat' && ui.chatBusy) { const log = document.getElementById('ftChatLog'); if (log) { const at = log.scrollHeight - log.scrollTop - log.clientHeight < 40; log.innerHTML = c.msgs.map(msgHtml).join('') + msgHtml({ role: 'assistant', text: c.streaming, passages, live: true }); if (at) log.scrollTop = log.scrollHeight; } } }, 60);
      });
      c.msgs.push({ role: 'assistant', text: reply || 'I could not write an answer to that. Try asking it another way.', passages });
      track('ai');
    } catch (e) {
      c.msgs.push({ role: 'error', err: { code: e.code, message: e.message } });
    }
    clearTimeout(paint);
    c.streaming = '';
    ui.chatBusy = false;
    const all = chats();
    if (!c.id) c.id = 'c' + Date.now().toString(36);
    const keep = c.msgs.filter((m) => m.role !== 'error');
    const at = all.threads.findIndex((t) => t.id === c.id);
    const thread = { id: c.id, subject: c.subject, at: new Date().toISOString(), msgs: keep };
    if (at >= 0) all.threads[at] = thread; else all.threads.push(thread);
    saveChats(all);
    if (current.view === 'chat') { rerender(); const inp = document.getElementById('ftChatIn'); if (inp) inp.focus(); }
  }

  /* ── Teach it back, Blurting, Flashcards: pick a set ────────────────── */

  const TOOLS = {
    teach: { title: 'Teach it back', tab: 'teach', lead: 'Pick a study set, then explain a topic in your own words as if teaching a classmate. Flux AI checks it against your notes: what you got right, what you missed, anything wrong, and the question a classmate would ask next.' },
    blurt: { title: 'Blurting', tab: 'blurt', lead: 'Pick a study set and a topic, then write down everything you remember without looking. Flux Tutor shows the key terms and facts you recalled and the ones you left out.' },
    cards: { title: 'Flashcards', tab: 'cards', lead: 'Spaced repetition for every key term. Cards come back just before you would forget them.' },
  };
  function toolView(id) {
    const key = TOOLS[id] ? id : 'teach';
    const tool = TOOLS[key];
    const head = '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(tool.title) + '</h1><p class="ft-lead">' + esc(tool.lead) + '</p></header>';
    const metas = api.metas().filter((m) => m.hasGuide).sort((a, b) => (key === 'cards' ? (b.cardsDue || 0) - (a.cardsDue || 0) : 0) || ((a.studiedAt || '') < (b.studiedAt || '') ? 1 : -1));
    if (!metas.length) return head + '<div class="ft-empty"><p><strong>No study sets yet.</strong> Open a unit from <a href="#bank">the question bank</a> or <a href="#library">add your notes</a> first.</p></div>';
    return head + '<ul class="ft-pick-sets">' + metas.map((m) => '<li><a href="' + esc(api.setHash(m.id, tool.tab)) + '"><span class="ft-today-t"><strong>' + esc(m.title || 'Untitled study set') + '</strong><span class="ft-help">'
      + (key === 'cards' ? plural(m.cardsDue || 0, 'card') + ' due' : plural(m.terms || 0, 'term') + ' · ' + (m.mastered || 0) + ' known') + '</span></span>' + ic('arrow', 16) + '</a></li>').join('') + '</ul>';
  }

  /* ── Coursework: IA, EE, TOK ────────────────────────────────────────── */

  function courseList() { const c = readLs(COURSE_KEY, null); return c && Array.isArray(c.items) ? c : { items: [] }; }
  function courseView(group) {
    const comps = AI ? AI.COMPONENTS.filter((c) => c.kind === 'written' && c.group === group) : [];
    if (!ui.course || ui.course.group !== group) ui.course = { group, comp: comps[0] ? comps[0].id : '', draft: '', criteria: '', title: '', result: null, busy: false, err: null };
    const st = ui.course;
    const comp = comps.find((c) => c.id === st.comp) || comps[0];
    const past = courseList().items.filter((x) => comps.some((c) => c.id === x.comp)).slice(-6).reverse();
    const names = { IA: 'Internal assessment', EE: 'Extended essay', TOK: 'Theory of knowledge' };
    const checks = comp && st.draft.trim() ? AI.courseChecks(comp, st.draft) : [];
    return '<header><p class="ft-kicker">Write and get marked</p><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">' + esc(names[group] || group) + '</h1>'
      + '<p class="ft-lead">Paste your draft for a predicted mark on each criterion, what already works, and the changes that gain the most marks. Flux AI never rewrites your work: the ideas and the words stay yours, as the IB requires.</p></header>'
      + (aiReady() ? '' : signInCard('Sign in to get feedback from Flux AI.'))
      + '<form class="ft-panel" data-hub-form="course" novalidate>'
      + (comps.length > 1 ? '<div class="ft-field"><label class="ft-label" for="ftCComp">What is it?</label><select class="ft-select" id="ftCComp" name="comp" data-hub-change="course-comp">' + comps.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === comp.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' : '')
      + (comp ? '<p class="ft-help">' + esc(comp.note) + (comp.criteria.length ? ' Criteria: ' + comp.criteria.map((k) => esc(k.id + ' ' + k.name) + ' (' + k.max + ')').join(', ') + '.' : '') + ' Check them against your subject guide.</p>' : '')
      + '<div class="ft-field"><label class="ft-label" for="ftCTitle">Title or research question <span class="ft-optional">(optional)</span></label><input class="ft-input" id="ftCTitle" name="title" maxlength="200" value="' + esc(st.title) + '"></div>'
      + (comp && comp.id === 'custom' ? '<div class="ft-field"><label class="ft-label" for="ftCCrit">Criteria, one per line</label><textarea class="ft-textarea" id="ftCCrit" name="criteria" rows="4" placeholder="A. Research design (6)&#10;B. Data analysis (6)">' + esc(st.criteria) + '</textarea></div>' : '')
      + '<div class="ft-field"><label class="ft-label" for="ftCDraft">Your draft</label><textarea class="ft-textarea ft-textarea--tall" id="ftCDraft" name="draft" rows="14" data-hub-input="draft" placeholder="Paste your draft here">' + esc(st.draft) + '</textarea>'
      + '<p class="ft-help" id="ftCCount">' + AI.wordsIn(st.draft) + ' words' + (comp && comp.words ? ' of ' + comp.words : '') + '</p></div>'
      + (checks.length ? '<ul class="ft-checks">' + checks.map((c) => '<li class="is-' + c.kind + '">' + ic(c.kind === 'good' ? 'check' : 'info', 16) + '<span>' + esc(c.text) + '</span></li>').join('') + '</ul>' : '')
      + '<div class="ft-row"><button type="submit" class="ft-btn"' + (st.busy || !aiReady() ? ' disabled' : '') + '>' + ic('sparkle', 17) + (st.busy ? 'Reading your draft…' : 'Get feedback') + '</button></div>'
      + '</form>'
      + (st.err ? aiErrorHtml(st.err) : '')
      + (st.result ? courseResultHtml(st.result) : '')
      + (past.length ? '<section class="ft-home-sec"><h2 class="ft-h3">Earlier feedback</h2><ul class="ft-history">' + past.map((x) => '<li><button type="button" class="ft-link-btn" data-hub="course-open" data-id="' + esc(x.id) + '">' + esc(x.title || 'Untitled draft') + '</button><span class="ft-help">' + esc(new Date(x.at).toLocaleDateString()) + ' · ' + x.result.total + ' / ' + x.result.max + '</span></li>').join('') + '</ul></section>' : '');
  }
  function courseResultHtml(r) {
    if (r.failed) return '<p class="ft-alert" role="alert">' + esc(r.message || 'Flux AI could not turn that into feedback. Try again.') + '</p>';
    const pct = r.max ? Math.round(r.total / r.max * 100) : 0;
    return '<section class="ft-panel ft-course-result" aria-labelledby="ftCResTitle"><div class="ft-sec-head"><h2 class="ft-h2" id="ftCResTitle" tabindex="-1">Predicted ' + r.total + ' / ' + r.max + '</h2><span class="ft-chip ft-chip--accent">' + pct + '%</span></div>'
      + (r.summary ? '<p class="ft-lead">' + esc(r.summary) + '</p>' : '')
      + (r.priorities.length ? '<h3 class="ft-h4">Do these first</h3><ol class="ft-priorities">' + r.priorities.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '')
      + r.rows.map((k) => '<article class="ft-crit"><header><h3 class="ft-h4">' + esc(k.id) + ' · ' + esc(k.name) + '</h3><span class="ft-crit-mark">' + k.mark + ' / ' + k.max + '</span></header>'
        + '<div class="ft-meter"><span style="width:' + Math.round(k.mark / k.max * 100) + '%"></span></div>'
        + (k.working.length ? '<p class="ft-label">What works</p><ul>' + k.working.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
        + (k.fixes.length ? '<p class="ft-label">To gain marks</p><ul class="ft-fixes">' + k.fixes.map((f) => '<li>' + (f.quote ? '<q>' + esc(f.quote) + '</q> ' : '') + esc(f.advice) + '</li>').join('') + '</ul>' : '')
        + '</article>').join('')
      + '<p class="ft-help">A prediction to guide your next draft, not an IB mark. Your teacher and the IB moderators decide the real one.' + (r.fromCache ? ' This draft was marked before, so you see the same feedback.' : '') + '</p></section>';
  }
  async function runCourse(form) {
    const st = ui.course;
    const comp = AI.COMPONENTS.find((c) => c.id === (form.elements.comp ? form.elements.comp.value : st.comp)) || AI.COMPONENTS.find((c) => c.group === st.group);
    st.comp = comp.id;
    st.title = String(form.elements.title.value || '').slice(0, 200);
    st.draft = String(form.elements.draft.value || '');
    st.criteria = form.elements.criteria ? String(form.elements.criteria.value || '') : '';
    if (AI.wordsIn(st.draft) < 80) { st.err = { message: 'Paste at least a paragraph or two of your draft first.' }; rerender(); return; }
    st.busy = true; st.err = null; st.result = null;
    rerender();
    try {
      st.result = await AI.courseFeedback(comp, st.draft, st.criteria);
      if (!st.result.failed) {
        const c = courseList();
        c.items.push({ id: 'cw' + Date.now().toString(36), comp: comp.id, title: st.title || (st.draft.trim().split('\n')[0] || '').slice(0, 80), at: new Date().toISOString(), draft: st.draft.slice(0, 40000), criteria: st.criteria, result: st.result });
        c.items = c.items.slice(-12);
        if (!writeLs(COURSE_KEY, c)) { c.items = c.items.slice(-3); writeLs(COURSE_KEY, c); }
        step('draft');
        track('ai');
      }
    } catch (e) { st.err = { code: e.code, message: e.message }; }
    st.busy = false;
    rerender();
    const r = document.getElementById('ftCResTitle');
    if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'start' }); }
  }

  /* ── Mock orals ─────────────────────────────────────────────────────── */

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const VOICE = { French: 'fr-FR', Spanish: 'es-ES', German: 'de-DE', Mandarin: 'zh-CN' };
  let recog = null;
  function oralView() {
    const comps = AI ? AI.COMPONENTS.filter((c) => c.kind === 'oral') : [];
    if (!ui.oral) ui.oral = { comp: comps[0] ? comps[0].id : '', lang: '', turns: [], busy: false, result: null, err: null, listening: false, draft: '', live: '' };
    const st = ui.oral;
    const comp = comps.find((c) => c.id === st.comp) || comps[0];
    const head = '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Mock orals</h1><p class="ft-lead">Practise an individual oral with a Flux AI examiner who listens and asks follow-up questions you have not prepared for. ' + (Rec ? 'Speak or type' : 'Type (this browser cannot listen)') + ' each answer, then get a mark for each criterion.</p></header>';
    if (!aiReady()) return head + signInCard('Sign in to practise orals with Flux AI.');
    if (!st.turns.length && !st.busy) {
      return head + (st.err ? aiErrorHtml(st.err) : '') + '<form class="ft-panel" data-hub-form="oral-start" novalidate><div class="ft-grid">'
        + '<div class="ft-field"><label class="ft-label" for="ftOComp">Oral</label><select class="ft-select" id="ftOComp" name="comp">' + comps.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === st.comp ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>'
        + '<div class="ft-field"><label class="ft-label" for="ftOLang">Language</label><select class="ft-select" id="ftOLang" name="lang">' + [['', 'English'], ['French', 'French'], ['Spanish', 'Spanish'], ['German', 'German'], ['Mandarin', 'Mandarin']].map((l) => '<option value="' + l[0] + '"' + (l[0] === st.lang ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select></div>'
        + '</div><p class="ft-help">' + esc(comp ? comp.note : '') + '</p><div class="ft-row"><button type="submit" class="ft-btn">' + ic('mic', 17) + 'Start the oral</button></div></form>';
    }
    const log = st.turns.map((t) => '<div class="ft-msg ' + (t.role === 'examiner' ? 'ft-msg--ai' : 'ft-msg--me') + '">' + (t.role === 'examiner' ? '<p class="ft-msg-who">' + ic('user', 14) + ' Examiner</p>' : '') + '<p>' + esc(t.text) + '</p></div>').join('')
      + (st.busy && !st.result ? '<div class="ft-msg ft-msg--ai"><p class="ft-msg-who">' + ic('user', 14) + ' Examiner</p><p class="ft-typing" role="status">' + esc(st.live || '…') + '</p></div>' : '');
    const said = st.turns.filter((t) => t.role === 'student').length;
    return head + '<div class="ft-chat"><div class="ft-chat-log" id="ftChatLog">' + log + '</div>'
      + (st.result ? courseResultHtml(st.result) : '<form class="ft-chat-form" data-hub-form="oral" novalidate><label class="ft-visually-hidden" for="ftOralIn">Your answer</label>'
        + '<textarea class="ft-textarea" id="ftOralIn" name="a" rows="3" data-hub-input="oral" placeholder="' + (Rec ? 'Press Speak, or type' : 'Type your answer') + '">' + esc(st.draft) + '</textarea>'
        + (Rec ? '<button type="button" class="ft-btn ft-btn--quiet" data-hub="oral-mic" aria-pressed="' + st.listening + '">' + ic(st.listening ? 'stop' : 'mic', 18) + '<span>' + (st.listening ? 'Stop' : 'Speak') + '</span></button>' : '')
        + '<button type="submit" class="ft-btn ft-btn--icon" aria-label="Answer"' + (st.busy ? ' disabled' : '') + '>' + ic('send', 18) + '</button></form>')
      + (st.err ? aiErrorHtml(st.err) : '')
      + '<div class="ft-row">' + (!st.result && said >= 2 ? '<button type="button" class="ft-btn" data-hub="oral-mark"' + (st.busy ? ' disabled' : '') + '>' + ic('sparkle', 17) + 'Finish and mark my oral</button>' : '')
      + '<button type="button" class="ft-btn ft-btn--quiet" data-hub="oral-reset">Start again</button></div></div>';
  }
  async function oralAsk() {
    const st = ui.oral;
    const comp = AI.COMPONENTS.find((c) => c.id === st.comp);
    st.busy = true; st.err = null;
    rerender();
    try {
      const q = st.turns.length ? await AI.oralNext(comp, st.turns, { language: st.lang }, (t) => { st.live = t; const el = root().querySelector('.ft-typing'); if (el) el.textContent = t; })
        : (st.lang ? await AI.oralNext(comp, [], { language: st.lang }) : comp.opener);
      st.turns.push({ role: 'examiner', text: String(q || '').trim() || 'Tell me more about that.' });
      speak(st.turns[st.turns.length - 1].text, st.lang);
    } catch (e) { st.err = { code: e.code, message: e.message }; }
    st.live = ''; st.busy = false;
    rerender();
    const inp = document.getElementById('ftOralIn');
    if (inp) inp.focus();
    const log = document.getElementById('ftChatLog');
    if (log) log.scrollTop = log.scrollHeight;
  }
  function speak(text, lang) {
    try {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = VOICE[lang] || 'en-GB';
      speechSynthesis.speak(u);
    } catch (_) { /* no voice */ }
  }
  function toggleMic() {
    const st = ui.oral;
    if (st.listening && recog) { try { recog.stop(); } catch (_) { /* stopped */ } return; }
    recog = new Rec();
    recog.lang = VOICE[st.lang] || 'en-GB';
    recog.continuous = true;
    recog.interimResults = true;
    const base = st.draft ? st.draft.replace(/\s+$/, '') + ' ' : '';
    recog.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      st.draft = base + text;
      const inp = document.getElementById('ftOralIn');
      if (inp) inp.value = st.draft;
    };
    recog.onend = () => { st.listening = false; if (current.view === 'oral') rerender(); };
    recog.onerror = () => { st.listening = false; };
    st.listening = true;
    try { recog.start(); } catch (_) { st.listening = false; }
    rerender();
  }

  /* ── Progress ───────────────────────────────────────────────────────── */

  function progressView() {
    const p = profile();
    const metas = api.metas();
    const lv = levelOf(p.xp);
    const streak = T.studyStreak(metas.map((m) => m.activity).concat([p.answered]));
    const answered = sumMap(p.answered);
    const cells = [];
    for (let i = 83; i >= 0; i--) {
      const d = T.addDays(today(), -i);
      const n = (p.answered[d] || 0) + metas.reduce((k, m) => k + ((m.activity || {})[d] || 0), 0);
      cells.push('<span class="ft-heat-cell" data-n="' + Math.min(4, n ? Math.ceil(n / 5) : 0) + '" title="' + esc(d) + ': ' + n + '"></span>');
    }
    const bySubj = new Map();
    metas.forEach((m) => {
      const sid = setSubjectId(m) || 'other';
      const row = bySubj.get(sid) || { name: subjectName(sid) || 'Other notes', terms: 0, known: 0, pct: [], sets: 0 };
      row.terms += m.terms || 0; row.known += m.mastered || 0; row.sets++;
      if (m.predicted && m.predicted.confidence !== 'low') row.pct.push(m.predicted.pct);
      bySubj.set(sid, row);
    });
    const tile = (num, label) => '<li class="ft-stat"><span class="ft-stat-num">' + num + '</span><span class="ft-stat-label">' + esc(label) + '</span></li>';
    return '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Progress</h1></header>'
      + '<section class="ft-panel ft-level"><p class="ft-level-num">Level ' + lv.level + '</p><div class="ft-meter ft-meter--big" role="progressbar" aria-label="XP to the next level" aria-valuemin="0" aria-valuemax="' + lv.span + '" aria-valuenow="' + lv.into + '"><span style="width:' + Math.round(lv.into / lv.span * 100) + '%"></span></div><p class="ft-help">' + p.xp + ' XP · ' + (lv.span - lv.into) + ' XP to level ' + (lv.level + 1) + '. ' + XP.right + ' XP for a right answer, ' + XP.daily + ' for the Daily 5, ' + XP.exam + ' for a mock exam.</p></section>'
      + '<ul class="ft-stats">' + tile(streak.current, 'day streak') + tile(streak.best, 'best streak') + tile(answered, 'questions answered') + tile(answered ? Math.round(sumMap(p.right) / answered * 100) + '%' : '—', 'right') + '</ul>'
      + '<section class="ft-home-sec"><h2 class="ft-h3">The last 12 weeks</h2><div class="ft-heat" role="img" aria-label="Days studied in the last 12 weeks: ' + streak.days + ' days in all">' + cells.join('') + '</div></section>'
      + '<section class="ft-home-sec"><h2 class="ft-h3">By subject</h2>' + (bySubj.size ? '<ul class="ft-subj-progress">' + Array.from(bySubj.values()).map((r) => {
        const pct = r.terms ? Math.round(r.known / r.terms * 100) : 0;
        const pred = r.pct.length ? T.gradeFor(Math.round(r.pct.reduce((a, b) => a + b, 0) / r.pct.length)) : null;
        return '<li><span class="ft-sp-name"><strong>' + esc(r.name) + '</strong><span class="ft-help">' + plural(r.sets, 'set') + ' · ' + r.known + ' of ' + plural(r.terms, 'term') + ' known</span></span><span class="ft-meter"><span style="width:' + pct + '%"></span></span>'
          + '<span class="ft-sp-grade" title="Predicted grade">' + (pred ? '<span class="ft-visually-hidden">Predicted grade </span>' + pred : '—') + '</span></li>';
      }).join('') + '</ul><p class="ft-help">Predicted grades come from your mock exams, practice tests and known terms. Real grade boundaries change each session.</p>' : '<p class="ft-help">Study a unit to see your progress here.</p>') + '</section>'
      + syncLine()
      + (AI && AI.signedIn() ? '<p class="ft-help">Signed in' + (AI.userName() ? ' as ' + esc(AI.userName()) : '') + '. <button type="button" class="ft-link-btn" data-hub="signout">Sign out of Flux Tutor</button></p>' : '');
  }

  function syncLine() {
    const C = window.FluxTutorCloud;
    if (!C) return '';
    const st = C.status();
    const text = !aiReady() ? 'Sign in to keep your study sets, XP and streak on every device.'
      : st.state === 'synced' ? 'Your study sets, XP and streak are saved to your Flux account.'
      : st.state === 'syncing' ? 'Saving to your Flux account…'
      : st.state === 'unavailable' ? 'Saving to your account is not switched on yet. Everything is saved in this browser.'
      : st.state === 'error' ? 'Could not save to your Flux account just now. It tries again by itself.'
      : 'Your study sets are saved in this browser.';
    return '<p class="ft-notice">' + ic('check', 17) + '<span>' + esc(text) + (aiReady() ? '' : ' <a href="#chat">Sign in</a>') + '</span></p>';
  }

  /* ── Study plan ─────────────────────────────────────────────────────── */

  function planView() {
    const p = profile();
    const metas = api.metas();
    const exams = metas.filter((m) => m.examDate).sort((a, b) => (a.examDate < b.examDate ? -1 : 1));
    const tasks = plannerTasks();
    const start = sessionStart(p.session);
    return '<header><h1 class="ft-h1" id="ftScreenTitle" tabindex="-1">Study plan</h1><p class="ft-lead">Your exams and deadlines from Flux Tutor and the Flux Planner together. Give a study set an exam date and Flux Tutor plans each day up to it. Exam dates and cards due also show on your planner\'s calendar.</p></header>'
      + (start ? '<section class="ft-panel"><h2 class="ft-h3">' + esc(sessionLabel(p.session)) + ' exams</h2><p class="ft-lead">' + (T.daysBetween(today(), start) >= 0 ? 'About ' + plural(T.daysBetween(today(), start), 'day') + ' to go.' : 'Under way. Good luck.') + '</p></section>' : '<p class="ft-notice">' + ic('info', 17) + '<span><a href="#setup">Choose your exam session</a> to count down to it.</span></p>')
      + '<section class="ft-home-sec"><h2 class="ft-h3">Study sets with an exam date</h2>' + (exams.length ? '<ul class="ft-deadlines">' + exams.map((m) => '<li><span class="ft-dl-when' + (m.daysLeft != null && m.daysLeft >= 0 && m.daysLeft <= 3 ? ' is-soon' : '') + '">' + (m.daysLeft == null ? '' : m.daysLeft < 0 ? 'Done' : m.daysLeft === 0 ? 'Today' : m.daysLeft + ' days') + '</span><span class="ft-dl-name"><strong>' + esc(m.title) + '</strong><span class="ft-help">' + esc(new Date(m.examDate + 'T12:00:00').toLocaleDateString()) + '</span></span><a class="ft-mini ft-mini--go" href="' + esc(api.setHash(m.id, 'plan')) + '">Today\'s plan</a></li>').join('') + '</ul>'
        : '<p class="ft-help">None yet. Open a study set and add its exam date in Study plan.</p>') + '</section>'
      + '<section class="ft-home-sec"><div class="ft-sec-head"><h2 class="ft-h3">From your Flux Planner</h2><a class="ft-link" href="index.html">Open the planner</a></div>' + (tasks.length ? '<ul class="ft-deadlines">' + tasks.map(deadlineRow).join('') + '</ul>'
        : '<p class="ft-help">Tests, quizzes and coursework deadlines you add in the Flux Planner on this device show here.</p>') + '</section>';
  }

  /* ── Events ─────────────────────────────────────────────────────────── */

  function onClick(e) {
    const b = e.target.closest('[data-hub]');
    if (!b || !root().contains(b) || b.disabled) return false;
    switch (b.dataset.hub) {
      case 'skip-setup': profile().steps.skipSetup = true; saveProfile(); rerender(); break;
      case 'hide-checklist': profile().steps.hideChecklist = true; saveProfile(); rerender(); break;
      case 'unit': step('first'); api.startUnitSet(b.dataset.unit, b.dataset.tab || ''); break;
      case 'bank-subject': ui.bank.subject = b.dataset.id; current.params = Object.assign({}, current.params, { subject: b.dataset.id }); rerender(); break;
      case 'daily-unsure': answerDaily(b.closest('form'), true); break;
      case 'daily-next': nextDaily(); break;
      case 'mis-open': ui.mist.open = b.dataset.id; rerender(); { const el = document.getElementById('ftMis-' + b.dataset.id); const btn = el && el.querySelector('.ft-btn'); if (btn) btn.focus(); } break;
      case 'mis-close': ui.mist.open = ''; rerender(); break;
      case 'mis-fixed': fixMistake(b.dataset.set, b.dataset.id); break;
      case 'chat-quick': sendChat(b.dataset.q); break;
      case 'chat-new': ui.chat = { subject: ui.chat.subject, id: '', msgs: [], streaming: '', passages: [] }; rerender(); break;
      case 'course-open': {
        const x = courseList().items.find((i) => i.id === b.dataset.id);
        if (x) { Object.assign(ui.course, { comp: x.comp, draft: x.draft, title: x.title, criteria: x.criteria || '', result: x.result, err: null }); rerender(); }
        break;
      }
      case 'oral-mic': toggleMic(); break;
      case 'oral-reset': if (recog) { try { recog.stop(); } catch (_) { /* stopped */ } } ui.oral = null; rerender(); break;
      case 'oral-mark': (async () => {
        const st = ui.oral;
        st.busy = true; rerender();
        try { st.result = await AI.oralMark(AI.COMPONENTS.find((c) => c.id === st.comp), st.turns); track('ai'); } catch (er) { st.err = { code: er.code, message: er.message }; }
        st.busy = false; rerender();
      })(); break;
      case 'signout': AI.signOut(); api.toast('Signed out of Flux Tutor on this device.'); rerender(); break;
      default: return false;
    }
    return true;
  }
  function onSubmit(e) {
    const f = e.target.closest && e.target.closest('form[data-hub-form]');
    if (!f) return false;
    e.preventDefault();
    switch (f.dataset.hubForm) {
      case 'signin': doSignIn(f); break;
      case 'setup': saveSetup(f); break;
      case 'daily': answerDaily(f, false); break;
      case 'chat': { const v = f.elements.q.value; f.elements.q.value = ''; sendChat(v); break; }
      case 'course': runCourse(f); break;
      case 'oral-start': ui.oral.comp = f.elements.comp.value; ui.oral.lang = f.elements.lang.value; oralAsk(); break;
      case 'oral': {
        const v = String(f.elements.a.value || '').trim();
        if (!v) { api.announce('Say or type your answer first.'); break; }
        if (recog && ui.oral.listening) { try { recog.stop(); } catch (_) { /* stopped */ } }
        ui.oral.turns.push({ role: 'student', text: v.slice(0, 3000) });
        ui.oral.draft = '';
        oralAsk();
        break;
      }
      default: return false;
    }
    return true;
  }
  function onChange(e) {
    const t = e.target;
    const k = t.dataset && t.dataset.hubChange;
    if (!k) return false;
    if (k === 'programme') { const p = profile(); p.programme = t.value === 'MYP' ? 'MYP' : 'DP'; p.subjects = []; saveProfile(); rerender(); }
    if (k === 'chat-subject') api.go('#chat' + (t.value ? '?subject=' + encodeURIComponent(t.value) : ''));
    if (k === 'course-comp') { ui.course.comp = t.value; ui.course.result = null; const d = document.getElementById('ftCDraft'); if (d) ui.course.draft = d.value; rerender(); const s = document.getElementById('ftCComp'); if (s) s.focus(); }
    return true;
  }
  function onInput(e) {
    const t = e.target;
    const k = t.dataset && t.dataset.hubInput;
    if (!k) return false;
    if (k === 'draft' && ui.course) {
      ui.course.draft = t.value;
      const c = document.getElementById('ftCCount');
      const comp = AI.COMPONENTS.find((x) => x.id === ui.course.comp);
      if (c) c.textContent = AI.wordsIn(t.value) + ' words' + (comp && comp.words ? ' of ' + comp.words : '');
    }
    if (k === 'oral' && ui.oral) ui.oral.draft = t.value;
    return true;
  }

  /** flux-teacher-app.js hands over what the hub needs, once, at start. */
  function attach(a) {
    api = a;
    const r = a.root;
    // Capture phase, so the study-set handlers never see a hub control.
    r.addEventListener('click', (e) => { if (onClick(e)) e.stopPropagation(); }, true);
    r.addEventListener('submit', (e) => { if (onSubmit(e)) e.stopPropagation(); }, true);
    r.addEventListener('change', (e) => { if (onChange(e)) e.stopPropagation(); }, true);
    r.addEventListener('input', (e) => { if (onInput(e)) e.stopPropagation(); }, true);
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && e.target && (e.target.id === 'ftChatIn')) {
        e.preventDefault();
        const f = e.target.closest('form');
        if (f && typeof f.requestSubmit === 'function') f.requestSubmit();
      }
    });
    const menu = document.getElementById('ftMenuBtn');
    if (menu) menu.addEventListener('click', () => { const open = document.body.classList.toggle('ft-side-open'); menu.setAttribute('aria-expanded', String(open)); if (open) { const first = document.querySelector('#ftSide a'); if (first) first.focus(); } });
    const scrim = document.getElementById('ftSideScrim');
    if (scrim) scrim.addEventListener('click', () => { document.body.classList.remove('ft-side-open'); if (menu) menu.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('ft-side-open')) { document.body.classList.remove('ft-side-open'); if (menu) { menu.setAttribute('aria-expanded', 'false'); menu.focus(); } } });
  }
  /** "#chat?subject=biology" → { view: 'chat', params: { subject } }; null for a hash that is not the hub's. */
  function parse(raw) {
    const s = String(raw || '').replace(/^#\/?/, '');
    const qi = s.indexOf('?');
    const path = (qi >= 0 ? s.slice(0, qi) : s).split('/');
    const q = new URLSearchParams(qi >= 0 ? s.slice(qi + 1) : '');
    const view = path[0] || 'home';
    if (!VIEWS.includes(view)) return null;
    let id = '';
    try { id = path[1] ? decodeURIComponent(path[1]) : ''; } catch (_) { id = ''; }
    const params = { id };
    q.forEach((v, k) => { if (/^[a-z]{2,12}$/.test(k)) params[k] = v.slice(0, 80); });
    return { view, params };
  }

  /** The profile changed under us (pulled from another device). */
  function refreshProfile() { profileCache = null; paintTop(); }

  window.FluxTutorHub = { refreshProfile, attach, parse, render, frame, track, step, profile, levelOf, sessionStart, plannerTasks, writeAgenda, normProfile, signInCard, aiReady, aiErrorHtml, VIEWS, XP };
})();
