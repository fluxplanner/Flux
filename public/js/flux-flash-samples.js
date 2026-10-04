/* Flux Flashcards · ready-made decks, so the app has something to study the
   moment it opens. Copying one gives you your own deck to edit. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  function rows(text) {
    return text.trim().split('\n').map(function (l) {
      var i = l.indexOf('|');
      return { term: l.slice(0, i).trim(), def: l.slice(i + 1).trim() };
    });
  }
  root.FluxFlashSamples = [
    {
      id: 'ib-command-terms',
      title: 'IB command terms',
      desc: 'What each command term in a DP question asks you to do.',
      icon: 'grad',
      cards: rows([
        'Analyse|Break down in order to bring out the essential elements or structure.',
        'Calculate|Obtain a numerical answer showing the relevant stages in the working.',
        'Compare|Give an account of the similarities between two (or more) items or situations, referring to both (all) of them throughout.',
        'Contrast|Give an account of the differences between two (or more) items or situations, referring to both (all) of them throughout.',
        'Compare and contrast|Give an account of similarities and differences between two (or more) items or situations, referring to both (all) of them throughout.',
        'Deduce|Reach a conclusion from the information given.',
        'Define|Give the precise meaning of a word, phrase, concept or physical quantity.',
        'Describe|Give a detailed account.',
        'Discuss|Offer a considered and balanced review that includes a range of arguments, factors or hypotheses, with conclusions supported by appropriate evidence.',
        'Evaluate|Make an appraisal by weighing up the strengths and limitations.',
        'Explain|Give a detailed account including reasons or causes.',
        'Identify|Provide an answer from a number of possibilities.',
        'Justify|Give valid reasons or evidence to support an answer or conclusion.',
        'Outline|Give a brief account or summary.',
        'State|Give a specific name, value or other brief answer without explanation or calculation.',
        'To what extent|Consider the merits or otherwise of an argument or concept, with opinions and conclusions supported by evidence and sound argument.',
      ].join('\n')),
    },
    {
      id: 'spanish-verbs',
      title: 'Spanish: 20 everyday verbs',
      desc: 'The verbs you will meet in almost every sentence.',
      icon: 'langs',
      termLang: 'es-ES',
      defLang: 'en-US',
      cards: rows([
        'ser|to be (what something is)',
        'estar|to be (how or where something is)',
        'tener|to have',
        'hacer|to do / to make',
        'ir|to go',
        'poder|to be able to / can',
        'decir|to say / to tell',
        'ver|to see',
        'dar|to give',
        'saber|to know (a fact)',
        'conocer|to know (a person or place)',
        'querer|to want / to love',
        'llegar|to arrive',
        'pasar|to pass / to spend (time)',
        'deber|must / to owe',
        'poner|to put',
        'parecer|to seem',
        'quedar|to stay / to remain',
        'creer|to believe',
        'hablar|to speak',
      ].join('\n')),
    },
    {
      id: 'chem-first-20',
      title: 'Chemistry: the first 20 elements',
      desc: 'Element names and symbols, hydrogen to calcium.',
      icon: 'flask',
      cards: rows([
        'Hydrogen|H', 'Helium|He', 'Lithium|Li', 'Beryllium|Be', 'Boron|B',
        'Carbon|C', 'Nitrogen|N', 'Oxygen|O', 'Fluorine|F', 'Neon|Ne',
        'Sodium|Na', 'Magnesium|Mg', 'Aluminium|Al', 'Silicon|Si', 'Phosphorus|P',
        'Sulfur|S', 'Chlorine|Cl', 'Argon|Ar', 'Potassium|K', 'Calcium|Ca',
      ].join('\n')),
    },
    {
      id: 'bio-organelles',
      title: 'Biology: cell organelles',
      desc: 'What each part of a cell does.',
      icon: 'dna',
      cards: rows([
        'Nucleus|Contains the cell\'s DNA and controls its activities.',
        'Mitochondrion|Site of aerobic respiration, which releases energy as ATP.',
        'Ribosome|Site of protein synthesis.',
        'Rough endoplasmic reticulum|Membranes studded with ribosomes that make and transport proteins.',
        'Smooth endoplasmic reticulum|Makes and transports lipids and steroids.',
        'Golgi apparatus|Modifies, packages and sorts proteins, often for secretion.',
        'Lysosome|Contains digestive enzymes that break down waste and worn-out organelles.',
        'Chloroplast|Site of photosynthesis in plant cells.',
        'Cell membrane|Partially permeable barrier that controls what enters and leaves the cell.',
        'Cell wall|Cellulose layer that supports and protects plant cells.',
        'Vacuole|Stores cell sap and keeps plant cells turgid.',
        'Centriole|Organises the spindle during cell division in animal cells.',
      ].join('\n')),
    },
    {
      id: 'physics-si',
      title: 'Physics: SI units',
      desc: 'Each quantity and the unit it is measured in.',
      icon: 'atom',
      cards: rows([
        'Force|newton (N)', 'Energy|joule (J)', 'Power|watt (W)', 'Pressure|pascal (Pa)',
        'Frequency|hertz (Hz)', 'Electric charge|coulomb (C)', 'Potential difference|volt (V)',
        'Resistance|ohm (Ω)', 'Electric current|ampere (A)', 'Temperature|kelvin (K)',
        'Amount of substance|mole (mol)', 'Luminous intensity|candela (cd)',
      ].join('\n')),
    },
    {
      id: 'capitals',
      title: 'World capitals',
      desc: 'The ones people most often get wrong.',
      icon: 'globe',
      cards: rows([
        'Australia|Canberra', 'Canada|Ottawa', 'Brazil|Brasília', 'Turkey|Ankara', 'Nigeria|Abuja',
        'Switzerland|Bern', 'New Zealand|Wellington', 'Pakistan|Islamabad', 'Morocco|Rabat',
        'Vietnam|Hanoi', 'South Korea|Seoul', 'Egypt|Cairo', 'Kenya|Nairobi',
        'Argentina|Buenos Aires', 'Japan|Tokyo',
      ].join('\n')),
    },
  ];
})();
