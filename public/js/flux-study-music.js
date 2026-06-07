/* ============================================================================
   FLUX STUDY HUB · Music module (Pass 1)
   Bespoke native tools: Circle of Fifths (interactive SVG ring), Elements of
   Music wheel (crisp SVG), Scale/Chord explorer (piano + WebAudio), intervals.
   Registers with window.fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const PC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const noteName = (pc) => PC[((pc % 12) + 12) % 12];

    const pol = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    function wedge(cx, cy, rI, rO, a1, a2) {
      const [x1, y1] = pol(cx, cy, rO, a1), [x2, y2] = pol(cx, cy, rO, a2), [x3, y3] = pol(cx, cy, rI, a2), [x4, y4] = pol(cx, cy, rI, a1);
      const large = (a2 - a1) % 360 > 180 ? 1 : 0;
      return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rO} ${rO} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${rI} ${rI} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    }

    // ── Circle of Fifths ─────────────────────────────────────────────────────
    const COF = [[0, 'C', 'Am', '—'], [7, 'G', 'Em', '1♯'], [2, 'D', 'Bm', '2♯'], [9, 'A', 'F♯m', '3♯'], [4, 'E', 'C♯m', '4♯'], [11, 'B', 'G♯m', '5♯'], [6, 'G♭', 'E♭m', '6♭'], [1, 'D♭', 'B♭m', '5♭'], [8, 'A♭', 'Fm', '4♭'], [3, 'E♭', 'Cm', '3♭'], [10, 'B♭', 'Gm', '2♭'], [5, 'F', 'Dm', '1♭']];
    const MAJ_DEG = [0, 2, 4, 5, 7, 9, 11], MAJ_QUAL = ['', 'm', 'm', '', '', 'm', '°'], ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    function diatonic(rootPc) { return MAJ_DEG.map((d, i) => ({ roman: ROMAN[i], chord: noteName(rootPc + d) + MAJ_QUAL[i] })); }
    function scaleOf(rootPc, pattern) { return pattern.map((s) => noteName(rootPc + s)); }
    let cofSel = 0;
    function cofInfoHTML(i) {
      const [pc, maj, min, sig] = COF[i]; const chords = diatonic(pc);
      return `<div class="fsh-keyinfo"><h3 style="margin:0 0 8px;font-size:20px">Key of ${esc(maj)} major</h3>
        <div class="row"><span>Key signature</span><span>${esc(sig)}</span></div>
        <div class="row"><span>Relative minor</span><span>${esc(min)}</span></div>
        <div class="row"><span>Scale</span><span>${scaleOf(pc, MAJ_DEG).map(esc).join(' ')}</span></div>
        <div class="row" style="border:0"><span>Diatonic chords</span><span></span></div>
        <div class="fsh-chips-row" style="margin-top:6px">${chords.map((c) => `<span class="fsh-shellbar"><b>${esc(c.roman)}</b> ${esc(c.chord)}</span>`).join('')}</div></div>`;
    }
    function renderCircle(body) {
      const cx = 230, cy = 230, rO = 215, rMid = 150, rI = 92;
      const segs = COF.map((k, i) => {
        const a1 = i * 30 - 15, a2 = i * 30 + 15, mid = i * 30;
        const [mx, my] = pol(cx, cy, (rO + rMid) / 2, mid), [nx, ny] = pol(cx, cy, (rMid + rI) / 2, mid);
        const hue = i * 30;
        return `<g class="fsh-ring-seg${i === cofSel ? ' active' : ''}" data-i="${i}">
          <path d="${wedge(cx, cy, rMid, rO, a1, a2)}" fill="hsl(${hue} 58% ${i === cofSel ? 56 : 46}%)" stroke="rgba(0,0,0,.25)" stroke-width="1"></path>
          <path d="${wedge(cx, cy, rI, rMid, a1, a2)}" fill="hsl(${hue} 42% ${i === cofSel ? 40 : 30}%)" stroke="rgba(0,0,0,.25)" stroke-width="1"></path>
          <text class="fsh-ring-label" x="${mx.toFixed(1)}" y="${my.toFixed(1)}">${esc(k[1])}</text>
          <text class="fsh-ring-label min" x="${nx.toFixed(1)}" y="${ny.toFixed(1)}">${esc(k[2])}</text></g>`;
      }).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🎼 Circle of Fifths</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Tap a key for its signature, relative minor and diatonic chords.</p>
        <div class="fsh-ring-wrap"><svg class="fsh-ring-svg" id="cofSvg" viewBox="0 0 460 460" role="img" aria-label="Circle of fifths">${segs}<circle cx="${cx}" cy="${cy}" r="${rI - 4}" fill="rgba(8,11,20,.6)" stroke="var(--fsh-line)"></circle><text class="fsh-ring-center" x="${cx}" y="${cy - 6}">5ths</text><text class="fsh-ring-label min" x="${cx}" y="${cy + 16}">major · minor</text></svg>
        <div id="cofInfo">${cofInfoHTML(cofSel)}</div></div></div>`;
      document.getElementById('cofSvg').addEventListener('click', (e) => { const g = e.target.closest('.fsh-ring-seg'); if (!g) return; cofSel = +g.dataset.i; renderCircle(body); });
    }

    // ── Elements of Music wheel ──────────────────────────────────────────────
    const ELEMENTS = [['Pitch', 'How high or low — notes & melody'], ['Rhythm', 'Patterns of sound in time'], ['Tempo', 'Speed of the beat (BPM)'], ['Dynamics', 'Loud ↔ soft (p, f, cresc.)'], ['Timbre', 'Tone colour of an instrument'], ['Texture', 'Layers — mono/homo/polyphony'], ['Harmony', 'Chords & how they combine'], ['Form', 'Structure — ABA, verse-chorus']];
    let elSel = 0;
    function renderElements(body) {
      const cx = 220, cy = 220, rO = 205, rI = 96, n = ELEMENTS.length, step = 360 / n;
      const segs = ELEMENTS.map((el, i) => {
        const a1 = i * step - step / 2, a2 = i * step + step / 2, mid = i * step;
        const [tx, ty] = pol(cx, cy, (rO + rI) / 2, mid); const hue = 200 + i * 18;
        return `<g class="fsh-ring-seg${i === elSel ? ' active' : ''}" data-i="${i}"><path d="${wedge(cx, cy, rI, rO, a1, a2)}" fill="hsl(${hue} 50% ${i === elSel ? 52 : 38}%)" stroke="rgba(0,0,0,.25)"></path><text class="fsh-ring-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${esc(el[0])}</text></g>`;
      }).join('');
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">◎ Elements of Music</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">The building blocks every analysis comes back to. Tap a segment.</p>
        <div class="fsh-ring-wrap"><svg class="fsh-ring-svg" id="elSvg" viewBox="0 0 440 440" role="img" aria-label="Elements of music">${segs}<circle cx="${cx}" cy="${cy}" r="${rI - 4}" fill="rgba(8,11,20,.6)" stroke="var(--fsh-line)"></circle><text class="fsh-ring-center" x="${cx}" y="${cy + 6}">MUSIC</text></svg>
        <div class="fsh-keyinfo" id="elInfo"><h3 style="margin:0 0 6px;font-size:19px">${esc(ELEMENTS[elSel][0])}</h3><p style="color:var(--fsh-ink-2);font-size:14px;line-height:1.6">${esc(ELEMENTS[elSel][1])}</p></div></div></div>`;
      document.getElementById('elSvg').addEventListener('click', (e) => { const g = e.target.closest('.fsh-ring-seg'); if (!g) return; elSel = +g.dataset.i; renderElements(body); });
    }

    // ── Scale / chord explorer ───────────────────────────────────────────────
    const SCALES = { 'Major': [0, 2, 4, 5, 7, 9, 11], 'Natural minor': [0, 2, 3, 5, 7, 8, 10], 'Harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Mixolydian': [0, 2, 4, 5, 7, 9, 10], 'Major pentatonic': [0, 2, 4, 7, 9], 'Minor pentatonic': [0, 3, 5, 7, 10], 'Blues': [0, 3, 5, 6, 7, 10] };
    const CHORDS = { 'Major': [0, 4, 7], 'Minor': [0, 3, 7], 'Diminished': [0, 3, 6], 'Augmented': [0, 4, 8], 'Major 7': [0, 4, 7, 11], 'Minor 7': [0, 3, 7, 10], 'Dominant 7': [0, 4, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7] };
    let scRoot = 0, scMode = 'scale', scType = 'Major', actx = null;
    function play(pcs) {
      try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      pcs.forEach((pc, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = 261.63 * Math.pow(2, pc / 12); const t = actx.currentTime + i * 0.16; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.42); });
    }
    function pianoHTML(activePcs) {
      const whites = [0, 2, 4, 5, 7, 9, 11], octaves = 2, whiteCount = whites.length * octaves;
      let html = '<div class="fsh-piano">';
      for (let o = 0; o < octaves; o++) for (let wi = 0; wi < whites.length; wi++) { const pc = whites[wi] + o * 12; const on = activePcs.indexOf(((pc % 12) + 12) % 12) !== -1; html += `<div class="fsh-pkey${on ? ' on' : ''}" data-pc="${pc}"></div>`; }
      const blackOver = [0, 1, 3, 4, 5], blackPcOff = [1, 3, 6, 8, 10];
      for (let o = 0; o < octaves; o++) for (let b = 0; b < blackOver.length; b++) { const whiteIndexGlobal = o * whites.length + blackOver[b]; const leftPct = (whiteIndexGlobal + 0.72) / whiteCount * 100; const pc = blackPcOff[b] + o * 12; const on = activePcs.indexOf(((pc % 12) + 12) % 12) !== -1; html += `<div class="fsh-pkey black${on ? ' on' : ''}" style="left:${leftPct}%" data-pc="${pc}"></div>`; }
      return html + '</div>';
    }
    function renderExplorer(body) {
      const opts = scMode === 'scale' ? Object.keys(SCALES) : Object.keys(CHORDS);
      if (opts.indexOf(scType) === -1) scType = opts[0];
      const pattern = (scMode === 'scale' ? SCALES : CHORDS)[scType];
      const pcs = pattern.map((s) => ((scRoot + s) % 12 + 12) % 12);
      const names = pattern.map((s) => noteName(scRoot + s));
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🎹 Scale &amp; chord explorer</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Pick a root and type — see the notes light up, then hear them.</p>
        <div class="fsh-field" style="flex-wrap:wrap">
          <select id="scRoot" class="fsh-input" style="flex:0 0 90px">${PC.map((p, i) => `<option value="${i}"${i === scRoot ? ' selected' : ''}>${p}</option>`).join('')}</select>
          <div class="fsh-seg" id="scModeSeg"><button type="button" data-mode="scale" class="${scMode === 'scale' ? 'active' : ''}">Scale</button><button type="button" data-mode="chord" class="${scMode === 'chord' ? 'active' : ''}">Chord</button></div>
          <select id="scType" class="fsh-input" style="flex:1;min-width:140px">${opts.map((o) => `<option${o === scType ? ' selected' : ''}>${o}</option>`).join('')}</select>
          <button type="button" class="fsh-btn" id="scPlay">▶ Play</button></div>
        <div class="fsh-out"><span class="big" style="font-size:20px">${names.map(esc).join(' · ')}</span></div>
        ${pianoHTML(pcs)}</div>`;
      document.getElementById('scRoot').addEventListener('change', (e) => { scRoot = +e.target.value; renderExplorer(body); });
      document.getElementById('scType').addEventListener('change', (e) => { scType = e.target.value; renderExplorer(body); });
      document.getElementById('scModeSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; scMode = b.dataset.mode; renderExplorer(body); });
      document.getElementById('scPlay').addEventListener('click', () => play(pattern.map((s) => scRoot + s)));
      body.querySelectorAll('.fsh-pkey').forEach((k) => k.addEventListener('click', () => play([+k.dataset.pc])));
    }

    // ── Intervals reference ──────────────────────────────────────────────────
    const INTERVALS = [[0, 'Unison'], [1, 'Minor 2nd'], [2, 'Major 2nd'], [3, 'Minor 3rd'], [4, 'Major 3rd'], [5, 'Perfect 4th'], [6, 'Tritone'], [7, 'Perfect 5th'], [8, 'Minor 6th'], [9, 'Major 6th'], [10, 'Minor 7th'], [11, 'Major 7th'], [12, 'Octave']];
    function renderIntervals(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">📐 Intervals</h3><div class="fsh-formula-list">${INTERVALS.map((i) => `<div class="fsh-formula"><div class="nm">${i[0]} semitone${i[0] === 1 ? '' : 's'}</div><div class="fx">${esc(i[1])}</div></div>`).join('')}</div></div>`; }

    H.register('music', [
      { id: 'circle', name: 'Circle of 5ths', icon: '🎼', desc: 'circle of fifths key signature relative minor chords ring', render: renderCircle, ai: { name: 'circleOfFifths', description: 'Key info. Arg: a major key like "G".', params: { key: 'string' }, run: (a) => { const row = COF.find((r) => r[1].toUpperCase() === String(a).trim().toUpperCase()) || COF[0]; return { key: row[1] + ' major', signature: row[3], relativeMinor: row[2], scale: scaleOf(row[0], MAJ_DEG), chords: diatonic(row[0]).map((c) => c.roman + ' ' + c.chord) }; } } },
      { id: 'elements', name: 'Elements', icon: '◎', desc: 'elements of music pitch rhythm dynamics timbre ring wheel', render: renderElements },
      { id: 'explorer', name: 'Scales & chords', icon: '🎹', desc: 'scale chord explorer piano notes major minor', render: renderExplorer, ai: { name: 'scaleNotes', description: 'Scale notes. Arg: "C Major".', params: { root: 'string', type: 'string' }, run: (a) => { const m = String(a).trim().match(/^([A-G][#♯b♭]?)\s+(.+)$/i); if (!m) throw new Error('Use "C Major"'); const root = PC.indexOf(m[1].replace('#', '♯').replace('b', '♭').toUpperCase()); const pat = SCALES[Object.keys(SCALES).find((k) => k.toLowerCase() === m[2].toLowerCase())] || SCALES.Major; return scaleOf(root < 0 ? 0 : root, pat); } } },
      { id: 'intervals', name: 'Intervals', icon: '📏', desc: 'intervals semitones music theory', render: renderIntervals },
    ]);
    H.addAITool({ name: 'chordNotes', subject: 'music', description: 'Chord notes. Arg: "D Minor 7".', params: { root: 'string', type: 'string' }, run: (a) => { const m = String(a).trim().match(/^([A-G][#♯b♭]?)\s+(.+)$/i); if (!m) throw new Error('Use "D Minor 7"'); const root = PC.indexOf(m[1].replace('b', '♭').replace('#', '♯').toUpperCase()); const pat = CHORDS[Object.keys(CHORDS).find((k) => k.toLowerCase() === m[2].toLowerCase())] || CHORDS.Major; return pat.map((s) => noteName((root < 0 ? 0 : root) + s)); } });
  }
  boot();
})();
