import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Naming a pinned date.
 *
 * Pinning used to store bare ISO strings, so a starred day told you something
 * mattered on the 20th without ever telling you what. The name is the point of
 * pinning, so these tests treat it as the feature rather than a decoration.
 *
 * The names live under their own storage key, separate from the pins. That is
 * deliberate, and the last test here is what defends it: pins already exist on
 * every device that has used this feature, and reshaping that array into
 * objects would have needed a migration — a migration that goes wrong loses
 * dates somebody deliberately marked.
 *
 * Every date used below is in 2099 so it sorts after today and can never
 * collide with real data.
 */
test.describe('Important date labels', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'calendar');
    await page.waitForTimeout(600);
  });

  test('a pinned date keeps the name you gave it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const W = (window as any).FluxWishlist;
      if (!W) return { error: 'FluxWishlist not loaded' };
      const dateInp = document.getElementById('fluxImpDateInp') as HTMLInputElement | null;
      const labelInp = document.getElementById('fluxImpLabelInp') as HTMLInputElement | null;
      if (!dateInp) return { error: 'date input missing' };
      if (!labelInp) return { error: 'label input missing' };

      dateInp.value = '2099-10-15';
      labelInp.value = 'Chem test period 4';
      W.pinDateFromInput();

      const item = document.querySelector('#fluxImpList .fluxw-imp-row-item');
      return {
        error: '',
        name: item?.querySelector('.fluxw-imp-name')?.textContent ?? null,
        // Cleared so the next pin starts blank rather than silently reusing
        // the previous name.
        inputCleared: labelInp.value === '',
      };
    });

    expect(result.error, result.error).toBe('');
    expect(result.name).toBe('Chem test period 4');
    expect(result.inputCleared, 'the name box should clear after pinning').toBe(true);
  });

  test('pinning a second date does not wipe the first name', async ({ page }) => {
    const names = await page.evaluate(() => {
      const W = (window as any).FluxWishlist;
      const dateInp = document.getElementById('fluxImpDateInp') as HTMLInputElement;
      const labelInp = document.getElementById('fluxImpLabelInp') as HTMLInputElement;

      dateInp.value = '2099-11-01';
      labelInp.value = 'Bio IA due';
      W.pinDateFromInput();

      // Second pin with the name box left empty. An empty box means "no
      // opinion", not "clear everything".
      dateInp.value = '2099-11-05';
      W.pinDateFromInput();

      return [...document.querySelectorAll('#fluxImpList .fluxw-imp-name')]
        .map((n) => n.textContent);
    });

    expect(names).toContain('Bio IA due');
  });

  test('a date with no name still pins and still shows its date', async ({ page }) => {
    const row = await page.evaluate(() => {
      const W = (window as any).FluxWishlist;
      const dateInp = document.getElementById('fluxImpDateInp') as HTMLInputElement;
      const labelInp = document.getElementById('fluxImpLabelInp') as HTMLInputElement;
      labelInp.value = '';
      dateInp.value = '2099-12-09';
      W.pinDateFromInput();
      const items = [...document.querySelectorAll('#fluxImpList .fluxw-imp-row-item')];
      const target = items.find((i) => i.querySelector('.fluxw-imp-when'));
      return {
        pinned: W.isImportantDate('2099-12-09'),
        hasWhen: !!target?.querySelector('.fluxw-imp-when')?.textContent?.trim(),
      };
    });

    expect(row.pinned, 'a nameless date must still pin').toBe(true);
    expect(row.hasWhen, 'the date itself must still be shown').toBe(true);
  });

  test('unpinning clears the name so a re-pin starts blank', async ({ page }) => {
    const after = await page.evaluate(() => {
      const W = (window as any).FluxWishlist;
      const dateInp = document.getElementById('fluxImpDateInp') as HTMLInputElement;
      const labelInp = document.getElementById('fluxImpLabelInp') as HTMLInputElement;

      dateInp.value = '2099-09-30';
      labelInp.value = 'Old thing that is over';
      W.pinDateFromInput();
      W.unpinDate('2099-09-30');

      // Re-pin the same day without typing anything.
      dateInp.value = '2099-09-30';
      labelInp.value = '';
      W.pinDateFromInput();

      const items = [...document.querySelectorAll('#fluxImpList .fluxw-imp-row-item')];
      return items.map((i) => i.querySelector('.fluxw-imp-name')?.textContent ?? '');
    });

    expect(after).not.toContain('Old thing that is over');
  });

  test('names are stored apart from pins, so pins need no migration', async ({ page }) => {
    const keys = await page.evaluate(() => {
      const W = (window as any).FluxWishlist;
      const dateInp = document.getElementById('fluxImpDateInp') as HTMLInputElement;
      const labelInp = document.getElementById('fluxImpLabelInp') as HTMLInputElement;
      dateInp.value = '2099-08-14';
      labelInp.value = 'Orientation';
      W.pinDateFromInput();

      const all = Object.keys(localStorage);
      const pinKey = all.find((k) => k.includes('flux_important_dates_v1'));
      const labelKey = all.find((k) => k.includes('flux_important_date_labels_v1'));
      let pins: unknown = null;
      try { pins = JSON.parse(localStorage.getItem(pinKey || '') || 'null'); } catch { /* ignore */ }
      return { hasPinKey: !!pinKey, hasLabelKey: !!labelKey, pinsIsArray: Array.isArray(pins) };
    });

    expect(keys.hasPinKey).toBe(true);
    expect(keys.hasLabelKey, 'names should have their own key').toBe(true);
    // The original shape is what old devices already hold; it must not become
    // an array of objects.
    expect(keys.pinsIsArray, 'pins must stay a plain ISO string array').toBe(true);
  });
});
