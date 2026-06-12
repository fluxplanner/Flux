/**
 * Flux · Staff Office Hours
 * ------------------------------------------------------------------------
 * Any staff member (teacher / counselor / admin / staff) publishes weekly
 * office / help / prep hours. Every signed-in student sees them on their
 * School panel.
 *
 *   - Staff: a card on the School (Work mode) panel to add / remove weekly
 *            slots (day, start, end, location, note).
 *   - Student: a read-only card on the School panel grouping active hours by
 *              staff member, with a quick name/subject filter.
 *
 * Storage: Supabase table public.staff_office_hours (see OFFICE-HOURS-MIGRATION.sql).
 *   Cross-user by nature, so DB-backed — RLS lets staff manage their own rows
 *   and any authenticated student read active rows. Degrades gracefully when
 *   Supabase is unavailable or the table hasn't been migrated yet.
 *
 * Integration: a debounced MutationObserver on #school re-injects the right
 *   card whenever the panel re-renders (renderSchool / renderSchoolTeacher
 *   rebuild their DOM). This avoids the classic-script window.* wrapping
 *   pitfall where bare-identifier calls bypass reassigned window functions.
 *
 * Self-contained IIFE. Exposes window.FluxOfficeHours.
 */
(function () {
  'use strict';

  var TABLE = 'staff_office_hours';
  var DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var DAY_LABEL = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri',
  };
  var DAY_FULL = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday',
  };
  var ROLE_LABEL = { teacher: 'Teacher', counselor: 'Counselor', admin: 'Admin', staff: 'Staff' };

  /* ---------- shared helpers (match flux-cowork.js conventions) ---------- */

  function enabled() {
    try {
      return window.FluxFeatureFlags
        ? !!window.FluxFeatureFlags.isEnabled('enable_office_hours', true)
        : true;
    } catch (_) { return true; }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (_) {}
    }
  }

  function getSB() {
    try { if (typeof window.getSB === 'function') return window.getSB(); } catch (_) {}
    return null;
  }

  function getCurrentUser() {
    return (typeof window.currentUser !== 'undefined' && window.currentUser) || null;
  }

  function isStaff() {
    try {
      var r = window.FluxRole;
      if (r && typeof r.isEducator === 'function') return !!r.isEducator();
      var role = (r && r.current) || '';
      return ['teacher', 'counselor', 'admin', 'staff'].indexOf(role) !== -1;
    } catch (_) { return false; }
  }

  function myIdentity() {
    var u = getCurrentUser();
    var prof = (window.FluxRole && window.FluxRole.profile) || {};
    var name = prof.display_name
      || (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name))
      || (u && u.email && u.email.split('@')[0])
      || 'Staff';
    var role = prof.role || (window.FluxRole && window.FluxRole.current) || 'staff';
    if (['teacher', 'counselor', 'admin', 'staff'].indexOf(role) === -1) role = 'staff';
    return {
      id: u && u.id,
      name: name,
      role: role,
      subject: prof.subject || '',
    };
  }

  /* ---------- pure helpers (unit-testable) ---------- */

  // '15:30' -> '3:30 PM'. Defensive against junk.
  function fmtTime(hhmm) {
    var s = String(hhmm == null ? '' : hhmm).trim();
    var m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return s;
    var h = parseInt(m[1], 10);
    var min = m[2];
    if (isNaN(h) || h < 0 || h > 23) return s;
    var ap = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + min + ' ' + ap;
  }

  function timeRange(a, b) {
    var s = fmtTime(a);
    var e = fmtTime(b);
    return e ? s + ' – ' + e : s;
  }

  function minutesOf(hhmm) {
    var m = String(hhmm == null ? '' : hhmm).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return 1e9; // unparseable sorts last
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  // Sort a flat slot list by day order then start time.
  function sortSlots(slots) {
    return (slots || []).slice().sort(function (a, b) {
      var da = DAYS.indexOf(a.day_of_week), db = DAYS.indexOf(b.day_of_week);
      if (da !== db) return da - db;
      return minutesOf(a.start_time) - minutesOf(b.start_time);
    });
  }

  // Group active slots by staff_id for the student view.
  function groupByStaff(slots) {
    var map = {};
    var order = [];
    (slots || []).forEach(function (s) {
      var key = s.staff_id || s.staff_name || '?';
      if (!map[key]) {
        map[key] = {
          id: key,
          name: s.staff_name || 'Staff',
          role: s.staff_role || 'staff',
          subject: s.staff_subject || '',
          slots: [],
        };
        order.push(key);
      }
      map[key].slots.push(s);
    });
    order.sort(function (a, b) {
      return String(map[a].name).toLowerCase().localeCompare(String(map[b].name).toLowerCase());
    });
    return order.map(function (k) {
      map[k].slots = sortSlots(map[k].slots);
      return map[k];
    });
  }

  function validSlot(s) {
    if (!s) return false;
    if (DAYS.indexOf(s.day_of_week) === -1) return false;
    if (!/^\d{1,2}:\d{2}$/.test(String(s.start_time || ''))) return false;
    if (!/^\d{1,2}:\d{2}$/.test(String(s.end_time || ''))) return false;
    if (minutesOf(s.end_time) <= minutesOf(s.start_time)) return false;
    return true;
  }

  /* ---------- data layer ---------- */

  var _studentCache = { at: 0, rows: null };
  var STUDENT_TTL = 60000;

  function tableMissing(err) {
    // Postgres undefined_table = 42P01; PostgREST surfaces it in .code/.message.
    if (!err) return false;
    var code = err.code || '';
    var msg = String(err.message || err.hint || '');
    return code === '42P01' || /relation .* does not exist|could not find the table/i.test(msg);
  }

  function fetchMine() {
    var sb = getSB(); var u = getCurrentUser();
    if (!sb || !u) return Promise.resolve({ rows: [], reason: 'offline' });
    return sb.from(TABLE).select('*').eq('staff_id', u.id)
      .then(function (res) {
        if (res.error) return { rows: [], reason: tableMissing(res.error) ? 'no_table' : 'error', error: res.error };
        return { rows: res.data || [], reason: null };
      })
      .catch(function (e) { return { rows: [], reason: 'error', error: e }; });
  }

  function fetchAllActive(force) {
    var now = Date.now();
    if (!force && _studentCache.rows && (now - _studentCache.at) < STUDENT_TTL) {
      return Promise.resolve({ rows: _studentCache.rows, reason: null });
    }
    var sb = getSB();
    if (!sb) return Promise.resolve({ rows: [], reason: 'offline' });
    return sb.from(TABLE).select('*').eq('is_active', true).limit(500)
      .then(function (res) {
        if (res.error) return { rows: [], reason: tableMissing(res.error) ? 'no_table' : 'error', error: res.error };
        _studentCache = { at: now, rows: res.data || [] };
        return { rows: res.data || [], reason: null };
      })
      .catch(function (e) { return { rows: [], reason: 'error', error: e }; });
  }

  function addSlot(slot) {
    var sb = getSB(); var ident = myIdentity();
    if (!sb || !ident.id) { toast('Sign in to publish office hours', 'warning'); return Promise.resolve(false); }
    var row = {
      staff_id: ident.id,
      staff_name: ident.name,
      staff_role: ident.role,
      staff_subject: ident.subject || null,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      location: slot.location || null,
      note: slot.note || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    return sb.from(TABLE).upsert(row, { onConflict: 'staff_id,day_of_week,start_time' })
      .then(function (res) {
        if (res.error) {
          toast(tableMissing(res.error) ? 'Office Hours table not set up yet — run the migration.' : (res.error.message || 'Could not save'), 'error');
          return false;
        }
        _studentCache.rows = null;
        return true;
      })
      .catch(function (e) { toast(e.message || 'Could not save', 'error'); return false; });
  }

  function deleteSlot(id) {
    var sb = getSB(); var u = getCurrentUser();
    if (!sb || !u || !id) return Promise.resolve(false);
    return sb.from(TABLE).delete().eq('id', id).eq('staff_id', u.id)
      .then(function (res) {
        if (res.error) { toast(res.error.message || 'Could not remove', 'error'); return false; }
        _studentCache.rows = null;
        return true;
      })
      .catch(function (e) { toast(e.message || 'Could not remove', 'error'); return false; });
  }

  /* ---------- bookings ---------- */

  var BOOK_TABLE = 'office_hour_bookings';
  var DAY_NUM = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };

  // Next calendar occurrence of a slot: today counts while the slot hasn't
  // ended yet; otherwise the next matching weekday.
  function nextOccurrence(slot, nowDate) {
    var now = nowDate ? new Date(nowDate) : new Date();
    var target = DAY_NUM[slot.day_of_week];
    if (!target) return null;
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var delta = (target - d.getDay() + 7) % 7;
    if (delta === 0) {
      var nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= minutesOf(slot.end_time)) delta = 7;
    }
    d.setDate(d.getDate() + delta);
    return d;
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Monday of the week containing d (weekend rolls forward to next Monday).
  function mondayOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = x.getDay();
    x.setDate(x.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
    return isoDate(x);
  }

  function fmtShortDate(d) {
    try { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (_) { return isoDate(d); }
  }

  // weeks: array of ISO mondays → { '<week>': Set(slotIds) } or null when the
  // backend can't tell us (missing rpc / old deploy) — then nothing is hidden.
  function fetchBookedSlotIds(weeks) {
    var sb = getSB();
    if (!sb || typeof sb.rpc !== 'function') return Promise.resolve(null);
    var uniq = []; (weeks || []).forEach(function (w) { if (w && uniq.indexOf(w) === -1) uniq.push(w); });
    if (!uniq.length) return Promise.resolve({});
    return Promise.all(uniq.map(function (w) {
      return sb.rpc('get_booked_slots', { p_week_start: w })
        .then(function (res) { return { w: w, ids: res.error ? null : (res.data || []).map(function (r) { return r.slot_id || r; }) }; })
        .catch(function () { return { w: w, ids: null }; });
    })).then(function (parts) {
      var out = {}; var anyKnown = false;
      parts.forEach(function (p) { if (p.ids) { anyKnown = true; out[p.w] = {}; p.ids.forEach(function (id) { out[p.w][id] = 1; }); } });
      return anyKnown ? out : null;
    });
  }

  function fetchMyBookings() {
    var sb = getSB(); var u = getCurrentUser();
    if (!sb || !u) return Promise.resolve([]);
    return sb.from(BOOK_TABLE).select('*').eq('student_id', u.id)
      .then(function (res) { return res.error ? [] : (res.data || []); })
      .catch(function () { return []; });
  }

  function fetchSlotBookings(slotIds) {
    var sb = getSB();
    if (!sb || !slotIds || !slotIds.length) return Promise.resolve([]);
    var q = sb.from(BOOK_TABLE).select('*');
    if (typeof q.in !== 'function') return Promise.resolve([]);
    return q.in('slot_id', slotIds)
      .then(function (res) { return res.error ? [] : (res.data || []); })
      .catch(function () { return []; });
  }

  function bookSlot(slot, weekISO) {
    var sb = getSB(); var u = getCurrentUser();
    if (!sb || !u) { toast('Sign in to book office hours', 'warning'); return Promise.resolve(false); }
    var name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || '').split('@')[0] || 'Student';
    return sb.from(BOOK_TABLE).insert({ slot_id: slot.id, student_id: u.id, student_name: name, week_start: weekISO })
      .then(function (res) {
        if (res.error) {
          var dup = res.error.code === '23505' || /duplicate|unique/i.test(res.error.message || '');
          toast(dup ? 'Just taken — another student booked this slot.' : (tableMissing(res.error) ? 'Booking isn’t set up yet — ask your school to run the latest migration.' : (res.error.message || 'Could not book')), dup ? 'warning' : 'error');
          return false;
        }
        return true;
      })
      .catch(function (e) { toast(e.message || 'Could not book', 'error'); return false; });
  }

  function cancelBooking(id) {
    var sb = getSB(); var u = getCurrentUser();
    if (!sb || !u || !id) return Promise.resolve(false);
    return sb.from(BOOK_TABLE).delete().eq('id', id)
      .then(function (res) { return !res.error; })
      .catch(function () { return false; });
  }

  /* ---------- staff card (set hours) ---------- */

  function timeOptions(sel) {
    var out = '<option value="">--</option>';
    for (var h = 6; h <= 20; h++) {
      ['00', '15', '30', '45'].forEach(function (mm) {
        var v = (h < 10 ? '0' + h : h) + ':' + mm;
        out += '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(fmtTime(v)) + '</option>';
      });
    }
    return out;
  }

  function staffCardHtml(slots, reason, bookings) {
    var sorted = sortSlots(slots);
    var bkBySlot = {};
    var curWeek = mondayOf(new Date());
    (bookings || []).forEach(function (b) {
      if (b.week_start >= curWeek) (bkBySlot[b.slot_id] = bkBySlot[b.slot_id] || []).push(b);
    });
    var listHtml;
    if (reason === 'no_table') {
      listHtml = '<div class="flux-oh-empty">Office Hours storage isn’t set up yet. Ask the owner to run <code>OFFICE-HOURS-MIGRATION.sql</code>.</div>';
    } else if (reason === 'offline') {
      listHtml = '<div class="flux-oh-empty">Sign in with your school account to publish office hours students can see.</div>';
    } else if (!sorted.length) {
      listHtml = '<div class="flux-oh-empty">No availability yet. Add your first slot below — students see it instantly and can book it.</div>';
    } else {
      var lastDay = null;
      listHtml = sorted.map(function (s) {
        var meta = [s.location, s.note].filter(Boolean).map(esc).join(' · ');
        var dayHead = '';
        if (s.day_of_week !== lastDay) {
          lastDay = s.day_of_week;
          dayHead = '<div class="flux-oh-dayhead">' + esc(DAY_FULL[s.day_of_week] || s.day_of_week) + '</div>';
        }
        var bks = (bkBySlot[s.id] || []).sort(function (a, b2) { return a.week_start < b2.week_start ? -1 : 1; });
        var bkHtml = bks.length
          ? '<div class="flux-oh-row-bks">' + bks.map(function (b) {
              return '<span class="flux-oh-bk" title="Booked">' + esc(b.student_name || 'Student') + ' · ' + esc(b.week_start) + '</span>';
            }).join('') + '</div>'
          : '';
        return dayHead + '<div class="flux-oh-row" data-oh-id="' + esc(s.id) + '">'
          + '<div class="flux-oh-row-main">'
          + '<div class="flux-oh-row-time">' + esc(timeRange(s.start_time, s.end_time))
          + (bks.length ? '<span class="flux-oh-row-bkcount">' + bks.length + ' booked</span>' : '<span class="flux-oh-row-open">open</span>')
          + '</div>'
          + (meta ? '<div class="flux-oh-row-meta">' + meta + '</div>' : '')
          + bkHtml
          + '</div>'
          + '<button type="button" class="flux-oh-del" data-oh-del="' + esc(s.id) + '" aria-label="Remove slot" title="Remove">✕</button>'
          + '</div>';
      }).join('');
    }

    var disabled = (reason === 'no_table' || reason === 'offline') ? ' disabled' : '';
    return ''
      + '<div class="card flux-oh-card" id="fluxOfficeHoursStaffCard">'
      + '<div class="flux-oh-head">'
      +   '<h3 style="margin:0">Availability</h3>'
      +   '<span class="flux-oh-badge">Students see &amp; book these</span>'
      + '</div>'
      + '<p class="flux-oh-sub">Weekly drop-in times. One student can book each slot per week — booked slots disappear for everyone else.</p>'
      + '<div class="flux-oh-list">' + listHtml + '</div>'
      + '<div class="flux-oh-form">'
      +   '<div class="flux-oh-form-label">Add a weekly slot</div>'
      +   '<input type="hidden" id="fluxOhDay" value="monday">'
      +   '<div class="flux-oh-daychips" role="group" aria-label="Day of week">'
      +     DAYS.map(function (d, i) { return '<button type="button" class="flux-oh-daychip' + (i === 0 ? ' active' : '') + '" data-oh-daychip="' + d + '"' + disabled + '>' + esc(DAY_LABEL[d]) + '</button>'; }).join('')
      +   '</div>'
      +   '<div class="flux-oh-form-grid">'
      +     '<label class="flux-oh-field"><span>From</span><select id="fluxOhStart"' + disabled + '>' + timeOptions('15:00') + '</select></label>'
      +     '<label class="flux-oh-field"><span>To</span><select id="fluxOhEnd"' + disabled + '>' + timeOptions('15:30') + '</select></label>'
      +     '<label class="flux-oh-field flux-oh-field--wide"><span>Location</span><input id="fluxOhLoc" type="text" maxlength="80" placeholder="Room 204, Library…"' + disabled + '></label>'
      +   '</div>'
      +   '<div class="flux-oh-form-grid">'
      +     '<label class="flux-oh-field flux-oh-field--wide"><span>Note (optional)</span><input id="fluxOhNote" type="text" maxlength="120" placeholder="e.g. College apps, math help, drop-in"' + disabled + '></label>'
      +     '<button type="button" class="flux-oh-add-btn" id="fluxOhAddBtn"' + disabled + '>Publish slot</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  function wireStaffCard(card) {
    if (!card) return;
    card.querySelectorAll('[data-oh-daychip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        card.querySelectorAll('[data-oh-daychip]').forEach(function (c) { c.classList.toggle('active', c === chip); });
        var hidden = card.querySelector('#fluxOhDay');
        if (hidden) hidden.value = chip.getAttribute('data-oh-daychip');
      });
    });
    card.querySelectorAll('[data-oh-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-oh-del');
        btn.disabled = true;
        deleteSlot(id).then(function (ok) {
          if (ok) { toast('Office hours updated', 'success'); refreshStaff(card); }
          else btn.disabled = false;
        });
      });
    });
    var addBtn = card.querySelector('#fluxOhAddBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var slot = {
          day_of_week: (card.querySelector('#fluxOhDay') || {}).value,
          start_time: (card.querySelector('#fluxOhStart') || {}).value,
          end_time: (card.querySelector('#fluxOhEnd') || {}).value,
          location: (card.querySelector('#fluxOhLoc') || {}).value,
          note: (card.querySelector('#fluxOhNote') || {}).value,
        };
        if (!validSlot(slot)) {
          toast('Pick a day and an end time later than the start time', 'warning');
          return;
        }
        addBtn.disabled = true;
        addSlot(slot).then(function (ok) {
          addBtn.disabled = false;
          if (ok) { toast('Office hours published', 'success'); refreshStaff(card); }
        });
      });
    }
  }

  function refreshStaff(card) {
    fetchMine().then(function (res) {
      var ids = (res.rows || []).map(function (s) { return s.id; }).filter(Boolean);
      fetchSlotBookings(ids).then(function (bookings) {
        var fresh = document.getElementById('fluxOfficeHoursStaffCard');
        if (!fresh) return;
        var tmp = document.createElement('div');
        tmp.innerHTML = staffCardHtml(res.rows, res.reason, bookings);
        var next = tmp.firstChild;
        fresh.parentNode.replaceChild(next, fresh);
        wireStaffCard(next);
      });
    });
  }

  /* ---------- student card (view hours) ---------- */

  // Day name → day_of_week key for "is this slot today?" lookup.
  // Returns null on weekends (no weekend office hours in current schema).
  function todayKey() {
    var i = (new Date()).getDay(); // 0=Sun..6=Sat
    var map = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', ''];
    return map[i] || null;
  }

  // Is the current local time within [start_time, end_time]? (Same-day only;
  // overnight slots aren't supported by the schema.)
  function isLiveNow(slot) {
    if (slot.day_of_week !== todayKey()) return false;
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    return minutesOf(slot.start_time) <= nowMin && nowMin < minutesOf(slot.end_time);
  }

  // Promote any group with a "live now" slot to the top; otherwise alpha order.
  function withLivePriority(groups) {
    var hot = [], cool = [];
    (groups || []).forEach(function (g) {
      var anyLive = g.slots.some(isLiveNow);
      g._anyLive = anyLive;
      (anyLive ? hot : cool).push(g);
    });
    return hot.concat(cool);
  }

  function studentCardHtml(groups, reason, bk) {
    bk = bk || { mine: {}, taken: null, canBook: false };
    var body;
    if (reason === 'no_table' || reason === 'offline') {
      // Quietly render nothing meaningful — don't nag students about backend setup.
      body = '<div class="flux-oh-empty">No staff office hours have been published yet.</div>';
    } else if (!groups.length) {
      body = '<div class="flux-oh-empty">No staff office hours have been published yet. Check back soon.</div>';
    } else {
      var prioritized = withLivePriority(groups);
      var today = todayKey();
      body = prioritized.map(function (g) {
        var sub = [ROLE_LABEL[g.role] || 'Staff', g.subject].filter(Boolean).map(esc).join(' · ');
        var livePill = g._anyLive ? '<span class="flux-oh-live-pill" title="Available right now">● LIVE NOW</span>' : '';
        var rows = g.slots.map(function (s) {
          var occ = nextOccurrence(s);
          var wk = occ ? mondayOf(occ) : null;
          var mine = wk ? bk.mine[s.id + '|' + wk] : null;
          // Booked by someone else → other students don't see the slot at all.
          if (!mine && wk && bk.taken && bk.taken[wk] && bk.taken[wk][s.id]) return '';
          var meta = [s.location, s.note].filter(Boolean).map(esc).join(' · ');
          var live = isLiveNow(s);
          var todayCls = (today && s.day_of_week === today) ? ' is-today' : '';
          var liveCls = live ? ' is-live' : '';
          var todayBadge = (today && s.day_of_week === today && !live) ? '<span class="flux-oh-today-badge">TODAY</span>' : '';
          var liveBadge = live ? '<span class="flux-oh-live-badge">NOW</span>' : '';
          var bookUi = '';
          if (mine) {
            bookUi = '<span class="flux-oh-booked-badge">Booked · ' + esc(fmtShortDate(occ)) + '</span>'
              + '<button type="button" class="flux-oh-cancel-btn" data-oh-cancel="' + esc(mine.id) + '">Cancel</button>';
          } else if (bk.canBook && wk) {
            bookUi = '<button type="button" class="flux-oh-book-btn" data-oh-book="' + esc(s.id) + '" data-oh-week="' + esc(wk) + '">Book · ' + esc(fmtShortDate(occ)) + '</button>';
          }
          return '<div class="flux-oh-srow' + todayCls + liveCls + (mine ? ' is-mine' : '') + '">'
            + '<span class="flux-oh-srow-day">' + esc(DAY_LABEL[s.day_of_week] || s.day_of_week) + '</span>'
            + '<span class="flux-oh-srow-time">' + esc(timeRange(s.start_time, s.end_time)) + '</span>'
            + liveBadge + todayBadge
            + (meta ? '<span class="flux-oh-srow-meta">' + meta + '</span>' : '')
            + (bookUi ? '<span class="flux-oh-srow-book">' + bookUi + '</span>' : '')
            + '</div>';
        }).join('');
        if (!rows) return ''; // every slot this week is taken — hide the group
        return '<div class="flux-oh-staff' + (g._anyLive ? ' is-live' : '') + '" data-oh-search="' + esc((g.name + ' ' + g.subject).toLowerCase()) + '">'
          + '<div class="flux-oh-staff-head">'
          +   '<span class="flux-oh-avatar" aria-hidden="true">' + esc(initials(g.name)) + '</span>'
          +   '<div style="flex:1;min-width:0"><div class="flux-oh-staff-name">' + esc(g.name) + livePill + '</div>'
          +   (sub ? '<div class="flux-oh-staff-sub">' + sub + '</div>' : '') + '</div>'
          + '</div>'
          + '<div class="flux-oh-staff-slots">' + rows + '</div>'
          + '</div>';
      }).join('') || '<div class="flux-oh-empty">All published slots are booked this week — check back next week.</div>';
    }

    var showFilter = groups.length > 3;
    return ''
      + '<div class="card flux-oh-card" id="fluxOfficeHoursStudentCard">'
      + '<div class="flux-oh-head">'
      +   '<h3 style="margin:0">Staff office hours</h3>'
      +   (groups.length ? '<span class="flux-oh-badge flux-oh-badge--count">' + groups.length + ' staff</span>' : '')
      + '</div>'
      + '<p class="flux-oh-sub">When teachers, counselors, and staff are available for drop-in help.</p>'
      + (showFilter ? '<input type="search" class="flux-oh-search" id="fluxOhSearch" placeholder="Filter by name or subject…" autocomplete="off">' : '')
      + '<div class="flux-oh-staff-list" id="fluxOhStaffList">' + body + '</div>'
      + '</div>';
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
  }

  var _slotById = {};

  function wireStudentCard(card) {
    if (!card) return;
    var search = card.querySelector('#fluxOhSearch');
    if (search) {
      search.addEventListener('input', function () {
        var q = this.value.trim().toLowerCase();
        card.querySelectorAll('[data-oh-search]').forEach(function (el) {
          var hay = el.getAttribute('data-oh-search') || '';
          el.style.display = (!q || hay.indexOf(q) !== -1) ? '' : 'none';
        });
      });
    }
    card.addEventListener('click', function (ev) {
      var bookBtn = ev.target.closest('[data-oh-book]');
      if (bookBtn) {
        var slot = _slotById[bookBtn.getAttribute('data-oh-book')];
        var wk = bookBtn.getAttribute('data-oh-week');
        if (!slot || !wk) return;
        bookBtn.disabled = true;
        bookSlot(slot, wk).then(function (ok) {
          if (ok) toast('Booked — it’s yours. It’s now hidden from other students.', 'success');
          refreshStudent(card);
        });
        return;
      }
      var cancelBtn = ev.target.closest('[data-oh-cancel]');
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBooking(cancelBtn.getAttribute('data-oh-cancel')).then(function (ok) {
          if (ok) toast('Booking cancelled', 'info');
          refreshStudent(card);
        });
      }
    });
  }

  function refreshStudent(card) {
    fetchAllActive(false).then(function (res) {
      var slots = (res.rows || []).filter(function (r) { return validSlot(r); });
      _slotById = {};
      var weeks = [];
      slots.forEach(function (s) {
        _slotById[s.id] = s;
        var occ = nextOccurrence(s);
        if (occ) weeks.push(mondayOf(occ));
      });
      Promise.all([fetchBookedSlotIds(weeks), fetchMyBookings()]).then(function (r2) {
        var taken = r2[0];
        var mine = {};
        (r2[1] || []).forEach(function (b) { mine[b.slot_id + '|' + b.week_start] = b; });
        var canBook = !!getSB() && !!getCurrentUser() && !isStaff();
        var fresh = document.getElementById('fluxOfficeHoursStudentCard');
        if (!fresh) return;
        var groups = groupByStaff(slots);
        var tmp = document.createElement('div');
        tmp.innerHTML = studentCardHtml(groups, res.reason, { mine: mine, taken: taken, canBook: canBook });
        var next = tmp.firstChild;
        fresh.parentNode.replaceChild(next, fresh);
        wireStudentCard(next);
      });
    });
  }

  /* ---------- injection into #school ---------- */

  function schoolStack() {
    var panel = document.getElementById('school');
    if (!panel) return null;
    return panel.querySelector('.flux-stack') || panel;
  }

  function inject() {
    if (!enabled()) return;
    var panel = document.getElementById('school');
    if (!panel) return;
    var stack = schoolStack();
    if (!stack) return;

    if (isStaff()) {
      // Remove a stale student card if role flipped.
      var stale = document.getElementById('fluxOfficeHoursStudentCard');
      if (stale) stale.remove();
      if (document.getElementById('fluxOfficeHoursStaffCard')) return;
      var holder = document.createElement('div');
      holder.innerHTML = staffCardHtml([], null);
      var card = holder.firstChild;
      stack.appendChild(card);
      wireStaffCard(card);
      refreshStaff(card);
    } else {
      var staleStaff = document.getElementById('fluxOfficeHoursStaffCard');
      if (staleStaff) staleStaff.remove();
      if (document.getElementById('fluxOfficeHoursStudentCard')) return;
      var h2 = document.createElement('div');
      h2.innerHTML = studentCardHtml([], null);
      var card2 = h2.firstChild;
      stack.appendChild(card2);
      wireStudentCard(card2);
      refreshStudent(card2);
    }
  }

  var _t = null;
  function scheduleInject() {
    clearTimeout(_t);
    _t = setTimeout(inject, 80);
  }

  function watch() {
    var panel = document.getElementById('school');
    if (!panel || !window.MutationObserver) return;
    var mo = new MutationObserver(function () {
      // If our card is already present we no-op inside inject(), which also
      // prevents an observer feedback loop.
      if (isStaff()
        ? !document.getElementById('fluxOfficeHoursStaffCard')
        : !document.getElementById('fluxOfficeHoursStudentCard')) {
        scheduleInject();
      }
    });
    mo.observe(panel, { childList: true, subtree: true });
  }

  /* ---------- public surface + boot ---------- */

  window.FluxOfficeHours = {
    enabled: enabled,
    refresh: function () {
      _studentCache.rows = null;
      scheduleInject();
    },
    inject: inject,
    // exposed for tests
    _sortSlots: sortSlots,
    _groupByStaff: groupByStaff,
    _fmtTime: fmtTime,
    _validSlot: validSlot,
    _nextOccurrence: nextOccurrence,
    _mondayOf: mondayOf,
    _studentCardHtml: studentCardHtml,
  };

  function boot() {
    if (!enabled()) return;
    watch();
    inject();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
