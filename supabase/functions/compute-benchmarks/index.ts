/**
 * compute-benchmarks — nightly anonymized aggregation for Flux Benchmarks.
 *
 * Reads user_data blobs for users who OPTED IN
 * (data.settings.share_anon_stats === true), computes a handful of population
 * priors from counts/ratios only (never raw text/titles/identities), suppresses
 * anything with too small a sample (k-anonymity), and upserts public.flux_benchmarks.
 *
 * Invoke nightly via pg_cron + pg_net (see migration), or manually:
 *   curl -X POST https://<ref>.supabase.co/functions/v1/compute-benchmarks \
 *     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
 *
 * Requires service-role context (it reads across users) — never call from the
 * browser with the anon key.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIN_USERS = 20;   // k-anonymity: don't publish a stat backed by < 20 people
const MIN_TASKS = 50;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing service env" }, 500);
  const sb = createClient(url, serviceKey);

  // Pull blobs in pages. user_data: { user_id, data: {...planner keys...} }
  let from = 0; const PAGE = 1000;
  let users = 0, tasksTotal = 0, lateMisses = 0;
  let focusDayCount = 0, focusMinTotal = 0;
  let estTotal = 0, actTotal = 0, estUsers = 0;

  for (;;) {
    const { data, error } = await sb.from("user_data")
      .select("data").range(from, from + PAGE - 1);
    if (error) return json({ error: error.message }, 500);
    if (!data || !data.length) break;

    for (const row of data) {
      const d = (row && (row as any).data) || {};
      const settings = d.settings || {};
      if (settings.share_anon_stats !== true) continue; // opt-in only
      users++;

      const tasks = Array.isArray(d.tasks) ? d.tasks : [];
      let uEst = 0, uAct = 0;
      for (const t of tasks) {
        if (!t || !t.date) continue;
        tasksTotal++;
        const onTime = t.done && t.completedAt &&
          String(new Date(t.completedAt).toISOString().slice(0, 10)) <= t.date;
        if (!onTime) lateMisses++;
        if (t.estTime) uEst += Number(t.estTime) || 0;
      }

      const sessions = Array.isArray(d.flux_session_log) ? d.flux_session_log : [];
      const byDay: Record<string, number> = {};
      for (const s of sessions) {
        if (!s || !s.date) continue;
        byDay[s.date] = (byDay[s.date] || 0) + (Number(s.mins) || 0);
        if (s.subject) uAct += Number(s.mins) || 0;
      }
      for (const day of Object.keys(byDay)) { focusDayCount++; focusMinTotal += byDay[day]; }
      if (uEst > 60 && uAct > 60) { estTotal += uEst; actTotal += uAct; estUsers++; }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const rows: Array<Record<string, unknown>> = [];
  if (users >= MIN_USERS && tasksTotal >= MIN_TASKS) {
    const missRate = lateMisses / tasksTotal;
    rows.push({ key: "late_task_miss_rate", value: round(missRate), unit: "ratio", sample_size: tasksTotal,
      label: `Across Flux students, ${Math.round(missRate * 100)}% of dated tasks aren't finished on time.` });
    if (focusDayCount >= MIN_USERS) {
      rows.push({ key: "avg_daily_focus_min", value: Math.round(focusMinTotal / focusDayCount), unit: "minutes", sample_size: focusDayCount,
        label: `Typical active study day is about ${Math.round(focusMinTotal / focusDayCount)} focused minutes.` });
    }
    if (estUsers >= MIN_USERS && estTotal > 0) {
      const ratio = actTotal / estTotal;
      rows.push({ key: "time_estimate_ratio", value: round(ratio), unit: "ratio", sample_size: estUsers,
        label: `Students spend about ${Math.round(ratio * 100)}% of their estimated time on tasks.` });
    }
  }

  if (rows.length) {
    for (const r of rows) (r as any).updated_at = new Date().toISOString();
    const { error } = await sb.from("flux_benchmarks").upsert(rows, { onConflict: "key" });
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, contributors: users, published: rows.map((r) => r.key) });
});

function round(n: number) { return Math.round(n * 1000) / 1000; }
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
