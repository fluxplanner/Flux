/* ════════════════════════════════════════════════════════════════════════
   FLUX · Google Calendar push — per-task push + auto-push new tasks
   ------------------------------------------------------------------------
   Uses the existing `gmailToken` (window.gmailToken) from Google sign-in.
   The write scope (calendar.events) is NOT requested by default — if the
   token lacks write permission, we prompt the user to reconnect with
   `fluxReconnectGoogleCalendarWrite()` which triggers a fresh OAuth with
   the added scope.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const LS_KEY_PUSHED = 'flux_gcal_pushed_map'; // { [taskId]: gcalEventId }
  const LS_KEY_AUTO = 'flux_gcal_auto_push';    // "1" / "0"

  function getToken(){ return window.gmailToken || sessionStorage.getItem('flux_gmail_token') || null; }
  function isAutoOn(){ return localStorage.getItem(LS_KEY_AUTO) === '1'; }
  function setAutoOn(on){ localStorage.setItem(LS_KEY_AUTO, on ? '1' : '0'); }
  function getPushedMap(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY_PUSHED) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function savePushedMap(m){ try{ localStorage.setItem(LS_KEY_PUSHED, JSON.stringify(m||{})); }catch(e){} }

  function toast(msg, kind){
    if(typeof window.showToast === 'function'){ window.showToast(msg, kind || 'info'); }
    else{ console.log('[gcal]', msg); }
  }

  function taskToEvent(task){
    const est = parseInt(task.estTime, 10);
    const mins = Number.isFinite(est) && est > 0 ? est : 30;
    const subs = (typeof window.getSubjects === 'function') ? window.getSubjects() : {};
    const sub = task.subject ? subs[task.subject] : null;
    const descParts = [];
    if(sub && (sub.name || sub.short)) descParts.push(`Subject: ${sub.name || sub.short}`);
    if(task.priority) descParts.push(`Priority: ${task.priority}`);
    if(task.type && task.type !== 'hw') descParts.push(`Type: ${task.type}`);
    if(task.notes) descParts.push(task.notes);
    descParts.push('Added from Flux Planner');
    const date = task.date;
    // All-day event by default; uses date only
    const ev = {
      summary: task.name || 'Untitled task',
      description: descParts.join('\n\n'),
      start: { date: date },
      end: { date: date },
    };
    // If a time is set on the task (HH:MM), use a timed event
    if(task.time && /^\d{2}:\d{2}$/.test(task.time)){
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      const startIso = `${date}T${task.time}:00`;
      const endDate = new Date(`${date}T${task.time}:00`);
      endDate.setMinutes(endDate.getMinutes() + mins);
      const endIso = endDate.toISOString().slice(0,19);
      ev.start = { dateTime: startIso, timeZone: tz };
      ev.end   = { dateTime: endIso,   timeZone: tz };
    }
    return ev;
  }

  async function insertEvent(task){
    const token = getToken();
    if(!token) return { ok: false, needsSignIn: true };
    const body = taskToEvent(task);
    try{
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if(res.status === 401) return { ok: false, expired: true };
      if(res.status === 403) return { ok: false, needsScope: true };
      if(!res.ok){
        const text = await res.text().catch(()=>'');
        return { ok: false, error: `Calendar API ${res.status} — ${text.slice(0,160)}` };
      }
      const data = await res.json();
      return { ok: true, eventId: data.id || '' };
    } catch(e){
      return { ok: false, error: String(e.message || e) };
    }
  }

  async function pushTaskToGCal(taskId){
    if(!Array.isArray(window.tasks)){ toast('Tasks not loaded', 'error'); return; }
    const t = window.tasks.find(x => x.id === taskId);
    if(!t){ toast('Task not found', 'error'); return; }
    if(!t.date){ toast('Add a due date first', 'warning'); return; }
    const pushed = getPushedMap();
    if(pushed[taskId]){ toast('Already on Google Calendar', 'info'); return; }
    if(!getToken()){
      toast('Sign in with Google to push to Calendar', 'warning');
      return;
    }
    const res = await insertEvent(t);
    if(res.ok){
      pushed[taskId] = res.eventId;
      savePushedMap(pushed);
      toast('Added to Google Calendar ✓', 'success');
      if(typeof window.renderTasks === 'function') window.renderTasks();
      return;
    }
    if(res.needsSignIn){
      toast('Sign in with Google first', 'warning');
      return;
    }
    if(res.expired || res.needsScope){
      if(confirm('Google Calendar write access needed. Reconnect now?')){
        fluxReconnectGoogleCalendarWrite();
      } else {
        toast('Enable Google Calendar sync in Settings to push tasks', 'warning');
      }
      return;
    }
    toast(res.error || 'Could not add to Calendar', 'error');
  }

  async function fluxReconnectGoogleCalendarWrite(){
    const sb = (typeof window.getSB === 'function') ? window.getSB() : null;
    if(!sb){ toast('Auth not available — please refresh', 'error'); return; }
    try{
      if(typeof window.initOAuthPostMessageListener === 'function'){ window.initOAuthPostMessageListener(); }
      const redirectTo = (typeof window.getRedirectURL === 'function') ? window.getRedirectURL() : (window.location.origin + window.location.pathname);
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events',
          ].join(' '),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        }
      });
      if(error) throw error;
      if(!data?.url){ toast('Could not start Google OAuth', 'error'); return; }
      const feat = 'width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes';
      const w = window.open(data.url, 'fluxGoogleOAuth', feat);
      if(!w){ window.location.href = data.url; return; }
      try{ w.focus(); }catch(e){}
      toast('Approve Google Calendar access in the pop-up', 'info');
    } catch(e){
      console.error('[flux-gcal] oauth error', e);
      toast('Sign-in failed: ' + (e.message || e), 'error');
    }
  }

  // Auto-push hook: should be called right after a task is created
  async function autoPushIfEnabled(task){
    if(!isAutoOn()) return;
    if(!task || !task.date) return;
    if(!getToken()) return;
    const pushed = getPushedMap();
    if(pushed[task.id]) return;
    const res = await insertEvent(task);
    if(res.ok){
      pushed[task.id] = res.eventId;
      savePushedMap(pushed);
    } else if(res.needsScope || res.expired){
      toast('Add Google Calendar write access in Settings to auto-sync', 'warning');
    }
  }

  // Public API
  try{
    window.fluxPushTaskToGCal = pushTaskToGCal;
    window.fluxReconnectGoogleCalendarWrite = fluxReconnectGoogleCalendarWrite;
    window.fluxGCalAutoPush = { enabled: isAutoOn, enable: ()=>setAutoOn(true), disable: ()=>setAutoOn(false), toggle: ()=>{ setAutoOn(!isAutoOn()); return isAutoOn(); } };
    window.fluxGCalPushedMap = getPushedMap;
    window.fluxGCalAutoPushTask = autoPushIfEnabled;
  }catch(e){}
})();
