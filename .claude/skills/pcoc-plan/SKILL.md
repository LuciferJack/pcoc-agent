---
name: pcoc-plan
description: >-
  Plan-writing skill. Triggered by pcoc-plan agent during PLAN phase
  of RIPER-5+C. Enforces the Touchpoints / Public Contracts / Blast
  Radius / Calibration Plan / Verification Evidence / Resume Handoff
  structure. NOT triggered by general "make a plan" requests outside
  the phase pipeline — only by the agent.
calibration:
  golden_cases: calibration/golden_cases/pcoc-plan/
  baseline_score: 40
  requires_human_promote: true
---

# Skill: pcoc-plan

See `.claude/agents/pcoc-plan.md` for the agent that uses this skill.

## The plan template

Render this exactly:

```markdown
# Plan: <feature-or-fix-name>

**Date**: <ISO8601>
**Approach**: <name chosen during INNOVATE>
**Author agent**: pcoc-plan
**Status**: ACTIVE
**Active overlay**: <overlay name, or "neutral">

## Context
1-3 sentences: why this work, who asked, what success means.

## Touchpoints
| Path                          | Action  | Purpose                       |
| ----------------------------- | ------- | ----------------------------- |
| <path/from/repo/root>         | CREATE  | <one-line reason>             |
| <path/from/repo/root>         | MODIFY  | <one-line reason>             |
| <path/from/repo/root>         | DELETE  | <one-line reason>             |

(EXECUTE may write only to paths in this table. Adding a row mid-execution
requires returning to PLAN.)

## Public Contracts
APIs, schemas, or interfaces that change. Include before/after.

```diff
- interface Foo { bar: string }
+ interface Foo { bar: string; baz?: number }
```

## Blast Radius
- **What could break**: ...
- **Tests to run**: <commands>
- **What to watch in production**: <metrics, log lines>
- **Reversibility**: easy (revert commit) / hard (data migration) / one-way

## Calibration Plan
- Touches a skill? <yes/no>
- If yes: list golden cases needed under
  `calibration/golden_cases/<skill-id>/`
- If no: "N/A — pure code change"

## Verification Evidence
Concrete proof this works. Commands or screenshots, not vibes:

```bash
$ command-to-run
expected-output
```

## Resume Handoff
If context compaction happens or another agent picks this up tomorrow,
the minimum context needed is:

- This plan file at <path>
- Active overlay: <name>
- State: <ACTIVE | EXECUTING after Touchpoint N | BLOCKED on X>
- Approvals received: <list>

## Approval log
- [ ] Plan approved by user
- [ ] Calibration passed (if applicable)
- [ ] Promotion gated (if applicable)
```

## Filename convention

```
process/general-plans/active/<slug>_PLAN_<DD-MM-YY>.md
```

`<slug>`: kebab-case, ≤ 5 words, e.g. `webhook-rate-limit_PLAN_27-06-26.md`

## Anti-patterns to refuse

1. Empty Touchpoints table ("I'll figure it out as I go")
2. Touchpoints with only "vague areas" instead of paths
3. Blast Radius left as "low" with no analysis
4. Verification Evidence as "tests will pass" without specific commands
5. Resume Handoff left empty (this is the most-skipped section and the
   one that hurts most after compaction)
