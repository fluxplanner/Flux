/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table — flux-ptable-explore.js
   ------------------------------------------------------------------------
   The tabs that go deeper into one element, for IB Diploma chemistry
   (Structure 1.2 and 1.3 especially). Pick an element on the small table
   beside each one.

     Electrons   the configuration, an energy-level diagram with every
                 orbital box filled, its ions (which electrons go first),
                 and where the Aufbau order is broken (chromium, copper…).
     Spectra     the element's real line spectrum, spectra side by side,
                 and hydrogen's energy levels: every Lyman, Balmer and
                 Paschen line worked out, and the convergence limit.
     Isotopes    the mass spectrum, how it averages to the relative atomic
                 mass, and the molecular-ion peaks of Cl₂, Br₂ and friends.
     3D          the Bohr model to turn round, and the orbitals' shapes
                 (flux-ptable-atom3d.js).

   The calculations are pure and unit-tested; the data is NIST's
   (flux-ptable-data.js). Registers itself as window.FluxPTableExplore.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxPTableExplore) return;

  const K = () => window.FluxPTable.core;
  const C = () => window.FluxChem;

  /* ── Electrons (pure) ───────────────────────────────────────────────── */

  const CAP = { s: 2, p: 6, d: 10, f: 14 };
  /** Where z electrons would go by the Aufbau order alone. */
  function aufbauOcc(z) {
    const occ = {};
    let left = z;
    for (const x of C().AUFBAU) {
      if (left <= 0) break;
      const put = Math.min(CAP[x.k[1]], left);
      occ[x.k] = put;
      left -= put;
    }
    return occ;
  }
  function sameOcc(a, b) {
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
    return true;
  }
  /** How this atom breaks the Aufbau order, or null when it follows it. */
  function exception(e) {
    let occ;
    try { occ = C().occupancy(e.ec); } catch (err) { return null; }
    const pred = aufbauOcc(e.n);
    if (sameOcc(occ, pred)) return null;
    const moved = Object.keys(Object.assign({}, occ, pred)).filter((k) => (occ[k] || 0) !== (pred[k] || 0));
    const dKey = moved.find((k) => k[1] === 'd');
    const dNow = dKey ? occ[dKey] || 0 : null;
    return {
      predicted: C().configText(pred).short,
      actual: C().configText(occ).short,
      halfOrFull: dKey != null && (dNow === 5 || dNow === 10),
      dCount: dNow,
    };
  }
  /** Energy-level diagram rows: every subshell in filling order up to the last one used, with its boxes. */
  function levelRows(occ) {
    const A = C().AUFBAU;
    let last = -1;
    A.forEach((x, i) => { if ((occ[x.k] || 0) > 0) last = i; });
    return A.slice(0, last + 1).map((x) => {
      const e = occ[x.k] || 0, boxes = CAP[x.k[1]] / 2, out = [];
      for (let b = 0; b < boxes; b++) out.push((e > b ? 1 : 0) + (e > boxes + b ? 1 : 0));
      return { sub: x.k, n: x.n, l: x.l, e: e, boxes: out };
    });
  }
  function lastFilled(occ) {
    let last = null;
    C().AUFBAU.forEach((x) => { if ((occ[x.k] || 0) > 0) last = x.k; });
    return last;
  }
  /** Why an element sits in its group, from its configuration. */
  function groupWhy(e, occ) {
    const outer = Math.max.apply(null, Object.keys(occ).map((k) => +k[0]));
    const ns = occ[outer + 's'] || 0, np = occ[outer + 'p'] || 0, d = occ[(outer - 1) + 'd'] || 0;
    const b = K().block(e);
    if (b === 's') return ns + ' electron' + (ns > 1 ? 's' : '') + ' in the outer s subshell';
    if (b === 'p') return ns + ' s + ' + np + ' p outer electrons: 10 + ' + (ns + np);
    if (b === 'd') return ns + ' s + ' + d + ' d electrons beyond the noble-gas core';
    return '';
  }

  /* ── Hydrogen (pure) ────────────────────────────────────────────────── */

  const H_IE = 13.598434;             // eV, NIST: hydrogen's ionization energy, = R_H·hc
  const HC = 1239.84198;              // eV·nm
  const KJ = 96.4853321233;           // kJ/mol in one eV per atom
  const C_LIGHT = 299792458;          // m/s
  /** Energy of level n in eV, zero at n = ∞. */
  const hLevel = (n) => -H_IE / (n * n);
  /** The photon given out falling from level hi to level lo: vacuum wavelength (nm), energy (eV and kJ/mol), frequency (Hz). */
  function hLine(hi, lo) {
    const eV = H_IE * (1 / (lo * lo) - (hi === Infinity ? 0 : 1 / (hi * hi)));
    const nm = HC / eV;
    return { eV: eV, kJ: eV * KJ, nm: nm, air: nm > 200 ? nm / 1.000277 : nm, hz: C_LIGHT / (nm * 1e-9) };
  }
  const SERIES = [[1, 'Lyman', 'ultraviolet'], [2, 'Balmer', 'visible'], [3, 'Paschen', 'infrared']];
  function region(nm) { return nm < 380 ? 'ultraviolet' : nm <= 750 ? 'visible' : 'infrared'; }

  /* ── Isotopes (pure) ────────────────────────────────────────────────── */

  /** Mass numbers of X₂ molecules and the share of each, from the atom's isotopes [[A, mass, abundance], …]. */
  function diatomicPeaks(iso) {
    const by = {};
    for (let i = 0; i < iso.length; i++) {
      for (let j = i; j < iso.length; j++) {
        const A = iso[i][0] + iso[j][0];
        by[A] = (by[A] || 0) + iso[i][2] * iso[j][2] * (i === j ? 1 : 2);
      }
    }
    return Object.keys(by).map((A) => [+A, by[A]]).sort((a, b) => a[0] - b[0]);
  }
  const DIATOMIC = ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'];

  /** What the 3D model is built from: electrons per shell, and the nucleus of the most common isotope. */
  function atomParts(e) {
    let occ;
    try { occ = C().occupancy(e.ec); } catch (err) { occ = {}; }
    const iso = e.x.iso;
    let A;
    if (iso && iso.length) A = iso.reduce((a, b) => (b[2] > a[2] ? b : a))[0];
    else if (e.x.hl) A = e.x.hl[0];
    else A = Math.round(e.mass);
    return { occ: occ, Z: e.n, A: A, shells: window.FluxAtom3D.shellCounts(occ) };
  }

  /* ── Shared bits ────────────────────────────────────────────────────── */

  const esc = (s) => K().esc(s);
  const sup = (q) => C().toSup((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
  const row = (k, v) => '<div class="fpt-kv"><span>' + k + '</span><b>' + v + '</b></div>';
  function head(e, extra) {
    return '<div class="fpx-head"><div class="fpt-tile fpx-tile" style="--c:' + K().CAT[e.cat].colour + '"><span class="fpt-tile-n">' + e.n + '</span><span class="fpt-tile-s">' + esc(e.s) + '</span><span class="fpt-tile-m">' + esc(K().massText(e)) + '</span></div>'
      + '<div class="fpx-hname"><h2>' + esc(e.name) + '</h2><span>' + (extra || '') + '</span></div>'
      + '<div class="fpx-step"><button type="button" class="fpt-ibtn" data-act="step" data-d="-1" aria-label="Previous element"' + (e.n === 1 ? ' disabled' : '') + '>‹</button>'
      + '<button type="button" class="fpt-ibtn" data-act="step" data-d="1" aria-label="Next element"' + (e.n === 118 ? ' disabled' : '') + '>›</button></div></div>';
  }
  const seg = (items, act, cur, attr) => '<div class="fpt-seg">' + items.map((m) => '<button type="button" class="fpt-chip' + (cur === m[0] ? ' is-on' : '') + '" data-act="' + act + '" data-' + (attr || 'mode') + '="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>';

  /* ── Electrons ──────────────────────────────────────────────────────── */

  function electronsHTML(app, e) {
    const st = app.st, F = C();
    let atom;
    try { atom = F.occupancy(e.ec); } catch (err) { return head(e) + '<p class="fpt-lead">No configuration is on record for ' + esc(e.name) + '.</p>'; }
    const ions = K().oxStates(e).filter((q) => q !== 0 && Math.abs(q) <= 4 && (q < 0 ? e.n - q <= 118 : q <= e.n));
    const q = ions.indexOf(st.ion) >= 0 ? st.ion : 0;
    let occ = atom;
    const lost = {};
    if (q) {
      try {
        occ = F.ionConfig(e.ec, e.n, q).occ;
        Object.keys(atom).forEach((k) => { if ((atom[k] || 0) > (occ[k] || 0)) lost[k] = atom[k] - (occ[k] || 0); });
      } catch (err) { occ = atom; }
    }
    const t = F.configText(occ, { filling: st.filling });
    const label = q ? e.s + sup(q) : e.s;
    const electrons = e.n - q;
    let h = head(e, 'Z = ' + e.n + ' · ' + electrons + ' electron' + (electrons === 1 ? '' : 's') + (q ? ' in ' + esc(label) : ''));
    h += '<div class="fpx-chips" role="group" aria-label="The atom or one of its ions">'
      + [0].concat(ions).map((c) => '<button type="button" class="fpt-chip' + (c === q ? ' is-on' : '') + '" data-act="xion" data-q="' + c + '">' + esc(c ? e.s + sup(c) : e.s + ' atom') + '</button>').join('') + '</div>';
    h += '<div class="fpt-config"><div class="fpt-config-t">' + esc(t.short) + '</div>'
      + (t.full !== t.short ? '<div class="fpt-config-f">' + esc(t.full) + '</div>' : '')
      + '<button type="button" class="fpt-link" data-act="order">' + (st.filling ? 'Show in shell order' : 'Show in filling order (4s before 3d)') + '</button></div>';
    if (q > 0 && Object.keys(lost).length) {
      // In the order they leave: outermost shell first.
      const from = Object.keys(lost).sort((a, b) => (+b[0] - +a[0]) || ('spdf'.indexOf(b[1]) - 'spdf'.indexOf(a[1])))
        .map((k) => lost[k] + ' from ' + k).join(' and ');
      const outerS = Math.max.apply(null, Object.keys(atom).map((k) => +k[0])) + 's';
      h += '<p class="fpx-note">' + esc(e.s) + ' → ' + esc(label) + ': electrons leave the outermost shell first — ' + esc(from) + '.'
        + (K().block(e) === 'd' && lost[outerS] ? ' That is why a transition metal loses its ' + outerS + ' electrons before its d electrons, although ' + outerS + ' filled first.' : '') + '</p>';
    } else if (q < 0) {
      h += '<p class="fpx-note">' + esc(label) + ' has gained ' + (-q) + ' electron' + (q < -1 ? 's' : '') + ', into the next spaces in the Aufbau order'
        + (F.configText(occ).core && Object.keys(occ).every((k) => (occ[k] || 0) === CAP[k[1]]) ? ' — it now has the configuration of a noble gas' : '') + '.</p>';
    }
    const ex = !q && exception(e);
    if (ex) {
      h += '<div class="fpx-warn"><b>An exception to the Aufbau order.</b> Filling in order predicts <code>' + esc(ex.predicted) + '</code>, but ' + esc(e.name.toLowerCase()) + ' is <code>' + esc(ex.actual) + '</code>. '
        + (ex.halfOrFull
          ? 'A ' + (ex.dCount === 5 ? 'half-full (d⁵)' : 'full (d¹⁰)') + ' d subshell is especially stable, so an s electron moves into the d subshell.'
          : 'In heavy atoms the subshells are so close in energy that the order shifts. Chromium and copper are the two exceptions to know.') + '</div>';
    }
    const rows = levelRows(occ);
    const orbs = F.orbitals(occ);
    const unpaired = orbs.reduce((a, o) => a + o.unpaired, 0);
    const shells = window.FluxAtom3D ? window.FluxAtom3D.shellCounts(occ) : [];
    const outer = Math.max.apply(null, Object.keys(atom).map((k) => +k[0]));
    const why = groupWhy(e, atom);
    h += '<div class="fpx-cols"><section class="fpx-card"><h3>Energy levels</h3>' + levelSVG(rows, lost)
      + '<p class="fpt-note">Each box is an orbital: two electrons at most, with opposite spins. Within a subshell they go in one to a box first (Hund\'s rule), then pair up.</p></section>'
      + '<section class="fpx-card"><h3>What it tells you</h3><div class="fpt-kvs">'
      + row('Electrons per shell', shells.join(', '))
      + row('Unpaired electrons', unpaired + (unpaired ? ' — paramagnetic' : ' — diamagnetic'))
      + (q ? '' : row('Period', outer + ' <small>(outer shell n = ' + outer + ')</small>'))
      + (q || !e.g ? '' : row('Group', e.g + (why ? ' <small>(' + esc(why) + ')</small>' : '')))
      + (q ? '' : row('Block', K().block(e) + '-block <small>(last electron into ' + esc(lastFilled(atom) || '—') + ')</small>'))
      + '</div><div class="fpt-bohr fpx-bohr">' + K().bohrSVG(Object.assign({}, e, { ec: t.full })) + '</div>'
      + '<button type="button" class="fpt-chip" data-act="view" data-view="3d">Turn it round in 3D →</button></section></div>';
    return h;
  }
  /** Orbital boxes stacked by energy, lowest at the bottom: the Aufbau diagram. */
  function levelSVG(rows, lost) {
    const BOX = 26, ROW = 34, L = 44, W = L + 7 * BOX + 64, H = rows.length * ROW + 22;
    let s = '<div class="fpx-levels"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Orbital energy-level diagram">';
    rows.forEach((r, i) => {
      const y = H - (i + 1) * ROW;
      const gone = lost && lost[r.sub];
      s += '<text x="' + (L - 8) + '" y="' + (y + 18) + '" class="fpx-lvl-t">' + r.sub + '</text>';
      r.boxes.forEach((b, j) => {
        const x = L + j * BOX;
        s += '<rect x="' + x + '" y="' + (y + 2) + '" width="' + BOX + '" height="' + (BOX - 2) + '" class="fpx-box' + (gone ? ' is-lost' : '') + (r.e ? '' : ' is-empty') + '"/>';
        if (b >= 1) s += '<path d="M' + (x + 9) + ' ' + (y + 21) + 'V' + (y + 7) + 'm-3.5 4 3.5-4 3.5 4" class="fpx-up"/>';
        if (b === 2) s += '<path d="M' + (x + 17) + ' ' + (y + 7) + 'V' + (y + 21) + 'm-3.5-4 3.5 4 3.5-4" class="fpx-up"/>';
      });
      s += '<text x="' + (L + r.boxes.length * BOX + 8) + '" y="' + (y + 18) + '" class="fpx-lvl-e">' + r.e + (gone ? ' (−' + gone + ')' : '') + '</text>';
    });
    s += '<text x="2" y="12" class="fpx-lvl-ax">energy ↑</text>';
    return s + '</svg></div>';
  }

  /* ── Spectra ────────────────────────────────────────────────────────── */

  function fix(nm) { return nm >= 1000 ? Math.round(nm).toLocaleString('en') : nm.toFixed(1); }
  function sci(v) { const x = Math.floor(Math.log10(v)); return (v / Math.pow(10, x)).toFixed(2) + ' × 10' + C().toSup(String(x)); }
  function lineColour(nm) {
    const r = region(nm);
    return r === 'visible' ? K().wlColour(nm) : r === 'ultraviolet' ? '#a78bfa' : '#f87171';
  }

  function spectraHTML(app, e) {
    const st = app.st, core = K();
    let h = head(e, e.x.ln ? e.x.ln.length + ' visible lines on record (NIST)' : 'no visible lines on record');
    h += '<section class="fpx-card"><h3>' + esc(e.name) + '\'s line spectrum</h3>';
    if (e.x.ln) {
      h += '<div class="fpx-row">' + seg([['emission', 'Emission'], ['absorption', 'Absorption']], 'spectrum', st.spectrum)
        + (st.compare.indexOf(e.n) < 0 ? '<button type="button" class="fpt-chip" data-act="cmpadd">+ Add to the comparison</button>' : '') + '</div>'
        + core.spectrumSVG(e, e.x.ln, st.spectrum);
      const strongest = e.x.ln.slice().sort((a, b) => b[1] - a[1]).slice(0, 6).sort((a, b) => a[0] - b[0]);
      h += '<div class="fpt-lines">' + strongest.map((l) => '<span><i style="background:' + core.wlColour(l[0]) + '"></i>' + l[0].toFixed(1) + ' nm <small>' + (HC / l[0]).toFixed(2) + ' eV</small></span>').join('') + '</div>'
        + '<p class="fpt-note">Emission: light given out as electrons fall to lower levels. Absorption: the same wavelengths missing from white light shone through the cold gas. Wavelengths in air.</p>';
    } else h += '<p class="fpt-lead">No visible emission lines are on record for ' + esc(e.name) + '.</p>';
    h += '</section>';
    const cmp = st.compare.map((n) => core.model()[n - 1]).filter((x) => x && x.x.ln);
    if (cmp.length) {
      h += '<section class="fpx-card"><h3>Side by side</h3><div class="fpx-cmp">' + cmp.map((x, i) => '<div class="fpx-cmp-row">'
        + '<button type="button" class="fpx-cmp-l" data-act="goto" data-n="' + x.n + '"><b>' + esc(x.s) + '</b><span>' + esc(x.name) + '</span></button>'
        + core.spectrumSVG(x, x.x.ln, 'emission', { h: 30, axis: i === cmp.length - 1 })
        + '<button type="button" class="fpt-ibtn" data-act="cmpdel" data-n="' + x.n + '" aria-label="Take ' + esc(x.name) + ' out">✕</button></div>').join('') + '</div>'
        + '<p class="fpt-note">No two elements share a set of lines — which is how helium was found in the Sun\'s light before anyone had seen it on Earth.</p></section>';
    }
    return h + hydrogenHTML(st);
  }

  function hydrogenHTML(st) {
    const lo = st.hLo, hi = st.hHi;
    const line = hLine(hi, lo);
    const ser = SERIES.find((x) => x[0] === lo);
    const reg = region(line.nm);
    let h = '<section class="fpx-card"><h3>Hydrogen\'s energy levels</h3>'
      + seg(SERIES.map((x) => [x[0], x[1] + ' <small>→ n = ' + x[0] + ', ' + x[2] + '</small>']), 'hseries', lo, 'lo')
      + '<div class="fpx-hcols">' + levelsDiagram(lo, hi) + '<div class="fpx-hside">'
      + '<div class="fpx-result"><i style="background:' + lineColour(line.nm) + '"></i><div>'
      + '<b>n = ' + (hi === Infinity ? '∞' : hi) + ' → n = ' + lo + '</b>'
      + '<span>λ = ' + fix(line.nm) + ' nm' + (reg === 'visible' ? ' <small>(' + fix(line.air) + ' nm in air)</small>' : '') + ' · ' + reg + '</span>'
      + '<span>ΔE = ' + line.eV.toFixed(3) + ' eV per atom = ' + Math.round(line.kJ) + ' kJ/mol</span>'
      + '<span>f = ' + sci(line.hz) + ' Hz</span></div></div>'
      + '<div class="fpt-work">1/λ = R<sub>H</sub> (1/' + lo + '² − ' + (hi === Infinity ? '0' : '1/' + hi + '²') + ') &nbsp;·&nbsp; ΔE = hc/λ = hf</div>'
      + '<div class="fpx-uppers" role="group" aria-label="Upper level">' + [2, 3, 4, 5, 6, 7, Infinity].filter((n) => n > lo).map((n) => '<button type="button" class="fpt-chip' + (n === hi ? ' is-on' : '') + '" data-act="hhi" data-hi="' + (n === Infinity ? 'inf' : n) + '">from n = ' + (n === Infinity ? '∞' : n) + '</button>').join('') + '</div>'
      + seriesStrip(lo, hi) + '</div></div>';
    const limit = hLine(Infinity, lo);
    h += '<p class="fpt-note">The ' + ser[1] + ' lines crowd together towards <b>' + fix(limit.nm) + ' nm</b>, the convergence limit: an electron falling from the very edge of the atom (n = ∞). '
      + (lo === 1 ? 'Its energy, ' + limit.eV.toFixed(2) + ' eV = <b>' + Math.round(limit.kJ) + ' kJ/mol</b>, is hydrogen\'s first ionization energy — the energy to take the electron right out from n = 1.' : 'The levels get closer together as n rises, which is why the lines converge.')
      + ' Wavelengths are for a vacuum; the levels are spaced for reading, not to scale.</p></section>';
    return h;
  }

  function levelsDiagram(lo, hi) {
    const W = 250, H = 260, top = 16, bot = H - 14;
    // Spaced by 1/n rather than 1/n², or n = 3 to ∞ crowd into the top tenth.
    const y = (E) => top + Math.sqrt(E / hLevel(1)) * (bot - top);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fpx-hlev" role="img" aria-label="Hydrogen energy levels">';
    [1, 2, 3, 4, 5, 6, Infinity].forEach((n) => {
      const E = n === Infinity ? 0 : hLevel(n);
      const yy = y(E);
      s += '<line x1="72" x2="' + (W - 6) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="fpx-hl' + (n === Infinity ? ' is-inf' : '') + '"/>';
      if (n <= 4 || n === Infinity) {
        s += '<text x="66" y="' + (yy + 4).toFixed(1) + '" class="fpx-hl-t">' + (n === Infinity ? 'n = ∞' : 'n = ' + n) + '</text>'
          + '<text x="' + (W - 6) + '" y="' + (yy - 3).toFixed(1) + '" class="fpx-hl-e">' + (n === Infinity ? '0 eV' : E.toFixed(2) + ' eV') + '</text>';
      }
    });
    // Every line of the chosen series, the chosen one drawn bold.
    const uppers = [2, 3, 4, 5, 6, 7, Infinity].filter((n) => n > lo);
    uppers.forEach((n, i) => {
      const x = 86 + i * ((W - 150) / Math.max(1, uppers.length - 1));   // clear of the eV labels on the right
      const y1 = y(n === Infinity ? 0 : hLevel(n)), y2 = y(hLevel(lo));
      const l = hLine(n, lo), col = lineColour(l.nm), on = n === hi;
      s += '<g class="fpx-tr' + (on ? ' is-on' : '') + '" data-act="hhi" data-hi="' + (n === Infinity ? 'inf' : n) + '">'
        + '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + y1.toFixed(1) + '" y2="' + (y2 - 6).toFixed(1) + '" stroke="' + col + '"/>'
        + '<path d="M' + (x - 4).toFixed(1) + ' ' + (y2 - 8).toFixed(1) + 'l4 7 4-7z" fill="' + col + '"/>'
        + '<rect x="' + (x - 8).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="16" height="' + Math.max(8, y2 - y1).toFixed(1) + '" fill="transparent"><title>n = ' + (n === Infinity ? '∞' : n) + ' → ' + lo + ': ' + fix(l.nm) + ' nm</title></rect></g>';
    });
    return s + '</svg>';
  }
  /** The series' lines on a wavelength scale, crowding towards the limit. */
  function seriesStrip(lo, hi) {
    const lines = [];
    for (let n = lo + 1; n <= lo + 14; n++) lines.push([n, hLine(n, lo).nm]);
    const limit = hLine(Infinity, lo).nm, first = lines[0][1];
    const a = limit - (first - limit) * 0.08, b = first + (first - limit) * 0.08;
    const W = 340, H = 46, x = (nm) => (1 - (nm - a) / (b - a)) * W;
    let s = '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" class="fpx-strip" role="img" aria-label="The lines of the series"><rect width="' + W + '" height="' + H + '" rx="6" class="fpx-strip-bg"/>';
    lines.forEach((l) => {
      const on = l[0] === hi;
      s += '<rect x="' + (x(l[1]) - (on ? 1.4 : 0.8)).toFixed(1) + '" y="4" width="' + (on ? 2.8 : 1.6) + '" height="' + (H - 8) + '" fill="' + lineColour(l[1]) + '" opacity="' + (on ? 1 : Math.max(0.3, 1 - (l[0] - lo - 1) * 0.07)).toFixed(2) + '"/>';
    });
    const lab = (xx, t) => '<text x="' + xx.toFixed(1) + '" y="' + (H + 12) + '" class="fpt-ax" style="text-anchor:' + (xx > W - 50 ? 'end' : xx < 50 ? 'start' : 'middle') + '">' + t + '</text>';
    s += '<line x1="' + x(limit).toFixed(1) + '" x2="' + x(limit).toFixed(1) + '" y1="0" y2="' + H + '" class="fpx-limit"/>'
      + lab(x(limit), 'limit ' + fix(limit) + ' nm') + lab(x(first), fix(first) + ' nm');
    return s + '</svg><p class="fpt-note">Shorter wavelength and higher energy to the right →</p>';
  }

  /* ── Isotopes ───────────────────────────────────────────────────────── */

  function isotopesHTML(app, e) {
    const st = app.st, core = K(), iso = e.x.iso;
    let h = head(e, iso ? iso.length + ' stable isotope' + (iso.length === 1 ? '' : 's') : 'no stable isotopes');
    if (!iso) {
      h += '<section class="fpx-card"><p class="fpt-lead">' + esc(e.name) + ' has no stable isotopes' + (e.x.abC ? ' — what exists in nature is left over from, or made by, radioactive decay' : ' — it is made, not found') + '.</p>';
      if (e.x.hl) h += '<div class="fpt-kvs">' + row('Longest-lived isotope', esc(e.s + '-' + e.x.hl[0]) + ' <small>(' + e.n + ' protons, ' + (e.x.hl[0] - e.n) + ' neutrons)</small>') + row('Half-life', esc(core.halfText(e.x.hl[1])) + (e.x.hl[3] ? ' <small>(estimated)</small>' : '')) + '</div>';
      return h + '<p class="fpt-note">Its relative atomic mass is given in brackets — the mass number of that isotope — because there is no natural mixture to average.</p></section>';
    }
    const rel = st.isoMode === 'rel';
    const max = Math.max.apply(null, iso.map((x) => x[2]));
    h += '<section class="fpx-card"><h3>Mass spectrum</h3>'
      + seg([['pct', '% abundance'], ['rel', 'Relative to the tallest peak']], 'isomode', st.isoMode)
      + massSpectrum(iso.map((x) => [x[0], rel ? x[2] / max * 100 : x[2] * 100]), rel ? 'relative abundance' : '% abundance', e.s)
      + '<p class="fpt-note">Each peak is one isotope, at its mass-to-charge ratio (m/z) as a 1+ ion; its height is how common it is.</p></section>';
    const pct = (a) => (a * 100 >= 0.01 ? core.trim0((a * 100).toFixed(a >= 0.1 ? 2 : 3)) : core.fmt(a * 100, 2));
    const sum = iso.reduce((a, x) => a + x[1] * x[2], 0);
    h += '<section class="fpx-card"><h3>Relative atomic mass</h3>';
    if (iso.length > 1) {
      const big = iso.filter((x) => x[2] >= 0.001);
      h += '<div class="fpt-work">A<sub>r</sub> = Σ (isotope mass × % abundance) ÷ 100<br>= [' + big.map((x) => '(' + x[1].toFixed(2) + ' × ' + pct(x[2]) + ')').join(' + ') + '] ÷ 100<br>= <b>' + sum.toFixed(3) + '</b></div>'
        + '<p class="fpt-note">With whole mass numbers instead, as exam questions often give them, it comes to ' + iso.reduce((a, x) => a + x[0] * x[2], 0).toFixed(2) + '. The data booklet gives ' + esc(core.massText(e)) + '.</p>';
    } else h += '<p class="fpt-lead">One stable isotope, so its relative atomic mass is that isotope\'s mass: ' + iso[0][1].toFixed(4) + '.</p>';
    h += '<table class="fpt-iso"><thead><tr><th>Isotope</th><th>Protons</th><th>Neutrons</th><th>Mass</th><th>Abundance</th></tr></thead><tbody>'
      + iso.map((x) => '<tr><td><sup>' + x[0] + '</sup>' + esc(e.s) + '</td><td>' + e.n + '</td><td>' + (x[0] - e.n) + '</td><td>' + x[1].toFixed(4) + '</td><td>' + pct(x[2]) + '%</td></tr>').join('')
      + '</tbody></table><p class="fpt-note">Isotopes have the same protons and electrons, so the same chemistry; only the number of neutrons differs.</p></section>';
    if (DIATOMIC.indexOf(e.s) >= 0) {
      const peaks = diatomicPeaks(iso).filter((p) => p[1] >= 0.001);
      const least = Math.min.apply(null, peaks.map((p) => p[1]));
      const ratio = peaks.map((p) => core.trim0((p[1] / least).toFixed(p[1] / least >= 10 ? 0 : 1))).join(' : ');
      h += '<section class="fpx-card"><h3>' + esc(e.s) + '₂ molecules</h3>'
        + massSpectrum(peaks.map((p) => [p[0], p[1] * 100]), '% of molecules', e.s + '₂')
        + '<p class="fpt-note">' + (peaks.length > 1 ? 'Molecular-ion peaks at m/z ' + peaks.map((p) => p[0]).join(', ') + ', in the ratio <b>' + ratio + '</b>'
          + (e.s === 'Cl' ? ' — 9 : 6 : 1 if you round ³⁵Cl : ³⁷Cl to 3 : 1' : e.s === 'Br' ? ' — about 1 : 2 : 1, because its two isotopes are almost equally common' : '') + '. '
          : 'Almost every molecule has the same mass. ')
        + 'A real spectrum also shows ' + esc(e.s) + '⁺ peaks from molecules that broke apart.</p></section>';
    }
    return h;
  }
  function massSpectrum(bars, yLabel, what) {
    const W = 420, H = 190, L = 40, B = 30, T = 16, R = 12;
    const ms = bars.map((b) => b[0]);
    const lo = Math.min.apply(null, ms) - 2, hi = Math.max.apply(null, ms) + 2;
    const top = Math.max.apply(null, bars.map((b) => b[1]));
    const ymax = top > 50 ? 100 : Math.ceil(top / 10) * 10 || 10;
    const x = (m) => L + (m - lo) / (hi - lo) * (W - L - R);
    const y = (v) => H - B - v / ymax * (H - B - T);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fpx-ms" role="img" aria-label="Mass spectrum of ' + esc(what) + '">';
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
      const v = ymax * f;
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="fpt-grid-l"/><text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" class="fpt-ax">' + K().trim0(v.toFixed(1)) + '</text>';
    });
    const step = hi - lo > 24 ? 5 : hi - lo > 12 ? 2 : 1;
    for (let m = Math.ceil(lo); m <= hi; m++) if (m % step === 0) s += '<text x="' + x(m).toFixed(1) + '" y="' + (H - B + 13) + '" class="fpt-ax fpt-ax--x">' + m + '</text>';
    const bw = Math.max(3, Math.min(10, (W - L - R) / (hi - lo) * 0.35));
    bars.forEach((b) => {
      s += '<rect x="' + (x(b[0]) - bw / 2).toFixed(1) + '" y="' + y(b[1]).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (H - B - y(b[1])).toFixed(1) + '" class="fpx-bar" data-mz="' + b[0] + '"><title>m/z ' + b[0] + ': ' + K().fmt(b[1], 3) + '</title></rect>';
      if (b[1] / ymax > 0.004) s += '<text x="' + x(b[0]).toFixed(1) + '" y="' + (y(b[1]) - 4).toFixed(1) + '" class="fpx-bar-t">' + K().fmt(b[1], 3) + '</text>';
    });
    s += '<text x="' + ((W + L) / 2) + '" y="' + (H - 2) + '" class="fpt-ax fpt-ax--x">m/z</text>'
      + '<text x="4" y="10" class="fpt-ax fpx-ylab">' + esc(yLabel) + '</text>';
    return s + '</svg>';
  }

  /* ── 3D ─────────────────────────────────────────────────────────────── */

  function render3D(app, e, box) {
    const st = app.st, A3 = window.FluxAtom3D;
    if (!A3) { box.innerHTML = head(e) + '<p class="fpt-lead">The 3D view could not load. Try refreshing.</p>'; return; }
    if (!box.querySelector('.fpx-stage')) {
      box.innerHTML = '<div class="fpx fpx--3d"><div class="fpx-3dtop"></div><div class="fpx-3dmain"><div class="fpx-stage">'
        + '<canvas class="fpx-canvas" tabindex="0" aria-label="A 3D model of the atom. Drag, or use the arrow keys, to turn it."></canvas>'
        + '<div class="fpx-ctl" role="toolbar" aria-label="3D view">'
        + '<button type="button" class="fpx-cbtn" data-act="a3spin" aria-pressed="false">Spin</button>'
        + '<button type="button" class="fpx-cbtn" data-act="a3play" aria-pressed="false">Move electrons</button>'
        + '<button type="button" class="fpx-cbtn" data-act="a3flat" aria-pressed="false">Flatten</button>'
        + '<button type="button" class="fpx-cbtn" data-act="a3reset">Reset</button></div>'
        + '<p class="fpx-hint">Drag to turn · scroll or pinch to zoom · double-click to reset</p></div>'
        + '<aside class="fpx-key"></aside></div></div>';
      if (app.atom) app.atom.destroy();
      app.atom = A3.create(box.querySelector('.fpx-canvas'));
      const key = box.querySelector('.fpx-key');
      // Pointing at a shell or orbital in the key picks it out in the model.
      const pick = (ev) => { const r = ev.target.closest('[data-hl]'); if (r && app.atom) app.atom.highlight(r.dataset.hl === 'nuc' ? 'nuc' : +r.dataset.hl); };
      key.addEventListener('mouseover', pick);
      key.addEventListener('focusin', pick);
      key.addEventListener('mouseleave', () => app.atom && app.atom.highlight(-1));
      key.addEventListener('focusout', () => app.atom && app.atom.highlight(-1));
    }
    const v = app.atom;
    v.resume();
    const parts = atomParts(e);
    const ink = getComputedStyle(box).getPropertyValue('--fpt-ink').trim() || '#eaf1ff';
    const mode = st.atomMode === 'orbitals' ? 'orbitals' : 'bohr';
    const order = (k) => C().AUFBAU.findIndex((x) => x.k === k);
    const subs = Object.keys(parts.occ).filter((k) => parts.occ[k] > 0).sort((a, b) => order(a) - order(b));
    const sub = subs.indexOf(st.orb) >= 0 ? st.orb : subs[subs.length - 1];
    box.querySelector('.fpx-3dtop').innerHTML = head(e, parts.Z + ' protons · ' + (parts.A - parts.Z) + ' neutrons · ' + parts.Z + ' electrons')
      + seg([['bohr', 'Bohr model'], ['orbitals', 'Orbitals']], 'a3mode', mode);
    v.set({ Z: parts.Z, A: parts.A, shells: parts.shells, ink: ink });
    v.setMode(mode);
    const key = box.querySelector('.fpx-key');
    if (mode === 'bohr' || !sub) {
      key.innerHTML = '<h3>Bohr model</h3><button type="button" class="fpx-krow" data-hl="nuc"><i class="fpx-dot is-p"></i><i class="fpx-dot is-n"></i><span class="is-prose"><b>Nucleus</b>'
        + parts.Z + ' proton' + (parts.Z === 1 ? '' : 's') + ' + ' + (parts.A - parts.Z) + ' neutron' + (parts.A - parts.Z === 1 ? '' : 's') + ' — ' + esc(e.name.toLowerCase()) + '-' + parts.A + '</span></button>'
        + parts.shells.map((c, i) => {
          const inShell = Object.keys(parts.occ).filter((k) => +k[0] === i + 1 && parts.occ[k] > 0).sort((a, b) => 'spdf'.indexOf(a[1]) - 'spdf'.indexOf(b[1])).map((k) => k + C().toSup(parts.occ[k])).join(' ');
          return '<button type="button" class="fpx-krow" data-hl="' + i + '"><i class="fpx-dot is-e"></i><span><b>Shell n = ' + (i + 1) + ' · ' + c + ' electron' + (c === 1 ? '' : 's') + '</b>' + esc(inShell) + '</span></button>';
        }).join('')
        + '<p class="fpt-note">Not to scale: a real nucleus is about 100,000 times smaller than the atom. And electrons do not really circle like planets — the <button type="button" class="fpt-link" data-act="a3mode" data-mode="orbitals">orbitals</button> are the truer picture.</p>';
    } else {
      const l = 'spdf'.indexOf(sub[1]);
      const boxes = C().orbitals(parts.occ).find((o) => o.sub === sub).boxes;
      v.setOrbital({ n: +sub[0], l: l, filled: boxes });
      /* Three p dumbbells together are the textbook picture; five d or seven
         f shapes on top of one another are a blur, so those show one at a time. */
      const count = A3.orbitalNames(l).length;
      const only = st.orbM === -1 || st.orbM == null ? (l >= 2 ? 0 : -1) : Math.min(st.orbM, count - 1);
      v.setOnly(only);
      key.innerHTML = '<h3>Orbitals</h3><div class="fpx-subs" role="group" aria-label="Subshell">' + subs.map((k) => '<button type="button" class="fpt-chip' + (k === sub ? ' is-on' : '') + '" data-act="a3orb" data-orb="' + k + '">' + k + C().toSup(parts.occ[k]) + '</button>').join('') + '</div>'
        + (l >= 1 ? '<div class="fpx-subs" role="group" aria-label="Which orbitals"><button type="button" class="fpt-chip' + (only === -1 ? ' is-on' : '') + '" data-act="a3m" data-m="-1">All ' + A3.orbitalNames(l).length + ' together</button></div>' : '')
        + A3.orbitalNames(l).map((nm, m) => '<button type="button" class="fpx-krow' + (only === m ? ' is-on' : '') + '" data-hl="' + m + '" data-act="a3m" data-m="' + m + '" aria-pressed="' + (only === m) + '"><i class="fpx-dot" style="background:' + A3.ORB_COL[m % A3.ORB_COL.length] + '"></i><span><b>' + esc(sub[0] + nm[0]) + (nm[1] ? '<sub>' + esc(nm[1]) + '</sub>' : '') + '</b>'
          + (boxes[m] === 2 ? '2 electrons, paired' : boxes[m] === 1 ? '1 electron' : 'empty') + '</span></button>').join('')
        + '<p class="fpt-note">' + (l === 0 ? 'An s orbital is a sphere around the nucleus.' : l === 1 ? 'The three p orbitals are dumbbells along x, y and z, at right angles to each other.' : l === 2 ? 'Four of the d orbitals have four lobes; d<sub>z²</sub> is a dumbbell with a ring round its middle.' : 'The seven f orbitals have six or eight lobes.')
        + ' The cloud is where the electron is most likely to be found; the darker lobes are the wave\'s other phase. The brighter the cloud, the more electrons it holds.</p>';
    }
    box.querySelectorAll('.fpx-ctl [data-act]').forEach((b) => {
      const a = b.dataset.act;
      const on = a === 'a3spin' ? v.spin : a === 'a3play' ? v.play : a === 'a3flat' ? v.flatTarget === 1 : null;
      if (on != null) b.setAttribute('aria-pressed', String(!!on));
      if (a === 'a3play' || a === 'a3flat') b.hidden = mode !== 'bohr';
    });
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */

  const RENDER = { electrons: electronsHTML, spectra: spectraHTML, isotopes: isotopesHTML };

  function render(app, view, e, box) {
    if (view === '3d') { if (e) render3D(app, e, box); box.dataset.view = '3d'; return; }
    if (app.atom) { app.atom.destroy(); app.atom = null; }
    box.dataset.view = view;
    box.innerHTML = e ? '<div class="fpx fpx--' + view + '">' + RENDER[view](app, e) + '</div>' : '';
  }
  /** Stop the 3D model drawing while its tab is not showing. */
  function leave(app) { if (app.atom) app.atom.stop(); }

  /** The explorers' own buttons. Returns true when it handled the action. */
  function action(app, act, el) {
    const st = app.st, v = app.atom;
    switch (act) {
      case 'xion': st.ion = +el.dataset.q; break;
      case 'hseries': st.hLo = +el.dataset.lo; st.hHi = st.hLo + 1; break;
      case 'hhi': st.hHi = el.dataset.hi === 'inf' ? Infinity : +el.dataset.hi; break;
      case 'cmpadd': if (st.sel && st.compare.indexOf(st.sel) < 0) st.compare = st.compare.concat(st.sel).slice(-6); break;
      case 'cmpdel': st.compare = st.compare.filter((n) => n !== +el.dataset.n); break;
      case 'isomode': st.isoMode = el.dataset.mode; break;
      case 'a3mode': st.atomMode = el.dataset.mode; break;
      case 'a3orb': st.orb = el.dataset.orb; st.orbM = null; break;
      case 'a3m': st.orbM = +el.dataset.m; break;
      case 'a3spin': if (v) v.setSpin(!v.spin); el.setAttribute('aria-pressed', String(!!(v && v.spin))); return true;
      case 'a3play': if (v) v.setPlay(!v.play); el.setAttribute('aria-pressed', String(!!(v && v.play))); return true;
      case 'a3flat': if (v) v.setFlat(v.flatTarget !== 1); el.setAttribute('aria-pressed', String(!!(v && v.flatTarget === 1))); return true;
      case 'a3reset': if (v) v.reset(); return true;
      default: return false;
    }
    app.save();
    app.renderExplore();
    return true;
  }

  window.FluxPTableExplore = {
    render: render,
    leave: leave,
    action: action,
    // Pure, for the unit tests.
    aufbauOcc: aufbauOcc,
    exception: exception,
    levelRows: levelRows,
    hLevel: hLevel,
    hLine: hLine,
    diatomicPeaks: diatomicPeaks,
    atomParts: atomParts,
  };
})();
