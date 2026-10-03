/* ============================================================================
   FLUX STUDY HUB · Music module
   Circle of fifths, scales & chords, chord inversions, Roman numerals,
   intervals and the dimensions ring. Registers with window.fluxStudyHub.

   Every note name comes from flux-music-theory.js, which spells by letter:
   B♭ major is B♭ C D E♭ F G A, never "A♯ C D D♯ F G A", and a key that would
   need double sharps (A♯ major) is shown as the key musicians write (B♭).
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    const T = window.FluxMusicTheory;
    if (!H || !H.register || !T) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const nm = T.name;
    const list = (ns) => Array.from(ns, nm).join(' ');

    const pol = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    function wedge(cx, cy, rI, rO, a1, a2) {
      const [x1, y1] = pol(cx, cy, rO, a1), [x2, y2] = pol(cx, cy, rO, a2), [x3, y3] = pol(cx, cy, rI, a2), [x4, y4] = pol(cx, cy, rI, a1);
      const large = (a2 - a1) % 360 > 180 ? 1 : 0;
      return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rO} ${rO} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${rI} ${rI} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    }

    // ── Sound and keyboard ───────────────────────────────────────────────────
    let actx = null;
    /** Semitones above middle C, played one after another (a chord arpeggiated from the bass). */
    function play(semis) {
      // 'playback' lets iPhones play through the silent switch, like a music app.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      if (actx.state !== 'running') actx.resume();
      semis.forEach((s, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = 261.63 * Math.pow(2, s / 12); const t = actx.currentTime + i * 0.16; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.42); });
    }
    /** Pitch values rising from the first note, so a chord is voiced from its bass upward. */
    function rising(notes) {
      let prev = -1;
      return notes.map((n) => { let v = T.pc(n); while (v <= prev) v += 12; prev = v; return v; });
    }
    /* Two octaves from C. `lit` lights every key of those pitch classes; `exact`
       lights just those keys (0–23), and `bass` marks the lowest one. */
    function pianoHTML(opts) {
      const lit = new Set((opts.lit || []).map((v) => ((v % 12) + 12) % 12));
      const exact = opts.exact ? new Set(opts.exact) : null;
      const on = (k) => (exact ? exact.has(k) : lit.has(k % 12));
      const whites = [0, 2, 4, 5, 7, 9, 11], octaves = 2, whiteCount = whites.length * octaves;
      let html = `<div class="fsh-piano${opts.mini ? ' fsh-piano--mini' : ''}">`;
      for (let o = 0; o < octaves; o++) for (let wi = 0; wi < whites.length; wi++) { const k = whites[wi] + o * 12; html += `<div class="fsh-pkey${on(k) ? ' on' : ''}${opts.bass === k ? ' bass' : ''}" data-pc="${k}"></div>`; }
      const blackOver = [0, 1, 3, 4, 5], blackPcOff = [1, 3, 6, 8, 10];
      for (let o = 0; o < octaves; o++) for (let b = 0; b < blackOver.length; b++) { const leftPct = (o * whites.length + blackOver[b] + 0.72) / whiteCount * 100; const k = blackPcOff[b] + o * 12; html += `<div class="fsh-pkey black${on(k) ? ' on' : ''}${opts.bass === k ? ' bass' : ''}" style="left:${leftPct}%" data-pc="${k}"></div>`; }
      return html + '</div>';
    }

    /** Scale or chord notes from a root, swapped to the practical spelling when it needs double accidentals. */
    const typeWord = (t) => (/^(Dorian|Phrygian|Lydian|Mixolydian|Locrian)$/.test(t) ? t : t.toLowerCase());
    function spell(rootName, kind, type) {
      const make = (r) => (kind === 'scale' ? T.scale(r, type) : T.chord(r, type));
      let root = T.parse(rootName), notes = make(root), note = '';
      if (T.hasDouble(notes)) {
        const alt = T.respell(root);
        const altNotes = alt ? make(alt) : null;
        if (altNotes && !T.hasDouble(altNotes)) {
          const doubles = notes.filter((n) => Math.abs(n.a) >= 2).map(nm);
          note = `${nm(root)} ${typeWord(type)} would need ${T.andList(doubles)}, so it is written as ${nm(alt)} ${typeWord(type)} — same sounds, easier to read.`;
          root = alt; notes = altNotes;
        }
      }
      return { root, notes, note };
    }
    const ROOT_CHOICES = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
    const rootSelect = (id, val, choices) => `<select id="${id}" class="fsh-input" style="flex:0 0 92px" aria-label="Root">${(choices || ROOT_CHOICES).map((p) => `<option${p === val ? ' selected' : ''}>${p}</option>`).join('')}</select>`;

    // ── Circle of Fifths ─────────────────────────────────────────────────────
    let cof = { i: 0, ring: 'major', alt: false };
    function cofKey() {
      const row = T.CIRCLE[cof.i];
      const t = cof.ring === 'major'
        ? (cof.alt && row.majorAlt ? row.majorAlt : row.major)
        : (cof.alt && row.minorAlt ? row.minorAlt : row.minor);
      return T.keyFor(t, cof.ring);
    }
    function chipsHTML(triads) {
      return triads.map((c) => `<span class="fsh-shellbar"><b>${esc(c.numeral)}</b> ${esc(c.symbol)}</span>`).join('');
    }
    function minorExtraHTML(k) {
      const har = T.diatonicTriads(k.tonic, 'Harmonic minor');
      const lead = nm(T.scale(k.tonic, 'Harmonic minor')[6]);
      return `<p class="fsh-note">Harmonic minor raises the 7th to <b>${esc(lead)}</b>: v becomes <b>V</b> (${esc(har[4].symbol)}) and VII becomes <b>vii°</b> (${esc(har[6].symbol)}) — the chords that pull a minor key home.</p>`;
    }
    /** The pair that shares this key signature, chord by chord, numbered from each home note. */
    function compareHTML(k) {
      const majorTonic = k.mode === 'major' ? k.tonic : T.parse(k.relative.replace(/ major$/, ''));
      const majorLabel = nm(majorTonic) + ' major';
      const minorLabel = k.mode === 'major' ? k.relative : k.label;
      const rows = T.relativeNumerals(majorTonic);
      return `<div class="fsh-numcompare"><div class="fsh-numcompare-h">Same chords, different numbers</div>
        <p class="fsh-note" style="margin:0 0 8px">${esc(majorLabel)} and ${esc(minorLabel)} share a key signature, so they share every chord — but a Roman numeral counts from the key's home note, so each chord gets a new number.</p>
        <table class="fsh-numtable"><thead><tr><th>Chord</th><th>in ${esc(majorLabel)}</th><th>in ${esc(minorLabel)}</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.symbol)}</td><td>${esc(r.inMajor)}</td><td>${esc(r.inMinor)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function cofInfoHTML() {
      const k = cofKey();
      const triads = T.diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor');
      const sig = k.signatureNotes.length ? `${esc(k.signatureText)} · ${k.signatureNotes.map(esc).join(' ')}` : 'No sharps or flats';
      const enh = k.enharmonic
        ? `<div class="row"><span>Enharmonic key</span><span><button type="button" class="fsh-btn fsh-btn--small" data-act="alt">${esc(k.enharmonic.label)} (${esc(k.enharmonic.signatureText)})</button></span></div>
           <p class="fsh-note">Enharmonic keys sound identical but are spelled differently. Composers pick whichever is easier to read — usually the one with fewer sharps or flats, or the one that matches the music around it.</p>`
        : '';
      return `<div class="fsh-keyinfo"><h3 style="margin:0 0 8px;font-size:20px">${esc(k.label)}</h3>
        <div class="row"><span>Key signature</span><span>${sig}</span></div>
        <div class="row"><span>Relative ${k.mode === 'major' ? 'minor' : 'major'}</span><span>${esc(k.relative)}</span></div>
        <div class="row"><span>Scale</span><span>${esc(list(k.scale))}</span></div>
        ${enh}
        <div class="row" style="border:0"><span>Chords in the key</span><span></span></div>
        <div class="fsh-chips-row" style="margin-top:6px">${chipsHTML(triads)}</div>
        ${k.mode === 'minor' ? minorExtraHTML(k) : ''}
        ${compareHTML(k)}</div>`;
    }
    function ringLabel(x, y, main, alt, cls) {
      if (!alt) return `<text class="fsh-ring-label${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(main)}</text>`;
      return `<text class="fsh-ring-label${cls}" x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}">${esc(main)}</text>`
        + `<text class="fsh-ring-label fsh-ring-alt${cls}" x="${x.toFixed(1)}" y="${(y + 9).toFixed(1)}">${esc(alt)}</text>`;
    }
    function renderCircle(body) {
      const cx = 230, cy = 230, rO = 215, rMid = 150, rI = 92;
      const segs = T.CIRCLE.map((k, i) => {
        const a1 = i * 30 - 15, a2 = i * 30 + 15, mid = i * 30;
        const [mx, my] = pol(cx, cy, (rO + rMid) / 2, mid), [nx, ny] = pol(cx, cy, (rMid + rI) / 2, mid);
        const hue = i * 30;
        const onMaj = cof.i === i && cof.ring === 'major', onMin = cof.i === i && cof.ring === 'minor';
        return `<g class="fsh-ring-seg${onMaj ? ' active' : ''}" data-i="${i}" data-ring="major">
            <path d="${wedge(cx, cy, rMid, rO, a1, a2)}" fill="hsl(${hue} 58% ${onMaj ? 58 : 46}%)" stroke="${onMaj ? '#fff' : 'rgba(0,0,0,.25)'}" stroke-width="${onMaj ? 2 : 1}"></path>
            ${ringLabel(mx, my, k.major, k.majorAlt, '')}</g>
          <g class="fsh-ring-seg${onMin ? ' active' : ''}" data-i="${i}" data-ring="minor">
            <path d="${wedge(cx, cy, rI, rMid, a1, a2)}" fill="hsl(${hue} 42% ${onMin ? 44 : 30}%)" stroke="${onMin ? '#fff' : 'rgba(0,0,0,.25)'}" stroke-width="${onMin ? 2 : 1}"></path>
            ${ringLabel(nx, ny, k.minor + 'm', k.minorAlt ? k.minorAlt + 'm' : '', ' min')}</g>`;
      }).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Circle of Fifths</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Tap a major key (outside) or a minor key (inside). The three at the bottom have two names — the same keys spelled two ways.</p>
        <div class="fsh-ring-wrap"><svg class="fsh-ring-svg" id="cofSvg" viewBox="0 0 460 460" role="img" aria-label="Circle of fifths">${segs}<circle cx="${cx}" cy="${cy}" r="${rI - 4}" fill="rgba(8,11,20,.6)" stroke="var(--fsh-line)"></circle><text class="fsh-ring-center" x="${cx}" y="${cy - 6}">5ths</text><text class="fsh-ring-label min" x="${cx}" y="${cy + 16}">major · minor</text></svg>
        <div id="cofInfo">${cofInfoHTML()}</div></div></div>`;
      body.querySelector('#cofSvg').addEventListener('click', (e) => {
        const g = e.target.closest('[data-ring]');
        if (!g) return;
        cof = { i: +g.dataset.i, ring: g.dataset.ring, alt: false };
        renderCircle(body);
      });
      body.querySelector('#cofInfo').addEventListener('click', (e) => {
        if (!e.target.closest('[data-act="alt"]')) return;
        cof.alt = !cof.alt;
        renderCircle(body);
      });
    }

    // ── Dimensions & metadimensions (classic IB listening framework) ─────────
    const DIMS = [['Timbre', 'Tone colour — what makes instruments sound different.'], ['Melody', 'A memorable, shaped succession of pitches.'], ['Harmony', 'Pitches sounded together — chords and their progression.'], ['Dynamics', 'Levels and changes of loudness (p, f, cresc.).'], ['Articulation', 'How notes are attacked and released (staccato, legato).'], ['Texture', 'How many layers there are and how they relate.'], ['Meter', 'The grouping of beats into regular patterns.'], ['Tempo', 'The speed of the beat (BPM).'], ['Form', 'The overall structure — ABA, verse–chorus, sonata.']];
    const METADIMS = [['Style', 'Characteristic features shared by a body of music.'], ['Architecture', 'Large-scale design and proportion of a work.'], ['Affective qualities', 'The emotions and moods the music evokes.'], ['Sense of ensemble', 'How performers interact and balance together.'], ['Personal context', "The listener's or creator's own experience & response."], ['Cultural context', 'The society and traditions the music belongs to.'], ['Historical context', 'The time period and its conventions.'], ['Sense of simultaneity', 'How several musical events are perceived at once.'], ['Genre', 'The category or type of music (jazz, opera, …).']];
    let dimSel = { kind: 'dim', i: 0 };
    const wrap2 = (s) => { if (s.length <= 13) return [s]; const w = s.split(' '); if (w.length < 2) return [s]; let best = 1, bd = 1e9; for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '); const d = Math.abs(a.length - b.length); if (d < bd) { bd = d; best = k; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };
    function dimInfo() { const d = dimSel.kind === 'core' ? ['Pitch & Rhythm', 'The two fundamental dimensions — every musical idea is built on organised pitch and time.'] : (dimSel.kind === 'meta' ? METADIMS[dimSel.i] : DIMS[dimSel.i]); const tag = dimSel.kind === 'core' ? 'Core' : dimSel.kind === 'meta' ? 'Metadimension' : 'Dimension'; return `<div class="fsh-keyinfo"><div class="fsh-note" style="margin:0 0 4px">${tag}</div><h3 style="margin:0 0 8px;font-size:21px">${esc(d[0])}</h3><p style="color:var(--fsh-ink-2);font-size:14px;line-height:1.65">${esc(d[1])}</p></div>`; }
    function renderDimensions(body) {
      const cx = 235, cy = 235;
      const pill = (label, deg, r, kind, i) => {
        const [x, y] = pol(cx, cy, r, deg); const active = dimSel.kind === kind && dimSel.i === i;
        const lines = wrap2(label); const tw = Math.max(48, Math.min(134, Math.max.apply(null, lines.map((l) => l.length)) * 6.6)); const th = lines.length > 1 ? 30 : 22;
        const rgb = kind === 'meta' ? '176,108,240' : 'var(--fsh-accent-rgb)';
        return `<g class="fsh-ring-seg" data-kind="${kind}" data-i="${i}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" style="cursor:pointer">
          <rect x="${(-tw / 2).toFixed(1)}" y="${(-th / 2).toFixed(1)}" width="${tw.toFixed(1)}" height="${th}" rx="${Math.min(11, th / 2)}" style="fill:rgba(${rgb},${active ? '.5' : '.2'})" stroke="${active ? '#ffffff' : 'rgba(255,255,255,.16)'}" stroke-width="${active ? 2 : 1}"></rect>
          ${lines.map((l, li) => `<text text-anchor="middle" dominant-baseline="central" y="${lines.length > 1 ? li * 12 - 6 : 0}" style="fill:#fff;font:600 11px ui-sans-serif,system-ui;pointer-events:none">${esc(l)}</text>`).join('')}</g>`;
      };
      const metas = METADIMS.map((m, i) => pill(m[0], i * 40, 196, 'meta', i)).join('');
      const dims = DIMS.map((d, i) => pill(d[0], i * 40 + 20, 122, 'dim', i)).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">◎ Dimensions &amp; metadimensions</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">The classic listening framework — <b>dimensions</b> describe the sound itself; <b>metadimensions</b> describe context &amp; meaning. Tap any label.</p>
        <div class="fsh-ring-wrap"><svg class="fsh-ring-svg" id="dimSvg" viewBox="0 0 470 470" role="img" aria-label="Music dimensions and metadimensions" style="max-width:480px">
          <circle cx="${cx}" cy="${cy}" r="228" style="fill:rgba(176,108,240,.06)" stroke="var(--fsh-line)"></circle>
          <circle cx="${cx}" cy="${cy}" r="170" style="fill:rgba(var(--fsh-accent-rgb),.06)" stroke="var(--fsh-line)"></circle>
          <circle cx="${cx}" cy="${cy}" r="74" fill="rgba(8,11,20,.55)" style="stroke:rgba(var(--fsh-accent-rgb),.4)"></circle>
          <text x="${cx}" y="26" text-anchor="middle" style="fill:rgba(255,255,255,.5);font:700 12px ui-sans-serif,system-ui;letter-spacing:.08em">METADIMENSIONS</text>
          <text x="${cx}" y="86" text-anchor="middle" style="fill:rgba(255,255,255,.5);font:700 11px ui-sans-serif,system-ui;letter-spacing:.06em">DIMENSIONS</text>
          ${metas}${dims}
          <g class="fsh-ring-seg" data-kind="core" data-i="0" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="60" fill="transparent"></circle><text x="${cx}" y="${cy - 9}" text-anchor="middle" style="fill:#fff;font:800 18px ui-sans-serif,system-ui;pointer-events:none">Pitch</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" style="fill:#fff;font:800 18px ui-sans-serif,system-ui;pointer-events:none">Rhythm</text></g>
        </svg>
        <div id="dimInfo">${dimInfo()}</div></div></div>`;
      document.getElementById('dimSvg').addEventListener('click', (e) => { const g = e.target.closest('.fsh-ring-seg'); if (!g) return; dimSel = { kind: g.dataset.kind, i: +g.dataset.i }; renderDimensions(body); });
    }

    // ── Scale / chord explorer ───────────────────────────────────────────────
    let ex = { root: 'C', mode: 'scale', type: 'Major' };
    function renderExplorer(body) {
      const opts = Object.keys(ex.mode === 'scale' ? T.SCALES : T.CHORDS);
      if (opts.indexOf(ex.type) === -1) ex.type = opts[0];
      const s = spell(ex.root, ex.mode, ex.type);
      const values = rising(s.notes);
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Scale &amp; chord explorer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Pick a root and type — see the notes spelled properly and lit up, then hear them.</p>
        <div class="fsh-field" style="flex-wrap:wrap">
          ${rootSelect('scRoot', ex.root)}
          <div class="fsh-seg" id="scModeSeg"><button type="button" data-mode="scale" class="${ex.mode === 'scale' ? 'active' : ''}">Scale</button><button type="button" data-mode="chord" class="${ex.mode === 'chord' ? 'active' : ''}">Chord</button></div>
          <select id="scType" class="fsh-input" style="flex:1;min-width:140px" aria-label="Type">${opts.map((o) => `<option${o === ex.type ? ' selected' : ''}>${o}</option>`).join('')}</select>
          <button type="button" class="fsh-btn" id="scPlay">▶ Play</button></div>
        <div class="fsh-out"><span class="big" style="font-size:20px">${Array.from(s.notes, nm).map(esc).join(' · ')}</span></div>
        ${s.note ? `<p class="fsh-note fsh-respelled">${esc(s.note)}</p>` : ''}
        ${pianoHTML({ lit: values })}</div>`;
      body.querySelector('#scRoot').addEventListener('change', (e) => { ex.root = e.target.value; renderExplorer(body); });
      body.querySelector('#scType').addEventListener('change', (e) => { ex.type = e.target.value; renderExplorer(body); });
      body.querySelector('#scModeSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; ex.mode = b.dataset.mode; renderExplorer(body); });
      body.querySelector('#scPlay').addEventListener('click', () => play(values));
      body.querySelectorAll('.fsh-pkey').forEach((k) => k.addEventListener('click', () => play([+k.dataset.pc])));
    }

    // ── Chord inversions ─────────────────────────────────────────────────────
    const INV_TYPES = ['Major', 'Minor', 'Diminished', 'Augmented', 'Dominant 7', 'Major 7', 'Minor 7', 'Half-diminished 7', 'Diminished 7'];
    let inv = { root: 'C', type: 'Major' };
    function renderInversions(body) {
      const s = spell(inv.root, 'chord', inv.type);
      const invs = T.inversions(s.root, inv.type);
      const seventh = invs.length === 4;
      const cards = invs.map((v) => {
        const values = rising(v.notes);
        const shift = values[0] >= 12 ? 12 : 0;   // keep the voicing on the two-octave keyboard
        const keys = values.map((x) => x - shift);
        return `<div class="fsh-inv" data-inv="${v.inversion}">
          <div class="fsh-inv-h">${esc(v.name)}</div>
          <div class="fsh-inv-sym">${esc(v.symbol)}</div>
          <div class="fsh-inv-row"><span>Bass note</span><b>${esc(nm(v.bass))}</b></div>
          <div class="fsh-inv-row"><span>Low → high</span><b>${esc(list(v.notes))}</b></div>
          <div class="fsh-inv-row"><span>Figured bass</span><b>${esc(v.figureShort || '—')}${seventh || !v.figureShort ? '' : ` <small>(${esc(v.figure)})</small>`}</b></div>
          ${pianoHTML({ exact: keys, bass: keys[0], mini: true })}
          <button type="button" class="fsh-btn fsh-btn--small" data-play="${values.join(',')}">▶ Play</button></div>`;
      }).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Chord inversions</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Same notes, different note in the bass. The bass decides the name: the root → root position, the 3rd → first inversion, the 5th → second${seventh ? ', the 7th → third' : ''}.</p>
        <div class="fsh-field" style="flex-wrap:wrap">
          ${rootSelect('invRoot', inv.root)}
          <select id="invType" class="fsh-input" style="flex:1;min-width:160px" aria-label="Chord">${INV_TYPES.map((o) => `<option${o === inv.type ? ' selected' : ''}>${o}</option>`).join('')}</select></div>
        ${s.note ? `<p class="fsh-note fsh-respelled">${esc(s.note)}</p>` : ''}
        <div class="fsh-inv-grid">${cards}</div>
        <p class="fsh-note">Slash chords name the bass after the slash: <b>C/E</b> is a C chord with E at the bottom. Figured bass counts the intervals above the bass${seventh ? ' — 7, 6/5, 4/3 and 4/2 for a seventh chord' : ' — nothing for root position, 6 for first inversion, 6/4 for second'}.</p></div>`;
      body.querySelector('#invRoot').addEventListener('change', (e) => { inv.root = e.target.value; renderInversions(body); });
      body.querySelector('#invType').addEventListener('change', (e) => { inv.type = e.target.value; renderInversions(body); });
      body.querySelector('.fsh-inv-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-play]');
        if (b) play(b.dataset.play.split(',').map(Number));
      });
    }

    // ── Roman numerals ───────────────────────────────────────────────────────
    let num = { tonic: 'C', mode: 'major' };
    function renderNumerals(body) {
      const tonics = num.mode === 'major' ? T.MAJOR_TONICS : T.MINOR_TONICS;
      if (tonics.indexOf(num.tonic) === -1) num.tonic = num.mode === 'major' ? 'C' : 'A';
      const k = T.keyFor(num.tonic, num.mode);
      const triads = T.diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor');
      const har = k.mode === 'minor' ? T.diatonicTriads(k.tonic, 'Harmonic minor') : null;
      const rows = triads.map((c, d) => {
        const extra = har && (d === 4 || d === 6)
          ? `<div class="fsh-num-alt">harmonic minor: <b>${esc(har[d].numeral)}</b> ${esc(har[d].symbol)}</div>` : '';
        return `<tr><td class="fsh-num">${esc(c.numeral)}${extra}</td><td>${esc(c.symbol)}</td><td>${esc(list(c.notes))}</td><td>${esc(c.quality.toLowerCase())}</td>
          <td><button type="button" class="fsh-btn fsh-btn--small" data-play="${rising(c.notes).join(',')}" aria-label="Play ${esc(c.symbol)}">▶</button></td></tr>`;
      }).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">Roman numerals</h3>
        <p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Numerals name each chord by its place in the key: capitals for major chords, small letters for minor, ° for diminished. They count from the key's home note, so the same chord gets a different numeral in a different key: C major is I in C major but III in A minor, and A minor is vi in C major but i in A minor.</p>
        <div class="fsh-field" style="flex-wrap:wrap">
          ${rootSelect('numTonic', num.tonic, tonics)}
          <div class="fsh-seg" id="numMode"><button type="button" data-mode="major" class="${num.mode === 'major' ? 'active' : ''}">Major</button><button type="button" data-mode="minor" class="${num.mode === 'minor' ? 'active' : ''}">Minor</button></div></div>
        <div class="fsh-out"><span class="big" style="font-size:18px">${esc(k.label)}</span> <span style="color:var(--fsh-mut);font-size:13px">· ${esc(k.signatureText)}</span></div>
        <table class="fsh-numtable fsh-numtable--key"><thead><tr><th>Numeral</th><th>Chord</th><th>Notes</th><th>Quality</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${compareHTML(k)}</div>`;
      body.querySelector('#numTonic').addEventListener('change', (e) => { num.tonic = e.target.value; renderNumerals(body); });
      body.querySelector('#numMode').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]');
        if (!b || b.dataset.mode === num.mode) return;
        // Keep the same key signature when switching: C major ↔ A minor.
        const next = T.keyFor(num.tonic, num.mode).relative;
        num = { mode: b.dataset.mode, tonic: next.replace(/ (major|minor)$/, '') };
        renderNumerals(body);
      });
      body.querySelector('.fsh-numtable--key').addEventListener('click', (e) => {
        const b = e.target.closest('[data-play]');
        if (b) play(b.dataset.play.split(',').map(Number));
      });
    }

    // ── Intervals reference ──────────────────────────────────────────────────
    const INTERVALS = [[0, 'Unison'], [1, 'Minor 2nd'], [2, 'Major 2nd'], [3, 'Minor 3rd'], [4, 'Major 3rd'], [5, 'Perfect 4th'], [6, 'Tritone'], [7, 'Perfect 5th'], [8, 'Minor 6th'], [9, 'Major 6th'], [10, 'Minor 7th'], [11, 'Major 7th'], [12, 'Octave']];
    function renderIntervals(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">📐 Intervals</h3><div class="fsh-formula-list">${INTERVALS.map((i) => `<div class="fsh-formula"><div class="nm">${i[0]} semitone${i[0] === 1 ? '' : 's'}</div><div class="fx">${esc(i[1])}</div></div>`).join('')}</div></div>`; }

    const parseRootType = (a, table, fallback) => {
      const m = String(a).trim().match(/^([A-G](?:𝄪|𝄫|x|##|bb|#|♯|b|♭)?)\s+(.+)$/i);
      if (!m) throw new Error(fallback);
      const type = Object.keys(table).find((k) => k.toLowerCase() === m[2].trim().toLowerCase()) || Object.keys(table)[0];
      return { root: m[1], type };
    };

    /* Every music tool opens under a link to Flux Composer (composer.html), the
       same tools and more on their own page — the way Chemistry ▸ Table links
       to the full Periodic Table. Reassigning the bindings means a tool's own
       re-render (tapping a key on the circle) keeps the banner too. */
    const composerBanner = (hash) => '<a class="fsh-ptable-full fsh-composer-full" href="composer.html#' + hash + '" target="_blank" rel="noopener">'
      + '<span class="fsh-ptable-full-i" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>'
      + '<span class="fsh-ptable-full-t"><b>Need more? Open Flux Composer</b><small>Every key on one table, a playable keyboard that writes what you play, cadences, an ear trainer, a metronome and DP Music. Free, on its own page.</small></span>'
      + '<span class="fsh-ptable-full-go" aria-hidden="true">Open ↗</span></a>';
    const withComposer = (fn, hash) => (body, picked) => {
      fn(body, picked);
      if (!body.querySelector('.fsh-composer-full')) body.insertAdjacentHTML('afterbegin', composerBanner(hash));
    };
    window.fluxComposerBanner = withComposer;
    renderCircle = withComposer(renderCircle, 'keys');
    renderDimensions = withComposer(renderDimensions, 'dp');
    renderExplorer = withComposer(renderExplorer, 'scales');
    renderInversions = withComposer(renderInversions, 'chords');
    renderNumerals = withComposer(renderNumerals, 'harmony');
    renderIntervals = withComposer(renderIntervals, 'intervals');

    H.register('music', [
      { id: 'circle', name: 'Circle of 5ths', icon: '🎼', desc: 'circle of fifths key signature relative minor enharmonic keys chords ring', render: renderCircle, ai: { name: 'circleOfFifths', description: 'Key info. Arg: a key like "G" or "E minor".', params: { key: 'string' }, run: (a) => { const m = String(a).trim().match(/^(\S+)\s*(minor|min|m)?$/i); const k = T.keyFor(m ? m[1] : 'C', m && m[2] ? 'minor' : 'major') || T.keyFor('C', 'major'); return { key: k.label, signature: k.signatureText, accidentals: k.signatureNotes, relative: k.relative, enharmonic: k.enharmonic ? k.enharmonic.label : null, writtenAs: k.respelledFrom ? k.why : null, scale: Array.from(k.scale, nm), chords: T.diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor').map((c) => c.numeral + ' ' + c.symbol) }; } } },
      { id: 'dimensions', name: 'Dimensions', icon: '◎', desc: 'dimensions metadimensions music ring pitch rhythm timbre style context', render: renderDimensions },
      { id: 'explorer', name: 'Scales & chords', icon: '🎹', desc: 'scale chord explorer piano notes major minor spelling', render: renderExplorer, ai: { name: 'scaleNotes', description: 'Scale notes. Arg: "B♭ Major".', params: { root: 'string', type: 'string' }, run: (a) => { const q = parseRootType(a, T.SCALES, 'Use "C Major"'); const s = spell(q.root, 'scale', q.type); return { notes: Array.from(s.notes, nm), note: s.note || null }; } } },
      { id: 'inversions', name: 'Inversions', icon: '🔁', desc: 'chord inversions first second third inversion bass slash chord figured bass 6 6/4 6/5 4/3 4/2', render: renderInversions, ai: { name: 'chordInversions', description: 'Inversions of a chord. Arg: "C Major" or "G Dominant 7".', params: { root: 'string', type: 'string' }, run: (a) => { const q = parseRootType(a, T.CHORDS, 'Use "G Dominant 7"'); const s = spell(q.root, 'chord', q.type); return T.inversions(s.root, q.type).map((v) => ({ name: v.name, symbol: v.symbol, bass: nm(v.bass), notes: Array.from(v.notes, nm), figuredBass: v.figure })); } } },
      { id: 'numerals', name: 'Roman numerals', icon: 'Ⅳ', desc: 'roman numerals harmony diatonic chords major minor key relative I IV V vi', render: renderNumerals, ai: { name: 'romanNumerals', description: 'Diatonic chords of a key. Arg: "D major" or "B minor".', params: { key: 'string' }, run: (a) => { const m = String(a).trim().match(/^(\S+)\s*(major|minor|maj|min|m)?$/i); const k = T.keyFor(m ? m[1] : 'C', m && /^m(in(or)?)?$/i.test(m[2] || '') ? 'minor' : 'major'); return T.diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor').map((c) => c.numeral + ' = ' + c.symbol); } } },
      { id: 'intervals', name: 'Intervals', icon: '📏', desc: 'intervals semitones music theory', render: renderIntervals },
    ]);
    H.addAITool({ name: 'chordNotes', subject: 'music', description: 'Chord notes. Arg: "D Minor 7".', params: { root: 'string', type: 'string' }, run: (a) => { const q = parseRootType(a, T.CHORDS, 'Use "D Minor 7"'); return Array.from(spell(q.root, 'chord', q.type).notes, nm); } });
  }
  boot();
})();
