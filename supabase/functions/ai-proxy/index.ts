import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import { getEntitlement, checkAILimit, incrementAIUsage } from "../_shared/plan.ts";

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

  if (PAYMENTS_ENABLED && userId) {
    const entitlement = await getEntitlement(userId);

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

  let text: string;
  try {
    if (hasImage) {
      text = await callGemini(body);
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

async function callGroq(body: {
  messages?: Array<{ role: string; content: unknown }>;
  message?: string;
  model?: string;
  system?: string;
  systemPrompt?: string;
}): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const system = body.system ?? body.systemPrompt;
  const messages = body.messages ?? [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: body.message ?? "" },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model ?? "llama-3.3-70b-versatile",
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
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
