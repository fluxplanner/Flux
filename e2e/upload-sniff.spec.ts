import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Importers check the first bytes, not the file name: a renamed text file must
 * be refused with a readable message, and anything over 15 MB never gets read.
 */

test.describe('Upload sniffing', () => {
  test('the schedule importer refuses a fake PDF with a friendly message', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const S = (window as any).FluxFileSniff;
      const tryIt = async (f: File, allow: string[]) => { try { return await S.check(f, allow); } catch (e: any) { return 'ERR ' + e.message; } };
      return {
        pdf: await tryIt(new File(['%PDF-1.7\n...'], 'a.pdf'), ['pdf', 'image']),
        png: await tryIt(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], 'a.png'), ['pdf', 'image']),
        fake: await tryIt(new File(['<html>not a pdf'], 'schedule.pdf', { type: 'application/pdf' }), ['pdf', 'image']),
        big: await tryIt(new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'huge.pdf'), ['pdf']),
        empty: await tryIt(new File([], 'e.pdf'), ['pdf']),
      };
    });
    expect(r.pdf).toBe('pdf');
    expect(r.png).toBe('image');
    expect(r.fake).toMatch(/^ERR That file is not a PDF or an image/);
    expect(r.big).toMatch(/^ERR That file is over 15 MB/);
    expect(r.empty).toMatch(/^ERR That file is empty/);
  });

  test('Flux Tutor loads the sniffer', async ({ page }) => {
    await page.goto('/teacher.html');
    expect(await page.evaluate(() => typeof (window as any).FluxFileSniff?.check)).toBe('function');
  });
});
