/* ════════════════════════════════════════════════════════════════════════
   FLUX · Reference tools (8 tools) — all hardcoded, offline, theme-aware
   ------------------------------------------------------------------------
   Shared modal shell: creates .ref-tool-overlay + .ref-tool-modal in body,
   remembers last active tab per tool in localStorage.
   All tools expose a single global function: open<ToolName>().
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const LS_TAB = (toolId) => `flux_tool_tab_${toolId}`;

  // ─────────────────────────────────────────────────────────────────
  // Shared modal
  // ─────────────────────────────────────────────────────────────────
  function openToolModal({ id, emoji, title, tabs, renderBody, onTabChange }){
    closeToolModal();
    const overlay = document.createElement('div');
    overlay.className = 'ref-tool-overlay';
    overlay.id = 'refToolOverlay';

    const savedTab = localStorage.getItem(LS_TAB(id));
    const initialTab = (tabs && tabs.find(t => t.id === savedTab)) ? savedTab : (tabs && tabs[0] ? tabs[0].id : null);

    const tabButtons = tabs ? tabs.map(t => `<button type="button" class="ref-tool-tab ${t.id===initialTab?'active':''}" data-tab="${esc(t.id)}">${esc(t.label)}</button>`).join('') : '';

    overlay.innerHTML = `
      <div class="ref-tool-modal" role="dialog" aria-modal="true" aria-labelledby="refToolTitle">
        <div class="ref-tool-head">
          <span class="ref-tool-emoji" aria-hidden="true">${emoji || '🧩'}</span>
          <div class="ref-tool-title" id="refToolTitle">${esc(title || '')}</div>
          <button type="button" class="ref-tool-close" aria-label="Close" onclick="fluxCloseToolModal()">✕</button>
        </div>
        ${tabs ? `<div class="ref-tool-tabs" role="tablist">${tabButtons}</div>` : ''}
        <div class="ref-tool-body" id="refToolBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const body = overlay.querySelector('#refToolBody');

    const renderForTab = (tabId) => {
      if(typeof renderBody === 'function') renderBody(body, tabId);
      if(typeof onTabChange === 'function') onTabChange(tabId);
      if(tabs){
        overlay.querySelectorAll('.ref-tool-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        localStorage.setItem(LS_TAB(id), tabId);
      }
    };

    if(tabs){
      overlay.querySelectorAll('.ref-tool-tab').forEach(b => {
        b.addEventListener('click', () => renderForTab(b.dataset.tab));
      });
    }

    renderForTab(initialTab);

    // Close on overlay click (but not modal inner)
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeToolModal(); });
    // Close on Escape
    document.addEventListener('keydown', keyHandler, true);
    return overlay;
  }

  function keyHandler(e){
    if(e.key === 'Escape'){ closeToolModal(); }
  }

  function closeToolModal(){
    const ov = document.getElementById('refToolOverlay');
    if(ov){ ov.remove(); }
    document.removeEventListener('keydown', keyHandler, true);
  }

  try{ window.fluxCloseToolModal = closeToolModal; }catch(e){}

  // ─────────────────────────────────────────────────────────────────
  // TOOL 1 — Math Formula Sheet
  // ─────────────────────────────────────────────────────────────────
  const MATH_FORMULAS = {
    algebra: [
      { name:'Quadratic formula', eq:'x = (−b ± √(b² − 4ac)) / 2a', vars:'a, b, c are real; a ≠ 0', ex:'For x² + 3x − 4 = 0 → x = (−3 ± √(9+16))/2 = 1 or −4' },
      { name:'Discriminant', eq:'Δ = b² − 4ac', vars:'Δ>0: two real roots; Δ=0: one; Δ<0: complex', ex:'3x²+2x+1 → Δ = 4−12 = −8 (complex roots)' },
      { name:'Exponent laws', eq:'aᵐ·aⁿ = aᵐ⁺ⁿ   (aᵐ)ⁿ = aᵐⁿ   a⁰ = 1   a⁻ⁿ = 1/aⁿ', vars:'a ≠ 0', ex:'2³·2² = 2⁵ = 32' },
      { name:'Logarithm rules', eq:'log(ab)=log a+log b   log(a/b)=log a−log b   log(aⁿ)=n·log a', vars:'a,b > 0, base > 0 and ≠ 1', ex:'log₂(8·4) = 3+2 = 5' },
      { name:'Change of base', eq:'logₐ(x) = ln(x)/ln(a)', vars:'a, x > 0; a ≠ 1', ex:'log₂(10) = ln(10)/ln(2) ≈ 3.3219' },
      { name:'Factoring difference of squares', eq:'a² − b² = (a − b)(a + b)', vars:'any a, b', ex:'x² − 9 = (x − 3)(x + 3)' },
      { name:'Sum/difference of cubes', eq:'a³ ± b³ = (a ± b)(a² ∓ ab + b²)', vars:'any a, b', ex:'8 − 27 = (2−3)(4+6+9) = −19' },
      { name:'Arithmetic sequence', eq:'aₙ = a₁ + (n − 1)d       Sₙ = n/2 · (a₁ + aₙ)', vars:'a₁ first term, d common diff.', ex:'3, 7, 11, … S₅ = 5/2·(3+19) = 55' },
      { name:'Geometric sequence', eq:'aₙ = a₁·rⁿ⁻¹       Sₙ = a₁(1 − rⁿ)/(1 − r)', vars:'r ≠ 1; |r|<1 → S∞ = a₁/(1−r)', ex:'Sum 1+½+¼+… = 2' },
      { name:'Binomial theorem', eq:'(a + b)ⁿ = Σ C(n,k)·aⁿ⁻ᵏ·bᵏ', vars:'k = 0…n', ex:'(x+1)³ = x³+3x²+3x+1' },
      { name:'Absolute value', eq:'|x| = x if x≥0; −x if x<0', vars:'|ab|=|a||b|', ex:'|−3| = 3' },
      { name:'Distance formula', eq:'d = √((x₂−x₁)² + (y₂−y₁)²)', vars:'2-D Cartesian', ex:'(1,2)→(4,6): d = √(9+16) = 5' },
      { name:'Midpoint formula', eq:'M = ((x₁+x₂)/2, (y₁+y₂)/2)', vars:'2-D', ex:'Mid of (0,0) & (4,8) = (2,4)' },
      { name:'Slope', eq:'m = (y₂ − y₁) / (x₂ − x₁)', vars:'2-D', ex:'(1,2)→(3,8): m = 3' },
      { name:'Line (point-slope)', eq:'y − y₁ = m(x − x₁)', vars:'point (x₁,y₁), slope m', ex:'Through (1,3), m=2 → y = 2x + 1' },
    ],
    trig: [
      { name:'Pythagorean identity', eq:'sin²θ + cos²θ = 1', vars:'θ any angle', ex:'sin(30°)=½, cos(30°)=√3/2 → ¼+¾=1' },
      { name:'Other Pythag identities', eq:'1 + tan²θ = sec²θ       1 + cot²θ = csc²θ', vars:'where defined', ex:'-' },
      { name:'Angle sum', eq:'sin(α±β) = sin α cos β ± cos α sin β\ncos(α±β) = cos α cos β ∓ sin α sin β', vars:'any α, β', ex:'sin(75°) = sin(45+30) = (√6+√2)/4' },
      { name:'Double angle', eq:'sin 2θ = 2 sin θ cos θ\ncos 2θ = cos²θ − sin²θ = 1 − 2sin²θ', vars:'any θ', ex:'sin(60°) = 2·½·(√3/2) = √3/2' },
      { name:'Half angle', eq:'sin²(θ/2) = (1 − cos θ)/2       cos²(θ/2) = (1 + cos θ)/2', vars:'any θ', ex:'-' },
      { name:'Law of sines', eq:'a/sin A = b/sin B = c/sin C', vars:'sides opposite their angles', ex:'A=30°, a=5, B=45° → b = 5·sin45/sin30' },
      { name:'Law of cosines', eq:'c² = a² + b² − 2ab·cos C', vars:'any triangle', ex:'a=3, b=4, C=60° → c² = 9+16−12 = 13' },
      { name:'Unit circle — 30°', eq:'sin=½  cos=√3/2  tan=1/√3', vars:'π/6', ex:'-' },
      { name:'Unit circle — 45°', eq:'sin=cos=√2/2  tan=1', vars:'π/4', ex:'-' },
      { name:'Unit circle — 60°', eq:'sin=√3/2  cos=½  tan=√3', vars:'π/3', ex:'-' },
      { name:'Unit circle — 90°', eq:'sin=1  cos=0  tan = undefined', vars:'π/2', ex:'-' },
      { name:'Radians ↔ degrees', eq:'θ_rad = θ_deg · π/180', vars:'convert both ways', ex:'180° = π rad' },
    ],
    calculus: [
      { name:'Power rule', eq:'d/dx [xⁿ] = n·xⁿ⁻¹', vars:'n real', ex:'d/dx[x³] = 3x²' },
      { name:'Sum/diff', eq:'(f ± g)\' = f\' ± g\'', vars:'-', ex:'-' },
      { name:'Product rule', eq:'(fg)\' = f\'g + fg\'', vars:'-', ex:'d/dx[x·sin x] = sin x + x·cos x' },
      { name:'Quotient rule', eq:'(f/g)\' = (f\'g − fg\')/g²', vars:'g ≠ 0', ex:'-' },
      { name:'Chain rule', eq:'d/dx [f(g(x))] = f\'(g(x))·g\'(x)', vars:'-', ex:'d/dx[sin(x²)] = cos(x²)·2x' },
      { name:'Common derivatives', eq:'d/dx[sin x]=cos x   d/dx[cos x]=−sin x\nd/dx[tan x]=sec²x   d/dx[eˣ]=eˣ   d/dx[ln x]=1/x', vars:'-', ex:'-' },
      { name:'Fundamental Theorem (Part 1)', eq:'F(x) = ∫ₐˣ f(t) dt → F\'(x) = f(x)', vars:'f continuous', ex:'-' },
      { name:'FTC (Part 2)', eq:'∫ₐᵇ f(x) dx = F(b) − F(a)', vars:'F antiderivative of f', ex:'∫₀¹ 2x dx = x² |₀¹ = 1' },
      { name:'Integration by parts', eq:'∫ u dv = u·v − ∫ v du', vars:'choose u so du simpler', ex:'∫ x eˣ dx = x eˣ − eˣ + C' },
      { name:'Common integrals', eq:'∫ xⁿ dx = xⁿ⁺¹/(n+1)+C  (n≠−1)\n∫ 1/x dx = ln|x|+C\n∫ eˣ dx = eˣ+C\n∫ sin x dx = −cos x+C', vars:'-', ex:'-' },
      { name:'Area under curve', eq:'A = ∫ₐᵇ f(x) dx', vars:'f ≥ 0 on [a,b]', ex:'-' },
      { name:'Volume of revolution', eq:'V = π ∫ₐᵇ [f(x)]² dx', vars:'disk method', ex:'-' },
      { name:'L\'Hôpital\'s Rule', eq:'lim f/g = lim f\'/g\'  (when 0/0 or ∞/∞)', vars:'f, g differentiable', ex:'lim(x→0) sin x / x = lim cos x / 1 = 1' },
      { name:'Limit definition of derivative', eq:'f\'(x) = lim_{h→0} [f(x+h) − f(x)]/h', vars:'-', ex:'-' },
    ],
    stats: [
      { name:'Mean / average', eq:'x̄ = (Σ xᵢ) / n', vars:'xᵢ sample values', ex:'{2,4,6} → 4' },
      { name:'Variance (sample)', eq:'s² = Σ(xᵢ − x̄)² / (n − 1)', vars:'divide by n for pop.', ex:'-' },
      { name:'Standard deviation', eq:'s = √s²', vars:'-', ex:'-' },
      { name:'Z-score', eq:'z = (x − μ) / σ', vars:'μ pop mean, σ pop SD', ex:'x=85, μ=75, σ=5 → z=2' },
      { name:'Combinations', eq:'C(n,k) = n! / (k!·(n−k)!)', vars:'order doesn\'t matter', ex:'C(5,2) = 10' },
      { name:'Permutations', eq:'P(n,k) = n! / (n−k)!', vars:'order matters', ex:'P(5,2) = 20' },
      { name:'Binomial probability', eq:'P(X=k) = C(n,k)·pᵏ·(1−p)ⁿ⁻ᵏ', vars:'n trials, prob p', ex:'n=5, k=3, p=.5 → 10·.125·.25=.3125' },
      { name:'Expected value (discrete)', eq:'E(X) = Σ xᵢ·P(xᵢ)', vars:'-', ex:'-' },
      { name:'68-95-99.7 rule', eq:'Normal: ±1σ: 68%   ±2σ: 95%   ±3σ: 99.7%', vars:'approx.', ex:'-' },
      { name:'Correlation coefficient', eq:'r = Σ[(xᵢ−x̄)(yᵢ−ȳ)] / √[Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²]', vars:'range [−1, 1]', ex:'-' },
      { name:'Regression line', eq:'ŷ = b₀ + b₁·x    b₁ = r·(sᵧ/sₓ)', vars:'least squares', ex:'-' },
      { name:'Confidence interval (mean)', eq:'x̄ ± z·(σ/√n)', vars:'z=1.96 for 95%', ex:'-' },
    ],
  };

  function openMathFormulas(){
    openToolModal({
      id: 'math-formulas',
      emoji: '📐',
      title: 'Math Formula Sheet',
      tabs: [
        { id:'algebra', label:'Algebra' },
        { id:'trig', label:'Trig' },
        { id:'calculus', label:'Calculus' },
        { id:'stats', label:'Stats' },
      ],
      renderBody: (body, tabId) => {
        const q = (document.getElementById('refMathSearch')?.value || '').toLowerCase();
        const data = MATH_FORMULAS[tabId] || [];
        const filtered = q ? data.filter(f => f.name.toLowerCase().includes(q) || f.eq.toLowerCase().includes(q)) : data;
        body.innerHTML = `
          <div class="ref-inner-search">
            <input type="search" id="refMathSearch" class="ref-search-input" placeholder="Search formulas…" value="${esc(q)}">
          </div>
          <div class="ref-formula-grid">
            ${filtered.length ? filtered.map(f => `
              <div class="ref-formula-card">
                <div class="ref-formula-name">${esc(f.name)}</div>
                <pre class="ref-formula-eq">${esc(f.eq)}</pre>
                <div class="ref-formula-vars"><strong>Where:</strong> ${esc(f.vars)}</div>
                ${f.ex && f.ex !== '-' ? `<div class="ref-formula-ex"><strong>Example:</strong> ${esc(f.ex)}</div>` : ''}
              </div>`).join('')
              : `<div class="ref-empty">No formulas match "${esc(q)}"</div>`}
          </div>
        `;
        const input = body.querySelector('#refMathSearch');
        if(input){
          input.addEventListener('input', () => {
            // Re-render body for current tab with new query
            const active = document.querySelector('.ref-tool-tab.active')?.dataset.tab || tabId;
            openMathReRender(body, active);
          });
          // Preserve focus and cursor position across re-renders
          setTimeout(()=>{ input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
        }
      },
    });
  }
  function openMathReRender(body, tabId){
    const q = (document.getElementById('refMathSearch')?.value || '').toLowerCase();
    const data = MATH_FORMULAS[tabId] || [];
    const filtered = q ? data.filter(f => f.name.toLowerCase().includes(q) || f.eq.toLowerCase().includes(q)) : data;
    const grid = body.querySelector('.ref-formula-grid');
    if(!grid) return;
    grid.innerHTML = filtered.length ? filtered.map(f => `
      <div class="ref-formula-card">
        <div class="ref-formula-name">${esc(f.name)}</div>
        <pre class="ref-formula-eq">${esc(f.eq)}</pre>
        <div class="ref-formula-vars"><strong>Where:</strong> ${esc(f.vars)}</div>
        ${f.ex && f.ex !== '-' ? `<div class="ref-formula-ex"><strong>Example:</strong> ${esc(f.ex)}</div>` : ''}
      </div>`).join('')
      : `<div class="ref-empty">No formulas match "${esc(q)}"</div>`;
  }

  // Expose — overwriting the stubs registered by flux-references.js
  try{ window.openMathFormulas = openMathFormulas; }catch(e){}

  // ═════════════════════════════════════════════════════════════════
  // Attach all other tool openers in a follow-up script section below
  // ═════════════════════════════════════════════════════════════════
  // (Continued in additional tool blocks below)

  // Export shared helpers for tool authors
  window.fluxOpenToolModal = openToolModal;
  window.fluxEsc = esc;
})();
