# Contributing to pcoc-agent

Thanks for considering a contribution. Highest-leverage areas:

1. **Skills**: new skills with calibration baselines included
2. **Golden cases**: realistic test scenarios for existing skills
3. **Overlay templates**: public-safe overlay configs for common stacks
4. **Privacy-guard rules**: new patterns to block, with proof of need
5. **Docs**: especially migration guides from other harnesses

## Mandatory pre-PR checklist

- [ ] `scripts/check-no-secrets.sh` passes
- [ ] No personal overlay content is committed (`overlays/` should
      only contain `example/` and the README in PR diffs)
- [ ] No hardcoded paths from your machine (no `~/Users/yourname/...`)
- [ ] New skills have at least 3 golden cases in `calibration/golden_cases/`
- [ ] New hooks fail open (a broken hook never blocks the user)
- [ ] New agents declare their tool whitelist explicitly

## Style

- Markdown: line-wrap at ~80 cols for body text; tables and code blocks
  can exceed this.
- Code: black for Python, prettier defaults for JS.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- One concern per PR.

## Skill contribution template

A new skill lives at `.claude/skills/<skill-name>/SKILL.md` and must
include:

```yaml
---
name: my-skill
description: >-
  One paragraph: what it does, when to trigger, when NOT to trigger.
  Under 1024 chars.
calibration:
  golden_cases: calibration/golden_cases/<skill-name>/
  baseline_score: <integer 0-100>
  requires_human_promote: true
---
```

Plus accompanying golden cases at
`calibration/golden_cases/<skill-name>/case-NN.yaml`.

## Reporting Security Issues

Please follow [SECURITY.md](./SECURITY.md) — do not open public issues
for security bugs.

## Code of Conduct

Be kind. Disagree on substance. Assume good faith. The maintainers
reserve the right to lock threads that lose the thread.
