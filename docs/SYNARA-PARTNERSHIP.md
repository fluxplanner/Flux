# Synara in Flux — the partnership, and how it is built

Synara is an app for students with epilepsy (medication reminders, a seizure
log, a school safety card) made by a separate organization. Flux builds and
hosts it; in return Synara promotes Flux. This is everything in this repo that
exists because of that, and the rules that keep a health app safe inside it.

| What | Where |
| --- | --- |
| The app | `synara.html`, source in `public/synara/` (copied from the Synara repo by its `npm run flux`; edit it there, not here) |
| Its bundles | `buildSynara()` in `scripts/build-web-bundles.mjs` → `public/bundles/flux-synara.*` and `flux-synara_vault.*` |
| Hub and switcher | `FluxHub.PRODUCTS` in `public/js/flux-hub.js`: second, beside the planner, `partner: true`, its own `logo` |
| Partner program and kit | `partners.html`, screenshots in `public/partners/` |
| Purple Day | `public/js/flux-purple-day.js` |
| Planner link | `public/js/flux-synara-link.js`, hooks in `app.js` `renderCalendar`, `renderCalDay`, `renderSchool` |
| Sync | `public/js/flux-synara-vault.mjs`, `supabase/migrations/20261005120000_synara_vaults.sql` |
| Tests | `e2e/synara.spec.ts`, `e2e/synara-partnership.spec.ts` |

## Its own brand

Synara keeps its name, its violet (purple is the epilepsy awareness colour) and
its own light/dark theme. `synara.html` deliberately does **not** load
`flux-theme-carry.js`, and it is "Synara", never "Flux Synara". Inside it, Flux
appears only as the app switcher in its app bar and a small "Powered by Flux"
credit (welcome screen, sidebar, You → About) — never on the emergency card.

## Purple Day (March 26)

`flux-purple-day.js` runs on every Flux page and in the planner bundle. On
March 26 (local date) it sets `--accent` to lavender with `!important` (so it
beats the planner's inline theme), adds `html.flux-purple-day` (so the
planner's `fluxOnAccent` watcher recomputes `--on-accent`), and shows a banner
— inline in a `[data-purple-day-slot]` on the hub, landing and partners pages, a
corner card elsewhere. Dismissing hides it for the year
(`flux_purple_day_dismissed`). Nothing on it animates: photosensitive epilepsy
is the point of the day. Preview any day with `?purpleday` (`?purpleday=0` ends
it). Synara shows its own Purple Day card on Home.

## The planner link (opt-in, one device)

In Synara, You → Flux → **Show in my Flux Planner** makes Synara write
`localStorage["synara.flux"]`:

```js
{ v: 1, meds: [{ name, dose, color, added, ended,
                 schedule: [{ from: "YYYY-MM-DD", times: ["HH:MM"] }] }] }
```

Medication names, doses and times only — no seizures, contacts, notes or
profile. `flux-synara-link.js` validates it and turns it into calendar items at
render time (violet, "Synara · medication", linking to `synara.html#/meds`) and
a safety-card shortcut on School info. These items are **never** written to
`flux_events` or `flux_weekly_events`, so cloud sync, exports and the AI context
never contain them. Keep it that way: if a feature ever wants Synara data in a
synced store or an AI prompt, it needs the student's explicit, separate consent.

## Sync (opt-in, end-to-end encrypted)

### What it does

A student signed in to Flux can sync Synara between devices (You → Flux → Sync).
The whole record is encrypted **on the device** with AES-GCM (128-bit key)
before upload. The key is generated on the first device and never sent; the
student carries it to other devices as a 26-character **sync key**. Flux stores
only ciphertext, in `synara_vaults` (one row per account, RLS: own row only, 2 MB
cap, server-set `updated_at`).

Sync rule (Synara `js/sync.js`): only this device changed → upload; only the
synced copy changed → download (validated by Synara's `migrate()`); both changed
→ the student chooses; synced copy deleted elsewhere → stop syncing here. "Delete
everything" and "Load example data" turn sync off on that device first, so an
empty or example record can never overwrite the real one everywhere.

`flux-synara-vault.mjs` uses the planner's own Supabase project and default
session key, so it shares the planner's sign-in and supabase-js handles token
refresh across tabs. It is bundled from `node_modules`, not a CDN.

### Privacy review

**What Flux can see:** that an account has a synced copy, its size, and when it
last changed. **What Flux cannot see:** anything in it — medication, seizures,
contacts, the safety card. Nobody with database access (including Flux's own
developers) can read it without the student's sync key.

**What remains before calling it done:**

1. ~~**Apply the migration**~~ Done 2026-10-06 (FluxPlanner project, migration
   `synara_vaults`). Checked after applying: anon is refused outright (no
   grants), a signed-in user can't write another user's row (RLS), their own
   row passes, the live API answers `42501 permission denied` to the public
   key, and Supabase's security and performance advisors report nothing for
   the table or its trigger.
2. **Under-13 users (COPPA).** Flux accounts may belong to children. Synced data
   is encrypted and unreadable to Flux, but an account still exists. Confirm
   Flux's sign-up flow already handles age and parental consent the way the rest
   of Flux requires.
3. **School-run deployments (FERPA).** If a school ever provides Flux to
   students, check with that school before Synara sync is offered there.
4. **HIPAA** applies to health plans, providers and their contractors. Neither
   Flux nor Synara is one, and Flux cannot read the data — but get this
   confirmed in writing if Synara ever partners with a clinic.
5. **Deletion.** A student can delete the synced copy from any device (You →
   Flux → Sync → Turn off and delete). Deleting the Flux account deletes the row
   (`ON DELETE CASCADE`).
6. **Key loss** is unrecoverable by design. Each device keeps its own copy, so
   nothing is lost locally; "Start fresh" replaces the unreadable synced copy.

### Mocking it in tests

`flux-synara-vault.mjs` does nothing if `window.FluxSynaraVault` already exists.
`e2e/synara-partnership.spec.ts` uses that to share one in-memory vault between
two browser contexts — two devices, one account — and checks the stored blob
never contains the record's plain text.
