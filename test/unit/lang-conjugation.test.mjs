import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Every conjugation the app is willing to show, checked against known forms.
 *
 * A wrong conjugation in a revision tool is worse than no tool: a blank page
 * sends you to the textbook, a confidently wrong answer does not. This engine
 * has shipped "yo podo", "jugé", "construo" and "véis" at various points —
 * each plausible enough to be copied straight into homework.
 *
 * e2e/lang-conjugator.spec.ts drives the UI; this sweeps the tables. A unit
 * test because the engine is deliberately pure and offline, so every verb can
 * be checked in milliseconds instead of through a browser.
 */

const src = fs.readFileSync('public/js/flux-lang-engine.js', 'utf8');
const w = {};
new Function('window', src)(w);
const E = w.FluxLangEngine;

/** Textbook forms; only entries I am confident of appear here. */
const EXPECT = {
  es: {
    present: {
      ser: 'soy,eres,es,somos,sois,son',
      estar: 'estoy,estás,está,estamos,estáis,están',
      ir: 'voy,vas,va,vamos,vais,van',
      tener: 'tengo,tienes,tiene,tenemos,tenéis,tienen',
      hacer: 'hago,haces,hace,hacemos,hacéis,hacen',
      decir: 'digo,dices,dice,decimos,decís,dicen',
      poder: 'puedo,puedes,puede,podemos,podéis,pueden',
      querer: 'quiero,quieres,quiere,queremos,queréis,quieren',
      saber: 'sé,sabes,sabe,sabemos,sabéis,saben',
      venir: 'vengo,vienes,viene,venimos,venís,vienen',
      /* dar and ver are the monosyllable trap: built from the regular endings
         they come out "dáis" and "véis". Both have shipped wrong. */
      dar: 'doy,das,da,damos,dais,dan',
      ver: 'veo,ves,ve,vemos,veis,ven',
      haber: 'he,has,ha,hemos,habéis,han',
      poner: 'pongo,pones,pone,ponemos,ponéis,ponen',
      salir: 'salgo,sales,sale,salimos,salís,salen',
      traer: 'traigo,traes,trae,traemos,traéis,traen',
      pedir: 'pido,pides,pide,pedimos,pedís,piden',
      dormir: 'duermo,duermes,duerme,dormimos,dormís,duermen',
      jugar: 'juego,juegas,juega,jugamos,jugáis,juegan',
      seguir: 'sigo,sigues,sigue,seguimos,seguís,siguen',
    },
    preterite: {
      ser: 'fui,fuiste,fue,fuimos,fuisteis,fueron',
      ir: 'fui,fuiste,fue,fuimos,fuisteis,fueron',
      tener: 'tuve,tuviste,tuvo,tuvimos,tuvisteis,tuvieron',
      hacer: 'hice,hiciste,hizo,hicimos,hicisteis,hicieron',
      decir: 'dije,dijiste,dijo,dijimos,dijisteis,dijeron',
      poder: 'pude,pudiste,pudo,pudimos,pudisteis,pudieron',
      estar: 'estuve,estuviste,estuvo,estuvimos,estuvisteis,estuvieron',
      dar: 'di,diste,dio,dimos,disteis,dieron',
      ver: 'vi,viste,vio,vimos,visteis,vieron',
      // The third-person stem change the old trainer missed entirely.
      pedir: 'pedí,pediste,pidió,pedimos,pedisteis,pidieron',
      dormir: 'dormí,dormiste,durmió,dormimos,dormisteis,durmieron',
      // -gar spelling change: "jugé" would be wrong.
      jugar: 'jugué,jugaste,jugó,jugamos,jugasteis,jugaron',
    },
    imperfect: {
      ser: 'era,eras,era,éramos,erais,eran',
      ir: 'iba,ibas,iba,íbamos,ibais,iban',
      ver: 'veía,veías,veía,veíamos,veíais,veían',
    },
  },
  fr: {
    present: {
      être: 'suis,es,est,sommes,êtes,sont',
      avoir: 'ai,as,a,avons,avez,ont',
      aller: 'vais,vas,va,allons,allez,vont',
      faire: 'fais,fais,fait,faisons,faites,font',
      pouvoir: 'peux,peux,peut,pouvons,pouvez,peuvent',
      vouloir: 'veux,veux,veut,voulons,voulez,veulent',
      savoir: 'sais,sais,sait,savons,savez,savent',
      venir: 'viens,viens,vient,venons,venez,viennent',
      prendre: 'prends,prends,prend,prenons,prenez,prennent',
      mettre: 'mets,mets,met,mettons,mettez,mettent',
      voir: 'vois,vois,voit,voyons,voyez,voient',
      devoir: 'dois,dois,doit,devons,devez,doivent',
      boire: 'bois,bois,boit,buvons,buvez,boivent',
      dire: 'dis,dis,dit,disons,dites,disent',
      lire: 'lis,lis,lit,lisons,lisez,lisent',
      /* The two -ir families. finir takes -iss-, partir and dormir drop the
         stem's final consonant — assuming -iss- for both gave the old
         trainer's "nous partissons". */
      partir: 'pars,pars,part,partons,partez,partent',
      finir: 'finis,finis,finit,finissons,finissez,finissent',
      dormir: 'dors,dors,dort,dormons,dormez,dorment',
    },
  },
  de: {
    present: {
      sein: 'bin,bist,ist,sind,seid,sind',
      haben: 'habe,hast,hat,haben,habt,haben',
      werden: 'werde,wirst,wird,werden,werdet,werden',
      gehen: 'gehe,gehst,geht,gehen,geht,gehen',
      // Stem change in du and er only — the German "boot".
      sehen: 'sehe,siehst,sieht,sehen,seht,sehen',
      geben: 'gebe,gibst,gibt,geben,gebt,geben',
      nehmen: 'nehme,nimmst,nimmt,nehmen,nehmt,nehmen',
      sprechen: 'spreche,sprichst,spricht,sprechen,sprecht,sprechen',
      fahren: 'fahre,fährst,fährt,fahren,fahrt,fahren',
      laufen: 'laufe,läufst,läuft,laufen,lauft,laufen',
      essen: 'esse,isst,isst,essen,esst,essen',
      lesen: 'lese,liest,liest,lesen,lest,lesen',
      wissen: 'weiß,weißt,weiß,wissen,wisst,wissen',
      // Modals: no ending on ich or er, and a different singular stem.
      können: 'kann,kannst,kann,können,könnt,können',
      müssen: 'muss,musst,muss,müssen,müsst,müssen',
      wollen: 'will,willst,will,wollen,wollt,wollen',
      dürfen: 'darf,darfst,darf,dürfen,dürft,dürfen',
      helfen: 'helfe,hilfst,hilft,helfen,helft,helfen',
      tragen: 'trage,trägst,trägt,tragen,tragt,tragen',
      schlafen: 'schlafe,schläfst,schläft,schlafen,schlaft,schlafen',
    },
    past: {
      sein: 'war,warst,war,waren,wart,waren',
      haben: 'hatte,hattest,hatte,hatten,hattet,hatten',
      gehen: 'ging,gingst,ging,gingen,gingt,gingen',
      sehen: 'sah,sahst,sah,sahen,saht,sahen',
      sprechen: 'sprach,sprachst,sprach,sprachen,spracht,sprachen',
      // Mixed verbs: changed stem, but weak -te endings.
      bringen: 'brachte,brachtest,brachte,brachten,brachtet,brachten',
      denken: 'dachte,dachtest,dachte,dachten,dachtet,dachten',
    },
  },
};

test('known irregular forms are exactly right', () => {
  const wrong = [];
  let checked = 0;
  for (const lang of Object.keys(EXPECT)) {
    for (const tense of Object.keys(EXPECT[lang])) {
      for (const [verb, want] of Object.entries(EXPECT[lang][tense])) {
        checked++;
        let got;
        try { got = (E.conjugate(lang, verb, tense).forms || []).join(','); }
        catch (e) { got = 'THREW ' + e.message; }
        if (got !== want) wrong.push(`${lang} ${verb} ${tense}\n  got  ${got}\n  want ${want}`);
      }
    }
  }
  assert.ok(checked > 70, `only ${checked} forms checked — the table shrank`);
  assert.deepEqual(wrong, [], `\n${wrong.join('\n')}\n`);
});

/* The irregular future stems. These are the ones a rule gets wrong quietly:
   every one looks regular, so "haceré" instead of "haré" would sail through
   any structural check. */
test('irregular future stems are not rebuilt from the infinitive', () => {
  const es = { hacer: 'haré', tener: 'tendré', decir: 'diré', poder: 'podré',
    saber: 'sabré', querer: 'querré', poner: 'pondré', salir: 'saldré',
    venir: 'vendré', haber: 'habré', caber: 'cabré', valer: 'valdré' };
  const fr = { avoir: 'aurai', être: 'serai', aller: 'irai', faire: 'ferai',
    pouvoir: 'pourrai', vouloir: 'voudrai', venir: 'viendrai', voir: 'verrai',
    savoir: 'saurai', devoir: 'devrai' };
  for (const [v, want] of Object.entries(es)) {
    assert.equal((E.conjugate('es', v, 'future').forms || [])[0], want, `es ${v} future`);
  }
  for (const [v, want] of Object.entries(fr)) {
    assert.equal((E.conjugate('fr', v, 'future').forms || [])[0], want, `fr ${v} future`);
  }
});

/* Every verb the app OFFERS as irregular must produce six usable forms in
   every tense it offers. This catches a verb added to the list but not to the
   tables, which renders as blanks rather than as an error anyone would see. */
test('every listed irregular returns six real forms in every tense', () => {
  const broken = [];
  let combos = 0;
  for (const lang of ['es', 'fr', 'de']) {
    const verbs = (E.irregulars(lang) || []).map((r) => (Array.isArray(r) ? r[0] : r));
    const tenses = (E.tenses(lang) || []).map((t) => t.id);
    assert.ok(verbs.length > 20, `${lang} lists only ${verbs.length} irregulars`);
    for (const v of verbs) {
      for (const t of tenses) {
        combos++;
        let f;
        try { f = E.conjugate(lang, v, t).forms || []; }
        catch (e) { broken.push(`${lang} ${v} ${t}: THREW ${e.message}`); continue; }
        if (f.length !== 6) broken.push(`${lang} ${v} ${t}: ${f.length} forms`);
        else if (f.some((x) => !String(x || '').trim())) broken.push(`${lang} ${v} ${t}: blank -> ${f.join(',')}`);
      }
    }
  }
  assert.ok(combos > 900, `only ${combos} combinations swept`);
  assert.deepEqual(broken, [], `\n${broken.join('\n')}\n`);
});

/* The verb drill asks for every form of every verb in its sets, so a wrong cell
   is now a question a student is marked wrong on. Everything below was wrong
   before the drill went in — each one a first-year form. */
const EXPECT_2026 = {
  es: {
    subjunctive: {
      // -car / -gar / -zar respell before e in all six persons.
      jugar: 'juegue,juegues,juegue,juguemos,juguéis,jueguen',
      buscar: 'busque,busques,busque,busquemos,busquéis,busquen',
      llegar: 'llegue,llegues,llegue,lleguemos,lleguéis,lleguen',
      empezar: 'empiece,empieces,empiece,empecemos,empecéis,empiecen',
      almorzar: 'almuerce,almuerces,almuerce,almorcemos,almorcéis,almuercen',
      construir: 'construya,construyas,construya,construyamos,construyáis,construyan',
      recoger: 'recoja,recojas,recoja,recojamos,recojáis,recojan',
      agradecer: 'agradezca,agradezcas,agradezca,agradezcamos,agradezcáis,agradezcan',
      distinguir: 'distinga,distingas,distinga,distingamos,distingáis,distingan',
      enviar: 'envíe,envíes,envíe,enviemos,enviéis,envíen',
      oler: 'huela,huelas,huela,olamos,oláis,huelan',
      reír: 'ría,rías,ría,riamos,riáis,rían',
      obtener: 'obtenga,obtengas,obtenga,obtengamos,obtengáis,obtengan',
    },
    present: {
      recoger: 'recojo,recoges,recoge,recogemos,recogéis,recogen',
      agradecer: 'agradezco,agradeces,agradece,agradecemos,agradecéis,agradecen',
      perseguir: 'persigo,persigues,persigue,perseguimos,perseguís,persiguen',
      enviar: 'envío,envías,envía,enviamos,enviáis,envían',
      continuar: 'continúo,continúas,continúa,continuamos,continuáis,continúan',
      obtener: 'obtengo,obtienes,obtiene,obtenemos,obtenéis,obtienen',
      freír: 'frío,fríes,fríe,freímos,freís,fríen',
    },
    perfect: {
      leer: 'he leído,has leído,ha leído,hemos leído,habéis leído,han leído',
      oír: 'he oído,has oído,ha oído,hemos oído,habéis oído,han oído',
      traer: 'he traído,has traído,ha traído,hemos traído,habéis traído,han traído',
      construir: 'he construido,has construido,ha construido,hemos construido,habéis construido,han construido',
      proponer: 'he propuesto,has propuesto,ha propuesto,hemos propuesto,habéis propuesto,han propuesto',
    },
    preterite: {
      introducir: 'introduje,introdujiste,introdujo,introdujimos,introdujisteis,introdujeron',
      deshacer: 'deshice,deshiciste,deshizo,deshicimos,deshicisteis,deshicieron',
    },
    future: { mantener: 'mantendré,mantendrás,mantendrá,mantendremos,mantendréis,mantendrán' },
  },
  fr: {
    present: {
      manger: 'mange,manges,mange,mangeons,mangez,mangent',
      commencer: 'commence,commences,commence,commençons,commencez,commencent',
      acheter: 'achète,achètes,achète,achetons,achetez,achètent',
      préférer: 'préfère,préfères,préfère,préférons,préférez,préfèrent',
      appeler: 'appelle,appelles,appelle,appelons,appelez,appellent',
      jeter: 'jette,jettes,jette,jetons,jetez,jettent',
      envoyer: 'envoie,envoies,envoie,envoyons,envoyez,envoient',
      nettoyer: 'nettoie,nettoies,nettoie,nettoyons,nettoyez,nettoient',
      payer: 'paie,paies,paie,payons,payez,paient',
      naître: 'nais,nais,naît,naissons,naissez,naissent',
      devenir: 'deviens,deviens,devient,devenons,devenez,deviennent',
      permettre: 'permets,permets,permet,permettons,permettez,permettent',
      rire: 'ris,ris,rit,rions,riez,rient',
      conduire: 'conduis,conduis,conduit,conduisons,conduisez,conduisent',
      craindre: 'crains,crains,craint,craignons,craignez,craignent',
      battre: 'bats,bats,bat,battons,battez,battent',
      interrompre: 'interromps,interromps,interrompt,interrompons,interrompez,interrompent',
      apercevoir: 'aperçois,aperçois,aperçoit,apercevons,apercevez,aperçoivent',
      décrire: 'décris,décris,décrit,décrivons,décrivez,décrivent',
      contredire: 'contredis,contredis,contredit,contredisons,contredisez,contredisent',
      valoir: 'vaux,vaux,vaut,valons,valez,valent',
    },
    imperfect: {
      manger: 'mangeais,mangeais,mangeait,mangions,mangiez,mangeaient',
      commencer: 'commençais,commençais,commençait,commencions,commenciez,commençaient',
      naître: 'naissais,naissais,naissait,naissions,naissiez,naissaient',
      rire: 'riais,riais,riait,riions,riiez,riaient',
    },
    future: {
      acheter: 'achèterai,achèteras,achètera,achèterons,achèterez,achèteront',
      appeler: 'appellerai,appelleras,appellera,appellerons,appellerez,appelleront',
      nettoyer: 'nettoierai,nettoieras,nettoiera,nettoierons,nettoierez,nettoieront',
      devenir: 'deviendrai,deviendras,deviendra,deviendrons,deviendrez,deviendront',
      cueillir: 'cueillerai,cueilleras,cueillera,cueillerons,cueillerez,cueilleront',
      renvoyer: 'renverrai,renverras,renverra,renverrons,renverrez,renverront',
    },
    passeCompose: {
      devenir: 'suis devenu,es devenu,est devenu,sommes devenus,êtes devenus,sont devenus',
      découvrir: 'ai découvert,as découvert,a découvert,avons découvert,avez découvert,ont découvert',
      rire: 'ai ri,as ri,a ri,avons ri,avez ri,ont ri',
      conduire: 'ai conduit,as conduit,a conduit,avons conduit,avez conduit,ont conduit',
      apparaître: 'suis apparu,es apparu,est apparu,sommes apparus,êtes apparus,sont apparus',
      prévenir: 'ai prévenu,as prévenu,a prévenu,avons prévenu,avez prévenu,ont prévenu',
    },
  },
  de: {
    perfect: {
      reisen: 'bin gereist,bist gereist,ist gereist,sind gereist,seid gereist,sind gereist',
      aufwachen: 'bin aufgewacht,bist aufgewacht,ist aufgewacht,sind aufgewacht,seid aufgewacht,sind aufgewacht',
    },
    present: { geschehen: 'geschehe,geschiehst,geschieht,geschehen,gescheht,geschehen' },
  },
};

test('forms the verb drill exposed are right (spelling changes, compounds, accents)', () => {
  const wrong = [];
  for (const lang of Object.keys(EXPECT_2026)) {
    for (const tense of Object.keys(EXPECT_2026[lang])) {
      for (const [verb, want] of Object.entries(EXPECT_2026[lang][tense])) {
        let got;
        try { got = E.conjugate(lang, verb, tense).forms.join(','); } catch (e) { got = 'THREW ' + e.message; }
        if (got !== want) wrong.push(`${lang} ${verb} ${tense}\n  got  ${got}\n  want ${want}`);
      }
    }
  }
  assert.deepEqual(wrong, [], `\n${wrong.join('\n')}\n`);
});

test('equally right spellings ride along as alts, and forms keep the textbook one', () => {
  const pay = E.conjugate('fr', 'payer', 'present');
  assert.equal(pay.forms[0], 'paie');
  assert.deepEqual([...pay.alts[0]], ['paye']);
  assert.deepEqual([...pay.alts[3]], [], 'nous payons has only one spelling');
  assert.deepEqual([...E.conjugate('fr', 'préférer', 'future').alts[0]], ['préfèrerai']);
  assert.deepEqual([...E.conjugate('es', 'reír', 'preterite').alts[2]], ['rio']);
  // sonrió always carries its accent, so the compound must not inherit "rio".
  assert.equal(E.conjugate('es', 'sonreír', 'preterite').forms[2], 'sonrió');
  assert.equal(E.conjugate('es', 'sonreír', 'preterite').alts, undefined);
  assert.equal(E.conjugate('fr', 'aller', 'passeCompose').agree, true);
  assert.equal(E.conjugate('fr', 'parler', 'passeCompose').agree, undefined);
});

test('verbs typed without accents find the table spelling; unknown irregulars are refused', () => {
  assert.equal(E.conjugate('fr', 'preferer', 'present').forms[0], 'préfère');
  assert.equal(E.conjugate('fr', 'decouvrir', 'passeCompose').forms[0], 'ai découvert');
  assert.equal(E.conjugate('es', 'oir', 'present').forms[0], 'oigo');
  assert.equal(E.conjugate('de', 'heissen', 'present').forms[1], 'heißt');
  // répartir is a different verb from repartir: an accent typed is meant.
  assert.equal(E.conjugate('fr', 'répartir', 'present').forms[0], 'répartis');
  assert.throws(() => E.conjugate('fr', 'conclure', 'present'), /does not have the forms/);
  // Impersonal: one person, dashes for the rest — never an invented form.
  assert.deepEqual([...E.conjugate('fr', 'falloir', 'present').forms], ['—', '—', 'faut', '—', '—', '—']);
  assert.equal(E.pastParticiple('es', 'leer'), 'leído');
  assert.equal(E.pastParticiple('es', 'componer'), 'compuesto');
  assert.equal(E.pastParticiple('fr', 'permettre'), 'permis');
  assert.equal(E.known('es', 'obtener'), true);
  assert.equal(E.known('fr', 'préférer'), true);
  assert.equal(E.known('es', 'bailar'), false, 'a regular verb is conjugated by rule, not listed');
});

test('French reflexive verbs carry their pronoun, elided where French elides it', () => {
  const forms = (v, t) => E.conjugate('fr', v, t).forms.join(',');
  assert.equal(forms('se réveiller', 'present'), 'me réveille,te réveilles,se réveille,nous réveillons,vous réveillez,se réveillent');
  assert.equal(forms("s'endormir", 'present'), "m'endors,t'endors,s'endort,nous endormons,vous endormez,s'endorment");
  assert.equal(forms('se laver', 'imperfect'), 'me lavais,te lavais,se lavait,nous lavions,vous laviez,se lavaient');
  assert.equal(forms('se lever', 'future'), 'me lèverai,te lèveras,se lèvera,nous lèverons,vous lèverez,se lèveront');
  assert.equal(forms("s'habiller", 'conditional').split(',')[0], "m'habillerais");
  assert.equal(forms('se hâter', 'present').split(',')[2], 'se hâte', 'an aspirated h does not elide');

  // Every way a phone or keyboard writes it lands on the same verb.
  for (const typed of ['se reveiller', 'SE RÉVEILLER', 'to se reveiller', '  se   reveiller ']) {
    assert.equal(E.conjugate('fr', typed, 'present').verb, 'se réveiller', typed);
    assert.equal(E.conjugate('fr', typed, 'present').forms[0], 'me réveille', typed);
  }
  for (const typed of ["s'endormir", 's’endormir', 's endormir', 'se endormir', "s' endormir"]) {
    assert.equal(E.conjugate('fr', typed, 'present').verb, "s'endormir", typed);
  }
  assert.equal(E.resolve('fr', 'se depecher'), 'se dépêcher');
});

test('French reflexive verbs take être in the passé composé and agree', () => {
  const r = E.conjugate('fr', 'se réveiller', 'passeCompose');
  assert.deepEqual([...r.forms], ['me suis réveillé', "t'es réveillé", "s'est réveillé", 'nous sommes réveillés', 'vous êtes réveillés', 'se sont réveillés']);
  assert.deepEqual([...r.pronouns], ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'], 'never j\' — me suis');
  assert.equal(r.agree, true);
  assert.equal(E.pastParticiple('fr', "s'endormir"), 'endormi');
  // A verb that takes avoir on its own still takes être once reflexive.
  assert.equal(E.conjugate('fr', 'se laver', 'passeCompose').forms[2], "s'est lavé");
  // assis already ends in s: no second one.
  assert.equal(E.conjugate('fr', "s'asseoir", 'passeCompose').forms[5], "se sont assis");
  // se = "to each other": no agreement.
  const parler = E.conjugate('fr', 'se parler', 'passeCompose');
  assert.equal(parler.forms[5], 'se sont parlé');
  assert.equal(parler.agree, undefined);
});

test('the irregular verbs reflexives lean on, and what is refused', () => {
  const forms = (v, t) => E.conjugate('fr', v, t).forms.join(',');
  assert.equal(forms("s'asseoir", 'present'), "m'assieds,t'assieds,s'assied,nous asseyons,vous asseyez,s'asseyent");
  assert.equal(forms("s'asseoir", 'future').split(',')[0], "m'assiérai");
  assert.equal(forms("s'asseoir", 'imperfect').split(',')[0], "m'asseyais");
  assert.equal(E.conjugate('fr', "s'asseoir", 'present').alts[0][0], "m'assois");
  assert.equal(forms('se souvenir', 'present'), 'me souviens,te souviens,se souvient,nous souvenons,vous souvenez,se souviennent');
  assert.equal(forms('se souvenir', 'passeCompose').split(',')[0], 'me suis souvenu');
  assert.equal(forms('se taire', 'present'), 'me tais,te tais,se tait,nous taisons,vous taisez,se taisent');
  assert.equal(forms('se taire', 'passeCompose').split(',')[1], "t'es tu");
  assert.equal(forms('se taire', 'future').split(',')[0], 'me tairai');

  assert.throws(() => E.conjugate('fr', 'se conclure', 'present'), /does not have the forms/);
  assert.throws(() => E.conjugate('fr', 'se conclure', 'passeCompose'), /does not have the forms/);
  assert.throws(() => E.conjugate('fr', 'se falloir', 'present'), /not a French reflexive/);
  assert.throws(() => E.conjugate('fr', "s'être", 'present'), /not a French reflexive/);
  assert.throws(() => E.conjugate('fr', 'se <img>', 'present'), /Letters only/);
  assert.throws(() => E.conjugate('fr', 'se maison', 'present'), /end in -er/);
  // Only French reads "se" as a pronoun.
  assert.throws(() => E.conjugate('es', 'se hablar', 'present'), /Letters only/);
});

test('Spanish reflexive verbs put the pronoun in front of every form', () => {
  const forms = (v, t) => E.conjugate('es', v, t).forms.join(',');
  assert.equal(forms('levantarse', 'present'), 'me levanto,te levantas,se levanta,nos levantamos,os levantáis,se levantan');
  assert.equal(forms('levantarse', 'perfect').split(',')[0], 'me he levantado');
  assert.equal(forms('acostarse', 'present').split(',')[0], 'me acuesto');
  assert.equal(forms('dormirse', 'preterite').split(',')[2], 'se durmió');
  assert.equal(forms('irse', 'present'), 'me voy,te vas,se va,nos vamos,os vais,se van');
  assert.equal(forms('ponerse', 'preterite').split(',')[0], 'me puse');
  assert.equal(forms('sentirse', 'present').split(',')[0], 'me siento');
  assert.equal(forms('sentarse', 'present').split(',')[3], 'nos sentamos');
  // Fixed so that these reflexives are right: all three were plain regulars.
  assert.equal(forms('arrepentirse', 'present').split(',')[0], 'me arrepiento');
  assert.equal(forms('reunirse', 'present'), 'me reúno,te reúnes,se reúne,nos reunimos,os reunís,se reúnen');
  assert.equal(forms('desvestirse', 'present').split(',')[0], 'me desvisto');
  // Typed without its accent, and alternatives carry the pronoun too.
  assert.equal(E.conjugate('es', 'reirse', 'present').verb, 'reírse');
  assert.equal(E.conjugate('es', 'reirse', 'present').forms[0], 'me río');
  assert.equal(E.conjugate('es', 'reírse', 'preterite').alts[2][0], 'se rio');
  assert.equal(E.pastParticiple('es', 'ponerse'), 'puesto');
  assert.equal(E.known('es', 'acostarse'), true);
  assert.throws(() => E.conjugate('es', 'serse', 'present'), /not a Spanish reflexive/);
  // Words that merely end in -se are still not verbs.
  assert.throws(() => E.conjugate('es', 'clase', 'present'), /-ar/);
});

test('German reflexive verbs place the pronoun after the first word', () => {
  const forms = (v, t) => E.conjugate('de', v, t).forms.join(',');
  assert.equal(forms('sich waschen', 'present'), 'wasche mich,wäschst dich,wäscht sich,waschen uns,wascht euch,waschen sich');
  assert.equal(forms('sich waschen', 'past').split(',')[0], 'wusch mich');
  assert.equal(forms('sich waschen', 'perfect').split(',')[0], 'habe mich gewaschen');
  assert.equal(forms('sich waschen', 'future').split(',')[1], 'wirst dich waschen');
  // Separable: the prefix still goes last.
  assert.equal(forms('sich anziehen', 'present').split(',')[0], 'ziehe mich an');
  assert.equal(forms('sich anziehen', 'perfect').split(',')[0], 'habe mich angezogen');
  assert.equal(forms('sich anziehen', 'future').split(',')[0], 'werde mich anziehen');
  // Plain umziehen takes sein; reflexive it takes haben.
  assert.equal(E.conjugate('de', 'umziehen', 'perfect').forms[0], 'bin umgezogen');
  assert.equal(forms('sich umziehen', 'perfect').split(',')[0], 'habe mich umgezogen');
  // Dative.
  assert.equal(forms('sich merken', 'present').split(',')[0], 'merke mir');
  assert.equal(forms('sich merken', 'present').split(',')[3], 'merken uns');
  // Fixed so that these reflexives are right.
  assert.equal(forms('sich ausruhen', 'present').split(',')[0], 'ruhe mich aus');
  assert.equal(forms('sich hinlegen', 'perfect').split(',')[0], 'habe mich hingelegt');
  assert.equal(forms('sich unterhalten', 'present').split(',')[2], 'unterhält sich');
  assert.equal(forms('sich unterhalten', 'perfect').split(',')[0], 'habe mich unterhalten');
  assert.equal(forms('sich befinden', 'past').split(',')[0], 'befand mich');
  assert.equal(forms('sich überlegen', 'perfect').split(',')[0], 'habe mir überlegt');
  // Typed without the umlaut.
  assert.equal(E.conjugate('de', '  SICH  fuhlen', 'present').verb, 'sich fühlen');
  assert.equal(forms('sich fuhlen', 'present').split(',')[0], 'fühle mich');
  assert.equal(E.pastParticiple('de', 'sich anziehen'), 'angezogen');
  assert.throws(() => E.conjugate('de', 'sich sein', 'present'), /not a German reflexive/);
  assert.throws(() => E.conjugate('de', 'sich haus', 'present'), /end in -en/);
});
