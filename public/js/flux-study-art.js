/* ============================================================================
   FLUX STUDY HUB · Visual Arts (IB Diploma) module

   Arts held only Music, and the one art thing anywhere in Flux was a reference
   chip parked under English — the wrong shelf, and a link rather than a tool.

   Weighted towards the two places DP Visual Arts students actually lose marks:
   writing about work (the Comparative Study wants analysis, not description)
   and knowing where a piece sits in art history well enough to compare across
   cultures. The formal elements are here because every rubric assumes them.

   One deliberate omission: exact screen counts and word limits are NOT stated
   as fact. IB has revised this course, so a number right for one cohort is
   wrong for the next, and a confidently wrong figure is worse than none — a
   student would build a whole portfolio to it. The structure is described; the
   counts point at the current subject guide.

   Registers with fluxStudyHub. No storage.
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
    const refList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    /* Feldman's four stages, chosen over the looser form/content/context triad
       because the *order* is the teachable part: students who interpret before
       they have described tend to assert a meaning the work never evidences,
       which is the most common way a Comparative Study loses marks. */
    const FELDMAN = [
      ['1 · Describe', 'Only what is literally there.',
        'Subject, medium, scale, condition. Nothing anyone could argue with. If a reader could not pick the work out of a line-up from your description, it is not finished.'],
      ['2 · Analyse', 'How it is put together.',
        'The formal elements: line, shape, colour, value, texture, space, composition. Where does the eye enter, where does it travel, what holds it? Still no meaning yet.'],
      ['3 · Interpret', 'What it might mean — and your evidence.',
        'Every claim needs a "because" pointing back at step 2 or at context. "Unsettling because the horizon sits above the figure\'s eyeline" is analysis. "Unsettling" on its own is a feeling.'],
      ['4 · Judge', 'Does it succeed, and by whose measure?',
        'Judge against the maker\'s intention and the conventions of its time, not your taste. This is where context actually earns marks.'],
    ];

    const ELEMENTS = [
      ['Line', 'Direction, weight, edge', 'Contour, gesture, implied line, hatching'],
      ['Shape', 'Flat bounded area', 'Geometric vs organic; positive vs negative space'],
      ['Form', 'Three-dimensional mass', 'Volume, mass, void'],
      ['Space', 'Depth and position', 'Overlap, diminishing scale, atmospheric and linear perspective'],
      ['Colour', 'Hue, saturation, temperature', 'Complementary, analogous, local vs expressive colour'],
      ['Value', 'Light to dark', 'Chiaroscuro, tonal range, contrast'],
      ['Texture', 'Actual or implied surface', 'Impasto, glaze, frottage, visual texture'],
    ];
    const PRINCIPLES = [
      ['Balance', 'How visual weight is distributed', 'Symmetrical, asymmetrical, radial'],
      ['Emphasis', 'What is made to dominate', 'Focal point via contrast, isolation, placement'],
      ['Contrast', 'Difference put to work', 'Tone, hue, scale, texture'],
      ['Rhythm & repetition', 'Movement through repeated units', 'Regular, alternating, progressive'],
      ['Proportion & scale', 'Size relationships', 'Hierarchical scale, human scale, deliberate distortion'],
      ['Unity & variety', 'Coherence against interest', 'Too much unity is inert; too much variety is noise'],
    ];

    /* Deliberately not Western-only: the Comparative Study asks for works from
       different cultures and times, so a canon-only list would quietly steer
       students into the safe comparison that caps their marks. */
    const MOVEMENTS = [
      ['Ukiyo-e', 'c. 1670–1900, Japan', 'Woodblock print; flat colour, strong outline, everyday and theatrical subjects. Hokusai, Hiroshige, Utamaro.'],
      ['Renaissance', 'c. 1400–1600, Italy & N. Europe', 'Linear perspective, anatomy, classical revival. Leonardo, Michelangelo, van Eyck.'],
      ['Baroque', 'c. 1600–1750, Europe', 'Drama through light; diagonals and movement. Caravaggio, Gentileschi, Rembrandt.'],
      ['Impressionism', 'c. 1870–1890, France', 'Broken colour, visible brushwork, light over line. Monet, Morisot, Degas.'],
      ['Post-Impressionism', 'c. 1885–1905', 'Structure and emotion pushed past observation. Cézanne, Van Gogh, Gauguin.'],
      ['Expressionism', 'c. 1905–1930, Germany', 'Distortion for feeling; harsh colour. Kirchner, Kollwitz, Marc.'],
      ['Cubism', 'c. 1907–1920', 'Multiple viewpoints in one plane; fractured form. Picasso, Braque, Gris.'],
      ['Surrealism', 'c. 1924–1950', 'Dream logic, automatism, uncanny juxtaposition. Dalí, Kahlo, Ernst, Carrington.'],
      ['Abstract Expressionism', 'c. 1943–1965, USA', 'Scale, gesture, the act of painting itself. Pollock, Krasner, Rothko.'],
      ['Pop Art', 'c. 1955–1970', 'Mass media and consumer imagery as subject. Warhol, Hamilton, Kusama.'],
      ['Land art', 'c. 1968–', 'Site, material and time as the medium. Smithson, Goldsworthy, Denes.'],
      ['Contemporary / global', 'c. 1980–', 'Identity, postcolonial critique, installation and lens-based work. Kara Walker, El Anatsui, Ai Weiwei, Shirin Neshat.'],
    ];

    const FORMS = [
      ['Two-dimensional', 'Drawing, painting, printmaking, graphic work', ''],
      ['Three-dimensional', 'Sculpture, ceramics, textiles as form, installation, assemblage', ''],
      ['Lens-based, electronic & screen-based', 'Photography, film and video, digital and generative work, projection', ''],
    ];

    function renderAnalyse(body) {
      body.innerHTML = '<div class="fsh-panel">'
        + card('Analysing a work', 'Four stages, in order. The order is the point — interpreting before you have described is how a study ends up asserting a meaning it never evidences.', refList(FELDMAN))
        + card('Sentence stems that force evidence', 'Each one makes you name the thing in the work that earned the claim.', refList([
          ['"The eye enters at … because …"', 'Composition', 'Ties a reading to a formal decision.'],
          ['"X is emphasised through …"', 'Emphasis', 'Names the device, not just the effect.'],
          ['"Compared with [work B], this …"', 'Comparison', 'The Comparative Study wants relationships, not two descriptions side by side.'],
          ['"For a viewer in [place, date], this would …"', 'Context', 'Where cultural context marks are actually available.'],
        ]))
        + '</div>';
    }
    function renderElements(body) {
      body.innerHTML = '<div class="fsh-panel">'
        + card('Formal elements', 'What a work is made of — step 2 of any analysis.', refList(ELEMENTS))
        + card('Principles of design', 'What the elements are made to do.', refList(PRINCIPLES))
        + '</div>';
    }
    function renderMovements(body) {
      body.innerHTML = '<div class="fsh-panel">'
        + card('Movements and contexts', 'Deliberately not Western-only: the Comparative Study asks for different cultures and time periods, so comparing two European paintings is the safe choice that caps your marks.', refList(MOVEMENTS))
        + '</div>';
    }
    function renderCourse(body) {
      body.innerHTML = '<div class="fsh-panel">'
        + card('The three tasks', 'What each is for. Screen counts, artwork numbers and word limits are deliberately not listed here — IB has revised this course and a figure right for one cohort is wrong for the next. Take those from your current subject guide or your teacher.', refList([
          ['Comparative Study', 'Analysis and comparison of work by other artists',
            'Compare across different cultures and time periods, and make the connections explicit rather than leaving them implied. HL additionally connects that analysis to your own practice.'],
          ['Process Portfolio', 'Evidence of how you work',
            'Experimentation, refinement, dead ends, and what you changed because of them. Sustained development across more than one art-making form. Failures shown honestly score better than a tidy portfolio with no visible thinking.'],
          ['Exhibition', 'A coherent selected body of resolved work',
            'Selection and curation are assessed, not only the pieces. The curatorial rationale has to explain the relationships between works — why these, in this order, in this space.'],
        ]))
        + card('Art-making forms', 'Portfolios need to show more than one of these — a strong body of work confined to a single column is a common and avoidable mark loss.', refList(FORMS))
        + '</div>';
    }

    H.register('art', [
      { id: 'analyse', name: 'Analysing a work', icon: '🔍', desc: 'analysis feldman describe interpret critique comparative study visual analysis', render: renderAnalyse },
      { id: 'elements', name: 'Elements & principles', icon: '📐', desc: 'formal elements principles design line shape colour balance composition', render: renderElements,
        ai: { name: 'artElement', description: 'What a formal element or design principle means. Arg: name, e.g. "value" or "balance".', params: { term: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.term).trim().toLowerCase();
            const m = ELEMENTS.concat(PRINCIPLES).find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No such element or principle');
            return { term: m[0], meaning: m[1], examples: m[2] };
          } } },
      { id: 'movements', name: 'Movements', icon: '🖼', desc: 'art movements history impressionism cubism ukiyo-e contemporary context', render: renderMovements,
        ai: { name: 'artMovement', description: 'Dates, traits and key figures of an art movement. Arg: movement name.', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const m = MOVEMENTS.find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No such movement');
            return { movement: m[0], when: m[1], traits: m[2] };
          } } },
      { id: 'course', name: 'The three tasks', icon: '📋', desc: 'comparative study process portfolio exhibition curatorial rationale assessment', render: renderCourse },
    ]);
  }
  boot();
})();
