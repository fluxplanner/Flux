/* ============================================================================
   FLUX LANGUAGE ENGINE  ·  flux-lang-engine.js
   Offline Spanish and French conjugation.

   WHY THIS EXISTS
   ---------------
   The old trainer fitted in six lines and got common verbs wrong:

     partir  (fr) → "nous partissons"   should be "nous partons"
     poder   (es) → "yo podo"           should be "yo puedo"
     querer  (es) → "yo quero"          should be "yo quiero"
     pedir   (es) → "yo pedo"           should be "yo pido"

   It knew three regular endings per language and nine irregular verbs, and
   treated everything else as regular. A student revising with it would be
   confidently taught the wrong form, which is worse than having no tool — a
   blank page sends you to a textbook, a wrong answer does not.

   Two faults caused nearly all of it:

   1. Spanish STEM CHANGES were absent. In the present tense the stressed
      vowel shifts in every form except nosotros/vosotros — the "boot". These
      are not exotic verbs; they are poder, querer, pensar, dormir, pedir.
   2. French has TWO -ir families and the old code assumed everything took the
      -iss- infix. finir/choisir do; partir/dormir/sortir/sentir/servir drop
      the final consonant of the stem instead.

   There is an AI conjugator in flux-toolbox.js. This is deliberately not that:
   it works with no network, no key and no latency, and it is deterministic, so
   it can be tested. The AI one handles anything; this one handles what a
   school syllabus actually asks for, instantly.

   COVERAGE
   --------
   Spanish: present, preterite, imperfect, future, conditional.
   French:  present, passé composé, imperfect, future, conditional.

   Every table below is written out rather than derived. Conjugation is exactly
   the kind of domain where a clever rule generates a plausible wrong answer,
   and a plausible wrong answer is the thing this file exists to stop.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxLangEngine) return;

  var PRONOUNS = {
    es: ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos/ellas'],
    fr: ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'],
  };

  var TENSES = {
    es: [
      { id: 'present', name: 'Present', hint: 'hablo — I speak' },
      { id: 'preterite', name: 'Preterite', hint: 'hablé — I spoke' },
      { id: 'imperfect', name: 'Imperfect', hint: 'hablaba — I used to speak' },
      { id: 'future', name: 'Future', hint: 'hablaré — I will speak' },
      { id: 'conditional', name: 'Conditional', hint: 'hablaría — I would speak' },
      { id: 'subjunctive', name: 'Subjunctive', hint: 'que hable — that I speak' },
      { id: 'perfect', name: 'Perfect', hint: 'he hablado — I have spoken' },
    ],
    fr: [
      { id: 'present', name: 'Present', hint: 'je parle — I speak' },
      { id: 'passeCompose', name: 'Passé composé', hint: "j'ai parlé — I spoke" },
      { id: 'imperfect', name: 'Imperfect', hint: 'je parlais — I used to speak' },
      { id: 'future', name: 'Future', hint: 'je parlerai — I will speak' },
      { id: 'conditional', name: 'Conditional', hint: 'je parlerais — I would speak' },
    ],
  };

  // ── Spanish ───────────────────────────────────────────────────────────────

  var ES_PRESENT = {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  };
  var ES_PRETERITE = {
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  };
  var ES_IMPERFECT = {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  };
  // Future and conditional attach to the WHOLE infinitive, not a stem — which
  // is why they are the two easiest tenses in Spanish and worth including.
  var ES_FUTURE = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
  var ES_CONDITIONAL = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];

  /* Irregular future/conditional stems. The ending is regular; only the stem
     shortens or gains a d. Both tenses share the list — that is the actual
     rule, so encoding it once prevents the two drifting apart. */
  var ES_FUT_STEM = {
    tener: 'tendr', venir: 'vendr', poner: 'pondr', salir: 'saldr', valer: 'valdr',
    poder: 'podr', saber: 'sabr', caber: 'cabr', haber: 'habr', querer: 'querr',
    hacer: 'har', decir: 'dir',
  };

  /* The "boot" verbs. The change hits every form except nosotros/vosotros,
     because those two put the stress on the ending instead of the stem.
     Listed by verb rather than guessed from spelling: contar changes, montar
     does not, and nothing in the letters tells you which. */
  var ES_STEM = {
    /* tener and venir belong here as well as in ES_YO: they are both boot
       verbs AND have an irregular yo, so tengo/tienes/tiene. Leaving them out
       of this list produced "tenes" — right about the yo, wrong about the
       other five. */
    ie: ['pensar', 'querer', 'empezar', 'comenzar', 'entender', 'perder', 'cerrar',
      'despertar', 'sentir', 'preferir', 'mentir', 'divertir', 'nevar', 'encender',
      'defender', 'atender', 'convertir', 'sugerir', 'herir', 'calentar', 'sentar',
      'tener', 'venir'],
    ue: ['poder', 'dormir', 'volver', 'contar', 'encontrar', 'recordar', 'morir',
      'almorzar', 'costar', 'mostrar', 'llover', 'mover', 'probar', 'resolver',
      'soñar', 'volar', 'devolver', 'acostar', 'colgar', 'doler'],
    i: ['pedir', 'servir', 'repetir', 'seguir', 'vestir', 'medir',
      'competir', 'impedir', 'despedir', 'conseguir', 'perseguir', 'decir'],
    // jugar is the only u→ue verb in the language.
    uue: ['jugar'],
  };

  /* Verbs whose yo form alone is irregular — the "go verbs" and friends. The
     other five forms follow the regular pattern (subject to any stem change),
     so only yo is stored. */
  var ES_YO = {
    tener: 'tengo', venir: 'vengo', poner: 'pongo', salir: 'salgo', hacer: 'hago',
    decir: 'digo', traer: 'traigo', caer: 'caigo', oír: 'oigo', valer: 'valgo',
    conocer: 'conozco', parecer: 'parezco', ofrecer: 'ofrezco', conducir: 'conduzco',
    traducir: 'traduzco', producir: 'produzco', ver: 'veo', dar: 'doy', saber: 'sé',
    caber: 'quepo', coger: 'cojo', escoger: 'escojo', proteger: 'protejo',
    seguir: 'sigo', conseguir: 'consigo', vencer: 'venzo',
  };

  var ES_IRREGULAR = {
    ser: { present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], imperfect: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'] },
    ir: { present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], imperfect: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'] },
    estar: { present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], preterite: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'] },
    haber: { present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], preterite: ['hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron'] },
    ver: { preterite: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'], imperfect: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'] },
    oler: { present: ['huelo', 'hueles', 'huele', 'olemos', 'oléis', 'huelen'] },
    dar: { preterite: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'] },
  };

  /* Strong preterites: an irregular stem plus a single unstressed ending set
     shared by all of them. The missing accents are the point — "tuve", not
     "tuvé". Storing the stem keeps that rule visible instead of retyping
     eighteen forms and mistyping one. */
  var ES_PRET_ENDINGS = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];
  var ES_PRET_STEM = {
    tener: 'tuv', poder: 'pud', poner: 'pus', saber: 'sup', hacer: 'hic',
    querer: 'quis', venir: 'vin', caber: 'cup', andar: 'anduv',
  };
  // Stems ending in j drop the i of the ellos ending: dijeron, not dijieron.
  var ES_PRET_STEM_J = { decir: 'dij', traer: 'traj', conducir: 'conduj', traducir: 'traduj', producir: 'produj' };

  /* Present subjunctive endings — the "opposite vowel" rule: -ar verbs borrow
     the -er endings and vice versa. */
  var ES_SUBJ = {
    ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
    ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  };

  /* Irregular past participles. Everything else is -ado / -ido. Without this
     list the perfect tense reads "he volvido" and "he escribido". */
  var ES_PP = {
    hacer: 'hecho', decir: 'dicho', ver: 'visto', poner: 'puesto', volver: 'vuelto',
    devolver: 'devuelto', resolver: 'resuelto', morir: 'muerto', abrir: 'abierto',
    cubrir: 'cubierto', descubrir: 'descubierto', escribir: 'escrito',
    describir: 'descrito', romper: 'roto', imprimir: 'impreso', freír: 'frito',
    satisfacer: 'satisfecho',
  };
  var ES_HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];

  /* A handful of verbs are irregular in the subjunctive in a way no rule
     derives, because their yo form is not the source: ser, ir, dar, estar,
     saber, haber. */
  var ES_SUBJ_IRREG = {
    ser: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
    ir: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
    dar: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
    estar: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
    saber: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
    haber: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
  };

  function esStemChange(verb) {
    for (var kind in ES_STEM) {
      if (ES_STEM[kind].indexOf(verb) !== -1) return kind;
    }
    return null;
  }

  /* Apply the change to the LAST occurrence of the vowel. entender has two
     e's and only the second one shifts (entiendo, not intiendo). */
  function applyStemChange(stem, kind) {
    var from = kind === 'ue' ? 'o' : kind === 'uue' ? 'u' : 'e';
    var to = kind === 'ie' ? 'ie' : kind === 'ue' ? 'ue' : kind === 'uue' ? 'ue' : 'i';
    var at = stem.lastIndexOf(from);
    if (at === -1) return stem;
    return stem.slice(0, at) + to + stem.slice(at + 1);
  }

  /* hacer is spelt hizo in the third person: the c would be read hard before
     an o. Orthography, not a different stem. */
  function esFixSpelling(verb, forms) {
    if (verb === 'hacer') forms[2] = 'hizo';
    return forms;
  }

  function conjugateEs(verb, tense) {
    var end = verb.slice(-2);
    var stem = verb.slice(0, -2);
    if (!ES_PRESENT[end]) throw new Error('Spanish verbs end in -ar, -er or -ir. Try hablar, comer or vivir.');

    var irr = ES_IRREGULAR[verb];
    if (irr && irr[tense]) return { forms: irr[tense].slice(), note: 'irregular' };

    if (tense === 'future' || tense === 'conditional') {
      var fstem = ES_FUT_STEM[verb] || verb;
      var fend = tense === 'future' ? ES_FUTURE : ES_CONDITIONAL;
      return {
        forms: fend.map(function (e) { return fstem + e; }),
        note: ES_FUT_STEM[verb] ? 'irregular stem "' + fstem + '-", regular endings' : 'regular — endings join the whole infinitive',
      };
    }

    if (tense === 'imperfect') {
      return {
        forms: ES_IMPERFECT[end].map(function (e) { return stem + e; }),
        note: 'regular — only ser, ir and ver are irregular here',
      };
    }

    if (tense === 'perfect') {
      var pp = ES_PP[verb] || stem + (end === 'ar' ? 'ado' : 'ido');
      return {
        forms: ES_HABER.map(function (h) { return h + ' ' + pp; }),
        note: ES_PP[verb] ? 'irregular participle "' + pp + '"' : 'haber + ' + (end === 'ar' ? '-ado' : '-ido'),
      };
    }

    if (tense === 'subjunctive') {
      if (ES_SUBJ_IRREG[verb]) return { forms: ES_SUBJ_IRREG[verb].slice(), note: 'irregular' };
      var sk = esStemChange(verb);
      /* The subjunctive is built from the yo form of the present, which is why
         an irregular yo carries into all six: tengo → tenga, tengamos. When it
         does, that stem wins everywhere and the boot does not apply. */
      var yoStem = ES_YO[verb] ? ES_YO[verb].replace(/o$/, '') : null;
      var sforms = ES_SUBJ[end].map(function (e, i) {
        if (yoStem) return yoStem + e;
        var outsideBoot = i === 3 || i === 4;
        if (!sk) return stem + e;
        /* -ir stem-changers are the exception to the exception: nosotros and
           vosotros take a weaker change of their own — durmamos, pidamos —
           rather than escaping it the way -ar and -er verbs do. */
        if (outsideBoot) {
          if (end !== 'ir') return stem + e;
          var weak = sk === 'ue' ? applyStemChange(stem, 'ue').replace('ue', 'u') : applyStemChange(stem, 'i');
          return weak + e;
        }
        return applyStemChange(stem, sk) + e;
      });
      return {
        forms: sforms,
        note: yoStem ? 'built from the yo form "' + ES_YO[verb] + '"' : sk ? 'stem change carries into the subjunctive' : 'regular — opposite endings to the present',
      };
    }

    if (tense === 'preterite') {
      var ps = ES_PRET_STEM[verb] || ES_PRET_STEM_J[verb];
      if (ps) {
        var isJ = !!ES_PRET_STEM_J[verb];
        return {
          forms: esFixSpelling(verb, ES_PRET_ENDINGS.map(function (e, i) {
            return ps + (isJ && i === 5 ? 'eron' : e);
          })),
          note: 'strong preterite — no accent on yo or él',
        };
      }
      /* -ir stem-changers keep a change in the third person only, and it is
         always e→i or o→u regardless of what the present tense does:
         durmió, pidió, sintió. */
      var pk = esStemChange(verb);
      if (end === 'ir' && pk) {
        var third = pk === 'ue' ? applyStemChange(stem, 'ue').replace('ue', 'u') : applyStemChange(stem, 'i');
        return {
          forms: ES_PRETERITE[end].map(function (e, i) {
            return (i === 2 || i === 5 ? third : stem) + e;
          }),
          note: '-ir stem change in él and ellos only',
        };
      }
      return { forms: ES_PRETERITE[end].map(function (e) { return stem + e; }), note: 'regular -' + end };
    }

    // Present.
    var kind = esStemChange(verb);
    var forms = ES_PRESENT[end].map(function (e, i) {
      // Index 3 and 4 are nosotros and vosotros — outside the boot.
      var s = kind && i !== 3 && i !== 4 ? applyStemChange(stem, kind) : stem;
      return s + e;
    });
    var note;
    if (kind) {
      var label = kind === 'uue' ? 'u→ue' : kind === 'ie' ? 'e→ie' : kind === 'ue' ? 'o→ue' : 'e→i';
      note = 'stem change ' + label + ' — not in nosotros/vosotros';
    } else {
      note = 'regular -' + end;
    }
    if (ES_YO[verb]) {
      forms[0] = ES_YO[verb];
      note = kind ? note + ', irregular yo' : 'irregular yo, otherwise regular -' + end;
    }
    return { forms: forms, note: note };
  }

  // ── French ────────────────────────────────────────────────────────────────

  var FR_ER = ['e', 'es', 'e', 'ons', 'ez', 'ent'];
  var FR_IR_ISS = ['is', 'is', 'it', 'issons', 'issez', 'issent'];   // finir
  var FR_IR_BARE = ['s', 's', 't', 'ons', 'ez', 'ent'];              // partir
  var FR_RE = ['s', 's', '', 'ons', 'ez', 'ent'];

  /* The partir family: -ir verbs that drop the final stem consonant in the
     singular. This list is the whole reason the old trainer was wrong, so it
     is explicit rather than inferred. -vrir/-frir verbs (ouvrir, offrir) are
     stranger still: they take -er endings entirely. */
  var FR_IR_BARE_VERBS = ['partir', 'sortir', 'dormir', 'sentir', 'servir', 'mentir',
    'repartir', 'ressentir', 'consentir', 'endormir', 'desservir'];
  var FR_IR_AS_ER = ['ouvrir', 'offrir', 'couvrir', 'souffrir', 'découvrir', 'cueillir'];

  var FR_IRREGULAR = {
    'être': { present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'] },
    avoir: { present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'] },
    aller: { present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'] },
    faire: { present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'] },
    pouvoir: { present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'] },
    vouloir: { present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'] },
    devoir: { present: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'] },
    savoir: { present: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'] },
    voir: { present: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'] },
    venir: { present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'] },
    tenir: { present: ['tiens', 'tiens', 'tient', 'tenons', 'tenez', 'tiennent'] },
    prendre: { present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'] },
    comprendre: { present: ['comprends', 'comprends', 'comprend', 'comprenons', 'comprenez', 'comprennent'] },
    apprendre: { present: ['apprends', 'apprends', 'apprend', 'apprenons', 'apprenez', 'apprennent'] },
    dire: { present: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'] },
    lire: { present: ['lis', 'lis', 'lit', 'lisons', 'lisez', 'lisent'] },
    'écrire': { present: ['écris', 'écris', 'écrit', 'écrivons', 'écrivez', 'écrivent'] },
    mettre: { present: ['mets', 'mets', 'met', 'mettons', 'mettez', 'mettent'] },
    boire: { present: ['bois', 'bois', 'boit', 'buvons', 'buvez', 'boivent'] },
    croire: { present: ['crois', 'crois', 'croit', 'croyons', 'croyez', 'croient'] },
    recevoir: { present: ['reçois', 'reçois', 'reçoit', 'recevons', 'recevez', 'reçoivent'] },
    'connaître': { present: ['connais', 'connais', 'connaît', 'connaissons', 'connaissez', 'connaissent'] },
    courir: { present: ['cours', 'cours', 'court', 'courons', 'courez', 'courent'] },
    mourir: { present: ['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'] },
    vivre: { present: ['vis', 'vis', 'vit', 'vivons', 'vivez', 'vivent'] },
    suivre: { present: ['suis', 'suis', 'suit', 'suivons', 'suivez', 'suivent'] },
  };

  /* Imperfect is built from the nous form of the present minus -ons, for every
     verb in the language except être. Storing the stem directly is simpler and
     avoids a recursive call that would inherit any present-tense mistake. */
  var FR_IMP_STEM = {
    'être': 'ét', avoir: 'av', aller: 'all', faire: 'fais', pouvoir: 'pouv',
    vouloir: 'voul', devoir: 'dev', savoir: 'sav', voir: 'voy', venir: 'ven',
    tenir: 'ten', prendre: 'pren', comprendre: 'compren', apprendre: 'appren',
    dire: 'dis', lire: 'lis', 'écrire': 'écriv', mettre: 'mett', boire: 'buv',
    croire: 'croy', recevoir: 'recev', 'connaître': 'connaiss', courir: 'cour',
    mourir: 'mour', vivre: 'viv', suivre: 'suiv',
  };
  var FR_IMP_ENDINGS = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
  var FR_FUT_ENDINGS = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
  var FR_COND_ENDINGS = FR_IMP_ENDINGS;

  var FR_FUT_STEM = {
    'être': 'ser', avoir: 'aur', aller: 'ir', faire: 'fer', pouvoir: 'pourr',
    vouloir: 'voudr', devoir: 'devr', savoir: 'saur', voir: 'verr', venir: 'viendr',
    tenir: 'tiendr', recevoir: 'recevr', courir: 'courr', mourir: 'mourr',
    envoyer: 'enverr', falloir: 'faudr', valoir: 'vaudr',
  };

  /* Past participles, for the passé composé. Only the irregular ones are
     listed; -er → -é, -ir → -i and -re → -u cover the rest. */
  var FR_PP = {
    'être': 'été', avoir: 'eu', faire: 'fait', prendre: 'pris', comprendre: 'compris',
    apprendre: 'appris', mettre: 'mis', dire: 'dit', 'écrire': 'écrit', lire: 'lu',
    voir: 'vu', boire: 'bu', croire: 'cru', devoir: 'dû', pouvoir: 'pu',
    vouloir: 'voulu', savoir: 'su', recevoir: 'reçu', venir: 'venu', tenir: 'tenu',
    'connaître': 'connu', vivre: 'vécu', suivre: 'suivi', mourir: 'mort',
    ouvrir: 'ouvert', offrir: 'offert', couvrir: 'couvert', souffrir: 'souffert',
    courir: 'couru', 'naître': 'né', descendre: 'descendu',
  };

  /* Verbs taking être in the passé composé — the DR & MRS VANDERTRAMP set.
     Getting this wrong produces "j'ai allé", which is the single most common
     mistake in school French. */
  var FR_ETRE_VERBS = ['aller', 'venir', 'arriver', 'partir', 'entrer', 'sortir',
    'monter', 'descendre', 'naître', 'mourir', 'rester', 'tomber', 'retourner',
    'revenir', 'devenir', 'rentrer'];

  var FR_AVOIR = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
  var FR_ETRE = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
  // Agreement on the être verbs: masculine singular, then plural where it shows.
  var FR_ETRE_AGREE = ['', '', '', 's', 's', 's'];

  function frFamily(verb) {
    if (FR_IRREGULAR[verb]) return 'irregular';
    if (FR_IR_AS_ER.indexOf(verb) !== -1) return 'ir-as-er';
    if (FR_IR_BARE_VERBS.indexOf(verb) !== -1) return 'ir-bare';
    if (verb.slice(-2) === 'er') return 'er';
    if (verb.slice(-2) === 'ir') return 'ir-iss';
    if (verb.slice(-2) === 're') return 're';
    return null;
  }

  function frPastParticiple(verb) {
    if (FR_PP[verb]) return FR_PP[verb];
    var end = verb.slice(-2);
    if (end === 'er') return verb.slice(0, -2) + 'é';
    if (end === 'ir') return verb.slice(0, -2) + 'i';
    if (end === 're') return verb.slice(0, -2) + 'u';
    return verb;
  }

  function conjugateFr(verb, tense) {
    var fam = frFamily(verb);
    if (!fam) throw new Error('French verbs end in -er, -ir or -re. Try parler, finir or vendre.');

    if (tense === 'imperfect') {
      var istem = FR_IMP_STEM[verb];
      if (!istem) {
        istem = fam === 'ir-iss' ? verb.slice(0, -2) + 'iss' : verb.slice(0, -2);
      }
      return {
        forms: FR_IMP_ENDINGS.map(function (x) { return istem + x; }),
        note: 'built from the nous form — the one tense with no exceptions but être',
      };
    }

    if (tense === 'future' || tense === 'conditional') {
      var fstem = FR_FUT_STEM[verb] || (verb.slice(-2) === 're' ? verb.slice(0, -1) : verb);
      var ends = tense === 'future' ? FR_FUT_ENDINGS : FR_COND_ENDINGS;
      return {
        forms: ends.map(function (x) { return fstem + x; }),
        note: FR_FUT_STEM[verb] ? 'irregular stem "' + fstem + '-"' : 'regular — endings join the infinitive',
      };
    }

    if (tense === 'passeCompose') {
      var pp = frPastParticiple(verb);
      var withEtre = FR_ETRE_VERBS.indexOf(verb) !== -1;
      var aux = withEtre ? FR_ETRE : FR_AVOIR;
      /* The pronoun lives in its own column in the UI, so the elision has to
         happen there rather than inside the verb: "j'" + "ai parlé", never
         "je" + "j'ai parlé" (duplicated) or "je" + "ai parlé" (not French).
         Only avoir triggers it — "je suis allé" keeps its full pronoun. */
      var pron = PRONOUNS.fr.slice();
      if (/^[aeiouéêh]/i.test(aux[0])) pron[0] = "j'";
      return {
        forms: aux.map(function (a, i) {
          return a + ' ' + (withEtre ? pp + FR_ETRE_AGREE[i] : pp);
        }),
        pronouns: pron,
        note: withEtre
          ? 'takes être — the participle agrees with the subject'
          : 'takes avoir — the participle does not change',
      };
    }

    // Present.
    if (fam === 'irregular') return { forms: FR_IRREGULAR[verb].present.slice(), note: 'irregular' };
    var s = verb.slice(0, -2);
    if (fam === 'er') {
      return { forms: FR_ER.map(function (x) { return s + x; }), note: 'regular -er' };
    }
    if (fam === 'ir-as-er') {
      return { forms: FR_ER.map(function (x) { return s + x; }), note: 'ends in -ir but takes -er endings' };
    }
    if (fam === 'ir-iss') {
      return { forms: FR_IR_ISS.map(function (x) { return s + x; }), note: 'regular -ir (finir type, with -iss-)' };
    }
    if (fam === 'ir-bare') {
      /* partir → par + s/s/t, then part + ons/ez/ent. The singular drops the
         last consonant of the stem; the plural keeps it. */
      var short = s.slice(0, -1);
      return {
        forms: FR_IR_BARE.map(function (x, i) { return (i < 3 ? short : s) + x; }),
        note: '-ir without -iss- (partir type)',
      };
    }
    // -re
    return { forms: FR_RE.map(function (x) { return s + x; }), note: 'regular -re' };
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Normalise what someone typed: trim, lowercase, drop a leading "to ". */
  function clean(verb) {
    return String(verb == null ? '' : verb).trim().toLowerCase().replace(/^to\s+/, '');
  }

  function conjugate(lang, verb, tense) {
    var l = lang === 'fr' ? 'fr' : 'es';
    var v = clean(verb);
    var t = tense || 'present';
    if (!v) throw new Error('Type a verb first.');
    if (!/^[a-záéíóúüñçàâèêëîïôûùœ]+$/.test(v)) throw new Error('Letters only — one verb at a time.');
    var known = TENSES[l].some(function (x) { return x.id === t; });
    if (!known) t = 'present';
    var r = l === 'es' ? conjugateEs(v, t) : conjugateFr(v, t);
    // A tense may override the pronoun column — see the passé composé elision.
    return { lang: l, verb: v, tense: t, pronouns: r.pronouns || PRONOUNS[l].slice(), forms: r.forms, note: r.note };
  }

  window.FluxLangEngine = {
    conjugate: conjugate,
    /** Past participle alone — the reference conjugator builds its own perfect
     *  and compound tenses from this. */
    pastParticiple: function (lang, verb) {
      var v = clean(verb);
      if ((lang === 'fr' ? 'fr' : 'es') === 'fr') return frPastParticiple(v);
      var end = v.slice(-2);
      if (!ES_PRESENT[end]) return v;
      return ES_PP[v] || v.slice(0, -2) + (end === 'ar' ? 'ado' : 'ido');
    },
    tenses: function (lang) { return TENSES[lang === 'fr' ? 'fr' : 'es'].slice(); },
    pronouns: function (lang) { return PRONOUNS[lang === 'fr' ? 'fr' : 'es'].slice(); },
    clean: clean,
  };
})();
