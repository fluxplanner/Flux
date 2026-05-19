/**
 * Flux · Google Tasks — list + import into planner (uses FluxGoogle token).
 */
(function () {
  'use strict';

  const CACHE_KEY = 'flux_google_tasks_cache_v1';
  const CACHE_MS = 3 * 60 * 1000;

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  async function api(path, opts) {
    const tok =
      (window.FluxGoogle && (await FluxGoogle.ensureToken())) ||
      window.gmailToken ||
      sessionStorage.getItem('flux_gmail_token');
    if (!tok) throw new Error('Google not connected');
    const res = await fetch('https://tasks.googleapis.com/tasks/v1' + path, {
      method: (opts && opts.method) || 'GET',
      headers: {
        Authorization: 'Bearer ' + tok,
        'Content-Type': 'application/json',
      },
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) throw new Error('Google session expired — sign in again');
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Tasks API ' + res.status + (text ? ': ' + text.slice(0, 120) : ''));
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async function fetchTaskLists() {
    const data = await api('/users/@me/lists?maxResults=50');
    return Array.isArray(data.items) ? data.items : [];
  }

  async function fetchTasksForList(listId) {
    const data = await api('/lists/' + encodeURIComponent(listId) + '/tasks?maxResults=100&showCompleted=false');
    return Array.isArray(data.items) ? data.items : [];
  }

  async function prefetch() {
    try {
      const lists = await fetchTaskLists();
      const defaultList = lists.find((l) => l.id === '@default') || lists[0];
      if (!defaultList) {
        save(CACHE_KEY, { fetchedAt: Date.now(), lists: [], tasks: [] });
        return;
      }
      const tasks = await fetchTasksForList(defaultList.id);
      save(CACHE_KEY, {
        fetchedAt: Date.now(),
        lists,
        listId: defaultList.id,
        listTitle: defaultList.title || 'Tasks',
        tasks,
      });
    } catch (e) {
      console.warn('[FluxGoogleTasks] prefetch', e);
    }
  }

  function dueYmd(task) {
    if (!task.due) return '';
    try {
      return String(task.due).slice(0, 10);
    } catch (_) {
      return '';
    }
  }

  function gtaskExistsInPlanner(gid) {
    if (!Array.isArray(window.tasks)) return false;
    return window.tasks.some((t) => t.googleTaskId && String(t.googleTaskId) === String(gid));
  }

  function importTask(task, listTitle) {
    if (!task || !task.title) return false;
    if (gtaskExistsInPlanner(task.id)) return false;
    const date = dueYmd(task) || todayStr();
    const row = {
      id: Date.now() + Math.floor(Math.random() * 999),
      name: task.title,
      date,
      subject: '',
      priority: 'med',
      type: 'hw',
      done: task.status === 'completed',
      rescheduled: 0,
      createdAt: Date.now(),
      googleTaskId: task.id,
      notes: (task.notes || '') + (listTitle ? '\n[Google Tasks · ' + listTitle + ']' : ''),
    };
    if (typeof calcUrgency === 'function') row.urgencyScore = calcUrgency(row);
    window.tasks.unshift(row);
    return true;
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function render() {
    const slot = document.getElementById('gHubTasksSlot');
    if (!slot) return;

    if (window.FluxGoogle && !FluxGoogle.isGoogleLinked()) {
      slot.innerHTML =
        '<p class="g-hub-muted">Sign in with Google on the Canvas tab to load Google Tasks.</p>';
      return;
    }

    slot.innerHTML =
      '<div class="g-hub-loading">Loading Google Tasks…</div>';
    let cache = load(CACHE_KEY, null);
    const stale = !cache || !cache.fetchedAt || Date.now() - cache.fetchedAt > CACHE_MS;
    if (stale) {
      try {
        await prefetch();
        cache = load(CACHE_KEY, null);
      } catch (e) {
        slot.innerHTML =
          '<div class="g-hub-err">' +
          esc(e.message || 'Could not load tasks') +
          '</div><button type="button" class="btn-sec" onclick="FluxGoogle.signIn()">Reconnect Google</button>';
        return;
      }
    }

    const lists = (cache && cache.lists) || [];
    const tasks = (cache && cache.tasks) || [];
    const listTitle = (cache && cache.listTitle) || 'Tasks';

    slot.innerHTML = `
    <div class="g-tasks-head">
      <div>
        <h3 class="g-tasks-title">Google Tasks</h3>
        <p class="g-hub-muted">From “${esc(listTitle)}” · ${tasks.length} open · synced ${cache && cache.fetchedAt ? new Date(cache.fetchedAt).toLocaleTimeString() : '—'}</p>
      </div>
      <div class="g-tasks-actions">
        <button type="button" class="btn-sec" onclick="FluxGoogleTasks.refresh()">↻ Refresh</button>
        <button type="button" onclick="FluxGoogleTasks.importAll()">Import all to Flux</button>
      </div>
    </div>
    <div class="g-tasks-list">
      ${
        tasks.length
          ? tasks
              .map((t) => {
                const due = dueYmd(t);
                const done = gtaskExistsInPlanner(t.id);
                return `<div class="g-task-row">
          <div class="g-task-main">
            <div class="g-task-name">${esc(t.title || '(untitled)')}</div>
            ${due ? `<div class="g-task-due">${esc(due)}</div>` : ''}
            ${t.notes ? `<div class="g-task-notes">${esc(String(t.notes).slice(0, 160))}</div>` : ''}
          </div>
          <button type="button" class="g-task-add ${done ? 'g-task-add--done' : ''}" ${done ? 'disabled' : ''} onclick="FluxGoogleTasks.importOne('${esc(t.id)}')">${done ? '✓ In Flux' : '+ Flux'}</button>
        </div>`;
              })
              .join('')
          : '<p class="g-hub-muted">No open tasks in this list.</p>'
      }
    </div>
    ${
      lists.length > 1
        ? `<p class="g-hub-muted g-tasks-more">Also found ${lists.length - 1} other list(s) in your account — switch lists in Google Tasks app; Flux imports the default list.</p>`
        : ''
    }`;
  }

  async function refresh() {
    await prefetch();
    await render();
    toast('Google Tasks refreshed', 'success');
  }

  function importOne(id) {
    const cache = load(CACHE_KEY, null);
    const task = (cache && cache.tasks || []).find((t) => String(t.id) === String(id));
    if (!task) return;
    if (importTask(task, cache.listTitle)) {
      save('tasks', window.tasks);
      if (typeof syncKey === 'function') syncKey('tasks', window.tasks);
      if (typeof renderTasks === 'function') renderTasks();
      if (typeof renderStats === 'function') renderStats();
      toast('Added to Flux', 'success');
      render();
    }
  }

  function importAll() {
    const cache = load(CACHE_KEY, null);
    let n = 0;
    (cache && cache.tasks ? cache.tasks : []).forEach((t) => {
      if (importTask(t, cache.listTitle)) n++;
    });
    if (n) {
      save('tasks', window.tasks);
      if (typeof syncKey === 'function') syncKey('tasks', window.tasks);
      if (typeof renderTasks === 'function') renderTasks();
      if (typeof renderStats === 'function') renderStats();
      toast('Imported ' + n + ' task(s)', 'success');
    } else toast('Nothing new to import', 'info');
    render();
  }

  window.FluxGoogleTasks = {
    prefetch,
    render,
    refresh,
    importOne,
    importAll,
    fetchTaskLists,
  };
})();
