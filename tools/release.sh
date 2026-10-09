#!/usr/bin/env bash
# Tags the current main as a fork release: v<newest upstream release in main's history>-pk<N>,
# e.g. v1.0.39.0-pk7. N is one counter that only goes up (it does not reset when the
# upstream version changes). Pushing the tag starts the release and Docker image workflows.
#
# Usage: tools/release.sh           dry run: prints the tag it would create
#        tools/release.sh --push    creates the tag and pushes it to origin ONLY
set -euo pipefail
cd "$(dirname "$0")/.."

origin_url=$(git remote get-url origin)
upstream_url=$(git remote get-url upstream)
[ "$origin_url" != "$upstream_url" ] || { echo "origin and upstream are the same repo; refusing." >&2; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "Run this on main." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean." >&2; exit 1; }

# Read-only fetches. Upstream tags go to their own namespace so local tags are never overwritten.
git fetch -q origin main
git fetch -q upstream main '+refs/tags/*:refs/upstream-tags/*'
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
  || { echo "HEAD is not the same as origin/main; push (or pull) first so the tag matches what is on GitHub." >&2; exit 1; }

# Newest upstream release (v1.2.3.4) that is part of our history.
base=""
while read -r ref; do
  if git merge-base --is-ancestor "$ref^{commit}" HEAD 2>/dev/null; then base=${ref#refs/upstream-tags/}; break; fi
done < <(git for-each-ref --sort=-v:refname --format='%(refname)' refs/upstream-tags \
         | grep -E '^refs/upstream-tags/v[0-9]+(\.[0-9]+){3}$')
[ -n "$base" ] || { echo "No upstream release tag found in main's history." >&2; exit 1; }

# Highest pkN anywhere (local or on origin) + 1.
last=$( { git tag --list '*-pk*'; git ls-remote --tags origin | sed 's|.*refs/tags/||; s|\^{}$||'; } \
        | sed -nE 's/.*-pk([0-9]+)$/\1/p' | sort -n | tail -1)
tag="${base}-pk$(( ${last:-0} + 1 ))"
ahead=$(git rev-list --count "refs/upstream-tags/$base..HEAD")

echo "upstream release: $base   last fork release: pk${last:-none}   commits since upstream release: $ahead"
echo "next tag:         $tag -> $(git log -1 --format='%h %s' HEAD)"
[ "${1:-}" = "--push" ] || { echo "(dry run; pass --push to create and push it to origin)"; exit 0; }

git tag "$tag" HEAD
git push origin "refs/tags/$tag"

# A push to the fork must never produce a PR against upstream.
slug() { sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##' <<<"$1"; }
up=$(slug "$upstream_url"); me=$(slug "$origin_url")
n=$(curl -s "https://api.github.com/repos/$up/pulls?head=${me%%/*}:main&state=all" | python3 -I -c 'import sys,json;print(len(json.load(sys.stdin)))')
echo "pushed $tag to $me; PRs against $up from ${me%%/*}:main: $n"
