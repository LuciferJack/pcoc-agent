# Overlays

This directory holds **scoping configurations** for pcoc-agent. Each
overlay declares:

- which filesystem paths the agent may freely read (`allowed_paths`)
- which paths it must refuse (`denied_paths`)
- which skills are loaded
- which memory partition is active
- which sensitive-terms file is consulted

## Why overlays exist

A typical engineer has work, side projects, and possibly trading or
financial systems. Each has different sensitivity. Without overlays,
your agent has the union of all those scopes in every session — and
the union of attack surfaces.

With overlays, you say "this session is the work session" and the
agent loses access to your personal / financial paths for the
duration. Switching is one command. The boundary is enforced by a
hook, not just convention.

## What's in this directory

In the public repo, only `example/` is committed. **Everything else is
gitignored.** Your real overlays — work, personal, quant, whatever
you set up — live here too, but never get pushed.

## Creating your own overlay

```bash
# 1. Copy the example as a starting point
cp -r overlays/example overlays/my-work

# 2. Edit overlays/my-work/overlay.yaml
$EDITOR overlays/my-work/overlay.yaml

# 3. Activate it
ln -sfn my-work overlays/_active

# 4. (Optional) create the sensitive-terms file
mkdir -p ~/.pcoc
$EDITOR ~/.pcoc/sensitive-terms.work.local.txt
```

The `overlays/_active` symlink is gitignored. Switching is just:

```bash
ln -sfn <overlay-name> overlays/_active
```

There's a `pcoc.switch <name>` command that wraps this for convenience.

## Overlay schema

```yaml
name: <overlay-name>            # short identifier, lowercase + dashes
visibility: local-only          # or: shareable (rare — implies no secrets)
description: |
  Optional one-paragraph description of what this overlay scopes.

allowed_paths:                  # the agent may read these (relative or ~)
  - ~/repos/some-project
  - ~/Documents/notes

denied_paths:                   # the agent must refuse these
  - ~/.ssh
  - ~/.aws
  - ~/repos/other-project       # explicit cross-overlay denial

inherited_skills:               # core skills available in this overlay
  - pcoc-plan
  - pcoc-debug
  - pcoc-fengchao-style
  - pcoc-redact
  - pcoc-memory-search

local_skills:                   # overlay-specific skills (optional)
  - my-domain-skill-1

sensitive_terms_file: ~/.pcoc/sensitive-terms.<name>.local.txt

memory_partition: <partition-name>   # SQLite partition name
                                     # cross-partition reads require
                                     # explicit pcoc.memory-search --partition

# Optional: cron-like or heartbeat tasks specific to this overlay
# (off by default; opt-in only)
heartbeat:
  enabled: false
```

## Common pitfalls

1. **Putting credentials in `allowed_paths`**. If your project's code
   reads from `~/.aws/credentials` at runtime, the project root being
   in `allowed_paths` does NOT make the credentials readable — they're
   still blocked by the default credential-store denylist in
   `privacy-guard.cjs`. That's correct. The agent has no reason to
   read your AWS key file.

2. **Overlapping `allowed_paths` across overlays**. If both `work`
   and `personal` declare `~/scratch` as allowed, the
   `work-personal-split.cjs` hook can't tell which overlay a
   `~/scratch/foo.md` access belongs to. Avoid overlap. Or use
   per-overlay subdirectories: `~/scratch/work/`, `~/scratch/personal/`.

3. **Forgetting to update `denied_paths` after adding a new
   overlay**. When you add a `quant` overlay with `~/quant/` as
   allowed, also update `work/overlay.yaml`'s `denied_paths` to
   include `~/quant/` — otherwise a `work` session could read it.

4. **Committing personal overlay content**. The `.gitignore` covers
   this by default. Verify with `git status` before any push.

## Sensitive-terms files: never commit

The `sensitive_terms_file` path points to a file outside the repo
(typically `~/.pcoc/sensitive-terms.<name>.local.txt`). This is by
design — even if you accidentally commit an overlay, the actual
sensitive-term content is somewhere else.

If you ever see a `sensitive-terms*.txt` in `git status`, something
is wrong. Stop and audit.

## Inspecting active overlay

```bash
# What's active right now?
readlink overlays/_active

# What does it allow / deny?
cat overlays/_active/overlay.yaml

# What's been blocked under this overlay?
grep -A 3 "overlay: $(readlink overlays/_active | xargs basename)" \
    calibration/audit_log.local.md
```
