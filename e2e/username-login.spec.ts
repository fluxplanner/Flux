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
});
