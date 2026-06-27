# Project Context

This file is populated by the `pcoc-setup` skill on first run. It
holds the read-only summary of the current codebase that the agent
loads at session start.

In a fresh install, this file is empty. Run `/pcoc-setup` in Claude
Code to populate it (the setup walks the codebase under the active
overlay's `allowed_paths`).

For domain-specific context (e.g., team-specific patterns,
architecture rationale), create additional files under
`process/context/all-<domain>.md` and reference them from this file.
