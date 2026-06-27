# Privacy: an operational walkthrough

This is the "how to actually use pcoc-agent without leaking things"
guide. Read [SECURITY.md](../SECURITY.md) first for the threat model.

## The five things that protect you

1. **`.gitignore` defaults**: anything under `overlays/`, `.pcoc/`,
   `*.local*`, `*.env`, key files, runtime state — all gitignored by
   default. The only `overlays/` content that ships is `example/`.

2. **privacy-guard hook**: a Node.js script that runs before every
   `Read` / `Edit` / `Write` / `Bash` tool call and refuses anything
   touching credential stores. Fail-open: a broken hook never blocks
   you, but the moment it sees `~/.ssh/id_rsa` in any form, exit code 2.

3. **work-personal-split hook**: if the active overlay is `work` and a
   tool call wants to touch `~/.okx/` (declared in your `quant` overlay's
   `allowed_paths`), it halts and asks for explicit override.

4. **Redaction skill**: every payload to a user-facing answer, an audit
   log, or a `WebSearch` payload is scanned for high-entropy strings,
   credential patterns, and your declared sensitive terms. Matches
   replaced with `<REDACTED:type>`. The original mapping is in-memory
   only, never persisted.

5. **Skill calibration gate**: a new skill can't go live until a
   separate measurement (not the LLM that drafted it) says it's at
   least as good as baseline AND you say `pcoc.promote`. This protects
   against skill quality drift and silent overwrites.

## Setting up your sensitive-terms file

The file lives at `~/.pcoc/sensitive-terms.local.txt` (or whatever path
your overlay's `sensitive_terms_file` field points to). It's **never
committed**. One term or regex per line:

```
# Internal project codenames
SECRET_PROJECT_NAME

# HR-sensitive names
COWORKER_X
HR_PERSON_Y

# Strategy parameters
SOME_MAGIC_NUMBER_NAME
```

Things you should consider putting in this file:

- **Real names of people you discuss in HR / personal contexts** —
  if you ever mention coworker performance, conflicts, or HR
  situations to the agent, the names should be redacted before they
  appear in any output, audit log, or web search query.
- **Internal project / client codenames** — even if the codename
  itself isn't classified, leaking the codename leaks the existence
  of the project.
- **Strategy or tuning constants** — for quant systems, magic numbers
  in your strategy (specific thresholds, position sizes that reveal
  capital base, etc.).
- **Vendor / partner names with sensitive context** — if you've ever
  said anything in an internal meeting that you wouldn't want quoted
  in a public commit.

Things you should **NOT** put in this file:

- Anything publicly known about you (your real name, public employer)
- Generic terminology of your industry
- Software / framework names

## Overlay strategy by use case

### Work overlay

```yaml
# overlays/work/overlay.yaml (this file is gitignored)
name: work
visibility: local-only
allowed_paths:
  - ~/repos/work-project-1
  - ~/repos/work-project-2
  - ~/Documents/work
denied_paths:
  - ~/.ssh
  - ~/.aws
  - ~/.okx
  - ~/repos/personal-project
  - ~/repos/quant-bot
inherited_skills:
  - pcoc-plan
  - pcoc-debug
  - pcoc-fengchao-style
  - pcoc-redact
sensitive_terms_file: ~/.pcoc/sensitive-terms.work.local.txt
memory_partition: work
```

### Quant / trading overlay

```yaml
name: quant
visibility: local-only
allowed_paths:
  - ~/quant
  - ~/repos/trading-bot
denied_paths:
  - ~/.ssh
  - ~/.aws
  - ~/repos/work-project-1
  - ~/repos/work-project-2
inherited_skills:
  - pcoc-plan
  - pcoc-debug
sensitive_terms_file: ~/.pcoc/sensitive-terms.quant.local.txt
memory_partition: quant
```

Note that `~/.okx/` is NOT in `allowed_paths` even for the quant
overlay. Credentials live in a tighter scope than code that uses them.
Your bot code can read credentials at runtime via the OS keychain or
env vars, but the agent has no reason to read the credential file
itself — refuse it at the harness layer.

### Personal / journal overlay

```yaml
name: personal
visibility: local-only
allowed_paths:
  - ~/Documents/journal
  - ~/repos/personal-blog
denied_paths:
  - ~/.ssh
  - ~/repos/work-project-1
  - ~/quant
inherited_skills:
  - pcoc-plan
  - pcoc-fengchao-style
sensitive_terms_file: ~/.pcoc/sensitive-terms.personal.local.txt
memory_partition: personal
```

## Audit log forensics

After a working session, you can inspect what happened:

```bash
# What got blocked (local detail)
less calibration/audit_log.local.md

# What got promoted/calibrated (committed history)
less calibration/audit_log.md
```

Recommended habit: skim the local audit log at end-of-day. False
positives in the privacy-guard are a signal to refine the patterns;
false negatives (something blocked that you wish you'd caught earlier)
are a signal to expand the denylist.

## When you actually need to override

```
pcoc.override <one-sentence reason>
```

The next single tool call goes through. The reason is logged. If you
find yourself overriding repeatedly for the same path, that's a signal
to revise your overlay's `denied_paths` — either to allow that path
permanently, or to figure out why the agent keeps trying to reach for
it (often a sign that the agent has the wrong model of the work).

## Wiping state

```bash
rm memory/pcoc_memory.db                  # wipe local memory DB
rm calibration/audit_log.local.md         # wipe local audit detail
rm -rf .pcoc-runtime/                     # wipe runtime artifacts
```

This is non-destructive to the committed history (which has only
hashes). You can wipe local state freely without losing your repo's
calibration trail.

## Pre-publication checklist

Before you ever push pcoc-agent (or any repo using it) to a public
remote:

```bash
scripts/check-no-secrets.sh
```

Failures here are blocking. Don't push until clean.

Optional but recommended:

```bash
scripts/scan-entropy.sh                   # find high-entropy strings
scripts/check-overlay-leak.sh             # find paths from gitignored overlays
git log --all --pretty=format: --name-only --diff-filter=A | sort -u | \
    grep -E '\.(env|pem|key)$|/\.okx/|/\.aws/'   # cleanup pass
```

If any of those find something, do not just delete it from HEAD — the
git history still has it. Use `git filter-repo` (or `git filter-branch`)
to scrub history, and treat any exposed credentials as compromised
(rotate immediately).

## What pcoc-agent does NOT do for you

- It does not encrypt your local SQLite memory DB. If you need that,
  use OS-level disk encryption (FileVault, LUKS, BitLocker).
- It does not protect against a compromised LLM provider. Anthropic /
  OpenAI / etc. see what you send. We minimize what's sent via the
  redaction skill, but we can't prevent legitimate prompts from
  containing things you'd rather they didn't see — that's on you.
- It does not stop you from saying `pcoc.override` on everything.
  The override exists for legitimate cases; if you use it constantly,
  the guard isn't guarding anything.
