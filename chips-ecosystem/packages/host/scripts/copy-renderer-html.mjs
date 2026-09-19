import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(packageRoot, 'src/renderer/shell.html');
const target = resolve(packageRoot, 'dist/renderer/shell.html');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
process.stdout.write(`壳页面已复制：${target}\n`);
