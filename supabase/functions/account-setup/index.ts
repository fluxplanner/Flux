import { corsHeaders, json, serviceClient, verifyUserJWT } from "../_shared/auth.ts";

/**
 * Let someone set their own sign-in name and password.
 *
 * WHY THIS HAS TO BE A SERVER FUNCTION
 * ------------------------------------
 * Flux accounts have no real email. The name you type is folded into a
 * synthesised key, <name>@users.fluxplanner.app, on a domain that receives no
 * mail — that address IS the account.
 *
 * A browser cannot change it. Supabase re-validates the address on any email
 * change and refuses the domain outright:
 *
 *     PUT /auth/v1/user  {"email": "..."}
 *     → 400  Email address "...@users.fluxplanner.app" is invalid
 *
 * Measured on a throwaway account: changing the *password* returns 200 and
 * changing *user_metadata* returns 200, so it is the email specifically. The
 * same rename applied with the service role works, and signing in afterwards
 * with the new name and the old password succeeds while the old name stops
 * working. So the capability exists; it just cannot live in the client.
 *
 * WHAT PROTECTS IT
 * ----------------
 * The account acted on comes from the verified JWT and never from the body, so
 * this endpoint can only ever modify the caller's own account. The owner's key
 * is refused as a target, or one rename would hand over everything gated on it.
 */

const USER_DOMAIN = "users.fluxplanner.app";
const OWNER_UID = (Deno.env.get("FLUX_OWNER_UID") ||
  "eabe2b1f-e428-4181-8530-8e5366eb3975").trim();

/**
 * Must stay byte-for-byte identical to fluxNormalizeUsername in public/js/app.js.
 *
 * This rule IS the account key. Changing it raises no error anywhere — it
 * silently points people at accounts that do not exist. The NFD step matters
 * for an IB cohort: without it "José Álvarez" collapses to "jos.lvarez",
 * losing the letters rather than the accents.
 */
function normalizeUsername(raw: unknown): string {
  return String(raw || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-_]+|[.\-_]+$/g, "");
}

function usernameToEmail(raw: unknown): string {
  const u = normalizeUsername(raw);
  return u ? `${u}@${USER_DOMAIN}` : "";
}

/** Mirrors fluxWeakPasswordReason: say what is wrong, not recite the rules. */
function weakPasswordReason(pw: string, name: string): string {
  if (pw.length < 8) return "Your password needs to be at least 8 characters.";
  if (/^\d+$/.test(pw)) return "That is only numbers. Add some letters.";
  if (/^[a-z]+$/i.test(pw)) return "That is only letters. Add a number.";
  const n = normalizeUsername(name).replace(/[.\-_]/g, "");
  if (n.length > 2 && pw.toLowerCase().includes(n)) {
    return "That contains your own name, which is the first thing anyone would try.";
  }
  const common = ["password", "12345678", "qwerty", "letmein", "iloveyou", "flux1234"];
  if (common.some((c) => pw.toLowerCase().includes(c))) {
    return "That is one of the most common passwords in the world. Pick something else.";
  }
  return "";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405, origin);
  }

  const auth = await verifyUserJWT(req);
  if ("error" in auth && auth.error) {
    return json({ error: auth.error }, auth.status, origin);
  }
  const { userId, email: currentEmail } = auth as { userId: string; email: string };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body" }, 400, origin);
  }

  const wantName = typeof body.username === "string" ? body.username : "";
  const wantPassword = typeof body.password === "string" ? body.password : "";
  if (!wantName && !wantPassword) {
    return json({ error: "Nothing to change." }, 400, origin);
  }

  const sb = serviceClient();
  const patch: Record<string, unknown> = {};
  let newUsername = "";

  if (wantName) {
    const nextEmail = usernameToEmail(wantName);
    if (!nextEmail) {
      return json({
        error: "That name has no letters or numbers in it. Try your first and last name.",
      }, 400, origin);
    }
    newUsername = nextEmail.slice(0, -(USER_DOMAIN.length + 1));

    if (nextEmail !== currentEmail) {
      /* The owner's account is not a name anyone may take. */
      const { data: ownerRow } = await sb.auth.admin.getUserById(OWNER_UID);
      if (ownerRow?.user?.email === nextEmail && userId !== OWNER_UID) {
        return json({ error: "That name is not available." }, 409, origin);
      }

      /* The key is derived from the name, so two people called Jane Doe want
         the same one. Say which problem it is rather than failing generically. */
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const taken = (list?.users || []).some(
        (u: { id: string; email?: string }) => u.email === nextEmail && u.id !== userId,
      );
      if (taken) {
        return json({
          error: `Someone already signs in as "${newUsername}". Try adding a middle initial.`,
          code: "name_taken",
        }, 409, origin);
      }
      patch.email = nextEmail;
      /* Keeps the account confirmed through the change. Without it the address
         flips to unconfirmed, and if confirmations are ever switched on every
         renamed account is locked out at once — with no inbox to rescue it. */
      patch.email_confirm = true;
    }
  }

  if (wantPassword) {
    const weak = weakPasswordReason(wantPassword, wantName || currentEmail);
    if (weak) return json({ error: weak }, 400, origin);
    patch.password = wantPassword;
  }

  /* Read-modify-write: passing user_metadata replaces it wholesale, so fetching
     first is what stops this wiping everything else stored on the account. */
  const { data: me } = await sb.auth.admin.getUserById(userId);
  const meta = { ...(me?.user?.user_metadata || {}) } as Record<string, unknown>;
  if (newUsername) meta.full_name = wantName.trim() || newUsername;
  meta.flux_setup_done = true;
  patch.user_metadata = meta;

  const { data: updated, error } = await sb.auth.admin.updateUserById(userId, patch);
  if (error) {
    return json({ error: error.message || "Could not save that." }, 400, origin);
  }

  const finalEmail = updated?.user?.email || currentEmail;
  return json({
    ok: true,
    username: finalEmail.endsWith(`@${USER_DOMAIN}`)
      ? finalEmail.slice(0, -(USER_DOMAIN.length + 1))
      : finalEmail,
    renamed: !!patch.email,
    passwordChanged: !!patch.password,
  }, 200, origin);
});
