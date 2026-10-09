# Instructions for AI agents working on this fork

This repo is a fork whose **only purpose is to add features the maintainer wanted** to
ImmichFrame. The top of `README.md` advertises those features with screenshots. That block
is generated, and **keeping it current is part of finishing any feature.**

## Rule: every new user-visible feature gets a README entry and screenshots

When you add (or materially change) a feature a user can see or configure, in the same
branch/commit series:

1. **Add an entry to `tools/screenshots/features.json`.** Fields: `id` (kebab-case),
   `title` (short, user-facing), `summary` (1-3 plain-English sentences: what it does and
   why you'd want it), and `screenshots` (`[{ "file": "name.png", "caption": "..." }]`).
   Write for non-technical users. Pure refactors with no effect on users don't need
   an entry. Bug fixes users would notice do: add them with `"type": "fix"` (listed under
   "What this fork fixes"; no scenario needed, and `screenshots` may be empty or reuse an
   existing PNG). Fold small related changes into an existing entry instead of adding one.
2. **Add a scenario to `tools/screenshots/capture.mjs`** under `scenarios[<id>]` that
   drives the real UI to the state worth showing and calls `shot(page, '<file>')` for
   every screenshot listed. Behaviour that is invisible by default (like the tap zones) may
   be outlined or labelled by injecting CSS in the scenario; say so in the `summary`.
3. **If the feature needs data the mock Immich lacks** (new endpoint, new field), extend
   `tools/screenshots/mock-immich.mjs`. If it needs different settings, edit
   `tools/screenshots/Settings.seed.json`. Keep all data fake: never use real photos,
   names, API keys or server URLs.
4. **Run `make screenshots`** (= `tools/screenshots/run.sh`). It generates the fake
   photos, builds this checkout into a Docker image alongside the mock Immich, captures
   every screenshot, rewrites the README block, and tears the stack down.
   `tools/screenshots/run.sh <feature-id>` re-captures just one feature while iterating
   (it leaves the README alone).
5. **Look at every PNG you produced** (open them) and confirm they show the feature and
   nothing odd: no spinners, blank cover images, error screens, or text cut off by the
   sticky header. A scenario that "passes" can still capture a broken page.
6. **Commit** `features.json`, `capture.mjs` (and mock/seed changes), the PNGs in
   `screenshots/`, and the regenerated `README.md` together with the feature.

When a feature is removed or its UI changes, update or delete its entry and screenshots
the same way. Re-run `make screenshots` after any UI change that could alter existing
screenshots.

## Hard rules

- **Never hand-edit** the README between the `FORK-FEATURES:START` / `END` markers; edit
  `features.json` and regenerate. Everything outside the markers is normal prose.
- Keep the first line of `README.md` pointing at the upstream README.
- Every feature id in `features.json` must have a scenario, and every screenshot listed
  must exist in `screenshots/`; both scripts exit non-zero otherwise.
- Don't commit `tools/screenshots/node_modules/`, `.cache/` or `_failed-*.png`
  (already gitignored). `_failed-<id>.png` is what the browser saw when a scenario broke.

## Releases

Fork releases are tagged `v<newest upstream release in main's history>-pk<N>`, e.g.
`v1.0.39.0-pk7`. The version part always matches upstream. `N` is a single counter that
only goes up: it does **not** reset when the upstream version changes (only reset it if the
fork's changes get merged upstream).

- Use `make release` (a dry run that prints the tag) and then `make release ARGS=--push`.
  Never hand-pick the tag. `tools/release.sh` picks the version and `N`, requires a clean
  `main` that matches `origin/main`, pushes the tag to `origin` only, and checks that no PR
  exists against upstream.
- Pushing a `v*` tag runs the release and multi-arch Docker image workflows in the fork, so
  only tag when asked. Never move or delete a pushed tag without being asked.
- To pick up a newer upstream release, rebase `main` onto `upstream/main` (see "Rebasing onto
  upstream"), push, then run the release; the version part follows automatically.

## Release writeups (notes for a GitHub release)

This section is the upstream project's own rule, kept as-is. When asked to create a release writeup or release notes, follow this process and format:

### Process

1. Run `git log --oneline <prev-tag>..HEAD` to get all commits since the last release.
2. Run `git diff <prev-tag>..HEAD --stat` to understand the scope of changes.
3. Fetch the GitHub release page if a URL is provided to cross-reference the auto-generated changelog.
4. Combine the raw git history with the GitHub changelog to produce a human-friendly writeup.

### Output Format

Use the template at `templates/release-template.md`. Key rules:

- **Title**: `# 📦 ImmichFrame Release vX.X.X.X – <Date>`
- **Intro**: One sentence summarising the release highlights (no heading).
- **Sections**: Follow the category order from `.github/release.yml` — Breaking Changes, New Features, Fixes, Documentation, Maintenance, Other Changes.
- **Each entry**:
  - H4 heading with emoji + feature name
  - Bold `**PR [#NNN](url) by @author**` attribution line
  - 2–4 sentences describing *what* changed and *why it matters* to the user
  - Include a code block if a config snippet helps illustrate usage
  - Separate entries with `---`
- **New Contributors**: Call out first-time contributors with 🎉
- **Footer**: Always end with the full changelog comparison URL.

### Tone

- Write for end users, not developers. Avoid internal refactor jargon unless it has a user-visible effect.
- Keep descriptions concise — 2–4 sentences per entry is enough.
- Use "you" / "your" to address users directly.

## Rebasing onto upstream

Keep `main` as our commits replayed on top of `upstream/main`, so GitHub's "N commits ahead,
0 behind" stays small and accurate. Never rewrite upstream's own commits (no
`filter-branch`, message cleanups or similar across shared history): that gives them new
hashes and GitHub then reports ~1,000 commits "behind" (this happened once and had to be
undone).

1. `git fetch upstream` (read-only), then `git rev-list --left-right --count upstream/main...main`.
   Left number = new upstream commits, right = ours.
2. `git rebase upstream/main`. Resolve conflicts in favour of keeping both upstream's change
   and ours; if a fork commit is now redundant, drop it.
3. Re-verify, because upstream UI or API changes can break things: build and run the tests
   (`make test-webapi test-core`), then **re-run `make screenshots`** and look at every PNG.
   Commit regenerated screenshots/README as a normal commit.
4. Check `git rev-list --left-right --count upstream/main...main` shows `0` on the left.
5. A rebase rewrites our commits, so the push is a force-push. **Ask first**, state that it
   rewrites the fork's `main`, and use a lease on the exact old SHA, to `origin` only:
   `git push --force-with-lease=main:<old-sha> origin main`.
6. Afterwards check that no PR exists against upstream
   (`https://api.github.com/repos/immichFrame/ImmichFrame/pulls?head=<fork-owner>:main&state=all`).
7. Do **not** move or delete already-pushed release tags to follow the rebase (that re-runs
   the image builds and replaces releases). Cut a new release instead; see Releases.

## Fork safety

`origin` is the maintainer's fork; `upstream` is `immichFrame/ImmichFrame`. Never push to,
open a PR against, or comment on upstream. Pull requests always target the fork
explicitly (`--repo <fork-owner>/ImmichFrame --base main`). See `~/.claude/CLAUDE.md`
rules if present.

## How the tooling fits together (`tools/screenshots/`)

| File | Role |
|---|---|
| `features.json` | Source of truth: feature list, summaries, screenshot files and captions |
| `capture.mjs` | One Playwright scenario per feature id; writes PNGs to `screenshots/` |
| `build-readme.mjs` | Renders `features.json` into the README block |
| `mock-immich.mjs` | Fake Immich API (albums, people, tags, search, thumbnails) |
| `gen-images.py` | Generates the fake photos and faces the mock serves |
| `Settings.seed.json` | Initial ImmichFrame config imported on first start (two named accounts) |
| `docker-compose.yml` | ImmichFrame (built from this checkout) + mock Immich; admin password `screenshots` |
| `run.sh` | Orchestrates all of the above |

Requirements: docker (with compose), node 20+, python3 with Pillow. Env overrides:
`SCREENSHOT_PORT` (default 18080), `CHROMIUM_PATH` (use an installed browser instead of
downloading Playwright's).

## Screenshot conventions

These are demo screenshots: a viewer must see the feature clearly. Completeness doesn't matter.

- **Dark mode is the default** (`colorScheme: 'dark'` in `capture.mjs`), so output never
  depends on the host's theme. Only the theme shot toggles to light.
- **Keep the 1280x1000 viewport.** Rows cut off at the bottom are fine. Pick items that
  are visible without scrolling (the first two rows of tiles) so the checkmarks show.
- **Start picker shots at the top** with `shot(page, file, { top: true })`. Clicking tiles
  further down scrolls the app shell (not the window) and hides the tab row under the
  sticky header.
- **The mock keeps 12 albums, 6 people, 6 tags. Don't shrink them.** The picker's search
  box only appears for more than 8 items, so fewer albums silently loses the search shot.
- Screenshots show whatever the mock serves, so keep it fake and tidy (clear names, no
  real photos or keys).

## Gotchas

The collapsible "Accounts" settings card is open by default (clicking it closes it).
Playwright's `click()` on Immich UI cards can scroll the page under the sticky header.
