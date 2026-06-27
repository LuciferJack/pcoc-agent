# pcoc-agent

> **P**hase-locked · **C**alibrated · **O**pen-source **C**ognitive agent harness
>
> An agent harness for engineers who don't trust agents to grade themselves.

[简体中文](./README.zh-CN.md) · [Why pcoc?](./docs/WHY-PCOC.md) · [Architecture](./docs/ARCHITECTURE.md) · [Privacy](./docs/PRIVACY.md)

---

## What this is

pcoc-agent is a harness for Claude Code (and Codex, via the mirror layer)
that combines the strongest patterns from two existing schools — and adds
the one thing both are missing.

| School                                | What it does well                              | What it lacks                                   |
| ------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Phase-locked harnesses (vibecode-style) | Plan-as-artifact, phase-locked tools, approval gates | No memory, no self-evolution, no measurement |
| Self-evolving agents (Hermes-style)   | Self-learning skills, persistent memory, multi-channel | Skills self-grade. No audit log. Silent overwrites. |
| **pcoc-agent**                        | **Both, plus calibration gate borrowed from online advertising systems (pcoc calibration)** | New project — community feedback wanted |

The core insight comes from large-scale online-advertising systems where
machine-learned scoring models are routinely **calibrated against ground
truth** (pcoc = predicted CTR over actual CTR ≈ 1.0 means the model is
well-calibrated). Agents need the same discipline. A skill that the LLM
itself judges as "great" is not a great skill; a skill that passes a
golden test set and a human promotion gate is.

## RIPER-5+C: the workflow

```
R — Research          (read-only, evidence gathering)
I — Innovate          (explore approaches, no code)
P — Plan              (spec written to disk)
E — Execute           (implement per plan, phase-locked tools)
C — Calibrate    ★new (run new/modified skills against golden cases)
   — update Process   (archive plan, write learnings, only after C passes)
```

The `C` step is non-negotiable for any skill that wants to be promoted
from `_staging/` to active. It runs an A vs B comparison on the golden
case set and surfaces deltas. A human says `pcoc.promote <skill>` (or
`pcoc.reject <skill>`). Nothing is silent.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/LuciferJack/pcoc-agent/main/install.sh | bash
```

Then in Claude Code:

```
/pcoc-setup
```

The setup walks you through:

1. **Privacy posture**: review the privacy-guard hook config; declare your
   sensitive-terms list (this list never gets committed)
2. **Overlay selection**: pick or create an overlay (work / personal /
   experimental) — overlays scope context, skills, and memory partitions
3. **Calibration set seeding**: optionally import a starter golden-case
   set, or generate one from your most-used recent prompts
4. **Codebase scan**: read-only walk to populate `process/context/`

## Overlay system (the privacy lever)

The public repo has **no** personal content. All your real work lives in
local-only overlays:

```
overlays/
├── example/          # template, public, the only overlay in the repo
├── my-work/          # ← gitignored, your work context
├── my-quant/         # ← gitignored, your trading bot context
└── my-personal/      # ← gitignored, journal/research/etc.
```

Each overlay declares its scope in `overlay.yaml`:

```yaml
name: my-work
visibility: local-only
allowed_paths:
  - ~/repos/my-work-project
  - ~/docs/work
denied_paths:
  - ~/repos/my-quant-project
  - ~/.okx
inherited_skills:
  - pcoc-plan
  - pcoc-debug
  - pcoc-calibrate
local_skills:
  - work-specific-skill-1
sensitive_terms_file: ~/.pcoc/sensitive-terms.work.local.txt
memory_partition: work
```

Sessions started under an overlay can only touch what the overlay
allows. The `work-personal-split.cjs` hook enforces this.

## What's in the box

```
.claude/
├── agents/       7 specialist agents (research, innovate, plan, execute,
│                 calibrate, evolve, security)
├── skills/       Core skills with calibration baseline
└── hooks/        privacy-guard · audit-log · work-personal-split · session-init

calibration/      A/B runner + golden_cases/ + audit log
process/          plan + context + feature workspace (artifacts gitignored)
overlays/         where YOUR private overlays land (gitignored except example/)
docs/             architecture, privacy, why-pcoc, migration guides
scripts/          maintenance and debugging utilities
```

## Comparison table

|                              | vibecode-pro-max-kit | NousResearch Hermes | pcoc-agent          |
| ---------------------------- | -------------------- | ------------------- | ------------------- |
| Plan-as-artifact             | ✅                    | ❌                   | ✅                   |
| Phase-locked tool whitelist  | ✅                    | ❌                   | ✅                   |
| Persistent memory            | ❌ (files only)       | ✅ (SQLite + FTS5)   | ✅ (SQLite + FTS5)   |
| Self-evolving skills         | ❌                    | ✅                   | ✅ (with gate)       |
| Calibration A/B gate         | ❌                    | ❌                   | ✅                   |
| Skill audit log              | ❌                    | ❌                   | ✅                   |
| Multi-overlay isolation      | ❌                    | ❌                   | ✅                   |
| Privacy-guard hook           | partial              | partial             | ✅ (multi-layer)     |
| Multi-host (Claude / Codex)  | ✅                    | ✅                   | ✅                   |
| IM bridges (Telegram/etc.)   | ❌                    | ✅                   | optional plugin     |
| Heartbeat / cron             | ❌                    | ✅                   | optional (gated)    |

## When to use pcoc-agent

**Use it if** you are a senior engineer who wants agents to follow process
the way humans on a real engineering team do — and you don't trust the
agent to be the only judge of its own work quality.

**Don't use it if** you want pure vibe coding. The calibration gate adds
friction by design. If you'd rather ship faster with less safety, vibecode
or vanilla Claude Code is the right call.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Skills, golden cases, and
overlay templates are the highest-leverage contributions.

**Note**: please run `scripts/check-no-secrets.sh` before any PR.

## License

MIT — see [LICENSE](./LICENSE).
