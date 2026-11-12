import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/*
 * Every edge function must prove who is calling before it does anything, and
 * every one a browser can reach must have a daily cap. This reads the source,
 * so a new function that forgets either fails here instead of in production.
 */
const dir = new URL('../../supabase/functions/', import.meta.url);
const fns = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);
const src = (n) => readFileSync(new URL(`${n}/index.ts`, dir), 'utf8');

/* Called by cron or a webhook with a secret, never by a signed-in browser. */
const SECRET_GATED = {
  'compute-benchmarks': /Bearer \$\{serviceKey\}/,
  'daily-briefing': /CRON_SECRET|x-cron/,
  'family-digest': /CRON_SECRET|x-cron/,
  'notify-push': /CRON_SECRET|x-cron|WEBHOOK_SECRET/,
  'security-watch': /secretMatches\(req\.headers\.get\("x-monitor-secret"\)/,
  'stripe-webhook': /verifyStripeSignature\(rawBody, signature, STRIPE_WEBHOOK_SECRET\)/,
};
/* Reached with an unguessable token in the URL, not a login. */
const TOKEN_URL = new Set(['ical-feed']);

test('every function checks who is calling', () => {
  for (const n of fns) {
    assert.ok(
      n in SECRET_GATED || TOKEN_URL.has(n) || /verifyUserJWT/.test(src(n)),
      `${n}: no verifyUserJWT, and not listed as secret- or token-gated`,
    );
  }
});

test('secret-gated functions check their secret', () => {
  for (const [n, re] of Object.entries(SECRET_GATED)) {
    if (!fns.includes(n)) continue;
    assert.ok(re.test(src(n)), `${n} lost its secret check`);
  }
});

test('every browser-reachable function has a daily cap', () => {
  for (const n of fns) {
    if (n in SECRET_GATED) continue;
    assert.ok(
      /overDailyLimit|bumpDailyGuard|checkAILimit/.test(src(n)),
      `${n} has no rate limit`,
    );
  }
});

test('no function embeds a key or token', () => {
  for (const n of fns) {
    assert.doesNotMatch(src(n), /eyJ[A-Za-z0-9_-]{10,}\.eyJ/, `${n} embeds a JWT`);
    assert.doesNotMatch(src(n), /sb_secret_|sk_live_|whsec_[A-Za-z0-9]/, `${n} embeds a secret`);
  }
});
