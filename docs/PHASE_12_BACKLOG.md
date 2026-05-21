# Phase 12 — Product backlog (100 ideas)

Curated from owner `FLUX_PRODUCT_IDEAS` in `public/js/owner-suite.js`.  
**Status:** Done · Partial · Roadmap

Execution order follows student-core protection, flags, and dependencies. See `docs/ROADMAP.md` Phase 12 steps.

---

## Epic A — Capture & quick add (1, 19, 47, 67)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Voice NL task capture (date, subject, duration) | **Done** | P12.3 `enable_voice_task_capture` |
| 19 | Screenshot snip → task | Done | P14.2 `enable_screenshot_snip` |
| 47 | CS snippet library (local) | Done | P24.1 `enable_cs_snippet_library` |
| 67 | Shortcuts / URL schemes | Partial | `?quick=task`, P12.1 deep links |

## Epic B — Calendar & sync (2, 5, 6, 61–63)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 2 | Two-way GCal + busy overlays | **Done** | P6 + P12.4 `enable_gcal_busy_overlay` |
| 5 | iCal subscribe export | Done | P21.1 `enable_ical_subscribe` |
| 6 | ICS timetable import | Done | P22.1 `enable_ics_timetable_import` |
| 61 | Buffer time around imported events | Done | P14.3 `enable_event_buffer` |
| 62 | Travel time between events | Done | P14.4 `enable_travel_time` |
| 63 | Geofence reminders | Done | P15.3 `enable_geofence_reminders` |

## Epic C — Tasks & planning (3, 56–60)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 3 | Recurring + exceptions (skip, shift, end-after-N) | **Done** | P12.5 `enable_recurring_exceptions` |
| 56 | Task template marketplace | Done | P17.1 `enable_task_template_marketplace` |
| 57 | Syllabus week auto-scaffold | Done | P16.2 `enable_syllabus_week_scaffold` |
| 58 | Exam countdown + daily minutes | Done | P16.1 `enable_exam_prep_plan` |
| 59 | Adaptive plan on sick/lazy day | Done | P15.2 `enable_rest_day_plan` |
| 60 | Energy-based scheduling | Done | P15.1 `enable_energy_scheduling` |

## Epic D — Collaboration & sharing (4, 28–32)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 4 | Study-group read-only boards + comments | Roadmap | RLS + spaces |
| 28 | Collaborative flashcards (CRDT) | Roadmap | |
| 29 | Peer study matching | Roadmap | |
| 30 | Public portfolio week view | Roadmap | |
| 31 | TZ-aware study groups | Roadmap | |
| 32 | Focus score heuristic | Done | P18.1 `enable_focus_score` |

## Epic E — Deep links & mobile (10, 65–67)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 10 | Deep links `?task=` `?note=` `?focus=` | **Done** | P12.1 `enable_deep_links` |
| 65 | Home screen widget | Roadmap | |
| 66 | Lock screen live activity | Roadmap | |
| 67 | Automations hooks | Done | P20.1 `enable_automation_hooks` |

## Epic F — Offline & platform (7, 95–99)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 7 | Offline queue visual | **Done** | P12.2 `enable_sync_queue_ui` |
| 95 | Bug report auto-capture | Partial | P8 client errors |
| 96 | Feature flag cohort rollouts | Partial | `flux_feature_flags` |
| 97 | Performance budgets CI | Roadmap | |
| 98 | Synthetic monitoring | Roadmap | P8 health |
| 99 | Owner kill-switch banner | Partial | Owner suite maintenance |

## Epic G — Personalization (8, 33)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 8 | Subject color themes + JSON export | Done | P12.6 theme packs |
| 33 | Ambient dashboard (weather) | Done | P14.5 `enable_ambient_weather` |

## Epic H — Command & search (9, 53–55)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 9 | Command palette every surface | Done | P12.7 fuzzy + recents |
| 53 | Full-text search keyboard nav | Done | P13.1 `enable_global_search_v2` |
| 54 | Saved searches / smart lists | Done | P13.2 `enable_smart_lists` |
| 55 | Bulk edit by filter | Done | P13.3 `enable_bulk_filter` |

## Epic I — Habits, mood, focus (11–12, 20–22, 32)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 11 | Habit chain heatmaps | Done | P13.5 `enable_habit_heatmap` |
| 12 | Mood + velocity + privacy | Done | P14.1 `enable_mood_velocity` |
| 20 | Pomodoro presets per subject | Done | P13.6 `enable_pomodoro_subject_presets` |
| 21 | Focus intent note | Done | P13.4 `enable_focus_intent` |
| 22 | Meeting / distraction collapse mode | Done | P13.7 `enable_meeting_mode` |

## Epic J — Notes & learning (13–18, 49–52, 64–66)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 13 | SRS deck mode `#review` SM-2 | Done | P28.1 `enable_srs_deck_mode` |
| 14 | Flashcard generator from notes | Done | P27.1 `enable_flashcard_generator` |
| 15 | Equation OCR → LaTeX | Done | P30.1 `enable_equation_ocr_latex` |
| 16 | Canvas LMS embed | Partial | Canvas panel |
| 17 | Schoology / Blackboard connector | Roadmap | Enterprise |
| 18 | Email-to-task inbox | Done | P19.1 `enable_email_task_inbox` |
| 49 | LaTeX live preview | Done | P29.1 `enable_latex_live_preview` |
| 50 | Handwriting-to-text | Done | P34.1 `enable_handwriting_to_text` |
| 51 | Mind map ↔ tasks | Done | P33.1 `enable_mind_map_tasks` |
| 52 | Wiki backlinks + graph | Done | P31.1 `enable_wiki_backlinks` |
| 64 | Citation helper | Done | P35.1 `enable_citation_helper` |
| 65–66 | Widgets / live activity | Roadmap | |

## Epic K — STEM toolbox (37–46)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 37–38 | Calc history / graphing library | Done | P36.1 `enable_calc_history` |
| 39 | Unit converter favorites | Done | P25.1 `enable_unit_converter_favorites` |
| 40 | Periodic table SRS quizzes | Done | P26.1 `enable_periodic_srs_quiz` |
| 41–46 | Org chem, conjugation, timeline, map, music, art | Partial | Ref tools in toolbox |

## Epic L — School & enterprise (23–27, 70–74, 91–94)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 23 | Parent weekly digest email | Roadmap | Parent portal partial |
| 24 | Teacher roster + assignment push | Partial | P3 teacher dash |
| 25 | GPA what-if | Done | Grades calculator |
| 26 | Rubric checklist importer | Roadmap | Ghost draft partial |
| 27 | Citation graph + export | Roadmap | |
| 70–74 | FERPA, clubs, volunteer, sports | Partial | P23.1 sport practice pack (#102) |
| 91–94 | Billing, SAML, devices, passkeys | Roadmap | |

## Epic M — Wellness & a11y (75–85)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 75–77 | Nutrition, sleep, break coach | Roadmap | |
| 78–85 | Dyslexia mode, SR audit, WCAG, RTL, keyboard, print | Partial | P7-A11y, P8 i18n, print CSS |

## Epic N — Integrations & export (86–90, 100)

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 86 | Notion / Obsidian export | Done | P32.1 `enable_notion_obsidian_export` |
| 87–90 | Zapier, Slack, Teams, Linear | Roadmap | |
| 100 | AI model rollout + cost caps | Partial | P7 AI orch |

---

## Phase 12 shipped / in flight

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 12.1 | `P12-DEEP-LINKS` | 10 | Done |
| 12.2 | `P12-SYNC-QUEUE` | 7 | Done |
| 12.3 | `P12-VOICE-CAPTURE` | 1 | Done |
| 12.4 | `P12-GCAL-BUSY` | 2 | Done |
| 12.5 | `P12-RECUR-EXCEPTIONS` | 3 | Done |
| 12.6 | `P12-THEME-PACKS` | 8 | Done |
| 12.7 | `P12-CMD-PALETTE-V2` | 9 | Done |

Migration: `20260529200000_phase_12_deep_links_sync_queue.sql`

## Phase 13

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 13.1 | `P13-GLOBAL-SEARCH-V2` | 53 | Done |
| 13.2 | `P13-SMART-LISTS` | 54 | Done |
| 13.3 | `P13-BULK-FILTER` | 55 | Done |
| 13.4 | `P13-FOCUS-INTENT` | 21 | Done |
| 13.5 | `P13-HABIT-HEATMAP` | 11 | Done |
| 13.6 | `P13-POMODORO-PRESETS` | 20 | Done |
| 13.7 | `P13-MEETING-MODE` | 22 | Done |

## Phase 14

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 14.1 | `P14-MOOD-VELOCITY` | 12 | Done |
| 14.2 | `P14-SCREENSHOT-SNIP` | 19 | Done |
| 14.3 | `P14-EVENT-BUFFER` | 61 | Done |
| 14.4 | `P14-TRAVEL-TIME` | 62 | Done |
| 14.5 | `P14-AMBIENT-WEATHER` | 33 | Done |

## Phase 15

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 15.1 | `P15-ENERGY-SCHEDULING` | 60 | Done |
| 15.2 | `P15-REST-DAY-PLAN` | 59 | Done |
| 15.3 | `P15-GEOFENCE` | 63 | Done |

## Phase 16

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 16.1 | `P16-EXAM-PREP-PLAN` | 58 | Done |
| 16.2 | `P16-SYLLABUS-WEEK-SCAFFOLD` | 57 | Done |

## Phase 17

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 17.1 | `P17-TASK-TEMPLATE-MARKETPLACE` | 56 | Done |

## Phase 18

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 18.1 | `P18-FOCUS-SCORE` | 32 | Done |

## Phase 19

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 19.1 | `P19-EMAIL-TASK-INBOX` | 18 | Done |

## Phase 20

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 20.1 | `P20-AUTOMATION-HOOKS` | 67 | Done |

## Phase 21

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 21.1 | `P21-ICAL-SUBSCRIBE` | 5 | Done |

## Phase 22

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 22.1 | `P22-ICS-TIMETABLE-IMPORT` | 6 | Done |

## Phase 23

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 23.1 | `P23-SPORT-PRACTICE-PACK` | 102 | Done |

## Phase 24

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 24.1 | `P24-CS-SNIPPET-LIBRARY` | 47 | Done |

## Phase 25

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 25.1 | `P25-UNIT-CONVERTER-FAVORITES` | 39 | Done |

## Phase 26

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 26.1 | `P26-PERIODIC-SRS-QUIZ` | 40 | Done |

## Phase 27

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 27.1 | `P27-FLASHCARD-GENERATOR` | 14 | Done |

## Phase 28

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 28.1 | `P28-SRS-DECK-MODE` | 13 | Done |

## Phase 29

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 29.1 | `P29-LATEX-LIVE-PREVIEW` | 49 | Done |

## Phase 30

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 30.1 | `P30-EQUATION-OCR-LATEX` | 15 | Done |

## Phase 31

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 31.1 | `P31-WIKI-BACKLINKS` | 52 | Done |

## Phase 32

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 32.1 | `P32-NOTION-OBSIDIAN-EXPORT` | 86 | Done |

## Phase 33

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 33.1 | `P33-MIND-MAP-TASKS` | 51 | Done |

## Phase 34

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 34.1 | `P34-HANDWRITING-TO-TEXT` | 50 | Done |

## Phase 35

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 35.1 | `P35-CITATION-HELPER` | 64 | Done |

## Phase 36

| Step | ID | Item # | Status |
|------|-----|--------|--------|
| 36.1 | `P36-CALC-HISTORY` | 37–38 | Done |
