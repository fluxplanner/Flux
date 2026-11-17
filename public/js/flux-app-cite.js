/* Flux Cite (cite.html): citations built here from what the student types.
   Nothing is looked up online — the page promises to work offline — so
   "Quick fill" only sorts a pasted DOI, ISBN or address into its box.
   Italics are written *like this* inside the formatter, then drawn as <i>
   for the page and dropped for plain-text copies. */
(function () {
  'use strict';
  var T = window.FluxTool, $ = T.$, $$ = T.$$;
  var KEY = 'flux_cite_v1';
  var list = T.load(KEY, []);
  var F = ['Type', 'Style', 'Authors', 'Title', 'Container', 'Publisher', 'Year', 'Date', 'Vol', 'Issue', 'Pages', 'Url', 'Doi', 'Isbn', 'Accessed'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function read() { var o = {}; F.forEach(function (k) { o[k.toLowerCase()] = $('#ci' + k).value.trim(); }); return o; }
  function people(s) {
    return String(s.authors || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.indexOf(',') >= 0 ? l.split(',') : (function () { var w = l.split(/\s+/); return [w.pop(), w.join(' ')]; })();
      return { last: p[0].trim(), first: (p[1] || '').trim() };
    });
  }
  var initials = function (f) { return f.split(/[\s-]+/).filter(Boolean).map(function (n) { return n[0].toUpperCase() + '.'; }).join(' '); };
  function authors(a, style) {
    if (!a.length) return '';
    if (style === 'mla') {
      if (a.length === 1) return a[0].last + (a[0].first ? ', ' + a[0].first : '');
      if (a.length === 2) return a[0].last + ', ' + a[0].first + ', and ' + (a[1].first ? a[1].first + ' ' : '') + a[1].last;
      return a[0].last + ', ' + a[0].first + ', et al';
    }
    if (style === 'apa') {
      var x = a.slice(0, 20).map(function (p) { return p.last + (p.first ? ', ' + initials(p.first) : ''); });
      return x.length === 1 ? x[0] : x.slice(0, -1).join(', ') + ', & ' + x[x.length - 1];
    }
    if (style === 'chicago') {
      var y = a.map(function (p, i) { return i === 0 ? p.last + (p.first ? ', ' + p.first : '') : (p.first ? p.first + ' ' : '') + p.last; });
      return y.length === 1 ? y[0] : y.slice(0, -1).join(', ') + ', and ' + y[y.length - 1];
    }
    var z = a.map(function (p) { return p.last + (p.first ? ', ' + initials(p.first) : ''); });
    return z.length === 1 ? z[0] : z.slice(0, -1).join(', ') + ' and ' + z[z.length - 1];
  }
  var end = function (s) { return s && !/[.?!]$/.test(s) ? s + '.' : s; };
  var join = function (parts, sep) { return parts.filter(Boolean).join(sep == null ? ' ' : sep); };
  function accessed(s, style) {
    if (!s.accessed) return '';
    var d = new Date(s.accessed + 'T12:00:00');
    return style === 'mla' ? d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + '. ' + d.getFullYear() : d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  var doiUrl = function (d) { return d ? (/^https?:/.test(d) ? d : 'https://doi.org/' + d.replace(/^doi:\s*/i, '')) : ''; };

  function format(s) {
    var a = people(s), st = s.style, A = authors(a, st), y = s.year || 'n.d.';
    var t = s.title || 'Untitled';
    if (st === 'mla') {
      if (s.type === 'book') return join([end(A), end('*' + t + '*'), join([s.publisher, s.year], ', ') + '.']);
      if (s.type === 'journal') return join([end(A), '“' + end(t) + '”', join(['*' + (s.container || '') + '*', s.vol && 'vol. ' + s.vol, s.issue && 'no. ' + s.issue, s.year, s.pages && 'pp. ' + s.pages, s.doi ? doiUrl(s.doi) : s.url], ', ') + '.']);
      return join([end(A), '“' + end(t) + '”', join([s.container && '*' + s.container + '*', s.publisher, join([s.date, s.year]), s.url], ', ') + '.', s.accessed && 'Accessed ' + accessed(s, st) + '.']);
    }
    if (st === 'apa') {
      var who = A || t;
      if (s.type === 'book') return join([end(who), '(' + y + ').', A ? end('*' + t + '*') : '', end(s.publisher)]);
      if (s.type === 'journal') return join([end(who), '(' + y + ').', A ? end(t) : '', join(['*' + (s.container || '') + '*', s.vol && ('*' + s.vol + '*' + (s.issue ? '(' + s.issue + ')' : '')), s.pages], ', ') + '.', s.doi ? doiUrl(s.doi) : s.url]);
      return join([end(who), '(' + y + (s.date ? ', ' + s.date : '') + ').', A ? end('*' + t + '*') : '', end(s.container), s.url]);
    }
    if (st === 'chicago') {
      if (s.type === 'book') return join([end(A), end('*' + t + '*'), join([s.publisher, s.year], ', ') + '.']);
      if (s.type === 'journal') return join([end(A), '“' + end(t) + '”', '*' + (s.container || '') + '*', join([s.vol, s.issue && 'no. ' + s.issue]), '(' + y + ')' + (s.pages ? ': ' + s.pages : '') + '.', end(s.doi ? doiUrl(s.doi) : s.url)]);
      return join([end(A), '“' + end(t) + '”', end(s.container), end(join([s.date, s.year], ', ')), end(s.url)]);
    }
    if (s.type === 'book') return join([A, '(' + y + ')', end('*' + t + '*'), end(s.publisher)]);
    if (s.type === 'journal') return join([A, '(' + y + ')', '‘' + t + '’,', join(['*' + (s.container || '') + '*', s.vol && s.vol + (s.issue ? '(' + s.issue + ')' : ''), s.pages && 'pp. ' + s.pages], ', ') + '.', s.doi && 'doi: ' + s.doi.replace(/^doi:\s*/i, '') + '.']);
    return join([A || '', '(' + y + ')', end('*' + t + '*'), s.url && 'Available at: ' + s.url, s.accessed && '(Accessed: ' + accessed(s, st) + ').']);
  }
  function intext(s) {
    var a = people(s), y = s.year || 'n.d.';
    var who = !a.length ? '“' + (s.title || 'Untitled').split(/\s+/).slice(0, 4).join(' ') + '”'
      : a.length === 1 ? a[0].last : a.length === 2 ? a[0].last + (s.style === 'apa' ? ' & ' : ' and ') + a[1].last : a[0].last + ' et al.';
    if (s.style === 'mla') return '(' + who + (s.pages ? ' ' + s.pages.split(/[–-]/)[0] : '') + ')';
    if (s.style === 'chicago') return '(' + who + ' ' + y + (s.pages ? ', ' + s.pages : '') + ')';
    return '(' + who + ', ' + y + (s.pages ? ', p. ' + s.pages.split(/[–-]/)[0] : '') + ')';
  }
  var html = function (c) { return T.esc(c).replace(/\*([^*]+)\*/g, '<i>$1</i>').replace(/\*\*/g, ''); };
  var plain = function (c) { return c.replace(/\*/g, ''); };
  var sortKey = function (c) { return plain(c).replace(/^[“‘"']/, '').toLowerCase(); };

  function syncFields() {
    var t = $('#ciType').value;
    $$('[data-for]').forEach(function (l) { l.hidden = l.getAttribute('data-for').split(' ').indexOf(t) < 0; });
  }
  function preview() {
    syncFields();
    var s = read();
    $('#ciPreview').innerHTML = html(format(s));
    $('#ciIntext').textContent = intext(s);
  }
  function drawList() {
    var style = $('#ciStyle').value;
    var items = list.map(function (s, i) { var x = Object.assign({}, s, { style: style }); return { i: i, c: format(x) }; })
      .sort(function (a, b) { return sortKey(a.c) < sortKey(b.c) ? -1 : 1; });
    $('#ciCount').textContent = list.length ? '(' + list.length + ')' : '';
    $('#ciList').innerHTML = items.length ? items.map(function (it) {
      return '<li><div style="padding-left:2em;text-indent:-2em">' + html(it.c) + '</div><div class="ft-row" style="margin-top:6px">'
        + '<button type="button" class="ft-btn small" data-copy="' + it.i + '">Copy</button>'
        + '<button type="button" class="ft-btn small" data-edit="' + it.i + '">Edit</button>'
        + '<button type="button" class="ft-btn small" data-del="' + it.i + '">Remove</button></div></li>';
    }).join('') : '<li class="ft-muted">Nothing here yet.</li>';
    return items;
  }
  function all() { return drawList().map(function (it) { return plain(it.c); }).join('\n\n'); }

  $('#ciQuick').addEventListener('change', function () {
    var v = this.value.trim(); if (!v) return;
    var doi = v.match(/10\.\d{4,9}\/\S+/), isbn = v.replace(/[\s-]/g, '').match(/^(97[89])?\d{9}[\dXx]$/);
    if (doi) { $('#ciType').value = 'journal'; $('#ciDoi').value = doi[0].replace(/[.,;]$/, ''); }
    else if (isbn) { $('#ciType').value = 'book'; $('#ciIsbn').value = v; }
    else if (/^https?:\/\//.test(v)) {
      $('#ciType').value = 'web'; $('#ciUrl').value = v;
      try { var h = new URL(v).hostname.replace(/^www\./, ''); if (!$('#ciContainer').value) $('#ciContainer').value = h; } catch (e) { /* not a URL after all */ }
      if (!$('#ciAccessed').value) $('#ciAccessed').value = new Date().toISOString().slice(0, 10);
    } else { T.toast('That is not a DOI, ISBN or web address.'); return; }
    this.value = ''; preview();
  });
  $('#ciForm').addEventListener('input', preview);
  $('#ciForm').addEventListener('change', function () { preview(); drawList(); T.save('flux_cite_style', $('#ciStyle').value); });
  $('#ciForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = read();
    if (!s.title) { T.toast('Add a title first.'); $('#ciTitle').focus(); return; }
    delete s.style; list.push(s); T.save(KEY, list); drawList(); T.toast('Added');
  });
  $('#ciClear').addEventListener('click', function () { F.forEach(function (k) { if (k !== 'Type' && k !== 'Style') $('#ci' + k).value = ''; }); preview(); });
  $('#ciCopyOne').addEventListener('click', function () { T.copy(plain(format(read()))); });
  $('#ciCopyIn').addEventListener('click', function () { T.copy(intext(read())); });
  $('#ciList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var style = $('#ciStyle').value;
    if (b.hasAttribute('data-copy')) T.copy(plain(format(Object.assign({}, list[+b.getAttribute('data-copy')], { style: style }))));
    if (b.hasAttribute('data-del')) { list.splice(+b.getAttribute('data-del'), 1); T.save(KEY, list); drawList(); }
    if (b.hasAttribute('data-edit')) {
      var s = list.splice(+b.getAttribute('data-edit'), 1)[0]; T.save(KEY, list);
      F.forEach(function (k) { if (k !== 'Style' && s[k.toLowerCase()] != null) $('#ci' + k).value = s[k.toLowerCase()]; });
      preview(); drawList(); $('#ciTitle').focus();
    }
  });
  $('#ciCopyAll').addEventListener('click', function () { T.copy(all(), 'Bibliography copied'); });
  $('#ciTxt').addEventListener('click', function () { T.download('bibliography.txt', all()); });
  $('#ciBib').addEventListener('click', function () {
    var bib = list.map(function (s, i) {
      var a = people(s), key = ((a[0] && a[0].last) || 'source').replace(/[^A-Za-z]/g, '') + (s.year || '') + (i ? String.fromCharCode(97 + i % 26) : '');
      var f = { author: a.map(function (p) { return p.last + (p.first ? ', ' + p.first : ''); }).join(' and '), title: s.title, year: s.year,
        journal: s.type === 'journal' ? s.container : '', howpublished: s.type === 'web' && s.container ? s.container : '', publisher: s.publisher,
        volume: s.vol, number: s.issue, pages: s.pages && s.pages.replace(/–/g, '--'), doi: s.doi, isbn: s.isbn, url: s.url, urldate: s.accessed };
      return '@' + (s.type === 'journal' ? 'article' : s.type === 'book' ? 'book' : 'misc') + '{' + key + ',\n'
        + Object.keys(f).filter(function (k) { return f[k]; }).map(function (k) { return '  ' + k + ' = {' + String(f[k]).replace(/[{}]/g, '') + '}'; }).join(',\n') + '\n}';
    }).join('\n\n');
    T.download('bibliography.bib', bib + '\n');
  });
  $('#ciStyle').value = T.load('flux_cite_style', 'mla');
  preview(); drawList();
  window.fluxCite = { format: format, intext: intext };
})();
