/* Chemistry Reference — polyatomic ions, solubility, acids/bases, constants */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  const POLYATOMIC = [
    { name:'Acetate',       formula:'C₂H₃O₂', charge:-1 },
    { name:'Ammonium',      formula:'NH₄',    charge:+1 },
    { name:'Azide',         formula:'N₃',     charge:-1 },
    { name:'Bicarbonate',   formula:'HCO₃',   charge:-1 },
    { name:'Bisulfate',     formula:'HSO₄',   charge:-1 },
    { name:'Carbonate',     formula:'CO₃',    charge:-2 },
    { name:'Chlorate',      formula:'ClO₃',   charge:-1 },
    { name:'Chlorite',      formula:'ClO₂',   charge:-1 },
    { name:'Chromate',      formula:'CrO₄',   charge:-2 },
    { name:'Cyanide',       formula:'CN',     charge:-1 },
    { name:'Dichromate',    formula:'Cr₂O₇',  charge:-2 },
    { name:'Hydroxide',     formula:'OH',     charge:-1 },
    { name:'Hypochlorite',  formula:'ClO',    charge:-1 },
    { name:'Iodate',        formula:'IO₃',    charge:-1 },
    { name:'Nitrate',       formula:'NO₃',    charge:-1 },
    { name:'Nitrite',       formula:'NO₂',    charge:-1 },
    { name:'Oxalate',       formula:'C₂O₄',   charge:-2 },
    { name:'Perchlorate',   formula:'ClO₄',   charge:-1 },
    { name:'Permanganate',  formula:'MnO₄',   charge:-1 },
    { name:'Peroxide',      formula:'O₂',     charge:-2 },
    { name:'Phosphate',     formula:'PO₄',    charge:-3 },
    { name:'Phosphite',     formula:'PO₃',    charge:-3 },
    { name:'Silicate',      formula:'SiO₃',   charge:-2 },
    { name:'Sulfate',       formula:'SO₄',    charge:-2 },
    { name:'Sulfite',       formula:'SO₃',    charge:-2 },
    { name:'Thiocyanate',   formula:'SCN',    charge:-1 },
    { name:'Thiosulfate',   formula:'S₂O₃',   charge:-2 },
    { name:'Hydronium',     formula:'H₃O',    charge:+1 },
  ];

  const SOLUBILITY = [
    { type:'sol', rule:'All Group 1 (alkali metal) compounds and NH₄⁺ salts',  exceptions:[] },
    { type:'sol', rule:'All nitrate (NO₃⁻), acetate (C₂H₃O₂⁻), chlorate (ClO₃⁻), perchlorate (ClO₄⁻) salts', exceptions:[] },
    { type:'sol', rule:'Most halide salts (Cl⁻, Br⁻, I⁻)', exceptions:['AgCl, AgBr, AgI — insoluble','PbCl₂, PbBr₂, PbI₂ — insoluble','Hg₂Cl₂, Hg₂Br₂, Hg₂I₂ — insoluble'] },
    { type:'sol', rule:'Most sulfate (SO₄²⁻) salts', exceptions:['BaSO₄, PbSO₄, SrSO₄, CaSO₄, Hg₂SO₄, Ag₂SO₄ — insoluble or slightly soluble'] },
    { type:'insol', rule:'Most hydroxide (OH⁻) salts', exceptions:['Group 1 & NH₄⁺ hydroxides — soluble','Ba(OH)₂, Sr(OH)₂, Ca(OH)₂ — slightly soluble'] },
    { type:'insol', rule:'Most sulfide (S²⁻) salts', exceptions:['Group 1, Group 2, and NH₄⁺ sulfides — soluble'] },
    { type:'insol', rule:'Most carbonate (CO₃²⁻), phosphate (PO₄³⁻), sulfite (SO₃²⁻), chromate (CrO₄²⁻) salts', exceptions:['Group 1 & NH₄⁺ salts — soluble'] },
    { type:'insol', rule:'Most oxide (O²⁻) and most fluoride (F⁻) salts', exceptions:['Group 1 oxides & fluorides — soluble'] },
  ];

  const STRONG_ACIDS = ['HCl (hydrochloric)','HBr (hydrobromic)','HI (hydroiodic)','HNO₃ (nitric)','H₂SO₄ (sulfuric)','HClO₄ (perchloric)','HClO₃ (chloric)'];
  const STRONG_BASES = ['LiOH, NaOH, KOH, RbOH, CsOH (Group 1 hydroxides)','Ca(OH)₂, Sr(OH)₂, Ba(OH)₂ (Group 2 heavy hydroxides)'];

  const PH_COLORS = [
    '#d32f2f','#e53935','#ef5350','#f57c00','#ff9800','#ffb300','#ffc107',
    '#9ccc65','#66bb6a','#26a69a','#29b6f6','#5c6bc0','#7e57c2','#8e24aa','#6a1b9a'
  ];

  const CONSTANTS = [
    { name:'Avogadro\'s number', val:'6.02214076 × 10²³ mol⁻¹' },
    { name:'Gas constant R', val:'8.314 J/(mol·K) = 0.0821 L·atm/(mol·K)' },
    { name:'Boltzmann constant', val:'1.380649 × 10⁻²³ J/K' },
    { name:'Faraday constant', val:'96,485 C/mol' },
    { name:'Speed of light', val:'2.998 × 10⁸ m/s' },
    { name:'Planck constant', val:'6.626 × 10⁻³⁴ J·s' },
    { name:'Electron charge', val:'1.602 × 10⁻¹⁹ C' },
    { name:'Electron mass', val:'9.109 × 10⁻³¹ kg' },
    { name:'Proton mass', val:'1.673 × 10⁻²⁷ kg' },
    { name:'Neutron mass', val:'1.675 × 10⁻²⁷ kg' },
    { name:'Standard atm pressure', val:'101,325 Pa = 1 atm = 760 mmHg' },
    { name:'Molar volume (STP)', val:'22.414 L/mol' },
    { name:'Water Kw', val:'1.0 × 10⁻¹⁴ at 25°C' },
    { name:'H₂O density (25°C)', val:'0.997 g/mL' },
  ];

  function chargeBadge(c){
    const cls = c < 0 ? 'ref-badge ref-badge--neg' : (c > 0 ? 'ref-badge ref-badge--pos' : 'ref-badge ref-badge--neu');
    const sign = c > 0 ? '+' + c : c;
    return `<span class="${cls}">${sign}</span>`;
  }

  function renderPolyatomic(body){
    const q = (document.getElementById('refChemSearch')?.value || '').toLowerCase();
    const filtered = q ? POLYATOMIC.filter(p => p.name.toLowerCase().includes(q) || p.formula.toLowerCase().includes(q)) : POLYATOMIC;
    body.innerHTML = `
      <div class="ref-inner-search"><input type="search" id="refChemSearch" class="ref-search-input" placeholder="Search ions…" value="${esc(q)}"></div>
      <div style="overflow-x:auto">
        <table class="ref-table">
          <thead><tr><th>Name</th><th>Formula</th><th>Charge</th></tr></thead>
          <tbody>
            ${filtered.map(p => `<tr>
              <td><strong>${esc(p.name)}</strong></td>
              <td style="font-family:'JetBrains Mono',monospace">${esc(p.formula)}<sup>${p.charge<0?'−'+Math.abs(p.charge):'+'+p.charge}</sup></td>
              <td>${chargeBadge(p.charge)}</td>
            </tr>`).join('')}
            ${!filtered.length ? '<tr><td colspan="3" style="padding:24px;text-align:center;color:var(--muted)">No ions match.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
    const inp = body.querySelector('#refChemSearch');
    if(inp){
      inp.addEventListener('input', () => renderPolyatomic(body));
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    }
  }

  function renderSolubility(body){
    body.innerHTML = `
      <h3 style="margin:0 0 12px;font-size:1rem">Solubility rules</h3>
      ${SOLUBILITY.map((s,i) => `
        <div class="ref-sol-row ref-sol-row--${s.type==='sol'?'sol':'insol'}" data-idx="${i}">
          <div class="ref-sol-rule">${s.type==='sol'?'✓ Soluble — ':'✗ Insoluble — '}${esc(s.rule)}</div>
          ${s.exceptions.length ? `<button type="button" class="ref-conj-chip" style="margin-top:6px" data-toggle="${i}">${s.exceptions.length} exception${s.exceptions.length>1?'s':''}</button>
            <div class="ref-sol-exc-wrap" id="refSolExc${i}" style="display:none;margin-top:8px">${s.exceptions.map(e=>`<div class="ref-sol-exc">⚠︎ ${esc(e)}</div>`).join('')}</div>` : ''}
        </div>
      `).join('')}
    `;
    body.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById('refSolExc' + btn.dataset.toggle);
        if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
      });
    });
  }

  function renderAcidBase(body){
    const phBar = PH_COLORS.map((c, i) => `<div style="background:${c}">${i}</div>`).join('');
    body.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:1rem">pH scale (0 – 14)</h3>
      <div class="ref-ph-bar">${phBar}</div>
      <div class="ref-ph-legend"><span>Strong acid</span><span>Neutral (7)</span><span>Strong base</span></div>

      <div class="ref-formula-grid">
        <div class="ref-formula-card">
          <div class="ref-formula-name">Strong acids (fully dissociate)</div>
          <div style="font-size:.88rem;line-height:1.7;color:var(--muted2)">${STRONG_ACIDS.map(a => `<div>${esc(a)}</div>`).join('')}</div>
        </div>
        <div class="ref-formula-card">
          <div class="ref-formula-name">Strong bases</div>
          <div style="font-size:.88rem;line-height:1.7;color:var(--muted2)">${STRONG_BASES.map(a => `<div>${esc(a)}</div>`).join('')}</div>
        </div>
        <div class="ref-formula-card">
          <div class="ref-formula-name">Key equations</div>
          <pre class="ref-formula-eq">pH = −log[H⁺]
pOH = −log[OH⁻]
pH + pOH = 14
Kw = [H⁺][OH⁻] = 1.0×10⁻¹⁴</pre>
        </div>
        <div class="ref-formula-card">
          <div class="ref-formula-name">Henderson–Hasselbalch</div>
          <pre class="ref-formula-eq">pH = pKa + log([A⁻]/[HA])</pre>
          <div class="ref-formula-vars">For buffer solutions</div>
        </div>
      </div>
    `;
  }

  function renderConstants(body){
    body.innerHTML = `
      ${CONSTANTS.map(c => `
        <div class="ref-const-row">
          <div class="ref-const-name">${esc(c.name)}</div>
          <div class="ref-const-value">${esc(c.val)}</div>
          <button type="button" class="ref-const-copy" data-copy="${esc(c.val)}">Copy</button>
        </div>
      `).join('')}
    `;
    body.querySelectorAll('.ref-const-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        try{
          await navigator.clipboard.writeText(btn.dataset.copy || '');
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = 'Copy', 1200);
        }catch(e){
          btn.textContent = '—';
        }
      });
    });
  }

  function openChemReference(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'chem-reference',
      emoji: '⚗️',
      title: 'Chemistry Reference',
      tabs: [
        { id:'poly', label:'Polyatomic Ions' },
        { id:'sol',  label:'Solubility Rules' },
        { id:'acid', label:'Acid / Base' },
        { id:'const',label:'Constants' },
      ],
      renderBody: (body, tabId) => {
        if(tabId === 'poly') renderPolyatomic(body);
        else if(tabId === 'sol') renderSolubility(body);
        else if(tabId === 'acid') renderAcidBase(body);
        else if(tabId === 'const') renderConstants(body);
      },
    });
  }

  try{ window.openChemReference = openChemReference; }catch(e){}
})();
