import { serviceClient, corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  }

  const sb = serviceClient();
  const { data, error } = await sb
    .from("flux_ical_feeds")
    .select("ics_body")
    .eq("token", token)
    .maybeSingle();

  if (error || !data?.ics_body) {
    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  }

  return new Response(data.ics_body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="flux.ics"',
      "Cache-Control": "public, max-age=300",
      ...corsHeaders(origin),
    },
  });
});
