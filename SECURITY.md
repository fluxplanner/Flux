# Security

## Reporting a problem

Use **Send feedback** inside Flux, or open a private GitHub security advisory on
this repository. Please don't file public issues for vulnerabilities.

## Browser-side controls

- **CSP** — every page carries a `<meta http-equiv="Content-Security-Policy">`.
  GitHub Pages can't send headers, and a meta CSP ignores `frame-ancestors`, so
  `public/js/flux-frame-guard.js` remains the clickjacking control.
  `'unsafe-inline'` stays until index.html's inline `on*=` handlers move out.
- **Escaping** — user text goes through `FluxEsc.html` (`public/js/core/flux-esc.js`);
  rich note bodies go through `FluxEsc.richText`. `e2e/xss-render.spec.ts` pins both.
- **Uploads** — `FluxFileSniff` checks magic bytes and a 15 MB cap before any parser runs.
- **Canvas token** — expires after 90 days, can be session-only, and "Forget
  Canvas token" removes it from the browser and the account.
- **Vendored scripts** — jQuery and MathQuill load with SRI hashes.

## Row-level security

Read from the live database (`pg_policies`, `pg_class.relrowsecurity`) on
2026-11-19. Every table in `public` has RLS **on**. Nearly every table also
GRANTs `SELECT` to `anon`, so RLS is the only thing between a logged-out
visitor and the data. Any policy on the `public` role applies to `anon` too.

### Intended public reads

| Table | Who | Why |
|---|---|---|
| `flux_announcements` | anon + signed in | live banner notices (`active` and inside `starts_at`/`ends_at`) |
| `flux_hidden_apps` | anon + signed in | which apps the Suite hides (visibility) |
| `platform_settings` | anon + signed in | `ui` and `broadcast` keys only |

There is no `products` table; the product list ships in `public/js/flux-hub.js`.

### Flags — review before the next schema change

1. **Anon can read every non-shadowed row of `school_announcements`,
   `school_feed` and `teacher_announcements`.** The `flux_shadow_hide` policy
   is PERMISSIVE and on the `public` role, with
   `NOT flux_is_shadowed(author) OR …`. That is true for anon, and permissive
   policies are OR'd, so it *grants* a read instead of hiding one. The tables
   were empty when checked (so a live anon query returned 0 rows); this was
   found from the policy logic, not observed. Fix: make it `AS RESTRICTIVE`, or
   scope it `TO authenticated`.
2. **`UPDATE … USING (true)` policies** — `flux_own_class_upd` on
   `teacher_assignments`, `teacher_announcements` and `no_homework_days`, plus
   `flux_accom_student_in_school_upd` on `flux_student_accommodations` and
   `staff_student_accommodations`. Any signed-in user can target *any* row; only
   the `WITH CHECK` limits the result. For example, a teacher can move another
   teacher's assignment into a class they own. Fix: restrict `USING` to the owner.
3. **Cross-school reads for any signed-in user** — `flux_school_broadcast`
   (`fsb_read_all`), `school_calendar_events` (`sce_read_all`) and
   `flux_feature_flags` all use `USING (true)`. That's probably fine for flags;
   check whether broadcasts and events should be limited to the reader's school.
4. **`user_roles` for anon** — `roles_select_educators_same_school` is on
   `public`. Anon queries currently fail with `42501 permission denied for
   function flux_my_school`, so nothing leaks, but the error is the guard. Scope
   the policy `TO authenticated`.
5. **Server-only tables** (RLS on, no policies — only the service role reads
   them): `error_logs`, `flux_ai_guard`, `flux_failed_logins`,
   `flux_mcp_auth_codes`, `flux_mcp_oauth_clients`, `flux_recovery_emails`,
   `flux_recovery_tokens`, `flux_security_alert_state`, `platform_admins`.
   This is correct as long as no client code queries them.

Every other table is owner-scoped (`auth.uid() = user_id`/`student_id`/
`teacher_id`, or a membership check) or owner-only (`flux_is_platform_admin()`).

### Per-table policy list

Format: command (roles). Policy bodies live in `supabase/migrations/`.

| Table | Policies |
|---|---|
| `admin_duty_logs` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `admin_meeting_requests` | ALL (authenticated) |
| `admin_meeting_slots` | ALL, SELECT (authenticated) |
| `admin_profiles` | INSERT, SELECT, UPDATE (authenticated) |
| `ai_usage` | SELECT (authenticated) |
| `aorta_bp_records` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `assignment_recovery_plans` | ALL, SELECT, UPDATE (authenticated) |
| `class_join_requests` | INSERT, SELECT, UPDATE (authenticated) |
| `college_tasks` | ALL (public, owner-scoped) |
| `counselor_appointments` | ALL, INSERT, SELECT, UPDATE (authenticated) |
| `counselor_availability_slots` | ALL, SELECT (authenticated) |
| `counselor_consent_audit` | INSERT, SELECT (authenticated) |
| `counselor_copilot_audit` | INSERT, SELECT (authenticated) |
| `counselor_referrals` | ALL, SELECT (authenticated) |
| `counselors` | INSERT, SELECT, UPDATE (authenticated) |
| `error_logs` | none — server-only |
| `flux_accommodation_audit` | SELECT (authenticated) |
| `flux_admin_action_log` | SELECT (authenticated, owner only) |
| `flux_ai_agent_runs` | INSERT, SELECT (authenticated) |
| `flux_ai_guard` | none — server-only |
| `flux_announcement_reads` | ALL (authenticated, owner only) |
| `flux_announcements` | ALL (owner); SELECT (anon + authenticated, live only) |
| `flux_bans` | ALL (authenticated, owner only) |
| `flux_daily_briefings` | SELECT, UPDATE (authenticated) |
| `flux_district_admins` | ALL, SELECT (authenticated) |
| `flux_districts` | SELECT (authenticated) |
| `flux_failed_logins` | none — server-only |
| `flux_family_digests` | SELECT (authenticated) |
| `flux_feature_flags` | SELECT (authenticated, all rows) |
| `flux_graphs` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `flux_hidden_apps` | DELETE, INSERT (owner); SELECT (anon + authenticated) |
| `flux_ical_feeds` | ALL (public, owner-scoped) |
| `flux_invite_codes` | ALL (authenticated, owner only) |
| `flux_mcp_auth_codes` | none — server-only |
| `flux_mcp_oauth_clients` | none — server-only |
| `flux_mcp_tokens` | DELETE, SELECT, UPDATE (public, owner-scoped) |
| `flux_memory_reset_log` | INSERT, SELECT (authenticated) |
| `flux_messages` | ALL, INSERT (authenticated) |
| `flux_mod_actions` | ALL (authenticated, owner only) |
| `flux_name_locks` | ALL (authenticated, owner only) |
| `flux_owner_alerts` | ALL (authenticated, owner only) |
| `flux_parent_links` | ALL, SELECT (authenticated) |
| `flux_password_help` | INSERT (anon + authenticated); SELECT, UPDATE (owner) |
| `flux_post_reports` | ALL (authenticated, owner only) |
| `flux_processor_jobs` | SELECT (authenticated) |
| `flux_product_events` | INSERT, SELECT (authenticated) |
| `flux_public_content_log` | SELECT (authenticated, owner only) |
| `flux_recovery_emails` | none — server-only |
| `flux_recovery_tokens` | none — server-only |
| `flux_reported_users` | ALL (authenticated, owner only) |
| `flux_role_members` | ALL (authenticated, owner only) |
| `flux_roles` | ALL (authenticated, owner only) |
| `flux_school_bell_schedules` | ALL, SELECT (authenticated) |
| `flux_school_broadcast` | ALL, SELECT (authenticated) — flag 3 |
| `flux_school_calendar_days` | ALL, SELECT (authenticated) |
| `flux_school_feature_flags` | ALL (authenticated) |
| `flux_schools` | SELECT (authenticated) |
| `flux_security_alert_state` | none — server-only |
| `flux_session_cutoffs` | ALL (authenticated, owner only) |
| `flux_student_accommodations` | ALL, INSERT, SELECT, UPDATE (authenticated) — flag 2 |
| `flux_study_rooms` | ALL (authenticated) |
| `flux_sub_plan_views` | SELECT (authenticated) |
| `flux_sub_plans` | ALL (authenticated) |
| `flux_sync_conflict_log` | INSERT, SELECT, UPDATE (authenticated) |
| `flux_threads` | ALL (authenticated) |
| `flux_uptime_checks` | ALL (authenticated, owner only) |
| `flux_user_feature_flags` | ALL (authenticated) |
| `flux_user_memory` | DELETE, INSERT, SELECT, UPDATE (public, owner-scoped) |
| `flux_user_sightings` | SELECT (authenticated, owner only) |
| `goals` | ALL (public, owner-scoped) |
| `grades` | ALL (public, owner-scoped) |
| `habit_done` | ALL (public, owner-scoped) |
| `habits` | ALL (public, owner-scoped) |
| `meeting_notes` | ALL (authenticated) |
| `no_homework_days` | ALL, INSERT, SELECT, UPDATE (authenticated) — flag 2 |
| `office_hour_bookings` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `owner_direct_messages` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `parent_contacts` | ALL (authenticated) |
| `platform_admins` | none — server-only |
| `platform_settings` | SELECT (anon + authenticated) |
| `professional_development` | ALL (authenticated) |
| `push_subscriptions` | ALL (authenticated) |
| `school_announcements` | DELETE, INSERT, SELECT, UPDATE (authenticated); SELECT (public) — flag 1 |
| `school_calendar_events` | DELETE, INSERT, SELECT, UPDATE (authenticated) — flag 3 |
| `school_feed` | DELETE, INSERT, SELECT (authenticated); SELECT (public) — flag 1 |
| `staff_conversation_members` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `staff_conversations` | INSERT, SELECT, UPDATE (authenticated) |
| `staff_counselor_private_notes` | ALL (authenticated) |
| `staff_directory` | SELECT, UPDATE (authenticated) |
| `staff_messages` | DELETE, INSERT, SELECT (authenticated) |
| `staff_office_hours` | ALL, SELECT (authenticated) |
| `staff_parent_contact_logs` | ALL (authenticated) |
| `staff_personal_data` | ALL (authenticated) |
| `staff_student_accommodations` | ALL, INSERT, SELECT, UPDATE (authenticated) — flag 2 |
| `staff_tickets` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `staff_verification_requests` | INSERT, SELECT, UPDATE (authenticated) |
| `student_class_codes` | ALL (authenticated) |
| `student_completions` | ALL, INSERT, SELECT, UPDATE (authenticated) |
| `student_counselor_checkins` | ALL, INSERT, SELECT (authenticated) |
| `student_counselors` | ALL, SELECT (authenticated) |
| `student_wellness_snapshots` | ALL, SELECT (authenticated) |
| `subscriptions` | SELECT (authenticated) |
| `synara_vaults` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `sync_versions` | ALL (authenticated) |
| `tasks` | ALL (public, owner-scoped) |
| `teacher_announcements` | ALL, INSERT, SELECT, UPDATE (authenticated); SELECT (public) — flags 1, 2 |
| `teacher_assignments` | ALL, INSERT, SELECT, UPDATE (authenticated) — flag 2 |
| `teacher_classes` | DELETE, INSERT, SELECT, UPDATE (authenticated) |
| `teacher_student_notes` | ALL, SELECT (authenticated) |
| `teacher_students` | ALL, INSERT, SELECT (authenticated) |
| `user_data` | DELETE, INSERT, SELECT, UPDATE (authenticated, owner-scoped) |
| `user_roles` | INSERT, SELECT, UPDATE (authenticated); SELECT (public) — flag 4 |
