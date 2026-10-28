/* ============================================================================
   FLUX TEACH · LANGUAGES  ·  flux-teach-languages.js
   French B, Spanish B and German B: conjugation in every common tense, both
   directions of vocabulary, and noun genders.

   Nothing here is typed by hand. Verb forms come from Flux Lingo’s conjugator
   (flux-conj.js, checked against Lefff and cross-checked engine to engine),
   vocabulary from the planner’s practice decks (flux-lang-practice.js). If
   either is missing the matching skills are simply not registered.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.FluxTeach, IB = root.FluxIbSyllabus, C = root.FluxConj, V = root.FluxLangPractice;
  if (!T || !IB || root.__fluxTeachLang) return;
  root.__fluxTeachLang = true;

  function U(sid, code) {
    var s = IB.subjects().filter(function (x) { return x.id === sid; })[0];
    var u = s && s.units.filter(function (x) { return x.code === code; })[0];
    if (!u) throw new Error('No unit "' + code + '" in ' + sid);
    return u.id;
  }
  var LANG = {
    fr: { sid: 'french-b', name: 'French', col: 2 },
    es: { sid: 'spanish-b', name: 'Spanish', col: 1 },
    de: { sid: 'german-b', name: 'German', col: 3 },
  };

  /* Which deck serves which IB theme. */
  var THEME_UNITS = { school: 'T4', family: 'T1', food: 'T1', home: 'T4', time: 'T2', places: 'T2', body: 'T1', clothes: 'T1', weather: 'T5', hobbies: 'T2', people: 'T1', core: 'T2' };

  var VERBS = {
    fr: ['être', 'avoir', 'aller', 'faire', 'dire', 'pouvoir', 'vouloir', 'savoir', 'venir', 'voir', 'prendre', 'devoir', 'mettre', 'parler', 'aimer', 'finir', 'choisir', 'vendre', 'attendre', 'partir', 'sortir', 'boire', 'écrire', 'lire', 'manger', 'acheter', 'appeler', 'arriver', 'tomber', 'rester'],
    es: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'decir', 'querer', 'ver', 'dar', 'saber', 'venir', 'poner', 'salir', 'hablar', 'comer', 'vivir', 'pensar', 'dormir', 'pedir', 'volver', 'jugar', 'empezar', 'traer', 'conocer', 'escribir', 'abrir', 'leer', 'sentir', 'seguir'],
  };

  var RULES = {
    fr: {
      present: ['Regular -er: drop -er, add -e, -es, -e, -ons, -ez, -ent.', 'Regular -ir (finir): -is, -is, -it, -issons, -issez, -issent. Regular -re (vendre): -s, -s, (nothing), -ons, -ez, -ent.', 'Learn the irregulars: être, avoir, aller, faire, pouvoir, vouloir, venir, prendre…'],
      passeCompose: ['Auxiliary (avoir or être) in the present + the past participle.', 'Participles: -er → -é, -ir → -i, -re → -u; irregulars include fait, pris, mis, vu, eu, été.', 'être goes with the 17 “DR & MRS VANDERTRAMP” verbs of movement and change and with every reflexive verb; then the participle agrees with the subject (allée, allés, allées).'],
      imperfect: ['Take the nous form of the present and drop -ons (nous finissons → finiss-).', 'Add -ais, -ais, -ait, -ions, -iez, -aient.', 'Only être is irregular: ét-.'],
      future: ['Use the infinitive as the stem (drop the final -e of -re verbs).', 'Add -ai, -as, -a, -ons, -ez, -ont.', 'Irregular stems: ser-, aur-, ir-, fer-, pourr-, voudr-, devr-, viendr-, saur-, verr-, enverr-.'],
      conditional: ['Same stem as the future, regular or irregular.', 'Add the imperfect endings: -ais, -ais, -ait, -ions, -iez, -aient.', 'It means “would”.'],
      subjPresent: ['Take the ils form of the present and drop -ent (ils finissent → finiss-).', 'Add -e, -es, -e, -ions, -iez, -ent; nous and vous use the nous stem of the present.', 'Irregular: être (sois), avoir (aie), aller (aille), faire (fasse), pouvoir (puisse), savoir (sache), vouloir (veuille).'],
    },
    es: {
      present: ['-ar: -o, -as, -a, -amos, -áis, -an. -er: -o, -es, -e, -emos, -éis, -en. -ir: -o, -es, -e, -imos, -ís, -en.', 'Stem-changers (e→ie, o→ue, e→i, u→ue) change in every form except nosotros and vosotros.', 'Irregular yo forms: tengo, hago, pongo, salgo, digo, vengo, traigo, conozco…'],
      preterite: ['-ar: -é, -aste, -ó, -amos, -asteis, -aron. -er/-ir: -í, -iste, -ió, -imos, -isteis, -ieron.', 'Strong stems take -e, -iste, -o, -imos, -isteis, -ieron with no accents: tuv-, estuv-, pud-, pus-, sup-, hic- (hizo), quis-, vin-, dij- (dijeron).', 'ser and ir share one set: fui, fuiste, fue, fuimos, fuisteis, fueron.'],
      imperfect: ['-ar: -aba, -abas, -aba, -ábamos, -abais, -aban.', '-er/-ir: -ía, -ías, -ía, -íamos, -íais, -ían.', 'Only three irregulars: ser (era), ir (iba), ver (veía).'],
      future: ['Whole infinitive + -é, -ás, -á, -emos, -éis, -án.', 'Irregular stems: tendr-, pondr-, saldr-, vendr-, dir-, har-, podr-, querr-, sabr-, habr-, cabr-, valdr-.', 'The endings are the same for every verb.'],
      conditional: ['Same stem as the future.', 'Add -ía, -ías, -ía, -íamos, -íais, -ían.', 'It means “would”.'],
      subjPresent: ['Start from the yo form of the present and drop the -o.', 'Swap the vowel: -ar verbs take -e endings (-e, -es, -e, -emos, -éis, -en); -er/-ir verbs take -a endings.', 'Irregular: ser (sea), ir (vaya), estar (esté), dar (dé), saber (sepa), haber (haya).'],
      perfect: ['haber in the present: he, has, ha, hemos, habéis, han.', 'Past participle: -ar → -ado, -er/-ir → -ido.', 'Irregular participles: hecho, dicho, visto, puesto, escrito, abierto, vuelto, muerto, roto.'],
    },
  };
  var TENSE_NAMES = {
    fr: { present: 'présent', passeCompose: 'passé composé', imperfect: 'imparfait', future: 'futur simple', conditional: 'conditionnel', subjPresent: 'subjonctif présent' },
    es: { present: 'present', preterite: 'preterite', imperfect: 'imperfect', future: 'future', conditional: 'conditional', subjPresent: 'present subjunctive', perfect: 'present perfect' },
  };

  /** Every agreement spelling of a form like "allé(e)(s)": allé, allée, allés, allées. */
  function spellings(f) {
    var parts = String(f).split(/(\([^)]*\))/), out = [''];
    parts.forEach(function (p) {
      if (/^\(.*\)$/.test(p)) { var inner = p.slice(1, -1); out = out.concat(out.map(function (o) { return o + inner; })); }
      else out = out.map(function (o) { return o + p; });
    });
    return out.filter(function (x, i, a) { return a.indexOf(x) === i; });
  }
  function bare(f) { return String(f).replace(/\([^)]*\)/g, ''); }
  function pronoun(lang, i) { return C.persons(lang)[i].split(' / ')[0]; }

  var skills = [];

  if (C && typeof C.conjugate === 'function') {
    ['fr', 'es'].forEach(function (lang) {
      var L = LANG[lang];
      Object.keys(TENSE_NAMES[lang]).forEach(function (t) {
        skills.push({
          id: 'lang-' + lang + '-' + t, units: [U(L.sid, 'P1'), U(L.sid, 'IA')],
          title: L.name + ' verbs: the ' + TENSE_NAMES[lang][t],
          method: RULES[lang][t],
          notes: 'Every form is checked against Flux Lingo’s conjugator. Open Flux Lingo to see any verb’s full table.',
          variants: [0, 1, 2, 3, 4, 5].map(function (person) {
            return { id: 'p' + person, name: pronoun(lang, person), gen: function (r) {
              var verb = r.pick(VERBS[lang]), res;
              try { res = C.conjugate(lang, verb); } catch (e) { return null; }
              var f = res && res.tenses[t] && res.tenses[t][person];
              if (!f) return null;
              var subj = (t === 'subjPresent' ? 'que ' : '') + pronoun(lang, person);
              var accept = spellings(f).concat(((res.alts && res.alts[t] || [])[person] || []).reduce(function (a, x) { return a.concat(spellings(x)); }, []));
              var irr = res.irregular && res.irregular[t] && res.irregular[t][person];
              var agree = spellings(f).filter(function (x) { return x !== bare(f); });
              return { q: 'Write the ' + TENSE_NAMES[lang][t] + ' of *' + verb + '* for *' + subj + '*' + (t === 'passeCompose' ? ' (auxiliary + participle)' : '') + '.', answer: bare(f), accept: accept, placeholder: lang === 'fr' ? 'e.g. parlons' : 'e.g. hablamos',
                steps: [RULES[lang][t][0], irr ? verb + ' is irregular in this form, so it has to be learned.' : verb + ' follows the pattern here.', subj + ' → ' + bare(f) + (agree.length ? ' (it agrees with the subject: ' + agree.join(', ') + ')' : '') + '.'] };
            } };
          }),
        });
      });
    });
  }

  if (V && typeof V.themes === 'function') {
    ['fr', 'es', 'de'].forEach(function (lang) {
      var L = LANG[lang], themes = V.themes();
      [['to', 'English → ' + L.name], ['from', L.name + ' → English']].forEach(function (dir) {
        skills.push({
          id: 'lang-' + lang + '-vocab-' + dir[0], units: themes.map(function (t) { return U(L.sid, THEME_UNITS[t.id] || 'T2'); }).filter(function (x, i, a) { return a.indexOf(x) === i; }),
          title: L.name + ' vocabulary: ' + dir[1],
          method: dir[0] === 'to'
            ? ['Read the English, then say the ' + L.name + ' word aloud before you type it.', 'Learn nouns with their article: it carries the gender you need for adjectives and pronouns.', 'Accents count in the exam; Flux points them out when you leave them off.']
            : ['Look for a cognate (a word that looks like English) and for an article, which tells you a noun is coming.', 'Give the most usual English meaning; “the” is optional.', 'Then say the ' + L.name + ' word again, so you learn it both ways.'],
          variants: themes.map(function (t) {
            return { id: t.id, name: t.name, gen: function (r) {
              var w = r.pick(V.words(t.id)), en = w[0], tl = w[L.col];
              if (!en || !tl) return null;
              var enClean = String(en).replace(/\s*\([^)]*\)/g, '');
              var enAll = enClean.split('/').map(function (x) { return x.trim(); }).reduce(function (a, x) { a.push(x); a.push(x.replace(/^(the|a|an|to)\s+/i, '')); return a; }, []);
              var tlAll = [tl, tl.replace(/^(el|la|los|las|le|les|der|die|das|un|una|une)\s+/i, '').replace(/^l['’]/i, '')];
              var noun = /^(el|la|los|las|le|les|der|die|das)\s|^l['’]/i.test(tl);
              if (dir[0] === 'to') return { q: 'Write in ' + L.name + ': *' + en + '*', answer: tl, accept: tlAll, placeholder: 'In ' + L.name,
                steps: ['Topic: ' + t.name + '.', noun ? 'It is a noun: give its article too.' : 'Not a noun, so no article.', en + ' = ' + tl + '.'] };
              return { q: 'What does *' + tl + '* mean in English?', answer: enAll[0], accept: enAll, placeholder: 'In English',
                steps: ['Topic: ' + t.name + '.', noun ? 'Look past the article to the noun.' : 'Think of the most common meaning.', tl + ' = ' + enClean + '.'] };
            } };
          }),
        });
      });

      var arts = lang === 'fr' ? { 'le ': 'masculine (le)', 'la ': 'feminine (la)' } : lang === 'es' ? { 'el ': 'masculine (el)', 'la ': 'feminine (la)' } : { 'der ': 'masculine (der)', 'die ': 'feminine (die)', 'das ': 'neuter (das)' };
      var nouns = [];
      themes.forEach(function (t) {
        V.words(t.id).forEach(function (w) {
          var tl = w[L.col], en = String(w[0]).replace(/\s*\([^)]*\)/g, '');
          // German plurals take die whatever the gender: singular nouns only.
          if (lang === 'de' && /s$/.test(en) && !/ss$/.test(en)) return;
          Object.keys(arts).forEach(function (a) { if (tl && tl.indexOf(a) === 0 && !/\s(y|et|und|o|ou|oder)\s/.test(tl)) nouns.push([tl, arts[a], en]); });
        });
      });
      if (nouns.length > 6) {
        var genders = Object.keys(arts).map(function (a) { return arts[a]; });
        skills.push({
          id: 'lang-' + lang + '-gender', units: [U(L.sid, 'P1'), U(L.sid, 'T1')],
          title: L.name + ' noun genders',
          method: lang === 'fr'
            ? ['Every noun is masculine (le, un) or feminine (la, une); learn it with the noun.', 'Usually feminine: -tion, -sion, -té, -ure, -ette, -ance/-ence. Usually masculine: -age, -ment, -eau, -isme, -oir.', 'l’ hides the gender before a vowel: check it with un or une.']
            : lang === 'es'
              ? ['Every noun is masculine (el, un) or feminine (la, una).', 'Usually masculine: -o, -or, -aje, -ma (el problema). Usually feminine: -a, -ción, -sión, -dad, -tad, -tud, -umbre.', 'Learn the exceptions: la mano, el día, el mapa.']
              : ['Every noun is masculine (der), feminine (die) or neuter (das); every plural takes die.', 'Usually feminine: -ung, -heit, -keit, -schaft, -ion, -tät. Usually neuter: -chen, -lein, -um, -ment. Usually masculine: -er (people), -ling, -ismus.', 'A compound noun takes the gender of its last part: das Klassenzimmer, from das Zimmer.'],
          variants: [{ id: 'all', name: 'Which gender?', gen: function (r) {
            var n = r.pick(nouns), word = n[0].replace(/^\S+\s/, '');
            return Object.assign(T.choice(n[1], genders.filter(function (gg) { return gg !== n[1]; })), { q: 'What gender is *' + word + '* (' + n[2] + ')?',
              steps: ['Check the ending against the usual patterns, then recall the article you learned it with.', 'With its article: ' + n[0] + '.', n[1].charAt(0).toUpperCase() + n[1].slice(1) + '.'] });
          } }],
        });
      }
    });
  }

  T.register(skills);
})();
