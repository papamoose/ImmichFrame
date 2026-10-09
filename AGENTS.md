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

Gotchas learned the hard way: the collapsible "Accounts" settings card is open by default
(clicking it closes it); Playwright's `click()` on Immich UI cards can scroll the page
under the sticky header, so prefer a taller viewport (1280x1000) over full-page shots.
