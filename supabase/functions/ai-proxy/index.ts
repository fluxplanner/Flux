import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import {
  type Entitlement,
  getEntitlement,
  checkAILimit,
  incrementAIUsage,
} from "../_shared/plan.ts";

const PAYMENTS_ENABLED = Deno.env.get("PAYMENTS_ENABLED") === "true";

/** OpenAI-compatible `…/chat/completions` base: Gemini shim, OpenRouter, DeepSeek, LiteLLM, etc. See `docs/ai-proxy-backends.md`. */
function anthropicOpenAICompatBase(): string | null {
  const b = Deno.env.get("ANTHROPIC_BASE_URL")?.trim();
  return b || null;
}

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
  if ("error" in auth && auth.error) {
    if (PAYMENTS_ENABLED) {
      return json({ error: auth.error }, auth.status, origin);
    }
    userId = null;
  } else {
    userId = auth.userId;
  }

  let body: {
    message?: string;
    messages?: Array<{ role: string; content: unknown }>;
    imageBase64?: string;
    mimeType?: string;
    model?: string;
    system?: string;
    systemPrompt?: string;
    /** When set, Groq returns a single JSON object (requires "json" in messages per API rules). */
    responseFormat?: "json_object";
    /** Groq (OpenAI-compatible) or Anthropic Messages API — server enforces Pro for Anthropic when billing on. */
    provider?: "groq" | "anthropic";
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

  let entitlement: Entitlement | null = null;
  if (PAYMENTS_ENABLED && userId) {
    entitlement = await getEntitlement(userId);

    if (hasImage && !entitlement.imageAnalysis) {
      return json({
        error: "feature_requires_pro",
        feature: "image_analysis",
        message: "Image analysis requires Flux Pro",
        upgrade_url: "https://azfermohammed.github.io/Fluxplanner/?upgrade=1",
      }, 403, origin);
    }

    const usage = await checkAILimit(userId, entitlement);
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

    if (entitlement.plan === "free" && !body.model) {
      body.model = "llama-3.1-8b-instant";
    }
  }

  if (!body.model) {
    body.model = "llama-3.3-70b-versatile";
  }

  const wantsJson = body.responseFormat === "json_object";
  let provider: "groq" | "anthropic" = wantsJson
    ? "groq"
    : (body.provider === "anthropic" ? "anthropic" : "groq");

  /* Native api.anthropic.com → Pro/School only. OpenAI-compat (ANTHROPIC_BASE_URL e.g. Gemini) is operator-hosted — allow all plans. */
  if (
    PAYMENTS_ENABLED && userId && provider === "anthropic" && entitlement &&
    !anthropicOpenAICompatBase()
  ) {
    if (entitlement.plan === "free") {
      return json(
        {
          error: "feature_requires_pro",
          feature: "claude_engine",
          message: "Anthropic Claude (official API) is on Flux Pro and School. For a free-tier backend, set ANTHROPIC_BASE_URL to an OpenAI-compatible endpoint (see Flux docs).",
          upgrade_url: "https://azfermohammed.github.io/Fluxplanner/?upgrade=1",
        },
        403,
        origin,
      );
    }
  }

  let text: string;
  try {
    if (hasImage) {
      text = await callGemini(body);
    } else if (provider === "anthropic") {
      text = await callAnthropic(body);
    } else {
      text = await callGroq(body);
    }
  } catch (e) {
    console.error("AI call failed:", e);
    return json(
      { error: "AI service error", details: String(e) },
      502,
      origin,
    );
  }

  if (PAYMENTS_ENABLED && userId) {
    incrementAIUsage(userId).catch(console.error);
  }

  return json({ content: [{ type: "text", text }] }, 200, origin);
});

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
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: jsonMode ? 1024 : 2048,
    temperature: jsonMode ? 0.2 : 0.7,
  };
  if (jsonMode) payload.response_format = { type: "json_object" };
  return payload;
}

/** OpenRouter asks for Referer + app title on chat completions. */
function extraOpenAICompatHeaders(endpointUrl: string): Record<string, string> {
  const u = endpointUrl.toLowerCase();
  if (!u.includes("openrouter.ai")) return {};
  const referer = Deno.env.get("OPENROUTER_HTTP_REFERER")?.trim() ||
    "https://github.com/fluxplanner/Flux";
  const title = Deno.env.get("OPENROUTER_APP_TITLE")?.trim() || "Flux Planner";
  return {
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

async function postOpenAIChatCompletion(
  endpointUrl: string,
  bearer: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${bearer}`,
    "Content-Type": "application/json",
    ...extraOpenAICompatHeaders(endpointUrl),
  };
  const res = await fetch(endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${label} error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function openAICompatChatUrl(base: string): string {
  const b = base.trim();
  if (b.includes("chat/completions")) return b;
  return `${b.replace(/\/+$/, "")}/chat/completions`;
}

/** Model for ANTHROPIC_BASE_URL OpenAI-compat channel (ignore Groq llama defaults on body). */
function pickAnthropicCompatModel(body: { model?: string }): string {
  const env = Deno.env.get("ANTHROPIC_MODEL")?.trim();
  if (env) return env;
  const bm = body.model ? String(body.model) : "";
  if (bm && !bm.includes("llama")) return bm;
  const base = (Deno.env.get("ANTHROPIC_BASE_URL") || "").toLowerCase();
  if (base.includes("openrouter.ai")) {
    return "google/gemini-2.0-flash-exp:free";
  }
  if (base.includes("deepseek.com")) {
    return "deepseek-chat";
  }
  return "gemini-2.0-flash";
}

async function callGroq(body: {
  messages?: Array<{ role: string; content: unknown }>;
  message?: string;
  model?: string;
  system?: string;
  systemPrompt?: string;
  responseFormat?: "json_object";
}): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  const model = body.model ?? "llama-3.3-70b-versatile";
  const payload = buildOpenAIChatPayload(body, model);
  return await postOpenAIChatCompletion(
    "https://api.groq.com/openai/v1/chat/completions",
    GROQ_API_KEY,
    payload,
    "Groq",
  );
}

/** OpenAI-style chat → Anthropic Messages (https://docs.anthropic.com/en/api/messages) */
function openAiMessagesToAnthropic(
  messages: Array<{ role: string; content: unknown }>,
  systemFromBody?: string,
): { system: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  let system = (systemFromBody ?? "").trim();
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (m.role === "system") {
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant") continue;
    const r = m.role as "user" | "assistant";
    const last = out[out.length - 1];
    if (last && last.role === r) last.content = `${last.content}\n\n${text}`;
    else out.push({ role: r, content: text });
  }
  return { system, messages: out };
}

async function callAnthropic(body: {
  messages?: Array<{ role: string; content: unknown }>;
  message?: string;
  model?: string;
  system?: string;
  systemPrompt?: string;
  responseFormat?: "json_object";
}): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set on server");

  const compatBase = anthropicOpenAICompatBase();
  if (compatBase) {
    const url = openAICompatChatUrl(compatBase);
    const model = pickAnthropicCompatModel(body);
    const payload = buildOpenAIChatPayload(body, model);
    return await postOpenAIChatCompletion(url, key, payload, "ANTHROPIC_BASE_URL");
  }

  const raw = Array.isArray(body.messages) ? [...body.messages] : [];
  if (raw.length === 0) {
    raw.push({ role: "user", content: body.message ?? "" });
  }
  const sysHint = body.system ?? body.systemPrompt;
  const { system, messages } = openAiMessagesToAnthropic(raw, sysHint);
  if (messages.length === 0) {
    throw new Error("No user/assistant messages for Anthropic");
  }

  const model =
    body.model && String(body.model).startsWith("claude")
      ? body.model
      : (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514");

  const payload: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    messages,
    temperature: 0.7,
  };
  if (system) payload.system = system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const blocks = data.content;
  if (!Array.isArray(blocks)) return "";
  const textBlock = blocks.find((b: { type?: string }) => b?.type === "text");
  return typeof textBlock?.text === "string" ? textBlock.text : "";
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
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const lastMsg = body.messages?.length
    ? String(body.messages[body.messages.length - 1]?.content ?? "")
    : (body.message ?? "");
  const system = body.system ?? body.systemPrompt ?? "";
  const prompt = (system ? system + "\n\n" : "") + lastMsg;

  const parts: unknown[] = [];
  if (body.imageBase64 && body.mimeType) {
    parts.push({
      inlineData: { mimeType: body.mimeType, data: body.imageBase64 },
    });
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        ...(system
          ? { systemInstruction: { parts: [{ text: system }] } }
          : {}),
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
