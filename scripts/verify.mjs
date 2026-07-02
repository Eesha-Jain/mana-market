#!/usr/bin/env node
/**
 * Full local verification: typecheck → Playwright e2e (builds test bundle + preview server).
 * Run: npm run verify
 */
import { spawnSync } from 'node:child_process';

function run(label, command, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

console.log('Mana Market — local verification\n');

run('TypeScript', 'npm', ['run', 'typecheck']);
run('Playwright e2e (test build + preview server + browser tests)', 'npm', [
  'run',
  'test:e2e',
]);

console.log('\n✓ All verification checks passed.');
