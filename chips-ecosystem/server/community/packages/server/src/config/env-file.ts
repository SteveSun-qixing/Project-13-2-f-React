import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * deploy/.env 显式加载（《服务端部署与运维》§6.1.1：环境文件由服务端代码显式加载，
 * 不扫描仓库根与其他目录）。零第三方依赖的最小解析器：
 * - 仅支持 `KEY=VALUE`、`#` 注释与空行；
 * - 值可选用成对单引号或双引号包裹（去引号，不做转义展开）；
 * - 已存在的进程环境变量优先，不被文件覆盖（与 dotenv 惯例一致）；
 * - 文件不存在时静默跳过（Compose/进程管理器可直接注入环境变量）。
 */

/** 从指定文件读取键值对（仅返回进程环境中尚不存在的键）。 */
export function readEnvFileEntries(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const entries: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key.length === 0) {
      continue;
    }
    entries[key] = value;
  }
  return entries;
}

/** deploy/.env 的产品级落点：`server/community/deploy/.env`（相对本模块定位，开发与构建产物同深度）。 */
export function defaultEnvFilePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/config｜dist/config → packages/server → packages → community → deploy/.env
  return path.resolve(here, '../../../../deploy/.env');
}

/**
 * 显式加载环境文件：只补齐进程环境中缺失的键（直接写入 `process.env`）。
 * 测试环境（NODE_ENV=test）不加载，避免真值污染测试夹具。
 */
export function loadEnvFile(filePath: string = defaultEnvFilePath()): void {
  if (process.env['NODE_ENV'] === 'test') {
    return;
  }
  const entries = readEnvFileEntries(filePath);
  for (const [key, value] of Object.entries(entries)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
