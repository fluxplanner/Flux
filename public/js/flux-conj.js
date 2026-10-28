/* ============================================================================
   FLUX CONJ  ·  flux-conj.js
   Every tense of every Spanish and French verb, offline, for Flux Lingo
   (translate.html → Conjugate).

   WHY A SECOND ENGINE
   -------------------
   flux-lang-engine.js answers the verb drill: five to seven tenses per
   language, the ones a syllabus asks for. A reference conjugator has to show
   the whole verb: the compound tenses, both imperfect subjunctives, the
   future subjunctive, the passé simple, the subjonctif imparfait, the
   imperative, the participles, reflexive forms. Bolting that onto the drill's
   engine would have meant re-deciding every one of its tested answers, so the
   reference lives here, and test/unit/conj.test.mjs checks that the two agree
   on every form they share — a drill and a conjugator that disagree teach two
   answers.

   HOW A VERB IS CONJUGATED
   ------------------------
   By model, the way Bescherelle and the RAE do it: a verb is the regular
   pattern plus the few things that make it different (a stem change, an
   irregular yo, a strong preterite, a respelling, an irregular participle).
   Those facts are listed by verb, never guessed from spelling — contar
   changes and montar does not, and nothing in the letters says which. A
   verb that is in none of the lists is conjugated by the regular pattern
   with the spelling rules that every verb of its shape follows (busqué,
   venzo, commençons, mangeons), and the page says it was not in the
   dictionary, so the student knows how sure to be.

   Other spellings that are just as right (je paie / je paye, rió / rio,
   hubiera / hubiese) are returned as `alts`, one list per person.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxConj) return;

  function set(s) { var o = {}; s.split(/\s+/).forEach(function (w) { if (w) o[w] = 1; }); return o; }
  function fold(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

  /* ══════════════════════════════════════════════════════════════════════
     SPANISH
     ══════════════════════════════════════════════════════════════════════ */

  /* Stem changes in the stressed syllable — the "boot": every form of the
     present except nosotros/vosotros. -ir verbs in these lists also change
     e→i / o→u in the preterite third persons, the gerund and the
     nosotros/vosotros of the present subjunctive (sintió, sintiendo,
     sintamos) — except the few that only ever change in the boot. */
  var ES_IE = set('acertar alentar apretar arrendar asentar atravesar calentar cegar cerrar comenzar concertar confesar ' +
    'desconcertar despertar desplegar empezar encerrar encomendar enmendar ensangrentar enterrar fregar gobernar helar ' +
    'manifestar merendar mentar negar nevar pensar plegar quebrar recomendar regar renegar restregar reventar segar sembrar ' +
    'sentar serrar sosegar temblar tentar tropezar aterrar denegar desasosegar desalentar desenterrar emparentar escarmentar ' +
    'requebrar resquebrar repensar acrecentar soterrar ' +
    'ascender atender condescender contender defender desatender descender encender entender extender heder hender ' +
    'malentender perder querer tender trascender verter sobrentender desentender ' +
    'advertir arrepentir asentir conferir consentir controvertir convertir diferir digerir divertir herir hervir inferir ' +
    'invertir mentir pervertir preferir presentir proferir referir requerir resentir revertir sentir sugerir transferir ' +
    'desmentir subvertir malherir ' +
    'discernir concernir cernir tener venir');
  /* -ir verbs whose change stays in the boot: discierne, but discernió. */
  var ES_IE_ONLY = set('discernir concernir cernir');
  var ES_UE = set('acordar acostar almorzar apostar aprobar avergonzar colar colgar comprobar concordar consolar contar ' +
    'costar degollar demostrar descontar desaprobar descolgar encontrar esforzar forzar mostrar poblar probar recontar ' +
    'recordar reforzar renovar rodar rogar soldar soltar sonar soñar tostar tronar volar volcar revolcar trocar desollar ' +
    'despoblar repoblar resonar consonar asonar acostar emporcar avergonzar descornar' +
    ' absolver cocer conmover demoler disolver doler llover moler morder mover poder promover remover resolver soler ' +
    'torcer volver escocer recocer retorcer destorcer devolver envolver revolver desenvolver' +
    ' dormir morir');
  var ES_I = set('ceñir colegir competir concebir corregir derretir despedir elegir embestir expedir gemir impedir ' +
    'investir medir pedir regir reñir rendir repetir revestir seguir conseguir perseguir proseguir servir teñir vestir ' +
    'desvestir estreñir desteñir constreñir travestir reelegir decir rehenchir henchir');

  /* Verbs whose yo alone is irregular — the "go" verbs and friends. The
     present subjunctive is built from it (tengo → tenga, tengamos). */
  var ES_YO = {
    tener: 'tengo', venir: 'vengo', poner: 'pongo', salir: 'salgo', hacer: 'hago', decir: 'digo', traer: 'traigo',
    caer: 'caigo', raer: 'raigo', valer: 'valgo', caber: 'quepo', saber: 'sé', asir: 'asgo', yacer: 'yazgo',
  };

  /* -iar and -uar verbs whose i or u is stressed in the boot (envío,
     continúo). cambiar and averiguar keep the stress on the a, and nothing in
     the spelling says which, so the stressed ones are listed. */
  var ES_IU = set('enviar esquiar confiar desconfiar ampliar vaciar variar espiar desviar enfriar resfriar averiar ' +
    'contrariar extraviar fotografiar telegrafiar hastiar chirriar desafiar expiar inventariar rociar porfiar amnistiar ' +
    'ataviar aliar aviar desliar ansiar arriar autografiar cartografiar caligrafiar coreografiar escalofriar estriar ' +
    'malcriar radiografiar vigiar guiar criar fiar liar piar' +
    ' continuar actuar graduar evaluar situar acentuar efectuar habituar insinuar perpetuar puntuar devaluar valuar ' +
    'tatuar conceptuar exceptuar fluctuar atenuar menstruar redituar individuar avaluar desvirtuar');
  /* Forms of these with a one-syllable stem (crie, crio, guie, fie) lost
     their accent in the 2010 rules; textbooks still print crié and crió, so
     both are given. */
  var ES_IU_MONO = set('guiar criar fiar liar piar');
  /* A stressed i or u that is not the last vowel of the stem: reúno,
     prohíbo, aíslo. */
  var ES_HIATUS = { reunir: 'u', prohibir: 'i', aislar: 'i', rehusar: 'u', ahumar: 'u', aullar: 'u', maullar: 'u',
    cohibir: 'i', enraizar: 'i', rehilar: 'i', ahijar: 'i', ahincar: 'i', airar: 'i', amohinar: 'i', aunar: 'u',
    embaular: 'u', rehundir: 'u', reusar: 'u' };

  var ES_ZC_EXCEPT = set('hacer deshacer rehacer satisfacer contrahacer cocer recocer escocer mecer torcer retorcer destorcer');

  /* Strong preterites: an irregular stem and one unstressed ending set. */
  var ES_PRET = { tener: 'tuv', poder: 'pud', poner: 'pus', saber: 'sup', hacer: 'hic', querer: 'quis', venir: 'vin',
    caber: 'cup', andar: 'anduv', estar: 'estuv', haber: 'hub', decir: 'dij', traer: 'traj' };
  var ES_FUT = { tener: 'tendr', venir: 'vendr', poner: 'pondr', salir: 'saldr', valer: 'valdr', poder: 'podr',
    saber: 'sabr', caber: 'cabr', haber: 'habr', querer: 'querr', hacer: 'har', decir: 'dir' };
  var ES_PP = { hacer: 'hecho', decir: 'dicho', ver: 'visto', poner: 'puesto', volver: 'vuelto', resolver: 'resuelto',
    absolver: 'absuelto', disolver: 'disuelto', morir: 'muerto', abrir: 'abierto', cubrir: 'cubierto',
    escribir: 'escrito', romper: 'roto', imprimir: 'impreso', freír: 'frito', pudrir: 'podrido', satisfacer: 'satisfecho' };
  var ES_TU = { decir: 'di', hacer: 'haz', ir: 've', poner: 'pon', salir: 'sal', ser: 'sé', tener: 'ten', venir: 'ven' };

  /* Compounds: a prefix on a verb the tables know, conjugated exactly like it.
     Listed, never spotted: "entender" is not en + tender. */
  var ES_COMPOUND = {};
  function compounds(base, list) { list.split(/\s+/).forEach(function (v) { if (v) ES_COMPOUND[v] = base; }); }
  compounds('tener', 'obtener mantener contener detener retener sostener entretener abstener atener');
  compounds('poner', 'componer proponer suponer disponer exponer imponer oponer reponer posponer descomponer deponer ' +
    'anteponer interponer presuponer yuxtaponer contraponer sobreponer superponer trasponer transponer recomponer ' +
    'predisponer indisponer');
  compounds('venir', 'prevenir convenir intervenir provenir devenir sobrevenir avenir contravenir reconvenir subvenir');
  compounds('hacer', 'deshacer rehacer contrahacer satisfacer');
  compounds('decir', 'predecir contradecir desdecir bendecir maldecir');
  compounds('traer', 'atraer contraer distraer extraer sustraer retraer abstraer detraer');
  compounds('volver', 'envolver revolver devolver desenvolver');
  compounds('mover', 'conmover promover remover');
  compounds('salir', 'sobresalir');
  compounds('valer', 'equivaler prevaler');
  compounds('caer', 'decaer recaer');
  compounds('ver', 'entrever');
  compounds('oír', 'desoír entreoír');
  compounds('reír', 'sonreír');
  compounds('escribir', 'describir inscribir prescribir suscribir subscribir transcribir proscribir adscribir circunscribir manuscribir reescribir');
  compounds('abrir', 'entreabrir reabrir');
  compounds('cubrir', 'descubrir encubrir recubrir');
  compounds('querer', 'bienquerer malquerer');
  compounds('andar', 'desandar');
  compounds('tener', 'atener');
  compounds('poder', '');
  compounds('morir', 'premorir');
  compounds('imprimir', 'reimprimir');
  compounds('romper', '');
  compounds('caber', '');
  compounds('saber', 'resaber');
  compounds('estar', '');

  /* Whole verbs no rule above derives. Any tense listed here wins. */
  var ES_FULL = {
    ser: { present: 'soy eres es somos sois son', preterite: 'fui fuiste fue fuimos fuisteis fueron',
      imperfect: 'era eras era éramos erais eran', subjPresent: 'sea seas sea seamos seáis sean', pp: 'sido', ger: 'siendo' },
    estar: { present: 'estoy estás está estamos estáis están', subjPresent: 'esté estés esté estemos estéis estén' },
    ir: { present: 'voy vas va vamos vais van', preterite: 'fui fuiste fue fuimos fuisteis fueron',
      imperfect: 'iba ibas iba íbamos ibais iban', subjPresent: 'vaya vayas vaya vayamos vayáis vayan', ger: 'yendo' },
    haber: { present: 'he has ha hemos habéis han', subjPresent: 'haya hayas haya hayamos hayáis hayan' },
    dar: { present: 'doy das da damos dais dan', preterite: 'di diste dio dimos disteis dieron',
      subjPresent: 'dé des dé demos deis den' },
    ver: { present: 'veo ves ve vemos veis ven', preterite: 'vi viste vio vimos visteis vieron',
      imperfect: 'veía veías veía veíamos veíais veían' },
    prever: { present: 'preveo prevés prevé prevemos prevéis prevén', preterite: 'preví previste previó previmos previsteis previeron',
      imperfect: 'preveía preveías preveía preveíamos preveíais preveían', pp: 'previsto' },
    saber: { subjPresent: 'sepa sepas sepa sepamos sepáis sepan' },
    oír: { present: 'oigo oyes oye oímos oís oyen', preterite: 'oí oíste oyó oímos oísteis oyeron', ger: 'oyendo', tu: 'oye' },
    reír: { present: 'río ríes ríe reímos reís ríen', preterite: 'reí reíste rió reímos reísteis rieron',
      subjPresent: 'ría rías ría riamos riáis rían', ger: 'riendo', tu: 'ríe' },
    freír: { present: 'frío fríes fríe freímos freís fríen', preterite: 'freí freíste frió freímos freísteis frieron',
      subjPresent: 'fría frías fría friamos friáis frían', ger: 'friendo', tu: 'fríe' },
    oler: { present: 'huelo hueles huele olemos oléis huelen', subjPresent: 'huela huelas huela olamos oláis huelan', tu: 'huele' },
    errar: { present: 'yerro yerras yerra erramos erráis yerran', subjPresent: 'yerre yerres yerre erremos erréis yerren', tu: 'yerra' },
    adquirir: { present: 'adquiero adquieres adquiere adquirimos adquirís adquieren',
      subjPresent: 'adquiera adquieras adquiera adquiramos adquiráis adquieran', tu: 'adquiere' },
    inquirir: { present: 'inquiero inquieres inquiere inquirimos inquirís inquieren',
      subjPresent: 'inquiera inquieras inquiera inquiramos inquiráis inquieran', tu: 'inquiere' },
    jugar: { present: 'juego juegas juega jugamos jugáis juegan', subjPresent: 'juegue juegues juegue juguemos juguéis jueguen', tu: 'juega' },
    erguir: { present: 'yergo yergues yergue erguimos erguís yerguen', preterite: 'erguí erguiste irguió erguimos erguisteis irguieron',
      subjPresent: 'yerga yergas yerga irgamos irgáis yergan', ger: 'irguiendo', tu: 'yergue' },
    argüir: { present: 'arguyo arguyes arguye argüimos argüís arguyen', preterite: 'argüí argüiste arguyó argüimos argüisteis arguyeron',
      subjPresent: 'arguya arguyas arguya arguyamos arguyáis arguyan', ger: 'arguyendo', tu: 'arguye' },
    podrir: { present: 'pudro pudres pudre pudrimos pudrís pudren', preterite: 'pudrí pudriste pudrió pudrimos pudristeis pudrieron',
      imperfect: 'pudría pudrías pudría pudríamos pudríais pudrían', subjPresent: 'pudra pudras pudra pudramos pudráis pudran',
      ger: 'pudriendo', tu: 'pudre', pp: 'podrido' },
    rehacer: { preterite: 'rehíce rehiciste rehízo rehicimos rehicisteis rehicieron' },
  };
  var ES_ALTS = {
    reír: { preterite: [[], [], ['rio'], [], [], []], subjPresent: [[], [], [], [], ['riais'], []] },
    freír: { preterite: [[], [], ['frio'], [], [], []], subjPresent: [[], [], [], [], ['friais'], []] },
    erguir: { present: [['irgo'], ['irgues'], ['irgue'], [], [], ['irguen']], subjPresent: [['irga'], ['irgas'], ['irga'], [], [], ['irgan']] },
    raer: { present: [['rayo'], [], [], [], [], []] },
  };

  /* ── Spanish helpers ───────────────────────────────────────────────── */

  function esEnd(v) { return fold(v.slice(-2)); }
  function esStemKind(v) {
    if (ES_I[v]) return 'i';
    if (ES_IE[v]) return 'ie';
    if (ES_UE[v]) return 'ue';
    return null;
  }
  /** Change the LAST e (or o) of the stem: entender → entiend-, not intend-. */
  function esChange(stem, kind) {
    var from = kind === 'ue' || kind === 'u' ? 'o' : 'e';
    var to = { ie: 'ie', ue: 'ue', i: 'i', u: 'u' }[kind];
    var at = stem.lastIndexOf(from);
    if (at === -1) return stem;
    var out = stem.slice(0, at) + to + stem.slice(at + 1);
    // o→ue at the start of a word is written hue- (oler is in ES_FULL);
    // after g it needs a diaeresis to keep the u sounded: avergüenzo, degüello.
    if (to === 'ue' && out.charAt(at - 1) === 'g') out = out.slice(0, at) + 'üe' + out.slice(at + 2);
    return out;
  }
  /** The weaker change -ir stem-changers take outside the boot. */
  function esWeak(v, stem) {
    if (esEnd(v) !== 'ir' || ES_IE_ONLY[v]) return stem;
    var k = esStemKind(v);
    if (k === 'ue') return esChange(stem, 'u');
    if (k === 'ie' || k === 'i') return esChange(stem, 'i');
    return stem;
  }
  function esOrth(v) {
    if (/ducir$/.test(v)) return 'zc';
    if (/c(er|ir)$/.test(v)) {
      if (ES_ZC_EXCEPT[v] || /decir$/.test(v)) return /cocer$|torcer$|mecer$/.test(v) ? 'z' : null;
      return /[aeiouáéíóú]c(er|ir)$/.test(v) ? 'zc' : 'z';
    }
    if (/guir$/.test(v)) return 'g';
    if (/quir$/.test(v)) return 'c';
    if (/g(er|ir)$/.test(v)) return 'j';
    return null;
  }
  /** Respell before an ending in a or o, to keep the sound of the infinitive. */
  function esBack(stem, kind) {
    if (kind === 'zc') return stem.replace(/c$/, 'zc');
    if (kind === 'z') return stem.replace(/c$/, 'z');
    if (kind === 'j') return stem.replace(/g$/, 'j');
    if (kind === 'g') return stem.replace(/gu$/, 'g');
    if (kind === 'c') return stem.replace(/qu$/, 'c');
    return stem;
  }
  /** Respell before an ending in e: busque, llegue, empiece, averigüe. */
  function esFront(stem, v) {
    if (/car$/.test(v)) return stem.replace(/c$/, 'qu');
    if (/guar$/.test(v)) return stem.replace(/gu$/, 'gü');
    if (/gar$/.test(v)) return stem.replace(/g$/, 'gu');
    if (/zar$/.test(v)) return stem.replace(/z$/, 'c');
    return stem;
  }
  function esIsUir(v) { return /uir$/.test(v) && !/[gq]uir$/.test(v); }
  function esIsVowel(v) { return /[aeo]er$/.test(v) && !/[qg]uer$/.test(v) || /[aeo]ír$/.test(v); }
  /** -ñer, -ñir, -llir: the i of -ió/-ieron/-iendo is swallowed (gruñó, bulló). */
  function esSwallow(v) { return /(ñ|ll|ch)(er|ir)$/.test(v); }
  /** Put the written accent on the stressed i or u of the stem. */
  function esAccentLast(stem, vowel) {
    var at = stem.lastIndexOf(vowel);
    return at === -1 ? stem : stem.slice(0, at) + ACUTE[vowel] + stem.slice(at + 1);
  }
  function words(s) { return s.split(' '); }

  /* Stress, for clitics: levanta + te → levántate. A form gets a written
     accent when the stress ends up three syllables or more from the end. */
  var STRONG = /[aeoáéíóú]/;
  function nuclei(w) {
    var out = [], i = 0, s = w.toLowerCase();
    while (i < s.length) {
      var c = s[i];
      // u after q and g before e/i is a letter, not a vowel: que, gui.
      if (c === 'u' && i > 0 && /[qg]/.test(s[i - 1]) && /[eéií]/.test(s[i + 1] || '')) { i++; continue; }
      if (/[aeiouáéíóúü]/.test(c)) {
        var j = i, run = '';
        while (j < s.length && /[aeiouáéíóúü]/.test(s[j])) { run += s[j]; j++; }
        // Split the run into syllable nuclei: two strong vowels never share one.
        var start = i, k = 0;
        while (k < run.length) {
          var len = 1;
          if (k + 1 < run.length && !(STRONG.test(run[k]) && STRONG.test(run[k + 1]))) {
            len = 2;
            if (k + 2 < run.length && !STRONG.test(run[k + 2]) && STRONG.test(run[k + 1])) len = 3;
          }
          var piece = run.substr(k, len), pos = start + k;
          // The nucleus vowel: the accented one, else a strong one, else the last.
          var m = piece.search(/[áéíóú]/);
          if (m === -1) m = piece.search(/[aeo]/);
          if (m === -1) m = piece.length - 1;
          out.push(pos + m);
          k += len;
        }
        i = j;
        continue;
      }
      i++;
    }
    return out;
  }
  function stressAt(w) {
    var n = nuclei(w);
    if (!n.length) return -1;
    var acc = w.search(/[áéíóú]/);
    if (acc !== -1) return acc;
    var last = w.slice(-1);
    return /[aeiouns]/.test(last) && n.length > 1 ? n[n.length - 2] : n[n.length - 1];
  }
  function attach(form, clitic) {
    var at = stressAt(form);
    var joined = form + clitic;
    if (at === -1) return joined;
    var n = nuclei(joined);
    var idx = n.indexOf(at);
    var fromEnd = n.length - idx;
    if (fromEnd >= 3 && !/[áéíóú]/.test(form)) {
      var ch = joined[at];
      joined = joined.slice(0, at) + (ACUTE[ch] || ch) + joined.slice(at + 1);
    }
    return joined;
  }

  /* ── Spanish core: one verb, every simple tense ────────────────────── */

  var ES_PRES = { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] };
  var ES_PRET_END = { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] };
  ES_PRET_END.ir = ES_PRET_END.er;
  var ES_IMPF = { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] };
  ES_IMPF.ir = ES_IMPF.er;
  var ES_SUBJ_END = { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'] };
  ES_SUBJ_END.ir = ES_SUBJ_END.er;

  /** `plain` ignores every list: the regular pattern alone, for marking what is irregular. */
  function esSimple(v, plain) {
    var end = esEnd(v);
    var stem = v.slice(0, -2);
    var full = !plain && ES_FULL[v] || {};
    var kind = plain ? null : esStemKind(v);
    // The plain pattern skips spelling rules too, so busqué, cojo, leyó and huyo
    // are marked like any other form that breaks the pattern.
    var orth = plain ? null : esOrth(v);
    var uir = !plain && esIsUir(v);
    var vowel = !plain && esIsVowel(v);
    var swallow = !plain && esSwallow(v);
    var front = plain ? function (x) { return x; } : esFront;
    var t = {};

    // Present.
    var boot = kind ? esChange(stem, kind) : stem;
    if (!plain && ES_IU[v]) boot = esAccentLast(boot, /u$/.test(boot) ? 'u' : 'i');
    if (!plain && ES_HIATUS[v]) boot = esAccentLast(boot, ES_HIATUS[v]);
    t.present = ES_PRES[end].map(function (e, i) {
      var inBoot = i !== 3 && i !== 4;
      var s = inBoot ? boot : stem;
      if (uir && inBoot) s += 'y';
      if (i === 0) s = esBack(s, orth);
      return s + e;
    });
    if (!plain && ES_YO[v]) t.present[0] = ES_YO[v];
    if (full.present) t.present = words(full.present);

    // Preterite.
    var strong = !plain && (ES_PRET[v] || (/ducir$/.test(v) ? v.slice(0, -3) + 'j' : null));
    if (strong) {
      var isJ = /j$/.test(strong);
      t.preterite = ['e', 'iste', 'o', 'imos', 'isteis', isJ ? 'eron' : 'ieron'].map(function (e) { return strong + e; });
      if (v === 'hacer') t.preterite[2] = 'hizo';
    } else {
      var third = plain ? stem : esWeak(v, stem);
      t.preterite = ES_PRET_END[end].map(function (e, i) {
        var s = (i === 2 || i === 5) ? third : stem;
        if (i === 0 && end === 'ar') return front(s, v) + e;
        if ((i === 2 || i === 5) && end !== 'ar') {
          if (uir || vowel) return s + (i === 2 ? 'yó' : 'yeron');
          if (swallow) return s + (i === 2 ? 'ó' : 'eron');
        }
        if (vowel && end !== 'ar') return s + e.replace(/^i/, 'í');
        return s + e;
      });
    }

    // Imperfect.
    t.imperfect = ES_IMPF[end].map(function (e) { return stem + e; });

    // Future and conditional join the whole infinitive (accent off reír → reiré).
    var fut = !plain && ES_FUT[v] || v.replace(/í(r)$/, 'i$1');
    t.future = ['é', 'ás', 'á', 'emos', 'éis', 'án'].map(function (e) { return fut + e; });
    t.conditional = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'].map(function (e) { return fut + e; });

    // Present subjunctive: from the yo when the yo is truly irregular
    // (tengo → tenga, tengamos), otherwise the boot plus the -ir weak change.
    var yo = t.present[0];
    // ver → veo → vea; oír → oigo → oiga: a written-out present counts too.
    var trueYo = !plain && /o$/.test(yo) && (ES_YO[v] || full.present) && !full.subjPresent;
    var ends = ES_SUBJ_END[end];
    t.subjPresent = ends.map(function (e, i) {
      var inBoot = i !== 3 && i !== 4;
      var s;
      if (trueYo) s = yo.slice(0, -1);
      else {
        s = inBoot ? boot : (plain ? stem : esWeak(v, stem));
        if (uir) s += 'y';
        s = end === 'ar' ? front(s, v) : esBack(s, orth);
      }
      return s + e;
    });

    // Imperfect and future subjunctive: from the preterite ellos, minus -ron.
    var b = t.preterite[5].slice(0, -3);
    var bAcc = b.replace(/([aeiou])([^aeiou]*)$/, function (m, vv, rest) { return ACUTE[vv] + rest; });
    t.subjImperfect = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'].map(function (e, i) { return (i === 3 ? bAcc : b) + e; });
    t.subjImperfectSe = ['se', 'ses', 'se', 'semos', 'seis', 'sen'].map(function (e, i) { return (i === 3 ? bAcc : b) + e; });
    t.subjFuture = ['re', 'res', 're', 'remos', 'reis', 'ren'].map(function (e, i) { return (i === 3 ? bAcc : b) + e; });

    // Gerund and participle.
    var gstem = plain ? stem : esWeak(v, stem);
    if (!plain && (v === 'poder')) gstem = 'pud';
    var ger;
    if (end === 'ar') ger = stem + 'ando';
    else if (uir || vowel) ger = gstem + 'yendo';
    else if (swallow) ger = gstem + 'endo';
    else ger = gstem + 'iendo';
    var pp = !plain && ES_PP[v] || (end === 'ar' ? stem + 'ado' : stem + (/[aeo]$/.test(stem) ? 'ído' : 'ido'));

    // Imperative: tú from the él present, vosotros from the infinitive, the rest from the subjunctive.
    var tu = !plain && (full.tu || ES_TU[v]) || t.present[2];
    if (!plain && ES_HIATUS[v]) tu = t.present[2];
    var vos = v.replace(/r$/, 'd').replace(/íd$/, 'íd');

    Object.keys(full).forEach(function (k) {
      if (k === 'pp') pp = full.pp;
      else if (k === 'ger') ger = full.ger;
      else if (k !== 'tu') t[k] = words(full[k]);
    });
    // Tenses built from one that was replaced follow it.
    if (full.preterite) {
      var b2 = t.preterite[5].slice(0, -3);
      var b2a = b2.replace(/([aeiou])([^aeiou]*)$/, function (m, vv, rest) { return ACUTE[vv] + rest; });
      t.subjImperfect = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'].map(function (e, i) { return (i === 3 ? b2a : b2) + e; });
      t.subjImperfectSe = ['se', 'ses', 'se', 'semos', 'seis', 'sen'].map(function (e, i) { return (i === 3 ? b2a : b2) + e; });
      t.subjFuture = ['re', 'res', 're', 'remos', 'reis', 'ren'].map(function (e, i) { return (i === 3 ? b2a : b2) + e; });
    }
    if (full.present && !full.tu && !ES_TU[v]) tu = t.present[2];

    return { t: t, ger: ger, pp: pp, tu: tu, vos: vos };
  }

  var ES_HABER = {
    present: 'he has ha hemos habéis han', imperfect: 'había habías había habíamos habíais habían',
    preterite: 'hube hubiste hubo hubimos hubisteis hubieron', future: 'habré habrás habrá habremos habréis habrán',
    conditional: 'habría habrías habría habríamos habríais habrían', subjPresent: 'haya hayas haya hayamos hayáis hayan',
    subjImperfect: 'hubiera hubieras hubiera hubiéramos hubierais hubieran',
    subjImperfectSe: 'hubiese hubieses hubiese hubiésemos hubieseis hubiesen',
    subjFuture: 'hubiere hubieres hubiere hubiéremos hubiereis hubieren',
  };

  var ES_GROUPS = [
    { id: 'ind', name: 'Indicative', tenses: [
      ['present', 'Present', 'hablo', 'Now, habits, general truths.'],
      ['preterite', 'Preterite', 'hablé', 'A finished action at a point in the past.'],
      ['imperfect', 'Imperfect', 'hablaba', 'Used to / was doing; background and description.'],
      ['future', 'Future', 'hablaré', 'Will do; also guesses about now (¿Dónde estará?).'],
      ['conditional', 'Conditional', 'hablaría', 'Would do; polite requests.'],
    ] },
    { id: 'indc', name: 'Indicative · compound', tenses: [
      ['perfect', 'Present perfect', 'he hablado', 'Have done (Spain: also today’s past).'],
      ['pluperfect', 'Pluperfect', 'había hablado', 'Had done, before another past action.'],
      ['pastAnterior', 'Past anterior', 'hube hablado', 'Literary: had done, right before.'],
      ['futurePerfect', 'Future perfect', 'habré hablado', 'Will have done.'],
      ['conditionalPerfect', 'Conditional perfect', 'habría hablado', 'Would have done.'],
    ] },
    { id: 'subj', name: 'Subjunctive', tenses: [
      ['subjPresent', 'Present', 'que hable', 'After wishes, doubts, emotions, ojalá, para que.'],
      ['subjImperfect', 'Imperfect (-ra)', 'que hablara', 'Past subjunctive; si clauses (si tuviera…).'],
      ['subjImperfectSe', 'Imperfect (-se)', 'que hablase', 'Same meaning as -ra, more written.'],
      ['subjFuture', 'Future', 'que hablare', 'Legal and old texts only.'],
    ] },
    { id: 'subjc', name: 'Subjunctive · compound', tenses: [
      ['subjPerfect', 'Present perfect', 'que haya hablado', 'That … has done.'],
      ['subjPluperfect', 'Pluperfect', 'que hubiera hablado', 'Had done; si hubiera sabido…'],
      ['subjFuturePerfect', 'Future perfect', 'que hubiere hablado', 'Legal and old texts only.'],
    ] },
    { id: 'imp', name: 'Imperative', tenses: [
      ['impAffirmative', 'Affirmative', '¡habla!', 'Commands: do it.'],
      ['impNegative', 'Negative', '¡no hables!', 'Commands: don’t do it.'],
    ] },
  ];
  var ES_PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
  var ES_IMP_PERSONS = ['', 'tú', 'usted', 'nosotros', 'vosotros', 'ustedes'];
  var ES_REFL = ['me', 'te', 'se', 'nos', 'os', 'se'];

  /** Put a compound's prefix on the last word: "he tenido" → "he obtenido". */
  function prefixLast(pre, form) {
    if (form == null) return form;
    var at = form.lastIndexOf(' ');
    return at === -1 ? pre + form : form.slice(0, at + 1) + pre + form.slice(at + 1);
  }

  function esConjugate(input) {
    var raw = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var refl = false;
    var v = raw;
    if (/se$/.test(v) && /(ar|er|ir|ír)se$/.test(v)) { refl = true; v = v.slice(0, -2); }
    v = esResolve(v);
    if (!/(ar|er|ir|ír)$/.test(v)) return null;
    var base = ES_COMPOUND[v], pre = '';
    var core;
    if (base) {
      pre = v === 'satisfacer' ? 'satis' : v.slice(0, v.length - base.length);
      core = esSimple(base, false);
      // satisfacer is satis + facer, the old spelling of hacer: satisfago, satisfice.
      var sub = function (f) { return f == null ? f : pre + (v === 'satisfacer' ? f.replace(/^h/, 'f') : f); };
      Object.keys(core.t).forEach(function (k) { core.t[k] = core.t[k].map(sub); });
      core.ger = sub(core.ger); core.pp = sub(core.pp); core.vos = sub(core.vos);
      // A prefixed one-syllable imperative takes an accent: obtén, propón, prevén.
      if (base === 'decir') {
        core.tu = pre + 'dice';
        // bendecir and maldecir keep a regular future and participle: bendeciré, bendecido.
        if (/^(ben|mal)$/.test(pre)) {
          core.pp = pre + 'decido';
          core.t.future = esSimple(v, true).t.future;
          core.t.conditional = esSimple(v, true).t.conditional;
        }
      } else if (/^(ten|ven|pon)$/.test(core.tu)) core.tu = pre + core.tu.replace('e', 'é').replace('o', 'ó');
      else core.tu = sub(core.tu);
      if (ES_FULL[v]) Object.keys(ES_FULL[v]).forEach(function (k) { core.t[k] = words(ES_FULL[v][k]); });
    } else {
      core = esSimple(v, false);
    }
    var plain = esSimple(v, true);
    var t = core.t;
    var haber = {};
    Object.keys(ES_HABER).forEach(function (k) { haber[k] = words(ES_HABER[k]); });
    var pp = core.pp;
    var comp = function (k) { return haber[k].map(function (h) { return h + ' ' + pp; }); };
    t.perfect = comp('present'); t.pluperfect = comp('imperfect'); t.pastAnterior = comp('preterite');
    t.futurePerfect = comp('future'); t.conditionalPerfect = comp('conditional');
    t.subjPerfect = comp('subjPresent'); t.subjPluperfect = comp('subjImperfect'); t.subjFuturePerfect = comp('subjFuture');

    var s = t.subjPresent;
    t.impAffirmative = [null, core.tu, s[2], v === 'ir' ? 'vamos' : s[3], v === 'ir' ? 'id' : core.vos, s[5]];
    t.impNegative = [null, 'no ' + s[1], 'no ' + s[2], 'no ' + s[3], 'no ' + s[4], 'no ' + s[5]];

    var alts = {};
    var al = ES_ALTS[v];
    if (al) Object.keys(al).forEach(function (k) { alts[k] = al[k].map(function (a) { return a.slice(); }); });
    if (ES_IU_MONO[v]) {
      // 2010 rules: crie, crio, guiais; textbooks: crié, crió, guiáis.
      alts.preterite = [[], [], [], [], [], []];
      alts.present = [[], [], [], [], [t.present[4].replace('á', 'a')], []];
      alts.preterite[0] = [fold(t.preterite[0])];
      alts.preterite[2] = [fold(t.preterite[2])];
    }
    alts.subjPluperfect = t.subjPluperfect.map(function (f, i) { return [words(ES_HABER.subjImperfectSe)[i] + ' ' + pp]; });
    if (v === 'freír') alts.perfect = haber.present.map(function (h) { return [h + ' freído']; });
    if (v === 'satisfacer') alts.impAffirmative = [[], ['satisface'], [], [], [], []];
    if (/^(pre|contra|des)decir$/.test(v)) {
      alts.future = esSimple(v, true).t.future.map(function (f) { return [f]; });
      alts.conditional = esSimple(v, true).t.conditional.map(function (f) { return [f]; });
    }

    var inf = v;
    var ger = core.ger;
    if (refl) {
      t = esReflexive(t);
      inf = v + 'se';
      ger = attach(core.ger, 'se');
      Object.keys(alts).forEach(function (k) {
        alts[k] = alts[k].map(function (a, i) { return a.map(function (f) { return ES_REFL[i] + ' ' + f; }); });
      });
    }

    // Irregular = not what the plain pattern gives.
    var irregular = {};
    Object.keys(t).forEach(function (k) {
      var p = plain.t[k];
      if (!p) return;
      irregular[k] = t[k].map(function (f, i) {
        if (f == null) return false;
        var bare = refl ? f.replace(/^(me|te|se|nos|os) /, '') : f;
        return bare !== p[i];
      });
    });
    var ppIrr = core.pp !== plain.pp, gerIrr = core.ger !== plain.ger;

    return {
      lang: 'es', infinitive: inf, base: v, reflexive: refl, gerund: ger, participle: pp,
      gerundIrregular: gerIrr, participleIrregular: ppIrr,
      tenses: t, alts: alts, irregular: irregular,
      model: base ? base : null,
      known: esKnown(v),
      notes: esNotes(v, core, plain),
    };
  }

  function esReflexive(t) {
    var out = {};
    Object.keys(t).forEach(function (k) {
      if (k === 'impAffirmative') {
        var a = t[k];
        /* vosotros drops its d (levantaos), except idos; an -ir verb's i then
           keeps its stress with an accent (vestíos). nosotros drops its s. */
        var vos = a[4] === 'id' ? 'idos' : /id$/.test(a[4]) ? a[4].replace(/id$/, 'íos') : a[4].replace(/d$/, '') + 'os';
        out[k] = [null, attach(a[1], 'te'), attach(a[2], 'se'), attach(a[3].replace(/s$/, ''), 'nos'), vos, attach(a[5], 'se')];
      } else if (k === 'impNegative') {
        out[k] = t[k].map(function (f, i) { return f == null ? f : f.replace(/^no /, 'no ' + ES_REFL[i] + ' '); });
      } else {
        out[k] = t[k].map(function (f, i) { return f == null ? f : ES_REFL[i] + ' ' + f; });
      }
    });
    return out;
  }

  function esKnown(v) {
    return !!(ES_FULL[v] || ES_COMPOUND[v] || ES_IE[v] || ES_UE[v] || ES_I[v] || ES_YO[v] || ES_PRET[v] || ES_PP[v] ||
      ES_IU[v] || ES_HIATUS[v] || ES_FUT[v] || (LEX.es && LEX.es[v]));
  }
  function esNotes(v, core, plain) {
    var n = [];
    var k = esStemKind(v) || (ES_COMPOUND[v] && esStemKind(ES_COMPOUND[v]));
    if (k) n.push('Stem change ' + (k === 'ie' ? 'e → ie' : k === 'ue' ? 'o → ue' : 'e → i') + ' in the stressed syllable (not nosotros/vosotros).');
    if (v === 'jugar') n.push('The only u → ue verb: juego, juegas…');
    if (ES_YO[v] || (ES_COMPOUND[v] && ES_YO[ES_COMPOUND[v]])) n.push('Irregular yo: ' + core.t.present[0] + ' — carried into the whole present subjunctive.');
    var o = esOrth(v);
    if (o && !ES_YO[v]) n.push('Spelling change to keep the sound: ' + core.t.present[0] + '.');
    if (/(car|gar|zar|guar)$/.test(v)) n.push('Spelling change before e: ' + core.t.preterite[0] + ', que ' + core.t.subjPresent[0] + '.');
    if (ES_PRET[v] || /ducir$/.test(v)) n.push('Strong preterite: ' + core.t.preterite[0] + ' (no accent).');
    if (ES_FUT[v]) n.push('Irregular future/conditional stem: ' + core.t.future[0].slice(0, -1) + '-.');
    if (core.pp !== plain.pp) n.push('Irregular past participle: ' + core.pp + '.');
    if (esIsUir(v)) n.push('-uir verb: y before a, e, o (construyo, construyó).');
    if (ES_IU[v] || ES_HIATUS[v]) n.push('The stressed vowel takes an accent: ' + core.t.present[0] + '.');
    if (ES_COMPOUND[v]) n.push('Conjugated like ' + ES_COMPOUND[v] + '.');
    return n;
  }

  /* ══════════════════════════════════════════════════════════════════════
     FRENCH
     ══════════════════════════════════════════════════════════════════════ */

  var FR_ETRE = set('aller venir devenir revenir parvenir survenir intervenir advenir provenir redevenir arriver partir ' +
    'repartir entrer rentrer sortir ressortir rester tomber retomber retourner naître renaître mourir monter remonter ' +
    'descendre redescendre passer repasser décéder apparaître éclore');
  /* With a direct object these take avoir: il a sorti la poubelle. */
  var FR_ETRE_BOTH = set('monter remonter descendre redescendre sortir ressortir rentrer retourner passer repasser');
  var FR_H_ASPIRE = set('haïr hacher hâter hanter harceler hasarder hausser heurter hisser hocher honnir hurler huer ' +
    'harasser harponner hennir hérisser houspiller hululer haleter handicaper happer haranguer hiérarchiser ' +
    'hanter haler harnacher hâler hacher hachurer hennir hérisser');
  /* -eler / -eter verbs that take è instead of doubling (traditional spelling). */
  var FR_E_GRAVE = set('acheter racheter geler congeler dégeler surgeler peler modeler ciseler démanteler écarteler ' +
    'marteler haleter crocheter fureter déceler receler celer harceler corseter encasteler');
  var FR_TWO = set('répartir impartir assortir asservir désassortir');

  function frElide(next) { return /^[aeiouyâàäéèêëîïôöûùüœh]/i.test(next); }

  var FR_PRES_ER = ['e', 'es', 'e', 'ons', 'ez', 'ent'];
  var PS = {
    a: ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'],
    i: ['is', 'is', 'it', 'îmes', 'îtes', 'irent'],
    u: ['us', 'us', 'ut', 'ûmes', 'ûtes', 'urent'],
    in: ['ins', 'ins', 'int', 'înmes', 'întes', 'inrent'],
  };
  var CIRC = { a: 'â', i: 'î', u: 'û', e: 'ê' };

  /* -cer and -ger keep their soft sound before a and o: commençons, mangeons. */
  function frJoin(stem, end, v) {
    if (/cer$/.test(v) && /c$/.test(stem) && /^[aoâ]/.test(end)) return stem.slice(0, -1) + 'ç' + end;
    if (/ger$/.test(v) && /g$/.test(stem) && /^[aoâ]/.test(end)) return stem + 'e' + end;
    return stem + end;
  }

  /* First group: the stem a silent ending gets (lève, appelle, jette, cède,
     emploie), and the stem of the future (lèverai, appellerai, emploierai). */
  function frErStems(v) {
    var stem = v.slice(0, -2);
    var silent = stem, fut = v, alt = null, futAlt = null, note = null;
    var m;
    if ((m = stem.match(/^(.*)e(l|t)$/)) && !FR_E_GRAVE[v]) {
      silent = stem + stem.slice(-1); fut = silent + 'er'; note = 'doubles the consonant before a silent e: ' + silent + 'e';
      if (!/^(appel|rappel|jet|rejet|projet|interjet|déjet|surjet|épel)$/.test(stem.replace(/^(r|ré|re)/, '')) && !/(appel|jet)$/.test(stem)) {
        alt = m[1] + 'è' + m[2]; futAlt = alt + 'er';
      }
    } else if ((m = stem.match(/^(.*)e([^aeiouyéèê]{1,2})$/)) && /[bcdfghjklmnpqrstvz]/.test(m[2]) && !/(gn|ll|tt|ss|cc|ch)$/.test(m[2]) && (m[2].length === 1 || /^(vr|br)$/.test(m[2]))) {
      silent = m[1] + 'è' + m[2]; fut = silent + 'er'; note = 'e → è before a silent ending: ' + silent + 'e';
    } else if ((m = stem.match(/^(.*)é([^aeiouyéèê]+)$/))) {
      silent = m[1] + 'è' + m[2]; note = 'é → è before a silent ending: ' + silent + 'e';
      futAlt = m[1] + 'è' + m[2] + 'er';
    } else if (/[ou]yer$/.test(v)) {
      silent = stem.slice(0, -1) + 'i'; fut = silent + 'er'; note = 'y → i before a silent e: ' + silent + 'e';
    } else if (/ayer$/.test(v)) {
      alt = stem; silent = stem.slice(0, -1) + 'i'; fut = silent + 'er'; futAlt = v; note = 'paie and paye are both right';
    }
    if (v === 'envoyer' || v === 'renvoyer') fut = stem.replace(/oy$/, '') + 'err';
    return { stem: stem, silent: silent, fut: fut, alt: alt, futAlt: futAlt, note: note };
  }

  /* A model gives the present, the stems the other tenses are built from and
     the participles. Anything left out follows from the present. */
  function M(present, o) { o = o || {}; o.present = present; return o; }

  function frModel(v) {
    var m;
    // ── the four that are entirely their own
    if (v === 'être') return M(['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], { imp: 'ét', ps: ['u', 'f'], fut: 'ser', pp: 'été', subj: ['sois sois soit soyons soyez soient'], ppr: 'étant', imper: ['sois', 'soyons', 'soyez'] });
    if (v === 'avoir') return M(['ai', 'as', 'a', 'avons', 'avez', 'ont'], { imp: 'av', ps: ['u', 'e'], fut: 'aur', pp: 'eu', subj: ['aie aies ait ayons ayez aient'], ppr: 'ayant', imper: ['aie', 'ayons', 'ayez'] });
    if (v === 'aller') return M(['vais', 'vas', 'va', 'allons', 'allez', 'vont'], { imp: 'all', ps: ['a', 'all'], fut: 'ir', pp: 'allé', subj: ['aill', 'all'], imper: ['va', 'allons', 'allez'] });
    if ((m = v.match(/^(.*)faire$/))) { var f = m[1]; return M([f + 'fais', f + 'fais', f + 'fait', f + 'faisons', f + 'faites', f + 'font'], { imp: f + 'fais', ps: ['i', f + 'f'], fut: f + 'fer', pp: f + 'fait', subj: [f + 'fass', f + 'fass'] }); }

    if (v === 'haïr') return M(['hais', 'hais', 'hait', 'haïssons', 'haïssez', 'haïssent'], { ps: ['i', 'ha'], fut: 'haïr', pp: 'haï', haiPs: true });
    // ── -er: the first group
    if (/er$/.test(v)) {
      var s = frErStems(v);
      var pres = FR_PRES_ER.map(function (e, i) { return frJoin(i === 3 || i === 4 ? s.stem : s.silent, e, v); });
      return M(pres, { imp: s.stem, ps: ['a', s.stem], fut: s.fut, pp: s.stem + 'é', group: 1, er: s });
    }

    // ── -oir
    if (/cevoir$/.test(v)) { var c = v.slice(0, -6); return M([c + 'çois', c + 'çois', c + 'çoit', c + 'cevons', c + 'cevez', c + 'çoivent'], { ps: ['u', c + 'ç'], fut: c + 'cevr', pp: c + 'çu' }); }
    if (v === 'devoir' || v === 'redevoir') { var d = v.slice(0, -6); return M([d + 'dois', d + 'dois', d + 'doit', d + 'devons', d + 'devez', d + 'doivent'], { ps: ['u', d + 'd'], fut: d + 'devr', pp: d + 'dû', ppAgree: d + 'du' }); }
    if ((m = v.match(/^(.*)voir$/)) && !/(sa|pou|a|mou|pleu)voir$/.test(v)) {
      var w = m[1] + 'v';
      var futV = v === 'prévoir' || v === 'pourvoir' ? v : m[1] + 'verr';
      return M([w + 'ois', w + 'ois', w + 'oit', w + 'oyons', w + 'oyez', w + 'oient'], { ps: [v === 'pourvoir' ? 'u' : 'i', v === 'pourvoir' ? 'pourv' : w], fut: futV, pp: w + 'u' });
    }
    if (v === 'savoir') return M(['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], { ps: ['u', 's'], fut: 'saur', pp: 'su', subj: ['sach', 'sach'], ppr: 'sachant', imper: ['sache', 'sachons', 'sachez'] });
    if (v === 'pouvoir') return M(['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], { ps: ['u', 'p'], fut: 'pourr', pp: 'pu', subj: ['puiss', 'puiss'], imper: [null, null, null], alts: { present: [['puis'], [], [], [], [], []] } });
    if (v === 'vouloir') return M(['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], { ps: ['u', 'voul'], fut: 'voudr', pp: 'voulu', subj: ['veuill', 'voul'], imper: ['veuille', 'veuillons', 'veuillez'] });
    if ((m = v.match(/^(.*)valoir$/))) { var vl = m[1]; return M([vl + 'vaux', vl + 'vaux', vl + 'vaut', vl + 'valons', vl + 'valez', vl + 'valent'], { ps: ['u', vl + 'val'], fut: vl + 'vaudr', pp: vl + 'valu', subj: [v === 'prévaloir' ? 'préval' : vl + 'vaill', vl + 'val'] }); }
    if (v === 'falloir') return M([null, null, 'faut', null, null, null], { imp: 'fall', ps: ['u', 'fall'], fut: 'faudr', pp: 'fallu', subj: ['faill', 'fall'], impersonal: true, imper: [null, null, null] });
    if (v === 'pleuvoir') return M([null, null, 'pleut', null, null, 'pleuvent'], { imp: 'pleuv', ps: ['u', 'pl'], fut: 'pleuvr', pp: 'plu', subj: ['pleuv', 'pleuv'], impersonal: true, imper: [null, null, null] });
    if ((m = v.match(/^(.*)asseoir$/))) { var a = m[1] + 'ass'; return M([a + 'ieds', a + 'ieds', a + 'ied', a + 'eyons', a + 'eyez', a + 'eyent'], { ps: ['i', a], fut: a + 'iér', pp: a + 'is', subj: [a + 'ey', a + 'ey'], alts: { present: [[a + 'ois'], [a + 'ois'], [a + 'oit'], [a + 'oyons'], [a + 'oyez'], [a + 'oient']] } }); }
    if ((m = v.match(/^(.*)mouvoir$/))) { var mv = m[1] + 'm'; return M([mv + 'eus', mv + 'eus', mv + 'eut', mv + 'ouvons', mv + 'ouvez', mv + 'euvent'], { ps: ['u', mv], fut: mv + 'ouvr', pp: m[1] ? mv + 'u' : 'mû', subj: [mv + 'euv', mv + 'ouv'] }); }

    // ── -ir verbs of the third group
    if (/ir$/.test(v) && !FR_TWO[v]) {
      if ((m = v.match(/^(.*)([vt])enir$/))) { var vt = m[1] + m[2]; return M([vt + 'iens', vt + 'iens', vt + 'ient', vt + 'enons', vt + 'enez', vt + 'iennent'], { ps: ['in', vt], fut: vt + 'iendr', pp: vt + 'enu', subj: [vt + 'ienn', vt + 'en'] }); }
      if ((m = v.match(/^(.*)(ouvrir|offrir|souffrir|couvrir)$/))) { var ov = v.slice(0, -2); return M([ov + 'e', ov + 'es', ov + 'e', ov + 'ons', ov + 'ez', ov + 'ent'], { ps: ['i', ov], fut: v, pp: v.slice(0, -3) + 'ert', tuDrop: true }); }
      if (/(cueillir|assaillir|tressaillir|défaillir)$/.test(v)) { var cu = v.slice(0, -2); return M([cu + 'e', cu + 'es', cu + 'e', cu + 'ons', cu + 'ez', cu + 'ent'], { ps: ['i', cu], fut: /cueillir$/.test(v) ? cu + 'er' : v, pp: cu + 'i', tuDrop: true }); }
      if (/courir$/.test(v)) { var co = v.slice(0, -2); return M([co + 's', co + 's', co + 't', co + 'ons', co + 'ez', co + 'ent'], { ps: ['u', co], fut: co + 'r', pp: co + 'u' }); }
      if (v === 'mourir') return M(['meurs', 'meurs', 'meurt', 'mourons', 'mourez', 'meurent'], { ps: ['u', 'mour'], fut: 'mourr', pp: 'mort', subj: ['meur', 'mour'] });
      if ((m = v.match(/^(.*)quérir$/))) { var q = m[1] + 'qu'; return M([q + 'iers', q + 'iers', q + 'iert', q + 'érons', q + 'érez', q + 'ièrent'], { ps: ['i', q], fut: q + 'err', pp: q + 'is', subj: [q + 'ièr', q + 'ér'] }); }
      if (/fuir$/.test(v)) { var fu = v.slice(0, -2); return M([fu + 'is', fu + 'is', fu + 'it', fu + 'yons', fu + 'yez', fu + 'ient'], { ps: ['i', fu], fut: v, pp: fu + 'i', subj: [fu + 'i', fu + 'y'] }); }
      if (/bouillir$/.test(v)) { var bo = v.slice(0, -8); return M([bo + 'bous', bo + 'bous', bo + 'bout', bo + 'bouillons', bo + 'bouillez', bo + 'bouillent'], { ps: ['i', bo + 'bouill'], fut: v, pp: bo + 'bouilli' }); }
      if (/vêtir$/.test(v)) { var ve = v.slice(0, -2); return M([ve + 's', ve + 's', ve, ve + 'ons', ve + 'ez', ve + 'ent'], { ps: ['i', ve], fut: v, pp: ve + 'u' }); }
      if (v === 'haïr') return M(['hais', 'hais', 'hait', 'haïssons', 'haïssez', 'haïssent'], { ps: ['i', 'ha'], fut: 'haïr', pp: 'haï', haiPs: true });
      if (/(partir|sortir|dormir|mentir|sentir|servir|repentir)$/.test(v)) {
        var full = v.slice(0, -2), short = full.slice(0, -1);
        return M([short + 's', short + 's', short + 't', full + 'ons', full + 'ez', full + 'ent'], { ps: ['i', full], fut: v, pp: full + 'i' });
      }
      if (/(ouïr|gésir)$/.test(v)) return null;
      // ── everything else in -ir: the second group, finir
      var st = v.slice(0, -2);
      return M([st + 'is', st + 'is', st + 'it', st + 'issons', st + 'issez', st + 'issent'], { ps: ['i', st], fut: v, pp: st + 'i', group: 2 });
    }
    if (FR_TWO[v]) { var st2 = v.slice(0, -2); return M([st2 + 'is', st2 + 'is', st2 + 'it', st2 + 'issons', st2 + 'issez', st2 + 'issent'], { ps: ['i', st2], fut: v, pp: st2 + 'i', group: 2 }); }

    // ── -re
    if (/^(re|)dire$/.test(v)) { var di = v.slice(0, -4); return M([di + 'dis', di + 'dis', di + 'dit', di + 'disons', di + 'dites', di + 'disent'], { ps: ['i', di + 'd'], fut: di + 'dir', pp: di + 'dit' }); }
    if (/(contre|inter|mé|pré)dire$/.test(v)) { var dd = v.slice(0, -4); return M([dd + 'dis', dd + 'dis', dd + 'dit', dd + 'disons', dd + 'disez', dd + 'disent'], { ps: ['i', dd + 'd'], fut: dd + 'dir', pp: dd + 'dit' }); }
    if (v === 'maudire') return M(['maudis', 'maudis', 'maudit', 'maudissons', 'maudissez', 'maudissent'], { ps: ['i', 'maud'], fut: 'maudir', pp: 'maudit' });
    if (/lire$/.test(v) && !/(é?crire|suffire)$/.test(v)) { var li = v.slice(0, -4); return M([li + 'lis', li + 'lis', li + 'lit', li + 'lisons', li + 'lisez', li + 'lisent'], { ps: ['u', li + 'l'], fut: li + 'lir', pp: li + 'lu' }); }
    if (/crire$/.test(v)) { var cr = v.slice(0, -2); return M([cr + 's', cr + 's', cr + 't', cr + 'vons', cr + 'vez', cr + 'vent'], { ps: ['i', cr + 'v'], fut: cr + 'r', pp: cr + 't' }); }
    if (/rire$/.test(v)) { var ri = v.slice(0, -2); return M([ri + 's', ri + 's', ri + 't', ri + 'ons', ri + 'ez', ri + 'ent'], { ps: ['i', ri.slice(0, -1)], fut: ri + 'r', pp: ri }); }
    if (/(suffire|confire|circoncire)$/.test(v)) { var su = v.slice(0, -2); return M([su + 's', su + 's', su + 't', su + 'sons', su + 'sez', su + 'sent'], { ps: ['i', su.slice(0, -1)], fut: su + 'r', pp: v === 'suffire' ? 'suffi' : v === 'confire' ? 'confit' : 'circoncis' }); }
    if (/uire$/.test(v)) { var ui = v.slice(0, -2); var ppU = /^(re|)(nuire|luire)$/.test(v) || /luire$/.test(v) || v === 'nuire' ? ui : ui + 't'; return M([ui + 's', ui + 's', ui + 't', ui + 'sons', ui + 'sez', ui + 'sent'], { ps: ['i', ui + 's'], fut: ui + 'r', pp: ppU }); }
    if (/plaire$/.test(v)) { var pl = v.slice(0, -6); return M([pl + 'plais', pl + 'plais', pl + 'plaît', pl + 'plaisons', pl + 'plaisez', pl + 'plaisent'], { ps: ['u', pl + 'pl'], fut: pl + 'plair', pp: pl + 'plu' }); }
    if (v === 'taire') return M(['tais', 'tais', 'tait', 'taisons', 'taisez', 'taisent'], { ps: ['u', 't'], fut: 'tair', pp: 'tu' });
    if (/boire$/.test(v)) { var bb = v.slice(0, -5); return M([bb + 'bois', bb + 'bois', bb + 'boit', bb + 'buvons', bb + 'buvez', bb + 'boivent'], { ps: ['u', bb + 'b'], fut: bb + 'boir', pp: bb + 'bu', subj: [bb + 'boiv', bb + 'buv'] }); }
    if (/croire$/.test(v)) { var cc = v.slice(0, -6); return M([cc + 'crois', cc + 'crois', cc + 'croit', cc + 'croyons', cc + 'croyez', cc + 'croient'], { ps: ['u', cc + 'cr'], fut: cc + 'croir', pp: cc + 'cru', subj: [cc + 'croi', cc + 'croy'] }); }
    if (/mettre$/.test(v)) { var me = v.slice(0, -6); return M([me + 'mets', me + 'mets', me + 'met', me + 'mettons', me + 'mettez', me + 'mettent'], { ps: ['i', me + 'm'], fut: me + 'mettr', pp: me + 'mis' }); }
    if (/battre$/.test(v)) { var ba = v.slice(0, -6); return M([ba + 'bats', ba + 'bats', ba + 'bat', ba + 'battons', ba + 'battez', ba + 'battent'], { ps: ['i', ba + 'batt'], fut: ba + 'battr', pp: ba + 'battu' }); }
    if (/prendre$/.test(v)) { var pr = v.slice(0, -7); return M([pr + 'prends', pr + 'prends', pr + 'prend', pr + 'prenons', pr + 'prenez', pr + 'prennent'], { ps: ['i', pr + 'pr'], fut: pr + 'prendr', pp: pr + 'pris', subj: [pr + 'prenn', pr + 'pren'] }); }
    if ((m = v.match(/^(.*)(ein|ain|oin)dre$/))) { var ia = m[1] + m[2]; return M([ia + 's', ia + 's', ia + 't', ia.slice(0, -1) + 'gnons', ia.slice(0, -1) + 'gnez', ia.slice(0, -1) + 'gnent'], { ps: ['i', ia.slice(0, -1) + 'gn'], fut: v.slice(0, -1), pp: ia + 't' }); }
    if ((m = v.match(/^(.*)soudre$/))) { var so = m[1]; var res = /^ré$/.test(so); return M([so + 'sous', so + 'sous', so + 'sout', so + 'solvons', so + 'solvez', so + 'solvent'], { ps: ['u', so + 'sol'], fut: so + 'soudr', pp: res ? 'résolu' : so + 'sous', ppFem: res ? null : so + 'soute' }); }
    if (/coudre$/.test(v)) { var cd = v.slice(0, -6); return M([cd + 'couds', cd + 'couds', cd + 'coud', cd + 'cousons', cd + 'cousez', cd + 'cousent'], { ps: ['i', cd + 'cous'], fut: cd + 'coudr', pp: cd + 'cousu' }); }
    if (/moudre$/.test(v)) { var md = v.slice(0, -6); return M([md + 'mouds', md + 'mouds', md + 'moud', md + 'moulons', md + 'moulez', md + 'moulent'], { ps: ['u', md + 'moul'], fut: md + 'moudr', pp: md + 'moulu' }); }
    if (/rompre$/.test(v)) { var ro = v.slice(0, -2); return M([ro + 's', ro + 's', ro + 't', ro + 'ons', ro + 'ez', ro + 'ent'], { ps: ['i', ro], fut: ro + 'r', pp: ro + 'u' }); }
    if (/dre$/.test(v)) { var dr = v.slice(0, -2); return M([dr + 's', dr + 's', dr, dr + 'ons', dr + 'ez', dr + 'ent'], { ps: ['i', dr], fut: dr + 'r', pp: dr + 'u' }); }
    if (/vivre$/.test(v)) { var vi = v.slice(0, -5); return M([vi + 'vis', vi + 'vis', vi + 'vit', vi + 'vivons', vi + 'vivez', vi + 'vivent'], { ps: ['u', vi + 'véc'], fut: vi + 'vivr', pp: vi + 'vécu' }); }
    if (/suivre$/.test(v)) { var sv = v.slice(0, -6); return M([sv + 'suis', sv + 'suis', sv + 'suit', sv + 'suivons', sv + 'suivez', sv + 'suivent'], { ps: ['i', sv + 'suiv'], fut: sv + 'suivr', pp: sv + 'suivi' }); }
    if (/^(re|)naître$/.test(v)) { var na = v.slice(0, -6); return M([na + 'nais', na + 'nais', na + 'naît', na + 'naissons', na + 'naissez', na + 'naissent'], { ps: ['i', na + 'naqu'], fut: na + 'naîtr', pp: na ? null : 'né', alts: { present: [[], [], [na + 'nait'], [], [], []] } }); }
    // paître: no passé simple and no participle, so no compound tenses.
    if (v === 'paître') return M(['pais', 'pais', 'paît', 'paissons', 'paissez', 'paissent'], { ps: null, fut: 'paîtr', pp: null, alts: { present: [[], [], ['pait'], [], [], []] } });
    if ((m = v.match(/^(.*)aître$/))) { var ai = m[1] + 'a'; return M([ai + 'is', ai + 'is', ai + 'ît', ai + 'issons', ai + 'issez', ai + 'issent'], { ps: ['u', m[1]], fut: ai + 'îtr', pp: m[1] + 'u', alts: { present: [[], [], [ai + 'it'], [], [], []] } }); }
    if ((m = v.match(/^(.*)croître$/))) { var cx = m[1]; var bare = !cx; return M([cx + (bare ? 'croîs' : 'crois'), cx + (bare ? 'croîs' : 'crois'), cx + 'croît', cx + 'croissons', cx + 'croissez', cx + 'croissent'], { ps: ['u', cx + (bare ? 'cr' : 'cr')], fut: cx + 'croîtr', pp: bare ? 'crû' : cx + 'cru', psCirc: bare }); }
    if ((m = v.match(/^(.*)clure$/))) { var cl = m[1] + 'clu'; return M([cl + 's', cl + 's', cl + 't', cl + 'ons', cl + 'ez', cl + 'ent'], { ps: ['u', m[1] + 'cl'], fut: cl + 'r', pp: /inclure|occlure/.test(v) ? cl + 's' : cl }); }
    if (/vaincre$/.test(v)) { var va = v.slice(0, -2); return M([va + 's', va + 's', va, va.slice(0, -1) + 'quons', va.slice(0, -1) + 'quez', va.slice(0, -1) + 'quent'], { ps: ['i', va.slice(0, -1) + 'qu'], fut: va + 'r', pp: va + 'u' }); }
    if (/traire$/.test(v)) { var tr = v.slice(0, -3); return M([tr + 'is', tr + 'is', tr + 'it', tr + 'yons', tr + 'yez', tr + 'ient'], { ps: null, fut: v.slice(0, -1), pp: tr + 'it', subj: [tr + 'i', tr + 'y'] }); }
    if (/clore$/.test(v)) { var clo = v.slice(0, -2); return M([clo + 's', clo + 's', clo.replace(/o$/, 'ô') + 't', clo + 'sons', clo + 'sez', clo + 'sent'], { ps: null, fut: clo + 'r', pp: clo + 's' }); }
    if (/être$/.test(v)) return null;
    return null;
  }

  var FR_AUX = {
    avoir: { present: 'ai as a avons avez ont', imperfect: 'avais avais avait avions aviez avaient',
      passeSimple: 'eus eus eut eûmes eûtes eurent', future: 'aurai auras aura aurons aurez auront',
      conditional: 'aurais aurais aurait aurions auriez auraient', subjPresent: 'aie aies ait ayons ayez aient',
      subjImperfect: 'eusse eusses eût eussions eussiez eussent', imper: 'aie ayons ayez' },
    être: { present: 'suis es est sommes êtes sont', imperfect: 'étais étais était étions étiez étaient',
      passeSimple: 'fus fus fut fûmes fûtes furent', future: 'serai seras sera serons serez seront',
      conditional: 'serais serais serait serions seriez seraient', subjPresent: 'sois sois soit soyons soyez soient',
      subjImperfect: 'fusse fusses fût fussions fussiez fussent', imper: 'sois soyons soyez' },
  };

  var FR_GROUPS = [
    { id: 'ind', name: 'Indicatif', tenses: [
      ['present', 'Présent', 'je parle', 'Now, habits, general truths.'],
      ['imperfect', 'Imparfait', 'je parlais', 'Used to / was doing; description in the past.'],
      ['passeSimple', 'Passé simple', 'je parlai', 'Written narrative past (books, history).'],
      ['future', 'Futur simple', 'je parlerai', 'Will do.'],
    ] },
    { id: 'indc', name: 'Indicatif · temps composés', tenses: [
      ['passeCompose', 'Passé composé', "j'ai parlé", 'Did / have done — the everyday past.'],
      ['pluperfect', 'Plus-que-parfait', "j'avais parlé", 'Had done.'],
      ['pastAnterior', 'Passé antérieur', "j'eus parlé", 'Written: had done, just before.'],
      ['futurePerfect', 'Futur antérieur', "j'aurai parlé", 'Will have done.'],
    ] },
    { id: 'cond', name: 'Conditionnel', tenses: [
      ['conditional', 'Présent', 'je parlerais', 'Would do; polite requests.'],
      ['conditionalPerfect', 'Passé', "j'aurais parlé", 'Would have done.'],
    ] },
    { id: 'subj', name: 'Subjonctif', tenses: [
      ['subjPresent', 'Présent', 'que je parle', 'After il faut que, vouloir que, emotions, doubt.'],
      ['subjPast', 'Passé', "que j'aie parlé", 'That … has done.'],
      ['subjImperfect', 'Imparfait', 'que je parlasse', 'Literary past subjunctive.'],
      ['subjPluperfect', 'Plus-que-parfait', "que j'eusse parlé", 'Literary.'],
    ] },
    { id: 'imp', name: 'Impératif', tenses: [
      ['imperative', 'Présent', 'parle !', 'Commands.'],
      ['imperativePast', 'Passé', 'aie parlé !', 'Have done (by a time).'],
    ] },
  ];
  var FR_PERSONS = ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'];
  var FR_SUBJ = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
  var FR_REFL = ['me', 'te', 'se', 'nous', 'vous', 'se'];

  function frBuild(v, mdl) {
    var t = {};
    var p = mdl.present.slice();
    t.present = p;
    // Imperfect: the nous of the present, minus -ons (être: ét-).
    var imp = mdl.imp || (p[3] ? p[3].replace(/ons$/, '') : null);
    if (imp != null && /ç$/.test(imp)) imp = imp.slice(0, -1) + 'c';
    if (imp != null && /ge$/.test(imp) && /ger$/.test(v)) imp = imp.slice(0, -1);
    var IMPF = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
    t.imperfect = IMPF.map(function (e) { return imp == null ? null : frJoin(imp, e, v); });
    // Passé simple.
    if (mdl.ps) {
      var kind = mdl.ps[0], pst = mdl.ps[1];
      t.passeSimple = PS[kind].map(function (e) { return frJoin(pst, e, v); });
      if (mdl.haiPs) t.passeSimple = ['haïs', 'haïs', 'haït', 'haïmes', 'haïtes', 'haïrent'];
      if (mdl.psCirc) t.passeSimple = ['crûs', 'crûs', 'crût', 'crûmes', 'crûtes', 'crûrent'];
    } else t.passeSimple = [null, null, null, null, null, null];
    // Future and conditional.
    var futS = /re$/.test(mdl.fut) ? mdl.fut.slice(0, -1) : mdl.fut;
    t.future = ['ai', 'as', 'a', 'ons', 'ez', 'ont'].map(function (e) { return futS + e; });
    t.conditional = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'].map(function (e) { return futS + e; });
    // Present subjunctive: the ils of the present, minus -ent; nous/vous from the imperfect.
    if (mdl.subj && mdl.subj.length === 1) t.subjPresent = mdl.subj[0].split(' ');
    else {
      var s1 = mdl.subj ? mdl.subj[0] : (p[5] ? p[5].replace(/ent$/, '') : imp);
      var s2 = mdl.subj ? mdl.subj[1] : imp;
      t.subjPresent = ['e', 'es', 'e', 'ions', 'iez', 'ent'].map(function (e, i) { return frJoin(i === 3 || i === 4 ? s2 : s1, e, v); });
    }
    // Imperfect subjunctive: from the passé simple tu, minus -s.
    if (mdl.ps) {
      var tu = t.passeSimple[1];
      var bse = tu.replace(/s$/, '');
      if (mdl.haiPs) bse = 'haï';
      var circ = bse.replace(/([aiu])(n?)$/, function (mm, vv, n) { return (CIRC[vv] || vv) + n; }).replace(/ïn?$/, 'ï');
      t.subjImperfect = ['sse', 'sses', 't', 'ssions', 'ssiez', 'ssent'].map(function (e, i) { return i === 2 ? circ + 't' : bse + e; });
      if (mdl.haiPs) t.subjImperfect[2] = 'haït';
    } else t.subjImperfect = [null, null, null, null, null, null];
    // Imperative: from the present tu/nous/vous; -e verbs drop the s (parle, ouvre, va).
    var imper = mdl.imper || [p[1] && (mdl.group === 1 || mdl.tuDrop ? p[1].replace(/es$/, 'e') : p[1]), p[3], p[4]];
    if (v === 'aller') imper = ['va', 'allons', 'allez'];
    t.imperative = [null, imper[0], null, imper[1], imper[2], null];
    var ppr = mdl.ppr || (imp != null ? frJoin(imp, 'ant', v) : null);
    if (mdl.impersonal) {
      Object.keys(t).forEach(function (k) { t[k] = t[k].map(function (f, i) { return i === 2 ? f : null; }); });
    }
    return { t: t, pp: mdl.pp, ppr: ppr };
  }

  function frConjugate(input) {
    var raw = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");
    var refl = false, v = raw;
    var mm;
    if ((mm = v.match(/^(se |s')(.+)$/))) { refl = true; v = mm[2]; }
    v = frResolve(v);
    if (!/(er|ir|re|ïr)$/.test(v)) return null;
    var mdl = frModel(v);
    if (!mdl) return null;
    var core = frBuild(v, mdl);
    var t = core.t, pp = core.pp;
    var alts = {};
    if (mdl.alts) Object.keys(mdl.alts).forEach(function (k) { alts[k] = mdl.alts[k]; });

    // First-group alternative spellings (paye, cèderai, 1990 "il ruissèle").
    if (mdl.er) {
      var s = mdl.er;
      if (s.alt) {
        var altPres = FR_PRES_ER.map(function (e, i) { return i === 3 || i === 4 ? null : s.alt + e; });
        alts.present = altPres.map(function (f) { return f ? [f] : []; });
        alts.subjPresent = ['e', 'es', 'e', 'ions', 'iez', 'ent'].map(function (e, i) { return i === 3 || i === 4 ? [] : [s.alt + e]; });
      }
      if (s.futAlt) {
        alts.future = ['ai', 'as', 'a', 'ons', 'ez', 'ont'].map(function (e) { return [s.futAlt + e]; });
        alts.conditional = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'].map(function (e) { return [s.futAlt + e]; });
      }
    }

    var etre = refl || FR_ETRE[v];
    var auxName = etre ? 'être' : 'avoir';
    var aux = {};
    Object.keys(FR_AUX[auxName]).forEach(function (k) { aux[k] = FR_AUX[auxName][k].split(' '); });
    // Agreement with être: allé(e), allé(e)s.
    var agree = function (i) {
      if (!etre) return pp;
      var base = pp;
      if (/s$/.test(base)) return i >= 3 ? base + '(es)'.replace('(es)', '(es)') : base + '(e)';
      return base + (i >= 3 ? (i === 4 ? '(e)(s)' : '(e)s') : '(e)');
    };
    var comp = function (k) { return aux[k].map(function (a, i) { return t.present[i] == null && mdl.impersonal ? null : a + ' ' + agree(i); }); };
    t.passeCompose = comp('present'); t.pluperfect = comp('imperfect'); t.pastAnterior = comp('passeSimple');
    t.futurePerfect = comp('future'); t.conditionalPerfect = comp('conditional');
    t.subjPast = comp('subjPresent'); t.subjPluperfect = comp('subjImperfect');
    t.imperativePast = [null, aux.imper[0] + ' ' + agree(1), null, aux.imper[1] + ' ' + agree(3), aux.imper[2] + ' ' + agree(4), null];
    if (mdl.impersonal || v === 'pouvoir') t.imperativePast = [null, null, null, null, null, null];
    if (mdl.impersonal) ['passeCompose', 'pluperfect', 'pastAnterior', 'futurePerfect', 'conditionalPerfect', 'subjPast', 'subjPluperfect'].forEach(function (k) {
      t[k] = t[k].map(function (f, i) { return i === 2 ? aux[k === 'passeCompose' ? 'present' : k === 'pluperfect' ? 'imperfect' : k === 'pastAnterior' ? 'passeSimple' : k === 'futurePerfect' ? 'future' : k === 'conditionalPerfect' ? 'conditional' : k === 'subjPast' ? 'subjPresent' : 'subjImperfect'][2] + ' ' + pp : null; });
    });

    // No participle (renaître, paître): no compound tenses either.
    if (!pp) ['passeCompose', 'pluperfect', 'pastAnterior', 'futurePerfect', 'conditionalPerfect', 'subjPast', 'subjPluperfect', 'imperativePast']
      .forEach(function (k) { t[k] = [null, null, null, null, null, null]; });

    var inf = v;
    var ppr = core.ppr;
    if (refl) {
      t = frReflexive(t);
      inf = (frElide(v) ? "s'" : 'se ') + v;
      ppr = ppr ? (frElide(ppr) ? "s'" : 'se ') + ppr : ppr;
      Object.keys(alts).forEach(function (k) {
        alts[k] = alts[k].map(function (a, i) { return a.map(function (f) { return frRefl(i, f); }); });
      });
    }

    // Irregular: compare with the plain pattern of the verb's ending.
    var plain = frPlain(v);
    var irregular = {};
    Object.keys(t).forEach(function (k) {
      if (!plain[k]) return;
      irregular[k] = t[k].map(function (f, i) {
        if (f == null || plain[k][i] == null) return false;
        var bare = refl ? f.replace(/^(me |te |se |nous |vous |m'|t'|s')/, '') : f;
        return bare !== plain[k][i];
      });
    });

    return {
      lang: 'fr', infinitive: inf, base: v, reflexive: refl, participle: pp, participlePresent: ppr,
      participleIrregular: pp !== plain.pp, gerund: ppr ? 'en ' + ppr : null, auxiliary: auxName,
      auxiliaryNote: !refl && FR_ETRE_BOTH[v] ? 'être; avoir when it has a direct object (il a ' + pp + ' la valise)' : null,
      tenses: t, alts: alts, irregular: irregular, impersonal: !!mdl.impersonal,
      model: frModelName(v, mdl), known: frKnown(v), group: mdl.group || 3, notes: frNotes(v, mdl, core),
    };
  }

  function frRefl(i, f) {
    if (f == null) return f;
    var pr = FR_REFL[i];
    if ((pr === 'me' || pr === 'te' || pr === 'se') && frElide(f) && !FR_H_ASPIRE[f.split(' ')[0]]) return pr.charAt(0) + "'" + f;
    return pr + ' ' + f;
  }
  function frReflexive(t) {
    var out = {};
    Object.keys(t).forEach(function (k) {
      if (k === 'imperative') {
        out[k] = [null, t[k][1] && t[k][1] + '-toi', null, t[k][3] && t[k][3] + '-nous', t[k][4] && t[k][4] + '-vous', null];
      } else if (k === 'imperativePast') {
        out[k] = [null, null, null, null, null, null];
      } else out[k] = t[k].map(function (f, i) { return frRefl(i, f); });
    });
    return out;
  }
  /** The regular pattern for the ending, ignoring the model: what "irregular" is measured against. */
  function frPlain(v) {
    var t = {};
    var end = v.slice(-2);
    var st = v.slice(0, -2);
    var mk = function (stem, ends) { return ends.map(function (e) { return stem + e; }); };
    if (end === 'er') {
      t.present = mk(st, FR_PRES_ER); t.imperfect = mk(st, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']);
      t.passeSimple = mk(st, PS.a); t.future = mk(v, ['ai', 'as', 'a', 'ons', 'ez', 'ont']);
      t.conditional = mk(v, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']); t.subjPresent = mk(st, ['e', 'es', 'e', 'ions', 'iez', 'ent']);
      t.subjImperfect = mk(st, ['asse', 'asses', 'ât', 'assions', 'assiez', 'assent']); t.pp = st + 'é';
    } else if (end === 'ir') {
      t.present = mk(st, ['is', 'is', 'it', 'issons', 'issez', 'issent']); t.imperfect = mk(st + 'iss', ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']);
      t.passeSimple = mk(st, PS.i); t.future = mk(v, ['ai', 'as', 'a', 'ons', 'ez', 'ont']);
      t.conditional = mk(v, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']); t.subjPresent = mk(st + 'iss', ['e', 'es', 'e', 'ions', 'iez', 'ent']);
      t.subjImperfect = mk(st, ['isse', 'isses', 'ît', 'issions', 'issiez', 'issent']); t.pp = st + 'i';
    } else {
      t.present = mk(st, ['s', 's', '', 'ons', 'ez', 'ent']); t.imperfect = mk(st, ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']);
      t.passeSimple = mk(st, PS.i); t.future = mk(v.slice(0, -1), ['ai', 'as', 'a', 'ons', 'ez', 'ont']);
      t.conditional = mk(v.slice(0, -1), ['ais', 'ais', 'ait', 'ions', 'iez', 'aient']); t.subjPresent = mk(st, ['e', 'es', 'e', 'ions', 'iez', 'ent']);
      t.subjImperfect = mk(st, ['isse', 'isses', 'ît', 'issions', 'issiez', 'issent']); t.pp = st + 'u';
    }
    return t;
  }
  function frModelName(v, mdl) {
    if (mdl.group === 1) return mdl.er && mdl.er.note ? 'parler (with a spelling change)' : 'parler';
    if (mdl.group === 2) return 'finir';
    return null;
  }
  function frKnown(v) { return !!(LEX.fr && LEX.fr[v]); }
  function frNotes(v, mdl, core) {
    var n = [];
    if (mdl.group === 1) {
      n.push('First group (-er): like parler.');
      if (mdl.er && mdl.er.note) n.push('Spelling: ' + mdl.er.note + '.');
      if (/cer$/.test(v)) n.push('ç before a and o: ' + core.t.present[3] + '.');
      if (/ger$/.test(v)) n.push('e after g before a and o: ' + core.t.present[3] + '.');
    } else if (mdl.group === 2) n.push('Second group (-ir with -iss-): like finir.');
    else n.push('Third group: irregular.');
    if (FR_ETRE[v]) n.push('Compound tenses with être; the participle agrees with the subject.');
    return n;
  }

  /* ══════════════════════════════════════════════════════════════════════
     Lookup: accents, the dictionary, any conjugated form
     ══════════════════════════════════════════════════════════════════════ */

  var LEX = { es: null, fr: null };
  var FOLD_INDEX = { es: null, fr: null };
  function foldIndex(lang) {
    if (FOLD_INDEX[lang]) return FOLD_INDEX[lang];
    var o = {};
    Object.keys(LEX[lang] || {}).forEach(function (v) { o[fold(v)] = v; });
    FOLD_INDEX[lang] = o;
    return o;
  }
  /** "reir" → "reír", "etre" → "être": the dictionary's spelling of a verb typed without accents. */
  function esResolve(v) { if (LEX.es && LEX.es[v]) return v; var f = foldIndex('es')[fold(v)]; return f || (ES_FULL[fold(v).replace(/ir$/, 'ír')] && /^(o|re|fre)ir$/.test(fold(v)) ? fold(v).replace(/ir$/, 'ír') : v); }
  function frResolve(v) { if (LEX.fr && LEX.fr[v]) return v; var f = foldIndex('fr')[fold(v)]; return f || (fold(v) === 'etre' ? 'être' : v); }

  function setLexicon(lang, text) {
    var o = {};
    String(text).split('|').forEach(function (e) {
      var at = e.indexOf(':');
      if (at > 0) o[e.slice(0, at).trim()] = e.slice(at + 1).trim();
    });
    LEX[lang] = o; FOLD_INDEX[lang] = null; FORMS[lang] = null;
  }

  function conjugate(lang, verb) { return lang === 'fr' ? frConjugate(verb) : esConjugate(verb); }

  /* Every form of every dictionary verb, folded, pointing back at where it
     came from: type "tengo" or "eussions" and get the verb. Built on first
     use, in slices so the page stays responsive. */
  var FORMS = { es: null, fr: null };
  function formIndex(lang) {
    if (FORMS[lang]) return FORMS[lang];
    var idx = {};
    var groups = lang === 'fr' ? FR_GROUPS : ES_GROUPS;
    Object.keys(LEX[lang] || {}).forEach(function (v) {
      var r;
      try { r = conjugate(lang, v); } catch (e) { r = null; }
      if (!r) return;
      groups.forEach(function (g) {
        g.tenses.forEach(function (tt) {
          (r.tenses[tt[0]] || []).forEach(function (f, i) {
            if (!f) return;
            var last = f.split(' ').pop().replace(/[!¡()]/g, '').replace(/\(e\)|\(s\)|\(es\)/g, '');
            var k = fold(last).replace(/^.*'/, '');
            if (!k) return;
            (idx[k] = idx[k] || []).push({ verb: v, tense: tt[0], person: i, form: last.replace(/^.*'/, '') });
          });
        });
      });
      [r.participle, r.participlePresent, r.gerund].forEach(function (f) {
        if (!f) return;
        var k = fold(f.split(' ').pop());
        (idx[k] = idx[k] || []).push({ verb: v, tense: 'nonfinite', person: -1 });
      });
    });
    FORMS[lang] = idx;
    return idx;
  }

  /** Small Levenshtein, for "did you mean". */
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var row = [];
    for (var j = 0; j <= b.length; j++) row[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var prev = row[0]; row[0] = i;
      for (j = 1; j <= b.length; j++) {
        var tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  /** What the student typed: an infinitive, a form, an English meaning, or a near miss. */
  function search(lang, query, limit) {
    limit = limit || 8;
    var q = String(query || '').trim().toLowerCase().replace(/’/g, "'");
    if (!q) return [];
    var lex = LEX[lang] || {};
    var fq = fold(q).replace(/^(se |s')/, '').replace(/se$/, lang === 'es' ? '' : 'se');
    var out = [], seen = {};
    var push = function (v, why, extra) { if (seen[v] || out.length >= limit) return; seen[v] = 1; out.push({ verb: v, why: why, gloss: lex[v] || '', hit: extra || null }); };
    var fi = foldIndex(lang);
    if (fi[fold(q)]) push(fi[fold(q)], 'infinitive');
    if (fi[fq]) push(fi[fq], 'infinitive');
    if (lang === 'es' && /se$/.test(fold(q)) && fi[fold(q).slice(0, -2)]) push(fi[fold(q).slice(0, -2)], 'infinitive');
    // Prefix matches on the infinitive.
    Object.keys(fi).forEach(function (k) { if (k.indexOf(fq) === 0) push(fi[k], 'starts'); });
    // A conjugated form.
    // A form typed with its accents beats one that only matches without them: fûmes is être, not fumer.
    var bare = q.replace(/^.*'/, '').split(' ').pop();
    var hits = (formIndex(lang)[fq.replace(/^.*'/, '').split(' ').pop()] || []).slice()
      .sort(function (a, b) { return (b.form === bare) - (a.form === bare); });
    hits.forEach(function (h) { push(h.verb, 'form', h); });
    // English.
    if (out.length < limit && fq.length >= 3) {
      var en = fq.replace(/^to /, '');
      var scored = [];
      Object.keys(lex).forEach(function (v) {
        var parts = lex[v].toLowerCase().split(/,|;/).map(function (x) { return x.trim().replace(/^to /, '').replace(/\s*\(.*\)$/, ''); });
        if (parts.indexOf(en) !== -1) scored.push([v, 0]);
        else if ((' ' + lex[v].toLowerCase() + ' ').indexOf(' ' + en + ' ') !== -1) scored.push([v, 1]);
      });
      scored.sort(function (a, b) { return a[1] - b[1]; }).forEach(function (x) { push(x[0], 'english'); });
    }
    // Near misses.
    if (!out.length && fq.length >= 3) {
      Object.keys(fi).map(function (k) { return [k, dist(fq, k)]; }).filter(function (x) { return x[1] <= 2; })
        .sort(function (a, b) { return a[1] - b[1]; }).forEach(function (x) { push(fi[x[0]], 'near'); });
    }
    return out;
  }

  function looksLikeInfinitive(lang, v) {
    v = fold(String(v || '').toLowerCase().trim()).replace(/^(se |s')/, '').replace(/se$/, lang === 'es' ? '' : 'se');
    return lang === 'fr' ? /(er|ir|re)$/.test(v) : /(ar|er|ir)$/.test(v);
  }

  root.FluxConj = {
    conjugate: conjugate,
    search: search,
    setLexicon: setLexicon,
    lexicon: function (lang) { return LEX[lang] || {}; },
    groups: function (lang) { return lang === 'fr' ? FR_GROUPS : ES_GROUPS; },
    persons: function (lang) { return (lang === 'fr' ? FR_PERSONS : ES_PERSONS).slice(); },
    imperativePersons: function (lang) { return lang === 'fr' ? ['', 'tu', '', 'nous', 'vous', ''] : ES_IMP_PERSONS.slice(); },
    subjectFor: function (lang, i, form) {
      if (lang === 'es') return ES_PERSONS[i];
      var p = FR_SUBJ[i];
      if (i === 0 && form && frElide(form) && !FR_H_ASPIRE[form.split(' ')[0]]) return "j'";
      return p;
    },
    looksLikeInfinitive: looksLikeInfinitive,
    fold: fold,
    formIndex: formIndex,
    _attach: attach,
  };
})();
