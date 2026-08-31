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

   ONE TABLE, TWO LANGUAGES
   ------------------------
   Each row is [English, Spanish, French]. Keeping both languages on the same
   row is not a space trick: two separate decks drift, and a student taking
   both then gets "the timetable" in one and something subtly different in the
   other. One row, one meaning.

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
      ['the teacher (m)', 'el profesor', 'le professeur'],
      ['the student (m)', 'el estudiante', "l'étudiant"],
      ['the classroom', 'el aula', 'la salle de classe'],
      ['the timetable', 'el horario', "l'emploi du temps"],
      ['the homework', 'los deberes', 'les devoirs'],
      ['the exam', 'el examen', "l'examen"],
      ['the mark / grade', 'la nota', 'la note'],
      ['the book', 'el libro', 'le livre'],
      ['the pen', 'el bolígrafo', 'le stylo'],
      ['the pencil', 'el lápiz', 'le crayon'],
      ['the notebook', 'el cuaderno', 'le cahier'],
      ['the bag', 'la mochila', 'le sac'],
      ['the library', 'la biblioteca', 'la bibliothèque'],
      ['the playground', 'el patio', 'la cour'],
      ['the lesson', 'la clase', 'le cours'],
      ['the break', 'el recreo', 'la récréation'],
      ['to learn', 'aprender', 'apprendre'],
      ['to study', 'estudiar', 'étudier'],
      ['to write', 'escribir', 'écrire'],
      ['to read', 'leer', 'lire'],
      ['difficult', 'difícil', 'difficile'],
      ['easy', 'fácil', 'facile'],
    ] },
    { id: 'family', name: 'Family', words: [
      ['the family', 'la familia', 'la famille'],
      ['the mother', 'la madre', 'la mère'],
      ['the father', 'el padre', 'le père'],
      ['the sister', 'la hermana', 'la sœur'],
      ['the brother', 'el hermano', 'le frère'],
      ['the daughter', 'la hija', 'la fille'],
      ['the son', 'el hijo', 'le fils'],
      ['the grandmother', 'la abuela', 'la grand-mère'],
      ['the grandfather', 'el abuelo', 'le grand-père'],
      ['the aunt', 'la tía', 'la tante'],
      ['the uncle', 'el tío', "l'oncle"],
      ['the cousin (f)', 'la prima', 'la cousine'],
      ['the friend (m)', 'el amigo', "l'ami"],
      ['the neighbour (m)', 'el vecino', 'le voisin'],
      ['the child', 'el niño', "l'enfant"],
      ['married', 'casado', 'marié'],
      ['older', 'mayor', 'plus âgé'],
      ['younger', 'menor', 'plus jeune'],
      ['to love', 'querer', 'aimer'],
      ['to live', 'vivir', 'habiter'],
    ] },
    { id: 'food', name: 'Food and drink', words: [
      ['the bread', 'el pan', 'le pain'],
      ['the cheese', 'el queso', 'le fromage'],
      ['the milk', 'la leche', 'le lait'],
      ['the water', 'el agua', "l'eau"],
      ['the meat', 'la carne', 'la viande'],
      ['the fish', 'el pescado', 'le poisson'],
      ['the chicken', 'el pollo', 'le poulet'],
      ['the egg', 'el huevo', "l'œuf"],
      ['the apple', 'la manzana', 'la pomme'],
      ['the orange', 'la naranja', "l'orange"],
      ['the vegetable', 'la verdura', 'le légume'],
      ['the rice', 'el arroz', 'le riz'],
      ['the sugar', 'el azúcar', 'le sucre'],
      ['the breakfast', 'el desayuno', 'le petit-déjeuner'],
      ['the lunch', 'la comida', 'le déjeuner'],
      ['the dinner', 'la cena', 'le dîner'],
      ['to eat', 'comer', 'manger'],
      ['to drink', 'beber', 'boire'],
      ['delicious', 'delicioso', 'délicieux'],
      ['to be hungry', 'tener hambre', 'avoir faim'],
    ] },
    { id: 'home', name: 'House and home', words: [
      ['the house', 'la casa', 'la maison'],
      ['the flat', 'el piso', "l'appartement"],
      ['the bedroom', 'el dormitorio', 'la chambre'],
      ['the kitchen', 'la cocina', 'la cuisine'],
      ['the bathroom', 'el baño', 'la salle de bains'],
      ['the living room', 'el salón', 'le salon'],
      ['the garden', 'el jardín', 'le jardin'],
      ['the door', 'la puerta', 'la porte'],
      ['the window', 'la ventana', 'la fenêtre'],
      ['the table', 'la mesa', 'la table'],
      ['the chair', 'la silla', 'la chaise'],
      ['the bed', 'la cama', 'le lit'],
      ['the storey / floor', 'la planta', "l'étage"],
      ['the key', 'la llave', 'la clé'],
      ['the wall', 'la pared', 'le mur'],
      ['upstairs', 'arriba', 'en haut'],
      ['downstairs', 'abajo', 'en bas'],
      ['to tidy', 'ordenar', 'ranger'],
      ['to sleep', 'dormir', 'dormir'],
      ['comfortable', 'cómodo', 'confortable'],
    ] },
    { id: 'time', name: 'Time and numbers', words: [
      ['today', 'hoy', "aujourd'hui"],
      ['tomorrow', 'mañana', 'demain'],
      ['yesterday', 'ayer', 'hier'],
      ['the week', 'la semana', 'la semaine'],
      ['the month', 'el mes', 'le mois'],
      ['the year', 'el año', "l'année"],
      ['Monday', 'lunes', 'lundi'],
      ['Saturday', 'sábado', 'samedi'],
      ['the morning', 'la mañana', 'le matin'],
      ['the afternoon', 'la tarde', "l'après-midi"],
      ['the night', 'la noche', 'la nuit'],
      ['early', 'temprano', 'tôt'],
      ['late', 'tarde', 'tard'],
      ['always', 'siempre', 'toujours'],
      ['never', 'nunca', 'jamais'],
      ['sometimes', 'a veces', 'parfois'],
      ['one', 'uno', 'un'],
      ['ten', 'diez', 'dix'],
      ['twenty', 'veinte', 'vingt'],
      ['a hundred', 'cien', 'cent'],
    ] },
    { id: 'places', name: 'Town and travel', words: [
      ['the town / city', 'la ciudad', 'la ville'],
      ['the village', 'el pueblo', 'le village'],
      ['the street', 'la calle', 'la rue'],
      ['the shop', 'la tienda', 'le magasin'],
      ['the market', 'el mercado', 'le marché'],
      ['the station', 'la estación', 'la gare'],
      ['the airport', 'el aeropuerto', "l'aéroport"],
      ['the beach', 'la playa', 'la plage'],
      ['the church', 'la iglesia', "l'église"],
      ['the hospital', 'el hospital', "l'hôpital"],
      ['the car', 'el coche', 'la voiture'],
      ['the train', 'el tren', 'le train'],
      ['the bus', 'el autobús', 'le bus'],
      ['the bike', 'la bicicleta', 'le vélo'],
      ['the journey', 'el viaje', 'le voyage'],
      ['on the left', 'a la izquierda', 'à gauche'],
      ['on the right', 'a la derecha', 'à droite'],
      ['straight on', 'todo recto', 'tout droit'],
      ['near', 'cerca', 'près'],
      ['far', 'lejos', 'loin'],
    ] },
    { id: 'body', name: 'Body and health', words: [
      ['the head', 'la cabeza', 'la tête'],
      ['the hand', 'la mano', 'la main'],
      ['the arm', 'el brazo', 'le bras'],
      ['the leg', 'la pierna', 'la jambe'],
      ['the foot', 'el pie', 'le pied'],
      ['the eye', 'el ojo', "l'œil"],
      ['the mouth', 'la boca', 'la bouche'],
      ['the hair', 'el pelo', 'les cheveux'],
      ['the heart', 'el corazón', 'le cœur'],
      ['the doctor', 'el médico', 'le médecin'],
      ['the chemist', 'la farmacia', 'la pharmacie'],
      ['ill', 'enfermo', 'malade'],
      ['tired', 'cansado', 'fatigué'],
      ['it hurts', 'me duele', "j'ai mal"],
      ['healthy', 'sano', 'en bonne santé'],
      ['to rest', 'descansar', 'se reposer'],
    ] },
    { id: 'clothes', name: 'Clothes and colours', words: [
      ['the shirt', 'la camisa', 'la chemise'],
      ['the trousers', 'los pantalones', 'le pantalon'],
      ['the dress', 'el vestido', 'la robe'],
      ['the skirt', 'la falda', 'la jupe'],
      ['the coat', 'el abrigo', 'le manteau'],
      ['the shoes', 'los zapatos', 'les chaussures'],
      ['the hat', 'el sombrero', 'le chapeau'],
      ['red', 'rojo', 'rouge'],
      ['blue', 'azul', 'bleu'],
      ['green', 'verde', 'vert'],
      ['yellow', 'amarillo', 'jaune'],
      ['black', 'negro', 'noir'],
      ['white', 'blanco', 'blanc'],
      ['to wear', 'llevar', 'porter'],
      ['to buy', 'comprar', 'acheter'],
      ['expensive', 'caro', 'cher'],
    ] },
    { id: 'weather', name: 'Weather and seasons', words: [
      ['the weather', 'el tiempo', 'le temps'],
      ['it is hot', 'hace calor', 'il fait chaud'],
      ['it is cold', 'hace frío', 'il fait froid'],
      ['it is raining', 'llueve', 'il pleut'],
      ['it is snowing', 'nieva', 'il neige'],
      ['it is windy', 'hace viento', 'il y a du vent'],
      ['the sun', 'el sol', 'le soleil'],
      ['the rain', 'la lluvia', 'la pluie'],
      ['the snow', 'la nieve', 'la neige'],
      ['the cloud', 'la nube', 'le nuage'],
      ['the storm', 'la tormenta', "l'orage"],
      ['spring', 'la primavera', 'le printemps'],
      ['summer', 'el verano', "l'été"],
      ['autumn', 'el otoño', "l'automne"],
      ['winter', 'el invierno', "l'hiver"],
    ] },
    { id: 'hobbies', name: 'Free time', words: [
      ['the film', 'la película', 'le film'],
      ['the music', 'la música', 'la musique'],
      ['the song', 'la canción', 'la chanson'],
      ['the game', 'el juego', 'le jeu'],
      ['the match', 'el partido', 'le match'],
      ['the team', 'el equipo', "l'équipe"],
      ['swimming', 'la natación', 'la natation'],
      ['to play (sport)', 'jugar', 'jouer'],
      ['to sing', 'cantar', 'chanter'],
      ['to dance', 'bailar', 'danser'],
      ['to run', 'correr', 'courir'],
      ['to watch', 'ver', 'regarder'],
      ['to listen', 'escuchar', 'écouter'],
      ['to go out', 'salir', 'sortir'],
      ['to travel', 'viajar', 'voyager'],
      ['funny', 'divertido', 'amusant'],
    ] },
    { id: 'people', name: 'Describing people', words: [
      ['tall', 'alto', 'grand'],
      ['short', 'bajo', 'petit'],
      ['thin', 'delgado', 'mince'],
      ['strong', 'fuerte', 'fort'],
      ['kind', 'amable', 'gentil'],
      ['clever', 'inteligente', 'intelligent'],
      ['lazy', 'perezoso', 'paresseux'],
      ['hard-working', 'trabajador', 'travailleur'],
      ['shy', 'tímido', 'timide'],
      ['happy', 'feliz', 'heureux'],
      ['sad', 'triste', 'triste'],
      ['angry', 'enfadado', 'fâché'],
      ['nice', 'simpático', 'sympa'],
      ['annoying', 'pesado', 'pénible'],
      ['honest', 'honesto', 'honnête'],
      ['generous', 'generoso', 'généreux'],
    ] },
    { id: 'core', name: 'Everyday verbs', words: [
      ['to be', 'ser', 'être'],
      ['to have', 'tener', 'avoir'],
      ['to do / make', 'hacer', 'faire'],
      ['to go', 'ir', 'aller'],
      ['to say', 'decir', 'dire'],
      ['to be able to', 'poder', 'pouvoir'],
      ['to want', 'querer', 'vouloir'],
      ['to know (a fact)', 'saber', 'savoir'],
      ['to see', 'ver', 'voir'],
      ['to come', 'venir', 'venir'],
      ['to give', 'dar', 'donner'],
      ['to take', 'tomar', 'prendre'],
      ['to speak', 'hablar', 'parler'],
      ['to think', 'pensar', 'penser'],
      ['to leave', 'salir', 'partir'],
      ['to arrive', 'llegar', 'arriver'],
      ['to open', 'abrir', 'ouvrir'],
      ['to close', 'cerrar', 'fermer'],
      ['to find', 'encontrar', 'trouver'],
      ['to lose', 'perder', 'perdre'],
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
        lang: raw.lang === 'fr' ? 'fr' : 'es',
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
  function col(lang) { return lang === 'fr' ? 2 : 1; }
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
    return bare(s).replace(/^(el|la|los|las|un|una|le|les|une)\s+/, '').replace(/^l'/, '').trim();
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

  function langName() { return state.lang === 'fr' ? 'French' : 'Spanish'; }

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
    return '<div class="fsh-card flp-card" style="padding:20px">'
      + '<h3 style="margin:0 0 4px;font-size:16px">🎯 Practice</h3>'
      + '<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">'
      + 'Test yourself instead of reading a list. ' + esc(langName()) + ', offline.</p>'
      + '<div class="fsh-seg flp-seg" id="flpLang"><button type="button" data-l="es" class="' + (state.lang === 'es' ? 'active' : '') + '">Spanish</button>'
      + '<button type="button" data-l="fr" class="' + (state.lang === 'fr' ? 'active' : '') + '">French</button></div>'
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
    body.innerHTML = '<div id="fluxLangPractice"></div>';
    nextQuestion();
    paint();
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
    H.register('languages', [{
      id: 'practice',
      name: 'Practice',
      icon: '🎯',
      desc: 'practice quiz vocabulary drill spanish french test yourself flashcards conjugation',
      render: render,
    }]);
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
