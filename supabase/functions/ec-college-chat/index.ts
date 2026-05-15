import { verifyUserJWT, json, corsHeaders } from "../_shared/auth.ts";

const UA = "FluxPlanner/1.0 (student planner; college admissions help)";

// Best-effort per-isolate rate limit: 12 calls/user/min. Resets on cold start.
const _hits = new Map<string, number[]>();
function rateOk(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 12;
  const arr = (_hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  _hits.set(userId, arr);
  return true;
}

async function wikipediaContext(collegeName: string): Promise<string> {
  try {
    const s = encodeURIComponent(collegeName);
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${s}&limit=2&namespace=0&format=json`,
      { headers: { "User-Agent": UA } },
    );
    const os = await r.json();
    const titles = os[1] as string[];
    if (!titles?.length) return "";
    const parts: string[] = [];
    for (const title of titles.slice(0, 2)) {
      const tr = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { "User-Agent": UA } },
      );
      if (!tr.ok) continue;
      const j = await tr.json();
      if (j.extract) parts.push(`[Wikipedia — ${title}]\n${j.extract}`);
    }
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

async function braveWebContext(collegeName: string, key: string): Promise<string> {
  const queries = [
    `${collegeName} undergraduate admissions extracurricular activities holistic review`,
    `${collegeName} admissions office values first-year applicants`,
    `${collegeName} admissions blog student involvement`,
  ];
  const chunks: string[] = [];
  for (const q of queries) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
      });
      if (!res.ok) continue;
      const j = await res.json();
      for (const item of j.web?.results || []) {
        chunks.push(`[${item.title}]\n${item.description || ""}\nURL: ${item.url}`);
      }
    } catch {
      /* skip query */
    }
  }
  return chunks.join("\n\n");
}

async function redditForumContext(collegeName: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${collegeName} extracurricular admissions`);
    const url =
      `https://www.reddit.com/r/ApplyingToCollege/search.json?q=${q}&restrict_sr=1&limit=7&sort=relevance`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return "";
    const j = await r.json();
    const children = j?.data?.children || [];
    return children
      .map((c: { data: { title: string; selftext?: string; score?: number; permalink?: string } }) => {
        const p = c.data;
        const body = (p.selftext || "").slice(0, 480).replace(/\s+/g, " ").trim();
        const link = p.permalink ? `https://www.reddit.com${p.permalink}` : "";
        return `[Forum — r/ApplyingToCollege: "${p.title}" | score ${p.score ?? "?"}]\n${body || "(link post — see URL)"}\n${link}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

function trimContext(s: string, max = 14000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n… [context trimmed]";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // Require a real Supabase user. Anonymous access was burning Groq quota.
  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return json({ error: auth.error }, auth.status, origin);
  }

  if (!rateOk(auth.userId)) {
    return json(
      { error: "Too many requests. Wait a minute and try again." },
      429,
      origin,
    );
  }

  try {
    const body = await req.json();
    const { messages, collegeName, profile, plannerDigest } = body;
    if (!messages || !Array.isArray(messages) || !collegeName || typeof collegeName !== "string") {
      return json({ error: "Invalid request: collegeName and messages[] required" }, 400, origin);
    }

    const safeName = collegeName.trim().slice(0, 160);
    const prof =
      typeof profile === "object" && profile
        ? `Student activities (from their planner): ${String(profile.activities || "not listed")}
Target school list in app: ${String(profile.schools || "not listed")}`
        : "";

    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY") || "";

    const [wiki, brave, reddit] = await Promise.all([
      wikipediaContext(safeName),
      braveKey ? braveWebContext(safeName, braveKey) : Promise.resolve(""),
      redditForumContext(safeName),
    ]);

    const hasAny = Boolean(wiki || brave || reddit);
    const researchPack = trimContext(
      [
        `=== RESEARCH CONTEXT for "${safeName}" (fetched before this reply). Always prioritize official .edu admissions pages for requirements, deadlines, and policies. ===`,
        wiki && `--- Overview (Wikipedia) ---\n${wiki}`,
        brave && `--- Web results (may include official sites, news, third-party articles) ---\n${brave}`,
        reddit && `--- Discussion forums (Reddit r/ApplyingToCollege — anecdotal, not from admissions officers) ---\n${reddit}`,
        !hasAny &&
          "No external snippets were retrieved. Rely on general guidance and tell the student to verify everything on the college's official admissions website.",
        !brave &&
          hasAny &&
          "(Optional: set BRAVE_SEARCH_API_KEY on this Edge Function for richer official-page and article coverage.)",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );

    const digestBlock =
      typeof plannerDigest === "string" && plannerDigest.trim()
        ? `\n\n=== STUDENT PLANNER EXPORT (read-only; tasks, grades, notes, mood, timer, school, ECs, etc.) ===\n${trimContext(
            plannerDigest.trim(),
            12000,
          )}`
        : "";

    const system = `You are Flux, a college admissions assistant embedded in a student's planner.

You MUST:
- Use the PLANNER EXPORT (if present) for anything about this student's real workload, grades, activities, notes, mood, or schedule. Cross-reference it with college research when giving EC or fit advice.
- Ground college-specific claims in the RESEARCH CONTEXT below. Synthesize patterns (forums, web snippets) but never fabricate quotes, stats, or URLs not implied by the context.
- Label sources: forum vs official-sounding web vs general knowledge.
- Say clearly that Reddit/forums reflect other applicants' experiences, not what an AO said word-for-word unless the snippet is clearly from an official source.
- Tell the student to double-check deadlines, essay prompts, and requirements on the institution's official undergraduate admissions site.

${prof ? `Student profile (summary):\n${prof}\n\n` : ""}${digestBlock ? `${digestBlock}\n\n` : ""}${researchPack}`;

    const cleanMsgs = messages
      .filter((m: { role?: string; content?: string }) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      )
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 12000) }));

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({ error: "GROQ_API_KEY not set" }, 500, origin);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [{ role: "system", content: system }, ...cleanMsgs],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json(
        { error: `Groq error: ${err?.error?.message || res.status}` },
        502,
        origin,
      );
    }

    const d = await res.json();
    const text = d.choices?.[0]?.message?.content;
    if (!text) return json({ error: "Groq returned no content" }, 502, origin);

    return json(
      {
        content: [{ type: "text", text }],
        meta: {
          college: safeName,
          sourcesUsed: {
            wikipedia: Boolean(wiki),
            webSearch: Boolean(brave),
            applyingToCollegeReddit: Boolean(reddit),
          },
        },
      },
      200,
      origin,
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 500, origin);
  }
});
