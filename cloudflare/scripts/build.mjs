import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const [entry, args, cwd] of [
  [
    '../../client/node_modules/vite/bin/vite.js',
    ['build'],
    new URL('../../client/', import.meta.url),
  ],
  [
    '../node_modules/wrangler/bin/wrangler.js',
    ['deploy', '--dry-run', '--outdir', '.build'],
    new URL('../', import.meta.url),
  ],
]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(entry, import.meta.url)), ...args],
    {
      cwd: fileURLToPath(cwd),
      stdio: 'inherit',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
