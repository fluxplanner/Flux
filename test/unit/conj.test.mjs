import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Flux Lingo's conjugator (public/js/flux-conj.js): every tense of every
 * Spanish and French verb. Three kinds of check:
 *
 *  1. Textbook forms for the verbs that catch conjugators out, in every tense.
 *  2. Agreement with the verb drill's engine (flux-lang-engine.js) on every
 *     form both can produce for a verb the drill knows — a drill and a
 *     reference that disagree teach two answers.
 *  3. Every dictionary verb conjugates, with all six persons where a verb has them.
 */

const w = {};
new Function('window', fs.readFileSync('public/js/flux-conj.js', 'utf8'))(w);
new Function('window', fs.readFileSync('public/js/flux-conj-lexicon.js', 'utf8'))(w);
new Function('window', fs.readFileSync('public/js/flux-lang-engine.js', 'utf8'))(w);
const C = w.FluxConj;
const E = w.FluxLangEngine;

const T = (lang, verb, tense) => {
  const r = C.conjugate(lang, verb);
  assert.ok(r, `${verb} did not conjugate`);
  return r.tenses[tense].map((f) => (f == null ? '—' : f)).join(',');
};

const EXPECT = {
  es: {
    erguir: { present: 'yergo,yergues,yergue,erguimos,erguís,yerguen', preterite: 'erguí,erguiste,irguió,erguimos,erguisteis,irguieron', subjPresent: 'yerga,yergas,yerga,irgamos,irgáis,yergan' },
    argüir: { present: 'arguyo,arguyes,arguye,argüimos,argüís,arguyen', preterite: 'argüí,argüiste,arguyó,argüimos,argüisteis,arguyeron' },
    raer: { present: 'raigo,raes,rae,raemos,raéis,raen', subjPresent: 'raiga,raigas,raiga,raigamos,raigáis,raigan' },
    podrir: { present: 'pudro,pudres,pudre,pudrimos,pudrís,pudren' },
    tener: {
      present: 'tengo,tienes,tiene,tenemos,tenéis,tienen',
      preterite: 'tuve,tuviste,tuvo,tuvimos,tuvisteis,tuvieron',
      future: 'tendré,tendrás,tendrá,tendremos,tendréis,tendrán',
      subjPresent: 'tenga,tengas,tenga,tengamos,tengáis,tengan',
      subjImperfect: 'tuviera,tuvieras,tuviera,tuviéramos,tuvierais,tuvieran',
      subjImperfectSe: 'tuviese,tuvieses,tuviese,tuviésemos,tuvieseis,tuviesen',
      subjFuture: 'tuviere,tuvieres,tuviere,tuviéremos,tuviereis,tuvieren',
      impAffirmative: '—,ten,tenga,tengamos,tened,tengan',
      impNegative: '—,no tengas,no tenga,no tengamos,no tengáis,no tengan',
      pluperfect: 'había tenido,habías tenido,había tenido,habíamos tenido,habíais tenido,habían tenido',
    },
    ser: { present: 'soy,eres,es,somos,sois,son', imperfect: 'era,eras,era,éramos,erais,eran', impAffirmative: '—,sé,sea,seamos,sed,sean' },
    ir: { present: 'voy,vas,va,vamos,vais,van', subjPresent: 'vaya,vayas,vaya,vayamos,vayáis,vayan', impAffirmative: '—,ve,vaya,vamos,id,vayan' },
    ver: { present: 'veo,ves,ve,vemos,veis,ven', subjPresent: 'vea,veas,vea,veamos,veáis,vean', perfect: 'he visto,has visto,ha visto,hemos visto,habéis visto,han visto' },
    dormir: {
      preterite: 'dormí,dormiste,durmió,dormimos,dormisteis,durmieron',
      subjPresent: 'duerma,duermas,duerma,durmamos,durmáis,duerman',
    },
    sentir: { subjPresent: 'sienta,sientas,sienta,sintamos,sintáis,sientan' },
    pedir: { present: 'pido,pides,pide,pedimos,pedís,piden', subjImperfect: 'pidiera,pidieras,pidiera,pidiéramos,pidierais,pidieran' },
    leer: { preterite: 'leí,leíste,leyó,leímos,leísteis,leyeron' },
    construir: { present: 'construyo,construyes,construye,construimos,construís,construyen', preterite: 'construí,construiste,construyó,construimos,construisteis,construyeron' },
    averiguar: { preterite: 'averigüé,averiguaste,averiguó,averiguamos,averiguasteis,averiguaron' },
    enviar: { present: 'envío,envías,envía,enviamos,enviáis,envían' },
    reunir: { present: 'reúno,reúnes,reúne,reunimos,reunís,reúnen' },
    obtener: { impAffirmative: '—,obtén,obtenga,obtengamos,obtened,obtengan' },
    satisfacer: { preterite: 'satisfice,satisficiste,satisfizo,satisficimos,satisficisteis,satisficieron', present: 'satisfago,satisfaces,satisface,satisfacemos,satisfacéis,satisfacen' },
    predecir: { impAffirmative: '—,predice,prediga,predigamos,predecid,predigan' },
    torcer: { present: 'tuerzo,tuerces,tuerce,torcemos,torcéis,tuercen', subjPresent: 'tuerza,tuerzas,tuerza,torzamos,torzáis,tuerzan' },
    gruñir: { preterite: 'gruñí,gruñiste,gruñó,gruñimos,gruñisteis,gruñeron' },
    oír: { subjPresent: 'oiga,oigas,oiga,oigamos,oigáis,oigan' },
    levantarse: {
      present: 'me levanto,te levantas,se levanta,nos levantamos,os levantáis,se levantan',
      impAffirmative: '—,levántate,levántese,levantémonos,levantaos,levántense',
      impNegative: '—,no te levantes,no se levante,no nos levantemos,no os levantéis,no se levanten',
    },
    vestirse: { impAffirmative: '—,vístete,vístase,vistámonos,vestíos,vístanse' },
    irse: { impAffirmative: '—,vete,váyase,vámonos,idos,váyanse' },
  },
  fr: {
    être: { subjImperfect: 'fusse,fusses,fût,fussions,fussiez,fussent', imperative: '—,sois,—,soyons,soyez,—' },
    avoir: { passeSimple: 'eus,eus,eut,eûmes,eûtes,eurent', subjPresent: 'aie,aies,ait,ayons,ayez,aient' },
    aller: {
      passeCompose: 'suis allé(e),es allé(e),est allé(e),sommes allé(e)s,êtes allé(e)(s),sont allé(e)s',
      subjPresent: 'aille,ailles,aille,allions,alliez,aillent', future: 'irai,iras,ira,irons,irez,iront',
    },
    faire: { present: 'fais,fais,fait,faisons,faites,font', subjImperfect: 'fisse,fisses,fît,fissions,fissiez,fissent' },
    venir: { passeSimple: 'vins,vins,vint,vînmes,vîntes,vinrent', subjImperfect: 'vinsse,vinsses,vînt,vinssions,vinssiez,vinssent' },
    commencer: { passeSimple: 'commençai,commenças,commença,commençâmes,commençâtes,commencèrent', imperfect: 'commençais,commençais,commençait,commencions,commenciez,commençaient' },
    manger: { present: 'mange,manges,mange,mangeons,mangez,mangent', passeSimple: 'mangeai,mangeas,mangea,mangeâmes,mangeâtes,mangèrent' },
    lever: { present: 'lève,lèves,lève,levons,levez,lèvent', future: 'lèverai,lèveras,lèvera,lèverons,lèverez,lèveront' },
    appeler: { present: 'appelle,appelles,appelle,appelons,appelez,appellent' },
    acheter: { present: 'achète,achètes,achète,achetons,achetez,achètent' },
    céder: { present: 'cède,cèdes,cède,cédons,cédez,cèdent' },
    envoyer: { future: 'enverrai,enverras,enverra,enverrons,enverrez,enverront' },
    partir: { present: 'pars,pars,part,partons,partez,partent' },
    finir: { subjImperfect: 'finisse,finisses,finît,finissions,finissiez,finissent' },
    recevoir: { present: 'reçois,reçois,reçoit,recevons,recevez,reçoivent', passeSimple: 'reçus,reçus,reçut,reçûmes,reçûtes,reçurent' },
    devoir: { present: 'dois,dois,doit,devons,devez,doivent' },
    voir: { future: 'verrai,verras,verra,verrons,verrez,verront' },
    pouvoir: { subjPresent: 'puisse,puisses,puisse,puissions,puissiez,puissent' },
    vouloir: { imperative: '—,veuille,—,veuillons,veuillez,—' },
    savoir: { imperative: '—,sache,—,sachons,sachez,—' },
    dire: { present: 'dis,dis,dit,disons,dites,disent' },
    contredire: { present: 'contredis,contredis,contredit,contredisons,contredisez,contredisent' },
    écrire: { present: 'écris,écris,écrit,écrivons,écrivez,écrivent' },
    prendre: { subjPresent: 'prenne,prennes,prenne,prenions,preniez,prennent' },
    peindre: { present: 'peins,peins,peint,peignons,peignez,peignent' },
    résoudre: { present: 'résous,résous,résout,résolvons,résolvez,résolvent' },
    connaître: { present: 'connais,connais,connaît,connaissons,connaissez,connaissent', passeSimple: 'connus,connus,connut,connûmes,connûtes,connurent' },
    naître: { passeSimple: 'naquis,naquis,naquit,naquîmes,naquîtes,naquirent' },
    vivre: { passeSimple: 'vécus,vécus,vécut,vécûmes,vécûtes,vécurent' },
    vaincre: { present: 'vaincs,vaincs,vainc,vainquons,vainquez,vainquent' },
    haïr: { present: 'hais,hais,hait,haïssons,haïssez,haïssent' },
    falloir: { present: '—,—,faut,—,—,—', subjPresent: '—,—,faille,—,—,—' },
    'se lever': {
      passeCompose: 'me suis levé(e),t\'es levé(e),s\'est levé(e),nous sommes levé(e)s,vous êtes levé(e)(s),se sont levé(e)s',
      imperative: '—,lève-toi,—,levons-nous,levez-vous,—',
    },
  },
};

test('textbook forms in every tense', () => {
  for (const [lang, verbs] of Object.entries(EXPECT)) {
    for (const [verb, tenses] of Object.entries(verbs)) {
      for (const [tense, want] of Object.entries(tenses)) {
        assert.equal(T(lang, verb, tense), want, `${lang} ${verb} ${tense}`);
      }
    }
  }
});

test('spelling-rule forms are marked irregular too (leyó, huyo, busqué)', () => {
  const irr = (lang, v, k, i) => C.conjugate(lang, v).irregular[k][i];
  assert.ok(irr('es', 'leer', 'preterite', 2));
  assert.ok(irr('es', 'huir', 'present', 0));
  assert.ok(irr('es', 'buscar', 'preterite', 0));
  assert.ok(irr('es', 'coger', 'present', 0));
  assert.ok(!irr('es', 'hablar', 'preterite', 0));
  assert.equal(C.conjugate('fr', 'paître').tenses.passeSimple[0], null);
  assert.equal(C.conjugate('fr', 'renaître').participle, null);
});

test('agrees with the verb drill on every verb the drill knows', () => {
  const MAP = {
    es: { present: 'present', preterite: 'preterite', imperfect: 'imperfect', future: 'future', conditional: 'conditional', subjunctive: 'subjPresent', perfect: 'perfect' },
    fr: { present: 'present', passeCompose: 'passeCompose', imperfect: 'imperfect', future: 'future', conditional: 'conditional' },
  };
  /* The drill's engine is wrong here and this one is right: it treats
     satisfacer as a regular -er verb (satisfaco, satisfací), and gives
     renaître a participle (rené) the Bescherelle says it does not have. */
  const DRILL_WRONG = new Set(['satisfacer', 'renaître']);
  const bad = [];
  for (const lang of ['es', 'fr']) {
    for (const v of Object.keys(C.lexicon(lang))) {
      if (/se$/.test(v) && lang === 'es') continue;
      if (!E.known(lang, v) || DRILL_WRONG.has(v)) continue;
      const r = C.conjugate(lang, v);
      for (const [ot, nt] of Object.entries(MAP[lang])) {
        let o;
        try { o = E.conjugate(lang, v, ot); } catch { continue; }
        o.forms.forEach((f, i) => {
          const raw = r.tenses[nt][i];
          const n = raw == null ? '—' : raw.replace(/\(e\)/g, '').replace(/\(s\)/g, 's');
          const ok = n === f || (r.alts[nt]?.[i] || []).includes(f) || (o.alts?.[i] || []).includes(n);
          if (!ok) bad.push(`${lang} ${v} ${nt}[${i}]: drill ${f}, lingo ${n}`);
        });
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('every dictionary verb conjugates, all six persons in every finite tense', () => {
  const missing = [];
  for (const lang of ['es', 'fr']) {
    for (const v of Object.keys(C.lexicon(lang))) {
      const r = C.conjugate(lang, v);
      if (!r) { missing.push(`${lang} ${v}: no conjugation`); continue; }
      if (r.impersonal) continue;
      for (const g of C.groups(lang)) {
        for (const [id] of g.tenses) {
          const forms = r.tenses[id];
          // Imperatives have no first person; some literary French tenses do not exist for traire/clore.
          const need = /^imp/.test(id) && id !== 'imperfect' ? [1, 3, 4] : [0, 1, 2, 3, 4, 5];
          if (lang === 'fr' && /traire$|clore$/.test(v) && /passeSimple|subjImperfect|pastAnterior|subjPluperfect/.test(id)) continue;
          if (lang === 'fr' && v === 'pouvoir' && /^imperative/.test(id)) continue;
          // No participle, so no compound tenses; paître has no passé simple either.
          const compound = /passeCompose|pluperfect|pastAnterior|futurePerfect|conditionalPerfect|subjPast|subjPluperfect|imperativePast/;
          if (lang === 'fr' && v === 'renaître' && compound.test(id)) continue;
          if (lang === 'fr' && v === 'paître' && (compound.test(id) || /passeSimple|subjImperfect/.test(id))) continue;
          for (const i of need) {
            if (!forms || !forms[i] || /undefined|null/.test(forms[i])) missing.push(`${lang} ${v} ${id}[${i}]`);
          }
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('finds the verb from an infinitive without accents, any form, or English', () => {
  const first = (lang, q) => C.search(lang, q, 3)[0]?.verb;
  assert.equal(first('es', 'tuvimos'), 'tener');
  assert.equal(first('es', 'hubiéramos'), 'haber');
  assert.equal(first('es', 'reir'), 'reír');
  assert.equal(first('es', 'to eat'), 'comer');
  assert.equal(first('fr', 'eussions'), 'avoir');
  assert.equal(first('fr', 'fûmes'), 'être');
  assert.equal(first('fr', 'etre'), 'être');
  assert.equal(first('fr', 'to see'), 'voir');
});

test('a verb outside the dictionary still conjugates by the rules for its ending', () => {
  const r = C.conjugate('es', 'tuitear');
  assert.equal(r.known, false);
  assert.equal(r.tenses.preterite[0], 'tuiteé');
  assert.equal(C.conjugate('fr', 'googler').tenses.present[3], 'googlons');
  assert.equal(C.conjugate('es', 'zzz'), null);
});

test('an English phrase finds the verb, tense and person it means', () => {
  const top = (lang, q) => { const h = C.fromEnglish(lang, q)[0]; return h ? h.verb + ' ' + h.tense + ' ' + h.person + ' ' + h.form : null; };
  assert.equal(top('es', 'I ate'), 'comer preterite 0 comí');
  assert.equal(top('fr', 'I ate'), 'manger passeCompose 0 ai mangé');
  assert.equal(top('es', 'we will speak'), 'hablar future 3 hablaremos');
  assert.equal(top('fr', 'we will speak'), 'parler future 3 parlerons');
  assert.equal(top('es', 'he goes'), 'ir present 2 va');
  assert.equal(top('es', 'they had gone'), 'ir pluperfect 5 habían ido');
  assert.equal(top('es', 'he was running'), 'correr imperfect 2 corría');
  assert.equal(top('fr', 'I used to swim'), 'nager imperfect 0 nageais');
  assert.equal(top('es', "I'll write"), 'escribir future 0 escribiré');
  assert.equal(top('es', 'you all live'), 'vivir present 4 vivís');
  assert.equal(top('fr', 'I have written'), 'écrire passeCompose 0 ai écrit');
  // Not English, or nothing to go on: no guess.
  assert.deepEqual(C.fromEnglish('es', 'tengo'), []);
  assert.deepEqual(C.fromEnglish('es', 'I'), []);
  // Search puts the phrase's verb first, carrying the form to highlight.
  const s = C.search('es', 'I ate', 3)[0];
  assert.equal(s.verb, 'comer');
  assert.equal(s.hit.tense, 'preterite');
});
