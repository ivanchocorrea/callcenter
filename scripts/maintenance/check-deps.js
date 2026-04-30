#!/usr/bin/env node
/**
 * check-deps.js — Verifica dependencias desactualizadas en backend y frontend.
 * Uso:
 *   node scripts/maintenance/check-deps.js [--json]
 *
 * Sale 0 si no hay nada o solo hay patches/minor; 2 si hay versiones major.
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECTS = ['backend', 'frontend'];
const JSON_OUT = process.argv.includes('--json');

function diffType(a, b) {
  const pa = String(a).replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10));
  const pb = String(b).replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10));
  if (!pb[0] || isNaN(pb[0])) return 'none';
  if ((pb[0] || 0) > (pa[0] || 0)) return 'major';
  if ((pb[1] || 0) > (pa[1] || 0)) return 'minor';
  if ((pb[2] || 0) > (pa[2] || 0)) return 'patch';
  return 'none';
}

function checkProject(name) {
  const cwd = path.join(ROOT, name);
  let raw = '{}';
  try {
    raw = execSync('npm outdated --json --long', {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 5 * 1024 * 1024,
    }).toString();
  } catch (e) {
    raw = (e.stdout || Buffer.from('{}')).toString();
  }
  const data = raw.trim() ? JSON.parse(raw) : {};
  return Object.entries(data).map(([pkg, info]) => ({
    project: name,
    package: pkg,
    current: info.current,
    wanted: info.wanted,
    latest: info.latest,
    type: diffType(info.current, info.latest),
  }));
}

const all = PROJECTS.flatMap(checkProject);
const summary = {
  total: all.length,
  patches: all.filter(x => x.type === 'patch').length,
  minor:   all.filter(x => x.type === 'minor').length,
  major:   all.filter(x => x.type === 'major').length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({ summary, items: all }, null, 2));
} else {
  console.log(`\nResumen: ${summary.total} desactualizados`);
  console.log(`  - patches: ${summary.patches}`);
  console.log(`  - minor:   ${summary.minor}`);
  console.log(`  - major:   ${summary.major}\n`);
  for (const it of all) {
    const flag = it.type === 'major' ? '⚠ ' : '  ';
    console.log(`${flag}[${it.project}] ${it.package}  ${it.current} → ${it.latest}  (${it.type})`);
  }
}

process.exit(summary.major > 0 ? 2 : 0);
