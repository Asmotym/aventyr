import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? findTests(file) : entry.name.endsWith('.test.ts') ? [file] : [];
  });
}

const args = process.argv.slice(2);
const suite = args.find(arg => arg.startsWith('--suite='))?.slice('--suite='.length);
const suites = {
  rooms: { flag: 'ROOMS_INTEGRATION', matches: name => ['rooms-http.integration.test.ts', 'lifecycle.integration.test.ts', 'settings-transfer.integration.test.ts'].includes(name) },
  locale: { flag: 'LOCALE_INTEGRATION', matches: name => name === 'locale.integration.test.ts' },
  bonus: { flag: 'BONUS_INTEGRATION', matches: name => name === 'bonus-point-config.integration.test.ts' },
  awards: { flag: 'ROLL_AWARDS_INTEGRATION', matches: name => name === 'session-awards.integration.test.ts' },
  bag: { flag: 'BAG_INTEGRATION', matches: name => /^(room-bag|room-session-bag).*integration\.test\.ts$/.test(name) },
  articles: { flag: 'ARTICLES_INTEGRATION', matches: name => name === 'articles.integration.test.ts' },
  talents: { flag: 'TALENT_INTEGRATION', matches: name => name.startsWith('room-talents') },
};
if (suite && !suites[suite]) throw new Error(`Unknown test suite: ${suite}`);
const withServer = args.includes('--with-server') || args.includes('--server-only');
const files = [
  ...(args.includes('--server-only') ? [] : findTests('tests/frontend')),
  ...(withServer ? findTests('server/tests') : []),
].filter(file => !suite || suites[suite].matches(basename(file))).sort();
if (!files.length) throw new Error('No tests matched');
const env = { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' };
if (suite) env[suites[suite].flag] = '1';
if (args.includes('--integration')) for (const entry of Object.values(suites)) env[entry.flag] = '1';
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit', env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
