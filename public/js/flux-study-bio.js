/* ============================================================================
   FLUX STUDY HUB · Biology module (Pass 2)
   Bespoke native tools: Punnett square (mono/dihybrid), DNA→protein translator,
   cell explorer (SVG), macromolecules reference. Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    // ── Punnett square ───────────────────────────────────────────────────────
    function gametes(geno) {
      geno = geno.replace(/\s/g, ''); if (!geno) throw new Error('Enter a genotype like Aa or AaBb');
      if (geno.length % 2) throw new Error('Genotype must be allele pairs (e.g. Aa, AaBb)');
      const genes = [];
      for (let i = 0; i < geno.length; i += 2) { const a = geno[i], b = geno[i + 1]; if (!/[A-Za-z]/.test(a) || !/[A-Za-z]/.test(b)) throw new Error('Use letters only'); if (a.toLowerCase() !== b.toLowerCase()) throw new Error('Each gene needs two alleles of the SAME letter, e.g. Aa'); genes.push([a, b]); }
      let combos = ['']; genes.forEach(([a, b]) => { const nx = []; combos.forEach((c) => { nx.push(c + a); nx.push(c + b); }); combos = nx; });
      return combos;
    }
    const combineAllele = (x, y) => [x, y].sort((p, q) => (p.toLowerCase() !== q.toLowerCase() ? (p.toLowerCase() < q.toLowerCase() ? -1 : 1) : (p < q ? -1 : 1))).join('');
    function offspring(g1, g2) { let o = ''; for (let i = 0; i < g1.length; i++) o += combineAllele(g1[i], g2[i]); return o; }
    function phenoKey(geno) { let k = ''; for (let i = 0; i < geno.length; i += 2) { const a = geno[i], b = geno[i + 1]; k += (a === a.toUpperCase() || b === b.toUpperCase()) ? a.toUpperCase() + '_' : a.toLowerCase() + a.toLowerCase(); } return k; }
    function punnett(cross) {
      const m = String(cross).split(/[x×*]/i); if (m.length !== 2) throw new Error('Use "Aa x Aa"');
      const ga = gametes(m[0]), gb = gametes(m[1]);
      const cells = ga.map((a) => gb.map((b) => offspring(a, b)));
      const geno = {}, pheno = {};
      cells.forEach((row) => row.forEach((c) => { geno[c] = (geno[c] || 0) + 1; const p = phenoKey(c); pheno[p] = (pheno[p] || 0) + 1; }));
      return { ga, gb, cells, geno, pheno };
    }
    function renderPunnett(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🧬 Punnett square</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Cross two genotypes — monohybrid (Aa × Aa) or dihybrid (AaBb × AaBb).</p>
        <div class="fsh-chips-row">${['Aa x Aa', 'Aa x aa', 'AaBb x AaBb', 'AABb x aabb'].map((q) => `<button type="button" class="fsh-cat-chip" data-pn="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="fsh-field"><input id="pnIn" class="fsh-input" value="Aa x Aa" spellcheck="false"><button type="button" class="fsh-btn" id="pnGo">Cross</button></div>
        <div class="fsh-out" id="pnOut"></div></div>`;
      const run = () => {
        const o = document.getElementById('pnOut');
        try {
          const r = punnett(document.getElementById('pnIn').value);
          const grid = `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:auto"><thead><tr><th></th>${r.gb.map((g) => `<th>${esc(g)}</th>`).join('')}</tr></thead><tbody>${r.ga.map((g, i) => `<tr><th>${esc(g)}</th>${r.cells[i].map((c) => `<td style="background:rgba(52,208,255,.12);color:var(--fsh-ink);font-weight:640">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
          const ratio = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="fsh-shellbar">${esc(k.replace(/_/g, '∗'))} × ${v}</span>`).join(' ');
          o.innerHTML = grid + `<div class="fsh-label" style="margin-top:14px"><span>Genotype ratio</span></div><div class="fsh-chips-row">${ratio(r.geno)}</div><div class="fsh-label"><span>Phenotype ratio</span></div><div class="fsh-chips-row">${ratio(r.pheno)}</div>`;
        } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; }
      };
      document.getElementById('pnGo').addEventListener('click', run);
      body.querySelectorAll('[data-pn]').forEach((b) => b.addEventListener('click', () => { document.getElementById('pnIn').value = b.dataset.pn; run(); }));
      run();
    }

    // ── DNA → protein translator (standard genetic code, transl_table 1) ──────
    const AAS = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
    const BIDX = { T: 0, C: 1, A: 2, G: 3 };
    const AA3 = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly', '*': 'Stop' };
    function codonAA(c) { const i = BIDX[c[0]] * 16 + BIDX[c[1]] * 4 + BIDX[c[2]]; return AAS[i]; }
    function translate(seq) {
      const s = String(seq).toUpperCase().replace(/U/g, 'T').replace(/[^ACGT]/g, '');
      if (s.length < 3) throw new Error('Need at least one codon (3 bases)');
      const out = []; for (let i = 0; i + 3 <= s.length; i += 3) out.push(codonAA(s.substr(i, 3)));
      return out;
    }
    function renderTranslate(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🧫 DNA → protein</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Paste a DNA or mRNA sequence — transcribed &amp; translated (reading frame 1).</p>
        <textarea id="trIn" class="fsh-input" style="min-height:70px;font-family:monospace" spellcheck="false">ATG GCC TCA GGA TAA</textarea>
        <div class="fsh-field" style="margin-top:10px"><button type="button" class="fsh-btn" id="trGo">Translate</button></div>
        <div class="fsh-out" id="trOut"></div></div>`;
      const run = () => { const o = document.getElementById('trOut'); try { const aas = translate(document.getElementById('trIn').value); o.innerHTML = `<div class="fsh-chips-row">${aas.map((a) => `<span class="fsh-shellbar" style="${a === '*' ? 'background:rgba(248,113,113,.18);border-color:rgba(248,113,113,.4)' : a === 'M' ? 'background:rgba(52,211,153,.18);border-color:rgba(52,211,153,.4)' : ''}"><b>${esc(a)}</b> ${esc(AA3[a] || '')}</span>`).join('')}</div><div class="fsh-note">${aas.length} codons · 1-letter: ${esc(aas.join(''))}</div>`; } catch (e) { o.innerHTML = `<span class="fsh-err">${esc(e.message)}</span>`; } };
      document.getElementById('trGo').addEventListener('click', run); run();
    }

    // ── Cell explorer (SVG) ──────────────────────────────────────────────────
    const ORG = [
      { id: 'nucleus', n: 'Nucleus', f: 'Controls the cell; holds DNA and directs protein synthesis.', x: 220, y: 150, r: 46, c: '#7c8cff', both: true },
      { id: 'mito', n: 'Mitochondrion', f: 'Powerhouse — makes ATP via aerobic respiration.', x: 110, y: 220, r: 26, c: '#ff7a59', both: true },
      { id: 'er', n: 'Endoplasmic reticulum', f: 'Rough ER makes proteins; smooth ER makes lipids.', x: 300, y: 215, r: 26, c: '#34d0ff', both: true },
      { id: 'golgi', n: 'Golgi apparatus', f: 'Modifies, packages and ships proteins in vesicles.', x: 320, y: 110, r: 24, c: '#f4a13f', both: true },
      { id: 'ribo', n: 'Ribosomes', f: 'Build proteins by translating mRNA.', x: 150, y: 110, r: 16, c: '#37c98a', both: true },
      { id: 'lyso', n: 'Lysosome', f: 'Digests waste with enzymes (mainly animal cells).', x: 160, y: 270, r: 18, c: '#e069b4', both: false },
      { id: 'chloro', n: 'Chloroplast', f: 'Photosynthesis — captures light to make glucose.', x: 300, y: 280, r: 26, c: '#5eecb6', plant: true },
      { id: 'vacuole', n: 'Vacuole', f: 'Large central store of water & turgor (plant cells).', x: 210, y: 270, r: 38, c: '#b16cf0', plant: true },
    ];
    let cellMode = 'animal', cellSel = 'nucleus';
    function renderCell(body) {
      const show = ORG.filter((o) => o.both || (cellMode === 'plant' && o.plant) || (cellMode === 'animal' && o.both));
      const sel = ORG.find((o) => o.id === cellSel) || ORG[0];
      const wall = cellMode === 'plant' ? `<rect x="14" y="14" width="412" height="332" rx="40" fill="none" stroke="#5eecb6" stroke-width="6" opacity=".5"></rect>` : '';
      const blobs = show.map((o) => `<g class="fsh-ring-seg" data-id="${o.id}"><circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${o.c}" opacity="${o.id === cellSel ? 0.95 : 0.7}" stroke="${o.id === cellSel ? '#fff' : 'rgba(0,0,0,.3)'}" stroke-width="${o.id === cellSel ? 2.5 : 1}"></circle><text class="fsh-ring-label" x="${o.x}" y="${o.y}" style="font-size:9px">${esc(o.n.split(' ')[0])}</text></g>`).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🔬 Cell explorer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Tap an organelle to see what it does.</p>
        <div class="fsh-seg" id="cellSeg" style="margin-bottom:12px"><button type="button" data-cm="animal" class="${cellMode === 'animal' ? 'active' : ''}">Animal</button><button type="button" data-cm="plant" class="${cellMode === 'plant' ? 'active' : ''}">Plant</button></div>
        <div class="fsh-ring-wrap"><svg class="fsh-ring-svg" id="cellSvg" viewBox="0 0 440 360" role="img" aria-label="Cell"><ellipse cx="220" cy="180" rx="206" ry="166" fill="rgba(52,208,255,.06)" stroke="var(--fsh-line)" stroke-width="2"></ellipse>${wall}${blobs}</svg>
        <div class="fsh-keyinfo" id="cellInfo"><h3 style="margin:0 0 6px;font-size:18px">${esc(sel.n)}</h3><p style="color:var(--fsh-ink-2);font-size:14px;line-height:1.6">${esc(sel.f)}</p></div></div></div>`;
      document.getElementById('cellSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-cm]'); if (!b) return; cellMode = b.dataset.cm; renderCell(body); });
      document.getElementById('cellSvg').addEventListener('click', (e) => { const g = e.target.closest('[data-id]'); if (!g) return; cellSel = g.dataset.id; renderCell(body); });
    }

    // ── Macromolecules ───────────────────────────────────────────────────────
    const MACRO = [['Carbohydrates', 'Monomer: monosaccharide · energy & structure (cellulose)'], ['Lipids', 'Glycerol + fatty acids · energy store, membranes, hormones'], ['Proteins', 'Monomer: amino acid · enzymes, structure, transport'], ['Nucleic acids', 'Monomer: nucleotide · store & transmit genetic info']];
    function renderMacro(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">🧪 Macromolecules</h3><div class="fsh-formula-list">${MACRO.map((m) => `<div class="fsh-formula"><div class="nm">${esc(m[0])}</div><div class="fx" style="font-size:13px;font-family:inherit">${esc(m[1])}</div></div>`).join('')}</div></div>`; }

    H.register('biology', [
      { id: 'punnett', name: 'Punnett', icon: '🧬', desc: 'punnett square genetics cross genotype phenotype', render: renderPunnett, ai: { name: 'punnett', description: 'Punnett cross. Arg: "Aa x Aa" or "AaBb x AaBb".', params: { cross: 'string' }, run: (a) => { const r = punnett(a); return { genotypeRatio: r.geno, phenotypeRatio: r.pheno }; } } },
      { id: 'translate', name: 'DNA→Protein', icon: '🧫', desc: 'dna rna codon translate protein amino acid transcription', render: renderTranslate, ai: { name: 'translateDNA', description: 'Translate DNA/mRNA to amino acids (frame 1). Arg: sequence.', params: { sequence: 'string' }, run: (a) => translate(a).join('-') } },
      { id: 'cell', name: 'Cell explorer', icon: '🔬', desc: 'cell organelles nucleus mitochondria animal plant', render: renderCell },
      { id: 'macro', name: 'Macromolecules', icon: '🧪', desc: 'macromolecules carbohydrates lipids proteins nucleic acids', render: renderMacro },
    ]);
  }
  boot();
})();
