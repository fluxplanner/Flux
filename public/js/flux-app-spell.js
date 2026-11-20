/* Flux Spell (spell.html). The word is spoken with the browser's own voices
   (speechSynthesis, which works offline), so it is spelled without being
   seen; where there is no voice, a hint with some letters hidden stands in.
   Missed words go to the back of the queue until they are right once. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$;
  T.tabs($('[role="tablist"]'), 'flux_spell_tab');
  var saved = T.load('flux_spell_words', null);
  if (saved) $('#spList').value = saved;
  var q = [], cur = null, right = 0, tries = 0, missed = {};
  var canSpeak = 'speechSynthesis' in window;
  function say(w) {
    if (!canSpeak) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(w); u.rate = 0.85; speechSynthesis.speak(u); } catch (e) { canSpeak = false; }
  }
  function hint(w) { return w.split('').map(function (ch, i) { return i === 0 || i === w.length - 1 || /[^a-z]/i.test(ch) || i % 3 === 0 ? ch : '_'; }).join(' '); }
  function next() {
    cur = q.shift();
    if (!cur) {
      var miss = Object.keys(missed);
      $('#spPrompt').textContent = 'Done: ' + right + ' right first time out of ' + tries + '.';
      $('#spOut').innerHTML = miss.length ? 'Words to practise: <strong>' + T.esc(miss.join(', ')) + '</strong>' : '<span class="ft-good">Every word right.</span>';
      $('#spForm').hidden = true; return;
    }
    $('#spForm').hidden = false;
    $('#spPrompt').textContent = canSpeak ? 'Listen, then type the word.' : 'Hint: ' + hint(cur);
    $('#spAns').value = ''; $('#spAns').focus();
    say(cur);
  }
  $('#spStart').addEventListener('click', function () {
    T.save('flux_spell_words', $('#spList').value);
    q = $('#spList').value.split(/[\n,]+/).map(function (w) { return w.trim(); }).filter(Boolean);
    if (!q.length) { T.toast('Add some words first.'); return; }
    if ($('#spShuffle').checked) q.sort(function () { return Math.random() - 0.5; });
    right = 0; tries = q.length; missed = {};
    $('#spDrill').hidden = false; $('#spOut').innerHTML = '';
    next();
  });
  $('#spSay').addEventListener('click', function () { if (cur) { if (canSpeak) say(cur); else T.toast('This browser has no voice to read with.'); } });
  $('#spHint').addEventListener('click', function () { if (cur) $('#spPrompt').textContent = 'Hint: ' + hint(cur); });
  $('#spForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cur) return;
    var a = $('#spAns').value.trim();
    if (a.toLowerCase() === cur.toLowerCase()) {
      if (!missed[cur]) right++;
      $('#spOut').innerHTML = '<span class="ft-good">Right: ' + T.esc(cur) + '</span>';
      next();
    } else {
      missed[cur] = true; q.push(cur);
      var diff = cur.split('').map(function (ch, i) { return a[i] && a[i].toLowerCase() === ch.toLowerCase() ? T.esc(ch) : '<mark>' + T.esc(ch) + '</mark>'; }).join('');
      $('#spOut').innerHTML = '<span class="ft-err">Not quite.</span> It is spelled <strong>' + diff + '</strong> — the highlighted letters are where yours went wrong. It will come back.';
      next();
    }
  });

  /* Homophones: [sentence with ___, answer, choices, why] */
  var HOMO = [
    ['The students left ___ bags in the hall.', 'their', ['their', 'there', 'they’re'], '“Their” shows something belongs to them.'],
    ['___ going to the museum tomorrow.', 'They’re', ['Their', 'There', 'They’re'], '“They’re” is short for “they are”.'],
    ['Put the books over ___.', 'there', ['their', 'there', 'they’re'], '“There” is a place.'],
    ['___ coat is this?', 'Whose', ['Who’s', 'Whose'], '“Whose” asks who owns it; “who’s” is “who is”.'],
    ['The dog wagged ___ tail.', 'its', ['its', 'it’s'], '“Its” shows belonging; “it’s” is “it is”.'],
    ['___ raining again.', 'It’s', ['Its', 'It’s'], '“It’s” is short for “it is”.'],
    ['I would rather walk ___ wait for the bus.', 'than', ['than', 'then'], '“Than” compares; “then” is about time.'],
    ['Finish the essay, ___ check it.', 'then', ['than', 'then'], '“Then” means next.'],
    ['The new rule will ___ everyone.', 'affect', ['affect', 'effect'], '“Affect” is usually the verb; “effect” the noun.'],
    ['The ___ of the drug was clear.', 'effect', ['affect', 'effect'], '“Effect” is the result, a noun.'],
    ['___ welcome to join us.', 'You’re', ['Your', 'You’re'], '“You’re” is short for “you are”.'],
    ['I want to come ___.', 'too', ['to', 'too', 'two'], '“Too” means also or more than enough.'],
    ['Don’t ___ your keys.', 'lose', ['loose', 'lose'], '“Lose” is to misplace; “loose” means not tight.'],
    ['The principal ___ of the plan is fairness.', 'principle', ['principal', 'principle'], 'A principle is a rule or belief; a principal is a head teacher.'],
    ['She ___ the test easily.', 'passed', ['passed', 'past'], '“Passed” is the verb; “past” is time gone by.'],
    ['Can you ___ the music?', 'hear', ['hear', 'here'], 'You hear with your ear.'],
    ['I bought new writing ___.', 'stationery', ['stationary', 'stationery'], 'Stationery (with an e) is paper and envelopes; stationary means not moving.'],
    ['Please ___ my apology.', 'accept', ['accept', 'except'], '“Accept” means take; “except” means leaving out.'],
  ];
  var ho = null;
  function homo() {
    ho = HOMO[Math.floor(Math.random() * HOMO.length)];
    $('#hoQ').textContent = ho[0];
    $('#hoOpts').innerHTML = ho[2].map(function (o) { return '<button type="button" class="ft-btn" data-o="' + T.esc(o) + '">' + T.esc(o) + '</button>'; }).join('');
    $('#hoOut').innerHTML = '';
  }
  $('#hoOpts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-o]'); if (!b) return;
    var ok = b.getAttribute('data-o') === ho[1];
    $('#hoOut').innerHTML = (ok ? '<span class="ft-good">Right.</span> ' : '<span class="ft-err">Not this time — it is “' + T.esc(ho[1]) + '”.</span> ') + T.esc(ho[3]);
  });
  $('#hoNext').addEventListener('click', homo);

  /* Punctuation: the right sentence first in each set; shown shuffled. */
  var PUNC = [
    [['It’s a long walk, so bring water.', 'Its a long walk so bring water.', 'It’s a long walk so, bring water.'], 'A comma before “so” joining two full sentences; it’s = it is.'],
    [['The girls’ changing room is closed.', 'The girl’s changing room is closed.', 'The girls changing room is closed.'], 'Plural owners ending in s take the apostrophe after the s.'],
    [['I need three things: a pen, a ruler and a calculator.', 'I need three things; a pen, a ruler and a calculator.', 'I need: three things a pen, a ruler and a calculator.'], 'A colon introduces a list after a complete sentence.'],
    [['I studied hard; the test was still difficult.', 'I studied hard, the test was still difficult.', 'I studied hard the test was still difficult.'], 'Two full sentences need a semicolon or a full stop, not just a comma.'],
    [['“Where are you going?” asked Sam.', '“Where are you going”? asked Sam.', '“Where are you going?” Asked Sam.'], 'The question mark goes inside the speech marks, and “asked” stays lower case.'],
    [['My brother, who lives in Paris, is visiting.', 'My brother who lives in Paris, is visiting.', 'My brother, who lives in Paris is visiting.'], 'Extra information is closed off with a pair of commas.'],
    [['However, the results were unclear.', 'However the results were unclear.', 'However; the results were unclear.'], 'A comma follows an opening “However”.'],
  ];
  var pu = null;
  function punc() {
    pu = PUNC[Math.floor(Math.random() * PUNC.length)];
    var opts = pu[0].map(function (s, i) { return { s: s, ok: i === 0 }; }).sort(function () { return Math.random() - 0.5; });
    $('#puOpts').innerHTML = opts.map(function (o) { return '<button type="button" class="ft-btn" style="display:flex;width:100%;justify-content:flex-start;text-align:left;margin-bottom:8px;height:auto;padding:10px 14px" data-ok="' + (o.ok ? 1 : 0) + '">' + T.esc(o.s) + '</button>'; }).join('');
    $('#puOut').innerHTML = '';
  }
  $('#puOpts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ok]'); if (!b) return;
    $('#puOut').innerHTML = (b.getAttribute('data-ok') === '1' ? '<span class="ft-good">Right.</span> ' : '<span class="ft-err">Not that one.</span> The right one is “' + T.esc(pu[0][0]) + '” ') + T.esc(pu[1]);
  });
  $('#puNext').addEventListener('click', punc);
  homo(); punc();
})();
