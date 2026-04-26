# Flux AI (`ai-proxy`) — second engine backends

Flux chat’s **Engine** dropdown sends `provider: "anthropic"` to the `ai-proxy` Edge Function. That name is historical: the server either calls **Anthropic’s native Messages API** or any **OpenAI-compatible** `POST …/chat/completions` endpoint, depending on env.

## Official Anthropic (Claude)

- **Do not** set `ANTHROPIC_BASE_URL`.
- Set **`ANTHROPIC_API_KEY`** to your Anthropic API key.
- Optional: **`ANTHROPIC_MODEL`** (e.g. `claude-sonnet-4-20250514`).

When billing is on, **free** plans cannot use this path (upgrade to Pro/School).

## OpenAI-compatible URL (same secret names)

Set all three. `ANTHROPIC_API_KEY` is always the **bearer token** for `chat/completions` (even when it is a Google or OpenRouter key).

### Google Gemini (AI Studio — OpenAI shim)

From [Google’s OpenAI compatibility base](https://ai.google.dev/gemini-api/docs/openai):

| Secret | Example value |
|--------|----------------|
| `ANTHROPIC_API_KEY` | `AIza…` (API key from Google AI Studio) |
| `ANTHROPIC_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `ANTHROPIC_MODEL` | `gemini-2.0-flash` or `gemini-2.5-flash` (check current model IDs in Google docs) |

If `ANTHROPIC_MODEL` is unset and the base URL is Google’s OpenAI shim, the proxy defaults to `gemini-2.0-flash`.

### OpenRouter (free tier models, many providers)

| Secret | Example value |
|--------|----------------|
| `ANTHROPIC_API_KEY` | `sk-or-v1-…` |
| `ANTHROPIC_BASE_URL` | `https://openrouter.ai/api/v1` |
| `ANTHROPIC_MODEL` | e.g. `google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-14b:free` |

The proxy appends `/chat/completions` when the base URL does not already include it.

**OpenRouter optional headers** (recommended by OpenRouter):

| Secret | Purpose |
|--------|---------|
| `OPENROUTER_HTTP_REFERER` | Defaults to this repo’s GitHub URL if unset. |
| `OPENROUTER_APP_TITLE` | Defaults to `Flux Planner`. |

If `ANTHROPIC_MODEL` is unset and the base URL contains `openrouter.ai`, the proxy defaults to `google/gemini-2.0-flash-exp:free` (rotate via `ANTHROPIC_MODEL` if you hit limits).

### DeepSeek

| Secret | Example value |
|--------|----------------|
| `ANTHROPIC_API_KEY` | DeepSeek API key |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/v1` |
| `ANTHROPIC_MODEL` | `deepseek-chat` or `deepseek-reasoner` |

If `ANTHROPIC_MODEL` is unset and the host is DeepSeek, the proxy defaults to `deepseek-chat`.

## Groq (first engine)

Unchanged: **`GROQ_API_KEY`**. JSON-only tools still force Groq for that request.

## Deploy

Set secrets in the Supabase project, then:

```bash
supabase functions deploy ai-proxy --project-ref <your-ref>
```
