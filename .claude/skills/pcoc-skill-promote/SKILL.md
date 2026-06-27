---
name: pcoc-skill-promote
description: >-
  Promote a staged skill to active. Triggered by user command
  `pcoc.promote <skill-id>`. Requires a calibration report to exist
  with positive recommendation. Logs every promotion to audit log.
  This is the ONLY way new skills become active.
calibration:
  golden_cases: calibration/golden_cases/pcoc-skill-promote/
  baseline_score: 0
  requires_human_promote: false
---

# Skill: pcoc-skill-promote

## When to use

- User says: `pcoc.promote <skill-id>`
- User says: `pcoc.reject <skill-id>` (the rejection variant follows
  similar flow but moves staging → `.pcoc-runtime/rejected/`)

## When NOT to use

- Self-initiated. NEVER promote a skill without explicit user command.

## Promotion procedure

### Pre-flight checks

1. Verify `.claude/skills/_staging/<skill-id>/SKILL.md` exists
2. Verify at least one calibration report exists at
   `calibration/results/<skill-id>_*.json`
3. Verify the most recent calibration result has either:
   - `recommendation: promote`, OR
   - The user has explicitly acknowledged the report says
     "iterate" or "reject" but they want to promote anyway (this is
     allowed but heavily audit-logged)

If any check fails, refuse with explanation. Do NOT promote.

### The promotion itself

1. **Snapshot current active version** (if any):

   ```bash
   if [ -d .claude/skills/<skill-id> ]; then
     mkdir -p .pcoc-runtime/retired/<skill-id>/
     mv .claude/skills/<skill-id> .pcoc-runtime/retired/<skill-id>/$(date +%Y%m%d_%H%M%S)/
   fi
   ```

2. **Promote staging to active**:

   ```bash
   mv .claude/skills/_staging/<skill-id> .claude/skills/<skill-id>
   ```

3. **Append to audit log** (`calibration/audit_log.md`):

   ```markdown
   ## <ISO timestamp> — <skill-id> — PROMOTED
   - Calibration report: <path>
   - Aggregate delta vs baseline: <signed integer>
   - Promoted by: <user> (via pcoc.promote)
   - Reason (if override): <quoted reason>
   - Retired version snapshot: <path or "none — first-time skill">
   ```

4. **Confirm to user**:

   ```
   ✅ Promoted: <skill-id>
   - Active path: .claude/skills/<skill-id>/
   - Prior version: <path or "none">
   - Audit log: calibration/audit_log.md (entry N)
   ```

## Rejection procedure

1. Move `.claude/skills/_staging/<skill-id>` to
   `.pcoc-runtime/rejected/<skill-id>/<date>/`
2. Append to audit log:

   ```markdown
   ## <ISO timestamp> — <skill-id> — REJECTED
   - Calibration report: <path>
   - Reason: <user-provided reason or "no reason given">
   ```

3. Confirm:

   ```
   ✅ Rejected: <skill-id>
   Staging moved to: .pcoc-runtime/rejected/...
   ```

## Override path

If the calibration recommended reject/iterate but user insists on promote:

```
pcoc.promote <skill-id> --override "<one-sentence reason>"
```

This still promotes but the audit log entry includes the override
reason prominently, and triggers a soft alert next session ("you
overrode calibration for X on Y — was that the right call?").

## Anti-patterns to refuse

1. Promote with no calibration report
2. Promote when active version exists and no snapshot path is writable
3. Promote when audit log is locked or unwritable (the audit log is
   the contract — if we can't log, we can't promote)
4. Silent promote (no user confirmation message)
5. Delete the retired version (audit needs the trail)
