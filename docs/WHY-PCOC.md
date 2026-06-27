# Why pcoc-agent exists

There are dozens of Claude Code harnesses. Two schools dominate:

1. **Phase-locked harnesses** (vibecode-pro-max-kit, claude-code-harness,
   etc.) — they put rails around the agent's workflow: plans are
   artifacts, tools are whitelisted per phase, approvals are gated.
2. **Self-evolving agents** (Hermes Agent, OpenClaw, ECC, etc.) —
   they give the agent persistent memory, let it create its own skills
   from experience, route messages across IM channels, run with cron
   and heartbeats.

Both schools work for their target audience. Both have a hole.

**The hole is the same hole**: neither has a robust way to know whether
a new skill is actually any good.

- Phase-locked harnesses don't generate new skills automatically, so
  the question doesn't arise — at the cost of the agent never getting
  better at the things you do repeatedly.
- Self-evolving agents do generate new skills, but the LLM that wrote
  the skill is also the only judge of whether it's good. This is the
  same model grading its own homework.

The downstream consequences in the self-evolving-agent school are
[publicly documented](https://levelup.gitconnected.com/rebuilt-hermes-inside-claude-code-b8d9c4ca5d21):

- Hermes-style systems accumulate 15+ near-identical skills over time
  with no clear winner
- Skills silently overwrite vetted prior versions
- No audit log means quality degradation is invisible until it bites
- The predecessor system (OpenClaw) had 200+ vulnerabilities found
  since launch, and the skill marketplace had 386 malicious packages
  from a single threat actor

These aren't bugs in any one implementation — they're the failure
mode of "model evaluates its own output" combined with "no human in
the loop".

## The fix is older than LLMs

In online advertising systems, machine-learned scoring models route
billions of dollars. They are not allowed to grade themselves.

The discipline is **calibration**: predicted CTR / actual CTR ≈ 1.0
across well-defined slices. A model that scores well on its training
loss but is poorly calibrated against ground truth doesn't get
deployed. There's an offline calibration gate. There's an online A/B
gate. There's a human (or a committee) who approves the rollout.

The name "pcoc" — *predicted CTR over CTR* — refers exactly to that
gate. It is the most familiar metric to anyone who has shipped a
ranking or bidding model in production.

The insight that drives pcoc-agent is small but it matters: **the
discipline that ad-system engineers apply to ML models is the
discipline LLM agents now need**. A skill is just a learned routing
behavior. Like any learned behavior, it can be miscalibrated, can
drift, and shouldn't be deployed on the strength of self-judgment.

## What pcoc-agent does differently

| Concern                            | Phase-locked harnesses | Self-evolving agents | pcoc-agent                                       |
| ---------------------------------- | ---------------------- | -------------------- | ------------------------------------------------ |
| Plans as artifacts                 | ✅                      | ❌                    | ✅                                                |
| Phase-locked tool whitelists       | ✅                      | ❌                    | ✅                                                |
| Persistent memory                  | ❌                      | ✅                    | ✅ (local-only, SQLite+FTS5)                      |
| Skills auto-generated from experience | ❌                  | ✅                    | ✅ (lands in `_staging/`, not active)             |
| Skill quality gate                 | n/a                    | self-grade           | golden case A/B + human promote                  |
| Skill audit log                    | ❌                      | ❌                    | ✅ (committed hashes + local-only details)        |
| Privacy hooks                      | partial                | partial              | multi-layer (paths + entropy + user terms)       |
| Overlay isolation                  | ❌                      | ❌                    | ✅ (work / personal / quant boundaries)           |

The three rows in **bold** below the table are what's new:

1. **Calibration A/B gate**. Every skill change runs against a golden
   case set, scored by a judge that is NOT the same instance that
   wrote the skill. Programmatic checks where they apply
   (must-contain, must-not-contain, length); LLM-as-judge with
   rubrics where prose quality matters.

2. **Human promotion command**. Even when calibration says "promote",
   the skill doesn't go live until you say `pcoc.promote <skill>`.
   The audit log records the decision and the prior version. Nothing
   is silent.

3. **Overlay isolation**. Different scopes of work — your day job,
   your side project, your trading bot — run under different overlays
   with different `allowed_paths`, different memory partitions, and
   different sensitive-term redaction lists. The boundaries are
   enforced by a hook, not just by convention.

## What we keep from each school

- **From phase-locked harnesses**: RIPER-5 workflow, plan-as-artifact,
  tool whitelists per phase, the "no silent scope creep" discipline.
- **From self-evolving agents**: persistent memory (SQLite+FTS5),
  skill self-evolution as a real workflow (not "rewrite SKILL.md by
  hand"), the recognition that an agent that doesn't compound its
  learning is just an expensive autocomplete.

## What we explicitly don't ship

- **IM bridges**. Hermes does Telegram/Discord/Slack/WhatsApp/Signal
  beautifully. Every one of those is also a credential attack surface
  and a place where work content can land on personal channels by
  accident. If you want them, run Hermes in parallel — but on a
  different threat model.
- **Heartbeat / cron**. Always-on agents need always-on monitoring,
  always-on credential refresh, and always-on audit. We don't yet
  trust ourselves to do all three well, so we don't ship the feature.
- **Multi-LLM routing inside one session**. Skill calibration assumes
  the model is constant during the comparison. Swapping models
  silently breaks the comparison. We may add this later with explicit
  re-calibration triggers.

## A reasonable summary

Phase-locked harnesses are very safe and never learn. Self-evolving
agents learn and quietly degrade. pcoc-agent tries to keep the
learning behavior of the second school while inheriting the discipline
of the first school, and then borrows one more piece — calibration
against ground truth — from an older field that already learned this
lesson.

If that sounds useful, you're the audience. If you want to ship
faster with less ceremony, you have other options.
