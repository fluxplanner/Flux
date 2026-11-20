import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

/**
 * flux-ib-notes.js and public/data/ib-notes: the starter notes behind "Start
 * with notes" in Flux Tutor's syllabus. has() answers from the SUBJECTS list
 * without fetching, so every unit of a listed subject must have notes, and the
 * notes must give Tutor enough to build a guide with real key terms.
 */
const js = new URL('../../public/js/', import.meta.url);
const data = new URL('../../public/data/ib-notes/', import.meta.url);
const sandbox = { URL };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['flux-ib-syllabus.js', 'flux-ib-notes.js', 'flux-tutor-core.js']) {
  vm.runInContext(readFileSync(new URL(f, js), 'utf8'), sandbox, { filename: f });
}
const IB = sandbox.FluxIbSyllabus;
const N = sandbox.FluxIbNotes;
const T = sandbox.FluxTutor;
const files = readdirSync(data).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const notes = Object.fromEntries(files.map((sid) => [sid, JSON.parse(readFileSync(new URL(sid + '.json', data), 'utf8'))]));

test('SUBJECTS lists exactly the subjects that have a notes file', () => {
  assert.equal(N.subjects().slice().sort().join(', '), files.join(', '));
});

test('every unit of a listed subject has notes, and every note is for a real unit', () => {
  for (const sid of files) {
    const subj = IB.subjects().find((s) => s.id === sid);
    assert.ok(subj, sid + ': not a syllabus subject');
    const titles = subj.units.map((u) => u.title);
    const missing = titles.filter((t) => typeof notes[sid][t] !== 'string' || !notes[sid][t].trim());
    const extra = Object.keys(notes[sid]).filter((t) => !titles.includes(t));
    assert.equal(missing.join('; '), '', sid + ': units without notes');
    assert.equal(extra.join('; '), '', sid + ': notes for no unit');
    for (const u of subj.units) assert.ok(N.has(u.id), u.id);
  }
});

test('each note gives Tutor a guide with at least four key terms', () => {
  const thin = [];
  for (const sid of files) {
    for (const [title, text] of Object.entries(notes[sid])) {
      const sources = [T.newSource(N.SOURCE_NAME, 'Notes', text)];
      const guide = T.buildGuide(sources, { corpus: T.buildCorpus(sources) });
      if (guide.terms.length < 4) thin.push(sid + ' / ' + title + ' (' + guide.terms.length + ')');
    }
  }
  assert.equal(thin.join('; '), '');
});

test('load() returns the unit’s notes by title, and nothing for a subject without notes', async () => {
  const unit = IB.subjects().find((s) => s.id === files[0]).units[0];
  sandbox.fetch = async (url) => {
    const sid = decodeURIComponent(String(url).split('/').pop().replace(/\.json$/, ''));
    return { ok: true, json: async () => notes[sid] };
  };
  assert.equal(await N.load(unit.id), notes[files[0]][unit.title]);
  const other = IB.subjects().find((s) => !files.includes(s.id));
  if (other) assert.equal(await N.load(other.units[0].id), '');
});
