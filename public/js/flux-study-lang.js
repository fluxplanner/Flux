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

    const PRON = { es: ['yo', 'tú', 'él/ella', 'nosotros', 'vosotros', 'ellos'], fr: ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils'] };
    const REG = {
      es: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
      fr: { er: ['e', 'es', 'e', 'ons', 'ez', 'ent'], ir: ['is', 'is', 'it', 'issons', 'issez', 'issent'], re: ['s', 's', '', 'ons', 'ez', 'ent'] },
    };
    const IRREG = {
      es: { ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'] },
      fr: { 'être': ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], avoir: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], aller: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], faire: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'] },
    };
    function conjugate(lang, verb) {
      lang = lang === 'fr' ? 'fr' : 'es'; verb = String(verb).trim().toLowerCase();
      if (IRREG[lang][verb]) return { forms: IRREG[lang][verb], note: 'irregular' };
      const end = verb.slice(-2); const stem = verb.slice(0, -2);
      const set = REG[lang][end]; if (!set) throw new Error('Use a verb ending in ' + Object.keys(REG[lang]).join('/'));
      return { forms: set.map((e) => stem + e), note: 'regular -' + end };
    }
    let lgLang = 'es';
    function renderConj(body) {
      const sample = lgLang === 'es' ? 'hablar' : 'parler';
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🗣 Conjugation trainer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Present tense. Regular ${lgLang === 'es' ? '-ar/-er/-ir' : '-er/-ir/-re'} verbs + common irregulars.</p>
        <div class="fsh-field" style="flex-wrap:wrap"><div class="fsh-seg" id="lgSeg"><button type="button" data-l="es" class="${lgLang === 'es' ? 'active' : ''}">🇪🇸 Spanish</button><button type="button" data-l="fr" class="${lgLang === 'fr' ? 'active' : ''}">🇫🇷 French</button></div>
        <input id="lgVerb" class="fsh-input" value="${sample}" spellcheck="false"><button type="button" class="fsh-btn" id="lgGo">Conjugate</button></div>
        <div class="fsh-out" id="lgOut"></div></div>`;
      const run = () => { const o = document.getElementById('lgOut'); try { const r = conjugate(lgLang, document.getElementById('lgVerb').value); o.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${PRON[lgLang].map((p, i) => `<tr><th style="text-align:left">${esc(p)}</th><td style="background:rgba(54,197,214,.14);color:var(--fsh-ink);font-weight:640">${esc(r.forms[i])}</td></tr>`).join('')}</tbody></table><div class="fsh-note">${esc(r.note)}</div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } };
      document.getElementById('lgSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; lgLang = b.dataset.l; renderConj(body); });
      document.getElementById('lgGo').addEventListener('click', run); run();
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
    const PHRASES = [['Hello', 'Hola', 'Bonjour'], ['Goodbye', 'Adiós', 'Au revoir'], ['Please', 'Por favor', "S'il vous plaît"], ['Thank you', 'Gracias', 'Merci'], ['Yes / No', 'Sí / No', 'Oui / Non'], ['Excuse me', 'Perdón', 'Excusez-moi'], ['How are you?', '¿Cómo estás?', 'Comment ça va?'], ['My name is…', 'Me llamo…', "Je m'appelle…"], ["I don't understand", 'No entiendo', 'Je ne comprends pas'], ['Where is…?', '¿Dónde está…?', 'Où est…?']];
    function renderPhrases(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">💬 Common phrases</h3><div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:420px"><thead><tr><th style="text-align:left">English</th><th>🇪🇸 Spanish</th><th>🇫🇷 French</th></tr></thead><tbody>${PHRASES.map((p) => `<tr><th style="text-align:left">${esc(p[0])}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(p[1])}</td><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(p[2])}</td></tr>`).join('')}</tbody></table></div></div>`; }

    H.register('languages', [
      { id: 'conj', name: 'Conjugation', icon: '🗣', desc: 'conjugation spanish french verbs present tense', render: renderConj, ai: { name: 'conjugate', description: 'Conjugate a verb (present). Arg: "hablar es" or "parler fr".', params: { verb: 'string', lang: 'es|fr' }, run: (a) => { const m = String(a).trim().split(/\s+/); const lang = (m[1] || 'es').toLowerCase(); const r = conjugate(lang, m[0]); const pr = PRON[lang === 'fr' ? 'fr' : 'es']; return pr.map((p, i) => p + ' ' + r.forms[i]); } } },
      { id: 'ipa', name: 'IPA chart', icon: 'Ƃ', desc: 'ipa phonetic alphabet pronunciation sounds', render: renderIPA },
      { id: 'phrases', name: 'Phrases', icon: '💬', desc: 'common phrases spanish french vocabulary', render: renderPhrases },
    ]);
  }
  boot();
})();
