import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Study tools — DP expansion', () => {
  test('toolbox renders the native study-hub subject rail', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    // The Study Hub rebuild replaced the legacy #stSubjectHost IB sections with a
    // native subject rail (#fshRoot/#fshRail). Assert by data-sub so the icon glyph
    // inside each pill doesn't pollute the comparison.
    const { hubRendered, subjects } = await page.evaluate(() => ({
      hubRendered: !!document.getElementById('fshRoot'),
      subjects: [...document.querySelectorAll('#fshRail .fsh-pill')].map(
        (e) => (e as HTMLElement).dataset.sub || '',
      ),
    }));
    expect(hubRendered, 'native study hub (#fshRoot) did not render').toBe(true);
    expect(subjects).toEqual([
      'chemistry',
      'physics',
      'math',
      'music',
      'biology',
      'psychology',
      'cs',
      'econ',
      'english',
      'history',
      'languages',
      'astronomy',
    ]);
  });

  test('psychology is its own subject, not a biology sub-tab', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(async () => {
      const hub = (window as any).fluxStudyHub;
      const names = (sid: string) => {
        hub.selectSubject(sid);
        return [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')].map((t) =>
          (t.textContent || '').trim(),
        );
      };
      const bio = names('biology');
      await new Promise((r) => setTimeout(r, 300));
      const psych = names('psychology');
      await new Promise((r) => setTimeout(r, 300));
      return { bio, psych };
    });
    expect(res.bio.some((n) => /psych/i.test(n))).toBe(false);
    expect(res.psych.some((n) => /psych/i.test(n))).toBe(true);
  });

  test('physics has a single formula sheet tab', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const tabs = await page.evaluate(async () => {
      (window as any).fluxStudyHub.selectSubject('physics');
      await new Promise((r) => setTimeout(r, 300));
      return [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')].map((t) =>
        (t.textContent || '').trim(),
      );
    });
    expect(tabs.filter((n) => /formula/i.test(n))).toHaveLength(1);
  });

  test('search finds chemistry built-in tabs and subjects; "/" focuses hub search only on Study tab', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const search = await page.evaluate(async () => {
      const si = document.getElementById('fshSearch') as HTMLInputElement;
      si.value = 'atom';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const atomHit = [...document.querySelectorAll('#fshStage .fsh-res-title')].some(
        (e) => e.textContent === '3D Atom Model',
      );
      si.value = 'physics';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      const subjHit = !!document.querySelector('#fshStage [data-act="open-sub"][data-sid="physics"]');
      si.value = '';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      return { atomHit, subjHit };
    });
    expect(search.atomHit, 'search "atom" should surface the 3D Atom chemistry tab').toBe(true);
    expect(search.subjHit, 'search "physics" should surface the subject shortcut').toBe(true);

    // "/" focuses the hub search while on the Study tab…
    const onStudy = await page.evaluate(async () => {
      (document.activeElement as HTMLElement)?.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 200));
      return document.activeElement?.id;
    });
    expect(onStudy).toBe('fshSearch');

    // …and still opens the app AI panel from any other tab
    const offStudy = await page.evaluate(async () => {
      (window as any).nav?.('dashboard');
      await new Promise((r) => setTimeout(r, 150));
      (document.activeElement as HTMLElement)?.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 300));
      return { panel: (window as any).__fluxLastNavPanel, focused: document.activeElement?.id };
    });
    // the app's own "/" shortcut must still win off the Study tab
    expect(offStudy.panel).toBe('ai');
    expect(offStudy.focused).not.toBe('fshSearch');
  });

  test('all new DP reference tools open with content and tabs', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const fns = [
        'openPsychReference',
        'openLitReference',
        'openGermanReference',
        'openGlobalPoliticsReference',
        'openVisualArtsReference',
        'openMusicTheoryReference',
        'openMathAnalysisReference',
        'openHistorySkillsReference',
      ];
      const out: Record<string, { opened: boolean; content: boolean; tabs: number; err: string | null }> = {};
      for (const fn of fns) {
        document.querySelectorAll('[class*="tool-modal"], .ref-tool-modal').forEach((m) => m.remove());
        let opened = false, content = false, tabs = 0, err: string | null = null;
        try {
          (window as any)[fn]();
          await new Promise((r) => setTimeout(r, 150));
          const modal = document.querySelector('[class*="tool-modal"], .ref-tool-modal');
          opened = !!modal;
          if (modal) {
            content = (modal as HTMLElement).innerText.length > 100;
            tabs = modal.querySelectorAll('[class*="tab"]').length;
          }
        } catch (e: any) { err = String(e?.message || e); }
        out[fn] = { opened, content, tabs, err };
        document.querySelectorAll('[class*="tool-modal"], .ref-tool-modal').forEach((m) => m.remove());
      }
      return out;
    });
    for (const fn of Object.keys(res)) {
      expect(res[fn].err, `${fn} threw`).toBeNull();
      expect(res[fn].opened, `${fn} did not open`).toBe(true);
      expect(res[fn].content, `${fn} had no content`).toBe(true);
      expect(res[fn].tabs, `${fn} had no tabs`).toBeGreaterThan(0);
    }
  });

  test('reorganization preserved inline tool rendering', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const tb = (window as any).fluxToolbox;
      const scratch = document.createElement('div');
      document.body.appendChild(scratch);
      // Every inline tool referenced by the new layout must still render.
      const layout = tb.UNIFIED_LAYOUT as any[];
      const broken: string[] = [];
      for (const sec of layout) {
        for (const t of sec.tools) {
          if (t.mode !== 'inline') continue;
          const subj = tb.SUBJECTS.find((s: any) => s.id === t.sub);
          const tool = subj?.tools.find((x: any) => x.id === t.tid);
          scratch.innerHTML = '';
          try {
            tool.render(scratch);
            if (scratch.innerHTML.length < 20) broken.push(`${t.sub}/${t.tid} (empty)`);
          } catch (e: any) {
            broken.push(`${t.sub}/${t.tid} (${e?.message || e})`);
          }
        }
      }
      scratch.remove();
      return { broken };
    });
    expect(res.broken).toEqual([]);
  });
});

/*
 * Favourites used to be per-device: flux_study_hub was saved locally but was
 * missing from getCloudPayload(), so starring Biology on a laptop left the
 * phone showing the default order. These guard the round trip and, just as
 * importantly, the failure modes — a slice that arrives half-written must
 * never silently unstar everything.
 */
test.describe('Study tools — favourite subjects sync', () => {
  test('starred subjects reach the cloud payload', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(() => {
      const hub = (window as any).fluxStudyHub;
      const star = (id: string) =>
        document.querySelector<HTMLElement>(`#fshRail .fsh-fav-btn[data-fav="${id}"]`)?.click();
      star('biology');
      star('physics');
      const payload = (window as any).getCloudPayload?.();
      return { local: hub.getCloudSlice().favs, sent: payload?.studyHub?.favs };
    });

    expect(res.local).toEqual(['biology', 'physics']);
    // The half that was missing: it has to be in what actually gets uploaded.
    expect(res.sent).toEqual(['biology', 'physics']);
  });

  test('a slice from another device re-sorts the rail', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(() => {
      const hub = (window as any).fluxStudyHub;
      hub.applyFromCloud({ favs: ['biology', 'physics'] });
      const kids = [...(document.getElementById('fshRail')?.children || [])];
      return {
        favs: hub.getCloudSlice().favs,
        // Favourites sort to the front, then a divider, then the rest.
        leading: kids.slice(0, 2).map((k) => k.querySelector<HTMLElement>('.fsh-pill')?.dataset.sub),
        separatorAt: kids.findIndex((k) => k.classList.contains('fsh-rail-sep')),
      };
    });

    expect(res.favs).toEqual(['biology', 'physics']);
    expect(res.leading.sort()).toEqual(['biology', 'physics']);
    expect(res.separatorAt).toBe(2);
  });

  test('a half-written slice never unstars what you already had', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    const res = await page.evaluate(() => {
      const hub = (window as any).fluxStudyHub;
      hub.applyFromCloud({ favs: ['biology'] });
      const after: Record<string, string[]> = {};
      hub.applyFromCloud({ subject: 'physics' });           // favs absent
      after.missing = hub.getCloudSlice().favs.slice();
      hub.applyFromCloud({ favs: null });                    // favs null
      after.nulled = hub.getCloudSlice().favs.slice();
      hub.applyFromCloud(null);                              // no record at all
      after.noRecord = hub.getCloudSlice().favs.slice();
      hub.applyFromCloud({ favs: ['physics', 42, null] });   // mixed junk
      after.junk = hub.getCloudSlice().favs.slice();
      return after;
    });

    expect(res.missing).toEqual(['biology']);
    expect(res.nulled).toEqual(['biology']);
    expect(res.noRecord).toEqual(['biology']);
    // Non-strings dropped rather than stored and later rendered as pills.
    expect(res.junk).toEqual(['physics']);
  });

  test('an id with no subject behind it does not shift the divider', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav?.('toolbox'));
    await page.waitForTimeout(800);

    // Renamed subjects and older app versions both produce ids that no longer
    // match anything. The divider is placed from how many favourites actually
    // resolved to a subject; counting the raw list put it slots too far right,
    // stranding it after subjects you never starred.
    const res = await page.evaluate(() => {
      const hub = (window as any).fluxStudyHub;
      hub.applyFromCloud({ favs: ['biology', 'ghost-subject', 'maths'] });
      const kids = [...(document.getElementById('fshRail')?.children || [])];
      return {
        separatorAt: kids.findIndex((k) => k.classList.contains('fsh-rail-sep')),
        faved: kids.filter((k) => k.classList.contains('faved')).length,
      };
    });

    expect(res.faved).toBe(1);
    expect(res.separatorAt).toBe(1);
  });
});
