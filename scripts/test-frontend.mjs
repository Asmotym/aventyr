import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? findTests(file) : entry.name.endsWith('.test.ts') ? [file] : [];
  });
}
const files = [
  ...findTests('tests/frontend'),
  ...(process.argv.includes('--with-server') ? findTests('server/tests') : []),
].sort();
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
