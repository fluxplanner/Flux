import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Self-controlled DOM translator', () => {
  test('FluxI18nDOM loads and reverse-maps the existing dictionary', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const DOM = (window as any).FluxI18nDOM;
      const dict = DOM?._buildDict?.('es-US');
      return {
        moduleType: typeof DOM,
        hasTranslate: typeof DOM?.translatePage,
        hasRestore: typeof DOM?.restoreEnglish,
        dictSize: dict ? dict.size : 0,
        close: dict ? dict.get('Close') : null,
      };
    });
    expect(res.moduleType).toBe('object');
    expect(res.hasTranslate).toBe('function');
    expect(res.hasRestore).toBe('function');
    expect(res.dictSize).toBeGreaterThan(10);
    expect(res.close).toBe('Cerrar');
  });

  test('translates text, attributes, and form placeholders — and restores', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const DOM = (window as any).FluxI18nDOM;
      const el = document.createElement('div');
      el.id = '__i18n_e2e';
      el.innerHTML =
        '<span class="t">Close</span>' +
        '<button title="Dashboard" aria-label="Done">Keep mine</button>' +
        '<input placeholder="Close">';
      document.body.appendChild(el);

      DOM.translatePage('es-US');
      await new Promise((r) => setTimeout(r, 250));
      const after = {
        span: el.querySelector('.t')!.textContent,
        btnText: el.querySelector('button')!.textContent,
        title: el.querySelector('button')!.getAttribute('title'),
        aria: el.querySelector('button')!.getAttribute('aria-label'),
        placeholder: el.querySelector('input')!.getAttribute('placeholder'),
      };

      DOM.restoreEnglish();
      await new Promise((r) => setTimeout(r, 250));
      const restored = {
        span: el.querySelector('.t')!.textContent,
        title: el.querySelector('button')!.getAttribute('title'),
        placeholder: el.querySelector('input')!.getAttribute('placeholder'),
      };
      el.remove();
      return { after, restored };
    });

    expect(res.after.span).toBe('Cerrar');
    expect(res.after.btnText).toBe('Mantener la mía');
    expect(res.after.title).toBe('Panel');
    expect(res.after.aria).toBe('Hecho');
    expect(res.after.placeholder).toBe('Cerrar'); // form placeholders translate
    // Full reversal
    expect(res.restored.span).toBe('Close');
    expect(res.restored.title).toBe('Dashboard');
    expect(res.restored.placeholder).toBe('Close');
  });

  test('does not translate code/no-i18n subtrees', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const DOM = (window as any).FluxI18nDOM;
      const el = document.createElement('div');
      el.id = '__i18n_skip';
      el.innerHTML =
        '<code>Close</code>' +
        '<span data-no-i18n="">Close</span>' +
        '<span class="ok">Close</span>';
      document.body.appendChild(el);
      DOM.translatePage('es-US');
      await new Promise((r) => setTimeout(r, 250));
      const out = {
        code: el.querySelector('code')!.textContent,
        noI18n: el.querySelector('[data-no-i18n]')!.textContent,
        ok: el.querySelector('.ok')!.textContent,
      };
      DOM.restoreEnglish();
      el.remove();
      return out;
    });
    expect(res.code).toBe('Close');     // code untouched
    expect(res.noI18n).toBe('Close');   // explicit opt-out untouched
    expect(res.ok).toBe('Cerrar');      // normal text translated
  });

  test('live observer translates dynamically-added nodes', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const DOM = (window as any).FluxI18nDOM;
      DOM.translatePage('es-US'); // activates observer
      await new Promise((r) => setTimeout(r, 200));
      // Add a node AFTER translation — observer should catch it
      const el = document.createElement('div');
      el.id = '__i18n_live';
      el.innerHTML = '<span class="live">Done</span>';
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 300));
      const live = el.querySelector('.live')!.textContent;
      DOM.restoreEnglish();
      el.remove();
      return { live };
    });
    expect(res.live).toBe('Hecho');
  });

  test('Arabic sets dir=rtl and the RTL stylesheet applies', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      (window as any).FluxI18n.setLocale('ar-SA');
      await new Promise((r) => setTimeout(r, 300));
      // Capture direction state WHILE Arabic is active (before we restore below).
      const dir = document.documentElement.dir;
      const lang = document.documentElement.lang;
      // body text-align flips (proves flux-rtl.css cascaded)
      const bodyAlign = getComputedStyle(document.body).textAlign;
      // Confirm flux-rtl.css actually shipped the app-shell flip rule (CSSOM),
      // independent of viewport/!important overrides that vary by test width.
      let appFlipRule = false;
      for (const sheet of document.styleSheets) {
        if (!(sheet.href || '').includes('flux-rtl')) continue;
        try {
          for (const r of (sheet as CSSStyleSheet).cssRules) {
            const sr = (r as CSSStyleRule).selectorText || '';
            if (sr.includes('#app.visible') && (r as CSSStyleRule).style.flexDirection === 'row-reverse') {
              appFlipRule = true;
            }
          }
        } catch (_) { /* cross-origin sheet — skip */ }
      }
      // restore to English so we don't leave the page in RTL for other state
      (window as any).FluxI18n.setLocale('en-US');
      return { dir, lang, bodyAlign, appFlipRule };
    });
    expect(res.dir).toBe('rtl');
    expect(res.lang).toBe('ar');
    expect(res.bodyAlign).toBe('right');       // flux-rtl.css cascaded
    expect(res.appFlipRule).toBe(true);        // app-shell row-reverse rule shipped
  });
});
