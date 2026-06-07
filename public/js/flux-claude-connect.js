/* Flux × Claude — Settings card.
 *
 * Shows the MCP server URL to add in Claude, brief connect instructions, and the
 * user's active Claude connections (with one-click revoke). Connection + token
 * minting happens entirely via OAuth in the `mcp` Edge Function; this card is
 * management + discovery only. Gated by the `enable_claude_mcp` feature flag.
 */
(function () {
  "use strict";

  const SB_URL = "https://lfigdijuqmbensebnevo.supabase.co";
  const MCP_URL = SB_URL + "/functions/v1/mcp";
  const MOUNT_ID = "fluxClaudeConnectMount";

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );

  function enabled() {
    try {
      return !!(window.FluxFeatureFlags && FluxFeatureFlags.isEnabled("enable_claude_mcp", false));
    } catch (_) {
      return false;
    }
  }

  function sb() {
    try {
      return window.getSB ? window.getSB() : null;
    } catch (_) {
      return null;
    }
  }

  function copy(text, btn) {
    const done = () => {
      if (!btn) return;
      const t = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = t), 1400);
    };
    try {
      if (window.copyText) {
        window.copyText(text);
        done();
        return;
      }
    } catch (_) {}
    try {
      navigator.clipboard.writeText(text).then(done, () => {});
    } catch (_) {}
  }

  function relTime(iso) {
    if (!iso) return "never";
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return "—";
    const s = Math.max(0, (Date.now() - d) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  async function fetchConnections() {
    const client = sb();
    if (!client) return [];
    try {
      const sess = await client.auth.getSession();
      if (!sess?.data?.session?.user) return [];
      const { data, error } = await client
        .from("flux_mcp_tokens")
        .select("id, client_name, created_at, last_used_at, revoked_at")
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    } catch (_) {
      return [];
    }
  }

  async function revoke(id) {
    const client = sb();
    if (!client) return;
    try {
      await client.from("flux_mcp_tokens").delete().eq("id", id);
    } catch (_) {}
    renderSettingsCard();
  }

  function connectionsHtml(rows) {
    if (!rows.length) {
      return `<div class="ccx-empty">No connections yet. Add the server URL in Claude to link your account.</div>`;
    }
    return (
      `<div class="ccx-conn-head">Connected apps</div>` +
      rows
        .map(
          (r) => `<div class="ccx-conn">
        <div class="ccx-conn-meta">
          <div class="ccx-conn-name">${esc(r.client_name || "Claude")}</div>
          <div class="ccx-conn-sub">Linked ${esc(relTime(r.created_at))} · last used ${esc(relTime(r.last_used_at))}</div>
        </div>
        <button type="button" class="btn-sec ccx-revoke" data-revoke="${esc(r.id)}">Disconnect</button>
      </div>`,
        )
        .join("")
    );
  }

  async function renderSettingsCard() {
    const mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    if (!enabled()) {
      mount.innerHTML = "";
      return;
    }

    const signedIn = !!(window.currentUser && window.currentUser.id);

    mount.innerHTML = `
      <div class="card ccx-card">
        <div class="ccx-head">
          <span class="ccx-badge">✦</span>
          <div>
            <h3 style="margin:0">Connect to Claude</h3>
            <div class="ccx-lede">Let Claude read your planner and create, edit &amp; complete your tasks — like a Notion connector.</div>
          </div>
        </div>

        ${
          signedIn
            ? ""
            : `<div class="ccx-empty">Sign in to your Flux account to connect Claude.</div>`
        }

        <div class="ccx-url-label">MCP server URL</div>
        <div class="ccx-url-row">
          <code class="ccx-url">${esc(MCP_URL)}</code>
          <button type="button" class="btn-sec" id="ccxCopyUrl">Copy</button>
        </div>

        <details class="ccx-how">
          <summary>How to connect</summary>
          <div class="ccx-how-body">
            <p><b>claude.ai (web &amp; desktop):</b> Settings → Connectors → <b>Add custom connector</b> → paste the URL above → <b>Connect</b>, then approve on the Flux page that opens.</p>
            <p><b>Claude Code / CLI:</b> <code>claude mcp add --transport http flux ${esc(MCP_URL)}</code> then run <code>/mcp</code> to authenticate.</p>
            <p class="ccx-note">You'll sign in to Flux and approve access. Claude can read tasks, calendar, goals, habits &amp; notes, and manage tasks — but never your Canvas/Google tokens, settings, or other people's data.</p>
          </div>
        </details>

        <div id="ccxConnections" class="ccx-conns">${signedIn ? `<div class="ccx-empty">Loading connections…</div>` : ""}</div>
      </div>`;

    document.getElementById("ccxCopyUrl")?.addEventListener("click", (e) => copy(MCP_URL, e.currentTarget));

    if (signedIn) {
      const rows = await fetchConnections();
      const box = document.getElementById("ccxConnections");
      if (box) {
        box.innerHTML = connectionsHtml(rows);
        box.querySelectorAll("[data-revoke]").forEach((b) =>
          b.addEventListener("click", () => revoke(b.getAttribute("data-revoke"))),
        );
      }
    }
  }

  window.FluxClaudeConnect = { renderSettingsCard, enabled };
})();
