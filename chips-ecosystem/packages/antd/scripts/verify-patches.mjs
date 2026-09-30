#!/usr/bin/env node
/**
 * 补丁栈一致性校验：台账（patches/patches.json）↔ 补丁文件 ↔ pnpm 配置 ↔ 已安装上游包。
 *
 * 检查项：
 * 1. 台账 schema、各上游版本与 fork 版本口径（`<上游版本>-chips.N`）一致；
 * 2. 每个 `applied` 补丁：文件存在且非空、补丁文件覆盖全部声明 target、pnpm.patchedDependencies 已登记；
 * 3. 反向检查：pnpm 登记的补丁都在台账中，补丁目录不存在台账之外的 `.patch` 文件；
 * 4. 已安装上游包版本等于台账锁定版本，且每条 `verifications` 断言（file 相对上游包根、
 *    contains 为必须出现的文本）成立。安装根解析：
 *    - 声明 `forkPackage` 的上游（fork 包直接依赖）：`packages/antd/node_modules/<上游包>`；
 *    - 其余传递上游（如 antd 依赖栈内的 `@rc-component/util`）：
 *      pnpm 存储目录 `node_modules/.pnpm/<上游包名 / → +>@<版本>_patch_hash=*`。
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
const PATCHES_DIR_IN_ROOT = 'packages/antd/patches';
const PATCH_NAME_PATTERN =
  /^(@[a-z0-9][a-z0-9-]*__[a-z0-9][a-z0-9-]*|[a-z0-9][a-z0-9-]*)@\d+\.\d+\.\d+\.patch$/;

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
  if (typeof ledger !== 'object' || ledger === null || !Array.isArray(ledger.upstreams)) {
    problems.push('台账必须是含 upstreams 数组的 JSON 对象');
    return [];
  }
  const sections = [];
  for (const upstream of ledger.upstreams) {
    if (typeof upstream !== 'object' || upstream === null) {
      problems.push('台账 upstreams 存在非对象条目');
      continue;
    }
    const { package: pkg, version, forkVersion, forkPackage } = upstream;
    if (typeof pkg !== 'string' || typeof version !== 'string' || typeof forkVersion !== 'string') {
      problems.push('台账 upstream 条目缺少合法的 package / version / forkVersion');
      continue;
    }
    if (forkVersion !== `${version}-chips.1` && !/^\d+\.\d+\.\d+-chips\.\d+$/.test(forkVersion)) {
      problems.push(`台账 ${pkg} 的 forkVersion 口径非法：${forkVersion}`);
    }
    if (forkPackage !== undefined && typeof forkPackage !== 'string') {
      problems.push(`台账 ${pkg} 的 forkPackage 非法：${String(forkPackage)}`);
    }
    if (!Array.isArray(upstream.patches)) {
      problems.push(`台账 ${pkg} 缺少 patches 数组`);
      continue;
    }
    sections.push(upstream);
  }
  return sections;
}

function resolveInstalledRoots(workspaceRoot, section) {
  const directRoot = join(workspaceRoot, 'packages', 'antd', 'node_modules', section.package);
  if (section.forkPackage) {
    return existsSync(directRoot) ? [directRoot] : [];
  }
  const storeDir = join(workspaceRoot, 'node_modules', '.pnpm');
  if (!existsSync(storeDir)) {
    return [];
  }
  const patchedPrefix = `${section.package.replace('/', '+')}@${section.version}_patch_hash=`;
  return readdirSync(storeDir)
    .filter((entry) => entry.startsWith(patchedPrefix))
    .map((entry) => join(storeDir, entry, 'node_modules', section.package))
    .filter((entry) => existsSync(entry));
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
  const sections = checkLedgerShape(ledger, problems);
  if (sections.length === 0) {
    fail(problems);
  }

  const forkManifestPath = join(packageDir, 'package.json');
  const forkManifest = readJson(forkManifestPath);

  const rootManifestPath = join(parsed.root, 'package.json');
  if (!existsSync(rootManifestPath)) {
    problems.push('工作区根 package.json 不存在');
    fail(problems);
  }
  const rootManifest = readJson(rootManifestPath);
  const patchedDependencies = rootManifest.pnpm?.patchedDependencies ?? {};
  const registeredPatchPaths = new Set(Object.values(patchedDependencies));

  const ledgerPatchFiles = new Set();
  for (const section of sections) {
    const { package: pkg, version, forkVersion, forkPackage, patches } = section;
    if (forkPackage) {
      if (forkManifest.version !== forkVersion) {
        problems.push(`fork 版本不一致：package.json=${forkManifest.version}，台账=${forkVersion}`);
      }
      if (forkManifest.dependencies?.[pkg] !== version) {
        problems.push(
          `上游版本未锁定：package.json 中 ${pkg} 为 ${String(forkManifest.dependencies?.[pkg])}，台账为 ${version}`
        );
      }
    }

    for (const patch of patches) {
      if (typeof patch !== 'object' || patch === null) {
        problems.push(`台账 ${pkg} 的 patches 存在非对象条目`);
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
      const encodedPackage = pkg.replace('/', '__');
      if (!file.startsWith(`${encodedPackage}@${version}`)) {
        problems.push(`补丁文件 ${file} 与锁定上游版本 ${pkg}@${version} 不一致`);
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
        if (registeredPatchPaths.has(join(PATCHES_DIR_IN_ROOT, file))) {
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
      const registrationPath = join(PATCHES_DIR_IN_ROOT, file);
      if (!registeredPatchPaths.has(registrationPath)) {
        problems.push(`补丁 ${id} 未登记到 pnpm.patchedDependencies（应为 ${registrationPath}）`);
      }

      if (!Array.isArray(verifications) || verifications.length === 0) {
        problems.push(`补丁 ${id} 缺少 verifications 断言`);
        continue;
      }
      const installedRoots = resolveInstalledRoots(parsed.root, section);
      if (installedRoots.length === 0) {
        problems.push(
          `上游包未安装：${pkg}@${version} 未在 packages/antd/node_modules 或 pnpm 存储（node_modules/.pnpm）中找到，请先在仓库根执行 pnpm install`
        );
        continue;
      }
      for (const installedRoot of installedRoots) {
        const installedManifestPath = join(installedRoot, 'package.json');
        if (!existsSync(installedManifestPath)) {
          problems.push(`上游包未安装：${pkg}/package.json 不存在，请先在仓库根执行 pnpm install`);
          continue;
        }
        const installedManifest = readJson(installedManifestPath);
        if (installedManifest.version !== version) {
          problems.push(
            `已安装 ${pkg} 版本 ${installedManifest.version} 与锁定版本 ${version} 不一致`
          );
        }
        for (const verification of verifications) {
          const verificationPath = join(installedRoot, verification.file);
          if (!existsSync(verificationPath)) {
            problems.push(`补丁 ${id} 的验证目标不存在：${pkg}/${verification.file}`);
            continue;
          }
          const installedContent = readFileSync(verificationPath, 'utf8');
          if (!installedContent.includes(verification.contains)) {
            problems.push(
              `补丁 ${id} 未生效：${pkg}/${verification.file} 不含 ${JSON.stringify(verification.contains)}`
            );
          }
        }
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
  for (const section of sections) {
    const appliedCount = section.patches.filter((patch) => patch.status === 'applied').length;
    console.log(
      `[verify-patches] 补丁栈校验通过：上游 ${section.package}@${section.version}，` +
        `fork ${section.forkVersion}，生效补丁 ${appliedCount} 个。`
    );
  }
}

main();
