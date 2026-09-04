/* ============================================================================
   FLUX STUDY HUB · Orchestra (symphonic ensemble playing)

   Adds tabs to the existing `music` subject; H.register concatenates, so
   flux-study-music.js is untouched.

   That module is theory — circle of fifths, scales, chords, intervals — which
   is what you need to understand a piece. This is what you need to *sit in the
   section and play it*: where your part sits on the page, what your written
   note actually sounds like, and what the Italian above the stave is asking
   for. None of it existed anywhere in the app.

   The transposition table is why this file has a calculator and not just a
   list. "Sounds a perfect 5th lower" is easy to read and just as easy to apply
   backwards, and a horn player transposing the wrong way is a rehearsal
   stopped. Pick a direction, get the note.

   No storage.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${esc(sub)}</p>` : '')
      + inner + '</div>';
    const termList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    // ── Transposing instruments ──────────────────────────────────────────────
    /* offset = semitones from WRITTEN to SOUNDING. Negative sounds lower.
       Bass clarinet is given in the treble-clef convention (major 9th down),
       which is what orchestral parts overwhelmingly use. */
    const INSTR = [
      ['Piccolo', 12, 'Sounds an octave higher than written'],
      ['Flute', 0, 'Concert pitch'],
      ['Oboe', 0, 'Concert pitch'],
      ['Cor anglais (in F)', -7, 'Sounds a perfect 5th lower'],
      ['Clarinet in B♭', -2, 'Sounds a major 2nd lower'],
      ['Clarinet in A', -3, 'Sounds a minor 3rd lower'],
      ['Bass clarinet in B♭', -14, 'Sounds a major 9th lower (treble-clef notation)'],
      ['Bassoon', 0, 'Concert pitch — bass and tenor clef'],
      ['Contrabassoon', -12, 'Sounds an octave lower'],
      ['Horn in F', -7, 'Sounds a perfect 5th lower'],
      ['Trumpet in B♭', -2, 'Sounds a major 2nd lower'],
      ['Trombone', 0, 'Concert pitch — bass and tenor clef'],
      ['Tuba', 0, 'Concert pitch'],
      ['Violin / Viola / Cello', 0, 'Concert pitch'],
      ['Double bass', -12, 'Sounds an octave lower than written'],
      ['Glockenspiel', 24, 'Sounds two octaves higher'],
      ['Xylophone', 12, 'Sounds an octave higher'],
      ['Celesta', 12, 'Sounds an octave higher'],
    ];
    const PC = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    let trIdx = 9, trNote = 0, trDir = 'sounding'; // defaults to Horn in F

    function renderTranspose(body) {
      const row = INSTR[trIdx], name = row[0], off = row[1], desc = row[2];
      /* Reading your part: written → sounding. Writing a part for a player:
         concert → written, the same offset applied backwards. */
      const shift = trDir === 'sounding' ? off : -off;
      const abs = trNote + shift;
      const out = PC[((abs % 12) + 12) % 12];
      const octs = Math.floor(abs / 12);
      const octLabel = octs === 0 ? '' : (octs > 0 ? `${octs} octave${octs > 1 ? 's' : ''} up` : `${-octs} octave${-octs > 1 ? 's' : ''} down`);
      const fromLabel = trDir === 'sounding' ? 'Written' : 'Concert';
      const toLabel = trDir === 'sounding' ? 'sounds as' : 'is written as';

      body.innerHTML = card(esc(name), desc,
        '<div class="fsh-field" style="flex-wrap:wrap;gap:8px">'
        + `<select id="trInstr" class="fsh-input" style="flex:1;min-width:190px;min-height:44px" aria-label="Instrument">${INSTR.map((r, i) =>
          `<option value="${i}"${i === trIdx ? ' selected' : ''}>${esc(r[0])}</option>`).join('')}</select>`
        + `<select id="trNote" class="fsh-input" style="flex:0 0 92px;min-height:44px" aria-label="Note">${PC.map((p, i) =>
          `<option value="${i}"${i === trNote ? ' selected' : ''}>${p}</option>`).join('')}</select>`
        + '<div class="fsh-seg" id="trDirSeg">'
        + `<button type="button" data-dir="sounding" class="${trDir === 'sounding' ? 'active' : ''}" style="min-height:44px">Written → sounds</button>`
        + `<button type="button" data-dir="written" class="${trDir === 'written' ? 'active' : ''}" style="min-height:44px">Concert → write</button>`
        + '</div></div>'
        + `<div class="fsh-out" style="margin-top:12px"><span class="big" style="font-size:23px">${esc(fromLabel)} ${esc(PC[trNote])} ${esc(toLabel)} ${esc(out)}</span></div>`
        + (octLabel ? `<p class="fsh-note" style="margin-top:8px">${esc(octLabel)}.</p>` : ''))
        + card('Every instrument', 'Written pitch against what the audience hears.',
          termList(INSTR.map((r) => [r[0], r[2], ''])));

      body.querySelector('#trInstr').addEventListener('change', (e) => { trIdx = +e.target.value; renderTranspose(body); });
      body.querySelector('#trNote').addEventListener('change', (e) => { trNote = +e.target.value; renderTranspose(body); });
      body.querySelector('#trDirSeg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-dir]'); if (!b) return;
        trDir = b.dataset.dir; renderTranspose(body);
      });
    }

    // ── Score order ──────────────────────────────────────────────────────────
    const SCORE = [
      ['1 · Woodwind', 'Piccolo, flutes, oboes, cor anglais, clarinets, bass clarinet, bassoons, contrabassoon', 'Highest to lowest within the family — the pattern repeats in every group below.'],
      ['2 · Brass', 'Horns, trumpets, trombones, tuba', 'Horns sit above trumpets despite sounding lower. Convention, not pitch order.'],
      ['3 · Percussion', 'Timpani first, then the rest', 'Timpani are usually ruled off on their own stave.'],
      ['4 · Harp & keyboard', 'Harp, celesta, piano, organ', ''],
      ['5 · Voices', 'Soloists, then chorus', 'Only when the work has them — directly above the strings.'],
      ['6 · Strings', 'Violin I, Violin II, Viola, Cello, Double bass', 'Always the bottom block, always that order.'],
    ];
    const CLEFS = [
      ['Treble', 'Violin, flute, oboe, clarinet, trumpet, horn', ''],
      ['Alto', 'Viola — and viola almost alone', 'Read it as treble and every note lands a third out.'],
      ['Tenor', 'Upper cello, trombone and bassoon passages', 'Used to escape a thicket of ledger lines above the bass clef.'],
      ['Bass', 'Cello, double bass, bassoon, trombone, tuba, timpani', ''],
    ];
    function renderScore(body) {
      body.innerHTML =
        card('Reading down the page', 'Standard order, top to bottom, in every published full score.', termList(SCORE))
        + card('Clefs', 'Which instrument reads what.', termList(CLEFS));
    }

    // ── Markings ─────────────────────────────────────────────────────────────
    const TEMPO = [
      ['Largo', 'Broad and very slow', 'roughly 40–60 bpm'],
      ['Adagio', 'Slow, at ease', 'roughly 66–76 bpm'],
      ['Andante', 'Walking pace', 'roughly 76–108 bpm'],
      ['Moderato', 'Moderate', 'roughly 108–120 bpm'],
      ['Allegro', 'Fast and bright', 'roughly 120–168 bpm'],
      ['Vivace', 'Lively', 'roughly 168–176 bpm'],
      ['Presto', 'Very fast', 'roughly 168–200 bpm'],
      ['Accelerando · Ritardando', 'Getting faster · getting slower', 'accel. and rit. — gradual, never a step change.'],
      ['Rubato', 'Flexible time, expressively stolen and repaid', 'The section follows the leader, not the metronome.'],
      ['A tempo · Tempo primo', 'Back to the previous speed · back to the opening speed', ''],
      ['Fermata', 'Held beyond the written value', 'How long is the conductor’s call.'],
    ];
    const DYN = [
      ['ppp · pp · p', 'Very very soft · very soft · soft', 'piano = soft.'],
      ['mp · mf', 'Moderately soft · moderately loud', 'mezzo = moderately.'],
      ['f · ff · fff', 'Loud · very loud · very very loud', 'forte = loud.'],
      ['Crescendo · Diminuendo', 'Gradually louder · gradually softer', 'cresc. and dim., or the hairpins.'],
      ['sfz — sforzando', 'A sudden strong accent', 'That note only — it is not a dynamic level you stay at.'],
      ['fp — fortepiano', 'Loud, then immediately soft', ''],
      ['subito', 'Suddenly — as in subito p', 'Cancels the gradual change you were expecting.'],
    ];
    const ARTIC = [
      ['Arco · Pizzicato', 'With the bow · plucked', 'pizz. stays in force until arco cancels it.'],
      ['Con sordino · Senza sordino', 'With mute · without mute', 'Both need bars to fit or remove — check you have them.'],
      ['Sul ponticello · Sul tasto', 'Bow near the bridge · over the fingerboard', 'Glassy and metallic · soft and flute-like.'],
      ['Col legno', 'Struck with the wood of the bow', ''],
      ['Détaché · Legato', 'Separate bows, notes not shortened · smoothly joined', ''],
      ['Spiccato · Staccato', 'Bounced off the string · shortened and detached', ''],
      ['Tremolo', 'Rapid repetition of a note', ''],
      ['Divisi (div.) · Unison (unis.)', 'Split the section between parts · back together', ''],
      ['Double stop', 'Two strings sounded together', ''],
      ['Tenuto · Marcato', 'Held to full value · marked and emphatic', ''],
    ];
    function renderMarkings(body) {
      body.innerHTML =
        card('Tempo', 'Ranges are approximate and differ between editions — the word matters more than the number.', termList(TEMPO))
        + card('Dynamics', 'Relative, never absolute: ff in a quartet is not ff in a full orchestra.', termList(DYN))
        + card('Technique & articulation', 'Weighted towards string directions, since that is where most of them appear.', termList(ARTIC));
    }

    H.register('music', [
      { id: 'orc-transpose', name: 'Transposition', icon: '🎺', desc: 'transposing instruments horn in f clarinet b flat written sounding concert pitch orchestra', render: renderTranspose,
        ai: { name: 'transposition', description: 'How an orchestral instrument transposes. Arg: instrument name, e.g. "horn".', params: { instrument: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.instrument).trim().toLowerCase();
            const r = INSTR.find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!r) throw new Error('No such instrument');
            return { instrument: r[0], semitonesFromWrittenToSounding: r[1], note: r[2] };
          } } },
      { id: 'orc-score', name: 'Score order', icon: '🎼', desc: 'full score layout woodwind brass percussion strings clefs alto tenor orchestra', render: renderScore },
      { id: 'orc-markings', name: 'Tempo & markings', icon: '🎻', desc: 'tempo italian terms dynamics articulation pizzicato sul ponticello divisi orchestra', render: renderMarkings,
        ai: { name: 'musicMarking', description: 'What an Italian tempo, dynamic or technique marking asks for. Arg: the marking.', params: { term: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.term).trim().toLowerCase();
            const m = TEMPO.concat(DYN, ARTIC).find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No such marking');
            return { marking: m[0], means: m[1], note: m[2] || '' };
          } } },
    ]);
  }
  boot();
})();
