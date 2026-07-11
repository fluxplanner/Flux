/**
 * notify-push — C7: due-soon Web Push reminders (flag enable_web_push).
 *
 * Runs on a schedule (hourly pg_cron → pg_net POST) with the service role.
 * For every user with a push subscription it reads the planner blob and
 * sends AT MOST ONE calm reminder per run when tasks are due within 24h.
 *
 * Server-side guardrails (a stale client can never cause a 2am buzz):
 *   - flag registry kill switch (same pattern as family-digest)
 *   - settings.notifyDueSoon must be true (existing Alerts setting)
 *   - quiet hours: settings.quiet + dndStart/dndEnd (school hours) are
 *     honored in PUSH_TZ (defaults to America/Detroit for the pilot
 *     district; override with the PUSH_TZ env var)
 *   - overnight suppression: nothing sends between 21:00 and 07:00
 *   - dead endpoints (404/410) are pruned
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@fluxplanner.app";
const PUSH_TZ = Deno.env.get("PUSH_TZ") ?? "America/Detroit";

function localHM(tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function inWindow(hm: string, start: string, end: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
  return start <= end ? hm >= start && hm <= end : hm >= start || hm <= end;
}
function iso(d: Date) { return d.toISOString().slice(0, 10); }

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!(CRON_SECRET && secret === CRON_SECRET) && auth !== `Bearer ${SERVICE_ROLE}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_vapid_keys" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Kill switch: flag registry (global default or any school override).
  const { data: flag } = await sb.from("flux_feature_flags")
    .select("default_enabled").eq("key", "enable_web_push").maybeSingle();
  if (!flag?.default_enabled) {
    const { count } = await sb.from("flux_school_feature_flags")
      .select("id", { count: "exact", head: true })
      .eq("flag_key", "enable_web_push").eq("enabled", true);
    if (!(count ?? 0)) {
      return new Response(JSON.stringify({ ok: true, skipped: "flag_off" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Overnight suppression regardless of per-user settings.
  const nowHM = localHM(PUSH_TZ);
  if (nowHM >= "21:00" || nowHM < "07:00") {
    return new Response(JSON.stringify({ ok: true, skipped: "overnight" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subs, error } = await sb.from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const byUser = new Map<string, any[]>();
  (subs ?? []).forEach((s) => {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  });

  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + 864e5));
  let sent = 0, pruned = 0;

  for (const [userId, userSubs] of byUser) {
    try {
      const { data: ud } = await sb.from("user_data").select("data").eq("user_id", userId).maybeSingle();
      const blob: any = ud?.data ?? {};
      const settings = blob.flux_settings ?? blob.settings ?? {};
      if (settings.notifyDueSoon === false) continue;
      // Quiet hours (school DND window) — server-enforced.
      if (settings.quiet && inWindow(nowHM, String(settings.dndStart || ""), String(settings.dndEnd || ""))) continue;

      const tasks = (Array.isArray(blob.tasks) ? blob.tasks : []) as any[];
      const dueSoon = tasks.filter((t) => t && !t.done && (t.date === today || t.date === tomorrow));
      if (!dueSoon.length) continue;

      const first = dueSoon[0];
      const more = dueSoon.length - 1;
      const payload = JSON.stringify({
        title: dueSoon.length === 1 ? "Due soon" : `${dueSoon.length} tasks due soon`,
        body: more > 0 ? `${first.name} and ${more} more by tomorrow.` : `${first.name} — due ${first.date === today ? "today" : "tomorrow"}.`,
        tag: "flux-due-soon",
      });

      for (const s of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
          await sb.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
        } catch (err: any) {
          const code = err?.statusCode ?? 0;
          if (code === 404 || code === 410) {
            await sb.from("push_subscriptions").delete().eq("id", s.id);
            pruned++;
          }
        }
      }
    } catch (_) { /* one user never blocks the batch */ }
  }

  return new Response(JSON.stringify({ ok: true, sent, pruned }), {
    headers: { "Content-Type": "application/json" },
  });
});
