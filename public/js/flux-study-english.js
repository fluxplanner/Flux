/* ============================================================================
   FLUX STUDY HUB · English module (Pass 3)
   Bespoke native tools: citation builder (MLA/APA), literary-device glossary,
   grammar reference, essay scaffold. Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    // ── Citation builder ─────────────────────────────────────────────────────
    let citeType = 'web';
    function buildCite(t, f) {
      const A = f.author ? (f.author.endsWith('.') ? f.author : f.author + '.') : '';
      const yr = f.year || 'n.d.';
      if (t === 'book') {
        return {
          MLA: `${A} <i>${esc(f.title || 'Title')}</i>. ${f.publisher ? esc(f.publisher) + ', ' : ''}${esc(f.year || '')}.`,
          APA: `${A} (${esc(yr)}). <i>${esc(f.title || 'Title')}</i>. ${f.publisher ? esc(f.publisher) + '.' : ''}`,
        };
      }
      return {
        MLA: `${A} "${esc(f.title || 'Title')}." <i>${esc(f.site || 'Website')}</i>, ${f.year ? esc(f.year) + ', ' : ''}${esc(f.url || '')}.`,
        APA: `${A} (${esc(yr)}). <i>${esc(f.title || 'Title')}</i>. ${f.site ? esc(f.site) + '. ' : ''}${esc(f.url || '')}`,
      };
    }
    function renderCite(body) {
      const fld = (id, l) => `<div class="fsh-ws-group"><div class="fsh-label"><span>${l}</span></div><input id="ct_${id}" class="fsh-input"></div>`;
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">❝ ❞ Citation builder</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Fill the fields → get MLA 9 and APA 7. Author as “Last, First”.</p>
        <div class="fsh-seg" id="ctType" style="margin-bottom:12px"><button type="button" data-t="web" class="${citeType === 'web' ? 'active' : ''}">Website</button><button type="button" data-t="book" class="${citeType === 'book' ? 'active' : ''}">Book</button></div>
        <div class="fsh-ws-controls">${fld('author', 'Author (Last, First)')}${fld('title', 'Title')}${citeType === 'book' ? fld('publisher', 'Publisher') : fld('site', 'Website / container')}${fld('year', 'Year')}${citeType === 'web' ? fld('url', 'URL') : ''}</div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="ctGo">Generate</button></div><div class="fsh-out" id="ctOut"></div></div>`;
      const get = (id) => { const e = document.getElementById('ct_' + id); return e ? e.value.trim() : ''; };
      const run = () => { const o = document.getElementById('ctOut'); const r = buildCite(citeType, { author: get('author'), title: get('title'), publisher: get('publisher'), site: get('site'), year: get('year'), url: get('url') }); o.innerHTML = `<div class="fsh-mm-rows"><div class="fsh-mm-row" style="display:block"><div class="el" style="color:var(--fsh-accent);margin-bottom:4px">MLA 9</div>${r.MLA}</div><div class="fsh-mm-row" style="display:block"><div class="el" style="color:var(--fsh-accent);margin-bottom:4px">APA 7</div>${r.APA}</div></div>`; };
      document.getElementById('ctType').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; citeType = b.dataset.t; renderCite(body); });
      document.getElementById('ctGo').addEventListener('click', run);
    }

    // ── Literary devices ─────────────────────────────────────────────────────
    const DEVICES = [
      ['Metaphor', 'A direct comparison without like/as.', '"Time is a thief."'],
      ['Simile', 'A comparison using like or as.', '"Brave as a lion."'],
      ['Personification', 'Human traits given to non-human things.', '"The wind whispered."'],
      ['Hyperbole', 'Deliberate exaggeration.', '"I\'ve told you a million times."'],
      ['Alliteration', 'Repeated initial consonant sounds.', '"Peter Piper picked..."'],
      ['Onomatopoeia', 'A word that imitates a sound.', '"The bees buzzed."'],
      ['Imagery', 'Vivid sensory description.', '"Crisp golden leaves crunched."'],
      ['Irony', 'Meaning opposite to the literal.', '"A fire station burns down."'],
      ['Symbolism', 'An object standing for an idea.', 'A dove = peace.'],
      ['Foreshadowing', 'Hints at events to come.', 'Dark clouds before tragedy.'],
      ['Oxymoron', 'Two contradictory terms together.', '"Deafening silence."'],
      ['Allusion', 'A reference to another work/event.', '"He was a Romeo."'],
      ['Juxtaposition', 'Placing contrasting ideas side by side.', 'Wealth beside poverty.'],
      ['Motif', 'A recurring element with meaning.', 'A recurring colour in a novel.'],
      ['Anaphora', 'Repetition at the start of clauses.', 'Repeated "we shall" openings.'],
      ['Metonymy', 'A thing referred to by an associated term.', '"The crown" = monarchy.'],
    ];
    let devQ = '';
    const devCard = (d) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(d[0])}</div><div class="nm" style="margin-top:4px;font-size:12px">${esc(d[1])}</div><div class="nm" style="font-style:italic;color:var(--fsh-ink-2)">${esc(d[2])}</div></div>`;
    function renderDevices(body) {
      const list = DEVICES.filter((d) => (d[0] + ' ' + d[1]).toLowerCase().includes(devQ.toLowerCase()));
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">📖 Literary devices</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Definitions with examples — search to filter.</p>
        <div class="fsh-search" style="max-width:320px;margin-bottom:14px"><span class="fsh-search-ico">⌕</span><input id="devSearch" type="search" placeholder="Search devices…" value="${esc(devQ)}"></div>
        <div class="fsh-formula-list" id="devList">${list.map(devCard).join('') || '<p style="color:var(--fsh-mut)">No matches.</p>'}</div></div>`;
      const s = document.getElementById('devSearch'); s.addEventListener('input', () => { devQ = s.value; const l2 = DEVICES.filter((d) => (d[0] + ' ' + d[1]).toLowerCase().includes(devQ.toLowerCase())); document.getElementById('devList').innerHTML = l2.map(devCard).join('') || '<p style="color:var(--fsh-mut)">No matches.</p>'; });
    }

    // ── Grammar reference ────────────────────────────────────────────────────
    const POS = [['Noun', 'Person, place, thing or idea — dog, London, joy'], ['Verb', 'Action or state — run, is, believe'], ['Adjective', 'Describes a noun — bright, tall'], ['Adverb', 'Describes a verb/adj — quickly, very'], ['Pronoun', 'Replaces a noun — she, it, they'], ['Preposition', 'Relation in time/space — on, after, with'], ['Conjunction', 'Joins clauses — and, but, because'], ['Interjection', 'Exclamation — wow, ouch']];
    const COMMAS = ['Separate items in a list (Oxford comma optional).', 'After an introductory phrase: "After lunch, we left."', 'Before a coordinating conjunction joining two independent clauses.', 'Around non-essential information: "My brother, a doctor, called."', 'Do NOT join two sentences with only a comma (comma splice).'];
    function renderGrammar(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 10px;font-size:16px">📘 Parts of speech</h3><div class="fsh-formula-list">${POS.map((p) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(p[0])}</div><div class="nm" style="margin-top:3px;font-size:12px">${esc(p[1])}</div></div>`).join('')}</div>
        <h3 style="margin:18px 0 10px;font-size:16px">✏ Comma rules</h3><div class="fsh-mm-rows">${COMMAS.map((c) => `<div class="fsh-mm-row" style="display:block">${esc(c)}</div>`).join('')}</div></div>`;
    }

    // ── Essay scaffold ───────────────────────────────────────────────────────
    function renderEssay(body) {
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🖊 Essay scaffold</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Draft a thesis, then build PEEL body paragraphs.</p>
        <div class="fsh-ws-controls"><div class="fsh-ws-group"><div class="fsh-label"><span>Topic</span></div><input id="es_topic" class="fsh-input" placeholder="e.g. social media"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Your claim</span></div><input id="es_claim" class="fsh-input" placeholder="does more harm than good"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Reason 1</span></div><input id="es_r1" class="fsh-input"></div>
        <div class="fsh-ws-group"><div class="fsh-label"><span>Reason 2</span></div><input id="es_r2" class="fsh-input"></div></div>
        <div style="margin-top:14px"><button type="button" class="fsh-btn" id="esGo">Build thesis</button></div><div class="fsh-out" id="esOut"></div>
        <h3 style="margin:18px 0 10px;font-size:15px">PEEL paragraph</h3><div class="fsh-mm-rows">${[['Point', 'State the main idea of the paragraph.'], ['Evidence', 'Quote or fact that supports it.'], ['Explain', 'Show how the evidence proves the point.'], ['Link', 'Tie back to the thesis / next idea.']].map((p) => `<div class="fsh-mm-row"><span class="el">${p[0]}</span><span style="text-align:right;max-width:70%">${esc(p[1])}</span></div>`).join('')}</div></div>`;
      document.getElementById('esGo').addEventListener('click', () => {
        const g = (id) => (document.getElementById('es_' + id).value || '').trim();
        const topic = g('topic') || '[topic]', claim = g('claim') || '[claim]', r1 = g('r1'), r2 = g('r2');
        const reasons = [r1, r2].filter(Boolean);
        const because = reasons.length ? ` because ${reasons.join(' and ')}` : '';
        document.getElementById('esOut').innerHTML = `<span class="big" style="font-size:17px;font-weight:600;line-height:1.5">${esc(topic.charAt(0).toUpperCase() + topic.slice(1))} ${esc(claim)}${esc(because)}.</span>`;
      });
    }

    H.register('english', [
      { id: 'cite', name: 'Citations', icon: '❝', desc: 'citation builder mla apa bibliography works cited', render: renderCite },
      { id: 'devices', name: 'Lit devices', icon: '📖', desc: 'literary devices metaphor simile glossary figurative', render: renderDevices, ai: { name: 'literaryDevice', description: 'Define a literary device. Arg: device name.', params: { term: 'string' }, run: (a) => { const d = DEVICES.find((x) => x[0].toLowerCase() === String(a).trim().toLowerCase()); if (!d) throw new Error('Unknown device'); return { term: d[0], definition: d[1], example: d[2] }; } } },
      { id: 'grammar', name: 'Grammar', icon: '📘', desc: 'grammar parts of speech comma rules', render: renderGrammar },
      { id: 'essay', name: 'Essay scaffold', icon: '🖊', desc: 'essay thesis peel paragraph structure writing', render: renderEssay },
    ]);
  }
  boot();
})();
