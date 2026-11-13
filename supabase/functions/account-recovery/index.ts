import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, serviceClient, verifyUserJWT } from "../_shared/auth.ts";
import { overDailyLimit } from "../_shared/rate-limit.ts";
import {
  emailToUsername,
  normalizeUsername,
  USER_DOMAIN,
  usernameToEmail,
  weakPasswordReason,
} from "../_shared/username.ts";

/**
 * Recovery email and password reset.
 *
 * Flux accounts sign in with a name; the address behind that name receives no
 * mail (see account-setup). So a forgotten password used to mean asking the
 * owner. This lets a person keep one real address beside their account, used
 * for nothing except sending them a link to set a new password.
 *
 * ACTIONS
 *   Signed in (the account always comes from the verified JWT, never the body):
 *     status        → { email, verified }
 *     set_email     → stores the address unconfirmed and emails a confirm link
 *     remove_email  → forgets the address
 *   Signed out (the emailed token is the proof):
 *     verify_email  { token }            → confirms the address
 *     request_reset { username }         → emails a reset link, or tells the owner
 *     confirm_reset { token, password }  → sets the password, signs out every device
 *
 * WHAT PROTECTS IT
 *   · A reset link goes only to a CONFIRMED address. A typo'd address is never
 *     trusted, or it would hand the account to whoever owns that inbox.
 *   · request_reset answers the same way whether or not the name exists or has
 *     an address, and does its work after answering, so neither the reply nor
 *     its timing says which accounts exist.
 *   · Tokens are 32 random bytes, stored only as a SHA-256 hash, single use,
 *     short lived (reset: 1 hour, confirm: 24 hours).
 *   · Every action is capped per person, per name and per IP.
 *   · Adding, changing or removing the address needs the current password, the
 *     same as changing the password does: otherwise a minute at someone's
 *     unlocked laptop is enough to point their account at your own inbox.
 *   · The owner's account is never reset by email: that inbox would become a
 *     way round the owner's authenticator.
 *
 * Secrets: RESEND_API_KEY, RECOVERY_FROM_EMAIL (a sender on a domain verified
 * in Resend — the resend.dev test sender only delivers to the account owner),
 * FLUX_SITE_URL (optional).
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("RECOVERY_FROM_EMAIL") ?? "";
const SITE_URL = (Deno.env.get("FLUX_SITE_URL") ?? "https://fluxplanner.github.io/Flux/").replace(/\/?$/, "/");
const OWNER_UID = (Deno.env.get("FLUX_OWNER_UID") ||
  "eabe2b1f-e428-4181-8530-8e5366eb3975").trim();

const RESET_MINUTES = 60;
const VERIFY_HOURS = 24;
const BAD_LINK = "This link has expired or was already used. Ask for a new one.";

const canSend = () => !!(RESEND_API_KEY && FROM_EMAIL);

function clientIp(req: Request): string {
  return (req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim().slice(0, 64);
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lowercased address, or "" if it is not one a reset link could reach. */
function cleanEmail(raw: unknown): string {
  const e = String(raw || "").trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return "";
  if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(e)) return "";
  if (e.endsWith(`@${USER_DOMAIN}`)) return ""; // the sign-in domain takes no mail
  return e;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!canSend()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("account-recovery: email", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("account-recovery: email", e);
    return false;
  }
}

function emailBody(heading: string, line: string, button: string, link: string, foot: string) {
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">` +
    `<h2 style="margin:0 0 12px;font-size:20px">${heading}</h2>` +
    `<p style="margin:0 0 20px;line-height:1.5">${line}</p>` +
    `<p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${button}</a></p>` +
    `<p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.5">${foot}</p>` +
    `<p style="margin:0;font-size:12px;color:#888;word-break:break-all">${link}</p></div>`;
  const text = `${heading}\n\n${line.replace(/<[^>]+>/g, "")}\n\n${link}\n\n${foot}`;
  return { html, text };
}

/** Stores a fresh single-use token and returns the secret that goes in the link. */
async function issueToken(
  sb: ReturnType<typeof serviceClient>,
  userId: string,
  purpose: "verify" | "reset",
  email: string | null,
  minutes: number,
): Promise<string | null> {
  await sb.from("flux_recovery_tokens").delete().eq("user_id", userId).eq("purpose", purpose);
  const token = newToken();
  const { error } = await sb.from("flux_recovery_tokens").insert({
    token_hash: await sha256(token),
    user_id: userId,
    purpose,
    email,
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
  });
  if (error) {
    console.error("account-recovery: token", error.message);
    return null;
  }
  return token;
}

/** The live token row for a secret, or null. */
async function findToken(sb: ReturnType<typeof serviceClient>, token: unknown, purpose: "verify" | "reset") {
  const t = typeof token === "string" ? token.trim() : "";
  if (t.length < 20 || t.length > 100) return null;
  const { data } = await sb.from("flux_recovery_tokens")
    .select("token_hash, user_id, email, expires_at, used_at")
    .eq("token_hash", await sha256(t)).eq("purpose", purpose).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as { token_hash: string; user_id: string; email: string | null };
}

/** True when `password` is this account's current password. */
async function passwordMatches(signInEmail: string, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || !password) return false;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email: signInEmail, password });
  if (error || !data?.session) return false;
  await anon.auth.signOut().catch(() => {}); // the check must not leave a session behind
  return true;
}

/** request_reset's real work, run after the reply has gone. */
async function handleResetRequest(username: string, ip: string) {
  const sb = serviceClient();
  // Counted here, silently: a refusal would tell the caller something.
  if (await overDailyLimit("recovery-reset-ip", ip, 10)) return;
  if (await overDailyLimit("recovery-reset-name", username, 3)) return;

  const { data: userId } = await sb.rpc("flux_recovery_user_for_email", { p_email: usernameToEmail(username) });
  let emailed = false;
  if (userId && userId !== OWNER_UID && canSend()) {
    const { data: row } = await sb.from("flux_recovery_emails")
      .select("email, verified_at").eq("user_id", userId).maybeSingle();
    if (row?.email && row.verified_at) {
      const token = await issueToken(sb, userId, "reset", null, RESET_MINUTES);
      if (token) {
        const link = `${SITE_URL}index.html#flux-reset=${token}`;
        const { html, text } = emailBody(
          "Set a new Flux password",
          `Someone asked to reset the password for the Flux account <strong>${escapeHtml(username)}</strong>. If that was you, choose a new password with the button below.`,
          "Choose a new password",
          link,
          `This link works once and stops working after ${RESET_MINUTES} minutes. If you did not ask for it, ignore this email: your password stays the same.`,
        );
        emailed = await sendEmail(row.email, "Reset your Flux password", html, text);
      }
    }
  }
  /* No confirmed address (or the email could not be sent): the owner is told,
     exactly as before this function existed, so nobody is left locked out. */
  if (!emailed) {
    await sb.from("flux_password_help").insert({
      username,
      note: "Asked for help from the sign-in screen. No reset email was sent.",
    });
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body" }, 400, origin);
  }
  const action = typeof body.action === "string" ? body.action : "";
  const ip = clientIp(req);
  const sb = serviceClient();

  /* ── Signed out: the emailed token is the proof ── */

  if (action === "request_reset") {
    const username = normalizeUsername(body.username);
    if (!username) return json({ error: "Type your name first." }, 400, origin);
    const work = handleResetRequest(username, ip).catch((e) => console.error("account-recovery: reset", e));
    // Answer now and finish afterwards, so the reply takes the same time
    // whether or not an email is being sent.
    try {
      (globalThis as unknown as { EdgeRuntime: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime.waitUntil(work);
    } catch {
      await work;
    }
    return json({ ok: true }, 200, origin);
  }

  if (action === "verify_email") {
    if (await overDailyLimit("recovery-verify-ip", ip, 30)) return json({ error: "rate_limited" }, 429, origin);
    const row = await findToken(sb, body.token, "verify");
    if (!row) return json({ error: BAD_LINK, code: "bad_token" }, 400, origin);
    // Confirms only the address this link was sent to, not a later one.
    const { data: updated } = await sb.from("flux_recovery_emails")
      .update({ verified_at: new Date().toISOString() })
      .eq("user_id", row.user_id).eq("email", row.email ?? "").select("email");
    await sb.from("flux_recovery_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", row.token_hash);
    if (!updated?.length) return json({ error: BAD_LINK, code: "bad_token" }, 400, origin);
    return json({ ok: true, email: updated[0].email }, 200, origin);
  }

  if (action === "confirm_reset") {
    if (await overDailyLimit("recovery-confirm-ip", ip, 20)) return json({ error: "rate_limited" }, 429, origin);
    const row = await findToken(sb, body.token, "reset");
    if (!row || row.user_id === OWNER_UID) return json({ error: BAD_LINK, code: "bad_token" }, 400, origin);
    const { data: who } = await sb.auth.admin.getUserById(row.user_id);
    const username = emailToUsername(who?.user?.email || "");
    if (!who?.user) return json({ error: BAD_LINK, code: "bad_token" }, 400, origin);

    const password = typeof body.password === "string" ? body.password : "";
    // Checking the link without a password lets the page say "expired" before
    // anyone has typed anything.
    if (!password) return json({ ok: true, username, check: true }, 200, origin);
    const weak = weakPasswordReason(password, username);
    if (weak) return json({ error: weak, code: "weak_password" }, 400, origin);

    // Spend the token first: two requests racing on one link must not both win.
    const { data: spent } = await sb.from("flux_recovery_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", row.token_hash).is("used_at", null).select("token_hash");
    if (!spent?.length) return json({ error: BAD_LINK, code: "bad_token" }, 400, origin);

    const { error } = await sb.auth.admin.updateUserById(row.user_id, { password });
    if (error) {
      console.error("account-recovery: password", error.message);
      return json({ error: "Could not save that password. Ask for a new link and try again." }, 400, origin);
    }
    await sb.rpc("flux_recovery_end_sessions", { p_user: row.user_id });
    return json({ ok: true, username }, 200, origin);
  }

  /* ── Signed in ── */

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) return json({ error: auth.error }, auth.status, origin);
  const { userId, email: signInEmail } = auth as { userId: string; email: string };

  if (action === "status") {
    const { data } = await sb.from("flux_recovery_emails").select("email, verified_at").eq("user_id", userId).maybeSingle();
    return json({ ok: true, email: data?.email ?? "", verified: !!data?.verified_at, canSend: canSend() }, 200, origin);
  }

  if (action !== "set_email" && action !== "remove_email") return json({ error: "Unknown action" }, 400, origin);

  // Capped before the password is looked at, so this cannot be used to guess it.
  if (await overDailyLimit("recovery-set", userId, 8)) {
    return json({ error: "Too many tries for one day. Try again tomorrow.", code: "rate_limited" }, 429, origin);
  }
  if (!(await passwordMatches(signInEmail, body.password))) {
    return json({ error: "That is not your current password.", code: "wrong_password" }, 403, origin);
  }

  if (action === "remove_email") {
    await sb.from("flux_recovery_tokens").delete().eq("user_id", userId);
    await sb.from("flux_recovery_emails").delete().eq("user_id", userId);
    return json({ ok: true, email: "", verified: false }, 200, origin);
  }

  if (action === "set_email") {
    const email = cleanEmail(body.email);
    if (!email) return json({ error: "That does not look like an email address. Check it and try again." }, 400, origin);
    if (!canSend()) {
      return json({ error: "Flux cannot send email yet, so there is nothing to confirm that address with. Try again later.", code: "email_off" }, 503, origin);
    }
    const { data: current } = await sb.from("flux_recovery_emails").select("email, verified_at").eq("user_id", userId).maybeSingle();
    if (current?.email === email && current.verified_at) {
      return json({ ok: true, email, verified: true }, 200, origin);
    }
    const { error } = await sb.from("flux_recovery_emails").upsert({
      user_id: userId,
      email,
      verified_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("account-recovery: save", error.message);
      return json({ error: "Could not save that address." }, 500, origin);
    }
    const token = await issueToken(sb, userId, "verify", email, VERIFY_HOURS * 60);
    const link = `${SITE_URL}index.html#flux-verify=${token}`;
    const { html, text } = emailBody(
      "Confirm your Flux recovery email",
      `This address was added to the Flux account <strong>${escapeHtml(emailToUsername(signInEmail))}</strong>, so a reset link can be sent here if the password is ever forgotten. Confirm that it is yours.`,
      "Confirm this address",
      link,
      `This link stops working after ${VERIFY_HOURS} hours. If you did not add this address to a Flux account, ignore this email and nothing will be sent here again.`,
    );
    const sent = !!token && await sendEmail(email, "Confirm your Flux recovery email", html, text);
    if (!sent) {
      return json({ error: "That address was saved, but the confirmation email could not be sent. Try again in a moment.", code: "send_failed", email, verified: false }, 502, origin);
    }
    return json({ ok: true, email, verified: false, sent: true }, 200, origin);
  }

  return json({ error: "Unknown action" }, 400, origin);
});
