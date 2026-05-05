import { loadData, updateData } from '../core/storage.js';

export function getEvents() {
  return loadData().events || [];
}

export function addEvent(event) {
  const ev = {
    ...event,
    id: event.id != null ? event.id : String(Date.now()),
  };
  updateData((data) => ({
    ...data,
    events: [...(data.events || []), ev],
  }));
  try {
    window.__fluxRenderCalendar?.();
  } catch {
    /* ignore */
  }
}

/**
 * Optional helper if you add `<div id="dayEvents"></div>` in a custom layout.
 * Does not touch `#calDayTasks` (owned by `renderCalendar()` in app.js).
 */
export function renderCalendarDay(dateStr) {
  const events = getEvents().filter((e) => e.date === dateStr);
  const container = document.getElementById('dayEvents');
  if (!container) return;
  container.innerHTML = events
    .map((e) => `<div class="event-card">${escapeHtml(e.title || 'Event')}</div>`)
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
