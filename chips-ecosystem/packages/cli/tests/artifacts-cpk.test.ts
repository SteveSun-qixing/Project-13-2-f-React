/**
 * `.cpk` 打包与五阶段校验（[插件包格式] §二–§七）：归档 → 结构 → 清单 → 签名 → 摘要。
 *
 * 断言面向文档契约：阶段结果序列、错误码与限额触发条件。
 */

import { createHash, generateKeyPairSync, sign as signValue } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ChipsError } from '../src/errors.js';
import type { IFileSystemPort } from '../src/args/filesystem.js';
import type { CliPluginSource, ICliArtifactValidateResult } from '../src/client/types.js';
import {
  collectDirectory,
  computeContentHash,
  CPK_LIMITS,
  sha256Hex,
  validateCpk,
  validateLayout,
  verifySignature,
} from '../src/artifacts/cpk-validate.js';
import { packCpk } from '../src/artifacts/cpk-pack.js';
import { createDocumentedPermissionCatalog } from '../src/artifacts/permission-catalog.js';
import { readZipStore, writeZipStore, type IZipEntry } from '../src/artifacts/zip.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

const BASECARD_MANIFEST = [
  'id: chips.basecard.hello',
  'version: 1.0.0',
  'type: basecard',
  'name: 你好卡片',
  'description: 演示基础卡片插件',
  'runtime:',
  '  targets: [host]',
  'capabilities:',
  '  cardTypes:',
  '    - id: base.richtext',
  '      name: 富文本卡片',
  '      icon: assets/icons/hello.svg',
  '',
].join('\n');

const SERVICE_MANIFEST = [
  'id: chips.service.clock',
  'version: 1.0.0',
  'type: service',
  'name: 时钟服务',
  'runtime:',
  '  targets: [host]',
  '  background: true',
  '',
].join('\n');

const ENTRY_MODULE = 'export default { activate() {} };\n';
const RENDER_MODULE = 'export function render() { return null; }\n';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';

/** 合法的基础卡片暂存成员（[插件包格式] §2.2、§三）。 */
function baseMembers(overrides?: Readonly<Record<string, Uint8Array | null>>): Map<string, Uint8Array> {
  const members = new Map<string, Uint8Array>([
    ['manifest.yaml', text(BASECARD_MANIFEST)],
    ['dist/index.js', text(ENTRY_MODULE)],
    ['render.js', text(RENDER_MODULE)],
    ['assets/icons/hello.svg', text(SVG)],
  ]);
  for (const [path, data] of Object.entries(overrides ?? {})) {
    if (data === null) {
      members.delete(path);
    } else {
      members.set(path, data);
    }
  }
  return members;
}

/** 合法的服务插件暂存成员：无 render.js，assets/ 只放数据文件。 */
function serviceMembers(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ['manifest.yaml', text(SERVICE_MANIFEST)],
    ['dist/index.js', text(ENTRY_MODULE)],
    ['assets/data/timezones.json', text('{"list":[]}')],
  ]);
}

function entriesOf(members: ReadonlyMap<string, Uint8Array>): IZipEntry[] {
  return [...members.entries()].map(([path, data]) => ({ path, data }));
}

function archiveOf(members: ReadonlyMap<string, Uint8Array>): Uint8Array {
  return writeZipStore(entriesOf(members));
}

/** 把成员写入目录态暂存目录。 */
function stageDirectory(members: ReadonlyMap<string, Uint8Array>, root = '/stage'): IFileSystemPort {
  const fileSystem = new MemoryFileSystem();
  for (const [path, data] of members) {
    fileSystem.writeBinary(`${root}/${path}`, data);
  }
  return fileSystem;
}

interface IValidateFixture {
  readonly source?: CliPluginSource;
  readonly platformVersion?: string;
  readonly trustRoots?: Readonly<Record<string, string>>;
}

function validateBytes(bytes: Uint8Array, fixture: IValidateFixture = {}): ICliArtifactValidateResult {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeBinary('/pkg/hello-basecard-1.0.0.cpk', bytes);
  return validateCpk({
    fileSystem,
    path: '/pkg/hello-basecard-1.0.0.cpk',
    source: fixture.source ?? 'user',
    catalog: createDocumentedPermissionCatalog(),
    ...(fixture.platformVersion === undefined ? {} : { platformVersion: fixture.platformVersion }),
    ...(fixture.trustRoots === undefined ? {} : { trustRoots: fixture.trustRoots }),
  });
}

function validateEntries(entries: readonly IZipEntry[], fixture: IValidateFixture = {}): ICliArtifactValidateResult {
  return validateBytes(writeZipStore(entries), fixture);
}

function validateStageDirectory(
  members: ReadonlyMap<string, Uint8Array>,
  fixture: IValidateFixture = {},
): ICliArtifactValidateResult {
  return validateCpk({
    fileSystem: stageDirectory(members),
    path: '/stage',
    source: fixture.source ?? 'development',
    catalog: createDocumentedPermissionCatalog(),
    ...(fixture.platformVersion === undefined ? {} : { platformVersion: fixture.platformVersion }),
    ...(fixture.trustRoots === undefined ? {} : { trustRoots: fixture.trustRoots }),
  });
}

function expectCpkError(run: () => unknown, code: string, message?: string | RegExp): ChipsError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    const normalized = error as ChipsError;
    expect(normalized.code).toBe(code);
    if (message !== undefined) {
      if (message instanceof RegExp) {
        expect(normalized.message).toMatch(message);
      } else {
        expect(normalized.message).toContain(message);
      }
    }
    return normalized;
  }
  throw new Error(`期望抛出 ${code}`);
}

function stageNames(result: ICliArtifactValidateResult): string[] {
  return result.stages.map((item) => `${item.stage}:${item.status}`);
}

function failedStageNames(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    const details = (error as ChipsError).details as { stages?: { stage: string }[] } | undefined;
    return (details?.stages ?? []).map((item) => item.stage);
  }
  throw new Error('期望校验失败');
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const { publicKey: otherPublic } = generateKeyPairSync('ed25519');
const OTHER_PUBLIC_PEM = otherPublic.export({ type: 'spki', format: 'pem' }).toString();

/**
 * `signature.json` 文档（[插件包格式] §六）：五个字段全部存在且为字符串，
 * 负例在调用点以 `Record<string, unknown>` 覆写单个字段。
 *
 * 取类型别名而非接口的原因：只有对象字面量类型才带隐式索引签名，
 * 完整文档才能直接传给 `withSignature(document: Readonly<Record<string, unknown>>)`。
 */
type ISignatureDocument = {
  readonly format: string;
  readonly keyId: string;
  readonly algorithm: string;
  readonly contentHash: string;
  readonly signature: string;
};

function signatureDocumentFor(
  entries: readonly IZipEntry[],
  keyId = 'chips-test',
): ISignatureDocument {
  const contentHash = computeContentHash(entries.filter((entry) => entry.path !== 'signature.json'));
  const signature = signValue(null, Buffer.from(contentHash, 'utf8'), privateKey).toString('base64');
  return { format: 'chips-signature-v1', keyId, algorithm: 'ed25519', contentHash, signature };
}

function withSignature(entries: readonly IZipEntry[], document: Readonly<Record<string, unknown>>): IZipEntry[] {
  return [...entries, { path: 'signature.json', data: text(JSON.stringify(document)) }];
}

describe('collectDirectory（目录态成员收集）', () => {
  it('收集相对 POSIX 路径与字节内容', () => {
    const members = collectDirectory(stageDirectory(baseMembers()), '/stage');
    expect([...members.keys()].sort()).toEqual([
      'assets/icons/hello.svg',
      'dist/index.js',
      'manifest.yaml',
      'render.js',
    ]);
    expect(new TextDecoder().decode(members.get('render.js') ?? new Uint8Array())).toBe(RENDER_MODULE);
  });

  it('容忍根路径尾部斜杠', () => {
    const fileSystem = stageDirectory(baseMembers());
    expect([...collectDirectory(fileSystem, '/stage/').keys()]).toEqual([
      ...collectDirectory(fileSystem, '/stage').keys(),
    ]);
  });

  it('超过深度上限即拒绝', () => {
    const fileSystem = new MemoryFileSystem();
    const deep = Array.from({ length: CPK_LIMITS.depth + 4 }, (_unused, index) => `d${index}`).join('/');
    fileSystem.writeBinary(`/stage/${deep}/index.js`, text(ENTRY_MODULE));
    expectCpkError(() => collectDirectory(fileSystem, '/stage'), 'CPK_LIMIT_EXCEEDED', '目录深度超过上限');
  });
});

describe('validateLayout（结构校验，§2.2、§三）', () => {
  it('basecard 与 service 的合法布局通过', () => {
    expect(() => validateLayout(baseMembers(), 'basecard')).not.toThrow();
    expect(() => validateLayout(serviceMembers(), 'service')).not.toThrow();
  });

  it('角色布局差异：render.js 只允许非 service 角色', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'render.js': null }), 'basecard'),
      'CPK_ENTRY_MISSING',
      'render.js',
    );
    const withRender = new Map(serviceMembers());
    withRender.set('render.js', text(RENDER_MODULE));
    expectCpkError(() => validateLayout(withRender, 'service'), 'CPK_LAYOUT_INVALID', 'service 角色不得携带 render.js');
  });

  it('缺少 manifest.yaml 与 dist/index.js', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'manifest.yaml': null }), 'basecard'),
      'CPK_MANIFEST_MISSING',
      'manifest.yaml',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'dist/index.js': null }), 'basecard'),
      'CPK_ENTRY_MISSING',
      'dist/index.js',
    );
  });

  it('入口必须是 UTF-8 文本 ESM 模块', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'dist/index.js': text('module.exports = {};') }), 'basecard'),
      'CPK_ENTRY_MISSING',
      '入口必须是 UTF-8 文本 ESM 模块',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'dist/index.js': new Uint8Array([0xff, 0xfe, 0x00]) }), 'basecard'),
      'CPK_ENTRY_MISSING',
      'dist/index.js',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'render.js': text(`export x${String.fromCharCode(0)}y`) }), 'basecard'),
      'CPK_ENTRY_MISSING',
      'render.js',
    );
  });

  it('包根白名单外的条目拒绝', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'src/index.ts': text('export x') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      '白名单外条目：src',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'package.json': text('{"version":"1.0.0"}') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      '白名单外条目：package.json',
    );
  });

  it('隐藏文件、HTML 与代码位置约束', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'assets/.hidden': text('x') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      '禁止隐藏文件或目录',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'dist/index.html': text('<html/>') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      '禁止 HTML 文档',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'assets/helper.js': text('export x') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      'assets/ 只允许登记的资源类型',
    );
    expectCpkError(
      () => validateLayout(baseMembers({ 'manifest.ts': text('export x') }), 'basecard'),
      'CPK_LAYOUT_INVALID',
      '白名单外条目：manifest.ts',
    );
    expect(() => validateLayout(baseMembers({ 'dist/helper.js': text('export x') }), 'basecard')).not.toThrow();
  });

  it('service 角色 assets/ 只允许数据文件', () => {
    const members = new Map(serviceMembers());
    members.set('assets/icons/clock.svg', text(SVG));
    expectCpkError(() => validateLayout(members, 'service'), 'CPK_LAYOUT_INVALID', '只允许数据文件');
  });

  it('原生载荷按扩展名与魔数拒绝', () => {
    expectCpkError(
      () => validateLayout(baseMembers({ 'dist/native.node': text('export x') }), 'basecard'),
      'CPK_NATIVE_PAYLOAD',
      '原生可执行文件',
    );
    const magics: readonly (readonly [string, readonly number[]])[] = [
      ['PE', [0x4d, 0x5a, 0x00, 0x00]],
      ['ELF', [0x7f, 0x45, 0x4c, 0x46]],
      ['Mach-O', [0xfe, 0xed, 0xfa, 0xce]],
      ['Mach-O', [0xfe, 0xed, 0xfa, 0xcf]],
      ['Mach-O', [0xca, 0xfe, 0xba, 0xbe]],
      ['WASM', [0x00, 0x61, 0x73, 0x6d]],
    ];
    for (const [label, bytes] of magics) {
      const members = baseMembers({ 'dist/payload.bin': new Uint8Array(bytes) });
      expectCpkError(() => validateLayout(members, 'basecard'), 'CPK_NATIVE_PAYLOAD', label);
    }
  });

  it('成员数限额（§四）', () => {
    const members = baseMembers();
    for (let index = 0; index < CPK_LIMITS.members + 1; index += 1) {
      members.set(`dist/f${index}.json`, text('{}'));
    }
    expectCpkError(() => validateLayout(members, 'basecard'), 'CPK_LIMIT_EXCEEDED', '文件成员数超过 512');
  });
});

describe('computeContentHash 与 sha256Hex（安装摘要，§6.2）', () => {
  it('按 path + 文件摘要拼接后再摘要', () => {
    const entries: IZipEntry[] = [
      { path: 'b.json', data: text('{}') },
      { path: 'a.js', data: text('export x') },
    ];
    const expected = createHash('sha256')
      .update(
        `a.js\n${createHash('sha256').update(text('export x')).digest('hex')}\n` +
          `b.json\n${createHash('sha256').update(text('{}')).digest('hex')}\n`,
        'utf8',
      )
      .digest('hex');
    expect(computeContentHash(entries)).toBe(`sha256:${expected}`);
  });

  it('与传入顺序无关，按路径字节序归一', () => {
    const entries = entriesOf(baseMembers());
    expect(computeContentHash([...entries].reverse())).toBe(computeContentHash(entries));
  });

  it('空归档也有确定摘要', () => {
    expect(computeContentHash([])).toBe(`sha256:${createHash('sha256').digest('hex')}`);
  });

  it('sha256Hex 输出小写十六进制', () => {
    expect(sha256Hex(text(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('verifySignature（签名阶段，§六）', () => {
  it('未签名：development 与未签名发布者跳过，builtin 必须签名', () => {
    const entries = entriesOf(baseMembers());
    expect(verifySignature({ entries, source: 'development', trustRoots: {} })).toEqual({
      stage: 'signature',
      status: 'skipped',
      detail: 'development 来源',
    });
    expect(verifySignature({ entries, source: 'user', trustRoots: {} })).toEqual({
      stage: 'signature',
      status: 'skipped',
      detail: '未签名发布者',
    });
    expectCpkError(
      () => verifySignature({ entries, source: 'builtin', trustRoots: {} }),
      'CPK_SIGNATURE_REQUIRED',
      'builtin 来源必须签名',
    );
  });

  it('信任根内 keyId 的 Ed25519 签名通过', () => {
    const unsigned = entriesOf(baseMembers());
    const entries = withSignature(unsigned, signatureDocumentFor(unsigned));
    expect(verifySignature({ entries, source: 'user', trustRoots: { 'chips-test': PUBLIC_PEM } })).toEqual({
      stage: 'signature',
      status: 'passed',
      detail: 'keyId: chips-test',
    });
  });

  it('development 来源带签名时不做信任根校验', () => {
    const unsigned = entriesOf(baseMembers());
    const entries = withSignature(unsigned, signatureDocumentFor(unsigned));
    expect(verifySignature({ entries, source: 'development', trustRoots: {} }).status).toBe('skipped');
  });

  it('内容被改动后摘要不一致', () => {
    const unsigned = entriesOf(baseMembers());
    const document = signatureDocumentFor(unsigned);
    const tampered = unsigned.map((entry) =>
      entry.path === 'render.js' ? { path: entry.path, data: text('export function render() { return 1; }') } : entry,
    );
    expectCpkError(
      () =>
        verifySignature({
          entries: withSignature(tampered, document),
          source: 'user',
          trustRoots: { 'chips-test': PUBLIC_PEM },
        }),
      'CPK_SIGNATURE_INVALID',
      '包内容摘要与签名声明不一致',
    );
  });

  it('keyId 未在信任根注册与公钥不匹配均拒绝', () => {
    const unsigned = entriesOf(baseMembers());
    const entries = withSignature(unsigned, signatureDocumentFor(unsigned));
    expectCpkError(
      () => verifySignature({ entries, source: 'user', trustRoots: { 'other-key': PUBLIC_PEM } }),
      'CPK_SIGNATURE_INVALID',
      '信任根未注册的 keyId',
    );
    expectCpkError(
      () => verifySignature({ entries, source: 'user', trustRoots: { 'chips-test': OTHER_PUBLIC_PEM } }),
      'CPK_SIGNATURE_INVALID',
      'Ed25519 签名校验失败',
    );
    expectCpkError(
      () => verifySignature({ entries, source: 'user', trustRoots: { 'chips-test': '不是 PEM' } }),
      'CPK_SIGNATURE_INVALID',
      '签名校验失败',
    );
  });

  it('signature.json 字段逐一校验', () => {
    const unsigned = entriesOf(baseMembers());
    const document = signatureDocumentFor(unsigned);
    const cases: readonly Record<string, unknown>[] = [
      { ...document, format: 'chips-signature-v2' },
      { ...document, keyId: '' },
      { ...document, keyId: 7 },
      { ...document, algorithm: 'rsa' },
      { ...document, contentHash: document.contentHash.replace('sha256:', 'sha512:') },
      { ...document, contentHash: 'sha256:zz' },
      { ...document, signature: '' },
      { ...document, contentHash: undefined },
    ];
    for (const value of cases) {
      const signatureEntry: IZipEntry = { path: 'signature.json', data: text(JSON.stringify(value)) };
      expectCpkError(
        () =>
          verifySignature({
            entries: [...unsigned, signatureEntry],
            source: 'user',
            trustRoots: { 'chips-test': PUBLIC_PEM },
          }),
        'CPK_SIGNATURE_INVALID',
        'signature.json 字段非法',
      );
    }
  });

  it('signature.json 不是合法 JSON 或非映射时拒绝', () => {
    const unsigned = entriesOf(baseMembers());
    const cases: readonly (readonly [string, string])[] = [
      ['{不是 JSON', '不是合法 JSON'],
      ['[1,2]', '字段非法'],
      ['null', '结构非法'],
    ];
    for (const [content, message] of cases) {
      const entries: IZipEntry[] = [...unsigned, { path: 'signature.json', data: text(content) }];
      expectCpkError(
        () => verifySignature({ entries, source: 'user', trustRoots: {} }),
        'CPK_SIGNATURE_INVALID',
        message,
      );
    }
  });
});

describe('validateCpk：归档态', () => {
  it('五阶段结果序列与安装摘要（未签名 user 来源）', () => {
    const bytes = archiveOf(baseMembers());
    const result = validateBytes(bytes);
    expect(result.valid).toBe(true);
    expect(stageNames(result)).toEqual([
      'archive:passed',
      'layout:passed',
      'manifest:passed',
      'signature:skipped',
      'hash:passed',
    ]);
    expect(result.stages[0]?.detail).toBe('全部成员 Stored');
    expect(result.stages[1]?.detail).toBe('basecard 布局');
    expect(result.stages[2]?.detail).toBe('chips.basecard.hello@1.0.0（basecard）');
    expect(result.stages[4]?.detail).toBe(`sha256:${sha256Hex(bytes)}`);
    expect(result.warnings).toEqual(['未签名发布者：安装需要用户确认']);
  });

  it('签名归档在信任根内通过签名阶段', () => {
    const unsigned = entriesOf(baseMembers());
    const entries = withSignature(unsigned, signatureDocumentFor(unsigned));
    const result = validateEntries(entries, { source: 'builtin', trustRoots: { 'chips-test': PUBLIC_PEM } });
    expect(stageNames(result)).toEqual([
      'archive:passed',
      'layout:passed',
      'manifest:passed',
      'signature:passed',
      'hash:passed',
    ]);
    expect(result.warnings).toBeUndefined();
  });

  it('同一输入两次归档字节级一致', () => {
    expect(Buffer.from(archiveOf(baseMembers())).equals(archiveOf(baseMembers()))).toBe(true);
  });

  it('路径不存在', () => {
    expectCpkError(
      () =>
        validateCpk({
          fileSystem: new MemoryFileSystem(),
          path: '/none.cpk',
          source: 'user',
          catalog: createDocumentedPermissionCatalog(),
        }),
      'CLI_PATH_NOT_FOUND',
      '路径不存在',
    );
  });

  it('不是合法 ZIP 归档', () => {
    expectCpkError(() => validateBytes(text('不是归档')), 'CPK_ARCHIVE_INVALID', '未找到中央目录结束记录');
  });

  it('缺少 manifest.yaml', () => {
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ 'manifest.yaml': null }))),
      'CPK_MANIFEST_MISSING',
      'manifest.yaml',
    );
  });

  it('清单阶段错误携带已完成的阶段结果', () => {
    const entries = entriesOf(baseMembers({ 'manifest.yaml': text('id: Chips.Bad\nversion: 1.0.0\n') }));
    const error = expectCpkError(() => validateEntries(entries), 'CPK_MANIFEST_INVALID', '反向域名');
    expect((error.details as { pointer?: string }).pointer).toBe('id');
    expect(failedStageNames(() => validateEntries(entries))).toEqual(['archive']);
  });

  it('engines.chips 门禁在安装校验生效', () => {
    const manifest = BASECARD_MANIFEST.replace('runtime:', 'engines:\n  chips: ">=2.0.0"\nruntime:');
    const entries = entriesOf(baseMembers({ 'manifest.yaml': text(manifest) }));
    expectCpkError(
      () => validateEntries(entries, { platformVersion: '1.0.0' }),
      'CPK_ENGINE_UNSUPPORTED',
      '不满足当前平台版本',
    );
    expect(validateEntries(entries, { platformVersion: '2.1.0' }).valid).toBe(true);
  });

  it('清单引用的资源缺失时拒绝', () => {
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ 'assets/icons/hello.svg': null }))),
      'CPK_MANIFEST_INVALID',
      '清单引用的文件不存在',
    );
  });

  it('布局错误在归档阶段之后返回', () => {
    const entries = entriesOf(baseMembers({ 'render.js': text('function noModules() {}') }));
    expect(failedStageNames(() => validateEntries(entries))).toEqual(['archive']);
    expectCpkError(() => validateEntries(entries), 'CPK_ENTRY_MISSING', 'render.js');
  });

  it('成员数超过归档限额', () => {
    const members = baseMembers();
    for (let index = 0; index < CPK_LIMITS.members + 1; index += 1) {
      members.set(`dist/f${index}.json`, text('{}'));
    }
    expectCpkError(() => validateEntries(entriesOf(members)), 'CPK_LIMIT_EXCEEDED', '文件成员数超过 512');
  });

  it('manifest.yaml 超过 256 KiB', () => {
    const oversized = text(`${BASECARD_MANIFEST}${'#'.repeat(CPK_LIMITS.manifestBytes)}`);
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ 'manifest.yaml': oversized }))),
      'CPK_LIMIT_EXCEEDED',
      'manifest.yaml 超过 256 KiB',
    );
  });

  it('嵌套归档在归档阶段拒绝', () => {
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ 'assets/bundle.zip': text('PK') }))),
      'CPK_ARCHIVE_INVALID',
      '禁止嵌套归档',
    );
    for (const extension of ['.tar', '.tgz', '.7z', '.cpk', '.gz', '.rar']) {
      const members = baseMembers({ [`assets/x${extension}`]: text('x') });
      expectCpkError(() => validateEntries(entriesOf(members)), 'CPK_ARCHIVE_INVALID', extension);
    }
  });
});

describe('validateCpk：成员路径安全（§2.4）', () => {
  const unsafePaths: readonly (readonly [string, string])[] = [
    ['/etc/passwd', '前导 /'],
    ['C:/Windows/x.js', '盘符'],
    ['assets\\icon.svg', '反斜杠'],
    [`assets/a${String.fromCharCode(0)}b.svg`, '控制字符'],
    ['assets//icon.svg', '路径穿越或空段'],
    ['assets/./icon.svg', '路径穿越或空段'],
    ['assets/../secret.svg', '路径穿越或空段'],
    ['assets/con/icon.svg', '保留设备名'],
    ['dist/NUL.js', '保留设备名'],
  ];

  it('不安全路径按 CPK_PATH_UNSAFE 拒绝，错误带成员路径', () => {
    for (const [path, reason] of unsafePaths) {
      const members = baseMembers({ [path]: text('x') });
      const error = expectCpkError(
        () => validateEntries(entriesOf(members)),
        'CPK_PATH_UNSAFE',
        reason,
      );
      expect((error.details as { file?: string }).file).toBe(path);
    }
  });

  it('路径超长与深度超限按 CPK_LIMIT_EXCEEDED 拒绝', () => {
    const longName = 'x'.repeat(CPK_LIMITS.pathLength + 1);
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ [`assets/${longName}`]: text('x') }))),
      'CPK_LIMIT_EXCEEDED',
      '成员路径超长',
    );
    const deep = Array.from({ length: CPK_LIMITS.depth + 1 }, (_unused, index) => `d${index}`).join('/');
    expectCpkError(
      () => validateEntries(entriesOf(baseMembers({ [`assets/${deep}.svg`]: text('x') }))),
      'CPK_LIMIT_EXCEEDED',
      '成员目录深度超限',
    );
  });
});

describe('validateCpk：目录态', () => {
  it('归档与摘要阶段跳过，布局与清单阶段照常执行', () => {
    const result = validateStageDirectory(baseMembers());
    expect(stageNames(result)).toEqual([
      'archive:skipped',
      'layout:passed',
      'manifest:passed',
      'signature:skipped',
      'hash:skipped',
    ]);
    expect(result.stages[0]?.detail).toBe('目录态跳过归档校验');
    expect(result.stages[4]?.detail).toBe('目录态不做归档摘要');
    expect(result.warnings).toBeUndefined();
  });

  it('user 来源的目录态仍提示未签名', () => {
    expect(validateStageDirectory(baseMembers(), { source: 'user' }).warnings).toEqual([
      '未签名发布者：安装需要用户确认',
    ]);
  });

  it('service 目录态布局', () => {
    expect(stageNames(validateStageDirectory(serviceMembers()))[1]).toBe('layout:passed');
  });

  it('目录态 assets/ 内的归档扩展名按资源类型规则拒绝', () => {
    expectCpkError(
      () => validateStageDirectory(baseMembers({ 'assets/bundle.zip': text('PK') })),
      'CPK_LAYOUT_INVALID',
      'assets/ 只允许登记的资源类型',
    );
  });

  it('目录态清单缺字段时返回清单阶段错误', () => {
    const members = baseMembers({ 'manifest.yaml': text('version: 1.0.0\n') });
    const error = expectCpkError(() => validateStageDirectory(members), 'CPK_MANIFEST_INVALID', '应为字符串：id');
    expect(failedStageNames(() => validateStageDirectory(members))).toEqual(['archive']);
    expect((error.details as { pointer?: string }).pointer).toBe('id');
  });
});

describe('packCpk（§7.1 打包）', () => {
  function packFixture(
    members: ReadonlyMap<string, Uint8Array>,
    extra?: Readonly<Record<string, Uint8Array>>,
  ): MemoryFileSystem {
    const fileSystem = new MemoryFileSystem();
    for (const [path, data] of members) {
      fileSystem.writeBinary(`/plugins/hello-basecard/${path}`, data);
    }
    for (const [path, data] of Object.entries(extra ?? {})) {
      fileSystem.writeBinary(path, data);
    }
    return fileSystem;
  }

  function pack(
    members: ReadonlyMap<string, Uint8Array>,
    options?: {
      readonly sign?: boolean;
      readonly keyId?: string;
      readonly signingKeyFile?: string;
      readonly out?: string;
      readonly dir?: string;
      readonly platformVersion?: string;
      readonly extra?: Readonly<Record<string, Uint8Array>>;
    },
  ): ReturnType<typeof packCpk> {
    const sign = options?.sign ?? false;
    const keyId = options?.keyId;
    const signingKeyFile = options?.signingKeyFile;
    const out = options?.out;
    const platformVersion = options?.platformVersion;
    return packCpk({
      fileSystem: packFixture(members, options?.extra),
      dir: options?.dir ?? '/plugins/hello-basecard',
      sign,
      ...(keyId === undefined ? {} : { keyId }),
      ...(signingKeyFile === undefined ? {} : { signingKeyFile }),
      ...(out === undefined ? {} : { out }),
      ...(platformVersion === undefined ? {} : { platformVersion }),
      catalog: createDocumentedPermissionCatalog(),
    });
  }

  it('未签名打包：产物命名、成员顺序与安装摘要', () => {
    const fileSystem = packFixture(baseMembers());
    const result = packCpk({
      fileSystem,
      dir: '/plugins/hello-basecard',
      sign: false,
      catalog: createDocumentedPermissionCatalog(),
    });
    expect(result.archivePath).toBe('/plugins/hello-basecard/dist/hello-basecard-1.0.0.cpk');
    expect(result.name).toBe('hello-basecard');
    expect(result.version).toBe('1.0.0');
    expect(result.role).toBe('basecard');
    expect(result.memberCount).toBe(4);
    expect(result.signed).toBe(false);
    const bytes = fileSystem.readBinary(result.archivePath);
    expect(result.archiveSize).toBe(bytes.length);
    expect(result.digest).toBe(`sha256:${sha256Hex(bytes)}`);
    expect(readZipStore(bytes).map((entry) => entry.path)).toEqual([
      'assets/icons/hello.svg',
      'dist/index.js',
      'manifest.yaml',
      'render.js',
    ]);
  });

  it('产物可被安装校验读取且阶段序列一致', () => {
    const fileSystem = stageDirectory(baseMembers(), '/plugins/hello-basecard');
    const result = packCpk({
      fileSystem,
      dir: '/plugins/hello-basecard',
      sign: false,
      catalog: createDocumentedPermissionCatalog(),
    });
    const validated = validateBytes(fileSystem.readBinary(result.archivePath), { source: 'development' });
    expect(stageNames(validated)).toEqual([
      'archive:passed',
      'layout:passed',
      'manifest:passed',
      'signature:skipped',
      'hash:passed',
    ]);
  });

  it('同一输入两次打包字节级可复现', () => {
    const first = stageDirectory(baseMembers(), '/a/hello-basecard');
    const second = stageDirectory(baseMembers(), '/b/hello-basecard');
    const left = packCpk({
      fileSystem: first,
      dir: '/a/hello-basecard',
      sign: false,
      catalog: createDocumentedPermissionCatalog(),
    });
    const right = packCpk({
      fileSystem: second,
      dir: '/b/hello-basecard',
      sign: false,
      catalog: createDocumentedPermissionCatalog(),
    });
    expect(left.digest).toBe(right.digest);
    expect(Buffer.from(first.readBinary(left.archivePath)).equals(second.readBinary(right.archivePath))).toBe(true);
  });

  it('签名打包写入 signature.json 并可被信任根验证', () => {
    const keyFile = '/keys/chips-test.pem';
    const fileSystem = packFixture(baseMembers(), { [keyFile]: text(PRIVATE_PEM) });
    const result = packCpk({
      fileSystem,
      dir: '/plugins/hello-basecard',
      sign: true,
      keyId: 'chips-test',
      signingKeyFile: keyFile,
      catalog: createDocumentedPermissionCatalog(),
    });
    expect(result.signed).toBe(true);
    expect(result.memberCount).toBe(5);

    const bytes = fileSystem.readBinary(result.archivePath);
    const entries = readZipStore(bytes);
    const signatureEntry = entries.find((entry) => entry.path === 'signature.json');
    expect(signatureEntry).toBeDefined();
    const document = JSON.parse(
      new TextDecoder().decode(signatureEntry?.data ?? new Uint8Array()),
    ) as ISignatureDocument;
    expect(Object.keys(document).sort()).toEqual(['algorithm', 'contentHash', 'format', 'keyId', 'signature']);
    expect(document.format).toBe('chips-signature-v1');
    expect(document.algorithm).toBe('ed25519');
    expect(document.keyId).toBe('chips-test');
    expect(document.contentHash).toBe(computeContentHash(entries.filter((entry) => entry.path !== 'signature.json')));

    const validated = validateBytes(bytes, { source: 'user', trustRoots: { 'chips-test': PUBLIC_PEM } });
    expect(stageNames(validated)).toEqual([
      'archive:passed',
      'layout:passed',
      'manifest:passed',
      'signature:passed',
      'hash:passed',
    ]);
  });

  it('输出目录可覆盖', () => {
    const result = pack(baseMembers(), { out: '/out' });
    expect(result.archivePath).toBe('/out/hello-basecard-1.0.0.cpk');
  });

  it('目录不存在与缺清单', () => {
    expectCpkError(() => pack(baseMembers(), { dir: '/none' }), 'CLI_PATH_INVALID', '不是目录');
    expectCpkError(
      () => pack(baseMembers({ 'manifest.yaml': null })),
      'CPK_MANIFEST_MISSING',
      '插件工程缺少 manifest.yaml',
    );
  });

  it('签名参数不完整时拒绝', () => {
    expectCpkError(() => pack(baseMembers(), { sign: true }), 'CLI_ARGUMENT_INVALID', 'CHIPS_SIGNING_KEY_FILE');
    expectCpkError(
      () => pack(baseMembers(), { sign: true, keyId: 'chips-test' }),
      'CLI_ARGUMENT_INVALID',
      'CHIPS_SIGNING_KEY_FILE',
    );
  });

  it('私钥不可读时返回签名错误', () => {
    expectCpkError(
      () => pack(baseMembers(), { sign: true, keyId: 'chips-test', signingKeyFile: '/keys/none.pem' }),
      'CPK_SIGNATURE_INVALID',
      '签名失败',
    );
  });

  it('package.json 版本一致性优先于布局校验（§3.2）', () => {
    expectCpkError(
      () =>
        pack(baseMembers(), {
          extra: { '/plugins/hello-basecard/package.json': text('{"version":"2.0.0"}') },
        }),
      'CPK_MANIFEST_INVALID',
      '不一致',
    );
    expectCpkError(
      () =>
        pack(baseMembers(), {
          extra: { '/plugins/hello-basecard/package.json': text('{坏 JSON') },
        }),
      'CPK_MANIFEST_INVALID',
      'package.json 不是合法 JSON',
    );
  });

  it('清单校验与平台门禁在打包阶段生效', () => {
    const manifest = BASECARD_MANIFEST.replace('runtime:', 'engines:\n  chips: ">=2.0.0"\nruntime:');
    expectCpkError(
      () => pack(baseMembers({ 'manifest.yaml': text(manifest) }), { platformVersion: '1.0.0' }),
      'CPK_ENGINE_UNSUPPORTED',
      '不满足当前平台版本',
    );
    expectCpkError(
      () => pack(baseMembers({ 'manifest.yaml': text('id: BAD\nversion: 1.0.0\n') })),
      'CPK_MANIFEST_INVALID',
    );
  });

  it('打包输入受根白名单约束：暂存目录外的源码工程文件被拒绝', () => {
    expectCpkError(
      () =>
        pack(baseMembers(), {
          extra: { '/plugins/hello-basecard/package.json': text('{"version":"1.0.0"}') },
        }),
      'CPK_LAYOUT_INVALID',
      '白名单外条目：package.json',
    );
  });
});
