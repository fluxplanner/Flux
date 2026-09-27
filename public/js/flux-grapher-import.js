/* ============================================================================
   FLUX GRAPHER · IMPORT  ·  flux-grapher-import.js
   Getting a data table into the grapher without typing it.

     A file    CSV, TSV or text from any spreadsheet, or an Excel workbook
               (.xlsx). Read here, in the browser — nothing is uploaded.
     A photo   of a printed or handwritten table. Read by Flux AI through
               ai-proxy's "table_scan" task: free with a Flux account, a
               daily allowance per person, counted on the server.

   Either way the table is shown first — headings, units and every number,
   beside the photo — so a misread digit is fixed before it is graphed.

   The parsing is pure and unit-tested (test/unit/grapher-import.test.mjs).
   What is left is the review sheet and one network call.
   ========================================================================== */
(function () {
  'use strict';

  const SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  const AI_URL = SB_URL + '/functions/v1/ai-proxy';
  const MAX_ROWS = 2000;         // what a grapher table holds
  const MAX_COLS = 12;
  const CELL = 40;
  const SHOW_ROWS = 200;         // editable in the review sheet; the rest come along unseen
  const PHOTO_EDGE = 2000;       // longest side sent, in pixels: small digits stay legible
  const SCANS_KEY = 'flux_grapher_scans';

  /* The server keeps its own copy of this and uses that one: a free scan
     reads tables and nothing else, whatever a client sends. This copy is for
     a server that predates the table_scan task. */
  const SCAN_SYSTEM = [
    'You read data tables from photos for a graphing tool used by students. Reply with one JSON object and nothing else:',
    '{"columns":[{"name":"...","unit":"..."}],"rows":[["...","..."]]}',
    '- columns: one entry per column of the table, left to right. name is the heading without its unit. unit is the unit given in the heading — from forms like "Time (s)", "Time / s", "t [s]" or "(t ± 0.1) / s" — or "" if there is none. If the heading gives an uncertainty such as "± 0.1", keep it in the name, e.g. "Time ± 0.1".',
    '- rows: one array per row of data, top to bottom, with exactly one string per column.',
    '- Copy every number exactly as written: the same digits, decimal places, trailing zeros and sign. Never calculate, round, correct or fill in a value. Write a decimal comma as a point (4,5 → 4.5) and a power of ten in e-notation (3.2 × 10⁻³ → 3.2e-3).',
    '- A value written with its uncertainty, like 2.35 ± 0.05, stays as written.',
    '- An empty, crossed-out or unreadable cell is "".',
    '- Leave out rows that are not readings, such as a mean or total row, and any writing outside the table.',
    '- A heading split over two lines is one heading. If there are several tables, read the largest.',
    '- If there is no table in the photo, reply {"columns":[],"rows":[]}.',
  ].join('\n');
  const SCAN_USER = 'Read the table in this photo.';

  function G() { return window.FluxGrapher || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(m, k) { if (G().toast) G().toast(m, k); }
  function importError(message, code) { const e = new Error(message); e.code = code || 'failed'; return e; }

  /* ── Numbers as people write them ─────────────────────────────────── */

  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };

  /**
   * One reading, the way the grapher reads numbers: "3.2 × 10⁻³" → "3.2e-3",
   * "−4,5" → "-4.5", "1,234.5" → "1234.5". Anything that is not a number
   * ("2%", "n/a", a name) comes back exactly as it was written.
   */
  function cleanNumber(raw, decimalComma) {
    const t0 = String(raw == null ? '' : raw).trim();
    if (!t0) return '';
    let t = t0.replace(/[−–—]/g, '-').replace(/[   ]/g, ' ');
    t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => '^' + Array.from(m).map((c) => SUP[c]).join(''));
    t = t.replace(/\s+/g, '');
    if (decimalComma && t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');   // 1.234,5
    else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');          // 1,234.5
    else if (/^[+-]?\d*,\d+$/.test(t)) t = t.replace(',', '.');                           // 4,5
    let m = /^([+-]?(?:\d+\.?\d*|\.\d+))[×xX*·]10\^\(?([+-]?\d+)\)?$/.exec(t);
    if (m) t = m[1] + 'e' + m[2];
    else if ((m = /^10\^\(?([+-]?\d+)\)?$/.exec(t))) t = '1e' + m[1];
    t = t.replace(/^\+/, '');
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? t : t0;
  }
  function isNumber(s) {
    const c = cleanNumber(s);
    return c !== '' && /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(c);
  }
  const PM = /^(.+?)\s*(?:±|\+\/-|\+-)\s*(.+)$/;
  /** "2.35 ± 0.05" → ['2.35', '0.05'], or null. */
  function splitPM(s) {
    const m = PM.exec(String(s || '').trim());
    if (!m || !isNumber(m[1])) return null;
    const u = m[2].trim();
    if (!isNumber(u.replace(/%$/, ''))) return null;
    return [cleanNumber(m[1]), /%$/.test(u) ? cleanNumber(u.slice(0, -1)) + '%' : cleanNumber(u)];
  }
  function isReading(s) { return isNumber(s) || !!splitPM(s); }

  /* ── Headings ───────────────────────────────────────────────────────── */

  const UNC_HEAD = /^\s*(±|\+\/-|Δ|delta\b|uncertainty|uncert\b|unc\b|error\b|err\b|abs(olute)?\.?\s+(uncertainty|error))/i;

  /**
   * A heading into its name, unit and any uncertainty it gives for every
   * reading below it. Handles the ways lab books write them:
   *   "Time (s)"  "Time / s"  "t [s]"  "t/s"  "(t ± 0.01) / s"  "Length / cm ± 0.1"
   */
  function splitHeading(h) {
    let s = String(h == null ? '' : h).replace(/\s+/g, ' ').trim();
    let unit = '', unc = '';
    let m = /^\(\s*(.+?)\s*(?:±|\+\/-)\s*([\d.,]+\s*%?)\s*\)\s*\/\s*(.+)$/.exec(s);
    if (m) return { name: m[1].slice(0, 40), unit: m[3].trim().slice(0, 20), unc: cleanNumber(m[2].replace(/\s/g, '')) };
    m = /\s*\(?\s*(?:±|\+\/-)\s*([\d.,]+\s*%?)\s*([A-Za-zµμ°Ω%][A-Za-zµμ°Ω%\/⁻¹²³·\-0-9]*)?\s*\)?/.exec(s);
    if (m && m.index > 0) {
      unc = m[1].replace(/\s/g, '');
      unc = /%$/.test(unc) ? cleanNumber(unc.slice(0, -1)) + '%' : cleanNumber(unc);
      if (m[2]) unit = m[2];
      s = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    }
    if ((m = /^(.*?\S)\s*[([]\s*([^()[\]]{1,20}?)\s*[)\]]\s*$/.exec(s))) { s = m[1]; unit = m[2]; }
    else if ((m = /^(.*?\S)\s+\/\s+(.{1,20})$/.exec(s))) { s = m[1]; unit = unit || m[2]; }
    else if ((m = /^([A-Za-zα-ωΑ-Ω][A-Za-z0-9_]{0,3})\s*\/\s*(\S.{0,19})$/.exec(s))) { s = m[1]; unit = unit || m[2]; }
    return { name: s.trim().replace(/[:=]$/, '').trim().slice(0, 40), unit: unit.trim().slice(0, 20), unc: unc };
  }

  /* ── Delimited text ─────────────────────────────────────────────────── */

  /**
   * Which of tab, semicolon or comma separates the columns. The separator is
   * the one that turns up the same number of times on every line — a count
   * of commas alone gets "0,5;1,2" (decimal commas, European Excel) wrong.
   */
  function sniffDelimiter(text) {
    const cands = ['\t', ';', ','];
    const per = cands.map(() => []);
    let q = false, line = cands.map(() => 0), any = false;
    const endLine = () => { if (any) cands.forEach((_, k) => per[k].push(line[k])); line = cands.map(() => 0); any = false; };
    for (let i = 0; i < text.length && per[0].length < 20; i++) {
      const c = text[i];
      if (c === '"') q = !q;
      else if (!q && c === '\n') endLine();
      else if (!q) {
        const k = cands.indexOf(c);
        if (k >= 0) line[k]++;
        if (c.trim()) any = true;
      }
    }
    endLine();
    const steady = cands.filter((_, k) => per[k].length && per[k][0] > 0 && per[k].every((n) => n === per[k][0]));
    if (steady.indexOf('\t') >= 0) return '\t';
    if (steady.length > 1 && steady.indexOf(';') >= 0 && /\d,\d/.test(text)) return ';';
    if (steady.length) return steady[steady.length === 1 ? 0 : steady.length - 1];
    const total = cands.map((_, k) => per[k].reduce((a, b) => a + b, 0));
    const best = total.indexOf(Math.max.apply(null, total));
    return total[best] > 0 ? cands[best] : null;
  }

  /** RFC 4180, forgivingly: quotes, doubled quotes, and newlines inside quotes. */
  function parseCSV(text, delim) {
    const src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const d = delim || sniffDelimiter(src);
    if (!d) {
      // No separators at all: one column, or columns lined up with spaces.
      return src.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/));
    }
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (q) {
        if (c === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"' && cell.trim() === '') { q = true; cell = ''; }
      else if (c === d) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ── Excel workbooks (.xlsx) ─────────────────────────────────────────
     An .xlsx is a zip of XML files. The browser inflates; this finds the
     files in the zip and reads the few XML shapes Excel writes. */

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function zipEntries(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw importError('That file is not an Excel workbook. Save it as .xlsx or CSV and try again.', 'format');
    const n = u16(bytes, eocd + 10);
    let p = u32(bytes, eocd + 16);
    const out = {};
    for (let k = 0; k < n; k++) {
      if (u32(bytes, p) !== 0x02014b50) break;
      const method = u16(bytes, p + 10), size = u32(bytes, p + 20);
      const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
      const local = u32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      out[name] = { method: method, size: size, local: local };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  async function zipRead(bytes, entries, name) {
    const e = entries[name];
    if (!e) return null;
    const p = e.local;
    if (u32(bytes, p) !== 0x04034b50) return null;
    const start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
    const data = bytes.subarray(start, start + e.size);
    if (e.method === 0) return new TextDecoder().decode(data);
    if (e.method !== 8) throw importError('That workbook is compressed in a way Flux cannot read. Save it as CSV and try again.', 'format');
    if (typeof DecompressionStream !== 'function') {
      throw importError('This browser cannot open Excel files. Save the sheet as CSV (File → Download → CSV) and open that.', 'format');
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  }

  function xmlText(s) {
    return String(s).replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === 'lt') return '<';
      if (k === 'gt') return '>';
      if (k === 'amp') return '&';
      if (k === 'quot') return '"';
      if (k === 'apos') return "'";
      const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    });
  }
  function attr(tag, name) {
    const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
    return m ? xmlText(m[1]) : null;
  }
  /** Every <t> run inside a shared string or inline string, minus phonetic guides. */
  function runs(xml) {
    const s = String(xml || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let out = '';
    const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let m;
    while ((m = re.exec(s))) out += xmlText(m[1]);
    return out;
  }
  function colIndex(ref) {
    const m = /^([A-Z]+)/.exec(ref || '');
    if (!m) return -1;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  /** Excel stores 0.1 + 0.2 as 0.30000000000000004; people typed 0.3. */
  function tidyNumber(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return String(Number(n.toPrecision(15)));
  }

  function sheetGrid(xml, shared) {
    const grid = [];
    const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm, rowNo = -1, count = 0;
    while ((rm = rowRe.exec(xml)) && count <= MAX_ROWS + 10) {
      const r = attr(rm[1], 'r');
      rowNo = r ? +r - 1 : rowNo + 1;
      if (!rm[2]) continue;
      const cells = [];
      const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm, col = -1;
      while ((cm = cellRe.exec(rm[2]))) {
        const ref = attr(cm[1], 'r');
        col = ref ? colIndex(ref) : col + 1;
        if (col < 0 || col > 50) continue;
        const t = attr(cm[1], 't');
        const inner = cm[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        let text = '';
        if (t === 's') text = v ? (shared[+v[1]] || '') : '';
        else if (t === 'inlineStr') text = runs(inner);
        else if (t === 'b') text = v ? (v[1] === '1' ? 'TRUE' : 'FALSE') : '';
        else if (t === 'e') text = '';
        else if (t === 'str') text = v ? xmlText(v[1]) : '';
        else text = v ? tidyNumber(xmlText(v[1])) : '';
        cells[col] = text;
      }
      if (cells.some((c) => c != null && String(c).trim() !== '')) {
        for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = '';
        grid[rowNo] = cells;
        count++;
      }
    }
    return grid.filter(Boolean);
  }

  /** Every sheet that has anything on it: [{ name, grid }]. */
  async function readXLSX(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const entries = zipEntries(bytes);
    const wb = await zipRead(bytes, entries, 'xl/workbook.xml');
    if (!wb) throw importError('That file is not an Excel workbook. Save it as .xlsx or CSV and try again.', 'format');
    const rels = (await zipRead(bytes, entries, 'xl/_rels/workbook.xml.rels')) || '';
    const targets = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach((tag) => { targets[attr(tag, 'Id')] = attr(tag, 'Target'); });
    const sst = (await zipRead(bytes, entries, 'xl/sharedStrings.xml')) || '';
    const shared = (sst.match(/<si\b[\s\S]*?<\/si>/g) || []).map(runs);
    const sheets = [];
    const tags = wb.match(/<sheet\b[^>]*>/g) || [];
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      if (attr(tag, 'state') === 'hidden' || attr(tag, 'state') === 'veryHidden') continue;
      let target = targets[attr(tag, 'r:id')] || ('worksheets/sheet' + (i + 1) + '.xml');
      target = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const xml = await zipRead(bytes, entries, target);
      if (!xml) continue;
      const grid = sheetGrid(xml, shared);
      if (grid.length) sheets.push({ name: attr(tag, 'name') || 'Sheet ' + (i + 1), grid: grid });
    }
    return sheets;
  }

  /* ── A grid into a grapher table ─────────────────────────────────────── */

  const SUMMARY_ROW = /^(mean|average|avg|total|sum|gradient|slope|std|standard deviation|range)\b/i;

  /**
   * Rows of cells → { cols: [{ name, unit, role, of }], rows, headed, cut }.
   *   role 'value' or 'unc'; `of` is the index of the value column an
   *   uncertainty belongs to. Headings become names and units, a heading's
   *   "± 0.1" becomes an uncertainty column, and "2.35 ± 0.05" cells split in two.
   * opts.headers: true / false forces whether the first rows are headings.
   */
  function buildTable(grid, opts) {
    const o = opts || {};
    let g = (grid || []).map((r) => (Array.isArray(r) ? r : []).map((c) => String(c == null ? '' : c).replace(/\s+/g, ' ').trim()))
      .filter((r) => r.some((c) => c !== ''));
    const width = g.reduce((w, r) => Math.max(w, r.length), 0);
    g = g.map((r) => { const a = r.slice(); while (a.length < width) a.push(''); return a; });
    // Columns with nothing in them at all go.
    const keep = [];
    for (let j = 0; j < width; j++) if (g.some((r) => r[j] !== '')) keep.push(j);
    g = g.map((r) => keep.map((j) => r[j]));

    // Leading rows that are mostly words are headings (up to three: "Time" over "(s)").
    let head = 0;
    const wordy = (r) => {
      const filled = r.filter((c) => c !== '');
      return filled.length > 0 && filled.filter(isReading).length / filled.length < 0.5;
    };
    if (o.headers === true) head = g.length ? 1 : 0;
    else if (o.headers !== false) while (head < 3 && head < g.length - 1 && wordy(g[head])) head++;
    const heads = keep.map((_, j) => g.slice(0, head).map((r) => r[j]).filter(Boolean).join(' '));
    const data = g.slice(head).filter((r) => {
      const first = r.find((c) => c !== '') || '';
      return !SUMMARY_ROW.test(first) && r.some(isReading);
    });

    const cols = [];
    const colData = [];
    const add = (col, cells) => { cols.push(col); colData.push(cells); };
    const lastValue = () => { for (let i = cols.length - 1; i >= 0; i--) if (cols[i].role === 'value') return i; return -1; };
    const uncCell = (c) => (/%$/.test(c) ? cleanNumber(c.slice(0, -1), o.decimalComma) + '%' : cleanNumber(c, o.decimalComma));
    heads.forEach((h, j) => {
      const cells = data.map((r) => r[j] || '');
      const filled = cells.filter((c) => c !== '');
      if (UNC_HEAD.test(h) && lastValue() >= 0) {
        add({ name: '', unit: '', role: 'unc', of: lastValue() }, cells.map(uncCell));
        return;
      }
      const hd = splitHeading(h);
      const pm = filled.length && filled.filter((c) => splitPM(c)).length / filled.length >= 0.5;
      const at = cols.length;
      if (pm) {
        add({ name: hd.name, unit: hd.unit, role: 'value' }, cells.map((c) => { const s = splitPM(c); return s ? s[0] : cleanNumber(c, o.decimalComma); }));
        add({ name: '', unit: '', role: 'unc', of: at }, cells.map((c) => { const s = splitPM(c); return s ? s[1] : ''; }));
        return;
      }
      add({ name: hd.name, unit: hd.unit, role: 'value' }, cells.map((c) => cleanNumber(c, o.decimalComma)));
      const nextIsUnc = heads[j + 1] != null && UNC_HEAD.test(heads[j + 1]);
      if (hd.unc && !nextIsUnc) add({ name: '', unit: '', role: 'unc', of: at }, cells.map((c) => (c !== '' ? hd.unc : '')));
    });

    let cut = false;
    if (cols.length > MAX_COLS) {
      cols.length = MAX_COLS;
      colData.length = MAX_COLS;
      cut = true;
    }
    if (!cols.some((c) => c.role === 'value')) return { cols: [], rows: [], headed: head > 0, cut: cut };
    let rows = data.map((_, i) => colData.map((cells) => String(cells[i] || '').slice(0, CELL)));
    if (rows.length > MAX_ROWS) { rows = rows.slice(0, MAX_ROWS); cut = true; }
    return { cols: cols, rows: rows, headed: head > 0, cut: cut };
  }

  /* ── What the AI sends back ──────────────────────────────────────────── */

  /** The model's reply → { grid, headed }, with the headings as the grid's
      first row. Lenient: JSON (fenced or not), a markdown table, or plain
      delimited text. */
  function parseScanReply(text) {
    const s = String(text || '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        const j = JSON.parse(s.slice(a, b + 1));
        const colsIn = Array.isArray(j.columns) ? j.columns : [];
        const rowsIn = Array.isArray(j.rows) ? j.rows : [];
        const heads = colsIn.map((c) => {
          if (c && typeof c === 'object') {
            const n = String(c.name == null ? '' : c.name).trim(), u = String(c.unit == null ? '' : c.unit).trim();
            return u ? (n ? n + ' (' + u + ')' : '(' + u + ')') : n;
          }
          return String(c == null ? '' : c);
        });
        const body = rowsIn.filter(Array.isArray).map((r) => r.map((c) => (c == null ? '' : String(c))));
        const named = heads.some((h) => h !== '');
        return { grid: named ? [heads].concat(body) : body, headed: named };
      } catch (e) { /* fall through to the text forms */ }
    }
    const lines = s.replace(/```[a-z]*\n?|```/gi, '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => l.indexOf('|') >= 0)) {
      const grid = lines.filter((l) => l.indexOf('|') >= 0 && !/^\|?[\s:|-]+\|?$/.test(l))
        .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      return { grid: grid, headed: null };
    }
    return { grid: parseCSV(lines.join('\n')), headed: null };
  }

  /* ── Files ──────────────────────────────────────────────────────────── */

  function kindOf(file) {
    const name = String(file && file.name || '').toLowerCase();
    const type = String(file && file.type || '').toLowerCase();
    if (/^image\//.test(type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(name)) return 'image';
    if (/\.xlsx$|\.xlsm$/.test(name) || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
    if (/\.(xls|ods|numbers)$/.test(name)) return 'old';
    if (/\.(csv|tsv|txt|tab|dat)$/.test(name) || /^text\//.test(type) || type === 'application/vnd.ms-excel') return 'text';
    return null;
  }

  /** A chosen file → [{ name, grid, decimalComma }] (one per sheet). */
  async function readFile(file) {
    const k = kindOf(file);
    if (k === 'old') {
      throw importError('Flux reads .xlsx and CSV files. In your spreadsheet app, use File → Save As (or Export) and pick .xlsx or CSV.', 'format');
    }
    if (k === 'image') throw importError('That is a photo — use "Scan a photo of a table" for it.', 'format');
    if (k === 'xlsx') {
      const sheets = await readXLSX(await file.arrayBuffer());
      if (!sheets.length) throw importError('That workbook has nothing in it to graph.', 'empty');
      return sheets;
    }
    if (file.size > 5e6) throw importError('That file is too big to be a data table (over 5 MB).', 'format');
    const text = await file.text();
    if (/\u0000/.test(text.slice(0, 2000))) throw importError('Flux reads .xlsx, CSV and text files, and photos of tables.', 'format');
    const d = sniffDelimiter(text.replace(/^﻿/, ''));
    return [{ name: file.name, grid: parseCSV(text, d), decimalComma: d === ';' }];
  }

  function pick(kind) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.className = 'fgi-picker';
      inp.accept = kind === 'image'
        ? 'image/*'
        : '.csv,.tsv,.txt,.xlsx,.xlsm,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      inp.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(inp);
      let done = false;
      const finish = (f) => { if (done) return; done = true; if (inp.parentNode) inp.parentNode.removeChild(inp); resolve(f || null); };
      inp.addEventListener('change', () => finish(inp.files && inp.files[0]));
      inp.addEventListener('cancel', () => finish(null));
      inp.click();
    });
  }

  /* ── Photos ─────────────────────────────────────────────────────────── */

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
  }

  /** The photo, upright and no bigger than it needs to be, as JPEG base64. */
  async function photoData(file) {
    const url = URL.createObjectURL(file);
    let src;
    try {
      src = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : await loadImage(url);
    } catch (e) {
      try { src = await loadImage(url); } catch (e2) {
        URL.revokeObjectURL(url);
        throw importError('Flux cannot open this kind of photo. Take a screenshot of it, or save it as JPEG or PNG, and try again.', 'format');
      }
    }
    const w = src.width, h = src.height;
    const k = Math.min(1, PHOTO_EDGE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    const b64 = c.toDataURL('image/jpeg', 0.86).split(',')[1] || '';
    return { b64: b64, url: url };
  }

  async function authToken() {
    const C = window.FluxGraphCloud;
    try {
      const s = C && C.session ? await C.session() : null;
      if (s && s.token) return s.token;
    } catch (e) {}
    return null;
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function rememberLeft(left) {
    try { localStorage.setItem(SCANS_KEY, JSON.stringify({ day: today(), left: left })); } catch (e) {}
  }
  /** Scans left today as the server last said, or null if it has not said today. */
  function scansLeft() {
    try {
      const s = JSON.parse(localStorage.getItem(SCANS_KEY) || 'null');
      return s && s.day === today() && Number.isFinite(s.left) ? s.left : null;
    } catch (e) { return null; }
  }

  /** Photo → { grid, headed, left, limit, url }. Throws with .code: auth, limit, unavailable, failed, format. */
  async function scan(file, onPhoto) {
    const token = await authToken();
    if (!token) throw importError('Sign in to scan photos of tables — it is free with a Flux account.', 'auth');
    const img = await photoData(file);
    if (onPhoto) onPhoto(img.url);
    let res;
    try {
      res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: SB_ANON },
        body: JSON.stringify({
          task: 'table_scan',
          imageBase64: img.b64,
          mimeType: 'image/jpeg',
          system: SCAN_SYSTEM,
          messages: [{ role: 'user', content: SCAN_USER }],
          responseFormat: 'json_object',
        }),
      });
    } catch (e) {
      URL.revokeObjectURL(img.url);
      throw importError('Could not reach Flux. Check your connection and try again.', 'failed');
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      URL.revokeObjectURL(img.url);
      if (res.status === 401) throw importError('Your sign-in has expired. Sign in again to scan photos.', 'auth');
      if (res.status === 429) {
        const lim = Number(j.daily_limit);
        if (j.error === 'scan_daily_limit') {
          rememberLeft(0);
          throw importError('You have used today\'s ' + (Number.isFinite(lim) ? lim + ' ' : '')
            + 'free photo scans. They come back tomorrow — until then, open a CSV or Excel file, or paste the numbers.', 'limit');
        }
        throw importError('Flux AI is busy right now. Try the photo again in a minute.', 'limit');
      }
      if (res.status === 403) throw importError('Photo scanning is not available on this account right now.', 'unavailable');
      if (res.status === 413) throw importError('That photo is too big. Crop it to the table and try again.', 'format');
      throw importError('Flux could not read that photo. Try again, or take a sharper, straighter photo of the table.', 'failed');
    }
    const text = j && j.content && j.content[0] && j.content[0].text || '';
    const out = parseScanReply(text);
    const left = Number(j.scans_left), limit = Number(j.daily_limit);
    if (j.scans_left != null && Number.isFinite(left)) rememberLeft(left);
    return {
      grid: out.grid, headed: out.headed, url: img.url,
      left: j.scans_left != null && Number.isFinite(left) ? left : null,
      limit: j.daily_limit != null && Number.isFinite(limit) ? limit : null,
    };
  }

  /* ── Sheets ─────────────────────────────────────────────────────────── */

  const ODD_TIP = 'Not a number — check it against your table. It will be left off the graph.';
  const CLOSE = '<button type="button" class="fgc-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';

  function sheetShell(html, onClosed, extraClass) {
    const back = document.createElement('div');
    back.className = 'fgc-back fgi-back';
    back.id = 'fgiSheet';            // one at a time; the id outranks the planner's global input and button rules
    back.innerHTML = '<div class="fgc-sheet fgi-sheet' + (extraClass ? ' ' + extraClass : '') + '" role="dialog" aria-modal="true" aria-labelledby="fgiH">' + CLOSE + html + '</div>';
    document.body.appendChild(back);
    const box = back.firstChild;
    const prevFocus = document.activeElement;
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      back.classList.add('is-out');
      setTimeout(() => { if (back.parentNode) back.parentNode.removeChild(back); }, 160);
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
      if (onClosed) onClosed();
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    return { box: box, close: close, back: back };
  }

  /** While a photo is read: the photo itself with a scan line over it. Returns
      { show(url), close(), cancelled } — closing it abandons the scan. */
  function busySheet() {
    const st = { cancelled: false };
    const s = sheetShell('<h2 class="fgc-h" id="fgiH">Reading your photo…</h2>'
      + '<p class="fgc-sub">Flux AI is copying the table. This takes a few seconds.</p>'
      + '<div class="fgi-busy"><i class="fgi-sweep" aria-hidden="true"></i></div>', () => { st.cancelled = true; }, 'fgi-sheet--busy');
    st.show = (url) => {
      const b = s.box.querySelector('.fgi-busy');
      if (b && url && !b.querySelector('img')) b.insertAdjacentHTML('afterbegin', '<img src="' + esc(url) + '" alt="">');
    };
    st.close = () => { const was = st.cancelled; s.close(); st.cancelled = was; };
    return st;
  }

  /**
   * The table as read, to be checked and fixed before it is added.
   * sources: [{ name, grid, decimalComma, headed }] — a workbook's sheets, or one.
   * opts: { from: 'photo' | 'file', fileName, url, left, limit }
   * Resolves with { cols, rows, name } or null.
   */
  function review(sources, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let result = null;
      let si = 0;
      let headers = null;                     // null: let buildTable decide
      let table = null;
      const make = () => {
        const src = sources[si];
        const forced = headers != null ? headers : (src.headed === true ? true : src.headed === false ? false : undefined);
        table = buildTable(src.grid, { headers: forced, decimalComma: src.decimalComma });
      };
      make();
      const photo = o.from === 'photo';
      const where = photo ? 'From your photo' : 'From ' + (o.fileName || 'your file');
      const leftText = photo && o.left != null
        ? o.left + (o.limit != null ? ' of ' + o.limit : '') + ' free scan' + (o.left === 1 ? '' : 's') + ' left today'
        : '';
      const s = sheetShell('<h2 class="fgc-h" id="fgiH">Check the table</h2>'
        + '<p class="fgc-sub">' + esc(where) + '. Fix anything that is wrong, then add it to the graph.</p>'
        + '<div class="fgi-body' + (photo && o.url ? ' has-photo' : '') + '">'
        + (photo && o.url ? '<figure class="fgi-photo"><img src="' + esc(o.url) + '" alt="The photo you scanned"></figure>' : '')
        + '<div class="fgi-main">'
        +   '<div class="fgi-opts">'
        +     (sources.length > 1 ? '<label class="fgi-opt"><span>Sheet</span><select class="fgi-sheetsel" data-sheet>'
        +       sources.map((x, i) => '<option value="' + i + '">' + esc(x.name) + '</option>').join('') + '</select></label>' : '')
        +     '<label class="fgi-opt fgi-opt--check"><input type="checkbox" data-headed> First row is headings</label>'
        +   '</div>'
        +   '<div class="fgi-scroll"><table class="fgi-table"></table></div>'
        +   '<p class="fgi-more" hidden></p>'
        + '</div></div>'
        + (photo ? '<p class="fgi-warn">Flux AI read these numbers from your photo. Check each one against it — handwriting can fool it.</p>' : '')
        + '<div class="fgi-actions"><span class="fgi-left">' + esc(leftText) + '</span>'
        + '<button type="button" class="fgi-cancel" data-close>Cancel</button>'
        + '<button type="button" class="fgc-btn fgi-add" data-add>Add to the graph</button></div>',
      () => { if (o.url) URL.revokeObjectURL(o.url); resolve(result); });
      const box = s.box;
      const tbl = box.querySelector('.fgi-table');
      const more = box.querySelector('.fgi-more');
      const headedBox = box.querySelector('[data-headed]');
      const addBtn = box.querySelector('[data-add]');
      const odd = (v) => { const t = String(v).trim(); return t !== '' && !isReading(t) && !/^[\d.]+\s*%$/.test(t); };

      const paint = () => {
        headedBox.checked = table.headed;
        if (!table.cols.length) {
          tbl.innerHTML = '<tbody><tr><td class="fgi-empty">' + (photo
            ? 'No table found in that photo. Try again closer up, with the whole table in the frame and the page flat.'
            : 'No numbers found in that file.') + '</td></tr></tbody>';
          more.hidden = true;
          addBtn.disabled = true;
          addBtn.textContent = 'Add to the graph';
          return;
        }
        const nameOf = (i) => (table.cols[i] && (table.cols[i].name || 'column ' + (i + 1))) || '';
        const head = table.cols.map((c, j) => '<th data-j="' + j + '" class="' + (c.role === 'unc' ? 'is-unc' : '') + '">'
          + '<div class="fgi-h">'
          + (c.role === 'unc'
            ? '<span class="fgi-pm">± <small>' + esc(nameOf(c.of)) + '</small></span>'
            : '<input type="text" class="fgi-name" data-name="' + j + '" value="' + esc(c.name) + '" placeholder="name" spellcheck="false" aria-label="Column ' + (j + 1) + ' name">')
          + '<button type="button" class="fgi-role" data-role="' + j + '" aria-pressed="' + (c.role === 'unc') + '" title="' + (c.role === 'unc' ? 'Make it a column of readings' : 'Make it the ± uncertainty of the column before it') + '" aria-label="Uncertainty column">±</button>'
          + '<button type="button" class="fgi-drop" data-drop="' + j + '" aria-label="Leave out column ' + (j + 1) + '" title="Leave this column out">×</button>'
          + '</div>'
          + (c.role === 'unc' ? '<div class="fgi-unitsp"></div>' : '<input type="text" class="fgi-unit" data-unit="' + j + '" value="' + esc(c.unit) + '" placeholder="unit" spellcheck="false" aria-label="Column ' + (j + 1) + ' unit">')
          + '</th>').join('');
        const shown = table.rows.slice(0, SHOW_ROWS);
        const body = shown.map((r, i) => '<tr><td class="fgi-rn">' + (i + 1) + '</td>'
          + r.map((v, j) => '<td><input type="text" class="fgi-cell' + (odd(v) ? ' is-odd' : '') + '" data-cell="' + i + ':' + j + '" value="' + esc(v) + '"'
          + (odd(v) ? ' title="' + ODD_TIP + '"' : '') + ' spellcheck="false" aria-label="Row ' + (i + 1) + ', column ' + (j + 1) + '"></td>').join('')
          + '</tr>').join('');
        tbl.innerHTML = '<thead><tr><th class="fgi-rn"></th>' + head + '</tr></thead><tbody>' + body + '</tbody>';
        const extra = table.rows.length - shown.length;
        more.hidden = !(extra > 0 || table.cut);
        more.textContent = (extra > 0 ? '…and ' + extra.toLocaleString() + ' more rows, which come too. ' : '')
          + (table.cut ? 'A grapher table holds ' + MAX_COLS + ' columns and ' + MAX_ROWS.toLocaleString() + ' rows; the rest were left out.' : '');
        addBtn.disabled = false;
        addBtn.textContent = 'Add ' + table.rows.length.toLocaleString() + ' row' + (table.rows.length === 1 ? '' : 's') + ' to the graph';
      };
      paint();

      box.addEventListener('input', (e) => {
        const d = e.target.dataset || {};
        if (d.name != null) table.cols[+d.name].name = e.target.value.slice(0, 40);
        else if (d.unit != null) table.cols[+d.unit].unit = e.target.value.slice(0, 20);
        else if (d.cell) {
          const p = d.cell.split(':');
          table.rows[+p[0]][+p[1]] = e.target.value.slice(0, CELL);
          const bad = odd(e.target.value);
          e.target.classList.toggle('is-odd', bad);
          if (bad) e.target.title = ODD_TIP; else e.target.removeAttribute('title');
        }
      });
      box.addEventListener('change', (e) => {
        const t = e.target;
        if (t.hasAttribute('data-headed')) { headers = t.checked; make(); paint(); }
        else if (t.hasAttribute('data-sheet')) { si = +t.value; headers = null; make(); paint(); }
      });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !box.contains(b)) return;
        const d = b.dataset;
        if (d.role != null) {
          const j = +d.role, c = table.cols[j];
          if (c.role === 'unc') { c.role = 'value'; delete c.of; }
          else {
            let of = -1;
            for (let i = j - 1; i >= 0; i--) if (table.cols[i].role === 'value') { of = i; break; }
            if (of < 0) { toast('An uncertainty column goes after the column it belongs to.', 'warning'); return; }
            if (table.cols.filter((x) => x.role === 'value').length <= 1) { toast('A table needs at least one column of readings.', 'warning'); return; }
            table.cols.forEach((x) => { if (x.role === 'unc' && x.of === j) { x.of = of; } });
            c.role = 'unc';
            c.of = of;
          }
          paint();
        } else if (d.drop != null) {
          const j = +d.drop;
          if (table.cols[j].role === 'value' && table.cols.filter((c) => c.role === 'value').length <= 1) {
            toast('A table needs at least one column of readings.', 'warning');
            return;
          }
          // Its uncertainty columns go with it.
          const gone = table.cols.map((c, i) => (i === j || (c.role === 'unc' && c.of === j) ? i : -1)).filter((i) => i >= 0);
          const keep = table.cols.map((_, i) => i).filter((i) => gone.indexOf(i) < 0);
          const remap = {};
          keep.forEach((i, k) => { remap[i] = k; });
          table.cols = keep.map((i) => {
            const c = table.cols[i];
            if (c.role === 'unc') c.of = remap[c.of];
            return c;
          });
          table.rows = table.rows.map((r) => keep.map((i) => r[i]));
          paint();
        } else if (d.add != null) {
          if (!table.cols.length) return;
          const base = !photo && o.fileName ? String(o.fileName).replace(/\.[^.]+$/, '') : '';
          result = {
            cols: table.cols.map((c) => Object.assign({}, c)),
            rows: table.rows,
            name: sources.length > 1 ? sources[si].name : base,
          };
          s.close();
        }
      });
      const first = box.querySelector('.fgi-add');
      if (first && !first.disabled) first.focus();
    });
  }

  window.FluxGrapherImport = {
    pick: pick,
    kindOf: kindOf,
    readFile: readFile,
    scan: scan,
    busySheet: busySheet,
    review: review,
    scansLeft: scansLeft,
    hasSession: async () => !!(await authToken()),
    // Pure, for the unit tests.
    parseCSV: parseCSV,
    sniffDelimiter: sniffDelimiter,
    readXLSX: readXLSX,
    buildTable: buildTable,
    parseScanReply: parseScanReply,
    splitHeading: splitHeading,
    cleanNumber: cleanNumber,
    splitPM: splitPM,
    SCAN_SYSTEM: SCAN_SYSTEM,
  };
})();
