/* ============================================================================
   FLUX TRANSLATE  ·  flux-translator.js
   Type or paste text, pick two languages, get a translation you can copy or
   hear read aloud.

   Two engines, tried in order:
   1. The browser's own Translator (Chrome on Chromebooks and desktops). It
      runs on the device, so the text never leaves the computer.
   2. MyMemory (api.mymemory.translated.net), free and keyless, for Safari,
      Firefox and phones. The text is sent to translated.net, and the page
      says so under every result it produces.

   No account, no bundles: it stands alone like flashcards.html. Settings and
   the last few translations live in this browser only.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'flux_translate_v1';
  var MAX = 5000;
  var HISTORY = 12;
  /* MyMemory refuses a q over 500 bytes; split under that at sentence ends. */
  var CHUNK = 450;

  var LANGS = [
    ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'],
    ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['zh', 'Chinese'],
    ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'], ['hi', 'Hindi'],
    ['ur', 'Urdu'], ['bn', 'Bengali'], ['ru', 'Russian'], ['tr', 'Turkish'],
    ['pl', 'Polish'], ['uk', 'Ukrainian'], ['vi', 'Vietnamese'], ['th', 'Thai'],
    ['id', 'Indonesian'], ['ms', 'Malay'], ['tl', 'Filipino'], ['sw', 'Swahili'],
    ['he', 'Hebrew'], ['el', 'Greek'], ['sv', 'Swedish'], ['da', 'Danish'],
    ['no', 'Norwegian'], ['fi', 'Finnish'], ['cs', 'Czech'], ['ro', 'Romanian'],
    ['hu', 'Hungarian'], ['fa', 'Persian'], ['la', 'Latin'],
  ];
  var nameOf = function (code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return LANGS[i][1];
    return code;
  };

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') return { from: s.from || 'en', to: s.to || 'es', history: Array.isArray(s.history) ? s.history : [] };
    } catch (e) {}
    return { from: 'en', to: 'es', history: [] };
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ── Engines ─────────────────────────────────────────────────────────── */
  var onDevice = {};
  function deviceTranslator(from, to) {
    if (!('Translator' in self)) return Promise.resolve(null);
    var k = from + '>' + to;
    if (onDevice[k]) return onDevice[k];
    var opts = { sourceLanguage: from, targetLanguage: to };
    onDevice[k] = self.Translator.availability(opts).then(function (a) {
      return a === 'unavailable' ? null : self.Translator.create(opts);
    }).catch(function () { return null; });
    onDevice[k].then(function (t) { if (!t) delete onDevice[k]; });
    return onDevice[k];
  }

  function chunks(text) {
    var out = [];
    var parts = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [text];
    var cur = '';
    parts.forEach(function (p) {
      while (p.length > CHUNK) { if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, CHUNK)); p = p.slice(CHUNK); }
      if ((cur + p).length > CHUNK) { out.push(cur); cur = ''; }
      cur += p;
    });
    if (cur) out.push(cur);
    return out;
  }

  function online(text, from, to) {
    var pieces = chunks(text);
    var done = [];
    var next = function (i) {
      if (i >= pieces.length) return Promise.resolve(done.join(''));
      var piece = pieces[i];
      if (!piece.trim()) { done.push(piece); return next(i + 1); }
      var lead = piece.match(/^\s*/)[0], trail = piece.match(/\s*$/)[0];
      var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(piece.trim()) + '&langpair=' + from + '|' + to;
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('net');
        return r.json();
      }).then(function (d) {
        if (d && d.quotaFinished) throw new Error('quota');
        var t = d && d.responseData && d.responseData.translatedText;
        if (!t || Number(d.responseStatus) !== 200) throw new Error('net');
        done.push(lead + t + trail);
        return next(i + 1);
      });
    };
    return next(0);
  }

  function translate(text, from, to) {
    return deviceTranslator(from, to).then(function (t) {
      if (t) return t.translate(text).then(function (out) { return { text: out, how: 'device' }; });
      return online(text, from, to).then(function (out) { return { text: out, how: 'online' }; });
    });
  }

  /* ── Read aloud (as in Flux Flashcards) ──────────────────────────────── */
  var canSpeak = 'speechSynthesis' in self;
  function speak(text, lang) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      var v = speechSynthesis.getVoices().filter(function (x) { return x.lang && x.lang.slice(0, 2) === lang; })[0];
      if (v) u.voice = v;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ── Page ────────────────────────────────────────────────────────────── */
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var options = function (sel) {
    return LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === sel ? ' selected' : '') + '>' + esc(l[1]) + '</option>'; }).join('');
  };

  function mount(host) {
    var state = load();
    host.innerHTML =
      '<div class="ft-bar">'
      + '<label class="ft-lang"><span class="ft-sr">From</span><select id="ftFrom" aria-label="Translate from">' + options(state.from) + '</select></label>'
      + '<button type="button" class="ft-swap" id="ftSwap" aria-label="Swap languages" title="Swap languages">⇄</button>'
      + '<label class="ft-lang"><span class="ft-sr">To</span><select id="ftTo" aria-label="Translate to">' + options(state.to) + '</select></label>'
      + '</div>'
      + '<div class="ft-panes">'
      + '<div class="ft-pane">'
      + '<textarea id="ftIn" maxlength="' + MAX + '" placeholder="Type or paste text to translate" aria-label="Text to translate"></textarea>'
      + '<div class="ft-foot"><span class="ft-count" id="ftCount">0 / ' + MAX + '</span><span class="grow"></span>'
      + (canSpeak ? '<button type="button" class="ft-btn ft-ghost" id="ftSpeakIn">Listen</button>' : '')
      + '<button type="button" class="ft-btn ft-ghost" id="ftClear">Clear</button>'
      + '<button type="button" class="ft-btn ft-go" id="ftGo">Translate</button></div>'
      + '</div>'
      + '<div class="ft-pane ft-pane--out">'
      + '<div id="ftOut" class="ft-out" aria-live="polite"><span class="ft-hint">Your translation shows here.</span></div>'
      + '<div class="ft-foot"><span class="ft-how" id="ftHow"></span><span class="grow"></span>'
      + (canSpeak ? '<button type="button" class="ft-btn ft-ghost" id="ftSpeakOut" disabled>Listen</button>' : '')
      + '<button type="button" class="ft-btn ft-ghost" id="ftCopy" disabled>Copy</button></div>'
      + '</div>'
      + '</div>'
      + '<p class="ft-tip">Tip: press Ctrl + Enter (⌘ + Enter on a Mac) to translate. Check important work with your teacher: machine translation can miss tone and idioms.</p>'
      + '<section class="ft-history" id="ftHistory" aria-label="Recent translations"></section>';

    var $ = function (id) { return host.querySelector('#' + id); };
    var input = $('ftIn'), out = $('ftOut'), how = $('ftHow'), go = $('ftGo');
    var from = $('ftFrom'), to = $('ftTo'), copy = $('ftCopy'), speakOut = $('ftSpeakOut');
    var result = '';
    var busy = 0;

    function setResult(text, note) {
      result = text || '';
      out.textContent = result;
      if (!result) out.innerHTML = '<span class="ft-hint">Your translation shows here.</span>';
      how.textContent = note || '';
      copy.disabled = !result;
      if (speakOut) speakOut.disabled = !result;
    }
    function remember() {
      state.from = from.value; state.to = to.value; save(state);
    }
    function drawHistory() {
      var h = $('ftHistory');
      if (!state.history.length) { h.innerHTML = ''; return; }
      h.innerHTML = '<div class="ft-history-head"><h2>Recent</h2><button type="button" class="ft-btn ft-ghost" id="ftForget">Clear recent</button></div>'
        + state.history.map(function (e, i) {
          return '<button type="button" class="ft-item" data-i="' + i + '">'
            + '<span class="ft-item-langs">' + esc(nameOf(e.from)) + ' → ' + esc(nameOf(e.to)) + '</span>'
            + '<span class="ft-item-src">' + esc(e.src.slice(0, 140)) + '</span>'
            + '<span class="ft-item-out">' + esc(e.out.slice(0, 140)) + '</span></button>';
        }).join('');
    }

    function run() {
      var text = input.value.trim();
      if (!text) { input.focus(); return; }
      if (from.value === to.value) { setResult(text, 'Both languages are the same.'); return; }
      var ticket = ++busy;
      var f = from.value, t = to.value;
      go.disabled = true; go.textContent = 'Translating…';
      out.innerHTML = '<span class="ft-hint">Translating…</span>';
      translate(text, f, t).then(function (r) {
        if (ticket !== busy) return;
        setResult(r.text, r.how === 'device'
          ? 'Translated on this device. Your text stayed on this computer.'
          : 'Translated by MyMemory. Your text was sent to translated.net.');
        state.history = [{ from: f, to: t, src: text.slice(0, 600), out: r.text.slice(0, 600) }]
          .concat(state.history.filter(function (e) { return !(e.src === text.slice(0, 600) && e.to === t); }))
          .slice(0, HISTORY);
        save(state); drawHistory();
      }).catch(function (e) {
        if (ticket !== busy) return;
        setResult('', e && e.message === 'quota'
          ? 'The free online translator has reached today’s limit for this network. Try again tomorrow, or use Chrome, which translates on the device.'
          : 'Could not translate. Check your internet connection and try again.');
      }).then(function () {
        if (ticket !== busy) return;
        go.disabled = false; go.textContent = 'Translate';
      });
    }

    input.addEventListener('input', function () { $('ftCount').textContent = input.value.length + ' / ' + MAX; });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });
    go.addEventListener('click', run);
    from.addEventListener('change', remember);
    to.addEventListener('change', remember);
    $('ftSwap').addEventListener('click', function () {
      var f = from.value; from.value = to.value; to.value = f; remember();
      if (result) { input.value = result; input.dispatchEvent(new Event('input')); setResult(''); }
    });
    $('ftClear').addEventListener('click', function () {
      input.value = ''; input.dispatchEvent(new Event('input')); setResult(''); input.focus();
    });
    copy.addEventListener('click', function () {
      if (!result || !navigator.clipboard) return;
      navigator.clipboard.writeText(result).then(function () {
        copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1400);
      }).catch(function () {});
    });
    if ($('ftSpeakIn')) $('ftSpeakIn').addEventListener('click', function () { speak(input.value.trim(), from.value); });
    if (speakOut) speakOut.addEventListener('click', function () { speak(result, to.value); });
    $('ftHistory').addEventListener('click', function (e) {
      if (e.target.closest('#ftForget')) { state.history = []; save(state); drawHistory(); return; }
      var b = e.target.closest('.ft-item');
      if (!b) return;
      var h = state.history[+b.getAttribute('data-i')];
      if (!h) return;
      from.value = h.from; to.value = h.to; remember();
      input.value = h.src; input.dispatchEvent(new Event('input'));
      setResult(h.out, 'From your recent translations.');
    });

    drawHistory();
    return { run: run };
  }

  window.FluxTranslator = { mount: mount, chunks: chunks, LANGS: LANGS };
})();
