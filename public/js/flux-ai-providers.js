/* ════════════════════════════════════════════════════════════════════════════
 * FluxAIProviders — BYOK multi-provider chat client.
 *
 * Lets Flux AI talk to any major AI provider using the user's own API key.
 * Keys are stored locally (localStorage, never synced) and only sent to the
 * provider they belong to. Adds a single normalized `call()` surface so any
 * Flux skill can ask "another AI" without caring which one.
 *
 * Public API on window.FluxAIProviders:
 *   .providers                       array of { id, name, models, ... }
 *   .listConfigured()                IDs of providers with a key stored
 *   .getKey(providerId) / .setKey(providerId, key) / .clearKey(providerId)
 *   .resolveModel(spec) → { provider, model }   (parse 'gpt-4o', 'claude-sonnet', etc.)
 *   .call({ provider?, model, system?, messages|user, temperature?, timeoutMs? })
 *       → Promise<{ ok, text, raw?, error?, provider, model }>
 *
 * Integrates with FluxSkills (registers `/ask` so users can route to any
 * configured provider mid-conversation) and FluxConnectors (registers a
 * connector group "AI Providers" so keys show up in Settings → Connectors).
 *
 * Design notes:
 *   - All calls run client-side, browser → provider. CORS is supported by
 *     Anthropic/OpenAI/Gemini/Groq/Mistral/DeepSeek/Perplexity as of 2026.
 *   - Each provider has a normalizer that turns Flux's neutral message
 *     shape into the provider's request body and pulls plain text out of
 *     the response.
 *   - On 401/403 we surface a clear "check your API key" toast.
 *   - On 429 we surface a friendly "rate limited — try again in a minute".
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const KEY_PREFIX = 'flux_aiprov_key_'; // per-provider local key store
  const ROUTE_KEY = 'flux_aiprov_default_route_v1';

  /* ───────── Provider registry ───────── */

  const PROVIDERS = [
    {
      id: 'anthropic',
      name: 'Anthropic (Claude)',
      icon: '🅰️',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#D97757" stroke-width="2.2" stroke-linecap="round"><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6M6 6l3.2 3.2M14.8 14.8 18 18M18 6l-3.2 3.2M9.2 14.8 6 18"/></svg>',
      site: 'https://console.anthropic.com/settings/keys',
      keyHint: 'Starts with sk-ant-…',
      models: [
        { id: 'claude-3-5-sonnet-latest',  label: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-latest',   label: 'Claude 3.5 Haiku (fast)' },
        { id: 'claude-3-opus-latest',      label: 'Claude 3 Opus' },
      ],
      endpoint: 'https://api.anthropic.com/v1/messages',
      headers: (key) => ({
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Required for browser CORS as of late 2024.
        'anthropic-dangerous-direct-browser-access': 'true',
      }),
      shapeRequest: ({ model, system, messages, temperature }) => ({
        model: model || 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        ...(system ? { system: String(system) } : {}),
        ...(temperature != null ? { temperature } : {}),
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        })),
      }),
      extractText: (json) => {
        if (!json) return '';
        if (Array.isArray(json.content)) {
          return json.content.map((b) => (b && b.type === 'text' ? b.text : '')).join('').trim();
        }
        return '';
      },
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT)',
      icon: '◯',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10A37F" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 19 7v10l-7 4-7-4V7z"/><circle cx="12" cy="12" r="3.2"/></svg>',
      site: 'https://platform.openai.com/api-keys',
      keyHint: 'Starts with sk-…',
      models: [
        { id: 'gpt-4o',         label: 'GPT-4o' },
        { id: 'gpt-4o-mini',    label: 'GPT-4o mini (fast)' },
        { id: 'o3-mini',        label: 'o3-mini (reasoning)' },
      ],
      endpoint: 'https://api.openai.com/v1/chat/completions',
      headers: (key) => ({
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
      }),
      shapeRequest: ({ model, system, messages, temperature }) => ({
        model: model || 'gpt-4o-mini',
        messages: [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          ...messages.map((m) => ({ role: m.role || 'user', content: String(m.content || '') })),
        ],
        ...(temperature != null ? { temperature } : {}),
      }),
      extractText: (json) => {
        const c = json && json.choices && json.choices[0];
        return (c && c.message && c.message.content && String(c.message.content).trim()) || '';
      },
    },
    {
      id: 'google',
      name: 'Google (Gemini)',
      icon: '✦',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2c.5 5 4.5 9 9.5 10-5 .5-9 4.5-9.5 9.5-.5-5-4.5-9-9.5-9.5C7.5 11 11.5 7 12 2z" fill="#4285F4"/></svg>',
      site: 'https://aistudio.google.com/app/apikey',
      keyHint: 'From Google AI Studio',
      models: [
        { id: 'gemini-2.0-flash',         label: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro',           label: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash',         label: 'Gemini 1.5 Flash (fast)' },
      ],
      // Google uses key in URL query string, model in URL path
      endpoint: (model, key) =>
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      headers: () => ({ 'content-type': 'application/json' }),
      shapeRequest: ({ system, messages, temperature }) => ({
        ...(system
          ? { systemInstruction: { role: 'system', parts: [{ text: String(system) }] } }
          : {}),
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }],
        })),
        ...(temperature != null ? { generationConfig: { temperature } } : {}),
      }),
      extractText: (json) => {
        const c = json && json.candidates && json.candidates[0];
        if (!c || !c.content || !Array.isArray(c.content.parts)) return '';
        return c.content.parts.map((p) => p && p.text ? p.text : '').join('').trim();
      },
    },
    {
      id: 'groq',
      name: 'Groq (very fast)',
      icon: '⚡',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#F55036"/></svg>',
      site: 'https://console.groq.com/keys',
      keyHint: 'Free tier with rate limits',
      models: [
        { id: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 70B' },
        { id: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B (instant)' },
        { id: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B' },
      ],
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      headers: (key) => ({
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
      }),
      shapeRequest: ({ model, system, messages, temperature }) => ({
        model: model || 'llama-3.1-8b-instant',
        messages: [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          ...messages.map((m) => ({ role: m.role || 'user', content: String(m.content || '') })),
        ],
        ...(temperature != null ? { temperature } : {}),
      }),
      // Groq is OpenAI-compatible
      extractText: (json) => {
        const c = json && json.choices && json.choices[0];
        return (c && c.message && c.message.content && String(c.message.content).trim()) || '';
      },
    },
    {
      id: 'mistral',
      name: 'Mistral',
      icon: '🇫🇷',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="5" width="18" height="3.6" fill="#FFD000"/><rect x="3" y="10.2" width="18" height="3.6" fill="#FF8205"/><rect x="3" y="15.4" width="18" height="3.6" fill="#FA500F"/></svg>',
      site: 'https://console.mistral.ai/api-keys',
      keyHint: 'From console.mistral.ai',
      models: [
        { id: 'mistral-large-latest',     label: 'Mistral Large' },
        { id: 'mistral-small-latest',     label: 'Mistral Small (fast)' },
      ],
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      headers: (key) => ({
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
      }),
      shapeRequest: ({ model, system, messages, temperature }) => ({
        model: model || 'mistral-small-latest',
        messages: [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          ...messages.map((m) => ({ role: m.role || 'user', content: String(m.content || '') })),
        ],
        ...(temperature != null ? { temperature } : {}),
      }),
      extractText: (json) => {
        const c = json && json.choices && json.choices[0];
        return (c && c.message && c.message.content && String(c.message.content).trim()) || '';
      },
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      icon: '🔷',
      logoSvg: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9c4.2 0 6.3 3.2 10.2 3.2 3 0 5-1.6 6-4.2.4 6.2-3.8 10.5-9 10.5-4.2 0-7.4-3.2-7.4-7.3 0-.9.2-1.6.6-2.2z" fill="#4D6BFE"/></svg>',
      site: 'https://platform.deepseek.com/api_keys',
      keyHint: 'From platform.deepseek.com',
      models: [
        { id: 'deepseek-chat',     label: 'DeepSeek Chat' },
        { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
      ],
      endpoint: 'https://api.deepseek.com/chat/completions',
      headers: (key) => ({
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
      }),
      shapeRequest: ({ model, system, messages, temperature }) => ({
        model: model || 'deepseek-chat',
        messages: [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          ...messages.map((m) => ({ role: m.role || 'user', content: String(m.content || '') })),
        ],
        ...(temperature != null ? { temperature } : {}),
      }),
      extractText: (json) => {
        const c = json && json.choices && json.choices[0];
        return (c && c.message && c.message.content && String(c.message.content).trim()) || '';
      },
    },
  ];

  const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

  /* ───────── Key storage (local-only) ───────── */

  function _ls() {
    return typeof window.FluxStorage === 'object' && window.FluxStorage
      ? window.FluxStorage
      : { load: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
          save: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  }
  function getKey(providerId) {
    if (!byId[providerId]) return '';
    return String(_ls().load(KEY_PREFIX + providerId, '') || '').trim();
  }
  function setKey(providerId, key) {
    if (!byId[providerId]) return false;
    _ls().save(KEY_PREFIX + providerId, String(key || '').trim());
    return true;
  }
  function clearKey(providerId) {
    try { localStorage.removeItem(KEY_PREFIX + providerId); } catch {}
  }
  function listConfigured() {
    return PROVIDERS.filter((p) => !!getKey(p.id)).map((p) => p.id);
  }

  /* ───────── Model resolution ─────────
     Accepts:
       'anthropic:claude-3-5-sonnet-latest'
       'openai/gpt-4o-mini'
       'gpt-4o'          (heuristic → openai)
       'claude'          (heuristic → anthropic default)
       'gemini-1.5-pro'  (heuristic → google)
       'llama'           (heuristic → groq)
       '' / null         → default route (see getDefaultRoute())
  */
  function getDefaultRoute() {
    const stored = _ls().load(ROUTE_KEY, null);
    if (stored && byId[stored.provider]) return stored;
    // First configured provider with its first model
    const first = listConfigured()[0];
    if (first) return { provider: first, model: byId[first].models[0].id };
    return null;
  }
  function setDefaultRoute(providerId, modelId) {
    if (!byId[providerId]) return false;
    _ls().save(ROUTE_KEY, { provider: providerId, model: modelId || byId[providerId].models[0].id });
    return true;
  }
  function resolveModel(spec) {
    if (!spec) return getDefaultRoute();
    const s = String(spec).trim();
    let provider = null, model = null;
    const m = s.match(/^([a-z][a-z0-9_]*)[:\/](.+)$/i);
    if (m && byId[m[1].toLowerCase()]) {
      provider = m[1].toLowerCase();
      model = m[2].trim();
    } else {
      // Heuristic by model substring
      const low = s.toLowerCase();
      if (/^claude/i.test(low) || /sonnet|opus|haiku/.test(low)) provider = 'anthropic';
      else if (/^gpt|^o\d/.test(low)) provider = 'openai';
      else if (/^gemini/.test(low)) provider = 'google';
      else if (/^llama|^mixtral/.test(low)) provider = 'groq';
      else if (/^mistral/.test(low)) provider = 'mistral';
      else if (/^deepseek/.test(low)) provider = 'deepseek';
      if (provider) model = s;
    }
    if (!provider) return getDefaultRoute();
    // If the user gave a provider name only, use that provider's first model
    if (!model || provider === model.toLowerCase()) {
      model = (byId[provider].models[0] || {}).id || null;
    }
    return { provider, model };
  }

  /* ───────── Call ───────── */

  async function call({ provider, model, system, messages, user, temperature, timeoutMs }) {
    // Normalize args
    let route = provider ? { provider, model } : null;
    if (!route || !byId[route.provider]) route = resolveModel(model || '');
    if (!route) {
      return { ok: false, error: 'No AI provider configured. Add an API key in Settings → AI providers.', provider: null, model: null };
    }
    const def = byId[route.provider];
    const apiKey = getKey(def.id);
    if (!apiKey) {
      return { ok: false, error: `${def.name} key missing. Add it in Settings → AI providers.`, provider: def.id, model: route.model };
    }
    const msgs = Array.isArray(messages) ? messages.slice() : [];
    if (user) msgs.push({ role: 'user', content: String(user) });
    if (!msgs.length) {
      return { ok: false, error: 'Empty message — nothing to ask.', provider: def.id, model: route.model };
    }
    const body = def.shapeRequest({ model: route.model, system, messages: msgs, temperature });
    const endpoint = typeof def.endpoint === 'function'
      ? def.endpoint(route.model || (def.models[0] || {}).id, apiKey)
      : def.endpoint;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), Math.max(2000, timeoutMs || 45000));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: def.headers(apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        let txt = '';
        try { txt = await res.text(); } catch {}
        let hint = '';
        if (res.status === 401 || res.status === 403) hint = ' (check your API key)';
        else if (res.status === 429) hint = ' (rate limited — try again shortly)';
        return {
          ok: false,
          error: `${def.name} returned HTTP ${res.status}${hint}`,
          rawError: txt.slice(0, 300),
          provider: def.id,
          model: route.model,
        };
      }
      const json = await res.json().catch(() => null);
      const text = def.extractText(json) || '';
      if (!text) {
        return { ok: false, error: `${def.name} returned no text`, raw: json, provider: def.id, model: route.model };
      }
      return { ok: true, text, raw: json, provider: def.id, model: route.model };
    } catch (e) {
      clearTimeout(t);
      const msg = (e && e.name === 'AbortError') ? `${def.name} timed out` : (e && e.message) || String(e);
      return { ok: false, error: msg, provider: def.id, model: route.model };
    }
  }

  /* ───────── /ask Skill (lets Flux talk to another AI mid-chat) ───────── */

  function registerAskSkill() {
    // V2 (flux-skills.js) is the one with slash parsing + palette + AI dispatch.
    // The legacy window.FluxSkills (app.js) has a different spec shape (.execute
    // vs .runner; no .slash) and only wires the in-AI-prompt skill listing, so
    // we register on BOTH when available — V2 first for slash routing, legacy
    // for AI-prompt context inclusion.
    let registered = false;
    try {
      if (window.FluxSkillsV2 && typeof window.FluxSkillsV2.register === 'function') {
        window.FluxSkillsV2.register(_askSpecV2());
        registered = true;
      }
    } catch (e) { console.warn('[FluxAIProviders] V2 register failed', e); }
    try {
      if (window.FluxSkills && typeof window.FluxSkills.register === 'function'
        && window.FluxSkills !== window.FluxSkillsV2) {
        // Legacy shape uses `execute(params)` and a `skill` payload in fenced blocks.
        window.FluxSkills.register(_askSpecLegacy());
      }
    } catch (e) { console.warn('[FluxAIProviders] legacy register failed', e); }
    return registered;
  }

  // Parse "/ask <model> <prompt>" args into { modelSpec, prompt }.
  function _parseAskArgs(argsText) {
    const raw = String(argsText || '').trim();
    if (!raw) return { modelSpec: '', prompt: '' };
    const firstSpace = raw.indexOf(' ');
    if (firstSpace <= 0) return { modelSpec: '', prompt: raw };
    const first = raw.slice(0, firstSpace);
    const looksLikeModel = /^[a-z0-9][a-z0-9_:.\-\/]*$/i.test(first)
      && first.length < 60
      && (/[\/:]/.test(first) || /(claude|gpt|gemini|llama|mistral|deepseek|sonnet|haiku|opus|mixtral|^o\d)/i.test(first));
    if (looksLikeModel) return { modelSpec: first, prompt: raw.slice(firstSpace + 1).trim() };
    return { modelSpec: '', prompt: raw };
  }

  async function _runAsk(argsText) {
    const { modelSpec, prompt } = _parseAskArgs(argsText);
    if (!prompt) {
      return { ok: false, message: 'Usage: /ask <model> <question> — e.g. /ask gpt-4o-mini Explain photosynthesis' };
    }
    const res = await call({ model: modelSpec || undefined, user: prompt });
    if (!res.ok) return { ok: false, message: res.error };
    const providerName = byId[res.provider] ? byId[res.provider].name : res.provider;
    const modelTag = res.model ? ' <span style="color:var(--muted2);font-family:JetBrains Mono,monospace;font-size:.72rem">' + escHtml(res.model) + '</span>' : '';
    const card = '<div class="flux-ask-card"><div class="flux-ask-head"><strong>' + escHtml(providerName) + '</strong>' + modelTag + '</div><div class="flux-ask-body">' + escHtml(res.text).replace(/\n/g, '<br>') + '</div></div>';
    // Cross-AI interop: rebroadcast the foreign AI's reply through Flux's
    // standard ai-response event so the existing ```skill``` parser
    // (flux-skills.js) and ```flux_tool``` dispatcher (flux-ai-orchestrator.js)
    // pick it up. Means a model from any provider can invoke Flux skills.
    try {
      document.dispatchEvent(new CustomEvent('flux-ai-response', {
        detail: { text: res.text, provider: res.provider, model: res.model, source: 'ask' },
      }));
    } catch (_) {}
    return { ok: true, message: res.text, render: card };
  }

  function _askSpecV2() {
    return {
      id: 'ask_other_ai',
      slash: '/ask',
      name: 'Ask another AI',
      icon: '🛰',
      category: 'ai',
      description: 'Route a question to Claude/GPT/Gemini/Groq/Mistral/DeepSeek. Usage: /ask gpt-4o-mini Explain photosynthesis',
      args: [
        { name: 'model', desc: 'Provider:model (optional — uses default if omitted)', required: false },
        { name: 'prompt', desc: 'What to ask the other AI', required: true },
      ],
      runner: _runAsk,
    };
  }

  function _askSpecLegacy() {
    // Legacy registry (app.js) uses { id, name, description, execute(params) }.
    // Surface this so its skill-listing context can show the option to the AI.
    return {
      id: 'ask_other_ai',
      name: 'Ask another AI',
      icon: '🛰',
      category: 'ai',
      enabledByDefault: true,
      description: 'Route a question to another AI (Claude/GPT/Gemini/Groq/Mistral/DeepSeek).',
      paramDocs: '"model": "<optional provider:model>", "prompt": "<question>"',
      async execute(params) {
        params = params || {};
        const argsText = (params.model ? params.model + ' ' : '') + String(params.prompt || '');
        return _runAsk(argsText);
      },
    };
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ───────── Public surface + boot ───────── */

  window.FluxAIProviders = {
    providers: PROVIDERS,
    byId,
    getKey, setKey, clearKey, listConfigured,
    getDefaultRoute, setDefaultRoute, resolveModel,
    call,
  };

  function boot() {
    // Try to register the /ask skill; if FluxSkills isn't ready yet, retry once.
    if (!registerAskSkill()) {
      setTimeout(registerAskSkill, 1500);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
