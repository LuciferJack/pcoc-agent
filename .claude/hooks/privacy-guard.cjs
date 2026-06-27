#!/usr/bin/env node
// =============================================================================
// pcoc-agent privacy-guard hook
//
// Fires on PreToolUse for Read / Edit / Write / Bash.
// Refuses access to credential-store paths and overlay-denied paths.
// Fail-open: if the hook crashes, the user's workflow is not blocked
//             (we log the crash, then permit — security via prevention,
//             not via denial-of-service).
//
// Audit-logs every block and every override to:
//   calibration/audit_log.local.md
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const AUDIT = 'calibration/audit_log.local.md';

// ---------- baseline denylist (always blocked, regardless of overlay) -------
const ALWAYS_BLOCKED = [
  /\/\.env(\.|$)/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /\.jks$/,
  /\/\.ssh(\/|$)/,
  /\/\.aws(\/|$)/,
  /\/\.gnupg(\/|$)/,
  /\/\.config\/(gh|git-credentials|gcloud)/,
  /\/\.kube\/config/,
  /\/\.docker\/config\.json/,
  /\/\.anthropic(\/|$)/,
  /\/\.openai(\/|$)/,
  /\/\.okx(\/|$)/,
  /\/\.binance(\/|$)/,
  /\/wallet\.dat$/,
  /\/Keychains\//,
  /\/Login Data$/,
  /\/Cookies$/,
  /id_rsa(\.pub)?$/,
  /id_ed25519(\.pub)?$/,
  /authorized_keys$/,
  /known_hosts$/,
  /\/secrets?\//,
  /\/credentials?\//,
];

// ---------- bash command patterns that should never run --------------------
const BLOCKED_BASH_PATTERNS = [
  /cat\s+[~/].*\.(env|pem|key)\b/,
  /cat\s+~\/\.ssh\//,
  /cat\s+~\/\.aws\//,
  /aws\s+configure\s+get/,
  /security\s+find-(internet|generic)-password/,
  /\bcurl\s+[^|]*\bAuthorization:\s+/i,  // sending auth headers to remote
  /git\s+remote\s+set-url.*:.*@/,        // creds in remote URL
];

// ---------- helpers ---------------------------------------------------------
function loadActiveOverlay() {
  // Active overlay is a symlink at overlays/_active
  try {
    const real = fs.realpathSync('overlays/_active');
    const yamlPath = path.join(real, 'overlay.yaml');
    if (!fs.existsSync(yamlPath)) return null;
    const text = fs.readFileSync(yamlPath, 'utf8');
    // Tiny YAML parse — only the fields we need
    return parseOverlayYaml(text);
  } catch (e) {
    return null;  // no overlay active
  }
}

function parseOverlayYaml(text) {
  const result = { allowed_paths: [], denied_paths: [] };
  let mode = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('#') || line === '') continue;
    if (line === 'allowed_paths:') { mode = 'allowed'; continue; }
    if (line === 'denied_paths:') { mode = 'denied'; continue; }
    if (line.match(/^\w+:/)) { mode = null; continue; }
    const m = line.match(/^\s*-\s*(.+)$/);
    if (m && mode) {
      const expanded = m[1].replace(/^~/, HOME).trim();
      result[`${mode}_paths`].push(expanded);
    }
  }
  return result;
}

function isBlocked(targetPath, overlay) {
  // 1. Always-blocked patterns
  for (const re of ALWAYS_BLOCKED) {
    if (re.test(targetPath)) return { reason: 'credential-store', pattern: re.source };
  }
  // 2. Overlay-specific denials
  if (overlay && overlay.denied_paths) {
    for (const denied of overlay.denied_paths) {
      if (targetPath.startsWith(denied)) {
        return { reason: 'overlay-denied', pattern: denied };
      }
    }
  }
  return null;
}

function isBlockedBash(command) {
  for (const re of BLOCKED_BASH_PATTERNS) {
    if (re.test(command)) return { reason: 'bash-pattern', pattern: re.source };
  }
  return null;
}

function audit(line) {
  try {
    const dir = path.dirname(AUDIT);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString();
    fs.appendFileSync(AUDIT, `\n## ${timestamp} — privacy-guard\n${line}\n`);
  } catch (e) {
    // Audit log failure is non-fatal but we want it visible
    process.stderr.write(`[pcoc privacy-guard] audit log write failed: ${e.message}\n`);
  }
}

// ---------- main ------------------------------------------------------------
function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (e) {
    // Fail-open: no input parsed, permit the call.
    process.stderr.write(`[pcoc privacy-guard] could not parse hook input — permitting\n`);
    process.exit(0);
  }

  const overlay = loadActiveOverlay();
  const tool = input.tool_name || input.tool || '';
  const args = input.tool_input || input.params || {};

  // For Read / Edit / Write — check the file path
  if (['Read', 'Edit', 'Write', 'NotebookRead', 'NotebookEdit'].includes(tool)) {
    const targetPath = args.file_path || args.path || args.notebook_path || '';
    if (!targetPath) {
      process.exit(0);  // nothing to check, permit
    }
    const blocked = isBlocked(targetPath, overlay);
    if (blocked) {
      audit(
        `BLOCKED ${tool} on ${targetPath}\n` +
        `- reason: ${blocked.reason}\n` +
        `- pattern: ${blocked.pattern}\n` +
        `- overlay: ${overlay ? overlay.name || 'unnamed' : 'none-active'}\n`
      );
      // Refuse the call. Exit code 2 = blocking refusal in Claude Code hooks.
      process.stderr.write(
        `\n🔒 pcoc privacy-guard refused ${tool} on a protected path.\n` +
        `   Reason: ${blocked.reason}\n` +
        `   Override (logged): pcoc.override <reason>\n`
      );
      process.exit(2);
    }
  }

  // For Bash — check the command
  if (tool === 'Bash') {
    const command = args.command || '';
    const blocked = isBlockedBash(command);
    if (blocked) {
      audit(
        `BLOCKED Bash command\n` +
        `- pattern: ${blocked.pattern}\n` +
        `- command (truncated): ${command.slice(0, 200)}\n`
      );
      process.stderr.write(
        `\n🔒 pcoc privacy-guard refused Bash command.\n` +
        `   Matched: ${blocked.pattern}\n` +
        `   Override (logged): pcoc.override <reason>\n`
      );
      process.exit(2);
    }
    // Also check any path arguments inside bash command
    if (overlay && overlay.denied_paths) {
      for (const denied of overlay.denied_paths) {
        if (command.includes(denied)) {
          audit(
            `BLOCKED Bash touching denied path\n` +
            `- denied path: ${denied}\n` +
            `- overlay: ${overlay.name || 'unnamed'}\n`
          );
          process.stderr.write(
            `\n🔒 pcoc privacy-guard refused Bash: command references overlay-denied path ${denied}.\n`
          );
          process.exit(2);
        }
      }
    }
  }

  // Default: permit
  process.exit(0);
}

try {
  main();
} catch (err) {
  // Fail-open on any unhandled error — security tool that DOSes the user is worse
  process.stderr.write(`[pcoc privacy-guard] error (failing open): ${err.message}\n`);
  process.exit(0);
}
