# RIPER-5+C: workflow protocol

This is the workflow contract for pcoc-agent. It extends the
phase-locked RIPER-5 pattern with a sixth step — **Calibrate** —
between Execute and update-Process.

## Why the extra step

RIPER-5 (as used in phase-locked harnesses) ends with the implementer
finishing the code, then "updating process" — writing learnings,
archiving the plan. That's fine for pure code changes.

But when the change is a **new or modified skill**, "the implementer
declares the work done" is not a strong enough signal that the new
skill is actually better than what was there. The same LLM that
authored the skill is judging it.

The C step inserts a measurement step against an external reference
(the golden case set) before the change can compound into the active
skill library.

## The six phases

### R — Research

- **Tools**: Read, Grep, Glob, WebSearch, WebFetch
- **Owner**: pcoc-research agent
- **Output**: research brief with findings + contradictions + unknowns
- **Exit condition**: user says "go" (or research is conclusive enough
  to skip directly to PLAN)

### I — Innovate

- **Tools**: Read only
- **Owner**: pcoc-innovate agent
- **Output**: 2-3 candidate approaches with trade-offs across
  complexity / blast radius / reversibility / calibration burden
- **Exit condition**: user picks an approach

### P — Plan

- **Tools**: Read + Write (only into `process/`)
- **Owner**: pcoc-plan agent
- **Output**: plan artifact at `process/general-plans/active/<slug>_PLAN_<date>.md`
  with sections: Touchpoints, Public Contracts, Blast Radius,
  Calibration Plan, Verification Evidence, Resume Handoff
- **Exit condition**: user explicitly says "ENTER EXECUTE MODE"
  (the literal phrase is the approval gate signal)

### E — Execute

- **Tools**: Read, Write, Edit, Bash (constrained to Touchpoints)
- **Owner**: pcoc-execute agent
- **Output**: code changes per plan + 50% check-in + self-review
- **Exit condition**: either (a) all Touchpoints complete and
  verification evidence captured, OR (b) deviation detected and
  return to PLAN

### C — Calibrate (the new step)

- **Tools**: Read, Bash (calibration runner only)
- **Owner**: pcoc-calibrate agent
- **Output**: JSON report at `calibration/results/<skill>_<ts>.json`
  with case-by-case scores, aggregate delta, and recommendation
- **Required**: only when a skill was created or modified
- **Exit condition**: report produced; human reviews + decides
  promote / reject / iterate
- **Critical**: the calibrate agent **cannot** promote — only report

### update Process

- **Tools**: Write (only into `process/context/` and `completed/`)
- **Output**:
  - Plan moved from `active/` to `completed/`
  - Learnings appended to `process/context/all-context.md`
  - For skill changes: human explicitly runs `pcoc.promote <skill>`
    or `pcoc.reject <skill>`
- **Exit condition**: cycle closes

## Hard rules

1. **Phase order is fixed** for new work. You cannot enter EXECUTE
   without an approved PLAN. You cannot promote a skill without a
   passed CALIBRATE.

2. **Phase-locked tools**: the orchestrator AND the privacy-guard
   enforce that an agent in PLAN phase cannot Write outside
   `process/`. Trying to is a phase-lock violation.

3. **Skill changes go through `_staging/`**: never edit
   `.claude/skills/<id>/SKILL.md` directly. The skill-audit-log
   hook will loudly flag any direct write to an active skill path
   as a protocol violation.

4. **The user's word approves**: the orchestrator surfaces phase
   transitions and waits for explicit go-ahead. Implicit advancement
   ("ok, moving on") is not enough.

5. **Resume Handoff is mandatory** in every plan: the section that
   describes what minimum context is needed to pick up the work
   after context compaction. This is the section LLMs most often
   skip. Don't.

## Sub-workflow shortcuts

For some intents, the full 6-phase cycle is overkill:

| Intent                   | Workflow                              |
| ------------------------ | ------------------------------------- |
| Pure factual question    | answer directly, no phases            |
| Technical Q&A            | pcoc-fengchao-style skill, no phases  |
| Quick bug fix (< 5 lines)| pcoc-debug → mini-plan → E → done     |
| Major refactor / feature | full R→I→P→E (→C if skill) → update   |
| New skill proposal       | pcoc-evolve drafts → C → human gate   |

The shortcut path requires the agent to explicitly note: "Taking
the shortcut path for X reason. Full pipeline available if you
prefer." It's not a license to skip; it's a deliberate optimization
the agent and user agree to.

## Anti-patterns

1. **Phase smearing**: doing research-y reads while in EXECUTE
   ("just need to check one more thing"). If you need to read
   anything not in the plan, that's a return to RESEARCH or PLAN.

2. **Implicit promotion**: writing a new skill into the active
   directory because "the new version is obviously better". This is
   the failure mode the C step exists to prevent. Stage it; calibrate
   it; let the human decide.

3. **Sandbagging the C step**: declaring "no skill changed" when a
   skill in fact changed. The skill-audit-log hook catches this; the
   orchestrator should also surface it before the hook does.

4. **Stale plans**: a plan in `active/` that's been there for weeks
   with no progress notes. Either resume it, move it to `backlog/`,
   or archive it. Decide; don't leave it ambiguous.

## See also

- `process/development-protocols/eight-step-answer.md` — the 8-step
  technical Q&A framework (used by pcoc-fengchao-style skill)
- `docs/ARCHITECTURE.md` — how RIPER-5+C maps onto the agent/skill/hook layers
- `docs/WHY-PCOC.md` — why C exists and why we copied it from ad systems
