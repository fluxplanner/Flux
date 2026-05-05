import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import {
  type Entitlement,
  getEntitlement,
  checkAILimit,
  incrementAIUsage,
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
    /** Groq returns a single JSON object (requires "json" in messages per API rules). */
    responseFormat?: "json_object";
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

  if (!isBYOK && !hasImage && !body.model) {
    body.model = "llama-3.3-70b-versatile";
  }

  let text: string;
  try {
    if (hasImage) {
      text = await callGemini(body);
    } else if (routeMode === "openai_compatible") {
      const rc = body.routing?.openaiCompatible;
      if (!rc?.apiKey?.trim() || !rc?.model?.trim()) {
        return json({ error: "routing_incomplete_openai" }, 400, origin);
      }
      text = await callOpenAICompatible(body, {
        apiKey: rc.apiKey.trim(),
        baseUrl: (rc.baseUrl || "").trim(),
        model: rc.model.trim(),
      });
    } else if (routeMode === "anthropic_messages") {
      const rc = body.routing?.anthropic;
      if (!rc?.apiKey?.trim() || !rc?.model?.trim()) {
        return json({ error: "routing_incomplete_anthropic" }, 400, origin);
      }
      text = await callAnthropicMessages(body, {
        apiKey: rc.apiKey.trim(),
        model: rc.model.trim(),
      });
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

  if (PAYMENTS_ENABLED && userId && !hasImage && !isBYOK) {
    incrementAIUsage(userId).catch(console.error);
  }

  return json({ content: [{ type: "text", text }] }, 200, origin);
});

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

  let base = rc.baseUrl.replace(/\/+$/, "");
  if (!base) base = "https://api.openai.com/v1";
  if (!/^https?:\/\/.+/i.test(base)) {
    throw new Error("OpenAI-compatible base URL must start with http:// or https://");
  }

  const url = base.endsWith("/chat/completions")
    ? base
    : base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;

  const res = await fetch(url, {
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
    const role = roleStr === "assistant" ? "assistant" : "user";
    messages.push({
      role,
      content:
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    });
  }

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
      system: systemParts.join("\n\n").slice(0, 200000),
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
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: jsonMode ? 1024 : 2048,
    temperature: jsonMode ? 0.2 : 0.7,
  };
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
  const model = body.model ?? "llama-3.3-70b-versatile";
  const payload = buildOpenAIChatPayload(body, model);
  return await postGroqChatCompletion(payload);
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
