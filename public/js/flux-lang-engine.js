/* ============================================================================
   FLUX LANGUAGE ENGINE  ·  flux-lang-engine.js
   Offline Spanish, French and German conjugation.

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
    de: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'],
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
    /* Four for German, and Konjunktiv II is deliberately not the fifth: half of
       it is replaced by "würde + infinitive" in real use and the other half
       needs a table this file would have to be right about. Four tenses that
       are correct beat five where one is a guess. */
    de: [
      { id: 'present', name: 'Präsens', hint: 'ich spreche — I speak' },
      { id: 'past', name: 'Präteritum', hint: 'ich sprach — I spoke' },
      { id: 'perfect', name: 'Perfekt', hint: 'ich habe gesprochen — I have spoken' },
      { id: 'future', name: 'Futur I', hint: 'ich werde sprechen — I will speak' },
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

  // ── German ────────────────────────────────────────────────────────────────
  /* German joined this file rather than getting one of its own, because the
     failure it has to avoid is the same one: a rule that looks right and
     produces "du fahrst" for fahren or "du gebst" for geben. Almost every
     German irregularity is confined to three places — the du/er stem in the
     present, the Präteritum stem, and the participle — so all three are listed
     per verb in DE_STRONG below rather than guessed from spelling. */

  // Weak (regular) endings. wir and sie are always the bare infinitive, which
  // is why those two slots are filled from the infinitive, not from this list.
  var DE_PRESENT = ['e', 'st', 't', 'en', 't', 'en'];
  var DE_PRAT_WEAK = ['te', 'test', 'te', 'ten', 'tet', 'ten'];
  // Strong verbs take no ending at all on ich and er: ich ging, er ging.
  var DE_PRAT_STRONG = ['', 'st', '', 'en', 't', 'en'];

  /* Fully irregular presents. sein, haben and werden carry the language, and
     the six modals share a pattern of their own — the singular drops the
     umlaut and ich and er come out identical. None of it is derivable. */
  var DE_PRESENT_IRREG = {
    sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
    haben: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
    werden: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'],
    'können': ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
    'müssen': ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
    'dürfen': ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
    wollen: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
    sollen: ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'],
    'mögen': ['mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen'],
    wissen: ['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen'],
    tun: ['tue', 'tust', 'tut', 'tun', 'tut', 'tun'],
  };

  /* The strong and mixed verbs, with their principal parts.

       du   the du/er present stem — '' when the vowel does not change
       prat the ich form of the Präteritum
       pp   the participle, for the Perfekt
       aux  'h' haben, 's' sein
       weak the mixed verbs (bringen, denken, kennen…): a changed stem but
            weak -te endings, so they cannot share the strong ending set
       en   the English gloss, so the irregular-verbs list is generated from
            this same table and can never drift out of step with what the
            conjugator returns

     This is the list a school course actually asks for. Anything not in it is
     treated as weak, which for German is true far more often than not. */
  var DE_STRONG = {
    sein: { du: '', prat: 'war', pp: 'gewesen', aux: 's', en: 'to be' },
    // "hat", not "hatte" — the weak -te is added below, and storing the whole
    // ich form here produced "hattete".
    haben: { du: '', prat: 'hat', pp: 'gehabt', aux: 'h', weak: true, en: 'to have' },
    /* werden fits neither pattern: -de where a weak verb has -te, and a final
       vowel a strong verb does not have, so "wurde" + "en" came out
       "wurdeen". Written out rather than bent into a rule. */
    werden: {
      du: '', prat: 'wurde', pp: 'geworden', aux: 's', en: 'to become',
      pratForms: ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden'],
    },
    'können': { du: '', prat: 'konn', pp: 'gekonnt', aux: 'h', weak: true, en: 'to be able to' },
    'müssen': { du: '', prat: 'muss', pp: 'gemusst', aux: 'h', weak: true, en: 'to have to' },
    'dürfen': { du: '', prat: 'durf', pp: 'gedurft', aux: 'h', weak: true, en: 'to be allowed to' },
    wollen: { du: '', prat: 'woll', pp: 'gewollt', aux: 'h', weak: true, en: 'to want' },
    sollen: { du: '', prat: 'soll', pp: 'gesollt', aux: 'h', weak: true, en: 'to be supposed to' },
    'mögen': { du: '', prat: 'moch', pp: 'gemocht', aux: 'h', weak: true, en: 'to like' },
    wissen: { du: '', prat: 'wuss', pp: 'gewusst', aux: 'h', weak: true, en: 'to know (a fact)' },
    tun: { du: '', prat: 'tat', pp: 'getan', aux: 'h', en: 'to do' },

    gehen: { du: '', prat: 'ging', pp: 'gegangen', aux: 's', en: 'to go' },
    kommen: { du: '', prat: 'kam', pp: 'gekommen', aux: 's', en: 'to come' },
    stehen: { du: '', prat: 'stand', pp: 'gestanden', aux: 'h', en: 'to stand' },
    verstehen: { du: '', prat: 'verstand', pp: 'verstanden', aux: 'h', en: 'to understand' },
    liegen: { du: '', prat: 'lag', pp: 'gelegen', aux: 'h', en: 'to lie, be lying' },
    sitzen: { du: '', prat: 'saß', pp: 'gesessen', aux: 'h', en: 'to sit' },
    bitten: { du: '', prat: 'bat', pp: 'gebeten', aux: 'h', en: 'to ask, request' },
    rufen: { du: '', prat: 'rief', pp: 'gerufen', aux: 'h', en: 'to call' },
    'heißen': { du: '', prat: 'hieß', pp: 'geheißen', aux: 'h', en: 'to be called' },

    fahren: { du: 'fähr', prat: 'fuhr', pp: 'gefahren', aux: 's', en: 'to drive, travel' },
    laufen: { du: 'läuf', prat: 'lief', pp: 'gelaufen', aux: 's', en: 'to run, walk' },
    fallen: { du: 'fäll', prat: 'fiel', pp: 'gefallen', aux: 's', en: 'to fall' },
    gefallen: { du: 'gefäll', prat: 'gefiel', pp: 'gefallen', aux: 'h', en: 'to please, be liked' },
    halten: { du: 'hält', prat: 'hielt', pp: 'gehalten', aux: 'h', en: 'to hold, stop' },
    schlafen: { du: 'schläf', prat: 'schlief', pp: 'geschlafen', aux: 'h', en: 'to sleep' },
    tragen: { du: 'träg', prat: 'trug', pp: 'getragen', aux: 'h', en: 'to carry, wear' },
    schlagen: { du: 'schläg', prat: 'schlug', pp: 'geschlagen', aux: 'h', en: 'to hit' },
    waschen: { du: 'wäsch', prat: 'wusch', pp: 'gewaschen', aux: 'h', en: 'to wash' },
    wachsen: { du: 'wächs', prat: 'wuchs', pp: 'gewachsen', aux: 's', en: 'to grow' },
    lassen: { du: 'läss', prat: 'ließ', pp: 'gelassen', aux: 'h', en: 'to let, leave' },
    verlassen: { du: 'verläss', prat: 'verließ', pp: 'verlassen', aux: 'h', en: 'to leave (a place)' },
    raten: { du: 'rät', prat: 'riet', pp: 'geraten', aux: 'h', en: 'to advise, guess' },
    fangen: { du: 'fäng', prat: 'fing', pp: 'gefangen', aux: 'h', en: 'to catch' },
    laden: { du: 'läd', prat: 'lud', pp: 'geladen', aux: 'h', en: 'to load, invite' },
    'stoßen': { du: 'stöß', prat: 'stieß', pp: 'gestoßen', aux: 'h', en: 'to push, bump' },

    geben: { du: 'gib', prat: 'gab', pp: 'gegeben', aux: 'h', en: 'to give' },
    nehmen: { du: 'nimm', prat: 'nahm', pp: 'genommen', aux: 'h', en: 'to take' },
    sehen: { du: 'sieh', prat: 'sah', pp: 'gesehen', aux: 'h', en: 'to see' },
    lesen: { du: 'lies', prat: 'las', pp: 'gelesen', aux: 'h', en: 'to read' },
    essen: { du: 'iss', prat: 'aß', pp: 'gegessen', aux: 'h', en: 'to eat' },
    vergessen: { du: 'vergiss', prat: 'vergaß', pp: 'vergessen', aux: 'h', en: 'to forget' },
    treffen: { du: 'triff', prat: 'traf', pp: 'getroffen', aux: 'h', en: 'to meet' },
    helfen: { du: 'hilf', prat: 'half', pp: 'geholfen', aux: 'h', en: 'to help' },
    sprechen: { du: 'sprich', prat: 'sprach', pp: 'gesprochen', aux: 'h', en: 'to speak' },
    brechen: { du: 'brich', prat: 'brach', pp: 'gebrochen', aux: 'h', en: 'to break' },
    werfen: { du: 'wirf', prat: 'warf', pp: 'geworfen', aux: 'h', en: 'to throw' },
    sterben: { du: 'stirb', prat: 'starb', pp: 'gestorben', aux: 's', en: 'to die' },
    stehlen: { du: 'stiehl', prat: 'stahl', pp: 'gestohlen', aux: 'h', en: 'to steal' },
    empfehlen: { du: 'empfiehl', prat: 'empfahl', pp: 'empfohlen', aux: 'h', en: 'to recommend' },
    geschehen: { du: 'gescheh', prat: 'geschah', pp: 'geschehen', aux: 's', en: 'to happen' },
    gelten: { du: 'gilt', prat: 'galt', pp: 'gegolten', aux: 'h', en: 'to be valid' },
    treten: { du: 'tritt', prat: 'trat', pp: 'getreten', aux: 's', en: 'to step, kick' },

    bleiben: { du: '', prat: 'blieb', pp: 'geblieben', aux: 's', en: 'to stay' },
    schreiben: { du: '', prat: 'schrieb', pp: 'geschrieben', aux: 'h', en: 'to write' },
    steigen: { du: '', prat: 'stieg', pp: 'gestiegen', aux: 's', en: 'to climb, rise' },
    scheinen: { du: '', prat: 'schien', pp: 'geschienen', aux: 'h', en: 'to shine, seem' },
    schweigen: { du: '', prat: 'schwieg', pp: 'geschwiegen', aux: 'h', en: 'to be silent' },
    leihen: { du: '', prat: 'lieh', pp: 'geliehen', aux: 'h', en: 'to lend, borrow' },
    'vergleichen': { du: '', prat: 'verglich', pp: 'verglichen', aux: 'h', en: 'to compare' },
    entscheiden: { du: '', prat: 'entschied', pp: 'entschieden', aux: 'h', en: 'to decide' },
    'beißen': { du: '', prat: 'biss', pp: 'gebissen', aux: 'h', en: 'to bite' },
    greifen: { du: '', prat: 'griff', pp: 'gegriffen', aux: 'h', en: 'to grab' },
    pfeifen: { du: '', prat: 'pfiff', pp: 'gepfiffen', aux: 'h', en: 'to whistle' },
    reiten: { du: '', prat: 'ritt', pp: 'geritten', aux: 's', en: 'to ride' },
    schneiden: { du: '', prat: 'schnitt', pp: 'geschnitten', aux: 'h', en: 'to cut' },
    streiten: { du: '', prat: 'stritt', pp: 'gestritten', aux: 'h', en: 'to argue' },
    leiden: { du: '', prat: 'litt', pp: 'gelitten', aux: 'h', en: 'to suffer' },

    bieten: { du: '', prat: 'bot', pp: 'geboten', aux: 'h', en: 'to offer' },
    fliegen: { du: '', prat: 'flog', pp: 'geflogen', aux: 's', en: 'to fly' },
    fliehen: { du: '', prat: 'floh', pp: 'geflohen', aux: 's', en: 'to flee' },
    'fließen': { du: '', prat: 'floss', pp: 'geflossen', aux: 's', en: 'to flow' },
    frieren: { du: '', prat: 'fror', pp: 'gefroren', aux: 'h', en: 'to freeze' },
    'schließen': { du: '', prat: 'schloss', pp: 'geschlossen', aux: 'h', en: 'to close' },
    'schießen': { du: '', prat: 'schoss', pp: 'geschossen', aux: 'h', en: 'to shoot' },
    verlieren: { du: '', prat: 'verlor', pp: 'verloren', aux: 'h', en: 'to lose' },
    ziehen: { du: '', prat: 'zog', pp: 'gezogen', aux: 'h', en: 'to pull' },
    biegen: { du: '', prat: 'bog', pp: 'gebogen', aux: 'h', en: 'to bend' },
    wiegen: { du: '', prat: 'wog', pp: 'gewogen', aux: 'h', en: 'to weigh' },
    riechen: { du: '', prat: 'roch', pp: 'gerochen', aux: 'h', en: 'to smell' },
    'lügen': { du: '', prat: 'log', pp: 'gelogen', aux: 'h', en: 'to lie, tell a lie' },

    finden: { du: '', prat: 'fand', pp: 'gefunden', aux: 'h', en: 'to find' },
    binden: { du: '', prat: 'band', pp: 'gebunden', aux: 'h', en: 'to tie' },
    verschwinden: { du: '', prat: 'verschwand', pp: 'verschwunden', aux: 's', en: 'to disappear' },
    singen: { du: '', prat: 'sang', pp: 'gesungen', aux: 'h', en: 'to sing' },
    trinken: { du: '', prat: 'trank', pp: 'getrunken', aux: 'h', en: 'to drink' },
    springen: { du: '', prat: 'sprang', pp: 'gesprungen', aux: 's', en: 'to jump' },
    gewinnen: { du: '', prat: 'gewann', pp: 'gewonnen', aux: 'h', en: 'to win' },
    beginnen: { du: '', prat: 'begann', pp: 'begonnen', aux: 'h', en: 'to begin' },
    schwimmen: { du: '', prat: 'schwamm', pp: 'geschwommen', aux: 's', en: 'to swim' },
    bekommen: { du: '', prat: 'bekam', pp: 'bekommen', aux: 'h', en: 'to get, receive' },

    bringen: { du: '', prat: 'brach', pp: 'gebracht', aux: 'h', weak: true, en: 'to bring' },
    denken: { du: '', prat: 'dach', pp: 'gedacht', aux: 'h', weak: true, en: 'to think' },
    kennen: { du: '', prat: 'kann', pp: 'gekannt', aux: 'h', weak: true, en: 'to know (a person)' },
    nennen: { du: '', prat: 'nann', pp: 'genannt', aux: 'h', weak: true, en: 'to name, call' },
    rennen: { du: '', prat: 'rann', pp: 'gerannt', aux: 's', weak: true, en: 'to run' },
    brennen: { du: '', prat: 'brann', pp: 'gebrannt', aux: 'h', weak: true, en: 'to burn' },
  };

  /* Separable verbs, listed rather than detected. Splitting on a prefix that
     merely looks separable turns antworten into "an + tworten" and prints
     "ich tworte an" with total confidence — the exact failure this engine
     exists to prevent. Every entry below is a real verb whose base is either
     in DE_STRONG or regular, and the auxiliary is stored per verb because it
     does not always survive the prefix: stehen takes haben, aufstehen sein. */
  var DE_SEPARABLE = {
    aufstehen: { p: 'auf', base: 'stehen', aux: 's', en: 'to get up' },
    anfangen: { p: 'an', base: 'fangen', aux: 'h', en: 'to begin' },
    ankommen: { p: 'an', base: 'kommen', aux: 's', en: 'to arrive' },
    anrufen: { p: 'an', base: 'rufen', aux: 'h', en: 'to phone' },
    anziehen: { p: 'an', base: 'ziehen', aux: 'h', en: 'to put on (clothes)' },
    ausziehen: { p: 'aus', base: 'ziehen', aux: 'h', en: 'to take off (clothes)' },
    umziehen: { p: 'um', base: 'ziehen', aux: 's', en: 'to move house' },
    'aufhören': { p: 'auf', base: 'hören', aux: 'h', en: 'to stop' },
    aufmachen: { p: 'auf', base: 'machen', aux: 'h', en: 'to open' },
    zumachen: { p: 'zu', base: 'machen', aux: 'h', en: 'to close' },
    'aufräumen': { p: 'auf', base: 'räumen', aux: 'h', en: 'to tidy up' },
    ausgehen: { p: 'aus', base: 'gehen', aux: 's', en: 'to go out' },
    aussehen: { p: 'aus', base: 'sehen', aux: 'h', en: 'to look, appear' },
    einkaufen: { p: 'ein', base: 'kaufen', aux: 'h', en: 'to go shopping' },
    einladen: { p: 'ein', base: 'laden', aux: 'h', en: 'to invite' },
    einschlafen: { p: 'ein', base: 'schlafen', aux: 's', en: 'to fall asleep' },
    einsteigen: { p: 'ein', base: 'steigen', aux: 's', en: 'to get in, board' },
    aussteigen: { p: 'aus', base: 'steigen', aux: 's', en: 'to get off' },
    fernsehen: { p: 'fern', base: 'sehen', aux: 'h', en: 'to watch television' },
    mitkommen: { p: 'mit', base: 'kommen', aux: 's', en: 'to come along' },
    mitbringen: { p: 'mit', base: 'bringen', aux: 'h', en: 'to bring along' },
    mitnehmen: { p: 'mit', base: 'nehmen', aux: 'h', en: 'to take along' },
    nachdenken: { p: 'nach', base: 'denken', aux: 'h', en: 'to think about' },
    stattfinden: { p: 'statt', base: 'finden', aux: 'h', en: 'to take place' },
    teilnehmen: { p: 'teil', base: 'nehmen', aux: 'h', en: 'to take part' },
    vorbereiten: { p: 'vor', base: 'bereiten', aux: 'h', en: 'to prepare' },
    vorstellen: { p: 'vor', base: 'stellen', aux: 'h', en: 'to introduce, imagine' },
    weggehen: { p: 'weg', base: 'gehen', aux: 's', en: 'to go away' },
    abfahren: { p: 'ab', base: 'fahren', aux: 's', en: 'to depart' },
    abholen: { p: 'ab', base: 'holen', aux: 'h', en: 'to fetch, pick up' },
    'zuhören': { p: 'zu', base: 'hören', aux: 'h', en: 'to listen' },
    'zurückkommen': { p: 'zurück', base: 'kommen', aux: 's', en: 'to come back' },
    'zurückgeben': { p: 'zurück', base: 'geben', aux: 'h', en: 'to give back' },
  };

  // No ge- in the participle after any of these: besucht, verkauft, erklärt.
  var DE_INSEPARABLE = /^(be|emp|ent|er|ge|miss|ver|zer)/;

  /** Stem: drop -en, or just the -n of tun / sammeln / ändern. */
  function deStem(verb) {
    if (verb.slice(-2) === 'en') return verb.slice(0, -2);
    if (verb.slice(-1) === 'n') return verb.slice(0, -1);
    return verb;
  }
  /* A linking e, or the ending cannot be said: arbeit + st → arbeitest,
     find + t → findet, rechn + t → rechnet. Strong verbs that already change
     their vowel are the exception and contract instead (er hält, er lädt),
     which is handled at the call site by not asking this about those forms. */
  function deNeedsE(stem) { return /[dt]$/.test(stem) || /(chn|ffn|gn|tm|dm)$/.test(stem); }
  // Stems already ending in an s-sound take only -t in the du form: du heißt.
  function deSibilant(stem) { return /(s|ß|z|x)$/.test(stem); }

  function dePresentForms(verb) {
    if (DE_PRESENT_IRREG[verb]) return { forms: DE_PRESENT_IRREG[verb].slice(), note: 'irregular' };
    var strong = DE_STRONG[verb];
    var stem = deStem(verb);
    var changed = strong && strong.du ? strong.du : stem;
    var eln = /eln$/.test(verb), ern = /ern$/.test(verb);
    // ich: sammeln loses the e of -el (sammle); ändern keeps it (ändere).
    var ich = eln ? stem.replace(/el$/, 'l') + 'e' : stem + 'e';
    var du, er;
    if (strong && strong.du) {
      // A changed stem contracts rather than taking a linking e: du hältst.
      du = deSibilant(changed) ? changed + 't' : changed + 'st';
      er = /t$/.test(changed) ? changed : changed + 't';
    } else {
      du = deNeedsE(stem) ? stem + 'est' : deSibilant(stem) ? stem + 't' : stem + 'st';
      er = deNeedsE(stem) ? stem + 'et' : stem + 't';
    }
    // ihr never takes the vowel change: ihr haltet, ihr gebt, ihr lest.
    var ihr = deNeedsE(stem) ? stem + 'et' : stem + 't';
    var note = strong && strong.du
      ? 'stem change in du and er/sie only — ' + stem + ' → ' + changed
      : eln || ern ? 'regular, -' + verb.slice(-3) + ' type'
        : deNeedsE(stem) ? 'regular, with a linking -e- after the ' + stem.slice(-1)
          : 'regular';
    return { forms: [ich, du, er, verb, ihr, verb], note: note };
  }

  function dePratForms(verb) {
    var strong = DE_STRONG[verb];
    if (strong && strong.pratForms) return { forms: strong.pratForms.slice(), note: 'irregular' };
    if (!strong) {
      var stem = deStem(verb);
      var base = deNeedsE(stem) ? stem + 'e' : stem;
      return { forms: DE_PRAT_WEAK.map(function (e) { return base + e; }), note: 'regular — stem + -te' };
    }
    if (strong.weak) {
      return {
        forms: DE_PRAT_WEAK.map(function (e) { return strong.prat + e; }),
        note: 'mixed verb — changed stem "' + strong.prat + '-", weak -te endings',
      };
    }
    var p = strong.prat;
    /* du takes a linking e after any awkward consonant (du fandest, du lasest,
       du hieltest); ihr only after -d and -t (ihr fandet, but ihr last). */
    var duE = /[dtsßz]$/.test(p), ihrE = /[dt]$/.test(p);
    return {
      forms: DE_PRAT_STRONG.map(function (e, i) {
        if (i === 1) return p + (duE ? 'est' : 'st');
        if (i === 4) return p + (ihrE ? 'et' : 't');
        return p + e;
      }),
      note: 'strong — no ending on ich or er',
    };
  }

  function dePastParticiple(verb) {
    var sep = DE_SEPARABLE[verb];
    // The prefix sits in front of whatever the base does: auf + gestanden.
    if (sep) return sep.p + dePastParticiple(sep.base);
    var strong = DE_STRONG[verb];
    if (strong) return strong.pp;
    var stem = deStem(verb);
    var tail = (deNeedsE(stem) ? stem + 'e' : stem) + 't';
    // -ieren verbs and the inseparable prefixes never take ge-.
    if (/ieren$/.test(verb) || DE_INSEPARABLE.test(verb)) return tail;
    return 'ge' + tail;
  }

  function conjugateDe(verb, tense) {
    // Every German infinitive ends in -n. Saying so beats conjugating "haus".
    if (verb.slice(-1) !== 'n') throw new Error('German infinitives end in -en or -n. Try sprechen, fahren or arbeiten.');
    var sep = DE_SEPARABLE[verb];
    if (sep) {
      /* Conjugate the base, then put the prefix where the tense wants it: at
         the end of the clause for the present and Präteritum (ich stehe auf),
         glued to the participle for the Perfekt (ich bin aufgestanden), and
         back on the infinitive for the future (ich werde aufstehen). */
      if (tense === 'perfect') {
        var sAux = sep.aux === 's' ? DE_PRESENT_IRREG.sein : DE_PRESENT_IRREG.haben;
        var sPp = dePastParticiple(verb);
        return {
          forms: sAux.map(function (a) { return a + ' ' + sPp; }),
          note: 'takes ' + (sep.aux === 's' ? 'sein' : 'haben') + ' — the prefix joins the participle',
        };
      }
      if (tense === 'future') {
        return {
          forms: DE_PRESENT_IRREG.werden.map(function (w) { return w + ' ' + verb; }),
          note: 'werden + infinitive — the prefix stays attached',
        };
      }
      var r = tense === 'past' ? dePratForms(sep.base) : dePresentForms(sep.base);
      return {
        forms: r.forms.map(function (f) { return f + ' ' + sep.p; }),
        note: 'separable — "' + sep.p + '" goes to the end of the clause',
      };
    }

    if (tense === 'perfect') {
      var strong = DE_STRONG[verb];
      var takesSein = strong ? strong.aux === 's' : false;
      var auxForms = takesSein ? DE_PRESENT_IRREG.sein : DE_PRESENT_IRREG.haben;
      var pp = dePastParticiple(verb);
      return {
        forms: auxForms.map(function (a) { return a + ' ' + pp; }),
        note: 'takes ' + (takesSein ? 'sein — verbs of movement and change' : 'haben')
          + ', participle "' + pp + '"',
      };
    }
    if (tense === 'future') {
      return {
        forms: DE_PRESENT_IRREG.werden.map(function (w) { return w + ' ' + verb; }),
        note: 'werden + infinitive — the one tense with no exceptions',
      };
    }
    if (tense === 'past') return dePratForms(verb);
    return dePresentForms(verb);
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Normalise what someone typed: trim, lowercase, drop a leading "to ". */
  function clean(verb) {
    return String(verb == null ? '' : verb).trim().toLowerCase().replace(/^to\s+/, '');
  }

  /** Which of the three tables a language code lands in. */
  function langOf(lang) { return lang === 'fr' ? 'fr' : lang === 'de' ? 'de' : 'es'; }

  function conjugate(lang, verb, tense) {
    var l = langOf(lang);
    var v = clean(verb);
    var t = tense || 'present';
    if (!v) throw new Error('Type a verb first.');
    // ä ö ß joined the set for German; without them "heißen" is rejected as
    // punctuation and the error blames the student for a correct spelling.
    if (!/^[a-záéíóúüäößñçàâèêëîïôûùœ]+$/.test(v)) throw new Error('Letters only — one verb at a time.');
    var known = TENSES[l].some(function (x) { return x.id === t; });
    if (!known) t = 'present';
    var r = l === 'es' ? conjugateEs(v, t) : l === 'de' ? conjugateDe(v, t) : conjugateFr(v, t);
    // A tense may override the pronoun column — see the passé composé elision.
    return { lang: l, verb: v, tense: t, pronouns: r.pronouns || PRONOUNS[l].slice(), forms: r.forms, note: r.note };
  }

  /* The irregular verbs worth learning, per language.

     Only the infinitive and the English gloss are stored. Every form shown in
     the irregular-verbs list is then computed by conjugate() from the same
     tables the conjugator uses, so the list and the trainer physically cannot
     disagree — which is the failure mode a second hand-typed table invites.
     German needs no list at all: DE_STRONG already is one. */
  var ES_IRREG_LIST = [
    ['ser', 'to be (permanent)'], ['estar', 'to be (state, place)'], ['ir', 'to go'],
    ['tener', 'to have'], ['hacer', 'to do, make'], ['decir', 'to say'], ['poder', 'to be able to'],
    ['querer', 'to want'], ['saber', 'to know (a fact)'], ['conocer', 'to know (a person)'],
    ['venir', 'to come'], ['poner', 'to put'], ['salir', 'to go out'], ['dar', 'to give'],
    /* oír is missing on purpose. It is common enough to belong here, but the
       Spanish tables key on a two-letter ending and "oír" ends in "ír", so it
       is rejected before any of the irregular entries are consulted. Listing
       it would put a verb on the reference sheet that the conjugator beside it
       refuses — better absent than broken. Same for freír. */
    ['ver', 'to see'], ['traer', 'to bring'], ['caer', 'to fall'],
    ['haber', 'to have (auxiliary)'], ['pensar', 'to think'], ['empezar', 'to begin'],
    ['entender', 'to understand'], ['perder', 'to lose'], ['cerrar', 'to close'],
    ['sentir', 'to feel'], ['preferir', 'to prefer'], ['dormir', 'to sleep'],
    ['morir', 'to die'], ['volver', 'to return'], ['contar', 'to count, tell'],
    ['encontrar', 'to find'], ['recordar', 'to remember'], ['costar', 'to cost'],
    ['jugar', 'to play'], ['pedir', 'to ask for'], ['servir', 'to serve'],
    ['repetir', 'to repeat'], ['seguir', 'to follow'], ['vestir', 'to dress'],
    ['abrir', 'to open'], ['escribir', 'to write'], ['romper', 'to break'],
    ['cubrir', 'to cover'], ['andar', 'to walk'], ['caber', 'to fit'], ['valer', 'to be worth'],
  ];
  var FR_IRREG_LIST = [
    ['être', 'to be'], ['avoir', 'to have'], ['aller', 'to go'], ['faire', 'to do, make'],
    ['pouvoir', 'to be able to'], ['vouloir', 'to want'], ['devoir', 'to have to'],
    ['savoir', 'to know (a fact)'], ['connaître', 'to know (a person)'], ['voir', 'to see'],
    ['venir', 'to come'], ['tenir', 'to hold'], ['prendre', 'to take'],
    ['comprendre', 'to understand'], ['apprendre', 'to learn'], ['dire', 'to say'],
    ['lire', 'to read'], ['écrire', 'to write'], ['mettre', 'to put'], ['boire', 'to drink'],
    ['croire', 'to believe'], ['recevoir', 'to receive'], ['courir', 'to run'],
    ['mourir', 'to die'], ['vivre', 'to live'], ['suivre', 'to follow'],
    ['partir', 'to leave'], ['sortir', 'to go out'], ['dormir', 'to sleep'],
    ['sentir', 'to feel'], ['servir', 'to serve'], ['mentir', 'to lie'],
    ['ouvrir', 'to open'], ['offrir', 'to offer'], ['couvrir', 'to cover'],
    ['souffrir', 'to suffer'], ['naître', 'to be born'], ['descendre', 'to go down'],
    ['envoyer', 'to send'], ['falloir', 'to be necessary'],
  ];

  window.FluxLangEngine = {
    conjugate: conjugate,
    /** Past participle alone — the reference conjugator builds its own perfect
     *  and compound tenses from this. */
    pastParticiple: function (lang, verb) {
      var l = langOf(lang);
      var v = clean(verb);
      if (l === 'de') return dePastParticiple(v);
      if (l === 'fr') return frPastParticiple(v);
      var end = v.slice(-2);
      if (!ES_PRESENT[end]) return v;
      return ES_PP[v] || v.slice(0, -2) + (end === 'ar' ? 'ado' : 'ido');
    },
    tenses: function (lang) { return TENSES[langOf(lang)].slice(); },
    pronouns: function (lang) { return PRONOUNS[langOf(lang)].slice(); },
    /** [infinitive, English gloss] for the irregulars worth knowing. */
    irregulars: function (lang) {
      var l = langOf(lang);
      if (l === 'es') return ES_IRREG_LIST.map(function (r) { return r.slice(); });
      if (l === 'fr') return FR_IRREG_LIST.map(function (r) { return r.slice(); });
      /* German's list IS the strong-verb table, plus the separable verbs whose
         irregularity is the prefix rather than the vowel. Sorted so it reads
         as a reference sheet instead of in the order I happened to type it. */
      var out = [];
      Object.keys(DE_STRONG).forEach(function (v) { out.push([v, DE_STRONG[v].en]); });
      Object.keys(DE_SEPARABLE).forEach(function (v) { out.push([v, DE_SEPARABLE[v].en]); });
      return out.sort(function (a, b) { return a[0].localeCompare(b[0], 'de'); });
    },
    /** German principal parts: infinitive · er/sie · Präteritum · Perfekt. */
    principalParts: function (verb) {
      var v = clean(verb);
      var pres = conjugate('de', v, 'present');
      var past = conjugate('de', v, 'past');
      var perf = conjugate('de', v, 'perfect');
      return { third: pres.forms[2], past: past.forms[0], perfect: perf.forms[2] };
    },
    clean: clean,
  };
})();
