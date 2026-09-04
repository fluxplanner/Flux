/* ============================================================================
   FLUX LANGUAGE PRACTICE  ·  flux-lang-practice.js
   Vocabulary decks and a conjugation drill for Spanish and French.

   WHY
   ---
   Every language tool in Flux was reference-only: look up a verb, read a
   phrase, study a chart. Nothing ever asked you a question. You cannot revise
   for a vocabulary test by reading a list, and the one thing a planner is well
   placed to do — catch you in the ten minutes before the lesson and ask —
   was missing entirely.

   ONE TABLE, THREE LANGUAGES
   --------------------------
   Each row is [English, Spanish, French, German]. Keeping all three on the
   same row is not a space trick: separate decks drift, and a student taking
   two of them then gets "the timetable" in one and something subtly different
   in the other. One row, one meaning.

   German arrived when French, German and Spanish became subjects in their own
   right. Its column carries der/die/das for the same reason the other two
   carry their articles — gender is what people actually lose marks on.

   MARKING
   -------
   Accents are stripped before comparison, then mentioned if that was the only
   difference. Marking someone wrong for a missing accent teaches nothing
   except that the tool is hostile; silently accepting it teaches a spelling
   that will lose marks in an exam. So: correct, with a note.

   LEITNER
   -------
   Five boxes. A right answer promotes a word, a wrong answer sends it back to
   box 0, and the picker draws from the lowest boxes first. Deliberately not
   SM-2 with intervals in days — this gets used the night before a test, not on
   a schedule, so "what do I keep getting wrong" beats "what is due today".
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxLangPractice) return;

  var LS_KEY = 'flux_lang_practice_v1';
  var BOXES = 5;

  /* ── vocabulary ──────────────────────────────────────────────────────────
     Nouns carry their article, because "table" is useless without knowing it
     is la mesa but la table and le bureau. Gender is what people lose marks
     on, so it is never stripped out. */
  var THEMES = [
    { id: 'school', name: 'School', words: [
      ['the teacher (m)', 'el profesor', 'le professeur', 'der Lehrer'],
      ['the student (m)', 'el estudiante', "l'étudiant", 'der Schüler'],
      ['the classroom', 'el aula', 'la salle de classe', 'das Klassenzimmer'],
      ['the timetable', 'el horario', "l'emploi du temps", 'der Stundenplan'],
      ['the homework', 'los deberes', 'les devoirs', 'die Hausaufgaben'],
      ['the exam', 'el examen', "l'examen", 'die Prüfung'],
      ['the mark / grade', 'la nota', 'la note', 'die Note'],
      ['the book', 'el libro', 'le livre', 'das Buch'],
      ['the pen', 'el bolígrafo', 'le stylo', 'der Kugelschreiber'],
      ['the pencil', 'el lápiz', 'le crayon', 'der Bleistift'],
      ['the notebook', 'el cuaderno', 'le cahier', 'das Heft'],
      ['the bag', 'la mochila', 'le sac', 'die Tasche'],
      ['the library', 'la biblioteca', 'la bibliothèque', 'die Bibliothek'],
      ['the playground', 'el patio', 'la cour', 'der Schulhof'],
      ['the lesson', 'la clase', 'le cours', 'die Stunde'],
      ['the break', 'el recreo', 'la récréation', 'die Pause'],
      ['to learn', 'aprender', 'apprendre', 'lernen'],
      ['to study', 'estudiar', 'étudier', 'studieren'],
      ['to write', 'escribir', 'écrire', 'schreiben'],
      ['to read', 'leer', 'lire', 'lesen'],
      ['difficult', 'difícil', 'difficile', 'schwierig'],
      ['easy', 'fácil', 'facile', 'einfach'],
    ] },
    { id: 'family', name: 'Family', words: [
      ['the family', 'la familia', 'la famille', 'die Familie'],
      ['the mother', 'la madre', 'la mère', 'die Mutter'],
      ['the father', 'el padre', 'le père', 'der Vater'],
      ['the sister', 'la hermana', 'la sœur', 'die Schwester'],
      ['the brother', 'el hermano', 'le frère', 'der Bruder'],
      ['the daughter', 'la hija', 'la fille', 'die Tochter'],
      ['the son', 'el hijo', 'le fils', 'der Sohn'],
      ['the grandmother', 'la abuela', 'la grand-mère', 'die Großmutter'],
      ['the grandfather', 'el abuelo', 'le grand-père', 'der Großvater'],
      ['the aunt', 'la tía', 'la tante', 'die Tante'],
      ['the uncle', 'el tío', "l'oncle", 'der Onkel'],
      ['the cousin (f)', 'la prima', 'la cousine', 'die Cousine'],
      ['the friend (m)', 'el amigo', "l'ami", 'der Freund'],
      ['the neighbour (m)', 'el vecino', 'le voisin', 'der Nachbar'],
      ['the child', 'el niño', "l'enfant", 'das Kind'],
      ['married', 'casado', 'marié', 'verheiratet'],
      ['older', 'mayor', 'plus âgé', 'älter'],
      ['younger', 'menor', 'plus jeune', 'jünger'],
      ['to love', 'querer', 'aimer', 'lieben'],
      ['to live', 'vivir', 'habiter', 'wohnen'],
    ] },
    { id: 'food', name: 'Food and drink', words: [
      ['the bread', 'el pan', 'le pain', 'das Brot'],
      ['the cheese', 'el queso', 'le fromage', 'der Käse'],
      ['the milk', 'la leche', 'le lait', 'die Milch'],
      ['the water', 'el agua', "l'eau", 'das Wasser'],
      ['the meat', 'la carne', 'la viande', 'das Fleisch'],
      ['the fish', 'el pescado', 'le poisson', 'der Fisch'],
      ['the chicken', 'el pollo', 'le poulet', 'das Hähnchen'],
      ['the egg', 'el huevo', "l'œuf", 'das Ei'],
      ['the apple', 'la manzana', 'la pomme', 'der Apfel'],
      ['the orange', 'la naranja', "l'orange", 'die Orange'],
      ['the vegetable', 'la verdura', 'le légume', 'das Gemüse'],
      ['the rice', 'el arroz', 'le riz', 'der Reis'],
      ['the sugar', 'el azúcar', 'le sucre', 'der Zucker'],
      ['the breakfast', 'el desayuno', 'le petit-déjeuner', 'das Frühstück'],
      ['the lunch', 'la comida', 'le déjeuner', 'das Mittagessen'],
      ['the dinner', 'la cena', 'le dîner', 'das Abendessen'],
      ['to eat', 'comer', 'manger', 'essen'],
      ['to drink', 'beber', 'boire', 'trinken'],
      ['delicious', 'delicioso', 'délicieux', 'lecker'],
      ['to be hungry', 'tener hambre', 'avoir faim', 'Hunger haben'],
    ] },
    { id: 'home', name: 'House and home', words: [
      ['the house', 'la casa', 'la maison', 'das Haus'],
      ['the flat', 'el piso', "l'appartement", 'die Wohnung'],
      ['the bedroom', 'el dormitorio', 'la chambre', 'das Schlafzimmer'],
      ['the kitchen', 'la cocina', 'la cuisine', 'die Küche'],
      ['the bathroom', 'el baño', 'la salle de bains', 'das Badezimmer'],
      ['the living room', 'el salón', 'le salon', 'das Wohnzimmer'],
      ['the garden', 'el jardín', 'le jardin', 'der Garten'],
      ['the door', 'la puerta', 'la porte', 'die Tür'],
      ['the window', 'la ventana', 'la fenêtre', 'das Fenster'],
      ['the table', 'la mesa', 'la table', 'der Tisch'],
      ['the chair', 'la silla', 'la chaise', 'der Stuhl'],
      ['the bed', 'la cama', 'le lit', 'das Bett'],
      ['the storey / floor', 'la planta', "l'étage", 'die Etage'],
      ['the key', 'la llave', 'la clé', 'der Schlüssel'],
      ['the wall', 'la pared', 'le mur', 'die Wand'],
      ['upstairs', 'arriba', 'en haut', 'oben'],
      ['downstairs', 'abajo', 'en bas', 'unten'],
      ['to tidy', 'ordenar', 'ranger', 'aufräumen'],
      ['to sleep', 'dormir', 'dormir', 'schlafen'],
      ['comfortable', 'cómodo', 'confortable', 'bequem'],
    ] },
    { id: 'time', name: 'Time and numbers', words: [
      ['today', 'hoy', "aujourd'hui", 'heute'],
      ['tomorrow', 'mañana', 'demain', 'morgen'],
      ['yesterday', 'ayer', 'hier', 'gestern'],
      ['the week', 'la semana', 'la semaine', 'die Woche'],
      ['the month', 'el mes', 'le mois', 'der Monat'],
      ['the year', 'el año', "l'année", 'das Jahr'],
      ['Monday', 'lunes', 'lundi', 'Montag'],
      ['Saturday', 'sábado', 'samedi', 'Samstag'],
      ['the morning', 'la mañana', 'le matin', 'der Morgen'],
      ['the afternoon', 'la tarde', "l'après-midi", 'der Nachmittag'],
      ['the night', 'la noche', 'la nuit', 'die Nacht'],
      ['early', 'temprano', 'tôt', 'früh'],
      ['late', 'tarde', 'tard', 'spät'],
      ['always', 'siempre', 'toujours', 'immer'],
      ['never', 'nunca', 'jamais', 'nie'],
      ['sometimes', 'a veces', 'parfois', 'manchmal'],
      ['one', 'uno', 'un', 'eins'],
      ['ten', 'diez', 'dix', 'zehn'],
      ['twenty', 'veinte', 'vingt', 'zwanzig'],
      ['a hundred', 'cien', 'cent', 'hundert'],
    ] },
    { id: 'places', name: 'Town and travel', words: [
      ['the town / city', 'la ciudad', 'la ville', 'die Stadt'],
      ['the village', 'el pueblo', 'le village', 'das Dorf'],
      ['the street', 'la calle', 'la rue', 'die Straße'],
      ['the shop', 'la tienda', 'le magasin', 'das Geschäft'],
      ['the market', 'el mercado', 'le marché', 'der Markt'],
      ['the station', 'la estación', 'la gare', 'der Bahnhof'],
      ['the airport', 'el aeropuerto', "l'aéroport", 'der Flughafen'],
      ['the beach', 'la playa', 'la plage', 'der Strand'],
      ['the church', 'la iglesia', "l'église", 'die Kirche'],
      ['the hospital', 'el hospital', "l'hôpital", 'das Krankenhaus'],
      ['the car', 'el coche', 'la voiture', 'das Auto'],
      ['the train', 'el tren', 'le train', 'der Zug'],
      ['the bus', 'el autobús', 'le bus', 'der Bus'],
      ['the bike', 'la bicicleta', 'le vélo', 'das Fahrrad'],
      ['the journey', 'el viaje', 'le voyage', 'die Reise'],
      ['on the left', 'a la izquierda', 'à gauche', 'links'],
      ['on the right', 'a la derecha', 'à droite', 'rechts'],
      ['straight on', 'todo recto', 'tout droit', 'geradeaus'],
      ['near', 'cerca', 'près', 'nah'],
      ['far', 'lejos', 'loin', 'weit'],
    ] },
    { id: 'body', name: 'Body and health', words: [
      ['the head', 'la cabeza', 'la tête', 'der Kopf'],
      ['the hand', 'la mano', 'la main', 'die Hand'],
      ['the arm', 'el brazo', 'le bras', 'der Arm'],
      ['the leg', 'la pierna', 'la jambe', 'das Bein'],
      ['the foot', 'el pie', 'le pied', 'der Fuß'],
      ['the eye', 'el ojo', "l'œil", 'das Auge'],
      ['the mouth', 'la boca', 'la bouche', 'der Mund'],
      ['the hair', 'el pelo', 'les cheveux', 'die Haare'],
      ['the heart', 'el corazón', 'le cœur', 'das Herz'],
      ['the doctor', 'el médico', 'le médecin', 'der Arzt'],
      ['the chemist', 'la farmacia', 'la pharmacie', 'die Apotheke'],
      ['ill', 'enfermo', 'malade', 'krank'],
      ['tired', 'cansado', 'fatigué', 'müde'],
      ['it hurts', 'me duele', "j'ai mal", 'es tut weh'],
      ['healthy', 'sano', 'en bonne santé', 'gesund'],
      ['to rest', 'descansar', 'se reposer', 'sich ausruhen'],
    ] },
    { id: 'clothes', name: 'Clothes and colours', words: [
      ['the shirt', 'la camisa', 'la chemise', 'das Hemd'],
      ['the trousers', 'los pantalones', 'le pantalon', 'die Hose'],
      ['the dress', 'el vestido', 'la robe', 'das Kleid'],
      ['the skirt', 'la falda', 'la jupe', 'der Rock'],
      ['the coat', 'el abrigo', 'le manteau', 'der Mantel'],
      ['the shoes', 'los zapatos', 'les chaussures', 'die Schuhe'],
      ['the hat', 'el sombrero', 'le chapeau', 'der Hut'],
      ['red', 'rojo', 'rouge', 'rot'],
      ['blue', 'azul', 'bleu', 'blau'],
      ['green', 'verde', 'vert', 'grün'],
      ['yellow', 'amarillo', 'jaune', 'gelb'],
      ['black', 'negro', 'noir', 'schwarz'],
      ['white', 'blanco', 'blanc', 'weiß'],
      ['to wear', 'llevar', 'porter', 'tragen'],
      ['to buy', 'comprar', 'acheter', 'kaufen'],
      ['expensive', 'caro', 'cher', 'teuer'],
    ] },
    { id: 'weather', name: 'Weather and seasons', words: [
      ['the weather', 'el tiempo', 'le temps', 'das Wetter'],
      ['it is hot', 'hace calor', 'il fait chaud', 'es ist heiß'],
      ['it is cold', 'hace frío', 'il fait froid', 'es ist kalt'],
      ['it is raining', 'llueve', 'il pleut', 'es regnet'],
      ['it is snowing', 'nieva', 'il neige', 'es schneit'],
      ['it is windy', 'hace viento', 'il y a du vent', 'es ist windig'],
      ['the sun', 'el sol', 'le soleil', 'die Sonne'],
      ['the rain', 'la lluvia', 'la pluie', 'der Regen'],
      ['the snow', 'la nieve', 'la neige', 'der Schnee'],
      ['the cloud', 'la nube', 'le nuage', 'die Wolke'],
      ['the storm', 'la tormenta', "l'orage", 'das Gewitter'],
      ['spring', 'la primavera', 'le printemps', 'der Frühling'],
      ['summer', 'el verano', "l'été", 'der Sommer'],
      ['autumn', 'el otoño', "l'automne", 'der Herbst'],
      ['winter', 'el invierno', "l'hiver", 'der Winter'],
    ] },
    { id: 'hobbies', name: 'Free time', words: [
      ['the film', 'la película', 'le film', 'der Film'],
      ['the music', 'la música', 'la musique', 'die Musik'],
      ['the song', 'la canción', 'la chanson', 'das Lied'],
      ['the game', 'el juego', 'le jeu', 'das Spiel'],
      // German uses das Spiel for a match too; der Wettkampf keeps the two
      // options distinct so multiple choice still has one right answer.
      ['the match', 'el partido', 'le match', 'der Wettkampf'],
      ['the team', 'el equipo', "l'équipe", 'die Mannschaft'],
      ['swimming', 'la natación', 'la natation', 'das Schwimmen'],
      ['to play (sport)', 'jugar', 'jouer', 'spielen'],
      ['to sing', 'cantar', 'chanter', 'singen'],
      ['to dance', 'bailar', 'danser', 'tanzen'],
      ['to run', 'correr', 'courir', 'laufen'],
      ['to watch', 'ver', 'regarder', 'schauen'],
      ['to listen', 'escuchar', 'écouter', 'hören'],
      ['to go out', 'salir', 'sortir', 'ausgehen'],
      ['to travel', 'viajar', 'voyager', 'reisen'],
      ['funny', 'divertido', 'amusant', 'lustig'],
    ] },
    { id: 'people', name: 'Describing people', words: [
      ['tall', 'alto', 'grand', 'groß'],
      ['short', 'bajo', 'petit', 'klein'],
      ['thin', 'delgado', 'mince', 'schlank'],
      ['strong', 'fuerte', 'fort', 'stark'],
      ['kind', 'amable', 'gentil', 'freundlich'],
      ['clever', 'inteligente', 'intelligent', 'klug'],
      ['lazy', 'perezoso', 'paresseux', 'faul'],
      ['hard-working', 'trabajador', 'travailleur', 'fleißig'],
      ['shy', 'tímido', 'timide', 'schüchtern'],
      ['happy', 'feliz', 'heureux', 'glücklich'],
      ['sad', 'triste', 'triste', 'traurig'],
      ['angry', 'enfadado', 'fâché', 'wütend'],
      ['nice', 'simpático', 'sympa', 'nett'],
      ['annoying', 'pesado', 'pénible', 'nervig'],
      ['honest', 'honesto', 'honnête', 'ehrlich'],
      ['generous', 'generoso', 'généreux', 'großzügig'],
    ] },
    { id: 'core', name: 'Everyday verbs', words: [
      ['to be', 'ser', 'être', 'sein'],
      ['to have', 'tener', 'avoir', 'haben'],
      ['to do / make', 'hacer', 'faire', 'machen'],
      ['to go', 'ir', 'aller', 'gehen'],
      ['to say', 'decir', 'dire', 'sagen'],
      ['to be able to', 'poder', 'pouvoir', 'können'],
      ['to want', 'querer', 'vouloir', 'wollen'],
      ['to know (a fact)', 'saber', 'savoir', 'wissen'],
      ['to see', 'ver', 'voir', 'sehen'],
      ['to come', 'venir', 'venir', 'kommen'],
      ['to give', 'dar', 'donner', 'geben'],
      ['to take', 'tomar', 'prendre', 'nehmen'],
      ['to speak', 'hablar', 'parler', 'sprechen'],
      ['to think', 'pensar', 'penser', 'denken'],
      ['to leave', 'salir', 'partir', 'weggehen'],
      ['to arrive', 'llegar', 'arriver', 'ankommen'],
      ['to open', 'abrir', 'ouvrir', 'öffnen'],
      ['to close', 'cerrar', 'fermer', 'schließen'],
      ['to find', 'encontrar', 'trouver', 'finden'],
      ['to lose', 'perder', 'perdre', 'verlieren'],
    ] },
  ];

  /* Verbs the drill picks from. Chosen so the awkward patterns come up often:
     stem changes, irregular yo forms, and both French -ir families. */
  var DRILL_VERBS = {
    es: ['hablar', 'comer', 'vivir', 'poder', 'querer', 'pedir', 'dormir', 'tener',
      'venir', 'hacer', 'decir', 'ser', 'ir', 'estar', 'pensar', 'volver', 'jugar',
      'salir', 'conocer', 'empezar', 'perder', 'encontrar', 'sentir', 'cerrar'],
    fr: ['parler', 'finir', 'vendre', 'partir', 'dormir', 'sortir', 'ouvrir',
      'être', 'avoir', 'aller', 'faire', 'pouvoir', 'vouloir', 'devoir', 'venir',
      'prendre', 'dire', 'voir', 'savoir', 'mettre', 'choisir', 'attendre'],
    /* German picks for the same reason: the vowel-changing present (fahren,
       geben, lesen), the linking -e- (arbeiten, finden), the sein/haben split
       in the Perfekt, and a separable verb so the prefix moving to the end of
       the clause is something you get asked about rather than told. */
    de: ['machen', 'arbeiten', 'wohnen', 'sein', 'haben', 'werden', 'gehen',
      'kommen', 'fahren', 'geben', 'nehmen', 'sehen', 'lesen', 'essen', 'sprechen',
      'helfen', 'schlafen', 'laufen', 'finden', 'trinken', 'bleiben', 'schreiben',
      'können', 'wollen', 'wissen', 'denken', 'bringen', 'aufstehen', 'einkaufen',
      'fernsehen', 'anfangen'],
  };

  // ── storage ───────────────────────────────────────────────────────────────
  function defaults() {
    return { lang: 'es', mode: 'choice', theme: 'school', box: {}, stats: { seen: 0, right: 0, streak: 0, best: 0 } };
  }
  function read() {
    try {
      var raw = typeof window.load === 'function'
        ? window.load(LS_KEY, null)
        : JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaults();
      var d = defaults();
      return {
        lang: raw.lang === 'fr' ? 'fr' : raw.lang === 'de' ? 'de' : 'es',
        mode: ['flash', 'choice', 'type', 'drill'].indexOf(raw.mode) >= 0 ? raw.mode : d.mode,
        theme: THEMES.some(function (t) { return t.id === raw.theme; }) ? raw.theme : d.theme,
        box: raw.box && typeof raw.box === 'object' ? raw.box : {},
        stats: raw.stats && typeof raw.stats === 'object' ? Object.assign(d.stats, raw.stats) : d.stats,
      };
    } catch (e) { return defaults(); }
  }
  /* Read on every use rather than once at load. The module evaluates before
     sign-in, so a value captured here would be the signed-out one for the rest
     of the session — the stale-namespace trap this codebase has hit before. */
  var state = read();
  function refresh() { state = read(); return state; }
  function persist() {
    try {
      if (typeof window.save === 'function') window.save(LS_KEY, state);
      else localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
    try { if (typeof window.syncKey === 'function') window.syncKey('langPractice', state); } catch (e) {}
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }
  function col(lang) { return lang === 'fr' ? 2 : lang === 'de' ? 3 : 1; }
  function key(lang, themeId, i) { return lang + ':' + themeId + ':' + i; }

  /** Strip accents and punctuation for comparison. */
  function bare(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, "'")
      .replace(/[^a-z' ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  /* An article is worth knowing but not worth failing someone over when they
     have clearly got the word. Marked right, and told about it. */
  function stripArticle(s) {
    return bare(s)
      .replace(/^(el|la|los|las|un|una|le|les|une|der|die|das|den|dem|ein|eine|einen)\s+/, '')
      .replace(/^l'/, '').trim();
  }

  function judge(given, expected) {
    var g = bare(given), e = bare(expected);
    if (!g) return { ok: false, note: '' };
    if (g === e) {
      // Right letters — did they get the accents too?
      return { ok: true, note: given.trim().toLowerCase() === expected.toLowerCase() ? '' : 'Accents: ' + expected };
    }
    var ga = stripArticle(g), ea = stripArticle(e);
    if (ga && ga === ea) return { ok: true, note: 'Nearly — it takes an article: ' + expected };
    return { ok: false, note: '' };
  }

  // ── picking ───────────────────────────────────────────────────────────────
  function boxOf(k) { var b = state.box[k]; return typeof b === 'number' ? b : 0; }

  /** Lowest Leitner box first, ties broken at random. */
  function pickWord() {
    var t = themeById(state.theme);
    var pool = t.words.map(function (w, i) { return { i: i, w: w, b: boxOf(key(state.lang, t.id, i)) }; });
    var min = pool.reduce(function (m, x) { return Math.min(m, x.b); }, BOXES);
    var due = pool.filter(function (x) { return x.b === min; });
    var pick = due[Math.floor(Math.random() * due.length)];
    return { theme: t, index: pick.i, row: pick.w };
  }

  function pickDrill() {
    var E = window.FluxLangEngine;
    if (!E) return null;
    var verbs = DRILL_VERBS[state.lang];
    var tenses = E.tenses(state.lang);
    for (var attempt = 0; attempt < 12; attempt++) {
      var verb = verbs[Math.floor(Math.random() * verbs.length)];
      var tense = tenses[Math.floor(Math.random() * tenses.length)];
      var person = Math.floor(Math.random() * 6);
      try {
        var r = E.conjugate(state.lang, verb, tense.id);
        return {
          verb: verb, tense: tense, person: person,
          answer: r.forms[person], pronoun: r.pronouns[person], note: r.note,
        };
      } catch (e) { /* try another */ }
    }
    return null;
  }

  function score(k, right) {
    state.stats.seen++;
    if (right) {
      state.stats.right++;
      state.stats.streak++;
      if (state.stats.streak > state.stats.best) state.stats.best = state.stats.streak;
      if (k) state.box[k] = Math.min(BOXES - 1, boxOf(k) + 1);
    } else {
      state.stats.streak = 0;
      // Straight back to the bottom: a word you just got wrong is not "nearly".
      if (k) state.box[k] = 0;
    }
    persist();
  }

  // ── render ────────────────────────────────────────────────────────────────
  var current = null;      // the question on screen
  var revealed = false;

  function langName() { return state.lang === 'fr' ? 'French' : state.lang === 'de' ? 'German' : 'Spanish'; }

  /* Which language the card is pinned to, or null for the old free-choice
     card. French, German and Spanish are separate subjects now, so a language
     switcher inside the Spanish subject would be a second way to answer a
     question the rail has already answered — and the confusing kind, because
     the pill would still say Spanish. */
  var locked = null;

  function statsHtml() {
    var s = state.stats;
    var pct = s.seen ? Math.round((s.right / s.seen) * 100) : 0;
    var t = themeById(state.theme);
    var learned = t.words.reduce(function (n, _, i) {
      return n + (boxOf(key(state.lang, t.id, i)) >= BOXES - 1 ? 1 : 0);
    }, 0);
    return '<div class="flp-stats">'
      + '<span><b>' + s.streak + '</b> streak</span>'
      + '<span><b>' + s.best + '</b> best</span>'
      + '<span><b>' + pct + '%</b> right</span>'
      + (state.mode === 'drill' ? '' : '<span><b>' + learned + '/' + t.words.length + '</b> mastered</span>')
      + '</div>';
  }

  function shellHtml(inner) {
    var modes = [['choice', 'Multiple choice'], ['type', 'Type it'], ['flash', 'Flashcards'], ['drill', 'Verb drill']];
    var langSeg = locked ? '' : '<div class="fsh-seg flp-seg" id="flpLang">'
      + [['es', 'Spanish'], ['fr', 'French'], ['de', 'German']].map(function (l) {
        return '<button type="button" data-l="' + l[0] + '" class="' + (state.lang === l[0] ? 'active' : '') + '">' + l[1] + '</button>';
      }).join('') + '</div>';
    return '<div class="fsh-card flp-card" style="padding:20px">'
      + '<h3 style="margin:0 0 4px;font-size:16px">🎯 Practice</h3>'
      + '<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">'
      + 'Test yourself instead of reading a list. ' + esc(langName()) + ', offline.</p>'
      + langSeg
      + '<div class="fsh-seg flp-seg" id="flpMode">' + modes.map(function (m) {
        return '<button type="button" data-m="' + m[0] + '" class="' + (state.mode === m[0] ? 'active' : '') + '">' + m[1] + '</button>';
      }).join('') + '</div>'
      + (state.mode === 'drill' ? '' : '<div class="flp-themes" id="flpTheme">' + THEMES.map(function (t) {
        return '<button type="button" data-t="' + t.id + '" class="flp-theme' + (state.theme === t.id ? ' active' : '') + '">' + esc(t.name) + '</button>';
      }).join('') + '</div>')
      + statsHtml()
      + '<div class="flp-stage" id="flpStage">' + inner + '</div>'
      + '<button type="button" class="flp-reset" id="flpReset">Reset progress for this deck</button>'
      + '</div>';
  }

  function questionHtml() {
    if (state.mode === 'drill') {
      if (!current) return '<div class="flp-empty">Conjugation tables still loading — try again in a moment.</div>';
      return '<div class="flp-q"><div class="flp-prompt">' + esc(current.verb) + '</div>'
        + '<div class="flp-hint">' + esc(current.tense.name) + ' · <b>' + esc(current.pronoun) + '</b></div></div>'
        + '<div class="flp-answer"><input id="flpIn" class="flp-in" type="text" autocomplete="off" autocapitalize="off" '
        + 'autocorrect="off" spellcheck="false" placeholder="Type the form" aria-label="Your answer">'
        + '<button type="button" class="fsh-btn" id="flpGo">Check</button></div>'
        + '<div class="flp-feedback" id="flpFb"></div>';
    }

    var ask = current.row[0];
    var answer = current.row[col(state.lang)];

    if (state.mode === 'flash') {
      return '<div class="flp-q"><div class="flp-prompt">' + esc(ask) + '</div>'
        + '<div class="flp-flip' + (revealed ? ' is-shown' : '') + '">' + (revealed ? esc(answer) : 'Hidden') + '</div></div>'
        + (revealed
          ? '<div class="flp-answer"><button type="button" class="fsh-btn ghost" id="flpNo">Didn\'t know</button>'
            + '<button type="button" class="fsh-btn" id="flpYes">Knew it</button></div>'
          : '<div class="flp-answer"><button type="button" class="fsh-btn" id="flpReveal">Show answer</button></div>');
    }

    if (state.mode === 'choice') {
      return '<div class="flp-q"><div class="flp-prompt">' + esc(ask) + '</div>'
        + '<div class="flp-hint">Which is ' + esc(langName()) + ' for this?</div></div>'
        + '<div class="flp-options">' + current.options.map(function (o, i) {
          return '<button type="button" class="flp-opt" data-o="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>'
        + '<div class="flp-feedback" id="flpFb"></div>';
    }

    return '<div class="flp-q"><div class="flp-prompt">' + esc(ask) + '</div>'
      + '<div class="flp-hint">Write it in ' + esc(langName()) + '</div></div>'
      + '<div class="flp-answer"><input id="flpIn" class="flp-in" type="text" autocomplete="off" autocapitalize="off" '
      + 'autocorrect="off" spellcheck="false" placeholder="Your answer" aria-label="Your answer">'
      + '<button type="button" class="fsh-btn" id="flpGo">Check</button></div>'
      + '<div class="flp-feedback" id="flpFb"></div>';
  }

  function nextQuestion() {
    revealed = false;
    if (state.mode === 'drill') { current = pickDrill(); return; }
    var picked = pickWord();
    var answer = picked.row[col(state.lang)];
    if (state.mode === 'choice') {
      /* Distractors come from the same theme, so "the kitchen" competes with
         "the bathroom" rather than with a number. Four plausible options is a
         test; one real answer among three absurd ones is not. */
      var others = picked.theme.words
        .filter(function (w, i) { return i !== picked.index; })
        .map(function (w) { return w[col(state.lang)]; })
        .filter(function (w) { return w !== answer; });
      var pool = [];
      while (pool.length < 3 && others.length) {
        pool.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
      }
      var opts = pool.concat([answer]);
      for (var i = opts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp;
      }
      picked.options = opts;
      picked.correct = opts.indexOf(answer);
    }
    current = picked;
  }

  function paint() {
    var host = document.getElementById('fluxLangPractice');
    if (!host) return;
    host.innerHTML = shellHtml(questionHtml());
    var inp = document.getElementById('flpIn');
    if (inp) { try { inp.focus(); } catch (e) {} }
  }

  function render(body) {
    refresh();
    /* refresh() has just overwritten state.lang with whatever was saved, so
       the pin has to be re-applied after it — not before, or opening German
       would show German once and Spanish on every repaint.

       Written back straight away rather than waiting for the first answer:
       everything else in this module re-reads from storage (see the header on
       why), so leaving memory and storage disagreeing means the very next
       read pulls the language of whichever subject you were in last. */
    if (locked && state.lang !== locked) { state.lang = locked; persist(); }
    body.innerHTML = '<div id="fluxLangPractice"></div>';
    nextQuestion();
    paint();
  }
  /** A render function pinned to one language, for a per-language subject. */
  function renderIn(lang) {
    return function (body) { locked = lang; render(body); };
  }

  // ── answering ─────────────────────────────────────────────────────────────
  function feedback(ok, right, note) {
    var fb = document.getElementById('flpFb');
    if (!fb) { nextQuestion(); paint(); return; }
    fb.className = 'flp-feedback ' + (ok ? 'is-ok' : 'is-no');
    fb.innerHTML = ok
      ? '<b>Correct</b>' + (note ? ' · ' + esc(note) : '')
      : '<b>Not quite</b> · ' + esc(right);
    // Long enough to read the answer, short enough not to feel like a penalty.
    setTimeout(function () { nextQuestion(); paint(); }, ok && !note ? 550 : 1600);
  }

  function answerTyped() {
    var inp = document.getElementById('flpIn');
    if (!inp) return;
    var given = inp.value;
    if (!bare(given)) return;
    if (state.mode === 'drill') {
      if (!current) return;
      var v = judge(given, current.answer);
      score(null, v.ok);
      feedback(v.ok, current.pronoun + ' ' + current.answer, v.note || (v.ok ? current.note : ''));
      return;
    }
    var answer = current.row[col(state.lang)];
    var res = judge(given, answer);
    score(key(state.lang, current.theme.id, current.index), res.ok);
    feedback(res.ok, answer, res.note);
  }

  function answerChoice(i) {
    var ok = i === current.correct;
    var answer = current.row[col(state.lang)];
    score(key(state.lang, current.theme.id, current.index), ok);
    var btns = document.querySelectorAll('#fluxLangPractice .flp-opt');
    for (var n = 0; n < btns.length; n++) {
      if (n === current.correct) btns[n].classList.add('is-right');
      else if (n === i) btns[n].classList.add('is-wrong');
      btns[n].disabled = true;
    }
    feedback(ok, answer, '');
  }

  function onClick(e) {
    var host = document.getElementById('fluxLangPractice');
    if (!host || !e.target || !e.target.closest || !host.contains(e.target)) return;
    var b = e.target.closest('button');
    if (!b) return;

    if (b.hasAttribute('data-l')) { state.lang = b.getAttribute('data-l'); persist(); nextQuestion(); paint(); return; }
    if (b.hasAttribute('data-m')) { state.mode = b.getAttribute('data-m'); persist(); nextQuestion(); paint(); return; }
    if (b.hasAttribute('data-t')) { state.theme = b.getAttribute('data-t'); persist(); nextQuestion(); paint(); return; }
    if (b.id === 'flpReveal') { revealed = true; paint(); return; }
    if (b.id === 'flpYes' || b.id === 'flpNo') {
      score(key(state.lang, current.theme.id, current.index), b.id === 'flpYes');
      nextQuestion(); paint(); return;
    }
    if (b.id === 'flpGo') { answerTyped(); return; }
    if (b.classList.contains('flp-opt')) { answerChoice(parseInt(b.getAttribute('data-o'), 10)); return; }
    if (b.id === 'flpReset') {
      var t = themeById(state.theme);
      var prefix = state.lang + ':' + t.id + ':';
      Object.keys(state.box).forEach(function (k) { if (k.indexOf(prefix) === 0) delete state.box[k]; });
      persist(); nextQuestion(); paint();
    }
  }

  function onKey(e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (!t || t.id !== 'flpIn') return;
    e.preventDefault();
    answerTyped();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  // ── registration ──────────────────────────────────────────────────────────
  function boot() {
    var H = window.fluxStudyHub;
    if (!H || !H.register) return setTimeout(boot, 60);
    /* One card, three subjects. Registering the same tool three times with a
       different pinned language is cheaper and less fragile than three copies
       of it, and it means a fix to the marking reaches all three at once. */
    [['french', 'fr', 'french'], ['german', 'de', 'german'], ['spanish', 'es', 'spanish']]
      .forEach(function (s) {
        H.register(s[0], [{
          id: 'practice',
          name: 'Practice',
          icon: '🎯',
          desc: 'practice quiz vocabulary drill ' + s[2] + ' test yourself flashcards conjugation',
          render: renderIn(s[1]),
        }]);
      });
  }
  boot();

  window.FluxLangPractice = {
    themes: function () { return THEMES.map(function (t) { return { id: t.id, name: t.name, count: t.words.length }; }); },
    words: function (themeId) { return themeById(themeId).words.map(function (w) { return w.slice(); }); },
    judge: judge,
    getCloudSlice: function () { return refresh(); },
    applyFromCloud: function (data) {
      if (!data || typeof data !== 'object') return;
      /* Merge the boxes rather than replacing them. Two devices used the same
         day should add up to more revision, not overwrite each other — and the
         higher box is the one backed by evidence of actually knowing it. */
      refresh();
      var incoming = data.box && typeof data.box === 'object' ? data.box : {};
      Object.keys(incoming).forEach(function (k) {
        if (typeof incoming[k] === 'number') state.box[k] = Math.max(boxOf(k), incoming[k]);
      });
      if (data.stats && typeof data.stats === 'object') {
        state.stats.seen = Math.max(state.stats.seen, data.stats.seen || 0);
        state.stats.right = Math.max(state.stats.right, data.stats.right || 0);
        state.stats.best = Math.max(state.stats.best, data.stats.best || 0);
      }
      if (data.lang === 'fr' || data.lang === 'es') state.lang = data.lang;
      try {
        if (typeof window.save === 'function') window.save(LS_KEY, state);
        else localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch (e) {}
      paint();
    },
    // Test seams.
    _state: function () { return JSON.parse(JSON.stringify(refresh())); },
    _next: function () { refresh(); nextQuestion(); paint(); return current; },
    _current: function () { return current; },
  };
})();
