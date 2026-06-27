# Getting Flux verified by Google (OAuth) — ASAP playbook

_Last updated: 2026-06-26_

## TL;DR

The single thing slowing you down is **`gmail.readonly`**. It is a Google
**restricted** scope, which forces the heaviest verification path: an annual,
paid, third‑party **CASA** security assessment on top of normal review. Every
other scope Flux asks for (Calendar, Tasks, Docs) is only **sensitive**, which
verifies far faster with no security assessment.

**Fastest path to "verified": drop / defer `gmail.readonly`.** Without any
restricted scope, Flux only needs *sensitive‑scope* verification (days–weeks),
not CASA (weeks–months + cost).

## Scopes Flux currently requests

From `signInWithGoogle()` in `public/js/app.js`:

| Scope | Tier | Verification impact |
|---|---|---|
| `openid`, `email`, `profile` | none | no review needed |
| `gmail.readonly` | **restricted** | **CASA security assessment + restricted review** |
| `calendar.readonly`, `calendar.events` | sensitive | sensitive‑scope review |
| `tasks` | sensitive | sensitive‑scope review |
| `documents` (Docs) | sensitive | sensitive‑scope review |

## Decision: do you actually need Gmail read access now?

- **No / not yet →** remove `gmail.readonly` from the scope list. Re‑request it
  later via *incremental authorization* only for users who use the Gmail
  feature. This drops you to the sensitive‑only path immediately.
- **Yes, it's core →** you must budget for CASA (below). Consider still using
  incremental auth so the Gmail prompt only appears for users who need it — it
  doesn't remove the CASA requirement but improves consent‑screen approval odds.

## Step 1 — Prerequisites (do these regardless)

1. **Google Cloud project** owns the OAuth client. One project = one app identity.
2. **OAuth consent screen** fully filled in: app name, logo, support email,
   authorized domains, **all** links working and on a domain you own:
   - Homepage
   - **Privacy policy** (Flux already ships `privacy.html`)
   - **Terms of service** (`terms.html`)
3. **Domain ownership** verified in Google Search Console for every domain used
   on the consent screen and in `Authorized domains`.
4. **Authorized redirect URIs** exactly match `getRedirectURL()` (see
   `public/js/app.js`) — production origin(s), no trailing slash mismatch.
5. **Branding/brand verification** is its own ~2–3 business‑day step whenever
   branding changed since last approval — it gates everything else.

## Step 2 — Justify each scope

For every sensitive/restricted scope, the review form requires:
- A clear, specific reason you need it.
- A **demo video** showing the OAuth consent screen and the in‑app feature that
  uses that exact scope, end to end.
- Confirmation you request the **minimum** scopes (Google rejects over‑broad asks).

## Step 3a — Sensitive scopes only (FAST path, if Gmail removed)

1. Submit the consent screen for verification with Calendar/Tasks/Docs.
2. Provide justifications + demo video.
3. Respond to reviewer follow‑ups quickly.
4. Typical turnaround: a few days to a few weeks. **No security assessment.**

## Step 3b — Restricted scope path (if you keep `gmail.readonly`)

In addition to everything above:
1. Pass the **restricted‑scope** review (stricter data‑handling + limited‑use
   compliance with Google API Services User Data Policy).
2. Complete a **CASA** (Cloud Application Security Assessment) with a Google‑
   approved third‑party assessor — based on OWASP ASVS, **14 categories**.
   - Tier 2 (self‑scan via approved scanner + verification) is the common bar.
   - Must be **re‑done every 12 months** to keep the scope.
   - Costs money and adds weeks; start the assessor engagement early.

## Recommended action for "ASAP"

1. **Remove `gmail.readonly`** from the scope array in `signInWithGoogle()`
   (and anywhere else it's requested) for the initial launch.
2. Ship verification for the **sensitive** scopes only (Calendar/Tasks/Docs).
3. Add Gmail back later behind **incremental auth** and run CASA in parallel if
   Gmail is on the roadmap.
4. While in review, the app keeps working for users in **Testing** mode (capped
   user count / 7‑day token expiry) — fine for pilots, not public launch.

## Sources

- [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Choose Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073?hl=en)
- [Verification requirements](https://support.google.com/cloud/answer/13464321?hl=en)
- [Security Assessment (CASA)](https://support.google.com/cloud/answer/13465431?hl=en)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
