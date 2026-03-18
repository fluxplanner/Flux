import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { system, messages, imageBase64, mimeType } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "Invalid request: messages must be an array" }, 400);
    }

    // ── IMAGE PATH: use Gemini vision ──
    if (imageBase64) {
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) return json({ error: "GEMINI_API_KEY not set in Supabase secrets" }, 500);

      const lastMsg = messages[messages.length - 1]?.content || "";
      const parts = [
        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
        { text: (system ? system + "\n\n" : "") + lastMsg },
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Gemini API error ${res.status}: ${err}` }, 502);
      }

      const d = await res.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return json({ content: [{ type: "text", text }] });
    }

    // ── TEXT PATH: use Groq ──
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({ error: "GROQ_API_KEY not set in Supabase secrets" }, 500);

    const groqMessages = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages,
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: groqMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `Groq API error ${res.status}: ${err}` }, 502);
    }

    const d = await res.json();
    const text = d.choices?.[0]?.message?.content || "";
    return json({ content: [{ type: "text", text }] });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
