/* ============================================================================
   FLUX MUSIC THEORY  ·  flux-music-theory.js
   Notes spelled the way musicians write them, and the theory built on that:
   keys and signatures, enharmonic keys, diatonic chords with Roman numerals in
   major and minor, and chord inversions with figured bass.

   Why spelling is the whole job
   -----------------------------
   The music tools used to name notes from a fixed table of twelve sharps, so
   B♭ major came out "A♯ C D D♯ F G A" and G♭ major's chords came out in
   sharps. A scale has one note on each letter A–G; its third is always two
   letters up, whatever accidental that needs. So a note here is a letter plus
   an accidental, and every step moves a number of letters AND a number of
   semitones — the accidental is whatever makes the two agree.

   That same rule is what flags a theoretical key: A♯ major needs C𝄪 and E♯ to
   keep one note per letter, which is why nobody writes it. keyFor() notices
   the double accidental and hands back B♭ major instead, saying why.

   Pure functions, no DOM. Plain script on window.FluxMusicTheory, so it runs
   in the planner bundle and under Node for test/unit/music-theory.test.mjs.
   ========================================================================== */
(function () {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL = [0, 2, 4, 5, 7, 9, 11];
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const mod = (n, m) => ((n % m) + m) % m;

  /** A note is { l: letter index 0–6 (C…B), a: accidental in semitones }. */
  const note = (l, a) => ({ l: mod(l, 7), a: a || 0 });
  const pc = (n) => mod(NATURAL[n.l] + n.a, 12);
  function name(n) {
    const a = ACC[String(n.a)];
    return LETTERS[n.l] + (a !== undefined ? a : (n.a > 0 ? '♯'.repeat(n.a) : '♭'.repeat(-n.a)));
  }

  /** "Bb", "B♭", "F#", "F♯", "Cx", "Ebb", "e" → note, or null. */
  function parse(s) {
    const m = /^\s*([A-Ga-g])\s*(𝄪|𝄫|x|##|bb|♯♯|♭♭|#|♯|b|♭)?\s*$/.exec(String(s || ''));
    if (!m) return null;
    const acc = { '': 0, '#': 1, '♯': 1, 'b': -1, '♭': -1, 'x': 2, '𝄪': 2, '##': 2, '♯♯': 2, 'bb': -2, '♭♭': -2, '𝄫': -2 }[m[2] || ''];
    return note(LETTERS.indexOf(m[1].toUpperCase()), acc);
  }

  /** Up `letters` letter names and `semis` semitones from n, spelled accordingly. */
  function step(n, letters, semis) {
    const l = mod(n.l + letters, 7);
    let a = mod(pc(n) + semis - NATURAL[l], 12);
    if (a > 6) a -= 12;
    return note(l, a);
  }

  /* Scales and chords as [letters up, semitones up] from the root. Pentatonic
     and blues skip letters, so they are spelled from the degrees they keep. */
  const SCALES = {
    'Major': [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 9], [6, 11]],
    'Natural minor': [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 8], [6, 10]],
    'Harmonic minor': [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 8], [6, 11]],
    'Melodic minor': [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 9], [6, 11]],
    'Dorian': [[0, 0], [1, 2], [2, 3], [3, 5], [4, 7], [5, 9], [6, 10]],
    'Mixolydian': [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 9], [6, 10]],
    'Major pentatonic': [[0, 0], [1, 2], [2, 4], [4, 7], [5, 9]],
    'Minor pentatonic': [[0, 0], [2, 3], [3, 5], [4, 7], [6, 10]],
    'Blues': [[0, 0], [2, 3], [3, 5], [4, 6], [4, 7], [6, 10]],
  };
  /* sym is how the chord is written after its root; triads have three notes,
     sevenths four — which decides the figured bass of each inversion. */
  const CHORDS = {
    'Major': { steps: [[0, 0], [2, 4], [4, 7]], sym: '' },
    'Minor': { steps: [[0, 0], [2, 3], [4, 7]], sym: 'm' },
    'Diminished': { steps: [[0, 0], [2, 3], [4, 6]], sym: '°' },
    'Augmented': { steps: [[0, 0], [2, 4], [4, 8]], sym: '+' },
    'Major 7': { steps: [[0, 0], [2, 4], [4, 7], [6, 11]], sym: 'maj7' },
    'Minor 7': { steps: [[0, 0], [2, 3], [4, 7], [6, 10]], sym: 'm7' },
    'Dominant 7': { steps: [[0, 0], [2, 4], [4, 7], [6, 10]], sym: '7' },
    'Half-diminished 7': { steps: [[0, 0], [2, 3], [4, 6], [6, 10]], sym: 'ø7' },
    'Diminished 7': { steps: [[0, 0], [2, 3], [4, 6], [6, 9]], sym: '°7' },
    'sus2': { steps: [[0, 0], [1, 2], [4, 7]], sym: 'sus2' },
    'sus4': { steps: [[0, 0], [3, 5], [4, 7]], sym: 'sus4' },
  };

  const build = (root, steps) => steps.map(([l, s]) => step(root, l, s));
  const scale = (root, type) => build(root, SCALES[type] || SCALES.Major);
  const chord = (root, type) => build(root, (CHORDS[type] || CHORDS.Major).steps);

  const hasDouble = (notes) => notes.some((n) => Math.abs(n.a) >= 2);
  function signature(notes) {
    let sharps = 0, flats = 0;
    notes.forEach((n) => { if (n.a > 0) sharps += n.a; else if (n.a < 0) flats -= n.a; });
    return { sharps, flats };
  }
  function signatureText(sig) {
    if (sig.sharps) return sig.sharps + '♯';
    if (sig.flats) return sig.flats + '♭';
    return 'no sharps or flats';
  }

  /* The accidentals of a signature, in the order they are written on the staff. */
  const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  function signatureNotes(sig) {
    if (sig.sharps) return SHARP_ORDER.slice(0, sig.sharps).map((l) => l + '♯');
    if (sig.flats) return FLAT_ORDER.slice(0, sig.flats).map((l) => l + '♭');
    return [];
  }

  /** The other spelling of the same pitch with at most one accidental: F♯↔G♭, B↔C♭, E♯↔F. */
  function respell(n) {
    for (const dl of [1, -1]) {
      const l = mod(n.l + dl, 7);
      const a = mod(pc(n) - NATURAL[l] + 6, 12) - 6;
      if (Math.abs(a) <= 1) return note(l, a);
    }
    return null;
  }

  /** "C𝄪, F𝄪 and G𝄪" */
  const andList = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

  const isMinor = (mode) => mode === 'minor' || /minor/i.test(String(mode || ''));

  /**
   * A key as it is actually written. mode: 'major' | 'minor'.
   * If the requested spelling needs double sharps or flats (A♯ major, D♭ minor)
   * the enharmonic key is returned instead, with `respelledFrom` and `why`.
   */
  function keyFor(tonic, mode) {
    const t = typeof tonic === 'string' ? parse(tonic) : tonic;
    if (!t) return null;
    const minor = isMinor(mode);
    const type = minor ? 'Natural minor' : 'Major';
    const notes = scale(t, type);
    if (hasDouble(notes)) {
      const alt = respell(t);
      if (alt && !hasDouble(scale(alt, type))) {
        const k = keyFor(alt, mode);
        const doubles = notes.filter((n) => Math.abs(n.a) >= 2).map(name);
        k.respelledFrom = name(t) + (minor ? ' minor' : ' major');
        k.why = `${k.respelledFrom} would need ${andList(doubles)}, so it is written as ${k.label}.`;
        return k;
      }
    }
    const sig = signature(notes);
    const k = {
      tonic: t, mode: minor ? 'minor' : 'major', label: name(t) + (minor ? ' minor' : ' major'),
      scale: notes, signature: sig, signatureText: signatureText(sig), signatureNotes: signatureNotes(sig),
    };
    // Relative key: same signature, a minor third apart.
    k.relative = minor ? name(step(t, 2, 3)) + ' major' : name(step(t, 5, 9)) + ' minor';
    // Enharmonic key: same sounds, other spelling — named only when it is a real key too.
    const alt = respell(t);
    if (alt) {
      const altNotes = scale(alt, type);
      if (!hasDouble(altNotes)) {
        k.enharmonic = { label: name(alt) + (minor ? ' minor' : ' major'), signatureText: signatureText(signature(altNotes)) };
      }
    }
    return k;
  }

  /* ── Roman numerals ────────────────────────────────────────────────────── */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function triadQuality(notes) {
    const third = mod(pc(notes[1]) - pc(notes[0]), 12), fifth = mod(pc(notes[2]) - pc(notes[0]), 12);
    if (third === 4 && fifth === 7) return 'Major';
    if (third === 3 && fifth === 7) return 'Minor';
    if (third === 3 && fifth === 6) return 'Diminished';
    if (third === 4 && fifth === 8) return 'Augmented';
    return 'Other';
  }
  function numeral(degree, quality) {
    const r = ROMAN[degree];
    if (quality === 'Minor') return r.toLowerCase();
    if (quality === 'Diminished') return r.toLowerCase() + '°';
    if (quality === 'Augmented') return r + '+';
    return r;
  }
  /**
   * The seven triads built on a key's scale, stacked in thirds from its own
   * notes. scaleType: 'Major' | 'Natural minor' | 'Harmonic minor'. Harmonic
   * minor raises the 7th, which is what turns v into V and VII into vii°.
   */
  function diatonicTriads(tonic, scaleType) {
    const t = typeof tonic === 'string' ? parse(tonic) : tonic;
    const s = scale(t, scaleType || 'Major');
    return s.map((root, d) => {
      const notes = [s[d], s[(d + 2) % 7], s[(d + 4) % 7]];
      const quality = triadQuality(notes);
      return {
        degree: d, numeral: numeral(d, quality), quality, root, notes,
        symbol: name(root) + (CHORDS[quality] ? CHORDS[quality].sym : ''),
      };
    });
  }
  /**
   * A major key and its relative minor share every note, so they share every
   * chord — but the chords are numbered from a different home note. C major
   * is I in C major and III in A minor; A minor is vi in C and i in A minor.
   */
  function relativeNumerals(majorTonic) {
    const t = typeof majorTonic === 'string' ? parse(majorTonic) : majorTonic;
    const maj = diatonicTriads(t, 'Major');
    const min = diatonicTriads(step(t, 5, 9), 'Natural minor');
    return maj.map((c) => {
      const m = min.find((x) => x.root.l === c.root.l && x.root.a === c.root.a);
      return { symbol: c.symbol, inMajor: c.numeral, inMinor: m ? m.numeral : '' };
    });
  }

  /* ── Inversions ────────────────────────────────────────────────────────── */
  const TRIAD_FIGURES = ['5/3', '6/3', '6/4'];
  const SEVENTH_FIGURES = ['7', '6/5', '4/3', '4/2'];
  const INVERSION_NAMES = ['Root position', 'First inversion', 'Second inversion', 'Third inversion'];
  /**
   * Every inversion of a chord: which note is in the bass, the notes from the
   * bottom up, the slash-chord symbol (C/E) and the figured bass that names it
   * (6 for a first-inversion triad, 6/4 for second; 6/5, 4/3, 4/2 for sevenths).
   */
  function inversions(root, type) {
    const r = typeof root === 'string' ? parse(root) : root;
    const def = CHORDS[type] || CHORDS.Major;
    const notes = chord(r, type);
    const sym = name(r) + def.sym;
    const figures = notes.length === 4 ? SEVENTH_FIGURES : TRIAD_FIGURES;
    return notes.map((_, i) => {
      const order = notes.slice(i).concat(notes.slice(0, i));
      return {
        inversion: i,
        name: INVERSION_NAMES[i],
        bass: order[0],
        notes: order,
        symbol: i === 0 ? sym : sym + '/' + name(order[0]),
        figure: figures[i],
        // What students actually write: nothing in root position, a lone 6 for a first-inversion triad.
        figureShort: notes.length === 4 ? figures[i] : ['', '6', '6/4'][i],
      };
    });
  }

  /* Tonics around the circle of fifths, clockwise from C. The bottom three are
     enharmonic pairs: the same keys can be written either way. */
  const CIRCLE = [
    { major: 'C', minor: 'A' }, { major: 'G', minor: 'E' }, { major: 'D', minor: 'B' },
    { major: 'A', minor: 'F♯' }, { major: 'E', minor: 'C♯' },
    { major: 'B', minor: 'G♯', majorAlt: 'C♭', minorAlt: 'A♭' },
    { major: 'F♯', minor: 'D♯', majorAlt: 'G♭', minorAlt: 'E♭' },
    { major: 'D♭', minor: 'B♭', majorAlt: 'C♯', minorAlt: 'A♯' },
    { major: 'A♭', minor: 'F' }, { major: 'E♭', minor: 'C' }, { major: 'B♭', minor: 'G' }, { major: 'F', minor: 'D' },
  ];

  /* Tonic choices for a picker: every key a musician actually writes, each once. */
  const MAJOR_TONICS = ['C', 'C♯', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C♭'];
  const MINOR_TONICS = ['C', 'C♯', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];

  window.FluxMusicTheory = {
    LETTERS, SCALES, CHORDS, CIRCLE, MAJOR_TONICS, MINOR_TONICS,
    note, parse, name, pc, step, scale, chord, signature, signatureText, signatureNotes,
    respell, keyFor, diatonicTriads, relativeNumerals, inversions, hasDouble, andList,
  };
})();
