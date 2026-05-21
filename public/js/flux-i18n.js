/**
 * FluxI18n — locale + Intl date/time formatting foundation.
 * Flag: enable_locale_foundation (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_locale_foundation';
  const LOCALE_KEY = 'flux_locale_v1';

  const LOCALES = [
    { id: 'en-US', label: 'English (US)' },
    { id: 'es-US', label: 'Español (US)' },
    { id: 'fr-FR', label: 'Français' },
    { id: 'ar-SA', label: 'العربية' },
  ];

  const UI_STRINGS = {
    'settings.locale_title': 'Language & region',
    'settings.locale_hint': 'Dates and times use your locale. More UI translation coming later.',
    'date.today': 'Today',
    'date.tomorrow': 'Tomorrow',
    'sync.title': 'Sync conflicts',
    'sync.lede_legacy': 'Same item changed on two devices. Pick a version.',
    'sync.lede_v2': 'The same item was edited here and in the cloud. Compare previews, then pick which copy to keep.',
    'sync.keep_mine': 'Keep mine',
    'sync.keep_cloud': 'Keep cloud',
    'sync.keep_all_mine': 'Keep all mine ({n})',
    'sync.keep_all_cloud': 'Keep all cloud ({n})',
    'sync.no_conflicts': 'No sync conflicts',
    'sync.close': 'Close',
    'sync.this_device': 'This device',
    'sync.cloud': 'Cloud',
    'sync.compare': 'Compare versions',
    'sync.resolve': 'Resolve',
    'sync.conflicts_pill': '{n} conflict(s)',
    'sync.pending_pill': '{n} pending',
    'sync.pill_title': 'Sync conflicts',
    'sync.pill_title_v2': 'Sync conflicts — tap to compare versions',
    'sync.outbox_title': 'Pending offline changes',
    'sync.banner': '{n} sync conflict(s) —',
    'sync.settings_title': 'Sync & conflicts',
    'sync.settings_body': 'Offline-aware merge is on for tasks, notes, and calendar events.',
    'sync.settings_body_v2': ' When versions differ, you get side-by-side previews before choosing.',
    'sync.stat_conflicts': '{n} conflict(s)',
    'sync.stat_pending': '{n} pending change(s)',
    'sync.review': 'Review conflicts',
    'sync.flush': 'Sync pending now',
    'sync.syncing': 'Syncing…',
    'sync.toast_new': '{n} sync conflict(s) — open Settings → Data or tap the pill',
    'sync.queue_title': 'Pending sync queue',
    'sync.queue_lede': 'Changes waiting to upload when you are back online.',
    'sync.queue_empty': 'Nothing waiting — you are fully synced.',
    'sync.queue_pending': 'Pending upload',
    'sync.queue_offline': 'Waiting for network',
    'sync.queue_retry': 'Retry needed',
    'sync.queue_retry_all': 'Retry all',
    'sync.queue_dismiss': 'Close',
    'sync.queue_open': 'View pending queue',
    'deeplink.copied': 'Link copied',
    'deeplink.copy_failed': 'Could not copy link',
    'deeplink.task_missing': 'Task not found on this device',
    'deeplink.note_missing': 'Note not found on this device',
    'deeplink.cmd_task': 'Copy link to open task',
    'deeplink.cmd_note': 'Copy link to open note',
    'deeplink.share_task': 'Copy task link',
    'deeplink.share_note': 'Copy note link',
    'voice.start': 'Start voice input',
    'voice.stop': 'Stop listening',
    'voice.listening': 'Listening…',
    'voice.heard': 'Heard: {text}',
    'voice.ready': 'Voice captured — review preview, then Enter to add',
    'voice.unsupported': 'Voice input is not supported in this browser',
    'voice.error': 'Voice input failed — try again',
    'voice.no_speech': 'No speech detected',
    'voice.cmd': 'Voice task capture',
    'gcal.busy_title': 'Google Calendar',
    'gcal.all_day': 'All day',
    'gcal.busy_untitled': 'Busy',
    'gcal.cal_marker': 'Google Calendar events this day',
    'gcal.banner_title': 'Calendar conflicts',
    'gcal.conflict_busy': '{date}: {events} Google events + {tasks} due tasks',
    'gcal.conflict_overlap': '{date}: "{task}" overlaps "{event}"',
    'gcal.conflict_allday': '{date}: all-day event + {tasks} due tasks',
    'gcal.more': '+{n} more calendar conflicts',
    'recur.weekly': 'Weekly',
    'recur.biweekly': 'Biweekly',
    'recur.monthly': 'Monthly',
    'recur.repeat': 'Repeat',
    'recur.legacy_weekly': 'Repeats weekly when completed',
    'recur.chip_title': 'Recurring series — tap 🔁 for options',
    'recur.end_chip': 'ends after {n}',
    'recur.menu_title': 'Repeat series',
    'recur.menu_skip': 'Complete without next occurrence',
    'recur.menu_skip_next': 'Skip next scheduled date',
    'recur.menu_shift': 'Shift series +7 days',
    'recur.menu_set_end': 'Set end-after count…',
    'recur.menu_end': 'End after {n} (edit…)',
    'recur.prompt_end': 'End series after how many completions? (blank = no limit)',
    'recur.skipped_toast': 'Completed — repeat skipped',
    'recur.ended_toast': 'Series ended after {n} occurrences',
    'recur.spawned_toast': '{label} · next due {date}',
    'recur.shift_toast': 'Series shifted {n} days',
    'recur.end_after_toast': 'Series ends after {n} completions',
    'recur.end_cleared': 'Series end limit cleared',
    'recur.skip_next_toast': 'Skipping occurrence on {date}',
    'recur.no_series': 'No series linked to this task',
    'theme.title': 'Subject theme packs',
    'theme.lede': 'Apply color and icon presets per class, or export and share a JSON pack with classmates.',
    'theme.preset': 'Preset pack',
    'theme.apply': 'Apply preset',
    'theme.export': 'Export JSON',
    'theme.import': 'Import JSON',
    'theme.export_default': 'My subject themes',
    'theme.exported': 'Theme pack downloaded',
    'theme.imported': 'Imported pack',
    'theme.applied': 'Applied {name}',
    'theme.import_ok': 'Updated {n} class(es) from pack',
    'theme.no_match': 'No classes matched the import file',
    'theme.invalid': 'Invalid theme pack file',
    'theme.version': 'Unsupported pack version',
    'theme.empty': 'Pack has no classes',
    'theme.parse_error': 'Could not read JSON file',
    'theme.no_classes': 'Add classes in School to preview swatches',
    'theme.active_none': 'Using class colors from School (no pack active)',
    'theme.active_preset': 'Active preset: {name}',
    'theme.active_custom': 'Active import: {name}',
    'search.recents': 'Recent searches',
    'search.hint': 'Search tasks, notes, and classes — fuzzy matching enabled',
    'search.no_results': 'No results',
    'search.kbd_hint': '↑↓ choose · Enter open · Esc close',
    'smart.toolbar': 'Smart lists',
    'smart.palette': 'Smart list: {name}',
    'smart.empty': 'No tasks in this smart list',
    'bulk.btn': 'Bulk edit filter',
    'bulk.btn_title': 'Select all tasks in {label} ({n})',
    'bulk.filter': 'Current filter',
    'bulk.filter_active': 'Active',
    'bulk.filter_all': 'All',
    'bulk.filter_today': 'Due today',
    'bulk.filter_overdue': 'Overdue',
    'bulk.filter_high': 'High priority',
    'bulk.filter_done': 'Done',
    'bulk.hint': '{label} · {n} visible',
    'bulk.select_filtered': 'Select filtered',
    'bulk.none': 'No tasks in this filter',
    'bulk.started': 'Selected {n} in {label}',
    'bulk.nothing_selected': 'Nothing selected',
    'bulk.priority_prompt': 'Priority for selected tasks (high, med, low):',
    'bulk.priority_invalid': 'Use high, med, or low',
    'bulk.priority_done': 'Priority set to {p}',
    'bulk.estimate_prompt': 'Time estimate in minutes for selected tasks:',
    'bulk.estimate_invalid': 'Enter a valid number of minutes',
    'bulk.estimate_done': 'Estimate set to {n} min',
    'bulk.palette': 'Bulk edit filtered tasks',
    'bulk.palette_sub': '{n} tasks in current filter',
    'intent.title': 'Focus intent',
    'intent.label': 'What will you accomplish this session?',
    'intent.placeholder': 'e.g. Finish problem set 4, no phone',
    'intent.kicker_deep': 'Deep work',
    'intent.kicker_timer': 'Focus timer',
    'intent.recents': 'Recent intents',
    'intent.no_recent': 'Your recent intents will appear here',
    'intent.cancel': 'Cancel',
    'intent.skip': 'Skip',
    'intent.start': 'Start focus',
    'intent.palette': 'Start deep work with intent',
    'habit.title': 'Habit chains',
    'habit.lede': 'Daily check-offs build streaks — separate from one-off tasks.',
    'habit.placeholder': 'New habit (e.g. Read 20 min)',
    'habit.add': 'Add habit',
    'habit.empty': 'Add a habit to start your chain.',
    'habit.untitled': 'Habit',
    'habit.toggle': 'Toggle today',
    'habit.remove': 'Remove habit',
    'habit.streak': '🔥 {n} day streak · best {best}',
    'habit.name_required': 'Enter a habit name',
    'habit.added': 'Added {name}',
    'habit.logged': 'Logged {name} for today',
    'habit.chain': '{n}-day chain — keep it going!',
    'habit.removed': 'Habit removed',
    'pomo.title': 'Subject presets',
    'pomo.lede': 'Save work and short-break minutes per class — synced across devices.',
    'pomo.save': 'Save preset',
    'pomo.none': 'No subject presets yet',
    'pomo.no_subject': 'No subject',
    'pomo.pick_subject': 'Choose a subject tag first',
    'pomo.saved': 'Saved {work}m focus for {name}',
    'pomo.applied': '{name}: {work} min focus',
    'pomo.removed': 'Preset removed',
    'pomo.remove': 'Remove preset',
    'pomo.active_saved': 'Active preset · {work}m work / {short}m break',
    'pomo.active_unsaved': 'No preset saved for this subject yet',
    'meeting.title': 'Meeting mode',
    'meeting.lede': 'Collapse distractions, show a banner timer, and copy a status message for chat apps.',
    'meeting.label': 'Meeting label',
    'meeting.label_ph': 'e.g. AP Bio class',
    'meeting.duration': 'Duration',
    'meeting.min': 'min',
    'meeting.start': 'Start meeting mode',
    'meeting.exit': 'Exit',
    'meeting.copy_reply': 'Copy auto-reply',
    'meeting.default_label': 'In a meeting',
    'meeting.auto_reply': 'In "{subject}" until {time}. I\'ll reply when I\'m back.',
    'meeting.copied': 'Auto-reply copied to clipboard',
    'meeting.started': 'Meeting mode · {n} min',
    'meeting.ended': 'Meeting mode ended',
    'meeting.done': 'Meeting block complete',
    'meeting.palette': 'Start meeting mode',
    'mv.title': 'Mood & velocity',
    'mv.lede': 'Quick-log how you feel and see how it lines up with tasks you finish.',
    'mv.mood': 'Mood',
    'mv.energy': 'Energy',
    'mv.save': 'Save quick log',
    'mv.privacy': 'Keep mood logs private (skip counselor wellness snapshots and cloud quick-log sync)',
    'mv.private_on': 'Mood logs kept private on this device',
    'mv.private_off': 'Mood quick logs may sync when signed in',
    'mv.pick_both': 'Pick both mood and energy',
    'mv.saved': 'Quick log saved',
    'mv.tasks': 'tasks',
    'mv.chart_aria': '14-day task completion and mood chart',
    'mv.legend_done': 'Tasks done',
    'mv.legend_mood': 'Mood dot',
    'mv.total': '{n} tasks completed in the last 14 days',
    'mv.insight_need_data': 'Complete a few tasks and check-ins to see patterns.',
    'mv.insight_positive': 'You tend to finish more tasks on days you feel good — nice momentum.',
    'mv.insight_rest': 'Lower mood days show fewer completions — consider lighter plans those days.',
    'mv.insight_neutral': 'Your completion pace looks steady across moods.',
    'mv.palette': 'Mood velocity check-in',
    'mv.palette_sub': 'Quick mood + energy log',
    'snip.btn_title': 'Paste screenshot from clipboard',
    'snip.cmd': 'Screenshot snip → task',
    'snip.reading': 'Reading screenshot…',
    'snip.reading_clipboard': 'Reading clipboard…',
    'snip.progress': 'Extracting text… {pct}%',
    'snip.done': 'Text extracted — review and add',
    'snip.ready': 'OCR text ready in quick-add',
    'snip.no_text': 'No readable text found — type a task name',
    'snip.no_image': 'No image on clipboard — copy a screenshot first',
    'snip.paste_hint': 'Copy a screenshot, then paste here or tap ✂️',
    'snip.permission': 'Allow clipboard access or paste with ⌘V',
    'snip.failed': 'Could not read screenshot',
    'snip.ocr_failed': 'OCR engine failed to load',
    'snip.text_from_clipboard': 'Used text from clipboard',
    'snip.preview_ok': '{n} words detected — edit before adding',
    'snip.preview_empty': 'Image captured — add a task title manually',
    'buffer.title': 'Event buffer time',
    'buffer.lede': 'Add padding before and after imported events (Google Calendar, one-off events, weekly activities). Tasks scheduled in buffer zones show a warning.',
    'buffer.before': 'Minutes before',
    'buffer.after': 'Minutes after',
    'buffer.save': 'Save buffer settings',
    'buffer.saved': 'Buffer settings saved',
    'buffer.day_title': 'Buffer zones',
    'buffer.pad_line': '−{before}m ({beforeRange}) · +{after}m ({afterRange})',
    'buffer.banner_title': 'Tasks in buffer zones',
    'buffer.conflict': '{date}: "{task}" sits in buffer before/after "{event}" ({when})',
    'buffer.more': '+{n} more buffer conflicts',
    'buffer.palette': 'Event buffer settings',
    'buffer.untitled_event': 'Event',
    'buffer.weekly': 'Weekly activity',
    'travel.title': 'Travel time between events',
    'travel.lede': 'Warn when back-to-back events leave less time than you need to get from one to the next.',
    'travel.minutes': 'Minimum travel minutes',
    'travel.save': 'Save travel setting',
    'travel.saved': 'Travel time setting saved',
    'travel.day_title': 'Tight travel gaps',
    'travel.banner_title': 'Not enough travel time',
    'travel.gap': '{date}: only {gap}m between "{from}" (ends {fromEnd}) and "{to}" (starts {toStart}) — need {need}m',
    'travel.more': '+{n} more travel gaps',
    'travel.palette': 'Travel time settings',
    'travel.untitled': 'Event',
    'travel.weekly': 'Weekly activity',
    'weather.aria': 'Local weather and study hint',
    'weather.default_loc': 'Default area',
    'weather.my_location': 'My location',
    'weather.custom_loc': 'Custom coordinates',
    'weather.clear': 'Clear',
    'weather.mainly_clear': 'Mainly clear',
    'weather.partly_cloudy': 'Partly cloudy',
    'weather.overcast': 'Overcast',
    'weather.fog': 'Fog',
    'weather.drizzle': 'Drizzle',
    'weather.rain': 'Rain',
    'weather.snow': 'Snow',
    'weather.showers': 'Showers',
    'weather.storm': 'Thunderstorm',
    'weather.unknown': 'Weather',
    'weather.sunset': 'Sunset {time}',
    'weather.sunset_unknown': 'Sunset time loading…',
    'weather.refresh': 'Refresh',
    'weather.use_geo': 'Use my location',
    'weather.edit_loc': 'Edit coordinates',
    'weather.save_loc': 'Save',
    'weather.loc_saved': 'Location updated',
    'weather.invalid_loc': 'Enter valid latitude and longitude',
    'weather.no_geo': 'Geolocation not supported in this browser',
    'weather.geo_denied': 'Location permission denied',
    'weather.fetch_failed': 'Could not load weather',
    'weather.hint_loading': 'Loading outdoor study hint…',
    'weather.hint_rain': 'Rain expected — indoor focus may work better.',
    'weather.hint_temp': 'Temperature is extreme — plan indoor study.',
    'weather.hint_dark': 'Sunset is soon — wrap up outdoor plans.',
    'weather.hint_outdoor': 'Nice window for outdoor review until sunset (~{until}).',
    'weather.hint_mixed': 'Mixed conditions — short outdoor breaks OK if comfortable.',
    'weather.palette': 'Refresh ambient weather',
    'es.title': 'Peak energy hours',
    'es.lede': 'Based on your energy check-ins — schedule heavy work in these windows.',
    'es.lede_collect': 'Move the energy slider on your dashboard a few times to learn your peak hours.',
    'es.peak_aria': 'Peak energy time windows',
    'es.no_peak': 'Not enough data yet — log energy throughout the day.',
    'es.no_heavy': 'No heavy tasks queued — you are clear for deep work.',
    'es.task_hint': 'Schedule during peak: {name}',
    'es.palette': 'Peak energy hours',
    'rdp.aria': 'Rest day adaptive plan',
    'rdp.off_title': 'Recovery mode',
    'rdp.mark_lede': 'Not feeling 100%? Mark today as a rest day for a lighter plan.',
    'rdp.mark_sick': 'Sick day',
    'rdp.mark_lazy': 'Lazy day',
    'rdp.marked_sick': 'Sick day marked — take it easy',
    'rdp.marked_lazy': 'Lazy day marked — light plan enabled',
    'rdp.sick_title': 'Sick day plan',
    'rdp.lazy_title': 'Lazy day plan',
    'rdp.sick_lede': 'Recovery first. Push school work forward unless it is truly optional.',
    'rdp.lazy_lede': 'Keep it light — a couple of easy wins max, defer the heavy stuff.',
    'rdp.stats': '{due} due today · {heavy} heavy',
    'rdp.push_all': 'Push all due tasks forward',
    'rdp.defer_heavy': 'Defer heavy tasks only',
    'rdp.deferred_heavy': 'Moved {n} heavy task(s) to next working day',
    'rdp.no_heavy': 'No heavy tasks due today',
    'rdp.nothing_push': 'Nothing due today to push',
    'rdp.mood': 'Mood check-in',
    'rdp.optional_micro': 'Optional micro-tasks (if you have energy)',
    'rdp.lazy_picks': 'Suggested easy wins',
    'rdp.no_light': 'No small tasks due — rest is the plan.',
    'rdp.no_rest_api': 'Rest day list unavailable',
    'rdp.palette': 'Rest day plan',
    'gf.title': 'Campus geofence reminders',
    'gf.lede': 'Save places like the library — Flux nudges you when you arrive (requires location while the app is open).',
    'gf.start_watch': 'Start location watch',
    'gf.stop_watch': 'Stop location watch',
    'gf.watch_on': 'Geofence watch started',
    'gf.watch_off': 'Geofence watch stopped',
    'gf.check_now': 'Check location now',
    'gf.use_loc': 'Use my location',
    'gf.add_place': 'Add place',
    'gf.delete': 'Remove',
    'gf.name_ph': 'e.g. Campus library',
    'gf.radius_ph': 'Radius (m)',
    'gf.msg_ph': 'Reminder message',
    'gf.place_meta': '{lat}, {lon} · {r}m radius',
    'gf.no_places': 'No places yet — stand at a spot and tap Use my location.',
    'gf.invalid_place': 'Enter name and valid coordinates',
    'gf.place_saved': 'Place saved',
    'gf.coords_set': 'Coordinates filled from GPS',
    'gf.no_geo': 'Geolocation not available',
    'gf.geo_denied': 'Location permission denied',
    'gf.arrived': 'Arrived at {place}',
    'gf.notif_title': 'At {place}',
    'gf.default_msg': 'You reached {place} — good time for a focused block.',
    'gf.default_msg_short': 'Good time for a focused study block.',
    'gf.nearest': 'Nearest: {name} (~{m}m away)',
    'gf.status_watch': 'Watching location while Flux is open.',
    'gf.status_off': 'Location watch is off.',
    'gf.palette': 'Geofence reminders',
    'exam.prep_title': 'Suggested daily prep',
    'exam.min_day': 'min/day',
    'exam.days': '{n} days left',
    'exam.prep_hint': 'Based on open tasks in the same subject plus review time, spread until exam day.',
    'exam.palette': 'Exam prep daily minutes',
    'sws.title': 'Syllabus weeks',
    'sws.lede': 'Detect week numbers from imported syllabus tasks and scaffold placeholder work blocks.',
    'sws.term_start': 'Week 1 starts',
    'sws.term_hint': 'Adjust term start so scaffold dates match your school calendar.',
    'sws.default_subject': 'Subject',
    'sws.no_subject': 'No subject',
    'sws.detected': 'Detected weeks',
    'sws.no_weeks': 'No week numbers yet — add tasks like "Week 4 reading" or paste syllabus imports.',
    'sws.week_row': 'Week {n} · {count} mention(s)',
    'sws.scaffold_btn': 'Scaffold week {n}',
    'sws.scaffolded': 'Scaffolded',
    'sws.manual_week': 'Week #',
    'sws.scaffold_manual': 'Scaffold week',
    'sws.task_preview': 'Week {n} — Preview readings',
    'sws.task_hw': 'Week {n} — Homework block',
    'sws.task_review': 'Week {n} — Review notes',
    'sws.task_catchup': 'Week {n} — Catch-up buffer',
    'sws.task_note': 'Auto-scaffold placeholder for syllabus week {n}. Edit or delete as needed.',
    'sws.toast_ok': 'Added {n} placeholder tasks for week {w}',
    'sws.already': 'Week {n} is already scaffolded',
    'sws.invalid_week': 'Enter a week number between 1 and 52',
    'sws.palette': 'Syllabus week scaffold',
    'sws.aria': 'Syllabus week auto-scaffold',
    'ttm.title': 'Template marketplace',
    'ttm.lede': 'Curated multi-task packs for AP, SAT, college apps, and projects. Import your own JSON packs.',
    'ttm.curated': 'Curated packs',
    'ttm.quick': 'Quick single templates',
    'ttm.imported': 'Imported packs',
    'ttm.no_imported': 'No imported packs yet.',
    'ttm.import_btn': 'Import JSON pack',
    'ttm.apply': 'Apply',
    'ttm.export': 'Export',
    'ttm.remove': 'Remove',
    'ttm.task_count': '{n} tasks',
    'ttm.diff': 'Diff {n}',
    'ttm.ap_desc': 'Register, review units, practice FRQs before AP week.',
    'ttm.sat_desc': 'Weekend SAT rhythm: full test, review, vocab.',
    'ttm.college_desc': 'Essay, rec letters, portals, and scholarships.',
    'ttm.exam_week_desc': 'Three-task exam week starter.',
    'ttm.project_desc': 'Research, draft, and revise milestones.',
    'ttm.applied': 'Added {n} tasks from "{name}"',
    'ttm.quick_applied': 'Template applied: {name}',
    'ttm.import_ok': 'Imported pack "{name}"',
    'ttm.import_invalid': 'Invalid pack JSON — need name + tasks[]',
    'ttm.export_ok': 'Pack exported',
    'ttm.pack_missing': 'Pack not found',
    'ttm.palette': 'Task template marketplace',
    'fs.title': 'Focus score',
    'fs.lede': 'Heuristic quality score from session length vs tab-switch interruptions. Not a medical metric.',
    'fs.score': 'Score',
    'fs.today': 'Today avg',
    'fs.week': '7-day avg',
    'fs.band_deep': 'Deep focus',
    'fs.band_solid': 'Solid session',
    'fs.band_frag': 'Fragmented',
    'fs.band_interrupt': 'Interrupted',
    'fs.recap': 'Focus score {score} · {band}',
    'fs.palette': 'Focus score',
    'fs.aria': 'Focus score heuristic',
    'eti.title': 'Email task inbox',
    'eti.lede': 'Stage syllabus or deadline emails here — approve to add tasks, nothing auto-imports.',
    'eti.scan_gmail': 'Scan Gmail (14 days)',
    'eti.paste_ph': 'Paste forwarded email: first line = subject, rest = body…',
    'eti.paste_btn': 'Stage pasted email',
    'eti.paste_source': 'Pasted email',
    'eti.approve': 'Approve → task',
    'eti.dismiss': 'Dismiss',
    'eti.empty': 'Queue empty — paste an email or scan Gmail.',
    'eti.untitled': 'Email follow-up',
    'eti.no_date': 'No date parsed',
    'eti.unknown_from': 'Unknown sender',
    'eti.staged_one': 'Staged 1 email for review',
    'eti.staged_n': 'Staged {n} emails for review',
    'eti.duplicate': 'Already in queue or imported',
    'eti.paste_empty': 'Paste email text first',
    'eti.gmail_needed': 'Connect Google sign-in for Gmail scan',
    'eti.scan_fail': 'Gmail scan failed',
    'eti.scan_none': 'No new syllabus emails found',
    'eti.dismissed': 'Removed from inbox',
    'eti.approved': 'Task added: {name}',
    'eti.palette': 'Email task inbox',
    'auto.title': 'Automation hooks',
    'auto.lede': 'Copy these URLs into iOS Shortcuts, Android routines, or browser bookmarks.',
    'auto.hint': 'Append &text=Your task here to prefill quick add on ?quick=task links.',
    'auto.copy': 'Copy',
    'auto.copied': 'URL copied',
    'auto.palette': 'Automation URL hooks',
    'auto.hook_task': 'Quick add task',
    'auto.hook_task_desc': 'Opens dashboard quick-add. Add &text=… to prefill.',
    'auto.hook_focus': 'Start focus session',
    'auto.hook_focus_desc': 'Opens Focus Timer and starts the pomodoro.',
    'auto.hook_timer': 'Focus Timer tab',
    'auto.hook_timer_desc': 'Opens timer without auto-start.',
    'auto.hook_mood': 'Mood check-in',
    'auto.hook_mood_desc': 'Opens mood / wellness tab.',
    'auto.hook_note': 'Notes tab',
    'auto.hook_note_desc': 'Opens notes workspace.',
    'auto.hook_cal': 'Calendar',
    'auto.hook_cal_desc': 'Opens month calendar view.',
    'auto.hook_dash': 'Dashboard',
    'auto.hook_dash_desc': 'Opens main dashboard.',
    'ical.title': 'iCal subscribe',
    'ical.lede': 'Publish a subscribe link for due dates (and optional focus blocks). Apple/Google Calendar refresh on their own schedule.',
    'ical.include_focus': 'Include focus session blocks',
    'ical.publish': 'Publish feed',
    'ical.download': 'Download .ics',
    'ical.regen': 'Regenerate token',
    'ical.copy_webcal': 'Copy webcal URL',
    'ical.copy_https': 'Copy https URL',
    'ical.copied': 'Subscribe URL copied',
    'ical.published': 'Calendar feed published',
    'ical.publish_fail': 'Could not publish feed',
    'ical.downloaded': 'Downloaded .ics file',
    'ical.sign_in': 'Sign in to publish a subscribe feed',
    'ical.publish_first': 'Publish feed first to get a subscribe URL',
    'ical.last_published': 'Last published: {when}',
    'ical.not_published': 'Not published yet',
    'ical.palette': 'iCal subscribe feed',
    'ical.aria': 'iCal subscribe export',
    'icsimp.title': 'ICS timetable import',
    'icsimp.lede': 'Drop a school .ics file to import weekly classes and blackout dates in one step.',
    'icsimp.drop': 'Drop .ics file or click to browse',
    'icsimp.opt_weekly': 'Import weekly schedule & one-off events',
    'icsimp.opt_blackouts': 'Import all-day dates as rest/blackout days',
    'icsimp.apply': 'Import selected',
    'icsimp.clear': 'Clear preview',
    'icsimp.parsed': 'Found {n} items — review and import',
    'icsimp.no_events': 'No events found in this file',
    'icsimp.parse_fail': 'Could not parse ICS file',
    'icsimp.read_fail': 'Could not read file',
    'icsimp.none_selected': 'Select at least one item to import',
    'icsimp.imported': 'Imported {weekly} weekly, {events} events, {blackouts} blackouts',
    'icsimp.import_note': 'Imported from ICS timetable',
    'icsimp.last_import': 'Last import: {when} ({file})',
    'icsimp.not_imported': 'No ICS import yet',
    'icsimp.palette': 'ICS timetable import',
    'icsimp.aria': 'ICS timetable import',
    'icsimp.untitled': 'Untitled event',
    'icsimp.kind_weekly': 'Weekly',
    'icsimp.kind_blackout': 'Blackout',
    'icsimp.kind_event': 'Event',
    'sport.title': 'Sport practice planner',
    'sport.lede': 'Apply drill, hydration, and recovery task packs — or add a repeating weekly practice to your calendar.',
    'sport.sport_name': 'Sport / activity name',
    'sport.sport_placeholder': 'e.g. Varsity Soccer',
    'sport.link_extra': 'Link to activity (optional)',
    'sport.no_extra': 'None',
    'sport.pack_practice': 'Practice day',
    'sport.pack_practice_desc': 'Warmup, drills, hydration, cooldown',
    'sport.pack_game': 'Game / match day',
    'sport.pack_game_desc': 'Pre-game, equipment, match, recovery',
    'sport.pack_recovery': 'Recovery week',
    'sport.pack_recovery_desc': 'Rest, mobility, sleep, hydration reset',
    'sport.task_warmup': 'Dynamic warmup',
    'sport.task_drills': 'Skill drills block',
    'sport.task_hydration': 'Hydration check',
    'sport.task_cooldown': 'Cooldown & stretch',
    'sport.task_pregame_meal': 'Pre-game meal',
    'sport.task_equipment': 'Equipment & uniform check',
    'sport.task_match': 'Match / game',
    'sport.task_recovery': 'Post-game recovery',
    'sport.task_rest': 'Rest or active recovery',
    'sport.task_mobility': 'Mobility & foam roll',
    'sport.task_sleep': 'Sleep target (8+ hrs)',
    'sport.task_hydration_reset': 'Hydration reset',
    'sport.task_count': '{n} tasks',
    'sport.applied': 'Added {n} tasks from {name}',
    'sport.pack_missing': 'Pack not found',
    'sport.weekly_title': 'Weekly practice',
    'sport.weekly_lede': 'Adds a repeating calendar block (outside school scope).',
    'sport.time': 'Time',
    'sport.days': 'Days',
    'sport.add_weekly': 'Add weekly practice',
    'sport.weekly_added': 'Weekly practice added: {name}',
    'sport.default_name': 'Sport',
    'sport.practice_label': 'Practice',
    'sport.palette': 'Sport practice packs',
    'sport.aria': 'Sport practice planner',
    'csl.title': 'CS snippet library',
    'csl.tool_label': 'Snippet library',
    'csl.tool_desc': 'Save and search local code snippets with syntax highlight.',
    'csl.search_ph': 'Search title, tags, or code…',
    'csl.copy': 'Copy code',
    'csl.to_note': 'Add to notes',
    'csl.delete': 'Delete',
    'csl.save': 'Save snippet',
    'csl.export': 'Export JSON',
    'csl.import': 'Import JSON',
    'csl.add_new': 'Add snippet',
    'csl.title_ph': 'Snippet title',
    'csl.tags_ph': 'Tags (comma-separated)',
    'csl.code_ph': 'Paste code here…',
    'csl.copied': 'Code copied',
    'csl.saved': 'Snippet saved',
    'csl.deleted': 'Snippet deleted',
    'csl.exported': 'Snippets exported',
    'csl.import_ok': 'Imported {n} snippets',
    'csl.import_invalid': 'Invalid snippet JSON',
    'csl.need_title_code': 'Title and code required',
    'csl.no_match': 'No snippets match your search',
    'csl.pick_one': 'Select a snippet from the list',
    'csl.note_added': 'Added to notes',
    'csl.note_title': 'Code snippet',
    'csl.unavailable': 'Snippet library unavailable',
    'csl.confirm_delete_starter': 'Delete this starter snippet?',
    'csl.palette': 'CS snippet library',
    'ucf.aria': 'Unit conversion favorites',
    'ucf.add': 'Add',
    'ucf.manage': 'Manage',
    'ucf.add_title': 'Pin conversion',
    'ucf.manage_title': 'Manage favorites',
    'ucf.category': 'Category',
    'ucf.from': 'From unit',
    'ucf.to': 'To unit',
    'ucf.value': 'Value',
    'ucf.save': 'Pin',
    'ucf.cancel': 'Cancel',
    'ucf.close': 'Close',
    'ucf.remove': 'Remove',
    'ucf.applied': 'Inserted: {text}',
    'ucf.added': 'Conversion pinned',
    'ucf.invalid': 'Invalid conversion',
    'ucf.need_converter': 'Unit converter not loaded',
    'ucf.palette': 'Unit conversion favorites',
    'ptsrs.title': 'Element quiz (SRS)',
    'ptsrs.tool_label': 'Element quiz',
    'ptsrs.tool_desc': 'Spaced-repetition drills for symbols, names, and atomic numbers.',
    'ptsrs.due': 'Due today',
    'ptsrs.correct': 'Correct',
    'ptsrs.review': 'Review queue',
    'ptsrs.mode_sym': 'Symbol → name',
    'ptsrs.mode_name': 'Name → symbol',
    'ptsrs.mode_num': 'Number → symbol',
    'ptsrs.q_sym_name': 'What element is this?',
    'ptsrs.q_name_sym': 'What is the symbol?',
    'ptsrs.q_num_sym': 'Which symbol matches this atomic number?',
    'ptsrs.again': 'Again',
    'ptsrs.hard': 'Hard',
    'ptsrs.good': 'Good',
    'ptsrs.easy': 'Easy',
    'ptsrs.nice': 'Correct!',
    'ptsrs.oops': 'Answer: {answer}',
    'ptsrs.all_caught_up': 'All caught up for today — come back tomorrow.',
    'ptsrs.no_elements': 'Periodic table data not loaded',
    'ptsrs.unavailable': 'Quiz unavailable',
    'ptsrs.palette': 'Periodic element quiz',
    'fcg.generate': 'Generate cards',
    'fcg.study_saved': 'Study saved',
    'fcg.preview_title': '{n} cards found — pick what to study',
    'fcg.select_all': 'Select all',
    'fcg.select_none': 'Select none',
    'fcg.study': 'Study selected',
    'fcg.try_ai': 'Try AI instead',
    'fcg.none_found': 'No headings or bullet pairs found — try AI or add H / • List structure.',
    'fcg.empty_note': 'Write something in the note first',
    'fcg.pick_one': 'Select at least one card',
    'fcg.applied': 'Studying {n} flashcards',
    'fcg.no_saved': 'No saved flashcards on this note',
    'fcg.shuffle': 'Shuffle deck',
    'fcg.shuffled': 'Deck shuffled',
    'fcg.palette': 'Generate flashcards from note',
    'fcg.default_note': 'Note',
    'fcg.q_heading': 'What is {topic}?',
    'fcg.q_bullet': '({topic}) {item}',
    'fcg.q_chunk': 'Review point {n} from {title}',
    'srsd.title': 'SRS review deck',
    'srsd.due': 'Due today',
    'srsd.cards': 'Cards',
    'srsd.notes': 'Notes',
    'srsd.sessions': 'Sessions',
    'srsd.start': 'Start review',
    'srsd.sync': 'Sync decks',
    'srsd.synced': 'Decks synced from #review notes',
    'srsd.banner_lead': 'Spaced repetition for notes tagged',
    'srsd.tap_reveal': 'Tap to reveal answer',
    'srsd.again': 'Again',
    'srsd.hard': 'Hard',
    'srsd.good': 'Good',
    'srsd.easy': 'Easy',
    'srsd.all_caught_up': 'All caught up for today — add #review notes or come back tomorrow.',
    'srsd.no_cards': 'No cards yet — tag a note #review and add headings or flashcards.',
    'srsd.tag_hint': 'Tag notes with #review and generate or save flashcards.',
    'srsd.session_done': 'Session complete!',
    'srsd.unavailable': 'SRS deck unavailable',
    'srsd.palette': 'SRS review deck (#review)',
    'srsd.default_note': 'Note',
    'srsd.tag_on': 'Added #review tag',
    'srsd.tag_off': 'Removed #review tag',
    'srsd.save_first': 'Save the note first',
    'srsd.empty_filter': 'No #review notes yet — open a note and tap #review.',
    'latex.preview': 'LaTeX preview',
    'latex.empty': 'Type math with $inline$ or $$display$$ delimiters…',
    'latex.load_fail': 'Could not load KaTeX — check your connection.',
    'latex.toggle': 'Toggle LaTeX preview split',
    'latex.insert_inline': 'Insert inline math',
    'latex.insert_display': 'Insert display math',
    'latex.split_on': 'LaTeX preview open',
    'latex.split_off': 'LaTeX preview hidden',
    'latex.palette': 'LaTeX live preview',
    'eocr.title': 'Equation → LaTeX',
    'eocr.btn': 'Equation OCR',
    'eocr.btn_hint': 'Photo of equation → editable LaTeX',
    'eocr.edit_label': 'Edit LaTeX',
    'eocr.preview_label': 'Preview',
    'eocr.preview_empty': 'Enter LaTeX to preview…',
    'eocr.reading': '📐 Reading equation with AI…',
    'eocr.insert': 'Insert into note',
    'eocr.cancel': 'Cancel',
    'eocr.inserted': 'Equation inserted — save when ready',
    'eocr.empty': 'LaTeX is empty',
    'eocr.no_editor': 'Open a note first',
    'eocr.open_note': 'Open or create a note first',
    'eocr.unavailable': 'Equation OCR unavailable',
    'eocr.failed': 'Could not read equation from photo',
    'eocr.no_latex': 'No LaTeX detected in image',
    'eocr.palette': 'Equation OCR → LaTeX',
    'wiki.panel_title': 'Wiki links',
    'wiki.outlinks': 'Links out',
    'wiki.backlinks': 'Backlinks',
    'wiki.no_outlinks': 'No [[wikilinks]] yet — use [[ ]] in the toolbar.',
    'wiki.no_backlinks': 'No other notes link here yet.',
    'wiki.broken': 'unresolved',
    'wiki.graph': 'Graph',
    'wiki.graph_title': 'Note link graph',
    'wiki.graph_hint': 'Click a node to open that note. Arrows follow [[wikilink]] direction.',
    'wiki.banner_lead': 'Notes with wikilinks:',
    'wiki.notes_linked': 'notes',
    'wiki.links': 'links',
    'wiki.insert_hint': 'Insert [[wikilink]]',
    'wiki.prompt_title': 'Link to note title (or numeric id)',
    'wiki.prompt_empty': 'Enter a title',
    'wiki.link_inserted': 'Wikilink inserted',
    'wiki.empty_filter': 'No linked notes — add [[Title]] in a note body.',
    'wiki.untitled': 'Untitled',
    'wiki.palette': 'Wiki note graph',
    'nox.banner_lead': 'Export notes as Obsidian Markdown:',
    'nox.notes': 'notes',
    'nox.export_zip': 'Download ZIP vault',
    'nox.export_one_hint': 'Download this note as .md',
    'nox.copy_hint': 'Copy Markdown to clipboard (Notion paste)',
    'nox.exported_one': 'Note exported as Markdown',
    'nox.exported_zip': 'Exported {n} notes as ZIP',
    'nox.no_notes': 'No notes to export',
    'nox.zip_fail': 'Could not build ZIP — check connection',
    'nox.open_note': 'Open a note first',
    'nox.copied': 'Markdown copied — paste into Notion or Obsidian',
    'nox.copy_fail': 'Could not copy to clipboard',
    'nox.untitled': 'Untitled',
    'nox.palette': 'Export notes to Obsidian (ZIP)',
    'mmap.title': 'Mind map',
    'mmap.default_title': 'Study plan',
    'mmap.root_label': 'Focus',
    'mmap.new_branch': 'New idea',
    'mmap.new_task': 'New task',
    'mmap.banner_lead': 'Plan branches visually:',
    'mmap.branches': 'branches',
    'mmap.linked_label': 'linked tasks',
    'mmap.open': 'Open mind map',
    'mmap.hint': 'Select a node → add branches, create tasks, or link existing ones. Click ◎ to jump to the task.',
    'mmap.pick_node': 'Select a node on the map',
    'mmap.label': 'Label',
    'mmap.task_link': 'Task link',
    'mmap.no_task': 'Not linked to a task',
    'mmap.pick_task': 'Link existing task…',
    'mmap.add_child': '+ Branch',
    'mmap.create_task': 'Create task',
    'mmap.goto_task': 'Go to task',
    'mmap.unlink': 'Unlink task',
    'mmap.delete': 'Delete branch',
    'mmap.label_required': 'Enter a label first',
    'mmap.task_created': 'Task created and linked',
    'mmap.task_missing': 'Task not found',
    'mmap.linked_toast': 'Linked to task',
    'mmap.unlinked': 'Task unlinked',
    'mmap.no_delete_root': 'Cannot delete the center node',
    'mmap.task_not_visible': 'Task not on current dashboard view',
    'mmap.task_note': 'Created from mind map',
    'mmap.palette': 'Mind map planner',
    'hw.title': 'Handwriting scan',
    'hw.btn': 'Handwriting',
    'hw.btn_hint': 'Photo of handwritten notes → editable text',
    'hw.edit_label': 'Edit recognized text',
    'hw.hint': 'Fix OCR mistakes before inserting into your note.',
    'hw.reading': '✍ Reading handwriting…',
    'hw.progress': 'Recognizing… {pct}%',
    'hw.insert': 'Insert into note',
    'hw.cancel': 'Cancel',
    'hw.inserted': 'Handwriting inserted — save when ready',
    'hw.empty': 'No text to insert',
    'hw.no_editor': 'Open a note first',
    'hw.open_note': 'Open or create a note first',
    'hw.no_text': 'No text detected in image',
    'hw.failed': 'Could not read handwriting',
    'hw.ocr_failed': 'OCR engine failed to load',
    'hw.palette': 'Scan handwriting to note',
    'cite.title': 'Citation helper',
    'cite.btn': 'Cite',
    'cite.btn_hint': 'Build MLA / APA / Chicago citations',
    'cite.banner_lead': 'Saved citations:',
    'cite.saved_count': 'in library',
    'cite.open': 'Open builder',
    'cite.source_type': 'Source type',
    'cite.type_web': 'Website',
    'cite.type_book': 'Book',
    'cite.type_journal': 'Journal article',
    'cite.type_news': 'Newspaper / magazine',
    'cite.preview': 'Citation preview',
    'cite.preview_empty': 'Fill in fields to preview…',
    'cite.save': 'Save to library',
    'cite.insert': 'Insert into note',
    'cite.copy': 'Copy',
    'cite.export_bib': 'Export bibliography',
    'cite.library': 'Saved library',
    'cite.lib_empty': 'No saved citations yet — build one and tap Save.',
    'cite.saved': 'Citation saved',
    'cite.inserted': 'Citation inserted — save note when ready',
    'cite.copied': 'Citation copied',
    'cite.copy_fail': 'Could not copy',
    'cite.exported': 'Bibliography downloaded',
    'cite.no_saved': 'Save citations first',
    'cite.empty': 'Citation is empty',
    'cite.open_note': 'Open a note first',
    'cite.fill_fields': 'Add at least a title or author',
    'cite.palette': 'Citation builder (MLA / APA)',
    'calch.title': 'Calc history & plots',
    'calch.bar_lead': 'Auto-saves basic calculator results when you press =',
    'calch.open_tape': 'Open tape',
    'calch.save_plot': 'Save current plot',
    'calch.tab_tape': 'History tape',
    'calch.tab_plots': 'Saved plots',
    'calch.expr_ph': 'Expression (e.g. sqrt(2)*3)',
    'calch.eval': 'Eval',
    'calch.tape_empty': 'No calculations yet — use the toolbox basic calc or Eval above.',
    'calch.plots_empty': 'No saved plots — open Graph + calc and tap Save plot.',
    'calch.export_tape': 'Export tape (.txt)',
    'calch.to_note': 'Insert tape into note',
    'calch.plot_untitled': 'Untitled plot',
    'calch.no_plot': 'Open Graph + calc with at least one Y= expression',
    'calch.plot_saved': 'Plot saved to library',
    'calch.no_tape': 'Nothing on the tape yet',
    'calch.tape_exported': 'Tape downloaded',
    'calch.tape_inserted': 'Tape inserted into note',
    'calch.png_exported': 'PNG downloaded',
    'calch.svg_exported': 'SVG downloaded',
    'calch.eval_fail': 'Could not evaluate expression',
    'calch.open_note': 'Open a note first',
    'calch.palette': 'Calc history & plot library',
    'calch.palette_sub': 'Tape + saved graphs',
    'calch.palette_plot_sub': 'From toolbox graphing calc',
    'task.untitled': '(untitled task)',
    'task.due': 'Due {date}',
    'task.done': 'Done',
    'task.not_done': 'Not done',
    'task.priority': 'Priority: {p}',
    'note.untitled': '(untitled note)',
    'note.no_body': '(no body)',
    'event.untitled': '(untitled event)',
    'storage.title': 'Storage repair',
    'storage.body': 'Fixes corrupt JSON for tasks, notes, and other planner data on this device. Does not change cloud sync.',
    'storage.last': 'Last scan: {detail}',
    'storage.not_scanned': 'Not scanned yet',
    'storage.scan': 'Scan & repair',
    'storage.toast_ok': 'Storage looks healthy — no repairs needed',
    'storage.toast_fixed': 'Repaired {n} storage key(s) — review tasks if anything looks missing',
    'dash.heading': 'Dashboard',
    'dash.hint': 'Show or hide sections, then reorder.',
    'dash.section.pulse': 'Next 7 days (workload)',
    'dash.section.gapfill': 'Smart gap-fill suggestions',
    'dash.section.countdown': 'Exam countdown',
    'dash.section.schedule': 'Today schedule & focus',
    'dash.section.tasks': 'Tasks',
    'cal.heading': 'Calendar',
    'cal.section.hero': 'Month, day detail & Google sync',
    'cal.section.schedule': 'Cycle & weekly schedule',
    'syllabus.title': 'Schedule conflicts',
    'syllabus.exam_stack': '{date}: {n} tests/quizzes due',
    'syllabus.heavy_day': '{date}: {n} assignments due',
    'syllabus.subject_clash': '{date}: {subject} has a test and homework due',
    'syllabus.duplicate_due': '{date}: duplicate "{name}" — check syllabus import',
    'syllabus.more': '+{n} more conflicts',
    'syllabus.cal_marker': 'Schedule conflict on this day',
  };

  const STRINGS = {
    'en-US': { ...UI_STRINGS },
    'es-US': {
      ...UI_STRINGS,
      'settings.locale_title': 'Idioma y región',
      'settings.locale_hint': 'Fechas y horas usan tu configuración regional.',
      'date.today': 'Hoy',
      'date.tomorrow': 'Mañana',
      'sync.title': 'Conflictos de sincronización',
      'sync.lede_legacy': 'El mismo elemento cambió en dos dispositivos. Elige una versión.',
      'sync.lede_v2': 'El mismo elemento se editó aquí y en la nube. Compara y elige qué copia conservar.',
      'sync.keep_mine': 'Mantener la mía',
      'sync.keep_cloud': 'Mantener la nube',
      'sync.keep_all_mine': 'Mantener todas las mías ({n})',
      'sync.keep_all_cloud': 'Mantener todas de la nube ({n})',
      'sync.no_conflicts': 'Sin conflictos de sincronización',
      'sync.close': 'Cerrar',
      'sync.this_device': 'Este dispositivo',
      'sync.cloud': 'Nube',
      'sync.compare': 'Comparar versiones',
      'sync.resolve': 'Resolver',
      'sync.conflicts_pill': '{n} conflicto(s)',
      'sync.pending_pill': '{n} pendiente(s)',
      'sync.pill_title': 'Conflictos de sincronización',
      'sync.pill_title_v2': 'Conflictos — toca para comparar versiones',
      'sync.outbox_title': 'Cambios sin conexión pendientes',
      'sync.banner': '{n} conflicto(s) de sync —',
      'sync.settings_title': 'Sincronización y conflictos',
      'sync.settings_body': 'La fusión sin conexión está activa para tareas, notas y calendario.',
      'sync.settings_body_v2': ' Si las versiones difieren, verás vistas previas lado a lado.',
      'sync.stat_conflicts': '{n} conflicto(s)',
      'sync.stat_pending': '{n} cambio(s) pendiente(s)',
      'sync.review': 'Revisar conflictos',
      'sync.flush': 'Sincronizar pendientes',
      'sync.syncing': 'Sincronizando…',
      'sync.toast_new': '{n} conflicto(s) — Ajustes → Datos o toca el indicador',
      'task.due': 'Entrega {date}',
      'task.done': 'Hecho',
      'task.not_done': 'Pendiente',
      'task.priority': 'Prioridad: {p}',
      'storage.title': 'Reparar almacenamiento',
      'storage.body': 'Corrige JSON dañado de tareas, notas y otros datos locales. No cambia la nube.',
      'storage.last': 'Último escaneo: {detail}',
      'storage.not_scanned': 'Aún no escaneado',
      'storage.scan': 'Escanear y reparar',
      'storage.toast_ok': 'Almacenamiento en buen estado',
      'storage.toast_fixed': 'Se repararon {n} clave(s) — revisa tus tareas',
      'dash.heading': 'Panel',
      'dash.hint': 'Mostrar u ocultar secciones y reordenar.',
      'dash.section.pulse': 'Próximos 7 días (carga)',
      'dash.section.gapfill': 'Sugerencias inteligentes',
      'dash.section.countdown': 'Cuenta regresiva de exámenes',
      'dash.section.schedule': 'Horario y enfoque de hoy',
      'dash.section.tasks': 'Tareas',
      'cal.heading': 'Calendario',
      'cal.section.hero': 'Mes, día y sync de Google',
      'cal.section.schedule': 'Ciclo y horario semanal',
      'syllabus.title': 'Conflictos de horario',
      'syllabus.exam_stack': '{date}: {n} exámenes/pruebas',
      'syllabus.heavy_day': '{date}: {n} tareas con entrega',
      'syllabus.subject_clash': '{date}: {subject} tiene examen y tarea',
      'syllabus.duplicate_due': '{date}: duplicado "{name}" — revisa el sílabo',
      'syllabus.more': '+{n} conflictos más',
      'syllabus.cal_marker': 'Conflicto de horario este día',
    },
    'fr-FR': {
      ...UI_STRINGS,
      'settings.locale_title': 'Langue et région',
      'settings.locale_hint': 'Dates et heures selon votre locale.',
      'date.today': "Aujourd'hui",
      'date.tomorrow': 'Demain',
      'sync.title': 'Conflits de synchronisation',
      'sync.lede_legacy': 'Le même élément a changé sur deux appareils. Choisissez une version.',
      'sync.lede_v2': 'Le même élément a été modifié ici et dans le cloud. Comparez puis choisissez.',
      'sync.keep_mine': 'Garder la mienne',
      'sync.keep_cloud': 'Garder le cloud',
      'sync.keep_all_mine': 'Tout garder (moi) ({n})',
      'sync.keep_all_cloud': 'Tout garder (cloud) ({n})',
      'sync.no_conflicts': 'Aucun conflit de sync',
      'sync.close': 'Fermer',
      'sync.this_device': 'Cet appareil',
      'sync.cloud': 'Cloud',
      'sync.compare': 'Comparer',
      'sync.resolve': 'Résoudre',
      'sync.conflicts_pill': '{n} conflit(s)',
      'sync.pending_pill': '{n} en attente',
      'sync.settings_title': 'Sync et conflits',
      'sync.settings_body': 'Fusion hors ligne active pour tâches, notes et calendrier.',
      'sync.settings_body_v2': ' Prévisualisations côte à côte si les versions diffèrent.',
      'sync.review': 'Voir les conflits',
      'sync.flush': 'Synchroniser maintenant',
      'sync.syncing': 'Synchronisation…',
      'storage.title': 'Réparation du stockage',
      'storage.body': 'Corrige le JSON local corrompu. Ne modifie pas le cloud.',
      'storage.scan': 'Analyser et réparer',
      'dash.heading': 'Tableau de bord',
      'dash.hint': 'Afficher, masquer et réordonner les sections.',
      'dash.section.countdown': 'Compte à rebours examens',
      'dash.section.tasks': 'Tâches',
      'cal.heading': 'Calendrier',
      'syllabus.title': 'Conflits d\'emploi du temps',
      'syllabus.exam_stack': '{date} : {n} tests',
      'syllabus.heavy_day': '{date} : {n} devoirs',
      'syllabus.subject_clash': '{date} : {subject} — test et devoir',
      'syllabus.duplicate_due': '{date} : doublon « {name} »',
      'syllabus.more': '+{n} autres',
      'syllabus.cal_marker': 'Conflit d\'horaire ce jour',
    },
    'ar-SA': {
      ...UI_STRINGS,
      'settings.locale_title': 'اللغة والمنطقة',
      'settings.locale_hint': 'التواريخ والأوقات حسب إعداداتك المحلية.',
      'date.today': 'اليوم',
      'date.tomorrow': 'غداً',
      'sync.title': 'تعارضات المزامنة',
      'sync.lede_legacy': 'عُدّل نفس العنصر على جهازين. اختر نسخة.',
      'sync.lede_v2': 'عُدّل العنصر هنا وفي السحابة. قارن ثم اختر النسخة.',
      'sync.keep_mine': 'الاحتفاظ بنسختي',
      'sync.keep_cloud': 'الاحتفاظ بالسحابة',
      'sync.keep_all_mine': 'الكل محلياً ({n})',
      'sync.keep_all_cloud': 'الكل من السحابة ({n})',
      'sync.no_conflicts': 'لا تعارضات',
      'sync.close': 'إغلاق',
      'sync.this_device': 'هذا الجهاز',
      'sync.cloud': 'السحابة',
      'sync.compare': 'مقارنة',
      'sync.resolve': 'حل',
      'sync.settings_title': 'المزامنة والتعارضات',
      'sync.review': 'مراجعة التعارضات',
      'sync.flush': 'مزامنة المعلّق',
      'storage.title': 'إصلاح التخزين',
      'storage.scan': 'فحص وإصلاح',
      'dash.heading': 'لوحة التحكم',
      'dash.section.tasks': 'المهام',
      'cal.heading': 'التقويم',
      'syllabus.title': 'تعارضات الجدول',
      'syllabus.exam_stack': '{date}: {n} اختبارات',
      'syllabus.heavy_day': '{date}: {n} واجبات',
      'syllabus.subject_clash': '{date}: {subject} — اختبار وواجب',
      'syllabus.duplicate_due': '{date}: تكرار «{name}»',
      'syllabus.more': '+{n} أخرى',
      'syllabus.cal_marker': 'تعارض في الجدول هذا اليوم',
    },
  };

  let _locale = 'en-US';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeLocale(id) {
    const hit = LOCALES.find((l) => l.id === id);
    return hit ? hit.id : 'en-US';
  }

  function getLocale() {
    return _locale;
  }

  function setLocale(id) {
    _locale = normalizeLocale(id);
    save(LOCALE_KEY, _locale);
    applyDocumentLocale();
    updateDatePill();
    try {
      document.dispatchEvent(new CustomEvent('flux-locale-change', { detail: { locale: _locale } }));
    } catch (_) {}
    if (typeof window.renderNoHWList === 'function') window.renderNoHWList();
    if (typeof window.renderStats === 'function') window.renderStats();
  }

  function applyDocumentLocale() {
    if (!enabled()) return;
    document.documentElement.lang = _locale.split('-')[0];
    document.documentElement.dir = _locale === 'ar-SA' ? 'rtl' : 'ltr';
  }

  function t(key, vars) {
    const table = STRINGS[_locale] || STRINGS['en-US'];
    let s = table[key] || STRINGS['en-US'][key] || key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function fluxT(key, vars) {
    if (!enabled()) {
      let s = STRINGS['en-US'][key] || key;
      if (vars && typeof vars === 'object') {
        Object.keys(vars).forEach((k) => {
          s = s.split('{' + k + '}').join(String(vars[k]));
        });
      }
      return s;
    }
    return t(key, vars);
  }

  function refreshLocaleSurfaces() {
    try {
      if (window.FluxPersonal?.renderPanelLayoutSettings) window.FluxPersonal.renderPanelLayoutSettings();
      if (window.FluxStorageRepair?.renderSettingsCard) window.FluxStorageRepair.renderSettingsCard();
      if (window.FluxOfflineSync?.refreshConflictUi) window.FluxOfflineSync.refreshConflictUi();
      if (window.FluxSyllabusConflict?.render) window.FluxSyllabusConflict.render();
      if (window.FluxSyllabusConflict?.decorateCalendar) window.FluxSyllabusConflict.decorateCalendar();
    } catch (_) {}
  }

  function toDate(input) {
    if (!input) return null;
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
    const s = String(input);
    const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(input, style) {
    const d = toDate(input);
    if (!d) return '';
    const loc = enabled() ? _locale : 'en-US';
    const opts =
      style === 'long'
        ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
        : style === 'weekday'
          ? { weekday: 'long', month: 'short', day: 'numeric' }
          : style === 'monthDay'
            ? { month: 'short', day: 'numeric' }
            : style === 'monthDayYear'
              ? { month: 'short', day: 'numeric', year: 'numeric' }
              : style === 'weekdayShort'
                ? { weekday: 'short' }
                : { weekday: 'short', month: 'short', day: 'numeric' };
    try {
      return new Intl.DateTimeFormat(loc, opts).format(d);
    } catch (_) {
      return d.toLocaleDateString('en-US', opts);
    }
  }

  function formatTime(input, opts) {
    const d = toDate(input) || new Date();
    const loc = enabled() ? _locale : 'en-US';
    const use24 = !!(opts && opts.hour24);
    try {
      return new Intl.DateTimeFormat(loc, {
        hour: use24 ? '2-digit' : 'numeric',
        minute: '2-digit',
        hour12: !use24,
      }).format(d);
    } catch (_) {
      return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hour12: !use24 });
    }
  }

  function formatDateTime(input) {
    return `${formatDate(input, 'short')} · ${formatTime(input)}`;
  }

  /** Staff/educator panels — delegates to fmtFluxDate when app.js is loaded */
  function fmtStaffDate(input, style) {
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(input, style || 'short');
    return formatDate(input, style || 'short');
  }

  function fmtStaffDateTime(input) {
    if (typeof window.fluxFormatDateTime === 'function') return window.fluxFormatDateTime(input);
    const d = toDate(input);
    if (!d) return '';
    return formatDateTime(d);
  }

  function fmtStaffTime(input, opts) {
    if (typeof window.fluxFormatTime === 'function') return window.fluxFormatTime(input, opts);
    return formatTime(input, opts);
  }

  function refreshStaffDateSurfaces() {
    const panels = ['lessonHub', 'counselorMeetings', 'adminOps', 'staffWorkboard'];
    panels.forEach((panel) => {
      if (document.getElementById(`fluxWidgetGrid_${panel}`) && window.FluxModuleLoader?.renderWidgetGrid) {
        try {
          window.FluxModuleLoader.renderWidgetGrid(panel);
        } catch (_) {}
      }
    });
    const adminBody = document.getElementById('adminDashboardBody');
    if (adminBody && adminBody.querySelector('.edu-dash-root') && typeof window.renderAdminDashboard === 'function') {
      void window.renderAdminDashboard();
    }
    try {
      if (typeof window.renderTeacherDashboard === 'function' && document.getElementById('teacherDashboardBody')?.querySelector('.edu-dash-root')) {
        void window.renderTeacherDashboard();
      }
      if (typeof window.renderCounselorDashboard === 'function' && document.getElementById('counselorDashboardBody')?.querySelector('.edu-dash-root')) {
        void window.renderCounselorDashboard();
      }
    } catch (_) {}
  }

  function relativeDayLabel(iso) {
    if (!iso) return null;
    const today = typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10);
    if (iso === today) return enabled() ? t('date.today') : 'Today';
    const tmr = new Date(`${today}T12:00:00`);
    tmr.setDate(tmr.getDate() + 1);
    const tmrStr = tmr.toISOString().slice(0, 10);
    if (iso === tmrStr) return enabled() ? t('date.tomorrow') : 'Tomorrow';
    return null;
  }

  /** Calendar week strip: Today / Tomorrow / short weekday */
  function calendarStripLabel(iso, index) {
    const rel = relativeDayLabel(iso);
    if (rel) return rel;
    if (index === 1) return enabled() ? t('date.tomorrow') : 'Tmrw';
    return formatDate(iso, 'weekdayShort');
  }

  function updateDatePill() {
    const pill = document.getElementById('datePill');
    if (!pill) return;
    const now = typeof TODAY !== 'undefined' && TODAY instanceof Date ? TODAY : new Date();
    let text = formatDate(now, 'short');
    if (window.FluxSiteEnhancements && typeof window.fluxEnhFormatTime === 'function') {
      try {
        const raw = window.load?.('flux_enh_prefs_v1', {}) || {};
        if (raw.time_24h) text += ' · ' + window.fluxEnhFormatTime(new Date());
      } catch (_) {}
    }
    pill.textContent = text;
  }

  function renderSettingsCard() {
    if (!enabled()) return;
    const pane = document.getElementById('spane-appearance');
    if (!pane || document.getElementById('fluxI18nSettingsCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'fluxI18nSettingsCard';
    card.innerHTML = `
      <h3>${esc(t('settings.locale_title'))}</h3>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 10px;line-height:1.45">${esc(t('settings.locale_hint'))}</p>
      <label style="font-size:.78rem;display:block;margin-bottom:6px">Locale</label>
      <select id="fluxLocaleSelect" style="width:100%;font-size:.82rem;padding:8px;border-radius:10px">
        ${LOCALES.map((l) => `<option value="${esc(l.id)}">${esc(l.label)}</option>`).join('')}
      </select>
      <p id="fluxLocalePreview" style="font-size:.72rem;color:var(--muted);margin-top:10px;font-family:'JetBrains Mono',monospace"></p>`;
    pane.insertBefore(card, pane.firstChild);
    const sel = card.querySelector('#fluxLocaleSelect');
    const preview = card.querySelector('#fluxLocalePreview');
    if (sel) {
      sel.value = _locale;
      sel.addEventListener('change', () => {
        setLocale(sel.value);
        if (preview) {
          preview.textContent = `${formatDate(new Date(), 'long')} · ${formatTime(new Date())}`;
        }
        if (typeof showToast === 'function') showToast('Locale updated', 'success', 1600);
      });
    }
    if (preview) preview.textContent = `${formatDate(new Date(), 'long')} · ${formatTime(new Date())}`;
  }

  function bindGlobals() {
    window.fluxFmtDate = formatDate;
    window.fluxFormatDate = formatDate;
    window.fluxFormatTime = formatTime;
    window.fluxFormatDateTime = formatDateTime;
    window.fluxRelativeDayLabel = relativeDayLabel;
    window.fluxCalendarStripLabel = calendarStripLabel;
    window.fluxFmtStaffDate = fmtStaffDate;
    window.fluxFmtStaffDateTime = fmtStaffDateTime;
    window.fluxFmtStaffTime = fmtStaffTime;
    window.fluxT = fluxT;
  }

  function install() {
    _locale = normalizeLocale(load(LOCALE_KEY, 'en-US'));
    bindGlobals();
    if (!enabled()) {
      updateDatePill();
      return false;
    }
    applyDocumentLocale();
    updateDatePill();
    renderSettingsCard();
    document.addEventListener('flux-nav', (ev) => {
      if (ev.detail?.panel === 'settings') renderSettingsCard();
      if (ev.detail?.panel === 'dashboard') updateDatePill();
    });
    document.addEventListener('flux-locale-change', () => {
      updateDatePill();
      try {
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderCountdown === 'function') renderCountdown();
        if (typeof renderDashWeekStrip === 'function') renderDashWeekStrip();
        refreshStaffDateSurfaces();
        refreshLocaleSurfaces();
      } catch (_) {}
    });
    return true;
  }

  _locale = normalizeLocale(load(LOCALE_KEY, 'en-US'));
  bindGlobals();

  window.FluxI18n = {
    FLAG,
    LOCALES,
    enabled,
    getLocale,
    setLocale,
    t,
    fluxT,
    refreshLocaleSurfaces,
    formatDate,
    formatTime,
    formatDateTime,
    fmtStaffDate,
    fmtStaffDateTime,
    fmtStaffTime,
    refreshStaffDateSurfaces,
    relativeDayLabel,
    calendarStripLabel,
    bindGlobals,
    updateDatePill,
    renderSettingsCard,
    install,
  };
})();
