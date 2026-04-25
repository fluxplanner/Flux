/* ════════════════════════════════════════════════════════════════════════
   FLUX · Study tools registry & class → subject mapping
   ------------------------------------------------------------------------
   • classifyClass() maps class names to subject tags (used by unified panel)
   • TOOLS registry for Cmd+K / search metadata parity
   • Global open* stubs until flux-reference-tools / reftool-* modules register
   • Keyboard shortcuts M / H / U / X
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const SUBJECT_KEYWORDS = {
    math:     [/math/i, /calc(ulus)?/i, /alg(ebra)?/i, /statistic/i, /geometr/i, /precalc/i, /trig/i],
    physics:  [/physics/i],
    chem:     [/chem/i],
    bio:      [/bio/i, /anatomy/i, /genetics/i, /zoology/i],
    history:  [/history/i, /social\s*studies?/i, /civics/i, /government/i, /geograph/i],
    spanish:  [/spanish|espan/i],
    french:   [/french|franca/i],
    cs:       [/computer|coding|programm|cs\b|informatics/i],
    english:  [/english/i, /literature/i, /writing/i, /ela\b/i, /language arts/i],
    econ:     [/economics/i, /business/i, /finance/i, /accounting/i, /marketing/i],
    language: [/language/i, /^latin$/i, /german/i, /italian/i, /mandarin/i, /chinese/i, /japanese/i, /korean/i, /portuguese/i, /russian/i],
  };

  function classifyClass(name){
    const n = String(name || '');
    const tags = [];
    for (const [tag, patterns] of Object.entries(SUBJECT_KEYWORDS)){
      if (patterns.some(re => re.test(n))) tags.push(tag);
    }
    return tags;
  }

  const TOOLS = [
    { id:'math-formulas', emoji:'📐', name:'Math Formula Sheet', desc:'Algebra, trig, calculus & stats quick reference.', subjects:['math','all'], fn:'openMathFormulas', shortcut:'M' },
    { id:'unit-converter', emoji:'🔁', name:'Unit Converter', desc:'Length, mass, temperature, energy, data — live conversions.', subjects:['math','physics','chem','bio','all'], fn:'openUnitConverter', shortcut:'U' },
    { id:'chem-reference', emoji:'⚗️', name:'Chemistry Reference', desc:'Polyatomic ions, solubility rules, acids & bases, constants.', subjects:['chem'], fn:'openChemReference', shortcut:'H' },
    { id:'periodic', emoji:'🧪', name:'Periodic Table', desc:'Interactive table with properties and categories.', subjects:['chem','physics'], fn:'openPeriodicTableModal' },
    { id:'codon-table', emoji:'🧬', name:'Biology Codon Table', desc:'64 codons, amino-acid lookup, color-coded by property.', subjects:['bio'], fn:'openCodonTable' },
    { id:'physics-formulas', emoji:'🪐', name:'Physics Formula Sheet', desc:'Mechanics, kinematics, energy, waves — quick reference.', subjects:['physics'], fn:'openPhysicsSandbox' },
    { id:'history-map', emoji:'🗺️', name:'History Map', desc:'Clickable world map with eras, empires, and key dates.', subjects:['history'], fn:'openHistoryMap' },
    { id:'spanish-conj', emoji:'🇪🇸', name:'Spanish Conjugator', desc:'60 high-frequency verbs across 7 tenses.', subjects:['spanish'], fn:'openSpanishConjugator' },
    { id:'french-conj', emoji:'🇫🇷', name:'French Conjugator', desc:'French tenses with passé composé aux & être flags.', subjects:['french'], fn:'openFrenchConjugator' },
    { id:'cs-ref', emoji:'💻', name:'CS Reference', desc:'Binary/hex, ASCII, Big-O, logic gates.', subjects:['cs','math'], fn:'openCSReference', shortcut:'X' },
  ];

  function fluxStudyOverlayEsc(e){
    if (e.key !== 'Escape') return;
    if (typeof window.closeFluxStudyToolOverlay === 'function') window.closeFluxStudyToolOverlay();
  }

  function closeFluxStudyToolOverlay(){
    const ov = document.getElementById('fluxStudyOverlay');
    if (!ov) return;
    document.removeEventListener('keydown', fluxStudyOverlayEsc, true);
    const body = ov.querySelector('.flux-study-ov-body');
    const periodicEl = document.getElementById('periodic');
    if (periodicEl && body && body.contains(periodicEl)){
      let stash = document.getElementById('periodicStash');
      if (!stash){
        stash = document.createElement('div');
        stash.id = 'periodicStash';
        stash.hidden = true;
        document.body.appendChild(stash);
      }
      stash.appendChild(periodicEl);
      periodicEl.hidden = true;
    }
    if (body) body.innerHTML = '';
    ov.remove();
  }

  /** secOrSub: unified section id (e.g. science) or SUBJECTS id; chipOrTid: unified chip id or SUBJECTS tool id */
  function openToolboxTool(secOrSub, chipOrTid){
    try{
      let subjectId = secOrSub;
      let toolId = chipOrTid;
      const layout = window.fluxToolbox && window.fluxToolbox.UNIFIED_LAYOUT;
      if (layout && secOrSub && chipOrTid){
        const sec = layout.find(s => s.id === secOrSub);
        const chip = sec && sec.tools.find(t => t.id === chipOrTid);
        if (chip && chip.mode === 'inline'){
          subjectId = chip.sub;
          toolId = chip.tid;
        }
      }
      if (typeof window.activateStudyTool === 'function') window.activateStudyTool(subjectId, toolId);
      closeFluxStudyToolOverlay();
      const rtb = window.fluxToolbox && typeof window.fluxToolbox.renderToolIntoBody === 'function';
      if (!rtb){
        if (typeof window.showToast === 'function') window.showToast('Study tools are still loading — try again in a moment.', 'info');
        return;
      }
      const ov = document.createElement('div');
      ov.id = 'fluxStudyOverlay';
      ov.className = 'ref-tool-overlay ref-overlay--wide';
      ov.innerHTML = '<div class="ref-tool-modal" role="dialog" aria-modal="true" aria-labelledby="fluxStudyOVTitle">'+
        '<div class="ref-tool-head">'+
        '<span class="ref-tool-emoji" aria-hidden="true">🧰</span>'+
        '<div class="ref-tool-title" id="fluxStudyOVTitle">Study tool</div>'+
        '<button type="button" class="ref-tool-close" aria-label="Close">✕</button>'+
        '</div>'+
        '<div class="ref-tool-body flux-study-ov-body" style="max-height:min(88vh,900px);overflow:auto;padding:12px 14px 18px"></div>'+
        '</div>';
      document.body.appendChild(ov);
      const body = ov.querySelector('.flux-study-ov-body');
      const closeBtn = ov.querySelector('.ref-tool-close');
      window.fluxToolbox.renderToolIntoBody(body, subjectId, toolId);
      const onClose = () => closeFluxStudyToolOverlay();
      if (closeBtn) closeBtn.addEventListener('click', onClose);
      ov.addEventListener('click', (e) => { if (e.target === ov) onClose(); });
      document.addEventListener('keydown', fluxStudyOverlayEsc, true);
    }catch(e){ console.warn(e); }
  }

  try{
    if (typeof window.openPeriodicTableModal !== 'function'){
      window.openPeriodicTableModal = () => openToolboxTool('science', 'periodic-tbl');
    }
    if (typeof window.openPhysicsSandbox !== 'function'){
      window.openPhysicsSandbox = () => openToolboxTool('science', 'formulas-sci');
    }
  }catch(e){}

  try{
    window.fluxRefsClassify = classifyClass;
    window.fluxRefsTools = TOOLS;
    window.openToolboxTool = openToolboxTool;
    window.closeFluxStudyToolOverlay = closeFluxStudyToolOverlay;
  }catch(e){}

  ['openMathFormulas','openChemReference','openCodonTable','openHistoryMap',
    'openSpanishConjugator','openFrenchConjugator','openUnitConverter','openCSReference'
  ].forEach(name => {
    if (typeof window[name] !== 'function'){
      window[name] = function(){
        if (typeof window.showToast === 'function') window.showToast(name.replace('open','') + ' is coming soon', 'info');
      };
    }
  });

  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'm' && typeof window.openMathFormulas === 'function'){ e.preventDefault(); window.openMathFormulas(); }
    else if (k === 'h' && typeof window.openChemReference === 'function'){ e.preventDefault(); window.openChemReference(); }
    else if (k === 'u' && typeof window.openUnitConverter === 'function'){ e.preventDefault(); window.openUnitConverter(); }
    else if (k === 'x' && typeof window.openCSReference === 'function'){ e.preventDefault(); window.openCSReference(); }
  });
})();
