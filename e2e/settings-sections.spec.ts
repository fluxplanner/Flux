import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Settings is a list down the side now, not a row of tabs across the top.
 *
 * The row held eight tabs covering wildly uneven amounts: "Look" carried
 * eleven cards while "About" carried one, and by eight items the pills were
 * squeezed narrower than their own labels needed. "Look" is now three sections
 * — Theme, Text & reading, Layout — which is ten in total, and a vertical list
 * has room for all ten.
 *
 * Two ids survived renames on purpose, and that is what these tests mostly
 * exist to protect. switchStab resolves panes by string concatenation —
 * `spane-` + id — so a rename never throws; it quietly matches nothing.
 *
 *  - `data`: flux-email-task-inbox.js:449 and flux-automation-hooks.js:211
 *    both call switchStab('data') to reveal their own injected card.
 *  - `appearance`, now labelled "Layout": eight modules inject a settings card
 *    straight into #spane-appearance — flux-i18n, flux-connectors,
 *    flux-pulse-layout, flux-pulse-perf, flux-site-enhancements and
 *    flux-ai-providers-ui. Renaming it would have made six features' settings
 *    disappear with no error anywhere.
 */
test.describe('Settings sections', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'settings');
    await expect(page.locator('#settings.panel.active')).toBeVisible();
  });

  test('has ten sections, each with a pane behind it', async ({ page }) => {
    const wiring = await page.evaluate(() =>
      [...document.querySelectorAll('#settings .stab')].map((btn) => {
        const onclick = btn.getAttribute('onclick') || '';
        const id = (onclick.match(/switchStab\('([^']+)'/) || [])[1] || '';
        return { label: btn.textContent!.trim(), id, hasPane: !!document.getElementById('spane-' + id) };
      }),
    );

    expect(wiring.map((w) => w.label)).toEqual([
      // "Look" was eleven cards doing three jobs, so it is three sections now:
      // what the app looks like, what makes it readable, and where things sit.
      'Theme',
      'Text & reading',
      'Layout',
      'Alerts',
      'Connections',
      'AI',
      'Account',
      'Your data',
      'Help',
      'About',
    ]);
    // Every tab must point at a pane that exists. A tab whose pane is missing
    // looks selected but leaves the previous section's cards on screen —
    // silent, and the exact failure a rename of `spane-data` would produce.
    expect(wiring.filter((w) => !w.hasPane)).toEqual([]);

    /* `appearance` has to survive the rename to "Layout".
       Eight modules inject their own settings card into #spane-appearance —
       flux-i18n, flux-connectors, flux-pulse-layout, flux-pulse-perf,
       flux-site-enhancements and flux-ai-providers-ui — and not one of them
       throws when it is missing; they look it up, find nothing, and inject
       nowhere. A rename would have made six features' settings vanish with no
       error anywhere, which is why the id is asserted and not just the label. */
    expect(wiring.find((w) => w.label === 'Layout')?.id,
      'Layout must still be spane-appearance — six modules inject into it').toBe('appearance');
  });

  test('each new section shows its own cards and nothing else', async ({ page }) => {
    const headingsFor = (id: string) =>
      page.evaluate((paneId) => {
        const btn = [...document.querySelectorAll('#settings .stab')].find((b) =>
          (b.getAttribute('onclick') || '').includes(`'${paneId}'`),
        ) as HTMLButtonElement | undefined;
        btn?.click();
        const pane = document.getElementById('spane-' + paneId)!;
        return {
          active: pane.classList.contains('active'),
          activeCount: document.querySelectorAll('#settings .spane.active').length,
          headings: [...pane.querySelectorAll('h3')].map((h) => h.textContent!.trim()),
        };
      }, id);

    const data = await headingsFor('data');
    expect(data.active).toBe(true);
    expect(data.activeCount).toBe(1);
    expect(data.headings).toContain('Your data');
    expect(data.headings).toContain('Local storage');
    expect(data.headings).toContain('Your privacy');

    const help = await headingsFor('help');
    expect(help.active).toBe(true);
    expect(help.headings).toEqual([
      'Planner tour',
      'Keyboard',
      'FAQ',
      'Send feedback',
      'For schools & families',
    ]);

    const about = await headingsFor('about');
    expect(about.active).toBe(true);
    expect(about.headings).toContain('Tech Stack');
    expect(about.headings).toContain("What's changed");
    expect(about.headings).toContain('Your Flux Stats');
  });

  test('the cards other modules inject still land in a real pane', async ({ page }) => {
    // switchStab('data') is the escape hatch two modules use to reveal their
    // own card. It has to keep resolving, and the pane it lands on has to be
    // the one holding their mount points.
    const landed = await page.evaluate(() => {
      (window as unknown as { switchStab: (id: string) => void }).switchStab('data');
      const pane = document.getElementById('spane-data')!;
      return {
        active: pane.classList.contains('active'),
        mounts: ['fluxStorageRepairMount', 'fluxSyncConflictSettingsMount', 'fluxClaudeConnectMount'].map(
          (id) => document.getElementById(id)?.closest('.spane')?.id || 'absent',
        ),
      };
    });
    expect(landed.active).toBe(true);
    expect(landed.mounts).toEqual(['spane-data', 'spane-data', 'spane-data']);
  });

  test('on a phone every section is visible without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Eight tabs are ~570px of buttons. In one row they overflowed a 345px
    // strip by 586px with no edge cue, so Your data / Help / About sat off
    // screen entirely with nothing to suggest they existed.
    const strip = await page.evaluate(() => {
      const s = document.querySelector('#settings .stabs') as HTMLElement;
      const tabs = [...s.querySelectorAll('.stab')] as HTMLElement[];
      const box = s.getBoundingClientRect();
      return {
        rows: new Set(tabs.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        clipped: tabs.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < box.left - 1 || r.right > box.right + 1;
        }).length,
      };
    });
    expect(strip.rows).toBeGreaterThan(1);
    expect(strip.clipped).toBe(0);
  });

  test('every control in every section is big enough to tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    /*
     * Hit-tested, not measured. Painted size is not tap size: most of the
     * small-looking controls here — the switches, the accent swatches — are
     * drawn at 20-23px on purpose and carry an invisible ::before or ::after
     * expander that makes them 44. Reading offsetHeight alone reported ~70
     * failures that were not real; probing with elementFromPoint found the one
     * that was (Set custom accent, at 35px).
     *
     * Every pane is checked, not just the open one, by activating each in turn.
     */
    const bad = await page.evaluate(() => {
      const reach = (el: Element) => {
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return null;
        let up = 0;
        let down = 0;
        for (let d = 0; d <= 22; d++) {
          const e = document.elementFromPoint(cx, cy - d);
          if (e === el || el.contains(e)) up = d; else break;
        }
        for (let d = 0; d <= 22; d++) {
          const e = document.elementFromPoint(cx, cy + d);
          if (e === el || el.contains(e)) down = d; else break;
        }
        return up + down;
      };

      const out: string[] = [];
      document.querySelectorAll('#settings .spane').forEach((pane) => {
        const was = pane.classList.contains('active');
        if (!was) pane.classList.add('active');
        pane
          .querySelectorAll('button,select,input:not([type=hidden]),a[href],summary')
          .forEach((el) => {
            const h = (el as HTMLElement).offsetHeight;
            if (!h || !(el as HTMLElement).offsetWidth || h >= 44) return;
            const v = reach(el);
            // 43 is what a genuine 44px box reads back: the probe steps +/-21.5
            // from the centre and counts whole pixels.
            if (v !== null && v < 43) {
              out.push(`${pane.id} ${el.id || el.tagName} paint=${h} reach=${v}`);
            }
          });
        if (!was) pane.classList.remove('active');
      });
      return out;
    });

    expect(bad, `controls too small to tap:\n${bad.join('\n')}`).toEqual([]);
  });

  /*
   * Changing your own password used to be impossible. The accounts were made
   * with generated passwords, and with no email on file there is no reset link
   * — so the one thing every account should be able to do was the one thing
   * none of them could, short of messaging the owner.
   *
   * Runs on teacher-workflow, not the describe's student-semester: that
   * scenario has needsUser:false and therefore no mock Supabase client, so
   * #accountSignedIn stays hidden and every assertion below would pass by
   * looking at nothing.
   */
  test('you can change your own password, and a mistyped one is refused', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await openSidebarTab(page, 'settings');
    await page.evaluate(() => (window as unknown as { switchStab: (s: string) => void }).switchStab('account'));
    await expect(page.locator('#spane-account')).toHaveClass(/\bactive\b/);

    // Signed in, or the form is correctly hidden and this proves nothing.
    await expect(page.locator('#accountSignedIn')).toBeVisible();
    for (const id of ['pwCurrent', 'pwNew', 'pwNew2']) {
      await expect(page.locator(`#${id}`), `${id} is missing from Settings → Account`).toBeVisible();
    }

    const attempt = (cur: string, a: string, b: string) => page.evaluate(async ([c, x, y]) => {
      const w = window as unknown as { fluxChangePassword: () => Promise<void> };
      (document.getElementById('pwCurrent') as HTMLInputElement).value = c;
      (document.getElementById('pwNew') as HTMLInputElement).value = x;
      (document.getElementById('pwNew2') as HTMLInputElement).value = y;
      await w.fluxChangePassword();
      return document.getElementById('pwMsg')?.textContent || '';
    }, [cur, a, b]);

    /* The two that matter most. Without an email there is no way back from
       either mistake, so both have to be caught before anything is sent. */
    expect(await attempt('oldpass123', 'freshpass9', 'freshpass8'),
      'two different new passwords were accepted').toMatch(/not the same/i);
    expect(await attempt('', 'freshpass9', 'freshpass9'),
      'the current password was not required').toMatch(/current password/i);
  });
});
