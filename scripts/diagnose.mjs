#!/usr/bin/env node
/**
 * Run browser diagnostics against yarn dev (real .env) and live production.
 * Saves HTML report + failure artifacts under playwright-report/.
 *
 * Usage:
 *   npm run diagnose
 *   npm run diagnose:prod
 *   PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app npm run diagnose:prod
 */
import { spawnSync } from 'node:child_process';

const target = process.argv[2] ?? 'all';

function run(label, args, extraEnv = {}) {
  console.log(`\n==> ${label}`);
  const result = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (see playwright-report/ for traces & screenshots)`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label}`);
}

console.log('Mana Market — environment diagnostics\n');

if (target === 'dev' || target === 'all') {
  run('Dev server (yarn dev + real Supabase .env)', [
    '--project=dev',
    '--reporter=list',
  ], { PW_SERVER: 'dev' });
}

if (target === 'prod' || target === 'all') {
  const url = process.env.PLAYWRIGHT_BASE_URL?.trim() || 'https://mana-market-eta.vercel.app';
  console.log(`Production URL: ${url}`);
  run('Live production deployment', [
    '--project=production',
    '--reporter=list',
  ], { PW_SERVER: 'none' });
}

console.log('\n✓ Diagnostics complete.');
console.log('Open playwright-report/index.html for traces, screenshots, and video on failures.');
