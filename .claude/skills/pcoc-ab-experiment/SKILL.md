---
name: pcoc-ab-experiment
description: >-
  A/B experimentation primitive for skill calibration. Runs candidate
  skill version against baseline on a golden case set, scored across
  configurable rubric dimensions. Used by pcoc-calibrate agent.
calibration:
  golden_cases: calibration/golden_cases/pcoc-ab-experiment/
  baseline_score: 0
  requires_human_promote: false
---

# Skill: pcoc-ab-experiment

## When to use

Invoked by `pcoc-calibrate` agent. Not user-facing typically.

## Procedure

### Inputs

- `--skill <skill-id>`
- `--version-a <path or "baseline">` (default: current active skill)
- `--version-b <path or "staging">` (default:
  `.claude/skills/_staging/<skill-id>/SKILL.md`)
- `--cases <path>` (default:
  `calibration/golden_cases/<skill-id>/`)
- `--output <path>` (default:
  `calibration/results/<skill-id>_<timestamp>.json`)

### What the runner does

For each golden case:

1. Run the trigger prompt twice — once with version A's SKILL.md
   loaded, once with version B's — using the same LLM and same
   temperature
2. Score each output along the case's rubric dimensions
3. Compute weighted aggregate score per side
4. Record case-level delta and any failure modes flagged

### Output JSON shape

```json
{
  "skill_id": "pcoc-fengchao-style",
  "timestamp": "2026-06-27T10:30:00Z",
  "version_a": {"label": "baseline", "path": ".claude/skills/.../SKILL.md"},
  "version_b": {"label": "staging", "path": ".claude/skills/_staging/.../SKILL.md"},
  "case_count": 5,
  "cases": [
    {
      "case_id": "case-01",
      "a_score": 7.0,
      "b_score": 8.5,
      "delta": 1.5,
      "notes": "B more concise; A had filler."
    }
  ],
  "aggregate": {
    "a_total": 35.0,
    "b_total": 38.5,
    "delta": 3.5,
    "a_wins": 1,
    "b_wins": 3,
    "ties": 1
  },
  "failure_modes_in_b": [
    "Hallucinated source in case-03"
  ],
  "recommendation": "iterate"
}
```

### Recommendation logic

| Condition                                   | Recommendation |
| ------------------------------------------- | -------------- |
| delta ≥ +5 AND no critical failure modes    | `promote`      |
| delta ≤ -3 OR any critical failure modes    | `reject`       |
| Otherwise                                   | `iterate`      |

Critical failure modes: hallucinated sources, refused to comply with
case constraints, leaked sensitive terms.

### Where scoring comes from

Two modes:

1. **Programmatic**: case YAML declares deterministic checks
   (e.g., "output must contain string X", "output must not exceed
   N tokens"). Used where possible — these are fastest and most
   reproducible.

2. **LLM-as-judge with rubric**: case YAML declares rubric
   dimensions; a separate LLM call scores each output 1-10 per
   dimension. The judge LLM is **not** the same instance that
   produced the candidates (different model OR fresh context).
   This avoids self-grading.

The runner uses programmatic where the case supports it, falls back
to LLM-as-judge for prose-quality dimensions.

## Anti-patterns

1. Same LLM instance scoring its own output (this is the Hermes bug)
2. Cherry-picked golden cases (rotated periodically — see
   `scripts/rotate-golden-cases.sh`)
3. Hidden test-set contamination: the candidate skill must not have
   been trained / tuned ON the golden cases
4. Single-case "ship it" — minimum 3 cases per skill
