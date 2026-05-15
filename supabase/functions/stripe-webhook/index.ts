import { serviceClient } from "../_shared/auth.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

function jsonNoCors(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonNoCors({ error: "Method not allowed" }, 405);
  }

  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
    console.error("Stripe webhook secrets missing");
    return jsonNoCors({ error: "Server misconfigured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonNoCors({ error: "Missing stripe-signature" }, 400);
  }

  const rawBody = await req.text();

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return jsonNoCors({ error: "Invalid signature" }, 400);
  }

  const db = serviceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const meta = session.metadata as Record<string, string> | undefined;
        const userId = meta?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId || !subscriptionId) {
          console.error("Missing user_id or subscription in session");
          break;
        }

        const stripeSub = await fetchStripeSubscription(subscriptionId);

        const { error: upsertErr } = await db.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: stripeSub.items?.data?.[0]?.price?.id,
          plan: "pro",
          status: stripeSub.status,
          trial_start: stripeSub.trial_start
            ? new Date(stripeSub.trial_start * 1000).toISOString()
            : null,
          trial_ends_at: stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000).toISOString()
            : null,
          current_period_start: stripeSub.current_period_start
            ? new Date(stripeSub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
        }, { onConflict: "user_id" });
        if (upsertErr) throw new Error(`subscriptions upsert failed: ${upsertErr.message}`);

        console.log(`Checkout complete for user ${userId}`);
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object;
        const customerId = stripeSub.customer as string;

        const { data: existing } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!existing?.user_id) {
          console.error("No user for customer", customerId);
          break;
        }

        const plan = stripeSub.status === "active" ||
            stripeSub.status === "trialing"
          ? "pro"
          : "free";

        const { error: updErr } = await db.from("subscriptions").update({
          plan,
          status: stripeSub.status as string,
          stripe_price_id: (stripeSub.items as {
            data: Array<{ price: { id: string } }>;
          })?.data?.[0]?.price?.id,
          current_period_start: stripeSub.current_period_start
            ? new Date((stripeSub.current_period_start as number) * 1000)
              .toISOString()
            : null,
          current_period_end: stripeSub.current_period_end
            ? new Date((stripeSub.current_period_end as number) * 1000)
              .toISOString()
            : null,
          cancel_at_period_end: stripeSub.cancel_at_period_end as boolean ??
            false,
          canceled_at: stripeSub.canceled_at
            ? new Date((stripeSub.canceled_at as number) * 1000).toISOString()
            : null,
        }).eq("user_id", existing.user_id);
        if (updErr) throw new Error(`subscription update failed: ${updErr.message}`);
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        const customerId = stripeSub.customer as string;

        const { data: existing } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!existing?.user_id) break;

        const { error: delErr } = await db.from("subscriptions").update({
          plan: "free",
          status: "canceled",
          canceled_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          stripe_subscription_id: null,
          cancel_at_period_end: false,
        }).eq("user_id", existing.user_id);
        if (delErr) throw new Error(`subscription cancel update failed: ${delErr.message}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        const { data: existing } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!existing?.user_id) break;

        const { error: pdErr } = await db.from("subscriptions").update({ status: "past_due" }).eq(
          "user_id",
          existing.user_id,
        );
        if (pdErr) throw new Error(`past_due update failed: ${pdErr.message}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        const { data: existing } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!existing?.user_id) break;

        const { error: psErr } = await db.from("subscriptions").update({
          status: "active",
          plan: "pro",
        }).eq("user_id", existing.user_id);
        if (psErr) throw new Error(`payment_succeeded update failed: ${psErr.message}`);
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (e) {
    // Return 5xx so Stripe retries instead of dropping the event.
    // Subscription state would otherwise drift silently until manual reconcile.
    console.error("Webhook handler error:", e);
    return jsonNoCors(
      {
        error: "Webhook handler failed; Stripe should retry.",
        eventType: event?.type ?? "unknown",
      },
      500,
    );
  }

  return jsonNoCors({ received: true }, 200);
});

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<void> {
  const parts = sigHeader.split(",").map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith("t="));
  const timestamp = tsPart?.slice(2);
  const v1sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));

  if (!timestamp || !v1sigs.length) {
    throw new Error("Malformed Stripe-Signature");
  }

  const tol = 300;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > tol) {
    throw new Error("Timestamp outside tolerance");
  }

  const keyBytes = decodeStripeSecret(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = `${timestamp}.${payload}`;
  const mac = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(signed),
    ),
  );
  const expectedHex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

  const ok = v1sigs.some((sig) => constantTimeEqualHex(sig, expectedHex));
  if (!ok) throw new Error("Signature mismatch");
}

function decodeStripeSecret(secret: string): Uint8Array {
  if (secret.startsWith("whsec_")) {
    const raw = atob(secret.slice(6));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(secret);
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function fetchStripeSubscription(subId: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${subId}?expand[]=items`,
    {
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Stripe-Version": "2024-06-20",
      },
    },
  );
  if (!res.ok) throw new Error(`Failed to fetch subscription: ${await res.text()}`);
  return res.json();
}
