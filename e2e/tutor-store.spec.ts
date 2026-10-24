import { test, expect, Page } from '@playwright/test';

/*
 * flux-tutor-store.js in a real browser: the IndexedDB path that the node
 * unit tests (test/unit/tutor-store.test.mjs) cannot run. The store is loaded
 * on a plain page (privacy.html has no scripts of its own), so this is about
 * saving only; the Tutor screens have their own spec.
 */

async function load(page: Page) {
  await page.goto('/privacy.html');
  await page.addScriptTag({ url: '/public/js/flux-tutor-core.js' });
  await page.addScriptTag({ url: '/public/js/flux-tutor-store.js' });
}

const BETA = {
  draft: { topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material: 'Allele frequency is how common an allele is in a population.', question: '', attachments: [] },
  session: {
    topic: 'Natural selection', subject: 'Biology', sourceTitle: 'Class notes', sourceUrl: '', material: 'Allele frequency is how common an allele is in a population.',
    attachments: [], question: '', warmup: 'Survival of the fittest?', teachback: 'Useful traits spread.', explain: { 0: 'How common an allele is.' }, answers: {},
    confidence: 'teach-it', step: 3, noteIndex: 0, questionIndex: 0, showSource: false, completedAt: '',
  },
};

test.describe('Flux Tutor library store', () => {
  test('IndexedDB: save, rename, duplicate, delete with undo, export and import, and it is all there after a reload', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    const first = await page.evaluate(async () => {
      const w = window as any;
      const T = w.FluxTutor;
      const store = await w.FluxTutorStore.open();
      const set = T.sampleSet();
      set.guide = T.buildGuide(set.sources);
      const saved = await store.save(set);
      const renamed = await store.rename(set.id, 'Biology unit 2');
      const dup = await store.duplicate(set.id);
      await store.remove(dup.set.id);
      const afterDelete = (await store.list()).sets.map((m: any) => m.title);
      const bin = (await store.list({ deleted: true })).sets.map((m: any) => m.title);
      await store.restore(dup.set.id);
      const exp = await store.exportSet(set.id);
      const imp = await store.importText(exp.text);
      return {
        backend: store.backend, warning: store.warning, saved: saved.ok, renamed: renamed.ok, terms: saved.meta.terms, guideTerms: set.guide.terms.length,
        afterDelete, bin, id: set.id, importedNewId: imp.sets[0].id !== set.id,
        titles: (await store.list()).sets.map((m: any) => m.title).sort(),
      };
    });
    expect(first.backend).toBe('indexeddb');
    expect(first.warning).toBe('');
    expect(first.saved && first.renamed).toBe(true);
    expect(first.terms).toBe(first.guideTerms);
    expect(first.afterDelete).toEqual(['Biology unit 2']);
    expect(first.bin).toEqual(['Biology unit 2 (copy)']);
    expect(first.importedNewId).toBe(true);
    expect(first.titles).toEqual(['Biology unit 2', 'Biology unit 2', 'Biology unit 2 (copy)']);

    await load(page);
    const second = await page.evaluate(async (id) => {
      const w = window as any;
      const store = await w.FluxTutorStore.open();
      const set = await store.get(id);
      return {
        title: set.title, terms: set.guide.terms.length, count: (await store.list()).sets.length,
        lsKeys: Object.keys(localStorage).filter((k) => k.startsWith('flux_tutor')),
      };
    }, first.id);
    expect(second.title).toBe('Biology unit 2');
    expect(second.terms).toBe(first.guideTerms);
    expect(second.count).toBe(3);
    expect(second.lsKeys).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the first beta\'s session moves into IndexedDB, and sets left in localStorage move over too', async ({ page }) => {
    await page.goto('/privacy.html');
    await page.evaluate((beta) => {
      localStorage.setItem('flux_teacher.beta.v1', JSON.stringify(beta));
      localStorage.setItem('flux_tutor.v2.set.set-fallback1', JSON.stringify({ id: 'set-fallback1', title: 'Saved in the backup storage', updatedAt: '2026-10-01T00:00:00.000Z', sources: [] }));
    }, BETA);
    await load(page);
    const r = await page.evaluate(async () => {
      const w = window as any;
      const store = await w.FluxTutorStore.open();
      const m = await store.migrateLegacy();
      const set = await store.get(m.ids[0]);
      return {
        migrated: m.migrated,
        titles: (await store.list()).sets.map((s: any) => s.title).sort(),
        teachback: set.legacy.notes.some((n: any) => n.text === 'Useful traits spread.'),
        legacy: localStorage.getItem('flux_teacher.beta.v1'),
        fallback: localStorage.getItem('flux_tutor.v2.set.set-fallback1'),
      };
    });
    expect(r.migrated).toBe(1);
    expect(r.titles).toEqual(['Natural selection', 'Saved in the backup storage']);
    expect(r.teachback).toBe(true);
    expect(r.legacy).toBeNull();
    expect(r.fallback).toBeNull();
  });

  test('a copy written as a tab closes moves in on the next open, unless another tab saved the set since; its key goes either way', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(async () => {
      const w = window as any;
      const T = w.FluxTutor;
      const keys = () => Object.keys(localStorage).filter((k) => k.startsWith('flux_tutor.v2.set.'));
      const a = await w.FluxTutorStore.open({ BroadcastChannel: null });
      const set = T.newSet({ title: 'Typed before closing' });
      await a.save(set);
      // The tab closes while its autosave is still waiting: the quick copy is written, the IndexedDB write never happens.
      const mine = await a.get(set.id);
      mine.subject = 'Kept';
      a.autosave(mine);
      a.writeEarlyCopies();
      a.discard(set.id);
      const keysAfterClose = keys();
      const next = await w.FluxTutorStore.open({ BroadcastChannel: null });
      const kept = (await next.get(set.id)).subject;
      const keysAfterOpen = keys();
      // Again, but another tab saves the set before the next open: its newer work wins.
      const again = await next.get(set.id);
      again.subject = 'From the closing tab';
      next.autosave(again);
      next.writeEarlyCopies();
      next.discard(set.id);
      const other = await w.FluxTutorStore.open({ BroadcastChannel: null });
      const theirs = await other.get(set.id);
      theirs.subject = 'From the other tab';
      await other.save(theirs);
      const third = await w.FluxTutorStore.open({ BroadcastChannel: null });
      return { keysAfterClose: keysAfterClose.length, kept, keysAfterOpen, final: (await third.get(set.id)).subject, keysAtEnd: keys() };
    });
    expect(r.keysAfterClose).toBe(1);
    expect(r.kept).toBe('Kept');
    expect(r.keysAfterOpen).toEqual([]);
    expect(r.final).toBe('From the other tab');
    expect(r.keysAtEnd).toEqual([]);
  });

  test('a save in one tab is announced to another tab', async ({ page, context }) => {
    await load(page);
    const other = await context.newPage();
    await load(other);
    await other.evaluate(async () => {
      const w = window as any;
      w.__changes = [];
      w.__store = await w.FluxTutorStore.open();
      w.__store.onChange((c: any) => w.__changes.push(c));
    });
    const id = await page.evaluate(async () => {
      const w = window as any;
      const store = await w.FluxTutorStore.open();
      const set = w.FluxTutor.newSet({ title: 'From the first tab' });
      await store.save(set);
      return set.id;
    });
    await expect.poll(() => other.evaluate(() => (window as any).__changes)).toEqual([{ id, type: 'saved', fromOtherTab: true }]);
    const title = await other.evaluate(async (setId) => (await (window as any).__store.get(setId)).title, id);
    expect(title).toBe('From the first tab');
  });
});
