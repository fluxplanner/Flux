import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * fluxReadAIStream parses the ai-proxy SSE format:
 *   data: {"delta":"…"}  …  data: [DONE]
 * accumulating the full reply while painting partial text into the
 * thinking bubble. These tests feed it synthetic streams in-page.
 */

function makeStream(page: import('@playwright/test').Page, chunks: string[]) {
  return page.evaluate(async (parts) => {
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(c) {
        parts.forEach((s) => c.enqueue(enc.encode(s)));
        c.close();
      },
    });
    const res = new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
    const thinkEl = document.createElement('div');
    thinkEl.innerHTML = '<div class="ai-av bot">✦</div><div class="ai-bub bot"></div>';
    document.body.appendChild(thinkEl);
    try {
      const text = await (window as any).fluxReadAIStream(res, thinkEl, null);
      return {
        text,
        painted: (thinkEl.querySelector('.ai-bub') as HTMLElement).innerHTML,
        error: null as string | null,
      };
    } catch (e: any) {
      return { text: '', painted: '', error: String(e && e.message) };
    } finally {
      thinkEl.remove();
    }
  }, chunks);
}

test.describe('Flux AI streaming client', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForFunction(() => typeof (window as any).fluxReadAIStream === 'function');
  });

  test('accumulates deltas across chunk boundaries and paints the bubble', async ({ page }) => {
    const out = await makeStream(page, [
      'data: {"delta":"Hel"}\n\n',
      // Split one SSE event across two network chunks:
      'data: {"del',
      'ta":"lo "}\n\n',
      'data: {"delta":"world"}\n\ndata: [DONE]\n\n',
    ]);
    expect(out.error).toBeNull();
    expect(out.text).toBe('Hello world');
    expect(out.painted).toContain('Hello world');
  });

  test('hides flux_tool blocks while streaming but returns them in full text', async ({ page }) => {
    const out = await makeStream(page, [
      'data: {"delta":"Adding that task now.\\n"}\n\n',
      'data: {"delta":"```flux_tool\\n{\\"name\\":\\"addTask\\"}\\n```"}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(out.error).toBeNull();
    // Full reply (for the tool parser) keeps the block…
    expect(out.text).toContain('```flux_tool');
    // …but the streamed bubble never shows it.
    expect(out.painted).toContain('Adding that task now.');
    expect(out.painted).not.toContain('flux_tool');
  });

  test('throws on an error event with no accumulated text', async ({ page }) => {
    const out = await makeStream(page, [
      'data: {"error":"Groq error 500: boom"}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(out.error).toContain('Groq error 500');
  });

  test('keeps partial text when the stream errors midway', async ({ page }) => {
    const out = await makeStream(page, [
      'data: {"delta":"Partial answer"}\n\n',
      'data: {"error":"upstream hiccup"}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(out.error).toBeNull();
    expect(out.text).toBe('Partial answer');
  });
});
