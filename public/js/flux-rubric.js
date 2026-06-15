/**
 * flux-rubric.js — Teacher Agent: grade a draft against a rubric before you submit.
 *
 * Paste (or upload PDF/image of) a rubric + your draft. Flux acts as the teacher,
 * scores each criterion, lists exactly what's missing, and gives a submission-
 * readiness %. Honest framing: it's a *predicted* score to guide revision, not a
 * guaranteed grade.
 *
 * Reuses: fluxAiSimple (AI, JSON mode), pdf.js (lazy), the ai-proxy vision path
 * for image OCR, showToast.
 *
 * window.FluxRubric = { open, close }
 */
(function () {
  'use strict';

  var MAX_CHARS = 16000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, k) { try { if (typeof showToast === 'function') showToast(m, k || 'info'); } catch (e) {} }

  /* ── file → text helpers (PDF text, image OCR via vision) ── */
  var PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var _pdfP = null;
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfP) return _pdfP;
    _pdfP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = PDFJS_SRC;
      s.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (e) {} res(window.pdfjsLib); };
      s.onerror = function () { rej(new Error('Could not load the PDF reader.')); };
      document.head.appendChild(s);
    });
    return _pdfP;
  }
  function readBuf(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('read failed')); }; r.readAsArrayBuffer(f); }); }
  function readURL(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('read failed')); }; r.readAsDataURL(f); }); }

  function pdfText(file) {
    return loadPdf().then(function (lib) {
      return readBuf(file).then(function (buf) {
        return lib.getDocument({ data: buf }).promise.then(function (pdf) {
          var n = Math.min(pdf.numPages, 40), chain = Promise.resolve('');
          for (var i = 1; i <= n; i++) (function (p) {
            chain = chain.then(function (acc) {
              if (acc.length >= MAX_CHARS) return acc;
              return pdf.getPage(p).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
                return acc + '\n' + tc.items.map(function (it) { return it.str; }).join(' ');
              });
            });
          })(i);
          return chain.then(function (t) { return t.trim(); });
        });
      });
    });
  }
  function imageText(file) {
    return readURL(file).then(function (url) {
      var m = /^data:([^;]+);base64,(.+)$/.exec(url || '');
      if (!m) throw new Error('Unsupported image.');
      var API = window.API; if (!API || !API.ai || typeof window.fluxAuthHeaders !== 'function') throw new Error('Sign in to read images.');
      return window.fluxAuthHeaders().then(function (h) {
        return fetch(API.ai, { method: 'POST', headers: h, body: JSON.stringify({
          system: 'Transcribe ALL text in this image exactly. Output only the text.',
          messages: [{ role: 'user', content: 'Transcribe.' }], imageBase64: m[2], mimeType: m[1],
        }) }).then(function (r) { return r.json(); }).then(function (d) { return d && d.content && d.content[0] && d.content[0].text || ''; });
      });
    });
  }
  function fileToText(file) {
    if (!file) return Promise.resolve('');
    var name = (file.name || '').toLowerCase();
    if (/\.pdf$/.test(name) || file.type === 'application/pdf') return pdfText(file);
    if (/^image\//.test(file.type)) return imageText(file);
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result || '')); }; r.onerror = function () { rej(new Error('read failed')); }; r.readAsText(file); });
  }

  /* ── grading ── */
  function grade(rubric, draft) {
    if (typeof fluxAiSimple !== 'function') return Promise.reject(new Error('Flux AI is not loaded yet.'));
    var sys = 'You are an exacting but fair teacher grading a student draft against a rubric. ' +
      'Score each rubric criterion out of its stated points (infer reasonable points if unstated). ' +
      'Be specific about what is missing. Respond ONLY with JSON: ' +
      '{"predictedScore":num,"max":num,"percent":num,"readiness":num(0-100),"summary":"1-2 sentences",' +
      '"perCriterion":[{"name":"...","score":num,"max":num,"met":bool,"gap":"what to add/fix, or empty if met"}],' +
      '"topFixes":["highest-leverage fix",...]}';
    var user = 'RUBRIC:\n' + rubric.slice(0, MAX_CHARS) + '\n\n---\n\nSTUDENT DRAFT:\n' + draft.slice(0, MAX_CHARS) + '\n\nGrade now as json.';
    return fluxAiSimple(sys, user, { responseFormat: 'json_object' }).then(function (out) {
      var j; try { j = JSON.parse(out); } catch (e) { throw new Error('Could not parse the grade — try again.'); }
      return j;
    });
  }

  /* ── UI ── */
  function open() {
    close();
    var ov = document.createElement('div');
    ov.id = 'frbOverlay';
    ov.innerHTML =
      '<div class="frb" role="dialog" aria-label="Grade against rubric">' +
        '<div class="frb-head"><div class="frb-title"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Grade my draft</div>' +
          '<button class="frb-x" id="frbClose" aria-label="Close">✕</button></div>' +
        '<div class="frb-body" id="frbBody">' +
          '<div class="frb-cols">' +
            '<label class="frb-field"><span>Rubric <button type="button" class="frb-up" data-up="rubric">＋ file</button></span>' +
              '<textarea id="frbRubric" rows="9" placeholder="Paste the rubric (or upload a PDF / photo of it)…"></textarea></label>' +
            '<label class="frb-field"><span>Your draft <button type="button" class="frb-up" data-up="draft">＋ file</button></span>' +
              '<textarea id="frbDraft" rows="9" placeholder="Paste your essay / assignment draft (or upload it)…"></textarea></label>' +
          '</div>' +
          '<div class="frb-actions"><span class="frb-note" id="frbNote">Predicted score is a revision guide, not a guaranteed grade.</span>' +
            '<button class="frb-btn" id="frbGo">Grade it</button></div>' +
        '</div>' +
        '<input type="file" id="frbFile" accept=".pdf,.txt,image/*" hidden>' +
      '</div>';
    document.body.appendChild(ov);
    var pendingTarget = null;
    var fileInput = ov.querySelector('#frbFile');
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.id === 'frbClose') return close();
      var up = e.target.closest('[data-up]');
      if (up) { pendingTarget = up.getAttribute('data-up'); fileInput.click(); return; }
      if (e.target.id === 'frbGo') return run();
    });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0]; if (!f || !pendingTarget) return;
      var note = ov.querySelector('#frbNote'); if (note) note.textContent = 'Reading ' + f.name + '…';
      fileToText(f).then(function (txt) {
        var el = ov.querySelector(pendingTarget === 'rubric' ? '#frbRubric' : '#frbDraft');
        if (el) el.value = txt;
        if (note) note.textContent = 'Loaded ' + f.name;
      }).catch(function (err) { toast(err.message || 'Could not read file', 'error'); })
        .then(function () { fileInput.value = ''; });
    });
    document.addEventListener('keydown', escClose);

    function run() {
      var rubric = (ov.querySelector('#frbRubric').value || '').trim();
      var draft = (ov.querySelector('#frbDraft').value || '').trim();
      if (!rubric || !draft) { toast('Add both a rubric and a draft.', 'warning'); return; }
      var body = ov.querySelector('#frbBody');
      body.innerHTML = '<div class="frb-loading"><div class="frb-spin"></div>Grading against the rubric…</div>';
      grade(rubric, draft).then(function (j) { renderScore(body, j); })
        .catch(function (err) { body.innerHTML = '<div class="frb-err">' + esc(err.message) + '</div><button class="frb-btn" onclick="FluxRubric.open()">Try again</button>'; });
    }
  }

  function renderScore(body, j) {
    var pct = j.percent != null ? Math.round(j.percent) : (j.max ? Math.round((j.predictedScore / j.max) * 100) : null);
    var ready = j.readiness != null ? Math.round(j.readiness) : pct;
    var crit = Array.isArray(j.perCriterion) ? j.perCriterion : [];
    var fixes = Array.isArray(j.topFixes) ? j.topFixes : [];
    body.innerHTML =
      '<div class="frb-score">' +
        '<div class="frb-score-big">' + (pct != null ? pct + '%' : (j.predictedScore != null ? j.predictedScore + '/' + (j.max || '?') : '—')) +
          '<span class="frb-score-sub">predicted' + (j.max != null && j.predictedScore != null ? ' · ' + j.predictedScore + '/' + j.max : '') + '</span></div>' +
        '<div class="frb-ready"><div class="frb-ready-label">Submission readiness</div>' +
          '<div class="frb-ready-bar"><div class="frb-ready-fill" style="width:' + (ready || 0) + '%"></div></div>' +
          '<div class="frb-ready-pct">' + (ready != null ? ready + '%' : '—') + '</div></div>' +
      '</div>' +
      (j.summary ? '<div class="frb-summary">' + esc(j.summary) + '</div>' : '') +
      (crit.length ? '<div class="frb-crit-head">Per-criterion</div>' + crit.map(critRow).join('') : '') +
      (fixes.length ? '<div class="frb-fixes"><div class="frb-crit-head">Fix these first</div><ol>' + fixes.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol></div>' : '') +
      '<div class="frb-actions"><span class="frb-note">Revision guide — your teacher\'s grade may differ.</span><button class="frb-btn frb-btn--ghost" onclick="FluxRubric.open()">Grade another</button></div>';
  }
  function critRow(c) {
    var max = c.max || 0, score = c.score || 0;
    var w = max ? Math.round((score / max) * 100) : (c.met ? 100 : 0);
    return '<div class="frb-crit' + (c.met ? ' met' : '') + '">' +
      '<div class="frb-crit-top"><span class="frb-crit-name">' + esc(c.name || 'Criterion') + '</span>' +
        '<span class="frb-crit-score">' + score + (max ? '/' + max : '') + '</span></div>' +
      '<div class="frb-crit-bar"><div class="frb-crit-fill" style="width:' + w + '%"></div></div>' +
      (c.gap && !c.met ? '<div class="frb-crit-gap">' + esc(c.gap) + '</div>' : '') + '</div>';
  }

  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() { var o = document.getElementById('frbOverlay'); if (o) o.remove(); document.removeEventListener('keydown', escClose); }

  window.FluxRubric = { open: open, close: close };
})();
