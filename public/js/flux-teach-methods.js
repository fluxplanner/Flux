/* ============================================================================
   FLUX TEACH · METHODS  ·  flux-teach-methods.js
   The written and analytical skills: command terms, essay and source methods,
   key concepts, literary devices, text types and register, research ethics,
   TOK, the elements of art and music theory.

   Where a skill is a method rather than a calculation, the lesson writes the
   method out and the practice draws from fixed banks of examples written for
   it, each with one defensible answer. Music intervals and key signatures are
   computed; history dates are fixed facts.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.FluxTeach, IB = root.FluxIbSyllabus;
  if (!T || !IB || root.__fluxTeachMethods) return;
  root.__fluxTeachMethods = true;

  /** A unit by its own code (when the code is unique) or by the start of its title. */
  function U(sid, key) {
    var s = IB.subjects().filter(function (x) { return x.id === sid; })[0];
    var units = s ? s.units : [];
    var byCode = units.filter(function (x) { return x.code === key; });
    var u = byCode.length === 1 ? byCode[0] : units.filter(function (x) { return x.title.indexOf(key) === 0; })[0];
    if (!u) throw new Error('No unit "' + key + '" in ' + sid);
    return u.id;
  }

  /**
   * A drill from a bank of [prompt, answer] pairs: the other answers in the
   * bank (or opts.options) are the distractors, so every option is plausible.
   */
  function bankVariant(id, name, bank, ask, steps, opts) {
    var o = opts || {};
    return { id: id, name: name, gen: function (r) {
      var item = r.pick(bank), answer = item[1];
      var pool = (o.options || bank.map(function (x) { return x[1]; })).filter(function (x, i, a) { return x !== answer && a.indexOf(x) === i; });
      return Object.assign(T.choice(answer, r.sample(pool, Math.min(3, pool.length)), r), { q: ask(item), steps: steps(item) });
    } };
  }

  var skills = [];
  function add(s) { skills.push(s); }

  /* ════════ Command terms (every subject) ════════ */

  var TERMS = [
    ['Analyse', 'Break down in order to bring out the essential elements or structure.'],
    ['Compare', 'Give an account of the similarities between two (or more) items, referring to both (all) of them throughout.'],
    ['Compare and contrast', 'Give an account of the similarities and differences between two (or more) items, referring to both (all) of them throughout.'],
    ['Contrast', 'Give an account of the differences between two (or more) items, referring to both (all) of them throughout.'],
    ['Define', 'Give the precise meaning of a word, phrase, concept or physical quantity.'],
    ['Describe', 'Give a detailed account.'],
    ['Discuss', 'Offer a considered and balanced review that includes a range of arguments, factors or hypotheses, with conclusions supported by evidence.'],
    ['Distinguish', 'Make clear the differences between two or more concepts or items.'],
    ['Evaluate', 'Make an appraisal by weighing up the strengths and limitations.'],
    ['Examine', 'Consider an argument or concept in a way that uncovers its assumptions and interrelationships.'],
    ['Explain', 'Give a detailed account including reasons or causes.'],
    ['Identify', 'Provide an answer from a number of possibilities.'],
    ['Justify', 'Give valid reasons or evidence to support an answer or conclusion.'],
    ['Outline', 'Give a brief account or summary.'],
    ['State', 'Give a specific name, value or other brief answer without explanation.'],
    ['Suggest', 'Propose a solution, hypothesis or other possible answer.'],
    ['To what extent', 'Consider the merits or otherwise of an argument or concept, reaching a clear, supported conclusion.'],
  ];
  var JUDGE = ['Discuss', 'Evaluate', 'To what extent', 'Justify', 'Examine'];
  var YES = 'Yes: weigh both sides and reach a judgement', NO = 'No: answer what is asked without a final judgement';
  add({ id: 'w-command', units: [U('global-politics', 'P1'), U('history', 'IA'), U('psychology', 'P1'), U('economics', '1.2'), U('business', '1.1'), U('geography', 'IA'), U('english-lit', 'P2'), U('tok', 'ES')],
    title: 'IB command terms',
    method: ['The command term tells you what kind of answer earns the marks: read it before the topic.', 'Low-demand terms (State, Identify, Define, Outline) want short, precise answers with no discussion.', 'Middle terms (Describe, Explain, Distinguish, Analyse) want detail, and reasons or causes.', 'High-demand terms (Discuss, Evaluate, Examine, Justify, To what extent) want arguments on more than one side and a supported judgement.'],
    variants: [
      bankVariant('meaning', 'What does it ask for?', TERMS, function (it) { return 'What does the command term *' + it[0] + '* ask you to do?'; },
        function (it) { return ['Match the term to its IB definition.', it[0] + (JUDGE.indexOf(it[0]) >= 0 ? ' is high-demand: it needs a judgement.' : ' does not need a final judgement.'), it[0] + ': ' + it[1]]; }),
      bankVariant('term', 'Which term is it?', TERMS.map(function (t) { return [t[1], t[0]]; }), function (it) { return 'Which command term means: “' + it[0] + '”?'; },
        function (it) { return ['Find the key idea in the definition: a summary, reasons, differences, an appraisal…', 'Match it to the term.', it[1] + '.']; }),
      bankVariant('judge', 'Does it need a conclusion?', TERMS.map(function (t) { return [t[0], JUDGE.indexOf(t[0]) >= 0 ? YES : NO]; }),
        function (it) { return 'A question starts “' + it[0] + '…”. Must the answer end with a supported judgement?'; },
        function (it) { return ['Discuss, Evaluate, Examine, Justify and To what extent all ask for a judgement.', it[0] + (JUDGE.indexOf(it[0]) >= 0 ? ' is one of them.' : ' is not.'), it[1] + '.']; },
        { options: [YES, NO] }),
    ] });

  /* ════════ Global Politics ════════ */

  var CONCEPTS = [
    ['Power', 'The ability of an actor to influence others or events to get the outcomes it wants.'],
    ['Sovereignty', 'Supreme authority within a territory, free from outside control.'],
    ['Legitimacy', 'Acceptance by those affected that an authority has the right to rule.'],
    ['Interdependence', 'Mutual reliance between actors, so that what one does affects the others.'],
    ['Human rights', 'Basic claims and entitlements that belong to every person because they are human.'],
    ['Development', 'Sustained improvement in people’s well-being and freedoms, not only their income.'],
    ['Sustainability', 'Meeting present needs without compromising the ability of future generations to meet theirs.'],
    ['Globalization', 'The growing interconnectedness of the world through trade, technology, culture and people.'],
  ];
  var POWER = [
    ['A state moves troops to its border to deter an invasion.', 'Hard power'],
    ['A government imposes economic sanctions to force a policy change.', 'Hard power'],
    ['A country’s films and music make people abroad admire its way of life.', 'Soft power'],
    ['A state offers university scholarships to build goodwill abroad.', 'Soft power'],
    ['A state pairs a military alliance with generous aid and cultural exchange.', 'Smart power'],
    ['Global trade rules that favour the countries that wrote them.', 'Structural power'],
  ];
  var ACTORS = [
    ['The United Nations', 'Intergovernmental organization (IGO)'], ['The World Trade Organization', 'Intergovernmental organization (IGO)'], ['The African Union', 'Intergovernmental organization (IGO)'],
    ['Amnesty International', 'Non-governmental organization (NGO)'], ['Médecins Sans Frontières', 'Non-governmental organization (NGO)'], ['Greenpeace', 'Non-governmental organization (NGO)'],
    ['Apple', 'Multinational corporation (MNC)'], ['Shell', 'Multinational corporation (MNC)'], ['Toyota', 'Multinational corporation (MNC)'],
    ['Fridays for Future', 'Social movement'], ['Black Lives Matter', 'Social movement'],
    ['Brazil', 'State'], ['Japan', 'State'],
  ];
  var RIGHTS = [
    ['The right to vote', 'First generation: civil and political'], ['Freedom of speech', 'First generation: civil and political'], ['The right to a fair trial', 'First generation: civil and political'],
    ['The right to education', 'Second generation: economic, social and cultural'], ['The right to health care', 'Second generation: economic, social and cultural'], ['The right to fair wages', 'Second generation: economic, social and cultural'],
    ['The right to a healthy environment', 'Third generation: collective (solidarity)'], ['The right to development', 'Third generation: collective (solidarity)'], ['The right of peoples to self-determination', 'Third generation: collective (solidarity)'],
  ];
  add({ id: 'w-gp-concepts', units: [U('global-politics', 'Power'), U('global-politics', 'Sovereignty'), U('global-politics', 'Legitimacy'), U('global-politics', 'Interdependence'), U('global-politics', 'Global governance'), U('global-politics', 'TS1'), U('global-politics', 'TS2')],
    title: 'Global Politics: key concepts, power and actors',
    method: ['Define the key concept precisely before you use it, then apply it to a real case.', 'Power: hard (coercion: force, sanctions), soft (attraction: culture, values), smart (the two combined), structural (shaping the rules everyone works within).', 'Actors: states, intergovernmental organizations (IGOs), non-governmental organizations (NGOs), multinational corporations (MNCs), social movements and individuals.', 'Human rights are often grouped in three generations: civil and political; economic, social and cultural; collective.'],
    variants: [
      bankVariant('concept', 'Key concept definitions', CONCEPTS.map(function (c) { return [c[1], c[0]]; }), function (it) { return 'Which concept is this: “' + it[0] + '”?'; }, function (it) { return ['Find the defining idea: ability, authority, acceptance, reliance…', 'Match it to the concept.', it[1] + '.']; }),
      bankVariant('power', 'Forms of power', POWER, function (it) { return it[0] + ' Which form of power is this?'; }, function (it) { return ['Coercion → hard; attraction → soft; both → smart; shaping the rules → structural.', 'Ask whether the target is forced, attracted, both, or constrained by the system.', it[1] + '.']; }),
      bankVariant('actor', 'Types of actor', ACTORS, function (it) { return 'What kind of actor is *' + it[0] + '*?'; }, function (it) { return ['IGOs are made of states; NGOs are private, non-profit groups; MNCs are businesses across borders; social movements are loose mass campaigns.', 'Ask who its members are and whether it seeks profit.', it[1] + '.']; }),
      bankVariant('rights', 'Generations of rights', RIGHTS, function (it) { return '*' + it[0] + '* is usually classed as which generation of rights?'; }, function (it) { return ['First: freedoms from the state (civil and political).', 'Second: things the state provides (economic, social, cultural). Third: rights of whole peoples.', it[1] + '.']; }),
    ] });

  add({ id: 'w-gp-assess', units: [U('global-politics', 'P1'), U('global-politics', 'P2'), U('global-politics', 'IA'), U('global-politics', 'P3')],
    title: 'Global Politics: answering papers and the engagement activity',
    method: ['Source questions: base each point on the source; short questions want only what the source shows.', 'Comparing sources: point by point, referring to both sources in every paragraph, similarities and differences.', 'Evaluating with sources: use the sources and your own real-world examples, weigh both sides, then give a clear judgement.', 'Essays: a thesis; each paragraph = claim, concept, real example, analysis; a counter-argument; a conclusion that answers the question.', 'Engagement activity: engage with a real political issue, link it to course concepts and theory, and analyse more than one perspective.'],
    variants: [
      bankVariant('which', 'Which approach fits?', [
        ['“Identify two reasons, given in Source A, for the fall in aid.”', 'Take the reasons straight from Source A; no own knowledge needed'],
        ['“Compare and contrast the views of Source C and Source D on sovereignty.”', 'Point-by-point paragraphs that refer to both sources each time'],
        ['“Using all the sources and your own knowledge, evaluate the claim that the UN is ineffective.”', 'Sources plus your own examples, both sides weighed, then a judgement'],
        ['“To what extent is soft power more effective than hard power?”', 'A thesis, paragraphs with real cases on both sides, a supported conclusion'],
      ], function (it) { return 'Question: ' + it[0] + ' How should you answer it?'; }, function (it) { return ['Read the command term and what you are told to use (a source, all sources, your own knowledge).', 'Match the structure to that demand.', it[1] + '.']; }),
      bankVariant('paragraph', 'Build an essay paragraph', [
        ['States still control their borders, so sovereignty remains strong.', 'Claim'],
        ['Sovereignty means supreme authority within a territory, free from outside control.', 'Concept'],
        ['In 2015 Hungary built a border fence despite objections from other EU members.', 'Real-world example'],
        ['This shows that EU membership limits, but does not remove, a state’s control of its borders.', 'Analysis'],
        ['However, the EU’s free-movement rules show that sovereignty can be pooled.', 'Counter-argument'],
      ], function (it) { return '“' + it[0] + '” — which part of an essay paragraph is this?'; }, function (it) { return ['A strong paragraph runs claim → concept → real example → analysis, with counter-arguments as well.', 'Ask what job this sentence does.', it[1] + '.']; }),
    ] });

  /* ════════ History ════════ */

  var EVENTS = {
    WH12: ['The Cold War', [['Berlin Blockade begins', 1948], ['NATO founded', 1949], ['Korean War begins', 1950], ['Warsaw Pact signed', 1955], ['Hungarian Uprising', 1956], ['Berlin Wall built', 1961], ['Cuban Missile Crisis', 1962], ['Prague Spring', 1968], ['SALT I signed', 1972], ['Soviet invasion of Afghanistan', 1979], ['Fall of the Berlin Wall', 1989], ['Dissolution of the USSR', 1991]]],
    PS3: ['The move to global war', [['Japanese invasion of Manchuria', 1931], ['Hitler becomes Chancellor', 1933], ['Italian invasion of Abyssinia', 1935], ['Remilitarization of the Rhineland', 1936], ['Marco Polo Bridge Incident', 1937], ['Anschluss with Austria', 1938], ['Nazi–Soviet Pact', 1939], ['Attack on Pearl Harbor', 1941]]],
    WH10: ['Authoritarian states', [['October Revolution in Russia', 1917], ['Mussolini’s March on Rome', 1922], ['Stalin’s first Five-Year Plan begins', 1928], ['Night of the Long Knives', 1934], ['People’s Republic of China founded', 1949], ['Great Leap Forward begins', 1958], ['Castro takes power in Cuba', 1959], ['Cultural Revolution begins', 1966]]],
    PS4: ['Rights and protest', [['Brown v. Board of Education ruling', 1954], ['Montgomery Bus Boycott begins', 1955], ['Sharpeville Massacre', 1960], ['March on Washington', 1963], ['Civil Rights Act passed in the USA', 1964], ['Soweto Uprising', 1976], ['Nelson Mandela released', 1990], ['South Africa’s first all-race elections', 1994]]],
  };
  Object.keys(EVENTS).forEach(function (k) {
    var title = EVENTS[k][0], ev = EVENTS[k][1];
    add({ id: 'w-hist-' + k.toLowerCase(), units: [U('history', k)], title: 'History chronology: ' + title,
      method: ['Anchor the topic on a few key dates, then place the other events around them.', 'Chronology shows cause and consequence: an event cannot cause one that came before it.', 'In essays give dates for precision, but analyse why events happened, not only when.'],
      variants: [
        { id: 'first', name: 'Which came first?', gen: function (r) {
          var two = r.sample(ev, 2);
          if (two[0][1] === two[1][1]) return null;
          var first = two[0][1] < two[1][1] ? two[0] : two[1];
          return Object.assign(T.choice(first[0], [two[0][0], two[1][0]].filter(function (x) { return x !== first[0]; })), { q: 'Which came first?',
            steps: [two[0][0] + ': ' + two[0][1] + '.', two[1][0] + ': ' + two[1][1] + '.', first[0] + ' (' + first[1] + ').'] });
        } },
        { id: 'year', name: 'In which year?', gen: function (r) {
          var e = r.pick(ev);
          return { q: 'In which year: *' + e[0] + '*?', answer: e[1], abs: 0,
            steps: ['Place it on your timeline for this topic.', 'Use the events either side of it as a check.', e[0] + ': ' + e[1] + '.'] };
        } },
      ] });
  });

  var OPCVL = [
    ['The speech was given by Churchill in 1946 at Fulton, Missouri.', 'Origin'],
    ['The cartoon was drawn by a Soviet artist for the newspaper Pravda.', 'Origin'],
    ['The author wanted to persuade the American public to support aid to Europe.', 'Purpose'],
    ['The memoir was written to defend the minister’s own decisions after he resigned.', 'Purpose'],
    ['As an eyewitness, the author gives detailed insight into the mood of the crowd.', 'Value'],
    ['Written for ministers only, it reveals what policy-makers really planned.', 'Value'],
    ['Written forty years later, the account may be distorted by hindsight.', 'Limitation'],
    ['As propaganda, it shows only the regime’s side and leaves out the opposition.', 'Limitation'],
  ];
  add({ id: 'w-hist-sources', units: [U('history', 'PS1'), U('history', 'PS2'), U('history', 'PS3'), U('history', 'PS4'), U('history', 'PS5'), U('history', 'IA')], title: 'History: analysing sources (OPCVL)',
    method: ['Origin: who made it, when, where, and what kind of source it is.', 'Purpose: why it was made and for whom.', 'Value and limitation: what the origin, purpose and content make it useful for — and weaker on — for this particular question.', 'Always tie value and limitation to origin and purpose, rather than just saying “it is biased”.'],
    variants: [
      bankVariant('classify', 'O, P, V or L?', OPCVL, function (it) { return '“' + it[0] + '” — which part of OPCVL is this?'; }, function (it) { return ['Who, when, where → origin; why and for whom → purpose.', 'Usefulness → value; weaknesses → limitation.', it[1] + '.']; }, { options: ['Origin', 'Purpose', 'Value', 'Limitation'] }),
      bankVariant('linked', 'Make the limitation specific', [
        ['a British government poster from 1941', 'It was made to keep up morale, so it may hide how anxious people really were'],
        ['a diary kept by a soldier in 1916', 'One soldier’s view of one part of the front may not represent the army as a whole'],
        ['a historian writing in 2005 with newly opened archives', 'It is an interpretation, shaped by the historian’s own focus and selection'],
        ['a leader’s speech to his own party conference', 'Made for supporters, it may exaggerate successes and leave out failures'],
      ], function (it) { return 'Which is the best limitation of ' + it[0] + '?'; }, function (it) { return ['A good limitation comes from the source’s origin or purpose.', 'Avoid vague answers like “it is biased”: say how and why.', it[1] + '.']; }),
    ] });

  /* ════════ English A ════════ */

  var DEVICES = [
    ['“The classroom was a zoo by the time the teacher returned.”', 'Metaphor'],
    ['“Her laugh was like a bell ringing across the valley.”', 'Simile'],
    ['“The wind whispered secrets through the empty streets.”', 'Personification'],
    ['“Silent snow settled softly on the sleeping town.”', 'Alliteration'],
    ['“I have told you a million times to close the door.”', 'Hyperbole'],
    ['“The room fell into a deafening silence.”', 'Oxymoron'],
    ['“We will not wait. We will not waver. We will not fail.”', 'Anaphora'],
    ['“Who among us has never been afraid?”', 'Rhetorical question'],
    ['“The bacon sizzled and popped in the pan.”', 'Onomatopoeia'],
    ['“The marble mansion stood beside a row of crumbling shacks.”', 'Juxtaposition'],
    ['“Rain lashed the windows as she read the letter of rejection.”', 'Pathetic fallacy'],
  ];
  var APPEALS = [
    ['“As a doctor with twenty years’ experience, I can tell you this treatment works.”', 'Ethos (credibility)'],
    ['“Imagine your child, alone and frightened, waiting for help that never comes.”', 'Pathos (emotion)'],
    ['“Ninety per cent of users saw results within a week, according to an independent trial.”', 'Logos (logic and evidence)'],
    ['“Trusted by teachers in over 40 countries.”', 'Ethos (credibility)'],
    ['“Every pound you give feeds a family for a day.”', 'Logos (logic and evidence)'],
    ['“Don’t let their sacrifice be forgotten.”', 'Pathos (emotion)'],
  ];
  add({ id: 'w-eng-devices', units: [U('english-lit', 'P1'), U('english-lit', 'AE1'), U('english-langlit', 'P1'), U('english-langlit', 'AE1')], title: 'Literary and rhetorical devices',
    method: ['Name the device precisely, quote it briefly, then explain its effect on the reader and how it serves the text’s purpose: the effect is what earns marks.', 'A simile compares with like or as; a metaphor says something is something else; personification gives human qualities to the non-human.', 'Sound: alliteration (repeated first sounds), onomatopoeia (sound words). Structure: anaphora (repeated openings), juxtaposition (contrasts placed side by side).', 'Persuasive appeals: ethos (credibility), pathos (emotion), logos (logic and evidence).'],
    variants: [
      bankVariant('device', 'Name the device', DEVICES, function (it) { return it[0] + ' Which device is used?'; }, function (it) { return ['Look for like/as (simile), an impossible equation (metaphor), human qualities (personification), a sound pattern or a repetition.', 'Pick the device this example defines.', it[1] + '. Then ask what effect it has here.']; }),
      bankVariant('appeal', 'Ethos, pathos or logos?', APPEALS, function (it) { return it[0] + ' Which appeal is this?'; }, function (it) { return ['The speaker’s credibility → ethos; feelings → pathos; facts, numbers, reasoning → logos.', 'Ask what makes the line persuasive.', it[1] + '.']; }, { options: ['Ethos (credibility)', 'Pathos (emotion)', 'Logos (logic and evidence)'] }),
    ] });

  add({ id: 'w-eng-assess', units: [U('english-lit', 'P1'), U('english-lit', 'P2'), U('english-lit', 'IO'), U('english-lit', 'HLE'), U('english-langlit', 'P1'), U('english-langlit', 'P2'), U('english-langlit', 'IO'), U('english-langlit', 'HLE')], title: 'English A: how to write each assessment',
    method: ['Paper 1 (guided analysis): a thesis about how the writer creates meaning; paragraphs on techniques, each with a short quotation and its effect; answer the guiding question.', 'Paper 2 (comparative essay): compare two works throughout, tied to the question, never one work and then the other.', 'Individual oral: one global issue explored through an extract from each of two works and the wider works.', 'HL essay: a focused line of inquiry on one work, a sustained argument and precise textual evidence.'],
    variants: [
      bankVariant('structure', 'Which structure fits?', [
        ['Paper 1', 'A thesis on how meaning is made, then technique–quotation–effect paragraphs'],
        ['Paper 2', 'Comparative paragraphs discussing both works throughout'],
        ['individual oral', 'One global issue explored through extracts from two works'],
        ['HL essay', 'A focused line of inquiry on one work, argued with close evidence'],
      ], function (it) { return 'Which approach fits the ' + it[0] + '?'; }, function (it) { return ['Each assessment rewards a different shape of argument.', 'Match the component to its shape.', it[1] + '.']; }),
      bankVariant('peel', 'Point, evidence, explanation', [
        ['The poet presents grief as overwhelming.', 'Point'],
        ['“The house was a hollow shell after she left.”', 'Evidence'],
        ['The metaphor of a “hollow shell” suggests the speaker’s life has lost its centre.', 'Explanation'],
        ['This connects to the poem’s wider concern with how loss reshapes identity.', 'Link to the question'],
      ], function (it) { return '“' + it[0] + '” — which part of an analytical paragraph is this?'; }, function (it) { return ['A paragraph moves point → evidence (a short quotation) → explanation of its effect → link back to the question.', 'Ask what this sentence does.', it[1] + '.']; }),
    ] });

  /* ════════ Language B: text types and register ════════ */

  var TEXTTYPES = [
    ['a headline, a byline, an opening that answers who, what, where and when, and short paragraphs', 'News report'],
    ['a formal greeting, a stated purpose, a formal sign-off and a signature', 'Formal letter'],
    ['a title, dated posts, a conversational first-person voice and an invitation to comment', 'Blog post'],
    ['direct address to an audience, rhetorical questions and a call to action', 'Speech'],
    ['headings, short sections, bullet points and contact details', 'Brochure or leaflet'],
    ['dated, private, first-person and reflective entries', 'Diary entry'],
    ['a subject line, a greeting, short focused paragraphs and a sign-off', 'Email'],
    ['an introduction, then questions and answers in turn with the interviewee’s own words', 'Interview'],
  ];
  [['french-b', 'French', 'tu', 'vous'], ['spanish-b', 'Spanish', 'tú', 'usted'], ['german-b', 'German', 'du', 'Sie']].forEach(function (L) {
    var formal = 'Formal: ' + L[3], informal = 'Informal: ' + L[2];
    var REG = [['a letter to the head of your school', formal], ['an email to a close friend', informal], ['a speech to the town council', formal], ['a message to your younger cousin', informal], ['a complaint to a hotel manager', formal], ['a blog post for teenagers your age', informal]];
    add({ id: 'w-langb-' + L[0], units: [U(L[0], 'P1'), U(L[0], 'IA'), U(L[0], 'T4')], title: L[1] + ' B: text types and register',
      method: ['Paper 1 asks for a text type: choose the one that fits the task and show its conventions (format, opening, closing, layout).', 'Match the register to the reader: formal for officials and strangers (' + L[3] + '), informal for friends and family (' + L[2] + ').', 'Plan: purpose, audience, text type, three main points, and a closing that suits the type.'],
      variants: [
        bankVariant('type', 'Which text type?', TEXTTYPES, function (it) { return 'Which text type has ' + it[0] + '?'; }, function (it) { return ['Look at the format features: headings, greetings, dates, questions.', 'Each text type has signature conventions.', it[1] + '.']; }),
        bankVariant('register', 'Which register?', REG, function (it) { return 'You are writing ' + it[0] + ' in ' + L[1] + '. Which register and form of “you”?'; }, function (it) { return ['Ask how well you know the reader and how official the situation is.', 'Officials and strangers → formal; friends and family → informal.', it[1] + '.']; }, { options: [formal, informal] }),
      ] });
  });

  /* ════════ Psychology ════════ */

  var APPROACH = [
    ['Low serotonin levels are linked to depression.', 'Biological approach'], ['Twin studies suggest that intelligence is partly heritable.', 'Biological approach'], ['Damage to the hippocampus prevents new long-term memories forming.', 'Biological approach'],
    ['Schemas shape what we remember from a story.', 'Cognitive approach'], ['Leading questions can distort eyewitness testimony.', 'Cognitive approach'], ['Working memory has separate stores for sounds and images.', 'Cognitive approach'],
    ['People conform to a group’s norms to fit in.', 'Sociocultural approach'], ['Individualist and collectivist cultures shape behaviour differently.', 'Sociocultural approach'], ['Social identity theory explains favouritism towards one’s own group.', 'Sociocultural approach'],
  ];
  var ETHICS = [
    ['Participants are told the study is about memory when it is really about obedience.', 'Deception'], ['A participant asks to stop but is told the experiment must continue.', 'Right to withdraw'],
    ['Children take part without their parents being asked.', 'Informed consent'], ['Participants’ names appear in the published report.', 'Confidentiality'],
    ['Participants leave without being told the real aim of the study.', 'Debriefing'], ['Participants are made very anxious for no clear benefit.', 'Protection from harm'],
  ];
  add({ id: 'w-psych', units: [U('psychology', 'The biological'), U('psychology', 'The cognitive'), U('psychology', 'The sociocultural'), U('psychology', 'Research methods'), U('psychology', 'P1'), U('psychology', 'P2')], title: 'Psychology: approaches, ethics and how to answer',
    method: ['Biological approach: genes, hormones, neurotransmitters and the brain. Cognitive: mental processes such as memory, thinking and perception. Sociocultural: groups, culture and other people.', 'Ethics: informed consent, deception, the right to withdraw, protection from harm, confidentiality, debriefing.', 'Short answers: describe the theory or study precisely and link it to the question. Essays: describe, evaluate (strengths, limitations, methods, ethics), then conclude.', 'For a study, give its aim, method, results and conclusion, then show how it supports the claim.'],
    variants: [
      bankVariant('approach', 'Which approach?', APPROACH, function (it) { return '“' + it[0] + '” — which approach does this explanation come from?'; }, function (it) { return ['Body and brain → biological; mental processes → cognitive; other people and culture → sociocultural.', 'Ask what the explanation points to as the cause.', it[1] + '.']; }, { options: ['Biological approach', 'Cognitive approach', 'Sociocultural approach'] }),
      bankVariant('ethics', 'Which ethical issue?', ETHICS, function (it) { return it[0] + ' Which ethical guideline is at stake?'; }, function (it) { return ['Lying about the aim → deception; no permission → informed consent; no way out → right to withdraw.', 'Names revealed → confidentiality; never told afterwards → debriefing; distress → protection from harm.', it[1] + '.']; }),
    ] });

  /* ════════ TOK ════════ */

  var KQ = [
    ['To what extent can we trust the evidence of our senses?', 'A knowledge question'], ['How does language shape what we can know?', 'A knowledge question'], ['Can a historian ever be fully objective?', 'A knowledge question'], ['What makes one scientific explanation better than another?', 'A knowledge question'],
    ['Was the Treaty of Versailles fair to Germany?', 'A subject question, not a knowledge question'], ['What is the boiling point of water at sea level?', 'A subject question, not a knowledge question'], ['In which year did Picasso paint Guernica?', 'A subject question, not a knowledge question'], ['Is nuclear power cheaper than solar power?', 'A subject question, not a knowledge question'],
  ];
  var TOKC = [['Evidence', 'Concept'], ['Certainty', 'Concept'], ['Truth', 'Concept'], ['Interpretation', 'Concept'], ['Power', 'Concept'], ['Justification', 'Concept'], ['Explanation', 'Concept'], ['Objectivity', 'Concept'], ['Perspective', 'Concept'], ['Culture', 'Concept'], ['Values', 'Concept'], ['Responsibility', 'Concept'],
    ['History', 'Area of knowledge'], ['The human sciences', 'Area of knowledge'], ['The natural sciences', 'Area of knowledge'], ['Mathematics', 'Area of knowledge'], ['The arts', 'Area of knowledge'],
    ['Knowledge and technology', 'Optional theme'], ['Knowledge and language', 'Optional theme'], ['Knowledge and politics', 'Optional theme'], ['Knowledge and religion', 'Optional theme'], ['Knowledge and Indigenous societies', 'Optional theme']];
  var TOKN = [['How many objects does the TOK exhibition use?', 3], ['What is the maximum word count of the TOK exhibition commentary?', 950], ['What is the maximum word count of the TOK essay?', 1600], ['How many prescribed titles are released for each TOK essay session?', 6], ['How many areas of knowledge does the TOK course name?', 5]];
  add({ id: 'w-tok', units: [U('tok', 'Knowledge and the knower'), U('tok', 'EX'), U('tok', 'ES'), U('tok', 'History'), U('tok', 'Knowledge and technology')], title: 'TOK: knowledge questions, concepts and assessment',
    method: ['A knowledge question is about knowledge itself: open, contestable, and phrased in TOK concepts (evidence, truth, certainty…) rather than a subject’s content.', 'The course: the core theme (knowledge and the knower), two of five optional themes, and five areas of knowledge.', 'Exhibition: three objects, one IA prompt, a commentary of up to 950 words linking each object to the prompt.', 'Essay: one of six prescribed titles, up to 1,600 words, with claims, counter-claims and real examples from areas of knowledge.'],
    variants: [
      bankVariant('kq', 'Knowledge question or not?', KQ, function (it) { return '“' + it[0] + '” — is this a knowledge question?'; }, function (it) { return ['Does it ask how we know, or what we know?', 'Knowledge questions are about knowledge and can be argued either way.', it[1] + '.']; }, { options: ['A knowledge question', 'A subject question, not a knowledge question'] }),
      bankVariant('part', 'Concept, area or theme?', TOKC, function (it) { return 'In the TOK course, what is *' + it[0] + '*?'; }, function (it) { return ['Twelve concepts, five areas of knowledge, five optional themes (plus the core theme).', 'Place the term in that structure.', it[0] + ': ' + it[1].toLowerCase() + '.']; }, { options: ['Concept', 'Area of knowledge', 'Optional theme'] }),
      { id: 'numbers', name: 'Assessment rules', gen: function (r) {
        var it = r.pick(TOKN);
        return { q: it[0], answer: it[1], abs: 0, steps: ['Exhibition: 3 objects, 1 IA prompt, up to 950 words.', 'Essay: 1 of 6 prescribed titles, up to 1,600 words.', 'Answer: ' + it[1] + '.'] };
      } },
    ] });

  /* ════════ Visual Arts ════════ */

  var ART = [['Line', 'Element'], ['Shape', 'Element'], ['Form', 'Element'], ['Colour', 'Element'], ['Value (tone)', 'Element'], ['Texture', 'Element'], ['Space', 'Element'],
    ['Balance', 'Principle'], ['Contrast', 'Principle'], ['Emphasis', 'Principle'], ['Movement', 'Principle'], ['Pattern', 'Principle'], ['Rhythm', 'Principle'], ['Unity', 'Principle'], ['Proportion', 'Principle']];
  var ARTDEF = [['How light or dark a colour or area is', 'Value (tone)'], ['How a surface feels, or looks as if it would feel', 'Texture'], ['The area around, between and within things, including depth', 'Space'], ['A three-dimensional shape, or the illusion of one', 'Form'],
    ['How visual weight is distributed in a composition', 'Balance'], ['Making one part the focal point', 'Emphasis'], ['Repetition that creates a sense of movement', 'Rhythm'], ['The sense that every part belongs together', 'Unity'], ['Placing very different things together so each stands out', 'Contrast']];
  add({ id: 'w-art', units: [U('visual-arts', 'Communicating visually'), U('visual-arts', 'A1'), U('visual-arts', 'A2'), U('visual-arts', 'A3')], title: 'Visual Arts: the formal elements and principles',
    method: ['Elements are the building blocks: line, shape, form, colour, value, texture, space.', 'Principles are how they are arranged: balance, contrast, emphasis, movement, pattern, rhythm, unity, proportion.', 'Formal analysis: describe what you see (elements), how it is organised (principles), then interpret its meaning and context.', 'In the connections study and the portfolio, use this vocabulary precisely and link it to your own art-making.'],
    variants: [
      bankVariant('which', 'Element or principle?', ART, function (it) { return 'Is *' + it[0] + '* an element or a principle of art?'; }, function (it) { return ['Elements are what an artwork is made of; principles are how they are arranged.', it[0] + (it[1] === 'Element' ? ' is a building block.' : ' is a way of arranging.'), it[1] + '.']; }, { options: ['Element', 'Principle'] }),
      bankVariant('define', 'Define the term', ARTDEF, function (it) { return 'Which term means: “' + it[0] + '”?'; }, function (it) { return ['Use precise formal vocabulary in written work.', 'Match the definition.', it[1] + '.']; }),
    ] });

  /* ════════ Music (computed) ════════ */

  var NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], NATURAL = [0, 2, 4, 5, 7, 9, 11];
  var INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];
  var SHARPS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'], FLATS = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  var METRES = ['Simple duple', 'Simple triple', 'Simple quadruple', 'Compound duple', 'Compound triple', 'Compound quadruple'];
  add({ id: 'w-music', units: [U('music', 'AI1'), U('music', 'AI2'), U('music', 'EM'), U('music', 'EX')], title: 'Music theory: intervals, keys, tempo and metre',
    method: ['An interval is the distance between two notes: count the semitones (C to E = 4 = a major 3rd; C to G = 7 = a perfect 5th).', 'Sharp major keys go up in fifths: G (1♯), D (2), A (3), E (4), B (5), F♯ (6), C♯ (7). Flat keys go down in fifths: F (1♭), B♭ (2), E♭ (3), A♭ (4), D♭ (5), G♭ (6), C♭ (7).', 'Tempo terms, slowest to fastest: largo, adagio, andante, moderato, allegro, presto.', 'Simple time divides the beat in two (2/4, 3/4, 4/4); compound time divides it in three (6/8, 9/8, 12/8).'],
    variants: [
      { id: 'interval', name: 'Name the interval', gen: function (r) {
        var a = r.int(0, 6), up = r.int(1, 12), low = NATURAL[a], high = (low + up) % 12;
        return Object.assign(T.choice(INTERVALS[up], r.sample(INTERVALS.filter(function (x, i) { return i !== up && i > 0; }), 3), r), {
          q: 'Name the interval from ' + LETTERS[a] + ' up to the ' + NOTES[high] + ' above it.',
          steps: ['Count the semitones from ' + LETTERS[a] + ' up to ' + NOTES[high] + '.', 'That is ' + up + ' semitone' + (up === 1 ? '' : 's') + '.', up + ' semitones: ' + INTERVALS[up].toLowerCase() + '.'] });
      } },
      { id: 'keys', name: 'Key signatures', gen: function (r) {
        var sharp = r.next() < 0.5, n = r.int(1, 7), key = (sharp ? SHARPS : FLATS)[n];
        return { q: 'How many ' + (sharp ? 'sharps' : 'flats') + ' are in the key signature of ' + key + ' major?', answer: n,
          steps: [sharp ? 'Sharp keys go up in fifths from C: G, D, A, E, B, F♯, C♯.' : 'Flat keys go down in fifths from C: F, B♭, E♭, A♭, D♭, G♭, C♭.', key + ' is number ' + n + ' in that list.', n + ' ' + (sharp ? 'sharp' : 'flat') + (n > 1 ? 's' : '') + '.'] };
      } },
      { id: 'tempo', name: 'Tempo terms', gen: function (r) {
        var order = ['Largo', 'Adagio', 'Andante', 'Moderato', 'Allegro', 'Presto'], two = r.sample(order, 2), faster = order.indexOf(two[0]) > order.indexOf(two[1]) ? two[0] : two[1];
        return Object.assign(T.choice(faster, two.filter(function (x) { return x !== faster; })), { q: 'Which is faster: ' + two[0] + ' or ' + two[1] + '?',
          steps: ['Slowest to fastest: largo, adagio, andante, moderato, allegro, presto.', 'Find both in the list.', faster + '.'] });
      } },
      { id: 'metre', name: 'Simple or compound time?', gen: function (r) {
        var ts = r.pick([['2/4', 'Simple duple'], ['3/4', 'Simple triple'], ['4/4', 'Simple quadruple'], ['6/8', 'Compound duple'], ['9/8', 'Compound triple'], ['12/8', 'Compound quadruple']]);
        return Object.assign(T.choice(ts[1], r.sample(METRES.filter(function (x) { return x !== ts[1]; }), 3), r), { q: 'Describe the time signature ' + ts[0] + '.',
          steps: ['Top number 2, 3 or 4 → simple time; 6, 9 or 12 → compound time (each beat divides in three).', 'In compound time, beats per bar = top number ÷ 3.', ts[0] + ': ' + ts[1].toLowerCase() + '.'] });
      } },
    ] });

  /* ════════ Economics, Business, Geography: the written side ════════ */

  var ECTERMS = [['The value of the next best alternative given up', 'Opportunity cost'], ['Assuming all other things remain equal', 'Ceteris paribus'], ['When a free market does not allocate resources to their most efficient use', 'Market failure'],
    ['A good with external benefits that a free market underprovides', 'Merit good'], ['A good with external costs that a free market overprovides', 'Demerit good'], ['A good that is non-rivalrous and non-excludable', 'Public good'],
    ['A sustained rise in the general price level', 'Inflation'], ['A sustained fall in the general price level', 'Deflation'], ['Using government spending and taxation to influence the economy', 'Fiscal policy'],
    ['Using interest rates and the money supply to influence the economy', 'Monetary policy'], ['Producing a good at a lower opportunity cost than another producer', 'Comparative advantage']];
  add({ id: 'w-econ', units: [U('economics', '1.2'), U('economics', '2.8'), U('economics', '2.9'), U('economics', '3.5'), U('economics', '3.6'), U('economics', '4.1')], title: 'Economics: definitions and evaluation',
    method: ['Start each answer by defining the key terms precisely.', 'Draw the right diagram, fully labelled (axes, curves, equilibria, shifts), and explain it in words.', 'Use a real-world example with specifics: a country, a date, a figure.', 'Evaluate: short run versus long run, the stakeholders affected, the assumptions and their limits, alternatives; end with a justified judgement.'],
    variants: [
      bankVariant('term', 'Which term?', ECTERMS, function (it) { return 'Which term means: “' + it[0] + '”?'; }, function (it) { return ['Precise definitions earn marks in every paper.', 'Match the definition to the term.', it[1] + '.']; }),
      bankVariant('part', 'Which part of the answer?', [['Ceteris paribus, a rise in price lowers the quantity demanded.', 'Theory and definition'], ['In 2018 the UK introduced a levy on sugary soft drinks.', 'Real-world example'], ['In the long run firms may pass the tax on to consumers, so its effect depends on PED.', 'Evaluation'], ['The supply curve shifts up by the amount of the tax, from S₁ to S₂.', 'Diagram explanation']],
        function (it) { return '“' + it[0] + '” — what job does this sentence do in an essay?'; }, function (it) { return ['Strong answers combine theory, a diagram explained in words, a real example and evaluation.', 'Ask what this sentence adds.', it[1] + '.']; }),
    ] });

  var SWOT = [['A strong, well-known brand', 'Strength (internal)'], ['Highly skilled, loyal staff', 'Strength (internal)'], ['Out-of-date machinery', 'Weakness (internal)'], ['Poor cash-flow management', 'Weakness (internal)'],
    ['A growing market for eco-friendly products', 'Opportunity (external)'], ['A trade agreement opening a new market', 'Opportunity (external)'], ['A new competitor entering the market', 'Threat (external)'], ['A recession reducing consumer spending', 'Threat (external)']];
  var STEEPLE = [['An ageing population', 'Social'], ['Automation of production lines', 'Technological'], ['Rising interest rates', 'Economic'], ['Stricter carbon-emission targets', 'Environmental'], ['A change of government', 'Political'], ['A new minimum-wage law', 'Legal'], ['Growing concern about fair treatment of suppliers', 'Ethical']];
  var ANSOFF = ['Market penetration', 'Product development', 'Market development', 'Diversification'];
  var BCG = ['Star', 'Cash cow', 'Question mark (problem child)', 'Dog'];
  add({ id: 'w-bm', units: [U('business', '1.3'), U('business', '4.5'), U('business', '1.5')], title: 'Business: SWOT, STEEPLE, Ansoff and the Boston matrix',
    method: ['SWOT: strengths and weaknesses are internal; opportunities and threats come from outside the business.', 'STEEPLE sorts external factors: Social, Technological, Economic, Environmental, Political, Legal, Ethical.', 'Ansoff: existing product in an existing market = market penetration; new product, existing market = product development; existing product, new market = market development; new product in a new market = diversification (the riskiest).', 'Boston matrix: high share + high growth = star; high share + low growth = cash cow; low share + high growth = question mark; low share + low growth = dog.'],
    variants: [
      bankVariant('swot', 'SWOT', SWOT, function (it) { return 'In a SWOT analysis, where does “' + it[0] + '” go?'; }, function (it) { return ['Inside the business → strength or weakness; outside → opportunity or threat.', 'Then ask: does it help or harm?', it[1] + '.']; }),
      bankVariant('steeple', 'STEEPLE', STEEPLE, function (it) { return 'Which STEEPLE factor is “' + it[0] + '”?'; }, function (it) { return ['STEEPLE: Social, Technological, Economic, Environmental, Political, Legal, Ethical.', 'Ask what kind of change it is.', it[1] + '.']; }),
      { id: 'ansoff', name: 'Ansoff matrix', gen: function (r) {
        var np = r.next() < 0.5, nm = r.next() < 0.5, ans = ANSOFF[(np ? 1 : 0) + (nm ? 2 : 0) === 3 ? 3 : np ? 1 : nm ? 2 : 0];
        var ex = np ? (nm ? 'launch a completely new kind of product in a country where it has never sold' : 'launch a new product for its current customers') : (nm ? 'start selling its existing product in a new country' : 'cut prices to win more customers for its current product at home');
        return Object.assign(T.choice(ans, ANSOFF.filter(function (x) { return x !== ans; })), { q: 'A firm plans to ' + ex + '. Which Ansoff strategy is this?',
          steps: ['Product: ' + (np ? 'new' : 'existing') + '. Market: ' + (nm ? 'new' : 'existing') + '.', 'Existing + existing → penetration; new product → product development; new market → market development; both new → diversification.', ans + '.'] });
      } },
      { id: 'boston', name: 'Boston matrix', gen: function (r) {
        var hs = r.next() < 0.5, hg = r.next() < 0.5, ans = BCG[hs ? (hg ? 0 : 1) : (hg ? 2 : 3)], share = hs ? r.int(30, 60) : r.int(2, 9), growth = hg ? r.int(12, 30) : r.int(0, 4);
        return Object.assign(T.choice(ans, BCG.filter(function (x) { return x !== ans; })), { q: 'A product holds ' + share + '% of its market (the leader’s share is about 30% or more) and the market is growing ' + growth + '% a year. Where does it sit in the Boston matrix?',
          steps: ['Market share: ' + (hs ? 'high' : 'low') + '. Market growth: ' + (hg ? 'high' : 'low') + '.', 'High share + high growth → star; high share + low growth → cash cow; low share + high growth → question mark; low + low → dog.', ans + '.'] });
      } },
    ] });

  var PUSHPULL = [['A lack of jobs in the home region', 'Push factor'], ['Civil war at home', 'Push factor'], ['Drought destroying crops', 'Push factor'], ['Higher wages in the destination', 'Pull factor'], ['Family already living in the destination', 'Pull factor'], ['Better schools and hospitals in the city', 'Pull factor']];
  var HAZ = [['earthquake', 'Geophysical'], ['volcanic eruption', 'Geophysical'], ['tsunami', 'Geophysical'], ['tropical cyclone', 'Hydro-meteorological'], ['drought', 'Hydro-meteorological'], ['river flood', 'Hydro-meteorological']];
  add({ id: 'w-geo', units: [U('geography', 'Changing population'), U('geography', 'D'), U('geography', 'Global risks')], title: 'Geography: classifying factors and writing with case studies',
    method: ['Migration: push factors drive people away from a place; pull factors draw them to one.', 'Geophysical hazards come from the Earth’s internal processes; hydro-meteorological hazards from weather and water.', 'Essays: define terms; use named, located, dated case studies with figures; compare scales and stakeholders; give a judgement for “to what extent”.'],
    variants: [
      bankVariant('pushpull', 'Push or pull?', PUSHPULL, function (it) { return '“' + it[0] + '” — push factor or pull factor?'; }, function (it) { return ['Push factors are at the origin and drive people out.', 'Pull factors are at the destination and draw people in.', it[1] + '.']; }, { options: ['Push factor', 'Pull factor'] }),
      bankVariant('hazard', 'Type of hazard', HAZ, function (it) { return 'Is a ' + it[0] + ' a geophysical or a hydro-meteorological hazard?'; }, function (it) { return ['The Earth’s internal energy → geophysical.', 'Weather and water → hydro-meteorological.', it[1] + '.']; }, { options: ['Geophysical', 'Hydro-meteorological'] }),
    ] });

  T.register(skills);
})();
