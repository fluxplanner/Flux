import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

test.describe('AI providers (BYOK multi-provider bridge)', () => {
  test('FluxAIProviders module loads with expected public surface', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const surface = await page.evaluate(() => {
      const FP = (window as any).FluxAIProviders;
      return {
        moduleType: typeof FP,
        providerCount: FP?.providers?.length,
        ids: FP?.providers?.map((p: any) => p.id),
        callType: typeof FP?.call,
        getKeyType: typeof FP?.getKey,
        setKeyType: typeof FP?.setKey,
        resolveType: typeof FP?.resolveModel,
      };
    });
    expect(surface.moduleType).toBe('object');
    expect(surface.providerCount).toBe(6);
    expect(surface.ids).toEqual(['anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek']);
    expect(surface.callType).toBe('function');
    expect(surface.getKeyType).toBe('function');
    expect(surface.setKeyType).toBe('function');
    expect(surface.resolveType).toBe('function');
  });

  test('model spec resolution maps shorthands to providers', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const FP = (window as any).FluxAIProviders;
      // need a configured provider for default-route fallbacks, but explicit
      // specs should resolve regardless
      return {
        gpt: FP.resolveModel('gpt-4o-mini'),
        claude: FP.resolveModel('claude-3-5-haiku-latest'),
        gemini: FP.resolveModel('gemini-1.5-flash'),
        llama: FP.resolveModel('llama-3.1-8b-instant'),
        explicit: FP.resolveModel('anthropic:claude-3-opus-latest'),
        slash: FP.resolveModel('openai/gpt-4o'),
      };
    });
    expect(res.gpt.provider).toBe('openai');
    expect(res.claude.provider).toBe('anthropic');
    expect(res.gemini.provider).toBe('google');
    expect(res.llama.provider).toBe('groq');
    expect(res.explicit).toEqual({ provider: 'anthropic', model: 'claude-3-opus-latest' });
    expect(res.slash).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  test('key storage round-trips and stays local', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const FP = (window as any).FluxAIProviders;
      FP.setKey('groq', 'gsk-test-1234567890');
      const stored = FP.getKey('groq');
      const configured = FP.listConfigured();
      // Confirm the key is in localStorage (local-only), not synced anywhere
      const inLocalStorage = Object.keys(localStorage).some(
        (k) => k.includes('aiprov_key_groq')
      );
      FP.clearKey('groq');
      const afterClear = FP.getKey('groq');
      return { stored, configuredHasGroq: configured.includes('groq'), inLocalStorage, afterClear };
    });
    expect(res.stored).toBe('gsk-test-1234567890');
    expect(res.configuredHasGroq).toBe(true);
    expect(res.inLocalStorage).toBe(true);
    expect(res.afterClear).toBe('');
  });

  test('call() returns a clear error when no key configured', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(async () => {
      const FP = (window as any).FluxAIProviders;
      FP.clearKey('anthropic');
      return FP.call({ provider: 'anthropic', user: 'hi' });
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/key missing/i);
    expect(res.error).toMatch(/Settings/);
  });

  test('/ask skill registers in the V2 skills registry', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    // Give the deferred registration a beat
    await page.waitForTimeout(1800);
    const res = await page.evaluate(() => {
      const v2 = (window as any).FluxSkillsV2;
      const all = v2 && v2.all ? v2.all() : [];
      const ask = all.find((s: any) => s.id === 'ask_other_ai');
      return { hasV2: !!v2, askExists: !!ask, askSlash: ask?.slash };
    });
    expect(res.hasV2).toBe(true);
    expect(res.askExists).toBe(true);
    expect(res.askSlash).toBe('/ask');
  });

  test('/ask runner routes through call() and surfaces provider replies', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(1800);
    const res = await page.evaluate(async () => {
      const FP = (window as any).FluxAIProviders;
      const v2 = (window as any).FluxSkillsV2;
      // The runner uses the module-internal `call`, which hits `fetch`. Stub at
      // the network layer (not FP.call) so we exercise the real code path, and
      // set a key so the missing-key guard passes.
      FP.setKey('openai', 'sk-test-key-1234567890');
      const origFetch = window.fetch;
      (window as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'stub-reply: hello world' } }] }),
        text: async () => '',
      });
      let fired: any = null;
      const handler = (e: any) => { fired = e.detail; };
      document.addEventListener('flux-ai-response', handler);
      const out = await v2.run('/ask', 'gpt-4o-mini hello world', { source: 'test' });
      document.removeEventListener('flux-ai-response', handler);
      window.fetch = origFetch;
      FP.clearKey('openai');
      return {
        ok: out.ok,
        message: out.message,
        hasRender: !!out.render,
        rebroadcastFired: !!fired,
        rebroadcastSource: fired?.source,
      };
    });
    expect(res.ok).toBe(true);
    expect(res.message).toContain('stub-reply: hello world');
    expect(res.hasRender).toBe(true);
    // Cross-AI interop: reply rebroadcasts so Flux skills can be invoked by it
    expect(res.rebroadcastFired).toBe(true);
    expect(res.rebroadcastSource).toBe('ask');
  });

  test('AI composer chips include /ask and prefill the input on click', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'ai');
    // /ask chip is present in the composer hint row
    const askChip = page.locator('[data-ai-chip="/ask "]');
    await expect(askChip).toBeVisible();
    await askChip.click();
    const input = page.locator('#aiInput');
    await expect(input).toHaveValue('/ask ');
    // And it's focused so the user can type their question immediately
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe('aiInput');
  });
});
