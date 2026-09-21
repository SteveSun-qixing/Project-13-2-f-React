/**
 * `.cpk` 插件包夹具生成器（W2-P0-3 装载器与插件链 E2E 的在用输入）。
 *
 * 正式链路：`examples/plugins/hello` 源码 → `pnpm --filter @chips/plugin-hello run build`
 * → `@chips/cli` 的 `chips plugin pack --sign --key-id`（ZIP Store + 真实 Ed25519 签名，
 * 私钥经 `CHIPS_SIGNING_KEY_FILE` 注入）→ 产出正/负夹具与校验清单。
 * 全程离线、确定性：归档时间戳固定（`packages/cli/src/artifacts/zip.ts`）、成员按路径
 * 字节序排序、Ed25519 按 RFC 8032 确定性签名、签名密钥为入库的夹具专用固定密钥对。
 *
 * 签名与信任根口径：《04-文件格式规范/03-插件包格式》§六、§八；命令面：
 * 《06-开发与运维/07-CLI完整参考》§3.5.2 / §3.5.3。
 *
 * 用法（任意工作目录）：
 *   node tests/e2e/fixtures/cpk/generate-cpk-fixtures.mjs           # 重建并写入夹具
 *   node tests/e2e/fixtures/cpk/generate-cpk-fixtures.mjs --check   # 重建后逐字节比对并跑校验矩阵（不写盘）
 *
 * 重建关键区互斥（闸链幂等收口）：`pnpm -r run test:contract` 双执行面并发跑同一套件，
 * 套件内 `package` 脚本链用例（`tests/contract/tests/cli-bin-resolution.test.ts`）与本生成器
 * 共享 `examples/plugins/hello/dist` 输入面；生成器 `--out` 指向工程外时 CLI 输入收集不做
 * 历史输出排除，嵌套归档守卫按工单033锁定语义拒绝锁外写入的 `dist/*.cpk`。因此 build →
 * 残留清理 → 两次 pack 的关键区必须与 `package` 脚本链持同一把跨进程互斥锁，并在 pack 前
 * 显式清理 `dist/` 顶层本包同族历史归档（仅 `<包名>-*.cpk`；外来归档一律留给守卫拒绝）。
 *
 * `keys/` 下的密钥对为一次性生成的入库资产，本脚本只读不写；轮换步骤与背景见
 * 《项目日志与笔记/task043-生态梳理/cpk夹具链勘查与落地-2026-09-20.md》。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ecosystemRoot = path.resolve(scriptDir, '..', '..', '..', '..');
const keysDir = path.join(scriptDir, 'keys');
const checkOnly = process.argv.includes('--check');

const KEY_ID = 'chips-fixture-2026';
const BUILT_CPK_NAME = 'hello-0.1.0.cpk';
const HELLO_PLUGIN_DIR = path.join(ecosystemRoot, 'examples', 'plugins', 'hello');

/** package 脚本链跨进程互斥锁的锁目录与默认预算（协议登记与实现见下方 `withPackageChainLock`）。 */
const PACKAGE_CHAIN_LOCK_DIR = path.join(tmpdir(), 'chips-contract-hello-package.lock');
const PACKAGE_CHAIN_LOCK_WAIT_MS = 90_000;
const PACKAGE_CHAIN_LOCK_STALE_MS = 180_000;

/** 夹具清单：file 为相对本目录路径；expected 为五阶段校验的期望判定。 */
const FIXTURE_PACKAGES = [
  {
    file: 'packages/hello-0.1.0.cpk',
    kind: 'positive-signed',
    summary: '真实 Ed25519 签名正夹具：信任根内 keyId，五阶段全部通过',
    expected: { valid: true, signatureStage: 'passed' },
  },
  {
    file: 'packages/hello-0.1.0-wrong-signature.cpk',
    kind: 'negative-signature',
    summary: '伪造私钥签名、keyId 冒用信任根内标识：Ed25519 验签失败',
    expected: { valid: false, code: 'CPK_SIGNATURE_INVALID', stage: 'signature' },
  },
  {
    file: 'packages/hello-0.1.0-bad-manifest.cpk',
    kind: 'negative-manifest',
    summary: 'manifest.yaml 的 id 违反反向域名约束：清单阶段失败',
    expected: { valid: false, code: 'CPK_MANIFEST_INVALID', stage: 'manifest' },
  },
  {
    file: 'packages/hello-0.1.0-crc-tampered.cpk',
    kind: 'negative-crc',
    summary: '签名单未动、成员数据被篡改：归档阶段 CRC 校验失败',
    expected: { valid: false, code: 'CPK_ARCHIVE_INVALID', stage: 'archive' },
  },
];

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function expectRun(label, result) {
  if (result.status !== 0) {
    const output = `${result.stdout?.toString() ?? ''}${result.stderr?.toString() ?? ''}`;
    throw new Error(`${label} 失败（退出码 ${result.status}）：\n${output}`);
  }
}

function readRequiredFile(label, file) {
  if (!existsSync(file)) {
    throw new Error(
      `${label} 不存在：${file}。夹具密钥为入库资产，缺失时请从版本库恢复，或按文档轮换步骤重建。`
    );
  }
  return readFileSync(file);
}

/** 同步休眠（Atomics 超时等待，不引入异步调度）。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 持有者进程是否存活（`kill` 信号 0 探测；ESRCH 即已退出）。 */
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

/**
 * package 脚本链跨进程互斥锁：与 `tests/contract/tests/cli-bin-resolution.test.ts` 的
 * 同名锁（`PACKAGE_CHAIN_LOCK_DIR`，原子 `mkdir` 建锁 + owner pid + 残锁接管双保险）
 * 共目录同协议，串行化一切读改写 `examples/plugins/hello/dist` 输入面的执行面
 * （`package` 链 pack/validate/清理 与 本生成器 build→清理→pack 重建链）。
 * 等待预算必须小于调用方显式超时，保证被终止的等待者不会留下二次残锁。
 */
function withPackageChainLock(body, options = {}) {
  const lockDir = options.lockDir ?? PACKAGE_CHAIN_LOCK_DIR;
  const timeoutMs = options.timeoutMs ?? PACKAGE_CHAIN_LOCK_WAIT_MS;
  const staleMs = options.staleMs ?? PACKAGE_CHAIN_LOCK_STALE_MS;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(lockDir);
      writeFileSync(path.join(lockDir, 'owner'), String(process.pid));
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      let takeover = false;
      try {
        const ownerPid = Number(readFileSync(path.join(lockDir, 'owner'), 'utf8').trim());
        takeover =
          (Number.isInteger(ownerPid) && ownerPid > 0 && !pidAlive(ownerPid)) ||
          Date.now() - statSync(lockDir).mtimeMs > staleMs;
      } catch {
        takeover = true; // 锁目录/owner 文件读失败：视为残锁。
      }
      if (takeover) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`等待 package 脚本链互斥锁超时（持有者见 ${lockDir}/owner）：${lockDir}`);
      }
      sleepSync(200);
    }
  }
  try {
    return body();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

/**
 * pack 前残留清理（清理时序收口）：`dist/` 顶层与本包归档命名同族
 * （`<包名>-*.cpk`，即 CLI pack 的唯一输出命名）的顶层文件是本包历史打包产物，
 * 锁内先行删除保证重建链输入面干净；其余嵌套归档不动，仍由 CLI 守卫按
 * [插件包格式] §2.6 拒绝（fail-closed 语义零削弱）。
 */
function removeFamilyPackResidue(pluginDir = HELLO_PLUGIN_DIR) {
  const distDir = path.join(pluginDir, 'dist');
  if (!existsSync(distDir)) {
    return 0;
  }
  const familyPrefix = `${path.basename(pluginDir)}-`;
  let removed = 0;
  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf('.') + 1).toLowerCase();
    if (entry.name.startsWith(familyPrefix) && extension === 'cpk') {
      rmSync(path.join(distDir, entry.name), { force: true });
      removed += 1;
    }
  }
  return removed;
}

/** 加载 `@chips/cli` 构建产物的公开引擎 API（正式链路的库面）。 */
async function loadCliEngine() {
  const entry = path.join(ecosystemRoot, 'packages', 'cli', 'dist', 'index.js');
  if (!existsSync(entry)) {
    throw new Error(
      `@chips/cli 未构建：${entry}。请先执行 pnpm --filter @chips/cli run build。`
    );
  }
  return import(pathToFileURL(entry).href);
}

/** 以 CLI 正式命令面打包（含签名），返回归档字节。 */
function packViaCli(workDir, label, privateKeyFile) {
  const bin = path.join(ecosystemRoot, 'packages', 'cli', 'dist', 'bin.js');
  if (!existsSync(bin)) {
    throw new Error(
      `@chips/cli 可执行入口未构建：${bin}。请先执行 pnpm --filter @chips/cli run build。`
    );
  }
  const outDir = path.join(workDir, `out-${label}`);
  const result = spawnSyncCliPack(bin, outDir, privateKeyFile);
  expectRun(`chips plugin pack（${label}）`, result);
  return readFileSync(path.join(outDir, BUILT_CPK_NAME));
}

function spawnSyncCliPack(bin, outDir, privateKeyFile) {
  return spawnSync(
    process.execPath,
    [
      bin,
      'plugin',
      'pack',
      '--dir',
      HELLO_PLUGIN_DIR,
      '--out',
      outDir,
      '--sign',
      '--key-id',
      KEY_ID,
    ],
    {
      cwd: ecosystemRoot,
      env: deterministicEnv({ CHIPS_SIGNING_KEY_FILE: privateKeyFile }),
      encoding: 'utf8',
    }
  );
}

/** 伪造清单负夹具：正夹具成员中替换 manifest.yaml 后用 CLI zip 引擎重写归档（CRC 重算，签名声明保持原文）。 */
function buildBadManifestArchive(engine, signedBytes) {
  const entries = engine.readZipStore(signedBytes).map((entry) => {
    if (entry.path !== 'manifest.yaml') {
      return entry;
    }
    const text = new TextDecoder('utf-8').decode(entry.data);
    const broken = text.replace('id: chips.example.hello', 'id: Chips.Bad');
    if (broken === text) {
      throw new Error('负夹具构造失败：manifest.yaml 中未找到待破坏的 id 字段');
    }
    return { path: entry.path, data: new TextEncoder().encode(broken) };
  });
  return engine.writeZipStore(entries);
}

/** CRC 篡改负夹具：在成员数据（图标 SVG）内做单字节替换，签名与归档结构均不动。 */
function buildCrcTamperedArchive(signedBytes) {
  const marker = Buffer.from('<svg xmlns');
  const bytes = Buffer.from(signedBytes);
  const index = bytes.indexOf(marker);
  if (index < 0) {
    throw new Error('负夹具构造失败：归档中未找到图标数据锚点');
  }
  bytes[index] = 0x3d; // '<' → '='：数据区单字节翻转，CRC 必然失配
  return new Uint8Array(bytes);
}

/** 从归档中读取 signature.json 文档（归档不可读或无签名时返回 null）。 */
function readSignatureDocument(engine, bytes) {
  let entries;
  try {
    entries = engine.readZipStore(bytes);
  } catch {
    return null; // CRC 篡改负夹具在归档阶段即不可读
  }
  const entry = entries.find((candidate) => candidate.path === 'signature.json');
  if (entry === undefined) {
    return null;
  }
  return JSON.parse(new TextDecoder('utf-8').decode(entry.data));
}

/** 构建全部夹具字节与校验清单（不写盘）。 */
async function buildFixturePlan(workDir) {
  const engine = await loadCliEngine();

  const trustedPrivate = path.join(keysDir, 'fixture-signing-private.pem');
  const untrustedPrivate = path.join(keysDir, 'untrusted-signing-private.pem');
  readRequiredFile('夹具签名私钥', trustedPrivate);
  readRequiredFile('负夹具伪造私钥', untrustedPrivate);

  // 重建关键区与 package 脚本链互斥：build（vite 清空 dist）→ 同族残留清理 →
  // 两次 CLI pack（`--out` 在工程外）相对其他执行面的 pack 写入/清理必须原子完成。
  const { signed, wrongSignature } = withPackageChainLock(() => {
    expectRun(
      'pnpm --filter @chips/plugin-hello run build',
      spawnSyncPnpmBuild()
    );
    removeFamilyPackResidue();
    return {
      signed: packViaCli(workDir, 'trusted', trustedPrivate),
      wrongSignature: packViaCli(workDir, 'untrusted', untrustedPrivate),
    };
  });
  const badManifest = buildBadManifestArchive(engine, signed);
  const crcTampered = buildCrcTamperedArchive(signed);

  const generated = new Map([
    ['packages/hello-0.1.0.cpk', signed],
    ['packages/hello-0.1.0-wrong-signature.cpk', wrongSignature],
    ['packages/hello-0.1.0-bad-manifest.cpk', badManifest],
    ['packages/hello-0.1.0-crc-tampered.cpk', crcTampered],
  ]);

  const packages = FIXTURE_PACKAGES.map((fixture) => {
    const bytes = generated.get(fixture.file);
    const signature = readSignatureDocument(engine, bytes);
    let memberCount = null;
    try {
      memberCount = engine.readZipStore(bytes).length;
    } catch {
      memberCount = null; // CRC 篡改负夹具按契约不可读
    }
    return {
      file: fixture.file,
      kind: fixture.kind,
      summary: fixture.summary,
      archiveSha256: `sha256:${sha256Hex(bytes)}`,
      archiveBytes: bytes.length,
      memberCount,
      signature:
        signature === null
          ? null
          : {
              keyId: signature.keyId,
              algorithm: signature.algorithm,
              contentHash: signature.contentHash,
            },
      expected: fixture.expected,
    };
  });

  const checklist = {
    version: 1,
    generatedBy: 'tests/e2e/fixtures/cpk/generate-cpk-fixtures.mjs',
    plugin: {
      sourceDir: 'examples/plugins/hello',
      packageFilter: '@chips/plugin-hello',
      id: 'chips.example.hello',
      version: '0.1.0',
      role: 'app',
    },
    signing: {
      keyId: KEY_ID,
      trustRootsFile: 'keys/trust-roots.json',
      note: '夹具专用固定密钥对（keys/*.pem 已入库）：仅用于测试夹具链，不代表发布链路信任根（《03-插件包格式》§6.3，发布链路信任根按《06-更新与分发规范》Phase 3/4 落地）。',
    },
    verification: {
      command: 'node tests/e2e/fixtures/cpk/generate-cpk-fixtures.mjs --check',
      channel: 'user',
      detail: '重建链逐字节比对 + 五阶段校验矩阵（正夹具 signature 阶段 passed，负夹具按 §八 错误码拒绝）。',
    },
    packages,
  };
  generated.set('checklist.json', Buffer.from(`${JSON.stringify(checklist, null, 2)}\n`, 'utf8'));
  return { generated, engine };
}

/** 构建/打包子进程的确定环境：固定生产模式并剔除测试宿主注入的运行时标记。 */
function deterministicEnv(extra) {
  const env = { ...process.env, ...extra, NODE_ENV: 'production' };
  for (const key of Object.keys(env)) {
    if (key.toUpperCase().startsWith('VITEST')) {
      delete env[key];
    }
  }
  return env;
}

function spawnSyncPnpmBuild() {
  return spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@chips/plugin-hello', 'run', 'build'],
    {
      cwd: ecosystemRoot,
      encoding: 'utf8',
      // 夹具构建固定为生产环境：从 vitest/CI 等宿主环境调用时，
      // 继承的 NODE_ENV/VITEST 会改变 vite 构建产物字节，破坏夹具的确定性。
      env: deterministicEnv({}),
    }
  );
}

/** 五阶段校验矩阵：对入库夹具逐件断言期望判定（走 `@chips/cli` 正式引擎库面）。 */
async function runVerificationMatrix(engine, trustedPublicPem) {
  const artifacts = engine.createLocalArtifacts({ trustRoots: { [KEY_ID]: trustedPublicPem } });
  const failures = [];
  for (const fixture of FIXTURE_PACKAGES) {
    const file = path.join(scriptDir, fixture.file);
    let outcome;
    try {
      const result = await artifacts.validate({
        path: file,
        source: 'user',
        fileSystem: engine.createNodeFileSystem(),
      });
      const signatureStage = result.stages.find((stage) => stage.stage === 'signature');
      outcome = {
        valid: true,
        signatureStage: signatureStage?.status ?? '缺失',
      };
    } catch (error) {
      outcome = {
        valid: false,
        code: typeof error.code === 'string' ? error.code : undefined,
        stage:
          typeof error.details === 'object' && error.details !== null
            ? error.details.stage
            : undefined,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (fixture.expected.valid) {
      if (!outcome.valid || outcome.signatureStage !== fixture.expected.signatureStage) {
        failures.push(
          `${fixture.file} 期望五阶段通过且签名阶段 ${fixture.expected.signatureStage}，实际 ${JSON.stringify(outcome)}`
        );
      }
    } else if (
      outcome.valid ||
      outcome.code !== fixture.expected.code ||
      outcome.stage !== fixture.expected.stage
    ) {
      failures.push(
        `${fixture.file} 期望 ${fixture.expected.code}（stage=${fixture.expected.stage}），实际 ${JSON.stringify(outcome)}`
      );
    }
  }
  return failures;
}

function listRelativeFiles(dirName) {
  const dir = path.join(scriptDir, dirName);
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${dirName}/${entry.name}`);
}

function compareWithDisk(generated) {
  const discrepancies = [];
  const expectedFiles = new Set(generated.keys());
  for (const [relative, data] of generated) {
    const diskPath = path.join(scriptDir, relative);
    if (!existsSync(diskPath)) {
      discrepancies.push(`缺失：${relative}`);
      continue;
    }
    if (!readFileSync(diskPath).equals(data)) {
      discrepancies.push(`内容不一致：${relative}`);
    }
  }
  for (const relative of [...listRelativeFiles('packages')]) {
    if (!expectedFiles.has(relative)) {
      discrepancies.push(`多余文件：${relative}`);
    }
  }
  return discrepancies;
}

async function main() {
  const workDir = mkdtempSync(path.join(tmpdir(), 'chips-cpk-fixtures-'));
  try {
    const { generated, engine } = await buildFixturePlan(workDir);
    if (checkOnly) {
      const discrepancies = compareWithDisk(generated);
      if (discrepancies.length > 0) {
        console.error(
          `cpk 夹具与生成结果不一致：\n${discrepancies.join('\n')}\n请运行 node tests/e2e/fixtures/cpk/generate-cpk-fixtures.mjs 重新生成。`
        );
        process.exitCode = 1;
        return;
      }
    } else {
      for (const [relative, data] of generated) {
        writeFileSync(path.join(scriptDir, relative), data);
      }
      console.info(
        `cpk 夹具生成完成：${generated.size} 个文件写入 ${path.relative(process.cwd(), scriptDir)}。`
      );
    }
    const trustedPublicPem = readFileSync(path.join(keysDir, 'fixture-signing-public.pem'), 'utf8');
    const failures = await runVerificationMatrix(engine, trustedPublicPem);
    if (failures.length > 0) {
      console.error(`校验矩阵未通过：\n${failures.join('\n')}`);
      process.exitCode = 1;
      return;
    }
    console.info(
      checkOnly
        ? `cpk 夹具校验通过：${generated.size} 个文件逐字节一致，五阶段校验矩阵（1 正 3 负）全部符合期望。`
        : '五阶段校验矩阵通过：正夹具签名有效，负夹具按 CPK_SIGNATURE_INVALID / CPK_MANIFEST_INVALID / CPK_ARCHIVE_INVALID 拒绝。'
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** 仅在直接执行本脚本时跑生成/校验主流程；被测试导入时只导出锁原语与清理时序件。 */
const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  await main();
}

export {
  PACKAGE_CHAIN_LOCK_DIR,
  withPackageChainLock,
  removeFamilyPackResidue,
  HELLO_PLUGIN_DIR,
};
