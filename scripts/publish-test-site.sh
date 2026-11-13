#!/usr/bin/env bash
# Publish the current branch to the Flux TEST site:
#   https://azfermohammed.github.io/flux-test/
#
# The test site is a copy of Flux that talks to its own database
# (Supabase project "FluxPlanner-Test", ref bwgtpqvvxunyvxrgvpny), so
# nothing done there can touch real users. The real site
# (fluxplanner.github.io/Flux, from main) is never changed by this script.
#
# Usage:  npm run publish:test        (publishes whatever is committed on HEAD)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

PROD_REF="lfigdijuqmbensebnevo"
TEST_REF="bwgtpqvvxunyvxrgvpny"
# Public "anon" keys — safe to ship in a web page (the real one already is).
PROD_ANON="$(grep -oE "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+" public/js/app.js | head -1)"
TEST_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z3RwcXZ2eHVueXZ4cmd2cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjUxNDgsImV4cCI6MjExMDEwMTE0OH0.qw7blYD3VE4Q2VcG61VRGtMmld3jhO--jzaM1tu_d4s"
TEST_REPO="git@github.com:azfermohammed/flux-test.git"

if [ -n "$(git status --porcelain -- public index.html '*.html' service-worker.js)" ]; then
  echo "Commit your changes first — the test site is built from what's committed." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

# 1. A clean copy of the committed site.
git archive HEAD | tar -x -C "$OUT"
rm -rf "$OUT/.github"

# 2. Point it at the test database and the test address.
LC_ALL=C grep -rlE "$PROD_REF|$PROD_ANON|fluxplanner\.github\.io/Flux" "$OUT" \
  --include='*.js' --include='*.mjs' --include='*.html' --include='*.json' --include='*.css' \
  | while read -r f; do
      LC_ALL=C sed -i '' \
        -e "s/$PROD_REF/$TEST_REF/g" \
        -e "s/$PROD_ANON/$TEST_ANON/g" \
        -e "s#fluxplanner\.github\.io/Flux#azfermohammed.github.io/flux-test#g" "$f"
    done
if LC_ALL=C grep -rqE "$PROD_REF|$PROD_ANON" "$OUT" --include='*.js' --include='*.mjs' --include='*.html'; then
  echo "Refusing to publish: a page still points at the real database." >&2
  exit 1
fi

# 3. A "TEST SITE" ribbon on every page, and keep search engines out.
RIBBON='<meta name="robots" content="noindex"><div style="position:fixed;z-index:2147483647;left:50%;bottom:0;transform:translateX(-50%);padding:2px 10px;border-radius:6px 6px 0 0;background:#f59e0b;color:#111;font:600 11px/1.6 system-ui,sans-serif;pointer-events:none">TEST SITE · '"$BRANCH"' · '"$SHA"'</div>'
for f in "$OUT"/*.html; do
  RIBBON="$RIBBON" LC_ALL=C perl -0pi -e 's{</body>}{$ENV{RIBBON}</body>}i' "$f"
done
touch "$OUT/.nojekyll"

# 4. Replace the test site with this build.
cd "$OUT"
git init -q -b main
git add -A
git commit -q -m "Test build of $BRANCH @ $SHA"
git push -q -f "$TEST_REPO" main
echo "Published $BRANCH @ $SHA → https://azfermohammed.github.io/flux-test/ (live in ~1 minute)"
