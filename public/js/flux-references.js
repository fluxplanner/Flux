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
    music:    [/\bmusic\b/i, /orchestra/i, /\bchoir\b/i, /concert\s+band/i, /ib\s*music/i],
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
    /* No conjugators here. They lived in their own modal with their own verb
       tables, a click away from the engine-backed conjugator in Study Tools,
       and two tables for one language is how a wrong form survives a fix.
       Languages are a Study Tools subject now: Languages → French / German /
       Spanish → Conjugator. */
    { id:'cs-ref', emoji:'💻', name:'CS Reference', desc:'Binary/hex, ASCII, Big-O, logic gates.', subjects:['cs','math'], fn:'openCSReference', shortcut:'X' },
  ];

  function openToolboxTool(subjectId, toolId){
    try{
      if (typeof window.activateStudyTool === 'function') window.activateStudyTool(subjectId, toolId);
      if (typeof window.nav === 'function') window.nav('toolbox');
      setTimeout(() => {
        if (typeof window.renderToolbox === 'function') window.renderToolbox();
      }, 30);
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
  }catch(e){}

  ['openMathFormulas','openChemReference','openCodonTable','openHistoryMap',
    'openUnitConverter','openCSReference'
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
