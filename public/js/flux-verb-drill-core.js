/* ============================================================================
   FLUX VERB DRILL · CORE  ·  flux-verb-drill-core.js
   Everything about the Study tools verb drill that is not drawing: the verb
   sets, the question pool, marking (with and without accents), rounds and
   their scores, the history kept in the langPractice slice, assignment links
   and score codes.

   No DOM here, so test/unit/verb-drill.test.mjs runs it in a bare VM against
   the real conjugation engine (flux-lang-engine.js). The page side is
   flux-study-verbs.js.

   WHERE THE ANSWERS COME FROM
   ---------------------------
   Every answer is the engine's, never a second table typed here. A drill and
   a conjugator that disagree teach two answers; flux-lang-engine.js's header
   explains why that is the failure Flux has paid for before.

   ASSIGNMENT LINKS AND SCORE CODES — WHAT THEY CAN AND CANNOT DO
   ---------------------------------------------------------------
   There is no server behind any of this (school join is off), so a link
   carries its whole assignment in the address, and a score code carries a
   result plus a check value. The check catches a code that was mistyped,
   cut short, edited by hand, or sent for a different assignment. It cannot
   stop someone who reads this file from making a code by hand: the "secret"
   is in the page. The page says so to teachers in plain words.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxVerbCore) return;

  /* ── Languages ─────────────────────────────────────────────────────── */

  /* Each person can be shown as one of several pronouns. A drill that always
     says "él" never practises "usted", and conjuguemos-style practice is
     about recognising the person behind whichever pronoun turns up. `g` is
     the gender/number the pronoun fixes for French agreement: m, f, or '' for
     either (je, tu) — and 'any' where singular and plural are both possible
     (vous, on). */
  var LANGS = {
    es: {
      name: 'Spanish', subject: 'spanish',
      accents: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
      persons: ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'],
      show: [[{ p: 'yo' }], [{ p: 'tú' }], [{ p: 'él' }, { p: 'ella' }, { p: 'usted' }], [{ p: 'nosotros' }],
        [{ p: 'vosotros' }], [{ p: 'ellos' }, { p: 'ellas' }, { p: 'ustedes' }]],
    },
    fr: {
      name: 'French', subject: 'french',
      accents: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'œ'],
      persons: ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'],
      show: [[{ p: 'je', g: '' }], [{ p: 'tu', g: '' }], [{ p: 'il', g: 'm' }, { p: 'elle', g: 'f' }, { p: 'on', g: 'any' }],
        [{ p: 'nous', g: '' }], [{ p: 'vous', g: 'any' }], [{ p: 'ils', g: 'm' }, { p: 'elles', g: 'f' }]],
    },
    de: {
      name: 'German', subject: 'german',
      accents: ['ä', 'ö', 'ü', 'ß'],
      persons: ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie'],
      show: [[{ p: 'ich' }], [{ p: 'du' }], [{ p: 'er' }, { p: 'sie', hint: 'she' }, { p: 'es' }], [{ p: 'wir' }],
        [{ p: 'ihr' }], [{ p: 'sie', hint: 'they' }, { p: 'Sie', hint: 'you, polite' }]],
    },
  };
  function langOf(l) { return l === 'fr' || l === 'de' ? l : 'es'; }

  /* ── Verb sets ─────────────────────────────────────────────────────── */

  /* Chosen so a "regular" set is regular in every tense the drill offers —
     escribir is out of regular -ir because its participle is escrito, and the
     -car/-gar/-zar verbs have a set of their own because their yo preterite
     and subjunctive change spelling. Every verb in every set is swept through
     every tense by the unit test, so a set cannot quietly hold a verb the
     engine gets wrong. */
  var SETS = {
    es: [
      { id: 'regular', name: 'Common regular verbs', verbs: [
        ['hablar', 'to speak'], ['trabajar', 'to work'], ['estudiar', 'to study'], ['caminar', 'to walk'],
        ['comprar', 'to buy'], ['escuchar', 'to listen'], ['mirar', 'to look at, watch'], ['bailar', 'to dance'],
        ['cantar', 'to sing'], ['cocinar', 'to cook'], ['nadar', 'to swim'], ['tomar', 'to take, drink'],
        ['viajar', 'to travel'], ['ayudar', 'to help'], ['necesitar', 'to need'], ['preparar', 'to prepare'],
        ['comer', 'to eat'], ['beber', 'to drink'], ['aprender', 'to learn'], ['comprender', 'to understand'],
        ['correr', 'to run'], ['vender', 'to sell'], ['deber', 'to have to, owe'], ['responder', 'to answer'],
        ['vivir', 'to live'], ['recibir', 'to receive'], ['decidir', 'to decide'], ['subir', 'to go up'],
        ['compartir', 'to share'], ['asistir', 'to attend'], ['permitir', 'to allow'], ['discutir', 'to argue, discuss']] },
      { id: 'ar', name: 'Regular -ar verbs', verbs: [
        ['hablar', 'to speak'], ['trabajar', 'to work'], ['estudiar', 'to study'], ['caminar', 'to walk'],
        ['comprar', 'to buy'], ['escuchar', 'to listen'], ['mirar', 'to look at, watch'], ['bailar', 'to dance'],
        ['cantar', 'to sing'], ['cocinar', 'to cook'], ['nadar', 'to swim'], ['tomar', 'to take, drink'],
        ['viajar', 'to travel'], ['ayudar', 'to help'], ['necesitar', 'to need'], ['preparar', 'to prepare'],
        ['esperar', 'to wait, hope'], ['llevar', 'to carry, wear'], ['lavar', 'to wash'], ['descansar', 'to rest'],
        ['terminar', 'to finish'], ['entrar', 'to enter'], ['visitar', 'to visit'], ['enseñar', 'to teach'],
        ['ganar', 'to win, earn'], ['limpiar', 'to clean']] },
      { id: 'er', name: 'Regular -er verbs', verbs: [
        ['comer', 'to eat'], ['beber', 'to drink'], ['aprender', 'to learn'], ['comprender', 'to understand'],
        ['correr', 'to run'], ['vender', 'to sell'], ['deber', 'to have to, owe'], ['responder', 'to answer'],
        ['prometer', 'to promise'], ['meter', 'to put in'], ['temer', 'to fear'], ['sorprender', 'to surprise'],
        ['barrer', 'to sweep'], ['esconder', 'to hide']] },
      { id: 'ir', name: 'Regular -ir verbs', verbs: [
        ['vivir', 'to live'], ['recibir', 'to receive'], ['decidir', 'to decide'], ['subir', 'to go up'],
        ['compartir', 'to share'], ['asistir', 'to attend'], ['permitir', 'to allow'], ['discutir', 'to argue, discuss'],
        ['existir', 'to exist'], ['insistir', 'to insist'], ['partir', 'to leave, split'], ['sufrir', 'to suffer'],
        ['unir', 'to join'], ['añadir', 'to add']] },
      { id: 'irregular', name: 'Common irregular verbs', verbs: [
        ['ser', 'to be'], ['estar', 'to be'], ['ir', 'to go'], ['tener', 'to have'], ['hacer', 'to do, make'],
        ['decir', 'to say'], ['poder', 'to be able to'], ['querer', 'to want'], ['saber', 'to know (a fact)'],
        ['conocer', 'to know (a person)'], ['venir', 'to come'], ['poner', 'to put'], ['salir', 'to go out'],
        ['dar', 'to give'], ['ver', 'to see'], ['traer', 'to bring'], ['oír', 'to hear'], ['caer', 'to fall'],
        ['leer', 'to read'], ['construir', 'to build'], ['conducir', 'to drive']] },
      { id: 'stem', name: 'Stem-changing (boot) verbs', verbs: [
        ['pensar', 'to think'], ['querer', 'to want'], ['empezar', 'to begin'], ['entender', 'to understand'],
        ['perder', 'to lose'], ['cerrar', 'to close'], ['preferir', 'to prefer'], ['sentir', 'to feel'],
        ['poder', 'to be able to'], ['dormir', 'to sleep'], ['volver', 'to return'], ['contar', 'to count, tell'],
        ['encontrar', 'to find'], ['recordar', 'to remember'], ['almorzar', 'to have lunch'], ['costar', 'to cost'],
        ['jugar', 'to play'], ['pedir', 'to ask for'], ['servir', 'to serve'], ['repetir', 'to repeat'],
        ['seguir', 'to follow'], ['vestir', 'to dress'], ['morir', 'to die'], ['mostrar', 'to show']] },
      { id: 'spelling', name: 'Spelling changes (-car, -gar, -zar)', verbs: [
        ['buscar', 'to look for'], ['tocar', 'to touch, play'], ['sacar', 'to take out'], ['practicar', 'to practise'],
        ['explicar', 'to explain'], ['llegar', 'to arrive'], ['pagar', 'to pay'], ['jugar', 'to play'],
        ['apagar', 'to switch off'], ['empezar', 'to begin'], ['almorzar', 'to have lunch'], ['comenzar', 'to begin'],
        ['organizar', 'to organise'], ['cruzar', 'to cross']] },
    ],
    fr: [
      { id: 'regular', name: 'Common regular verbs', verbs: [
        ['parler', 'to speak'], ['aimer', 'to like, love'], ['regarder', 'to watch'], ['écouter', 'to listen'],
        ['jouer', 'to play'], ['travailler', 'to work'], ['habiter', 'to live'], ['chanter', 'to sing'],
        ['danser', 'to dance'], ['donner', 'to give'], ['trouver', 'to find'], ['penser', 'to think'],
        ['porter', 'to wear, carry'], ['chercher', 'to look for'], ['demander', 'to ask'], ['aider', 'to help'],
        ['finir', 'to finish'], ['choisir', 'to choose'], ['réussir', 'to succeed'], ['remplir', 'to fill'],
        ['grandir', 'to grow up'], ['réfléchir', 'to think, reflect'], ['obéir', 'to obey'],
        ['vendre', 'to sell'], ['attendre', 'to wait'], ['entendre', 'to hear'], ['répondre', 'to answer'],
        ['perdre', 'to lose'], ['rendre', 'to give back']] },
      { id: 'er', name: 'Regular -er verbs', verbs: [
        ['parler', 'to speak'], ['aimer', 'to like, love'], ['regarder', 'to watch'], ['écouter', 'to listen'],
        ['jouer', 'to play'], ['travailler', 'to work'], ['habiter', 'to live'], ['chanter', 'to sing'],
        ['danser', 'to dance'], ['donner', 'to give'], ['trouver', 'to find'], ['penser', 'to think'],
        ['porter', 'to wear, carry'], ['chercher', 'to look for'], ['demander', 'to ask'], ['aider', 'to help'],
        ['fermer', 'to close'], ['marcher', 'to walk'], ['arriver', 'to arrive'], ['entrer', 'to enter'],
        ['rester', 'to stay'], ['tomber', 'to fall'], ['oublier', 'to forget'], ['étudier', 'to study'],
        ['visiter', 'to visit'], ['préparer', 'to prepare'], ['détester', 'to hate'], ['raconter', 'to tell']] },
      { id: 'ir', name: 'Regular -ir verbs (finir)', verbs: [
        ['finir', 'to finish'], ['choisir', 'to choose'], ['réussir', 'to succeed'], ['remplir', 'to fill'],
        ['grandir', 'to grow up'], ['grossir', 'to put on weight'], ['maigrir', 'to lose weight'],
        ['réfléchir', 'to think, reflect'], ['obéir', 'to obey'], ['punir', 'to punish'], ['rougir', 'to blush'],
        ['bâtir', 'to build'], ['agir', 'to act'], ['applaudir', 'to clap'], ['guérir', 'to cure'],
        ['nourrir', 'to feed'], ['ralentir', 'to slow down'], ['saisir', 'to seize']] },
      { id: 're', name: 'Regular -re verbs', verbs: [
        ['vendre', 'to sell'], ['attendre', 'to wait'], ['entendre', 'to hear'], ['répondre', 'to answer'],
        ['perdre', 'to lose'], ['rendre', 'to give back'], ['descendre', 'to go down'], ['défendre', 'to defend'],
        ['mordre', 'to bite'], ['tondre', 'to mow'], ['fondre', 'to melt'], ['correspondre', 'to correspond']] },
      { id: 'irregular', name: 'Common irregular verbs', verbs: [
        ['être', 'to be'], ['avoir', 'to have'], ['aller', 'to go'], ['faire', 'to do, make'],
        ['pouvoir', 'to be able to'], ['vouloir', 'to want'], ['devoir', 'to have to'], ['savoir', 'to know (a fact)'],
        ['voir', 'to see'], ['venir', 'to come'], ['prendre', 'to take'], ['mettre', 'to put'], ['dire', 'to say'],
        ['lire', 'to read'], ['écrire', 'to write'], ['boire', 'to drink'], ['croire', 'to believe'],
        ['recevoir', 'to receive'], ['connaître', 'to know (a person)'], ['courir', 'to run'], ['mourir', 'to die'],
        ['vivre', 'to live'], ['suivre', 'to follow'], ['partir', 'to leave'], ['sortir', 'to go out'],
        ['dormir', 'to sleep'], ['ouvrir', 'to open'], ['offrir', 'to offer'], ['tenir', 'to hold'],
        ['comprendre', 'to understand'], ['apprendre', 'to learn'], ['devenir', 'to become'],
        ['revenir', 'to come back'], ['rire', 'to laugh'], ['conduire', 'to drive'], ['naître', 'to be born']] },
      { id: 'spelling', name: 'Spelling-change -er verbs', verbs: [
        ['manger', 'to eat'], ['nager', 'to swim'], ['voyager', 'to travel'], ['changer', 'to change'],
        ['commencer', 'to begin'], ['lancer', 'to throw'], ['placer', 'to place'], ['acheter', 'to buy'],
        ['lever', 'to raise'], ['promener', 'to walk (a dog)'], ['préférer', 'to prefer'], ['espérer', 'to hope'],
        ['répéter', 'to repeat'], ['appeler', 'to call'], ['jeter', 'to throw away'], ['envoyer', 'to send'],
        ['payer', 'to pay'], ['essayer', 'to try'], ['nettoyer', 'to clean'], ['employer', 'to use']] },
      { id: 'etre', name: 'Verbs with être (DR & MRS VANDERTRAMP)', verbs: [
        ['aller', 'to go'], ['venir', 'to come'], ['arriver', 'to arrive'], ['partir', 'to leave'],
        ['entrer', 'to enter'], ['sortir', 'to go out'], ['monter', 'to go up'], ['descendre', 'to go down'],
        ['naître', 'to be born'], ['mourir', 'to die'], ['rester', 'to stay'], ['tomber', 'to fall'],
        ['retourner', 'to return'], ['revenir', 'to come back'], ['devenir', 'to become'], ['rentrer', 'to go home']] },
    ],
    de: [
      { id: 'regular', name: 'Common regular (weak) verbs', verbs: [
        ['machen', 'to do, make'], ['spielen', 'to play'], ['lernen', 'to learn'], ['kaufen', 'to buy'],
        ['wohnen', 'to live'], ['arbeiten', 'to work'], ['hören', 'to hear'], ['sagen', 'to say'],
        ['fragen', 'to ask'], ['kochen', 'to cook'], ['tanzen', 'to dance'], ['reisen', 'to travel'],
        ['warten', 'to wait'], ['antworten', 'to answer'], ['brauchen', 'to need'], ['glauben', 'to believe'],
        ['lieben', 'to love'], ['zeigen', 'to show'], ['besuchen', 'to visit'], ['studieren', 'to study'],
        ['öffnen', 'to open'], ['leben', 'to live'], ['suchen', 'to look for'], ['wandern', 'to hike']] },
      { id: 'irregular', name: 'Common irregular (strong) verbs', verbs: [
        ['sein', 'to be'], ['haben', 'to have'], ['werden', 'to become'], ['gehen', 'to go'], ['kommen', 'to come'],
        ['fahren', 'to drive, travel'], ['geben', 'to give'], ['nehmen', 'to take'], ['sehen', 'to see'],
        ['lesen', 'to read'], ['essen', 'to eat'], ['sprechen', 'to speak'], ['helfen', 'to help'],
        ['schlafen', 'to sleep'], ['laufen', 'to run'], ['finden', 'to find'], ['trinken', 'to drink'],
        ['bleiben', 'to stay'], ['schreiben', 'to write'], ['singen', 'to sing'], ['schwimmen', 'to swim'],
        ['sitzen', 'to sit'], ['stehen', 'to stand'], ['liegen', 'to lie'], ['tragen', 'to carry, wear'],
        ['treffen', 'to meet'], ['vergessen', 'to forget'], ['verstehen', 'to understand'], ['beginnen', 'to begin'],
        ['fliegen', 'to fly']] },
      { id: 'stem', name: 'Vowel change in du and er', verbs: [
        ['fahren', 'to drive, travel'], ['schlafen', 'to sleep'], ['tragen', 'to carry, wear'], ['waschen', 'to wash'],
        ['laufen', 'to run'], ['fallen', 'to fall'], ['halten', 'to hold, stop'], ['lassen', 'to let, leave'],
        ['geben', 'to give'], ['nehmen', 'to take'], ['sehen', 'to see'], ['lesen', 'to read'], ['essen', 'to eat'],
        ['sprechen', 'to speak'], ['helfen', 'to help'], ['treffen', 'to meet'], ['werfen', 'to throw'],
        ['vergessen', 'to forget'], ['sterben', 'to die'], ['empfehlen', 'to recommend']] },
      { id: 'modal', name: 'Modal and mixed verbs', verbs: [
        ['können', 'to be able to'], ['müssen', 'to have to'], ['dürfen', 'to be allowed to'], ['wollen', 'to want'],
        ['sollen', 'to be supposed to'], ['mögen', 'to like'], ['wissen', 'to know (a fact)'], ['bringen', 'to bring'],
        ['denken', 'to think'], ['kennen', 'to know (a person)'], ['nennen', 'to name'], ['rennen', 'to run']] },
      { id: 'separable', name: 'Separable verbs', verbs: [
        ['aufstehen', 'to get up'], ['anfangen', 'to begin'], ['ankommen', 'to arrive'], ['anrufen', 'to phone'],
        ['einkaufen', 'to go shopping'], ['fernsehen', 'to watch TV'], ['mitkommen', 'to come along'],
        ['aufmachen', 'to open'], ['zumachen', 'to close'], ['ausgehen', 'to go out'], ['einladen', 'to invite'],
        ['einschlafen', 'to fall asleep'], ['aufräumen', 'to tidy up'], ['zuhören', 'to listen'],
        ['abholen', 'to pick up'], ['mitbringen', 'to bring along']] },
    ],
  };
  function sets(lang) {
    return SETS[langOf(lang)].map(function (s) { return { id: s.id, name: s.name, count: s.verbs.length }; });
  }
  function setById(lang, id) {
    var list = SETS[langOf(lang)];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function setVerbs(lang, id) {
    var s = setById(lang, id);
    return s ? s.verbs.map(function (v) { return v[0]; }) : [];
  }
  /** The English for a verb, from the sets or the engine's irregular lists. */
  function gloss(E, lang, verb) {
    var l = langOf(lang), i, j;
    for (i = 0; i < SETS[l].length; i++) {
      for (j = 0; j < SETS[l][i].verbs.length; j++) if (SETS[l][i].verbs[j][0] === verb) return SETS[l][i].verbs[j][1];
    }
    try {
      var irr = E.irregulars(l);
      for (i = 0; i < irr.length; i++) if (irr[i][0] === verb) return irr[i][1];
    } catch (e) { /* no engine list */ }
    return '';
  }
  /** A set verb typed without its accents (ecouter) → the set's spelling. */
  function fromSets(lang, verb) {
    var l = langOf(lang), bare = loose(verb);
    if (bare !== verb) return verb;
    for (var i = 0; i < SETS[l].length; i++) {
      for (var j = 0; j < SETS[l][i].verbs.length; j++) if (loose(SETS[l][i].verbs[j][0]) === bare) return SETS[l][i].verbs[j][0];
    }
    return verb;
  }
  function inSets(lang, verb) {
    var l = langOf(lang);
    return SETS[l].some(function (s) { return s.verbs.some(function (v) { return v[0] === verb; }); });
  }

  /* ── Text helpers ──────────────────────────────────────────────────── */

  /** What someone typed, tidied: one spacing, lower case, straight apostrophes. */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'")
      .replace(/\s+/g, ' ').replace(/\s*'\s*/g, "'").trim()
      .replace(/[.!]+$/, '');
  }
  /** norm, then every accent, umlaut and cedilla removed (ß → ss, œ → oe). */
  function loose(s) {
    return norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }
  /** Do these two differ only in accents? */
  function accentOnly(a, b) { return norm(a) !== norm(b) && loose(a) === loose(b); }

  function utf8b64(str) {
    var bytes = new TextEncoder().encode(String(str));
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64utf8(b64) {
    var s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(out);
  }

  /* cyrb53: a small, well-mixed 53-bit hash. Not cryptography — there is no
     secret to protect it with — just a check value that changes completely
     when one character of what it covers changes. */
  function cyrb53(str, seed) {
    var h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function hash36(str, len, seed) {
    var h = cyrb53(str, seed).toString(36);
    while (h.length < len) h = '0' + h;
    return h.slice(-len);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /** Today (or `t`) as a local yyyymmdd number. */
  function ymd(t) {
    var d = t == null ? new Date() : new Date(t);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(n) {
    n = Number(n) || 0;
    var y = Math.floor(n / 10000), m = Math.floor(n / 100) % 100, d = n % 100;
    if (!y || m < 1 || m > 12 || d < 1) return '';
    return d + ' ' + MONTHS[m - 1] + ' ' + y;
  }
  function fmtSecs(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }

  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    var b = a.slice();
    for (var i = b.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  /* ── Settings ──────────────────────────────────────────────────────── */

  function defaultConfig(lang, E) {
    var l = langOf(lang);
    var first = E ? E.tenses(l)[0].id : 'present';
    return { lang: l, tenses: [first], set: 'regular', custom: [], persons: [0, 1, 2, 3, 4, 5], mode: 'time', minutes: 2, count: 20, exact: false };
  }
  function clampInt(v, lo, hi, dflt) {
    var n = Math.round(Number(v));
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  }
  /** A config with every field present and in range; unknown tenses/sets dropped. */
  function sanitizeConfig(c, E) {
    c = c && typeof c === 'object' ? c : {};
    var l = langOf(c.lang);
    var d = defaultConfig(l, E);
    var known = E ? E.tenses(l).map(function (t) { return t.id; }) : null;
    var tenses = Array.isArray(c.tenses) ? c.tenses.filter(function (t, i, a) {
      return typeof t === 'string' && a.indexOf(t) === i && (!known || known.indexOf(t) !== -1);
    }) : [];
    var persons = Array.isArray(c.persons) ? c.persons.map(Number).filter(function (p, i, a) {
      return p >= 0 && p <= 5 && Math.floor(p) === p && a.indexOf(p) === i;
    }).sort() : [];
    var custom = Array.isArray(c.custom) ? c.custom.filter(function (v) { return typeof v === 'string' && v; }).slice(0, 60) : [];
    var set = c.set === 'custom' || setById(l, c.set) ? c.set : d.set;
    return {
      lang: l,
      tenses: tenses.length ? tenses : d.tenses,
      set: set,
      custom: custom,
      persons: persons.length ? persons : d.persons,
      mode: c.mode === 'count' ? 'count' : 'time',
      minutes: clampInt(c.minutes, 1, 5, d.minutes),
      count: clampInt(c.count, 5, 100, d.count),
      exact: !!c.exact,
    };
  }
  function verbsFor(cfg) { return cfg.set === 'custom' ? cfg.custom.slice() : setVerbs(cfg.lang, cfg.set); }

  /** Same settings, same key — the key best scores are kept under. */
  function configKey(cfg) {
    var verbs = cfg.set === 'custom' ? 'custom:' + hash36(cfg.custom.join(','), 6) : cfg.set;
    return [cfg.lang, cfg.tenses.slice().sort().join('+'), verbs, cfg.persons.join(''),
      cfg.mode === 'count' ? 'n' + cfg.count : 't' + cfg.minutes, cfg.exact ? 'x' : 'a'].join('|');
  }
  function tenseName(E, lang, id) {
    var t = E.tenses(lang).filter(function (x) { return x.id === id; })[0];
    return t ? t.name : id;
  }
  /** "Preterite, Imperfect · Common irregular verbs · 2 minutes" */
  function describe(cfg, E) {
    var verbs = cfg.set === 'custom' ? cfg.custom.length + ' chosen verb' + (cfg.custom.length === 1 ? '' : 's')
      : (setById(cfg.lang, cfg.set) || {}).name || cfg.set;
    var len = cfg.mode === 'count' ? cfg.count + ' questions' : cfg.minutes + ' minute' + (cfg.minutes === 1 ? '' : 's');
    return cfg.tenses.map(function (t) { return tenseName(E, cfg.lang, t); }).join(', ') + ' · ' + verbs + ' · ' + len;
  }

  /** Parse a typed list of verbs: what will be drilled, refused, and not in the tables. */
  function parseCustom(E, lang, text) {
    var l = langOf(lang);
    var seen = {}, verbs = [], refused = [], unlisted = [];
    String(text || '').split(/[\s,;/]+/).forEach(function (raw) {
      var t = E.clean(raw).replace(/^to$/, '');
      if (!t || seen[t]) return;
      seen[t] = 1;
      var v;
      try {
        v = E.resolve(l, t);
        if (v === t) v = fromSets(l, t);
        E.conjugate(l, v, 'present');
      } catch (e) {
        refused.push({ verb: t, why: e.message });
        return;
      }
      if (verbs.indexOf(v) !== -1) return;
      if (verbs.length >= 60) { refused.push({ verb: t, why: 'A list holds up to 60 verbs.' }); return; }
      verbs.push(v);
      if (!E.known(l, v) && !inSets(l, v)) unlisted.push(v);
    });
    return { verbs: verbs, refused: refused, unlisted: unlisted };
  }

  /* ── Questions ─────────────────────────────────────────────────────── */

  /** Every verb × tense × person this config can ask (impersonal blanks skipped). */
  function buildPool(E, cfg) {
    var pool = [];
    verbsFor(cfg).forEach(function (verb) {
      cfg.tenses.forEach(function (tense) {
        var r;
        try { r = E.conjugate(cfg.lang, verb, tense); } catch (e) { return; }
        cfg.persons.forEach(function (p) {
          var f = r.forms[p];
          if (f && f !== '—') pool.push({ verb: r.verb, tense: tense, person: p });
        });
      });
    });
    return pool;
  }

  /** `n` items drawn through shuffled passes of the pool, never the same item twice running. */
  function makeQueue(pool, n, rnd) {
    var out = [];
    if (!pool.length) return out;
    while (out.length < n) {
      var pass = shuffle(pool, rnd);
      var last = out[out.length - 1];
      if (last && pass.length > 1 && sameItem(pass[0], last)) pass.push(pass.shift());
      for (var i = 0; i < pass.length && out.length < n; i++) out.push(pass[i]);
    }
    return out;
  }
  function sameItem(a, b) { return a.verb === b.verb && a.tense === b.tense && a.person === b.person; }

  /* French être verbs agree: elle est allée, nous sommes allé(e)s. The pronoun
     on screen decides which endings are right — je may be a girl or a boy,
     elle may not be a boy, vous may be one person or several. */
  function agreeVariants(pp, g, person) {
    // A participle already ending in s (assis) takes no second s in the plural.
    var ms = pp, fs = pp + 'e', mp = /s$/.test(pp) ? pp : pp + 's', fp = pp + 'es';
    if (g === 'any') return [ms, fs, mp, fp];
    if (person < 3) return g === 'm' ? [ms] : g === 'f' ? [fs] : [ms, fs];
    return g === 'm' ? [mp] : g === 'f' ? [fp] : [mp, fp];
  }

  /**
   * One question: the item, the pronoun shown, and every answer accepted
   * (answers[0] is the one to show). `rnd` picks which pronoun stands for the
   * person (él, ella or usted); pass () => 0 for the first.
   */
  function makeQuestion(E, item, lang, rnd) {
    var l = langOf(lang);
    var r = E.conjugate(l, item.verb, item.tense);
    var choices = LANGS[l].show[item.person];
    var who = choices[Math.floor((rnd || Math.random)() * choices.length) % choices.length];
    var main = r.forms[item.person];
    var answers = [main];
    if (r.agree) {
      var at = main.lastIndexOf(' ');
      var aux = main.slice(0, at + 1);
      var pp = E.pastParticiple(l, item.verb);
      answers = agreeVariants(pp, who.g, item.person).map(function (x) { return aux + x; });
    }
    (r.alts && r.alts[item.person] || []).forEach(function (a) { if (answers.indexOf(a) === -1) answers.push(a); });
    // The pronoun column: j' before avoir in the passé composé (engine), and
    // before any vowel or silent h when the whole phrase is shown.
    var shown = r.pronouns[item.person] === "j'" ? "j'" : who.p;
    return {
      verb: r.verb,
      gloss: gloss(E, l, r.verb),
      tense: item.tense,
      tenseName: tenseName(E, l, item.tense),
      person: item.person,
      pronoun: shown,
      hint: who.hint || '',
      answers: answers,
      note: r.note || '',
    };
  }

  /** The full phrase, for feedback: "j'ai parlé", "elle est allée", "yo hablo". */
  function phrase(q, form) {
    var f = form == null ? q.answers[0] : form;
    if (q.pronoun === "j'") return "j'" + f;
    if (q.pronoun === 'je' && (/^[aeiouéèêœ]/i.test(f) || (/^h/i.test(f) && ASPIRATED.indexOf(q.verb) === -1))) return "j'" + f;
    return q.pronoun + ' ' + f;
  }
  // Verbs whose h is "aspiré": je hais, never "j'hais".
  var ASPIRATED = ['haïr', 'hurler', 'hausser', 'heurter', 'hacher', 'hanter', 'huer', 'hisser', 'hâter', 'harceler'];

  /* ── Marking ───────────────────────────────────────────────────────── */

  /* Typing the pronoun as well ("yo hablo", "j'ai parlé") is not wrong, so it
     is taken off before comparing. */
  function withoutPronoun(text, q, lang) {
    var t = norm(text);
    var l = langOf(lang);
    var cands = [q.pronoun, "j'", 'je'].concat(LANGS[l].show[q.person].map(function (s) { return s.p; }));
    for (var i = 0; i < cands.length; i++) {
      var c = norm(cands[i]);
      if (!c) continue;
      if (c.slice(-1) === "'" && t.indexOf(c) === 0 && t.length > c.length) return t.slice(c.length);
      if (t.indexOf(c + ' ') === 0 && t.length > c.length + 1) return t.slice(c.length + 1);
    }
    return t;
  }

  /**
   * Mark an answer. { ok, accents } — `accents` is true when only accents
   * differ: right when accents are not required (with a note), wrong when
   * they are. `empty` when nothing was typed.
   */
  function check(given, q, opts) {
    var exact = !!(opts && opts.exact);
    var lang = (opts && opts.lang) || 'es';
    var t = norm(given);
    if (!t) return { ok: false, empty: true, accents: false, expected: q.answers[0] };
    var tries = [t, withoutPronoun(t, q, lang)];
    var i, j;
    for (i = 0; i < tries.length; i++) {
      for (j = 0; j < q.answers.length; j++) {
        if (tries[i] === norm(q.answers[j])) return { ok: true, accents: false, expected: q.answers[j] };
      }
    }
    for (i = 0; i < tries.length; i++) {
      for (j = 0; j < q.answers.length; j++) {
        if (loose(tries[i]) === loose(q.answers[j])) return { ok: !exact, accents: true, expected: q.answers[j] };
      }
    }
    return { ok: false, accents: false, expected: q.answers[0] };
  }

  /* ── Rounds ────────────────────────────────────────────────────────── */

  /** What the end-of-round screen and the history need. */
  function summarize(results, secs) {
    var correct = 0, missed = [];
    (results || []).forEach(function (r) {
      if (r.ok) correct++;
      else missed.push(r);
    });
    var answered = (results || []).length;
    return {
      correct: correct,
      answered: answered,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      secs: Math.max(0, Math.round(secs || 0)),
      missed: missed,
    };
  }
  /** The items behind a round's mistakes, once each, for "Practise my mistakes". */
  function mistakeItems(results) {
    var out = [];
    (results || []).forEach(function (r) {
      if (r.ok || !r.verb) return;
      var it = { verb: r.verb, tense: r.tense, person: r.person };
      if (!out.some(function (x) { return sameItem(x, it); })) out.push(it);
    });
    return out;
  }

  /* ── Assignment links ──────────────────────────────────────────────── */

  var TITLE_MAX = 80;
  function cleanTitle(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX); }

  /**
   * An assignment: settings plus who-what-when. The verb list is always
   * carried in full, even for a named set, so a later change to a set cannot
   * change an assignment already handed out.
   */
  function newAssignment(cfg, extra, E) {
    var c = sanitizeConfig(cfg, E);
    extra = extra || {};
    var id = extra.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(-8);
    var goal = clampInt(extra.goal, 0, 500, 0);
    if (c.mode === 'count') goal = Math.min(goal, c.count);
    return {
      v: 1, id: String(id).replace(/[^0-9a-z]/gi, '').slice(0, 12) || 'a',
      title: cleanTitle(extra.title) || 'Verb practice',
      lang: c.lang, tenses: c.tenses, set: c.set, verbs: verbsFor(c), persons: c.persons,
      mode: c.mode, n: c.mode === 'count' ? c.count : c.minutes, goal: goal, exact: c.exact,
      made: extra.made || ymd(),
    };
  }
  /** The config a student plays for an assignment. */
  function assignmentConfig(a) {
    return {
      lang: a.lang, tenses: a.tenses.slice(), set: 'custom', custom: a.verbs.slice(), persons: a.persons.slice(),
      mode: a.mode, minutes: a.mode === 'time' ? a.n : 2, count: a.mode === 'count' ? a.n : 20, exact: a.exact,
    };
  }
  function encodeAssignment(a) {
    return utf8b64(JSON.stringify({
      v: 1, i: a.id, t: a.title, l: a.lang, ts: a.tenses, s: a.set, vb: a.verbs, p: a.persons.join(''),
      m: a.mode === 'count' ? 'n' : 't', n: a.n, g: a.goal, a: a.exact ? 1 : 0, d: a.made,
    }));
  }
  /** Read a link's payload, or throw an Error with a sentence a person can act on. */
  function decodeAssignment(code, E) {
    var raw;
    try { raw = JSON.parse(b64utf8(String(code || '').trim())); } catch (e) {
      throw new Error('This link is incomplete or was changed. Ask your teacher to send it again.');
    }
    if (!raw || raw.v !== 1) throw new Error('This link is for a different version of Flux. Ask your teacher to make it again.');
    var l = raw.l;
    if (l !== 'es' && l !== 'fr' && l !== 'de') throw new Error('This link does not say which language to practise.');
    var known = E.tenses(l).map(function (t) { return t.id; });
    var tenses = (Array.isArray(raw.ts) ? raw.ts : []).filter(function (t, i, a) { return known.indexOf(t) !== -1 && a.indexOf(t) === i; });
    if (!tenses.length) throw new Error('This link asks for tenses Flux does not have.');
    var verbs = [];
    (Array.isArray(raw.vb) ? raw.vb : []).slice(0, 60).forEach(function (v) {
      if (typeof v !== 'string' || verbs.indexOf(v) !== -1) return;
      try { E.conjugate(l, v, 'present'); verbs.push(E.resolve(l, v)); } catch (e) { /* dropped */ }
    });
    if (!verbs.length) throw new Error('This link has no verbs Flux can conjugate.');
    var persons = String(raw.p || '').split('').map(Number).filter(function (p, i, a) { return p >= 0 && p <= 5 && a.indexOf(p) === i; });
    if (!persons.length) throw new Error('This link has no pronouns to practise.');
    var mode = raw.m === 'n' ? 'count' : 'time';
    var n = mode === 'count' ? clampInt(raw.n, 5, 100, 20) : clampInt(raw.n, 1, 5, 2);
    var made = clampInt(raw.d, 20200101, 21001231, ymd());
    return {
      v: 1, id: String(raw.i || '').replace(/[^0-9a-z]/gi, '').slice(0, 12) || 'a',
      title: cleanTitle(raw.t) || 'Verb practice', lang: l, tenses: tenses,
      set: typeof raw.s === 'string' ? raw.s.slice(0, 20) : 'custom', verbs: verbs, persons: persons,
      mode: mode, n: n, goal: Math.min(clampInt(raw.g, 0, 500, 0), mode === 'count' ? n : 500),
      exact: raw.a === 1, made: made,
    };
  }
  /* The fingerprint names an assignment exactly: its id and every setting.
     A student who edits the link (fewer verbs, a shorter round) gets a
     different fingerprint, and the checker says the code is for a different
     assignment. */
  function fingerprint(a) {
    return hash36(['fv-assign', a.id, a.title, a.lang, a.tenses.join(','), a.verbs.join(','), a.persons.join(''),
      a.mode, a.n, a.goal, a.exact ? 1 : 0, a.made].join('|'), 6, 17);
  }
  function assignmentUrl(base, a) { return String(base).replace(/#.*$/, '') + '#verbs=' + encodeAssignment(a); }
  function describeAssignment(a, E) {
    var verbs = a.verbs.length <= 6 ? a.verbs.join(', ') : a.verbs.slice(0, 6).join(', ') + ' and ' + (a.verbs.length - 6) + ' more';
    return {
      language: LANGS[a.lang].name,
      tenses: a.tenses.map(function (t) { return tenseName(E, a.lang, t); }).join(', '),
      verbs: verbs,
      pronouns: a.persons.map(function (p) { return LANGS[a.lang].persons[p]; }).join(', '),
      length: a.mode === 'count' ? a.n + ' questions' : a.n + ' minute' + (a.n === 1 ? '' : 's'),
      goal: a.goal ? a.goal + ' correct' : '',
      accents: a.exact ? 'Accents must be exact' : 'Missing accents are allowed',
    };
  }

  /* ── Score codes ───────────────────────────────────────────────────── */

  /*  FV1.<assignment>.<correct>.<answered>.<seconds>.<yyyymmdd>.<name>.<check>
      e.g. FV1.k3x9q2.18.20.120.20261016.QW5hIFDDqXJleg.a8k2m1z

      The numbers are readable at a glance; the name is base64 so a code is one
      unbroken word that survives being pasted anywhere. The check covers every
      other field, so changing any of them — or pasting half a code — shows. */
  var CODE_RE = /FV1\.[^\s"'<>(),;]+/g;
  function codeCheck(parts) { return hash36('fv1|' + parts.join('|'), 7, 29); }
  function makeCode(r) {
    var name = String(r.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var parts = [r.fp, String(clampInt(r.correct, 0, 9999, 0)), String(clampInt(r.answered, 0, 9999, 0)),
      String(clampInt(r.secs, 0, 99999, 0)), String(r.date || ymd()), utf8b64(name)];
    return 'FV1.' + parts.join('.') + '.' + codeCheck(parts);
  }
  /** One code token → its fields and whether its check holds. */
  function readCode(token) {
    var t = String(token || '').trim().replace(/[.]+$/, '');
    var bits = t.split('.');
    var out = { code: t, ok: false };
    if (bits.length !== 8 || bits[0] !== 'FV1') return out;
    var parts = bits.slice(1, 7);
    if (!/^[0-9a-z]{6}$/.test(parts[0]) || !/^\d{1,4}$/.test(parts[1]) || !/^\d{1,4}$/.test(parts[2])
      || !/^\d{1,5}$/.test(parts[3]) || !/^\d{8}$/.test(parts[4]) || !/^[A-Za-z0-9_-]{1,80}$/.test(parts[5])) return out;
    var name;
    try { name = b64utf8(parts[5]); } catch (e) { return out; }
    out.fp = parts[0];
    out.correct = Number(parts[1]);
    out.answered = Number(parts[2]);
    out.secs = Number(parts[3]);
    out.date = Number(parts[4]);
    out.name = name;
    out.parsed = true;
    out.ok = bits[7] === codeCheck(parts);
    return out;
  }
  /**
   * Every score code in a pasted block (a Classroom comment thread, a
   * spreadsheet column…), each with a status for the teacher:
   *   ok        — the check holds and it is for this assignment
   *   other     — the check holds, but it was made for a different assignment
   *   edited    — the check does not hold: changed by hand, mistyped or cut short
   *   duplicate — the same code pasted twice
   *   early     — dated before the assignment was made
   *   odd       — numbers that cannot happen (more right than answered…)
   */
  function checkCodes(text, assignment) {
    var fp = assignment ? fingerprint(assignment) : null;
    var seen = {};
    var rows = [];
    (String(text || '').match(CODE_RE) || []).forEach(function (tok) {
      var r = readCode(tok);
      var row = {
        code: r.code, name: r.name || '', correct: r.correct, answered: r.answered, secs: r.secs, date: r.date,
        accuracy: r.parsed && r.answered ? Math.round((r.correct / r.answered) * 100) : 0,
        goalMet: null, status: 'ok',
      };
      if (seen[r.code]) row.status = 'duplicate';
      else if (!r.parsed || !r.ok) row.status = 'edited';
      else if (fp && r.fp !== fp) row.status = 'other';
      else if (r.correct > r.answered || (assignment && assignment.mode === 'count' && r.answered > assignment.n)) row.status = 'odd';
      else if (assignment && r.date < assignment.made) row.status = 'early';
      if (assignment && r.parsed && assignment.goal) row.goalMet = r.correct >= assignment.goal;
      seen[r.code] = 1;
      rows.push(row);
    });
    return rows;
  }
  var STATUS_TEXT = {
    ok: 'Matches this assignment',
    other: 'Made for a different assignment',
    edited: 'Changed or incomplete — ask for the code again',
    duplicate: 'Pasted twice',
    early: 'Dated before this assignment was made',
    odd: 'The numbers do not add up',
  };

  /* ── The store (inside the langPractice slice) ─────────────────────── */

  var CAP = { history: 60, best: 80, assignments: 30, made: 40 };
  function emptyStore() { return { v: 1, name: '', settings: {}, history: [], best: {}, assignments: [], made: [] }; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }

  function cleanEntry(h) {
    if (!h || typeof h !== 'object' || typeof h.id !== 'string') return null;
    return {
      id: h.id.slice(0, 24), at: num(h.at), lang: langOf(h.lang), key: str(h.key, 300), label: str(h.label, 300),
      correct: Math.max(0, num(h.correct)), answered: Math.max(0, num(h.answered)), secs: Math.max(0, num(h.secs)),
      fp: str(h.fp, 6),
    };
  }
  function cleanAttempt(b) {
    if (!b || typeof b !== 'object') return null;
    return { correct: Math.max(0, num(b.correct)), answered: Math.max(0, num(b.answered)), secs: Math.max(0, num(b.secs)), at: num(b.at), code: str(b.code, 200) };
  }
  function cleanAsg(a) {
    if (!a || typeof a !== 'object' || typeof a.fp !== 'string' || typeof a.link !== 'string') return null;
    return { fp: a.fp.slice(0, 6), title: str(a.title, TITLE_MAX), lang: langOf(a.lang), link: a.link.slice(0, 4000), at: num(a.at), best: cleanAttempt(a.best) };
  }
  /** Whatever came from storage or the cloud, made safe to use. */
  function sanitizeStore(x, E) {
    var s = emptyStore();
    if (!x || typeof x !== 'object') return s;
    s.name = str(x.name, 40);
    if (x.settings && typeof x.settings === 'object') {
      ['es', 'fr', 'de'].forEach(function (l) {
        if (x.settings[l] && typeof x.settings[l] === 'object') s.settings[l] = sanitizeConfig(Object.assign({}, x.settings[l], { lang: l }), E);
      });
    }
    s.history = (Array.isArray(x.history) ? x.history : []).map(cleanEntry).filter(Boolean).slice(0, CAP.history);
    if (x.best && typeof x.best === 'object') {
      Object.keys(x.best).slice(0, CAP.best).forEach(function (k) {
        var b = cleanAttempt(x.best[k]);
        if (b) s.best[k.slice(0, 300)] = b;
      });
    }
    s.assignments = (Array.isArray(x.assignments) ? x.assignments : []).map(cleanAsg).filter(Boolean).slice(0, CAP.assignments);
    s.made = (Array.isArray(x.made) ? x.made : []).map(cleanAsg).filter(Boolean).slice(0, CAP.made);
    return s;
  }
  /** Better: more right; then more accurate; then (a tie) the earlier one stands. */
  function better(a, b) {
    if (!b) return !!a;
    if (!a) return false;
    if (a.correct !== b.correct) return a.correct > b.correct;
    var ra = a.answered ? a.correct / a.answered : 0, rb = b.answered ? b.correct / b.answered : 0;
    return ra > rb;
  }
  function byNewest(a, b) { return (b.at || 0) - (a.at || 0); }

  /** A finished round: into the history, and into best scores if it beat them. */
  function recordRound(store, entry) {
    var s = sanitizeStore(store);
    var e = cleanEntry(entry);
    if (!e) return { store: s, best: false };
    s.history = [e].concat(s.history.filter(function (h) { return h.id !== e.id; })).slice(0, CAP.history);
    var isBest = false;
    if (!e.fp) {
      var prev = s.best[e.key];
      if (better(e, prev)) { s.best[e.key] = { correct: e.correct, answered: e.answered, secs: e.secs, at: e.at, code: '' }; isBest = !!prev || e.correct > 0; }
      var keys = Object.keys(s.best);
      if (keys.length > CAP.best) {
        keys.sort(function (a, b) { return (s.best[a].at || 0) - (s.best[b].at || 0); });
        keys.slice(0, keys.length - CAP.best).forEach(function (k) { delete s.best[k]; });
      }
    }
    return { store: s, best: isBest };
  }
  /** An assignment opened (and, with `attempt`, a result for it — kept if it is the best so far). */
  function recordAssignment(store, info, attempt) {
    var s = sanitizeStore(store);
    var cur = s.assignments.filter(function (a) { return a.fp === info.fp; })[0];
    var next = cleanAsg(Object.assign({}, cur || {}, info, { at: (cur && cur.at) || info.at || Date.now(), best: cur ? cur.best : null }));
    if (!next) return s;
    if (attempt && better(attempt, next.best)) next.best = cleanAttempt(attempt);
    s.assignments = [next].concat(s.assignments.filter(function (a) { return a.fp !== info.fp; })).slice(0, CAP.assignments);
    return s;
  }
  function recordMade(store, info) {
    var s = sanitizeStore(store);
    var next = cleanAsg(info);
    if (!next) return s;
    s.made = [next].concat(s.made.filter(function (a) { return a.fp !== next.fp; })).slice(0, CAP.made);
    return s;
  }

  /* Two devices' stores, merged. Nothing a student did on either is lost:
     history is the union by round, best scores take the better, an
     assignment keeps its better attempt. Settings and name are this device's
     unless it has none — they are preferences, not progress. */
  function mergeStore(local, remote) {
    var a = sanitizeStore(local), b = sanitizeStore(remote);
    var out = emptyStore();
    out.name = a.name || b.name;
    out.settings = Object.assign({}, b.settings, a.settings);
    var hist = {};
    a.history.concat(b.history).forEach(function (h) { if (!hist[h.id]) hist[h.id] = h; });
    out.history = Object.keys(hist).map(function (k) { return hist[k]; }).sort(byNewest).slice(0, CAP.history);
    Object.keys(a.best).concat(Object.keys(b.best)).forEach(function (k) {
      var x = a.best[k], y = b.best[k];
      out.best[k] = better(y, x) ? y : x || y;
    });
    [['assignments', CAP.assignments], ['made', CAP.made]].forEach(function (pair) {
      var key = pair[0], byFp = {};
      a[key].concat(b[key]).forEach(function (r) {
        var cur = byFp[r.fp];
        if (!cur) { byFp[r.fp] = r; return; }
        var keep = Object.assign({}, cur);
        if (better(r.best, cur.best)) keep.best = r.best;
        keep.at = Math.min(cur.at || r.at, r.at || cur.at);
        byFp[r.fp] = keep;
      });
      out[key] = Object.keys(byFp).map(function (k) { return byFp[k]; }).sort(byNewest).slice(0, pair[1]);
    });
    return out;
  }

  root.FluxVerbCore = {
    LANGS: LANGS, STATUS_TEXT: STATUS_TEXT,
    sets: sets, setById: setById, setVerbs: setVerbs, gloss: gloss,
    norm: norm, loose: loose, accentOnly: accentOnly, ymd: ymd, fmtDate: fmtDate, fmtSecs: fmtSecs, shuffle: shuffle,
    defaultConfig: defaultConfig, sanitizeConfig: sanitizeConfig, verbsFor: verbsFor, configKey: configKey,
    describe: describe, tenseName: tenseName, parseCustom: parseCustom,
    buildPool: buildPool, makeQueue: makeQueue, makeQuestion: makeQuestion, phrase: phrase, check: check,
    summarize: summarize, mistakeItems: mistakeItems,
    newAssignment: newAssignment, assignmentConfig: assignmentConfig, encodeAssignment: encodeAssignment,
    decodeAssignment: decodeAssignment, fingerprint: fingerprint, assignmentUrl: assignmentUrl,
    describeAssignment: describeAssignment,
    makeCode: makeCode, readCode: readCode, checkCodes: checkCodes,
    emptyStore: emptyStore, sanitizeStore: sanitizeStore, recordRound: recordRound,
    recordAssignment: recordAssignment, recordMade: recordMade, mergeStore: mergeStore, better: better,
  };
})();
