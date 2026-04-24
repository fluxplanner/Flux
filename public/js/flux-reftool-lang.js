/* Spanish + French Conjugators — 60 verbs each, 7 tenses, irregular markers */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  // ─────────────────────────────────────────────────────────────────
  // Helpers — regular conjugation of Spanish verbs
  // ─────────────────────────────────────────────────────────────────
  const ES_PRON = ['yo','tú','él/ella','nosotros','vosotros','ellos'];
  const ES_ENDINGS = {
    ar: { pres:['o','as','a','amos','áis','an'], pret:['é','aste','ó','amos','asteis','aron'], imp:['aba','abas','aba','ábamos','abais','aban'], fut:['aré','arás','ará','aremos','aréis','arán'], cond:['aría','arías','aría','aríamos','aríais','arían'], subj:['e','es','e','emos','éis','en'] },
    er: { pres:['o','es','e','emos','éis','en'], pret:['í','iste','ió','imos','isteis','ieron'], imp:['ía','ías','ía','íamos','íais','ían'], fut:['eré','erás','erá','eremos','eréis','erán'], cond:['ería','erías','ería','eríamos','eríais','erían'], subj:['a','as','a','amos','áis','an'] },
    ir: { pres:['o','es','e','imos','ís','en'], pret:['í','iste','ió','imos','isteis','ieron'], imp:['ía','ías','ía','íamos','íais','ían'], fut:['iré','irás','irá','iremos','iréis','irán'], cond:['iría','irías','iría','iríamos','iríais','irían'], subj:['a','as','a','amos','áis','an'] },
  };

  function esConjugate(verb){
    const group = verb.slice(-2);
    const stem = verb.slice(0, -2);
    const e = ES_ENDINGS[group];
    if(!e) return null;
    // Past participle: -ar → -ado, -er/-ir → -ido
    const pp = group === 'ar' ? stem + 'ado' : stem + 'ido';
    return {
      pres: e.pres.map(x => stem + x),
      pret: e.pret.map(x => stem + x),
      imp:  e.imp.map(x => stem + x),
      fut:  e.fut.map(x => stem + x),
      cond: e.cond.map(x => stem + x),
      subj: e.subj.map(x => stem + x),
      perf: e.pres.map((_, i) => (['he','has','ha','hemos','habéis','han'][i]) + ' ' + pp),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Irregular overrides (exceptions only)
  // ─────────────────────────────────────────────────────────────────
  const ES_IRREGULAR = {
    ser:   { pres:['soy','eres','es','somos','sois','son'], pret:['fui','fuiste','fue','fuimos','fuisteis','fueron'], imp:['era','eras','era','éramos','erais','eran'], fut:['seré','serás','será','seremos','seréis','serán'], cond:['sería','serías','sería','seríamos','seríais','serían'], subj:['sea','seas','sea','seamos','seáis','sean'], perf:['he sido','has sido','ha sido','hemos sido','habéis sido','han sido'] },
    estar: { pres:['estoy','estás','está','estamos','estáis','están'], pret:['estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron'], imp:['estaba','estabas','estaba','estábamos','estabais','estaban'], fut:['estaré','estarás','estará','estaremos','estaréis','estarán'], cond:['estaría','estarías','estaría','estaríamos','estaríais','estarían'], subj:['esté','estés','esté','estemos','estéis','estén'], perf:['he estado','has estado','ha estado','hemos estado','habéis estado','han estado'] },
    tener: { pres:['tengo','tienes','tiene','tenemos','tenéis','tienen'], pret:['tuve','tuviste','tuvo','tuvimos','tuvisteis','tuvieron'], imp:['tenía','tenías','tenía','teníamos','teníais','tenían'], fut:['tendré','tendrás','tendrá','tendremos','tendréis','tendrán'], cond:['tendría','tendrías','tendría','tendríamos','tendríais','tendrían'], subj:['tenga','tengas','tenga','tengamos','tengáis','tengan'], perf:['he tenido','has tenido','ha tenido','hemos tenido','habéis tenido','han tenido'] },
    ir:    { pres:['voy','vas','va','vamos','vais','van'], pret:['fui','fuiste','fue','fuimos','fuisteis','fueron'], imp:['iba','ibas','iba','íbamos','ibais','iban'], fut:['iré','irás','irá','iremos','iréis','irán'], cond:['iría','irías','iría','iríamos','iríais','irían'], subj:['vaya','vayas','vaya','vayamos','vayáis','vayan'], perf:['he ido','has ido','ha ido','hemos ido','habéis ido','han ido'] },
    hacer: { pres:['hago','haces','hace','hacemos','hacéis','hacen'], pret:['hice','hiciste','hizo','hicimos','hicisteis','hicieron'], imp:['hacía','hacías','hacía','hacíamos','hacíais','hacían'], fut:['haré','harás','hará','haremos','haréis','harán'], cond:['haría','harías','haría','haríamos','haríais','harían'], subj:['haga','hagas','haga','hagamos','hagáis','hagan'], perf:['he hecho','has hecho','ha hecho','hemos hecho','habéis hecho','han hecho'] },
    decir: { pres:['digo','dices','dice','decimos','decís','dicen'], pret:['dije','dijiste','dijo','dijimos','dijisteis','dijeron'], imp:['decía','decías','decía','decíamos','decíais','decían'], fut:['diré','dirás','dirá','diremos','diréis','dirán'], cond:['diría','dirías','diría','diríamos','diríais','dirían'], subj:['diga','digas','diga','digamos','digáis','digan'], perf:['he dicho','has dicho','ha dicho','hemos dicho','habéis dicho','han dicho'] },
    poder: { pres:['puedo','puedes','puede','podemos','podéis','pueden'], pret:['pude','pudiste','pudo','pudimos','pudisteis','pudieron'], imp:['podía','podías','podía','podíamos','podíais','podían'], fut:['podré','podrás','podrá','podremos','podréis','podrán'], cond:['podría','podrías','podría','podríamos','podríais','podrían'], subj:['pueda','puedas','pueda','podamos','podáis','puedan'], perf:['he podido','has podido','ha podido','hemos podido','habéis podido','han podido'] },
    querer:{ pres:['quiero','quieres','quiere','queremos','queréis','quieren'], pret:['quise','quisiste','quiso','quisimos','quisisteis','quisieron'], imp:['quería','querías','quería','queríamos','queríais','querían'], fut:['querré','querrás','querrá','querremos','querréis','querrán'], cond:['querría','querrías','querría','querríamos','querríais','querrían'], subj:['quiera','quieras','quiera','queramos','queráis','quieran'], perf:['he querido','has querido','ha querido','hemos querido','habéis querido','han querido'] },
    saber: { pres:['sé','sabes','sabe','sabemos','sabéis','saben'], pret:['supe','supiste','supo','supimos','supisteis','supieron'], imp:['sabía','sabías','sabía','sabíamos','sabíais','sabían'], fut:['sabré','sabrás','sabrá','sabremos','sabréis','sabrán'], cond:['sabría','sabrías','sabría','sabríamos','sabríais','sabrían'], subj:['sepa','sepas','sepa','sepamos','sepáis','sepan'], perf:['he sabido','has sabido','ha sabido','hemos sabido','habéis sabido','han sabido'] },
    venir: { pres:['vengo','vienes','viene','venimos','venís','vienen'], pret:['vine','viniste','vino','vinimos','vinisteis','vinieron'], imp:['venía','venías','venía','veníamos','veníais','venían'], fut:['vendré','vendrás','vendrá','vendremos','vendréis','vendrán'], cond:['vendría','vendrías','vendría','vendríamos','vendríais','vendrían'], subj:['venga','vengas','venga','vengamos','vengáis','vengan'], perf:['he venido','has venido','ha venido','hemos venido','habéis venido','han venido'] },
    ver:   { pres:['veo','ves','ve','vemos','veis','ven'], pret:['vi','viste','vio','vimos','visteis','vieron'], imp:['veía','veías','veía','veíamos','veíais','veían'], fut:['veré','verás','verá','veremos','veréis','verán'], cond:['vería','verías','vería','veríamos','veríais','verían'], subj:['vea','veas','vea','veamos','veáis','vean'], perf:['he visto','has visto','ha visto','hemos visto','habéis visto','han visto'] },
    dar:   { pres:['doy','das','da','damos','dais','dan'], pret:['di','diste','dio','dimos','disteis','dieron'], imp:['daba','dabas','daba','dábamos','dabais','daban'], fut:['daré','darás','dará','daremos','daréis','darán'], cond:['daría','darías','daría','daríamos','daríais','darían'], subj:['dé','des','dé','demos','deis','den'], perf:['he dado','has dado','ha dado','hemos dado','habéis dado','han dado'] },
    poner: { pres:['pongo','pones','pone','ponemos','ponéis','ponen'], pret:['puse','pusiste','puso','pusimos','pusisteis','pusieron'], imp:['ponía','ponías','ponía','poníamos','poníais','ponían'], fut:['pondré','pondrás','pondrá','pondremos','pondréis','pondrán'], cond:['pondría','pondrías','pondría','pondríamos','pondríais','pondrían'], subj:['ponga','pongas','ponga','pongamos','pongáis','pongan'], perf:['he puesto','has puesto','ha puesto','hemos puesto','habéis puesto','han puesto'] },
  };

  // Top 60 Spanish verbs with glosses + irregular flag
  const ES_VERBS = [
    { v:'ser', g:'to be (essential)', irr:true },
    { v:'estar', g:'to be (temporary)', irr:true },
    { v:'tener', g:'to have', irr:true },
    { v:'hacer', g:'to do / to make', irr:true },
    { v:'ir', g:'to go', irr:true },
    { v:'decir', g:'to say / to tell', irr:true },
    { v:'poder', g:'to be able to', irr:true },
    { v:'querer', g:'to want / love', irr:true },
    { v:'saber', g:'to know (facts)', irr:true },
    { v:'venir', g:'to come', irr:true },
    { v:'ver', g:'to see', irr:true },
    { v:'dar', g:'to give', irr:true },
    { v:'poner', g:'to put', irr:true },
    { v:'hablar', g:'to speak' },
    { v:'comer', g:'to eat' },
    { v:'vivir', g:'to live' },
    { v:'trabajar', g:'to work' },
    { v:'estudiar', g:'to study' },
    { v:'escribir', g:'to write' },
    { v:'leer', g:'to read' },
    { v:'comprender', g:'to understand' },
    { v:'aprender', g:'to learn' },
    { v:'beber', g:'to drink' },
    { v:'abrir', g:'to open' },
    { v:'cerrar', g:'to close' },
    { v:'empezar', g:'to begin' },
    { v:'terminar', g:'to finish' },
    { v:'llegar', g:'to arrive' },
    { v:'salir', g:'to leave' },
    { v:'entrar', g:'to enter' },
    { v:'llevar', g:'to carry / wear' },
    { v:'traer', g:'to bring' },
    { v:'comprar', g:'to buy' },
    { v:'vender', g:'to sell' },
    { v:'pagar', g:'to pay' },
    { v:'ganar', g:'to win / earn' },
    { v:'perder', g:'to lose' },
    { v:'buscar', g:'to look for' },
    { v:'encontrar', g:'to find' },
    { v:'conocer', g:'to know (people)' },
    { v:'pensar', g:'to think' },
    { v:'creer', g:'to believe' },
    { v:'sentir', g:'to feel' },
    { v:'esperar', g:'to wait / hope' },
    { v:'necesitar', g:'to need' },
    { v:'usar', g:'to use' },
    { v:'llamar', g:'to call' },
    { v:'preguntar', g:'to ask' },
    { v:'contestar', g:'to answer' },
    { v:'escuchar', g:'to listen' },
    { v:'mirar', g:'to watch / look' },
    { v:'jugar', g:'to play' },
    { v:'correr', g:'to run' },
    { v:'caminar', g:'to walk' },
    { v:'dormir', g:'to sleep' },
    { v:'despertar', g:'to wake up' },
    { v:'bañar', g:'to bathe' },
    { v:'levantar', g:'to lift / raise' },
    { v:'cocinar', g:'to cook' },
    { v:'ayudar', g:'to help' },
  ];

  function getEsConj(verb){
    if(ES_IRREGULAR[verb]) return ES_IRREGULAR[verb];
    return esConjugate(verb);
  }

  // ─────────────────────────────────────────────────────────────────
  // French
  // ─────────────────────────────────────────────────────────────────
  const FR_PRON = ['je','tu','il/elle','nous','vous','ils/elles'];

  const FR_ENDINGS = {
    er: { pres:['e','es','e','ons','ez','ent'], imp:['ais','ais','ait','ions','iez','aient'], fut:['erai','eras','era','erons','erez','eront'], cond:['erais','erais','erait','erions','eriez','eraient'], subj:['e','es','e','ions','iez','ent'], pp:'é' },
    ir: { pres:['is','is','it','issons','issez','issent'], imp:['issais','issais','issait','issions','issiez','issaient'], fut:['irai','iras','ira','irons','irez','iront'], cond:['irais','irais','irait','irions','iriez','iraient'], subj:['isse','isses','isse','issions','issiez','issent'], pp:'i' },
    re: { pres:['s','s','','ons','ez','ent'], imp:['ais','ais','ait','ions','iez','aient'], fut:['rai','ras','ra','rons','rez','ront'], cond:['rais','rais','rait','rions','riez','raient'], subj:['e','es','e','ions','iez','ent'], pp:'u' },
  };

  function frConjugate(verb){
    const endings = [['er',2],['ir',2],['re',2]];
    let group = null, stem = null;
    for(const [g, len] of endings){
      if(verb.endsWith(g)){ group = g; stem = verb.slice(0, -len); break; }
    }
    if(!group) return null;
    const e = FR_ENDINGS[group];
    const pp = stem + e.pp;
    const presElision = (w) => /^[aeiouhéèê]/i.test(w) && w.startsWith(stem) ? w : w; // kept simple
    return {
      pres: e.pres.map(x => stem + x),
      imp:  e.imp.map(x => stem + x),
      fut:  e.fut.map(x => stem + x),
      cond: e.cond.map(x => stem + x),
      subj: e.subj.map(x => stem + x),
      pc: ['ai','as','a','avons','avez','ont'].map(a => a + ' ' + pp), // assumes avoir aux
      aux: 'avoir',
      pp: pp,
    };
  }

  const FR_IRREGULAR = {
    être: { pres:['suis','es','est','sommes','êtes','sont'], imp:['étais','étais','était','étions','étiez','étaient'], fut:['serai','seras','sera','serons','serez','seront'], cond:['serais','serais','serait','serions','seriez','seraient'], subj:['sois','sois','soit','soyons','soyez','soient'], pp:'été', aux:'avoir', pc:['ai été','as été','a été','avons été','avez été','ont été'] },
    avoir:{ pres:['ai','as','a','avons','avez','ont'], imp:['avais','avais','avait','avions','aviez','avaient'], fut:['aurai','auras','aura','aurons','aurez','auront'], cond:['aurais','aurais','aurait','aurions','auriez','auraient'], subj:['aie','aies','ait','ayons','ayez','aient'], pp:'eu', aux:'avoir', pc:['ai eu','as eu','a eu','avons eu','avez eu','ont eu'] },
    aller:{ pres:['vais','vas','va','allons','allez','vont'], imp:['allais','allais','allait','allions','alliez','allaient'], fut:['irai','iras','ira','irons','irez','iront'], cond:['irais','irais','irait','irions','iriez','iraient'], subj:['aille','ailles','aille','allions','alliez','aillent'], pp:'allé', aux:'être', pc:['suis allé(e)','es allé(e)','est allé(e)','sommes allé(e)s','êtes allé(e)(s)','sont allé(e)s'] },
    faire:{ pres:['fais','fais','fait','faisons','faites','font'], imp:['faisais','faisais','faisait','faisions','faisiez','faisaient'], fut:['ferai','feras','fera','ferons','ferez','feront'], cond:['ferais','ferais','ferait','ferions','feriez','feraient'], subj:['fasse','fasses','fasse','fassions','fassiez','fassent'], pp:'fait', aux:'avoir', pc:['ai fait','as fait','a fait','avons fait','avez fait','ont fait'] },
    pouvoir:{ pres:['peux','peux','peut','pouvons','pouvez','peuvent'], imp:['pouvais','pouvais','pouvait','pouvions','pouviez','pouvaient'], fut:['pourrai','pourras','pourra','pourrons','pourrez','pourront'], cond:['pourrais','pourrais','pourrait','pourrions','pourriez','pourraient'], subj:['puisse','puisses','puisse','puissions','puissiez','puissent'], pp:'pu', aux:'avoir', pc:['ai pu','as pu','a pu','avons pu','avez pu','ont pu'] },
    vouloir:{ pres:['veux','veux','veut','voulons','voulez','veulent'], imp:['voulais','voulais','voulait','voulions','vouliez','voulaient'], fut:['voudrai','voudras','voudra','voudrons','voudrez','voudront'], cond:['voudrais','voudrais','voudrait','voudrions','voudriez','voudraient'], subj:['veuille','veuilles','veuille','voulions','vouliez','veuillent'], pp:'voulu', aux:'avoir', pc:['ai voulu','as voulu','a voulu','avons voulu','avez voulu','ont voulu'] },
    savoir:{ pres:['sais','sais','sait','savons','savez','savent'], imp:['savais','savais','savait','savions','saviez','savaient'], fut:['saurai','sauras','saura','saurons','saurez','sauront'], cond:['saurais','saurais','saurait','saurions','sauriez','sauraient'], subj:['sache','saches','sache','sachions','sachiez','sachent'], pp:'su', aux:'avoir', pc:['ai su','as su','a su','avons su','avez su','ont su'] },
    venir:{ pres:['viens','viens','vient','venons','venez','viennent'], imp:['venais','venais','venait','venions','veniez','venaient'], fut:['viendrai','viendras','viendra','viendrons','viendrez','viendront'], cond:['viendrais','viendrais','viendrait','viendrions','viendriez','viendraient'], subj:['vienne','viennes','vienne','venions','veniez','viennent'], pp:'venu', aux:'être', pc:['suis venu(e)','es venu(e)','est venu(e)','sommes venu(e)s','êtes venu(e)(s)','sont venu(e)s'] },
    voir:{ pres:['vois','vois','voit','voyons','voyez','voient'], imp:['voyais','voyais','voyait','voyions','voyiez','voyaient'], fut:['verrai','verras','verra','verrons','verrez','verront'], cond:['verrais','verrais','verrait','verrions','verriez','verraient'], subj:['voie','voies','voie','voyions','voyiez','voient'], pp:'vu', aux:'avoir', pc:['ai vu','as vu','a vu','avons vu','avez vu','ont vu'] },
    dire:{ pres:['dis','dis','dit','disons','dites','disent'], imp:['disais','disais','disait','disions','disiez','disaient'], fut:['dirai','diras','dira','dirons','direz','diront'], cond:['dirais','dirais','dirait','dirions','diriez','diraient'], subj:['dise','dises','dise','disions','disiez','disent'], pp:'dit', aux:'avoir', pc:['ai dit','as dit','a dit','avons dit','avez dit','ont dit'] },
    prendre:{ pres:['prends','prends','prend','prenons','prenez','prennent'], imp:['prenais','prenais','prenait','prenions','preniez','prenaient'], fut:['prendrai','prendras','prendra','prendrons','prendrez','prendront'], cond:['prendrais','prendrais','prendrait','prendrions','prendriez','prendraient'], subj:['prenne','prennes','prenne','prenions','preniez','prennent'], pp:'pris', aux:'avoir', pc:['ai pris','as pris','a pris','avons pris','avez pris','ont pris'] },
    mettre:{ pres:['mets','mets','met','mettons','mettez','mettent'], imp:['mettais','mettais','mettait','mettions','mettiez','mettaient'], fut:['mettrai','mettras','mettra','mettrons','mettrez','mettront'], cond:['mettrais','mettrais','mettrait','mettrions','mettriez','mettraient'], subj:['mette','mettes','mette','mettions','mettiez','mettent'], pp:'mis', aux:'avoir', pc:['ai mis','as mis','a mis','avons mis','avez mis','ont mis'] },
  };

  // DR MRS VANDERTRAMP — être auxiliaire
  const ETRE_AUX = new Set(['aller','venir','arriver','partir','entrer','sortir','monter','descendre','naître','mourir','rester','tomber','devenir','revenir','rentrer','retourner','passer']);

  const FR_VERBS = [
    { v:'être', g:'to be', irr:true },
    { v:'avoir', g:'to have', irr:true },
    { v:'aller', g:'to go', irr:true, etre:true },
    { v:'faire', g:'to do / to make', irr:true },
    { v:'pouvoir', g:'to be able to', irr:true },
    { v:'vouloir', g:'to want', irr:true },
    { v:'savoir', g:'to know', irr:true },
    { v:'venir', g:'to come', irr:true, etre:true },
    { v:'voir', g:'to see', irr:true },
    { v:'dire', g:'to say', irr:true },
    { v:'prendre', g:'to take', irr:true },
    { v:'mettre', g:'to put', irr:true },
    { v:'parler', g:'to speak' },
    { v:'manger', g:'to eat' },
    { v:'habiter', g:'to live' },
    { v:'travailler', g:'to work' },
    { v:'étudier', g:'to study' },
    { v:'écouter', g:'to listen' },
    { v:'regarder', g:'to watch' },
    { v:'chanter', g:'to sing' },
    { v:'danser', g:'to dance' },
    { v:'jouer', g:'to play' },
    { v:'aimer', g:'to like / love' },
    { v:'détester', g:'to hate' },
    { v:'donner', g:'to give' },
    { v:'trouver', g:'to find' },
    { v:'acheter', g:'to buy' },
    { v:'vendre', g:'to sell' },
    { v:'chercher', g:'to look for' },
    { v:'demander', g:'to ask' },
    { v:'répondre', g:'to answer' },
    { v:'attendre', g:'to wait' },
    { v:'entendre', g:'to hear' },
    { v:'lire', g:'to read', irr:true },
    { v:'écrire', g:'to write', irr:true },
    { v:'boire', g:'to drink', irr:true },
    { v:'finir', g:'to finish' },
    { v:'choisir', g:'to choose' },
    { v:'réussir', g:'to succeed' },
    { v:'grandir', g:'to grow' },
    { v:'arriver', g:'to arrive', etre:true },
    { v:'partir', g:'to leave', etre:true, irr:true },
    { v:'entrer', g:'to enter', etre:true },
    { v:'sortir', g:'to go out', etre:true, irr:true },
    { v:'monter', g:'to go up', etre:true },
    { v:'descendre', g:'to go down', etre:true },
    { v:'rester', g:'to stay', etre:true },
    { v:'tomber', g:'to fall', etre:true },
    { v:'naître', g:'to be born', etre:true, irr:true },
    { v:'mourir', g:'to die', etre:true, irr:true },
    { v:'devenir', g:'to become', etre:true, irr:true },
    { v:'revenir', g:'to come back', etre:true, irr:true },
    { v:'rentrer', g:'to return', etre:true },
    { v:'retourner', g:'to return', etre:true },
    { v:'passer', g:'to pass by', etre:true },
    { v:'marcher', g:'to walk' },
    { v:'courir', g:'to run', irr:true },
    { v:'dormir', g:'to sleep', irr:true },
    { v:'ouvrir', g:'to open', irr:true },
    { v:'fermer', g:'to close' },
  ];

  function getFrConj(verb){
    if(FR_IRREGULAR[verb]) return FR_IRREGULAR[verb];
    const c = frConjugate(verb);
    if(!c) return null;
    if(ETRE_AUX.has(verb)){
      c.aux = 'être';
      c.pc = ['suis','es','est','sommes','êtes','sont'].map(a => a + ' ' + c.pp);
    }
    return c;
  }

  // ─────────────────────────────────────────────────────────────────
  // Shared renderer
  // ─────────────────────────────────────────────────────────────────
  function renderConjugator(lang){
    const isEs = lang === 'es';
    const pronouns = isEs ? ES_PRON : FR_PRON;
    const verbs = isEs ? ES_VERBS : FR_VERBS;
    const getConj = isEs ? getEsConj : getFrConj;
    const tensesEs = [
      {id:'pres', label:'Presente'}, {id:'pret', label:'Pretérito'},
      {id:'imp', label:'Imperfecto'}, {id:'fut', label:'Futuro'},
      {id:'cond', label:'Condicional'}, {id:'subj', label:'Subjuntivo'},
      {id:'perf', label:'Pretérito perfecto'}
    ];
    const tensesFr = [
      {id:'pres', label:'Présent'}, {id:'imp', label:'Imparfait'},
      {id:'fut', label:'Futur simple'}, {id:'cond', label:'Conditionnel'},
      {id:'subj', label:'Subjonctif'}, {id:'pc', label:'Passé composé'},
    ];
    const tenses = isEs ? tensesEs : tensesFr;

    let state = { verb: verbs[0].v, tense: tenses[0].id };

    return function(body){
      const verbData = verbs.find(v => v.v === state.verb);
      const conj = getConj(state.verb);
      const baseForm = (isEs ? esConjugate(state.verb) : frConjugate(state.verb));

      body.innerHTML = `
        <div class="ref-conj-wrap">
          <div class="ref-conj-search">
            <input type="search" id="refConjSearch" class="ref-search-input" placeholder="Search verbs…" autocomplete="off" value="">
            <div id="refConjAuto" class="ref-conj-autocomplete" style="display:none"></div>
          </div>
          <div class="ref-conj-chips" id="refConjChips">
            ${verbs.slice(0, 30).map(v => `<button type="button" class="ref-conj-chip${v.irr?' irregular':''}${v.v===state.verb?' active':''}" data-verb="${esc(v.v)}">${esc(v.v)}${v.irr?' ●':''}</button>`).join('')}
          </div>

          <div>
            <div class="ref-conj-verb-title">
              ${esc(verbData.v)}
              ${verbData.irr ? '<span class="ref-conj-badge ref-conj-badge--irr">irregular</span>' : ''}
              ${verbData.etre ? '<span class="ref-conj-badge ref-conj-badge--etre">aux. être</span>' : ''}
            </div>
            <div class="ref-conj-gloss">${esc(verbData.g)}</div>
          </div>

          <div class="ref-tool-tabs" style="border:0;padding:0;margin-bottom:10px">
            ${tenses.map(t => `<button type="button" class="ref-tool-tab ${t.id===state.tense?'active':''}" data-tense="${t.id}">${esc(t.label)}</button>`).join('')}
          </div>

          <div class="ref-formula-card">
            <table class="ref-conj-table">
              <tbody>
                ${pronouns.map((p, i) => {
                  const form = conj && conj[state.tense] ? conj[state.tense][i] : '—';
                  // Compare with base regular form to highlight irregular parts
                  const reg = baseForm && baseForm[state.tense] ? baseForm[state.tense][i] : null;
                  const isIrr = reg && form !== reg;
                  return `<tr>
                    <th>${esc(p)}</th>
                    <td class="${isIrr?'ref-conj-irr':''}">${esc(form)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Wiring
      const input = body.querySelector('#refConjSearch');
      const auto = body.querySelector('#refConjAuto');
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if(!q){ auto.style.display = 'none'; return; }
        const matches = verbs.filter(v => v.v.toLowerCase().includes(q) || v.g.toLowerCase().includes(q)).slice(0, 10);
        if(!matches.length){ auto.style.display = 'none'; return; }
        auto.innerHTML = matches.map(v => `<button type="button" data-verb="${esc(v.v)}"><strong>${esc(v.v)}</strong> <span style="color:var(--muted2);font-size:.78rem">— ${esc(v.g)}${v.irr?' (irregular)':''}</span></button>`).join('');
        auto.style.display = 'block';
        auto.querySelectorAll('button').forEach(b => {
          b.addEventListener('click', () => {
            state.verb = b.dataset.verb;
            input.value = '';
            auto.style.display = 'none';
            body.dispatchEvent(new CustomEvent('refRerender'));
          });
        });
      });
      document.addEventListener('click', (e) => {
        if(!body.contains(e.target)) auto.style.display = 'none';
      }, { once: true });

      body.querySelectorAll('[data-verb]').forEach(b => {
        b.addEventListener('click', () => {
          state.verb = b.dataset.verb;
          body.dispatchEvent(new CustomEvent('refRerender'));
        });
      });
      body.querySelectorAll('[data-tense]').forEach(b => {
        b.addEventListener('click', () => {
          state.tense = b.dataset.tense;
          body.dispatchEvent(new CustomEvent('refRerender'));
        });
      });
      body.addEventListener('refRerender', () => renderConjugator.__active(body));
    };
  }

  function openSpanishConjugator(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    const renderer = renderConjugator('es');
    renderConjugator.__active = renderer;
    window.fluxOpenToolModal({
      id: 'spanish-conj',
      emoji: '🇪🇸',
      title: 'Spanish Conjugator',
      renderBody: (body) => renderer(body),
    });
  }

  function openFrenchConjugator(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    const renderer = renderConjugator('fr');
    renderConjugator.__active = renderer;
    window.fluxOpenToolModal({
      id: 'french-conj',
      emoji: '🇫🇷',
      title: 'French Conjugator',
      renderBody: (body) => renderer(body),
    });
  }

  try{
    window.openSpanishConjugator = openSpanishConjugator;
    window.openFrenchConjugator = openFrenchConjugator;
  }catch(e){}
})();
