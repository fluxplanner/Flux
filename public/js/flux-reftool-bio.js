/* Biology Codon Table — 64 codons, color-coded by AA property, lookup */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  // Single-letter + 3-letter + full name + property
  const AA = {
    Ala:{ n:'Alanine',       s:'A', p:'nonpolar' },
    Arg:{ n:'Arginine',      s:'R', p:'posch' },
    Asn:{ n:'Asparagine',    s:'N', p:'polar' },
    Asp:{ n:'Aspartate',     s:'D', p:'negch' },
    Cys:{ n:'Cysteine',      s:'C', p:'polar' },
    Gln:{ n:'Glutamine',     s:'Q', p:'polar' },
    Glu:{ n:'Glutamate',     s:'E', p:'negch' },
    Gly:{ n:'Glycine',       s:'G', p:'nonpolar' },
    His:{ n:'Histidine',     s:'H', p:'posch' },
    Ile:{ n:'Isoleucine',    s:'I', p:'nonpolar' },
    Leu:{ n:'Leucine',       s:'L', p:'nonpolar' },
    Lys:{ n:'Lysine',        s:'K', p:'posch' },
    Met:{ n:'Methionine',    s:'M', p:'nonpolar' },
    Phe:{ n:'Phenylalanine', s:'F', p:'nonpolar' },
    Pro:{ n:'Proline',       s:'P', p:'nonpolar' },
    Ser:{ n:'Serine',        s:'S', p:'polar' },
    Thr:{ n:'Threonine',     s:'T', p:'polar' },
    Trp:{ n:'Tryptophan',    s:'W', p:'nonpolar' },
    Tyr:{ n:'Tyrosine',      s:'Y', p:'polar' },
    Val:{ n:'Valine',        s:'V', p:'nonpolar' },
    Stop:{ n:'Stop codon',   s:'*', p:'stop' },
  };

  // Standard genetic code (DNA → AA via mRNA; we use RNA U here)
  const CODON = {
    // U
    UUU:'Phe', UUC:'Phe', UUA:'Leu', UUG:'Leu',
    UCU:'Ser', UCC:'Ser', UCA:'Ser', UCG:'Ser',
    UAU:'Tyr', UAC:'Tyr', UAA:'Stop', UAG:'Stop',
    UGU:'Cys', UGC:'Cys', UGA:'Stop', UGG:'Trp',
    // C
    CUU:'Leu', CUC:'Leu', CUA:'Leu', CUG:'Leu',
    CCU:'Pro', CCC:'Pro', CCA:'Pro', CCG:'Pro',
    CAU:'His', CAC:'His', CAA:'Gln', CAG:'Gln',
    CGU:'Arg', CGC:'Arg', CGA:'Arg', CGG:'Arg',
    // A
    AUU:'Ile', AUC:'Ile', AUA:'Ile', AUG:'Met',
    ACU:'Thr', ACC:'Thr', ACA:'Thr', ACG:'Thr',
    AAU:'Asn', AAC:'Asn', AAA:'Lys', AAG:'Lys',
    AGU:'Ser', AGC:'Ser', AGA:'Arg', AGG:'Arg',
    // G
    GUU:'Val', GUC:'Val', GUA:'Val', GUG:'Val',
    GCU:'Ala', GCC:'Ala', GCA:'Ala', GCG:'Ala',
    GAU:'Asp', GAC:'Asp', GAA:'Glu', GAG:'Glu',
    GGU:'Gly', GGC:'Gly', GGA:'Gly', GGG:'Gly',
  };

  const BASES = ['U','C','A','G'];

  function propClass(p){
    if(p === 'nonpolar') return 'codon-nonpolar';
    if(p === 'polar') return 'codon-polar';
    if(p === 'posch') return 'codon-posch';
    if(p === 'negch') return 'codon-negch';
    if(p === 'stop') return 'codon-stop';
    return '';
  }

  function renderTable(body, highlight){
    // Full table organized by first base → second base → third base
    const rows = [];
    rows.push('<div style="overflow-x:auto">');
    rows.push('<table class="ref-table"><thead><tr><th>1st ↓ 2nd →</th>' + BASES.map(b => `<th>${b}</th>`).join('') + '<th>3rd</th></tr></thead><tbody>');
    BASES.forEach(b1 => {
      BASES.forEach((b3, idx) => {
        rows.push('<tr>');
        if(idx === 0) rows.push(`<td rowspan="4" style="font-weight:900;font-size:1.1rem;font-family:'JetBrains Mono',monospace">${b1}</td>`);
        BASES.forEach(b2 => {
          const codon = b1 + b2 + b3;
          const aa = CODON[codon];
          const aaData = AA[aa] || {};
          const cls = propClass(aaData.p);
          const isStart = codon === 'AUG';
          const pulse = highlight && aa === highlight ? ' pulse' : '';
          rows.push(`<td style="padding:3px">
            <div class="ref-codon-cell ${cls}${pulse}${isStart?' codon-start':''}" data-codon="${codon}" data-aa="${aa||''}">
              <span class="c">${codon}</span>
              <span class="aa">${aa === 'Stop' ? 'STOP' : (aaData.s || '')}</span>
            </div>
          </td>`);
        });
        rows.push(`<td style="font-family:'JetBrains Mono',monospace;font-weight:800">${b3}</td>`);
        rows.push('</tr>');
      });
    });
    rows.push('</tbody></table></div>');
    return rows.join('');
  }

  function renderTab(body){
    const q = (document.getElementById('refCodonSearch')?.value || '').trim();
    // Try direct codon lookup (3 chars RNA)
    let lookup = null;
    if(/^[ACGUT]{3}$/i.test(q)){
      const codon = q.toUpperCase().replace(/T/g,'U');
      const aa = CODON[codon];
      if(aa){
        const aaData = AA[aa];
        const synonyms = Object.keys(CODON).filter(c => CODON[c] === aa);
        lookup = { codon, aa, aaData, synonyms };
      }
    }
    // Highlight: match AA name (starting 2+ chars)
    let highlight = null;
    if(q.length >= 2 && !lookup){
      const qLower = q.toLowerCase();
      const match = Object.entries(AA).find(([,data]) => data.n.toLowerCase().startsWith(qLower) || data.s.toLowerCase() === qLower);
      if(match) highlight = match[0];
    }

    body.innerHTML = `
      <div class="ref-inner-search"><input type="search" id="refCodonSearch" class="ref-search-input" placeholder="Search AA name (e.g. Leucine) or codon (e.g. AUG)…" value="${esc(q)}"></div>

      ${lookup ? `
        <div class="ref-formula-card" style="margin-bottom:14px">
          <div class="ref-formula-name">${esc(lookup.codon)} → ${esc(lookup.aaData.n)} <span style="opacity:.7">(${esc(lookup.aaData.s)})</span></div>
          <div class="ref-formula-vars"><strong>Property:</strong> ${esc(lookup.aaData.p.replace('posch','positively charged').replace('negch','negatively charged').replace('stop','stop codon'))}</div>
          <div class="ref-formula-vars"><strong>Synonymous codons:</strong> <span style="font-family:'JetBrains Mono',monospace;color:var(--accent)">${lookup.synonyms.join(', ')}</span></div>
        </div>
      ` : ''}

      <div class="ref-codon-legend">
        <span><i class="codon-nonpolar" style="background:rgba(255,193,7,.8)"></i> Nonpolar</span>
        <span><i class="codon-polar" style="background:rgba(64,156,255,.8)"></i> Polar</span>
        <span><i class="codon-posch" style="background:rgba(108,231,138,.8)"></i> + Charged</span>
        <span><i class="codon-negch" style="background:rgba(255,107,107,.8)"></i> − Charged</span>
        <span><i class="codon-stop" style="background:rgba(140,30,30,.8)"></i> Stop</span>
        <span><i style="background:transparent;border:2px solid var(--accent)"></i> AUG = Start</span>
      </div>

      ${renderTable(body, highlight)}
    `;

    const input = body.querySelector('#refCodonSearch');
    if(input){
      input.addEventListener('input', () => renderTab(body));
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
    }
    body.querySelectorAll('.ref-codon-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const input = document.getElementById('refCodonSearch');
        if(input){ input.value = cell.dataset.codon; input.dispatchEvent(new Event('input')); }
      });
    });
  }

  function openCodonTable(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'codon-table',
      emoji: '🧬',
      title: 'Biology Codon Table',
      renderBody: renderTab,
    });
  }

  try{ window.openCodonTable = openCodonTable; }catch(e){}
})();
