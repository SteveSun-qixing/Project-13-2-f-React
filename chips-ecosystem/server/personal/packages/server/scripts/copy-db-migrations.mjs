import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 构建期资产拷贝：drizzle 迁移 SQL 与快照不经 tsc 编译，需原样随 dist 发布
 * （server.ts 启动迁移从 dist/db/migrations 读取）。
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const source = path.join(packageRoot, 'src', 'db', 'migrations');
const target = path.join(packageRoot, 'dist', 'db', 'migrations');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log(
  `[copy-db-migrations] ${path.relative(packageRoot, source)} -> ${path.relative(packageRoot, target)}`
);
