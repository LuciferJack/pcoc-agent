---
name: pcoc-setup
description: >-
  First-run interactive setup for pcoc-agent in a new project. Trigger
  with /pcoc-setup. Walks the user through privacy posture, overlay
  selection, sensitive-terms declaration, calibration seeding, and
  read-only codebase scan. Re-runnable; non-destructive.
calibration:
  golden_cases: calibration/golden_cases/pcoc-setup/
  baseline_score: 0
  requires_human_promote: false
---

# Skill: pcoc-setup

## When to use

- First time pcoc-agent runs in a project
- User explicitly runs `/pcoc-setup`
- After an upgrade that adds new config fields

## When NOT to use

- During an active feature implementation (it's setup, not part of work)
- If the user clearly already finished setup (check for `.pcoc/setup-done`)

## Procedure

### Step 1 — Detect environment

Read (do NOT execute anything yet):
- `package.json` (or `pyproject.toml`, `Cargo.toml`, `go.mod`, ...)
- Existing `.claude/`, `.codex/`, `process/` directories
- Existing `CLAUDE.md`, `AGENTS.md`

Report what you found. Wait for user to confirm before continuing.

### Step 2 — Privacy posture review

Show the user the contents of `SECURITY.md` and `docs/PRIVACY.md` (or
links). Ask:

> Do you want to declare a sensitive-terms file now?
> (recommended — even an empty placeholder helps the redaction skill
> know to look)

If yes, help them create `.pcoc/sensitive-terms.local.txt` (already
gitignored). Suggest categories without filling in their actual terms:

```
# Internal project codenames
# HR / personnel matters
# Trading strategy magic constants
# Client / partner names with sensitive context
```

### Step 3 — Overlay selection

Ask:

> What is the primary purpose of this directory?
> a) Work (e.g., employer's codebase)
> b) Personal project (open-source, side project)
> c) Trading / financial (sensitive credentials likely)
> d) Mixed / general
> e) Skip — I'll set up overlays later

Based on answer, draft an overlay in `overlays/<name>/overlay.yaml`
with appropriate defaults. **Important**: this overlay file is
gitignored by default; the user can opt to publish a sanitized version
later.

### Step 4 — Calibration seeding

Ask:

> Do you want to seed the golden-case set?
> a) Start empty (add cases as you encounter them)
> b) Generate cases from my last N prompts in this project
> c) Import a starter set for [detected stack]

Option (b) requires reading the recent conversation history — confirm
the user is OK with this before doing it.

### Step 5 — Codebase scan (read-only)

Walk the codebase respecting overlay's `allowed_paths` and `denied_paths`.
Populate `process/context/all-context.md` with:

- Repo structure (depth 3, gitignore-respecting)
- Detected stack + versions
- Key patterns and conventions you observe
- Import aliases / env vars / API routes / DB schema / test setup

**Never** include the contents of files in `denied_paths`. Never
include any string that looks like a credential.

### Step 6 — Mark setup complete

```bash
touch .pcoc/setup-done
```

Print a summary of what was created and what the user should review.

## Anti-patterns

- Do NOT silently move existing files
- Do NOT overwrite an existing `CLAUDE.md` without offering a backup
  (`CLAUDE.md.pre-pcoc`)
- Do NOT create empty placeholder files everywhere — only create what
  has real content
- Do NOT assume the user wants the public defaults — ask
