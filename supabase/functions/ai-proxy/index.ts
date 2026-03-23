import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { system, messages, imageBase64, mimeType } = await req.json();
    if (!messages || !Array.isArray(messages)) return json({ error: "Invalid request" }, 400);

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return json({ error: "GROQ_API_KEY not set in Supabase secrets" }, 500);

    const lastMsg = messages[messages.length - 1]?.content || "";

    // Image → Groq Llama 4 Scout (vision model)
    if (imageBase64) {
      const imageUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          max_tokens: 2048,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageUrl } },
                { type: "text", text: lastMsg || "Please analyze this image." }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return json({ error: `Groq vision error: ${err?.error?.message || res.status}` }, 500);
      }

      const d = await res.json();
      const text = d.choices?.[0]?.message?.content;
      if (!text) return json({ error: "Groq returned no content" }, 500);
      return json({ content: [{ type: "text", text }] });
    }

    // Text only → Groq Llama 3.3 70B
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [...(system ? [{ role: "system", content: system }] : []), ...messages]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return json({ error: `Groq error: ${err?.error?.message || res.status}` }, 500);
    }

    const d = await res.json();
    const text = d.choices?.[0]?.message?.content;
    if (!text) return json({ error: "Groq returned no content" }, 500);
    return json({ content: [{ type: "text", text }] });

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
