/* ============================================================================
   FLUX STUDY HUB · Psychology module

   The Psychology pill has been in the subject rail since the rail was written,
   but no module ever registered tools for it. It was not blank — the hub's
   legacy index supplied a single static "Psychology" reference sheet — but one
   tab against three to eight everywhere else made it the thinnest subject in
   the rail, and nothing on it could be practised. This is that module.

   Built around the four things AP Psychology exams actually punish: the
   reinforcement/punishment quadrant (which almost everyone inverts for negative
   reinforcement), the reinforcement schedules, who-said-what, and the
   neurotransmitter/brain-region pairings.

   Registers with fluxStudyHub. No storage — the drill score is per session.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${sub}</p>` : '')
      + inner + '</div>';
    /** The hub's two-line reference row: bold term, then detail beneath. */
    const refList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    // ── Key figures ──────────────────────────────────────────────────────────
    const FIGURES = [
      ['Wilhelm Wundt', 'Structuralism', 'Opened the first psychology lab, Leipzig 1879. Introspection.'],
      ['William James', 'Functionalism', 'Asked what consciousness is for. Wrote Principles of Psychology.'],
      ['Ivan Pavlov', 'Classical conditioning', 'Dogs salivating to a bell — a neutral stimulus becomes conditioned.'],
      ['John B. Watson', 'Behaviourism', 'Little Albert: fear conditioned to a white rat.'],
      ['B. F. Skinner', 'Operant conditioning', 'Behaviour is shaped by its consequences. Skinner box, schedules.'],
      ['Edward Thorndike', 'Law of effect', 'Rewarded behaviour is repeated. Puzzle boxes.'],
      ['Albert Bandura', 'Social learning', 'Bobo doll — we learn by observing and imitating models.'],
      ['Jean Piaget', 'Cognitive development', 'Sensorimotor, preoperational, concrete operational, formal operational.'],
      ['Lev Vygotsky', 'Sociocultural theory', 'Zone of proximal development; learning is social first.'],
      ['Erik Erikson', 'Psychosocial stages', 'Eight lifelong crises, e.g. identity vs role confusion in adolescence.'],
      ['Lawrence Kohlberg', 'Moral development', 'Preconventional, conventional, postconventional. Heinz dilemma.'],
      ['Sigmund Freud', 'Psychoanalysis', 'Id, ego, superego; the unconscious; defence mechanisms.'],
      ['Carl Rogers', 'Humanistic', 'Unconditional positive regard; the self-concept.'],
      ['Abraham Maslow', 'Hierarchy of needs', 'Physiological, safety, belonging, esteem, self-actualisation.'],
      ['Mary Ainsworth', 'Attachment', 'Strange Situation: secure, avoidant, anxious/resistant.'],
      ['Harry Harlow', 'Contact comfort', 'Monkeys chose the cloth mother over the wire one that fed them.'],
      ['Solomon Asch', 'Conformity', 'People agreed with an obviously wrong line judgement to match a group.'],
      ['Stanley Milgram', 'Obedience', 'Most participants continued shocks when instructed by an authority.'],
      ['Philip Zimbardo', 'Stanford prison study', 'Roles and situation shaped behaviour. Now heavily criticised.'],
      ['Elizabeth Loftus', 'Misinformation effect', 'Memory is reconstructed; leading questions alter recall.'],
      ['Hermann Ebbinghaus', 'Forgetting curve', 'Retention drops sharply then levels off. Spacing effect.'],
      ['George Miller', 'Short-term capacity', 'The magical number seven, plus or minus two.'],
      ['Paul Broca', "Broca's area", 'Left frontal — speech production. Damage: halting, effortful speech.'],
      ['Carl Wernicke', "Wernicke's area", 'Left temporal — comprehension. Damage: fluent but meaningless speech.'],
      ['Roger Sperry', 'Split brain', 'Severing the corpus callosum reveals hemispheric specialisation.'],
      ['Hans Selye', 'General adaptation syndrome', 'Alarm, resistance, exhaustion.'],
      ['Martin Seligman', 'Learned helplessness', 'Also founded positive psychology.'],
      ['Noam Chomsky', 'Language acquisition device', 'Argued grammar is innate, against Skinner.'],
      ['Alfred Binet', 'First intelligence test', 'Mental age, to identify children needing help.'],
      ['Howard Gardner', 'Multiple intelligences', 'Linguistic, spatial, musical, bodily-kinaesthetic and more.'],
    ];
    function renderFigures(body) {
      body.innerHTML = card('Key figures', 'Search by name, idea, or study.',
        '<div class="fsh-field"><input id="pfQ" class="fsh-input" placeholder="e.g. conditioning, Bobo, memory" spellcheck="false"></div>'
        + '<div id="pfList" style="margin-top:14px"></div>');
      const draw = (q) => {
        const t = q.trim().toLowerCase();
        const hits = !t ? FIGURES : FIGURES.filter((f) => (f[0] + ' ' + f[1] + ' ' + f[2]).toLowerCase().indexOf(t) >= 0);
        document.getElementById('pfList').innerHTML = hits.length
          ? refList(hits)
          : `<p style="color:var(--fsh-mut)">Nothing matches &ldquo;${esc(q)}&rdquo;.</p>`;
      };
      document.getElementById('pfQ').addEventListener('input', (e) => draw(e.target.value));
      draw('');
    }

    // ── Biology: neurotransmitters and brain regions ─────────────────────────
    const NEURO = [
      ['Acetylcholine (ACh)', 'Muscle movement, learning, memory', 'Undersupply linked to Alzheimer’s.'],
      ['Dopamine', 'Reward, movement, attention', 'Oversupply linked to schizophrenia; undersupply to Parkinson’s.'],
      ['Serotonin', 'Mood, hunger, sleep', 'Undersupply linked to depression. SSRIs act here.'],
      ['Norepinephrine', 'Alertness and arousal', 'Undersupply can depress mood.'],
      ['GABA', 'The main inhibitory transmitter', 'Undersupply linked to seizures and anxiety.'],
      ['Glutamate', 'The main excitatory transmitter', 'Oversupply can overstimulate and cause migraines.'],
      ['Endorphins', 'Pain relief and pleasure', 'Natural opiates; released under stress or exertion.'],
    ];
    const BRAIN = [
      ['Medulla', 'Heartbeat and breathing', 'Brainstem — the functions you never think about.'],
      ['Cerebellum', 'Balance and coordinated movement', 'Also procedural memory. The "little brain" at the rear.'],
      ['Thalamus', 'Sensory switchboard', 'Routes every sense except smell to the cortex.'],
      ['Hypothalamus', 'Hunger, thirst, temperature, hormones', 'Controls the pituitary; reward centres.'],
      ['Hippocampus', 'Forms new explicit memories', 'Damage causes anterograde amnesia.'],
      ['Amygdala', 'Fear and aggression', 'Fast emotional appraisal, ahead of the cortex.'],
      ['Frontal lobe', 'Planning, judgement, speech', 'The prefrontal cortex matures into the mid-twenties.'],
      ['Parietal lobe', 'Touch and body position', 'Contains the somatosensory cortex.'],
      ['Occipital lobe', 'Vision', 'At the very back — a blow here can blind you with intact eyes.'],
      ['Temporal lobe', 'Hearing and language comprehension', 'Contains the auditory cortex.'],
      ['Corpus callosum', 'Joins the two hemispheres', 'Cut in split-brain patients.'],
    ];
    function renderBiology(body) {
      body.innerHTML = card('Neurotransmitters', 'What each one does, and what happens when it runs short.', refList(NEURO))
        + card('Brain regions', 'From the brainstem up.', refList(BRAIN));
    }

    // ── Conditioning drill ───────────────────────────────────────────────────
    /* The quadrant is the single most-missed idea on this paper: "negative"
       means something is removed, not that the outcome is bad. Every item below
       is written so exactly one label is defensible. */
    const QUAD = ['Positive reinforcement', 'Negative reinforcement', 'Positive punishment', 'Negative punishment'];
    const SCHED = ['Fixed ratio', 'Variable ratio', 'Fixed interval', 'Variable interval'];
    const ITEMS = [
      ['Your dog sits, so you give it a treat. It sits more often.', 'Positive reinforcement', QUAD,
        'Something pleasant was ADDED and the behaviour increased.'],
      ['You fasten your seatbelt and the beeping stops. You buckle up sooner each time.', 'Negative reinforcement', QUAD,
        'Something unpleasant was REMOVED and the behaviour increased. This is not punishment.'],
      ['A child touches a hot stove, it hurts, and they stop reaching for it.', 'Positive punishment', QUAD,
        'Something unpleasant was ADDED and the behaviour decreased.'],
      ['A teenager misses curfew, so you take their phone away. They come home on time after that.', 'Negative punishment', QUAD,
        'Something pleasant was REMOVED and the behaviour decreased.'],
      ['You take a painkiller and your headache goes. You reach for it faster next time.', 'Negative reinforcement', QUAD,
        'Removing the pain reinforces taking the tablet.'],
      ['A student is praised for a good answer and volunteers more often.', 'Positive reinforcement', QUAD,
        'Praise was ADDED; the behaviour increased.'],
      ['A factory worker is paid for every 20 units assembled.', 'Fixed ratio', SCHED,
        'Reinforcement after a set NUMBER of responses. High rate, with a pause after each payoff.'],
      ['A slot machine pays out after an unpredictable number of pulls.', 'Variable ratio', SCHED,
        'An unpredictable NUMBER of responses. The highest, steadiest rate and the hardest to extinguish.'],
      ['You are paid every Friday regardless of how much you produce.', 'Fixed interval', SCHED,
        'A fixed amount of TIME. Produces a scalloped pattern — effort rises as the payday approaches.'],
      ['A teacher gives surprise pop quizzes at unpredictable times.', 'Variable interval', SCHED,
        'An unpredictable amount of TIME. Produces slow, steady responding — you keep studying.'],
      ['You check your phone and sometimes there is a new message waiting.', 'Variable ratio', SCHED,
        'The payoff depends on an unpredictable NUMBER of checks, which is why it is so hard to stop.'],
      ['A cake is checked every 30 minutes until it is done.', 'Fixed interval', SCHED,
        'A fixed amount of TIME must pass before checking can pay off.'],
    ];
    function renderDrill(body) {
      let score = 0, asked = 0, idx = -1;
      body.innerHTML = card('Conditioning drill', 'Reinforcement, punishment, and the four schedules. Score: <b id="pdScore">0 / 0</b>',
        '<div class="fsh-out" style="margin:0 0 12px"><span class="big" style="font-size:16px;line-height:1.5" id="pdQ"></span></div>'
        + '<div id="pdOpts"></div><div id="pdWhy" style="margin-top:10px;font-size:12.5px;color:var(--fsh-mut);line-height:1.55"></div>');
      const $q = body.querySelector('#pdQ'), $o = body.querySelector('#pdOpts'),
        $w = body.querySelector('#pdWhy'), $s = body.querySelector('#pdScore');
      function ask() {
        let n = idx;
        while (n === idx && ITEMS.length > 1) n = Math.floor(Math.random() * ITEMS.length);
        idx = n;
        const it = ITEMS[idx];
        $q.textContent = it[0];
        $w.textContent = '';
        $o.innerHTML = it[2].map((o) =>
          `<button type="button" class="fsh-btn ghost" data-opt="${esc(o)}" style="display:block;width:100%;text-align:left;margin-bottom:8px">${esc(o)}</button>`).join('');
        $o.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
          asked++;
          const right = b.dataset.opt === it[1];
          if (right) score++;
          b.style.background = right ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)';
          if (!right) {
            const c = $o.querySelector('[data-opt="' + CSS.escape(it[1]) + '"]');
            if (c) c.style.background = 'rgba(52,211,153,.25)';
          }
          // The explanation is the point of the drill — a bare right/wrong
          // teaches nothing about why negative reinforcement isn't punishment.
          $w.textContent = it[1] + ' — ' + it[3];
          $s.textContent = score + ' / ' + asked;
          $o.querySelectorAll('[data-opt]').forEach((x) => { x.disabled = true; });
          setTimeout(ask, 2600);
        }));
      }
      ask();
    }

    // ── Defence mechanisms and cognitive biases ──────────────────────────────
    const DEFENCE = [
      ['Repression', 'Pushing a threatening memory out of awareness', 'Freud called this the basis of all the others.'],
      ['Denial', 'Refusing to accept a painful reality', '"The test result must be wrong."'],
      ['Projection', 'Attributing your own impulse to someone else', '"He hates me", when in fact you dislike him.'],
      ['Displacement', 'Redirecting an impulse to a safer target', 'Shouting at a sibling after being told off by a teacher.'],
      ['Rationalisation', 'Inventing an acceptable reason for the real one', '"I did not want that place anyway."'],
      ['Reaction formation', 'Acting the opposite of the true feeling', 'Being conspicuously nice to someone you resent.'],
      ['Regression', 'Retreating to an earlier stage of development', 'A child reverting to baby talk when a sibling arrives.'],
      ['Sublimation', 'Channelling an impulse into something accepted', 'Aggression redirected into sport.'],
    ];
    const BIASES = [
      ['Confirmation bias', 'Seeking evidence that fits what you already think', 'And discounting whatever does not.'],
      ['Hindsight bias', 'Believing you knew it all along, after the fact', 'The "I-knew-it-all-along" phenomenon.'],
      ['Availability heuristic', 'Judging likelihood by what comes to mind easily', 'Overestimating plane crashes after seeing one reported.'],
      ['Representativeness heuristic', 'Judging by resemblance to a stereotype', 'Which means ignoring base rates.'],
      ['Anchoring', 'Over-weighting the first number you hear', 'The opening price shapes what then seems reasonable.'],
      ['Framing', 'The same fact persuading differently by wording', '"90% survive" against "10% die".'],
      ['Fundamental attribution error', 'Over-blaming character, under-weighting the situation', 'For other people, rarely for ourselves.'],
      ['Self-serving bias', 'Taking credit for success, blaming circumstances for failure', ''],
      ['Overconfidence', 'Being more certain than you are accurate', ''],
      ['Belief perseverance', 'Clinging to a belief after the evidence for it is gone', ''],
    ];
    function renderThinking(body) {
      body.innerHTML = card('Defence mechanisms', 'Freud’s ego defences, with an example of each.', refList(DEFENCE))
        + card('Biases and heuristics', 'The shortcuts that make thinking fast, and sometimes wrong.', refList(BIASES));
    }

    H.register('psychology', [
      { id: 'figures', name: 'Key figures', icon: '👤', desc: 'psychologists names studies who theory contributions', render: renderFigures,
        ai: { name: 'psychFigure', description: 'What a psychologist is known for. Arg: name.', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const f = FIGURES.find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!f) throw new Error('No such figure');
            return { name: f[0], knownFor: f[1], detail: f[2] };
          } } },
      { id: 'drill', name: 'Conditioning drill', icon: '🎯', desc: 'reinforcement punishment schedules operant classical practice', render: renderDrill },
      { id: 'biology', name: 'Brain & chemistry', icon: '🧠', desc: 'neurotransmitters brain regions lobes biological bases', render: renderBiology },
      /* 🧩, not 🪞 — flux-iconify has no mirror in its emoji map, so that one
         rendered as the neutral fallback dot next to four real icons. */
      { id: 'thinking', name: 'Defences & biases', icon: '🧩', desc: 'defence mechanisms cognitive biases heuristics freud', render: renderThinking },
    ]);
  }
  boot();
})();
