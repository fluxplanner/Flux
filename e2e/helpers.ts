import { expect, type Page } from '@playwright/test';

/** Phase 12–36 mega-release flags for flag-on E2E smoke. Set E2E_MEGA_FLAGS=1 to enable. */
export const MEGA_RELEASE_FLAGS: Record<string, boolean> = {
  enable_deep_links: true,
  enable_sync_queue_ui: true,
  enable_voice_task_capture: true,
  enable_gcal_busy_overlay: true,
  enable_recurring_exceptions: true,
  enable_subject_theme_packs: true,
  enable_cmd_palette_v2: true,
  enable_global_search_v2: true,
  enable_smart_lists: true,
  enable_bulk_filter: true,
  enable_focus_intent: true,
  enable_habit_heatmap: true,
  enable_pomodoro_subject_presets: true,
  enable_meeting_mode: true,
  enable_mood_velocity: true,
  enable_screenshot_snip: true,
  enable_event_buffer: true,
  enable_travel_time: true,
  enable_ambient_weather: true,
  enable_energy_scheduling: true,
  enable_rest_day_plan: true,
  enable_geofence_reminders: true,
  enable_exam_prep_plan: true,
  enable_syllabus_week_scaffold: true,
  enable_task_template_marketplace: true,
  enable_focus_score: true,
  enable_email_task_inbox: true,
  enable_automation_hooks: true,
  enable_ical_subscribe: true,
  enable_ics_timetable_import: true,
  enable_sport_practice_pack: true,
  enable_cs_snippet_library: true,
  enable_unit_converter_favorites: true,
  enable_periodic_srs_quiz: true,
  enable_flashcard_generator: true,
  enable_srs_deck_mode: true,
  enable_latex_live_preview: true,
  enable_equation_ocr_latex: true,
  enable_wiki_backlinks: true,
  enable_notion_obsidian_export: true,
  enable_mind_map_tasks: true,
  enable_handwriting_to_text: true,
  enable_citation_helper: true,
  enable_calc_history: true,
};

export async function gotoScenario(page: Page, scenario: string) {
  if (process.env.E2E_MEGA_FLAGS === '1') {
    await page.addInitScript((flags) => {
      window.FLUX_EXPERIMENTS = { ...(window.FLUX_EXPERIMENTS || {}), ...flags };
    }, MEGA_RELEASE_FLAGS);
  }
  await page.goto(`/?e2e=1&scenario=${encodeURIComponent(scenario)}`);
  await expect(page.locator('#app')).toHaveClass(/visible/);
}

export async function openSidebarTab(page: Page, tab: string) {
  const item = page.locator(`#sidebar .nav-item[data-tab="${tab}"]`).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.locator(`#${tab}.panel.active`)).toBeVisible({ timeout: 15_000 });
}
