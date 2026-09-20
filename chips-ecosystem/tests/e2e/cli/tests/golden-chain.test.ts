/**
 * 金链路（任务 #88 核心交付）：脚手架生成工程 → 真实构建 → 真实签名打包 → 五阶段校验。
 *
 * 全链一律进程级：`chips plugin create` 生成 basecard 工程 → 临时镜像工作区内
 * `pnpm install --offline` + `pnpm run build`（真实 vite 双构建）→
 * `chips plugin pack --sign`（Ed25519 真签名）→ `chips plugin validate`
 * 正负矩阵（§2.5 退出码 + §2.6 错误信封 + [插件包格式] §五 五阶段）。
 *
 * 口径说明：
 * - 打包确定性双形覆盖：两个工程外显式 `--out` 目录对比字节 sha，另加「缺省
 *   `--out`（`<dir>/dist`）连续两次 pack 字节级一致」用例（工单033 缺陷③收口，
 *   §3.5.2 承诺形）；
 * - 安装链宿主驱动段：`plugin install` 在无承载进程返回 `CLI_TARGET_UNAVAILABLE / 6`
 *   为定性边界断言（依据《波E装载器收口》与波次规划「宿主驱动段随集成波」），
 *   真实装载-启用-运行闭环归集成波；
 * - 信任根注入面负例按《07-CLI完整参考》§2.7 实测冻结：缺失文件 → 5、
 *   非文件路径 → 5、非法 JSON / 非法 schema → 2、空串按未设置。
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupTempDir,
  createMirroredWorkspace,
  createSigningAssets,
  expectFailure,
  expectSuccessJson,
  fileExists,
  makeTempDir,
  readTextFile,
  runChips,
  runPnpm,
  sha256File,
  trustRootsDocument,
  type ICliRun,
  type IMirroredWorkspace,
  type ISigningAssets,
} from './support/harness';

/** validate `--json` 结果形状（[插件包格式] §五）。 */
interface IValidateJson {
  readonly valid: boolean;
  readonly stages: readonly { stage: string; status: string; detail: string }[];
  readonly warnings?: readonly string[];
}

/** pack `--json` 结果形状（[插件包格式] §七）。 */
interface IPackJson {
  readonly archivePath: string;
  readonly name: string;
  readonly version: string;
  readonly role: string;
  readonly memberCount: number;
  readonly archiveSize: number;
  readonly digest: string;
  readonly signed: boolean;
}

const KEY_ID = 'chips-e2e-chain-key';

let workspace: IMirroredWorkspace;
let projectDir: string;
let assets: ISigningAssets;
let signedCpk: string;
let unsignedCpk: string;
const extraTempDirs: string[] = [];

function tempDir(kind: string): string {
  const dir = makeTempDir(kind);
  extraTempDirs.push(dir);
  return dir;
}

beforeAll(() => {
  workspace = createMirroredWorkspace('chain');
  // create 使用相对目录（cwd=临时工作区根），杜绝任何对真实仓库的写入。
  const create = runChips(
    [
      'plugin',
      'create',
      '--role',
      'basecard',
      '--id',
      'chips.e2e.chain.card',
      '--name',
      '金链路卡片',
      '--dir',
      'generated/chain-card',
    ],
    { cwd: workspace.root }
  );
  expect(create.exitCode, `plugin create 失败：${create.stdout}${create.stderr}`).toBe(0);
  projectDir = path.join(workspace.root, 'generated', 'chain-card');

  const install = runPnpm(['install', '--offline'], workspace.root);
  expect(install.exitCode, `镜像工作区 install 失败：${install.stderr}`).toBe(0);

  const build = runPnpm(['run', 'build'], projectDir);
  expect(build.exitCode, `生成工程 build 失败：${build.stdout}\n${build.stderr}`).toBe(0);

  assets = createSigningAssets(path.join(workspace.root, 'sig'), KEY_ID);

  const outDir = path.join(workspace.root, 'cpks');
  mkdirSync(outDir, { recursive: true });
  const pack = runChips(
    [
      '--json',
      'plugin',
      'pack',
      '--dir',
      projectDir,
      '--out',
      outDir,
      '--sign',
      '--key-id',
      KEY_ID,
    ],
    { cwd: workspace.root, env: { CHIPS_SIGNING_KEY_FILE: assets.privateKeyFile } }
  );
  const packed = expectSuccessJson(pack) as IPackJson;
  expect(packed.signed).toBe(true);
  signedCpk = packed.archivePath;

  // 未签名产物落独立目录：同名归档（确定性命名）会覆盖签名版。
  const unsignedOutDir = path.join(workspace.root, 'cpks-unsigned');
  mkdirSync(unsignedOutDir, { recursive: true });
  const unsignedPack = runChips(
    ['--json', 'plugin', 'pack', '--dir', projectDir, '--out', unsignedOutDir],
    { cwd: workspace.root }
  );
  unsignedCpk = (expectSuccessJson(unsignedPack) as IPackJson).archivePath;
});

afterAll(() => {
  if (workspace !== undefined) {
    cleanupTempDir(workspace.root);
  }
  for (const dir of extraTempDirs) {
    cleanupTempDir(dir);
  }
});

function validate(cpk: string, trustRootsFile?: string): ICliRun {
  return runChips(['--json', 'plugin', 'validate', cpk], {
    cwd: workspace.root,
    ...(trustRootsFile === undefined ? {} : { env: { CHIPS_TRUST_ROOTS_FILE: trustRootsFile } }),
  });
}

describe('金链路：生成 → 构建 → 签名打包 → 校验（正向面）', () => {
  it('构建产物落位（打包输入：dist 入口与渲染入口存在）', () => {
    expect(fileExists(path.join(projectDir, 'dist', 'index.js'))).toBe(true);
    expect(fileExists(path.join(projectDir, 'render.js'))).toBe(true);
  });

  it('签名 pack 真实落盘 .cpk，JSON 结果字段齐备（§3.5.2）', () => {
    expect(fileExists(signedCpk)).toBe(true);
    expect(path.basename(signedCpk)).toMatch(/-0\.1\.0\.cpk$/);
    expect(signedCpk.startsWith(path.join(workspace.root, 'cpks'))).toBe(true);
  });

  it('validate + 正确信任根：五阶段全部 passed、退出 0、无警告（§五）', () => {
    const run = validate(signedCpk, assets.trustRootsFile);
    const result = expectSuccessJson(run) as IValidateJson;
    expect(result.valid).toBe(true);
    expect(result.stages.map((stage) => stage.stage)).toEqual([
      'archive',
      'layout',
      'manifest',
      'signature',
      'hash',
    ]);
    for (const stage of result.stages) {
      expect(stage.status, stage.stage).toBe('passed');
    }
    expect(result.warnings).toBeUndefined();
  });

  it('未签名 .cpk 在 user 入口：签名阶段 skipped + 警告，退出 0（§2.5/§五）', () => {
    const run = validate(unsignedCpk);
    const result = expectSuccessJson(run) as IValidateJson;
    const signature = result.stages.find((stage) => stage.stage === 'signature');
    expect(signature?.status).toBe('skipped');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect((result.warnings ?? []).length).toBeGreaterThan(0);
  });

  it('dev 入口校验签名 .cpk：signature 阶段按 development 来源跳过，退出 0（§2.7 来源口径）', () => {
    const run = runChips(['--json', 'dev', 'plugin', 'validate', signedCpk], {
      cwd: workspace.root,
      env: { CHIPS_TRUST_ROOTS_FILE: assets.trustRootsFile },
    });
    const result = expectSuccessJson(run) as IValidateJson;
    const signature = result.stages.find((stage) => stage.stage === 'signature');
    expect(signature?.status).toBe('skipped');
  });

  it('同输入两次签名打包字节级可复现（[插件包格式] §七确定性）', () => {
    const dirA = path.join(tempDir('det'), 'a');
    const dirB = path.join(tempDir('det'), 'b');
    mkdirSync(dirA, { recursive: true });
    mkdirSync(dirB, { recursive: true });
    const env = { CHIPS_SIGNING_KEY_FILE: assets.privateKeyFile };
    for (const out of [dirA, dirB]) {
      const run = runChips(
        ['plugin', 'pack', '--dir', projectDir, '--out', out, '--sign', '--key-id', KEY_ID],
        { cwd: workspace.root, env }
      );
      expect(run.exitCode).toBe(0);
    }
    expect(sha256File(path.join(dirA, 'chain-card-0.1.0.cpk'))).toBe(
      sha256File(path.join(dirB, 'chain-card-0.1.0.cpk'))
    );
  });

  it('缺省 --out（<dir>/dist）连续两次 pack：历史输出归属排除、字节级可复现（§3.5.2、§7.2，工单033 缺陷③收口）', () => {
    const first = runChips(['--json', 'plugin', 'pack', '--dir', projectDir], {
      cwd: workspace.root,
    });
    expect(first.exitCode, `首次缺省 pack 失败：${first.stdout}${first.stderr}`).toBe(0);
    const firstResult = expectSuccessJson(first) as IPackJson;
    expect(firstResult.archivePath).toBe(path.join(projectDir, 'dist', 'chain-card-0.1.0.cpk'));
    const firstSha = sha256File(firstResult.archivePath);

    const second = runChips(['--json', 'plugin', 'pack', '--dir', projectDir], {
      cwd: workspace.root,
    });
    expect(second.exitCode, `第二次缺省 pack 失败：${second.stdout}${second.stderr}`).toBe(0);
    const secondResult = expectSuccessJson(second) as IPackJson;
    expect(secondResult.memberCount).toBe(firstResult.memberCount);
    expect(secondResult.digest).toBe(firstResult.digest);
    expect(sha256File(secondResult.archivePath)).toBe(firstSha);
  });
});

describe('金链路：签名与信任根注入面负例（§2.5、§2.7）', () => {
  it('已签名但无信任根注入：CPK_SIGNATURE_INVALID / 1，details.stage=signature', () => {
    const envelope = expectFailure(validate(signedCpk), 'CPK_SIGNATURE_INVALID', 1);
    expect(envelope.details?.stage).toBe('signature');
    expect(envelope.details?.keyId).toBe(KEY_ID);
  });

  it('信任根注册了同名 keyId 但公钥不匹配：CPK_SIGNATURE_INVALID / 1', () => {
    expectFailure(validate(signedCpk, assets.foreignTrustRootsFile), 'CPK_SIGNATURE_INVALID', 1);
  });

  it('CHIPS_TRUST_ROOTS_FILE 指向不存在文件 → CLI_PATH_NOT_FOUND / 5（§2.7）', () => {
    const envelope = expectFailure(
      validate(signedCpk, path.join(workspace.root, 'sig', 'nope.json')),
      'CLI_PATH_NOT_FOUND',
      5
    );
    expect(envelope.details?.env).toBe('CHIPS_TRUST_ROOTS_FILE');
  });

  it('CHIPS_TRUST_ROOTS_FILE 指向目录（非文件路径）→ CLI_PATH_INVALID / 5（§2.7）', () => {
    expectFailure(validate(signedCpk, path.join(workspace.root, 'sig')), 'CLI_PATH_INVALID', 5);
  });

  it('信任注册文件非法 JSON → CLI_ARGUMENT_INVALID / 2（§2.7）', () => {
    const dir = tempDir('trust');
    const badFile = path.join(dir, 'bad.json');
    writeFileSync(badFile, '{不是 JSON');
    expectFailure(validate(signedCpk, badFile), 'CLI_ARGUMENT_INVALID', 2);
  });

  it('信任注册文件 version 非 1（schema 严格）→ CLI_ARGUMENT_INVALID / 2（§2.7）', () => {
    const dir = tempDir('trust');
    const file = path.join(dir, 'v2.json');
    writeFileSync(file, trustRootsDocument(KEY_ID, '-----BEGIN PUBLIC KEY-----\nZZZ\n'));
    const wrapped = JSON.parse(readTextFile(file)) as Record<string, unknown>;
    writeFileSync(file, JSON.stringify({ ...wrapped, version: 2 }));
    expectFailure(validate(signedCpk, file), 'CLI_ARGUMENT_INVALID', 2);
  });

  it('CHIPS_TRUST_ROOTS_FILE 空串按未设置：仍走签名无效而非路径错误（§2.7）', () => {
    const run = runChips(['--json', 'plugin', 'validate', signedCpk], {
      cwd: workspace.root,
      env: { CHIPS_TRUST_ROOTS_FILE: '' },
    });
    expectFailure(run, 'CPK_SIGNATURE_INVALID', 1);
  });

  it('篡改归档成员字节（CRC 失配）→ CPK_ARCHIVE_INVALID / 1，archive 阶段拒绝', () => {
    const tampered = tamperMemberData(signedCpk, 'manifest.yaml');
    const file = path.join(tempDir('crc'), 'tampered.cpk');
    writeFileSync(file, tampered);
    const envelope = expectFailure(validate(file), 'CPK_ARCHIVE_INVALID', 1);
    expect(envelope.details?.stage).toBe('archive');
  });
});

describe('金链路：结构/清单负例与源目录误用（§2.5、[插件包格式] §2.7）', () => {
  it('校验源码工程目录（根含 package.json）→ CPK_LAYOUT_INVALID / 1 + pack 指引', () => {
    const envelope = expectFailure(
      runChips(['plugin', 'validate', projectDir], { cwd: workspace.root }),
      'CPK_LAYOUT_INVALID',
      1
    );
    expect(envelope.details?.file).toBe('package.json');
  });

  it('校验不存在的 .cpk → CLI_PATH_NOT_FOUND / 5', () => {
    expectFailure(
      runChips(['plugin', 'validate', path.join(workspace.root, 'ghost.cpk')], {
        cwd: workspace.root,
      }),
      'CLI_PATH_NOT_FOUND',
      5
    );
  });

  it('打包不存在的工程目录 → CLI_PATH_INVALID / 5', () => {
    expectFailure(
      runChips(['plugin', 'pack', '--dir', path.join(workspace.root, 'ghost')], {
        cwd: workspace.root,
      }),
      'CLI_PATH_INVALID',
      5
    );
  });

  it('打包缺少 manifest.yaml 的目录 → CPK_MANIFEST_MISSING / 1', () => {
    const dir = tempDir('nomanifest');
    mkdirSync(path.join(dir, 'dist'), { recursive: true });
    writeFileSync(path.join(dir, 'dist', 'index.js'), 'export const a = 1;\n');
    expectFailure(
      runChips(['plugin', 'pack', '--dir', dir, '--out', tempDir('nomanifest-out')], {
        cwd: dir,
      }),
      'CPK_MANIFEST_MISSING',
      1
    );
  });

  it('package.json 与 manifest.yaml 版本不一致 → CPK_MANIFEST_INVALID / 1', () => {
    const dir = tempDir('vermismatch');
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join(projectDir, 'manifest.yaml'), path.join(dir, 'manifest.yaml'));
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'chain-card-mismatch', version: '9.9.9' })
    );
    const envelope = expectFailure(
      runChips(['plugin', 'pack', '--dir', dir, '--out', tempDir('vermismatch-out')], {
        cwd: dir,
      }),
      'CPK_MANIFEST_INVALID',
      1
    );
    expect(envelope.details?.pointer).toBe('version');
  });

  it('--sign 缺 CHIPS_SIGNING_KEY_FILE → CLI_ARGUMENT_INVALID / 2（§2.7 私钥只走环境注入）', () => {
    expectFailure(
      runChips(
        [
          'plugin',
          'pack',
          '--dir',
          projectDir,
          '--out',
          tempDir('sign-env'),
          '--sign',
          '--key-id',
          KEY_ID,
        ],
        { cwd: workspace.root }
      ),
      'CLI_ARGUMENT_INVALID',
      2
    );
  });

  it('--sign 缺 --key-id → CLI_ARGUMENT_INVALID / 2', () => {
    expectFailure(
      runChips(['plugin', 'pack', '--dir', projectDir, '--out', tempDir('sign-kid'), '--sign'], {
        cwd: workspace.root,
        env: { CHIPS_SIGNING_KEY_FILE: assets.privateKeyFile },
      }),
      'CLI_ARGUMENT_INVALID',
      2
    );
  });
});

describe('金链路：安装段承载边界（宿主驱动归集成波）', () => {
  it('非交互安装未签名 .cpk 且无 --yes → CLI_ARGUMENT_INVALID / 2（确认门先行，§3.5.4）', () => {
    expectFailure(
      runChips(['plugin', 'install', unsignedCpk], { cwd: workspace.root }),
      'CLI_ARGUMENT_INVALID',
      2
    );
  });

  it('--yes 越过确认门后触达承载边界：CLI_TARGET_UNAVAILABLE / 6（§2.5，装载器在宿主侧）', () => {
    const envelope = expectFailure(
      runChips(['--yes', 'plugin', 'install', unsignedCpk], { cwd: workspace.root }),
      'CLI_TARGET_UNAVAILABLE',
      6
    );
    expect(typeof envelope.details?.hint).toBe('string');
  });
});

/**
 * 翻转归档内指定成员的数据字节（写侧布局：本地头+数据顺序紧邻、无扩展字段，
 * 见 [插件包格式] §2.1；读侧 CRC 校验失配即 CPK_ARCHIVE_INVALID）。
 */
function tamperMemberData(cpk: string, memberPath: string): Buffer {
  const bytes = readFileSync(cpk);
  let position = 0;
  while (position + 30 <= bytes.length && bytes.readUInt32LE(position) === 0x04034b50) {
    const nameLength = bytes.readUInt16LE(position + 26);
    const extraLength = bytes.readUInt16LE(position + 28);
    const compressedSize = bytes.readUInt32LE(position + 18);
    const name = bytes.subarray(position + 30, position + 30 + nameLength).toString('utf8');
    const dataStart = position + 30 + nameLength + extraLength;
    if (name === memberPath) {
      const copy = Buffer.from(bytes);
      const flipAt = dataStart + 2;
      copy[flipAt] = (copy[flipAt] ?? 0) ^ 0xff;
      return copy;
    }
    position = dataStart + compressedSize;
  }
  throw new Error(`归档中未找到成员：${memberPath}`);
}
