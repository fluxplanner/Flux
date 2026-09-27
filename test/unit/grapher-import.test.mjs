import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import vm from 'node:vm';

/**
 * Getting a data table into the grapher without typing it: CSV and Excel
 * files, and what Flux AI reads off a photo. The table a student gets must
 * be the one they wrote — same digits, headings split into name and unit.
 */

const sandbox = {
  window: {}, document: {}, console, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, Uint8Array,
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../../public/js/flux-grapher-import.js', import.meta.url), 'utf8'), sandbox, { filename: 'flux-grapher-import.js' });
const I = sandbox.window.FluxGrapherImport;
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const shape = (t) => ({ cols: t.cols.map((c) => [c.name, c.unit, c.role].concat(c.role === 'unc' ? [c.of] : [])), rows: t.rows });

test('numbers as people write them', () => {
  const c = (s, dc) => I.cleanNumber(s, dc);
  assert.equal(c('3.2 × 10⁻³'), '3.2e-3');
  assert.equal(c('3.2x10^-3'), '3.2e-3');
  assert.equal(c('−4.50'), '-4.50');                    // trailing zero kept: it is a reading
  assert.equal(c('4,5'), '4.5');
  assert.equal(c('1,234.5'), '1234.5');
  assert.equal(c('1.234,5', true), '1234.5');
  assert.equal(c('+0.25'), '0.25');
  assert.equal(c('n/a'), 'n/a');
  assert.equal(c('2%'), '2%');
  same(I.splitPM('2.35 ± 0.05'), ['2.35', '0.05']);
  same(I.splitPM('9.8 +/- 2%'), ['9.8', '2%']);
  assert.equal(I.splitPM('Time ± 0.1'), null);
});

test('headings split into a name, a unit and an uncertainty', () => {
  const h = (s) => { const r = I.splitHeading(s); return [r.name, r.unit, r.unc]; };
  same(h('Time (s)'), ['Time', 's', '']);
  same(h('Time / s'), ['Time', 's', '']);
  same(h('Speed / m/s'), ['Speed', 'm/s', '']);
  same(h('t [s]'), ['t', 's', '']);
  same(h('t/s'), ['t', 's', '']);
  same(h('Temperature (°C)'), ['Temperature', '°C', '']);
  same(h('(t ± 0.01) / s'), ['t', 's', '0.01']);
  same(h('Length / cm ± 0.1'), ['Length', 'cm', '0.1']);
  same(h('Time ± 0.1'), ['Time', '', '0.1']);
  same(h('Mass of beaker (g)'), ['Mass of beaker', 'g', '']);
});

test('CSV: quotes, semicolons with decimal commas, and a byte-order mark', () => {
  same(I.parseCSV('﻿a,b\n1,"2,5"\n3,"say ""hi"""'), [['a', 'b'], ['1', '2,5'], ['3', 'say "hi"']]);
  assert.equal(I.sniffDelimiter('Zeit;Weg\n0,5;1,2\n1,0;2,4'), ';');
  const t = I.buildTable(I.parseCSV('Zeit (s);Weg (m)\n0,5;1,2\n1,0;2,4'), { decimalComma: true });
  same(shape(t), { cols: [['Zeit', 's', 'value'], ['Weg', 'm', 'value']], rows: [['0.5', '1.2'], ['1.0', '2.4']] });
  assert.equal(I.sniffDelimiter('x\ty\n1\t2'), '\t');
});

test('a grid becomes a grapher table: headings, ± columns, and no summary rows', () => {
  const grid = [
    ['Trial', 'Length / cm ± 0.1', 'Period (s)', 'Δ Period'],
    ['1', '20.0', '0.90', '0.02'],
    ['2', '40.0', '1.27', '0.02'],
    ['', '', '', ''],
    ['Mean', '30.0', '1.08', ''],
  ];
  const t = I.buildTable(grid);
  same(shape(t), {
    cols: [['Trial', '', 'value'], ['Length', 'cm', 'value'], ['', '', 'unc', 1], ['Period', 's', 'value'], ['', '', 'unc', 3]],
    rows: [['1', '20.0', '0.1', '0.90', '0.02'], ['2', '40.0', '0.1', '1.27', '0.02']],
  });
  // "value ± uncertainty" in each cell splits into two columns.
  const pm = I.buildTable([['v (m/s)'], ['2.35 ± 0.05'], ['3.10 ± 0.05']]);
  same(shape(pm), { cols: [['v', 'm/s', 'value'], ['', '', 'unc', 0]], rows: [['2.35', '0.05'], ['3.10', '0.05']] });
  // Two heading rows are one heading.
  const two = I.buildTable([['Time', 'Distance'], ['(s)', '(m)'], ['1', '4.9']]);
  same(shape(two), { cols: [['Time', 's', 'value'], ['Distance', 'm', 'value']], rows: [['1', '4.9']] });
  // No headings at all: every row is data.
  const bare = I.buildTable([['1', '2'], ['3', '4']]);
  assert.equal(bare.headed, false);
  assert.equal(bare.rows.length, 2);
  // Forcing "first row is headings" off keeps a numeric-looking first row.
  assert.equal(I.buildTable([['2019', '2020'], ['1', '2']], { headers: false }).rows.length, 2);
});

test('what the AI sends back, however it sends it', () => {
  const j = I.parseScanReply('```json\n{"columns":[{"name":"Time","unit":"s"},{"name":"Height","unit":""}],"rows":[["0.0","1.20"],["0.5","0.98"]]}\n```');
  same(j.grid, [['Time (s)', 'Height'], ['0.0', '1.20'], ['0.5', '0.98']]);
  const t = I.buildTable(j.grid, { headers: j.headed });
  same(shape(t), { cols: [['Time', 's', 'value'], ['Height', '', 'value']], rows: [['0.0', '1.20'], ['0.5', '0.98']] });
  // A markdown table, when the model ignores the JSON instruction.
  const md = I.parseScanReply('Here it is:\n| x | y |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
  same(md.grid, [['x', 'y'], ['1', '2'], ['3', '4']]);
  // No table in the photo.
  assert.equal(I.buildTable(I.parseScanReply('{"columns":[],"rows":[]}').grid).cols.length, 0);
});

/* A real .xlsx, built the way Excel writes one: shared strings for text,
   numbers inline, a formula with its cached value, and a second sheet. */
function zip(files) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameB = enc.encode(name), raw = enc.encode(text), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, Buffer.from(nameB), data);
    centrals.push(ch, Buffer.from(nameB));
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test('Excel workbooks: shared strings, formulas, gaps, and every sheet', async () => {
  const book = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Trial 1" sheetId="1" r:id="rId1"/><sheet name="Notes &amp; misc" sheetId="2" r:id="rId2"/><sheet name="Old" sheetId="3" state="hidden" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Type="x" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Voltage (V)</t></si><si><r><t>Current </t></r><r><t>(mA)</t></r></si><si><t>ok</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2"><v>1.5</v></c><c r="B2"><f>A2*20</f><v>30.000000000000004</v></c></row>'
      + '<row r="3"/>'
      + '<row r="4"><c r="A4"><v>3</v></c><c r="C4" t="s"><v>2</v></c></row>'
      + '</sheetData></worksheet>',
    'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>just words</t></is></c></row></sheetData></worksheet>',
    'xl/worksheets/sheet3.xml': '<worksheet><sheetData><row r="1"><c r="A1"><v>9</v></c></row></sheetData></worksheet>',
  });
  const sheets = await I.readXLSX(book);
  same(sheets.map((s) => s.name), ['Trial 1', 'Notes & misc']);        // the hidden sheet is left out
  same(sheets[0].grid, [['Voltage (V)', 'Current (mA)'], ['1.5', '30'], ['3', '', 'ok']]);
  const t = I.buildTable(sheets[0].grid);
  same(shape(t), { cols: [['Voltage', 'V', 'value'], ['Current', 'mA', 'value'], ['', '', 'value']], rows: [['1.5', '30', ''], ['3', '', 'ok']] });
  await assert.rejects(() => I.readXLSX(new TextEncoder().encode('not a zip at all, just text')), /not an Excel workbook/);
});

test('the scan prompt asks for the digits as written, and nothing invented', () => {
  assert.match(I.SCAN_SYSTEM, /exactly as written/);
  assert.match(I.SCAN_SYSTEM, /Never calculate, round, correct or fill in/);
  assert.match(I.SCAN_SYSTEM, /"columns":\[\],"rows":\[\]/);
});
