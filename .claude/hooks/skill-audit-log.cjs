#!/usr/bin/env node
// =============================================================================
// pcoc-agent skill-audit-log hook
//
// Fires on PostToolUse for Write / Edit.
// Detects any change inside .claude/skills/ and appends an audit entry.
// Fail-open: a broken audit hook never blocks the user.
//
// This is the mechanism that defeats "silent skill overwrite" — every
// modification to a skill is logged with timestamp, tool, file, and a hash
// of the new content.
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT = 'calibration/audit_log.md';  // committed audit log
const LOCAL_AUDIT = 'calibration/audit_log.local.md';  // local-only

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function audit(committedEntry, localEntry) {
  try {
    const dir = path.dirname(AUDIT);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(AUDIT, committedEntry);
    fs.appendFileSync(LOCAL_AUDIT, localEntry);
  } catch (e) {
    process.stderr.write(`[pcoc skill-audit-log] audit write failed: ${e.message}\n`);
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (e) {
    process.exit(0);
  }

  const tool = input.tool_name || input.tool || '';
  if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) {
    process.exit(0);
  }

  const args = input.tool_input || input.params || {};
  const targetPath = args.file_path || args.path || '';
  if (!targetPath) process.exit(0);

  // Only care about skill files
  if (!targetPath.includes('.claude/skills/')) {
    process.exit(0);
  }

  const isStaging = targetPath.includes('.claude/skills/_staging/');
  const isActive = !isStaging && /\.claude\/skills\/[^_][^/]*\//.test(targetPath);
  const isRetired = targetPath.includes('.pcoc-runtime/retired/');

  const timestamp = new Date().toISOString();
  let lane;
  if (isStaging) lane = 'STAGING';
  else if (isActive) lane = 'ACTIVE';
  else if (isRetired) lane = 'RETIRED';
  else lane = 'OTHER-SKILL-PATH';

  // Compute content hash AFTER write — we re-read file
  let contentHash = 'unreadable';
  try {
    const content = fs.readFileSync(targetPath, 'utf8');
    contentHash = sha256(content);
  } catch (e) { /* ignore */ }

  // Active-lane writes are the dangerous case. Loudly flag them.
  const isAlarming = (lane === 'ACTIVE');

  const committedEntry =
    `\n## ${timestamp} — skill ${lane} write\n` +
    `- path: ${targetPath}\n` +
    `- tool: ${tool}\n` +
    `- content sha256 (first 16): ${contentHash}\n` +
    (isAlarming ? `- ⚠️  DIRECT WRITE TO ACTIVE SKILL — this should only happen via pcoc-skill-promote\n` : '');

  const localEntry =
    `\n## ${timestamp} — skill ${lane} write (local detail)\n` +
    `- path: ${targetPath}\n` +
    `- tool: ${tool}\n` +
    `- session: ${process.env.CLAUDE_SESSION_ID || 'unknown'}\n`;

  audit(committedEntry, localEntry);

  // If active write, alert via stderr (non-blocking)
  if (isAlarming) {
    process.stderr.write(
      `\n⚠️  pcoc skill-audit: direct write to ACTIVE skill at ${targetPath}.\n` +
      `   This is logged. If you didn't mean to bypass calibration, revert and use pcoc-evolve + pcoc-calibrate + pcoc.promote.\n`
    );
  }

  process.exit(0);
}

try { main(); }
catch (err) {
  process.stderr.write(`[pcoc skill-audit-log] error (failing open): ${err.message}\n`);
  process.exit(0);
}
