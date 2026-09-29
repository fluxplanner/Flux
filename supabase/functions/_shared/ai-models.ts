/**
 * Choosing an AI model that still exists, and fitting a conversation into one.
 *
 * Pure functions: no network, no Deno APIs, so test/unit/ai-models.test.mjs
 * can run them under Node. ai-proxy does the fetching and calls these.
 */

export type ChatMessage = { role: string; content: unknown };

function sizeOf(m: ChatMessage): number {
  return typeof m.content === "string"
    ? m.content.length
    : JSON.stringify(m.content ?? "").length;
}

/**
 * Shorten a conversation to fit a character budget, keeping the newest part.
 *
 * Groq refuses a request outright (413) when the prompt plus the reserved
 * answer exceeds the model's per-minute token allowance, and every model on
 * the ladder has the same allowance — so stepping down models never helped a
 * long conversation; only sending less does.
 *
 * System messages all stay: they carry the instructions (ai-proxy has already
 * capped their length). Then the most recent messages are kept whole, newest
 * first, while they fit. The latest message is always kept — cut to its last
 * `budget` characters if it is too long alone — because it is the question
 * being asked.
 */
export function fitMessages(messages: ChatMessage[], budgetChars: number): ChatMessage[] {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  let used = system.reduce((n, m) => n + sizeOf(m), 0);
  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    const n = sizeOf(m);
    if (kept.length === 0) {
      const room = Math.max(1000, budgetChars - used);
      const trimmed = n > room && typeof m.content === "string"
        ? { ...m, content: m.content.slice(-room) }
        : m;
      kept.unshift(trimmed);
      used += Math.min(n, room);
      continue;
    }
    if (used + n > budgetChars) break;
    kept.unshift(m);
    used += n;
  }
  return [...system, ...kept];
}

/** Groq's "too large for the per-minute allowance" refusal, as ai-proxy words its errors. */
export function isTooLargeError(e: unknown): boolean {
  const s = String(e);
  return /Groq error 413/.test(s) || /request too large/i.test(s);
}

/** Google's "that model id is gone" answers: a 404, or a 400 naming the model. */
export function isGeminiModelGone(status: number, body: string): boolean {
  if (status === 404) return true;
  return status === 400 &&
    /(not found|no longer available|is not supported|unknown model|invalid model)/i.test(body);
}

/**
 * The newest stable "gemini-N.N-flash" in a ListModels response that can
 * generateContent. Previews, "-lite", "-8b", dated and experimental ids are
 * skipped: the photo scan needs a model that stays put, not the newest toy.
 */
export function newestGeminiFlash(
  models: Array<{ name?: string; supportedGenerationMethods?: string[] }>,
): string | null {
  let best: { id: string; v: number[] } | null = null;
  for (const m of models || []) {
    const id = String(m?.name ?? "").replace(/^models\//, "");
    const hit = /^gemini-(\d+(?:\.\d+)*)-flash$/.exec(id);
    if (!hit) continue;
    if (!(m.supportedGenerationMethods ?? []).includes("generateContent")) continue;
    const v = hit[1].split(".").map(Number);
    if (!best || compareVersions(v, best.v) > 0) best = { id, v };
  }
  return best ? best.id : null;
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
