import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Owner Controls (owner.html) is its own app. These tests run the real page and
 * answer its requests to the database themselves, so nothing reaches production.
 * The rules that stop anyone else using these functions live in the database and
 * are tested there. What is tested here: who the page lets in, that everything
 * from the planner is still reachable, that text other people wrote stays text,
 * and that a save cannot damage the planner's half of the shared row.
 */

const OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
const SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
const EVIL = '<img src=x onerror="window.__pwned=1">';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };

type Db = {
  row: { data: Record<string, unknown>; updated_at: string };
  calls: { rpc: string; args: Record<string, unknown> }[];
  writes: { table: string; method: string; body: unknown; url: string }[];
};

const RPC: Record<string, unknown> = {
  flux_owner_mod_summary: { bans: 2, mutes: 1, posts_24h: 3, active_24h: 4, shared_ips: 1, new_accounts_7d: 7, accounts: 28, password_help: 5, staff_waiting: 1, rooms_open: 1, lockdown: false },
  flux_owner_user_intel: [{ user_id: 'u1', username: 'a"b', display_name: EVIL, role: 'student', deleted: false, device_id: 'abc', ip: '203.0.113.9', accounts_on_ip: 4, last_seen: '2026-11-05T05:09:00Z' }],
  flux_owner_new_accounts: [{ user_id: 'u1', username: 'newbie', display_name: EVIL, role: 'student', created_at: '2026-11-05T05:09:00Z' }],
  flux_owner_study_rooms: [{ id: 'r1', code: 'ABC', label: EVIL, participants: 2, active: true, host_id: 'u1', host_username: 'host' }],
  flux_owner_person: { user_id: 'u1', account: { username: 'jo', created_at: '2026-11-05T05:09:00Z' }, profile: { display_name: EVIL, role: 'student' }, sightings: [{ device_id: 'abc', ip: '203.0.113.9', accounts_on_ip: 1, user_agent: EVIL }], posts: [{ source: 'school_feed', source_id: 'p1', action: 'INSERT', content: { title: EVIL } }], bans: [], actions: [{ kind: 'warning', detail: EVIL, created_at: '2026-11-05T05:09:00Z' }] },
  flux_owner_find_user: 'u1',
  flux_owner_ban: 'ban-id',
  flux_owner_remove_content: 1,
  flux_owner_set_lockdown: { on: true },
  flux_owner_save_report: {},
};

const TABLES: Record<string, unknown[]> = {
  flux_public_content_log: [
    { id: 1, source: 'school_feed', source_id: 'p1', action: 'INSERT', created_at: '2026-11-05T05:09:00Z', author_id: 'u1', author_label: EVIL, author_ip: '203.0.113.9', content: { title: EVIL, body: 'buy cheats here' } },
    { id: 2, source: 'platform_settings', source_id: 'ui', action: 'UPDATE', created_at: '2026-11-05T05:09:00Z', content: { key: 'ui' } },
  ],
  flux_password_help: [{ id: 'h1', username: 'jo', note: EVIL, handled: false, created_at: '2026-11-05T05:09:00Z' }],
  flux_bans: [],
  flux_reported_users: [],
  flux_mod_actions: [],
  flux_hidden_apps: [],
  staff_verification_requests: [],
  staff_directory: [],
  owner_direct_messages: [],
  platform_settings: [],
  flux_feature_flags: [],
};

/**
 * mfa: 'fresh' is a session that entered an authenticator code a minute ago (the
 * normal state once Owner Controls has opened); 'needed' has an authenticator but
 * only a password this session; 'none' has never set one up.
 */
async function setup(page: Page, opts: { uid?: string | null; mfa?: 'fresh' | 'needed' | 'none' } = {}) {
  const uid = opts.uid === undefined ? OWNER_UID : opts.uid;
  const mfa = opts.mfa || 'fresh';
  const factors = mfa === 'none' ? [] : [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'phone', created_at: '', updated_at: '' }];
  const db: Db = {
    row: {
      updated_at: '2026-11-01T00:00:00+00:00',
      data: {
        tasks: [{ id: 1, name: 'My planner task', done: true }, { id: 2, name: 'Open task', done: false }],
        notes: [{ id: 9, body: 'keep me' }],
        platformConfig: { modWatchWords: ['cheats'] },
        devAccounts: [],
        ownerAuditLog: [],
        feedbackInbox: [{ id: 'f1', t: Date.now(), message: EVIL, fromEmail: 'a@b.c' }],
        feedbackTombstones: [],
      },
    },
    calls: [],
    writes: [],
  };

  await page.route('**/*.supabase.co/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') {
      return uid ? json({ id: uid, aud: 'authenticated', role: 'authenticated', email: 'someone@users.fluxplanner.app', factors }) : json({ message: 'no session' }, 401);
    }
    if (url.pathname.startsWith('/functions/v1/release-admin')) return json({ ok: true, gate: null });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop() as string;
      db.calls.push({ rpc: name, args: req.postDataJSON() || {} });
      return json(name in RPC ? RPC[name] : null);
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (req.method() !== 'GET' && req.method() !== 'HEAD') db.writes.push({ table, method: req.method(), body: req.postDataJSON(), url: req.url() });
    if (table === 'user_data') {
      if (req.method() === 'PATCH') {
        const want = decodeURIComponent(url.searchParams.get('updated_at') || '').replace(/^eq\./, '');
        if (want !== db.row.updated_at) return json([]);
        const body = req.postDataJSON();
        db.row = { data: body.data, updated_at: body.updated_at };
        return json([{ updated_at: body.updated_at }]);
      }
      return json(db.row);
    }
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${(TABLES[table] || []).length}` } });
    }
    const single = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (req.method() === 'GET') return single ? json((TABLES[table] || [])[0] || null) : json(TABLES[table] || []);
    return json([{ id: 'x', app_id: 'synara' }], 201);
  });

  await page.addInitScript(([key, id, fresh]) => {
    if (!id) return;
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400;
    const assurance = fresh
      ? { aal: 'aal2', amr: [{ method: 'totp', timestamp: now - 60 }, { method: 'password', timestamp: now - 90 }] }
      : { aal: 'aal1', amr: [{ method: 'password', timestamp: now - 90 }] };
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, role: 'authenticated', session_id: 's1', ...assurance })}.sig`;
    localStorage.setItem(key as string, JSON.stringify({
      access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp,
      user: { id, aud: 'authenticated', role: 'authenticated', email: 'someone@users.fluxplanner.app' },
    }));
  }, [SESSION_KEY, uid, mfa === 'fresh'] as const);
  return db;
}

const open = async (page: Page, hash = '') => {
  await page.goto('/owner.html' + hash);
  await expect(page.locator('#ownerSuite')).toBeVisible();
};

test.describe('who gets in', () => {
  test('someone signed out is sent to sign in', async ({ page }) => {
    await setup(page, { uid: null });
    await page.goto('/owner.html');
    await expect(page.locator('#ownerGate')).toContainText('Sign in first');
    await expect(page.locator('#ownerSuite')).toHaveCount(0);
  });

  test('any other account is turned away, whatever the browser claims', async ({ page }) => {
    await setup(page, { uid: 'not-the-owner' });
    await page.goto('/owner.html');
    await expect(page.locator('#ownerGate')).toContainText('This page is private');
    await expect(page.locator('#ownerSuite')).toHaveCount(0);
  });

  test('a session forged in the browser does not pass the server check', async ({ page }) => {
    const db = await setup(page, { uid: 'not-the-owner' });
    await page.addInitScript(([key, id]) => {
      const raw = JSON.parse(localStorage.getItem(key as string) || '{}');
      raw.user.id = id;
      localStorage.setItem(key as string, JSON.stringify(raw));
    }, [SESSION_KEY, OWNER_UID]);
    await page.goto('/owner.html');
    await expect(page.locator('#ownerGate')).toContainText('This page is private');
    expect(db.writes).toEqual([]);
  });

  test('the owner with only a password is asked for an authenticator code first', async ({ page }) => {
    const db = await setup(page, { mfa: 'needed' });
    await page.goto('/owner.html');
    await expect(page.locator('#ownerGate h1')).toHaveText('Enter your code');
    await expect(page.locator('#ownerSuite')).toHaveCount(0);
    expect(db.calls).toEqual([]);
  });

  test('the owner without an authenticator is made to set one up', async ({ page }) => {
    await setup(page, { mfa: 'none' });
    await page.route('**/auth/v1/factors', (route) => route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ id: 'f1', type: 'totp', friendly_name: 'x', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://x' } }),
    }));
    await page.goto('/owner.html');
    await expect(page.locator('#ownerGate h1')).toHaveText('Set up two-step sign-in');
    await expect(page.locator('#ownerSuite')).toHaveCount(0);
  });
});

test.describe('the Flux Suite tab', () => {
  test('the owner sees an Owner Controls tab that opens the app', async ({ page }) => {
    await setup(page);
    await page.goto('/suite.html');
    await page.getByRole('tab', { name: /Owner Controls/ }).click();
    await page.locator('#apps-owner a.app').click();
    await expect(page).toHaveURL(/\/owner/);
    await expect(page.locator('.os-head__name')).toHaveText('Owner Controls');
  });

  test('nobody else sees it', async ({ page }) => {
    await setup(page, { uid: 'not-the-owner' });
    await page.goto('/suite.html');
    await expect(page.getByRole('tab', { name: /Partners/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Owner Controls/ })).toHaveCount(0);
    await expect(page.locator('a[href="owner.html"]')).toHaveCount(0);
  });
});

test.describe('the app', () => {
  test('every tab draws without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await open(page);
    const tabs = await page.locator('[data-os-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-os-tab') as string));
    for (const name of ['today', 'moderation', 'pwhelp', 'plannertabs', 'hideapps', 'release', 'auth', 'staffverify', 'nuke', 'audit', 'data', 'feedback', 'backlog', 'health', 'preview', 'team', 'testers', 'config', 'integrations', 'analytics', 'usage', 'ideas', 'megamap', 'advanced', 'overview']) {
      expect(tabs, `${name} is missing`).toContain(name);
    }
    for (const t of tabs) {
      await page.locator(`[data-os-tab="${t}"]`).click();
      await page.waitForTimeout(60);
      await expect(page.locator('#osBody'), `tab ${t}`).not.toContainText('Tab failed to render');
    }
    expect(errors).toEqual([]);
  });

  test('Today shows what needs attention and links to it', async ({ page }) => {
    await setup(page);
    await open(page);
    const help = page.getByRole('button', { name: /Password help waiting/ });
    await expect(help).toContainText('5');
    await expect(page.getByRole('button', { name: /Watch-word matches/ })).toContainText('1');
    await expect(page.locator('#osBadge-pwhelp')).toHaveText('1');
    await help.click();
    await expect(page.locator('#osBody')).toContainText('Password help');
    await expect(page).toHaveURL(/#pwhelp/);
  });

  test('a link to one tab opens that tab', async ({ page }) => {
    await setup(page);
    await open(page, '#nuke');
    await expect(page.locator('#osBody')).toContainText('Nuke Controls');
  });

  test('saving changes only the owner settings and never the planner data', async ({ page }) => {
    const db = await setup(page);
    await open(page);
    const before = JSON.stringify([db.row.data.tasks, db.row.data.notes]);
    await page.evaluate(() => (window as any).savePlatformConfig({ announcement: 'hello' }));
    await expect.poll(() => (db.row.data.platformConfig as any)?.announcement).toBe('hello');
    expect(JSON.stringify([db.row.data.tasks, db.row.data.notes])).toBe(before);
    const patch = db.writes.find((w) => w.table === 'user_data' && w.method === 'PATCH');
    expect(patch?.url, 'the write must be conditional on the row not having moved').toContain('updated_at=eq.');
  });

  test('a save that loses the race to the planner reads the row again and keeps its tasks', async ({ page }) => {
    const db = await setup(page);
    await open(page);
    // The planner saves a new task while the owner app's copy is out of date.
    await page.route('**/rest/v1/user_data**', async (route) => {
      if (route.request().method() === 'PATCH' && !(db as any).raced) {
        (db as any).raced = true;
        db.row = { updated_at: '2026-11-02T00:00:00+00:00', data: { ...db.row.data, tasks: [{ id: 3, name: 'Added on the phone' }] } };
      }
      return route.fallback();
    });
    await page.evaluate(() => (window as any).savePlatformConfig({ announcement: 'race' }));
    await expect.poll(() => (db.row.data.platformConfig as any)?.announcement).toBe('race');
    expect(db.row.data.tasks).toEqual([{ id: 3, name: 'Added on the phone' }]);
  });

  test('the feedback inbox shows hostile text as text, and dismissing sticks', async ({ page }) => {
    const db = await setup(page);
    await open(page, '#feedback');
    await expect(page.locator('#osBody')).toContainText(EVIL);
    await expect(page.locator('#osBody img')).toHaveCount(0);
    await page.getByRole('button', { name: /Dismiss/i }).first().click();
    await expect.poll(() => db.row.data.feedbackTombstones).toEqual(['f1']);
    expect(db.row.data.feedbackInbox).toEqual([]);
  });

  test('Switch to staff goes to the planner in a preview', async ({ page }) => {
    await setup(page);
    await open(page);
    await page.evaluate(() => {
      const w = window as any;
      w.FluxStaffDirectory.findByEmail = () => ({ role: 'teacher', name: 'T', email: 't@x.y' });
      w.ownerPreviewSwitch('t@x.y');
    });
    await page.waitForURL((u) => !u.pathname.includes('owner'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flux_owner_impersonate') || '{}').email)).toBe('t@x.y');
  });

  test('hiding an app reaches the database, and this app cannot be hidden', async ({ page }) => {
    const db = await setup(page);
    await open(page, '#hideapps');
    const panel = page.locator('#osHiddenApps');
    await expect(panel.getByRole('switch', { name: 'Flux Planner visible' })).toHaveCount(0);
    await expect(panel.getByRole('switch', { name: 'Flux Owner Controls visible' })).toHaveCount(0);
    await panel.getByRole('switch', { name: 'Synara visible' }).click();
    await expect.poll(() => db.writes.some((w) => w.table === 'flux_hidden_apps' && w.method === 'POST')).toBe(true);
  });

  test('works on a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setup(page);
    await open(page);
    await expect(page.getByRole('button', { name: /Password help waiting/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('moderation', () => {
  const mod = async (page: Page, view: string) => {
    await open(page, '#moderation');
    await page.locator(`[data-view=${view}]`).click();
  };
  const fill = async (page: Page, confirm: string, text: string, hours?: string) => {
    const box = page.locator('dialog.own-dialog');
    await box.locator('textarea').fill(text);
    if (hours) await box.locator('select').selectOption(hours);
    await box.getByRole('button', { name: confirm }).click();
  };

  test('the archive shows hostile posts as plain text and marks watch words', async ({ page }) => {
    await setup(page);
    await open(page, '#moderation');
    const body = page.locator('#fluxModBody');
    await expect(body).toContainText(EVIL);
    await expect(body).toContainText('Matches “cheats”');
    await expect(body.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
  });

  test('the archive can be searched and filtered', async ({ page }) => {
    await setup(page);
    await open(page, '#moderation');
    await page.locator('#modArchiveFlagged').check();
    await expect(page.locator('#modArchiveList .own-card')).toHaveCount(1);
    await page.locator('#modArchiveFlagged').uncheck();
    await page.locator('#modArchiveQ').fill('nothing like this');
    await expect(page.locator('#modArchiveList')).toContainText('Nothing matches');
  });

  test('a live post can be taken down', async ({ page }) => {
    const db = await setup(page);
    await open(page, '#moderation');
    await page.getByRole('button', { name: 'Take down' }).click();
    await fill(page, 'Take down', 'spam');
    await expect.poll(() => db.calls.find((c) => c.rpc === 'flux_owner_remove_content')?.args).toEqual({ p_source: 'school_feed', p_id: 'p1', p_reason: 'spam' });
  });

  test('people view warns about shared addresses and offers every action', async ({ page }) => {
    await setup(page);
    await mod(page, 'people');
    const body = page.locator('#fluxModBody');
    await expect(body).toContainText('shared by 4 accounts');
    for (const label of ['Open file', 'Warn', 'Turn off posting', 'Ban account', 'Ban IP', 'Ban device', 'Save to report']) {
      await expect(body.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(body.locator('img')).toHaveCount(0);
  });

  test('a timed ban sends an end time and leaves the account able to return', async ({ page }) => {
    const db = await setup(page);
    await mod(page, 'people');
    await page.getByRole('button', { name: 'Ban account' }).click();
    await fill(page, 'Ban', 'spamming', '24');
    await expect.poll(() => db.calls.find((c) => c.rpc === 'flux_owner_ban')?.args.p_reason).toBe('spamming');
    const args = db.calls.find((c) => c.rpc === 'flux_owner_ban')!.args;
    expect(args.p_kind).toBe('user');
    const hours = (new Date(args.p_expires as string).getTime() - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
  });

  test('turning off posting uses a mute, not a ban', async ({ page }) => {
    const db = await setup(page);
    await mod(page, 'people');
    await page.getByRole('button', { name: 'Turn off posting' }).click();
    await fill(page, 'Turn off posting', 'off topic');
    await expect.poll(() => db.calls.find((c) => c.rpc === 'flux_owner_ban')?.args.p_kind).toBe('mute');
    expect(db.calls.find((c) => c.rpc === 'flux_owner_ban')?.args.p_expires).toBeNull();
  });

  test('a warning reaches the person and goes on their file', async ({ page }) => {
    const db = await setup(page);
    await mod(page, 'people');
    await page.getByRole('button', { name: 'Warn' }).click();
    await fill(page, 'Send warning', 'Stop posting that');
    await expect.poll(() => db.writes.some((w) => w.table === 'flux_mod_actions')).toBe(true);
    const dm = db.writes.find((w) => w.table === 'owner_direct_messages')?.body as any;
    expect(dm).toMatchObject({ recipient_id: 'u1', body: 'Stop posting that' });
  });

  test("a person's file shows everything about them as plain text", async ({ page }) => {
    await setup(page);
    await mod(page, 'people');
    await page.getByRole('button', { name: 'Open file' }).click();
    const body = page.locator('#fluxModBody');
    await expect(body).toContainText('1 warning');
    await expect(body).toContainText('Public posts');
    await expect(body).toContainText('Sign out everywhere'.slice(0, 8));
    await expect(body.locator('img')).toHaveCount(0);
  });

  test('searching a username from the header opens their file', async ({ page }) => {
    const db = await setup(page);
    await open(page);
    await page.locator('#ownFindUser').fill('@jo');
    await page.locator('#ownFindUser').press('Enter');
    await expect(page.locator('#fluxModBody')).toContainText('Addresses and devices');
    expect(db.calls.find((c) => c.rpc === 'flux_owner_find_user')?.args).toEqual({ p_username: 'jo' });
  });

  test('the lockdown switch and the other new views work', async ({ page }) => {
    const db = await setup(page);
    page.on('dialog', (d) => d.accept());
    await mod(page, 'rules');
    await page.getByRole('button', { name: 'Pause all posting' }).click();
    await expect.poll(() => db.calls.find((c) => c.rpc === 'flux_owner_set_lockdown')?.args).toEqual({ p_on: true });
    for (const [view, text] of [['newaccounts', 'newbie'], ['rooms', EVIL], ['bans', 'No active bans.'], ['reports', 'Nobody has been saved yet.'], ['log', 'Nothing recorded yet.']]) {
      await page.locator(`[data-view=${view}]`).click();
      await expect(page.locator('#fluxModBody')).toContainText(text);
      await expect(page.locator('#fluxModBody img')).toHaveCount(0);
    }
  });

  test('without the database update, the app says so instead of breaking', async ({ page }) => {
    await setup(page);
    await page.route('**/rest/v1/rpc/flux_owner_new_accounts', (route) => route.fulfill({
      status: 404, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }),
    }));
    await mod(page, 'newaccounts');
    await expect(page.locator('#fluxModBody')).toContainText('needs the database update');
  });

  test('password help shows requests and marks them handled', async ({ page }) => {
    const db = await setup(page);
    await open(page, '#pwhelp');
    const body = page.locator('#osBody');
    await expect(body).toContainText('@jo');
    await expect(body).toContainText(EVIL);
    await expect(body.locator('img')).toHaveCount(0);
    await body.getByRole('button', { name: 'Mark handled' }).click();
    await expect.poll(() => db.writes.find((w) => w.table === 'flux_password_help')?.body).toEqual({ handled: true });
  });
});
