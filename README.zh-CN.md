# pcoc-agent

> **P**hase-locked · **C**alibrated · **O**pen-source **C**ognitive agent harness
>
> 给不放心 agent 自己给自己打分的工程师用的 harness。

[English](./README.md) · [Why pcoc?](./docs/WHY-PCOC.md) · [架构](./docs/ARCHITECTURE.md) · [隐私](./docs/PRIVACY.md)

---

## 这是什么

pcoc-agent 是给 Claude Code（以及 Codex，通过 mirror 层）用的 harness。
它把两套主流路线的优点缝在一起，再补上一件两边都缺的东西。

| 流派                                  | 优点                                       | 缺点                                |
| ----------------------------------- | ---------------------------------------- | --------------------------------- |
| Phase-locked 派（vibecode 风格）           | Plan-as-artifact、工具白名单分阶段、人工审批闸           | 没记忆、没自演化、没量化校验               |
| 自演化派（Hermes 风格）                       | 自学习 skill、持久 memory、跨 IM channel           | Skill 自评、没 audit log、静默覆盖   |
| **pcoc-agent**                      | **两边的好都收下，再加上凤巢式的 pcoc 校准 gate**            | 新项目，欢迎社区反馈                       |

核心洞察来自大型在线广告系统：模型上线必须做 **pcoc 校准**
（predicted CTR / actual CTR ≈ 1.0 才算合格）。Agent 也是一样
——大模型自评"我这个 skill 写得很好"不算数；过了黄金测试集 + 过了人工
推广 gate，才算数。

## RIPER-5+C 工作流

```
R — Research          只读，收集证据
I — Innovate          探索方案，不写码
P — Plan              写到磁盘的 spec
E — Execute           按 plan 执行，工具受阶段约束
C — Calibrate    ★新   新/改动 skill 跑黄金用例做 AB 对比
   — update Process   归档 plan，写入学习项；前提是 C 过了
```

`C` 阶段不可绕过。任何想从 `_staging/` 提升到正式 active 的 skill，
都必须跑一遍 AB 对比，把 delta 摆给你看。最终是你说 `pcoc.promote <skill>`
或 `pcoc.reject <skill>`——没有静默的事。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/LuciferJack/pcoc-agent/main/install.sh | bash
```

然后在 Claude Code 里：

```
/pcoc-setup
```

setup 会引导你走完：

1. **隐私姿态**：复核 privacy-guard hook 配置；声明你的敏感词清单
   （清单文件不会被 commit）
2. **Overlay 选择**：选或建一个 overlay（work / personal / experimental）
   ——overlay 隔离 context、skill、memory 分区
3. **校准集种子**：可选导入一份起步用的黄金用例集，或从你最近用得
   多的 prompt 自动派生
4. **代码库扫描**：只读 walk，填充 `process/context/`

## Overlay 体系（隐私的核心抓手）

**公开 repo 里没有任何你的个人内容**。你的真实业务全部装在本地的
overlay 里：

```
overlays/
├── example/          模板，公开的，repo 里唯一一个 overlay
├── my-work/          ← gitignored，你的工作 context
├── my-quant/         ← gitignored，你的量化机器人 context
└── my-personal/      ← gitignored，日记/研究/等等
```

每个 overlay 用 `overlay.yaml` 声明边界：

```yaml
name: my-work
visibility: local-only
allowed_paths:
  - ~/repos/my-work-project
  - ~/docs/work
denied_paths:
  - ~/repos/my-quant-project
  - ~/.okx
inherited_skills:
  - pcoc-plan
  - pcoc-debug
  - pcoc-calibrate
local_skills:
  - work-specific-skill-1
sensitive_terms_file: ~/.pcoc/sensitive-terms.work.local.txt
memory_partition: work
```

在某个 overlay 下开的 session，只能动 overlay 允许的范围。
跨界的事由 `work-personal-split.cjs` hook 拦住。

## 仓库结构

```
.claude/
├── agents/       7 个专项 agent（research/innovate/plan/execute/
│                 calibrate/evolve/security）
├── skills/       带校准基线的核心 skill
└── hooks/        privacy-guard · audit-log · work-personal-split · session-init

calibration/      A/B 跑分器 + golden_cases/ + 审计日志
process/          plan + context + feature 工作区（artifacts 是 gitignored）
overlays/         你的私人 overlay 放这儿（除 example/ 外都 gitignored）
docs/             架构、隐私、为什么是 pcoc、迁移指南
scripts/          运维 / debug 工具
```

## 对比表

|                          | vibecode-pro-max-kit | Nous Hermes      | pcoc-agent     |
| ------------------------ | -------------------- | ---------------- | -------------- |
| Plan-as-artifact         | ✅                    | ❌                | ✅              |
| 工具白名单分阶段                | ✅                    | ❌                | ✅              |
| 持久 memory                 | ❌（只有文件）             | ✅ SQLite+FTS5    | ✅ SQLite+FTS5  |
| Skill 自演化                  | ❌                    | ✅                | ✅（带 gate）      |
| 校准 A/B gate                | ❌                    | ❌                | ✅              |
| Skill audit log             | ❌                    | ❌                | ✅              |
| 多 overlay 隔离              | ❌                    | ❌                | ✅              |
| Privacy-guard hook         | 部分                   | 部分               | ✅（多层）          |
| 多 host（Claude/Codex）      | ✅                    | ✅                | ✅              |
| IM 桥（Telegram 等）          | ❌                    | ✅                | 可选插件           |
| Heartbeat / cron           | ❌                    | ✅                | 可选（带 gate）     |

## 什么时候该用 pcoc-agent

**用它，如果**：你是有几年工程经验的人，希望 agent 像真团队里的人一样
走流程，并且你不想让 agent 独自决定自己的产出质量。

**别用它，如果**：你就是想 vibe coding。校准 gate 是故意加摩擦的。
如果你宁可少做安全、跑得更快，那 vibecode 或裸 Claude Code 更合适。

## 贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。Skill、黄金用例、overlay
模板 是 leverage 最高的贡献方向。

**注意**：提 PR 之前请跑一遍 `scripts/check-no-secrets.sh`。

## License

MIT — 见 [LICENSE](./LICENSE)。
