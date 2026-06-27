#!/usr/bin/env bash
# =============================================================================
# pcoc-agent installer
# Installs the harness layer into the current directory (or a target dir).
# Safe to re-run: existing files are backed up to .pcoc-backup/<timestamp>/.
# =============================================================================
set -euo pipefail

PCOC_REPO="${PCOC_REPO:-https://github.com/YOUR-HANDLE/pcoc-agent.git}"
PCOC_BRANCH="${PCOC_BRANCH:-main}"
TARGET_DIR="${1:-$(pwd)}"

# Pretty output
if [[ -t 1 ]]; then
  C_BLUE='\033[1;34m'; C_GREEN='\033[1;32m'; C_YELLOW='\033[1;33m'
  C_RED='\033[1;31m'; C_RESET='\033[0m'
else
  C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''
fi

say()  { printf "${C_BLUE}[pcoc]${C_RESET} %s\n" "$*"; }
ok()   { printf "${C_GREEN}[ ok ]${C_RESET} %s\n" "$*"; }
warn() { printf "${C_YELLOW}[warn]${C_RESET} %s\n" "$*"; }
die()  { printf "${C_RED}[fail]${C_RESET} %s\n" "$*" >&2; exit 1; }

# --- pre-flight checks ------------------------------------------------------
command -v git    >/dev/null || die "git is required"
command -v curl   >/dev/null || die "curl is required"
command -v python3 >/dev/null || warn "python3 not found — calibration runner will be unavailable"

[[ -d "$TARGET_DIR" ]] || die "target dir does not exist: $TARGET_DIR"
cd "$TARGET_DIR"

say "Installing pcoc-agent into: $TARGET_DIR"

# --- back up anything that would be clobbered -------------------------------
BACKUP_DIR=".pcoc-backup/$(date +%Y%m%d_%H%M%S)"
NEEDS_BACKUP=0
for path in .claude .codex CLAUDE.md AGENTS.md SECURITY.md; do
  [[ -e "$path" ]] && NEEDS_BACKUP=1
done

if [[ $NEEDS_BACKUP -eq 1 ]]; then
  warn "Existing harness files detected. Backing up to: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"
  for path in .claude .codex CLAUDE.md AGENTS.md SECURITY.md; do
    [[ -e "$path" ]] && cp -a "$path" "$BACKUP_DIR/" || true
  done
  ok "Backup complete."
fi

# --- fetch the harness ------------------------------------------------------
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

say "Fetching pcoc-agent ($PCOC_BRANCH) from $PCOC_REPO ..."
git clone --depth=1 --branch "$PCOC_BRANCH" "$PCOC_REPO" "$STAGING/repo" >/dev/null 2>&1 \
  || die "git clone failed — check PCOC_REPO and network"
ok "Fetched."

# --- copy harness layer (everything EXCEPT user content) --------------------
say "Copying harness files ..."

# These are the components that constitute the harness itself
HARNESS_PATHS=(
  ".claude/agents"
  ".claude/skills"
  ".claude/hooks"
  ".codex/agents"
  "calibration"
  "process/development-protocols"
  "scripts"
  "docs"
  "CLAUDE.md"
  "AGENTS.md"
  "SECURITY.md"
  "LICENSE"
)

for p in "${HARNESS_PATHS[@]}"; do
  src="$STAGING/repo/$p"
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$p")"
    cp -a "$src" "$p"
    ok "  $p"
  fi
done

# --- create runtime directories (gitignored) --------------------------------
say "Creating runtime directories ..."
mkdir -p process/general-plans/active
mkdir -p process/general-plans/completed
mkdir -p process/general-plans/backlog
mkdir -p process/features
mkdir -p process/context
mkdir -p calibration/results
mkdir -p memory
mkdir -p overlays
mkdir -p .pcoc

# --- .gitignore: append our patterns if not present -------------------------
if [[ ! -f .gitignore ]] || ! grep -q "pcoc-agent" .gitignore 2>/dev/null; then
  say "Appending pcoc-agent patterns to .gitignore ..."
  cat "$STAGING/repo/.gitignore" >> .gitignore
  ok "  .gitignore updated"
fi

# --- create local sensitive-terms placeholder ------------------------------
if [[ ! -f .pcoc/sensitive-terms.local.txt ]]; then
  cat > .pcoc/sensitive-terms.local.txt <<'EOF'
# pcoc-agent sensitive terms — LOCAL ONLY, never committed
# One term or regex per line. Lines starting with # are comments.
#
# Examples (delete and replace with your own):
# - real coworker names you discuss in HR contexts
# - internal project codenames
# - secret tuning constants
# - client names that shouldn't leave the box
EOF
  ok "  .pcoc/sensitive-terms.local.txt (placeholder)"
fi

# --- node check for hooks ---------------------------------------------------
if ! command -v node >/dev/null; then
  warn "node not found — Claude Code hooks (.cjs) require Node.js. Install it from https://nodejs.org/"
fi

# --- summary ----------------------------------------------------------------
say ""
ok "pcoc-agent installed."
say ""
say "Next steps:"
say "  1. Open Claude Code in this directory"
say "  2. Run: /pcoc-setup    (interactive first-run config)"
say "  3. Read: docs/PRIVACY.md before any sensitive work"
say ""
if [[ $NEEDS_BACKUP -eq 1 ]]; then
  say "Your previous config is in: $BACKUP_DIR"
fi
