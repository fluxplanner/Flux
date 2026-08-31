/* ============================================================================
   FLUX STUDY HUB · Languages module (Pass 4)
   Bespoke native tools: conjugation trainer (Spanish/French present),
   IPA chart, common phrases. Registers with fluxStudyHub.
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

    let lgLang = 'es';
    let lgTense = 'present';

    function renderConj(body) {
      const E = ENG();
      if (!E) { body.innerHTML = '<div class="fsh-card" style="padding:20px"><span class="fsh-err">Conjugation tables still loading — reopen this tool in a moment.</span></div>'; return; }
      const sample = lgLang === 'es' ? 'hablar' : 'parler';
      const tenses = E.tenses(lgLang);
      // Switching language can land on a tense the other one does not have.
      if (!tenses.some((t) => t.id === lgTense)) lgTense = 'present';
      const active = tenses.filter((t) => t.id === lgTense)[0] || tenses[0];

      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🗣 Conjugation trainer</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Five tenses. Stem-changing verbs, irregular yo forms and both -ir families — offline, no waiting.</p>
        <div class="fsh-field" style="flex-wrap:wrap"><div class="fsh-seg" id="lgSeg"><button type="button" data-l="es" class="${lgLang === 'es' ? 'active' : ''}">🇪🇸 Spanish</button><button type="button" data-l="fr" class="${lgLang === 'fr' ? 'active' : ''}">🇫🇷 French</button></div>
        <input id="lgVerb" class="fsh-input" value="${sample}" spellcheck="false" autocapitalize="off" autocorrect="off"><button type="button" class="fsh-btn" id="lgGo">Conjugate</button></div>
        <div class="fsh-seg" id="lgTenseSeg" style="margin-top:10px">${tenses.map((t) => `<button type="button" data-t="${esc(t.id)}" class="${t.id === lgTense ? 'active' : ''}">${esc(t.name)}</button>`).join('')}</div>
        <div class="fsh-note" style="margin-top:8px">${esc(active.hint)}</div>
        <div class="fsh-out" id="lgOut"></div></div>`;

      const run = () => {
        const o = document.getElementById('lgOut');
        try {
          const r = ENG().conjugate(lgLang, document.getElementById('lgVerb').value, lgTense);
          o.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${r.pronouns.map((p, i) => `<tr><th style="text-align:left">${esc(p)}</th><td style="background:rgba(54,197,214,.14);color:var(--fsh-ink);font-weight:640">${esc(r.forms[i])}</td></tr>`).join('')}</tbody></table><div class="fsh-note">${esc(r.note)}</div>`;
        } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; }
      };
      document.getElementById('lgSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; lgLang = b.dataset.l; renderConj(body); });
      /* Re-render rather than just re-run: the active pill and the hint change
         too. The typed verb is carried across so switching tense doesn't throw
         away what you were looking at. */
      document.getElementById('lgTenseSeg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        const typed = document.getElementById('lgVerb').value;
        lgTense = b.dataset.t;
        renderConj(body);
        const inp = document.getElementById('lgVerb');
        if (inp && typed) { inp.value = typed; }
        const o = document.getElementById('lgOut');
        try {
          const r = ENG().conjugate(lgLang, typed, lgTense);
          if (o) o.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${r.pronouns.map((p, i) => `<tr><th style="text-align:left">${esc(p)}</th><td style="background:rgba(54,197,214,.14);color:var(--fsh-ink);font-weight:640">${esc(r.forms[i])}</td></tr>`).join('')}</tbody></table><div class="fsh-note">${esc(r.note)}</div>`;
        } catch (err) { if (o) o.innerHTML = `<span class="fsh-err">${esc(err.message)}</span>`; }
      });
      document.getElementById('lgGo').addEventListener('click', run);
      // Enter is how anyone actually submits a one-field form.
      document.getElementById('lgVerb').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      run();
    }

    // ── IPA chart ────────────────────────────────────────────────────────────
    const IPA_C = [['p', 'pen'], ['b', 'bad'], ['t', 'top'], ['d', 'dog'], ['k', 'cat'], ['g', 'go'], ['m', 'man'], ['n', 'no'], ['ŋ', 'sing'], ['f', 'fan'], ['v', 'van'], ['θ', 'think'], ['ð', 'this'], ['s', 'see'], ['z', 'zoo'], ['ʃ', 'she'], ['ʒ', 'vision'], ['h', 'hat'], ['l', 'let'], ['r', 'run'], ['j', 'yes'], ['w', 'we'], ['tʃ', 'chair'], ['dʒ', 'jump']];
    const IPA_V = [['iː', 'see'], ['ɪ', 'sit'], ['e', 'bed'], ['æ', 'cat'], ['ɑː', 'car'], ['ɒ', 'hot'], ['ɔː', 'saw'], ['ʊ', 'put'], ['uː', 'too'], ['ʌ', 'cup'], ['ə', 'about'], ['ɜː', 'bird']];
    function renderIPA(body) {
      const grid = (arr) => `<div class="fsh-ion-grid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">${arr.map((x) => `<div class="fsh-ion"><span class="f" style="font-size:18px">${esc(x[0])}</span><div class="n">${esc(x[1])}</div></div>`).join('')}</div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Ƃ IPA chart</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Common English phonemes with example words.</p>
        <div class="fsh-label"><span>Consonants</span></div>${grid(IPA_C)}<div class="fsh-label" style="margin-top:14px"><span>Vowels</span></div>${grid(IPA_V)}</div>`;
    }

    // ── Common phrases ───────────────────────────────────────────────────────
    /* Grouped rather than one flat list of ten. The old table was a greeting
       card: hello, goodbye, thank you. None of it helps in the lesson you are
       actually sitting in, which is where classroom language and the "I need
       to say something and don't know how" rows come in. */
    const PHRASE_GROUPS = [
      ['Greetings', [
        ['Hello', 'Hola', 'Bonjour'],
        ['Good morning', 'Buenos días', 'Bonjour'],
        ['Good evening', 'Buenas noches', 'Bonsoir'],
        ['Goodbye', 'Adiós', 'Au revoir'],
        ['See you tomorrow', 'Hasta mañana', 'À demain'],
        ['How are you?', '¿Cómo estás?', 'Comment ça va ?'],
        ['I am well, thanks', 'Estoy bien, gracias', 'Ça va bien, merci'],
        ['Nice to meet you', 'Mucho gusto', 'Enchanté(e)'],
      ]],
      ['Courtesy', [
        ['Please', 'Por favor', "S'il vous plaît"],
        ['Thank you', 'Gracias', 'Merci'],
        ["You're welcome", 'De nada', 'De rien'],
        ['Excuse me', 'Perdón', 'Excusez-moi'],
        ['I am sorry', 'Lo siento', 'Je suis désolé(e)'],
        ['Yes / No', 'Sí / No', 'Oui / Non'],
      ]],
      ['About you', [
        ['My name is…', 'Me llamo…', "Je m'appelle…"],
        ['I am … years old', 'Tengo … años', "J'ai … ans"],
        ['I am from…', 'Soy de…', 'Je viens de…'],
        ['I live in…', 'Vivo en…', "J'habite à…"],
        ['I have a brother / sister', 'Tengo un hermano / una hermana', "J'ai un frère / une sœur"],
        ['I like…', 'Me gusta…', "J'aime…"],
        ["I don't like…", 'No me gusta…', "Je n'aime pas…"],
      ]],
      ['In class', [
        ['I have a question', 'Tengo una pregunta', "J'ai une question"],
        ['How do you say … ?', '¿Cómo se dice … ?', 'Comment dit-on … ?'],
        ['What does … mean?', '¿Qué significa … ?', 'Que veut dire … ?'],
        ['Could you repeat that?', '¿Puede repetir?', 'Pouvez-vous répéter ?'],
        ['More slowly, please', 'Más despacio, por favor', "Plus lentement, s'il vous plaît"],
        ["I don't understand", 'No entiendo', 'Je ne comprends pas'],
        ["I don't know", 'No sé', 'Je ne sais pas'],
        ['May I go to the toilet?', '¿Puedo ir al baño?', 'Puis-je aller aux toilettes ?'],
        ['When is it due?', '¿Para cuándo es?', "C'est pour quand ?"],
        ['I forgot my homework', 'Olvidé mi tarea', "J'ai oublié mes devoirs"],
      ]],
      ['Out and about', [
        ['Where is…?', '¿Dónde está…?', 'Où est…?'],
        ['How much is it?', '¿Cuánto cuesta?', "Combien ça coûte ?"],
        ['I would like…', 'Quisiera…', 'Je voudrais…'],
        ['The bill, please', 'La cuenta, por favor', "L'addition, s'il vous plaît"],
        ['I need help', 'Necesito ayuda', "J'ai besoin d'aide"],
        ['Do you speak English?', '¿Habla inglés?', 'Parlez-vous anglais ?'],
        ['What time is it?', '¿Qué hora es?', "Quelle heure est-il ?"],
      ]],
      ['Question words', [
        ['Who', 'Quién', 'Qui'],
        ['What', 'Qué', 'Quoi / Que'],
        ['When', 'Cuándo', 'Quand'],
        ['Where', 'Dónde', 'Où'],
        ['Why', 'Por qué', 'Pourquoi'],
        ['How', 'Cómo', 'Comment'],
        ['How many', 'Cuántos', 'Combien'],
        ['Which', 'Cuál', 'Quel / Quelle'],
      ]],
    ];

    function renderPhrases(body) {
      const table = (rows) => `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:420px"><thead><tr><th style="text-align:left">English</th><th>🇪🇸 Spanish</th><th>🇫🇷 French</th></tr></thead><tbody>${rows.map((p) => `<tr><th style="text-align:left">${esc(p[0])}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(p[1])}</td><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(p[2])}</td></tr>`).join('')}</tbody></table></div>`;
      const count = PHRASE_GROUPS.reduce((n, g) => n + g[1].length, 0);
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Common phrases</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${count} phrases in Spanish and French, grouped by when you'd need them.</p>
        ${PHRASE_GROUPS.map((g, i) => `<div class="fsh-label"${i ? ' style="margin-top:16px"' : ''}><span>${esc(g[0])}</span></div>${table(g[1])}`).join('')}</div>`;
    }

    H.register('languages', [
      {
        id: 'conj', name: 'Conjugation', icon: '🗣',
        desc: 'conjugation spanish french verbs present preterite imperfect future conditional tense',
        render: renderConj,
        ai: {
          name: 'conjugate',
          description: 'Conjugate a verb. Arg: "hablar es preterite" or "partir fr". Tense is optional and defaults to present.',
          params: { verb: 'string', lang: 'es|fr', tense: 'present|preterite|imperfect|future|conditional|passeCompose' },
          run: (a) => {
            const m = String(a).trim().split(/\s+/);
            const r = ENG().conjugate((m[1] || 'es').toLowerCase(), m[0], (m[2] || 'present'));
            return r.pronouns.map((p, i) => p + ' ' + r.forms[i]).concat(['(' + r.note + ')']);
          },
        },
      },
      { id: 'ipa', name: 'IPA chart', icon: 'Ƃ', desc: 'ipa phonetic alphabet pronunciation sounds', render: renderIPA },
      { id: 'phrases', name: 'Phrases', icon: '💬', desc: 'common phrases spanish french vocabulary', render: renderPhrases },
    ]);
  }
  boot();
})();
