import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    const token = url.searchParams.get("token");
    if (!targetUrl || !token) return new Response(JSON.stringify({ error: "Missing url or token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch(targetUrl, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });
    const d = await res.json();
    return new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
