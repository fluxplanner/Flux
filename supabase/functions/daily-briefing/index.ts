/**
 * daily-briefing — server-side overnight Flux Intelligence briefing.
 *
 * Runs on a schedule (pg_cron → pg_net POST, see the migration) with the
 * service role. For every student user_data row it computes a lightweight
 * briefing from the stored planner blob (the same signals the client engines
 * produce) and upserts one row per user per day into flux_daily_briefings.
 * The client reads today's row on load and shows it in the briefing banner;
 * if the function hasn't run, the client falls back to computing locally.
 *
 * Auth: requires the CRON_SECRET header (shared secret) OR a service-role JWT.
 * Never trust the anon key here — this reads every user's data.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function dayOffset(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

/** Compute a briefing from one user's planner blob. Mirrors the client engines. */
function briefingFor(data: Record<string, unknown>) {
  const today = todayISO();
  const tasks = (Array.isArray((data as any)?.tasks) ? (data as any).tasks : []) as Array<any>;
  const open = tasks.filter((t) => t && !t.done);
  const overdue = open.filter((t) => t.date && t.date < today);
  const dueToday = open.filter((t) => t.date === today);
  const in7 = dayOffset(7);
  const next7 = open.filter((t) => t.date && t.date >= today && t.date <= in7);
  const next7Min = next7.reduce((s, t) => s + (Number(t.estTime) || 30), 0);

  const moods = (Array.isArray((data as any)?.flux_mood) ? (data as any).flux_mood : []) as Array<any>;
  const recent = moods.slice(-3);
  const lowSleep = recent.filter((m) => Number(m.sleep) && Number(m.sleep) < 6.5).length;
  const highStress = recent.filter((m) => Number(m.stress) && Number(m.stress) >= 7).length;
  const burnout = lowSleep >= 2 || highStress >= 2 ? "Elevated" : "Healthy";

  const headline = overdue.length
    ? `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"} to clear`
    : dueToday.length
    ? `${dueToday.length} due today`
    : next7.length
    ? `~${Math.round(next7Min / 60)}h of work this week`
    : "You're on track";

  const signals: string[] = [];
  if (overdue.length) signals.push(`${overdue.length} overdue`);
  if (dueToday.length) signals.push(`${dueToday.length} due today`);
  if (next7.length) signals.push(`~${Math.round(next7Min / 60)}h next 7 days`);
  if (burnout === "Elevated") signals.push("burnout risk elevated");

  return {
    headline,
    burnout,
    overdue: overdue.length,
    dueToday: dueToday.length,
    weekHours: Math.round(next7Min / 60),
    signals,
  };
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const okSecret = CRON_SECRET && secret === CRON_SECRET;
  const okService = auth === `Bearer ${SERVICE_ROLE}`;
  if (!okSecret && !okService) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const today = todayISO();

  let from = 0;
  const PAGE = 500;
  let processed = 0;
  for (;;) {
    const { data, error } = await sb
      .from("user_data")
      .select("user_id, data")
      .range(from, from + PAGE - 1);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    if (!data || !data.length) break;

    const rows = data
      .map((r: any) => {
        try {
          const b = briefingFor(r.data || {});
          return { user_id: r.user_id, brief_date: today, payload: b, seen: false };
        } catch (_) { return null; }
      })
      .filter(Boolean);

    if (rows.length) {
      const { error: upErr } = await sb
        .from("flux_daily_briefings")
        .upsert(rows as any, { onConflict: "user_id,brief_date" });
      if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
      processed += rows.length;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return new Response(JSON.stringify({ ok: true, date: today, processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
