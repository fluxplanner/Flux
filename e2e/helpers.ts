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

/**
 * Bring a Study Tools tab into the strip, selecting its unit if it has one.
 *
 * Study Tools nests umbrella → subject → unit → tool. A subject with a unit row
 * renders only the selected unit's tools, so a tab a spec asks for by id may be
 * legitimately absent from the DOM until the right chip is clicked — which is
 * exactly what a student does.
 *
 * Deliberately a search rather than a lookup table: it clicks through the chips
 * until the tool shows up, so it keeps working when a tool is re-filed into a
 * different unit. Subjects with no unit row return on the first check, so this
 * is a no-op for Chemistry, the languages, History and the rest.
 *
 * Call it after selectSubject() and before locating the tab.
 */
/**
 * The unit ids in the current subject's row, read once up front.
 *
 * Chips must be addressed by `data-unit`, never by an nth() index. Clicking one
 * rebuilds the entire stage — `stage.innerHTML = …` in renderRegistered — so
 * every chip element is destroyed and replaced on each click. An index-based
 * locator re-resolves against that fresh row and can act on a chip other than
 * the one it measured, silently skipping a unit and leaving the tool unfound.
 * That produced a ~1-in-3 `no "ab-apps" tab under math` failure, always on a
 * unit at index 1 or later, never on the one that renders first.
 */
async function unitIdsOf(page: Page): Promise<string[]> {
  /* Both the unit row and the tab strip carry data-sid, and during a subject
     switch they disagree for a frame. Reading then hands back the *previous*
     subject's unit ids, so every click that follows addresses a row that is no
     longer on screen, the search finds nothing, and the caller reports the tool
     as missing. Waiting for the two to agree is what makes the read meaningful.
     This was the residual ~1-in-4 `no "orc-transpose" tab under music`. */
  await page.waitForFunction(() => {
    const strip = document.querySelector('#fshChemTabs[data-sid]') as HTMLElement | null;
    if (!strip) return false;
    const row = document.querySelector('.fsh-units[data-sid]') as HTMLElement | null;
    return !row || row.dataset.sid === strip.dataset.sid;
  }, undefined, { timeout: 10_000 });
  return page.evaluate(() =>
    [...document.querySelectorAll('.fsh-units .fsh-unit[data-unit]')]
      .map((c) => (c as HTMLElement).dataset.unit || '')
      .filter(Boolean));
}

export async function revealStudyTool(page: Page, tool: string): Promise<void> {
  const sel = `#fshChemTabs [data-tool="${tool}"]`;
  if (await page.locator(sel).count() > 0) return;
  for (const id of await unitIdsOf(page)) {
    const chip = page.locator(`.fsh-units .fsh-unit[data-unit="${id}"]`);
    await chip.click();
    /* The chip is addressed by data-unit, so this class can only be reporting
       on the chip just clicked — which is what made the earlier nth() version
       unsafe, not the signal itself. It is set in the same synchronous render
       that rebuilds the strip, so the new tabs are in the DOM the moment it
       passes.

       Waiting on the tool tab instead would be waiting on the real goal, but
       it costs a full timeout on every unit that does *not* hold it, which is
       most of them. At ~2s a miss that pushed this spec past the 60s budget
       and turned a passing walk into a timeout. */
    await expect(chip).toHaveClass(/\bactive\b/, { timeout: 5000 });
    if (await page.locator(sel).count() > 0) return;
  }
  // Fall through silently: the caller's own expect() gives a better failure
  // message naming the tool and subject than anything this could throw.
}

/**
 * Same as revealStudyTool, for specs that find a tab by its visible label
 * rather than its id.
 */
export async function revealStudyToolByText(page: Page, label: string): Promise<void> {
  const tab = () => page.locator('#fshChemTabs .fsh-chem-tab', { hasText: label });
  if (await tab().count() > 0) return;
  for (const id of await unitIdsOf(page)) {
    const chip = page.locator(`.fsh-units .fsh-unit[data-unit="${id}"]`);
    await chip.click();
    // Same reasoning as revealStudyTool: address the chip by data-unit, then
    // use the active class as the (fast) signal that the strip was rebuilt.
    await expect(chip).toHaveClass(/\bactive\b/, { timeout: 5000 });
    if (await tab().count() > 0) return;
  }
}

/**
 * Every tool id registered under the current subject, across all its units.
 *
 * Specs use this to prove *registration* — a module with a mistyped subject id
 * or missing from the bundle manifest throws nothing and renders nothing, so
 * "is this id present" is the only signal that it loaded. The unit row means
 * only one unit's tabs are in the DOM at a time, so reading the strip once now
 * answers a different and much weaker question than these specs are asking.
 *
 * Walks the chips and unions the results. Falls back to a single read for
 * subjects with no unit row.
 */
export async function allStudyTools(page: Page): Promise<{ id: string; label: string }[]> {
  const readStrip = () => page.evaluate(() =>
    [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')].map((t) => ({
      id: (t as HTMLElement).dataset.tool || '',
      label: (t.textContent || '').trim(),
    })));

  const unitIds = await unitIdsOf(page);
  if (unitIds.length === 0) return readStrip();

  const byId = new Map<string, { id: string; label: string }>();
  for (const id of unitIds) {
    const chip = page.locator(`.fsh-unit[data-unit="${id}"]`);
    await chip.click();
    /* Here the active class IS the right signal, unlike in revealStudyTool:
       this function has no particular tab to wait for, and the chip is
       addressed by data-unit, so the class can only be reporting on the chip
       that was just clicked. */
    await expect(chip).toHaveClass(/\bactive\b/, { timeout: 5000 });
    for (const t of await readStrip()) if (t.id) byId.set(t.id, t);
  }
  return [...byId.values()];
}

/** Just the ids — the common case. */
export async function allStudyToolIds(page: Page): Promise<string[]> {
  return (await allStudyTools(page)).map((t) => t.id);
}

// ── CSP / console-error guard (zero tolerance) ────────────────────────────────
// Attaches listeners for `securitypolicyviolation` events and console errors,
// then lets a spec assert that none fired. Call watchForViolations(page) BEFORE
// the first navigation, and assertNoCspOrConsoleViolations(page) at the end of
// the test. The log is keyed by page (WeakMap), so it is safe under fullyParallel.

type ViolationLog = { csp: string[]; consoleErrors: string[] };
const _violationLogs = new WeakMap<Page, ViolationLog>();

/**
 * Begin recording CSP violations and console errors for `page`. Must be awaited
 * before the first navigation so the init script + binding install in time.
 */
export async function watchForViolations(page: Page): Promise<void> {
  const log: ViolationLog = { csp: [], consoleErrors: [] };
  _violationLogs.set(page, log);

  // Exclusion-free: every console error counts, including browser network
  // resource-load 404s. The one known source of such noise (the not-yet-deployed
  // get_benchmarks RPC) is now gated off in flux-benchmarks.js, so the guard can
  // be strict — any 404 that appears is a real regression.
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    log.consoleErrors.push(`pageerror: ${err.message}`);
  });

  // CSP violations fire the in-page `securitypolicyviolation` event; forward
  // each to Node via a binding installed on every document before scripts run.
  await page.exposeFunction('__fluxReportCsp', (detail: string) => {
    log.csp.push(detail);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const ev = e as SecurityPolicyViolationEvent;
      const where = ev.blockedURI || ev.sourceFile || '(inline)';
      try {
        (window as unknown as { __fluxReportCsp?: (d: string) => void })
          .__fluxReportCsp?.(`${ev.violatedDirective} blocked ${where}`);
      } catch (_) { /* binding not ready yet — ignore */ }
    });
  });
}

/** Assert zero CSP violations and zero console errors were recorded for `page`. */
export function assertNoCspOrConsoleViolations(page: Page): void {
  const log = _violationLogs.get(page) ?? { csp: [], consoleErrors: [] };
  expect(log.csp, `CSP violations detected:\n${log.csp.join('\n')}`).toEqual([]);
  expect(
    log.consoleErrors,
    `console errors detected:\n${log.consoleErrors.join('\n')}`,
  ).toEqual([]);
}
