---
name: pcoc-redact
description: >-
  Sensitive content redaction. Invoked automatically before any
  user-facing output, audit log write, or git commit. Replaces
  detected credentials, sensitive terms, and high-entropy strings
  with placeholder tokens. Mapping is in-memory only.
calibration:
  golden_cases: calibration/golden_cases/pcoc-redact/
  baseline_score: 30
  requires_human_promote: true
---

# Skill: pcoc-redact

## When to use

- Before printing any answer that may reference file contents the
  agent has read
- Before writing to any file that may be committed (i.e., not in
  `.pcoc-runtime/`)
- Before logging to `calibration/audit_log.md`
- Before any `WebSearch` or `WebFetch` payload preparation

## When NOT to use

- Internal reasoning traces (these stay in context, not on disk)
- The user's own input echoed back verbatim (they wrote it; redacting
  back at them is confusing)

## Detection layers

### Layer 1 — Credential patterns

| Pattern                              | Replacement              |
| ------------------------------------ | ------------------------ |
| `AKIA[A-Z0-9]{16}`                   | `<REDACTED:aws-key>`     |
| `gh[pousr]_[A-Za-z0-9]{36,}`         | `<REDACTED:gh-pat>`      |
| `sk-[A-Za-z0-9]{32,}`                | `<REDACTED:openai-key>`  |
| `sk_live_[A-Za-z0-9]{24,}`           | `<REDACTED:stripe-live>` |
| `xox[abpr]-[A-Za-z0-9-]{10,}`        | `<REDACTED:slack-token>` |
| `-----BEGIN [A-Z ]+ PRIVATE KEY-----.*?-----END [A-Z ]+ PRIVATE KEY-----` | `<REDACTED:private-key>` |
| `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | `<REDACTED:jwt>` |

### Layer 2 — High-entropy detection

Strings of length ≥ 32 chars with:
- Shannon entropy > 4.0 bits/char, AND
- No common English word fragment (avoid false positives on prose)

→ `<REDACTED:high-entropy>`

### Layer 3 — User-defined terms

From the active overlay's `sensitive_terms_file`:

```yaml
# overlay.yaml
sensitive_terms_file: ~/.pcoc/sensitive-terms.work.local.txt
```

Each line in that file is matched case-insensitive against the
output. Matches replaced with `<REDACTED:user-term:N>` where N is
the line number (the actual term is never quoted in the placeholder).

### Layer 4 — Path-based hints

If the user's prompt or context mentions paths under:
- `~/.ssh/`
- `~/.aws/`
- `~/.config/<known credential dir>`
- Anything in `denied_paths`

Then the redactor is more aggressive in that response — high-entropy
threshold drops to 3.5, suspicion of any quoted base64-looking string.

## Hard rules

- **Never write the original to disk** as a "backup before redacting".
  The mapping table is in memory only.
- **Never echo a redacted term**, even in error messages. Errors say
  "redaction occurred at position N" — not what the term was.
- **Never trust a single layer**. Run all four every time. Performance
  cost is negligible; missing a token is catastrophic.

## False-positive handling

If the user complains "you redacted something that wasn't sensitive":

1. Acknowledge
2. Show the placeholder + position
3. Ask the user to confirm the original is safe to reproduce
4. Only then reproduce it

This is intentional friction. False positives are recoverable;
false negatives are not.

## Hand-off

After redaction, return the cleaned payload. The orchestrator decides
where it goes (user-facing, audit log, etc.). The redactor's only job
is to clean.
