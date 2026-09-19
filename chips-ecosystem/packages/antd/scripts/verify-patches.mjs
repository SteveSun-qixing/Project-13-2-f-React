#!/usr/bin/env node
/**
 * 补丁栈一致性校验：台账（patches/patches.json）↔ 补丁文件 ↔ pnpm 配置 ↔ 已安装上游包。
 *
 * 检查项：
 * 1. 台账 schema、上游版本与 fork 版本口径（`<上游版本>-chips.N`）一致；
 * 2. 每个 `applied` 补丁：文件存在且非空、补丁文件覆盖全部声明 target、pnpm.patchedDependencies 已登记；
 * 3. 反向检查：pnpm 登记的补丁都在台账中，补丁目录不存在台账之外的 `.patch` 文件；
 * 4. `packages/antd/node_modules/<上游包>` 已安装且版本等于台账锁定版本，
 *    且每条 `verifications` 断言（file 相对上游包根、contains 为必须出现的文本）成立。
 *
 * 用法：node scripts/verify-patches.mjs [--root <工作区根>]
 * 退出码：0 通过；1 不一致；2 用法错误。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const packageDir = resolve(scriptDir, '..');
const defaultRoot = resolve(packageDir, '..', '..');
const LEDGER_PATH = join(packageDir, 'patches', 'patches.json');
const PATCHES_DIR = join(packageDir, 'patches');
const PATCH_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*@\d+\.\d+\.\d+\.patch$/;

function parseArgs(argv) {
  let root = defaultRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        return { error: '--root 缺少路径值' };
      }
      root = resolve(value);
      index += 1;
    } else {
      return { error: `未知参数：${arg}` };
    }
  }
  return { root };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fail(problems) {
  console.error(`[verify-patches] 补丁栈校验未通过，共 ${problems.length} 项：`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

function checkLedgerShape(ledger, problems) {
  if (typeof ledger !== 'object' || ledger === null) {
    problems.push('台账必须是 JSON 对象');
    return false;
  }
  const upstream = ledger.upstream;
  if (
    typeof upstream !== 'object' ||
    upstream === null ||
    typeof upstream.package !== 'string' ||
    typeof upstream.version !== 'string' ||
    typeof upstream.forkVersion !== 'string'
  ) {
    problems.push('台账缺少合法的 upstream（package / version / forkVersion）');
    return false;
  }
  if (
    upstream.forkVersion !== `${upstream.version}-chips.1` &&
    !/^\d+\.\d+\.\d+-chips\.\d+$/.test(upstream.forkVersion)
  ) {
    problems.push(`台账 forkVersion 口径非法：${upstream.forkVersion}`);
  }
  if (!Array.isArray(ledger.patches)) {
    problems.push('台账缺少 patches 数组');
    return false;
  }
  return true;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`[verify-patches] ${parsed.error}`);
    process.exit(2);
  }
  const problems = [];

  if (!existsSync(LEDGER_PATH)) {
    console.error(`[verify-patches] 台账不存在：${LEDGER_PATH}`);
    process.exit(2);
  }
  const ledger = readJson(LEDGER_PATH);
  if (!checkLedgerShape(ledger, problems)) {
    fail(problems);
  }

  const forkManifestPath = join(packageDir, 'package.json');
  const forkManifest = readJson(forkManifestPath);
  if (forkManifest.version !== ledger.upstream.forkVersion) {
    problems.push(
      `fork 版本不一致：package.json=${forkManifest.version}，台账=${ledger.upstream.forkVersion}`
    );
  }
  if (forkManifest.dependencies?.[ledger.upstream.package] !== ledger.upstream.version) {
    problems.push(
      `上游版本未锁定：package.json 中 ${ledger.upstream.package} 为 ${String(
        forkManifest.dependencies?.[ledger.upstream.package]
      )}，台账为 ${ledger.upstream.version}`
    );
  }

  const rootManifestPath = join(parsed.root, 'package.json');
  if (!existsSync(rootManifestPath)) {
    problems.push(`工作区根 package.json 不存在：${rootManifestPath}`);
    fail(problems);
  }
  const rootManifest = readJson(rootManifestPath);
  const patchedDependencies = rootManifest.pnpm?.patchedDependencies ?? {};
  const registeredPatchPaths = new Set(Object.values(patchedDependencies));

  const ledgerPatchFiles = new Set();
  for (const patch of ledger.patches) {
    if (typeof patch !== 'object' || patch === null) {
      problems.push('台账 patches 存在非对象条目');
      continue;
    }
    const { id, file, targets, reason, spec, status, verifications } = patch;
    if (
      typeof id !== 'string' ||
      typeof file !== 'string' ||
      !Array.isArray(targets) ||
      targets.length === 0
    ) {
      problems.push(`台账条目缺少 id / file / targets：${JSON.stringify(patch)}`);
      continue;
    }
    if (!PATCH_NAME_PATTERN.test(file)) {
      problems.push(`补丁文件名必须为 <包名>@<上游版本>.patch：${file}`);
    }
    if (!file.startsWith(`${ledger.upstream.package}@${ledger.upstream.version}`)) {
      problems.push(`补丁文件 ${file} 与锁定上游版本 ${ledger.upstream.version} 不一致`);
    }
    if (
      typeof reason !== 'string' ||
      reason.length === 0 ||
      typeof spec !== 'string' ||
      spec.length === 0
    ) {
      problems.push(`补丁 ${id} 必须写明 reason 与 spec（依据文档）`);
    }
    ledgerPatchFiles.add(file);

    if (status === 'retired') {
      if (registeredPatchPaths.has(join('packages/antd/patches', file))) {
        problems.push(`补丁 ${id} 已标记 retired，但仍登记在 pnpm.patchedDependencies 中`);
      }
      continue;
    }
    if (status !== 'applied') {
      problems.push(`补丁 ${id} 的 status 非法：${String(status)}（只允许 applied / retired）`);
      continue;
    }

    const patchPath = join(PATCHES_DIR, file);
    if (!existsSync(patchPath)) {
      problems.push(`补丁文件不存在：${file}`);
      continue;
    }
    const patchContent = readFileSync(patchPath, 'utf8');
    if (patchContent.trim().length === 0) {
      problems.push(`补丁文件为空：${file}`);
    }
    for (const target of targets) {
      if (!patchContent.includes(target)) {
        problems.push(`补丁 ${file} 未覆盖声明的 target：${target}`);
      }
    }
    const registrationPath = join('packages/antd/patches', file);
    if (!registeredPatchPaths.has(registrationPath)) {
      problems.push(`补丁 ${id} 未登记到 pnpm.patchedDependencies（应为 ${registrationPath}）`);
    }

    if (!Array.isArray(verifications) || verifications.length === 0) {
      problems.push(`补丁 ${id} 缺少 verifications 断言`);
      continue;
    }
    const installedRoot = join(
      parsed.root,
      'packages',
      'antd',
      'node_modules',
      ledger.upstream.package
    );
    const installedManifestPath = join(installedRoot, 'package.json');
    if (!existsSync(installedManifestPath)) {
      problems.push(
        `上游包未安装：packages/antd/node_modules/${ledger.upstream.package}/package.json 不存在，请先在仓库根执行 pnpm install`
      );
      continue;
    }
    const installedManifest = readJson(installedManifestPath);
    if (installedManifest.version !== ledger.upstream.version) {
      problems.push(
        `已安装 ${ledger.upstream.package} 版本 ${installedManifest.version} 与锁定版本 ${ledger.upstream.version} 不一致`
      );
    }
    for (const verification of verifications) {
      const verificationPath = join(installedRoot, verification.file);
      if (!existsSync(verificationPath)) {
        problems.push(
          `补丁 ${id} 的验证目标不存在：${ledger.upstream.package}/${verification.file}`
        );
        continue;
      }
      const installedContent = readFileSync(verificationPath, 'utf8');
      if (!installedContent.includes(verification.contains)) {
        problems.push(
          `补丁 ${id} 未生效：${ledger.upstream.package}/${verification.file} 不含 ${JSON.stringify(verification.contains)}`
        );
      }
    }
  }

  for (const registrationPath of registeredPatchPaths) {
    const fileName = registrationPath.split('/').pop();
    if (!ledgerPatchFiles.has(fileName)) {
      problems.push(`pnpm.patchedDependencies 登记了台账之外的补丁：${registrationPath}`);
    }
  }

  if (existsSync(PATCHES_DIR)) {
    for (const entry of readdirSync(PATCHES_DIR)) {
      if (entry.endsWith('.patch') && !ledgerPatchFiles.has(entry)) {
        problems.push(`补丁目录存在台账之外的补丁文件：${entry}`);
      }
    }
  }

  if (problems.length > 0) {
    fail(problems);
  }
  const appliedCount = ledger.patches.filter((patch) => patch.status === 'applied').length;
  console.log(
    `[verify-patches] 补丁栈校验通过：上游 ${ledger.upstream.package}@${ledger.upstream.version}，` +
      `fork ${ledger.upstream.forkVersion}，生效补丁 ${appliedCount} 个。`
  );
}

main();
