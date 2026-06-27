# Architecture

pcoc-agent has four layers. Each layer has a different lifecycle and a
different audit trail.

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 4: Overlays (local-only, gitignored)                       │
│  - your work / personal / quant scopes                            │
│  - each declares allowed_paths, denied_paths, memory_partition    │
│  - sensitive_terms_file (local-only)                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │ resolved at session start
┌────────────────────────────▼─────────────────────────────────────┐
│  Layer 3: Hooks (.claude/hooks/*.cjs)                             │
│  - privacy-guard       PreToolUse: block credential paths         │
│  - work-personal-split PreToolUse: block cross-overlay reads      │
│  - skill-audit-log     PostToolUse: log every skill change        │
│  - session-init        SessionStart: inject context               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ pre/post tool wrap
┌────────────────────────────▼─────────────────────────────────────┐
│  Layer 2: Agents + Skills (.claude/{agents,skills}/)               │
│  - 7 agents, each with a tool whitelist and a phase binding       │
│  - 8 core skills, each calibrated against golden cases            │
│  - skill changes go through _staging/ → calibration → human gate  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ orchestrated by
┌────────────────────────────▼─────────────────────────────────────┐
│  Layer 1: Orchestrator (CLAUDE.md / AGENTS.md)                    │
│  - RIPER-5+C workflow definition                                  │
│  - Routing rules (intent → pipeline)                              │
│  - Hard rules (privacy, phase-lock, no silent skill overwrites)   │
└──────────────────────────────────────────────────────────────────┘
```

## Layer 1: Orchestrator

`CLAUDE.md` is the system prompt prepended to every Claude Code session.
It defines:

- **Workflow**: RIPER-5+C — Research, Innovate, Plan, Execute, Calibrate,
  update Process. The **C** step is novel — it forces measurement before
  any new skill becomes active.
- **Routing**: intent classification table that maps user phrasing to the
  right pipeline (full RIPER for features, debug-skill for bug reports,
  fengchao-style for technical Q&A, etc.).
- **Hard rules**: a small enumerable list that cannot be overridden by
  user prompt. Hooks enforce these mechanically; the orchestrator's job
  is to also make them visible so the agent self-polices before the
  hook has to refuse.

`AGENTS.md` is the Codex-equivalent mirror. Same content, different
discovery mechanism.

## Layer 2: Agents and skills

### Agents

Seven agents, each with a tool whitelist and a phase binding:

| Agent              | Phase     | Tool whitelist                          |
| ------------------ | --------- | --------------------------------------- |
| pcoc-research      | research  | Read, Grep, Glob, WebSearch, WebFetch   |
| pcoc-innovate      | innovate  | Read                                    |
| pcoc-plan          | plan      | Read, Write (only into process/)        |
| pcoc-execute       | execute   | Read, Write, Edit, Bash (per plan)      |
| pcoc-calibrate     | calibrate | Read, Bash (only calibration runner)    |
| pcoc-evolve        | any       | Read, Write (only into _staging/)       |
| pcoc-security      | any       | Read, Grep, Glob, Bash (script-only)    |

The tool whitelist is enforced by both the agent definition (declared
intent) AND the privacy-guard hook (mechanical refusal). Both layers
matter — declared intent helps the LLM self-police; the hook catches
the cases where it doesn't.

### Skills

Eight core skills, each with a `calibration:` frontmatter block
declaring its golden case directory and baseline expectations:

| Skill                    | Trigger                                  |
| ------------------------ | ---------------------------------------- |
| pcoc-setup               | `/pcoc-setup` — first-run config         |
| pcoc-plan                | invoked by pcoc-plan agent               |
| pcoc-debug               | "X is broken / failing" patterns         |
| pcoc-skill-promote       | `pcoc.promote <skill-id>`                |
| pcoc-redact              | pre-output / pre-commit hooks            |
| pcoc-fengchao-style      | "what is / why / how does" technical Qs  |
| pcoc-memory-search       | "did we discuss / remember when"         |
| pcoc-ab-experiment       | called by pcoc-calibrate agent           |

Skills live in three lanes:

```
.claude/skills/
├── <skill-id>/           ACTIVE — what's used live
├── _staging/             STAGED — calibration runs against ACTIVE
└── (during promotion, ACTIVE moves to .pcoc-runtime/retired/<id>/<ts>/)
```

## Layer 3: Hooks

Hooks are Node.js (`.cjs`) scripts. **They fail open**: a hook that
crashes never blocks the user. That's a deliberate trade-off — a
security tool that breaks the user's flow gets disabled, and a disabled
security tool protects nothing.

| Hook                   | Event        | Job                                     |
| ---------------------- | ------------ | --------------------------------------- |
| privacy-guard.cjs      | PreToolUse   | Refuse credential paths, blocked bash   |
| work-personal-split.cjs| PreToolUse   | Refuse cross-overlay reads              |
| skill-audit-log.cjs    | PostToolUse  | Log skill writes (loud alarm on ACTIVE) |
| session-init.cjs       | SessionStart | Inject overlay/plan context             |

Two audit logs:

- `calibration/audit_log.md` — committed; hashes only, no payloads
- `calibration/audit_log.local.md` — gitignored; full detail with
  session IDs, blocked paths, overrides

The split exists so the public repo can have an auditable history of
calibrations and promotions without leaking the contents of what was
blocked.

## Layer 4: Overlays

Overlays are the privacy lever. A repo can have zero or many overlays.
The active overlay is determined by a symlink:

```
overlays/_active → overlays/<active-overlay-name>
```

Each overlay declares its scope in `overlay.yaml`. Example structure
(this is a TEMPLATE — your actual overlay content is local-only):

```yaml
name: example
visibility: local-only
allowed_paths:
  - /full/expanded/path/to/your/project
denied_paths:
  - ~/.ssh
  - ~/.aws
  - ~/.config/some-tool
inherited_skills:
  - pcoc-plan
  - pcoc-debug
  - pcoc-fengchao-style
local_skills:
  - ()
sensitive_terms_file: ~/.pcoc/sensitive-terms.local.txt
memory_partition: example
```

`overlays/_active` is itself gitignored. Switching overlays is:

```bash
ln -sfn overlays/<name> overlays/_active
```

(There's a `pcoc.switch` command that wraps this.)

## RIPER-5+C in detail

```
R — Research          read-only, evidence gathered into plan draft
I — Innovate          2-3 approaches with trade-offs, no code
P — Plan              spec written to process/general-plans/active/
E — Execute           implement per plan + 50% check-in + self-review
C — Calibrate    ★    if a skill changed: run A/B vs golden cases
   — update Process   archive plan, write learnings, ONLY after C passes
```

The novel step is **C**. It separates "code that works" from "skill that
generalizes". Code-only changes skip C and go straight from E to
update-Process. Skill changes MUST pass C and then the human promotion
gate before the new skill goes active.

This is the same separation online ad systems make between "deployable
code" and "model that's been validated against ground truth". You can
deploy code that compiles. You can't deploy a model just because it
trained — it has to pass offline calibration AND online experimentation
gates first.

## Why two audit logs?

| Concern                          | Committed log | Local log |
| -------------------------------- | ------------- | --------- |
| Public auditability of process   | ✅             | ❌         |
| Don't leak what was blocked      | ✅ (hashes only) | n/a    |
| Session-level forensic detail    | ❌             | ✅         |
| Bisectable across collaborators  | ✅             | ❌         |

If you wipe your local audit log (e.g., for laptop disposal), the
committed log still tells future-you and your collaborators what
calibrations ran and what was promoted, just not the operational
details of every blocked path.

## What's intentionally NOT in pcoc-agent (yet)

- **IM bridges** (Telegram/Discord/etc.) — Hermes does this well but
  it's a privacy attack surface. If you want it, install Hermes
  separately and treat it as a different system. A future plugin
  pattern may add this with explicit per-channel privacy declarations.
- **Heartbeat / cron** — same reason. Always-on agents need a much
  stronger threat model than what we ship today.
- **Multi-LLM routing inside one session** — Hermes does this; we
  don't, because skill calibration becomes much harder when the model
  swap silently changes what skills mean.
- **Shared memory across machines** — local-only by design. If you
  want sync, encrypt the SQLite file and use whatever sync you already
  trust (Syncthing, dropbox, etc.).

These omissions are deliberate: the smaller surface lets pcoc-agent
make stronger guarantees about privacy and skill quality. If you need
the things Hermes does, run Hermes — and treat the two as separate
systems with separate threat models.
