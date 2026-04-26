import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";
import { getEntitlement, checkAILimit } from "../_shared/plan.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return json({ error: auth.error }, auth.status, origin);
  }

  const entitlement = await getEntitlement(auth.userId);
  const usage = await checkAILimit(auth.userId, entitlement);

  return json({
    ...entitlement,
    usage: {
      daily_used: usage.dailyUsed,
      daily_limit: usage.dailyLimit,
      monthly_used: usage.monthlyUsed,
      monthly_limit: usage.monthlyLimit,
    },
  }, 200, origin);
});
