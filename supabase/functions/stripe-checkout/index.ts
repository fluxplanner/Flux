import { verifyUserJWT, serviceClient, json, corsHeaders } from "../_shared/auth.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const APP_URL = "https://azfermohammed.github.io/Fluxplanner";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return json({ error: "Stripe not configured on server" }, 500, origin);
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return json({ error: auth.error }, auth.status, origin);
  }
  const { userId, email } = auth;

  const db = serviceClient();

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_customer_id, plan, status")
    .eq("user_id", userId)
    .single();

  let stripeCustomerId = sub?.stripe_customer_id as string | undefined;

  if (!stripeCustomerId) {
    const customerRes = await stripeRequest("POST", "/v1/customers", {
      email,
      metadata: { user_id: userId },
    });
    if (!customerRes.ok) {
      const errText = await customerRes.text();
      return json({ error: "Failed to create customer", details: errText }, 502, origin);
    }
    const customer = await customerRes.json();
    stripeCustomerId = customer.id as string;

    await db.from("subscriptions").update({
      stripe_customer_id: stripeCustomerId,
    }).eq("user_id", userId);
  }

  const sessionRes = await stripeRequest("POST", "/v1/checkout/sessions", {
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url:
      `${APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/?checkout=canceled`,
    metadata: { user_id: userId },
    subscription_data: {
      metadata: { user_id: userId },
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_update: { address: "auto" },
  });

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    return json({ error: "Failed to create checkout session", details: errText }, 502, origin);
  }

  const session = await sessionRes.json();
  return json({ url: session.url, session_id: session.id }, 200, origin);
});

async function stripeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const encoded = body
    ? new URLSearchParams(flattenStripeParams(body)).toString()
    : "";
  return fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: encoded || undefined,
  });
}

function flattenStripeParams(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenStripeParams(value as Record<string, unknown>, fullKey),
      );
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") {
          Object.assign(
            result,
            flattenStripeParams(
              item as Record<string, unknown>,
              `${fullKey}[${i}]`,
            ),
          );
        } else {
          result[`${fullKey}[${i}]`] = String(item);
        }
      });
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}
