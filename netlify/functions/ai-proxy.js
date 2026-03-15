
exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { system, messages } = JSON.parse(event.body || '{}');
    if (!messages || !Array.isArray(messages)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { statusCode: response.status, headers, body: JSON.stringify({ error: err.error?.message || 'Groq error' }) };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { statusCode: 200, headers, body: JSON.stringify({ content: [{ type: 'text', text }] }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
