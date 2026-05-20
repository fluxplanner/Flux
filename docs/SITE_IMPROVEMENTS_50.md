# Site Improvements — 50 enhancements

**Shipped in:** `public/js/flux-site-enhancements.js` + `public/css/flux-site-enhancements.css`  
**Flag:** `enable_site_enhancements_pack` (default **on**)  
**Migration:** `supabase/migrations/20260527100000_site_enhancements_pack.sql`

Toggle individual items under **Settings → Data & info → Site enhancements (50)**.  
QA: `docs/QA_MATRIX.md` §0f.

| # | ID | What it does |
|---|-----|----------------|
| 1 | `panel_breadcrumb` | Breadcrumb + copy panel URL in topbar |
| 2 | `shortcuts_help` | Press `?` for shortcut overlay |
| 3 | `esc_close_modal` | `Esc` closes top modal |
| 4 | `dblclick_task_done` | Double-click task row to toggle done |
| 5 | `relative_due_dates` | “Today / Tomorrow” on due dates |
| 6 | `session_build_stamp` | Session length + build id in settings |
| 7 | `storage_warn` | Warn when browser storage >4MB / >8MB |
| 8 | `reconnect_toast` | Toast when connectivity returns |
| 9 | `print_styles` | Print-friendly layout (hide chrome) |
| 10 | `time_24h` | Optional 24h time in date pill |
| 11 | `week_monday` | `window.fluxWeekStartsMonday()` helper |
| 12 | `notes_word_count` | Live word count on Notes |
| 13 | `task_priority_legend` | Priority color legend on dashboard |
| 14 | `appointment_badges` | Pending appointment badges (counselor/student) |
| 15 | `teacher_refresh` | Refresh button on teacher dashboard |
| 16 | `staff_csv_export` | Export `staff_tickets` CSV on workboard |
| 17 | `google_status_dot` | Green dot when Google token present |
| 18 | `canvas_sync_label` | Last Canvas sync label on Google panel |
| 19 | `impersonate_bar` | Striped bar when impersonating |
| 20 | `notes_unsaved_guard` | `beforeunload` if notes edited |
| 21 | `focus_dim_chrome` | Dim sidebar during focus timer |
| 22 | `recovery_dismiss` | Dismiss recovery banner (persisted) |
| 23 | `feedback_quick` | Bug / Idea / UX quick feedback buttons |
| 24 | `g_nav` | `g` then `d` → dashboard, `g` then `s` → settings |
| 25 | `copy_ids` | Copy user ID / school ID in account |
| 26 | `motion_hint` | One-time hint if OS prefers reduced motion |
| 27 | `toast_aria` | Reinforce toast stack `aria-live` |
| 28 | `task_flash` | `window.__fluxEnhFlashTask(id)` highlight API |
| 29 | `greeting_emoji` | Time-of-day emoji on dashboard greeting |
| 30 | `empty_tasks_cta` | Empty state CTA on task list |
| 31 | `habit_celebrate` | Toast on 7+ day habit streak |
| 32 | `topbar_pills` | SRS due + momentum pills in topbar |
| 33 | `work_mode_reminder` | Educator work-mode routing reminder (once/day) |
| 34 | `directory_debounce` | Debounced staff directory search |
| 35 | `staff_autocomplete_off` | `autocomplete=off` on staff forms |
| 36 | `noreferrer_blank` | `noopener` on `target=_blank` links |
| 37 | `lazy_images` | `loading=lazy` on images |
| 38 | `tab_title_sync` | Browser tab title matches panel |
| 39 | `scroll_restore` | Per-panel scroll position in session |
| 40 | `task_context_copy` | Right-click copies task title |
| 41 | `enh_settings_ui` | Per-enhancement toggles in settings |
| 42 | `deep_link_panel` | `?panel=dashboard` deep link on load |
| 43 | `panel_back` | Back button in topbar (panel history) |
| 44 | `ai_rate_hint` | Friendly message on AI rate limits |
| 45 | `profile_completeness` | Profile completeness meter |
| 46 | `school_feed_new` | “New” badge on school feed tab |
| 47 | `offline_queue_pill` | Offline queue count on sync pill |
| 48 | `resources_pin_count` | Pin count in Resources title |
| 49 | `contrast_quick` | Quick high-contrast toggle in Look |
| 50 | `privacy_links` | Privacy card in Data settings |

API: `FluxSiteEnhancements.catalog()` returns this list.

**Rollback:** set `enable_site_enhancements_pack` to `false` in `flux_feature_flags` (or school override).

**Dev console:** `FluxSiteEnhancements.catalog()` · `FluxSiteEnhancements.setEnabled('shortcuts_help', false)`
