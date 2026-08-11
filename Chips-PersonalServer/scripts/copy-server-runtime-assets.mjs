import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceMigrationsDir = path.join(projectRoot, 'packages/server/src/db/migrations');
const distMigrationsDir = path.join(projectRoot, 'packages/server/dist/db/migrations');

if (!existsSync(sourceMigrationsDir)) {
  throw new Error(`Missing runtime asset source: ${sourceMigrationsDir}`);
}

rmSync(distMigrationsDir, { recursive: true, force: true });
mkdirSync(path.dirname(distMigrationsDir), { recursive: true });
cpSync(sourceMigrationsDir, distMigrationsDir, { recursive: true });

console.info(`Copied server runtime assets to ${distMigrationsDir}`);
