import { verifyUserJWT, serviceClient, json, corsHeaders } from "../_shared/auth.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = "https://azfermohammed.github.io/Fluxplanner";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!STRIPE_SECRET_KEY) {
    return json({ error: "Stripe not configured" }, 500, origin);
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return json({ error: auth.error }, auth.status, origin);
  }

  const db = serviceClient();
  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .single();

  if (!sub?.stripe_customer_id) {
    return json({ error: "No subscription found" }, 404, origin);
  }

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: new URLSearchParams({
      customer: sub.stripe_customer_id,
      return_url: APP_URL,
    }).toString(),
  });

  if (!res.ok) {
    const t = await res.text();
    return json({ error: "Failed to create portal session", details: t }, 502, origin);
  }

  const portal = await res.json();
  return json({ url: portal.url }, 200, origin);
});
