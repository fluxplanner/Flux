/**
 * security-watch — the 24/7 alarm.
 *
 * Called every 15 minutes by .github/workflows/security-watch.yml, and by any
 * scheduled workflow that fails. Runs flux_security_scan(), turns the result
 * into alerts (_shared/security-rules.ts), and sends each new one to Discord
 * and email. Each call also counts as activity, which keeps the free-plan
 * project from pausing.
 *
 * Auth: x-monitor-secret must equal the MONITOR_SECRET function secret. Deploy
 * with --no-verify-jwt; GitHub holds only that secret, never a Supabase key.
 *
 * The response says how many alerts went out and nothing else, because GitHub
 * Actions logs on this public repo are public.
 *
 * Secrets: MONITOR_SECRET, DISCORD_WEBHOOK_URL, RESEND_API_KEY, ALERT_EMAIL,
 * ALERT_EMAIL_FROM (optional).
 */
import { serviceClient } from "../_shared/auth.ts";
import { evaluate, formatAlert, type Alert } from "../_shared/security-rules.ts";

const MONITOR_SECRET = Deno.env.get("MONITOR_SECRET") ?? "";
const DISCORD = Deno.env.get("DISCORD_WEBHOOK_URL") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_TO = Deno.env.get("ALERT_EMAIL") ?? "";
const EMAIL_FROM = Deno.env.get("ALERT_EMAIL_FROM") ?? "Flux Monitor <onboarding@resend.dev>";

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function secretMatches(given: string): Promise<boolean> {
  if (!MONITOR_SECRET || !given) return false;
  // Compare digests so the time taken says nothing about how much matched.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(MONITOR_SECRET)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Returns how many channels took the message. */
async function send(a: Alert): Promise<number> {
  const text = formatAlert(a);
  let sent = 0;
  if (DISCORD) {
    try {
      const r = await fetch(DISCORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
      });
      if (r.ok) sent++;
      else console.error("security-watch: discord", r.status);
    } catch (e) {
      console.error("security-watch: discord", e);
    }
  }
  if (RESEND && EMAIL_TO) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [EMAIL_TO],
          subject: `${a.severity === "critical" ? "[URGENT] " : ""}Flux: ${a.title}`,
          text: text.replace(/\*\*/g, ""),
        }),
      });
      if (r.ok) sent++;
      else console.error("security-watch: email", r.status);
    } catch (e) {
      console.error("security-watch: email", e);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!(await secretMatches(req.headers.get("x-monitor-secret") ?? ""))) {
    return reply({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body = scan */ }
  const kind = String(body.kind ?? "scan");
  const db = serviceClient();

  // A scheduled workflow failed. The workflow name and run link are all it
  // sends; the logs stay on GitHub.
  if (kind === "workflow_failed") {
    const workflow = String(body.workflow ?? "a scheduled check").slice(0, 80);
    const runUrl = String(body.run_url ?? "");
    const safeUrl = /^https:\/\/github\.com\/fluxplanner\/Flux\/actions\/runs\/\d+/.test(runUrl) ? runUrl : "";
    const alert: Alert = {
      signal: `workflow:${workflow}`,
      fingerprint: "failing",
      repeatMinutes: 6 * 60,
      severity: "warning",
      title: `${workflow} failed`,
      lines: [safeUrl ? `Run: ${safeUrl}` : "Open GitHub → Actions to see the run."],
    };
    const { data: claim } = await db.rpc("flux_security_alert_claim", {
      p_signal: alert.signal, p_fingerprint: alert.fingerprint, p_repeat_minutes: alert.repeatMinutes,
    });
    return reply({ ok: true, alerts: claim ? (await send(alert) ? 1 : 0) : 0 });
  }

  // A scheduled workflow passed: clear its state so the next failure alerts.
  if (kind === "workflow_ok") {
    const workflow = String(body.workflow ?? "").slice(0, 80);
    if (workflow) await db.from("flux_security_alert_state").delete().eq("signal", `workflow:${workflow}`);
    return reply({ ok: true, alerts: 0 });
  }

  const { data: scan, error } = await db.rpc("flux_security_scan", { p_minutes: 20 });
  if (error) {
    console.error("security-watch: scan", error.message);
    return reply({ error: "scan_failed" }, 500);
  }

  let sent = 0;
  const alerts = evaluate(scan ?? {});
  for (const a of alerts) {
    const { data: claim, error: claimErr } = await db.rpc("flux_security_alert_claim", {
      p_signal: a.signal, p_fingerprint: a.fingerprint, p_repeat_minutes: a.repeatMinutes,
    });
    if (claimErr) console.error("security-watch: claim", claimErr.message);
    if (!claim) continue;
    if (await send(a)) sent++;
    // Nothing got through (channel down, secret missing): forget the claim so
    // the next run tries again instead of staying silent for hours.
    else await db.from("flux_security_alert_state").delete().eq("signal", a.signal);
  }
  // A signal that cleared is forgotten, so if it comes back it alerts at once.
  const active = alerts.map((a) => a.signal);
  const cleared = ["failed_logins", "power_grants", "rls_missing", "ai_usage"].filter((s) => !active.includes(s));
  if (cleared.length) await db.from("flux_security_alert_state").delete().in("signal", cleared);

  return reply({ ok: true, alerts: sent });
});
