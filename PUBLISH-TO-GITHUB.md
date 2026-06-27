# 推到 LuciferJack/pcoc-agent

handle `LuciferJack` 已经烧进 `install.sh`、`README.md`、`README.zh-CN.md`、
`SECURITY.md`。下面是把这个仓库推到 https://github.com/LuciferJack/pcoc-agent
的三条路径，选一个。推完之后**把这个文件删掉**——它是操作指南，不是仓库内容。

## 路径 A：用 `gh` CLI（最快，推荐）

```bash
cd pcoc-agent
gh repo create LuciferJack/pcoc-agent \
    --public \
    --source=. \
    --remote=origin \
    --push \
    --description "Phase-locked, Calibrated, Open-source Cognitive agent harness for Claude Code and Codex"
```

一条命令搞定：建仓 + 加 remote + 推送。

如果想私有：把 `--public` 改成 `--private`。

## 路径 B：Web UI + git CLI

1. 浏览器打开 https://github.com/new
2. Repository name: `pcoc-agent`
3. Description: `Phase-locked, Calibrated, Open-source Cognitive agent harness for Claude Code and Codex`
4. Public（或 Private，看你）
5. **不要勾**「Add a README / Add .gitignore / Choose a license」——这三个仓库里都有了
6. Create repository

然后在 Mac 终端：

```bash
cd pcoc-agent
git remote add origin https://github.com/LuciferJack/pcoc-agent.git
git push -u origin main
```

## 路径 C：SSH（如果你 Mac 上 ssh key 已经配过）

```bash
cd pcoc-agent
git remote add origin git@github.com:LuciferJack/pcoc-agent.git
git push -u origin main
```

## 推送前的最后一遍检查（30 秒）

```bash
cd pcoc-agent

# 1. 没有泄密
bash scripts/check-no-secrets.sh --all
# 预期输出：✓ No secrets found.

# 2. 没有忘记的 placeholder
grep -rn "YOUR-HANDLE\|<your-handle>\|<YOUR-HANDLE>\|<owner>" \
    --include="*.md" --include="*.sh" --include="*.json" .
# 预期输出：无（grep 退出码 1）

# 3. overlays/ 里只有 example/ 在 tracking
git ls-files overlays/
# 预期输出：仅 overlays/README.md、overlays/example/README.md、overlays/example/overlay.yaml
```

三项都过了，再推。

## 推完之后建议立刻做这几件事

在 https://github.com/LuciferJack/pcoc-agent 仓库页面：

### 1. Topics（让人能搜到你）
点 ⚙ 旁边的 Topics 框，填：
```
claude-code  agent-harness  ai-agents  privacy
codex  riper-5  calibration  llm-agent
```

### 2. 开启安全功能
Settings → Code security and analysis：
- ✅ Secret scanning（公开仓库免费）
- ✅ Push protection
- ✅ Dependency graph
- ✅ Dependabot alerts

### 3. About 区域填一下
点仓库右上角的 ⚙：
- Website: 留空（或填 docs 链接）
- Topics: 见上
- Description: 仓库描述

### 4. 把 default branch 锁一锁（可选，建仓初期可以不做）
Settings → Branches → Add branch protection rule：
- Pattern: `main`
- Require pull request before merging
- Require status checks（等你接了 CI 再开）

## 加一份 CI（可选，但强烈建议）

新建 `.github/workflows/check.yml`：

```yaml
name: pcoc check
on: [push, pull_request]
jobs:
  no-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run secret check
        run: bash scripts/check-no-secrets.sh --all
  syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Node hook syntax
        run: for f in .claude/hooks/*.cjs; do node --check "$f"; done
      - name: Python ab_runner syntax
        run: python3 -m py_compile calibration/ab_runner.py
      - name: Shell scripts syntax
        run: for f in scripts/*.sh install.sh; do bash -n "$f"; done
```

这样每次有 PR 都会自动跑 secret 扫描 + 语法检查。

## 删掉这个文件

推上去之后：

```bash
cd pcoc-agent
git rm PUBLISH-TO-GITHUB.md
git commit -m "chore: remove publish instructions (already published)"
git push
```

或者先留着也行——它对未来贡献者有点用，可以挪到 `docs/PUBLISHING.md`。
