/* Flux × Claude — OAuth consent page.
 *
 * Reached when Claude (claude.ai / Desktop / Code) sends the user to the Flux
 * authorization endpoint, which redirects here. This page runs same-origin as
 * the Flux app, so it shares the user's existing Supabase session. On approval
 * it POSTs the user's Supabase JWT to the `mcp` Edge Function, which mints the
 * single-use OAuth authorization code and hands back the redirect to Claude.
 */
(function () {
  "use strict";

  const SB_URL = "https://lfigdijuqmbensebnevo.supabase.co";
  const SB_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo";
  const GRANT_URL = SB_URL + "/functions/v1/mcp/authorize/grant";

  const SCOPE_INFO = {
    "planner.read": {
      ic: "👀",
      tt: "Read your planner",
      ds: "Your tasks, calendar, goals, habits and notes.",
    },
    "tasks.write": {
      ic: "✏️",
      tt: "Manage your tasks",
      ds: "Create, edit, complete and delete to-dos.",
    },
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );

  const q = new URLSearchParams(location.search);
  const params = {
    client_id: q.get("client_id") || "",
    redirect_uri: q.get("redirect_uri") || "",
    code_challenge: q.get("code_challenge") || "",
    code_challenge_method: q.get("code_challenge_method") || "",
    scope: (q.get("scope") || "planner.read tasks.write").trim(),
    state: q.get("state") || "",
    resource: q.get("resource") || "",
  };

  let sb;
  try {
    sb = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (e) {
    /* handled in init */
  }

  function showMsg(text, kind) {
    const el = $("msg");
    if (!el) return;
    el.className = "msg " + (kind || "err");
    el.textContent = text;
  }
  function clearMsg() {
    const el = $("msg");
    if (el) el.className = "msg";
  }

  function fatal(text) {
    $("content").innerHTML = `<h1>Can't connect</h1><p class="lede">${esc(text)}</p>
      <p class="deny-note">Close this tab and try adding the Flux connector again from Claude.</p>`;
  }

  function paramsValid() {
    return params.client_id && params.redirect_uri && params.code_challenge &&
      params.code_challenge_method === "S256";
  }

  function denyRedirect() {
    try {
      const u = new URL(params.redirect_uri);
      u.searchParams.set("error", "access_denied");
      if (params.state) u.searchParams.set("state", params.state);
      location.assign(u.toString());
    } catch {
      fatal("The connection request was cancelled.");
    }
  }

  function scopesHtml() {
    const list = params.scope.split(/\s+/).filter(Boolean);
    const items = list
      .filter((s) => SCOPE_INFO[s])
      .map((s) => {
        const i = SCOPE_INFO[s];
        return `<li><span class="ic">${i.ic}</span><span><span class="tt">${esc(i.tt)}</span><br>
          <span class="ds">${esc(i.ds)}</span></span></li>`;
      })
      .join("");
    return `<ul class="scopes">${items}</ul>`;
  }

  function renderConsent(user) {
    const email = user.email || user.user_metadata?.email || "your account";
    const initial = (email[0] || "F").toUpperCase();
    $("content").innerHTML = `
      <h1>Connect to Claude</h1>
      <p class="lede"><b>Claude</b> wants to access your Flux Planner so it can help manage your work.</p>
      <div class="who"><span class="av">${esc(initial)}</span>
        <span>Signed in as <b>${esc(email)}</b><br><small>Approving links Claude to this account.</small></span></div>
      ${scopesHtml()}
      <p class="deny-note">Claude <b>cannot</b> see your Canvas/Google tokens, account settings, or anyone else's data. You can disconnect anytime in Flux → Settings.</p>
      <div class="row">
        <button class="ghost" id="denyBtn" type="button">Deny</button>
        <button class="primary" id="approveBtn" type="button">Allow access</button>
      </div>
      <div class="row" style="margin-top:10px;justify-content:center">
        <button class="muted-link" id="switchBtn" type="button">Not ${esc(email)}? Sign out</button>
      </div>`;
    $("denyBtn").onclick = denyRedirect;
    $("switchBtn").onclick = async () => {
      await sb.auth.signOut();
      renderSignIn();
    };
    $("approveBtn").onclick = approve;
  }

  async function approve() {
    clearMsg();
    const btn = $("approveBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Connecting…';
    try {
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        renderSignIn();
        return;
      }
      const res = await fetch(GRANT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          apikey: SB_ANON,
        },
        body: JSON.stringify({
          client_id: params.client_id,
          redirect_uri: params.redirect_uri,
          code_challenge: params.code_challenge,
          scope: params.scope,
          state: params.state,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.redirect) {
        location.assign(json.redirect);
        return;
      }
      showMsg(json.error_description || json.error || "Could not complete the connection.", "err");
    } catch (e) {
      showMsg("Network error — please try again.", "err");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Allow access";
    }
  }

  function renderSignIn() {
    $("content").innerHTML = `
      <h1>Sign in to connect</h1>
      <p class="lede">Sign in to Flux to link <b>Claude</b> to your planner.</p>
      <button class="primary full signin-google" id="googleBtn" type="button">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.3 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.7-11.3-7l-6.5 5C9.1 40.4 16 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.3 5.2C39.9 36.7 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
        Continue with Google
      </button>
      <div style="text-align:center;color:#7e8db0;font-size:.82rem;margin:6px 0 12px">or use email</div>
      <input type="email" id="emailIn" placeholder="you@school.edu" autocomplete="email" />
      <button class="ghost full" id="emailBtn" type="button">Email me a sign-in link</button>`;
    $("googleBtn").onclick = () =>
      sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href } });
    $("emailBtn").onclick = async () => {
      const email = ($("emailIn").value || "").trim();
      if (!email) {
        showMsg("Enter your email first.", "err");
        return;
      }
      clearMsg();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
      if (error) showMsg(error.message, "err");
      else showMsg("Check your inbox for a sign-in link, then return here.", "ok");
    };
  }

  async function init() {
    if (!sb) return fatal("Could not initialize. Please reload.");
    if (!paramsValid()) {
      return fatal("This connection link is missing required information or is malformed.");
    }
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) renderConsent(data.session.user);
      else renderSignIn();
    } catch (e) {
      fatal("Could not read your session. Please reload.");
    }
  }

  // Auth state may resolve after an OAuth/magic-link redirect parses the URL.
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      if (session?.user && document.querySelector("#googleBtn, .spin")) renderConsent(session.user);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
