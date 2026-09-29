/* ============================================================================
   FLUX STUDY HUB · Literature (English)

   Adds a Literature unit to the existing `english` subject; H.register
   concatenates, so flux-study-english.js is untouched.

     lit-poetry      Poetry terms — a searchable packet you can print.
     lit-commentary  How to write a poetry commentary (IB Paper 1 style), with
                     a planner that turns your notes into an outline.
     lit-graphic     Graphic novel terms — panels, gutters, closure, shots.
     lit-mediums     The same storytelling idea in each medium's own jargon:
                     prose, poetry, drama, film, graphic novel.

   Examples are invented, or a few words from works long in the public domain.
   No storage: the commentary planner keeps its fields in memory while open.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${sub}</p>` : '')
      + inner + '</div>';

    /** A glossary: groups of [term, definition, example]. */
    const termCard = (t) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(t[0])}</div><div class="nm" style="margin-top:4px;font-size:12.5px;color:var(--fsh-ink-2)">${esc(t[1])}</div>${t[2] ? `<div class="nm" style="font-style:italic;margin-top:3px">${esc(t[2])}</div>` : ''}</div>`;
    function glossaryHTML(groups, q) {
      const needle = String(q || '').trim().toLowerCase();
      const out = groups.map(([g, terms]) => {
        const hit = needle ? terms.filter((t) => (t[0] + ' ' + t[1] + ' ' + (t[2] || '')).toLowerCase().includes(needle)) : terms;
        return hit.length ? `<div class="fsh-gloss-h">${esc(g)}</div><div class="fsh-formula-list">${hit.map(termCard).join('')}</div>` : '';
      }).join('');
      return out || '<p style="color:var(--fsh-mut)">No matches.</p>';
    }
    /** Print a glossary on its own, as a clean black-on-white packet. */
    function printPacket(title, intro, groups) {
      const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
        body{font:11pt/1.45 Georgia,'Times New Roman',serif;color:#000;margin:18mm}
        h1{font:700 18pt/1.2 system-ui,sans-serif;margin:0 0 4px} .intro{color:#444;margin:0 0 10px}
        h2{font:700 12pt system-ui,sans-serif;margin:14px 0 4px;padding-bottom:3px;border-bottom:1px solid #999;break-after:avoid}
        .t{margin:5px 0;break-inside:avoid} .t b{font-family:system-ui,sans-serif} .ex{font-style:italic;color:#333}
        .foot{margin-top:16px;color:#777;font:9pt system-ui,sans-serif}</style></head><body>
        <h1>${esc(title)}</h1><p class="intro">${esc(intro)}</p>
        ${groups.map(([g, terms]) => `<h2>${esc(g)}</h2>${terms.map((t) => `<div class="t"><b>${esc(t[0])}</b> — ${esc(t[1])}${t[2] ? ` <span class="ex">${esc(t[2])}</span>` : ''}</div>`).join('')}`).join('')}
        <p class="foot">Flux · Study tools</p></body></html>`;
      const f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(f);
      const w = f.contentWindow;
      w.document.open(); w.document.write(doc); w.document.close();
      setTimeout(() => {
        try { w.focus(); w.print(); } catch (e) { if (window.showToast) window.showToast('Printing is not available here', 'info'); }
        setTimeout(() => f.remove(), 1500);
      }, 80);
    }
    function glossaryTool(body, st, opts) {
      body.innerHTML = card(opts.title, opts.sub,
        `<div class="fsh-field" style="flex-wrap:wrap;margin-bottom:12px"><div class="fsh-search" style="flex:1;min-width:200px;max-width:360px"><span class="fsh-search-ico">⌕</span><input type="search" class="fsh-gloss-q" placeholder="${esc(opts.placeholder)}" value="${esc(st.q)}"></div>
          <button type="button" class="fsh-btn fsh-gloss-print">🖨 Print packet</button></div>
         <div class="fsh-gloss">${glossaryHTML(opts.groups, st.q)}</div>`);
      const q = body.querySelector('.fsh-gloss-q');
      q.addEventListener('input', () => { st.q = q.value; body.querySelector('.fsh-gloss').innerHTML = glossaryHTML(opts.groups, st.q); });
      body.querySelector('.fsh-gloss-print').addEventListener('click', () => printPacket(opts.title, opts.printIntro, opts.groups));
    }

    // ── Poetry terms ─────────────────────────────────────────────────────────
    const POETRY = [
      ['Sound', [
        ['Rhyme', 'Words whose final sounds match.', 'night / light'],
        ['Rhyme scheme', 'The pattern of end rhymes, labelled with letters — each new rhyme sound gets the next letter.', 'A quatrain rhyming night / day / light / way is ABAB.'],
        ['Internal rhyme', 'A rhyme inside a line rather than at its end.', '"Once upon a midnight dreary, while I pondered, weak and weary" — Poe'],
        ['Slant rhyme (half rhyme)', 'A near rhyme: the sounds are close but not identical. Often used to unsettle.', 'worm / swarm; soul / all'],
        ['Eye rhyme', 'Words that look as if they rhyme but are not pronounced alike.', 'love / move; bough / cough'],
        ['Alliteration', 'Repeated consonant sounds at the start of nearby words.', 'the wild, white wind'],
        ['Assonance', 'Repeated vowel sounds in nearby words.', 'the low moan of the old road'],
        ['Consonance', 'Repeated consonant sounds anywhere in nearby words, often at the ends.', 'the black truck struck the rock'],
        ['Sibilance', 'Repeated s and sh sounds — can hush, soothe or hiss.', 'the silent, sliding sea'],
        ['Onomatopoeia', 'A word that imitates the sound it names.', 'hiss, crackle, thud'],
        ['Euphony / cacophony', 'Smooth, pleasant-sounding language / harsh, clashing sounds that jar.', 'lulling lullaby / cracked, clanking, gritted'],
      ]],
      ['Rhythm and metre', [
        ['Metre', 'The regular pattern of stressed and unstressed syllables in a line.', ''],
        ['Foot', 'One unit of metre — a small group of syllables with a set stress pattern.', ''],
        ['Iamb', 'Unstressed then stressed: da-DUM. The most common foot in English.', 'a-WAY, be-LIEVE'],
        ['Trochee', 'Stressed then unstressed: DUM-da. Feels falling, chant-like.', 'GAR-den, TI-ger'],
        ['Anapest', 'Two unstressed then a stressed: da-da-DUM. Galloping.', 'in-ter-VENE'],
        ['Dactyl', 'A stressed then two unstressed: DUM-da-da.', 'MER-ri-ly'],
        ['Spondee', 'Two stresses together: DUM-DUM. Slows and weighs a line down.', 'HEART-BREAK'],
        ['Iambic pentameter', 'Five iambs per line — ten syllables, da-DUM × 5. The rhythm of Shakespeare\'s sonnets and speeches.', '"Shall I compare thee to a summer\'s day?"'],
        ['Scansion', 'Marking a line\'s stressed and unstressed syllables to find its metre — and where it breaks the pattern.', ''],
        ['Caesura', 'A pause in the middle of a line, usually at punctuation.', '"To err is human; to forgive, divine." — Pope'],
        ['Enjambment', 'A sentence running over the end of a line without a pause, pulling the reader on.', ''],
        ['End-stopped line', 'A line that ends with a pause — a full stop, comma or natural break.', ''],
      ]],
      ['Form and structure', [
        ['Stanza', 'A group of lines forming a unit, like a paragraph in a poem.', ''],
        ['Couplet / tercet / quatrain', 'Stanzas (or groups) of two, three and four lines.', ''],
        ['Sestet / octave', 'Groups of six and eight lines — the two halves of a Petrarchan sonnet.', ''],
        ['Sonnet', 'A 14-line poem, usually in iambic pentameter. Petrarchan: octave + sestet. Shakespearean: three quatrains + a couplet (ABAB CDCD EFEF GG).', ''],
        ['Volta', 'The "turn" in a sonnet — a shift in argument, tone or feeling. Line 9 in a Petrarchan sonnet; often the final couplet in a Shakespearean one.', ''],
        ['Villanelle', '19 lines: five tercets and a quatrain, rhyming ABA, with two lines repeated as refrains.', ''],
        ['Ballad', 'A poem that tells a story, often in quatrains rhyming ABCB, with a refrain; rooted in song.', ''],
        ['Ode', 'A formal, often elaborate poem addressed to and praising a person, object or idea.', '"Ode to a Nightingale" — Keats'],
        ['Elegy', 'A poem of mourning for someone who has died, often moving from grief to consolation.', ''],
        ['Haiku', 'A three-line form from Japan; in English usually 5–7–5 syllables, catching a single moment, often in nature.', ''],
        ['Dramatic monologue', 'A single speaker addresses a silent listener and reveals more about themselves than they intend.', '"My Last Duchess" — Browning'],
        ['Free verse', 'Poetry without a regular metre or rhyme scheme; its shape comes from line breaks and phrasing.', ''],
        ['Blank verse', 'Unrhymed iambic pentameter.', 'Much of Shakespeare\'s dialogue'],
        ['Refrain', 'A line or phrase repeated through a poem, often at the end of stanzas.', ''],
        ['Lyric', 'A short poem expressing a speaker\'s personal thoughts and feelings.', ''],
        ['Concrete (shape) poem', 'A poem whose layout on the page forms a picture of its subject.', ''],
      ]],
      ['Imagery and figurative language', [
        ['Imagery', 'Language that appeals to the senses: sight (visual), sound (auditory), touch (tactile), smell (olfactory), taste (gustatory), movement (kinaesthetic).', ''],
        ['Metaphor / extended metaphor', 'A comparison saying one thing is another; extended when it runs across several lines or the whole poem.', 'Life is a road, and every junction a choice.'],
        ['Simile', 'A comparison using "like" or "as".', 'lonely as a cloud'],
        ['Personification', 'Giving human qualities to something non-human.', 'the sulking sky'],
        ['Apostrophe', 'Speaking directly to someone absent, dead, or to a thing or idea.', '"Death, be not proud" — Donne'],
        ['Conceit', 'An elaborate, surprising comparison developed at length — a favourite of the Metaphysical poets.', 'Donne compares two lovers to the legs of a drawing compass.'],
        ['Symbol', 'An object, image or action that stands for something larger than itself.', 'a closed door for a lost chance'],
        ['Pathetic fallacy', 'Weather or nature mirroring human feeling.', 'rain on the day of a funeral'],
        ['Synaesthesia', 'Describing one sense in terms of another.', 'a loud shirt; a bitter wind'],
        ['Motif', 'An image or idea that recurs through a poem or a poet\'s work.', ''],
      ]],
      ['Voice, tone and meaning', [
        ['Speaker / persona', 'The voice of the poem. Never assume it is the poet — call it "the speaker".', ''],
        ['Addressee', 'Who the speaker is talking to — a lover, the reader, the dead, themselves.', ''],
        ['Tone', 'The speaker\'s attitude to the subject: bitter, tender, ironic, reverent…', ''],
        ['Mood', 'The atmosphere the poem creates, and the feeling it leaves in the reader.', ''],
        ['Diction', 'Word choice — formal or plain, archaic or modern, harsh or soft.', ''],
        ['Connotation / denotation', 'The associations a word carries / its dictionary meaning.', '"home" denotes a house; it connotes safety and belonging.'],
        ['Syntax', 'Word order and sentence structure — inverted, fragmented, long and winding, or short and blunt.', ''],
        ['Shift', 'A change in tone, speaker, time, place or argument — often where a poem\'s meaning turns.', ''],
        ['Ambiguity', 'Deliberate openness to more than one meaning.', ''],
        ['Irony', 'A gap between what is said and what is meant (verbal), expected and what happens (situational), or what a character knows and what we know (dramatic).', ''],
        ['Juxtaposition', 'Placing contrasting images or ideas side by side to sharpen both.', ''],
        ['Line break', 'Where a line ends — a choice that can create emphasis, suspense or a double meaning.', ''],
      ]],
    ];
    const poetrySt = { q: '' };
    function renderPoetry(body) {
      glossaryTool(body, poetrySt, {
        title: 'Poetry terms',
        sub: 'The vocabulary for talking about a poem — sound, rhythm, form, imagery and voice. Search it, or print the whole packet.',
        placeholder: 'Search poetry terms…',
        printIntro: 'The vocabulary for writing about poetry. When you name a technique, always say what it does to the meaning.',
        groups: POETRY,
      });
    }

    // ── Poetry commentary ────────────────────────────────────────────────────
    const STEPS = [
      ['Read it twice', 'First for sense: who is speaking, to whom, about what, where and when? Then again with a pen. Say what happens in the poem in one sentence before you analyse anything.'],
      ['Annotate', 'Mark the title, the speaker and situation, the structure (stanzas, line lengths, rhyme, metre), the language (diction, imagery, figurative language, sound), and the tone. Circle every shift.'],
      ['Find the turn', 'Most poems move: from one feeling, time or idea to another. Where does it change, and what is different at the end from the beginning? The movement is usually the heart of your argument.'],
      ['Write a thesis', 'One or two sentences answering how the poem creates its meaning and why — technique, effect and insight together. If there is a guiding question, answer it directly.'],
      ['Plan by idea, not by device', 'Three or four body paragraphs, each making one claim about meaning, in the order of the poem\'s movement. "Imagery", "Structure", "Sound" as headings leads to a list of features, not an argument.'],
      ['Build each paragraph', 'Point (your claim) → evidence (a short quotation, embedded in your sentence) → analysis (how the words work: connotation, sound, form, placement) → effect (on meaning and the reader) → link back to the thesis.'],
      ['Introduce and conclude', 'Introduction: title, poet, form, the poem\'s movement in a line, then your thesis. Conclusion: what the poem finally suggests, drawing your points together — no new quotations.'],
      ['Check', 'Leave five minutes. Is every quotation analysed? Is every device tied to an effect? Did you call it "the speaker"?'],
    ];
    const MISTAKES = [
      'Feature-spotting — naming a device without saying what it does. "There is alliteration in line 3" earns nothing on its own.',
      'Retelling the poem instead of analysing how it works.',
      'Long quotations. Quote the few words you are about to analyse, and weave them into your sentence.',
      'Treating the speaker as the poet.',
      'Ignoring structure — line breaks, stanza shape and the turn are choices too.',
      'Empty effects: "this makes the reader want to read on" could be said of any line of any poem.',
    ];
    const VERBS = ['conveys', 'evokes', 'foregrounds', 'underscores', 'juxtaposes', 'undercuts', 'heightens', 'destabilises', 'enacts', 'subverts', 'intensifies', 'distances'];
    const STARTERS = [
      'The enjambment across lines 4–5 enacts…',
      'By placing "…" at the end of the line, the poet foregrounds…',
      'The shift from … to … in the final stanza signals…',
      'The harsh consonance of "…" mirrors…',
      'Although the speaker claims …, the imagery of … suggests…',
    ];
    const plan = { title: '', question: '', thesis: '', points: [{ q: '', t: '', e: '' }, { q: '', t: '', e: '' }, { q: '', t: '', e: '' }] };
    function outlineText() {
      const lines = [];
      if (plan.title) lines.push('Poem: ' + plan.title);
      if (plan.question) lines.push('Guiding question: ' + plan.question);
      lines.push('', 'Thesis: ' + (plan.thesis || '…'), '');
      plan.points.forEach((p, i) => {
        if (!p.q && !p.t && !p.e) return;
        lines.push(`Paragraph ${i + 1}`);
        if (p.q) lines.push('  Evidence: "' + p.q.replace(/^["“]|["”]$/g, '') + '"');
        if (p.t) lines.push('  Technique: ' + p.t);
        if (p.e) lines.push('  Effect / meaning: ' + p.e);
        lines.push('');
      });
      lines.push('Conclusion: what the poem finally suggests — link back to the thesis.');
      return lines.join('\n');
    }
    function renderCommentary(body) {
      const field = (key, label, ph, i) => {
        const val = i == null ? plan[key] : plan.points[i][key];
        return `<label class="fsh-plan-f"><span>${esc(label)}</span><input class="fsh-input" data-k="${key}"${i == null ? '' : ` data-i="${i}"`} placeholder="${esc(ph)}" value="${esc(val)}"></label>`;
      };
      body.innerHTML = card('How to write a poetry commentary',
        'A close analysis of one poem — what IB calls Paper 1, the guided literary analysis. The same method works for any unseen poem.',
        `<ol class="fsh-steps">${STEPS.map((s) => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>`).join('')}</ol>
        <div class="fsh-gloss-h">Thesis template</div>
        <div class="fsh-respelled">In <i>[title]</i>, [poet] uses [feature] and [feature] to present [subject] as [your interpretation], ultimately suggesting [the insight].</div>
        <div class="fsh-lit-cols">
          <div><div class="fsh-gloss-h">Common mistakes</div><ul class="fsh-bullets">${MISTAKES.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>
          <div><div class="fsh-gloss-h">Analytical verbs</div><div class="fsh-chips-row">${VERBS.map((v) => `<span class="fsh-shellbar">${esc(v)}</span>`).join('')}</div>
            <div class="fsh-gloss-h">Sentence starters</div><ul class="fsh-bullets">${STARTERS.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
        </div>
        <p class="fsh-note">IB Paper 1 timing: SL is 1 hour 15 minutes for one passage; HL is 2 hours 15 minutes for two. Spend the first 15–20 minutes reading and planning — a clear plan writes faster than no plan.</p>
        <div class="fsh-gloss-h">Plan your commentary</div>
        <div class="fsh-plan" id="litPlan">
          ${field('title', 'Poem and poet', 'e.g. "Ozymandias", Shelley')}
          ${field('question', 'Guiding question (if given)', 'e.g. How does the poet present power?')}
          ${field('thesis', 'Thesis', 'How the poem makes its meaning, and why')}
          ${plan.points.map((p, i) => `<div class="fsh-plan-p"><div class="fsh-plan-n">Paragraph ${i + 1}</div>
            ${field('q', 'Quotation', 'a few words', i)}${field('t', 'Technique', 'e.g. enjambment, sibilance', i)}${field('e', 'Effect on meaning', 'what it does, and why it matters', i)}</div>`).join('')}
          <div><button type="button" class="fsh-btn" id="litCopy">Copy outline</button> <span class="fsh-note" id="litCopied"></span></div>
        </div>`);
      body.querySelector('#litPlan').addEventListener('input', (e) => {
        const el = e.target.closest('[data-k]');
        if (!el) return;
        if (el.dataset.i != null) plan.points[+el.dataset.i][el.dataset.k] = el.value;
        else plan[el.dataset.k] = el.value;
      });
      body.querySelector('#litCopy').addEventListener('click', async () => {
        const note = body.querySelector('#litCopied');
        try { await navigator.clipboard.writeText(outlineText()); note.textContent = 'Copied — paste it into your notes.'; }
        catch (e) { note.textContent = 'Copying is blocked here — select the fields and copy them by hand.'; }
      });
    }

    // ── Graphic novel terms ──────────────────────────────────────────────────
    const GRAPHIC = [
      ['The page', [
        ['Panel', 'A single framed image — the basic unit of a comic, like a shot in film.', ''],
        ['Gutter', 'The space between panels. What happens "in the gutter" is left for the reader to imagine.', ''],
        ['Tier', 'A row of panels across the page.', ''],
        ['Splash page', 'A single image filling a whole page — used for big moments, arrivals and reveals.', ''],
        ['Double-page spread', 'One image or layout across two facing pages.', ''],
        ['Bleed', 'Art that runs off the edge of the page instead of stopping at a border — can feel open, overwhelming or boundless.', ''],
        ['Inset panel', 'A small panel placed inside a larger one, often a detail or close-up.', ''],
        ['Border (frame)', 'The line around a panel. Its style — ragged, rounded, missing — can signal memory, dream or chaos.', ''],
        ['Layout / grid', 'How panels are arranged on the page. A regular grid (such as nine equal panels) feels steady; broken layouts feel urgent.', ''],
        ['Page-turn reveal', 'Saving a surprise for the first panel after the reader turns the page.', ''],
      ]],
      ['Words', [
        ['Speech balloon', 'Holds spoken words; the tail points to the speaker. Jagged balloons shout, dotted ones whisper.', ''],
        ['Thought bubble', 'A cloud-shaped balloon with a trail of circles, holding a character\'s thoughts.', ''],
        ['Caption', 'A box of narration, time or place ("Meanwhile…", "Paris, 1943") set apart from the speech.', ''],
        ['Sound effect (SFX)', 'Onomatopoeia drawn into the art — its size, shape and colour show how the sound feels.', 'KRAK!'],
        ['Lettering', 'The style of the words: font, size, bold and wobble all shape how they are "heard".', ''],
        ['Word–image relationship', 'Words and pictures can say the same thing, add to each other, or contradict each other — contradiction is often where the irony is.', ''],
      ]],
      ['Images', [
        ['Shot distance', 'Borrowed from film: establishing shot (sets the scene), long shot (whole figure), medium shot (waist up), close-up (face), extreme close-up (a detail).', ''],
        ['Angle', 'Where we look from: eye level (neutral), high angle (looking down — small, vulnerable), low angle (looking up — powerful), bird\'s-eye and worm\'s-eye views.', ''],
        ['Framing and composition', 'What is inside the panel and where — foreground and background, what is centred, what is cut off.', ''],
        ['Colour and palette', 'The range of colours used; a shift in palette often marks a flashback, a new place, or a change in mood.', ''],
        ['Line and style', 'Clean or rough, cartoonish or realistic. Simpler faces make it easier for readers to see themselves in a character.', ''],
        ['Motion lines', 'Lines showing movement and speed.', ''],
        ['Emanata', 'Little marks drawn around a character to show feeling — sweat drops, stars, question marks.', ''],
        ['Visual metaphor / symbol', 'An image that means more than itself — a cage, a mask, a recurring object.', ''],
      ]],
      ['Time and reading', [
        ['Closure', 'The reader\'s imaginative leap that joins two separate panels into one continuous event.', ''],
        ['Panel transitions', 'How one panel leads to the next: moment-to-moment, action-to-action, subject-to-subject, scene-to-scene, aspect-to-aspect (different views of one place or mood), and non sequitur.', ''],
        ['Pacing', 'Time on the page. Many small panels speed things up; a wide or silent panel slows it down.', ''],
        ['Reading path', 'The order the eye travels — left to right, top to bottom in English (a Z-shape); right to left in manga.', ''],
        ['Encapsulation', 'Choosing which single moment of an action to draw — the frozen instant that stands for the whole.', ''],
      ]],
    ];
    const graphicSt = { q: '' };
    function renderGraphic(body) {
      glossaryTool(body, graphicSt, {
        title: 'Graphic novel terms',
        sub: 'The language for analysing comics and graphic novels — how the page, words, images and time work together.',
        placeholder: 'Search graphic novel terms…',
        printIntro: 'The vocabulary for writing about comics and graphic novels. Name the choice, then say what it does.',
        groups: GRAPHIC,
      });
    }

    // ── One idea, five mediums ───────────────────────────────────────────────
    const MEDIUMS = ['Prose fiction', 'Poetry', 'Drama', 'Film', 'Graphic novel'];
    const COMPARE = [
      ['The basic unit', ['sentence, paragraph, chapter', 'line, stanza', 'line of dialogue, scene, act', 'shot, scene, sequence', 'panel, page, spread']],
      ['Who tells it', ['the narrator — first, second or third person; omniscient or limited; sometimes unreliable', 'the speaker (persona)', 'the characters themselves; sometimes a chorus or narrator figure', 'the camera\'s point of view; sometimes voice-over', 'caption narration, plus what the "camera" chooses to show']],
      ['Showing a place', ['description, setting, imagery', 'imagery', 'set design, stage directions, lighting', 'mise-en-scène (set, costume, lighting, framing); establishing shot', 'establishing panel, art style, colour palette']],
      ['Showing thoughts', ['interior monologue, free indirect style, stream of consciousness', 'the lyric voice speaking its feelings', 'soliloquy, aside', 'voice-over, close-up on a face, subjective (POV) shot', 'thought bubbles, caption boxes']],
      ['Controlling time', ['pace; flashback (analepsis) and flash-forward (prolepsis); summary vs scene', 'line length, enjambment, caesura', 'scene breaks; stage time vs real time', 'editing — cut, montage, cross-cutting, slow motion', 'the gutter and closure; panel size and number']],
      ['Creating emphasis', ['short sentences, placement, repetition', 'line breaks, stress, rhyme', 'pauses, stage position, blocking', 'close-ups, music, lighting, a lingering shot', 'splash pages, panel size, bold lettering, colour']],
      ['Sound', ['onomatopoeia, the rhythm of sentences', 'rhyme, metre, sound devices', 'delivery, sound effects, music cues', 'diegetic sound (in the world) and non-diegetic sound (score, voice-over)', 'SFX lettering, balloon shapes']],
      ['The audience\'s position', ['narrative distance — how close we are to a character', 'the addressee — who the poem speaks to', 'the fourth wall; dramatic irony', 'camera angle and distance; point-of-view shots', 'panel angle and distance']],
    ];
    const MEDIUM_TERMS = {
      'Prose fiction': [
        ['Narrator', 'The voice telling the story — not the same as the author.'],
        ['Point of view', 'First person (I), second (you), third person limited (one character\'s view) or omniscient (all-knowing).'],
        ['Unreliable narrator', 'A narrator whose account we cannot fully trust.'],
        ['Free indirect style', 'Third-person narration slipping into a character\'s own thoughts and words.'],
        ['Stream of consciousness', 'Narration that follows the flow of a mind — jumps, associations and all.'],
        ['Characterisation', 'How character is built: direct (told) or indirect (shown through speech, action, appearance).'],
        ['Exposition, climax, resolution', 'Set-up, turning point and ending of a plot.'],
        ['Frame narrative', 'A story told inside another story.'],
        ['Epistolary', 'Told through letters, diaries or documents.'],
      ],
      'Poetry': [
        ['Speaker', 'The voice of the poem.'],
        ['Line and stanza', 'The poem\'s units — line breaks are meaningful choices.'],
        ['Metre and rhyme', 'The sound structure of the poem.'],
        ['Volta', 'The turn in argument or feeling.'],
        ['Imagery', 'Sensory language.'],
        ['More', 'See Poetry terms for the full packet.'],
      ],
      'Drama': [
        ['Act and scene', 'The large and small divisions of a play.'],
        ['Stage directions', 'The playwright\'s instructions for action, setting and delivery.'],
        ['Soliloquy', 'A character alone on stage speaking their thoughts aloud.'],
        ['Aside', 'A remark to the audience that other characters on stage cannot hear.'],
        ['Monologue', 'A long speech by one character to others.'],
        ['Dramatic irony', 'The audience knows something a character does not.'],
        ['Fourth wall', 'The invisible wall between stage and audience; "breaking" it means addressing the audience.'],
        ['Blocking', 'Where and how actors move on stage.'],
        ['Hamartia and catharsis', 'In tragedy: the hero\'s fatal flaw or error / the audience\'s emotional release.'],
      ],
      'Film': [
        ['Shot types', 'Establishing, long, medium, close-up, extreme close-up.'],
        ['Camera angle', 'High, low, eye level, bird\'s-eye, Dutch (tilted) angle.'],
        ['Camera movement', 'Pan (turns side to side), tilt (up and down), tracking/dolly (moves along), zoom, handheld.'],
        ['Mise-en-scène', 'Everything placed in the frame: set, props, costume, lighting, actors\' positions.'],
        ['Lighting', 'High-key (bright, even) or low-key (dark, shadowy) — sets the mood.'],
        ['Editing', 'Cut, match cut, montage, cross-cutting, fade, dissolve — how shots are joined.'],
        ['Diegetic / non-diegetic sound', 'Sound the characters can hear / sound only the audience hears, like the score.'],
        ['Voice-over', 'Narration heard over the images.'],
      ],
      'Graphic novel': [
        ['Panel and gutter', 'The frames, and the space between them where the reader fills the gaps.'],
        ['Splash page', 'One image across a whole page.'],
        ['Closure', 'The reader joining separate panels into one action.'],
        ['Balloons and captions', 'Speech, thought and narration.'],
        ['More', 'See Graphic novel terms for the full list.'],
      ],
    };
    let mediumTab = 'compare';
    function renderMediums(body) {
      const tabs = [['compare', 'Compare']].concat(MEDIUMS.map((m) => [m, m]));
      const inner = mediumTab === 'compare'
        ? `<div class="fsh-tablewrap"><table class="fsh-numtable fsh-mediums"><thead><tr><th></th>${MEDIUMS.map((m) => `<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>
            ${COMPARE.map(([idea, cells]) => `<tr><th scope="row">${esc(idea)}</th>${cells.map((c, i) => `<td data-label="${esc(MEDIUMS[i])}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
           <p class="fsh-note">Use the medium's own words in an essay: a film has shots and mise-en-scène, a comic has panels and gutters, a play has stage directions — not "paragraphs" or "chapters".</p>`
        : `<div class="fsh-formula-list">${MEDIUM_TERMS[mediumTab].map((t) => termCard([t[0], t[1], ''])).join('')}</div>`;
      body.innerHTML = card('Storytelling by medium',
        'Every medium tells stories with its own tools — and its own jargon. Compare how the same idea is named in each, or open one medium\'s key terms.',
        `<div class="fsh-seg" id="medTabs" style="margin-bottom:14px">${tabs.map(([id, label]) => `<button type="button" data-m="${esc(id)}" class="${id === mediumTab ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>${inner}`);
      body.querySelector('#medTabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        mediumTab = b.dataset.m;
        renderMediums(body);
      });
    }

    const define = (groups) => (a) => {
      const q = String(a).trim().toLowerCase();
      for (const [, terms] of groups) {
        const t = terms.find((x) => x[0].toLowerCase() === q || x[0].toLowerCase().split(/\s*[/(]\s*/)[0] === q);
        if (t) return { term: t[0], definition: t[1], example: t[2] || null };
      }
      throw new Error('Unknown term');
    };

    H.register('english', [
      { id: 'lit-poetry', name: 'Poetry terms', icon: '🪶', desc: 'poetry terms glossary packet metre rhyme scheme iamb sonnet stanza enjambment caesura volta speaker', render: renderPoetry, ai: { name: 'poetryTerm', description: 'Define a poetry term. Arg: term name.', params: { term: 'string' }, run: define(POETRY) } },
      { id: 'lit-commentary', name: 'Poetry commentary', icon: '🖋', desc: 'how to write a poetry commentary analysis paper 1 guided literary analysis thesis unseen poem', render: renderCommentary },
      { id: 'lit-graphic', name: 'Graphic novel terms', icon: '💬', desc: 'graphic novel comics terms panel gutter splash page closure speech balloon caption transitions', render: renderGraphic, ai: { name: 'graphicNovelTerm', description: 'Define a comics / graphic novel term. Arg: term name.', params: { term: 'string' }, run: define(GRAPHIC) } },
      { id: 'lit-mediums', name: 'Storytelling mediums', icon: '🎞', desc: 'storytelling mediums jargon prose drama film graphic novel poetry compare terms mise-en-scène soliloquy shot', render: renderMediums },
    ]);
  }
  boot();
})();
