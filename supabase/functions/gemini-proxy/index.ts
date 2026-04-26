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
  } else {
    userId = auth.userId;
  }

  let body: { imageBase64?: string; mimeType?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  if (!body.imageBase64 || !body.prompt) {
    return json({ error: "Missing params" }, 400, origin);
  }

  if (PAYMENTS_ENABLED && userId) {
    const entitlement = await getEntitlement(userId);
    if (!entitlement.imageAnalysis) {
      return json({
        error: "feature_requires_pro",
        feature: "image_analysis",
        message: "Vision import requires Flux Pro",
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
      }, 429, origin);
    }
  }

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    return json({ error: "GROQ_API_KEY not set" }, 500, origin);
  }

  const visionBody = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${body.mimeType || "image/jpeg"};base64,${body.imageBase64}`,
          },
        },
        { type: "text", text: body.prompt },
      ],
    }],
    temperature: 0.1,
    max_tokens: 2048,
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify(visionBody),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: `Groq API ${res.status}: ${err}` }, 502, origin);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) {
    return json({ error: "Groq returned empty response" }, 502, origin);
  }

  if (PAYMENTS_ENABLED && userId) {
    incrementAIUsage(userId).catch(console.error);
  }

  return json({ text }, 200, origin);
});
