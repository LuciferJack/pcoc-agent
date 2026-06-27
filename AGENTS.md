# pcoc-agent — Codex / OpenAI Agents Compatibility

This file mirrors `CLAUDE.md` for Codex CLI and other agent runtimes that
follow the AGENTS.md convention. Behavior is identical to `CLAUDE.md`;
this file exists so the same `process/` and `calibration/` state stays
consistent across runtimes.

The agents in `.codex/agents/` mirror those in `.claude/agents/`. The
skills live in one place: `.claude/skills/`, symlinked to `.agents/skills`
for Codex discovery.

See [CLAUDE.md](./CLAUDE.md) for the full protocol.
