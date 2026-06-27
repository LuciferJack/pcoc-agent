---
name: pcoc-debug
description: >-
  Evidence-before-hypothesis debugging skill. Triggered by bug reports
  or "X is broken" requests. Forces gathering evidence first, then
  generating 2-3 competing hypotheses, then testing each adversarially
  before stating root cause. Does NOT implement fixes — produces a fix
  boundary that pcoc-execute then implements.
calibration:
  golden_cases: calibration/golden_cases/pcoc-debug/
  baseline_score: 45
  requires_human_promote: true
---

# Skill: pcoc-debug

## When to use

- User says "X is broken / not working / failing"
- User reports a stack trace or error message
- User says "intermittent issue" or "flaky"

## When NOT to use

- Feature requests
- Code review (use pcoc-code-review if/when added)
- Performance optimization without a specific failure mode

## Procedure

### Phase 1 — Evidence gathering (no hypothesis yet)

Resist the urge to guess. Collect:

- Exact reproduction steps
- Exact error message / stack trace / log excerpt
- Environment (OS, runtime version, package versions)
- When did it last work? (git log diff)
- Frequency: always / sometimes / specific conditions?
- Recent changes

Write findings into a debug note:

```markdown
## Debug note — <date> — <one-line symptom>

### Evidence
- Symptom: <exact behavior>
- Reproduction: <steps>
- Last good commit: <hash>
- Frequency: <always | N of M times | conditional>
- Logs: <excerpt>
```

### Phase 2 — Competing hypotheses

Generate 2-3 hypotheses, NOT one. Each must:

- Be falsifiable
- Predict a specific test outcome
- Be ranked by prior probability

```markdown
### Hypotheses
1. H1: <description> — prior: 60% — test: <what you'd check>
2. H2: <description> — prior: 30% — test: <what you'd check>
3. H3: <description> — prior: 10% — test: <what you'd check>
```

### Phase 3 — Adversarial testing

For each hypothesis, run the test that would **disprove** it (not the
one that would confirm it — confirmation bias is the enemy):

```markdown
### Tests
- H1: ran `<command>` → result: <actual> — H1 disproved / consistent / inconclusive
- H2: ran `<command>` → result: <actual> — H2 disproved / consistent / inconclusive
- H3: not tested (eliminated by H1/H2 results)
```

### Phase 4 — Root cause + fix boundary

Only after evidence supports exactly one hypothesis:

```markdown
### Root cause
<one sentence>

### Evidence chain
<step-by-step proof, citing tests above>

### Fix boundary
- File: <path>
- Function / region: <name or line range>
- Approach: <what the fix should do>
- What it should NOT do: <to prevent scope creep>
- Tests that should pass after fix:
  - <test 1>
  - <test 2>
```

### Phase 5 — Hand-off to execute

Do NOT implement the fix. Hand the fix boundary to pcoc-execute,
which will treat it as a one-task plan.

## Anti-patterns

1. **Skipping evidence** ("I bet it's a race condition") — write the evidence first
2. **Single-hypothesis tunnel vision** — always 2-3 hypotheses
3. **Confirmation tests** — pick tests that could disprove
4. **Fix while debugging** — separate the concerns; the agent that
   diagnoses is not the one that fixes
5. **"Probably fixed by retry"** — never. State the root cause or
   say "unproven, recommend more logging at <points>"
