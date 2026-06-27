---
name: pcoc-fengchao-style
description: >-
  Eight-step technical answer framework borrowed from online-advertising
  systems engineering culture. Trigger when answering "what is X" /
  "why is X needed" / "how does X work" — anything technical where a
  rote definition would lose the user. Produces structured explanation
  with explicit trade-offs and analogical bridges to the user's known
  domains.
calibration:
  golden_cases: calibration/golden_cases/pcoc-fengchao-style/
  baseline_score: 35
  requires_human_promote: true
---

# Skill: pcoc-fengchao-style

## When to use

User asks any of:
- "what is X?" / "what does X do?"
- "why do we need X?" / "what problem does X solve?"
- "how does X work?" / "explain X"
- Any technical Q where you can tell the user wants depth, not a one-liner

## When NOT to use

- Pure factual lookups ("what year did X ship")
- Code-writing requests
- Conversational small talk
- Requests where the user explicitly said "short answer please"

## The 8 steps

Structure your answer as:

### 1. 是什么 (What is it)
A precise definition. Not a marketing description. What does it
actually do, in one sentence?

### 2. 为什么需要 (Why is it needed)
What problem does it solve? What was the world like without it?

### 3. 去掉的代价 (Cost of removing it)
Reverse-prove its value. If you ripped it out, what would break? This
is the single most clarifying test of whether something matters.

### 4. 覆盖场景 (Scope of coverage)
How many problems does it cover? Is it a general primitive or a
specialized tool? Where does it stop being useful?

### 5. 不变的本质 (The invariant core)
After stripping away the surface, what's the unchanging idea
underneath? This is the part the user should remember in 5 years.

### 6. 元结构映射 (Meta-structure mapping)
Map to one or more of these recurring engineering patterns:
- 直连 > 转发 (direct > forwarded)
- 学分布 > 学答案 (learn distributions > memorize answers)
- 按需 > 固定 (on-demand > fixed)
- 压缩 = 理解 (compression = understanding)
- 先通用后专用 (general before specialized)
- 竞争产生秩序 (competition creates order)

### 7. 关联用户经验 (Analogical bridge)
If the user has stated a domain of expertise, find the corresponding
concept in their domain. The bridge sentence pattern is:

> 这就跟你做 [X] 时的 [Y] 是一回事 — 都是 [shared underlying mechanism].

### 8. 一句话总结本质 (One-sentence essence)
The single sentence the user takes away if they remember nothing else.

## Failure modes to avoid

1. **Wikipedia voice**: dry, encyclopedic, no point of view. The whole
   point of this skill is to give a structured opinion.
2. **Skipping step 3**: this is the step LLMs most often skip because
   it requires you to argue against the thing you just defined. Don't skip it.
3. **Forced analogies**: if no good bridge exists in step 7, say so —
   "no clean analog in your usual domain" beats a contrived bridge.
4. **Wrong-element meta-structures**: step 6 picks at most 2 elements,
   not all six. If you can't honestly map any, say "doesn't fit any
   element cleanly" and explain why.

## Format

Use headers for each of the 8 steps. Keep each step short — 2-4
sentences for steps 1, 2, 8; longer for 3, 5, 7 when the depth matters.
Tables OK when comparing two things. Lists when enumerating.

## Provenance

This framework originated in online ad-system engineering culture
(specifically large-scale ranking/bidding systems at Chinese internet
giants where structured technical onboarding is mandatory). It works
because every step forces the answerer to take a different angle on
the topic — definition, motivation, counterfactual, scope, essence,
abstraction, analogy, summary. Skipping any one step leaves a hole the
listener will feel even if they can't name it.
