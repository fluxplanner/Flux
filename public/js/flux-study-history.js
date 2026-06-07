/* ============================================================================
   FLUX STUDY HUB · History & Geography module (Pass 4)
   Bespoke native tools: timeline builder, capitals quiz, eras reference.
   Registers with fluxStudyHub.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;
    const yrLabel = (y) => (y < 0 ? Math.abs(y) + ' BCE' : y + ' CE');

    // ── Timeline builder ─────────────────────────────────────────────────────
    const TL_KEY = 'flux_study_timeline';
    const loadTL = () => { try { return JSON.parse(localStorage.getItem(TL_KEY)) || []; } catch (e) { return []; } };
    const saveTL = (a) => { try { localStorage.setItem(TL_KEY, JSON.stringify(a)); } catch (e) {} };
    function renderTimeline(body) {
      let evs = loadTL();
      if (!evs.length) evs = [{ year: -3100, text: 'Writing invented (Mesopotamia)' }, { year: 776, text: 'First Olympic Games' }, { year: 1492, text: 'Columbus reaches the Americas' }, { year: 1789, text: 'French Revolution begins' }, { year: 1969, text: 'Apollo 11 Moon landing' }];
      function draw() {
        evs.sort((a, b) => a.year - b.year);
        const rows = evs.map((e, i) => `<div class="fsh-ws-q"><span class="num" style="width:auto;padding:0 8px;border-radius:9px">${esc(yrLabel(e.year))}</span><span class="eq" style="flex:1">${esc(e.text)}</span><button type="button" class="fsh-iconbtn" data-del="${i}" style="width:30px;height:30px;font-size:14px" aria-label="Delete">✕</button></div>`).join('');
        document.getElementById('tlList').innerHTML = rows || '<p style="color:var(--fsh-mut)">No events yet.</p>';
        document.querySelectorAll('#tlList [data-del]').forEach((b) => b.addEventListener('click', () => { evs.splice(+b.dataset.del, 1); saveTL(evs); draw(); }));
      }
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🕰 Timeline builder</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Add events (negative year = BCE). Auto-sorts &amp; saves.</p>
        <div class="fsh-field"><input id="tlYear" class="fsh-input short" placeholder="Year" type="number"><input id="tlText" class="fsh-input" placeholder="Event description" spellcheck="false"><button type="button" class="fsh-btn" id="tlAdd">Add</button></div>
        <div class="fsh-ws-preview" id="tlList" style="margin-top:16px"></div></div>`;
      document.getElementById('tlAdd').addEventListener('click', () => { const y = parseInt(document.getElementById('tlYear').value, 10); const t = document.getElementById('tlText').value.trim(); if (isNaN(y) || !t) return; evs.push({ year: y, text: t }); saveTL(evs); document.getElementById('tlText').value = ''; document.getElementById('tlYear').value = ''; draw(); });
      draw();
    }

    // ── Capitals quiz ────────────────────────────────────────────────────────
    const CAPS = { France: 'Paris', Germany: 'Berlin', Spain: 'Madrid', Italy: 'Rome', 'United Kingdom': 'London', Japan: 'Tokyo', China: 'Beijing', India: 'New Delhi', USA: 'Washington, D.C.', Canada: 'Ottawa', Brazil: 'Brasília', Russia: 'Moscow', Australia: 'Canberra', Egypt: 'Cairo', 'South Africa': 'Pretoria', Mexico: 'Mexico City', Argentina: 'Buenos Aires', Greece: 'Athens', Turkey: 'Ankara', Sweden: 'Stockholm', Norway: 'Oslo', Netherlands: 'Amsterdam', Portugal: 'Lisbon', Poland: 'Warsaw', Kenya: 'Nairobi', Nigeria: 'Abuja', 'South Korea': 'Seoul', Thailand: 'Bangkok', 'Saudi Arabia': 'Riyadh', Indonesia: 'Jakarta', Vietnam: 'Hanoi', Peru: 'Lima' };
    let quizScore = 0, quizTotal = 0, quizCountry = null;
    function newQuestion() { const keys = Object.keys(CAPS); quizCountry = keys[Math.floor(Math.random() * keys.length)]; const correct = CAPS[quizCountry]; const opts = [correct]; const all = Object.values(CAPS); while (opts.length < 4) { const c = all[Math.floor(Math.random() * all.length)]; if (opts.indexOf(c) === -1) opts.push(c); } for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; } return opts; }
    function renderQuiz(body) {
      function ask() {
        const opts = newQuestion();
        body.querySelector('#qzQ').textContent = 'What is the capital of ' + quizCountry + '?';
        body.querySelector('#qzOpts').innerHTML = opts.map((o) => `<button type="button" class="fsh-btn ghost" data-opt="${esc(o)}" style="display:block;width:100%;text-align:left;margin-bottom:8px">${esc(o)}</button>`).join('');
        body.querySelectorAll('#qzOpts [data-opt]').forEach((b) => b.addEventListener('click', () => {
          quizTotal++; const right = b.dataset.opt === CAPS[quizCountry]; if (right) quizScore++;
          b.style.background = right ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)';
          if (!right) { const c = body.querySelector(`#qzOpts [data-opt="${CSS.escape(CAPS[quizCountry])}"]`); if (c) c.style.background = 'rgba(52,211,153,.25)'; }
          body.querySelector('#qzScore').textContent = `${quizScore} / ${quizTotal}`;
          body.querySelectorAll('#qzOpts [data-opt]').forEach((x) => { x.disabled = true; });
          setTimeout(ask, 900);
        }));
      }
      body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">🗺 Capitals quiz</h3><p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">Pick the right capital. Score: <b id="qzScore">${quizScore} / ${quizTotal}</b></p>
        <div class="fsh-out" style="margin:0 0 12px"><span class="big" style="font-size:18px" id="qzQ"></span></div><div id="qzOpts"></div></div>`;
      ask();
    }

    // ── Eras reference ───────────────────────────────────────────────────────
    const ERAS = [['Prehistory', 'before ~3000 BCE', 'Before written records'], ['Ancient', '3000–800 BCE', 'Mesopotamia, Egypt, early empires'], ['Classical', '800 BCE–500 CE', 'Greece, Rome, Han China'], ['Medieval', '500–1500', 'Feudalism, Islamic Golden Age'], ['Renaissance', '1300–1600', 'Art, science, humanism'], ['Early Modern', '1500–1800', 'Exploration, Reformation, Enlightenment'], ['Industrial', '1760–1900', 'Industrial Revolution, empires'], ['Modern', '1900–1945', 'World Wars, rapid change'], ['Contemporary', '1945–present', 'Cold War, digital age']];
    function renderEras(body) { body.innerHTML = `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 12px;font-size:16px">📜 Historical eras</h3><div class="fsh-formula-list">${ERAS.map((e) => `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(e[0])}</div><div class="nm" style="margin-top:3px">${esc(e[1])}</div><div class="nm" style="color:var(--fsh-ink-2)">${esc(e[2])}</div></div>`).join('')}</div></div>`; }

    H.register('history', [
      { id: 'timeline', name: 'Timeline', icon: '🕰', desc: 'timeline builder events history dates', render: renderTimeline },
      { id: 'capitals', name: 'Capitals quiz', icon: '🗺', desc: 'geography capitals quiz countries map', render: renderQuiz, ai: { name: 'capital', description: 'Capital city of a country. Arg: country name.', params: { country: 'string' }, run: (a) => { const k = Object.keys(CAPS).find((c) => c.toLowerCase() === String(a).trim().toLowerCase()); if (!k) throw new Error('Unknown country'); return CAPS[k]; } } },
      { id: 'eras', name: 'Eras', icon: '📜', desc: 'historical eras periods timeline reference', render: renderEras },
    ]);
  }
  boot();
})();
