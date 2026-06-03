/* ════════════════════════════════════════════════════════════════════════════
 * FLUX TOOLBOX · DP/MYP expansion pack
 * ----------------------------------------------------------------------------
 * Adds reference tools for the school's IB DP/MYP classes (Psychology,
 * Literature, German, Global Politics, Visual Arts, Music theory, Math
 * Analysis & Applications, History source-analysis, expanded Bio/Physics)
 * and re-sorts the Study Tools toolbox into clean, balanced subject groups
 * aligned to the IB subject areas:
 *
 *   Sciences · Mathematics · Individuals & Societies · Language & Literature
 *   · Language Acquisition · The Arts · Computer Science
 *
 * Design: this is a *companion* to flux-toolbox.js. It does not touch the
 * 4000-line core — it registers new modal tools via window.fluxOpenToolModal
 * (the same API the flux-reftool-* files use) and rewrites the contents of
 * window.fluxToolbox.UNIFIED_LAYOUT in place, before the toolbox first renders.
 *
 * Loaded after flux-toolbox.js + flux-reference-tools.js in index.html.
 * ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var esc = window.fluxEsc || function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ── shared renderers (match flux-reference-tools.js visual language) ── */

  // Formula-style cards: [{ name, eq, vars, ex }]
  function renderFormulaCards(body, list, q) {
    var query = (q || '').toLowerCase();
    var filtered = query
      ? list.filter(function (f) { return (f.name + ' ' + f.eq + ' ' + (f.vars || '')).toLowerCase().indexOf(query) !== -1; })
      : list;
    return '<div class="ref-formula-grid">' + (filtered.length
      ? filtered.map(function (f) {
        return '<div class="ref-formula-card">'
          + '<div class="ref-formula-name">' + esc(f.name) + '</div>'
          + (f.eq ? '<pre class="ref-formula-eq">' + esc(f.eq) + '</pre>' : '')
          + (f.vars && f.vars !== '-' ? '<div class="ref-formula-vars"><strong>Where:</strong> ' + esc(f.vars) + '</div>' : '')
          + (f.ex && f.ex !== '-' ? '<div class="ref-formula-ex"><strong>Example:</strong> ' + esc(f.ex) + '</div>' : '')
          + '</div>';
      }).join('')
      : '<div class="ref-empty">No matches for "' + esc(q) + '"</div>') + '</div>';
  }

  // Glossary/term cards: [{ name, def, ex }]
  function renderTermCards(body, list, q) {
    var query = (q || '').toLowerCase();
    var filtered = query
      ? list.filter(function (t) { return (t.name + ' ' + t.def + ' ' + (t.ex || '')).toLowerCase().indexOf(query) !== -1; })
      : list;
    return '<div class="fs-body">' + (filtered.length
      ? filtered.map(function (t) {
        return '<div class="fs-item">'
          + '<div class="fs-f"><strong>' + esc(t.name) + '</strong></div>'
          + '<div class="fs-v">' + esc(t.def) + '</div>'
          + (t.ex ? '<div class="fs-v" style="opacity:.8"><em>' + esc(t.ex) + '</em></div>' : '')
          + '</div>';
      }).join('')
      : '<div class="ref-empty">No matches for "' + esc(q) + '"</div>') + '</div>';
  }

  // Simple table: cols = ['A','B'], rows = [['x','y'], ...]
  function renderTable(cols, rows) {
    return '<div class="ref-table-wrap"><table class="ref-table"><thead><tr>'
      + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr>' + r.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
      }).join('')
      + '</tbody></table></div>';
  }

  // Build a standard searchable modal tool from a tab→data map of formula/term lists.
  // kind: 'formula' | 'term'
  function makeSearchableModal(opts) {
    var searchId = 'dpSearch_' + opts.id;
    function render(body, tabId) {
      var q = (document.getElementById(searchId) ? document.getElementById(searchId).value : '') || '';
      var data = opts.data[tabId] || [];
      var inner = opts.kind === 'term' ? renderTermCards(body, data, q) : renderFormulaCards(body, data, q);
      body.innerHTML =
        '<div class="ref-inner-search"><input type="search" id="' + searchId + '" class="ref-search-input" placeholder="' + esc(opts.searchPlaceholder || 'Search…') + '" value="' + esc(q) + '"></div>'
        + '<div id="' + searchId + '_out">' + inner + '</div>';
      var input = body.querySelector('#' + searchId);
      if (input) {
        input.addEventListener('input', function () {
          var active = (document.querySelector('.ref-tool-tab.active') && document.querySelector('.ref-tool-tab.active').dataset.tab) || tabId;
          var d = opts.data[active] || [];
          var out = body.querySelector('#' + searchId + '_out');
          if (out) out.innerHTML = opts.kind === 'term' ? renderTermCards(body, d, input.value) : renderFormulaCards(body, d, input.value);
        });
        setTimeout(function () { try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (_) {} }, 0);
      }
    }
    return function open() {
      if (typeof window.fluxOpenToolModal !== 'function') {
        if (window.showToast) window.showToast('Tool unavailable — reference engine not loaded', 'info');
        return;
      }
      window.fluxOpenToolModal({
        id: opts.id, emoji: opts.emoji, title: opts.title,
        tabs: opts.tabs, renderBody: render,
      });
    };
  }

  // Build a modal whose tabs each render arbitrary HTML (for tables / mixed content).
  function makeHtmlModal(opts) {
    return function open() {
      if (typeof window.fluxOpenToolModal !== 'function') {
        if (window.showToast) window.showToast('Tool unavailable — reference engine not loaded', 'info');
        return;
      }
      window.fluxOpenToolModal({
        id: opts.id, emoji: opts.emoji, title: opts.title, tabs: opts.tabs,
        renderBody: function (body, tabId) { body.innerHTML = '<div class="tb-card">' + (opts.html[tabId] || '') + '</div>'; },
      });
    };
  }

  /* ════════════════════════════ PSYCHOLOGY ════════════════════════════ */
  var PSYCH = {
    approaches: [
      { name: 'Biological approach', def: 'Behaviour explained via physiology, genetics, hormones, neurotransmitters, brain structures.', ex: 'Studies: Maguire (taxi drivers, hippocampus); HM (memory & hippocampus).' },
      { name: 'Cognitive approach', def: 'Mind as an information processor; memory, schema, perception, decision-making.', ex: 'Studies: Loftus & Palmer (reconstructive memory); Bartlett (War of the Ghosts).' },
      { name: 'Sociocultural approach', def: 'Behaviour shaped by social context, culture, groups, and social identity.', ex: 'Studies: Tajfel (social identity); Bandura (social learning / Bobo doll).' },
      { name: 'Learning approach', def: 'Behaviour learned via classical conditioning, operant conditioning, observation.', ex: 'Pavlov (classical); Skinner (operant); Bandura (observational).' },
    ],
    studies: [
      { name: 'Loftus & Palmer (1974)', def: 'Leading questions altered speed estimates ("smashed" vs "hit") — reconstructive memory.', ex: 'Cognitive · lab experiment · misinformation effect.' },
      { name: 'Bandura (1961) — Bobo doll', def: 'Children imitated aggressive adult models — observational learning.', ex: 'Learning/Sociocultural · controlled observation.' },
      { name: 'Milgram (1963)', def: '65% of participants administered max "shock" — obedience to authority.', ex: 'Sociocultural · ethics landmark.' },
      { name: 'Maguire (2000)', def: 'London taxi drivers had larger posterior hippocampi — neuroplasticity.', ex: 'Biological · MRI correlational.' },
      { name: 'HM (Milner)', def: 'Hippocampus removal → anterograde amnesia; intact procedural memory.', ex: 'Biological · case study · memory systems.' },
      { name: 'Tajfel (1971)', def: 'Minimal groups → in-group favouritism — social identity theory.', ex: 'Sociocultural · experiment.' },
      { name: 'Festinger (1957)', def: 'Cognitive dissonance — discomfort from conflicting cognitions drives attitude change.', ex: 'Cognitive · $1/$20 study.' },
      { name: 'Rosenhan (1973)', def: '"Being sane in insane places" — diagnostic labels stick; validity of diagnosis.', ex: 'Abnormal · field study.' },
    ],
    methods: [
      { name: 'Experiment', def: 'Manipulate IV, measure DV, control extraneous variables. Establishes cause-effect.', ex: 'Lab, field, natural/quasi.' },
      { name: 'Correlation', def: 'Measures strength/direction of relationship (r, −1..+1). No causation.', ex: 'Positive, negative, zero.' },
      { name: 'Case study', def: 'In-depth study of one person/group. Rich data, low generalisability.', ex: 'HM, Genie.' },
      { name: 'Naturalistic observation', def: 'Observe behaviour in natural setting; covert/overt, participant/non-participant.', ex: 'High ecological validity.' },
      { name: 'Sampling', def: 'Random, opportunity, volunteer/self-selected, stratified, snowball.', ex: 'Affects representativeness.' },
      { name: 'Ethics', def: 'Consent, deception, debrief, withdrawal, confidentiality, protection from harm.', ex: 'BPS guidelines.' },
      { name: 'Validity', def: 'Internal (causal certainty) vs external (generalisability: population, ecological).', ex: '' },
      { name: 'Reliability', def: 'Consistency: test-retest, inter-rater, internal consistency.', ex: '' },
    ],
    brain: [
      { name: 'Frontal lobe', def: 'Planning, decision-making, personality, voluntary movement (motor cortex).', ex: 'Phineas Gage.' },
      { name: 'Temporal lobe', def: 'Auditory processing, language (Wernicke), memory (hippocampus nearby).', ex: '' },
      { name: 'Parietal lobe', def: 'Sensory integration, spatial awareness (somatosensory cortex).', ex: '' },
      { name: 'Occipital lobe', def: 'Visual processing.', ex: '' },
      { name: 'Amygdala', def: 'Emotion, fear processing, threat detection.', ex: '' },
      { name: 'Hippocampus', def: 'Formation of new long-term memories; spatial memory.', ex: 'HM; Maguire.' },
      { name: 'Hypothalamus', def: 'Homeostasis, hormones, hunger, thirst, temperature.', ex: '' },
      { name: 'Neurotransmitters', def: 'Dopamine (reward), serotonin (mood), acetylcholine (memory), GABA (inhibition).', ex: '' },
    ],
  };
  window.openPsychReference = makeSearchableModal({
    id: 'psych-ref', emoji: '🧠', title: 'Psychology Reference', kind: 'term',
    searchPlaceholder: 'Search studies, approaches, methods…',
    tabs: [
      { id: 'approaches', label: 'Approaches' },
      { id: 'studies', label: 'Key Studies' },
      { id: 'methods', label: 'Research Methods' },
      { id: 'brain', label: 'Brain & Biology' },
    ],
    data: PSYCH,
  });

  /* ════════════════════════════ LITERATURE ════════════════════════════ */
  var LIT = {
    devices: [
      { name: 'Allegory', def: 'Narrative with a hidden moral/political meaning beneath the surface story.', ex: 'Animal Farm → Russian Revolution.' },
      { name: 'Allusion', def: 'Indirect reference to another text, person, or event.', ex: '"He was a Good Samaritan."' },
      { name: 'Anaphora', def: 'Repetition of a word/phrase at the start of successive clauses.', ex: '"We shall fight… we shall fight…"' },
      { name: 'Bildungsroman', def: 'Coming-of-age narrative tracing moral/psychological growth.', ex: 'Jane Eyre; The Catcher in the Rye.' },
      { name: 'Dramatic irony', def: 'Audience knows what a character does not.', ex: 'Oedipus seeking the killer (himself).' },
      { name: 'Enjambment', def: 'A sentence/phrase runs over a line break without pause.', ex: '' },
      { name: 'Juxtaposition', def: 'Placing contrasting ideas/images close together for effect.', ex: '' },
      { name: 'Motif', def: 'A recurring image/idea that develops a theme.', ex: 'Green light in Gatsby.' },
      { name: 'Metonymy', def: 'Substituting an attribute for the thing meant.', ex: '"The crown" = the monarchy.' },
      { name: 'Synecdoche', def: 'Part stands for whole (or vice versa).', ex: '"All hands on deck."' },
      { name: 'Pathetic fallacy', def: 'Nature/weather mirrors human emotion.', ex: 'Storm during turmoil.' },
      { name: 'Foreshadowing', def: 'Hints at events to come.', ex: '' },
      { name: 'In medias res', def: 'Beginning in the middle of the action.', ex: 'The Odyssey.' },
      { name: 'Unreliable narrator', def: 'A narrator whose credibility is compromised.', ex: 'The Tell-Tale Heart.' },
      { name: 'Zeugma', def: 'One word governs two others, often differently.', ex: '"She broke his car and his heart."' },
    ],
    poetry: [
      { name: 'Iambic pentameter', def: 'Five iambs (da-DUM ×5) per line — the heartbeat of English verse.', ex: 'Shakespeare\'s sonnets.' },
      { name: 'Sonnet', def: '14 lines. Shakespearean: 3 quatrains + couplet (ABAB CDCD EFEF GG). Petrarchan: octave + sestet.', ex: '' },
      { name: 'Volta', def: 'The "turn" in a sonnet — a shift in argument/emotion.', ex: 'Often at line 9 (Petrarchan).' },
      { name: 'Meter feet', def: 'Iamb (˘ˊ), trochee (ˊ˘), spondee (ˊˊ), anapest (˘˘ˊ), dactyl (ˊ˘˘).', ex: '' },
      { name: 'Free verse', def: 'No regular meter or rhyme scheme.', ex: 'Whitman.' },
      { name: 'Blank verse', def: 'Unrhymed iambic pentameter.', ex: 'Milton, Paradise Lost.' },
      { name: 'Villanelle', def: '19 lines, 5 tercets + quatrain, two refrains.', ex: 'Do Not Go Gentle…' },
      { name: 'Caesura', def: 'A strong pause within a line.', ex: '' },
      { name: 'Slant rhyme', def: 'Approximate rhyme (consonance/assonance).', ex: 'Dickinson.' },
    ],
    rhetoric: [
      { name: 'Ethos', def: 'Appeal to credibility/character of the speaker.', ex: '"As a doctor of 20 years…"' },
      { name: 'Pathos', def: 'Appeal to the audience\'s emotions.', ex: 'Vivid suffering imagery.' },
      { name: 'Logos', def: 'Appeal to logic, evidence, reasoning.', ex: 'Statistics, syllogism.' },
      { name: 'Kairos', def: 'The opportune moment / timeliness of an argument.', ex: '' },
      { name: 'Anecdote', def: 'A short personal story used as evidence/illustration.', ex: '' },
      { name: 'Rhetorical question', def: 'A question asked for effect, not an answer.', ex: '"Are we not all human?"' },
      { name: 'Antithesis', def: 'Contrasting ideas in parallel structure.', ex: '"Ask not what your country…"' },
      { name: 'Tricolon', def: 'A series of three parallel elements.', ex: '"Veni, vidi, vici."' },
    ],
    analysis: [
      { name: 'Close reading checklist', def: 'Diction, imagery, tone, syntax, structure, sound, figurative language, POV, shifts.', ex: 'DICTION drives TONE.' },
      { name: 'TPCASTT (poetry)', def: 'Title, Paraphrase, Connotation, Attitude/tone, Shifts, Title (again), Theme.', ex: '' },
      { name: 'SIFT', def: 'Symbol, Imagery, Figures of speech, Tone/Theme.', ex: '' },
      { name: 'Tone vs mood', def: 'Tone = author\'s attitude; mood = reader\'s feeling.', ex: '' },
      { name: 'Theme statement', def: 'A complete sentence expressing a universal insight — not a single word.', ex: '"Ambition unchecked destroys the self."' },
      { name: 'IB Paper 1 (guided analysis)', def: 'Unseen text + guiding question. Build a thesis on HOW meaning is made.', ex: '' },
      { name: 'IB Paper 2 (comparative essay)', def: 'Compare two studied works against a prompt — focus on authorial choices.', ex: '' },
    ],
  };
  window.openLitReference = makeSearchableModal({
    id: 'lit-ref', emoji: '📖', title: 'Literature Toolkit', kind: 'term',
    searchPlaceholder: 'Search devices, forms, rhetoric…',
    tabs: [
      { id: 'devices', label: 'Literary Devices' },
      { id: 'poetry', label: 'Poetry & Form' },
      { id: 'rhetoric', label: 'Rhetoric' },
      { id: 'analysis', label: 'Analysis Frameworks' },
    ],
    data: LIT,
  });

  /* ════════════════════════════ GERMAN ════════════════════════════ */
  function germanCasesHtml() {
    return '<div class="tb-card-h"><h3>German cases — definite & indefinite articles</h3></div>'
      + '<p class="tb-sub">The four cases and how articles change. Memorise this grid first.</p>'
      + renderTable(
        ['Case', 'Masculine', 'Feminine', 'Neuter', 'Plural'],
        [
          ['Nominative (subject)', 'der / ein', 'die / eine', 'das / ein', 'die / —'],
          ['Accusative (direct obj)', 'den / einen', 'die / eine', 'das / ein', 'die / —'],
          ['Dative (indirect obj)', 'dem / einem', 'der / einer', 'dem / einem', 'den …n / —'],
          ['Genitive (possession)', 'des …s / eines …s', 'der / einer', 'des …s / eines …s', 'der / —'],
        ]
      )
      + '<p class="tb-sub" style="margin-top:10px"><strong>Pronoun endings follow the same pattern.</strong> Dative plural adds <code>-n</code> to the noun.</p>';
  }
  function germanPrepsHtml() {
    return '<div class="tb-card-h"><h3>Prepositions by case</h3></div>'
      + renderTable(['Case', 'Prepositions'], [
        ['Accusative', 'durch, für, gegen, ohne, um, bis, entlang'],
        ['Dative', 'aus, außer, bei, mit, nach, seit, von, zu, gegenüber'],
        ['Two-way (Wechsel)', 'an, auf, hinter, in, neben, über, unter, vor, zwischen'],
        ['Genitive', 'während, wegen, trotz, (an)statt, außerhalb, innerhalb'],
      ])
      + '<p class="tb-sub" style="margin-top:10px">Two-way: <strong>Accusative</strong> for motion/direction (wohin?), <strong>Dative</strong> for location (wo?).</p>';
  }
  var GERMAN_VERBS = {
    present: [
      { name: 'sein (to be) — irregular', eq: 'ich bin · du bist · er/sie/es ist\nwir sind · ihr seid · sie/Sie sind', vars: 'most common verb', ex: 'Ich bin müde.' },
      { name: 'haben (to have)', eq: 'ich habe · du hast · er hat\nwir haben · ihr habt · sie haben', vars: 'auxiliary for perfect', ex: 'Ich habe Zeit.' },
      { name: 'werden (to become)', eq: 'ich werde · du wirst · er wird\nwir werden · ihr werdet · sie werden', vars: 'future + passive aux', ex: 'Es wird kalt.' },
      { name: 'Regular -en (machen)', eq: 'ich mache · du machst · er macht\nwir machen · ihr macht · sie machen', vars: 'stem + e/st/t/en/t/en', ex: 'Ich mache Hausaufgaben.' },
      { name: 'Modal: können (can)', eq: 'ich kann · du kannst · er kann\nwir können · ihr könnt · sie können', vars: 'vowel change in singular', ex: 'Ich kann schwimmen.' },
      { name: 'Modal: müssen (must)', eq: 'ich muss · du musst · er muss\nwir müssen · ihr müsst · sie müssen', vars: '', ex: 'Du musst lernen.' },
    ],
    past: [
      { name: 'Perfekt (spoken past)', eq: 'haben/sein (conjugated) + past participle (end)', vars: 'ge-…-t (weak) / ge-…-en (strong)', ex: 'Ich habe gespielt. Ich bin gegangen.' },
      { name: 'Präteritum (written past)', eq: 'weak: stem + te + endings; strong: vowel change', vars: 'used in narration', ex: 'ich machte; ich ging.' },
      { name: 'sein/haben choice', eq: 'sein = movement / change of state; haben = everything else', vars: '', ex: 'Ich bin gefahren. Ich habe gegessen.' },
      { name: 'Plusquamperfekt', eq: 'hatte/war + past participle', vars: 'past-before-past', ex: 'Ich hatte gegessen, bevor…' },
    ],
    future: [
      { name: 'Futur I', eq: 'werden (conjugated) + infinitive (end)', vars: '', ex: 'Ich werde lernen.' },
      { name: 'Word order — main clause', eq: 'Subject – VERB(2nd) – … – infinitive/participle(end)', vars: 'verb always 2nd', ex: 'Morgen werde ich kommen.' },
      { name: 'Word order — subordinate', eq: 'Conjunction – Subject – … – VERB(end)', vars: 'weil, dass, wenn, ob', ex: '…, weil ich müde bin.' },
    ],
  };
  window.openGermanReference = function () {
    if (typeof window.fluxOpenToolModal !== 'function') { if (window.showToast) window.showToast('Tool unavailable', 'info'); return; }
    window.fluxOpenToolModal({
      id: 'german-ref', emoji: '🇩🇪', title: 'German Reference',
      tabs: [
        { id: 'cases', label: 'Cases & Articles' },
        { id: 'verbs', label: 'Verb Tenses' },
        { id: 'preps', label: 'Prepositions' },
      ],
      renderBody: function (body, tabId) {
        if (tabId === 'cases') { body.innerHTML = '<div class="tb-card">' + germanCasesHtml() + '</div>'; return; }
        if (tabId === 'preps') { body.innerHTML = '<div class="tb-card">' + germanPrepsHtml() + '</div>'; return; }
        // verbs — sub-grouped formula cards
        body.innerHTML = '<div class="tb-card">'
          + '<div class="fs-cat"><div class="fs-cat-h">Present</div>' + renderFormulaCards(body, GERMAN_VERBS.present) + '</div>'
          + '<div class="fs-cat"><div class="fs-cat-h">Past</div>' + renderFormulaCards(body, GERMAN_VERBS.past) + '</div>'
          + '<div class="fs-cat"><div class="fs-cat-h">Future & Word Order</div>' + renderFormulaCards(body, GERMAN_VERBS.future) + '</div>'
          + '</div>';
      },
    });
  };

  /* ════════════════════════════ GLOBAL POLITICS ════════════════════════════ */
  var GOPO = {
    concepts: [
      { name: 'Power', def: 'Ability to influence/control outcomes. Hard (military/economic) vs soft (culture/ideology) vs smart (blend).', ex: 'Nye\'s typology.' },
      { name: 'Sovereignty', def: 'Supreme authority of a state over its territory; internal vs external (Westphalian).', ex: '' },
      { name: 'Legitimacy', def: 'The right to rule, recognised by the governed/international community.', ex: 'Weber: traditional, charismatic, legal-rational.' },
      { name: 'Interdependence', def: 'Mutual reliance between states (economic, security, environmental).', ex: 'Globalisation.' },
      { name: 'Human rights', def: 'Universal, inalienable, indivisible entitlements (UDHR 1948).', ex: 'Civil/political vs economic/social/cultural.' },
      { name: 'Globalisation', def: 'Increasing interconnectedness — economic, political, cultural, technological.', ex: '' },
    ],
    theories: [
      { name: 'Realism', def: 'States are rational, self-interested actors in anarchy; power & security dominate.', ex: 'Morgenthau, Waltz.' },
      { name: 'Liberalism', def: 'Cooperation possible via institutions, trade, democracy, interdependence.', ex: 'Kant, Keohane.' },
      { name: 'Marxism', def: 'Politics driven by economic class struggle; critique of global capitalism.', ex: 'World-systems theory.' },
      { name: 'Constructivism', def: 'Interests/identities are socially constructed, not fixed.', ex: 'Wendt: "anarchy is what states make of it."' },
      { name: 'Feminism', def: 'Gender as a lens on power, security, and global inequality.', ex: '' },
    ],
    actors: [
      { name: 'State', def: 'Defined territory, population, government, sovereignty (Montevideo Convention).', ex: '' },
      { name: 'IGOs', def: 'Inter-governmental organisations — members are states.', ex: 'UN, EU, NATO, WTO, IMF.' },
      { name: 'NGOs', def: 'Non-governmental, non-profit; advocacy/operational.', ex: 'Amnesty, Red Cross, Greenpeace.' },
      { name: 'MNCs', def: 'Multinational corporations operating across borders; economic power.', ex: '' },
      { name: 'Social movements', def: 'Collective, often grassroots action for change.', ex: 'BLM, climate strikes.' },
      { name: 'UN organs', def: 'General Assembly, Security Council (5 P5 vetoes), ICJ, Secretariat, ECOSOC.', ex: '' },
    ],
  };
  window.openGlobalPoliticsReference = makeSearchableModal({
    id: 'gopo-ref', emoji: '🌐', title: 'Global Politics Reference', kind: 'term',
    searchPlaceholder: 'Search concepts, theories, actors…',
    tabs: [
      { id: 'concepts', label: 'Key Concepts' },
      { id: 'theories', label: 'Theories' },
      { id: 'actors', label: 'Actors' },
    ],
    data: GOPO,
  });

  /* ════════════════════════════ VISUAL ARTS ════════════════════════════ */
  var ARTS = {
    elements: [
      { name: 'Line', def: 'Path of a point; defines shape, direction, movement, contour.', ex: '' },
      { name: 'Shape / Form', def: 'Shape = 2D (geometric/organic); Form = 3D (mass, volume).', ex: '' },
      { name: 'Colour', def: 'Hue, value, saturation. Warm/cool; complementary; analogous.', ex: 'Colour wheel.' },
      { name: 'Value', def: 'Lightness/darkness; creates contrast and depth.', ex: 'Chiaroscuro.' },
      { name: 'Texture', def: 'Surface quality — actual or implied.', ex: '' },
      { name: 'Space', def: 'Positive/negative; foreground/background; perspective.', ex: '' },
    ],
    principles: [
      { name: 'Balance', def: 'Distribution of visual weight — symmetrical, asymmetrical, radial.', ex: '' },
      { name: 'Contrast', def: 'Difference (light/dark, large/small) to create interest.', ex: '' },
      { name: 'Emphasis', def: 'Focal point — where the eye is drawn first.', ex: '' },
      { name: 'Movement', def: 'Visual path through the work.', ex: '' },
      { name: 'Rhythm / Pattern', def: 'Repetition of elements creating visual tempo.', ex: '' },
      { name: 'Unity / Variety', def: 'Cohesion of the whole vs differences that add interest.', ex: '' },
      { name: 'Proportion / Scale', def: 'Relative size of parts to whole.', ex: 'Golden ratio.' },
    ],
    analysis: [
      { name: 'Formal analysis', def: 'Describe the elements & principles — what you literally see.', ex: '' },
      { name: 'Interpretation', def: 'Meaning, symbolism, mood, message.', ex: '' },
      { name: 'Context', def: 'Cultural, historical, personal context of creation.', ex: '' },
      { name: 'Function', def: 'Purpose — devotional, political, decorative, commercial.', ex: '' },
      { name: 'IB comparative study', def: 'Compare ≥3 works by ≥2 artists across cultures — formal + contextual.', ex: '' },
      { name: 'Process portfolio', def: 'Document experimentation, skills, and development across media.', ex: '' },
    ],
  };
  window.openVisualArtsReference = makeSearchableModal({
    id: 'arts-ref', emoji: '🎨', title: 'Visual Arts Reference', kind: 'term',
    searchPlaceholder: 'Search elements, principles…',
    tabs: [
      { id: 'elements', label: 'Elements of Art' },
      { id: 'principles', label: 'Principles of Design' },
      { id: 'analysis', label: 'Analysis & IB' },
    ],
    data: ARTS,
  });

  /* ════════════════════════════ MUSIC THEORY ════════════════════════════ */
  function circleOfFifthsHtml() {
    var maj = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
    var sharpsFlats = ['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '5♭', '4♭', '3♭', '2♭', '1♭'];
    var min = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
    var rows = maj.map(function (m, i) { return [m, min[i], sharpsFlats[i]]; });
    return '<div class="tb-card-h"><h3>Circle of Fifths</h3></div>'
      + '<p class="tb-sub">Clockwise = add a sharp (up a 5th). Counter-clockwise = add a flat. Relative minor is 3 semitones below the major.</p>'
      + renderTable(['Major', 'Relative minor', 'Key signature'], rows);
  }
  var MUSIC = {
    intervals: [
      { name: 'Unison / Octave', eq: '0 / 12 semitones', vars: 'perfect', ex: 'C–C' },
      { name: 'Minor 2nd / Major 2nd', eq: '1 / 2 semitones', vars: '', ex: 'C–D♭ / C–D' },
      { name: 'Minor 3rd / Major 3rd', eq: '3 / 4 semitones', vars: 'min=sad, maj=happy', ex: 'C–E♭ / C–E' },
      { name: 'Perfect 4th', eq: '5 semitones', vars: '', ex: 'C–F' },
      { name: 'Tritone', eq: '6 semitones', vars: 'aug 4th / dim 5th', ex: 'C–F♯' },
      { name: 'Perfect 5th', eq: '7 semitones', vars: 'very consonant', ex: 'C–G' },
      { name: 'Major 6th / Minor 7th', eq: '9 / 10 semitones', vars: '', ex: '' },
      { name: 'Major 7th', eq: '11 semitones', vars: 'leading tone tension', ex: 'C–B' },
    ],
    scales: [
      { name: 'Major scale', eq: 'W–W–H–W–W–W–H', vars: 'Ionian', ex: 'C D E F G A B C' },
      { name: 'Natural minor', eq: 'W–H–W–W–H–W–W', vars: 'Aeolian', ex: 'A B C D E F G A' },
      { name: 'Harmonic minor', eq: 'W–H–W–W–H–W½–H', vars: 'raised 7th', ex: 'A B C D E F G♯ A' },
      { name: 'Melodic minor', eq: 'asc: raise 6 & 7; desc: natural minor', vars: '', ex: '' },
      { name: 'Pentatonic (major)', eq: '1 2 3 5 6', vars: '5 notes', ex: 'C D E G A' },
      { name: 'Blues scale', eq: '1 ♭3 4 ♭5 5 ♭7', vars: '', ex: 'C E♭ F F♯ G B♭' },
    ],
    chords: [
      { name: 'Major triad', eq: '1 – 3 – 5 (4+3 semitones)', vars: '', ex: 'C E G' },
      { name: 'Minor triad', eq: '1 – ♭3 – 5 (3+4)', vars: '', ex: 'C E♭ G' },
      { name: 'Diminished', eq: '1 – ♭3 – ♭5 (3+3)', vars: '', ex: 'C E♭ G♭' },
      { name: 'Augmented', eq: '1 – 3 – ♯5 (4+4)', vars: '', ex: 'C E G♯' },
      { name: 'Dominant 7th', eq: '1 – 3 – 5 – ♭7', vars: 'resolves to tonic', ex: 'G7 → C' },
      { name: 'Major 7th', eq: '1 – 3 – 5 – 7', vars: '', ex: 'Cmaj7' },
      { name: 'Roman numerals', eq: 'I ii iii IV V vi vii°', vars: 'upper=major, lower=minor', ex: 'I–V–vi–IV' },
    ],
    terms: [
      { name: 'Dynamics', def: 'pp < p < mp < mf < f < ff. Cresc. = louder, dim./decresc. = softer.', ex: '' },
      { name: 'Tempo', def: 'Largo (slow) < Adagio < Andante < Moderato < Allegro < Presto (fast).', ex: 'BPM markings.' },
      { name: 'Articulation', def: 'Staccato (short), legato (smooth), accent, tenuto, fermata (hold).', ex: '' },
      { name: 'Texture', def: 'Monophonic, homophonic, polyphonic, heterophonic.', ex: '' },
      { name: 'Cadence', def: 'Perfect (V–I), plagal (IV–I), imperfect (–V), interrupted (V–vi).', ex: '' },
    ],
  };
  window.openMusicTheoryReference = function () {
    if (typeof window.fluxOpenToolModal !== 'function') { if (window.showToast) window.showToast('Tool unavailable', 'info'); return; }
    window.fluxOpenToolModal({
      id: 'music-theory', emoji: '🎼', title: 'Music Theory',
      tabs: [
        { id: 'circle', label: 'Circle of 5ths' },
        { id: 'intervals', label: 'Intervals' },
        { id: 'scales', label: 'Scales' },
        { id: 'chords', label: 'Chords' },
        { id: 'terms', label: 'Terms' },
      ],
      renderBody: function (body, tabId) {
        if (tabId === 'circle') { body.innerHTML = '<div class="tb-card">' + circleOfFifthsHtml() + '</div>'; return; }
        if (tabId === 'terms') { body.innerHTML = '<div class="tb-card">' + renderTermCards(body, MUSIC.terms) + '</div>'; return; }
        body.innerHTML = '<div class="tb-card">' + renderFormulaCards(body, MUSIC[tabId] || []) + '</div>';
      },
    });
  };

  /* ════════════════════════════ MATH ANALYSIS (extra) ════════════════════════════ */
  function unitCircleHtml() {
    var rows = [
      ['0° / 0', '1', '0', '0'],
      ['30° / π/6', '√3/2', '1/2', '√3/3'],
      ['45° / π/4', '√2/2', '√2/2', '1'],
      ['60° / π/3', '1/2', '√3/2', '√3'],
      ['90° / π/2', '0', '1', 'undef'],
      ['120° / 2π/3', '−1/2', '√3/2', '−√3'],
      ['135° / 3π/4', '−√2/2', '√2/2', '−1'],
      ['150° / 5π/6', '−√3/2', '1/2', '−√3/3'],
      ['180° / π', '−1', '0', '0'],
      ['270° / 3π/2', '0', '−1', 'undef'],
    ];
    return '<div class="tb-card-h"><h3>Unit circle — exact values</h3></div>'
      + '<p class="tb-sub">cos = x-coordinate, sin = y-coordinate, tan = sin/cos.</p>'
      + renderTable(['Angle', 'cos θ', 'sin θ', 'tan θ'], rows);
  }
  var MATH_RULES = {
    derivatives: [
      { name: 'Power rule', eq: 'd/dx[xⁿ] = n·xⁿ⁻¹', vars: '', ex: 'd/dx[x³] = 3x²' },
      { name: 'Product rule', eq: '(uv)′ = u′v + uv′', vars: '', ex: '' },
      { name: 'Quotient rule', eq: '(u/v)′ = (u′v − uv′)/v²', vars: '', ex: '' },
      { name: 'Chain rule', eq: 'd/dx[f(g(x))] = f′(g(x))·g′(x)', vars: '', ex: 'd/dx[sin(x²)] = 2x·cos(x²)' },
      { name: 'Trig', eq: 'd/dx[sin] = cos · d/dx[cos] = −sin · d/dx[tan] = sec²', vars: '', ex: '' },
      { name: 'Exp / Log', eq: 'd/dx[eˣ] = eˣ · d/dx[ln x] = 1/x · d/dx[aˣ] = aˣ·ln a', vars: '', ex: '' },
    ],
    integrals: [
      { name: 'Power rule', eq: '∫ xⁿ dx = xⁿ⁺¹/(n+1) + C  (n ≠ −1)', vars: '', ex: '' },
      { name: 'Reciprocal', eq: '∫ 1/x dx = ln|x| + C', vars: '', ex: '' },
      { name: 'Exp', eq: '∫ eˣ dx = eˣ + C', vars: '', ex: '' },
      { name: 'Trig', eq: '∫ sin x dx = −cos x + C · ∫ cos x dx = sin x + C', vars: '', ex: '' },
      { name: 'By parts', eq: '∫ u dv = uv − ∫ v du', vars: 'LIATE for choosing u', ex: '' },
      { name: 'Definite (FTC)', eq: '∫ₐᵇ f(x) dx = F(b) − F(a)', vars: '', ex: '' },
    ],
    sequences: [
      { name: 'Arithmetic nth term', eq: 'uₙ = u₁ + (n−1)d', vars: 'd = common difference', ex: '' },
      { name: 'Arithmetic sum', eq: 'Sₙ = n/2·(2u₁ + (n−1)d) = n/2·(u₁+uₙ)', vars: '', ex: '' },
      { name: 'Geometric nth term', eq: 'uₙ = u₁·rⁿ⁻¹', vars: 'r = common ratio', ex: '' },
      { name: 'Geometric sum', eq: 'Sₙ = u₁(1−rⁿ)/(1−r)', vars: 'r ≠ 1', ex: '' },
      { name: 'Infinite geometric', eq: 'S∞ = u₁/(1−r)', vars: '|r| < 1', ex: '' },
      { name: 'Binomial theorem', eq: '(a+b)ⁿ = Σ C(n,k)·aⁿ⁻ᵏ·bᵏ', vars: '', ex: '' },
    ],
  };
  window.openMathAnalysisReference = function () {
    if (typeof window.fluxOpenToolModal !== 'function') { if (window.showToast) window.showToast('Tool unavailable', 'info'); return; }
    window.fluxOpenToolModal({
      id: 'math-analysis', emoji: '📐', title: 'Math Analysis & Calculus',
      tabs: [
        { id: 'circle', label: 'Unit Circle' },
        { id: 'derivatives', label: 'Derivatives' },
        { id: 'integrals', label: 'Integrals' },
        { id: 'sequences', label: 'Sequences & Series' },
      ],
      renderBody: function (body, tabId) {
        if (tabId === 'circle') { body.innerHTML = '<div class="tb-card">' + unitCircleHtml() + '</div>'; return; }
        body.innerHTML = '<div class="tb-card">' + renderFormulaCards(body, MATH_RULES[tabId] || []) + '</div>';
      },
    });
  };

  /* ════════════════════════════ HISTORY — source analysis ════════════════════════════ */
  var HIST = {
    frameworks: [
      { name: 'OPCVL (IB source eval)', def: 'Origin, Purpose, Content, Value, Limitation — evaluate a source\'s utility.', ex: 'Core of IB Paper 1 Q3.' },
      { name: 'SOAPSTone', def: 'Speaker, Occasion, Audience, Purpose, Subject, Tone.', ex: 'For speeches & documents.' },
      { name: 'Primary vs secondary', def: 'Primary = from the time/event; secondary = later interpretation.', ex: '' },
      { name: 'Cross-referencing', def: 'Corroborate sources against each other; note agreement/contradiction.', ex: 'Paper 1 Q2.' },
      { name: 'Continuity & change', def: 'Identify what persists vs what shifts over a period.', ex: '' },
      { name: 'Causation', def: 'Long-term vs short-term causes; trigger events; consequences.', ex: '' },
    ],
    paper1: [
      { name: 'Q1a — comprehension', def: 'What does the source say? 3 marks — make 3 distinct points.', ex: '' },
      { name: 'Q1b — message of source', def: 'Interpret a visual/cartoon — message + supporting detail.', ex: '' },
      { name: 'Q2 — compare & contrast', def: 'Run-on comparison of two sources — similarities AND differences.', ex: '' },
      { name: 'Q3 — value & limitation', def: 'Use OPCVL on one source.', ex: '' },
      { name: 'Q4 — mini-essay', def: 'Use ALL sources + own knowledge to answer a judgement question.', ex: '' },
    ],
    essay: [
      { name: 'Thesis', def: 'A clear, arguable judgement that directly answers the question.', ex: '' },
      { name: 'PEEL paragraph', def: 'Point, Evidence, Explain, Link back to thesis.', ex: '' },
      { name: 'Historiography', def: 'Reference historians\' differing interpretations (schools of thought).', ex: 'e.g. orthodox vs revisionist.' },
      { name: 'Counter-argument', def: 'Address the strongest opposing view, then rebut.', ex: '' },
      { name: 'IB Paper 2 / 3', def: 'Thematic comparative (P2) / regional depth (P3) essays.', ex: '' },
    ],
  };
  window.openHistorySkillsReference = makeSearchableModal({
    id: 'hist-skills', emoji: '📜', title: 'History Skills', kind: 'term',
    searchPlaceholder: 'Search frameworks, paper structure…',
    tabs: [
      { id: 'frameworks', label: 'Source Analysis' },
      { id: 'paper1', label: 'IB Paper 1' },
      { id: 'essay', label: 'Essay Writing' },
    ],
    data: HIST,
  });

  /* ════════════════════════════ NEW LAYOUT ════════════════════════════
   * Rebalanced into IB subject groups. Each tool keeps its existing render
   * target (inline sub/tid or modal fn) so nothing rendering-wise changes —
   * only grouping + ordering, plus the new modal tools above.
   * ──────────────────────────────────────────────────────────────────── */
  function inline(id, label, icon, desc, sub, tid) {
    return { id: id, label: label, icon: icon, desc: desc, mode: 'inline', sub: sub, tid: tid };
  }
  function modal(id, label, icon, desc, fn) {
    return { id: id, label: label, icon: icon, desc: desc, mode: 'modal', fn: fn };
  }
  function link(id, label, icon, desc, nav, btn) {
    return { id: id, label: label, icon: icon, desc: desc, mode: 'link', nav: nav, btn: btn };
  }

  var NEW_LAYOUT = [
    {
      id: 'sciences', name: 'Sciences', icon: '🧪', classTags: ['physics', 'chem', 'bio', 'science'],
      tools: [
        inline('periodic-tbl', 'Periodic Table', '⚗', 'Interactive table with properties and categories.', 'science', 'periodic-tbl'),
        inline('physics-sandbox', 'Physics formulas', '🪐', 'Mechanics, kinematics, energy, waves — formulas and constants.', 'science', 'formulas-sci'),
        modal('chem-ref', 'Chemistry reference', '⚗️', 'Polyatomic ions, solubility, acids & bases, constants.', 'openChemReference'),
        modal('codon', 'Biology codon table', '🧬', '64 codons and amino-acid lookup.', 'openCodonTable'),
        inline('molar-mass', 'Molecular weight', '⚖', 'Parse formulas (H2O, Ca(OH)2) and get molar mass.', 'science', 'molar-mass'),
        modal('unit-conv', 'Unit converter', '🔁', 'Length, mass, temperature, energy, data — live conversions.', 'openUnitConverter'),
      ],
    },
    {
      id: 'math', name: 'Mathematics', icon: '∑', classTags: ['math'],
      tools: [
        modal('math-analysis', 'Analysis & calculus', '📐', 'Unit circle, derivatives, integrals, sequences & series.', 'openMathAnalysisReference'),
        modal('math-formulas', 'Formula sheet', '📋', 'Algebra, trig, calculus, and statistics reference.', 'openMathFormulas'),
        inline('graphing', 'Graph + calc', '📈', 'Plot functions and use a built-in calculator.', 'math', 'graphing'),
        inline('matrix', 'Matrix calculator', '⊞', 'Multiply, invert, determinant, and more.', 'math', 'matrix'),
        inline('stats', 'Statistics toolkit', '𝝈', 'Summary stats and z-scores from raw data.', 'math', 'stats'),
        inline('geo-ref', 'Geometry formulas', '△', '2D and 3D area, surface, and volume.', 'math', 'geo-ref'),
      ],
    },
    {
      id: 'individuals-societies', name: 'Individuals & Societies', icon: '🏛', classTags: ['history', 'psych', 'econ', 'gopo', 'business'],
      tools: [
        modal('psych-ref', 'Psychology', '🧠', 'Approaches, key studies, research methods, brain & biology.', 'openPsychReference'),
        modal('gopo-ref', 'Global politics', '🌐', 'Key concepts, theories, and global actors.', 'openGlobalPoliticsReference'),
        inline('econ-formulas', 'Economics formulas', 'Σ', 'Micro and macro formulas with explanations.', 'econ', 'econ-formulas'),
        inline('fin-calc', 'Financial calculator', '🧮', 'Compound interest, loans, and savings goals.', 'econ', 'fin-calc'),
        modal('hist-skills', 'History skills', '📜', 'OPCVL/SOAPSTone source analysis + IB paper structure.', 'openHistorySkillsReference'),
        modal('hist-map', 'World history map', '🌍', 'Clickable map with eras, empires, and key dates.', 'openHistoryMap'),
        inline('timeline', 'Timeline builder', '🕰', 'Build and save timelines for papers and exams.', 'history', 'timeline'),
        inline('map-quiz', 'Map & capitals', '🗺', 'Browse regions or quiz yourself on capitals.', 'history', 'map-quiz'),
      ],
    },
    {
      id: 'language-lit', name: 'Language & Literature', icon: '📖', classTags: ['english', 'lit'],
      tools: [
        modal('lit-ref', 'Literature toolkit', '📖', 'Devices, poetry & form, rhetoric, analysis frameworks.', 'openLitReference'),
        inline('lit-devices', 'Literary devices (quick)', '✒', 'Inline glossary with definitions and examples.', 'english', 'literary'),
        inline('grammar', 'Grammar reference', '📘', 'Parts of speech, commas, clauses, common mistakes.', 'english', 'grammar'),
        inline('essay', 'Essay structure guide', '🖊', 'Thesis, body paragraphs, evidence, and revision.', 'english', 'essay'),
        link('cite-notes', 'Citation builder', '❝ ❞', 'Build MLA / APA citations in Notes for copying into papers.', 'notes', 'Open in Notes'),
      ],
    },
    {
      id: 'language-acq', name: 'Language Acquisition', icon: '🗣', classTags: ['spanish', 'french', 'german', 'language'],
      tools: [
        modal('german-ref', 'German reference', '🇩🇪', 'Cases & articles, verb tenses, prepositions.', 'openGermanReference'),
        modal('spanish-conj', 'Spanish conjugator', '🇪🇸', '60 high-frequency verbs across major tenses.', 'openSpanishConjugator'),
        modal('french-conj', 'French conjugator', '🇫🇷', 'French tenses with être / auxiliary flags.', 'openFrenchConjugator'),
        inline('ipa', 'IPA chart', 'Ƃ', 'Pulmonic consonants and vowel quadrilateral.', 'languages', 'ipa'),
        link('translate-ai', 'Translation', '🔁', 'Send text to Flux AI with language-pair context.', 'ai', 'Open Flux AI'),
      ],
    },
    {
      id: 'arts', name: 'The Arts', icon: '🎨', classTags: ['music', 'art', 'band', 'orchestra', 'choir', 'visual arts', 'theatre'],
      tools: [
        modal('music-theory', 'Music theory', '🎼', 'Circle of fifths, intervals, scales, chords, terms.', 'openMusicTheoryReference'),
        modal('arts-ref', 'Visual arts', '🎨', 'Elements of art, principles of design, analysis & IB.', 'openVisualArtsReference'),
        inline('dp-dimensions', 'Music: ring diagram', '◎', 'Concentric dimensions map with bubble labels.', 'music', 'dp-dimensions'),
        inline('dp-chart', 'Music: quick chart', '📊', 'Flat checklist of dimensions and metadimensions.', 'music', 'dp-chart'),
      ],
    },
    {
      id: 'cs', name: 'Computer Science', icon: '💻', classTags: ['cs', 'product team'],
      tools: [
        modal('cs-ref', 'CS reference', '💻', 'Number converter, ASCII, Big-O, and logic gates.', 'openCSReference'),
      ],
    },
  ];

  /* ── apply: replace UNIFIED_LAYOUT contents in place (before first render) ── */
  function applyLayout() {
    try {
      var tb = window.fluxToolbox;
      if (!tb || !Array.isArray(tb.UNIFIED_LAYOUT)) return false;
      // Mutate in place so the live reference held by the renderer stays valid.
      tb.UNIFIED_LAYOUT.length = 0;
      NEW_LAYOUT.forEach(function (s) { tb.UNIFIED_LAYOUT.push(s); });
      return true;
    } catch (e) { console.warn('[FluxToolboxDP] layout apply failed', e); return false; }
  }

  // flux-toolbox.js runs synchronously at load (IIFE) and exposes window.fluxToolbox
  // immediately; this script is ordered after it, so the array exists now. Apply
  // right away, and also re-apply on DOMContentLoaded as a belt-and-suspenders
  // guard in case load order ever changes.
  var applied = applyLayout();
  if (!applied) {
    document.addEventListener('DOMContentLoaded', applyLayout, { once: true });
  }

  window.FluxToolboxDP = {
    NEW_LAYOUT: NEW_LAYOUT,
    applyLayout: applyLayout,
    // exposed for tests / re-use
    _renderFormulaCards: renderFormulaCards,
    _renderTermCards: renderTermCards,
  };
})();
