import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/* CI runs Node 20, which cannot import a .ts file (type stripping arrived in
   Node 22.18). Strip the types with esbuild — already here for the web
   bundles — and import the result, so this runs the same on every Node. */
const src = readFileSync(new URL('../../supabase/functions/_shared/ai-models.ts', import.meta.url), 'utf8');
const { code } = transformSync(src, { loader: 'ts', format: 'esm' });
const { fitMessages, isTooLargeError, isGeminiModelGone, newestGeminiFlash } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

/**
 * ai-proxy's model choice and conversation trimming. Two live failures drove
 * these: long chats died with Groq 413 on every rung of the ladder, and photo
 * scans died because Google retired the one Gemini model the code named.
 */

const msg = (role, n, ch = 'x') => ({ role, content: ch.repeat(n) });

test('a conversation that fits is left exactly as it was', () => {
  const m = [msg('system', 100), msg('user', 50), msg('assistant', 50), msg('user', 50)];
  assert.deepEqual(fitMessages(m, 10_000), m);
});

test('a long conversation keeps the instructions and the newest turns', () => {
  const m = [msg('system', 2000, 's'), msg('user', 3000, 'a'), msg('assistant', 3000, 'b'), msg('user', 3000, 'c'), msg('assistant', 3000, 'd'), msg('user', 500, 'q')];
  const out = fitMessages(m, 7000);
  assert.equal(out[0].role, 'system', 'the instructions stay first');
  assert.equal(out.at(-1).content, 'q'.repeat(500), 'the question being asked is always sent');
  const total = out.reduce((n, x) => n + x.content.length, 0);
  assert.ok(total <= 7000, `sent ${total} characters over a 7000 budget`);
  assert.ok(!out.some((x) => x.content.startsWith('a')), 'the oldest turn goes first');
});

test('one enormous question is cut to its end, not dropped', () => {
  const out = fitMessages([msg('system', 1000), { role: 'user', content: 'y'.repeat(20_000) + 'THE QUESTION' }], 5000);
  assert.equal(out.length, 2);
  assert.ok(out[1].content.endsWith('THE QUESTION'));
  assert.ok(out[1].content.length <= 4000);
});

test("Groq's too-large refusal is recognised, other errors are not", () => {
  assert.ok(isTooLargeError('Error: Groq error 413: {"error":{"message":"Request too large for model"}}'));
  assert.ok(isTooLargeError(new Error('request too large for model `openai/gpt-oss-20b`')));
  assert.ok(!isTooLargeError('Groq error 429: rate limit'));
  assert.ok(!isTooLargeError('Groq error 404: model_not_found'));
});

test('a retired Gemini model is recognised, a real failure is not', () => {
  assert.ok(isGeminiModelGone(404, '{"error":{"code":404,"message":"This model models/gemini-2.0-flash is no longer available."}}'));
  assert.ok(isGeminiModelGone(400, 'models/gemini-x is not found for API version v1beta'));
  assert.ok(!isGeminiModelGone(400, 'Invalid image data'));
  assert.ok(!isGeminiModelGone(429, 'quota'));
  assert.ok(!isGeminiModelGone(500, 'internal'));
});

test('the newest stable Flash that can generate is picked from Google\'s list', () => {
  const list = [
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-3.10-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-4.0-flash-preview-09-2026', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-4.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-5.0-flash', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-3.9-pro', supportedGenerationMethods: ['generateContent'] },
  ];
  assert.equal(newestGeminiFlash(list), 'gemini-3.10-flash', '3.10 is newer than 3.8 — compared as numbers, not text');
  assert.equal(newestGeminiFlash([]), null);
  assert.equal(newestGeminiFlash(undefined), null);
});
