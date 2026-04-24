/* ════════════════════════════════════════════════════════════════════════
   FLUX · References panel (tools organized by class)
   ------------------------------------------------------------------------
   • Reads classes from window.classes (user's saved classes)
   • Maps each tool to one or more subjects
   • Horizontal class chip filter + search bar
   • Renders tool cards with emoji, name, description, subject tag, Open btn
   • Registers global open* functions (stubs that a tool module fills later)
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const SUBJECT_KEYWORDS = {
    math:     [/math/i, /calc(ulus)?/i, /alg(ebra)?/i, /statistic/i, /geometr/i, /precalc/i, /trig/i],
    physics:  [/physics/i],
    chem:     [/chem/i],
    bio:      [/bio/i, /anatomy/i, /genetics/i, /zoology/i],
    history:  [/history/i, /social\s*studies?/i, /civics/i, /government/i, /economics/i],
    spanish:  [/spanish|espan/i],
    french:   [/french|franca/i],
    cs:       [/computer|coding|programm|cs\b|informatics/i],
  };

  function classifyClass(name){
    const n = String(name || '');
    const tags = [];
    for(const [tag, patterns] of Object.entries(SUBJECT_KEYWORDS)){
      if(patterns.some(re => re.test(n))) tags.push(tag);
    }
    return tags;
  }

  // Tools registry. Each tool can belong to multiple subjects.
  // The handler is resolved from window at click time so tool files can be
  // loaded after this module without ordering issues.
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

  // State
  let state = {
    activeClassKey: localStorage.getItem('flux_ref_class') || 'all',
    query: '',
  };

  function getUserClasses(){
    const cl = Array.isArray(window.classes) ? window.classes : [];
    // Build unique list with classification tags
    const out = [];
    cl.forEach(c => {
      if(!c || !c.name) return;
      const tags = classifyClass(c.name);
      out.push({ id: String(c.id), name: c.name, color: c.color || 'var(--accent)', tags });
    });
    return out;
  }

  // Build the set of subject tags that should match the user's classes.
  // Always include 'all' as a universal bucket.
  function activeSubjectTags(){
    if(state.activeClassKey === 'all') return null;
    const cls = getUserClasses().find(c => c.id === state.activeClassKey);
    if(!cls) return null;
    if(!cls.tags.length) return []; // class with no recognized subject → no tools
    return cls.tags;
  }

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function renderChips(){
    const wrap = document.getElementById('refClassChips');
    if(!wrap) return;
    const cls = getUserClasses();
    const mkChip = (key, label, color) => {
      const active = state.activeClassKey === key ? ' on' : '';
      const col = color ? `style="--chip-col:${esc(color)}"` : '';
      return `<button type="button" class="ref-chip${active}" data-class="${esc(key)}" ${col} role="tab" aria-selected="${state.activeClassKey===key}">${esc(label)}</button>`;
    };
    const parts = [ mkChip('all', 'All') ];
    cls.forEach(c => parts.push(mkChip(c.id, c.name, c.color)));
    wrap.innerHTML = parts.join('');
    wrap.querySelectorAll('.ref-chip').forEach(el => {
      el.addEventListener('click', () => {
        state.activeClassKey = el.getAttribute('data-class') || 'all';
        localStorage.setItem('flux_ref_class', state.activeClassKey);
        renderChips();
        renderGrid();
      });
    });
  }

  function filterTools(){
    const tags = activeSubjectTags();
    const q = state.query.trim().toLowerCase();
    return TOOLS.filter(t => {
      // Class filter — if tags is null, include everything; otherwise match
      let subjOk = true;
      if(tags !== null){
        // tool shows if it shares a subject tag OR has 'all'
        subjOk = t.subjects.includes('all') || t.subjects.some(s => tags.includes(s));
      }
      if(!subjOk) return false;
      if(!q) return true;
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    });
  }

  function subjectPill(key){
    const map = {
      math:'Math', physics:'Physics', chem:'Chemistry', bio:'Biology',
      history:'History', spanish:'Spanish', french:'French', cs:'CS', all:'Any'
    };
    return map[key] || key;
  }

  function renderGrid(){
    const wrap = document.getElementById('refGrid');
    if(!wrap) return;
    const tools = filterTools();
    if(!tools.length){
      wrap.innerHTML = `<div class="ref-empty">No tools for this class yet. Try selecting <strong>All</strong>.</div>`;
      return;
    }
    wrap.innerHTML = tools.map(t => {
      const tags = t.subjects.filter(s => s !== 'all').map(s => `<span class="ref-tag">${esc(subjectPill(s))}</span>`).join('');
      const shortcut = t.shortcut ? `<span class="ref-shortcut" aria-label="Shortcut ${esc(t.shortcut)}">${esc(t.shortcut)}</span>` : '';
      return `<article class="ref-card" data-tool="${esc(t.id)}" data-fn="${esc(t.fn)}">
        <div class="ref-card-head">
          <span class="ref-emoji" aria-hidden="true">${t.emoji}</span>
          ${shortcut}
        </div>
        <div class="ref-card-name">${esc(t.name)}</div>
        <div class="ref-card-desc">${esc(t.desc)}</div>
        <div class="ref-card-tags">${tags}</div>
        <button type="button" class="ref-card-open">Open</button>
      </article>`;
    }).join('');
    wrap.querySelectorAll('.ref-card').forEach(card => {
      const fn = card.getAttribute('data-fn');
      const open = () => {
        const handler = fn && window[fn];
        if(typeof handler === 'function'){
          try{ handler(); } catch(e){ console.error('[refs] tool error', e); }
        } else {
          if(typeof window.showToast === 'function') window.showToast('This tool is coming soon','info');
        }
      };
      card.addEventListener('click', (e) => {
        if(e.target.closest('.ref-card-open, .ref-emoji, .ref-card-name, .ref-card-desc, .ref-card')) open();
      });
    });
  }

  function bindSearch(){
    const input = document.getElementById('refSearchInput');
    if(!input) return;
    input.addEventListener('input', () => {
      state.query = input.value;
      renderGrid();
    });
  }

  function mount(){
    if(!document.getElementById('references')) return;
    renderChips();
    renderGrid();
    bindSearch();
  }

  // Re-render when user navigates to panel (classes may have been edited)
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(mount, 300);
    // Hook into nav() via a small wrapper
    const origNav = window.nav;
    if(typeof origNav === 'function'){
      window.nav = function(id){
        const r = origNav.apply(this, arguments);
        if(id === 'references'){ setTimeout(mount, 30); }
        return r;
      };
    }
    const origNavMob = window.navMob;
    if(typeof origNavMob === 'function'){
      window.navMob = function(id){
        const r = origNavMob.apply(this, arguments);
        if(id === 'references'){ setTimeout(mount, 30); }
        return r;
      };
    }
  });

  // Helper used by Periodic Table + Physics Sandbox cards: navigate to
  // the Toolbox panel and activate the right tool via internal state.
  function openToolboxTool(subjectId, toolId){
    try{
      if(window.fluxToolbox && window.fluxToolbox.state){
        window.fluxToolbox.state.subject = subjectId;
        window.fluxToolbox.state.tool = toolId;
      }
      if(typeof window.nav === 'function') window.nav('toolbox');
      setTimeout(() => {
        if(typeof window.renderToolbox === 'function') window.renderToolbox();
      }, 50);
    }catch(e){ console.warn(e); }
  }
  try{
    // Stubs used by the References panel cards — only define if not already global
    if(typeof window.openPeriodicTableModal !== 'function'){
      window.openPeriodicTableModal = () => openToolboxTool('science', 'periodic-tbl');
    }
    if(typeof window.openPhysicsSandbox !== 'function'){
      window.openPhysicsSandbox = () => openToolboxTool('science', 'formulas-sci');
    }
  }catch(e){}

  // Expose mount for manual refresh
  try{ window.fluxRefsMount = mount; window.fluxRefsTools = TOOLS; window.fluxRefsClassify = classifyClass; }catch(e){}

  // Stubs for tools that will be filled by tool-specific modules.
  // These only run if the real module hasn't registered its own function yet.
  ['openMathFormulas','openChemReference','openCodonTable','openHistoryMap',
   'openSpanishConjugator','openFrenchConjugator','openUnitConverter','openCSReference'
  ].forEach(name => {
    if(typeof window[name] !== 'function'){
      window[name] = function(){
        if(typeof window.showToast === 'function') window.showToast(name.replace('open','') + ' is coming soon', 'info');
      };
    }
  });

  // Keyboard shortcuts: M / H / U / X when no input focused
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if(k === 'm' && typeof window.openMathFormulas === 'function'){ e.preventDefault(); window.openMathFormulas(); }
    else if(k === 'h' && typeof window.openChemReference === 'function'){ e.preventDefault(); window.openChemReference(); }
    else if(k === 'u' && typeof window.openUnitConverter === 'function'){ e.preventDefault(); window.openUnitConverter(); }
    else if(k === 'x' && typeof window.openCSReference === 'function'){ e.preventDefault(); window.openCSReference(); }
  });
})();
