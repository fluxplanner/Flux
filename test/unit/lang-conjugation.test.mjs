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
  assert.throws(() => E.conjugate('fr', 'asseoir', 'present'), /does not have the forms/);
  // Impersonal: one person, dashes for the rest — never an invented form.
  assert.deepEqual([...E.conjugate('fr', 'falloir', 'present').forms], ['—', '—', 'faut', '—', '—', '—']);
  assert.equal(E.pastParticiple('es', 'leer'), 'leído');
  assert.equal(E.pastParticiple('es', 'componer'), 'compuesto');
  assert.equal(E.pastParticiple('fr', 'permettre'), 'permis');
  assert.equal(E.known('es', 'obtener'), true);
  assert.equal(E.known('fr', 'préférer'), true);
  assert.equal(E.known('es', 'bailar'), false, 'a regular verb is conjugated by rule, not listed');
});
