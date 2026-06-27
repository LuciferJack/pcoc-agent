#!/usr/bin/env node
// =============================================================================
// pcoc-agent session-init hook
//
// Fires on SessionStart. Injects compact context describing:
//   - the active overlay (if any)
//   - any in-progress plan
//   - recovered approval-gate state (after context compaction)
//
// Output is JSON written to stdout, which Claude Code prepends to the system
// prompt for this session.
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');

function activeOverlayInfo() {
  try {
    const real = fs.realpathSync('overlays/_active');
    const name = path.basename(real);
    const yamlPath = path.join(real, 'overlay.yaml');
    if (!fs.existsSync(yamlPath)) return { name, declared: false };
    return { name, declared: true, yaml_path: yamlPath };
  } catch (e) {
    return null;
  }
}

function activePlanInfo() {
  const dir = 'process/general-plans/active';
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const fullPath = path.join(dir, f);
      const content = fs.readFileSync(fullPath, 'utf8');
      const statusMatch = content.match(/\*\*Status\*\*:\s*(\S+)/);
      const approvalMatch = content.match(/- \[(x| )\] Plan approved/);
      return {
        path: fullPath,
        status: statusMatch ? statusMatch[1] : 'UNKNOWN',
        approved: approvalMatch ? approvalMatch[1] === 'x' : false,
      };
    });
}

function recentAuditEntries(n) {
  const auditFile = 'calibration/audit_log.local.md';
  if (!fs.existsSync(auditFile)) return [];
  const content = fs.readFileSync(auditFile, 'utf8');
  const entries = content.split('\n## ').slice(-n);
  return entries;
}

function main() {
  const overlay = activeOverlayInfo();
  const plans = activePlanInfo();

  const context = [];
  context.push('# pcoc-agent session context');
  context.push('');

  if (overlay) {
    context.push(`## Active overlay: ${overlay.name}`);
    if (overlay.declared) {
      context.push(`Config: ${overlay.yaml_path}`);
    } else {
      context.push(`⚠️  Overlay symlink exists but no overlay.yaml found.`);
    }
  } else {
    context.push('## No active overlay');
    context.push('Session is in neutral mode. Set overlay with: `pcoc.switch <name>`');
  }
  context.push('');

  if (plans.length > 0) {
    context.push('## Active plans');
    for (const plan of plans) {
      const flag = plan.approved ? '✅ approved' : '⏳ awaiting approval';
      context.push(`- ${plan.path} — status: ${plan.status} — ${flag}`);
    }
    context.push('');
    context.push('**Reminder**: do not EXECUTE on an unapproved plan. If a prior session said');
    context.push('"ENTER EXECUTE MODE", confirm with the user before resuming — context may have been compacted.');
  } else {
    context.push('## No active plans');
  }
  context.push('');

  // Output as the format Claude Code expects from hooks
  const output = {
    additional_context: context.join('\n'),
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

try { main(); }
catch (err) {
  process.stderr.write(`[pcoc session-init] error: ${err.message}\n`);
  process.exit(0);
}
