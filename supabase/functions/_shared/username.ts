/**
 * The sign-in name rule and the password rule, shared by every function that
 * touches an account (account-setup, account-recovery).
 */
export const USER_DOMAIN = "users.fluxplanner.app";

/**
 * Must give the same result as fluxNormalizeUsername in public/js/app.js.
 *
 * This rule IS the account key. Changing it raises no error anywhere — it
 * silently points people at accounts that do not exist. The NFD step matters
 * for an IB cohort: without it "José Álvarez" collapses to "jos.lvarez",
 * losing the letters rather than the accents.
 */
export function normalizeUsername(raw: unknown): string {
  return String(raw || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-_]+|[.\-_]+$/g, "");
}

export function usernameToEmail(raw: unknown): string {
  const u = normalizeUsername(raw);
  return u ? `${u}@${USER_DOMAIN}` : "";
}

/** The name part of a sign-in address, or the address itself if it is not one of ours. */
export function emailToUsername(email: string): string {
  return email.endsWith(`@${USER_DOMAIN}`) ? email.slice(0, -(USER_DOMAIN.length + 1)) : email;
}

/** Mirrors fluxWeakPasswordReason: say what is wrong, not recite the rules. */
export function weakPasswordReason(pw: string, name: string): string {
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
