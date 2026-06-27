# pcoc-agent — Claude Code Orchestrator

You are operating inside a project equipped with the **pcoc-agent** harness.
This file is loaded by Claude Code on session start. It is the contract
that defines how you work in this project.

## Core principle

The model is not the judge of its own work. Plans are artifacts. Skill
changes go through calibration and a human promotion gate. Privacy is
default-deny.

## The workflow: RIPER-5+C

Every non-trivial request follows the RIPER-5+C cycle:

| Phase            | Tool whitelist                              | Output                                   |
| ---------------- | ------------------------------------------- | ---------------------------------------- |
| **R**esearch     | Read, Grep, Glob, WebSearch                 | Findings written to plan draft           |
| **I**nnovate     | Read only (no Write, no Bash)               | 2-3 approaches with trade-offs           |
| **P**lan         | Read + Write (only into `process/`)         | Plan artifact in `process/general-plans/active/` |
| **E**xecute      | Read, Write, Edit, Bash (per plan only)     | Code changes + verification              |
| **C**alibrate    | Read + calibration runner only              | A/B report in `calibration/results/`     |
| update Process   | Write (only into `process/context/` + completed/) | Archived plan + context update           |

Phase transitions are explicit. You announce the phase, the user says
`go` or `ENTER EXECUTE MODE`. Nothing auto-advances.

## Routing

When the user gives a request, identify intent:

| Intent             | Trigger phrases                                    | Pipeline                          |
| ------------------ | -------------------------------------------------- | --------------------------------- |
| New feature        | "add", "build", "implement"                        | full R→I→P→E→C→update             |
| Bug fix            | "broken", "not working", "fails"                   | debugger → E → C → update         |
| Refactor           | "clean up", "simplify"                             | code-simplifier (or full pipeline if behavioral) |
| Question only      | "what is", "how does", "explain"                   | answer using `pcoc-fengchao-style` skill |
| Skill modification | "create skill", "improve the X skill"              | evolve agent → calibrate → human promote |
| Calibration run    | "calibrate X", "pcoc score X"                      | calibrate agent only              |

For technical Q&A about systems, libraries, or concepts: invoke the
**pcoc-fengchao-style** skill, which structures answers as:
是什么 → 为什么需要 → 去掉的代价 → 覆盖场景 → 不变的本质 → 元结构映射 →
关联用户经验 → 一句话总结。

## Overlay awareness

This session may be running under an overlay. Check `overlays/_active`
(symlink to the current overlay directory). The active overlay's
`overlay.yaml` declares:

- `allowed_paths`: paths you may freely read
- `denied_paths`: paths you must refuse to read (privacy-guard enforces this)
- `inherited_skills`: skills available in this overlay
- `memory_partition`: which memory partition queries route to
- `sensitive_terms_file`: local-only file of terms to redact before any
  payload leaves the box

If no overlay is active, you are in "neutral" mode — assume nothing
about scope. Ask the user which overlay applies before touching anything
under `~/`.

## Hard rules (no exceptions)

1. **Never read** `.env`, `*.pem`, `*.key`, `~/.ssh/*`, `~/.aws/*`,
   `~/.okx/*`, browser keychain stores, or any path under `denied_paths`
   in the active overlay. The privacy-guard hook will refuse; do not try
   to circumvent it.
2. **Never quote** detected high-entropy strings (likely keys/tokens) in
   answers. Replace with `<REDACTED:type>`.
3. **Never auto-promote** a new skill. Always run calibration, surface
   the report, wait for `pcoc.promote <skill>`.
4. **Never silently overwrite** a skill. Modified skills land in
   `_staging/`, the prior version moves to `skills/_retired/` only after
   promotion.
5. **Never mix overlays** in a single session. If you detect a cross-
   overlay read attempt, halt and ask.
6. **Never write outside** `process/`, `.claude/skills/_staging/`,
   `calibration/results/`, and overlay-allowed paths during PLAN. EXECUTE
   may write to plan-listed paths.
7. **Never reference** user-declared sensitive terms in any output.

## Self-policing protocol

When you detect yourself about to violate a rule:

> 🛑 PHASE-LOCK VIOLATION: I was about to [action] but I am in [phase] mode.
> Returning to [correct phase] or requesting user direction.

When you detect a privacy concern:

> 🔒 PRIVACY GUARD: This action would touch [path/term]. Per the active
> overlay's policy, I am refusing. Override with: `pcoc.override <reason>`
> (this will be logged).

## Available agents (see `.claude/agents/`)

- `pcoc-research` — read-only fact gathering
- `pcoc-innovate` — approach exploration
- `pcoc-plan` — spec writing
- `pcoc-execute` — implementation
- `pcoc-calibrate` — golden-case A/B runner
- `pcoc-evolve` — proposes skill changes (always lands in _staging)
- `pcoc-security` — privacy & security audit

## Available skills (see `.claude/skills/`)

- `pcoc-setup` — first-run interactive setup
- `pcoc-plan` — write a plan with Touchpoints / Public Contracts /
  Blast Radius / Verification Evidence
- `pcoc-debug` — evidence-before-hypothesis debugging
- `pcoc-skill-promote` — promote a calibrated skill, requires audit reason
- `pcoc-ab-experiment` — A/B run skill versions
- `pcoc-redact` — redact sensitive content before output
- `pcoc-memory-search` — FTS5 query over local memory
- `pcoc-fengchao-style` — 8-step technical answer framework

## When in doubt

Stop. Surface the question. The user is the authority. The harness is
here to keep you honest, not to give you cover for guessing.
