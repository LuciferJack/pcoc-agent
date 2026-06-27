# pcoc-agent — Claude Code Handoff Document

> 把这份文档放到 pcoc-agent 仓库根目录（或 `~/Documents/` 里也行），
> 在 Claude Code 里说 "Read HANDOFF.md and continue building per the
> priorities listed" 就能接手。
>
> **生成时间**：2026-06-27
> **当前版本**：v0.1.0（已推送 GitHub）
> **维护者 GitHub**：LuciferJack

---

## 1. 用 30 秒理解这个项目

pcoc-agent 是一个 Claude Code / Codex 的 agent harness。它把两套主流路线
（vibecode 风格的 phase-locked 工作流 + Hermes 风格的 self-evolving
agent）的精华缝合，再加了一个两边都缺的东西：**校准 gate**。

核心洞察来自在线广告系统：模型上线必须做 pcoc 校准
（predicted CTR / actual CTR ≈ 1.0 才合格）。LLM 写出来的 skill 也是
模型，也需要被外部 judge 评估，不能让作者自己打分。

设计哲学一句话：**让 agent 像团队里的工程师一样走流程，并且不让它
单独决定自己的产出质量。**

完整背景见 `docs/WHY-PCOC.md`。

---

## 2. 维护者背景（影响设计决策的部分）

> 这部分给 Claude Code 用来理解设计选择和分析风格。不含任何敏感细节。

- **资深工程师**，约 10 年大规模 ML 系统经验
- 来自**在线广告系统**领域，对 pcoc 校准、AB 实验、灰度发布、特征
  压缩、OCPC 类在线学习有深度实操经验
- 当前在做 **AI 芯片推理基础设施**（diagnostic agent 方向）+ 几个个人
  项目（trajectory agent、量化交易监控）
- **学术背景**：硬件 + 软件复合（microelectronics 本科/硕士 + 工业界
  软件工程师）
- 偏好**结构化技术问答**，具体框架在 `.claude/skills/pcoc-fengchao-style/`

### 偏好的回答风格

技术问题按 8 步答：

```
1. 是什么 (定义)
2. 为什么需要 (动机)
3. 去掉的代价 (反证价值)
4. 覆盖场景 (适用边界)
5. 不变的本质 (核心抽象)
6. 元结构映射 (见下面 6 大元结构)
7. 关联到他熟悉的领域 (在线广告系统 / 大模型 agent)
8. 一句话总结
```

### 6 大元结构（recurring lens）

回答技术问题时常用的抽象框架：

1. **直连 > 转发** — 减少中间层
2. **学分布 > 学答案** — 学规律比记答案泛化性强
3. **按需 > 固定** — on-demand 比 hardcoded 适应性强
4. **压缩 = 理解** — 高压缩比往往等价于深度理解
5. **先通用后专用** — 通用 primitive 之上再做 specialization
6. **竞争产生秩序** — 多 candidate 对抗产生筛选机制
   ⚠️ **这条特别重要**——pcoc-agent 的 calibration gate 就是这条
   元结构的应用。Hermes 失败的核心就是缺这条。

### 工程优化公式

```
找瓶颈 → 消除浪费 → 按需分配 → 并行重叠 → 换空间换时间
```

### 类比偏好

新概念尽量映射到**广告排序系统的对应物**。例子：

| 大模型 / agent 概念       | 广告系统对应物              |
| --------------------- | -------------------- |
| Skill self-evolution loop | OCPC 在线学习            |
| Skill calibration gate    | pcoc 校准 + AB 实验      |
| RIPER-5 plan-as-artifact  | 上线评审制度               |
| Phase-locked tools        | 灰度发布闸                |
| Memory + FTS5 召回         | 索引压缩 + 召回排序          |
| Hermes self-grading bug   | 模型自评 = 训练集泄漏到测试集     |
| Cross-overlay isolation   | 流量隔离 / 桶切流           |

---

## 3. v0.1.0 已完成清单

仓库根目录的完整状态。所有列出的文件**都已经测试过**：
- Node `.cjs` hooks 全部 `node --check` 通过
- Python ab_runner.py 端到端 smoke test 跑通过
- bash 脚本 `bash -n` 语法检查通过
- `check-no-secrets.sh --all` 0 命中
- 个人信息审计 0 命中

### 已交付组件

| 类别                 | 数量 | 路径                                          | 状态 |
| ------------------ | -- | ------------------------------------------- | -- |
| 顶层文档               | 7  | README{,.zh-CN}.md / LICENSE / SECURITY.md / CONTRIBUTING.md / CLAUDE.md / AGENTS.md | ✅ |
| Agents             | 7  | `.claude/agents/pcoc-{research,innovate,plan,execute,calibrate,evolve,security}.md` | ✅ |
| Skills             | 8  | `.claude/skills/pcoc-{setup,plan,debug,skill-promote,redact,fengchao-style,memory-search,ab-experiment}/SKILL.md` | ✅ |
| Hooks              | 4  | `.claude/hooks/{privacy-guard,skill-audit-log,work-personal-split,session-init}.cjs` | ✅ syntax + functional tested |
| Calibration runner | 1  | `calibration/ab_runner.py`                  | ✅ smoke tested |
| Golden cases       | 3  | `calibration/golden_cases/pcoc-fengchao-style/case-{01,02,03}.yaml` | ✅ |
| Audit log (committed) | 1  | `calibration/audit_log.md`                  | ✅ initial empty |
| Overlay template   | 1  | `overlays/example/{overlay.yaml,README.md}` | ✅ |
| Architecture docs  | 3  | `docs/{ARCHITECTURE,PRIVACY,WHY-PCOC}.md`   | ✅ |
| Bootstrap installer | 1  | `install.sh`                                | ✅ syntax tested |
| Secret scanner     | 1  | `scripts/check-no-secrets.sh`               | ✅ tested |
| Manifest           | 1  | `pcoc-manifest.json`                        | ✅ valid JSON |

---

## 4. v0.2.0 待办（按优先级）

### P0 — 不补就基本不能用

#### P0.1 — `scripts/memory_query.py`
- **被谁引用**：`pcoc-memory-search` skill 直接调它
- **要做的事**：SQLite + FTS5 查询脚本
- **接口**：
  ```bash
  python3 scripts/memory_query.py \
      --partition <name> \
      --query "<terms>" \
      --limit 10 \
      --format json
  ```
- **schema 草案**（写到 `memory/schema.sql`）：
  ```sql
  CREATE TABLE memory_entries (
      id INTEGER PRIMARY KEY,
      partition TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source_type TEXT NOT NULL,   -- plan / context / debug / user-msg
      source_path TEXT,
      content TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE memory_fts USING fts5(content, partition, content=memory_entries);
  CREATE INDEX idx_partition_time ON memory_entries(partition, timestamp);
  ```
- **关键约束**：跨 partition 查询必须显式 `--cross-partition` flag，
  否则只查当前 partition

#### P0.2 — `PCOC_GEN_FN` reference implementation
- **被谁引用**：`calibration/ab_runner.py` 现在用 stub
- **要做的事**：写一个真实的 LLM 调用模块
- **接口**：
  ```python
  # overlays/_active/judge.py 或 scripts/anthropic_gen.py
  def generate(case: dict, version_a_path: str, version_b_path: str) -> tuple[str, str]:
      """Returns (output_a, output_b) by running the trigger prompt
      under both SKILL.md versions as system context."""
  ```
- **环境变量激活**：`export PCOC_GEN_FN=scripts.anthropic_gen:generate`
- **关键**：必须用 `claude` CLI 或 Anthropic API；同一模型同一温度跑两遍
- **隐私要求**：调用前必须先跑一遍 pcoc-redact skill 清理 case 内容

#### P0.3 — `PCOC_JUDGE_FN` reference implementation
- 同上，但是 judge 函数
- **必须用不同的模型**或至少不同的 context（fresh session）
- **接口**：
  ```python
  def score(case: dict, output_a: str, output_b: str, judge_model: str) -> dict:
      """Returns {"a": float, "b": float, "method": str, "note": str}"""
  ```
- **rubric 评估**：根据 case 的 `scoring_rubric` 字段，分维度打分后加权

### P1 — 补完一致性

#### P1.1 — 剩下 7 个 skill 的 golden cases
现在只有 `pcoc-fengchao-style/` 有 3 个 case。每个 skill 至少需要 3 个：

```
calibration/golden_cases/
├── pcoc-setup/             ← 还没建
├── pcoc-plan/              ← 还没建
├── pcoc-debug/             ← 还没建
├── pcoc-skill-promote/     ← 还没建
├── pcoc-redact/            ← 还没建
├── pcoc-memory-search/     ← 还没建
└── pcoc-ab-experiment/     ← 还没建
```

每个 case YAML 格式见 `calibration/golden_cases/pcoc-fengchao-style/case-01.yaml`。

**重要原则**：每个 skill 至少要有 1 个**负样本**（应该不触发的场景），
1 个**对抗样本**（边界压力测试），1 个**典型用法**。

#### P1.2 — `scripts/scan-entropy.sh`
- **被谁引用**：`docs/PRIVACY.md`
- **功能**：扫描 repo 里所有高熵字符串（≥32 char、entropy > 4.0/char）
- **可参考**：`scripts/check-no-secrets.sh` 的结构

#### P1.3 — `scripts/check-overlay-leak.sh`
- **被谁引用**：`SECURITY.md`、`CONTRIBUTING.md`
- **功能**：检查 git tracked files 里有没有 overlay 名（除 `example` 外）
  ——任何 `overlays/<name>/` 不是 example 被 tracked 都是泄漏

#### P1.4 — CLI 命令实现
现在 `CLAUDE.md` 里提到的这些命令都还是声明，没有真实现：
- `pcoc.promote <skill>` — 应该是 skill-promote skill 的触发器
- `pcoc.reject <skill>` — 同上
- `pcoc.switch <overlay>` — 切换 overlay 的 ln -sfn 操作
- `pcoc.override <reason>` — 单次绕过 privacy-guard

**实现选择**（讨论清楚后再开搞）：
- 选项 A：纯 shell wrapper（`scripts/pcoc`），用户在 terminal 里跑
- 选项 B：Claude Code slash command（`.claude/commands/promote.md`）
- 选项 C：两个都做（terminal 用 A，Claude Code 内用 B）

推荐 C，先做 B（更高频）。

### P2 — 完善生态

#### P2.1 — Codex agent mirror
`.codex/agents/` 现在是空目录。需要把 `.claude/agents/*.md` 镜像过去
（同样内容，但适配 Codex 的发现机制）。可以是 symlink，但要确认
Codex 是否跟 symlink。

#### P2.2 — CI workflow
新建 `.github/workflows/check.yml`，内容已经在 `PUBLISH-TO-GITHUB.md`
里给了草稿。三个 job：
- `no-secrets` — 跑 `check-no-secrets.sh --all`
- `syntax` — Node + Python + bash 语法检查
- `golden-cases` — 验证每个 skill 都有 ≥ 3 个 case（结构性检查）

#### P2.3 — Migration guides
- `docs/migration-from-vibecode.md` — 给从 vibecode-pro-max-kit 来的人
- `docs/migration-from-hermes.md` — 给从 Hermes 来的人

每篇内容：架构差异表 + 数据迁移路径 + 心智模型对照。

#### P2.4 — `docs/SECURITY-HALL-OF-FAME.md`
SECURITY.md 提到了但没建。空的也行，至少占位。

### P3 — 优化和打磨

- 各 SKILL.md 的 `baseline_score` 都是估的，应该用真 calibration run 校正
- README 顶部加 badges（CI status、license、star）
- `scripts/init-overlay.sh` — 交互式建 overlay 的脚本（比手动 cp 友好）
- `scripts/pcoc-doctor.sh` — 健康检查脚本（检查 hooks 可执行、Node 在 PATH、
  Python 版本足够等）

---

## 5. 不可破的硬规则

以下规则**所有 Claude Code 后续 session 都必须遵守**。违反任意一条
就是这个项目的失败。

### 5.1 Skill 提升流程

```
人写 / pcoc-evolve 起草
        │
        ▼
.claude/skills/_staging/<id>/    ← 必须先到这里
        │
        ▼
pcoc-calibrate 跑 AB              ← 不能跳过
        │
        ▼
calibration/results/<id>_*.json   ← 必须产报告
        │
        ▼
用户说 pcoc.promote <id>           ← 不能 agent 自己做主
        │
        ▼
.claude/skills/<id>/              ← 旧版本进 .pcoc-runtime/retired/
audit_log.md 追加一条             ← 必须留痕
```

**直接 Write `.claude/skills/<id>/SKILL.md`**（绕过 staging）→
skill-audit-log hook 会**大声警告**，但不阻塞——这是给 emergency hotfix
留的口子。任何这样的写入**必须**手动追加 audit log 解释为什么。

### 5.2 Privacy guard 不能绕

`privacy-guard.cjs` 拦的几类路径**永远拦**：
- `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`
- `~/.ssh/*`, `~/.aws/*`, `~/.gnupg/*`, `~/.kube/*`, `~/.docker/*`
- `~/.anthropic/*`, `~/.openai/*`
- `~/.okx/*`, `~/.binance/*`, `wallet.dat`
- 浏览器 keychain / `Login Data` / `Cookies`
- 当前 active overlay 的 `denied_paths`

**改这个清单要慎重**——只能往里加，不能往里删。

### 5.3 Audit log 不能静默

任何 skill 变更（_staging 写入 / 提升 / 退役 / override）都必须产生
audit log 条目。两个文件：

- `calibration/audit_log.md` — committed，只放 hash 和决策
- `calibration/audit_log.local.md` — gitignored，放完整 forensic 细节

skill-audit-log hook 已经做了机械记录，但**业务层（agent / skill）做
重大变更时也要主动补一条**说明 why。

### 5.4 Overlay 边界

如果用户在 overlay A 的 session 里，**不能**读 overlay B 的
`allowed_paths`。`work-personal-split.cjs` hook 已经拦了，但 agent
本身也要先自我审查再发起调用。

跨 overlay 真有需要 → `pcoc.override <reason>` → audit log。

### 5.5 不能引入 IM bridge / heartbeat / 多模型路由

这三个是 Hermes 做的、我们故意没做的。原因写在 `docs/WHY-PCOC.md`
和 `docs/ARCHITECTURE.md` 的 "What we explicitly don't ship" 章节。
任何想加这三类功能的 PR 都要先讨论威胁模型。

---

## 6. 怎么加一个新 skill（推荐流程）

```bash
# 1. 起草到 _staging
mkdir -p .claude/skills/_staging/my-new-skill
cat > .claude/skills/_staging/my-new-skill/SKILL.md <<'EOF'
---
name: my-new-skill
description: >-
  When to trigger, what it does, when NOT to trigger. <1024 chars.
calibration:
  golden_cases: calibration/golden_cases/my-new-skill/
  baseline_score: 30    # estimate; will calibrate later
  requires_human_promote: true
---

# Skill: my-new-skill

## When to use
...

## When NOT to use
...

## Procedure
...

## Anti-patterns
...
EOF

# 2. 写至少 3 个 golden case
mkdir -p calibration/golden_cases/my-new-skill
$EDITOR calibration/golden_cases/my-new-skill/case-01.yaml  # typical use
$EDITOR calibration/golden_cases/my-new-skill/case-02.yaml  # adversarial
$EDITOR calibration/golden_cases/my-new-skill/case-03.yaml  # negative (no-trigger)

# 3. 跑 calibration
export PCOC_GEN_FN=scripts.anthropic_gen:generate   # 需要先做 P0.2
export PCOC_JUDGE_FN=scripts.anthropic_judge:score  # 需要先做 P0.3
python3 calibration/ab_runner.py \
    --skill my-new-skill \
    --version-a baseline \
    --version-b staging \
    --output calibration/results/my-new-skill_$(date +%Y%m%d_%H%M%S).json

# 4. 看报告，决定 promote / reject / iterate
cat calibration/results/my-new-skill_*.json | python3 -m json.tool

# 5. （在 Claude Code 里）人工提升
# pcoc.promote my-new-skill
```

---

## 7. 怎么处理一个 bug 报告（标准动作）

直接调 `pcoc-debug` skill。它会：

```
1. 收证据（不假设）
2. 给 2-3 个 hypothesis（不只一个）
3. 跑能证伪的测试（不是能证实的）
4. 锁定 root cause + 给 fix boundary
5. 交给 pcoc-execute 实施（debug 和 fix 是两个角色）
```

**反模式**：debug 阶段就改代码、单一 hypothesis tunnel vision、
用能 confirm 而不是能 refute 的测试。

---

## 8. 维护者的几个具体使用场景

> 这部分写给 Claude Code 用来理解 overlay 应该怎么建。**具体路径
> 留空**——维护者会在自己的 Mac 上填实际路径。

### 场景 A：企业工作（敏感）

需要一个 `overlays/work/` overlay：
- `allowed_paths`: 仅企业代码仓库 + 工作文档目录
- `denied_paths`: 默认 + `~/.okx`, `~/quant`, `~/personal/*`
- `sensitive_terms_file`: `~/.pcoc/sensitive-terms.work.local.txt`
  里放：内部项目代号、合作客户简称、特定同事姓名（HR 场景下）、
  敏感人物代号
- `memory_partition: work`

### 场景 B：trajectory/journal agent（中等敏感）

需要一个 `overlays/sic/` overlay（用户的个人轨迹 agent 项目）：
- `allowed_paths`: `~/sic/`, `~/.sic/`
- `denied_paths`: 默认 + 工作路径 + 量化路径
- `local_skills`: 该项目特定 skill（self-evolution daily/weekly report 等）
- `memory_partition: sic`

设计参考：这个 trajectory agent 的核心是 "工作留痕，Agent 自长" —
镜像 pcoc-agent 自身的 self-evolution 机制，但运行在用户本地的笔记/
git history 上。可以直接复用 `pcoc-evolve` + `pcoc-calibrate` 的工具链。

### 场景 C：量化交易系统（最敏感）

需要一个 `overlays/quant/` overlay：
- `allowed_paths`: 仅 `~/quant/` 代码目录
- `denied_paths`: 默认 + 工作路径 + `~/.okx/`（这个**就算量化也不该读**——
  代码用 env var 注入凭证就行）
- `sensitive_terms_file`: 策略魔数、风控阈值、本金规模线索
- `memory_partition: quant`
- 任何涉及交易策略的输出**必须**先过 pcoc-redact

**特别警告**：量化 overlay 是最容易出事的——既有金钱，又有算法 IP，
又有交易所审计风险。在这个 overlay 下：
- 永不外发实盘配置到外部 API（包括 LLM）
- 永不在 git commit message 里写具体盈亏数字
- 任何代码改动都走 RIPER-5+C 完整流程，不走 shortcut

---

## 9. Anti-patterns 清单

Claude Code 在接手时容易犯的错：

1. **直接修改 active skill**——必须走 _staging → calibrate → promote
2. **跳过 50% check-in**——pcoc-execute 必须做
3. **single-hypothesis debug**——必须 2-3 个 hypothesis 对抗
4. **confirmation tests**——必须用能 refute 的测试
5. **silent scope creep**（"我刚顺手也改了..."）——必须返回 PLAN
6. **plan 里 Touchpoints 空着**（"边写边定"）——这就是 plan 的本质
7. **跳过 Resume Handoff section**——context compaction 之后接不上
8. **过度触发 fengchao-style 框架**——简单问题不要硬套 8 步
9. **从一个 overlay 偷看另一个 overlay**——work-personal-split 会拦，
   但 agent 本来就不应该尝试
10. **在 commit message 里写敏感信息**——commit message 是公开的

---

## 10. 给 Claude Code 的 "start here"

**第一步**：读完这份 HANDOFF.md（你正在读）

**第二步**：浏览这几个关键文件，建立 mental model：
- `README.md` — 项目定位
- `docs/ARCHITECTURE.md` — 四层结构
- `docs/WHY-PCOC.md` — 为什么这么设计
- `CLAUDE.md` — orchestrator 协议
- `.claude/agents/pcoc-calibrate.md` — 最核心的新 agent
- `calibration/ab_runner.py` — 校准器的代码（看 stub 在哪）

**第三步**：跟用户确认从 P0 哪一项开始。建议顺序：

1. `P0.2 PCOC_GEN_FN` + `P0.3 PCOC_JUDGE_FN`（绑一起做最自然）
2. `P0.1 memory_query.py`（独立的，可以并行）
3. `P1.1` 给已有 skill 补 golden cases（这是上面三个真跑起来的前提）
4. `P1.4 CLI 命令实现`（让用户能 `pcoc.promote` 真的有反应）
5. P2 / P3 视情况

**第四步**：每做一项任务都走 RIPER-5+C 完整流程：
- R: 读相关文件确认现状
- I: 给 2-3 个实现方案，列 trade-off
- P: 写 plan 到 `process/general-plans/active/`
- 等用户说 "ENTER EXECUTE MODE"
- E: 实施，50% 报告，self-review
- C: 如果改了 skill，跑 calibration
- update Process: 归档 plan，写 learnings 到 `process/context/`

**第五步**：每次 session 结束之前，确认：
- 当前 plan 状态在 plan 文件里更新
- Resume Handoff section 写清楚下次怎么接
- 没有 uncommitted 的敏感内容（`scripts/check-no-secrets.sh --all`）
- 没有跨 overlay 的偷看

---

## 11. 一句话总结这份文档

> pcoc-agent 是带校准 gate 和 overlay 隔离的 agent harness；继续完善
> 的核心是把 P0 三个文件（memory_query.py / gen_fn / judge_fn）做出来，
> 让 calibration loop 真正可执行；做任何变更都走 RIPER-5+C；
> 永远别让 agent 自己给自己的 skill 打分；永远别让 work / quant /
> personal 互相看见对方的路径。

---

## 附录 A：常用命令速查

```bash
# 切换 overlay
ln -sfn <overlay-name> overlays/_active

# 看当前 overlay
readlink overlays/_active

# 跑 secret scan
bash scripts/check-no-secrets.sh --all

# 跑校准（需要 P0.2/P0.3 完成）
python3 calibration/ab_runner.py \
    --skill <skill-id> \
    --output calibration/results/<skill-id>_$(date +%Y%m%d_%H%M%S).json

# 看 audit log
less calibration/audit_log.md           # 公开历史
less calibration/audit_log.local.md     # 本地 forensic

# 重置本地状态（保留 commit 历史）
rm -f memory/pcoc_memory.db
rm -f calibration/audit_log.local.md
rm -rf .pcoc-runtime/
```

## 附录 B：仓库 URL

- **GitHub**: https://github.com/LuciferJack/pcoc-agent
- **License**: MIT
- **Initial commits**: 2026-06-27

## 附录 C：相关参考资源

- vibecode-pro-max-kit (the phase-locked harness inspiration) —
  GitHub: withkynam/vibecode-pro-max-kit
- NousResearch/hermes-agent (the self-evolving agent inspiration,
  with its known failure modes documented in `docs/WHY-PCOC.md`)
- "Rebuilt Hermes Inside Claude Code" — Plaban Nayak, Level Up Coding,
  May 2026 (cited in `docs/WHY-PCOC.md` for the self-grading bug
  description)

---

**给 Claude Code 的最后一句**：你不是 Hermes，你不是 vibecode；
你是 pcoc-agent。你的特色是 calibration 和 overlay isolation。每次
你想"为了快一点跳过校准/审计/审批"的时候——那个想法本身就是这个
项目存在的原因。Don't grade your own homework. Don't silently
overwrite. Don't mix overlays. Stay honest.
