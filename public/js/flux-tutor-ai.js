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
  /*
   * Each criterion has its levels, top first: [range, what work at that level
   * does]. They summarise the IB descriptors in Flux's own words (the guides
   * themselves are the IB's), so the examiner prompt can place work in a
   * level the way a moderator does, not guess a number. `traps` are the
   * mistakes examiners' subject reports name year after year; `rules` are
   * the hard requirements of the component.
   */
  const COMPONENTS = [
    { id: 'tok-essay', group: 'TOK', kind: 'written', name: 'TOK essay', words: 1600, note: 'One mark out of 10 for the whole essay, on one of the six prescribed titles for your session.',
      rules: 'At most 1,600 words (examiners stop reading there). Must answer one prescribed title for the session, word for word. References and a bibliography are required; personal examples are allowed.',
      criteria: [{ id: 'TOK', name: 'A clear, coherent and critical exploration of the prescribed title', max: 10,
        levels: [
          ['9-10', 'Excellent: a sustained focus on the title, linked effectively to areas of knowledge. Arguments clear, coherent and supported by specific, effective examples. Implications are considered. Different points of view are explored and evaluated.'],
          ['7-8', 'Very good: focused on the title and often linked effectively to areas of knowledge. Arguments clear and supported by examples. Some awareness and evaluation of different points of view.'],
          ['5-6', 'Good: enough focus on the title; links to areas of knowledge are made but not always developed. Some arguments are clear and supported by examples. Some awareness of other points of view.'],
          ['3-4', 'Adequate: some relevant points, but the link to the title is weak or undeveloped; links to areas of knowledge are superficial. Arguments are offered but often unclear or not backed by effective examples.'],
          ['1-2', 'Rudimentary: only loosely connected to the title; largely descriptive; little or no evidence; links to areas of knowledge missing or irrelevant.'],
        ],
        traps: 'Answering a different question from the title or ignoring its key terms; generic or hypothetical examples instead of specific real ones; describing knowledge instead of analysing how we know; counterclaims named but not evaluated; a conclusion that only repeats.' }] },
    { id: 'tok-exhibition', group: 'TOK', kind: 'written', name: 'TOK exhibition', words: 950, note: 'Three objects, one IA prompt, one mark out of 10.',
      rules: 'Exactly three objects (or images of them), all linked to the same one of the 35 IA prompts. At most 950 words in all. Each object needs its specific real-world context, and sources must be referenced.',
      criteria: [{ id: 'TOK', name: 'Does the exhibition show how TOK appears in the world around us?', max: 10,
        levels: [
          ['9-10', 'Excellent: three objects with specific real-world contexts. The link from each object to the IA prompt is clear and well explained. A strong justification of what each object adds, supported by evidence and explicit reference to the prompt.'],
          ['7-8', 'Good: three objects and their contexts identified. Links to the prompt explained. Each inclusion justified, mostly supported by evidence and reference to the prompt.'],
          ['5-6', 'Satisfactory: three objects identified, though contexts may be vague. Links to the prompt explained in places. Some justification, not always supported.'],
          ['3-4', 'Basic: objects identified, but links to the prompt are made with little explanation. Justification is superficial or repetitive.'],
          ['1-2', 'Rudimentary: links to the prompt are tenuous or missing. Justification is ineffective or absent.'],
        ],
        traps: 'Objects too general (a "phone" instead of one particular phone in one place and time); commentary that describes the object without linking it to the prompt; the same point made for all three objects; quoting the prompt without using it.' }] },
    { id: 'ee', group: 'EE', kind: 'written', name: 'Extended essay', words: 4000, note: 'Criteria for first assessment 2027 (out of 30). Check the levels against the guide your school gives you.',
      rules: 'At most 4,000 words (examiners stop reading there; the bibliography and in-text references do not count). A focused research question, clearly stated. Every source cited consistently. Reflection is also assessed through the reflection form and viva voce, which Flux Tutor cannot see.',
      criteria: [
        { id: 'A', name: 'Framework for the essay', max: 6, levels: [
          ['5-6', 'A clear, focused research question or aim that the whole essay serves. Methods and sources are appropriate to the subject and their choice is explained. The structure moves the argument forward.'],
          ['3-4', 'A research question that is mostly clear but broad or not always followed. Methods and sources are appropriate but their choice is not well explained. The structure mostly works.'],
          ['1-2', 'The research question is unclear, too broad or not followed. Methods or sources are poorly suited. The structure gets in the way of the argument.'],
        ], traps: 'A question too broad for 4,000 words; methods never justified; headings that follow a template instead of the argument.' },
        { id: 'B', name: 'Knowledge and understanding', max: 6, levels: [
          ['5-6', 'Accurate, relevant knowledge of the topic and its wider context. Subject terms and concepts are used precisely and correctly. Sources are understood, not just quoted.'],
          ['3-4', 'Mostly accurate and relevant knowledge, with some gaps or irrelevance. Terms are mostly used correctly.'],
          ['1-2', 'Knowledge is limited, often inaccurate or not relevant. Subject terms are missing or misused.'],
        ], traps: 'Background that never connects to the question; textbook knowledge with no specialist sources; terms used loosely.' },
        { id: 'C', name: 'Analysis and line of argument', max: 6, levels: [
          ['5-6', 'Evidence and sources are analysed, not described. A coherent, well-supported line of argument answers the research question throughout.'],
          ['3-4', 'Some analysis, mixed with description. An argument is present but not always connected to the evidence or the question.'],
          ['1-2', 'Mostly description or summary. Little or no argument.'],
        ], traps: 'Summarising sources one after another; data presented but never interpreted; an argument that appears only in the conclusion.' },
        { id: 'D', name: 'Discussion and evaluation', max: 8, levels: [
          ['7-8', 'Conclusions follow from the analysis and are consistent with it. The strengths and limitations of the research, methods and sources are weighed critically, including how they affect the answer.'],
          ['5-6', 'Conclusions are mostly supported. Strengths and limitations are discussed, though not always their effect on the answer.'],
          ['3-4', 'Conclusions are partly supported. Evaluation is general or brief.'],
          ['1-2', 'Conclusions are not supported by the essay. Little or no evaluation.'],
        ], traps: 'Sources never evaluated for reliability; limitations listed in a final paragraph instead of discussed; a conclusion that introduces new material.' },
        { id: 'E', name: 'Reflection', max: 4, levels: [
          ['3-4', 'Reflection shows how the student’s thinking and choices developed during the research, what they learned, and how it shaped the essay.'],
          ['1-2', 'Reflection is descriptive: what was done, with little on why or what was learned.'],
        ], traps: 'Diary-style descriptions of the process; reflection with nothing about choices and their consequences.' },
      ] },
    { id: 'sci-ia', group: 'IA', kind: 'written', name: 'Science IA (Biology, Chemistry, Physics)', words: 3000, note: 'Criteria for first assessment 2025 (out of 24).',
      rules: 'At most 3,000 words (tables, graphs, equations and references do not count). A research question with its context, enough relevant data, uncertainties handled, a conclusion compared with accepted science, and an evaluation of the method.',
      criteria: [
        { id: 'RD', name: 'Research design', max: 6, levels: [
          ['5-6', 'The purpose of the investigation gives detailed context for a clearly and precisely stated research question. The method’s considerations for collecting relevant and sufficient data are described. The method is described well enough to be reproduced.'],
          ['3-4', 'The research question is stated but its context is not detailed. Methodological considerations are described. The method could mostly be reproduced, with a few gaps or ambiguities.'],
          ['1-2', 'The research question is outlined in a broad context. Methodological considerations are only stated. The method is unclear and could not be reproduced.'],
        ], traps: 'A question with no named independent and dependent variables or ranges; too few values of the independent variable or too few repeats to see a trend; controlled variables listed without saying how they were controlled.' },
        { id: 'DA', name: 'Data analysis', max: 6, levels: [
          ['5-6', 'Recording and processing of data is clear and precise. Processing is appropriate to the research question and carried out accurately. Uncertainties are appropriately considered and carried through.'],
          ['3-4', 'Recording and processing are communicated, with some lapses in clarity or precision. Processing is relevant but has significant omissions or errors. Uncertainties are considered in places.'],
          ['1-2', 'Recording and processing are unclear. Processing is inappropriate or has many errors. Little or no consideration of uncertainties.'],
        ], traps: 'Raw data without units or uncertainties; averages with no spread; graphs without error bars or a line of best fit; inconsistent significant figures.' },
        { id: 'CO', name: 'Conclusion', max: 6, levels: [
          ['5-6', 'The conclusion is relevant to the research question and fully consistent with the analysis. It is justified by comparison with the accepted scientific context.'],
          ['3-4', 'The conclusion is relevant but not fully consistent with the analysis. Some comparison with accepted scientific context.'],
          ['1-2', 'The conclusion is stated but not supported by the analysis. Comparison with scientific context is superficial or missing.'],
        ], traps: 'Claiming more than the data shows (e.g. "proves"); ignoring scatter and anomalies; no literature value or theory to compare against.' },
        { id: 'EV', name: 'Evaluation', max: 6, levels: [
          ['5-6', 'The effect of specific, relevant weaknesses and limitations of the method on the results is discussed. Realistic, relevant improvements and extensions are explained.'],
          ['3-4', 'Weaknesses and their effect are described. Improvements and extensions are described.'],
          ['1-2', 'Weaknesses are stated generically (e.g. "human error"). Improvements are only listed.'],
        ], traps: '"Human error" or "more repeats" with no specific cause or effect; improvements that do not fix the weakness named.' },
      ] },
    { id: 'math-ia', group: 'IA', kind: 'written', name: 'Maths exploration (AA or AI)', words: 0, note: 'About 12–20 pages, out of 20.',
      rules: 'About 12–20 pages, double-spaced. The mathematics must be at the level of the course (HL needs sophistication and rigour for the top of E). Sources and any technology used must be acknowledged.',
      criteria: [
        { id: 'A', name: 'Presentation', max: 4, levels: [
          ['4', 'Coherent, well organised and concise.'], ['3', 'Coherent and well organised.'], ['2', 'Some coherence or some organisation.'], ['1', 'Some coherence or organisation, but hard to follow.'],
        ], traps: 'No clear aim at the start; long tangents and repeated calculations that make it not concise; a conclusion that does not answer the aim.' },
        { id: 'B', name: 'Mathematical communication', max: 4, levels: [
          ['4', 'Relevant notation, symbols and terminology used appropriately and consistently, with suitable multiple forms of representation (formulae, diagrams, tables, graphs).'],
          ['3', 'Mostly appropriate and consistent notation and terminology.'], ['2', 'Some appropriate notation and terminology, with lapses.'], ['1', 'Limited appropriate mathematical communication.'],
        ], traps: 'Calculator notation (x^2, *, E-3); variables not defined; graphs without labelled axes or scales.' },
        { id: 'C', name: 'Personal engagement', max: 3, levels: [
          ['3', 'Abundant evidence of significant personal engagement: independent thinking, creativity, own questions and approaches.'], ['2', 'Significant evidence of personal engagement.'], ['1', 'Some evidence, often only stated ("I find this interesting").'],
        ], traps: 'Saying the topic is interesting instead of showing it through own choices, data or extensions.' },
        { id: 'D', name: 'Reflection', max: 3, levels: [
          ['3', 'Substantial critical reflection on results, methods and limitations throughout the exploration.'], ['2', 'Meaningful reflection.'], ['1', 'Limited or superficial reflection, often only at the end.'],
        ], traps: 'Reflection only in the conclusion; no comment on the validity or limits of the model or method.' },
        { id: 'E', name: 'Use of mathematics', max: 6, levels: [
          ['5-6', 'Relevant mathematics at the level of the course, correct, with thorough knowledge and understanding (for HL, with sophistication and rigour).'],
          ['3-4', 'Relevant mathematics, mostly correct, with good or some knowledge and understanding.'],
          ['1-2', 'Some relevant mathematics, with limited understanding or many errors.'],
        ], traps: 'Mathematics below the level of the course; results from software with no working or understanding shown; errors in the core method.' },
      ] },
    { id: 'econ-ia', group: 'IA', kind: 'written', name: 'Economics IA commentary', words: 800, note: 'One commentary, out of 14 (the three-commentary rubric, F, is marked on the whole portfolio).',
      rules: 'At most 800 words. A news article published within one year before writing. Each commentary uses a different unit of the syllabus and a key concept, with diagrams that are referred to in the text.',
      criteria: [
        { id: 'A', name: 'Diagrams', max: 3, levels: [
          ['3', 'Relevant, accurate diagrams with a full explanation, referred to in the text and applied to the article.'], ['2', 'Relevant, accurate diagrams with a limited explanation, or minor errors.'], ['1', 'Relevant diagrams with significant errors, or not explained.'],
        ], traps: 'Generic textbook diagrams with no figures or labels from the article; diagrams never mentioned in the text.' },
        { id: 'B', name: 'Terminology', max: 2, levels: [
          ['2', 'Relevant economic terms used appropriately throughout.'], ['1', 'Some relevant terms used, not always appropriately.'],
        ], traps: 'Terms defined but then not used; everyday words where an economic term is needed.' },
        { id: 'C', name: 'Application and analysis', max: 3, levels: [
          ['3', 'Relevant economic theory applied effectively to the article throughout, with effective economic analysis.'], ['2', 'Theory applied to the article with some analysis, not throughout.'], ['1', 'Theory described with little application to the article.'],
        ], traps: 'Retelling the article; theory explained in general with no link to the case.' },
        { id: 'D', name: 'Key concept', max: 3, levels: [
          ['3', 'The chosen key concept is clearly linked to the article and its use is explained and developed.'], ['2', 'The key concept is linked to the article, with some explanation.'], ['1', 'The key concept is named but the link is not explained.'],
        ], traps: 'Naming the key concept only in the cover sheet or first line.' },
        { id: 'E', name: 'Evaluation', max: 3, levels: [
          ['3', 'Effective evaluation: judgements supported by effective, balanced reasoning (e.g. stakeholders, short and long run, assumptions).'], ['2', 'Evaluation present but judgements not always supported.'], ['1', 'Limited or unsupported evaluation.'],
        ], traps: 'Evaluation as a list of points with no final judgement; one-sided arguments.' },
      ] },
    { id: 'lit-essay', group: 'IA', kind: 'written', name: 'English A HL essay', words: 1500, note: '1,200–1,500 words, out of 20.',
      rules: '1,200–1,500 words on one work studied in the course, following a line of inquiry. References to the work and any secondary sources must be cited.',
      criteria: [
        { id: 'A', name: 'Knowledge, understanding and interpretation', max: 5, levels: [
          ['5', 'Excellent knowledge and understanding of the work; persuasive interpretation of its implications, effectively supported by well-chosen references.'], ['4', 'Very good, with a sustained interpretation and relevant references.'], ['3', 'Good: a satisfactory interpretation, supported in places.'], ['2', 'Some knowledge, superficial interpretation.'], ['1', 'Little knowledge, little or no interpretation.'],
        ], traps: 'Plot summary in place of interpretation; quotations dropped in without discussion.' },
        { id: 'B', name: 'Analysis and evaluation', max: 5, levels: [
          ['5', 'Insightful, convincing analysis and evaluation of how the writer’s choices create meaning.'], ['4', 'Very good analysis with some evaluation.'], ['3', 'Generally appropriate analysis, mostly descriptive in places.'], ['2', 'Some analysis, largely descriptive.'], ['1', 'Little or no analysis.'],
        ], traps: 'Feature-spotting (naming techniques) without saying what they do.' },
        { id: 'C', name: 'Focus, organization and development', max: 5, levels: [
          ['5', 'Effectively organised, coherent; the line of inquiry is well developed throughout.'], ['4', 'Well organised and mostly coherent and developed.'], ['3', 'Adequately organised; development uneven.'], ['2', 'Some organisation; little development.'], ['1', 'Little organisation or focus.'],
        ], traps: 'A line of inquiry that drifts; paragraphs not linked.' },
        { id: 'D', name: 'Language', max: 5, levels: [
          ['5', 'Very clear, carefully chosen, accurate and varied language; effective register and style.'], ['4', 'Clear, carefully chosen language with a good degree of accuracy.'], ['3', 'Clear language, generally accurate, with lapses.'], ['2', 'Sometimes clear; errors affect it.'], ['1', 'Rarely clear and appropriate.'],
        ], traps: 'Informal register; long quotations padding the word count.' },
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
  // A short summary of the levels for prompts that mark several criteria at once (orals).
  COMPONENTS.forEach((c) => c.criteria.forEach((k) => {
    if (k.levels && !k.bands) k.bands = k.levels.map((l) => l[0] + ': ' + l[1]).join(' ');
  }));
  /** "5-6" → [5, 6]; "4" → [4, 4]. */
  function levelRange(r) {
    const m = String(r || '').match(/^\s*(\d{1,2})\s*(?:[-–]\s*(\d{1,2}))?\s*$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    return a <= b ? [a, b] : null;
  }

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
  /*
   * Precise marking: one criterion at a time, over the whole draft.
   *
   * Groq allows about 8,000 tokens a minute per model, and ai-proxy cuts a
   * request that is too big from the FRONT, so sending a 4,000-word EE in one
   * go lost its introduction and research question. Instead a long draft is
   * read in parts first (evidence for each criterion, every quote checked
   * against the draft), then each criterion is marked on its own from that
   * evidence plus the opening and the end of the draft. One criterion per
   * call means the examiner weighs one set of level descriptors at a time,
   * and the code holds the mark to the level it chose.
   */
  const WHOLE_MAX = 11000;
  const PART_CHARS = 7000;
  const CRIT_SYSTEM = [
    'You are a senior IB moderator marking ONE criterion of a student\'s coursework draft.',
    'Mark as IB examiners do:',
    '1. Read the level descriptors from the top level down and choose the level that best fits the work as a whole (best fit: the work need not meet every word of a level).',
    '2. Within the level, give the higher mark when the description is clearly and consistently met, the lower when it is only just met.',
    '3. Mark only what is on the page. Never reward plans, intentions or sections the student says they will add. Do not inflate marks: most drafts sit in the middle levels.',
    '4. Words beyond the word limit are not read by examiners and earn nothing.',
    'Academic honesty: never rewrite the student\'s work and never write sentences for them to copy.',
    'Reply ONLY with JSON: {"level":"5-6","mark":5,"met":["…"],"missing":["…"],"evidence":["…"],"fixes":[{"quote":"…","advice":"…"}],"confidence":"high"}',
    '- level: one of the given level ranges, written exactly as given ("0" if the work does not reach the lowest level).',
    '- met: at most 2 parts of the chosen level the work clearly meets, each under 20 words.',
    '- missing: at most 2 things that keep it out of the next level up, each under 25 words.',
    '- evidence: at most 2 short quotes (under 20 words) copied exactly from the draft that justify the mark.',
    '- fixes: at most 2. "quote" is a short exact quote from the draft the fix is about, or "". "advice" says what to do in under 35 words, without writing it for them.',
    '- confidence: "low" if the draft is short, a section is missing, or you cannot see enough to judge; otherwise "medium" or "high".',
  ].join('\n');
  const PART_SYSTEM = [
    'You help an IB moderator by reading ONE part of a longer coursework draft. Do not give marks.',
    'For each criterion, note the evidence in THIS part that an examiner would weigh: strengths and weaknesses.',
    'Reply ONLY with JSON: {"notes":[{"c":"A","kind":"strength","quote":"exact words from this part, under 20 words","note":"what it shows, under 20 words"}]}',
    'kind is "strength" or "weakness". At most 2 notes per criterion; leave out criteria this part says nothing about. Copy every quote exactly.',
  ].join('\n');

  /** Splits a draft at paragraph breaks into parts of at most `size` characters. */
  function splitDraft(draft, size) {
    const max = size || PART_CHARS;
    const paras = String(draft || '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    const pieces = [];
    paras.forEach((p) => {
      if (p.length <= max) { pieces.push(p); return; }
      // A very long paragraph: at sentence ends, or hard cuts if there are none.
      let cur = '';
      p.split(/(?<=[.!?])\s+/).forEach((s) => {
        while (s.length > max) { if (cur) { pieces.push(cur); cur = ''; } pieces.push(s.slice(0, max)); s = s.slice(max); }
        if (cur && cur.length + s.length + 1 > max) { pieces.push(cur); cur = ''; }
        cur = cur ? cur + ' ' + s : s;
      });
      if (cur) pieces.push(cur);
    });
    const parts = [];
    let cur = '';
    pieces.forEach((p) => {
      if (cur && cur.length + p.length + 2 > max) { parts.push(cur); cur = ''; }
      cur = cur ? cur + '\n\n' + p : p;
    });
    if (cur) parts.push(cur);
    return parts;
  }
  /** Short lines that look like section headings, in order. */
  function headingsOf(draft) {
    return String(draft || '').split('\n').map((l) => l.trim())
      .filter((l) => l.length >= 3 && l.length <= 80 && !/[.,;:]$/.test(l) && wordsIn(l) <= 10 && /^[\p{Lu}\d]/u.test(l))
      .slice(0, 30);
  }
  function topLevel(k) { return k.levels && k.levels[0] ? k.levels[0][1] : (k.bands || ''); }
  function partPrompt(component, criteria, part, i, n) {
    return 'Component: ' + component.name + '\nCriteria (what the top level asks for):\n'
      + criteria.map((k) => k.id + '. ' + k.name + ': ' + str(topLevel(k), 260)).join('\n')
      + '\n\nPart ' + (i + 1) + ' of ' + n + ' of the draft:\n"""' + part + '"""';
  }
  function parsePart(text, criteria, part) {
    const j = parseJson(text);
    if (!plainObject(j) || !Array.isArray(j.notes)) return null;
    const ids = new Set(criteria.map((k) => k.id.toUpperCase()));
    const per = {};
    const notes = [];
    j.notes.forEach((x) => {
      if (!plainObject(x)) return;
      const c = String(x.c || '').toUpperCase();
      const q = str(x.quote, 240).trim();
      if (!ids.has(c) || !q || !quoted(part, q)) return;
      per[c] = (per[c] || 0) + 1;
      if (per[c] > 3) return;
      notes.push({ c, kind: x.kind === 'weakness' ? 'weakness' : 'strength', quote: q, note: str(x.note, 200).trim() });
    });
    return { notes };
  }
  function criterionPrompt(component, k, draft, evidence, title) {
    const words = wordsIn(draft);
    const head = 'Component: ' + component.name
      + (component.words ? ' (word limit ' + component.words + '; this draft has ' + words + ' words' + (words > component.words ? ', over the limit' : '') + ')' : ' (this draft has ' + words + ' words)')
      + (component.rules ? '\nRules: ' + component.rules : '')
      + (title ? '\nThe student\'s title or research question: ' + str(title, 200) : '')
      + '\n\nCriterion ' + k.id + '. ' + k.name + ' (out of ' + k.max + ')'
      + (k.levels && k.levels.length ? '\nLevels, top first:\n' + k.levels.map((l) => l[0] + ': ' + l[1]).join('\n')
        : (k.bands ? '\nWhat it asks for: ' + k.bands : '\nNo level descriptors were given: judge it out of ' + k.max + ' the way an IB examiner would.'))
      + (k.traps ? '\nMistakes examiners often report for this criterion: ' + k.traps : '');
    if (!evidence) return head + '\n\nThe draft:\n"""' + draft + '"""';
    const notes = evidence.filter((x) => x.c === k.id.toUpperCase());
    const hs = headingsOf(draft);
    return head + '\n\nThe draft is long, so it was read in full, part by part. Evidence found for this criterion (quotes are exact):\n'
      + (notes.length ? notes.map((x) => '- part ' + x.part + ', ' + x.kind + ': "' + x.quote + '"' + (x.note ? ' (' + x.note + ')' : '')).join('\n') : '- nothing specific was found for this criterion.')
      + (hs.length ? '\n\nSection headings, in order: ' + hs.join(' | ') : '')
      + '\n\nThe opening of the draft:\n"""' + draft.slice(0, 2500) + '"""'
      + '\n\nThe end of the draft:\n"""' + draft.slice(-2000) + '"""';
  }
  function normLevel(s) { return String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/\s+/g, ''); }
  /** One criterion's reply, held to the level descriptors: the mark must sit inside the level chosen. */
  function parseCriterion(text, k, draft) {
    const j = parseJson(text);
    if (!plainObject(j)) return null;
    const levels = (k.levels || []).map((l) => ({ name: l[0], text: l[1], range: levelRange(normLevel(l[0])) })).filter((l) => l.range);
    const rawMark = Number(j.mark);
    let mark = Number.isFinite(rawMark) ? Math.max(0, Math.min(k.max, Math.round(rawMark))) : null;
    let level = levels.find((l) => normLevel(l.name) === normLevel(j.level)) || null;
    if (normLevel(j.level) === '0' && mark == null) mark = 0;
    if (level) {
      if (mark == null) mark = level.range[0];
      else mark = Math.max(level.range[0], Math.min(level.range[1], mark));
    } else if (mark != null) {
      level = levels.find((l) => mark >= l.range[0] && mark <= l.range[1]) || null;
    }
    if (mark == null) return null;
    const evidence = strs(j.evidence, 3, 240).filter((q) => quoted(draft, q)).slice(0, 2);
    let confidence = ['high', 'medium', 'low'].includes(j.confidence) ? j.confidence : 'medium';
    if (mark > 0 && !evidence.length && confidence === 'high') confidence = 'medium';
    const next = levels.filter((l) => l.range[0] > mark).pop() || null;
    return {
      id: k.id, name: k.name, max: k.max, mark,
      level: level ? level.name.replace('-', '–') : String(mark),
      levelText: level ? level.text : '',
      next: next ? { name: next.name.replace('-', '–'), text: next.text } : null,
      working: strs(j.met, 2, 240),
      missing: strs(j.missing, 2, 300),
      evidence,
      fixes: list(j.fixes).filter(plainObject).slice(0, 2).map((f) => {
        const q = str(f.quote, 240).trim();
        return { quote: q && quoted(draft, q) ? q : '', advice: str(f.advice, 400).trim() };
      }).filter((f) => f.advice),
      confidence,
    };
  }
  /** The headline and the three changes worth most marks, worked out from the rows (no extra AI call). */
  function courseSummary(rows, component, draft) {
    const total = rows.reduce((n, r) => n + r.mark, 0);
    const max = rows.reduce((n, r) => n + r.max, 0);
    const gap = rows.slice().sort((a, b) => (b.max - b.mark) / b.max - (a.max - a.mark) / a.max || (b.max - b.mark) - (a.max - a.mark));
    const best = rows.slice().sort((a, b) => b.mark / b.max - a.mark / a.max)[0];
    const priorities = gap.filter((r) => r.mark < r.max).slice(0, 3).map((r) => {
      const how = r.missing[0] || (r.fixes[0] && r.fixes[0].advice) || (r.next ? 'Reach the next level: ' + r.next.text : '');
      return r.id + ' ' + r.name + ' (' + r.mark + ' of ' + r.max + '): ' + how;
    }).filter((x) => !/: $/.test(x));
    const words = wordsIn(draft);
    const parts = ['Predicted ' + total + ' of ' + max + '.'];
    if (best && rows.length > 1) parts.push('Strongest: ' + best.id + ' ' + best.name + '.');
    if (gap[0] && rows.length > 1 && gap[0].mark < gap[0].max) parts.push('Most marks to gain: ' + gap[0].id + ' ' + gap[0].name + '.');
    if (component.words && words > component.words) parts.push('The draft is over the ' + component.words + '-word limit; examiners stop reading there.');
    if (rows.some((r) => r.confidence === 'low')) parts.push('Marks shown as unsure could move by a level.');
    return { total, max, priorities, summary: parts.join(' ') };
  }
  /** Runs a Flux AI step, waiting and trying again (twice) when Flux AI is busy. */
  async function patiently(run, onWait) {
    for (let i = 0; ; i++) {
      try { return await run(); } catch (e) {
        if (!(e instanceof AiError) || e.code !== 'busy' || i >= 2) throw e;
        if (typeof onWait === 'function') onWait();
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
  }
  async function courseFeedback(component, draft, extra, opts) {
    const o = opts || {};
    const criteria = criteriaFor(component, extra);
    if (!criteria.length) return { failed: true, message: 'Paste the criteria with a letter, a name and the marks on each line, like "A. Research design (6)".' };
    const d = String(draft || '').slice(0, DRAFT_MAX * 2);
    const progress = (text) => { if (typeof o.onProgress === 'function') o.onProgress(text); };
    const wait = () => progress('Flux AI is busy. Waiting a moment, then carrying on…');
    // Each step is cached on its own, so trying again after an error carries on where it stopped.
    let evidence = null;
    if (d.length > WHOLE_MAX) {
      const parts = splitDraft(d, PART_CHARS);
      evidence = [];
      for (let i = 0; i < parts.length; i++) {
        progress('Reading part ' + (i + 1) + ' of ' + parts.length + ' of your draft…');
        const got = await patiently(() => cached('course-part', { c: component.id, k: criteria.map((k) => k.id), p: parts[i] }, async () => {
          const text = await call({ system: PART_SYSTEM, json: true, messages: [{ role: 'user', content: partPrompt(component, criteria, parts[i], i, parts.length) }] });
          return parsePart(text, criteria, parts[i]) || { failed: true };
        }), wait);
        if (got && !got.failed) got.notes.forEach((x) => evidence.push(Object.assign({ part: i + 1 }, x)));
      }
    }
    const rows = [];
    for (let i = 0; i < criteria.length; i++) {
      const k = criteria[i];
      progress('Marking ' + (k.id === 'TOK' ? 'your ' + component.name : 'criterion ' + k.id + ', ' + k.name) + '…');
      const prompt = criterionPrompt(component, k, d, evidence, o.title);
      let row = null;
      for (let attempt = 0; attempt < 2 && !row; attempt++) {
        const got = await patiently(() => cached('course-crit', { v: 2, a: attempt, p: prompt }, async () => {
          const text = await call({ system: CRIT_SYSTEM, json: true, messages: [{ role: 'user', content: prompt }] });
          return parseCriterion(text, k, d) || { failed: true };
        }), wait);
        if (got && !got.failed) row = got;
      }
      if (!row) return { failed: true, message: 'Flux AI could not mark criterion ' + k.id + '. Try again: the parts already done are kept.' };
      rows.push(row);
    }
    return Object.assign({ rows, whole: !evidence }, courseSummary(rows, component, d));
  }

  /* ── 8. Lesson transcripts into notes ───────────────────────────────── */

  /** Plain lines from a pasted transcript or a caption file (WebVTT, SRT, Otter, Granola, Teams). */
  function cleanTranscript(raw) {
    const out = [];
    String(raw || '').replace(/\r\n?/g, '\n').split('\n').forEach((line0) => {
      let line = line0.trim();
      if (!line || /^WEBVTT/i.test(line) || /^(NOTE|STYLE|REGION)(\s|$)/.test(line)) return;
      if (/^\d+$/.test(line) || /-->/.test(line)) return;                                  // SRT cue numbers and timings
      if (/^[[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?[\])]?$/.test(line)) return;           // a bare timestamp
      if (/^.{1,40}?\s{2,}\d{1,2}:\d{2}(?::\d{2})?$/.test(line)) return;                    // "Speaker 1  0:03" (Otter)
      line = line.replace(/<v\s+([^>]+)>/gi, '$1: ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (line && out[out.length - 1] !== line) out.push(line);                             // captions repeat lines
    });
    return out.join('\n');
  }
  /** Numbered pieces of about 45 words, so notes can point at where in the lesson they came from. Works without punctuation (Chrome's speech recognition adds none). */
  function lessonSegments(text, maxWords) {
    const max = maxWords || 45;
    const sents = [];
    String(text || '').split(/\n+|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
      const w = s.split(/\s+/);
      for (let i = 0; i < w.length; i += max) sents.push(w.slice(i, i + max).join(' '));
    });
    const segs = [];
    let cur = [];
    let n = 0;
    sents.forEach((s) => {
      const c = wordsIn(s);
      if (cur.length && n + c > max) { segs.push(cur.join(' ')); cur = []; n = 0; }
      cur.push(s); n += c;
    });
    if (cur.length) segs.push(cur.join(' '));
    return segs.map((t, i) => ({ n: i + 1, text: t }));
  }
  function lessonChunks(segs, maxChars) {
    const max = maxChars || 6000;
    const out = [];
    let cur = [];
    let len = 0;
    segs.forEach((s) => {
      if (cur.length && len + s.text.length > max) { out.push(cur); cur = []; len = 0; }
      cur.push(s); len += s.text.length + 6;
    });
    if (cur.length) out.push(cur);
    return out;
  }
  const LESSON_SYSTEM = [
    'You turn part of a class transcript into clear study notes for an IB student.',
    'The transcript comes from speech recognition: it may have no punctuation and some misheard words. Fix a misheard word only when the meaning is certain; otherwise leave the point out.',
    'Use only what was said in this part. Never add facts that were not said. Leave out small talk, jokes and classroom management.',
    'Reply ONLY with JSON: {"title":"the topic of this part, under 8 words","points":[{"text":"one clear note in your own words","s":[3,4]}],"terms":[{"term":"…","def":"the definition as taught","s":[5]}],"exam":[{"text":"what the teacher said about tests, exams or what to learn","s":[7]}],"tasks":[{"text":"homework, deadlines or things to bring","s":[9]}]}',
    'Every item gives in "s" the numbers of the transcript lines it comes from. At most 10 points, 8 terms, 4 exam items and 4 tasks.',
  ].join('\n');
  function citeList(v, lo, hi) {
    return Array.from(new Set(list(v).map(Number).filter((n) => Number.isInteger(n) && n >= lo && n <= hi))).slice(0, 6);
  }
  /** One part's notes. Items that cite no line of this part are dropped: they were not said here. */
  function parseLessonPart(text, lo, hi) {
    const j = parseJson(text);
    if (!plainObject(j)) return null;
    const items = (v, max) => list(v).filter(plainObject).map((x) => ({ text: str(x.text, 400).trim(), s: citeList(x.s, lo, hi) })).filter((x) => x.text && x.s.length).slice(0, max);
    return {
      title: str(j.title, 100).trim(),
      points: items(j.points, 10),
      terms: list(j.terms).filter(plainObject).map((x) => ({ term: str(x.term, 100).trim(), def: str(x.def, 400).trim(), s: citeList(x.s, lo, hi) })).filter((x) => x.term && x.def && x.s.length).slice(0, 8),
      exam: items(j.exam, 4),
      tasks: items(j.tasks, 4),
    };
  }
  function lessonPrompt(chunk, i, n, subject) {
    return (subject ? 'Subject: ' + subject + '\n' : '') + 'Part ' + (i + 1) + ' of ' + n + ' of the lesson transcript:\n'
      + chunk.map((s) => '[' + s.n + '] ' + s.text).join('\n');
  }
  async function lessonNotes(raw, opts) {
    const o = opts || {};
    const segments = lessonSegments(cleanTranscript(raw));
    if (wordsIn(segments.map((s) => s.text).join(' ')) < 30) return { failed: true, message: 'There is not enough in the transcript yet to make notes from.' };
    const chunks = lessonChunks(segments, 6000);
    const parts = [];
    let missed = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const lo = c[0].n;
      const hi = c[c.length - 1].n;
      if (typeof o.onProgress === 'function') o.onProgress('Making notes from part ' + (i + 1) + ' of ' + chunks.length + '…');
      const got = await patiently(() => cached('lesson', { s: o.subject || '', t: c.map((x) => x.text), lo }, async () => {
        const text = await call({ system: LESSON_SYSTEM, json: true, messages: [{ role: 'user', content: lessonPrompt(c, i, chunks.length, o.subject) }] });
        return parseLessonPart(text, lo, hi) || { failed: true };
      }), () => { if (typeof o.onProgress === 'function') o.onProgress('Flux AI is busy. Waiting a moment, then carrying on…'); });
      if (got && !got.failed) parts.push(Object.assign({ lo, hi }, got)); else missed++;
    }
    if (!parts.length) return { failed: true, message: 'Flux AI could not turn this transcript into notes. Try again.' };
    return { segments, parts, missed };
  }
  /** The notes as text for a study set: "Term: definition" lines become flashcards there. */
  function lessonNotesText(notes, title) {
    const lines = [];
    if (title) lines.push(title, '');
    list(notes && notes.parts).forEach((p) => {
      if (p.title) lines.push(p.title);
      p.points.forEach((x) => lines.push(x.text));
      p.terms.forEach((x) => lines.push(x.term + ': ' + x.def));
      p.exam.forEach((x) => lines.push('For the test: ' + x.text));
      p.tasks.forEach((x) => lines.push('To do: ' + x.text));
      lines.push('');
    });
    return lines.join('\n').trim();
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
    levelRange, splitDraft, headingsOf, parsePart, criterionPrompt, parseCriterion, courseSummary,
    oralNext, oralMark,
    cleanTranscript, lessonSegments, lessonChunks, parseLessonPart, lessonNotes, lessonNotesText,
  };
})();
