/**
 * Turns one flux_security_scan() result into alerts.
 *
 * Pure: no network, no Deno APIs, so test/unit/security-rules.test.mjs runs it
 * under Node. The thresholds live here and nowhere else.
 */

export interface Scan {
  failed_logins?: {
    total?: number;
    top_usernames?: { username: string; n: number }[];
    top_ips?: { ip: string | null; n: number; usernames: number }[];
  };
  power_grants?: {
    id?: number;
    action_type: string;
    role?: string | null;
    via?: string | null;
    by_owner?: boolean;
    self_granted?: boolean;
    target?: string | null;
    created_at?: string;
  }[];
  rls_missing?: string[];
  ai_usage?: {
    near_cap?: { kind: string; count: number; cap: number; ratio: number }[];
    guest_buckets_today?: number;
    ai_messages_today?: number;
    ai_messages_7d_avg?: number;
  };
}

export interface Alert {
  /** Dedupe key: one alert per signal until its fingerprint changes. */
  signal: string;
  /** Same fingerprint as last time = same problem, so stay quiet. */
  fingerprint: string;
  /** Minutes before the same unchanged problem is sent again. */
  repeatMinutes: number;
  severity: "critical" | "warning";
  title: string;
  lines: string[];
}

export const THRESHOLDS = {
  failedTotal: 30,
  failedPerUsername: 10,
  failedPerIp: 20,
  usernamesPerIp: 5,
  guestBuckets: 150,
  aiSpikeFactor: 3,
  aiSpikeFloor: 50,
};

const OWNER_ACTIONS = new Set(["owner_added", "owner_changed", "owner_removed"]);

export function evaluate(scan: Scan): Alert[] {
  const out: Alert[] = [];
  const T = THRESHOLDS;

  // ---- failed logins
  const fl = scan.failed_logins ?? {};
  const names = (fl.top_usernames ?? []).filter((u) => u.n >= T.failedPerUsername);
  const ips = (fl.top_ips ?? []).filter((i) => i.n >= T.failedPerIp || i.usernames >= T.usernamesPerIp);
  if ((fl.total ?? 0) >= T.failedTotal || names.length || ips.length) {
    out.push({
      signal: "failed_logins",
      // Rounded so a burst that keeps climbing by one or two is one alert.
      fingerprint: [
        ...names.map((u) => u.username),
        ...ips.map((i) => i.ip ?? "?"),
        Math.floor((fl.total ?? 0) / 50),
      ].join("|"),
      repeatMinutes: 60,
      severity: names.length || ips.some((i) => i.usernames >= T.usernamesPerIp) ? "critical" : "warning",
      title: `${fl.total ?? 0} failed sign-ins in the last 20 minutes`,
      lines: [
        ...names.map((u) => `${u.n} wrong passwords for "${u.username}"`),
        ...ips.map((i) => `${i.n} failures from ${i.ip ?? "unknown address"} across ${i.usernames} usernames`),
      ],
    });
  }

  // ---- power grants: every one is worth a ping; ones you didn't make are critical
  const grants = scan.power_grants ?? [];
  if (grants.length) {
    const suspicious = grants.some((g) => OWNER_ACTIONS.has(g.action_type) || g.self_granted || g.by_owner === false);
    out.push({
      signal: "power_grants",
      fingerprint: grants.map((g) => `${g.action_type}:${g.id ?? g.created_at}:${g.target ?? ""}`).join("|"),
      repeatMinutes: 24 * 60,
      severity: suspicious ? "critical" : "warning",
      title: suspicious
        ? `Power granted that you did not grant (${grants.length})`
        : `${grants.length} role change${grants.length === 1 ? "" : "s"} by you`,
      lines: grants.map((g) => {
        const who = g.target ? `"${g.target}"` : "an account";
        const what = g.action_type.startsWith("owner_")
          ? g.action_type.replace("owner_", "platform owner ")
          : g.action_type === "custom_role_added"
          ? `added to custom role "${g.role}"`
          : `given role ${g.role}`;
        const by = g.self_granted ? " (gave it to themselves)" : g.by_owner === false ? " (not by you)" : "";
        return `${who} ${what}${by}${g.via ? ` via ${g.via}` : ""}`;
      }),
    });
  }

  // ---- tables without row level security
  const rls = scan.rls_missing ?? [];
  if (rls.length) {
    out.push({
      signal: "rls_missing",
      fingerprint: [...rls].sort().join("|"),
      repeatMinutes: 6 * 60,
      severity: "critical",
      title: `${rls.length} table${rls.length === 1 ? "" : "s"} with no access rules`,
      lines: rls.map((t) => `public.${t} can be read by anyone with the app's public key`),
    });
  }

  // ---- AI and function usage
  const ai = scan.ai_usage ?? {};
  const capped = (ai.near_cap ?? []).filter((b) => b.ratio >= 1);
  const today = ai.ai_messages_today ?? 0;
  const avg = ai.ai_messages_7d_avg ?? 0;
  const spike = today >= T.aiSpikeFloor && today > avg * T.aiSpikeFactor;
  const guests = (ai.guest_buckets_today ?? 0) >= T.guestBuckets;
  if (capped.length || spike || guests) {
    out.push({
      signal: "ai_usage",
      fingerprint: [
        ...new Set(capped.map((b) => b.kind)),
        spike ? "spike" : "",
        guests ? "guests" : "",
      ].join("|"),
      repeatMinutes: 6 * 60,
      severity: "warning",
      title: "Unusual AI or function usage today",
      lines: [
        ...capped.map((b) => `someone hit the ${b.kind} daily cap (${b.count}/${b.cap})`),
        ...(spike ? [`${today} AI messages today vs ${avg} a day this week`] : []),
        ...(guests ? [`${ai.guest_buckets_today} different signed-out visitors used AI today`] : []),
      ],
    });
  }

  return out;
}

/** One plain-text message for Discord (2000-character limit) and email. */
export function formatAlert(a: Alert): string {
  const icon = a.severity === "critical" ? "🚨" : "⚠️";
  const body = a.lines.slice(0, 15).map((l) => `• ${l}`).join("\n");
  const more = a.lines.length > 15 ? `\n…and ${a.lines.length - 15} more` : "";
  return `${icon} **Flux: ${a.title}**\n${body}${more}`.slice(0, 1900);
}
