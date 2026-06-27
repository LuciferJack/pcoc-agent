#!/usr/bin/env node
// =============================================================================
// pcoc-agent work-personal-split hook
//
// Detects cross-overlay reads: if active overlay is "work" but a tool call
// targets a path that belongs to a different overlay (e.g., personal/quant),
// halt and surface a confirmation prompt.
//
// Reads overlays/*/overlay.yaml to know each overlay's allowed_paths.
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

function listOverlays() {
  try {
    if (!fs.existsSync('overlays')) return [];
    return fs.readdirSync('overlays')
      .filter(d => d !== '_active' && !d.startsWith('.') && d !== 'README.md')
      .map(d => path.join('overlays', d))
      .filter(p => fs.statSync(p).isDirectory());
  } catch (e) {
    return [];
  }
}

function loadOverlay(overlayDir) {
  const yamlPath = path.join(overlayDir, 'overlay.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  const text = fs.readFileSync(yamlPath, 'utf8');
  const result = { name: path.basename(overlayDir), allowed_paths: [] };
  let mode = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('#') || line === '') continue;
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) { result.name = nameMatch[1].trim(); continue; }
    if (line === 'allowed_paths:') { mode = 'allowed'; continue; }
    if (line.match(/^\w+:/)) { mode = null; continue; }
    const m = line.match(/^\s*-\s*(.+)$/);
    if (m && mode === 'allowed') {
      const expanded = m[1].replace(/^~/, HOME).trim();
      result.allowed_paths.push(expanded);
    }
  }
  return result;
}

function activeOverlayName() {
  try {
    const real = fs.realpathSync('overlays/_active');
    return path.basename(real);
  } catch (e) {
    return null;
  }
}

function pathBelongsToOverlay(targetPath, overlay) {
  for (const allowed of overlay.allowed_paths) {
    if (targetPath.startsWith(allowed)) return true;
  }
  return false;
}

function main() {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); }
  catch (e) { process.exit(0); }

  const tool = input.tool_name || input.tool || '';
  if (!['Read', 'Edit', 'Write', 'Bash'].includes(tool)) process.exit(0);

  const active = activeOverlayName();
  if (!active) process.exit(0);  // no overlay → no cross-overlay concern

  const args = input.tool_input || input.params || {};
  const targetPath = args.file_path || args.path || args.command || '';
  if (!targetPath) process.exit(0);

  // Load all overlays
  const overlays = listOverlays().map(loadOverlay).filter(Boolean);
  const activeOverlay = overlays.find(o => o.name === active);
  if (!activeOverlay) process.exit(0);

  // Check: does this path belong to a DIFFERENT overlay?
  for (const other of overlays) {
    if (other.name === active) continue;
    if (pathBelongsToOverlay(targetPath, other)) {
      // Cross-overlay attempt detected
      process.stderr.write(
        `\n🔒 pcoc work-personal-split: action targets path belonging to overlay '${other.name}'\n` +
        `   while active overlay is '${active}'.\n` +
        `   Refusing. To proceed: switch overlay (pcoc.switch ${other.name}) or override (pcoc.override <reason>).\n`
      );
      process.exit(2);
    }
  }

  process.exit(0);
}

try { main(); }
catch (err) {
  process.stderr.write(`[pcoc work-personal-split] error (failing open): ${err.message}\n`);
  process.exit(0);
}
