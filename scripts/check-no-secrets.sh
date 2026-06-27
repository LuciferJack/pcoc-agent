#!/usr/bin/env bash
# =============================================================================
# pcoc-agent check-no-secrets
#
# Scans tracked files for known credential patterns. Designed to be run
# before any push to a public remote. Exit non-zero on findings so it
# can be wired into a pre-push git hook or CI.
#
# Usage:
#   scripts/check-no-secrets.sh            # scan tracked + staged files
#   scripts/check-no-secrets.sh --all      # also scan untracked (not gitignored)
#   scripts/check-no-secrets.sh --history  # additionally scan git history
# =============================================================================
set -euo pipefail

if [[ -t 1 ]]; then
  R='\033[1;31m'; G='\033[1;32m'; Y='\033[1;33m'; B='\033[1;34m'; N='\033[0m'
else
  R=''; G=''; Y=''; B=''; N=''
fi

SCAN_ALL=0
SCAN_HISTORY=0
for arg in "$@"; do
  case "$arg" in
    --all)     SCAN_ALL=1 ;;
    --history) SCAN_HISTORY=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# --- patterns --------------------------------------------------------------
# Each entry: "label|regex". Regex uses ERE syntax for grep -E.
PATTERNS=(
  "aws-access-key|AKIA[0-9A-Z]{16}"
  "aws-secret-key|aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{40}"
  "github-pat-classic|gh[pousr]_[A-Za-z0-9]{36,}"
  "github-pat-fine|github_pat_[A-Za-z0-9_]{20,}"
  "openai-sk|sk-[A-Za-z0-9]{40,}"
  "anthropic-key|sk-ant-[A-Za-z0-9_-]{40,}"
  "stripe-live|sk_live_[A-Za-z0-9]{20,}"
  "stripe-restricted|rk_live_[A-Za-z0-9]{20,}"
  "slack-bot-token|xoxb-[A-Za-z0-9-]{20,}"
  "slack-user-token|xoxp-[A-Za-z0-9-]{20,}"
  "google-api-key|AIza[0-9A-Za-z_-]{35}"
  "pem-private-key|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----"
  "ssh-private-key|-----BEGIN OPENSSH PRIVATE KEY-----"
  "rsa-private-key|-----BEGIN RSA PRIVATE KEY-----"
  "pgp-private-key|-----BEGIN PGP PRIVATE KEY BLOCK-----"
  "generic-secret-eq|(password|passwd|pwd|secret|api[_-]?key|apikey)[[:space:]]*[:=][[:space:]]*[\"'][^\"'[:space:]]{8,}[\"']"
  "jwt|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"
)

# Files that are documentation about patterns are allowed to contain
# example-looking strings. Skip them.
DOC_ALLOWLIST=(
  "scripts/check-no-secrets.sh"
  "scripts/scan-entropy.sh"
  ".claude/skills/pcoc-redact/SKILL.md"
  "SECURITY.md"
  "docs/PRIVACY.md"
)

is_allowlisted() {
  local f="$1"
  for a in "${DOC_ALLOWLIST[@]}"; do
    [[ "$f" == "$a" ]] && return 0
  done
  return 1
}

# --- collect file list -----------------------------------------------------
collect_files() {
  if [[ $SCAN_ALL -eq 1 ]]; then
    # Tracked + staged + untracked (but respecting .gitignore)
    git ls-files --cached --others --exclude-standard
  else
    # Tracked + staged only
    git ls-files --cached
  fi
}

# --- scan ------------------------------------------------------------------
FINDINGS=0
TMPFINDINGS=$(mktemp)
trap 'rm -f "$TMPFINDINGS"' EXIT

printf "${B}[pcoc check-no-secrets]${N} scanning...\n"

while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  is_allowlisted "$file" && continue
  # Skip binaries
  if file -b --mime "$file" 2>/dev/null | grep -q "charset=binary"; then
    continue
  fi

  for entry in "${PATTERNS[@]}"; do
    label="${entry%%|*}"
    regex="${entry#*|}"
    if matches=$(grep -nE "$regex" "$file" 2>/dev/null); then
      while IFS= read -r line; do
        # Truncate the match preview to avoid printing the secret in full
        preview=$(echo "$line" | cut -c1-80)
        echo "  ${R}[FAIL]${N} ${file}:${preview%% *} — pattern: ${label}" >> "$TMPFINDINGS"
        FINDINGS=$((FINDINGS+1))
      done <<< "$matches"
    fi
  done
done < <(collect_files)

# --- history scan (optional) ----------------------------------------------
if [[ $SCAN_HISTORY -eq 1 ]]; then
  printf "${B}[pcoc check-no-secrets]${N} scanning git history (may be slow)...\n"
  for entry in "${PATTERNS[@]}"; do
    label="${entry%%|*}"
    regex="${entry#*|}"
    if hits=$(git log --all -p --no-color 2>/dev/null | grep -nE "$regex" | head -5); then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        echo "  ${R}[HISTORY]${N} pattern ${label} found in git history (truncated): ${line:0:80}" >> "$TMPFINDINGS"
        FINDINGS=$((FINDINGS+1))
      done <<< "$hits"
    fi
  done
fi

# --- report -----------------------------------------------------------------
if [[ $FINDINGS -gt 0 ]]; then
  echo ""
  printf "${R}✗ Found %d potential secret(s):${N}\n" "$FINDINGS"
  cat "$TMPFINDINGS"
  echo ""
  printf "${Y}Do not push.${N} Review each finding. If a finding is a false positive,\n"
  printf "either add the file to the DOC_ALLOWLIST in this script or refine the\n"
  printf "regex pattern. If a finding is a real secret:\n"
  printf "  1. Rotate the credential immediately.\n"
  printf "  2. Scrub git history with git filter-repo or git filter-branch.\n"
  printf "  3. Re-run with --history to confirm.\n"
  exit 1
else
  printf "${G}✓ No secrets found.${N}\n"
  exit 0
fi
