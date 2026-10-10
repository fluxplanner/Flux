/* ============================================================================
   FLUX COMPOSER  ·  flux-composer.js
   Music the way periodic.html is chemistry: one free page, no account, with
   the planner's music tools and more. composer.html mounts it; it needs only
   flux-music-theory.js (note spelling) and, for the app switcher, flux-hub.js.

   Tabs
     keys       the table of keys — every major and minor key a musician
                writes, laid out by its key signature like elements by group
     keyboard   a playable three-octave piano that names and notates each note
     scales     every scale and mode, spelled by letter, on the staff
     chords     chord builder and inversions with figured bass
     harmony    Roman numerals, cadences and common progressions, playable
     intervals  every interval, and an ear trainer
     rhythm     note values, time signatures and a metronome
     beats      Beat Maker: a 16-step drum machine with bass and melody
     orchestra  ranges, transposition, score order and clefs
     terms      a searchable glossary: tempo, dynamics, articulation, form…
     dp         IB DP Music: dimensions, areas of inquiry, contexts, roles,
                components, and a listening sheet

   Every note name comes from FluxMusicTheory, which spells by letter: B♭ major
   is B♭ C D E♭ F G A, never A♯ C D D♯ F G A.
   ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const mod = (n, m) => ((n % m) + m) % m;

  /* ── Sound ──────────────────────────────────────────────────────────────── */
  let actx = null;
  /* On an iPhone with the ringer switch on silent, Web Audio is muted as if it
     were a ringtone — the buttons "did nothing". Telling Safari this page plays
     media (audioSession, Safari 16.4+) and, for older iOS, looping a silent
     <audio> element started from the same tap moves it to the media channel,
     which the switch does not mute. Both run once, inside the first tap. */
  let unlocked = false;
  function silentWav() {
    const n = 800, buf = new Uint8Array(44 + n), v = new DataView(buf.buffer);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) buf[o + i] = t.charCodeAt(i); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
    buf.fill(128, 44);
    let bin = '';
    buf.forEach((b) => { bin += String.fromCharCode(b); });
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function unlockMedia() {
    if (unlocked) return;
    unlocked = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    try {
      const el = document.createElement('audio');
      el.src = silentWav();
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('aria-hidden', 'true');
      el.volume = 0.01;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* no <audio> */ }
  }
  function ctx() {
    unlockMedia();
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    return actx;
  }
  /** Run fn(context) once the context is actually running — on iOS the first
      tap's resume() finishes after the click, and notes scheduled before it
      landed at a time that had already passed. */
  function withAudio(fn) {
    const c = ctx();
    if (!c) return;
    if (c.state === 'running') fn(c);
    else c.resume().then(() => fn(c), () => fn(c));
  }
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  /* A soft, piano-ish tone: a triangle with a quieter octave sine on top, a
     quick attack and an exponential fade. */
  function tone(midi, at, dur, vol) {
    withAudio((c) => toneAt(c, midi, at, dur, vol));
  }
  function toneAt(c, midi, at, dur, vol) {
    const t = c.currentTime + 0.03 + (at || 0);
    const d = dur || 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.22, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(c.destination);
    [['triangle', 1, 1], ['sine', 2, 0.25]].forEach(([type, mult, amp]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type;
      o.frequency.value = freq(midi) * mult;
      og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + d + 0.05);
    });
  }
  /** Each step is one midi number or an array sounded together. */
  function playSteps(steps, gap, dur) {
    const g = gap || 0.42;
    steps.forEach((s, i) => (Array.isArray(s) ? s : [s]).forEach((m) => tone(m, i * g, dur || Math.max(0.5, g * 1.6), Array.isArray(s) ? 0.14 : 0.22)));
  }
  function click(at, accent) {
    const c = ctx();
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(accent ? 0.18 : 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.06);
  }

  /* ── Notes, octaves and midi ────────────────────────────────────────────── */
  const NATURAL = [0, 2, 4, 5, 7, 9, 11];
  /** Give spelled notes octaves rising from `startOct`, each above the last. */
  function placeRising(notes, startOct) {
    let prevD = -1;
    return notes.map((n) => {
      let oct = startOct;
      let d = oct * 7 + n.l;
      while (d <= prevD) { oct += 1; d = oct * 7 + n.l; }
      prevD = d;
      return { l: n.l, a: n.a, oct };
    });
  }
  const midiOf = (p) => (p.oct + 1) * 12 + NATURAL[p.l] + p.a;

  /* ── Staff (SVG) ────────────────────────────────────────────────────────── */
  // Diatonic step (oct*7 + letter) of each clef's bottom line.
  const BOTTOM = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };
  const SIG_STEPS = {
    treble: { sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] },
    bass: { sharp: [24, 21, 25, 22, 19, 23, 20], flat: [20, 23, 19, 22, 18, 21, 17] },
  };
  /* Accidentals drawn as paths, centred on (x, y), so they sit exactly on
     their line or space whatever fonts the device has — as text, ♭ and ♯
     landed a space too high and some systems drew them as coloured emoji. */
  function accPath(a, x, y) {
    const P = (d, w) => `<path d="${d}" class="fc-accp" style="stroke-width:${w || 1.4}"/>`;
    const flat = (fx) => P(`M${fx} ${y - 15}V${y + 5}`) + `<path d="M${fx} ${y + 5}C${fx + 9} ${y + 1} ${fx + 9} ${y - 6} ${fx} ${y - 3}" class="fc-accp fc-accp--bowl"/>`;
    if (a === -1) return flat(x - 3);
    if (a === -2) return flat(x - 8) + flat(x);
    if (a === 1) return P(`M${x - 2.5} ${y - 11}V${y + 12}M${x + 2.5} ${y - 12}V${y + 11}`) + P(`M${x - 6} ${y - 2}L${x + 6} ${y - 5}M${x - 6} ${y + 5}L${x + 6} ${y + 2}`, 3);
    if (a === 2) return P(`M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`, 2.4);
    return P(`M${x - 3} ${y - 12}V${y + 4}M${x + 3} ${y - 4}V${y + 12}`) + P(`M${x - 3} ${y - 2}L${x + 3} ${y - 4}M${x - 3} ${y + 5}L${x + 3} ${y + 3}`, 3);
  }
  /**
   * opts.notes: [{l, a, oct}] · opts.chord: stack them in one column
   * opts.sig: {sharps, flats} draws a key signature (and hides accidentals it covers)
   * opts.clef: 'treble' | 'bass' (default: picked from the notes)
   */
  function staffSVG(opts) {
    const notes = opts.notes || [];
    const clef = opts.clef || (notes.length && notes.reduce((s, p) => s + p.oct * 7 + p.l, 0) / notes.length < 28 ? 'bass' : 'treble');
    const H = 7;                 // half a space, in px
    /* Notes far above or below the staff are written an octave or two lower
       or higher under 8va / 15ma (8vb / 15mb), as printed music does, rather
       than on a ladder of ledger lines running off the top of the picture. */
    const steps = notes.map((p) => p.oct * 7 + p.l);
    const hi = steps.length ? Math.max.apply(null, steps) : 0;
    const lo = steps.length ? Math.min.apply(null, steps) : 0;
    let shift = 0;
    while (steps.length && shift > -14 && hi + shift > BOTTOM[clef] + 8 + 7) shift -= 7;
    while (steps.length && shift < 14 && lo + shift < BOTTOM[clef] - 7) shift += 7;
    const ottava = shift === -7 ? '8va' : shift === -14 ? '15ma' : shift === 7 ? '8vb' : shift === 14 ? '15mb' : '';
    // Room for whatever ledger lines are left, above and below.
    const above = Math.max(0, (hi + shift - (BOTTOM[clef] + 8)) * H + 14);
    const below = Math.max(0, (BOTTOM[clef] - (lo + shift)) * H + 14);
    const top = Math.max(34, above + 12) + (ottava && shift < 0 ? 14 : 0); // y of the top line
    const bottom = top + 8 * H;  // y of the bottom line
    const yOf = (d) => bottom - (d - BOTTOM[clef]) * H; // d on the staff, after any octave shift
    const sig = opts.sig || { sharps: 0, flats: 0 };
    const sigCount = sig.sharps || sig.flats;
    const sigKind = sig.sharps ? 'sharp' : 'flat';
    const sigW = sigCount * 11;
    const startX = 54 + sigW + (sigCount ? 10 : 4);
    const colW = opts.chord ? 0 : 38;
    const width = opts.width || Math.max(180, startX + (opts.chord ? 70 : notes.length * colW + 30));
    const sigLetters = new Set();
    if (sigCount) {
      const order = sig.sharps ? [3, 0, 4, 1, 5, 2, 6] : [6, 2, 5, 1, 4, 0, 3];
      order.slice(0, sigCount).forEach((l) => sigLetters.add(l));
    }
    const height = bottom + Math.max(46, below + 16) + (ottava && shift > 0 ? 14 : 0);
    let s = `<svg class="fc-staff" viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="${esc(opts.label || 'Staff')}${ottava ? ', ' + ottava : ''}">`;
    if (ottava) {
      const oy = shift < 0 ? 14 : height - 8;
      s += `<text x="${startX}" y="${oy}" class="fc-ottava">${ottava}</text><line x1="${startX + 36}" x2="${width - 10}" y1="${oy - 4}" y2="${oy - 4}" class="fc-line fc-ottava-line"/>`;
    }
    for (let i = 0; i < 5; i++) s += `<line x1="6" x2="${width - 6}" y1="${top + i * 2 * H}" y2="${top + i * 2 * H}" class="fc-line"/>`;
    s += clef === 'treble'
      ? `<text x="10" y="${bottom + 9}" class="fc-clef fc-clef--treble">𝄞</text>`
      : `<text x="9" y="${top + 2 * H + 13}" class="fc-clef fc-clef--bass">𝄢</text>`;
    if (sigCount) {
      SIG_STEPS[clef][sigKind].slice(0, sigCount).forEach((d, i) => {
        s += accPath(sigKind === 'sharp' ? 1 : -1, 54 + i * 11, yOf(d));
      });
    }
    notes.forEach((p, i) => {
      const d = p.oct * 7 + p.l + shift;
      const x = opts.chord ? startX + 20 + (opts.chord && i > 0 && d - shift - (notes[i - 1].oct * 7 + notes[i - 1].l) === 1 ? 14 : 0) : startX + 16 + i * colW;
      const y = yOf(d);
      // Ledger lines above and below the staff.
      for (let ld = BOTTOM[clef] - 2; ld >= d; ld -= 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${yOf(ld)}" y2="${yOf(ld)}" class="fc-line"/>`;
      for (let ld = BOTTOM[clef] + 10; ld <= d; ld += 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${yOf(ld)}" y2="${yOf(ld)}" class="fc-line"/>`;
      const inSig = sigLetters.has(p.l) && ((sig.sharps && p.a === 1) || (sig.flats && p.a === -1));
      const needsNatural = sigLetters.has(p.l) && p.a === 0;
      if ((p.a !== 0 && !inSig) || needsNatural) {
        s += accPath(p.a, x - 19, y);
      }
      s += `<ellipse cx="${x}" cy="${y}" rx="7.4" ry="5.4" transform="rotate(-18 ${x} ${y})" class="fc-head${p.hl ? ' is-hl' : ''}"/>`;
    });
    return s + '</svg>';
  }

  /* ── Piano ──────────────────────────────────────────────────────────────── */
  /** opts: from (midi of the first C), octaves, lit (Set of midi), bass (midi) */
  function pianoHTML(opts) {
    const from = opts.from || 48;
    const octaves = opts.octaves || 2;
    const lit = opts.lit || new Set();
    const whites = [0, 2, 4, 5, 7, 9, 11];
    const whiteCount = whites.length * octaves;
    let h = `<div class="fc-piano${opts.small ? ' fc-piano--small' : ''}" style="--whites:${whiteCount}">`;
    for (let o = 0; o < octaves; o++) {
      whites.forEach((w, wi) => {
        const m = from + o * 12 + w;
        const label = w === 0 ? 'C' + (Math.floor(m / 12) - 1) : '';
        h += `<button type="button" class="fc-wkey${lit.has(m) ? ' on' : ''}${opts.bass === m ? ' bass' : ''}" data-midi="${m}" aria-label="${esc(pcName(m))}"><span>${label}</span></button>`;
      });
    }
    const blackAfter = [0, 1, 3, 4, 5];
    const blackPc = [1, 3, 6, 8, 10];
    for (let o = 0; o < octaves; o++) {
      blackAfter.forEach((wi, b) => {
        const m = from + o * 12 + blackPc[b];
        const left = ((o * 7 + wi + 1) / whiteCount) * 100;
        h += `<button type="button" class="fc-bkey${lit.has(m) ? ' on' : ''}${opts.bass === m ? ' bass' : ''}" style="left:calc(${left}% - var(--bw) / 2)" data-midi="${m}" aria-label="${esc(pcName(m))}"></button>`;
      });
    }
    return h + '</div>';
  }
  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  function pcName(m) {
    const p = mod(m, 12);
    return SHARP_NAMES[p] === FLAT_NAMES[p] ? SHARP_NAMES[p] : SHARP_NAMES[p] + ' / ' + FLAT_NAMES[p];
  }
  /** A pressed key as a spelled note with an octave (sharps for black keys). */
  function spellMidi(m, preferFlat) {
    const p = mod(m, 12);
    const nameStr = (preferFlat ? FLAT_NAMES : SHARP_NAMES)[p];
    const T = window.FluxMusicTheory;
    const n = T.parse(nameStr);
    return { l: n.l, a: n.a, oct: Math.floor((m - NATURAL[n.l] - n.a) / 12) - 1 };
  }

  /* ── Data ───────────────────────────────────────────────────────────────── */
  const SCALE_INFO = {
    'Major': ['W W H W W W H', 'Bright and settled. Same notes as the Ionian mode.'],
    'Natural minor': ['W H W W H W W', 'Darker. Same notes as the Aeolian mode; shares its key signature with the relative major.'],
    'Harmonic minor': ['W H W W H W+H H', 'Raised 7th, so V is major and the leading note pulls home; the gap of a tone and a half gives it its colour.'],
    'Melodic minor': ['W H W W W W H', 'Raised 6th and 7th going up (classically, the natural minor coming down).'],
    'Dorian': ['W H W W W H W', 'Minor with a raised 6th. Folk, jazz and rock.'],
    'Phrygian': ['H W W W H W W', 'Minor with a flat 2nd — Spanish and flamenco colour.'],
    'Lydian': ['W W W H W W H', 'Major with a raised 4th — bright, floating, film-score.'],
    'Mixolydian': ['W W H W W H W', 'Major with a flat 7th — rock, folk and blues.'],
    'Locrian': ['H W W H W W W', 'Diminished 5th above the tonic; rarely a home key.'],
    'Major pentatonic': ['W W W+H W W+H', 'Five notes, no semitones — folk melodies across the world.'],
    'Minor pentatonic': ['W+H W W W+H W', 'The rock and blues soloing scale.'],
    'Blues': ['W+H W H H W+H W', 'Minor pentatonic plus the flattened 5th, the blue note.'],
    'Whole tone': ['W W W W W W', 'Six notes a tone apart — dreamy, no pull home (Debussy).'],
  };
  const CHORD_INFO = {
    'Major': 'Root, major 3rd, perfect 5th. Stable and bright.',
    'Minor': 'Root, minor 3rd, perfect 5th. Stable and darker.',
    'Diminished': 'Two minor 3rds stacked. Tense; the leading-note chord (vii°) of a major key.',
    'Augmented': 'Two major 3rds stacked. Unsettled; III+ in harmonic minor.',
    'Major 7': 'Major triad plus a major 7th. Soft, jazzy.',
    'Minor 7': 'Minor triad plus a minor 7th. Mellow; ii7 in a major key.',
    'Dominant 7': 'Major triad plus a minor 7th. The V7 that pulls to I.',
    'Half-diminished 7': 'Diminished triad plus a minor 7th. ii in a minor key.',
    'Diminished 7': 'Three minor 3rds stacked. Very tense; vii°7 in harmonic minor.',
    'sus2': 'The 3rd replaced by the 2nd. Open, unresolved.',
    'sus4': 'The 3rd replaced by the 4th. Wants to fall back to the 3rd.',
  };
  /* Interval: semitones, name, letters up from C, and a short description. */
  const INTERVALS = [
    [0, 'Perfect unison', 0, 'The same note.'],
    [1, 'Minor 2nd', 1, 'A semitone — tense, the shark theme.'],
    [2, 'Major 2nd', 1, 'A tone — the step of most scales.'],
    [3, 'Minor 3rd', 2, 'The interval that makes a chord minor.'],
    [4, 'Major 3rd', 2, 'The interval that makes a chord major.'],
    [5, 'Perfect 4th', 3, 'Open and strong — "Here comes the bride".'],
    [6, 'Augmented 4th', 3, 'The tritone: half an octave, very unstable.'],
    [7, 'Perfect 5th', 4, 'The most stable after the octave; power chords.'],
    [8, 'Minor 6th', 5, 'Bittersweet.'],
    [9, 'Major 6th', 5, 'Warm and open.'],
    [10, 'Minor 7th', 6, 'The 7th of a dominant 7th chord.'],
    [11, 'Major 7th', 6, 'A semitone below the octave — very tense.'],
    [12, 'Perfect octave', 7, 'The same note name, twice the frequency.'],
  ];
  const CADENCES = [
    ['Perfect', 'V → I', [4, 0], 'Sounds finished — a full stop. Also called authentic.'],
    ['Plagal', 'IV → I', [3, 0], 'The "Amen" cadence: finished, but softer.'],
    ['Imperfect', 'I → V', [0, 4], 'Ends on V — a comma, the phrase is not over. Any chord to V counts.'],
    ['Interrupted', 'V → vi', [4, 5], 'Sets up I and swerves to vi — a surprise. Also called deceptive.'],
  ];
  const PROGRESSIONS = [
    ['Pop / "four chords"', [0, 4, 5, 3], 'I–V–vi–IV: the backbone of countless pop songs.'],
    ['Doo-wop', [0, 5, 3, 4], 'I–vi–IV–V: 1950s ballads.'],
    ['Jazz ii–V–I', [1, 4, 0], 'The most common progression in jazz.'],
    ['Pachelbel', [0, 4, 5, 2, 3, 0, 3, 4], 'I–V–vi–iii–IV–I–IV–V: the Canon in D.'],
    ['12-bar blues', [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], 'I I I I · IV IV I I · V IV I V.'],
    ['Circle of fifths', [0, 3, 6, 2, 5, 1, 4, 0], 'I–IV–vii°–iii–vi–ii–V–I: each root a 5th down.'],
  ];
  const NOTE_VALUES = [
    ['Semibreve', 'Whole note', 4, 'whole'],
    ['Minim', 'Half note', 2, 'half'],
    ['Crotchet', 'Quarter note', 1, 'quarter'],
    ['Quaver', 'Eighth note', 0.5, 'eighth'],
    ['Semiquaver', 'Sixteenth note', 0.25, 'sixteenth'],
    ['Dotted minim', 'Dotted half note', 3, 'half', true],
    ['Dotted crotchet', 'Dotted quarter note', 1.5, 'quarter', true],
    ['Dotted quaver', 'Dotted eighth note', 0.75, 'eighth', true],
  ];
  const TIME_SIGS = [
    ['2/4', 'Simple duple', 'Two crotchet beats — marches.'],
    ['3/4', 'Simple triple', 'Three crotchet beats — waltzes, minuets.'],
    ['4/4', 'Simple quadruple', 'Four crotchet beats — "common time", most pop.'],
    ['6/8', 'Compound duple', 'Two dotted-crotchet beats, each split in three — jigs, lilting songs.'],
    ['9/8', 'Compound triple', 'Three dotted-crotchet beats.'],
    ['12/8', 'Compound quadruple', 'Four dotted-crotchet beats — slow blues and gospel.'],
    ['5/4', 'Irregular', 'Five beats, usually grouped 3+2 or 2+3 — "Take Five", "Mars".'],
    ['7/8', 'Irregular', 'Seven quavers grouped 2+2+3 or similar — Balkan folk, progressive rock.'],
  ];
  const TEMPO_WORDS = [[40, 'Grave'], [46, 'Largo'], [60, 'Larghetto'], [66, 'Adagio'], [76, 'Andante'], [108, 'Moderato'], [120, 'Allegro'], [168, 'Vivace'], [176, 'Presto'], [200, 'Prestissimo']];
  const tempoWord = (bpm) => { let w = TEMPO_WORDS[0][1]; TEMPO_WORDS.forEach(([b, n]) => { if (bpm >= b) w = n; }); return w; };

  /* Approximate sounding ranges, midi low–high. Ranges vary with the player. */
  const RANGES = [
    ['Strings', [['Violin', 55, 103], ['Viola', 48, 88], ['Cello', 36, 81], ['Double bass', 28, 67], ['Harp', 23, 104]]],
    ['Woodwind', [['Piccolo', 74, 108], ['Flute', 60, 96], ['Oboe', 58, 93], ['Clarinet in B♭', 50, 94], ['Bassoon', 34, 75], ['Alto saxophone', 49, 81]]],
    ['Brass', [['Trumpet in B♭', 52, 82], ['Horn in F', 35, 77], ['Trombone', 40, 72], ['Tuba', 26, 65]]],
    ['Percussion & keyboard', [['Timpani', 38, 57], ['Xylophone', 65, 108], ['Glockenspiel', 79, 108], ['Piano', 21, 108]]],
    ['Voices', [['Soprano', 60, 81], ['Alto', 53, 74], ['Tenor', 48, 69], ['Bass', 40, 64]]],
  ];
  const TRANSPOSE = [
    ['Piccolo', 12, 'Sounds an octave higher than written'],
    ['Flute · Oboe · Bassoon', 0, 'Concert pitch'],
    ['Cor anglais (in F)', -7, 'Sounds a perfect 5th lower'],
    ['Clarinet in B♭', -2, 'Sounds a major 2nd lower'],
    ['Clarinet in A', -3, 'Sounds a minor 3rd lower'],
    ['Bass clarinet in B♭', -14, 'Sounds a major 9th lower (treble-clef notation)'],
    ['Alto saxophone in E♭', -9, 'Sounds a major 6th lower'],
    ['Tenor saxophone in B♭', -14, 'Sounds a major 9th lower'],
    ['Horn in F', -7, 'Sounds a perfect 5th lower'],
    ['Trumpet in B♭', -2, 'Sounds a major 2nd lower'],
    ['Trombone · Tuba', 0, 'Concert pitch'],
    ['Double bass', -12, 'Sounds an octave lower than written'],
    ['Guitar', -12, 'Sounds an octave lower than written'],
    ['Glockenspiel', 24, 'Sounds two octaves higher'],
    ['Xylophone · Celesta', 12, 'Sounds an octave higher'],
  ];
  const SCORE_ORDER = [
    ['Woodwind', 'Piccolo, flutes, oboes, cor anglais, clarinets, bass clarinet, bassoons, contrabassoon'],
    ['Brass', 'Horns, trumpets, trombones, tuba — horns above trumpets by convention'],
    ['Percussion', 'Timpani first, then the rest'],
    ['Harp & keyboards', 'Harp, celesta, piano, organ'],
    ['Voices', 'Soloists, then chorus — when the work has them'],
    ['Strings', 'Violin I, Violin II, Viola, Cello, Double bass — always at the bottom'],
  ];
  const CLEFS = [
    ['Treble', 'Violin, flute, oboe, clarinet, trumpet, horn, right hand of the piano'],
    ['Alto', 'Viola — middle C on the middle line'],
    ['Tenor', 'High cello, trombone and bassoon passages'],
    ['Bass', 'Cello, double bass, bassoon, trombone, tuba, timpani, left hand of the piano'],
  ];
  /* Glossary: [term, meaning, group]. */
  const TERMS = [
    ['Grave', 'Very slow and solemn', 'Tempo'], ['Largo', 'Broad and slow', 'Tempo'], ['Adagio', 'Slow, at ease', 'Tempo'],
    ['Andante', 'At a walking pace', 'Tempo'], ['Moderato', 'At a moderate speed', 'Tempo'], ['Allegretto', 'Moderately fast', 'Tempo'],
    ['Allegro', 'Fast and bright', 'Tempo'], ['Vivace', 'Lively', 'Tempo'], ['Presto', 'Very fast', 'Tempo'],
    ['Accelerando (accel.)', 'Gradually getting faster', 'Tempo'], ['Ritardando (rit.) / Rallentando (rall.)', 'Gradually getting slower', 'Tempo'],
    ['Rubato', 'Flexible time — pushing and pulling the beat expressively', 'Tempo'], ['A tempo', 'Back to the previous speed', 'Tempo'],
    ['Fermata', 'A pause: hold the note longer than written', 'Tempo'],
    ['pp · p', 'Very soft · soft (piano)', 'Dynamics'], ['mp · mf', 'Moderately soft · moderately loud (mezzo)', 'Dynamics'],
    ['f · ff', 'Loud · very loud (forte)', 'Dynamics'], ['Crescendo (cresc.)', 'Gradually louder', 'Dynamics'],
    ['Diminuendo (dim.) / Decrescendo', 'Gradually softer', 'Dynamics'], ['Sforzando (sfz)', 'A sudden strong accent on one note', 'Dynamics'],
    ['Subito', 'Suddenly — as in subito p', 'Dynamics'],
    ['Legato', 'Smooth and joined', 'Articulation'], ['Staccato', 'Short and detached', 'Articulation'], ['Accent', 'Emphasise the note', 'Articulation'],
    ['Tenuto', 'Hold for the full value, slightly stressed', 'Articulation'], ['Marcato', 'Marked and emphatic', 'Articulation'],
    ['Pizzicato (pizz.) / Arco', 'Plucked / with the bow', 'Articulation'], ['Con sordino', 'With a mute', 'Articulation'],
    ['Tremolo', 'Rapid repetition of a note, or between two notes', 'Articulation'], ['Glissando', 'A slide between two pitches', 'Articulation'],
    ['Vibrato', 'A slight, regular wobble in pitch for warmth', 'Articulation'],
    ['Binary (AB)', 'Two contrasting sections, often each repeated', 'Form'], ['Ternary (ABA)', 'A section, a contrast, then the first section back', 'Form'],
    ['Rondo (ABACA…)', 'A main theme that keeps returning between episodes', 'Form'],
    ['Theme and variations', 'A theme, then altered versions of it', 'Form'],
    ['Sonata form', 'Exposition (two themes, two keys) · development · recapitulation', 'Form'],
    ['Strophic', 'The same music for every verse', 'Form'], ['Through-composed', 'New music for each section of text, no repeats', 'Form'],
    ['Verse–chorus', 'Alternating verses and a repeated chorus — most popular song', 'Form'],
    ['Ritornello', 'A returning orchestral passage between solo episodes (Baroque concerto)', 'Form'],
    ['Monophonic', 'A single melody line with no accompaniment', 'Texture'], ['Homophonic', 'A melody with chordal accompaniment', 'Texture'],
    ['Polyphonic / contrapuntal', 'Several independent melodies at once', 'Texture'], ['Heterophonic', 'Different versions of the same melody at the same time', 'Texture'],
    ['Ostinato', 'A short pattern repeated over and over', 'Devices'], ['Riff', 'An ostinato in popular music', 'Devices'],
    ['Sequence', 'A phrase repeated at a higher or lower pitch', 'Devices'], ['Imitation', 'A phrase copied in another part', 'Devices'],
    ['Canon', 'Strict imitation — a round', 'Devices'], ['Pedal', 'A held or repeated note, usually in the bass, under changing harmony', 'Devices'],
    ['Drone', 'A sustained note or chord throughout', 'Devices'], ['Syncopation', 'Accents off the beat', 'Devices'],
    ['Hemiola', 'Two bars of 3 heard as three bars of 2', 'Devices'], ['Modulation', 'Changing key within a piece', 'Devices'],
    ['Call and response', 'A phrase answered by another, often by a group', 'Devices'], ['Cadence', 'A chord progression that ends a phrase', 'Devices'],
    ['Melisma', 'Several notes sung on one syllable', 'Devices'], ['Word painting', 'Music that imitates the meaning of the words', 'Devices'],
  ];
  const DIMS = [['Timbre', 'Tone colour — what makes instruments and voices sound different.'], ['Melody', 'A shaped succession of pitches.'], ['Harmony', 'Pitches sounded together — chords and how they move.'], ['Dynamics', 'How loud or soft, and how that changes.'], ['Articulation', 'How notes are attacked and joined — legato, staccato, accents.'], ['Texture', 'How the layers combine — mono-, homo-, polyphonic.'], ['Meter', 'How beats are grouped — time signature and pulse.'], ['Tempo', 'Speed, and how it changes.'], ['Form', 'The structure — how sections repeat and contrast.']];
  const METADIMS = [['Style', 'The characteristic features a body of music shares.'], ['Architecture', 'Large-scale design and proportion.'], ['Affective qualities', 'The emotions and moods it evokes.'], ['Sense of ensemble', 'How the performers work together.'], ['Personal context', 'What the music means to you and to its makers.'], ['Cultural context', 'The culture it comes from and speaks to.'], ['Historical context', 'When it was made and what shaped it.'], ['Sense of simultaneity', 'Many dimensions working at once.'], ['Genre', 'The kind of music, and its conventions.']];
  const AREAS = [
    ['1', 'Music for sociocultural and political expression', 'Protest songs, anthems, sacred music, music of identity and community.'],
    ['2', 'Music for listening and performance', 'Concert, chamber and popular music made to be listened to and performed.'],
    ['3', 'Music for dramatic impact, movement and entertainment', 'Film, game, theatre and dance music.'],
    ['4', 'Music technology in the electronic and digital age', 'Electronic, sampled and produced music, and how technology shapes it.'],
  ];
  const CONTEXTS = [['Personal', 'Music that matters to you.'], ['Local', 'Music of your community or region.'], ['Global', 'Music from cultures beyond your own.']];
  const ROLES = [['Researcher', 'Investigating music, its contexts and how it works.'], ['Creator', 'Composing, arranging, improvising and producing.'], ['Performer', 'Bringing music to life for an audience.']];
  const COMPONENTS = [
    ['Exploring music in context', 'SL & HL · external', 'A portfolio exploring diverse music through written work, practical exercises and creative responses.'],
    ['Experimenting with music', 'SL & HL · internal', 'An experimentation report with practical evidence of creating and performing.'],
    ['Presenting music', 'SL & HL · external', 'A collection of finished work: a programme note, compositions and/or performances.'],
    ['The contemporary music-maker', 'HL only · internal', 'A collaborative, multimedia project presented with a continuous multimedia submission.'],
  ];

  /* ── Small helpers ──────────────────────────────────────────────────────── */
  const T = () => window.FluxMusicTheory;
  const nm = (n) => T().name(n);
  const ROOTS = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
  const selectHTML = (id, value, options, label) => `<select id="${id}" class="fc-select" aria-label="${esc(label)}">${options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const segHTML = (id, value, options) => `<div class="fc-seg" id="${id}" role="radiogroup">${options.map(([v, l]) => `<button type="button" role="radio" data-v="${esc(v)}" aria-checked="${v === value}">${esc(l)}</button>`).join('')}</div>`;
  const card = (title, sub, inner, cls) => `<section class="fc-card${cls ? ' ' + cls : ''}">${title ? `<h2 class="fc-h">${title}</h2>` : ''}${sub ? `<p class="fc-sub">${sub}</p>` : ''}${inner}</section>`;
  /** Respell a scale/chord that would need double accidentals (A♯ major → B♭ major). */
  function spell(rootName, kind, type) {
    const make = (r) => (kind === 'scale' ? T().scale(r, type) : T().chord(r, type));
    let root = T().parse(rootName);
    let notes = make(root);
    let note = '';
    if (T().hasDouble(notes)) {
      const alt = T().respell(root);
      const altNotes = alt ? make(alt) : null;
      if (altNotes && !T().hasDouble(altNotes)) {
        note = `${nm(root)} ${type.toLowerCase()} would need ${T().andList(notes.filter((n) => Math.abs(n.a) >= 2).map(nm))}, so it is written as ${nm(alt)} ${type.toLowerCase()} — same sounds, easier to read.`;
        root = alt; notes = altNotes;
      }
    }
    return { root, notes, note };
  }
  /** Midi values for notes rising from octave 4 (or `oct`). */
  const risingMidi = (notes, oct) => placeRising(notes, oct == null ? 4 : oct).map(midiOf);
  /** A triad voiced for playback: root in the bass an octave down, the chord above. */
  const voiced = (notes) => { const up = risingMidi(notes, 4); return [up[0] - 12].concat(up); };

  /* ── Mount ──────────────────────────────────────────────────────────────── */
  const TABS = [
    ['keys', 'Keys'], ['keyboard', 'Keyboard'], ['scales', 'Scales & modes'], ['chords', 'Chords'],
    ['harmony', 'Harmony'], ['intervals', 'Intervals'], ['rhythm', 'Rhythm'], ['beats', 'Beat Maker'], ['orchestra', 'Orchestra'],
    ['terms', 'Terms'], ['dp', 'DP Music'],
  ];

  /* Beat Maker rows and styles. Rows are 16 steps, x = hit; missing rows are empty. */
  const BT_DRUMS = [['kick', 'Kick'], ['snare', 'Snare'], ['clap', 'Clap'], ['hat', 'Hi-hat'], ['open', 'Open'], ['tom', 'Tom'], ['bell', 'Cowbell']];
  const BT_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const BT_IDS = BT_DRUMS.map((d) => d[0]).concat(['k0', 'k1', 'k2', 'k3', 'k4', 'bass']);
  const BT_PRESETS = {
    'Boom bap': { bpm: 90, swing: 25, kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x......x..x.....', k2: '..........x.....', k1: 'x...............' },
    House: { bpm: 124, swing: 0, kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..x...x...x...x.', bass: '..x...x...x...x.' },
    Rock: { bpm: 110, swing: 0, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: '.............xx.', bass: 'x.....x.x.......' },
    Trap: { bpm: 140, swing: 0, kick: 'x......x..x.....', snare: '........x.......', hat: 'x.xxx.x.x.xxxxxx', open: '.......x........', bass: 'x......x..x.....' },
    Reggaeton: { bpm: 96, swing: 0, kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x..x..x.' },
    'Bossa nova': { bpm: 120, swing: 0, kick: 'x..xx..xx..xx..x', clap: 'x..x..x...x..x..', hat: 'xxxxxxxxxxxxxxxx', bass: 'x..x....x..x....', k2: 'x.......x.......' },
    Funk: { bpm: 100, swing: 15, kick: 'x.x....x..x.....', snare: '....x..x.x..x..x', hat: 'xxxxxxxxxxxxxxxx', bell: 'x.....x.....x...', bass: 'x.x....x..x..x..' },
  };

  function mount(host, opts) {
    opts = opts || {};
    if (!host || !window.FluxMusicTheory) return null;
    const st = {
      tab: 'keys',
      key: { tonic: 'C', mode: 'major' },
      kb: { from: 48, played: [], flat: false },
      sc: { root: 'C', type: 'Major' },
      ch: { root: 'C', type: 'Major' },
      hm: { tonic: 'C', mode: 'major' },
      iv: { quiz: null, score: 0, asked: 0, pool: 'all' },
      mt: { bpm: 96, beats: 4, on: false, timer: null, next: 0, beat: 0, taps: [] },
      tr: { i: 8, note: 'C', dir: 'sounding' },
      terms: { q: '', group: 'All' },
      dp: { sel: { kind: 'core', i: 0 } },
      bt: { bpm: 90, swing: 25, key: 'C', mode: 'minor', preset: 'Boom bap', rows: {}, on: false, timer: null, bar: 0, step: 0 },
    };
    const VALID = new Set(TABS.map((t) => t[0]));
    function readHash() {
      if (!opts.hash) return;
      const h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
      const [tab, rest] = h.split('/');
      if (VALID.has(tab)) st.tab = tab;
      if (tab === 'beats' && rest) btFromCode(rest);
      if (tab === 'keys' && rest) {
        const m = /^(.+?)-(major|minor)$/.exec(rest);
        if (m && T().parse(m[1])) st.key = { tonic: m[1], mode: m[2] };
      }
    }
    function writeHash() {
      if (!opts.hash) return;
      const h = '#' + st.tab + (st.tab === 'keys' ? '/' + st.key.tonic + '-' + st.key.mode : st.tab === 'beats' ? '/' + btCode() : '');
      if (location.hash !== h) history.replaceState(null, '', h);
    }
    btLoad('Boom bap');
    readHash();

    host.innerHTML = `<div class="fc-root">
      <nav class="fc-tabs" role="tablist" aria-label="Flux Composer">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === st.tab}">${esc(label)}</button>`).join('')}</nav>
      <div class="fc-body" id="fcBody"></div></div>`;
    const tabsEl = host.querySelector('.fc-tabs');
    const body = host.querySelector('#fcBody');
    tabsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b || b.dataset.tab === st.tab) return;
      stopMetronome(); stopBeats();
      st.tab = b.dataset.tab;
      render();
      b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    // Any [data-play] anywhere plays its notes: "60,64,67" in sequence, "60+64+67" together.
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-play]');
      if (!b) return;
      const gap = +(b.dataset.gap || 0.42);
      const steps = b.dataset.play.split(',').map((s) => (s.includes('+') ? s.split('+').map(Number) : Number(s)));
      playSteps(steps, gap);
    });

    // Space plays and stops the Beat Maker, unless you are typing or on a button.
    document.addEventListener('keydown', (e) => {
      if (st.tab !== 'beats' || e.key !== ' ' || e.repeat || !host.isConnected) return;
      if (e.target.closest && e.target.closest('input, select, textarea, button, [contenteditable]')) return;
      e.preventDefault();
      if (st.bt.on) stopBeats(); else startBeats();
    });

    const RENDER = { keys: renderKeys, keyboard: renderKeyboard, scales: renderScales, chords: renderChords, harmony: renderHarmony, intervals: renderIntervals, rhythm: renderRhythm, beats: renderBeats, orchestra: renderOrchestra, terms: renderTerms, dp: renderDP };
    function render() {
      tabsEl.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
      (RENDER[st.tab] || renderKeys)();
      writeHash();
    }

    /* ── Keys: the table ──────────────────────────────────────────────────── */
    /* Columns run from seven flats to seven sharps, like groups across the
       periodic table; the top row is the major key, the bottom its relative
       minor — the same key signature, so the same column. */
    const KEY_COLS = [
      ['C♭', 'A♭'], ['G♭', 'E♭'], ['D♭', 'B♭'], ['A♭', 'F'], ['E♭', 'C'], ['B♭', 'G'], ['F', 'D'],
      ['C', 'A'],
      ['G', 'E'], ['D', 'B'], ['A', 'F♯'], ['E', 'C♯'], ['B', 'G♯'], ['F♯', 'D♯'], ['C♯', 'A♯'],
    ];
    function keyTile(tonic, mode, idx) {
      const k = T().keyFor(tonic, mode);
      const n = idx - 7;
      const fam = n === 0 ? 'nat' : (n > 0 ? 'sharp' : 'flat');
      const on = st.key.tonic === tonic && st.key.mode === mode;
      const count = Math.abs(n);
      return `<button type="button" class="fc-tile fc-tile--${fam}${on ? ' is-on' : ''}" data-key="${esc(tonic)}" data-mode="${mode}" style="--depth:${count}" aria-pressed="${on}" aria-label="${esc(k.label)}, ${esc(k.signatureText)}">
        <span class="fc-tile-n">${count ? count + (n > 0 ? '♯' : '♭') : '0'}</span>
        <span class="fc-tile-s">${esc(tonic)}${mode === 'minor' ? '<small>m</small>' : ''}</span>
        <span class="fc-tile-l">${mode === 'major' ? 'major' : 'minor'}</span></button>`;
    }
    function renderKeys() {
      const k = T().keyFor(st.key.tonic, st.key.mode);
      const grid = `<div class="fc-table-wrap"><div class="fc-table" role="group" aria-label="Table of keys">
        <div class="fc-table-axis"><span>7♭</span><span>flats</span><span class="fc-axis-mid">no sharps or flats</span><span>sharps</span><span>7♯</span></div>
        <div class="fc-row-label">Major</div>${KEY_COLS.map((c, i) => keyTile(c[0], 'major', i)).join('')}
        <div class="fc-row-label">Minor</div>${KEY_COLS.map((c, i) => keyTile(c[1], 'minor', i)).join('')}
      </div></div>
      <div class="fc-legend"><span class="fc-lg fc-lg--flat">Flat keys</span><span class="fc-lg fc-lg--nat">C major / A minor</span><span class="fc-lg fc-lg--sharp">Sharp keys</span><span class="fc-lg-note">Each column shares one key signature. Tap a key.</span></div>`;
      const triads = T().diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor');
      const scaleNotes = placeRising(k.scale.concat([k.scale[0]]), 4);
      const scaleMidi = scaleNotes.map(midiOf);
      const bassScale = placeRising(k.scale.concat([k.scale[0]]), 2);
      const tonicTriad = voiced(triads[0].notes);
      const dom = T().diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Harmonic minor')[4];
      const sub = triads[3];
      const cadence = [tonicTriad, voiced(sub.notes), voiced(dom.notes), tonicTriad].map((c) => c.join('+')).join(',');
      const detail = `<div class="fc-key">
        <div class="fc-key-head">
          <div><div class="fc-key-big">${esc(k.label)}</div>
          <div class="fc-key-meta">${esc(k.signatureNotes.length ? k.signatureText + ' · ' + k.signatureNotes.join(' ') : 'No sharps or flats')}</div></div>
          <div class="fc-actions">
            <button type="button" class="fc-btn fc-btn--primary" data-play="${scaleMidi.join(',')}" data-gap="0.3">▶ Scale</button>
            <button type="button" class="fc-btn" data-play="${cadence}" data-gap="0.75">▶ I–IV–V–I</button>
          </div></div>
        <div class="fc-facts">
          <div><span>Relative ${k.mode === 'major' ? 'minor' : 'major'}</span><button type="button" class="fc-link" data-goto-key="${esc(k.relative)}">${esc(k.relative)}</button></div>
          ${k.enharmonic ? `<div><span>Enharmonic</span><button type="button" class="fc-link" data-goto-key="${esc(k.enharmonic.label)}">${esc(k.enharmonic.label)}</button></div>` : ''}
          <div><span>Dominant (V)</span><b>${esc(dom.symbol)}</b></div>
          <div><span>Scale</span><b>${esc(k.scale.map(nm).join(' '))}</b></div>
        </div>
        ${k.respelledFrom ? `<p class="fc-note">${esc(k.why)}</p>` : ''}
        <div class="fc-staves">${staffSVG({ notes: scaleNotes, sig: k.signature, clef: 'treble', label: k.label + ' scale, treble clef' })}${staffSVG({ notes: bassScale, sig: k.signature, clef: 'bass', label: k.label + ' scale, bass clef' })}</div>
        <h3 class="fc-h3">Chords in ${esc(k.label)}</h3>
        <div class="fc-chips">${triads.map((c) => `<button type="button" class="fc-chip" data-play="${voiced(c.notes).join('+')}"><b>${esc(c.numeral)}</b> ${esc(c.symbol)}</button>`).join('')}</div>
        ${k.mode === 'minor' ? `<p class="fc-note">In harmonic minor the 7th is raised to <b>${esc(nm(T().scale(k.tonic, 'Harmonic minor')[6]))}</b>, so v becomes <b>V</b> (${esc(dom.symbol)}) — the chord that pulls home.</p>` : ''}
      </div>`;
      body.innerHTML = card('The table of keys', 'Every major and minor key, arranged by key signature — flats to the left, sharps to the right.', grid) + card('', '', detail, 'fc-card--detail');
      body.querySelectorAll('.fc-tile').forEach((t) => t.addEventListener('click', () => {
        st.key = { tonic: t.dataset.key, mode: t.dataset.mode };
        renderKeys();
        writeHash();
        const d = body.querySelector('.fc-card--detail');
        if (d && window.matchMedia('(max-width: 900px)').matches) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      body.querySelectorAll('[data-goto-key]').forEach((b) => b.addEventListener('click', () => {
        const m = /^(.+) (major|minor)$/.exec(b.dataset.gotoKey);
        if (!m) return;
        st.key = { tonic: m[1], mode: m[2] };
        renderKeys();
        writeHash();
      }));
    }

    /* ── Keyboard ─────────────────────────────────────────────────────────── */
    const KB_MAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
    let kbKeyHandler = null;
    function renderKeyboard() {
      const kb = st.kb;
      const last = kb.played.slice(-6);
      const lit = new Set(last.slice(-1));
      const lastNote = last.length ? spellMidi(last[last.length - 1], kb.flat) : null;
      let intervalTxt = '';
      if (last.length >= 2) {
        const a = last[last.length - 2], b = last[last.length - 1];
        const diff = Math.abs(b - a);
        const iv = INTERVALS.find((x) => x[0] === diff % 12) || INTERVALS[0];
        const oct = Math.floor(diff / 12);
        intervalTxt = diff === 0 ? 'Same note' : `${diff % 12 === 0 ? 'Octave' + (oct > 1 ? ' ×' + oct : '') : iv[1] + (oct ? ' + ' + oct + ' octave' + (oct > 1 ? 's' : '') : '')} ${b > a ? 'up' : 'down'} · ${diff} semitone${diff === 1 ? '' : 's'}`;
      }
      const info = lastNote
        ? `<div class="fc-kb-now"><div class="fc-kb-name">${esc(nm(lastNote))}<sub>${lastNote.oct}</sub></div>
             <div class="fc-kb-sub">${esc(pcName(last[last.length - 1]))} · ${freq(last[last.length - 1]).toFixed(2)} Hz · midi ${last[last.length - 1]}</div>
             ${intervalTxt ? `<div class="fc-kb-int">${esc(intervalTxt)}</div>` : ''}</div>
           <div class="fc-staves">${staffSVG({ notes: last.map((m) => spellMidi(m, kb.flat)), label: 'Notes played' })}</div>`
        : '<p class="fc-sub">Tap a key, or use your computer keyboard: <b>A W S E D F T G Y H U J K</b> play a chromatic octave.</p>';
      body.innerHTML = card('Keyboard', 'Three octaves. Every note you play is named, measured and written on the staff.',
        `<div class="fc-row">
           <button type="button" class="fc-btn" id="kbDown" ${kb.from <= 24 ? 'disabled' : ''}>◀ Lower</button>
           <span class="fc-pill">C${Math.floor(kb.from / 12) - 1} – B${Math.floor(kb.from / 12) + 1}</span>
           <button type="button" class="fc-btn" id="kbUp" ${kb.from >= 84 ? 'disabled' : ''}>Higher ▶</button>
           ${segHTML('kbSpell', kb.flat ? 'flat' : 'sharp', [['sharp', 'Sharps'], ['flat', 'Flats']])}
           <button type="button" class="fc-btn" id="kbClear">Clear</button></div>
         ${pianoHTML({ from: kb.from, octaves: 3, lit })}
         <div class="fc-kb-info">${info}</div>`);
      body.querySelectorAll('.fc-piano [data-midi]').forEach((k) => k.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressKey(+k.dataset.midi);
      }));
      body.querySelector('#kbDown').addEventListener('click', () => { kb.from -= 12; renderKeyboard(); });
      body.querySelector('#kbUp').addEventListener('click', () => { kb.from += 12; renderKeyboard(); });
      body.querySelector('#kbClear').addEventListener('click', () => { kb.played = []; renderKeyboard(); });
      body.querySelector('#kbSpell').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; kb.flat = b.dataset.v === 'flat'; renderKeyboard(); });
      if (!kbKeyHandler) {
        kbKeyHandler = (e) => {
          if (st.tab !== 'keyboard' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
          const tag = (document.activeElement && document.activeElement.tagName) || '';
          if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
          const off = KB_MAP[e.key.toLowerCase()];
          if (off == null) return;
          e.preventDefault();
          pressKey(st.kb.from + 12 + off);
        };
        document.addEventListener('keydown', kbKeyHandler);
      }
    }
    function pressKey(m) {
      tone(m, 0, 1.1, 0.25);
      st.kb.played.push(m);
      if (st.kb.played.length > 12) st.kb.played.shift();
      renderKeyboard();
    }

    /* ── Scales & modes ───────────────────────────────────────────────────── */
    function renderScales() {
      const sc = st.sc;
      const types = Object.keys(T().SCALES);
      if (types.indexOf(sc.type) === -1) sc.type = 'Major';
      const s = spell(sc.root, 'scale', sc.type);
      const up = placeRising(s.notes.concat([s.notes[0]]), 4);
      const midi = up.map(midiOf);
      const info = SCALE_INFO[sc.type] || ['', ''];
      const modes = ['Major', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Natural minor', 'Locrian'];
      const modeNames = { Major: 'Ionian (major)', 'Natural minor': 'Aeolian (natural minor)' };
      const cMajor = T().scale(T().parse('C'), 'Major');
      const modeRows = modes.map((m, i) => {
        const tonic = cMajor[i];
        const notes = T().scale(tonic, m);
        return `<tr><td><b>${esc(modeNames[m] || m)}</b></td><td>${esc(nm(tonic))} to ${esc(nm(tonic))}</td><td class="fc-mono">${esc((SCALE_INFO[m] || [''])[0])}</td>
          <td><button type="button" class="fc-btn fc-btn--small" data-play="${risingMidi(notes.concat([notes[0]]), 4).join(',')}" data-gap="0.26" aria-label="Play ${esc(m)}">▶</button></td></tr>`;
      }).join('');
      body.innerHTML = card('Scales &amp; modes', 'Pick a starting note and a scale. Notes are spelled with one letter each, the way they are written.',
        `<div class="fc-row">${selectHTML('scRoot', sc.root, ROOTS, 'Starting note')}${selectHTML('scType', sc.type, types, 'Scale')}
          <button type="button" class="fc-btn fc-btn--primary" data-play="${midi.join(',')}" data-gap="0.28">▶ Up</button>
          <button type="button" class="fc-btn" data-play="${midi.slice().reverse().join(',')}" data-gap="0.28">▶ Down</button></div>
         <div class="fc-out">${esc(s.notes.map(nm).join(' · '))}</div>
         ${s.note ? `<p class="fc-note">${esc(s.note)}</p>` : ''}
         <p class="fc-sub"><span class="fc-mono">${esc(info[0])}</span>${info[0] ? ' — ' : ''}${esc(info[1])}</p>
         <div class="fc-staves">${staffSVG({ notes: up, clef: 'treble', label: 'Scale' })}</div>
         ${pianoHTML({ from: 60, octaves: 2, lit: new Set(midi), small: true })}`)
        + card('The modes', 'The seven modes use the white notes of C major, each starting on a different note. W = tone, H = semitone.',
          `<div class="fc-table-scroll"><table class="fc-tbl"><thead><tr><th>Mode</th><th>White notes</th><th>Steps</th><th></th></tr></thead><tbody>${modeRows}</tbody></table></div>`);
      body.querySelector('#scRoot').addEventListener('change', (e) => { sc.root = e.target.value; renderScales(); });
      body.querySelector('#scType').addEventListener('change', (e) => { sc.type = e.target.value; renderScales(); });
      wirePianoTaps();
    }
    function wirePianoTaps() {
      body.querySelectorAll('.fc-piano [data-midi]').forEach((k) => k.addEventListener('click', () => tone(+k.dataset.midi, 0, 1, 0.25)));
    }

    /* ── Chords ───────────────────────────────────────────────────────────── */
    function renderChords() {
      const ch = st.ch;
      const types = Object.keys(T().CHORDS);
      const s = spell(ch.root, 'chord', ch.type);
      const placed = placeRising(s.notes, 4);
      const midi = placed.map(midiOf);
      const symbol = nm(s.root) + T().CHORDS[ch.type].sym;
      const invs = T().inversions(s.root, ch.type);
      const invCards = invs.map((v) => {
        const p = placeRising(v.notes, 4);
        const m = p.map(midiOf);
        return `<div class="fc-inv"><div class="fc-inv-h">${esc(v.name)}</div><div class="fc-inv-sym">${esc(v.symbol)}</div>
          <div class="fc-inv-row"><span>Bass</span><b>${esc(nm(v.bass))}</b></div>
          <div class="fc-inv-row"><span>Figured bass</span><b>${esc(v.figureShort || '— (5/3)')}</b></div>
          ${staffSVG({ notes: p, chord: true, clef: 'treble', width: 150, label: v.name })}
          <button type="button" class="fc-btn fc-btn--small" data-play="${m.join('+')}">▶ Play</button></div>`;
      }).join('');
      body.innerHTML = card('Chord builder', 'Pick a root and a chord. Play it as a block or broken (arpeggio).',
        `<div class="fc-row">${selectHTML('chRoot', ch.root, ROOTS, 'Root')}${selectHTML('chType', ch.type, types, 'Chord')}
          <button type="button" class="fc-btn fc-btn--primary" data-play="${midi.join('+')}">▶ Block</button>
          <button type="button" class="fc-btn" data-play="${midi.join(',')}" data-gap="0.2">▶ Broken</button></div>
         <div class="fc-out">${esc(symbol)} <span class="fc-out-sub">${esc(s.notes.map(nm).join(' · '))}</span></div>
         ${s.note ? `<p class="fc-note">${esc(s.note)}</p>` : ''}
         <p class="fc-sub">${esc(CHORD_INFO[ch.type] || '')}</p>
         <div class="fc-staves">${staffSVG({ notes: placed, chord: true, clef: 'treble', width: 170, label: symbol })}</div>
         ${pianoHTML({ from: 60, octaves: 2, lit: new Set(midi), bass: midi[0], small: true })}`)
        + card('Inversions', 'Same notes, a different one in the bass. Figured bass counts the intervals above the bass: 6 for first inversion, 6/4 for second; 6/5, 4/3 and 4/2 for sevenths.',
          `<div class="fc-inv-grid">${invCards}</div>`);
      body.querySelector('#chRoot').addEventListener('change', (e) => { ch.root = e.target.value; renderChords(); });
      body.querySelector('#chType').addEventListener('change', (e) => { ch.type = e.target.value; renderChords(); });
      wirePianoTaps();
    }

    /* ── Harmony ──────────────────────────────────────────────────────────── */
    function renderHarmony() {
      const hm = st.hm;
      const tonics = hm.mode === 'major' ? T().MAJOR_TONICS : T().MINOR_TONICS;
      if (tonics.indexOf(hm.tonic) === -1) hm.tonic = hm.mode === 'major' ? 'C' : 'A';
      const k = T().keyFor(hm.tonic, hm.mode);
      const nat = T().diatonicTriads(k.tonic, k.mode === 'major' ? 'Major' : 'Natural minor');
      // In minor, cadences and progressions use the harmonic-minor V (and vii°).
      const harm = k.mode === 'minor' ? T().diatonicTriads(k.tonic, 'Harmonic minor') : nat;
      const chordAt = (d) => (d === 4 || d === 6 ? harm[d] : nat[d]);
      const rows = nat.map((c, d) => `<tr><td class="fc-num">${esc(c.numeral)}${k.mode === 'minor' && (d === 4 || d === 6) ? `<small>harmonic: ${esc(harm[d].numeral)}</small>` : ''}</td>
        <td>${esc(c.symbol)}</td><td>${esc(c.notes.map(nm).join(' '))}</td><td>${esc(c.quality.toLowerCase())}</td>
        <td><button type="button" class="fc-btn fc-btn--small" data-play="${voiced(c.notes).join('+')}" aria-label="Play ${esc(c.symbol)}">▶</button></td></tr>`).join('');
      const seq = (degrees) => degrees.map((d) => voiced(chordAt(d).notes).join('+')).join(',');
      const label = (degrees) => degrees.map((d) => chordAt(d).numeral).join(' – ');
      const cads = CADENCES.map(([n, f, degs, desc]) => `<div class="fc-cad"><div class="fc-cad-h">${esc(n)} <span>${esc(f)}</span></div>
        <div class="fc-cad-c">${esc(degs.map((d) => chordAt(d).symbol).join(' → '))}</div><p>${esc(desc)}</p>
        <button type="button" class="fc-btn fc-btn--small" data-play="${seq(degs)}" data-gap="0.8">▶ Play</button></div>`).join('');
      const progs = PROGRESSIONS.map(([n, degs, desc]) => `<div class="fc-cad"><div class="fc-cad-h">${esc(n)}</div>
        <div class="fc-cad-c">${esc(label(degs))}</div><div class="fc-cad-s">${esc(degs.map((d) => chordAt(d).symbol).join(' '))}</div><p>${esc(desc)}</p>
        <button type="button" class="fc-btn fc-btn--small" data-play="${seq(degs)}" data-gap="${degs.length > 8 ? 0.6 : 0.8}">▶ Play</button></div>`).join('');
      body.innerHTML = card('Harmony', 'Roman numerals name each chord by its place in the key: capitals major, small letters minor, ° diminished.',
        `<div class="fc-row">${selectHTML('hmTonic', hm.tonic, tonics, 'Key')}${segHTML('hmMode', hm.mode, [['major', 'Major'], ['minor', 'Minor']])}
          <span class="fc-pill">${esc(k.label)} · ${esc(k.signatureText)}</span></div>
         <div class="fc-table-scroll"><table class="fc-tbl"><thead><tr><th>Numeral</th><th>Chord</th><th>Notes</th><th>Quality</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`)
        + card('Cadences', `The four cadences in ${esc(k.label)}${k.mode === 'minor' ? ', using the major V of harmonic minor' : ''}.`, `<div class="fc-cad-grid">${cads}</div>`)
        + card('Progressions', 'Chord patterns you will hear everywhere, played in this key.', `<div class="fc-cad-grid">${progs}</div>`);
      body.querySelector('#hmTonic').addEventListener('change', (e) => { hm.tonic = e.target.value; renderHarmony(); });
      body.querySelector('#hmMode').addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b || b.dataset.v === hm.mode) return;
        const rel = T().keyFor(hm.tonic, hm.mode).relative;   // keep the key signature: C major ↔ A minor
        hm.mode = b.dataset.v;
        hm.tonic = rel.replace(/ (major|minor)$/, '');
        renderHarmony();
      });
    }

    /* ── Intervals + ear trainer ──────────────────────────────────────────── */
    function intervalNotes(i) {
      const [semis, , letters] = INTERVALS[i];
      const c = T().parse('C');
      const top = T().step(c, letters, semis);
      return placeRising([c, top], 4).map((p, j) => (j === 1 && semis === 12 ? { l: p.l, a: p.a, oct: 5 } : (j === 1 && semis === 0 ? { l: 0, a: 0, oct: 4 } : p)));
    }
    function renderIntervals() {
      const iv = st.iv;
      const rows = INTERVALS.map((x, i) => {
        const ps = intervalNotes(i);
        const m = ps.map(midiOf);
        return `<tr><td><b>${esc(x[1])}</b></td><td>${x[0]}</td><td>C – ${esc(nm(ps[1]))}</td><td class="fc-hide-sm">${esc(x[3])}</td>
          <td class="fc-nowrap"><button type="button" class="fc-btn fc-btn--small" data-play="${m.join(',')}" data-gap="0.5" aria-label="Play ${esc(x[1])} melodic">▶</button>
          <button type="button" class="fc-btn fc-btn--small" data-play="${m.join('+')}" aria-label="Play ${esc(x[1])} together">▶▶</button></td></tr>`;
      }).join('');
      const pool = iv.pool === 'basic' ? [0, 2, 4, 5, 7, 9, 12].map((s) => INTERVALS.findIndex((x) => x[0] === s)) : INTERVALS.map((_, i) => i);
      const q = iv.quiz;
      const quiz = `<div class="fc-row">${segHTML('ivPool', iv.pool, [['basic', 'Starter set'], ['all', 'All intervals']])}
          <button type="button" class="fc-btn fc-btn--primary" id="ivNew">${q ? 'Next interval' : 'Start'}</button>
          ${q ? '<button type="button" class="fc-btn" id="ivAgain">▶ Hear again</button>' : ''}
          <span class="fc-pill">Score ${iv.score} / ${iv.asked}</span></div>
        ${q ? `<div class="fc-quiz">${pool.map((i) => `<button type="button" class="fc-btn fc-quiz-a${q.answered ? (i === q.i ? ' is-right' : (i === q.pick ? ' is-wrong' : '')) : ''}" data-ans="${i}" ${q.answered ? 'disabled' : ''}>${esc(INTERVALS[i][1])}</button>`).join('')}</div>
          ${q.answered ? `<p class="fc-note">${q.pick === q.i ? 'Correct!' : 'Not quite — it was a ' + esc(INTERVALS[q.i][1].toLowerCase()) + '.'} ${esc(INTERVALS[q.i][3])}</p>` : '<p class="fc-sub">Listen, then pick the interval.</p>'}` : '<p class="fc-sub">Flux plays two notes from a random starting pitch; you name the interval.</p>'}`;
      body.innerHTML = card('Ear trainer', '', quiz)
        + card('Intervals', 'The distance between two notes, counted in letter names and semitones. ▶ plays them one after the other, ▶▶ together.',
          `<div class="fc-table-scroll"><table class="fc-tbl"><thead><tr><th>Interval</th><th>Semitones</th><th>From C</th><th class="fc-hide-sm">Sound</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`);
      const playQ = () => { if (st.iv.quiz) playSteps([st.iv.quiz.base, st.iv.quiz.base + INTERVALS[st.iv.quiz.i][0]], 0.6); };
      body.querySelector('#ivPool').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; iv.pool = b.dataset.v; iv.quiz = null; renderIntervals(); });
      body.querySelector('#ivNew').addEventListener('click', () => {
        const i = pool[Math.floor(Math.random() * pool.length)];
        iv.quiz = { i, base: 55 + Math.floor(Math.random() * 12), answered: false };
        renderIntervals();
        playQ();
      });
      const again = body.querySelector('#ivAgain');
      if (again) again.addEventListener('click', playQ);
      body.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
        if (!iv.quiz || iv.quiz.answered) return;
        iv.quiz.pick = +b.dataset.ans;
        iv.quiz.answered = true;
        iv.asked += 1;
        if (iv.quiz.pick === iv.quiz.i) iv.score += 1;
        renderIntervals();
      }));
    }

    /* ── Rhythm + metronome ───────────────────────────────────────────────── */
    function noteGlyph(kind, dotted) {
      const filled = kind !== 'whole' && kind !== 'half';
      const stem = kind !== 'whole';
      const flags = { eighth: 1, sixteenth: 2 }[kind] || 0;
      let s = `<svg class="fc-glyph" viewBox="0 0 44 56" width="44" height="56" aria-hidden="true">`;
      s += `<ellipse cx="16" cy="44" rx="8" ry="5.8" transform="rotate(-20 16 44)" class="${filled ? 'fc-g-fill' : 'fc-g-open'}"/>`;
      if (stem) s += `<line x1="23.4" y1="42" x2="23.4" y2="8" class="fc-g-stem"/>`;
      for (let f = 0; f < flags; f++) s += `<path d="M23.4 ${8 + f * 8} q 10 6 8 18" class="fc-g-flag"/>`;
      if (dotted) s += `<circle cx="33" cy="44" r="2.6" class="fc-g-fill"/>`;
      return s + '</svg>';
    }
    function renderRhythm() {
      const mt = st.mt;
      const values = NOTE_VALUES.map(([uk, us, beats, kind, dot]) => `<div class="fc-val">${noteGlyph(kind, dot)}<div><b>${esc(uk)}</b><span>${esc(us)}</span></div><div class="fc-val-b">${beats} beat${beats === 1 ? '' : 's'}</div></div>`).join('');
      const sigs = TIME_SIGS.map(([sig, kind, desc]) => `<div class="fc-ts"><div class="fc-ts-sig"><span>${esc(sig.split('/')[0])}</span><span>${esc(sig.split('/')[1])}</span></div><div><b>${esc(kind)}</b><p>${esc(desc)}</p></div></div>`).join('');
      body.innerHTML = card('Metronome', 'Set a tempo, or tap it in. The first beat of each bar is accented.',
        `<div class="fc-metro">
           <div class="fc-metro-bpm"><span id="mtBpm">${mt.bpm}</span><small>bpm · <i id="mtWord">${esc(tempoWord(mt.bpm))}</i></small></div>
           <input type="range" id="mtSlider" min="30" max="240" value="${mt.bpm}" aria-label="Tempo in beats per minute">
           <div class="fc-row">
             <button type="button" class="fc-btn fc-btn--primary" id="mtGo">${mt.on ? '■ Stop' : '▶ Start'}</button>
             <button type="button" class="fc-btn" id="mtTap">Tap tempo</button>
             <label class="fc-inline">Beats per bar ${selectHTML('mtBeats', String(mt.beats), ['2', '3', '4', '5', '6', '7'], 'Beats per bar')}</label>
           </div>
           <div class="fc-beats" id="mtBeatsRow">${Array.from({ length: mt.beats }, (_, i) => `<span class="fc-beat${i === 0 ? ' is-1' : ''}"></span>`).join('')}</div>
         </div>`)
        + card('Note values', 'British names first, American second. Beats are counted in crotchets (quarter notes); a dot adds half the note’s value again.', `<div class="fc-vals">${values}</div>`)
        + card('Time signatures', 'The top number counts beats; the bottom says which note gets one. In compound time each beat divides into three.', `<div class="fc-ts-grid">${sigs}</div>`);
      const slider = body.querySelector('#mtSlider');
      const setBpm = (v) => {
        mt.bpm = Math.max(30, Math.min(240, Math.round(v)));
        slider.value = mt.bpm;
        body.querySelector('#mtBpm').textContent = mt.bpm;
        body.querySelector('#mtWord').textContent = tempoWord(mt.bpm);
      };
      slider.addEventListener('input', () => setBpm(+slider.value));
      body.querySelector('#mtGo').addEventListener('click', () => { if (mt.on) stopMetronome(); else startMetronome(); renderRhythm(); });
      body.querySelector('#mtTap').addEventListener('click', () => {
        const now = performance.now();
        mt.taps = mt.taps.filter((t) => now - t < 2500).concat([now]);
        if (mt.taps.length >= 2) {
          const gaps = mt.taps.slice(1).map((t, i) => t - mt.taps[i]);
          setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
        }
      });
      body.querySelector('#mtBeats').addEventListener('change', (e) => { mt.beats = +e.target.value; mt.beat = 0; renderRhythm(); });
    }
    function startMetronome() {
      const mt = st.mt;
      const c = ctx();
      if (!c) return;
      if (c.state !== 'running') c.resume();
      mt.on = true;
      mt.beat = 0;
      mt.next = c.currentTime + 0.08;
      // Look-ahead scheduler: clicks are scheduled on the audio clock, so a busy page cannot make them drift.
      mt.timer = setInterval(() => {
        while (mt.next < c.currentTime + 0.12) {
          const accent = mt.beat % mt.beats === 0;
          click(mt.next - c.currentTime, accent);
          const b = mt.beat % mt.beats;
          const delay = Math.max(0, (mt.next - c.currentTime) * 1000);
          setTimeout(() => {
            const row = document.getElementById('mtBeatsRow');
            if (!row) return;
            row.querySelectorAll('.fc-beat').forEach((el, i) => el.classList.toggle('is-now', i === b));
          }, delay);
          mt.beat += 1;
          mt.next += 60 / mt.bpm;
        }
      }, 25);
    }
    function stopMetronome() {
      const mt = st.mt;
      mt.on = false;
      if (mt.timer) clearInterval(mt.timer);
      mt.timer = null;
    }

    /* ── Beat Maker ───────────────────────────────────────────────────────── */
    /* A 16-step drum machine with a bass line and a melody on the key's
       pentatonic scale, so anything a student clicks in sounds right. Every
       sound is made here with Web Audio — no samples to download. A beat
       travels as a link (#beats/…) and downloads as a WAV. */
    function renderBeats() {
      const bt = st.bt;
      const melody = btMelody();
      const rows = BT_DRUMS.map(([id, label]) => [id, label, 'drum'])
        .concat(melody.map((m, i) => ['k' + i, nm(m.note), 'key']))
        .concat([['bass', 'Bass ' + nm(melody[melody.length - 1].note), 'bass']]);
      const grid = rows.map(([id, label, kind]) => `<div class="fc-bt-row fc-bt-row--${kind}"><span class="fc-bt-name">${esc(label)}</span><div class="fc-bt-steps">${btRow(id).map((on, s) => `<button type="button" class="fc-bt-step" data-r="${id}" data-s="${s}" aria-pressed="${on}" aria-label="${esc(label)}, step ${s + 1}"></button>`).join('')}</div></div>`).join('');
      body.innerHTML = card('Beat Maker', 'Click the squares to build a beat, then press play — or start from a style. The melody and bass use the key’s pentatonic scale, so every note fits. <kbd>Space</kbd> plays and stops.',
        `<div class="fc-row">
           <button type="button" class="fc-btn fc-btn--primary" id="btGo" aria-pressed="${bt.on}">${bt.on ? '■ Stop' : '▶ Play'}</button>
           <label class="fc-inline">Style ${selectHTML('btPreset', bt.preset, ['Choose…'].concat(Object.keys(BT_PRESETS)), 'Start from a style')}</label>
           <label class="fc-inline">Key ${selectHTML('btKey', bt.key, BT_KEYS, 'Key')}</label>
           ${segHTML('btMode', bt.mode, [['major', 'Major'], ['minor', 'Minor']])}
         </div>
         <div class="fc-row fc-bt-sliders">
           <label class="fc-inline">Tempo <input type="range" id="btBpm" min="60" max="180" value="${bt.bpm}" aria-label="Tempo in beats per minute"><b id="btBpmV">${bt.bpm}</b></label>
           <label class="fc-inline">Swing <input type="range" id="btSwing" min="0" max="60" value="${bt.swing}" aria-label="Swing"><b id="btSwingV">${bt.swing}%</b></label>
         </div>
         <div class="fc-bt-grid" id="btGrid">${grid}</div>
         <div class="fc-row fc-bt-actions">
           <button type="button" class="fc-btn" id="btInspire">Inspire me</button>
           <button type="button" class="fc-btn" id="btClear">Clear</button>
           <button type="button" class="fc-btn" id="btShare">Copy link</button>
           <button type="button" class="fc-btn" id="btWav">Download WAV</button>
         </div>`, 'fc-card--beats');
      const q = (s) => body.querySelector(s);
      q('#btGo').addEventListener('click', () => { if (bt.on) stopBeats(); else startBeats(); });
      q('#btGrid').addEventListener('click', (e) => {
        const b = e.target.closest('.fc-bt-step');
        if (!b) return;
        const row = btRow(b.dataset.r), s = +b.dataset.s;
        row[s] = !row[s];
        b.setAttribute('aria-pressed', String(row[s]));
        if (row[s] && !bt.on) withAudio((c) => btSound(c, btOut(c), c.currentTime + 0.02, b.dataset.r));
        writeHash();
      });
      q('#btPreset').addEventListener('change', (e) => { if (BT_PRESETS[e.target.value]) { btLoad(e.target.value); renderBeats(); writeHash(); } });
      q('#btKey').addEventListener('change', (e) => { bt.key = e.target.value; renderBeats(); writeHash(); });
      q('#btMode').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; bt.mode = b.dataset.v; renderBeats(); writeHash(); });
      q('#btBpm').addEventListener('input', (e) => { bt.bpm = +e.target.value; q('#btBpmV').textContent = bt.bpm; });
      q('#btBpm').addEventListener('change', writeHash);
      q('#btSwing').addEventListener('input', (e) => { bt.swing = +e.target.value; q('#btSwingV').textContent = bt.swing + '%'; });
      q('#btSwing').addEventListener('change', writeHash);
      q('#btClear').addEventListener('click', () => { btBlank(); bt.preset = 'Choose…'; renderBeats(); writeHash(); });
      q('#btInspire').addEventListener('click', () => { btInspire(); renderBeats(); writeHash(); });
      q('#btShare').addEventListener('click', () => {
        writeHash();
        const url = location.href.split('#')[0] + '#beats/' + btCode();
        try { navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => window.prompt('Copy this link:', url)); } catch (e) { window.prompt('Copy this link:', url); }
      });
      q('#btWav').addEventListener('click', btDownload);
    }
    function btRow(id) { return st.bt.rows[id] || (st.bt.rows[id] = new Array(16).fill(false)); }
    function btBlank() { BT_IDS.forEach((id) => { st.bt.rows[id] = new Array(16).fill(false); }); }
    function btLoad(name) {
      const p = BT_PRESETS[name];
      btBlank();
      BT_IDS.forEach((id) => { if (p[id]) st.bt.rows[id] = p[id].split('').map((ch) => ch === 'x'); });
      st.bt.bpm = p.bpm; st.bt.swing = p.swing; st.bt.preset = name;
    }
    /** The five pentatonic notes, highest first, with the midi each plays. */
    function btMelody() {
      const bt = st.bt;
      const notes = T().scale(T().parse(bt.key), bt.mode === 'minor' ? 'Minor pentatonic' : 'Major pentatonic');
      const midi = risingMidi(notes, 4);
      return notes.map((note, i) => ({ note, midi: midi[i] })).reverse();
    }
    function btInspire() {
      const bt = st.bt;
      ['k0', 'k1', 'k2', 'k3', 'k4', 'bass'].forEach((id) => { bt.rows[id] = new Array(16).fill(false); });
      let at = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0 ? Math.random() < 0.6 : Math.random() < 0.28) {
          at = Math.max(0, Math.min(4, at + [-1, -1, 0, 1, 1, 2, -2][Math.floor(Math.random() * 7)]));
          bt.rows['k' + at][s] = true;
        }
        if (btRow('kick')[s] || (s % 8 === 0) || (s % 4 === 3 && Math.random() < 0.25)) bt.rows.bass[s] = true;
      }
    }
    function btCode() {
      const bt = st.bt;
      const hex = BT_IDS.map((id) => btRow(id).reduce((n, on, i) => n | (on ? 1 << (15 - i) : 0), 0).toString(16).padStart(4, '0')).join('');
      return [bt.bpm, bt.swing, BT_KEYS.indexOf(bt.key), bt.mode === 'minor' ? 'm' : 'M', hex].join('-');
    }
    function btFromCode(code) {
      const m = /^(\d{2,3})-(\d{1,2})-(\d{1,2})-([mM])-([0-9a-f]{52})$/i.exec(code || '');
      if (!m) return false;
      const bt = st.bt;
      bt.bpm = Math.max(60, Math.min(180, +m[1]));
      bt.swing = Math.min(60, +m[2]);
      bt.key = BT_KEYS[+m[3]] || 'C';
      bt.mode = m[4] === 'm' ? 'minor' : 'major';
      BT_IDS.forEach((id, r) => {
        const n = parseInt(m[5].slice(r * 4, r * 4 + 4), 16);
        bt.rows[id] = Array.from({ length: 16 }, (_, i) => !!(n & (1 << (15 - i))));
      });
      bt.preset = 'Choose…';
      return true;
    }

    /* Sounds: each takes the context, where to send it and when. */
    const noiseBufs = new WeakMap();
    function noise(c) {
      let b = noiseBufs.get(c);
      if (!b) {
        b = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noiseBufs.set(c, b);
      }
      const s = c.createBufferSource();
      s.buffer = b;
      return s;
    }
    const outs = new WeakMap();
    /** A gentle compressor in front of the speakers, so a full beat never clips. */
    function btOut(c) {
      let o = outs.get(c);
      if (!o) {
        o = c.createDynamicsCompressor();
        o.threshold.value = -14; o.ratio.value = 4;
        const g = c.createGain();
        g.gain.value = 0.9;
        o.connect(g); g.connect(c.destination);
        outs.set(c, o);
      }
      return o;
    }
    function env(c, dest, t, peak, decay) {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      g.connect(dest);
      return g;
    }
    function osc(c, type, f, to, t, dur, dest) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.4);
      o.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function noiseHit(c, dest, t, type, f, q, peak, decay) {
      const n = noise(c), fl = c.createBiquadFilter();
      fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      n.connect(fl); fl.connect(env(c, dest, t, peak, decay));
      n.start(t); n.stop(t + decay + 0.05);
    }
    function btSound(c, dest, t, id) {
      if (id === 'kick') osc(c, 'sine', 150, 42, t, 0.42, env(c, dest, t, 1, 0.42));
      else if (id === 'snare') { noiseHit(c, dest, t, 'highpass', 1200, 0.7, 0.55, 0.18); osc(c, 'triangle', 200, 160, t, 0.1, env(c, dest, t, 0.45, 0.1)); }
      else if (id === 'clap') [0, 0.011, 0.022].forEach((d, i) => noiseHit(c, dest, t + d, 'bandpass', 1400, 0.9, 0.6, i === 2 ? 0.16 : 0.03));
      else if (id === 'hat') noiseHit(c, dest, t, 'highpass', 7500, 0.7, 0.28, 0.05);
      else if (id === 'open') noiseHit(c, dest, t, 'highpass', 7000, 0.7, 0.24, 0.32);
      else if (id === 'tom') osc(c, 'sine', 210, 120, t, 0.32, env(c, dest, t, 0.75, 0.32));
      else if (id === 'bell') {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 3;
        bp.connect(env(c, dest, t, 0.4, 0.28));
        osc(c, 'square', 540, 0, t, 0.28, bp); osc(c, 'square', 800, 0, t, 0.28, bp);
      } else if (id === 'bass') {
        const midi = btMelody()[4].midi - 24;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.25); lp.Q.value = 5;
        lp.connect(env(c, dest, t, 0.5, 0.3));
        osc(c, 'sawtooth', freq(midi), 0, t, 0.3, lp); osc(c, 'sine', freq(midi), 0, t, 0.3, lp);
      } else if (id[0] === 'k') {
        const midi = btMelody()[+id[1]].midi;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2800;
        lp.connect(env(c, dest, t, 0.22, 0.4));
        osc(c, 'triangle', freq(midi), 0, t, 0.4, lp); osc(c, 'square', freq(midi), 0, t, 0.12, env(c, lp, t, 0.25, 0.12));
      }
    }
    /** When step s starts, counted from the start of the bar; odd 16ths are swung late. */
    function btStepTime(s) {
      const d = 60 / st.bt.bpm / 4;
      return s * d + (s % 2 ? (st.bt.swing / 100) * d * 0.66 : 0);
    }
    function btPlayStep(c, dest, t, s) {
      BT_IDS.forEach((id) => { if (btRow(id)[s]) btSound(c, dest, t, id); });
    }
    function startBeats() {
      const bt = st.bt;
      withAudio((c) => {
        if (bt.on) return;
        bt.on = true;
        bt.step = 0;
        bt.bar = c.currentTime + 0.08;
        const out = btOut(c);
        // The metronome's look-ahead scheduler: sounds are booked on the audio clock.
        bt.timer = setInterval(() => {
          let t;
          while ((t = bt.bar + btStepTime(bt.step)) < c.currentTime + 0.12) {
            const s = bt.step;
            btPlayStep(c, out, t, s);
            setTimeout(() => {
              const g = document.getElementById('btGrid');
              if (!g || !bt.on) return;
              g.querySelectorAll('.is-now').forEach((el) => el.classList.remove('is-now'));
              g.querySelectorAll(`[data-s="${s}"]`).forEach((el) => el.classList.add('is-now'));
            }, Math.max(0, (t - c.currentTime) * 1000));
            bt.step += 1;
            if (bt.step === 16) { bt.step = 0; bt.bar += 60 / bt.bpm * 4; }
          }
        }, 25);
        btButton();
      });
    }
    function stopBeats() {
      const bt = st.bt;
      bt.on = false;
      if (bt.timer) clearInterval(bt.timer);
      bt.timer = null;
      document.querySelectorAll('#btGrid .is-now').forEach((el) => el.classList.remove('is-now'));
      btButton();
    }
    function btButton() {
      const b = document.getElementById('btGo');
      if (!b) return;
      b.textContent = st.bt.on ? '■ Stop' : '▶ Play';
      b.setAttribute('aria-pressed', String(st.bt.on));
    }
    /** Four bars, rendered offline as fast as the computer can, as a 16-bit WAV. */
    function btDownload() {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) { toast('This browser cannot make a WAV.'); return; }
      const rate = 44100, bar = 60 / st.bt.bpm * 4, bars = 4;
      const c = new OAC(1, Math.ceil(rate * (bar * bars + 0.6)), rate);
      const out = btOut(c);
      for (let b = 0; b < bars; b++) for (let s = 0; s < 16; s++) btPlayStep(c, out, 0.02 + b * bar + btStepTime(s), s);
      c.startRendering().then((buf) => {
        const d = buf.getChannelData(0), n = d.length;
        const wav = new DataView(new ArrayBuffer(44 + n * 2));
        const str = (o, t) => { for (let i = 0; i < t.length; i++) wav.setUint8(o + i, t.charCodeAt(i)); };
        str(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); wav.setUint32(16, 16, true);
        wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true);
        wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        a.download = 'flux-beat-' + st.bt.bpm + 'bpm.wav';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, () => toast('Could not make the WAV.'));
    }

    /* ── Orchestra ────────────────────────────────────────────────────────── */
    function renderOrchestra() {
      const tr = st.tr;
      const LOW = 21, HIGH = 108;
      const span = HIGH - LOW;
      const ranges = RANGES.map(([fam, list]) => `<div class="fc-rng-fam">${esc(fam)}</div>${list.map(([n, lo, hi]) => {
        const l = ((lo - LOW) / span) * 100, w = ((hi - lo) / span) * 100;
        const loN = spellMidi(lo, true), hiN = spellMidi(hi, true);
        return `<div class="fc-rng-row"><span class="fc-rng-n">${esc(n)}</span><span class="fc-rng-track"><span class="fc-rng-bar" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%" title="${esc(nm(loN) + loN.oct + ' – ' + nm(hiN) + hiN.oct)}"></span><span class="fc-rng-c4" style="left:${(((60 - LOW) / span) * 100).toFixed(2)}%"></span></span><span class="fc-rng-t">${esc(nm(loN) + loN.oct + '–' + nm(hiN) + hiN.oct)}</span></div>`;
      }).join('')}`).join('');
      const row = TRANSPOSE[tr.i];
      const shift = tr.dir === 'sounding' ? row[1] : -row[1];
      const base = T().parse(tr.note);
      const outMidi = 60 + NATURAL[base.l] + base.a + shift;
      const out = spellMidi(outMidi, /♭/.test(tr.note) || [-2, -9, -14, -7].includes(row[1]));
        body.innerHTML = card('Transposition', 'Reading your part, or writing one for a player: pick the instrument and the direction.',
        `<div class="fc-row">${`<select id="trI" class="fc-select" aria-label="Instrument">${TRANSPOSE.map((r, i) => `<option value="${i}"${i === tr.i ? ' selected' : ''}>${esc(r[0])}</option>`).join('')}</select>`}
          ${selectHTML('trN', tr.note, ROOTS, 'Note')}${segHTML('trDir', tr.dir, [['sounding', 'Written → sounds'], ['written', 'Concert → write']])}</div>
         <div class="fc-out">${tr.dir === 'sounding' ? 'Written' : 'Concert'} ${esc(tr.note)} ${tr.dir === 'sounding' ? 'sounds as' : 'is written as'} ${esc(nm(out))}</div>
         <p class="fc-sub">${esc(row[2])}${tr.dir === 'written' && row[1] ? ' — so the part is written the same distance the other way' : ''}.</p>`)
        + card('Ranges', 'Approximate sounding range of each instrument and voice, on the piano’s 88 keys. The thin mark is middle C.', `<div class="fc-rng">${ranges}</div>`)
        + card('Score order', 'Top to bottom in every full score.', `<ol class="fc-list">${SCORE_ORDER.map(([a, b]) => `<li><b>${esc(a)}</b> — ${esc(b)}</li>`).join('')}</ol>`)
        + card('Clefs', 'Which instruments read which clef.', `<ul class="fc-list">${CLEFS.map(([a, b]) => `<li><b>${esc(a)}</b> — ${esc(b)}</li>`).join('')}</ul>`);
      body.querySelector('#trI').addEventListener('change', (e) => { tr.i = +e.target.value; renderOrchestra(); });
      body.querySelector('#trN').addEventListener('change', (e) => { tr.note = e.target.value; renderOrchestra(); });
      body.querySelector('#trDir').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; tr.dir = b.dataset.v; renderOrchestra(); });
    }

    /* ── Terms ────────────────────────────────────────────────────────────── */
    function renderTerms() {
      const t = st.terms;
      const groups = ['All'].concat(Array.from(new Set(TERMS.map((x) => x[2]))));
      body.innerHTML = card('Terms', 'Every word you will meet on a score or in an exam answer.',
        `<div class="fc-row"><input type="search" id="tmQ" class="fc-input" placeholder="Search — e.g. staccato, rondo, ostinato" value="${esc(t.q)}" aria-label="Search terms">
          ${selectHTML('tmG', t.group, groups, 'Group')}</div><div class="fc-terms" id="tmList"></div>`);
      const list = body.querySelector('#tmList');
      const draw = () => {
        const q = t.q.trim().toLowerCase();
        const hits = TERMS.filter((x) => (t.group === 'All' || x[2] === t.group) && (!q || (x[0] + ' ' + x[1]).toLowerCase().includes(q)));
        list.innerHTML = hits.length
          ? hits.map(([term, def, g]) => `<div class="fc-term"><div class="fc-term-t">${esc(term)}</div><div class="fc-term-d">${esc(def)}</div><span class="fc-term-g">${esc(g)}</span></div>`).join('')
          : '<p class="fc-sub">No terms match.</p>';
      };
      draw();
      body.querySelector('#tmQ').addEventListener('input', (e) => { t.q = e.target.value; draw(); });
      body.querySelector('#tmG').addEventListener('change', (e) => { t.group = e.target.value; draw(); });
    }

    /* ── DP Music ─────────────────────────────────────────────────────────── */
    /* Listening sheets: one per piece, each tagged with its area of inquiry and
       context, because the "Exploring music in context" portfolio asks for
       diverse music across all four areas and personal, local and global
       contexts. There used to be a single sheet (SHEET_KEY); it becomes the
       first piece and the old key is left as it was. */
    const SHEET_KEY = 'flux_composer_listening';
    const SHEETS_KEY = 'flux_composer_listening_v2';
    let sheetSeq = 0;
    const blankSheet = () => ({ id: 'p' + Date.now().toString(36) + (sheetSeq++), piece: '', area: '', context: '', notes: {} });
    function cleanSheet(s) {
      const notes = {};
      if (s.notes && typeof s.notes === 'object') DIMS.forEach(([d]) => { if (typeof s.notes[d] === 'string' && s.notes[d]) notes[d] = s.notes[d].slice(0, 4000); });
      return {
        id: typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : blankSheet().id,
        piece: typeof s.piece === 'string' ? s.piece.slice(0, 300) : '',
        area: AREAS.some((a) => a[0] === s.area) ? s.area : '',
        context: CONTEXTS.some((c) => c[0] === s.context) ? s.context : '',
        notes,
      };
    }
    function loadSheets() {
      let v = null;
      try { v = JSON.parse(localStorage.getItem(SHEETS_KEY) || 'null'); } catch (e) { v = null; }
      if (!v || typeof v !== 'object' || !Array.isArray(v.sheets)) {
        let old = {};
        try { old = JSON.parse(localStorage.getItem(SHEET_KEY) || '{}') || {}; } catch (e) { old = {}; }
        const first = blankSheet();
        if (typeof old.Piece === 'string') first.piece = old.Piece;
        DIMS.forEach(([d]) => { if (typeof old[d] === 'string' && old[d]) first.notes[d] = old[d]; });
        v = { sheets: [first], current: first.id };
      }
      v.sheets = v.sheets.filter((s) => s && typeof s === 'object').map(cleanSheet);
      if (!v.sheets.length) v.sheets = [blankSheet()];
      if (!v.sheets.some((s) => s.id === v.current)) v.current = v.sheets[0].id;
      return v;
    }
    let sheetSaveWarned = false;
    function saveSheets(v) {
      try { localStorage.setItem(SHEETS_KEY, JSON.stringify(v)); sheetSaveWarned = false; } catch (e) {
        if (!sheetSaveWarned) { sheetSaveWarned = true; toast('Could not save here — storage may be full or blocked.'); }
      }
    }
    function renderDP() {
      const sel = st.dp.sel;
      const cx = 235, cy = 235;
      const pol = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      const pill = (label, deg, r, kind, i) => {
        const [x, y] = pol(r, deg);
        const active = sel.kind === kind && sel.i === i;
        const words = label.split(' ');
        const lines = label.length > 13 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [label];
        const w = Math.max(54, Math.min(130, Math.max.apply(null, lines.map((l) => l.length)) * 7));
        const h = lines.length > 1 ? 32 : 24;
        return `<g class="fc-dim fc-dim--${kind}${active ? ' is-on' : ''}" data-kind="${kind}" data-i="${i}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(label)}">
          <rect x="${(-w / 2).toFixed(1)}" y="${-h / 2}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}"/>
          ${lines.map((l, li) => `<text text-anchor="middle" dominant-baseline="central" y="${lines.length > 1 ? li * 13 - 6.5 : 0}">${esc(l)}</text>`).join('')}</g>`;
      };
      const info = sel.kind === 'core' ? ['Pitch & rhythm', 'The two fundamental dimensions — every musical idea is organised pitch in organised time.'] : (sel.kind === 'meta' ? METADIMS[sel.i] : DIMS[sel.i]);
      const book = loadSheets();
      const cur = book.sheets.find((x) => x.id === book.current);
      const pieceName = (x, i) => x.piece.trim() || 'Untitled piece ' + (i + 1);
      const opt = (v, l, on) => `<option value="${esc(v)}"${v === on ? ' selected' : ''}>${esc(l)}</option>`;
      const coverage = () => `<table class="fc-cov"><thead><tr><th scope="col">Area</th>${CONTEXTS.map((c) => `<th scope="col">${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${AREAS.map((a) => `<tr><th scope="row" title="${esc(a[1])}">Area ${esc(a[0])}</th>${CONTEXTS.map((c) => {
        const n = book.sheets.filter((x) => x.area === a[0] && x.context === c[0]).length;
        return n ? `<td class="is-on">${n}<span class="fc-sr"> ${n === 1 ? 'piece' : 'pieces'}</span></td>` : '<td><span aria-hidden="true">—</span><span class="fc-sr">none yet</span></td>';
      }).join('')}</tr>`).join('')}</tbody></table>`;
      const ring = `<div class="fc-dp-ring"><svg viewBox="0 0 470 470" class="fc-ring" role="group" aria-label="Dimensions and metadimensions">
          <circle cx="${cx}" cy="${cy}" r="228" class="fc-ring-meta"/><circle cx="${cx}" cy="${cy}" r="168" class="fc-ring-dim"/><circle cx="${cx}" cy="${cy}" r="72" class="fc-ring-core"/>
          <text x="${cx}" y="24" text-anchor="middle" class="fc-ring-cap">METADIMENSIONS</text>
          <text x="${cx}" y="84" text-anchor="middle" class="fc-ring-cap">DIMENSIONS</text>
          ${METADIMS.map((m, i) => pill(m[0], i * 40, 198, 'meta', i)).join('')}
          ${DIMS.map((d, i) => pill(d[0], i * 40 + 20, 122, 'dim', i)).join('')}
          <g class="fc-dim fc-dim--core${sel.kind === 'core' ? ' is-on' : ''}" data-kind="core" data-i="0" tabindex="0" role="button" aria-label="Pitch and rhythm"><circle cx="${cx}" cy="${cy}" r="60"/><text x="${cx}" y="${cy - 9}" text-anchor="middle">Pitch</text><text x="${cx}" y="${cy + 13}" text-anchor="middle">Rhythm</text></g>
        </svg><div class="fc-dp-info"><h3 class="fc-h3">${esc(info[0])}</h3><p>${esc(info[1])}</p></div></div>`;
      const grid = (rows, cls) => `<div class="fc-dp-grid${cls ? ' ' + cls : ''}">${rows.map((r) => `<div class="fc-dp-cell">${r.length === 3 ? `<span class="fc-dp-n">${esc(r[0])}</span><b>${esc(r[1])}</b><p>${esc(r[2])}</p>` : `<b>${esc(r[0])}</b><p>${esc(r[1])}</p>`}</div>`).join('')}</div>`;
      const fields = DIMS.map(([d]) => `<label class="fc-ls-row"><span>${esc(d)}</span><textarea class="fc-input" data-ls-dim="${esc(d)}" rows="2" placeholder="What do you hear?">${esc(cur.notes[d] || '')}</textarea></label>`).join('');
      body.innerHTML = card('Dimensions &amp; metadimensions', 'The listening framework: dimensions describe the sound itself, metadimensions its context and meaning. Tap one.', ring)
        + card('Areas of inquiry', 'IB DP Music (first assessed 2022) studies music through four areas of inquiry.', grid(AREAS))
        + card('Contexts &amp; roles', 'Each area is explored in personal, local and global contexts, working as a researcher, creator and performer.', grid(CONTEXTS) + grid(ROLES))
        + card('Assessment components', 'Check your school’s current subject guide for weightings and word limits.', grid(COMPONENTS.map((c) => [c[1], c[0], c[2]]), 'fc-dp-grid--wide'))
        + card('Listening sheets', 'Notes on each piece, one dimension at a time, tagged with its area of inquiry and context. Saved on this device; Copy puts the open sheet on your clipboard for an essay or portfolio.',
          `<div class="fc-row fc-ls-pick"><label class="fc-ls-row"><span>Your pieces</span><select class="fc-select" id="lsPick">${book.sheets.map((x, i) => opt(x.id, pieceName(x, i), book.current)).join('')}</select></label><button type="button" class="fc-btn" id="lsNew">New piece</button></div>
           <label class="fc-ls-row"><span>Piece</span><input class="fc-input" data-ls="piece" placeholder="Title, composer / artist, year" value="${esc(cur.piece)}"></label>
           <label class="fc-ls-row"><span>Area of inquiry</span><select class="fc-select" data-ls="area">${opt('', 'Choose…', cur.area)}${AREAS.map((a) => opt(a[0], 'Area ' + a[0] + ' · ' + a[1], cur.area)).join('')}</select></label>
           <label class="fc-ls-row"><span>Context</span><select class="fc-select" data-ls="context">${opt('', 'Choose…', cur.context)}${CONTEXTS.map((c) => opt(c[0], c[0], cur.context)).join('')}</select></label>${fields}
           <div class="fc-row"><button type="button" class="fc-btn fc-btn--primary" id="lsCopy">Copy</button><button type="button" class="fc-btn" id="lsClear">Delete this piece</button></div>`)
        + card('Portfolio coverage', 'Pieces you have notes on, by area of inquiry and context. The portfolio asks for diverse music, so the empty cells show where to look next.', `<div id="lsCov">${coverage()}</div>`);
      const pick = (g) => { st.dp.sel = { kind: g.dataset.kind, i: +g.dataset.i }; renderDP(); };
      body.querySelectorAll('.fc-dim').forEach((g) => {
        g.addEventListener('click', () => pick(g));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g); } });
      });
      const save = () => saveSheets(book);
      body.querySelectorAll('[data-ls]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        cur[el.dataset.ls] = el.value;
        save();
        if (el.dataset.ls === 'piece') {
          const o = body.querySelector(`#lsPick option[value="${CSS.escape(cur.id)}"]`);
          if (o) o.textContent = pieceName(cur, book.sheets.indexOf(cur));
        } else body.querySelector('#lsCov').innerHTML = coverage();
      }));
      body.querySelectorAll('[data-ls-dim]').forEach((el) => el.addEventListener('input', () => {
        if (el.value) cur.notes[el.dataset.lsDim] = el.value; else delete cur.notes[el.dataset.lsDim];
        save();
      }));
      body.querySelector('#lsPick').addEventListener('change', (e) => {
        book.current = e.target.value;
        save();
        renderDP();
        body.querySelector('#lsPick')?.focus();
      });
      body.querySelector('#lsNew').addEventListener('click', () => {
        const fresh = blankSheet();
        book.sheets.push(fresh);
        book.current = fresh.id;
        save();
        renderDP();
        body.querySelector('[data-ls="piece"]')?.focus();
      });
      body.querySelector('#lsCopy').addEventListener('click', () => {
        const area = AREAS.find((a) => a[0] === cur.area);
        const lines = [['Piece', cur.piece], ['Area of inquiry', area ? 'Area ' + area[0] + ': ' + area[1] : ''], ['Context', cur.context]]
          .concat(DIMS.map(([d]) => [d, cur.notes[d] || '']))
          .filter(([, v]) => v.trim()).map(([k, v]) => k + ': ' + v.trim());
        const text = lines.join('\n');
        if (!text) { toast('Nothing to copy yet.'); return; }
        try { navigator.clipboard.writeText(text).then(() => toast('Copied'), () => window.prompt('Copy this:', text)); } catch (e) { window.prompt('Copy this:', text); }
      });
      body.querySelector('#lsClear').addEventListener('click', () => {
        if (!window.confirm('Delete the notes on “' + pieceName(cur, book.sheets.indexOf(cur)) + '”?')) return;
        book.sheets = book.sheets.filter((x) => x.id !== cur.id);
        if (!book.sheets.length) book.sheets.push(blankSheet());
        book.current = book.sheets[0].id;
        save();
        renderDP();
      });
    }

    function toast(text) {
      const t = document.createElement('div');
      t.className = 'fc-toast';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2000);
    }

    render();
    return {
      readHash() { readHash(); render(); },
      setTab(tab) { if (VALID.has(tab)) { stopMetronome(); stopBeats(); st.tab = tab; render(); } },
      get tab() { return st.tab; },
    };
  }

  window.FluxComposer = { mount, staffSVG, placeRising, midiOf, spellMidi, tempoWord };
})();
