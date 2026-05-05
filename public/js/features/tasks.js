import { loadData, updateData } from '../core/storage.js';

export function getTasks() {
  return loadData().tasks || [];
}

/** Prefer `addTask()` in app.js for full validation; this is for modules / tooling. */
export function addTask(task) {
  const t = {
    ...task,
    id: task.id != null ? task.id : Date.now() + Math.random(),
  };
  updateData((data) => ({
    ...data,
    tasks: [...(data.tasks || []), t],
  }));
  try {
    window.__fluxReloadTasksFromStorage?.();
  } catch {
    /* ignore */
  }
}

/** Dashboard list is rendered by `app.js` `window.renderTasks`. */
export function renderTasks() {
  if (typeof window.renderTasks === 'function') window.renderTasks();
}
