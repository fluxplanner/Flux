/* ============================================================================
   FLUX STUDY HUB · Language subjects
   Four tools each for French, German and Spanish — dictionary, conjugator,
   irregular verbs, common phrases — plus the IPA chart, which is English
   phonetics and now sits under English.

   WHY THREE SUBJECTS AND NOT ONE
   ------------------------------
   There used to be a single "Languages" pill holding a Spanish/French toggle.
   That works while the umbrella is called "English & Languages" and holds two
   of them; it stops working the moment someone takes German, because every
   tool then opens on the wrong language and the first thing you do in a
   revision session is press a switch. The rail already knows which language
   you are in — asking again inside every tool is a question with a known
   answer.

   NOTHING IS RETYPED
   ------------------
   The dictionary reads the same rows as the practice decks
   (FluxLangPractice.words). The conjugator and the irregular-verbs sheet are
   both driven by FluxLangEngine — the irregular list stores only infinitives
   and glosses and computes every form on the way to the screen. So a wrong
   form cannot exist in one place and be right in another, which is how "yo
   podo" survived in the old six-line trainer while a correct table sat
   elsewhere in the app.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    /* The conjugation tables live in flux-lang-engine.js. They used to be four
       lines here, and those four lines taught "nous partissons" and "yo podo".
       See that file's header for what was wrong and why being right needed a
       hundred times the data. */
    const ENG = () => window.FluxLangEngine;
    const LANGS = {
      fr: { name: 'French', sample: 'parler' },
      de: { name: 'German', sample: 'sprechen' },
      es: { name: 'Spanish', sample: 'hablar' },
    };
    const COL = { es: 1, fr: 2, de: 3 };
    const loading = (what) => '<div class="fsh-card" style="padding:20px">'
      + `<span class="fsh-err">${esc(what)} still loading — reopen this tool in a moment.</span></div>`;

    // ── conjugator ───────────────────────────────────────────────────────────
    // One tense at a time, remembered per language so switching subject does
    // not drop you back on the present every time.
    const tenseOf = {};

    function renderConj(lang, body) {
      const E = ENG();
      if (!E) { body.innerHTML = loading('Conjugation tables'); return; }
      const L = LANGS[lang];
      const tenses = E.tenses(lang);
      if (!tenses.some((t) => t.id === tenseOf[lang])) tenseOf[lang] = tenses[0].id;
      const active = tenses.filter((t) => t.id === tenseOf[lang])[0];

      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🗣 ${esc(L.name)} conjugator</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${tenses.length} tenses, offline and instant. Every irregular form is written out rather than guessed at.</p>
        <div class="fsh-field" style="flex-wrap:wrap"><input id="lgVerb" class="fsh-input" value="${esc(L.sample)}" spellcheck="false" autocapitalize="off" autocorrect="off"><button type="button" class="fsh-btn" id="lgGo">Conjugate</button></div>
        <div class="fsh-seg" id="lgTenseSeg" style="margin-top:10px">${tenses.map((t) => `<button type="button" data-t="${esc(t.id)}" class="${t.id === tenseOf[lang] ? 'active' : ''}">${esc(t.name)}</button>`).join('')}</div>
        <div class="fsh-note" style="margin-top:8px">${esc(active.hint)}</div>
        <div class="fsh-out" id="lgOut"></div></div>`;

      const show = (typed) => {
        const o = document.getElementById('lgOut');
        if (!o) return;
        try {
          const r = ENG().conjugate(lang, typed, tenseOf[lang]);
          o.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${r.pronouns.map((p, i) => `<tr><th style="text-align:left">${esc(p)}</th><td style="background:rgba(54,197,214,.14);color:var(--fsh-ink);font-weight:640">${esc(r.forms[i])}</td></tr>`).join('')}</tbody></table><div class="fsh-note">${esc(r.note)}</div>`;
        } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; }
      };
      const run = () => show(document.getElementById('lgVerb').value);

      /* Re-render on a tense change rather than just re-running: the active
         pill and the hint underneath both change too. The typed verb is
         carried across so switching tense doesn't throw away your place. */
      document.getElementById('lgTenseSeg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        const typed = document.getElementById('lgVerb').value;
        tenseOf[lang] = b.dataset.t;
        renderConj(lang, body);
        const inp = document.getElementById('lgVerb');
        if (inp && typed) inp.value = typed;
        show(typed);
      });
      document.getElementById('lgGo').addEventListener('click', run);
      // Enter is how anyone actually submits a one-field form.
      document.getElementById('lgVerb').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      run();
    }

    // ── irregular verbs ──────────────────────────────────────────────────────
    /* Generated, not typed. The engine hands over [infinitive, gloss] and every
       column below is conjugated on the spot, so this sheet and the conjugator
       next to it are physically incapable of disagreeing. */
    function irregColumns(lang) {
      if (lang === 'de') return ['Infinitiv', 'er/sie', 'Präteritum', 'Perfekt'];
      if (lang === 'fr') return ['Infinitive', 'je', 'Participle', 'Passé composé'];
      return ['Infinitive', 'yo', 'Preterite (yo)', 'Participle'];
    }
    function irregRow(lang, verb) {
      const E = ENG();
      if (lang === 'de') {
        const p = E.principalParts(verb);
        return [p.third, p.past, p.perfect];
      }
      if (lang === 'fr') {
        return [
          E.conjugate('fr', verb, 'present').forms[0],
          E.pastParticiple('fr', verb),
          E.conjugate('fr', verb, 'passeCompose').forms[0],
        ];
      }
      return [
        E.conjugate('es', verb, 'present').forms[0],
        E.conjugate('es', verb, 'preterite').forms[0],
        E.pastParticiple('es', verb),
      ];
    }
    function renderIrregular(lang, body) {
      const E = ENG();
      if (!E) { body.innerHTML = loading('Verb tables'); return; }
      const cols = irregColumns(lang);
      const rows = [];
      E.irregulars(lang).forEach((entry) => {
        /* A verb the engine cannot conjugate must not appear as a blank row —
           silently printing empty cells is how a reference sheet teaches
           nothing while still looking complete. Skipped instead. */
        try { rows.push([entry[0], entry[1]].concat(irregRow(lang, entry[0]))); } catch (e) {}
      });
      const head = `<tr><th style="text-align:left">${cols.map(esc).join('</th><th>')}</th><th>English</th></tr>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📋 ${esc(LANGS[lang].name)} irregular verbs</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${rows.length} verbs, ${lang === 'de' ? 'with their principal parts' : 'with the forms that catch people out'}. Every cell is produced by the same tables the conjugator uses.</p>
        <div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:520px"><thead>${head}</thead><tbody>${rows.map((r) => {
    const cells = r.slice(2).map((c) => `<td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(c)}</td>`).join('');
    return `<tr><th style="text-align:left">${esc(r[0])}</th>${cells}<td style="background:transparent;color:var(--fsh-mut)">${esc(r[1])}</td></tr>`;
  }).join('')}</tbody></table></div></div>`;
    }

    // ── dictionary ───────────────────────────────────────────────────────────
    /* Reads the practice decks rather than carrying a word list of its own.
       Two lists of the same 221 words would drift, and the one that drifted
       would be the one nobody was testing. */
    const dictQ = {};

    function dictRows(lang) {
      const P = window.FluxLangPractice;
      if (!P) return null;
      const out = [];
      P.themes().forEach((t) => {
        P.words(t.id).forEach((w) => { out.push({ topic: t.name, en: w[0], tgt: w[COL[lang]] }); });
      });
      return out;
    }
    /** Accent-blind, so searching "prufung" finds Prüfung. */
    function fold(s) {
      return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ß/g, 'ss');
    }

    function renderDict(lang, body) {
      const all = dictRows(lang);
      if (!all) { body.innerHTML = loading('The word list'); return; }
      const q = dictQ[lang] || '';
      const hits = q
        ? all.filter((r) => fold(r.en).indexOf(fold(q)) >= 0 || fold(r.tgt).indexOf(fold(q)) >= 0)
        : all;

      // Grouped by topic so an empty search box is a browsable dictionary
      // rather than 221 undifferentiated rows.
      const byTopic = [];
      hits.forEach((r) => {
        const last = byTopic[byTopic.length - 1];
        if (last && last.topic === r.topic) last.rows.push(r);
        else byTopic.push({ topic: r.topic, rows: [r] });
      });

      const table = (rows) => `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:360px"><tbody>${rows.map((r) =>
        `<tr><th style="text-align:left">${esc(r.en)}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(r.tgt)}</td></tr>`).join('')}</tbody></table></div>`;

      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🔍 English ⇄ ${esc(LANGS[lang].name)}</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${all.length} words with their articles, grouped by topic. Type in either language — accents optional.</p>
        <div class="fsh-field"><input id="lgDictQ" class="fsh-input" placeholder="Search English or ${esc(LANGS[lang].name)}…" value="${esc(q)}" spellcheck="false" autocapitalize="off" autocorrect="off"></div>
        ${hits.length
    ? `<div class="fsh-note" style="margin-top:8px">${hits.length} of ${all.length} words</div>`
            + byTopic.map((g) => `<div class="fsh-label" style="margin-top:14px"><span>${esc(g.topic)}</span></div>${table(g.rows)}`).join('')
    : `<div class="fsh-note" style="margin-top:12px">Nothing matched “${esc(q)}”. The dictionary covers the ${all.length} words on the syllabus, not every word in the language — use the Translation tab for anything else.</div>`}
        </div>`;

      const inp = document.getElementById('lgDictQ');
      if (inp) {
        inp.addEventListener('input', () => {
          dictQ[lang] = inp.value;
          const at = inp.selectionStart;
          renderDict(lang, body);
          /* Re-rendering replaces the input, so the caret has to be put back
             or every keystroke after the first lands at the start of the box
             and you end up typing your search term backwards. */
          const next = document.getElementById('lgDictQ');
          if (next) { next.focus(); try { next.setSelectionRange(at, at); } catch (e) {} }
        });
      }
    }

    // ── common phrases ───────────────────────────────────────────────────────
    /* Grouped rather than one flat list of ten. The old table was a greeting
       card: hello, goodbye, thank you. None of it helps in the lesson you are
       actually sitting in, which is where classroom language and the "I need
       to say something and don't know how" rows come in. */
    const PHRASE_GROUPS = [
      ['Greetings', [
        ['Hello', 'Hola', 'Bonjour', 'Hallo'],
        ['Good morning', 'Buenos días', 'Bonjour', 'Guten Morgen'],
        ['Good evening', 'Buenas noches', 'Bonsoir', 'Guten Abend'],
        ['Goodbye', 'Adiós', 'Au revoir', 'Auf Wiedersehen'],
        ['See you tomorrow', 'Hasta mañana', 'À demain', 'Bis morgen'],
        ['How are you?', '¿Cómo estás?', 'Comment ça va ?', 'Wie geht es dir?'],
        ['I am well, thanks', 'Estoy bien, gracias', 'Ça va bien, merci', 'Mir geht es gut, danke'],
        ['Nice to meet you', 'Mucho gusto', 'Enchanté(e)', 'Freut mich'],
      ]],
      ['Courtesy', [
        ['Please', 'Por favor', "S'il vous plaît", 'Bitte'],
        ['Thank you', 'Gracias', 'Merci', 'Danke'],
        ["You're welcome", 'De nada', 'De rien', 'Gern geschehen'],
        ['Excuse me', 'Perdón', 'Excusez-moi', 'Entschuldigung'],
        ['I am sorry', 'Lo siento', 'Je suis désolé(e)', 'Es tut mir leid'],
        ['Yes / No', 'Sí / No', 'Oui / Non', 'Ja / Nein'],
      ]],
      ['About you', [
        ['My name is…', 'Me llamo…', "Je m'appelle…", 'Ich heiße…'],
        ['I am … years old', 'Tengo … años', "J'ai … ans", 'Ich bin … Jahre alt'],
        ['I am from…', 'Soy de…', 'Je viens de…', 'Ich komme aus…'],
        ['I live in…', 'Vivo en…', "J'habite à…", 'Ich wohne in…'],
        ['I have a brother / sister', 'Tengo un hermano / una hermana', "J'ai un frère / une sœur", 'Ich habe einen Bruder / eine Schwester'],
        ['I like…', 'Me gusta…', "J'aime…", 'Ich mag…'],
        ["I don't like…", 'No me gusta…', "Je n'aime pas…", 'Ich mag … nicht'],
      ]],
      ['In class', [
        ['I have a question', 'Tengo una pregunta', "J'ai une question", 'Ich habe eine Frage'],
        ['How do you say … ?', '¿Cómo se dice … ?', 'Comment dit-on … ?', 'Wie sagt man … ?'],
        ['What does … mean?', '¿Qué significa … ?', 'Que veut dire … ?', 'Was bedeutet … ?'],
        ['Could you repeat that?', '¿Puede repetir?', 'Pouvez-vous répéter ?', 'Können Sie das wiederholen?'],
        ['More slowly, please', 'Más despacio, por favor', "Plus lentement, s'il vous plaît", 'Langsamer, bitte'],
        ["I don't understand", 'No entiendo', 'Je ne comprends pas', 'Ich verstehe nicht'],
        ["I don't know", 'No sé', 'Je ne sais pas', 'Ich weiß nicht'],
        ['May I go to the toilet?', '¿Puedo ir al baño?', 'Puis-je aller aux toilettes ?', 'Darf ich auf die Toilette gehen?'],
        ['When is it due?', '¿Para cuándo es?', "C'est pour quand ?", 'Bis wann muss das fertig sein?'],
        ['I forgot my homework', 'Olvidé mi tarea', "J'ai oublié mes devoirs", 'Ich habe meine Hausaufgaben vergessen'],
      ]],
      ['Out and about', [
        ['Where is…?', '¿Dónde está…?', 'Où est…?', 'Wo ist…?'],
        ['How much is it?', '¿Cuánto cuesta?', 'Combien ça coûte ?', 'Was kostet das?'],
        ['I would like…', 'Quisiera…', 'Je voudrais…', 'Ich möchte…'],
        ['The bill, please', 'La cuenta, por favor', "L'addition, s'il vous plaît", 'Die Rechnung, bitte'],
        ['I need help', 'Necesito ayuda', "J'ai besoin d'aide", 'Ich brauche Hilfe'],
        ['Do you speak English?', '¿Habla inglés?', 'Parlez-vous anglais ?', 'Sprechen Sie Englisch?'],
        ['What time is it?', '¿Qué hora es?', 'Quelle heure est-il ?', 'Wie spät ist es?'],
      ]],
      ['Question words', [
        ['Who', 'Quién', 'Qui', 'Wer'],
        ['What', 'Qué', 'Quoi / Que', 'Was'],
        ['When', 'Cuándo', 'Quand', 'Wann'],
        ['Where', 'Dónde', 'Où', 'Wo'],
        ['Why', 'Por qué', 'Pourquoi', 'Warum'],
        ['How', 'Cómo', 'Comment', 'Wie'],
        ['How many', 'Cuántos', 'Combien', 'Wie viele'],
        ['Which', 'Cuál', 'Quel / Quelle', 'Welcher / Welche'],
      ]],
    ];

    function renderPhrases(lang, body) {
      const c = COL[lang];
      const table = (rows) => `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:360px"><tbody>${rows.map((p) => `<tr><th style="text-align:left">${esc(p[0])}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(p[c])}</td></tr>`).join('')}</tbody></table></div>`;
      const count = PHRASE_GROUPS.reduce((n, g) => n + g[1].length, 0);
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">💬 Common ${esc(LANGS[lang].name)} phrases</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${count} phrases grouped by when you'd actually need them, classroom language included.</p>
        ${PHRASE_GROUPS.map((g, i) => `<div class="fsh-label"${i ? ' style="margin-top:16px"' : ''}><span>${esc(g[0])}</span></div>${table(g[1])}`).join('')}</div>`;
    }

    // ── IPA chart (English phonetics — belongs to English) ────────────────────
    const IPA_C = [['p', 'pen'], ['b', 'bad'], ['t', 'top'], ['d', 'dog'], ['k', 'cat'], ['g', 'go'], ['m', 'man'], ['n', 'no'], ['ŋ', 'sing'], ['f', 'fan'], ['v', 'van'], ['θ', 'think'], ['ð', 'this'], ['s', 'see'], ['z', 'zoo'], ['ʃ', 'she'], ['ʒ', 'vision'], ['h', 'hat'], ['l', 'let'], ['r', 'run'], ['j', 'yes'], ['w', 'we'], ['tʃ', 'chair'], ['dʒ', 'jump']];
    const IPA_V = [['iː', 'see'], ['ɪ', 'sit'], ['e', 'bed'], ['æ', 'cat'], ['ɑː', 'car'], ['ɒ', 'hot'], ['ɔː', 'saw'], ['ʊ', 'put'], ['uː', 'too'], ['ʌ', 'cup'], ['ə', 'about'], ['ɜː', 'bird']];
    function renderIPA(body) {
      const grid = (arr) => `<div class="fsh-ion-grid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">${arr.map((x) => `<div class="fsh-ion"><span class="f" style="font-size:18px">${esc(x[0])}</span><div class="n">${esc(x[1])}</div></div>`).join('')}</div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Ƃ IPA chart</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Common English phonemes with example words.</p>
        <div class="fsh-label"><span>Consonants</span></div>${grid(IPA_C)}<div class="fsh-label" style="margin-top:14px"><span>Vowels</span></div>${grid(IPA_V)}</div>`;
    }

    // ── registration ─────────────────────────────────────────────────────────
    /* Same four tools, three times. The subject id and the language code are
       the only things that differ, so they are the only things passed in —
       three near-identical files would each need the next fix applied three
       times, and one of them would get missed. */
    [['french', 'fr'], ['german', 'de'], ['spanish', 'es']].forEach(function (pair) {
      const sid = pair[0], lang = pair[1];
      const low = LANGS[lang].name.toLowerCase();
      H.register(sid, [
        {
          id: 'dict', name: 'Dictionary', icon: '🔍',
          desc: 'dictionary vocabulary words lookup translate ' + low + ' english',
          render: (b) => renderDict(lang, b),
        },
        {
          id: 'conj', name: 'Conjugator', icon: '🗣',
          desc: 'conjugation ' + low + ' verbs tenses present past future',
          render: (b) => renderConj(lang, b),
        },
        {
          id: 'irreg', name: 'Irregular verbs', icon: '📋',
          desc: 'irregular verbs strong ' + low + ' list principal parts',
          render: (b) => renderIrregular(lang, b),
        },
        {
          id: 'phrases', name: 'Phrases', icon: '💬',
          desc: 'common phrases ' + low + ' classroom language speaking',
          render: (b) => renderPhrases(lang, b),
        },
      ]);
    });

    H.register('english', [
      { id: 'ipa', name: 'IPA chart', icon: 'Ƃ', desc: 'ipa phonetic alphabet pronunciation sounds', render: renderIPA },
    ]);

    /* One AI tool for all three, registered directly rather than through a
       tool's `ai` field: doing it per language would define the same name
       three times and only the last registration would survive. */
    if (typeof H.addAITool === 'function') {
      H.addAITool({
        name: 'conjugate',
        subject: 'languages',
        description: 'Conjugate a verb. Arg: "hablar es preterite", "partir fr" or "fahren de past". Tense is optional and defaults to the present.',
        params: { verb: 'string', lang: 'es|fr|de', tense: 'a tense id for that language' },
        run: (a) => {
          const m = String(a).trim().split(/\s+/);
          const r = ENG().conjugate((m[1] || 'es').toLowerCase(), m[0], m[2] || 'present');
          return r.pronouns.map((p, i) => p + ' ' + r.forms[i]).concat(['(' + r.note + ')']);
        },
      });
    }
  }
  boot();
})();
