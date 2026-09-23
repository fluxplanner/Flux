import { test, expect } from '@playwright/test';

/**
 * Signing in with a name and a password.
 *
 * There is no email anywhere in this flow: none is collected, none is sent,
 * and no reset link exists. The name is folded into an address on a domain
 * that exists only to give Supabase Auth something to key on.
 *
 * That makes fluxNormalizeUsername load-bearing in a way normalisation usually
 * is not — **the address it produces IS the account key**. The eight existing
 * accounts were converted on 2026-09-13 using exactly this rule, so changing
 * it does not raise a validation error; it silently points people at accounts
 * that do not exist. These assertions pin the rule itself.
 *
 * No real credentials appear here and nothing signs in over the network. The
 * helpers are pure, so the mapping is checked directly.
 */

test.describe('Name + password sign-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e=1&scenario=guest');
    await page.waitForTimeout(2000);
  });

  test('the form asks for a name, not an email, and offers no Google', async ({ page }) => {
    const form = await page.evaluate(() => {
      const u = document.querySelector('#loginUsername') as HTMLInputElement | null;
      return {
        hasUsername: !!u,
        type: u?.type,
        label: u?.closest('label')?.textContent?.trim().split('\n')[0].trim(),
        hasOldEmailField: !!document.querySelector('#loginEmail'),
        hasGoogleButton: !!document.querySelector('.lx-google'),
      };
    });

    expect(form.hasUsername, 'the name field is missing').toBe(true);
    /* type=email would make a phone keyboard demand an @ sign for a value that
       must never contain one. */
    expect(form.type, 'a name field must not be type=email').toBe('text');
    expect(form.label).toBe('Name');
    expect(form.hasOldEmailField, 'the old email field is still there').toBe(false);
    /* Google sign-in would match the old identity and could restore the
       pre-conversion address, silently undoing the switch to names. */
    expect(form.hasGoogleButton, 'the Google button is back').toBe(false);
  });

  /*
   * Removing that button was not enough. All eight accounts still carry a
   * google identity holding the person's old gmail address, while the account
   * they sign in with is <name>@users.fluxplanner.app. Finishing a Google OAuth
   * flow re-asserts the identity's email onto the account — so any surviving
   * OAuth trigger is a way to silently undo the conversion and lock someone out
   * of their own name.
   *
   * Six triggers survived inside the Google hub, Classroom sync, Drive import,
   * Calendar push and Docs, which is why the block sits on the client they all
   * share rather than on the buttons. This pins the choke point, and pins that
   * other providers are still passed straight through.
   */
  test('Google sign-in is refused at the client every caller shares', async ({ page }) => {
    const res = await page.evaluate(async () => {
      type OAuthResult = { data?: { url?: string | null }; error?: { name?: string } };
      const w = window as unknown as {
        getSB?: () => { auth: { signInWithOAuth: (o: unknown) => Promise<OAuthResult> } } | null;
      };
      const sb = w.getSB?.();
      if (!sb) return { noClient: true, url: null, errName: null, otherDelegated: false };
      const google = await sb.auth.signInWithOAuth({ provider: 'google' });
      /* A different provider must not be short-circuited. Whatever the mock
         does with it — resolve, reject, anything — reaching it at all proves we
         delegated rather than swallowing every provider. */
      let otherDelegated = false;
      try {
        const other = await sb.auth.signInWithOAuth({ provider: 'azure' });
        otherDelegated = other?.error?.name !== 'FluxGoogleDisabled';
      } catch {
        otherDelegated = true;
      }
      return {
        noClient: false,
        url: google?.data?.url ?? null,
        errName: google?.error?.name ?? null,
        otherDelegated,
      };
    });

    expect(res.noClient, 'no Supabase client was available, so this asserted nothing').toBe(false);
    expect(res.errName, 'Google OAuth should come back refused, not started').toBe('FluxGoogleDisabled');
    expect(res.url, 'a redirect URL means the OAuth flow actually began').toBeNull();
    expect(res.otherDelegated, 'only google should be short-circuited').toBe(true);
  });

  /*
   * The profile name and the sign-in name were two different things, and only
   * one of them was editable. Rename yourself in Profile and the profile said
   * the new name while the sign-in box still only accepted the old one — with
   * nothing on screen saying so, and no email to remind you.
   *
   * They are the same name now, which means a rename re-keys the account. The
   * cases below are the ones that lock someone out if they are wrong: an
   * address that is not ours must never be rewritten, a name that normalises to
   * nothing must be refused, and the person must be told before it happens.
   *
   * Uses teacher-workflow — the describe's guest scenario has nobody signed in,
   * so none of this would engage and it would all pass by doing nothing.
   */
  test('renaming yourself in Profile renames how you sign in, and says so first', async ({ page }) => {
    await page.goto('/?e2e=1&scenario=teacher-workflow');
    /* Waiting on the function alone is not enough — it exists from the moment
       the bundle parses, while currentUser only appears once sign-in resolves,
       and the rename path reads that. */
    await page.waitForFunction(
      () => typeof (window as any).fluxSyncLoginNameToProfile === 'function'
        && !!(window as any).currentUser?.email,
      null, { timeout: 20000 });

    const res = await page.evaluate(async () => {
      const w = window as any;
      /* A real mailbox is not ours to rewrite. The e2e user's address is not on
         the synthesised domain, so the guard must leave it completely alone. */
      const foreign = await w.fluxSyncLoginNameToProfile('New Name', 'Old Name');

      w.currentUser.email = 'jane.doe@users.fluxplanner.app';
      /* Intercept the endpoint, not sb.auth.updateUser. The rename moved to the
         account-setup function because a browser cannot do it: Supabase refuses
         an email change to this domain with a 400. Stubbing the old SDK call is
         how the first version of this test passed while the feature was broken
         in production — the mock accepted what the real server rejects. */
      let sent: any = null;
      const realFetch = w.fetch.bind(w);
      w.fetch = async (url: any, opts: any) => {
        if (String(url).includes('/functions/v1/account-setup')) {
          sent = JSON.parse(opts?.body || '{}');
          const username = String(sent.username || '').trim().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
          return new Response(JSON.stringify({ ok: true, username, renamed: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return realFetch(url, opts);
      };
      const prompts: string[] = [];
      w.confirm = (m: string) => { prompts.push(m); return true; };
      const alerts: string[] = [];
      w.alert = (m: string) => { alerts.push(m); };

      const unusable = await w.fluxSyncLoginNameToProfile('!!! ???', 'Jane Doe');
      const sameKey = await w.fluxSyncLoginNameToProfile('Jane   Doe', 'Jane Doe');
      const renamed = await w.fluxSyncLoginNameToProfile('Jane Smith', 'Jane Doe');

      w.confirm = () => false;
      const cancelled = await w.fluxSyncLoginNameToProfile('Jane Jones', 'Jane Doe');

      return { foreign, unusable, sameKey, renamed, cancelled,
        sentUsername: sent?.username ?? null,
        prompt: prompts[0] ?? '', alerts };
    });

    expect(res.foreign, 'an address outside the synthesised domain was touched').toBe(true);
    expect(res.unusable, 'a name that normalises to nothing was accepted').toBe(false);
    expect(res.sameKey, 'a spacing-only edit should not prompt or re-key').toBe(true);
    expect(res.renamed).toBe(true);
    /* The raw name goes over the wire; the server folds it to the key with the
       same rule, so the client never invents an address of its own. */
    expect(res.sentUsername, 'the new name never reached the endpoint').toBe('Jane Smith');
    // Being told is the whole point — both names, and that the password holds.
    expect(res.prompt, 'the warning did not show the old name').toContain('jane.doe');
    expect(res.prompt, 'the warning did not show the new name').toContain('jane.smith');
    expect(res.prompt, 'the warning did not say the password is unaffected').toMatch(/password stays the same/i);
    expect(res.cancelled, 'cancelling still went ahead with the rename').toBe(false);
  });

  test('a name maps to the account key the converted accounts use', async ({ page }) => {
    const map = await page.evaluate(() => {
      const f = (window as unknown as { fluxUsernameToEmail?: (s: string) => string })
        .fluxUsernameToEmail;
      if (typeof f !== 'function') return null;
      return {
        plain: f('Azfer Mohammed'),
        padded: f('  Mixed   Case  '),
        // NFD splits "é" into "e" + a combining mark, which is then dropped.
        // Without it "José Álvarez" became "jos.lvarez" — losing the letters
        // rather than the accents.
        accented: f('José Álvarez'),
        punctuated: f("O'Brien-Smith"),
        empty: f('   '),
      };
    });

    expect(map, 'fluxUsernameToEmail is not on window').not.toBeNull();
    /* This exact value is the owner's live account key. If this line has to
       change, he cannot sign in. */
    expect(map!.plain).toBe('azfer.mohammed@users.fluxplanner.app');
    expect(map!.padded).toBe('mixed.case@users.fluxplanner.app');
    expect(map!.accented).toBe('jose.alvarez@users.fluxplanner.app');
    expect(map!.punctuated).toBe('obrien-smith@users.fluxplanner.app');
    // Nothing typeable at all must not produce a bare "@domain" key.
    expect(map!.empty).toBe('');
  });

  test('the write-it-down notice exists and stays hidden until sign-up', async ({ page }) => {
    const keepsafe = await page.evaluate(() => {
      const el = document.querySelector('#loginKeepsafe') as HTMLElement | null;
      if (!el) return null;
      return {
        display: getComputedStyle(el).display,
        mentionsNoReset: /no reset link/i.test(el.textContent || ''),
        namesTheOwner: /azfer/i.test(el.textContent || ''),
      };
    });

    expect(keepsafe, 'the keepsafe notice is missing').not.toBeNull();
    // Hidden on arrival — it is for the moment just after an account is made.
    expect(keepsafe!.display).toBe('none');
    /* The whole reason the notice exists: with no email there is no recovery,
       so the copy has to say that, not just "keep it safe". */
    expect(keepsafe!.mentionsNoReset, 'the notice must explain there is no reset').toBe(true);
    expect(keepsafe!.namesTheOwner, 'the notice must say who to ask').toBe(true);
  });

  test('a locked-out student can ask for help without signing in', async ({ page }) => {
    const help = await page.evaluate(() => {
      const btn = document.querySelector('#loginHelpBtn') as HTMLElement | null;
      return {
        present: !!btn,
        text: btn?.textContent?.trim(),
        wired: typeof (window as unknown as { fluxRequestPasswordHelp?: unknown })
          .fluxRequestPasswordHelp === 'function',
      };
    });

    expect(help.present, 'there is no way to ask for help').toBe(true);
    expect(help.wired, 'the help button is not wired to anything').toBe(true);
    expect(help.text).toMatch(/forgot your password/i);
  });

  test('asking for help with an empty name says so instead of sending', async ({ page }) => {
    await page.evaluate(() => {
      const u = document.querySelector('#loginUsername') as HTMLInputElement;
      u.value = '';
      (window as unknown as { fluxRequestPasswordHelp: () => void }).fluxRequestPasswordHelp();
    });
    await page.waitForTimeout(400);

    const err = await page.evaluate(() =>
      (document.querySelector('#loginAuthError') as HTMLElement | null)?.textContent?.trim());
    /* Without this the request lands as a blank row and the owner has no idea
       who to help — worse than refusing, because it looks like it worked. */
    expect(err).toMatch(/type your name/i);
  });

  /*
   * Sign-up answered a weak password by reciting Supabase's own string:
   * "Password should contain at least one character of each:
   *  abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789."
   *
   * Two faults, one cause. fluxWeakPasswordReason and fluxAuthErrorText were
   * called from four places and defined in none — and every call site is
   * written `typeof fn === 'function' ? fn(…) : ''`, so nothing ever threw.
   * The check silently passed every password and the raw provider text went
   * straight to the screen.
   *
   * Asserting on the missing-character wording specifically: that branch has
   * to sit above the generic `includes('password')` one, which would answer a
   * missing capital with "at least 8 characters" and send someone off
   * lengthening a password that was already long enough.
   */
  test('a weak password is explained in words, before the button and after it', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as any).fluxWeakPasswordReason === 'function'
         && typeof (window as any).fluxAuthErrorText === 'function',
      null, { timeout: 15000 });

    const r = await page.evaluate(() => {
      const w = window as any;
      const weak = w.fluxWeakPasswordReason;
      return {
        noCapital: weak('dominic1', 'Dominic'),
        noNumber: weak('Sunshine', 'Sam'),
        noLower: weak('ABCDEFGH1', 'Sam'),
        tooShort: weak('dom1', 'Dominic'),
        ownName: weak('Dominic1', 'Dominic'),
        good: weak('Tr0mbone!Quay', 'Sam'),
        // The exact string from the report, as the server sends it.
        server: w.fluxAuthErrorText({ message:
          'Password should contain at least one character of each: '
          + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.' },
          'signup', 'Dominic'),
      };
    });

    expect(r.noCapital).toMatch(/capital letter/i);
    expect(r.noNumber).toMatch(/number/i);
    expect(r.noLower).toMatch(/small letter/i);
    expect(r.tooShort).toMatch(/8 characters/i);
    expect(r.ownName).toMatch(/your own name/i);
    expect(r.good, 'a strong password was refused').toBe('');

    // Never the alphabet, and never the wrong advice.
    expect(r.server).not.toMatch(/abcdefghij/);
    expect(r.server, 'a missing capital was blamed on length')
      .not.toMatch(/8 characters/i);
    expect(r.server).toMatch(/small letter.*capital letter.*number/i);
  });
});
