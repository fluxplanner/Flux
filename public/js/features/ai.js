import { loadData } from '../core/storage.js';

function trimTasksForPrompt(list) {
  const take = list.slice(0, 80);
  return take.map((t) => ({
    name: t.name,
    date: t.date,
    done: !!t.done,
    priority: t.priority,
    subject: t.subject,
    type: t.type,
  }));
}

function trimEvents(list) {
  return list.slice(0, 40).map((e) => ({
    title: e.title,
    date: e.date,
    time: e.time,
    scope: e.scope,
  }));
}

/**
 * Structured snapshot for AI requests (keep small for token budget).
 */
export function getAIContext() {
  const data = loadData();
  const moodHistory = data.moodHistory || [];
  return {
    tasks: trimTasksForPrompt(data.tasks || []),
    events: trimEvents(data.events || []),
    mood: {
      recentCheckIns: moodHistory.slice(-14),
    },
    notesDigest: {
      count: Array.isArray(data.notes) ? data.notes.length : 0,
    },
  };
}
