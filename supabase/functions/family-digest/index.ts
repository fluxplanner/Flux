/**
 * family-digest — C6: weekly guardian digest (flag enable_family_digest).
 *
 * Runs on a weekly schedule (pg_cron → pg_net POST, same pattern as
 * daily-briefing) with the service role. For every ACTIVE family link whose
 * student opted in (flux_parent_links.digest_opt_in — explicit, student-set),
 * it computes a digest from the stored planner blob: WINS FIRST (completed
 * work, focus sessions), then the upcoming week — in the guardian's
 * language. Categories are student-chosen (digest_categories, default
 * conservative: wins + upcoming). Grades are never included at any setting.
 *
 * One flux_family_digests row per link per week (idempotent upsert) records
 * exactly what was shared — students can read their own rows.
 *
 * Email: sent via Resend when RESEND_API_KEY is configured; otherwise the
 * digest is rendered + recorded with status 'rendered' (no send), which
 * still gives the in-app guardian surface something to show.
 *
 * Auth: CRON_SECRET header or service-role JWT — never the anon key.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("DIGEST_FROM_EMAIL") ?? "Flux Planner <digest@fluxplanner.app>";

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() - (dow - 1));
  return iso(d);
}

/* ── i18n (extensible dict; guardian's language from the link row) ── */
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    subject: "This week with {name} on Flux",
    wins: "Wins first",
    completed: "{n} tasks completed this week",
    focus: "{n} focus sessions logged",
    streak: "Keeping a steady rhythm",
    upcoming: "The week ahead",
    due: "{n} tasks on the plan (~{h}h of work)",
    tests: "{n} tests or quizzes coming up",
    calm: "No assessments scheduled — a lighter week.",
    footer: "Sent because {name} chose to share this. They control what's included, in Flux → Settings → Family sharing.",
  },
  es: {
    subject: "Esta semana con {name} en Flux",
    wins: "Primero, los logros",
    completed: "{n} tareas completadas esta semana",
    focus: "{n} sesiones de concentración registradas",
    streak: "Manteniendo un ritmo constante",
    upcoming: "La próxima semana",
    due: "{n} tareas en el plan (~{h}h de trabajo)",
    tests: "{n} exámenes o pruebas próximas",
    calm: "Sin evaluaciones programadas — una semana más ligera.",
    footer: "Enviado porque {name} decidió compartirlo. Ellos controlan el contenido en Flux → Ajustes → Compartir con la familia.",
  },
  fr: {
    subject: "Cette semaine avec {name} sur Flux",
    wins: "Les réussites d'abord",
    completed: "{n} tâches terminées cette semaine",
    focus: "{n} sessions de concentration",
    streak: "Un rythme régulier",
    upcoming: "La semaine à venir",
    due: "{n} tâches au programme (~{h}h de travail)",
    tests: "{n} contrôles ou interrogations à venir",
    calm: "Aucune évaluation prévue — une semaine plus légère.",
    footer: "Envoyé parce que {name} a choisi de le partager. Le contenu se règle dans Flux → Paramètres → Partage familial.",
  },
};
function t(lang: string, key: string, vars: Record<string, string | number> = {}) {
  const dict = STRINGS[lang] ?? STRINGS.en;
  let s = dict[key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/* ── digest math from the planner blob ── */
function digestFor(data: Record<string, unknown>, categories: string[]) {
  const today = iso(new Date());
  const weekAgo = iso(new Date(Date.now() - 7 * 864e5));
  const in7 = iso(new Date(Date.now() + 7 * 864e5));
  const tasks = (Array.isArray((data as any)?.tasks) ? (data as any).tasks : []) as Array<any>;

  const wins = {
    completed: tasks.filter((x) => x?.done && x.completedAt && iso(new Date(x.completedAt)) >= weekAgo).length,
    focusSessions: (Array.isArray((data as any)?.flux_session_log) ? (data as any).flux_session_log : [])
      .filter((s: any) => s?.date && s.date >= weekAgo).length,
  };
  const open = tasks.filter((x) => x && !x.done && x.date && x.date >= today && x.date <= in7);
  const upcoming = {
    count: open.length,
    estHours: Math.round(open.reduce((s, x) => s + (Number(x.estTime) || 30), 0) / 60),
    assessments: open.filter((x) => x.type === "test" || x.type === "quiz").length,
  };
  const out: Record<string, unknown> = {};
  if (categories.includes("wins")) out.wins = wins;
  if (categories.includes("upcoming")) out.upcoming = upcoming;
  return out;
}

/* ── minimal HTML (wins first, calm tone, no branding noise) ── */
function renderHtml(lang: string, studentName: string, payload: any): string {
  const rows: string[] = [];
  if (payload.wins) {
    rows.push(`<h2 style="font-size:15px;margin:18px 0 6px">${t(lang, "wins")}</h2>`);
    rows.push(`<p style="margin:2px 0">✅ ${t(lang, "completed", { n: payload.wins.completed })}</p>`);
    if (payload.wins.focusSessions) rows.push(`<p style="margin:2px 0">⏱ ${t(lang, "focus", { n: payload.wins.focusSessions })}</p>`);
  }
  if (payload.upcoming) {
    rows.push(`<h2 style="font-size:15px;margin:18px 0 6px">${t(lang, "upcoming")}</h2>`);
    rows.push(`<p style="margin:2px 0">📋 ${t(lang, "due", { n: payload.upcoming.count, h: payload.upcoming.estHours })}</p>`);
    rows.push(`<p style="margin:2px 0">${payload.upcoming.assessments ? "📝 " + t(lang, "tests", { n: payload.upcoming.assessments }) : t(lang, "calm")}</p>`);
  }
  return `<div style="font:14px/1.6 system-ui,sans-serif;color:#1a2030;max-width:520px;margin:0 auto;padding:16px">
    <h1 style="font-size:17px">${t(lang, "subject", { name: studentName })}</h1>
    ${rows.join("\n")}
    <p style="font-size:11px;color:#8a90a3;margin-top:22px">${t(lang, "footer", { name: studentName })}</p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!(CRON_SECRET && secret === CRON_SECRET) && auth !== `Bearer ${SERVICE_ROLE}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Respect the kill switch: run only if the flag is enabled globally or for
  // at least one school (the UI that sets digest_opt_in is also flag-gated,
  // but the cron must stop when the flag is pulled — rollback story).
  const { data: flag } = await sb.from("flux_feature_flags")
    .select("default_enabled").eq("key", "enable_family_digest").maybeSingle();
  let anySchool = false;
  if (!flag?.default_enabled) {
    const { count } = await sb.from("flux_school_feature_flags")
      .select("id", { count: "exact", head: true })
      .eq("flag_key", "enable_family_digest").eq("enabled", true);
    anySchool = (count ?? 0) > 0;
  }
  if (!flag?.default_enabled && !anySchool) {
    return new Response(JSON.stringify({ ok: true, skipped: "flag_off" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const weekStart = mondayOfThisWeek();
  const { data: links, error } = await sb.from("flux_parent_links")
    .select("id, student_id, parent_id, student_label, digest_language, digest_categories, digest_channel")
    .eq("status", "active").eq("digest_opt_in", true).not("parent_id", "is", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let rendered = 0, sent = 0;
  for (const link of links ?? []) {
    try {
      if (link.digest_channel === "none") continue;
      const cats = Array.isArray(link.digest_categories) ? link.digest_categories : ["wins", "upcoming"];
      const { data: ud } = await sb.from("user_data").select("data").eq("user_id", link.student_id).maybeSingle();
      const payload = digestFor(ud?.data ?? {}, cats);
      if (!Object.keys(payload).length) continue; // student excluded everything

      const lang = STRINGS[link.digest_language] ? link.digest_language : "en";
      const name = link.student_label || "your student";
      const html = renderHtml(lang, name, payload);

      let status = "rendered";
      if (link.digest_channel === "email" && link.parent_id) {
        const { data: pu } = await sb.auth.admin.getUserById(link.parent_id);
        const email = pu?.user?.email;
        if (email && (await sendEmail(email, t(lang, "subject", { name }), html))) {
          status = "sent";
          sent++;
        }
      }
      const { error: upErr } = await sb.from("flux_family_digests").upsert(
        { link_id: link.id, student_id: link.student_id, week_start: weekStart, payload, status },
        { onConflict: "link_id,week_start" },
      );
      if (!upErr) rendered++;
    } catch (_) { /* one bad link never blocks the batch */ }
  }

  return new Response(JSON.stringify({ ok: true, weekStart, rendered, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
