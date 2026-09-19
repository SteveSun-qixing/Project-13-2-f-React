import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const directory of ['dist', 'coverage']) {
  await rm(resolve(packageRoot, directory), { recursive: true, force: true });
}
process.stdout.write('dist/ 与 coverage/ 已清理\n');
