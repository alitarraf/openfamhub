# DEVLOG: openfamhub

<!-- The hub's prefix+a preview reads this file. Keep it current:
     Status = where we are / what's next.  TODO = check off [x].  Log = newest on top. -->

## Status
Now:  existing project — retrofitted into the standard 2026-07-10; describe the real current state here
Next: fill CLAUDE.md + the founding PRD in docs/

## TODO
- [ ] fill CLAUDE.md — what this is, stack, structure
- [ ] fill the founding PRD (docs/PRD_openfamhub_July2026.md)

## Log
### 2026-07-13 — screensaver slideshow shuffles randomly
- `ScreensaverOverlay.svelte` now Fisher-Yates shuffles the photo list once per
  screensaver activation (was server-sorted alphabetical). The overlay mounts
  fresh each activation, so every idle-in gets a new random order. Client-side
  only; server photo contract unchanged. Mirrored from home-os.

### 2026-07-10 — retrofitted into the /mnt/d project standard
- added CLAUDE.md + DEVLOG.md + docs/ founding PRD stub (project pre-dated the standard)
