#!/usr/bin/env node
/** Build for Playwright/e2e with local auth (no Supabase baked into the bundle). */
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
};

function run(label, command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true, env });
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed`);
    process.exit(result.status ?? 1);
  }
}

run('Typecheck', 'npm', ['run', 'typecheck']);
run('Vite build (test mode)', 'npx', ['vite', 'build', '--mode', 'test']);
