---
name: pcoc-memory-search
description: >-
  Local memory search via SQLite + FTS5. Queries past sessions,
  archived plans, and learning notes within the active overlay's
  memory partition. Read-only. Never crosses overlay boundaries.
calibration:
  golden_cases: calibration/golden_cases/pcoc-memory-search/
  baseline_score: 20
  requires_human_promote: true
---

# Skill: pcoc-memory-search

## When to use

- User says "did we discuss X before?"
- User references "the plan from last week"
- User says "remember when we decided Y"
- Agent's own internal need to check prior decisions

## When NOT to use

- General factual lookups (use WebSearch instead)
- Looking up things from before pcoc-agent was installed (no data)
- When the user is in a different overlay (boundary refuse)

## Procedure

1. Determine the active overlay's `memory_partition` from
   `overlays/_active/overlay.yaml`. If no overlay is active, use the
   `neutral` partition.

2. Construct the query. The runtime is:

   ```bash
   python3 scripts/memory_query.py \
       --partition <name> \
       --query "<user terms>" \
       --limit 10 \
       --format json
   ```

3. Parse results. Each result has:
   - `session_id`
   - `timestamp`
   - `snippet` (FTS5 result snippet)
   - `source_type` (plan / context-note / debug-note / user-message)
   - `source_path` (if disk-backed)

4. Present results to user as:

   ```markdown
   ### Memory matches (overlay: <name>)
   1. <date> — <source_type> — <snippet>
      <link to source if available>
   2. ...
   ```

5. If 0 results, say so explicitly. Do NOT make up plausible matches.

## Cross-overlay searches

By default, this skill searches ONLY the active partition.

To search another partition, the user must explicitly say:

```
pcoc.memory-search --partition <other> "<query>"
```

This is logged to the audit log because cross-overlay reads are
sensitive (e.g., searching the "work" partition while in the
"personal" overlay).

## Privacy

- The memory DB is local-only (`memory/pcoc_memory.db`)
- It is gitignored
- It can be wiped at any time: `rm memory/pcoc_memory.db`
- Sensitive terms are NOT redacted before storage (the DB is local)
  but ARE redacted when memory results appear in user-facing output

## Anti-patterns

1. Reading from a different overlay's partition without explicit user
   command
2. Echoing sensitive terms found in memory snippets
3. Inventing memory results when 0 actually matched
4. Treating memory as ground truth — it's a hint, not an authority;
   the active state of the codebase always wins on conflict
