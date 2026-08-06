/*
 * Vendored @supabase/supabase-js.
 *
 * Replaces the former
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * UMD tag (a floating major-version CDN dependency — supply-chain + silent
 * breakage risk). The exact version is pinned in package.json and bundled into
 * public/bundles/flux-vendor.js via scripts/web-bundle-manifest.json.
 *
 * The CDN UMD build exposed the module namespace as a plain, mutable global
 * `window.supabase` (with `createClient` et al). We reproduce that contract
 * exactly so app.js + connect-claude.js (`window.supabase.createClient`) and
 * every other module that reads the global keep working unchanged. Spreading
 * into a fresh object (rather than assigning the sealed ESM namespace) keeps
 * the global mutable, matching the old UMD behaviour.
 *
 * Loaded first in the vendor bundle so the global is set at the very start of
 * bundle execution — before the deferred core/features bundles run.
 */
import * as supabase from '@supabase/supabase-js';

window.supabase = { ...supabase };
