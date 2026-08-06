import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import {
  getEntitlement,
  checkAndIncrementAIUsage,
  refundAIUsage,
} from "../_shared/plan.ts";
import {
  bumpDailyGuard,
  clientIp,
  isAnonRoleJwt,
  sha256Hex,
} from "../_shared/rate-limit.ts";

const PAYMENTS_ENABLED = Deno.env.get("PAYMENTS_ENABLED") === "true";
// P0 A5 (mirrors ai-proxy): auth required independent of payments. Guest mode
// stays allowed for the pre-signup onboarding schedule import, but tightly
// metered — vision calls are the most expensive thing we proxy.
const ALLOW_GUESTS = (Deno.env.get("AI_PROXY_ALLOW_GUESTS") ?? "true") === "true";
const GUEST_DAILY = Number(Deno.env.get("GEMINI_PROXY_GUEST_DAILY") ?? "10");
const USER_DAILY = Number(Deno.env.get("AI_PROXY_USER_DAILY") ?? "300");

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
    // A failed JWT never falls through to a free ride anymore. Only guest
    // mode (Bearer = the project's anon-role JWT) may proceed, rate-guarded
    // below — the pre-signup onboarding schedule import depends on it.
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!ALLOW_GUESTS || !isAnonRoleJwt(bearer)) {
      return json({ error: auth.error }, auth.status, origin);
    }
  } else {
    userId = auth.userId ?? null;
  }

  let body: { imageBase64?: string; mimeType?: string; prompt?: string; fingerprint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  if (!body.imageBase64 || !body.prompt) {
    return json({ error: "Missing params" }, 400, origin);
  }

  if (!userId) {
    // Guest vision guard — fail CLOSED for anonymous traffic.
    const fp = typeof body.fingerprint === "string" ? body.fingerprint.slice(0, 128) : "";
    const bucket = "guestv:" + await sha256Hex(
      [clientIp(req), req.headers.get("user-agent") ?? "", fp].join("|"),
    );
    const count = await bumpDailyGuard(bucket);
    if (count === null || count > GUEST_DAILY) {
      return json({
        error: "guest_daily_limit",
        message: "Guest limit reached — sign in to keep importing.",
        daily_limit: GUEST_DAILY,
      }, 429, origin);
    }
  } else if (!PAYMENTS_ENABLED) {
    // Basic per-user daily abuse stop even without payment metering.
    // Fail OPEN for signed-in users.
    const count = await bumpDailyGuard("user:" + userId);
    if (count !== null && count > USER_DAILY) {
      return json({ error: "daily_limit_reached", daily_limit: USER_DAILY }, 429, origin);
    }
  }

  let chargedQuota = false;
  if (PAYMENTS_ENABLED && userId) {
    const entitlement = await getEntitlement(userId);
    if (!entitlement.imageAnalysis) {
      return json({
        error: "feature_requires_pro",
        feature: "image_analysis",
        message: "Vision import requires Flux Pro",
      }, 403, origin);
    }
    const usage = await checkAndIncrementAIUsage(userId, entitlement);
    if (!usage.allowed) {
      return json({
        error: "daily_limit_reached",
        daily_used: usage.dailyUsed,
        daily_limit: usage.dailyLimit,
        monthly_used: usage.monthlyUsed,
        monthly_limit: usage.monthlyLimit,
      }, 429, origin);
    }
    chargedQuota = true;
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
    if (chargedQuota && userId) refundAIUsage(userId).catch(console.error);
    return json({ error: `Groq API ${res.status}: ${err}` }, 502, origin);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) {
    if (chargedQuota && userId) refundAIUsage(userId).catch(console.error);
    return json({ error: "Groq returned empty response" }, 502, origin);
  }

  return json({ text }, 200, origin);
});
