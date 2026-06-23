import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import {
  type Entitlement,
  getEntitlement,
  checkAndIncrementAIUsage,
  refundAIUsage,
} from "../_shared/plan.ts";

const PAYMENTS_ENABLED = Deno.env.get("PAYMENTS_ENABLED") === "true";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  let userId: string | null = null;
  const auth = await verifyUserJWT(req);
  if ("error" in auth) {
    if (PAYMENTS_ENABLED) {
      return json({ error: auth.error }, auth.status, origin);
    }
    userId = null;
  } else {
    userId = auth.userId ?? null;
  }

  let body: {
    message?: string;
    messages?: Array<{ role: string; content: unknown }>;
    imageBase64?: string;
    mimeType?: string;
    model?: string;
    system?: string;
    systemPrompt?: string;
    /** Groq returns a single JSON object (requires "json" in messages per API rules). */
    responseFormat?: "json_object";
    /** Stream the reply as SSE (`data: {"delta":"…"}` … `data: [DONE]`). Text-only. */
    stream?: boolean;
    /**
     * Agentic tool loop: round 1 is the user's message, rounds 2+ are hidden
     * TOOL RESULTS continuations of the same turn — only round 1 is metered.
     */
    loopRound?: number;
    routing?: {
      mode?: string;
      openaiCompatible?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      };
      anthropic?: { apiKey?: string; model?: string };
    };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return json({ error: "Invalid request: messages required" }, 400, origin);
  }

  const hasImage = !!body.imageBase64;
  const routeMode = body.routing?.mode ?? "";
  const isBYOK = routeMode === "openai_compatible" ||
    routeMode === "anthropic_messages";

  let entitlement: Entitlement | null = null;
  // Whether we already debited a quota point (so we can refund on AI errors).
  let chargedQuota = false;

  if (PAYMENTS_ENABLED && userId && !isBYOK) {
    entitlement = await getEntitlement(userId);

    if (hasImage && !entitlement.imageAnalysis) {
      return json({
        error: "feature_requires_pro",
        feature: "image_analysis",
        message: "Image analysis requires Flux Pro",
        upgrade_url: "https://azfermohammed.github.io/Fluxplanner/?upgrade=1",
      }, 403, origin);
    }

    // Image calls aren't currently metered against the text quota.
    // Agent-loop continuations (rounds 2+) of one user turn are charged once, on round 1.
    const loopRound = Number(body.loopRound) || 1;
    const isLoopContinuation = loopRound > 1 && loopRound <= 8;
    if (!hasImage && !isLoopContinuation) {
      const usage = await checkAndIncrementAIUsage(userId, entitlement);
      if (!usage.allowed) {
        return json({
          error: "daily_limit_reached",
          daily_used: usage.dailyUsed,
          daily_limit: usage.dailyLimit,
          monthly_used: usage.monthlyUsed,
          monthly_limit: usage.monthlyLimit,
          plan: entitlement.plan,
          is_trialing: entitlement.isTrialing,
          trial_ends_at: entitlement.trialEndsAt,
          upgrade_url: "https://azfermohammed.github.io/Fluxplanner/?upgrade=1",
        }, 429, origin);
      }
      chargedQuota = true;
    }

    if (entitlement.plan === "free" && !body.model) {
      // Tool-calling turns need a model that can emit well-formed flux_tool
      // JSON and reason; plain chat gets the smaller (still capable) model.
      const sys = String(body.system ?? body.systemPrompt ?? "");
      body.model = sys.includes("flux_tool")
        ? "openai/gpt-oss-120b"
        : "openai/gpt-oss-20b";
    }
  }

  if (!isBYOK && !hasImage && !body.model) {
    body.model = "openai/gpt-oss-120b";
  }

  // SSE streaming: text chat only (vision and json_object stay request/response).
  const wantStream = body.stream === true && !hasImage &&
    body.responseFormat !== "json_object";

  let text: string;
  try {
    if (hasImage) {
      text = await callVision(body);
    } else if (routeMode === "openai_compatible") {
      const rc = body.routing?.openaiCompatible;
      if (!rc?.apiKey?.trim() || !rc?.model?.trim()) {
        if (chargedQuota && userId) await refundAIUsage(userId);
        return json({ error: "routing_incomplete_openai" }, 400, origin);
      }
      const cfg = {
        apiKey: rc.apiKey.trim(),
        baseUrl: (rc.baseUrl || "").trim(),
        model: rc.model.trim(),
      };
      if (wantStream) {
        const upstream = await openOpenAICompatibleStream(body, cfg);
        return pipeSSE(upstream, openaiDelta, origin);
      }
      text = await callOpenAICompatible(body, cfg);
    } else if (routeMode === "anthropic_messages") {
      const rc = body.routing?.anthropic;
      if (!rc?.apiKey?.trim() || !rc?.model?.trim()) {
        if (chargedQuota && userId) await refundAIUsage(userId);
        return json({ error: "routing_incomplete_anthropic" }, 400, origin);
      }
      const cfg = { apiKey: rc.apiKey.trim(), model: rc.model.trim() };
      if (wantStream) {
        const upstream = await openAnthropicStream(body, cfg);
        return pipeSSE(upstream, anthropicDelta, origin);
      }
      text = await callAnthropicMessages(body, cfg);
    } else {
      if (wantStream) {
        const upstream = await openGroqStream(body);
        return pipeSSE(upstream, openaiDelta, origin);
      }
      text = await callGroq(body);
    }
  } catch (e) {
    console.error("AI call failed:", e);
    if (chargedQuota && userId) {
      // Provider failed — give the user their quota back.
      refundAIUsage(userId).catch(console.error);
    }
    return json(
      { error: "AI service error", details: String(e) },
      502,
      origin,
    );
  }

  return json({ content: [{ type: "text", text }] }, 200, origin);
});

/* ───────── SSE streaming ─────────
 * Providers stream their own SSE shapes; we normalize to
 *   data: {"delta":"…"}  …  data: [DONE]
 * so the client only ever parses one format. Errors before the upstream
 * connection opens flow through the normal JSON error path (quota refunded);
 * mid-stream errors are emitted as a {"error":…} event.
 */

function openaiDelta(j: unknown): string | undefined {
  const o = j as { choices?: Array<{ delta?: { content?: string } }> };
  return o?.choices?.[0]?.delta?.content || undefined;
}

function anthropicDelta(j: unknown): string | undefined {
  const o = j as { type?: string; delta?: { text?: string } };
  return o?.type === "content_block_delta" ? (o.delta?.text || undefined) : undefined;
}

function pipeSSE(
  upstream: Response,
  extract: (j: unknown) => string | undefined,
  origin: string,
): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();
  let buf = "";

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const t = extract(JSON.parse(data));
              if (t) emit({ delta: t });
            } catch {
              // Partial/non-JSON keepalive line — skip.
            }
          }
        }
      } catch (e) {
        emit({ error: String(e) });
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
    cancel() {
      try {
        reader.cancel();
      } catch { /* upstream already closed */ }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Per-model rate limits are independent on Groq, so when one model is
 * saturated we step down the ladder instead of surfacing a raw 429.
 */
const GROQ_MODEL_LADDER = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

function groqFallbackChain(model: string): string[] {
  const chain = [model];
  for (const m of GROQ_MODEL_LADDER) if (!chain.includes(m)) chain.push(m);
  return chain;
}

function isRetryableGroqStatus(status: number): boolean {
  // 413: free-tier per-request token caps differ per model — a request too
  // big for gpt-oss-120b often fits llama-3.3-70b, so step down the ladder.
  return status === 413 || status === 429 || status === 498 ||
    status === 499 || status >= 500;
}

function isRetryableGroqError(e: unknown): boolean {
  const s = String(e);
  return /Groq error (413|429|498|499|5\d\d)/.test(s) ||
    /rate.?limit/i.test(s) || /request too large/i.test(s) ||
    /over capacity/i.test(s);
}

async function openGroqStream(body: {
  messages?: Array<{ role: string; content: unknown }>;
  message?: string;
  model?: string;
  system?: string;
  systemPrompt?: string;
}): Promise<Response> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  let lastErr = "";
  for (const model of groqFallbackChain(body.model ?? GROQ_MODEL_LADDER[0])) {
    const payload = buildOpenAIChatPayload(body, model);
    payload.stream = true;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.body) return res;
    const err = await res.text().catch(() => "");
    lastErr = `Groq error ${res.status}: ${err}`;
    if (!isRetryableGroqStatus(res.status)) break;
    console.warn(`ai-proxy: ${model} unavailable (${res.status}), falling back`);
  }
  throw new Error(lastErr || "Groq error: all models unavailable");
}

async function openOpenAICompatibleStream(
  body: {
    messages?: Array<{ role: string; content: unknown }>;
    message?: string;
    model?: string;
    system?: string;
    systemPrompt?: string;
  },
  rc: { apiKey: string; baseUrl: string; model: string },
): Promise<Response> {
  const payload = buildOpenAIChatPayload(body, rc.model || body.model || "gpt-4o-mini");
  payload.stream = true;
  const res = await fetch(openaiCompatibleUrl(rc.baseUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rc.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI-compatible error ${res.status}: ${err}`);
  }
  return res;
}

async function openAnthropicStream(
  body: {
    messages?: Array<{ role: string; content: unknown }>;
    system?: string;
    systemPrompt?: string;
  },
  rc: { apiKey: string; model: string },
): Promise<Response> {
  const { system, messages } = buildAnthropicPayload(body);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": rc.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: rc.model,
      max_tokens: 2048,
      system,
      messages,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }
  return res;
}

function openaiCompatibleUrl(baseUrl: string): string {
  let base = baseUrl.replace(/\/+$/, "");
  if (!base) base = "https://api.openai.com/v1";
  if (!/^https?:\/\/.+/i.test(base)) {
    throw new Error("OpenAI-compatible base URL must start with http:// or https://");
  }
  return base.endsWith("/chat/completions")
    ? base
    : base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;
}

function buildAnthropicPayload(body: {
  messages?: Array<{ role: string; content: unknown }>;
  system?: string;
  systemPrompt?: string;
}): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts: string[] = [];
  const topSys = body.system ?? body.systemPrompt;
  if (topSys) systemParts.push(String(topSys));

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  const raw = Array.isArray(body.messages) ? [...body.messages] : [];
  for (const m of raw) {
    const roleStr = String(m.role || "");
    if (roleStr === "system") {
      systemParts.push(
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      );
      continue;
    }
    messages.push({
      role: roleStr === "assistant" ? "assistant" : "user",
      content:
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    });
  }
  return { system: systemParts.join("\n\n").slice(0, 200000), messages };
}

async function callOpenAICompatible(
  body: {
    messages?: Array<{ role: string; content: unknown }>;
    message?: string;
    model?: string;
    system?: string;
    systemPrompt?: string;
    responseFormat?: "json_object";
  },
  rc: { apiKey: string; baseUrl: string; model: string },
): Promise<string> {
  const model = rc.model || body.model || "gpt-4o-mini";
  const payload = buildOpenAIChatPayload(body, model);

  const res = await fetch(openaiCompatibleUrl(rc.baseUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rc.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI-compatible error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropicMessages(
  body: {
    messages?: Array<{ role: string; content: unknown }>;
    message?: string;
    system?: string;
    systemPrompt?: string;
  },
  rc: { apiKey: string; model: string },
): Promise<string> {
  const { system, messages } = buildAnthropicPayload(body);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": rc.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: rc.model,
      max_tokens: 2048,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const blocks = data.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b: { type?: string }) => b && b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("\n")
    .trim();
}

function buildOpenAIChatPayload(
  body: {
    messages?: Array<{ role: string; content: unknown }>;
    message?: string;
    model?: string;
    system?: string;
    systemPrompt?: string;
    responseFormat?: "json_object";
  },
  model: string,
): Record<string, unknown> {
  const system = body.system ?? body.systemPrompt;
  let messages = Array.isArray(body.messages) ? [...body.messages] : [];
  if (system && !messages.some((m) => m.role === "system")) {
    messages = [{ role: "system", content: system }, ...messages];
  }
  if (messages.length === 0) {
    messages = [{ role: "user", content: body.message ?? "" }];
  }
  const jsonMode = body.responseFormat === "json_object";
  const isGptOss = /gpt-oss/.test(model);
  const payload: Record<string, unknown> = {
    model,
    messages,
    // Reasoning models (gpt-oss) spend completion budget thinking before
    // answering — keep enough headroom that long solutions don't truncate.
    max_tokens: jsonMode ? 1024 : (isGptOss ? 8192 : 4096),
    temperature: jsonMode ? 0.2 : 0.7,
  };
  // Think hard by default: the biggest free accuracy lever on gpt-oss, and
  // Groq is fast enough that the extra thinking stays responsive.
  if (isGptOss && !jsonMode) payload.reasoning_effort = "high";
  if (jsonMode) payload.response_format = { type: "json_object" };
  return payload;
}

async function postGroqChatCompletion(
  payload: Record<string, unknown>,
): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGroq(body: {
  messages?: Array<{ role: string; content: unknown }>;
  message?: string;
  model?: string;
  system?: string;
  systemPrompt?: string;
  responseFormat?: "json_object";
}): Promise<string> {
  let lastErr: unknown = null;
  for (const model of groqFallbackChain(body.model ?? GROQ_MODEL_LADDER[0])) {
    try {
      return await postGroqChatCompletion(buildOpenAIChatPayload(body, model));
    } catch (e) {
      lastErr = e;
      if (!isRetryableGroqError(e)) throw e;
      console.warn(`ai-proxy: ${model} unavailable, falling back`);
    }
  }
  throw lastErr ?? new Error("Groq error: all models unavailable");
}

/** Vision when `GEMINI_API_KEY` is unset — same stack as `gemini-proxy` (Groq + Llama 4 Scout). */
async function callGroqVision(body: {
  messages?: Array<{ role: string; content: unknown }>;
  imageBase64?: string;
  mimeType?: string;
  system?: string;
  systemPrompt?: string;
}): Promise<string> {
  const mime = body.mimeType || "image/jpeg";
  const b64 = String(body.imageBase64 || "").replace(/\s/g, "");
  if (!b64) throw new Error("Missing image data for vision request");

  const visionModel = (Deno.env.get("GROQ_VISION_MODEL") ??
    "meta-llama/llama-4-scout-17b-16e-instruct").trim();
  const dataUrl = `data:${mime};base64,${b64}`;

  const system = String(body.system ?? body.systemPrompt ?? "").trim();
  const raw = Array.isArray(body.messages) ? [...body.messages] : [];
  if (raw.length === 0) throw new Error("No messages for vision request");

  const last = raw[raw.length - 1]!;
  const lastRole = String(last.role || "user");
  const lastText =
    typeof last.content === "string"
      ? last.content
      : JSON.stringify(last.content ?? "");

  const multimodalContent: unknown[] = [
    {
      type: "image_url",
      image_url: { url: dataUrl },
    },
    {
      type: "text",
      text: lastText.trim() || "Answer using the image.",
    },
  ];

  const history = raw.slice(0, -1).map((m) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    const content =
      typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return { role, content };
  });

  const groqMessages: Array<{ role: string; content: unknown }> = [];
  if (system) groqMessages.push({ role: "system", content: system });
  groqMessages.push(...history);
  groqMessages.push({
    role: lastRole === "assistant" ? "assistant" : "user",
    content: multimodalContent,
  });

  return await postGroqChatCompletion({
    model: visionModel,
    messages: groqMessages,
    temperature: 0.3,
    max_tokens: 2048,
  });
}

function isGeminiQuotaOrRateLimitError(err: unknown): boolean {
  const s = String(err);
  if (/\b429\b/.test(s)) return true;
  if (/RESOURCE_EXHAUSTED/i.test(s)) return true;
  if (/quota exceeded/i.test(s.toLowerCase())) return true;
  if (/rate limit/i.test(s.toLowerCase())) return true;
  return false;
}

/**
 * Image / vision: set `AI_PROXY_VISION_PROVIDER=groq` to skip Gemini entirely.
 * Otherwise tries Gemini when `GEMINI_API_KEY` is set; on 429 / quota errors falls back to Groq if `GROQ_API_KEY` is set.
 */
async function callVision(body: {
  message?: string;
  messages?: Array<{ role: string; content: unknown }>;
  imageBase64?: string;
  mimeType?: string;
  system?: string;
  systemPrompt?: string;
}): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const forceGroq =
    Deno.env.get("AI_PROXY_VISION_PROVIDER")?.trim().toLowerCase() === "groq";

  // Groq vision rate-limited → Gemini can cover (and vice versa below).
  const groqVisionWithGeminiFallback = async (): Promise<string> => {
    try {
      return await callGroqVision(body);
    } catch (e) {
      if (isRetryableGroqError(e) && geminiKey) {
        console.warn(
          "ai-proxy: Groq vision failed (rate limit), using Gemini",
        );
        return await callGemini(body);
      }
      throw e;
    }
  };

  if (forceGroq) {
    if (!groqKey) {
      throw new Error(
        "AI_PROXY_VISION_PROVIDER=groq but GROQ_API_KEY is not set",
      );
    }
    return await groqVisionWithGeminiFallback();
  }

  if (geminiKey) {
    try {
      return await callGemini(body);
    } catch (e) {
      if (isGeminiQuotaOrRateLimitError(e) && groqKey) {
        console.warn(
          "ai-proxy: Gemini vision failed (quota/rate limit), using Groq",
        );
        return await callGroqVision(body);
      }
      throw e;
    }
  }

  if (!groqKey) {
    throw new Error("No GEMINI_API_KEY or GROQ_API_KEY for vision");
  }
  return await groqVisionWithGeminiFallback();
}

async function callGemini(body: {
  message?: string;
  messages?: Array<{ role: string; content: unknown }>;
  imageBase64?: string;
  mimeType?: string;
  system?: string;
  systemPrompt?: string;
}): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY not set (caller should use Groq vision when Gemini is disabled)",
    );
  }

  /** `gemini-1.5-flash-latest` often 404s as Google rotates IDs; override via secret if needed. */
  const model = (Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-2.0-flash")
    .trim();

  const lastMsg = body.messages?.length
    ? String(body.messages[body.messages.length - 1]?.content ?? "")
    : (body.message ?? "");
  const systemRaw = body.system ?? body.systemPrompt ?? "";
  const system = String(systemRaw).trim();
  const userText = String(lastMsg).trim() || "Answer based on the attached image.";

  const parts: unknown[] = [];
  if (body.imageBase64 && body.mimeType) {
    const data = String(body.imageBase64).replace(/\s/g, "");
    parts.push({
      inlineData: { mimeType: String(body.mimeType), data },
    });
  }
  parts.push({ text: userText });

  const reqBody: Record<string, unknown> = {
    contents: [{ parts }],
  };
  if (system) {
    reqBody.systemInstruction = { parts: [{ text: system }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
