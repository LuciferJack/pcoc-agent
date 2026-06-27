# How to publish this to GitHub

This file gives you three different paths to publish pcoc-agent depending
on what tools you have. Delete this file after you push — it's just
operator instructions.

## Path A — easiest, uses `gh` CLI (recommended)

If you have GitHub CLI installed (`brew install gh` on Mac, then `gh
auth login` once):

```bash
cd pcoc-agent
gh repo create pcoc-agent --public --source=. --remote=origin --push
```

That's it. The repo is created, this directory is set as the source,
the current commit is pushed.

If you want it private instead, swap `--public` for `--private`.

## Path B — using the GitHub web UI + git CLI

1. Go to https://github.com/new
2. Repository name: `pcoc-agent`
3. Description: `Phase-locked, Calibrated, Open-source Cognitive agent harness for Claude Code and Codex`
4. Public (or private — your call)
5. **Do NOT** check "Add a README", "Add .gitignore", or "Choose a license"
   — this repo already has all three and an initial commit
6. Click "Create repository"

Then in your terminal:

```bash
cd pcoc-agent
git remote add origin https://github.com/<YOUR-HANDLE>/pcoc-agent.git
git push -u origin main
```

(Replace `<YOUR-HANDLE>` with your GitHub username.)

## Path C — using SSH instead of HTTPS

Same as Path B, but the remote URL is:

```bash
git remote add origin git@github.com:<YOUR-HANDLE>/pcoc-agent.git
```

## Recommended post-push setup

After the push, in the GitHub repo settings:

1. **Topics** (top of repo page → ⚙ next to "About"): add `claude-code`,
   `agent-harness`, `claude`, `codex`, `ai-agents`, `privacy`,
   `mcp-server` (if applicable)

2. **Security**:
   - Settings → Code security and analysis → enable **Secret scanning**
     (free for public repos)
   - Settings → Code security and analysis → enable **Dependency
     graph** and **Dependabot alerts**

3. **Branch protection** for `main`:
   - Settings → Branches → Add rule → branch name pattern: `main`
   - Require PR before merging
   - Require status checks to pass (once you add CI)

4. **CI** (optional, recommended): add a `.github/workflows/check.yml`
   that runs `scripts/check-no-secrets.sh` on every PR — this is your
   automated guardrail against secret leaks from contributors.

## Before you push: final checklist

```bash
# Run from inside pcoc-agent/
bash scripts/check-no-secrets.sh --all

# Confirm git status is clean of personal content
git status --ignored --short | grep "^!!"   # should be empty in fresh install
git ls-files | xargs grep -l "TODO" 2>/dev/null   # check for forgotten TODOs

# Confirm .gitignore is doing its job
ls overlays/   # only example/ and README.md should be tracked
git check-ignore overlays/my-work 2>/dev/null && echo "✓ personal overlays gitignored"
```

If `check-no-secrets.sh` passes and the gitignore confirmation prints
the checkmark, you're safe to push.

## Update the install URL after pushing

Once your repo is up, edit `install.sh`:

```bash
sed -i.bak "s|YOUR-HANDLE|<your-actual-handle>|g" install.sh
git add install.sh && git commit -m "chore: set install.sh repo URL" && git push
rm install.sh.bak
```

That way users who hit the install line in the README get the right
repo URL.

## After publishing

- Watch your own repo (Settings → Notifications)
- Open issues in the GitHub project board for v0.2.0 plans
- Star your own repo (yes — it puts it in your starred list, makes it
  easy to find later)
