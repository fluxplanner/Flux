# Flux Planner — QA matrix (Phase 15)

**Status:** Living checklist for manual regression passes before releases. Pair with `docs/PHASE_1_CLOSEOUT.md` (exit criteria), `docs/stabilization-checkpoint.md`, and `docs/RLS_AUDIT.md` (Supabase).

**Mark cells:** ✓ pass · ✗ fail · — skip (not applicable)

---

## 0a. Staff platform v2 (`20260521130000_staff_platform_v2_fixes.sql`)

- [ ] Migration applied: `platform_admins`, `staff_tickets`, `applicant_note` column, `flux_is_platform_admin()`.
- [ ] `FluxStaffDirectory.hydrate()` loads rows from `staff_directory` (not empty after seed/import).
- [ ] `staff` role work mode opens **Workboard** (`staffWorkboard`), not admin dashboard.
- [ ] `admin` role work mode opens **Operations** / admin dashboard; `adminOps` denied for `staff`.
- [ ] Staff workboard tickets persist to `staff_tickets` (visible after reload, same school).
- [ ] Sign-in shows dashboard skeleton until role routing completes (no flash of wrong layout).
- [ ] Educator **Ctrl/Cmd+K** toggles Work ↔ Personal; **Ctrl/Cmd+Shift+K** still opens global search.
- [ ] Owner approval queue works via `platform_admins` email (not hardcoded JWT string in new policies).

---

## 0b. Phase 5 — Counselor caseload + verification realtime

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Counselor caseload | `counselor` | Enable `enable_counselor_caseload`, sign in, Work mode, open Overview | `#counselorCaseloadMount` shows skeleton then summary cards (assigned / consented / bands). |
| Caseload mode toggle | `counselor` | Work → Personal via Ctrl/Cmd+K | Caseload mount clears/hides; student planner chrome returns. |
| Verification subscriptions | `owner` | Open Owner Suite → Staff verify; approve pending row while applicant is logged in | Applicant `user_roles` upgrades without full page reload (watch Network + console). |
| Realtime cleanup | Any | Sign out | `getSB().getChannels()` length returns to 0 (no `owner_verification_queue` / `applicant_verification_watch` left). |

Dev flags: `window.FLUX_EXPERIMENTS = { enable_counselor_caseload: true };` then reload.

Directory seed: `node scripts/seed-staff-directory.mjs scripts/staff-import-ia-east.jsonl` (requires service role).

---

## 0c. Phase 7 — Educator Google Workspace hub

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Google Hub Auth | `teacher` | Work mode → Teacher Overview → **Connect Google Workspace** | OAuth pop-up requests Classroom + Drive (plus Gmail/Calendar); UI updates without full page reload. |
| Student isolation | `student` | Console: `FluxGoogleHub.init()` or `FluxGoogle.canInitStaffHub()` | Returns false / no-op; student Canvas + personal Google flows unchanged. |
| Work mode routing | `counselor` | Work mode → click **Canvas** in sidebar (if visible) or `nav('canvas')` | `FluxRoleRouting.interceptNavigation` sends user to `counselorDashboard`, not student Canvas LMS panel. |
| Staff Hub feature flag | `staff` | Disable `enable_staff_google_hub` in DB, reload | `.staff-google-hub-mount` hidden; staff **Google** nav hidden (see §0). Re-enable → mount + nav return. |
| Staff / admin Google nav | `staff` or `admin` | Work mode → **Google** nav | Opens unified hub (`canvas` panel); pop-up OAuth preserves workboard Realtime state. |

Implementation: `public/js/flux-google-hub.js` (`FluxGoogle.installStaffHub`, `FluxGoogleHub` alias), `flux-role-routing.js` (`interceptNavigation`).

---

## 0e. Counselor appointment booking

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Student books | `student` | Profile → My counselor → Book appointment → pick slot → Request | Row in `counselor_appointments` with `status=pending`; taken slots show as booked for other students. |
| Counselor queue | `counselor` | Work mode → Overview → **Booking requests** | Pending rows show student name, reason, Confirm / Decline. |
| Confirm | `counselor` | Click **Confirm** on pending row | Status `confirmed`; student gets message (if messaging works). |
| Meetings tab | `counselor` | **Meetings** nav | Pending requests block appears above Google Calendar. |

Migration: `supabase/migrations/20260526120000_counselor_appointments_booking_fixes.sql`

| Availability slots | `counselor` + `student` | Counselor saves grid in Workboard; student opens Book appointment | Date chips show counts; not “No open slots”; rows in `counselor_availability_slots` (lowercase `day_of_week`). |

Migration: `supabase/migrations/20260533700000_counselor_availability_student_read.sql`

---

## 0g. Staff Productivity Suite (P8.2)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Suite flags | Owner | Enable `enable_staff_productivity_suite` + `enable_classroom_tools` | Widget grid appears on teacher dashboard (Work mode). |
| Quick-Grade | `teacher` | Drag card between buckets | Persists in localStorage after reload. |
| Accommodations | `teacher` | Add need-to-know row | Row in `staff_student_accommodations`; visible to same-school educators with roster/counselor link. |
| Meeting log | `counselor` | Add private note | Row in `staff_counselor_private_notes`; not readable by teacher test account. |
| Personal hub | `teacher` | Personal mode → Personal hub tab | Brain dump / grocery widgets; no row in Supabase for grocery. |
| Staff dash board | `counselor` / `teacher` | Enable `enable_staff_dash_board` → Personal mode → Dashboard | Widget board (welcome, mini cal, week strip); drag ⠿ reorder; ↔ resize; + Widget adds photo board / hub modules. |
| Staff dash board rollback | Owner | Disable `enable_staff_dash_board` | Legacy card dashboard (Tasks / Resources / Personal hub). |
| Student picker | `teacher` | Load roster → Pick student | Name shown; same student not picked again within 3 rounds. |
| Classroom timer | `teacher` | Start 5 min preset | Countdown runs; toast at 0:00. |
| Oops broadcast | `teacher` | Work mode → Oops widget → send message | `teacher_announcements` urgent row; enrolled `student` sees banner on Dashboard. |
| Hall pass | `teacher` | Log student out → Returned | Local registry only. |
| Exit ticket | `teacher` | Generate question | New prompt each click. |
| Rollback | Owner | Disable master flag | Widget grid hidden. |
| Wellness queue | `counselor` | Student sends check-in (Profile → My counselor) | Row in `student_counselor_checkins`; counselor Wellness queue shows new item; Acknowledge / Resolve. |
| Crisis sheet | `counselor` | Open crisis widget | Static steps visible; no DB write. |
| Referrals | `counselor` | + New referral | Row in `counselor_referrals`; admin same school can SELECT. |
| Student check-in | `student` | Profile → Need support → Send | Counselor notified; button disabled after send. |
| Duty alerts | `admin` | Work → Admin Ops → Duty widget | Unassigned slots highlighted; edit persists locally; Publish inserts `admin_duty_logs`. |
| Sub swap | `admin` | Add two subs → select both → Swap covers | Cover names exchanged; Operations tab reflects change. |
| Staff ⌘K | `teacher` / `admin` | With command v2 on: ⌘K opens palette (not mode toggle) → "Open teacher dashboard" | Navigates to correct panel; closes palette. Mode toggle still in palette under Workspace. |
| Gmail palette | `teacher` | ⌘K → "Gmail: import top action email" (Gmail connected) | Task created with `gmailMessageId`; dashboard shows task. |
| Gmail widget | `counselor` | Enable `sys_gmail_quick` widget → Import top | Same as palette import. |
| IA East pilot | `teacher` @ IAE | After `20260528300000` migration, reload (no FLUX_EXPERIMENTS) | `FluxFeatureFlags` resolves suite flags true for IAE school. |
| IA East locale | `student` @ IAE | After `20260528700000`, reload | `enable_locale_foundation` true via school override; Appearance shows locale card. |
| IA East health | `admin` @ IAE | Operations → System health | Panel available without experiments when extended pilot applied. |
| Counselor picker | `counselor` | Meeting log → + note → select assigned student | Saves without UUID prompt; shows display name in list. |
| Ops health | `admin` | Enable `enable_ops_health_panel` → System health → Run checks | Supabase + flags ok; staff tables ok after migrations; RLS legacy flags false. |

Migration: `20260528100000` … `20260528700000_ia_east_pilot_extended.sql` · Docs: `docs/PHASE_8_CLOSEOUT.md`, `docs/P8-STAFF-PRODUCTIVITY.md`, `docs/P8-HEALTH.md`

---

## 0m. Syllabus conflict check (`enable_syllabus_conflict_check` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Two quizzes same day | Legacy “Heavy day” one-line banner |
| Flag on | `student` | 2+ tests same date | Bullet list under notices bar |
| Flag on | `student` | Test + hw same subject/date | Subject clash bullet |
| Flag on | `student` | Duplicate task name same day | Duplicate due bullet |
| Locale | `student` | Flag + locale on | Bullets use `fluxT` / Español |
| IAE pilot | `student` @ IAE | After `20260529100000`, two quizzes same day | Banner shows without experiments |
| Live refresh | `student` | Add second quiz same date | Banner updates without full page reload |
| Calendar marker | `student` | Flag on, conflict date in month view | `cal-day--conflict` on grid cell |
| Calendar day panel | `student` | Select conflict day | Gold hint block in `#calDayTasks` |
| Calendar tab | `student` | Open Calendar with conflicts | Notices banner still shows v2 list |

Migration: `20260529000000` … `20260529100000_ia_east_syllabus_conflict.sql` · Docs: `docs/P11-SYLLABUS-CONFLICT.md`, `docs/P11-CALENDAR-CONFLICT.md`

---

## 0n. Deep links (`enable_deep_links` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Open `?task=123` | Param ignored; app loads normally |
| Flag on | `student` | Copy link from task row | Clipboard URL with task id |
| Flag on | `student` | Open copied URL | Dashboard scrolls to task + flash |
| Note link | `student` | `?note={id}` | Notes editor opens |
| Focus link | `student` | `?focus={id}` | Deep work overlay starts |
| Edit param | `student` | `?task={id}&edit=1` | Edit modal opens |

Migration: `20260529200000_phase_12_deep_links_sync_queue.sql` · Doc: `docs/P12-DEEP-LINKS.md`

---

## 0o. Sync queue UI (`enable_sync_queue_ui` + `enable_offline_sync`)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | Any | Pending outbox pill | Count only; no modal on click |
| Flag on | Any | Offline edit + pill click | Queue modal lists storage keys |
| Retry | Any | Retry all while online | Flush + toast “Syncing…” |
| Settings | Any | Data card | “View pending queue” opens modal |

Doc: `docs/P12-SYNC-QUEUE.md`

---

## 0p. Voice task capture (`enable_voice_task_capture` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Open quick-add | No mic button |
| Flag on | `student` | Quick-add → mic → speak “Bio lab Friday 30 min” | Preview shows date, time chip |
| Flag on | `student` | Enter after voice | Task added with parsed fields |
| Unsupported | Any | Firefox / no SR API | Mic disabled + toast |
| Palette | `student` | ⌘K → “Voice task” | Opens listen on quick-add |

Migration: `20260529300000_voice_task_capture.sql` · Doc: `docs/P12-VOICE-CAPTURE.md`

---

## 0q. GCal busy overlays (`enable_gcal_busy_overlay` + `enable_gcal_2way`)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flags off | `student` | Calendar month | No blue busy stripes |
| Both on | `student` | Sync two-way with Google events | Busy bars on matching days |
| Day panel | `student` | Select day with GCal events | Blue hint block lists events |
| Conflict | `student` | Due task same day as 2+ GCal events | `#gcalBusyBanner` on dashboard |
| Overlap | `student` | Task with time overlaps GCal block | Overlap bullet in banner/day hint |

Migration: `20260529400000_gcal_busy_overlay.sql` · Docs: `docs/P12-GCAL-BUSY.md`, `docs/P6-GCAL-2WAY.md`

---

## 0r. Recurring exceptions (`enable_recurring_exceptions` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Complete weekly task | Legacy spawn only |
| Flag on | `student` | 🔁 → Complete without next | Done; no new instance |
| Skip next | `student` | 🔁 → Skip next date, then complete | Spawn date skips one cycle |
| Shift | `student` | 🔁 → Shift +7 days | Open series tasks move +7d |
| End after | `student` | Set end-after 2, complete twice | Second completion ends series |
| Cloud | `student` | Change series on device A | Device B pull shows same rules |

Migration: `20260529500000_recurring_exceptions.sql` · Doc: `docs/P12-RECUR-EXCEPTIONS.md`

---

## 0s. Subject theme packs (`enable_subject_theme_packs` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Settings → Appearance | No subject theme card |
| Flag on | `student` | Appearance card | Preset select + export/import |
| Apply preset | `student` | Choose Pastel STEM → Apply | Class colors/icons update in School |
| Task chip | `student` | Open tasks with subjects | Chip shows icon when set |
| Export | `student` | Export JSON | Downloads `flux-subject-theme.json` |
| Import | `student` | Import matching pack | Classes merge colors/icons; toast count |
| Cloud | `student` | Apply preset on device A | Device B pull shows same active preset |

Migration: `20260529600000_subject_theme_packs.sql` · Doc: `docs/P12-THEME-PACKS.md`

---

## 0t. Command palette v2 (`enable_cmd_palette_v2` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | ⌘K → type `cal` | Substring match only (Calendar if label contains query) |
| Flag on | `student` | ⌘K → `cal` | Calendar matches via fuzzy |
| Recents | `student` | Run Settings + Notes, reopen ⌘K empty | **Recent** group shows both |
| Surfaces | `student` | Enable hidden tab in tab customizer | **Surfaces** lists Open … command |
| Cloud | `student` | Run commands on A | Device B pull restores recents order |

Migration: `20260529700000_cmd_palette_v2.sql` · Doc: `docs/P12-CMD-PALETTE-V2.md`

---

## 0u. Global search v2 (`enable_global_search_v2` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | ⌘⇧K → partial query | Substring match (legacy) |
| Flag on | `student` | ⌘⇧K → `bio hw` | Fuzzy task/note/class hits |
| Keyboard | `student` | ↑↓ then Enter | Opens highlighted result |
| Recents | `student` | Search twice, reopen empty | Recent query chips appear |
| Cloud | `student` | Search on device A | Device B shows same recents |

Migration: `20260529800000_global_search_v2.sql` · Doc: `docs/P13-GLOBAL-SEARCH-V2.md`

---

## 0v. Smart task lists (`enable_smart_lists` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard filters | No smart-list chip row |
| Flag on | `student` | Dashboard | Overdue STEM, No estimate, Exam prep chips |
| Overdue STEM | `student` | Tap chip with overdue bio task | Only matching tasks shown |
| No estimate | `student` | Tap chip | Open tasks without `estTime` |
| Exam prep | `student` | Tap chip | Tests/quizzes due ≤14 days |
| ⌘K | `student` | `Smart list: exam prep` | Navigates + applies filter |
| Cloud | `student` | Pin/activate on A | Device B restores `lastActive` |

Migration: `20260529900000_smart_lists.sql` · Doc: `docs/P13-SMART-LISTS.md`

---

## 0w. Bulk edit by filter (`enable_bulk_filter` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Bulk bar | “Select all” selects every open task |
| Flag on | `student` | Filter row | **Bulk edit filter** button visible |
| Smart list | `student` | Exam prep → Bulk edit filter | Bulk mode; only matching tasks selected |
| Select filtered | `student` | Toggle in bulk bar | Selects/deselects visible set only |
| Set estimate | `student` | Bulk → Set estimate → 45 | All selected get `estTime` 45 |
| Set priority | `student` | Bulk → Set priority → high | Priority updated on selection |
| ⌘K | `student` | Bulk edit filtered tasks | Dashboard + bulk mode |

Migration: `20260530000000_bulk_filter.sql` · Doc: `docs/P13-BULK-FILTER.md`

---

## 0x. Focus intent note (`enable_focus_intent` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | ⌘D deep work | Opens immediately, no modal |
| Flag on | `student` | ⌘D or task ⏱ | Intent modal with Skip / Start |
| Intent display | `student` | Enter intent → start | Text shown in deep work overlay |
| Session log | `student` | Complete deep work | `flux_session_log` row has `intent` |
| Recents | `student` | Reuse chip in modal | Fills textarea |
| Cloud | `student` | Save intent on A | Device B shows same recents |

Migration: `20260530100000_focus_intent.sql` · Doc: `docs/P13-FOCUS-INTENT.md`

---

## 0y. Habit chain heatmaps (`enable_habit_heatmap` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Focus Timer | No habit chains card |
| Flag on | `student` | Focus Timer | Habit chains card below focus heatmap |
| Add | `student` | Name + Add habit | Row with empty heatmap |
| Check today | `student` | Toggle checkbox | Cell fills; streak updates |
| Streak | `student` | Log 2 consecutive days | Streak shows 2 |
| Cloud | `student` | Log on device A | Device B shows same history |

Migration: `20260530200000_habit_heatmap.sql` · Doc: `docs/P13-HABIT-HEATMAP.md`

---

## 0z. Pomodoro subject presets (`enable_pomodoro_subject_presets` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Focus Timer | No subject preset bar |
| Flag on | `student` | Timer subject + Save preset | Chip appears with minutes |
| Apply | `student` | Click chip | Work/short inputs update |
| Subject change | `student` | Select tagged subject | Saved minutes auto-apply |
| Task timer | `student` | ⏱ on task with subject | Uses subject preset |
| Cloud | `student` | Save on A | Device B shows same chips |

Migration: `20260530300000_pomodoro_subject_presets.sql` · Doc: `docs/P13-POMODORO-PRESETS.md`

---

## 10a. Meeting mode (`enable_meeting_mode` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Focus Timer | No meeting mode card |
| Flag on | `student` | Timer → Start meeting mode | Focus shell + top banner |
| Countdown | `student` | Wait / observe banner | Timer counts down |
| Auto-reply | `student` | Copy auto-reply | Clipboard status message |
| Toasts | `student` | Trigger info toast while active | Suppressed |
| Exit | `student` | Esc or Exit | Full UI restored |

Migration: `20260530400000_meeting_mode.sql` · Doc: `docs/P13-MEETING-MODE.md`

---

## 10b. Mood velocity (`enable_mood_velocity` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Mood tab | No velocity card |
| Flag on | `student` | Mood → quick log | Chart + chips appear |
| Save | `student` | Pick mood + energy → Save | Toast; history updates |
| Complete task | `student` | Mark task done | Chart bar updates |
| Privacy on | `student` | Save mood with private checked | Counselor snapshot skipped |
| Privacy off | `student` | Uncheck private + save | Cloud slice includes logs |
| ⌘K | `student` | “mood velocity” | Opens Mood tab |

Migration: `20260530500000_mood_velocity.sql` · Doc: `docs/P14-MOOD-VELOCITY.md`

---

## 10c. Screenshot snip (`enable_screenshot_snip` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Quick-add (T) | No ✂️ button |
| Flag on | `student` | Quick-add | ✂️ snip button visible |
| Paste | `student` | Copy screenshot → paste in quick-add | Preview + OCR text in field |
| Snip btn | `student` | Copy screenshot → tap ✂️ | Same as paste |
| Add | `student` | Submit extracted text | Task created via NL parse |
| ⌘K | `student` | “screenshot snip” | Opens quick-add + reads clipboard |

Migration: `20260530600000_screenshot_snip.sql` · Doc: `docs/P14-SCREENSHOT-SNIP.md`

---

## 10d. Event buffer (`enable_event_buffer` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Calendar | No buffer card |
| Flag on | `student` | Calendar → buffer card | Before/after inputs |
| Save | `student` | Set 15m / 15m → Save | Toast; settings persist |
| Day hint | `student` | Day with timed event | Buffer zone list |
| Conflict | `student` | Timed task in buffer window | Banner + day warning |
| Grid | `student` | Conflict day | `cal-day--buffer-warn` ring |

Migration: `20260530700000_event_buffer.sql` · Doc: `docs/P14-EVENT-BUFFER.md`

---

## 10e. Travel time (`enable_travel_time` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Calendar | No travel card |
| Flag on | `student` | Calendar → travel card | Minutes input |
| Tight gap | `student` | Two events 5m apart (< 15m travel) | Day hint + banner |
| Grid | `student` | Gap day | `cal-day--travel-warn` outline |
| Save | `student` | Change travel min → Save | Setting persists |

Migration: `20260530800000_travel_time.sql` · Doc: `docs/P14-TRAVEL-TIME.md`

---

## 10f. Ambient weather (`enable_ambient_weather` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard | No weather card |
| Flag on | `student` | Dashboard | Weather card under greeting |
| Refresh | `student` | Tap Refresh | Temp + condition load |
| Geo | `student` | Use my location (allow) | Location label updates |
| Hint | `student` | Clear day, mild temp | Outdoor study hint |
| ⌘K | `student` | “ambient weather” | Dashboard + refresh |

Migration: `20260530900000_ambient_weather.sql` · Doc: `docs/P14-AMBIENT-WEATHER.md`

---

## 10g. Energy scheduling (`enable_energy_scheduling` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard | No peak hours card |
| Flag on | `student` | Move energy slider 3+ times | Peak window chips appear |
| Heavy tasks | `student` | Add essay/project task | Listed with schedule hint |
| ⌘K | `student` | “peak energy” | Opens dashboard card |

Migration: `20260531000000_energy_scheduling.sql` · Doc: `docs/P15-ENERGY-SCHEDULING.md`

---

## 10h. Rest day plan (`enable_rest_day_plan` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard | No recovery card |
| Flag on | `student` | Dashboard | Recovery mode card |
| Mark lazy | `student` | Lazy day button | Rest plan + defer options |
| Mark sick | `student` | Sick day button | Sick plan + push all |
| Defer heavy | `student` | Lazy day + defer heavy | Heavy tasks moved forward |
| ⌘K | `student` | “rest day plan” | Opens dashboard card |

Migration: `20260531100000_rest_day_plan.sql` · Doc: `docs/P15-REST-DAY-PLAN.md`

---

## 10i. Geofence reminders (`enable_geofence_reminders` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Settings → Alerts | No geofence card |
| Flag on | `student` | Settings → Alerts | Geofence card visible |
| Add place | `student` | Name + coords + Add | Place listed |
| Watch | `student` | Start location watch | Status shows watching |
| Arrive | `student` | Enter radius (simulated coords) | Toast / notification |
| ⌘K | `student` | “geofence” | Settings Alerts tab |

Migration: `20260531200000_geofence_reminders.sql` · Doc: `docs/P15-GEOFENCE.md`

---

## 10j. Exam prep plan (`enable_exam_prep_plan` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard exam countdown | No daily prep block |
| Flag on | `student` | Seeded/future test task | Prep rows under countdown |
| Minutes | `student` | Subject tasks with estimates | min/day reflects total ÷ days |
| Multi exam | `student` | 2+ future tests | Up to 4 rows |
| ⌘K | `student` | “exam prep” | Dashboard + countdown refresh |

Migration: `20260531300000_exam_prep_plan.sql` · Doc: `docs/P16-EXAM-PREP-PLAN.md`

---

## 10k. Syllabus week scaffold (`enable_syllabus_week_scaffold` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard | No syllabus week card |
| Flag on | `student` | Task named "Week 4 reading" | Week 4 listed on card |
| Term start | `student` | Set Week 1 Monday | Scaffold dates shift |
| Scaffold | `student` | Scaffold week 4 | 4 placeholder tasks added |
| Dedupe | `student` | Scaffold same week again | Toast: already scaffolded |
| Manual | `student` | Enter week # + scaffold | Tasks for that week |
| ⌘K | `student` | "syllabus week" | Dashboard + card visible |

Migration: `20260531400000_syllabus_week_scaffold.sql` · Doc: `docs/P16-SYLLABUS-WEEK-SCAFFOLD.md`

---

## 10l. Task template marketplace (`enable_task_template_marketplace` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Templates button | Legacy 8 singles + 2 packs |
| Flag on | `student` | Templates button | Marketplace modal with curated packs |
| Apply pack | `student` | AP exam crunch | 4 tasks added |
| Quick template | `student` | Homework single | Add-task modal prefilled |
| Import JSON | `student` | Valid pack file | Pack listed under Imported |
| Export | `student` | Export imported pack | JSON download |
| ⌘K | `student` | "template marketplace" | Opens marketplace |

Migration: `20260531500000_task_template_marketplace.sql` · Doc: `docs/P17-TASK-TEMPLATE-MARKETPLACE.md`

---

## 10m. Focus score (`enable_focus_score` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Focus Timer page | No focus score card |
| Flag on | `student` | Complete pomodoro | Session recap shows score |
| Interruptions | `student` | Switch tab mid-session | Score lower vs clean session |
| Card | `student` | Timer page | Today + 7-day averages |
| Cloud | `student` | Sync after session | `focusScore` on sessionLog entry |
| ⌘K | `student` | "focus score" | Navigates to Focus Timer |

Migration: `20260531600000_focus_score.sql` · Doc: `docs/P18-FOCUS-SCORE.md`

---

## 10n. Email task inbox (`enable_email_task_inbox` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Settings → Data | No email inbox card |
| Flag on | `student` | Settings → Data | Inbox card with paste + scan |
| Paste | `student` | Paste syllabus email → Stage | Item in queue |
| Approve | `student` | Approve → task | Task added, queue item gone |
| Dismiss | `student` | Dismiss | Item removed |
| Gmail | `student` | Scan Gmail (signed in) | Matching emails staged |
| Dedupe | `student` | Stage same email twice | Duplicate toast |
| ⌘K | `student` | "email inbox" | Settings Data tab |

Migration: `20260531700000_email_task_inbox.sql` · Doc: `docs/P19-EMAIL-TASK-INBOX.md`

---

## 10o. Automation hooks (`enable_automation_hooks` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Settings → Data | No automation hooks card |
| Flag on | `student` | Settings → Data | Hook URLs listed |
| Copy | `student` | Copy URL | Clipboard toast |
| quick=focus | `student` | Open `?quick=focus` | Timer tab + session starts |
| quick=timer | `student` | Open `?quick=timer` | Timer tab |
| panel=calendar | `student` | Open `?panel=calendar` | Calendar tab |
| quick=task+text | `student` | `?quick=task&text=Math hw` | Quick add prefilled |
| ⌘K | `student` | "automation hooks" | Settings Data tab |

Migration: `20260531800000_automation_hooks.sql` · Doc: `docs/P20-AUTOMATION-HOOKS.md`

---

## 10p. iCal subscribe (`enable_ical_subscribe` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Calendar tab | No iCal subscribe card |
| Flag on | `student` | Calendar → card below Google sync | Publish + copy URLs |
| Publish | `student` | Publish feed (signed in) | Toast + webcal URL shown |
| Focus toggle | `student` | Include focus → publish | Focus days in ICS |
| Download | `student` | Download .ics | File download |
| Regenerate | `student` | Regenerate token | Old URL invalid |
| ⌘K | `student` | "ical subscribe" | Calendar tab |

Migration: `20260531900000_ical_subscribe.sql` · Edge: `ical-feed` · Doc: `docs/P21-ICAL-SUBSCRIBE.md`

---

## 10q. ICS timetable import (`enable_ics_timetable_import` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Calendar tab | No ICS import card |
| Flag on | `student` | Calendar → card below iCal | Drop zone visible |
| Parse | `student` | Drop sample .ics | Preview rows (weekly/event/blackout) |
| Weekly | `student` | Import RRULE weekly item | Appears in weekly schedule |
| Blackout | `student` | Import holiday all-day | Rest day added |
| Options | `student` | Uncheck blackouts → import | Only weekly/events imported |
| ⌘K | `student` | "ics import" | Calendar tab |

Migration: `20260532000000_ics_timetable_import.sql` · Doc: `docs/P22-ICS-TIMETABLE-IMPORT.md`

---

## 10r. Sport practice pack (`enable_sport_practice_pack` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Extracurriculars tab | No sport practice card |
| Flag on | `student` | Extracurriculars → card | 3 packs + weekly scheduler |
| Practice pack | `student` | Apply Practice day | 4 tasks added (outside scope) |
| Game pack | `student` | Apply Game day | Match-day tasks added |
| Weekly | `student` | Pick days + Add weekly practice | Rule in calendar weekly schedule |
| Marketplace | `student` | Both sport + marketplace flags | Sport packs in Templates modal |
| ⌘K | `student` | "sport practice" | Extracurriculars tab |

Migration: `20260532100000_sport_practice_pack.sql` · Doc: `docs/P23-SPORT-PRACTICE-PACK.md`

---

## 10s. CS snippet library (`enable_cs_snippet_library` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Toolbox → CS | No Snippet library chip |
| Flag on | `student` | Toolbox → CS → Snippet library | Modal with starter snippets |
| Search | `student` | Search "binary" | Python binary search shown |
| Copy | `student` | Copy code | Clipboard + toast |
| Add | `student` | Save new snippet | Appears in list |
| Notes | `student` | Add to notes | Note with fenced code block |
| Export | `student` | Export JSON | File download |
| ⌘K | `student` | "cs snippet" | Opens library |

Migration: `20260532200000_cs_snippet_library.sql` · Doc: `docs/P24-CS-SNIPPET-LIBRARY.md`

---

## 10t. Unit converter favorites (`enable_unit_converter_favorites` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Open quick-add (N) | No conversion chip strip |
| Flag on | `student` | Open quick-add | Chip strip above hint |
| Tap chip | `student` | Tap `1 in → 2.54 cm` | Text in quick-add + toast |
| Add | `student` | + Add → pin mph→km/h | New chip appears |
| Manage | `student` | Manage → Remove | Chip removed |
| ⌘K | `student` | "unit favorite" | Opens quick-add with strip |

Migration: `20260532300000_unit_converter_favorites.sql` · Doc: `docs/P25-UNIT-CONVERTER-FAVORITES.md`

---

## 10u. Periodic SRS quiz (`enable_periodic_srs_quiz` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Toolbox → Science | No Element quiz chip |
| Flag on | `student` | Science → Element quiz | MCQ modal opens |
| Answer | `student` | Pick option | Reveal + grade buttons |
| SRS | `student` | Good → next card | Due count decreases |
| Wrong | `student` | Miss answer | Added to review queue |
| Modes | `student` | Switch Name → symbol | New prompt style |
| ⌘K | `student` | "element quiz" | Opens quiz |

Migration: `20260532400000_periodic_srs_quiz.sql` · Doc: `docs/P26-PERIODIC-SRS-QUIZ.md`

---

## 10v. Flashcard generator (`enable_flashcard_generator` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes → Flashcards | AI generation (legacy) |
| Flag on | `student` | Note with H + bullets → Generate | Preview modal |
| Select | `student` | Study selected | Flashcard view opens |
| Saved | `student` | Study saved on note w/ cards | Deck loads |
| Shuffle | `student` | Shuffle in study view | Order changes |
| AI fallback | `student` | Try AI instead | Legacy AI path |
| ⌘K | `student` | "flashcard generate" | Notes + generate |

Migration: `20260532500000_flashcard_generator.sql` · Doc: `docs/P27-FLASHCARD-GENERATOR.md`

---

## 10w. SRS deck mode (`enable_srs_deck_mode` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes tab | No SRS banner or #review filter |
| Flag on | `student` | Notes tab | SRS banner with due/cards counts |
| Tag | `student` | Note → 🔄 #review | Tag toggles; note appears in filter |
| Sync | `student` | Note w/ flashcards + #review → Sync | Card count updates |
| Review | `student` | Start review | Flip + grade modal |
| SRS | `student` | Good → next card | Due count decreases |
| Filter | `student` | #review filter | Only tagged notes listed |
| ⌘K | `student` | "srs review deck" | Opens study modal |

Migration: `20260532600000_srs_deck_mode.sql` · Doc: `docs/P28-SRS-DECK-MODE.md`

---

## 10x. LaTeX live preview (`enable_latex_live_preview` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes → edit note | Single editor pane, no ∑ buttons |
| Flag on | `student` | Notes → edit note | ∑ / $x$ / $$ in rtbar |
| Split | `student` | Tap ∑ | Preview pane toggles |
| Inline | `student` | Type `$E=mc^2$` | Renders inline in preview |
| Display | `student` | Type `$$\frac{a}{b}$$` | Block equation in preview |
| Insert | `student` | Tap $$ button | Display template inserted |
| ⌘K | `student` | "latex preview" | Notes + split opens |

Migration: `20260532700000_latex_live_preview.sql` · Doc: `docs/P29-LATEX-LIVE-PREVIEW.md`

---

## 10y. Equation OCR → LaTeX (`enable_equation_ocr_latex` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes → edit note | No 📐 Equation OCR button |
| Flag on | `student` | Notes → 📐 Equation OCR | File picker opens |
| OCR | `student` | Photo of equation | Correction modal with LaTeX |
| Edit | `student` | Fix typo in textarea | KaTeX preview updates |
| Insert | `student` | Insert into note | `$$…$$` block in editor |
| ⌘K | `student` | "equation ocr" | Notes + picker |

Migration: `20260532800000_equation_ocr_latex.sql` · Doc: `docs/P30-EQUATION-OCR-LATEX.md`

---

## 10z. Wiki backlinks (`enable_wiki_backlinks` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes tab | No wiki banner or [[ ]] button |
| Flag on | `student` | Notes tab | Banner with link counts |
| Insert | `student` | [[ ]] → "Biology" | `[[Biology]]` in editor |
| Outlinks | `student` | Save link to existing note | Outlinks panel lists target |
| Backlinks | `student` | Open linked-to note | Backlinks shows source |
| Graph | `student` | Graph button | SVG modal; click opens note |
| Filter | `student` | 🔗 Linked | Only notes with wikilinks |
| ⌘K | `student` | "wiki graph" | Opens graph modal |

Migration: `20260532900000_wiki_backlinks.sql` · Doc: `docs/P31-WIKI-BACKLINKS.md`

---

## 10aa. Notion / Obsidian export (`enable_notion_obsidian_export` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes tab | No export banner |
| Flag on | `student` | Notes tab | ZIP export banner |
| ZIP | `student` | Download ZIP vault | `.zip` with `.md` per note |
| Single | `student` | Note → ↓ MD | One `.md` file downloads |
| Copy | `student` | Note → 📋 | Markdown on clipboard |
| Front matter | `student` | Export starred tagged note | YAML includes tags/starred |
| ⌘K | `student` | "obsidian export" | ZIP download starts |

Migration: `20260533000000_notion_obsidian_export.sql` · Doc: `docs/P32-NOTION-OBSIDIAN-EXPORT.md`

---

## 10ab. Mind map ↔ tasks (`enable_mind_map_tasks` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Dashboard | No mind map banner |
| Flag on | `student` | Dashboard | Banner with branch/link counts |
| Map | `student` | Open mind map | Radial SVG modal |
| Branch | `student` | Select node → + Branch | Child node appears |
| Create | `student` | Create task | Task on dashboard + linked node |
| Link | `student` | Pick existing task | Node shows task name |
| Jump | `student` | Go to task | Dashboard scroll + highlight |
| ⌘K | `student` | "mind map" | Opens map modal |

Migration: `20260533100000_mind_map_tasks.sql` · Doc: `docs/P33-MIND-MAP-TASKS.md`

---

## 10ac. Handwriting-to-text (`enable_handwriting_to_text` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes → edit note | No ✍ Handwriting button |
| Flag on | `student` | Notes → ✍ Handwriting | File picker opens |
| OCR | `student` | Photo of writing | Edit modal with text |
| Edit | `student` | Fix typo → Insert | Paragraphs in note editor |
| Progress | `student` | Scan in progress | Percent updates |
| ⌘K | `student` | "handwriting scan" | Notes + picker |

Migration: `20260533200000_handwriting_to_text.sql` · Doc: `docs/P34-HANDWRITING-TO-TEXT.md`

---

## 10ad. Citation helper (`enable_citation_helper` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Notes tab | No citation banner |
| Flag on | `student` | Notes → ❝ Cite | Builder modal opens |
| MLA | `student` | Web source + fields | Preview updates |
| Save | `student` | Save to library | Appears in sidebar |
| Insert | `student` | Insert into note | Citation in editor |
| Export | `student` | Export bibliography | `.txt` download |
| ⌘K | `student` | "citation mla" | Opens builder |

Migration: `20260533300000_citation_helper.sql` · Doc: `docs/P35-CITATION-HELPER.md`

---

## 10ae. Calc history (`enable_calc_history` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | `student` | Toolbox → Graph + calc | No history bar |
| Flag on | `student` | Basic calc → `2+2` → `=` | Entry on tape |
| Save plot | `student` | Y= sin(x) → Save plot | Plot in library |
| Export | `student` | Tape → Export .txt | Download |
| Note | `student` | Insert tape into note | Markdown list in editor |
| PNG | `student` | Saved plot → PNG | File download |
| ⌘K | `student` | "calc history" | Modal opens |

Migration: `20260533400000_calc_history.sql` · Doc: `docs/P36-CALC-HISTORY.md`

---

## 0l. Locale UI strings (P10.2 — needs `enable_locale_foundation`)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Sync modal | Any | Locale on + conflict UI → open resolver | Buttons/labels in selected language |
| Widget picker | Any | Appearance → Español | Section labels (countdown, tasks, …) in Spanish |
| Storage repair | Any | Locale on + repair flag → Data card | Title and scan button translated |
| Rollback | Any | Disable locale flag | `fluxT` returns English |

Doc: `docs/P10-I18N-STRINGS.md`

---

## 0k. Storage repair (`enable_storage_repair` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag off | Any | Settings → Data | No Storage repair card |
| Flag on | Any | Corrupt `tasks` JSON in DevTools → Scan & repair | Toast reports repair; tasks reload (default or salvaged) |
| Auto scan | Any | Reload with flag on, corrupt key present | One session toast on first fix |
| Rollback | Owner | Disable flag | Card hidden; no auto scan |

Migration: `20260528900000_storage_repair.sql` · Doc: `docs/P10-STORAGE-REPAIR.md`

---

## 0j. Production smoke (P9.5)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| E2E IAE teacher | Harness | `npm run test:e2e` → `ia-east-pilot` | Widget grid visible on teacher dashboard |
| E2E widgets | Harness | `student-dashboard-widgets` spec | Countdown hide + Appearance toggles |
| Manual IAE | Real accounts | `docs/P9-PRODUCTION-SMOKE.md` checklist | All rows pass without `FLUX_EXPERIMENTS` |

Doc: `docs/P9-PRODUCTION-SMOKE.md` · Closeout: `docs/PHASE_9_CLOSEOUT.md`

---

## 0i. Dashboard widget picker (`enable_dashboard_widget_picker` on by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Visibility | `student` | Settings → Appearance → uncheck Exam countdown | `#countdownCard` hidden on dashboard after reload/nav. |
| Reorder | `student` | Move Tasks ↑ | Task block appears above workload strip. |
| Reset | `student` | Reset panel layouts (if exposed) or re-enable sections | Defaults restore. |
| Rollback | Owner | Disable flag in DB | Checkboxes hidden; order-only UI unchanged. |

Migration: `20260528600000_dashboard_widget_picker.sql` · Doc: `docs/P9-DASHBOARD-WIDGETS.md`

---

## 0h. Locale foundation (`enable_locale_foundation` off by default)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Flag on | Any | Settings → Appearance → Language & region → Español | Top date pill uses Spanish month names; rest days list dates localized. |
| RTL | Any | Select العربية | `<html dir="rtl">`; layout mirrors. |
| Rollback | Owner | Disable flag, reload | Dates stay en-US via `fmtFluxDate` fallback. |
| Task due chips | Any | Flag on → Español → Dashboard tasks | Due dates show localized month/day. |
| Educator panels (P9.4) | `counselor` / `admin` | Locale on + staff suite → meeting log / School dashboard greet | Timestamps and greet line use selected locale (not hardcoded en-US). |
| Locale change refresh | `teacher` | Work hub widgets open → switch locale | Widget grid re-renders with new date labels. |

Migration: `20260528500000_locale_foundation.sql` · Docs: `docs/P8-I18N.md`, `docs/P9-I18N-EDUCATOR.md`

---

## 0f. Site enhancements pack (50)

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Pack enabled | Any | Sign in; `FluxFeatureFlags.isEnabled('enable_site_enhancements_pack')` | `true` by default. |
| Shortcuts | Any | Press `?` (not in input) | Modal lists shortcuts; `Esc` closes. |
| Deep link | Any | Open `?panel=settings` while signed in | Lands on Settings after load. |
| Toggles | Any | Settings → Data → Site enhancements (50) | Uncheck item → behavior off after reload. |
| Staff CSV | `staff` | Workboard → **Export tickets CSV** | Downloads CSV when tickets exist. |
| Rollback | Owner | Disable `enable_site_enhancements_pack` in DB, reload | No breadcrumb, `?` modal, or enhancement settings card. |

See `docs/SITE_IMPROVEMENTS_50.md`. Migration: `20260527100000_site_enhancements_pack.sql`.

---

## 0d. Phase 8 — Pilot hardening & security audit

| Feature | Role | Test action | Expected result |
|---------|------|-------------|-----------------|
| Offline boot | Any | DevTools → Offline, hard refresh | `showFluxOfflineScreen()` with retry button (no blank white `#app`). |
| Staff cache wipe | `teacher` | Work → Personal (Ctrl/Cmd+K) | `flux_staff_tickets_v1` / checklist keys removed from localStorage (namespaced). |
| Sign-out wipe | Any educator | Sign out | `clearSensitiveStaffCache()` runs before redirect; staff ticket keys not restored. |
| Staff beta modal | `teacher` / `counselor` / `admin` | First sign-in after migration | One-time welcome modal; `flux_staff_beta_seen_<userId>` set on dismiss. |
| RLS insert | `staff` | Insert `staff_tickets` row | Succeeds only when `created_by = auth.uid()` and `user_roles.school` is set. |
| Admin duty logs | `admin` | Insert `admin_duty_logs` | Succeeds only when `admin_id = auth.uid()` and school matches `user_roles.school`. |

Migration: `supabase/migrations/20260525100000_final_audit.sql`

---

## 0. Feature flags (after sign-in)

- [ ] `FluxFeatureFlags.load()` completes without console error (requires migration `20260524120000_feature_flags_foundation.sql`).
- [ ] `FluxFeatureFlags.isEnabled('enable_staff_google_hub')` is true by default for staff/admin.
- [ ] Disabling `enable_staff_google_hub` in DB user override hides staff **Google** nav (work + personal) after reload.
- [ ] `FLUX_EXPERIMENTS.enable_*` in devtools overrides local flag when set.

---

## 1. Debug switches (no console spam unless enabled)

| Goal | Enable |
|------|--------|
| Master (quiet-friendly) | `localStorage.setItem('flux_debug','on')` |
| Master (legacy) | `localStorage.setItem('FLUX_DEBUG','1')` |
| Session-only | `window.FLUX_DEBUG = true` (until reload) |
| Nav start/end logs | `localStorage.setItem('FLUX_DEBUG_NAV','1')` |
| Post-`nav()` panel snapshot (`[FluxPanel]`) | `localStorage.setItem('FLUX_DEBUG_PANEL','1')` **or** master `flux_debug` |
| Role / `assertRoleAccess` | `localStorage.setItem('FLUX_DEBUG_ROLE','1')` |
| Storage namespacing / impersonation | `localStorage.setItem('FLUX_DEBUG_STORAGE','1')` |
| AI pipeline | `localStorage.setItem('FLUX_DEBUG_AI','1')` |
| Perf marks | `localStorage.setItem('FLUX_DEBUG_PERF','1')` |

Implementation: `public/js/core/debug.js` (`window.FluxDebug`).

---

## 2. Roles × surface (smoke)

| Scenario | Desktop | Mobile | Notes |
|----------|---------|--------|------|
| Student · default | — | — | Home/dashboard loads; sidebar + primary tabs switch without blanking. |
| Student · onboarding | — | — | First-run / splash path; complete or skip; lands in app with expected tab. |
| Student · Canvas connected | — | — | Canvas hub loads; course list or empty state; no JS error in console. |
| Student · Google connected | — | — | Docs / Google flows if enabled; token errors handled gracefully. |
| Teacher · work mode | — | — | Educator nav set; staff-only panels gated; `assertRoleAccess` no false deny (see §4). |
| Teacher · personal mode | — | — | Mode switch bar if applicable; student vs work panels consistent. |
| Counselor · work | — | — | Booking / messaging panels per role UI. |
| Staff / admin · work | — | — | Staff tabs + dashboards; no student-only leakage. |
| Owner · impersonation | — | — | Impersonation banner; storage keys namespaced; exit restore (see `docs/STORAGE_RAW_INVENTORY.md`). |
| Extension active | — | — | If browser extension present: no double-inject / CSP issues. |
| AI streaming | — | — | Send message; stream completes or errors with UI feedback; composer stays usable. |
| Offline → reconnect | — | — | Devtools offline; core shell usable or clear message; sync when back online. |

---

## 3. Panel / navigation (after `FLUX_DEBUG_PANEL=1` or `flux_debug=on`)

- [ ] After each `nav(tabId)`, **at most one** `.main-content > .panel.active` (watch for duplicate `.active` if `FLUX_EXPERIMENTS.routingAssertDupPanel` is toggled in devtools).
- [ ] `[FluxPanel]` log shows `panelFound: true` for valid tabs; `routed` matches expected remap for educators.
- [ ] Bottom nav: primary tab has `.bnav-item.active`; secondary routes highlight **More** (`#moreBtn`) when `data-tab` does not match a primary chip.
- [ ] `updateNavAriaCurrent` (or equivalent): `aria-current` on the active control where implemented.
- [ ] **Canvas split** (`body.flux-canvas-ai-split`): `#canvas` + `#ai` visibility matches design; no hidden panel blocking clicks.
- [ ] **Mobile:** `#canvas` / `#toolbox` use `display:flex` when active (see `styles.css` mobile LAYOUT block); other panels `display:block`.
- [ ] **Reduced motion:** `prefers-reduced-motion: reduce` — panel switch animation disabled (`panelReveal` off on `.panel.active`).

---

## 4. `assertRoleAccess` (with `FLUX_DEBUG_ROLE=1`)

- [ ] Run `FluxRoleRouting.auditMatrix()` after sign-in — review `ok` column for current role/mode.
- [ ] Open each educator-only panel from sidebar / deep link; expect **no** unexpected `assertRoleAccess denied` for the current role/mode.
- [ ] **Staff** work mode: lands on `staffWorkboard`, not `adminDashboard`; admin nav hidden.
- [ ] **Admin** work mode: `adminDashboard` + Operations; staff workboard hidden.
- [ ] **Staff** personal: Google tab visible when `enable_staff_google_hub`; staff personal panels visible.
- [ ] **Teacher** work: student Canvas tab hidden; `nav('canvas')` redirects to teacher home if forced.
- [ ] Intentional deny: student account hitting educator URL → redirect / fallback tab (`dashboard` or role home) without broken layout.

---

## 5. Storage regression (spot)

Authority: `docs/STORAGE_RAW_INVENTORY.md` + `docs/P1-STORAGE.md` + `load`/`save` / `FluxStorage`.

- [ ] Toggle a preference (theme, accent, feature flag); reload; value persists (correct namespace when not impersonating).
- [ ] Impersonate (if available): confirm writes do **not** corrupt the owner bubble (keys prefixed per inventory).
- [ ] Account switch: sign in as user B after user A — feature flags match B (no stale A cache).
- [ ] `FluxStorageKeys.auditStragglers()` — no unexpected keys (or documented).
- [ ] Optional: `FLUX_DEBUG_STORAGE=1` — console shows throttled `[FluxStorage]` lines on read/write paths.

---

## 6. Supabase / RLS

- [ ] Run `supabase/scripts/verify_rls_policies.sql` + manual matrix in `docs/P1-RLS-VERIFICATION.md`.
- [ ] Admin: `flux_rls_health_snapshot()` returns `legacy_*: false`.
- [ ] Student join preview shows teacher name without `user_roles` query errors.

## 7. Product event bus (`enable_event_bus` off by default)

- [ ] With flag off: `FluxBus.emit('task_completed', …)` works; no `flux_product_events` rows created.
- [ ] With `FLUX_EXPERIMENTS.enable_event_bus: true`: sign-in → `sign_in` row; complete task → `task_completed` row (own user only).
- [ ] `flux_record_product_events` rejects batches > 25.

## 40. Client error reporting (`enable_client_error_reporting` off by default)

- [ ] Migration applied: `enable_client_error_reporting` flag.
- [ ] Flag off: no global error hooks; `FluxErrorReporter.ring()` empty or stale only.
- [ ] Flag on: `throw new Error('test')` → `FluxErrorReporter.ring()[0]` has scrubbed message.
- [ ] With `enable_event_bus` on: `client_error` row in `flux_product_events` (no email/token in payload).
- [ ] Rate limit: 6+ errors in 1 min → only first 5 persisted per minute.

## 39. E2E harness (`enable_e2e_harness` / `?e2e=1`)

- [ ] Migration applied: `enable_e2e_harness` flag in `flux_feature_flags`.
- [ ] `npm run test:e2e` passes: student-semester, teacher-workflow, counselor-path.
- [ ] Student scenario: seeded tasks visible; calendar tab; task checkbox completes.
- [ ] Teacher scenario: teacher nav + dashboard; **New Class** opens modal.
- [ ] Counselor scenario: counselor nav + dashboard (no “record not found”).
- [ ] Normal users (no `?e2e=1`): login flow unchanged.

## 38. Accessibility suite (`enable_a11y_suite` off by default)

- [ ] Migration applied: `enable_a11y_suite` flag in `flux_feature_flags`.
- [ ] Flag off: no Accessibility suite card in Settings → Look; calm/ADHD classes not applied.
- [ ] Flag on: Settings → Look shows calm + ADHD toggles; toggles persist across reload.
- [ ] Personal calm: mesh/cursor effects hidden; saturation reduced (not school emergency calm).
- [ ] ADHD focus: smart suggestions / gap filler hidden; tap targets ≥ 44px; stronger `:focus-visible`.
- [ ] Reduce motion + font scale + high contrast still work when flag off (legacy controls).

## 37. Parent portal (`enable_parent_portal` off by default)

- [ ] Migration applied: `flux_parent_links` + invite/claim/snapshot RPCs.
- [ ] Flag off: no Family nav, no student Family sharing card.
- [ ] Student creates invite → parent claims code → Family tab shows wellness table.
- [ ] Student revokes link → parent snapshot returns forbidden.
- [ ] No task titles or grades in parent RPC payloads.

## 36. Layered AI memory (`enable_layered_memory` off by default)

- [ ] Migration applied: `flux_user_memory.layer` + `flux_reset_user_memory` RPC.
- [ ] Flag off: no AI memory card in Settings → Account.
- [ ] Flag on: Account shows layer counts + per-layer reset + reset all.
- [ ] Chat stores session turns; long-term hints after struggle/reminder phrases.
- [ ] Reset long-term clears `flux_user_memory` rows for that user (own RLS only).

## 35. Offline sync (`enable_offline_sync` off by default)

- [ ] Migration applied: `flux_sync_conflict_log` + `flux_record_sync_conflicts` RPC.
- [ ] Flag off: `syncFromCloud` overwrites tasks/notes/events (legacy).
- [ ] Flag on: DevTools offline → edit task → outbox pill shows pending; online → sync clears outbox.
- [ ] Flag on: same task edited on two devices → conflict pill + modal; **Keep mine** / **Keep cloud** resolves.
- [ ] LWW: newer `_fluxTs` wins when fingerprints differ beyond 2s skew.

## 35b. Sync conflict UI v2 (`enable_sync_conflict_ui` off by default; needs offline sync)

- [ ] Migration `20260528800000_sync_conflict_ui.sql` applied.
- [ ] Both flags on: conflict modal shows side-by-side previews + relative edit times.
- [ ] Both flags on: **Keep all mine** / **Keep all cloud** clears all conflicts.
- [ ] Both flags on: Settings → Data & info → **Sync & conflicts** card; **Review conflicts** opens modal.
- [ ] `enable_sync_conflict_ui` off, offline on: legacy two-button row modal still works.
- [ ] Rollback: disable `enable_sync_conflict_ui` only — merge/outbox unchanged.

Migration: `20260528800000_sync_conflict_ui.sql` · Doc: `docs/P9-SYNC-CONFLICT.md`

## 34. AI orchestration (`enable_ai_orchestration` off by default)

- [ ] Migration applied: `flux_ai_agent_runs` + `flux_record_agent_runs` RPC.
- [ ] Flag off: `sendAI` uses legacy `FluxOrchestrator` augment only.
- [ ] Flag on (student): “I’m tired and overwhelmed” routes to Momentum agent; thinking log shows agent label.
- [ ] Flag on (student): `/plan` still invokes planner tools when routed to Planner/Momentum.
- [ ] Flag on (teacher work mode): class question routes to Instruction agent; copilot tip when `enable_teacher_copilot` on.
- [ ] With `enable_event_bus`: `ai_agent_routed` rows contain agent ids only (no message body).

## 33. Event processors (`enable_event_bus_processors` off by default)

- [ ] Migration applied: `flux_processor_jobs` + enqueue/claim/complete RPCs.
- [ ] Flag off: `FluxBus.emit` unchanged aside from P1 persist; no processor audit ring growth.
- [ ] Flag on: complete task → `FluxEventProcessors.getAuditRing()` includes `task_completed`; `getSessionStats()` unchanged until focus session ends.
- [ ] Flag on: `session_ended` → local stats `sessions` increments; optional row in `flux_processor_jobs` (status → `done` after drain).
- [ ] `flux_enqueue_processor_jobs` rejects batches > 10; users cannot read others' jobs (RLS).

## 32. District rollup (`enable_district_rollup` off by default)

- [ ] Migration applied: `flux_districts`, `flux_district_admins`, `district_slug`, `school_slug`, RPC.
- [ ] Flag off: no district rollup section on admin dashboard.
- [ ] Flag on: admin with district sees rollup table + district totals.
- [ ] `flux_district_rollup_metrics` returns forbidden for users outside district.
- [ ] Per-school rows show role counts and active classes (aggregates only).
- [ ] `flux_district_admins` grant expands access beyond single-school admin.

## 31. School emergency / calm broadcast (`enable_school_emergency_broadcast` off by default)

- [ ] Migration applied: `flux_school_broadcast` table + admin/staff write RLS.
- [ ] Flag off: legacy emergency modal + local banner only.
- [ ] Flag on: admin modal offers Emergency, Calm mode, End broadcast.
- [ ] Emergency requires message; calm allows default copy.
- [ ] All users see banner + body `data-school-broadcast` after sign-in refresh.
- [ ] Calm mode reduces animations (CSS).
- [ ] End broadcast clears mode to normal.
- [ ] Emergency also creates `school_announcements` row; duplicate emergency banner from announcements suppressed when broadcast active.

## 36. Educator Gmail import (`enable_gmail_educator_import` off by default)

- [ ] Flag on + educator role: Gmail hub tab shows filter bar and action scoring.
- [ ] Flag on + student: legacy Gmail list (no educator UI).
- [ ] + Task creates task with `gmailMessageId`; second import shows “In Flux”.
- [ ] Due tag appears when date parsed from subject/snippet.
- [ ] Import action items bulk-imports high-score emails only.
- [ ] Filters (unread, parents, school) change Gmail query results.

## 35. Docs ↔ Ghost draft sync (`enable_docs_ghost_sync` off by default)

- [ ] Flag on: ghost scaffold cards show Docs ↔ Ghost draft bar.
- [ ] Create & link opens new Google Doc; Open linked Doc works.
- [ ] Push → Doc writes ghost text; Pull ← Doc updates `task.ghostDraft`.
- [ ] Use primary doc links Settings/hub URL to task.
- [ ] Legacy ghost block (ghost v2 off) still shows doc bar when `ghostDraft` exists.
- [ ] Integrations hub Docs tab shows per-task sync help text.
- [ ] 403 on push offers reconnect via `fluxReconnectGoogleDocs`.

## 34. Google Drive import (`enable_drive_import` off by default)

- [ ] Flag on: Integrations hub shows **Drive** tab.
- [ ] List Drive files returns Docs/Slides/PDFs; preview loads exported text.
- [ ] Generate lesson draft copies markdown to clipboard.
- [ ] Generate assignment prefills create-assignment modal (teachers).
- [ ] Open in Lesson AI prefills topic/notes when `enable_teacher_ai` on.
- [ ] + Add as Flux task creates deduped planner row with Drive link in notes.
- [ ] Lesson Hub shows Drive import shortcut (teachers, flag on).
- [ ] 403 → reconnect scopes (`fluxReconnectGoogleDrive`).

## 33. Google Classroom sync (`enable_classroom_sync` off by default)

- [ ] Flag on: Integrations hub shows **Classroom** tab.
- [ ] Flag off: no Classroom tab.
- [ ] Sync pulls active classes and coursework; status shows last sync time.
- [ ] + Flux adds task; second click shows “In Flux” (no duplicate).
- [ ] Import dated (new) bulk-imports only assignments with due dates.
- [ ] Grade column shows assigned grade or submission state when API returns it.
- [ ] 403 prompts reconnect; `fluxReconnectGoogleClassroom()` requests Classroom scopes.
- [ ] Course filter narrows assignment table.

## 32. Google Calendar two-way sync (`enable_gcal_2way` off by default)

- [ ] Flag seeded: `enable_gcal_2way`.
- [ ] Flag off: legacy calendar sync (read list + add task per event).
- [ ] Flag on: calendar panel shows week load strip, import mode, push/open toggles.
- [ ] Two-way sync imports new events (no duplicate on second sync).
- [ ] Push open tasks respects overload-aware skip on heavy days.
- [ ] Suggest lighter dates assigns due dates to low-load days in the next 7.
- [ ] `fluxGCal2WaySuggestDueDate(taskId)` works from console.
- [ ] Sign-in required; expired token shows offline badge.

## 31. School operations intelligence (`enable_school_ops` off by default)

- [ ] Migration applied: `flux_school_ops_overload_week()` RPC exists.
- [ ] Flag off: no Operations intelligence on admin School dashboard or Operations tab.
- [ ] Flag on (admin): Operations tab shows week badge, signals, 7-day bar chart.
- [ ] Flag on: School dashboard shows compact ops card (no duplicate full stats required).
- [ ] Non-admin cannot call RPC (forbidden).
- [ ] Peak day column highlighted when overload elevated/high.
- [ ] Footer states aggregates only (no individual student wellness rows).

## 30. School command center (`enable_school_command` off by default)

- [ ] Migration applied: `flux_school_command_metrics()` RPC exists.
- [ ] Flag off: admin dashboard has no Command center section (legacy stats band only).
- [ ] Flag on (admin): Command center shows community, teaching, counseling, admin groups.
- [ ] Non-admin cannot call RPC (forbidden).
- [ ] Alert styling on join requests / pending reviews when counts > 0.
- [ ] Footer states aggregates only (no individual student wellness rows).

## 29. Counselor copilot (`enable_counselor_copilot` off by default)

- [ ] Migration applied: `counselor_copilot_audit` + RLS.
- [ ] Flag off: no Copilot button, FAB, or panel.
- [ ] Flag on: panel opens; context line shows aggregate caseload stats only (no student names).
- [ ] Quick chips send a message; reply renders in panel.
- [ ] Successful exchange creates audit row with prompt/reply summaries + context_snapshot JSON.
- [ ] Copilot independent of teacher copilot flag.

## 28. Counselor consent flows (`enable_counselor_consent_flows` off by default)

- [ ] Migration applied: `counselor_consent_audit` table + RLS.
- [ ] Flag off: legacy dual-checkbox consent (when caseload flag on).
- [ ] Flag on: student sees three-tier picker + Stop all sharing.
- [ ] Wellness tier upgrade shows confirm dialog.
- [ ] Tier save writes `student_counselors` + audit row.
- [ ] Counselor dashboard shows Visibility & consent summary table.
- [ ] Caseload cards show tier badge for consented students.
- [ ] Revoke sets tier `none` and clears insights_consent.

## 27. Counselor outreach queue (`enable_counselor_risk_queue` off by default)

- [ ] Flag off: no outreach queue on counselor dashboard.
- [ ] Flag on, no consented students: empty-state copy (no errors).
- [ ] Basic consent: appointment-based priority/watch signals only.
- [ ] Wellness consent + snapshots: mood/stress/load/momentum signals appear.
- [ ] Queue sorted high → medium severity.
- [ ] Message opens student thread; Timeline opens wellness modal (wellness tier only).
- [ ] Dismiss removes row and persists locally until cleared.
- [ ] Disclaimer states signals are not diagnoses.

## 26. Counselor wellness timeline (`enable_counselor_wellness_timeline` off by default)

- [ ] Migration applied: `student_wellness_snapshots`, `consent_tier` includes `wellness`.
- [ ] Both caseload + timeline flags off: no timeline UI or snapshots written.
- [ ] Student wellness consent only with basic enabled; unchecking basic clears wellness.
- [ ] Mood check-in with wellness tier upserts row for today in `student_wellness_snapshots`.
- [ ] Counselor sees "View wellness timeline" only for wellness-tier students.
- [ ] Modal shows mood/stress/load/momentum summaries — no task titles or grades.
- [ ] Student without snapshots sees empty state in modal.
- [ ] Counselor cannot read snapshots for `basic`-only or non-consented students (RLS).

## 25. Counselor caseload (`enable_counselor_caseload` off by default)

- [ ] Migration applied: `insights_consent`, `consent_tier`, `consented_at` on `student_counselors`.
- [ ] Flag off: no caseload section on counselor dashboard; no student consent checkbox.
- [ ] Flag on, student has not consented: counselor sees assigned count only; no student names in caseload grid.
- [ ] Student opts in (Profile → My counselor): `insights_consent` true, `consent_tier` = `basic`.
- [ ] Counselor dashboard shows consented students with engagement band (appointment-derived).
- [ ] Student opts out: counselor caseload cards disappear for that student.
- [ ] Caseload card click opens message thread.
- [ ] Disclaimer visible; bands are not labeled as clinical diagnosis.

## 24. Teacher wellness (`enable_teacher_wellness` off by default)

- [ ] Flag off: no wellness opt-in or pulse card on teacher dashboard.
- [ ] Flag on, not opted in: opt-in banner only; no score until enabled.
- [ ] Opt-in: wellness card shows aggregate signals (counts) — no student names.
- [ ] Turn off wellness removes card until re-enabled.
- [ ] Score changes when review queue / due-soon counts change (aggregate inputs only).

## 23. Assignment recovery (`enable_assignment_recovery` off by default)

- [ ] Migration applied: `assignment_recovery_plans` exists with RLS.
- [ ] Flag off: no Recovery link on assignments, no dashboard banner.
- [ ] Teacher proposes plan for missing/late student → status `proposed`.
- [ ] Dashboard Review approves → student gets message; plan status `approved`.
- [ ] Student task notes include approved recovery steps after planner sync.
- [ ] Reject removes student visibility (status `rejected`).
- [ ] Plans do not auto-complete assignments for students.

## 22. Teacher copilot (`enable_teacher_copilot` off by default)

- [ ] Flag off: no Copilot button, FAB, or side panel.
- [ ] Flag on: panel opens; class dropdown lists only teacher’s active classes.
- [ ] Context line shows aggregates (enrolled, due soon, to review) — no student names in UI.
- [ ] Quick chips send a message; reply renders in panel.
- [ ] Class view opens copilot scoped to that class.
- [ ] Copilot independent of `enable_teacher_ai` (lesson generator).

## 21. Teacher lesson AI (`enable_teacher_ai` off by default)

- [ ] Flag off: no Lesson AI / Lesson plan buttons on dashboard or class view.
- [ ] Flag on: modal opens; required topic field; Generate returns markdown sections.
- [ ] Copy puts plan on clipboard; Regenerate replaces result.
- [ ] Plan is not auto-created as assignment or announcement.
- [ ] Daily AI limit errors surface in modal (same proxy as chat).
- [ ] With `enable_event_bus`: optional `lesson_ai_generated` event (no student PII in payload).

## 20. Start Class / live mode (`enable_live_class_mode` off by default)

- [ ] Flag off: no Start Class button, no resume chip, nav visible during class work.
- [ ] Flag on: class view shows **▶ Start Class**; opens full-screen overlay with timer.
- [ ] End class clears session and restores normal layout.
- [ ] Resume chip appears on teacher dashboard after starting; click reopens immersive mode.
- [ ] Session notes persist locally until End class (same class).
- [ ] Quick actions: copy code, + Assignment, Announce work without errors.
- [ ] No student PII beyond what teacher already sees in class view (agenda uses assignment aggregates).

## 19. Teacher roster v2 (`enable_teacher_roster_v2` off by default)

- [ ] Flag off: student join uses instant `flux_join_teacher_class` RPC; class Students tab is legacy layout.
- [ ] Flag on (student): join creates pending request; toast says teacher will approve; no planner sync until approved.
- [ ] Flag on (teacher): Students tab shows copy code, enrolled count, pending block with Approve/Reject.
- [ ] Approve from class roster adds student to `teacher_students` and refreshes class view.
- [ ] Roster list only shows students matching class `class_code` (no cross-class leak on client).
- [ ] Class cards show enrolled / pending meta when aggregates loaded.

## 18. Teacher assignment intel (`enable_teacher_assign_intel` off by default)

- [ ] Flag off: class assignment rows have no friction badge or Steps button.
- [ ] Flag on: new assignment insert includes `friction_score`, `friction_tier`, `scaffold_steps`.
- [ ] Flag on: assignment row shows friction badge when tier ≠ none; Steps opens scaffold modal with labels.
- [ ] Scaffold modal is read-only (no student tasks created).
- [ ] Legacy assignments without DB intel still show computed badge/steps when flag on.

## 17. Teacher class momentum (`enable_teacher_class_momentum` off by default)

- [ ] Flag off: teacher dashboard has no Class momentum section.
- [ ] Flag on (teacher account): momentum cards show enrolled count + % on track — **no student names** on cards.
- [ ] Clicking a momentum card opens the same class view as the class list.
- [ ] Class list cards show momentum meta line when aggregates exist.
- [ ] RLS: teacher only sees their own classes (existing policies).

## 16. Predict v2 (`enable_predict_v2` off by default)

- [ ] Flag off: legacy gap-fill with **Start →** only; no insights panel.
- [ ] Flag on: insights card shows when at-risk tasks or heavy week; disclaimer visible.
- [ ] Gap-fill rows use **View →** (`openEdit`), not `startDeepWork`.
- [ ] No tasks auto-created or rescheduled when panel renders.
- [ ] With `enable_event_bus`: `predict_insight_shown` rows (counts only, no task titles).

## 15. SRS v2 (`enable_srs_v2` off by default)

- [ ] Flag off: completing SRS-enabled task uses legacy 1/7/30 scheduling from due date.
- [ ] Flag on: reviews schedule from **completion** day; no duplicate sets on second complete.
- [ ] Review cards show `🔄 Review today` / overdue badges; parent shows `SRS on` before complete.
- [ ] Dashboard chip shows count when reviews are due; click scrolls to first review.
- [ ] With `enable_event_bus`: `srs_reviews_scheduled` + `srs_review_completed` rows (no task titles in payload).

## 14. Neuro dashboard (`enable_neuro_dashboard` off by default)

- [ ] Flag off: no `data-neuro-dash-mode` on body; mode chip hidden.
- [ ] Flag on: chip shows one of Recovery / Focus / Flow / Balanced.
- [ ] Simulated high load (or `enable_cognitive_ui` + stress): recovery mode hides pulse & schedule sections.
- [ ] High momentum (`enable_momentum_v2` + completions): flow mode expands task workspace styling.
- [ ] `body[data-neuro-dash-mode]` updates after mood check-in without reload.

## 13. Ghost draft v2 (`enable_ghost_draft_v2` off by default)

- [ ] Flag off: new task still calls legacy ghost inject; basic ghost block if `ghostDraft` exists.
- [ ] Flag on: project/essay/lab card shows scaffold area; loading shimmer while AI runs.
- [ ] Paste rubric → Save & generate → card shows checklist + starters; `ghostDraftMeta.rubricCriteria` > 0.
- [ ] Regenerate (↻) replaces draft without duplicate cards.
- [ ] Notes with `Rubric:` header parse criteria without paste modal.

## 12. Shutdown v2 (`enable_shutdown_v2` off by default)

- [ ] Flag off: `dailyShutdown()` opens legacy 3-stat modal (inline styles).
- [ ] Flag on: dashboard shows `🌙 Shutdown`; modal has reflect fields + tomorrow list.
- [ ] Finish shutdown: coach line appears; `flux_shutdown_v2_log_v1` gains an entry (FluxStorage).
- [ ] Second click on entry button closes modal (toggle).

## 11. Task friction (`enable_task_friction` off by default)

- [ ] Flag off: reschedule styling uses legacy `rescheduled` count only.
- [ ] Flag on: overdue task shows friction badge; inline date change increments slip count.
- [ ] 3+ slips triggers break-down intervention (once per task).
- [ ] `data-friction-tier` present on card when tier ≠ none.

## 10. Cognitive v2 (`enable_cognitive_ui` off by default)

- [ ] Flag off: `updateCognitiveLoadMeter` sets only `data-recovery` (no meter, no `data-cognitive-level`).
- [ ] Flag on: topbar meter visible; levels calm → balanced → elevated → overload change CSS tokens.
- [ ] Score ≥ 85: recovery banner + `recovery-hidden` tasks; Quick Wins CTA works.
- [ ] Mood check-in with high stress raises score (v2 boost).

## 9. Momentum v2 (`enable_momentum_v2` off by default)

- [ ] Flag off: legacy `momentumPill` streak (`N×`) behavior unchanged.
- [ ] Flag on: pill shows composite score + 4 domain bars; `data-zone` follows composite.
- [ ] Complete task + mood check-in + focus session — domains update without console errors.
- [ ] Achievements `streak_3` / `streak_7` still use legacy `_momentum` count.

## 8. Telemetry schema (v1)

- [ ] `FluxTelemetry.audit()` lists 10 persisted events + categories.
- [ ] `FluxTelemetry.normalize('task_completed', { id: 1, name: 'Secret' })` — payload has **no** `name` key.
- [ ] Toggle work/personal as educator → `role_mode_changed` row when bus enabled.
- [ ] Payloads include `schema_version: 1` (see `docs/TELEMETRY_SCHEMA.md`).
- [ ] After applying **`supabase/migrations/20260519120000_user_roles_select_tighten.sql`**, re-run §8 checklist in that doc (especially admin user list + join-class preview with `school` set on `user_roles`).
- [ ] Smoke: sign-in, fetch profile, write allowed row, confirm denied row returns policy error (not silent empty).

---

## 7. CSS / layout quick pass

- [ ] **Z-index:** modals, command palette, login screen, mobile “More” sheet stack correctly (no hidden blocking layer).
- [ ] **Panels:** no double `panelIn` / `panelReveal` glitches; tab switch feels like a single animation.
- [ ] **Safe areas:** iOS notch / home indicator — topbar and bottom nav clear content (`flux-mobile-app.css`, `login.css`).

---

## 8. Browsers (minimum bar)

| Browser | Desktop | Mobile / narrow |
|---------|---------|------------------|
| Chrome | — | — |
| Safari | — | — |
| Firefox | — | — (optional if not primary) |

---

## 9. Release gate (short)

1. Clear `localStorage` test profile OR use dedicated test account.  
2. Run §3 with debug on once.  
3. Run §2 row for **your** ship persona (student + educator if shipping both).  
4. §6 if backend changed.  
5. Update this file: date, tester, git SHA in a one-line footer when recording a formal sign-off.

---

**Last expanded:** 2026-05-17 (Phase 15 v1 — post stabilization Phase 4).
