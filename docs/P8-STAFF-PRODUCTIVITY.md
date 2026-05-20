# P8 — Staff Productivity Suite (Human-Centered OS)

**Migration:** `supabase/migrations/20260528100000_staff_productivity_suite.sql`  
**Master flag:** `enable_staff_productivity_suite` (default **off**)

## Architecture

| Layer | Module | Storage | Notes |
|-------|--------|---------|-------|
| Loader | `FluxModuleLoader` | `localStorage` layout | Widget grid, catalog, flags |
| Classroom | `FluxClassroomTools` | Local + `staff_student_accommodations`, `staff_parent_contact_logs` | Work only |
| Counselor | `FluxCaseloadEngine` | `staff_counselor_private_notes` | RLS: counselor owner only |
| Personal | `FluxPersonalHub` | **localStorage only** | Never in school DB |
| Command | `FluxStaffCommand` | — | Extends search when `enable_staff_command_v2` |

## Enable in dev

```javascript
window.FLUX_EXPERIMENTS = {
  enable_staff_productivity_suite: true,
  enable_classroom_tools: true,
  enable_caseload_engine: true,
  enable_personal_hub: true,
  enable_school_ops: true,
  enable_staff_command_v2: true,
  enable_gmail_educator_import: true,
};
```

Reload, sign in as educator, open **Work** mode → Teacher Overview / Counselor Overview / Workboard.  
**Personal** mode → Dashboard shows Personal Hub widgets.

### IA East pilot (production)

Migration `20260528300000_ia_east_staff_pilot.sql` enables the suite for `user_roles.school = International Academy East` via `flux_school_feature_flags`.  
Rollback: delete those school override rows or set `enabled = false`. Gmail import remains off unless you also enable `enable_gmail_educator_import` per school.

## Human-Centered feature catalog (50)

| # | Feature | Module ID | Status |
|---|---------|-----------|--------|
| **I. Classroom** |
| 1 | Quick-Grade buckets | `classroom_quick_grade` | beta |
| 2 | Random student picker | `classroom_student_picker` | beta |
| 3 | Accommodation cheat-sheet | `classroom_accommodations` | beta |
| 4 | Automated parent log | `classroom_parent_log` | beta |
| 5 | Digital hall pass | `classroom_hall_pass` | beta |
| 6 | Exit ticket generator | `classroom_exit_ticket` | beta |
| 7 | Classroom timer | `classroom_timer` | beta |
| 8 | Lesson planner + Drive/Canvas | — | planned (Lesson Hub) |
| 9 | Attendance heatmap | — | planned |
| 10 | Oops broadcast | `classroom_oops_broadcast` | beta (urgent `teacher_announcements` → student dashboard banner) |
| **II. Admin** |
| 11 | Duty roster alerts | `admin_duty_alerts` | beta (local roster + publish `admin_duty_logs`) |
| 12 | Sub-coverage swap | `admin_sub_swap` | beta (swap covers, syncs with Operations tab) |
| 13–20 | Rooms, directory skills, maintenance, budget, inventory, drills, meeting timer, PD log | various | planned / partial (`FluxSchoolOps`, `renderAdminOps`) |
| **III. Counseling** |
| 21 | Caseload dashboard | `counselor_caseload` | live (flag `enable_counselor_caseload`) |
| 22 | Wellness check-in | `counselor_wellness_queue` + student Profile card | beta (`student_counselor_checkins`) |
| 23 | Private meeting log | `counselor_meeting_log` | beta |
| 24 | Crisis protocol cheat-sheet | `counselor_crisis_sheet` | beta (static steps) |
| 25 | Referral tracker | `counselor_referrals` | beta (`counselor_referrals`) |
| 26–30 | Appointments, college deadlines, achievements, parent directory, group messaging | mixed | appointments **live** |
| **IV. Personal (local only)** |
| 31–40 | Commute, grocery, deep work, meals, fitness, expenses, vacation, family sync, brain dump, mood | `personal_*` | brain dump / grocery / mood **beta** |
| **V. System** |
| 41 | Staff command palette v2 | `sys_command_v2` | beta (⌘K role shortcuts + module jumps) |
| 42 | Gmail → task quick import | `sys_gmail_quick` | beta (needs `enable_gmail_educator_import`) |
| 43–50 | Themes, OCR, multi-account, offline, voice, shortcuts, widgets, CSV export | `sys_*` | export **beta** |

## Tables (school scope, RLS)

- `staff_student_accommodations` — need-to-know IEP/504 lines; teachers with roster link or counselors/admins same school.
- `staff_counselor_private_notes` — counselor-only narrative (`encryption_version` for future client crypto).
- `staff_parent_contact_logs` — educator-owned contact events.
- `student_counselor_checkins` — student → assigned counselor flags (P8.5); see `20260528200000_counselor_support_tools.sql`.
- `counselor_referrals` — counselor-owned referral status; school admin read same school.

## Rollback

1. Set `enable_staff_productivity_suite` false (and child flags) in `flux_feature_flags`.
2. Widget grids hide; local personal data remains in browser only.
3. Migration tables can stay (no breaking change).

See `docs/RLS_AUDIT.md` (staff productivity section) and `docs/QA_MATRIX.md` §0g.
