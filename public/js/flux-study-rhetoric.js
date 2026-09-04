/* ============================================================================
   FLUX STUDY HUB · Rhetoric & argument (AP English Language)

   Adds tabs to the existing `english` subject; H.register concatenates, so
   flux-study-english.js is untouched.

   flux-toolbox-dp.js already carries a Literature Toolkit whose `rhetoric`
   section lists the four appeals and four devices, and whose `analysis`
   section is written for IB Paper 1 and Paper 2. That is a literature course.
   AP Lang is an argument course, and the gap between the two is this file:
   the rhetorical situation, logical fallacies — of which the app had none,
   the single `fallac` match in the codebase being "pathetic fallacy", a
   literary term — the syntactic devices that carry most rhetorical analysis
   marks, and the three essays the exam actually sets.

   Definitions are the discriminating kind on purpose. "Straw man = misrepresenting
   an argument" is not enough to separate it from a red herring under time
   pressure, so each entry says what distinguishes it from its nearest neighbour.

   No storage.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${esc(sub)}</p>` : '')
      + inner + '</div>';
    /* [term, meaning, example-or-tell?] */
    const termList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    // ── The rhetorical situation ─────────────────────────────────────────────
    const SOAP = [
      ['Speaker', 'Who is talking, and what persona they adopt', 'Not always the author — a writer can build a narrator to argue through.'],
      ['Occasion', 'The moment and context that prompted it', 'The immediate trigger, plus the larger situation behind it.'],
      ['Audience', 'Who it is aimed at', 'Ask what they already believe — that is what every choice is shaped around.'],
      ['Purpose', 'What the speaker wants to happen', 'To persuade, warn, unify, justify. "To inform" is almost never the real answer.'],
      ['Subject', 'What it is about', 'State it in a phrase, not a paraphrase of the whole text.'],
      ['Tone', 'The speaker’s attitude to the subject', 'Choose a precise word. "Negative" earns nothing; "resigned" or "indignant" does.'],
    ];
    const APPEALS = [
      ['Ethos', 'Credibility and character', 'Built through expertise, shared values, or visible fairness to the other side.'],
      ['Pathos', 'The audience’s emotions', 'Naming the emotion is not analysis — say which choice produces it.'],
      ['Logos', 'Reasoning and evidence', 'Data, precedent, causal chains, concession that strengthens the claim.'],
      ['Kairos', 'The timeliness of the moment', 'Why this argument had to be made now rather than at any time.'],
    ];

    function renderSituation(body) {
      body.innerHTML =
        card('SOAPSTone', 'Answer these before analysing anything — every rhetorical choice is a choice made for this audience at this moment.', termList(SOAP))
        + card('The appeals', 'What the speaker leans on. Most passages use all four; the mark is in which one carries the weight, and why.', termList(APPEALS));
    }

    // ── Fallacies ────────────────────────────────────────────────────────────
    const FALLACIES = [
      ['Ad hominem', 'Attacks the arguer instead of the argument', 'The attack replaces the reasoning. If the character claim is genuinely relevant evidence, it is not this.'],
      ['Straw man', 'Refutes a distorted, weaker version of the opponent’s claim', 'The position is misstated first. A red herring changes the subject; a straw man keeps it and bends it.'],
      ['False dilemma', 'Presents two options as though they were the only two', 'Look for "either … or" where a third option plainly exists.'],
      ['Slippery slope', 'Claims one step leads inevitably to an extreme end', 'The fallacy is the unjustified chain, not the fear — a supported chain is a valid argument.'],
      ['Post hoc', 'Treats "after" as "because of"', 'Sequence mistaken for causation. Full name: post hoc ergo propter hoc.'],
      ['Hasty generalisation', 'Draws a broad conclusion from too small a sample', 'Two anecdotes standing in for a population.'],
      ['Circular reasoning', 'Assumes in the premise what it sets out to prove', 'Also called begging the question — which does not mean "raises the question".'],
      ['Red herring', 'Introduces an irrelevance to pull attention away', 'The subject changes. Nothing is misrepresented; it is simply abandoned.'],
      ['Appeal to authority', 'Cites an authority outside their field, or a disputed one', 'Citing a real expert within their own field is evidence, not a fallacy.'],
      ['Bandwagon', 'Treats popularity as proof', 'Ad populum. "Everyone knows" is the usual tell.'],
      ['Equivocation', 'Shifts a word’s meaning partway through', 'The argument works only because the word quietly changed sense.'],
      ['False analogy', 'Compares two things that differ in the respect that matters', 'The comparison holds somewhere — just not where the argument needs it.'],
      ['Appeal to ignorance', 'Takes absence of disproof as proof', 'Burden of proof reversed onto whoever doubts it.'],
    ];
    function renderFallacies(body) {
      body.innerHTML = card('Logical fallacies',
        'Naming one earns nothing by itself. The mark comes from showing what the flawed step was doing for the arguer.',
        termList(FALLACIES));
    }

    // ── Devices ──────────────────────────────────────────────────────────────
    const REPEAT = [
      ['Anaphora', 'Repetition at the start of successive clauses', '"We shall fight on the beaches, we shall fight on the landing grounds…"'],
      ['Epistrophe', 'Repetition at the end of successive clauses', '"…of the people, by the people, for the people."'],
      ['Antimetabole', 'The same words reversed', '"Ask not what your country can do for you — ask what you can do for your country."'],
      ['Chiasmus', 'Inverted parallel structure, ABBA', 'Antimetabole repeats the exact words; chiasmus need only mirror the structure.'],
      ['Tricolon', 'Three parallel elements', 'Three lands more firmly than two or four — that is the reason to reach for it.'],
      ['Parallelism', 'Matching grammatical structure across parts', 'Signals that the ideas are equal in weight.'],
    ];
    const SYNTAX = [
      ['Asyndeton', 'Conjunctions omitted', '"I came, I saw, I conquered." Speeds a list up and leaves it feeling unfinished.'],
      ['Polysyndeton', 'Conjunctions deliberately piled on', 'Slows a list down and makes it feel exhausting or endless.'],
      ['Periodic sentence', 'Main clause held back to the end', 'Creates suspense; the point lands last.'],
      ['Cumulative sentence', 'Main clause first, detail after', 'Also called loose. Feels natural, unspooling.'],
      ['Juxtaposition', 'Contrasting things placed side by side', 'Antithesis is juxtaposition sharpened by parallel structure.'],
      ['Zeugma', 'One word governing two others in different senses', '"She lost her keys and her temper."'],
      ['Litotes', 'Understatement by negating the opposite', '"Not a bad result." Often dry, often ironic.'],
      ['Hypophora', 'Poses a question, then answers it', 'A rhetorical question is left hanging; hypophora is not.'],
      ['Concession & rebuttal', 'Grants the other side a point, then answers it', 'Builds ethos — it shows the writer has actually read the opposition.'],
    ];
    function renderDevices(body) {
      body.innerHTML =
        card('Repetition and structure', 'The patterns that carry emphasis.', termList(REPEAT))
        + card('Syntax and stance', 'How the sentence itself argues.', termList(SYNTAX));
    }

    // ── The essays ───────────────────────────────────────────────────────────
    const ESSAYS = [
      ['Synthesis', 'Your argument, supported by the provided sources', 'Use at least three, cite them, and make them serve your claim. Summarising each source in turn is the standard way to lose this one.'],
      ['Rhetorical analysis', 'How the writer builds their argument', 'Analyse choices and their effect on the audience. Listing the devices you spotted is not analysis — every device needs a "so that".'],
      ['Argument', 'Your own defensible position, no sources given', 'Evidence from reading, history, observation. A qualified position ("largely, though not when…") usually beats an absolute one.'],
    ];
    const RUBRIC = [
      ['Thesis — 1 point', 'A defensible position that answers the prompt', 'Not a restatement of the prompt, and not a list of devices.'],
      ['Evidence & commentary — 4 points', 'Specific evidence, and reasoning that ties it to the thesis', 'Where the essay is actually won. Commentary should outweigh quotation.'],
      ['Sophistication — 1 point', 'Genuine complexity, sustained', 'Earned through tension, nuance or a vivid line of argument — never through longer words.'],
    ];
    function renderEssays(body) {
      body.innerHTML =
        card('The three essays', 'Forty minutes each; three entirely different jobs.', termList(ESSAYS))
        + card('How each is scored', 'Six points, weighted heavily towards one row.', termList(RUBRIC));
    }

    H.register('english', [
      { id: 'rh-situation', name: 'Rhetorical situation', icon: '🗣', desc: 'soapstone speaker occasion audience purpose subject tone ethos pathos logos kairos ap lang', render: renderSituation },
      { id: 'rh-fallacies', name: 'Fallacies', icon: '⚠', desc: 'logical fallacies ad hominem straw man slippery slope post hoc circular red herring bandwagon ap lang', render: renderFallacies,
        ai: { name: 'fallacy', description: 'What a logical fallacy is and how to tell it from its neighbours. Arg: fallacy name.', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const f = FALLACIES.find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!f) throw new Error('No such fallacy');
            return { fallacy: f[0], meaning: f[1], tell: f[2] };
          } } },
      { id: 'rh-devices', name: 'Rhetorical devices', icon: '✎', desc: 'anaphora epistrophe asyndeton polysyndeton chiasmus antimetabole periodic cumulative zeugma litotes ap lang', render: renderDevices,
        ai: { name: 'rhetoricalDevice', description: 'What a rhetorical or syntactic device does. Arg: device name.', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const d = REPEAT.concat(SYNTAX).find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!d) throw new Error('No such device');
            return { device: d[0], meaning: d[1], example: d[2] };
          } } },
      { id: 'rh-essays', name: 'The three essays', icon: '📄', desc: 'synthesis rhetorical analysis argument essay rubric thesis commentary sophistication ap lang', render: renderEssays },
    ]);
  }
  boot();
})();
