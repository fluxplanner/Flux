/* ============================================================================
   FLUX STUDY HUB · Biology, second module
   Microscopy, carbohydrates, lipids, units, fieldwork statistics, pedigrees
   and viral replication.

   A separate file from flux-study-bio.js rather than 600 lines appended to it:
   that module owns the Punnett square, the codon translator and the cell
   explorer, all of which work, and none of this needs to touch them. It
   registers against the same subject id, so the tabs land in one strip.

   THE DIAGRAMS ARE DRAWN, NOT LINKED
   ----------------------------------
   Every diagram below is inline SVG. Flux gets used offline and on a school
   network that blocks plenty; a diagram that is a broken image icon on the one
   day you need it is worse than a diagram that is a bit plain. Drawing them
   also means they follow the theme, so they stay readable in light mode
   without a second set of assets.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) => `<div class="fsh-card" style="padding:20px">
      <h3 style="margin:0 0 4px;font-size:16px">${title}</h3>
      ${sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${sub}</p>` : ''}
      ${inner}</div>`;
    const table = (head, rows, min) => `<div class="fsh-sol-scroll"><table class="fsh-sol" style="min-width:${min || 460}px">
      <thead><tr><th style="text-align:left">${head.map(esc).join('</th><th>')}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th style="text-align:left">${esc(r[0])}</th>${r.slice(1).map((c) => `<td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const list = (items) => `<div class="fsh-formula-list">${items.map((x) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(x[0])}</div><div class="nm" style="margin-top:4px;color:var(--fsh-ink-2)">${esc(x[1])}</div></div>`).join('')}</div>`;
    const label = (t, first) => `<div class="fsh-label"${first ? '' : ' style="margin-top:16px"'}><span>${esc(t)}</span></div>`;
    const fig = (drawing, caption) => `<div class="fsh-card" style="padding:14px;margin-top:10px;background:rgba(255,255,255,.03)">
      ${drawing}${caption ? `<div class="fsh-note" style="margin-top:8px">${caption}</div>` : ''}</div>`;
    const num = (id) => parseFloat((document.getElementById(id) || {}).value);

    /* One place for the SVG boilerplate. Strokes take their colour from the
       hub's own custom properties rather than fixed greys, so every diagram
       follows the theme and the subject accent and stays readable in light
       mode. */
    const draw = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img"
      fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      style="color:var(--fsh-ink-2);max-width:${w}px;height:auto;display:block;margin:0 auto">${inner}</svg>`;
    const txt = (x, y, s, o) => `<text x="${x}" y="${y}" fill="var(--fsh-ink)" stroke="none" font-size="${(o && o.size) || 12}" text-anchor="${(o && o.anchor) || 'middle'}" font-family="inherit"${o && o.weight ? ` font-weight="${o.weight}"` : ''}>${s}</text>`;

    // ══ Microscopy and magnification ═══════════════════════════════════════
    function renderMicroscopy(body) {
      body.innerHTML = card('Microscopy and magnification',
        'The triangle, the two microscopes, and the thing examiners actually take marks for — units.',
        `${label('The formula', true)}
        ${fig(draw(420, 130, `
          ${txt(210, 26, 'magnification  =  image size  ÷  actual size', { size: 13, weight: '650' })}
          <rect x="130" y="44" width="160" height="70" rx="10" stroke="var(--fsh-line)"/>
          <line x1="130" y1="76" x2="290" y2="76" stroke="var(--fsh-line)"/>
          <line x1="210" y1="76" x2="210" y2="114" stroke="var(--fsh-line)"/>
          ${txt(210, 68, 'I  (image)', { size: 12 })}
          ${txt(170, 100, 'A', { size: 12 })}
          ${txt(250, 100, 'M', { size: 12 })}
        `), 'Cover the one you want. Image over actual gives magnification; image over magnification gives the actual size.')}

        ${label('Work one out')}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <input id="mgI" class="fsh-input" placeholder="Image size (mm)" inputmode="decimal" style="max-width:180px">
          <input id="mgA" class="fsh-input" placeholder="Actual size (µm)" inputmode="decimal" style="max-width:180px">
          <input id="mgM" class="fsh-input" placeholder="Magnification (×)" inputmode="decimal" style="max-width:180px">
          <button type="button" class="fsh-btn" id="mgGo">Fill the blank</button>
        </div>
        <div class="fsh-out" id="mgOut"></div>
        <div class="fsh-note" style="margin-top:8px">Leave exactly one box empty. Image in millimetres and actual size in micrometres, because that is how the question is nearly always worded — the conversion is done for you.</div>

        ${label('Magnification vs resolution')}
        ${list([
    ['Magnification', 'How much bigger the image is than the object. You can magnify as much as you like; past a point you just get a bigger blur.'],
    ['Resolution', 'The smallest distance between two points that still look like two points. This is the real limit, and it is set by the wavelength of whatever you are imaging with.'],
    ['Why light runs out', 'Visible light is 400–700 nm, so a light microscope cannot resolve much below about 200 nm. Electrons have a far shorter wavelength, which is the entire reason electron microscopes exist.'],
  ])}
        ${table(['', 'Light microscope', 'TEM', 'SEM'], [
    ['Resolution', 'about 200 nm', 'about 0.2 nm', 'about 5 nm'],
    ['Useful magnification', 'up to ×1,500', 'up to ×500,000', 'up to ×100,000'],
    ['Specimen', 'Living or dead', 'Dead, ultra-thin section', 'Dead, surface coated in metal'],
    ['Image', '2D, can be in colour', '2D, black and white', '3D surface, black and white'],
    ['Shows you', 'Cells and larger organelles', 'Internal ultrastructure', 'Surface detail'],
    ['Catch', 'Limited by the wavelength of light', 'Vacuum, so nothing alive; artefacts possible', 'Vacuum; surface only'],
  ], 620)}

        ${label('Scale bars and graticules')}
        ${list([
    ['Reading a scale bar', 'Measure the bar with a ruler, then divide that length by the length it says it represents. That gives the magnification of the whole image, so you can then measure anything else on it.'],
    ['Eyepiece graticule', 'An arbitrary scale in the eyepiece. The divisions mean nothing at all until you calibrate them.'],
    ['Stage micrometer', 'A slide with a known scale, usually 100 divisions over 1 mm, so one division is 10 µm. Line the two scales up, count how many graticule divisions fit into one micrometer division, and you have what a graticule division is worth at that objective.'],
    ['Recalibrate for every objective', 'The graticule does not change but the magnification does, so a division is worth a different length at ×10 and at ×40. This is the mark people lose.'],
  ])}

        ${label('Drawing rules that carry marks')}
        <div class="fsh-note">Sharp pencil, single continuous lines, no shading and no sketchy repeated strokes. Draw what you can actually see rather than what the textbook shows. Label lines are straight, drawn with a ruler, and never cross each other. Always state the magnification or add a scale bar, and give the drawing a title.</div>`);

      document.getElementById('mgGo').addEventListener('click', () => {
        const out = document.getElementById('mgOut');
        const I = num('mgI'), A = num('mgA'), M = num('mgM');
        const blanks = [['image', I], ['actual', A], ['magnification', M]].filter((x) => !isFinite(x[1]));
        if (blanks.length !== 1) { out.innerHTML = '<span class="fsh-err">Leave exactly one box empty.</span>'; return; }
        /* Image comes in as millimetres and actual size as micrometres, so one
           of the two has to be scaled before they can be divided. Doing it here
           rather than asking the student to is the point — mixing the units is
           the single most common way this calculation goes wrong. */
        const b = blanks[0][0];
        if (b === 'magnification') {
          if (!(A > 0)) { out.innerHTML = '<span class="fsh-err">Actual size must be more than zero.</span>'; return; }
          const m = (I * 1000) / A;
          out.innerHTML = `<span class="big">×${m.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>`
            + `<div class="fsh-note">${I} mm is ${(I * 1000).toLocaleString()} µm, and ${(I * 1000).toLocaleString()} ÷ ${A} = ${m.toFixed(1)}.</div>`;
        } else if (b === 'actual') {
          if (!(M > 0)) { out.innerHTML = '<span class="fsh-err">Magnification must be more than zero.</span>'; return; }
          const a = (I * 1000) / M;
          out.innerHTML = `<span class="big">${a.toLocaleString(undefined, { maximumFractionDigits: 3 })} µm</span>`
            + `<div class="fsh-note">That is ${(a / 1000).toFixed(4)} mm, or ${(a * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} nm.</div>`;
        } else {
          const i = (A * M) / 1000;
          out.innerHTML = `<span class="big">${i.toLocaleString(undefined, { maximumFractionDigits: 3 })} mm</span>`
            + `<div class="fsh-note">${A} µm × ${M} = ${(A * M).toLocaleString()} µm, which is ${i.toFixed(3)} mm.</div>`;
        }
      });
    }

    // ══ Units and scale ════════════════════════════════════════════════════
    const LEN = { m: 1, cm: 1e-2, mm: 1e-3, um: 1e-6, nm: 1e-9 };
    const LEN_NAME = { m: 'metres', cm: 'centimetres', mm: 'millimetres', um: 'micrometres (µm)', nm: 'nanometres' };
    function renderUnits(body) {
      body.innerHTML = card('Units and scale',
        'Biology spans ten orders of magnitude, and the exam will make you move between them.',
        `${label('SI prefixes', true)}
        ${table(['Prefix', 'Symbol', 'Multiplier', 'Where it shows up'], [
    ['kilo', 'k', '10³', 'Rarely — kJ of energy'],
    ['(none)', '—', '10⁰', 'Metres, moles, grams'],
    ['centi', 'c', '10⁻²', 'Leaf and organ sizes; cm³'],
    ['milli', 'm', '10⁻³', 'mm on a ruler; mm³; mol per dm³'],
    ['micro', 'µ', '10⁻⁶', 'Cells and organelles'],
    ['nano', 'n', '10⁻⁹', 'Membranes, molecules, wavelengths'],
    ['pico', 'p', '10⁻¹²', 'Very small masses'],
  ], 520)}
        <div class="fsh-note" style="margin-top:8px">Each step from milli downwards is a factor of 1,000, not 10. That is the most common slip on the whole topic: 1 mm is 1,000 µm, and 1 µm is 1,000 nm.</div>

        ${label('Convert a length')}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <input id="unIn" class="fsh-input" value="7" inputmode="decimal" style="max-width:160px">
          <div class="fsh-seg" id="unFrom">${Object.keys(LEN).map((k) => `<button type="button" data-u="${k}" class="${k === 'nm' ? 'active' : ''}">${k === 'um' ? 'µm' : k}</button>`).join('')}</div>
          <button type="button" class="fsh-btn" id="unGo">Convert</button>
        </div>
        <div class="fsh-out" id="unOut"></div>

        ${label('How big things actually are')}
        ${table(['Structure', 'Typical size'], [
    ['Human egg cell', '100 µm — just about visible without a microscope'],
    ['Plant cell', '10–100 µm'],
    ['Animal cell', '10–30 µm'],
    ['Chloroplast', '3–10 µm'],
    ['Mitochondrion', '0.5–5 µm'],
    ['Bacterium', '1–5 µm'],
    ['Cell membrane thickness', '7–10 nm'],
    ['Ribosome', '20–25 nm'],
    ['DNA double helix width', '2 nm'],
    ['Water molecule', 'about 0.3 nm'],
  ], 460)}

        ${label('Volume and concentration')}
        ${list([
    ['1 dm³ = 1 litre = 1,000 cm³', 'A cubic decimetre is a 10 cm cube. Biology papers say dm³ where everyday life says litre — they are the same thing.'],
    ['1 cm³ = 1 mL', 'So 25 cm³ of solution and 25 mL are identical.'],
    ['Concentration in mol dm⁻³', 'Moles of solute per litre of solution. A 0.1 mol dm⁻³ solution has 0.1 mol in every 1,000 cm³.'],
    ['Percentage solutions', '% (w/v) means grams per 100 cm³. A 5% glucose solution is 5 g in 100 cm³, so 50 g per dm³.'],
  ])}`);

      let from = 'nm';
      const run = () => {
        const out = document.getElementById('unOut');
        const v = num('unIn');
        if (!isFinite(v)) { out.innerHTML = '<span class="fsh-err">Enter a number.</span>'; return; }
        const m = v * LEN[from];
        const fmt = (x) => (x !== 0 && (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-4) ? x.toExponential(3) : x.toLocaleString(undefined, { maximumFractionDigits: 6 }));
        out.innerHTML = `<table class="fsh-sol" style="min-width:auto;margin-top:6px"><tbody>${Object.keys(LEN).map((k) =>
          `<tr><th style="text-align:left">${esc(LEN_NAME[k])}</th><td style="background:rgba(255,255,255,.05);color:var(--fsh-ink)">${esc(fmt(m / LEN[k]))}</td></tr>`).join('')}</tbody></table>`;
      };
      document.getElementById('unFrom').addEventListener('click', (e) => {
        const b = e.target.closest('[data-u]'); if (!b) return;
        from = b.dataset.u;
        body.querySelectorAll('#unFrom button').forEach((x) => x.classList.toggle('active', x === b));
        run();
      });
      document.getElementById('unGo').addEventListener('click', run);
      document.getElementById('unIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      run();
    }

    // ══ Carbohydrates and structural polysaccharides ═══════════════════════
    /* Drawn as rings with the carbon-1 hydroxyl marked, because α against β is
       the whole point of the topic and it comes down to that one bond. */
    function glucoseSVG() {
      const ring = (x, caption, ohDown) => `
        <polygon points="${x},58 ${x + 22},44 ${x + 44},58 ${x + 44},84 ${x + 22},98 ${x},84"
          fill="rgba(255,255,255,.05)" stroke="var(--fsh-ink-2)"/>
        <line x1="${x + 44}" y1="${ohDown ? 84 : 58}" x2="${x + 56}" y2="${ohDown ? 100 : 42}" stroke="var(--fsh-accent)" stroke-width="2"/>
        ${txt(x + 62, ohDown ? 106 : 40, 'OH', { size: 11, anchor: 'start' })}
        ${txt(x + 22, 74, 'O', { size: 11 })}
        ${txt(x + 22, 124, caption, { size: 11, weight: '650' })}`;
      return draw(380, 140, `${ring(24, 'α-glucose — OH below', true)}${ring(210, 'β-glucose — OH above', false)}`);
    }
    function chainSVG() {
      return draw(470, 210, `
        ${txt(12, 20, 'α-1,4 — chains coil', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M20 46 q14 -18 28 0 t28 0 t28 0 t28 0 t28 0 t28 0" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        ${txt(12, 72, 'starch (amylose) and glycogen', { size: 11, anchor: 'start' })}

        ${txt(12, 106, 'α-1,6 — branch points', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M20 130 h120" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <path d="M70 130 l22 -22 M110 130 l22 22" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        ${txt(150, 134, 'amylopectin, and glycogen even more so', { size: 11, anchor: 'start' })}

        ${txt(12, 170, 'β-1,4 — every other unit flipped, so chains lie straight', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M20 188 h180" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <path d="M20 196 h180" stroke="var(--fsh-accent)" stroke-width="2.4" stroke-dasharray="4 4"/>
        ${txt(210, 196, 'cellulose — hydrogen bonds hold the chains together', { size: 11, anchor: 'start' })}`);
    }
    function renderCarbs(body) {
      body.innerHTML = card('Structural polysaccharides',
        'Four polymers of the same sugar that behave completely differently, and the reason is one bond.',
        `${label('It all starts with one hydroxyl', true)}
        ${fig(glucoseSVG(), 'α and β glucose differ only in whether the hydroxyl group on carbon 1 points below the ring or above it. Everything else on this page follows from that.')}

        ${label('The five polymers')}
        ${table(['Polymer', 'Monomer and bond', 'Structure', 'Where', 'Job'], [
    ['Amylose', 'α-glucose, 1,4 only', 'Unbranched, coils into a helix', 'Plants', 'Compact energy store'],
    ['Amylopectin', 'α-glucose, 1,4 and 1,6', 'Branched every 24–30 units', 'Plants', 'Store with faster release — many ends for enzymes'],
    ['Glycogen', 'α-glucose, 1,4 and 1,6', 'Branched every 8–12 units, so more than amylopectin', 'Animals — liver and muscle', 'Store released very fast, as animals need it'],
    ['Cellulose', 'β-glucose, 1,4', 'Straight chains, hydrogen-bonded into microfibrils', 'Plant cell walls', 'Tensile strength — stops the cell bursting'],
    ['Chitin', 'β-glucose with an acetylamino group, 1,4', 'Like cellulose, straight and hydrogen-bonded', 'Arthropod exoskeletons, fungal walls', 'Strong, light and waterproof'],
  ], 740)}
        ${fig(chainSVG(), 'α chains coil or branch, which makes them compact and quick to break down — good for storage. β chains lie flat and hydrogen-bond to their neighbours, which makes them strong — good for structure.')}

        ${label('The exam answers')}
        ${list([
    ['Why cellulose is strong', 'In a β-1,4 chain every other glucose is rotated 180°, so the chain comes out straight rather than coiled. Straight chains lie alongside one another and form very many hydrogen bonds between them, bundling into microfibrils. Each bond is weak; there are enormous numbers of them.'],
    ['Why starch is a good store', 'Insoluble, so it does not affect water potential and will not draw water in osmotically. Compact, because it coils. Branched, so enzymes can attack many ends at once. And it packs a lot of glucose into a small space.'],
    ['Why glycogen is more branched than starch', 'Animals respire faster and need glucose released more quickly. More branches means more free ends for enzymes to work on simultaneously.'],
    ['Why humans cannot digest cellulose', 'We make amylase, which hydrolyses α-1,4 bonds. We have no cellulase for β-1,4, so cellulose passes through as fibre. Ruminants do not make it either — bacteria in their gut do it for them.'],
    ['The bond, in both directions', 'All of these are joined by glycosidic bonds formed in condensation reactions, releasing one water per bond. They are broken by hydrolysis, which adds one water per bond.'],
  ])}`);
    }

    // ══ Lipids and fatty acids ═════════════════════════════════════════════
    function fattyAcidSVG() {
      return draw(470, 250, `
        ${txt(12, 20, 'Saturated — no C=C, so the chain is straight', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M24 52 l18 -14 l18 14 l18 -14 l18 14 l18 -14 l18 14 l18 -14 l18 14"
          stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <circle cx="24" cy="52" r="7" fill="rgba(255,255,255,.08)" stroke="var(--fsh-ink-2)"/>
        ${txt(24, 78, 'COOH', { size: 10 })}
        ${txt(240, 42, 'packs tightly · solid at room temperature · animal fat', { size: 11, anchor: 'start' })}

        ${txt(12, 118, 'Unsaturated, cis — the double bond kinks it', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M24 150 l18 -14 l18 14 l18 -14" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <path d="M78 136 h26 M78 131 h26" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <path d="M104 136 l14 22 l18 -14 l18 14 l18 -14" stroke="var(--fsh-accent)" stroke-width="2.4"/>
        <circle cx="24" cy="150" r="7" fill="rgba(255,255,255,.08)" stroke="var(--fsh-ink-2)"/>
        ${txt(24, 176, 'COOH', { size: 10 })}
        ${txt(91, 120, 'C=C', { size: 10 })}
        ${txt(240, 172, 'cannot pack · liquid at room temperature · plant oil', { size: 11, anchor: 'start' })}

        ${txt(12, 214, 'Unsaturated, trans — has a C=C but stays straight', { size: 12, anchor: 'start', weight: '650' })}
        <path d="M24 240 l18 -12 l18 12 h26 l18 -12 l18 12 l18 -12 l18 12"
          stroke="var(--fsh-accent)" stroke-width="2.4" stroke-dasharray="6 3"/>
        ${txt(240, 236, 'behaves like a saturated fat in the body', { size: 11, anchor: 'start' })}`);
    }
    function triglycerideSVG() {
      return draw(450, 200, `
        ${txt(112, 22, 'Triglyceride', { size: 12, weight: '650' })}
        <rect x="34" y="36" width="26" height="120" rx="6" fill="rgba(255,255,255,.05)" stroke="var(--fsh-ink-2)"/>
        ${txt(47, 102, 'G', { size: 12 })}
        ${[58, 98, 138].map((y) => `<path d="M60 ${y} l18 -8 l18 8 l18 -8 l18 8 l18 -8" stroke="var(--fsh-accent)" stroke-width="2.2"/>`).join('')}
        ${txt(112, 180, 'glycerol + 3 fatty acids · 3 ester bonds · 3 water out', { size: 11 })}

        ${txt(340, 22, 'Phospholipid', { size: 12, weight: '650' })}
        <circle cx="340" cy="52" r="14" fill="rgba(var(--fsh-accent-rgb),.35)" stroke="var(--fsh-accent)"/>
        ${txt(340, 57, 'P', { size: 11 })}
        <path d="M332 66 v12 M348 66 v12" stroke="var(--fsh-ink-2)"/>
        <path d="M332 78 l-8 14 l8 14 l-8 14 l8 14" stroke="var(--fsh-accent)" stroke-width="2.2"/>
        <path d="M348 78 l8 14 l-8 14 l8 14 l-8 14" stroke="var(--fsh-accent)" stroke-width="2.2"/>
        ${txt(340, 152, 'head: hydrophilic', { size: 10 })}
        ${txt(340, 166, 'tails: hydrophobic', { size: 10 })}
        ${txt(340, 186, 'two fatty acids, not three', { size: 11 })}`);
    }
    function renderLipids(body) {
      body.innerHTML = card('Fatty acids and lipids',
        'One double bond is the difference between butter and olive oil.',
        `${label('The three kinds of chain', true)}
        ${fig(fattyAcidSVG(), 'Saturated chains are straight, so they stack closely and the forces between them are strong — solid at room temperature. A cis double bond puts a permanent kink in the chain so they cannot stack, and the fat is a liquid oil. A trans double bond has its hydrogens on opposite sides, so the chain stays straight and behaves like a saturated fat despite technically being unsaturated.')}
        ${table(['Type', 'C=C bonds', 'Shape', 'At room temperature', 'Typical source'], [
    ['Saturated', 'None', 'Straight', 'Solid', 'Butter, lard, meat fat'],
    ['Monounsaturated', 'One', 'One kink', 'Liquid', 'Olive oil, avocado'],
    ['Polyunsaturated', 'Two or more', 'Several kinks', 'Liquid, often runny', 'Sunflower oil, oily fish'],
    ['Trans', 'One or more, trans', 'Straight despite the C=C', 'Solid', 'Partially hydrogenated oils'],
  ], 660)}
        <div class="fsh-note" style="margin-top:8px">Omega-3 and omega-6 say where the first double bond sits counting from the methyl end rather than the acid end — omega-3 means three carbons in.</div>

        ${label('What they build')}
        ${fig(triglycerideSVG(), 'A triglyceride is glycerol plus three fatty acids joined by ester bonds — three condensation reactions, releasing three molecules of water. Swap one fatty acid for a phosphate group and you get a phospholipid, which has a water-loving head and two water-hating tails.')}
        ${list([
    ['Why phospholipids form bilayers', 'The heads are polar and attract water; the tails are non-polar and are pushed away from it. In water the only arrangement that satisfies both is a double layer with the tails facing inwards — which is every membrane you have.'],
    ['Why fat stores more energy than carbohydrate', 'Fatty acid chains are almost entirely C–H bonds and are highly reduced, so oxidising them releases far more energy per gram — roughly 37 kJ g⁻¹ against about 17 for carbohydrate.'],
    ['Their other jobs', 'Thermal insulation, physical protection around organs, buoyancy, waterproofing in the waxy plant cuticle, and steroid hormones such as testosterone and oestrogen — which are lipids too.'],
    ['Metabolic water', 'Respiring fat produces a lot of water, which is why a camel’s hump is fat rather than a water tank.'],
    ['The health point', 'Diets high in saturated and trans fats raise LDL cholesterol and are associated with coronary heart disease. Trans fats are the worse of the two, because they also lower HDL.'],
  ])}`);
    }

    // ══ Fieldwork statistics ═══════════════════════════════════════════════
    const CHI = [
      [1, 3.84, 6.63], [2, 5.99, 9.21], [3, 7.81, 11.34], [4, 9.49, 13.28], [5, 11.07, 15.09],
      [6, 12.59, 16.81], [7, 14.07, 18.48], [8, 15.51, 20.09], [9, 16.92, 21.67], [10, 18.31, 23.21],
      [11, 19.68, 24.72], [12, 21.03, 26.22], [15, 25.00, 30.58], [20, 31.41, 37.57],
    ];
    function renderStats(body) {
      body.innerHTML = card('Fieldwork statistics',
        'Chi-squared for "is this difference real", the Lincoln index for "how many are there".',
        `${label('Chi-squared', true)}
        ${list([
    ['What it tests', 'Whether the gap between what you counted and what you expected is bigger than chance would explain. It is for categories and counts, never for measurements.'],
    ['The formula', 'χ² = Σ (O − E)² ÷ E, summed over every category. O is observed, E is expected.'],
    ['Degrees of freedom', 'Goodness of fit: categories − 1. Association between two variables: (rows − 1) × (columns − 1).'],
    ['The decision', 'If χ² is greater than or equal to the critical value at p = 0.05, reject the null hypothesis — the difference is significant, and there is under a 5% probability it arose by chance. If χ² is smaller, you have no evidence of a difference.'],
    ['The null hypothesis', 'Always "there is no significant difference between observed and expected", or "there is no association between the two variables". Write it down — there are marks for it.'],
  ])}
        ${label('Critical values')}
        ${table(['Degrees of freedom', 'p = 0.05', 'p = 0.01'], CHI.map((r) => [String(r[0]), r[1].toFixed(2), r[2].toFixed(2)]), 420)}
        <div class="fsh-note" style="margin-top:8px">The 0.05 column is the one you almost always want. 3.84 at one degree of freedom is worth memorising — it comes up constantly.</div>

        ${label('Calculate χ²')}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <input id="csO" class="fsh-input" value="42, 38, 12, 8" placeholder="Observed, comma separated" style="max-width:260px">
          <input id="csE" class="fsh-input" value="45, 35, 10, 10" placeholder="Expected, comma separated" style="max-width:260px">
          <button type="button" class="fsh-btn" id="csGo">Test it</button>
        </div>
        <div class="fsh-out" id="csOut"></div>

        ${label('The Lincoln index')}
        ${list([
    ['What it does', 'Estimates the size of a population you cannot count directly, by capturing, marking, releasing and then recapturing.'],
    ['The formula', 'N = (n₁ × n₂) ÷ n₃ — the first sample marked, times the second sample total, divided by how many in the second sample were already marked.'],
    ['The assumptions', 'No births, deaths, immigration or emigration between the two samples. Marking does not harm the animal or change how easy it is to catch. The marks do not come off. And enough time is left for the marked animals to mix back in evenly.'],
    ['Why it goes wrong', 'If marked animals learn to avoid the trap, n₃ falls and the estimate comes out far too high. If they learn the trap means free food, the opposite happens.'],
  ])}
        <div class="fsh-field" style="flex-wrap:wrap;margin-top:8px">
          <input id="liN1" class="fsh-input" value="60" placeholder="n₁ caught and marked" inputmode="numeric" style="max-width:210px">
          <input id="liN2" class="fsh-input" value="72" placeholder="n₂ caught second time" inputmode="numeric" style="max-width:210px">
          <input id="liN3" class="fsh-input" value="18" placeholder="n₃ of those already marked" inputmode="numeric" style="max-width:240px">
          <button type="button" class="fsh-btn" id="liGo">Estimate</button>
        </div>
        <div class="fsh-out" id="liOut"></div>`);

      document.getElementById('csGo').addEventListener('click', () => {
        const out = document.getElementById('csOut');
        const parse = (id) => String((document.getElementById(id) || {}).value || '')
          .split(/[,\s]+/).filter(Boolean).map(Number);
        const O = parse('csO'), E = parse('csE');
        if (!O.length || O.length !== E.length) { out.innerHTML = '<span class="fsh-err">Give the same number of observed and expected values.</span>'; return; }
        if (O.some((x) => !isFinite(x)) || E.some((x) => !isFinite(x))) { out.innerHTML = '<span class="fsh-err">Numbers only.</span>'; return; }
        // Dividing by an expected value of zero would give Infinity and print a
        // confident nonsense answer, so it is refused rather than computed.
        if (E.some((x) => !(x > 0))) { out.innerHTML = '<span class="fsh-err">Expected values must be above zero — the formula divides by them.</span>'; return; }
        let chi = 0;
        const rows = O.map((o, i) => {
          const c = ((o - E[i]) ** 2) / E[i];
          chi += c;
          return ['Category ' + (i + 1), String(o), String(E[i]), (o - E[i]).toFixed(2), c.toFixed(3)];
        });
        const df = O.length - 1;
        const crit = CHI.find((r) => r[0] === df);
        const verdict = !crit
          ? `Look up the critical value for ${df} degrees of freedom — the table above stops at 20.`
          : chi >= crit[1]
            ? `χ² of ${chi.toFixed(3)} is greater than the critical value of ${crit[1]} at p = 0.05 with ${df} degrees of freedom, so reject the null hypothesis. The difference is significant.`
            : `χ² of ${chi.toFixed(3)} is less than the critical value of ${crit[1]} at p = 0.05 with ${df} degrees of freedom, so do not reject the null hypothesis. There is no significant difference.`;
        out.innerHTML = `<span class="big">χ² = ${chi.toFixed(3)}, df = ${df}</span>`
          + table(['', 'O', 'E', 'O − E', '(O−E)²/E'], rows, 420)
          + `<div class="fsh-note" style="margin-top:8px">${esc(verdict)}</div>`;
      });

      document.getElementById('liGo').addEventListener('click', () => {
        const out = document.getElementById('liOut');
        const n1 = num('liN1'), n2 = num('liN2'), n3 = num('liN3');
        if (![n1, n2, n3].every((x) => isFinite(x) && x > 0)) { out.innerHTML = '<span class="fsh-err">All three numbers must be above zero.</span>'; return; }
        if (n3 > n2) { out.innerHTML = '<span class="fsh-err">You cannot recapture more marked animals than you caught in the second sample.</span>'; return; }
        const N = (n1 * n2) / n3;
        out.innerHTML = `<span class="big">about ${Math.round(N).toLocaleString()} individuals</span>`
          + `<div class="fsh-note">(${n1} × ${n2}) ÷ ${n3} = ${N.toFixed(1)}. Round to a whole animal, and call it an estimate — it is one.</div>`;
      });
    }

    // ══ Pedigrees ══════════════════════════════════════════════════════════
    function pedigreeSVG() {
      const off = 'rgba(255,255,255,.05)';
      const on = 'var(--fsh-ink)';
      const box = (x, y, fill) => `<rect x="${x}" y="${y}" width="26" height="26" fill="${fill}" stroke="var(--fsh-ink-2)"/>`;
      const circ = (x, y, fill) => `<circle cx="${x + 13}" cy="${y + 13}" r="13" fill="${fill}" stroke="var(--fsh-ink-2)"/>`;
      return draw(470, 210, `
        ${box(20, 24, off)}${txt(33, 70, 'male', { size: 10 })}
        ${circ(80, 24, off)}${txt(93, 70, 'female', { size: 10 })}
        ${box(140, 24, on)}${txt(153, 70, 'affected', { size: 10 })}
        ${circ(200, 24, on)}${txt(213, 70, 'affected', { size: 10 })}
        <circle cx="273" cy="37" r="13" fill="${off}" stroke="var(--fsh-ink-2)"/>
        <path d="M273 24 a13 13 0 0 1 0 26 z" fill="${on}" stroke="var(--fsh-ink-2)"/>
        ${txt(273, 70, 'carrier', { size: 10 })}
        <polygon points="333,24 346,37 333,50 320,37" fill="${off}" stroke="var(--fsh-ink-2)"/>
        ${txt(333, 70, 'sex unknown', { size: 10 })}
        ${box(392, 24, off)}<line x1="388" y1="54" x2="422" y2="20" stroke="var(--fsh-ink-2)"/>
        ${txt(405, 70, 'deceased', { size: 10 })}

        ${box(60, 112, off)}${circ(160, 112, on)}
        <line x1="86" y1="125" x2="160" y2="125" stroke="var(--fsh-ink-2)"/>
        ${txt(123, 106, 'mating line', { size: 10 })}
        <line x1="123" y1="125" x2="123" y2="152" stroke="var(--fsh-ink-2)"/>
        <line x1="80" y1="152" x2="166" y2="152" stroke="var(--fsh-ink-2)"/>
        <line x1="80" y1="152" x2="80" y2="164" stroke="var(--fsh-ink-2)"/>
        <line x1="166" y1="152" x2="166" y2="164" stroke="var(--fsh-ink-2)"/>
        ${box(67, 164, off)}${circ(153, 164, on)}
        ${txt(123, 204, 'sibship line — children hang below their parents', { size: 10 })}

        <line x1="300" y1="120" x2="340" y2="120" stroke="var(--fsh-ink-2)"/>
        <line x1="300" y1="126" x2="340" y2="126" stroke="var(--fsh-ink-2)"/>
        ${txt(320, 110, 'double line', { size: 10 })}
        ${txt(320, 146, 'related parents', { size: 10 })}
        <path d="M300 186 l18 -12 M300 186 l7 -2 M300 186 l2 -7" stroke="var(--fsh-accent)" stroke-width="2"/>
        ${txt(326, 190, 'arrow marks the proband', { size: 10, anchor: 'start' })}`);
    }
    function renderPedigree(body) {
      body.innerHTML = card('Pedigree charts',
        'The symbols, and the handful of checks that identify any inheritance pattern.',
        `${label('The symbols', true)}
        ${fig(pedigreeSVG(), 'Generations are numbered with Roman numerals down the left, and individuals within a generation with Arabic numerals across. So "II-3" is the third person in the second generation.')}

        ${label('Working out the pattern')}
        ${list([
    ['Two unaffected parents with an affected child', 'It is recessive. Both parents must be carriers, which is the only way the allele can hide. This single deduction is usually worth the first mark.'],
    ['Affected people in every generation, each with an affected parent', 'It is dominant. A dominant allele cannot skip a generation, because you cannot carry it without showing it.'],
    ['Far more affected males than females', 'Suspect X-linked recessive. Males have only one X, so a single copy shows, while a female needs two.'],
    ['An affected father with an unaffected daughter', 'Rules out X-linked dominant — an affected father gives his only X to every daughter, so all of them would be affected.'],
    ['An affected father and an affected son', 'Rules out X-linked anything. Fathers pass sons a Y, not an X, so an X-linked trait can never go father to son.'],
    ['Only males, in every generation, father to every son', 'Y-linked. Rare, and easy to spot for exactly that reason.'],
  ])}

        ${label('The five patterns side by side')}
        ${table(['Pattern', 'Skips generations?', 'Sex bias', 'The giveaway'], [
    ['Autosomal recessive', 'Yes', 'None', 'Unaffected parents with an affected child'],
    ['Autosomal dominant', 'No', 'None', 'Every affected person has an affected parent'],
    ['X-linked recessive', 'Yes', 'Mostly males', 'Affected males, carrier mothers, never father to son'],
    ['X-linked dominant', 'No', 'More females', 'An affected father has all affected daughters and no affected sons'],
    ['Y-linked', 'No', 'Males only', 'Father to every son, and no daughters ever'],
  ], 640)}

        ${label('How to actually answer one')}
        <div class="fsh-note">Find a couple whose child differs from both of them — that settles dominant against recessive immediately. Then check whether any affected father has an affected son; if he does, it is autosomal. Only then start assigning genotypes, writing down the ones you are certain of first and using a dash for an unknown allele, as in A–. Work outwards from the individuals you are sure about.</div>`);
    }

    // ══ Viral replication ══════════════════════════════════════════════════
    function virusSVG() {
      return draw(470, 250, `
        <circle cx="235" cy="124" r="92" stroke="var(--fsh-line)" stroke-dasharray="5 5"/>
        ${txt(235, 20, 'Attachment → penetration', { size: 12, weight: '650' })}
        <circle cx="235" cy="52" r="18" fill="rgba(var(--fsh-accent-rgb),.25)" stroke="var(--fsh-accent)"/>
        ${txt(235, 57, 'phage', { size: 9 })}

        ${txt(378, 116, 'LYTIC', { size: 12, weight: '650', anchor: 'start' })}
        <path d="M305 80 q42 20 42 46" stroke="var(--fsh-accent)" stroke-width="2"/>
        ${txt(378, 138, 'biosynthesis', { size: 10, anchor: 'start' })}
        ${txt(378, 154, 'assembly', { size: 10, anchor: 'start' })}
        ${txt(378, 170, 'lysis — host bursts', { size: 10, anchor: 'start' })}

        ${txt(92, 116, 'LYSOGENIC', { size: 12, weight: '650', anchor: 'end' })}
        <path d="M165 80 q-42 20 -42 46" stroke="var(--fsh-ink-2)" stroke-width="2"/>
        ${txt(92, 138, 'integrates as a prophage', { size: 10, anchor: 'end' })}
        ${txt(92, 154, 'copied with the host', { size: 10, anchor: 'end' })}
        ${txt(92, 170, 'host unharmed', { size: 10, anchor: 'end' })}

        <path d="M125 198 q110 38 220 0" stroke="var(--fsh-accent)" stroke-width="2" stroke-dasharray="6 4"/>
        ${txt(235, 240, 'induction — stress or UV switches it to lytic', { size: 10 })}`);
    }
    function renderVirus(body) {
      body.innerHTML = card('Lytic and lysogenic cycles',
        'Two things a bacteriophage can do once it is inside, and what decides which.',
        `${fig(virusSVG(), 'Both cycles start identically. The difference is what happens to the viral genome once it is in: used immediately, or filed away in the host chromosome and copied along with it.')}

        ${label('The lytic cycle — five stages')}
        ${table(['Stage', 'What happens'], [
    ['1. Attachment', 'Tail fibres bind to specific receptor proteins on the bacterial cell wall. That specificity is why a phage infects one species and not another.'],
    ['2. Penetration', 'The tail sheath contracts and the viral nucleic acid is injected. The capsid stays outside — which is exactly what the Hershey–Chase experiment showed.'],
    ['3. Biosynthesis', 'Host DNA is broken down. The host’s own ribosomes, enzymes and nucleotides are hijacked to make viral proteins and copies of the viral genome.'],
    ['4. Assembly', 'New capsids self-assemble around the new genomes. Nothing directs this; the parts fit together spontaneously.'],
    ['5. Lysis', 'Lysozyme breaks down the cell wall, the cell bursts, and 100–200 new phages are released to infect the neighbours.'],
  ], 620)}

        ${label('The lysogenic cycle')}
        ${table(['Stage', 'What happens'], [
    ['1–2. Attachment and penetration', 'Identical to the lytic cycle.'],
    ['3. Integration', 'The viral genome is inserted into the bacterial chromosome, where it is called a prophage. It then sits there silently.'],
    ['4. Replication', 'Every time the bacterium divides by binary fission it copies the prophage too, so a whole colony ends up carrying it. No new virus particles are made and the host is unharmed.'],
    ['5. Induction', 'A trigger — often UV light, radiation or chemical stress — excises the prophage, and it enters the lytic cycle.'],
  ], 620)}

        ${label('Telling them apart in an answer')}
        ${list([
    ['Speed', 'Lytic is fast and can finish in under an hour. Lysogenic can persist for thousands of generations.'],
    ['The host', 'Lytic kills it. Lysogenic does not, and the bacterium goes on living and dividing normally.'],
    ['New virus particles', 'Lytic makes them straight away. Lysogenic makes none at all until induction.'],
    ['Virulent vs temperate', 'A phage that can only do lytic is virulent — T4 is the standard example. One that can do both is temperate — lambda phage is the one in every textbook.'],
    ['Why lysogeny is useful to the virus', 'It is a way of surviving when hosts are scarce. Rather than burning through the last few bacteria, it hides in the genome and rides along until conditions improve.'],
    ['Lysogenic conversion', 'A prophage sometimes carries genes that change the host. The diphtheria, cholera and botulism toxins are all encoded by prophages — those bacteria are only dangerous because they are themselves infected.'],
  ])}
        <div class="fsh-note" style="margin-top:10px">HIV does something similar in human cells: reverse transcriptase makes DNA from its RNA genome, and integrase splices that into the host chromosome as a provirus. It is why the infection is lifelong, and why antiretrovirals suppress rather than cure it.</div>`);
    }

    /* ⬡ ⌁ 𝝌 ⚭ ☣ are plain text glyphs rather than emoji. flux-iconify only has
       SVGs for the emoji in its map and falls back to a featureless dot for
       everything else, so five of these tabs would have shared one grey circle.
       Text glyphs are also never swapped after paint, so these tabs never
       change width underneath the sliding highlight. */
    H.register('biology', [
      { id: 'micro', name: 'Microscopy', icon: '🔍', desc: 'microscopy magnification resolution light electron tem sem scale bar graticule stage micrometer drawing', render: renderMicroscopy },
      { id: 'biounits', name: 'Units & scale', icon: '📏', desc: 'unit conversion si prefixes micrometre nanometre dm3 concentration mol volume size scale', render: renderUnits },
      { id: 'carbs', name: 'Polysaccharides', icon: '⬡', desc: 'polysaccharide starch amylose amylopectin glycogen cellulose chitin glycosidic alpha beta glucose structural', render: renderCarbs },
      { id: 'lipids', name: 'Fatty acids', icon: '⌁', desc: 'lipid fatty acid saturated unsaturated cis trans triglyceride phospholipid ester bilayer omega', render: renderLipids },
      { id: 'biostats', name: 'Stats', icon: '𝝌', desc: 'chi squared table critical value lincoln index capture recapture significance null hypothesis degrees of freedom', render: renderStats },
      { id: 'pedigree', name: 'Pedigrees', icon: '⚭', desc: 'pedigree chart symbols autosomal recessive dominant x-linked carrier proband inheritance', render: renderPedigree },
      { id: 'virus', name: 'Viral cycles', icon: '☣', desc: 'lytic lysogenic cycle bacteriophage prophage induction temperate virulent lambda t4 hiv provirus', render: renderVirus },
    ]);
  }
  boot();
})();
