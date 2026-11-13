/* ============================================================================
   FLUX PASTE IMPORT · CORE  ·  flux-paste-import-core.js
   Turns a pasted assignment sheet, syllabus or to-do list into task drafts.

   No DOM and no AI: it works offline and costs nothing. Reading one line
   ("Essay draft due Fri") is already the planner's job — parseNLTask in app.js —
   so this file does only what a *sheet* adds on top of a line:

     · tidy each line: bullets, numbering, checkboxes, table cells, point values
     · drop the lines that are not work: table headers, rules, blank lines
     · carry context down the page: a date on a line of its own ("Monday 11/20")
       or a class heading ("Biology:") applies to the lines under it

   build(text, parseLine) takes the line parser as an argument, so the unit
   tests run this in a bare VM with a stand-in parser.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxPasteImportCore) return;

  var MAX_LINES = 200;
  var MAX_LINE = 300;

  var WD = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|thurs|tues|weds|thur|sun|mon|tue|wed|thu|fri|sat)';
  var MON = '(?:january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)';
  /* "Mon 11/20", "Friday, Nov 3": the weekday only repeats the real date, and
     the line parser would read the weekday first and land on the wrong week. */
  var WD_BEFORE_DATE = new RegExp('\\b' + WD + '\\.?,?\\s+(?=\\d{1,2}/\\d{1,2}\\b|' + MON + '\\.?\\s+\\d{1,2}\\b|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MON + '\\b)', 'i');
  /* Column titles of a pasted table. A row made only of these is a header. */
  var HEADER_WORDS = /^(?:#|no\.?|assignments?|tasks?|names?|titles?|items?|due|dates?|due dates?|deadlines?|points?|pts|scores?|grades?|status|descriptions?|details|types?|class(?:es)?|courses?|subjects?|weeks?|days?|topics?|notes?|done|submitted)$/i;

  /** One raw line → the text worth parsing, or '' when the line is not work. */
  function cleanLine(raw) {
    var s = String(raw == null ? '' : raw).replace(/ /g, ' ');
    if (s.length > MAX_LINE) s = s.slice(0, MAX_LINE);

    // Table rows: tab- or pipe-separated cells.
    var cells = s.split(/\t+|\s*\|\s*/).map(function (c) { return c.trim(); }).filter(Boolean);
    if (cells.length > 1) {
      if (cells.every(function (c) { return HEADER_WORDS.test(c); })) return '';
      // A markdown table's "---|---" rule.
      if (cells.every(function (c) { return /^[:\-=\s]+$/.test(c); })) return '';
      s = cells.join(' - ');
    }
    s = s.trim();
    if (!s) return '';
    if (/^[\-=_*~#\s]+$/.test(s)) return ''; // a rule or a row of symbols

    s = s
      .replace(/^(?:[-*•▪◦‣·–—>]+|\d{1,3}[.)]|[a-z][.)])\s+/i, '')   // bullet or number
      .replace(/^(?:\[[ xX✓✔]?\]|[☐☑☒✓✔])\s*/, '')                    // checkbox
      .replace(/^(?:[-*•▪◦‣·–—>]+)\s+/, '')                            // bullet after the checkbox
      .replace(/^#{1,6}\s+/, '')                                        // markdown heading
      .replace(/\*\*|__/g, '');                                         // bold marks

    // 2026-11-20 → 11/20/2026, the form the line parser reads.
    s = s.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, function (_, y, m, d) { return +m + '/' + +d + '/' + y; });
    s = s.replace(WD_BEFORE_DATE, '');

    // Point values and scores say nothing about what to do or when.
    s = s
      .replace(/[(\[]\s*\d+(?:\.\d+)?\s*(?:pts?|points?|marks?)\.?\s*[)\]]/ig, ' ')
      .replace(/(?:^|[\s\-–—,;])\d+(?:\.\d+)?\s*(?:pts?|points?)\b\.?/ig, ' ')
      .replace(/(?:^|\s)[-–—]?\s*\/\s*\d+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;:–—-]+|[\s,;–—-]+$/g, '')
      .trim();
    return s;
  }

  /** All the lines worth reading, in order. */
  function splitLines(text) {
    var out = [];
    var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    for (var i = 0; i < rows.length && out.length < MAX_LINES; i++) {
      var c = cleanLine(rows[i]);
      if (c) out.push(c);
    }
    return out;
  }

  function sameText(a, b) {
    var norm = function (x) { return String(x || '').toLowerCase().replace(/[\s,;:.–—-]+/g, ' ').trim(); };
    return norm(a) === norm(b);
  }

  /**
   * text → [{ name, date, time, type, priority, estTime, subject, source }]
   *
   * parseLine(line) is the planner's single-line parser. It returns
   * { name, date, ... } and, when nothing is left once the date is taken out,
   * falls back to the whole line as the name — which is how a line that is
   * only a date ("Monday 11/20") is recognised here as a heading.
   */
  function build(text, parseLine) {
    var lines = splitLines(text);
    var drafts = [];
    var ctxDate = '';
    var ctxSubject = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var heading = /:$/.test(line);
      var body = heading ? line.replace(/:+$/, '').trim() : line;
      if (!body) continue;
      var r = parseLine(body);
      if (!r || !r.name) continue;

      // A date and nothing else: it dates the lines below it.
      if (r.date && sameText(r.name, body)) { ctxDate = r.date; continue; }
      // "Biology:" / "Week 4:" — a heading. A class name becomes the context.
      if (heading && !r.date) {
        ctxSubject = r.subject || '';
        ctxDate = '';
        continue;
      }
      drafts.push({
        name: r.name,
        date: r.date || ctxDate || '',
        time: r.time || '',
        type: r.type || 'hw',
        priority: r.priority || 'med',
        estTime: r.estTime || 0,
        subject: r.subject || ctxSubject || '',
        source: line,
      });
    }
    return drafts;
  }

  /** Marks drafts the planner already holds (same name, same date). */
  function markDuplicates(drafts, existing) {
    var seen = Object.create(null);
    var key = function (t) { return String(t.name || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + (t.date || ''); };
    (existing || []).forEach(function (t) { if (t && t.name) seen[key(t)] = true; });
    return drafts.map(function (d) {
      var k = key(d);
      var dup = !!seen[k];
      seen[k] = true; // a line pasted twice counts once
      return Object.assign({}, d, { duplicate: dup });
    });
  }

  root.FluxPasteImportCore = {
    MAX_LINES: MAX_LINES,
    cleanLine: cleanLine, splitLines: splitLines, build: build, markDuplicates: markDuplicates,
  };
})();
