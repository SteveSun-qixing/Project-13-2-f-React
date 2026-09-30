/**
 * `IDocumentParserPort` chips-native 生产适配器单测（W2 金链路刀2，契约先行）。
 *
 * 权威：《03-核心接口规范》§6.4「Neon 导出」表与 §6.6、《06-文档解析器设计》§12.1/§12.2
 * （导出名、参数位次、返回信封、`ChipsError` 同构错误形状）、§8.6（导出表只增不改、
 * ABI 递增规则）、工单034（`documentRevision` / `documentLayoutConfig` 两正式化名口径）。
 *
 * 覆盖面：
 * - A 组 契约锁：§6.4/§12.1 表原文解析 ↔ 适配器冻结导出名常量逐项一致；ABI 常量 ↔
 *   `export-surface.json`；`.d.ts` 函数面；工单034 收口锁（两正式化名已入表并与
 *   注入面同序互锁）。
 * - B 组 装载闸：fail-closed 四分面（CJS 替身夹具，`native-bridge.test.ts` 同法）。
 * - C 组 适配器直连：open（严格 kind / 自动识别逐导出）、readPart 四臂参数位次与
 *   返回形状逐字对 §6.4、fingerprint 复合臂、release 幂等注册表、backing 抛
 *   `IChipsError` 结构对象的错误还原（工单024 唯一类语义）、取消预检、泄漏守卫、
 *   信封守卫、serialize 真接（工单036 波 C3 `documentSerialize`：参数位次、保存时刻
 *   单源交付、成员形状守卫、失败透传与形状违约归一）。
 * - D 组 真实服务链路：`service.ts` 全链（executeOpen/Read/Write/Save/releaseSessions）
 *   以 `{...harness.dependencies, parser: 适配器}` 组装跑通。
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ChipsError, isChipsError } from '@chips/bridge';
import { describe, expect, it } from 'vitest';

import { computeQuickFingerprintDigest } from '../src/capabilities/document/digest.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import { createNativeDocumentParserPort } from '../src/capabilities/document/adapters/native-parser.js';
import {
  NATIVE_DOCUMENT_PARSER_ABI_VERSION,
  NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS,
  NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS,
  NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS,
  NATIVE_DOCUMENT_PARSER_STORAGE_EXPORTS,
  NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS,
  defaultNativeDocumentParserModulePath,
  loadNativeDocumentParserBinding,
} from '../src/capabilities/document/adapters/native-parser-module.js';
import { createDocumentService } from '../src/capabilities/document/service.js';
import type { IDocumentHandle } from '../src/capabilities/document/ports.js';
import type {
  INativeDocumentHandle,
  INativeDocumentParserModule,
} from '../src/capabilities/document/adapters/native-parser-module.js';
import {
  BOX_ID,
  CARD_ID,
  createHarness,
  ctxFor,
  NODE_ID_ONE,
  SESSION_A,
  boxMetadata,
  boxStructure,
  cardMetadata,
  cardStructure,
} from './helpers/document-fake-ports.js';

/** 测试夹具目录（装载闸内部经 `createRequire` 加载 CJS 替身，模拟 `.node` 边界）。 */
const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/native-binding/${name}`, import.meta.url));

/** 读取工作区文档库/生成源原文（不建立依赖边）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

/** 从契约文档原文提取「Neon 导出」表首列反引号函数名（表行均以 `` | `name` | `` 起头）。 */
function parseExportTableNames(markdown: string): string[] {
  const names: string[] = [];
  for (const line of markdown.split('\n')) {
    const matched = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|/.exec(line);
    if (matched?.[1] !== undefined) {
      names.push(matched[1]);
    }
  }
  return names;
}

/* ------------------------------------------------------------------ *
 * 替身原生模块（TS 注入面：成员盘镜像 + 调用日志 + 失败/返回值注入面板）
 * ------------------------------------------------------------------ */

interface IFakeCall {
  readonly fn: string;
  readonly args: readonly unknown[];
}

interface IFakeMember {
  path: string;
  size: number;
  modifiedMillis: number | null;
  crc32: number | null;
}

interface IFakeDocument {
  kind: 'card' | 'box';
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contents: Record<string, Record<string, unknown>>;
  entries: Record<string, unknown>[];
  layout: Record<string, unknown>;
  sourceKind: 'directory' | 'archive';
  members: IFakeMember[];
  diagnostics: { severity: 'error' | 'warning' | 'info'; code: string; message: string }[];
}

interface IFakeNativeOptions {
  /** 失败注入面板：backing 抛出的 §12.2 同构错误一律为 `Error` 实例（`bindingError` / `new Error`）。 */
  readonly failures: Record<string, Error>;
  readonly overrides: Record<string, unknown>;
  readonly hooks: Record<string, () => void>;
}

interface IFakeNative {
  readonly module: INativeDocumentParserModule;
  readonly calls: IFakeCall[];
  readonly docs: Map<string, IFakeDocument>;
  readonly options: IFakeNativeOptions;
  closeCountOf(localPath: string): number;
}

/** backing 抛出的 §12.2 同构错误（`Error` 自有属性 `code` / `message` / `details` / `retryable`）。 */
function bindingError(
  code: string,
  message: string,
  extra: { readonly details?: unknown; readonly retryable?: boolean } = {},
): Error {
  // 显式泛型：内联字面量含 `unknown ?? 默认值` 联合成员时 `Object.assign` 会落入 any 重载。
  return Object.assign<Error, { code: string; details: unknown; retryable: boolean }>(new Error(message), {
    code,
    details: extra.details ?? { origin: 'chips-parser' },
    retryable: extra.retryable ?? false,
  });
}

function cardDocument(): IFakeDocument {
  return {
    kind: 'card',
    metadata: cardMetadata(),
    structure: cardStructure(),
    contents: {
      [NODE_ID_ONE]: { text: '第一块内容' },
      Jk4lMn5Op6: { text: '第二块内容' },
    },
    entries: [],
    layout: {},
    sourceKind: 'directory',
    members: [
      { path: 'meta.yaml', size: 120, modifiedMillis: 1000, crc32: null },
      { path: 'structure.yaml', size: 200, modifiedMillis: 1000, crc32: null },
    ],
    diagnostics: [{ severity: 'warning', code: 'PARSE_WARNING', message: '基线解析告警' }],
  };
}

function boxDocument(): IFakeDocument {
  return {
    kind: 'box',
    metadata: boxMetadata(),
    structure: boxStructure(),
    contents: {},
    entries: boxStructure().entries as Record<string, unknown>[],
    layout: { active_layout_type: 'grid', columns: 3 },
    sourceKind: 'archive',
    members: [
      { path: 'meta.yaml', size: 128, modifiedMillis: 2000, crc32: 3735928559 },
      { path: 'structure.yaml', size: 256, modifiedMillis: 2000, crc32: 2596069104 },
    ],
    diagnostics: [],
  };
}

/** 构造替身原生模块：文档按本地路径登记，句柄即 `{path}` 投影。 */
function createFakeNative(docs: Map<string, IFakeDocument>): IFakeNative {
  const calls: IFakeCall[] = [];
  const options: IFakeNativeOptions = { failures: {}, overrides: {}, hooks: {} };
  const closes = new Map<string, number>();

  function dispatch<T>(fn: string, args: readonly unknown[], produce: () => T): Promise<T> {
    calls.push({ fn, args });
    options.hooks[fn]?.();
    const failure = options.failures[fn];
    if (failure !== undefined) {
      throw failure;
    }
    const override = options.overrides[fn];
    if (override !== undefined) {
      return Promise.resolve(override as T);
    }
    return Promise.resolve(produce());
  }

  function docOf(handle: INativeDocumentHandle): IFakeDocument {
    const path = (handle as unknown as { path: string }).path;
    const doc = docs.get(path);
    if (doc === undefined) {
      throw bindingError('DOCUMENT_NOT_FOUND', '来源不存在');
    }
    return doc;
  }

  const module: INativeDocumentParserModule = {
    openDocument(path) {
      return dispatch('openDocument', [path], () => {
        if (!docs.has(path)) {
          throw bindingError('DOCUMENT_NOT_FOUND', '来源不存在');
        }
        return { path } as unknown as INativeDocumentHandle;
      });
    },
    openCard(path) {
      return dispatch('openCard', [path], () => {
        const doc = docs.get(path);
        if (doc === undefined) {
          throw bindingError('DOCUMENT_NOT_FOUND', '来源不存在');
        }
        if (doc.kind !== 'card') {
          throw bindingError('DOCUMENT_FORMAT_UNKNOWN', '声明 card 而内容为 box');
        }
        return { path } as unknown as INativeDocumentHandle;
      });
    },
    openBox(path) {
      return dispatch('openBox', [path], () => {
        const doc = docs.get(path);
        if (doc === undefined) {
          throw bindingError('DOCUMENT_NOT_FOUND', '来源不存在');
        }
        if (doc.kind !== 'box') {
          throw bindingError('DOCUMENT_FORMAT_UNKNOWN', '声明 box 而内容为 card');
        }
        return { path } as unknown as INativeDocumentHandle;
      });
    },
    documentMetadata(handle) {
      return dispatch('documentMetadata', [handle], () => {
        const doc = docOf(handle);
        return { kind: doc.kind, value: doc.metadata, diagnostics: doc.diagnostics };
      });
    },
    documentStructure(handle) {
      return dispatch('documentStructure', [handle], () => {
        const doc = docOf(handle);
        return { kind: doc.kind, value: doc.structure, diagnostics: doc.diagnostics };
      });
    },
    documentContent(handle, nodeId) {
      return dispatch('documentContent', [handle, nodeId], () => {
        const doc = docOf(handle);
        const value = doc.contents[nodeId];
        if (value === undefined) {
          throw bindingError('DOCUMENT_STRUCTURE_INVALID', '内容成员不存在');
        }
        return {
          kind: doc.kind,
          value: { node_id: nodeId, card_type: 'text', value },
          diagnostics: [],
        };
      });
    },
    documentEntries(handle, range) {
      return dispatch('documentEntries', range === undefined ? [handle] : [handle, range], () => {
        const doc = docOf(handle);
        const all = doc.entries;
        const value = range === undefined ? all : all.slice(range.offset, range.offset + range.limit);
        return { kind: doc.kind, value, diagnostics: [] };
      });
    },
    documentReadResource(handle, path, range) {
      return dispatch(
        'documentReadResource',
        [handle, path, ...(range === undefined ? [] : [range])],
        () => new Uint8Array(0),
      );
    },
    documentValidate(handle) {
      return dispatch('documentValidate', [handle], () => {
        const doc = docOf(handle);
        return {
          kind: doc.kind,
          chip_standards_version: '1.0.0',
          status: 'valid' as const,
          statistics: {
            member_count: doc.members.length,
            yaml_bytes: 0,
            resource_count: 0,
            entry_count: doc.entries.length,
            uncompressed_bytes: 0,
          },
          diagnostics: [],
        };
      });
    },
    buildDocumentView(handle, session) {
      return dispatch('buildDocumentView', [handle, session], () => ({ kind: docOf(handle).kind }));
    },
    documentClose(handle) {
      return dispatch('documentClose', [handle], () => {
        const path = (handle as unknown as { path: string }).path;
        closes.set(path, (closes.get(path) ?? 0) + 1);
      });
    },
    createCancelToken() {
      calls.push({ fn: 'createCancelToken', args: [] });
      return { nativeCancelTokenHandleBrand: 'chips-native.cancel-token' as const };
    },
    cancelTokenCancel(token) {
      void dispatch('cancelTokenCancel', [token], () => undefined);
    },
    documentRevision(handle) {
      return dispatch('documentRevision', [handle], () => {
        const doc = docOf(handle);
        return {
          source: { kind: doc.sourceKind, members: doc.members.map((member) => ({ ...member })) },
          chipStandardsVersion: '1.0.0',
          indexDigest: 'sha256:index',
        };
      });
    },
    documentLayoutConfig(handle) {
      return dispatch('documentLayoutConfig', [handle], () => {
        const doc = docOf(handle);
        if (doc.kind !== 'box') {
          throw bindingError('DOCUMENT_FORMAT_UNKNOWN', '卡片句柄无布局配置');
        }
        return { kind: 'box', value: doc.layout, diagnostics: [] };
      });
    },
    documentSerialize(request, savedAtUnixMs) {
      return dispatch('documentSerialize', [request, savedAtUnixMs], () => {
        // 忠实替身：按变更集范围产成员（与 `document-fake-ports.ts` serialize 同谱——
        // 元数据 / 结构 / 内容成员逐项 JSON 字节；路径升序交付）。
        const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
        const members: { packagePath: string; bytes: Uint8Array }[] = [];
        if (request.changedParts.includes('metadata')) {
          members.push({ packagePath: 'meta.yaml', bytes: encode(request.metadata) });
        }
        if (request.changedParts.includes('structure') || request.changedParts.includes('entries')) {
          members.push({ packagePath: 'structure.yaml', bytes: encode(request.structure) });
        }
        for (const item of request.contents) {
          members.push({ packagePath: `content/${item.nodeId}.yaml`, bytes: encode(item.value) });
        }
        if (request.kind === 'box' && request.layoutConfig !== null) {
          members.push({ packagePath: 'layout.yaml', bytes: encode(request.layoutConfig) });
        }
        return members.sort((left, right) => left.packagePath.localeCompare(right.packagePath));
      });
    },
  };

  return {
    module,
    calls,
    docs,
    options,
    closeCountOf: (localPath: string) => closes.get(localPath) ?? 0,
  };
}

/** 捕获拒绝并断言其为唯一类 `ChipsError`（工单024：跨边界还原后一律唯一类实例）。 */
async function rejectAsChipsError(run: Promise<unknown>): Promise<ChipsError> {
  try {
    await run;
  } catch (error: unknown) {
    expect(isChipsError(error), `预期 ChipsError 同构拒绝，实际：${String(error)}`).toBe(true);
    expect(error).toBeInstanceOf(ChipsError);
    return error as ChipsError;
  }
  throw new Error('预期以登记码拒绝，实际正常完成');
}

/** 适配器直连用例的公共装配：一个 box（归档态）与一个 card（目录态）。 */
function adapterFixture(): {
  fake: IFakeNative;
  port: ReturnType<typeof createNativeDocumentParserPort>;
  cardPath: string;
  boxPath: string;
} {
  const cardPath = '/fake/adapter.card';
  const boxPath = '/fake/adapter.box';
  const fake = createFakeNative(
    new Map([
      [cardPath, cardDocument()],
      [boxPath, boxDocument()],
    ]),
  );
  return { fake, port: createNativeDocumentParserPort(fake.module), cardPath, boxPath };
}

function freshSignal(): AbortSignal {
  return new AbortController().signal;
}

/* ------------------------------------------------------------------ *
 * A 组：§6.4 / §12.1 / §8.6 契约锁
 * ------------------------------------------------------------------ */

describe('刀2契约锁：§6.4/§12.1 导出表 ↔ 适配器冻结名 ↔ ABI 清单 ↔ .d.ts', () => {
  const frozenDoc = readWorkspaceSource(
    '../../../../薯片生态文档库/05-接口与契约/03.06-03-核心接口规范-六、文档解析入口（chips-parser）.md',
  );
  const parserDoc = readWorkspaceSource(
    '../../../../薯片生态文档库/01-架构设计/01-子系统设计/06.12-06-文档解析器设计-十二、Neon 暴露.md',
  );
  const manifest = JSON.parse(readWorkspaceSource('../../native/abi/export-surface.json')) as {
    abiVersion: number;
    exports: { name: string }[];
  };
  const declaration = readWorkspaceSource('../../native/types/chips-native.d.ts');

  it('§6.4 表原文 15 行导出名与适配器文档表镜像段逐项一致（前缀锁；文档库随动归主批，工单036 波 C3 补登名在镜像尾段）', () => {
    const section = frozenDoc.slice(frozenDoc.indexOf('### 6.4'), frozenDoc.indexOf('### 6.5'));
    const documented = [...NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS, ...NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS];
    expect(parseExportTableNames(section).sort()).toEqual([...documented].sort());
    // 前缀锁：文档表 15 名按表序与镜像全集面前缀逐位一致（尾段 = C3 存储序列化名）。
    expect(NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS.slice(0, documented.length)).toEqual(documented);
    expect(NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS.slice(documented.length)).toEqual(['documentSerialize']);
  });

  it('§12.1 表原文 14 行 = 文档表镜像段去掉 buildDocumentView（两表同源互证）', () => {
    const section = parserDoc.slice(parserDoc.indexOf('### 12.1'), parserDoc.indexOf('### 12.2'));
    const documented = [...NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS, ...NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS];
    const expected = documented.filter((name) => name !== 'buildDocumentView');
    expect(parseExportTableNames(section).sort()).toEqual([...expected].sort());
  });

  it('工单034 正式化名清单与注入面声明一致（documentRevision / documentLayoutConfig）；C3 存储序列化名入闸', () => {
    expect(NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS).toEqual(['documentRevision', 'documentLayoutConfig']);
    expect(NATIVE_DOCUMENT_PARSER_STORAGE_EXPORTS).toEqual(['documentSerialize']);
    expect(NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS.length).toBe(
      NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS.length +
        NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS.length +
        NATIVE_DOCUMENT_PARSER_STORAGE_EXPORTS.length +
        2 /* 元信息两项 */,
    );
  });

  it('13 项冻结名已登记于 ABI 清单与 .d.ts 函数面（刀1 落地互锁）', () => {
    const names = manifest.exports.map((entry) => entry.name);
    for (const name of NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS) {
      expect(names).toContain(name);
      expect(declaration).toContain(`export function ${name}(`);
    }
  });

  it('工单034 收口锁：两正式化名已入 ABI 清单与 .d.ts，落位互锁（翻转自登记现状锁）', () => {
    const names = manifest.exports.map((entry) => entry.name);
    for (const name of NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS) {
      expect(names).toContain(name);
      expect(declaration).toContain(`export function ${name}(`);
    }
    // 落位（§6.4 backing 句柄方法表序，`documentEntries` 之后、`documentReadResource`
    // 之前）：`documentLayoutConfig` 先、`documentRevision` 后（Rust 侧声明序），
    // 与 `export_table!` / `check-abi` 三方一致口径互锁。
    const index = (name: string): number => names.indexOf(name);
    expect(index('documentLayoutConfig')).toBeGreaterThan(index('documentEntries'));
    expect(index('documentRevision')).toBe(index('documentLayoutConfig') + 1);
    expect(index('documentRevision')).toBeLessThan(index('documentReadResource'));
    expect(NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS.length).toBe(16);
  });

  it('宿主期望解析域 ABI 与 export-surface.json 的 abiVersion 等值', () => {
    expect(manifest.abiVersion).toBe(NATIVE_DOCUMENT_PARSER_ABI_VERSION);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：装载闸 fail-closed 四分面
 * ------------------------------------------------------------------ */

describe('刀2装载闸：loadNativeDocumentParserBinding（fail-closed 四分面）', () => {
  it('可用面：16 项消费面 + 元信息快照交付（parser-available 夹具）', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('parser-available.js'));
    expect(binding.status).toBe('available');
    if (binding.status === 'available') {
      expect(binding.coreVersion).toBe('0.1.0');
      expect(binding.abiVersion).toBe(NATIVE_DOCUMENT_PARSER_ABI_VERSION);
      for (const name of NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS) {
        expect(typeof (binding.parser as unknown as Record<string, unknown>)[name]).toBe('function');
      }
    }
  });

  it('旧 13 项产物：surface-mismatch 且逐项点名两正式化名（防静默降级，工单034 口径）', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('parser-stale-13.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('documentRevision');
      expect(binding.detail).toContain('documentLayoutConfig');
    }
  });

  it('33 项旧产物（仅缺 documentRevision）：surface-mismatch 且只点名该名（收口闸粒度锁）', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('parser-stale-33.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('documentRevision');
      expect(binding.detail).not.toContain('documentLayoutConfig');
    }
  });

  it('C3 前旧产物（仅缺 documentSerialize）：surface-mismatch 且只点名该名（工单036 波 C3 补登闸粒度锁）', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('parser-stale-35.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('documentSerialize');
      expect(binding.detail).not.toContain('documentLayoutConfig');
    }
  });

  it('ABI 漂移：abi-mismatch 且回显不等', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('parser-abi-drift.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('abi-mismatch');
      expect(binding.detail).toContain('不等');
    }
  });

  it('加载抛错：load-failed（共用 native-bridge 损坏夹具）', () => {
    const binding = loadNativeDocumentParserBinding(fixturePath('broken.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('load-failed');
      expect(binding.detail).toContain('模拟原生产物损坏');
    }
  });

  it('产物不存在：module-missing 且回显路径', () => {
    const binding = loadNativeDocumentParserBinding('/tmp/chips-native-089-不存在.node');
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('module-missing');
      expect(binding.modulePath).toBe('/tmp/chips-native-089-不存在.node');
    }
  });

  it('defaultNativeDocumentParserModulePath 与 Bridge 域同落位口径（上溯两级进 native/）', () => {
    expect(defaultNativeDocumentParserModulePath(join('/app', 'dist', 'renderer'))).toBe(
      resolve('/app', 'native', 'chips-native.node'),
    );
  });
});

/* ------------------------------------------------------------------ *
 * C 组：适配器直连（注入替身模块）
 * ------------------------------------------------------------------ */

describe('刀2适配器 open：严格 kind / 自动识别逐导出映射（§6.4 参数位次锁）', () => {
  it('kind=card → openCard(localPath)（单参，不传 options），随后 documentMetadata + documentRevision', async () => {
    const { fake, port, cardPath } = adapterFixture();
    const outcome = await port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() });
    expect(fake.calls.map((call) => call.fn)).toEqual(['openCard', 'documentMetadata', 'documentRevision']);
    expect(fake.calls[0]?.args).toEqual([cardPath]);
    expect(outcome.documentId).toBe(CARD_ID);
    expect(outcome.kind).toBe('card');
    expect(outcome.title).toBe('测试卡片');
    expect(outcome.metadata).toEqual(cardMetadata());
    expect(outcome.diagnostics).toEqual([{ severity: 'warning', code: 'PARSE_WARNING', message: '基线解析告警' }]);
    expect(outcome.fingerprint.members).toEqual([
      { path: 'meta.yaml', size: 120, modifiedAtMs: 1000, crc32: null },
      { path: 'structure.yaml', size: 200, modifiedAtMs: 1000, crc32: null },
    ]);
  });

  it('kind=box → openBox；kind=null → openDocument（§6.2 自动识别）', async () => {
    const { fake, port, boxPath, cardPath } = adapterFixture();
    const box = await port.open({ localPath: boxPath, kind: 'box', signal: freshSignal() });
    expect(box.kind).toBe('box');
    expect(box.documentId).toBe(BOX_ID);
    expect(box.fingerprint.members[0]?.crc32).toBe(3735928559);
    const auto = await port.open({ localPath: cardPath, kind: null, signal: freshSignal() });
    expect(fake.calls.map((call) => call.fn)).toEqual([
      'openBox',
      'documentMetadata',
      'documentRevision',
      'openDocument',
      'documentMetadata',
      'documentRevision',
    ]);
    expect(auto.kind).toBe('card');
  });

  it('取消预检命中：DOCUMENT_PARSE_CANCELLED（可重试，§8.2）且零原生调用', async () => {
    const { fake, port, cardPath } = adapterFixture();
    const controller = new AbortController();
    controller.abort();
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: controller.signal }));
    expect(error.code).toBe('DOCUMENT_PARSE_CANCELLED');
    expect(error.retryable).toBe(true);
    expect(fake.calls).toEqual([]);
  });

  it('打开途中取消：句柄已取得 → documentClose 回收后以取消码拒绝', async () => {
    const { fake, port, cardPath } = adapterFixture();
    const controller = new AbortController();
    fake.options.hooks.openCard = () => {
      controller.abort();
    };
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: controller.signal }));
    expect(error.code).toBe('DOCUMENT_PARSE_CANCELLED');
    expect(fake.calls.map((call) => call.fn)).toEqual(['openCard', 'documentClose']);
    expect(fake.closeCountOf(cardPath)).toBe(1);
  });

  it('backing 抛 IChipsError 结构对象：唯一类还原、登记码与 details 原样透传（§12.2 + 工单024）', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.failures.documentMetadata = bindingError('DOCUMENT_IO', '读取源失败', {
      details: { path: cardPath },
      retryable: true,
    });
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() }));
    expect(error.code).toBe('DOCUMENT_IO');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ path: cardPath });
    // 泄漏守卫：句柄已取得即回收，且不触达后续导出。
    expect(fake.calls.map((call) => call.fn)).toEqual(['openCard', 'documentMetadata', 'documentClose']);
  });

  it('非 ChipsError 形状的裸异常归一 BRIDGE_INTERNAL（不裸抛、不透传原始消息）', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.failures.openCard = new Error('内部堆栈：/Users/private/path');
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() }));
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(error.message).toBe('平台内部错误');
    expect(error.message).not.toContain('Users');
  });

  it('元数据缺稳定标识：DOCUMENT_METADATA_INVALID 且回收句柄', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.docs.get(cardPath)!.metadata = { name: '无标识卡片' };
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() }));
    expect(error.code).toBe('DOCUMENT_METADATA_INVALID');
    expect(error.retryable).toBe(false);
    expect(fake.calls.map((call) => call.fn)).toEqual([
      'openCard',
      'documentMetadata',
      'documentRevision',
      'documentClose',
    ]);
  });

  it('信封形状违约：BRIDGE_INTERNAL 且 details 点名导出与原因（含句柄回收）', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.overrides.documentMetadata = { kind: 'scroll', value: {}, diagnostics: [] };
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() }));
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(error.details).toEqual({ export: 'documentMetadata', reason: '信封 kind 判别字段非法' });
    expect(fake.closeCountOf(cardPath)).toBe(1);
  });

  it('修订结果成员缺修改时间：绑定违约 BRIDGE_INTERNAL（宿主侧不补字节解析）', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.overrides.documentRevision = {
      source: { kind: 'directory', members: [{ path: 'meta.yaml', size: 1, modifiedMillis: null, crc32: null }] },
      chipStandardsVersion: '1.0.0',
      indexDigest: 'sha256:index',
    };
    const error = await rejectAsChipsError(port.open({ localPath: cardPath, kind: 'card', signal: freshSignal() }));
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect((error.details as Record<string, unknown>).reason).toBe('成员缺少修改时间');
    expect(fake.closeCountOf(cardPath)).toBe(1);
  });
});

describe('刀2适配器 readPart / release / fingerprint：四臂逐导出映射锁', () => {
  async function openedCard(): Promise<{
    fake: IFakeNative;
    port: ReturnType<typeof createNativeDocumentParserPort>;
    handle: IDocumentHandle;
    cardPath: string;
  }> {
    const fixture = adapterFixture();
    const outcome = await fixture.port.open({
      localPath: fixture.cardPath,
      kind: 'card',
      signal: freshSignal(),
    });
    fixture.fake.calls.length = 0;
    return { ...fixture, port: fixture.port, handle: outcome.handle };
  }

  it('metadata / structure → documentMetadata / documentStructure（单参句柄，value/diagnostics 信封直投）', async () => {
    const { fake, port, handle } = await openedCard();
    const metadata = await port.readPart(handle, { part: 'metadata' }, freshSignal());
    expect(metadata.value).toEqual(cardMetadata());
    expect(metadata.diagnostics).toEqual([{ severity: 'warning', code: 'PARSE_WARNING', message: '基线解析告警' }]);
    const structure = await port.readPart(handle, { part: 'structure' }, freshSignal());
    expect(structure.value).toEqual(cardStructure());
    expect(fake.calls.map((call) => call.fn)).toEqual(['documentMetadata', 'documentStructure']);
    expect(fake.calls[0]?.args.length).toBe(1);
  });

  it('content 带 nodeId → documentContent(handle, nodeId)：参数位次逐字对 §6.4', async () => {
    const { fake, port, handle } = await openedCard();
    const outcome = await port.readPart(handle, { part: 'content', nodeId: NODE_ID_ONE }, freshSignal());
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.fn).toBe('documentContent');
    expect(fake.calls[0]?.args[1]).toBe(NODE_ID_ONE);
    expect(outcome.value).toEqual({ node_id: NODE_ID_ONE, card_type: 'text', value: { text: '第一块内容' } });
  });

  it('content 不带 nodeId（箱子布局臂）→ documentLayoutConfig(handle)', async () => {
    const { fake, port, boxPath } = adapterFixture();
    const box = await port.open({ localPath: boxPath, kind: 'box', signal: freshSignal() });
    fake.calls.length = 0;
    const layout = await port.readPart(box.handle, { part: 'content' }, freshSignal());
    expect(fake.calls.map((call) => call.fn)).toEqual(['documentLayoutConfig']);
    expect(layout.value).toEqual({ active_layout_type: 'grid', columns: 3 });
  });

  it('卡片句柄布局臂误用：原生契约码 DOCUMENT_FORMAT_UNKNOWN 原样还原', async () => {
    const { port, handle } = await openedCard();
    const error = await rejectAsChipsError(port.readPart(handle, { part: 'content' }, freshSignal()));
    expect(error.code).toBe('DOCUMENT_FORMAT_UNKNOWN');
    expect(error.retryable).toBe(false);
  });

  it('entries → documentEntries：range 逐字转发 {offset, limit}；缺省时单参调用', async () => {
    const { fake, port, boxPath } = adapterFixture();
    const box = await port.open({ localPath: boxPath, kind: 'box', signal: freshSignal() });
    fake.calls.length = 0;
    const paged = await port.readPart(box.handle, { part: 'entries', range: { offset: 1, limit: 1 } }, freshSignal());
    expect(paged.value).toEqual(boxDocument().entries.slice(1, 2));
    const all = await port.readPart(box.handle, { part: 'entries' }, freshSignal());
    expect(all.value).toEqual(boxDocument().entries);
    expect(fake.calls[0]?.fn).toBe('documentEntries');
    expect((fake.calls[0]?.args[1] as Record<string, unknown>)?.offset).toBe(1);
    expect(fake.calls[1]?.args.length).toBe(1);
  });

  it('伪造句柄 readPart → DOCUMENT_NOT_FOUND 且零原生调用；释放后同臂亦 DOCUMENT_NOT_FOUND', async () => {
    const { fake, port, handle } = await openedCard();
    const forged: IDocumentHandle = { documentHandleBrand: 'chips-parser' };
    const error = await rejectAsChipsError(port.readPart(forged, { part: 'structure' }, freshSignal()));
    expect(error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(fake.calls).toEqual([]);
    await port.release(handle);
    const stale = await rejectAsChipsError(port.readPart(handle, { part: 'structure' }, freshSignal()));
    expect(stale.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('release → documentClose 一次；重复释放为 no-op（幂等契约）', async () => {
    const { fake, port, handle, cardPath } = await openedCard();
    await port.release(handle);
    await port.release(handle);
    expect(fake.closeCountOf(cardPath)).toBe(1);
    expect(fake.calls.filter((call) => call.fn === 'documentClose')).toHaveLength(1);
  });

  it('release 失败保持可重试：documentClose 抛错标志不置位，再次释放重新触达原生', async () => {
    const { fake, port, handle, cardPath } = await openedCard();
    fake.options.failures.documentClose = bindingError('DOCUMENT_IO', '关闭失败');
    const error = await rejectAsChipsError(port.release(handle));
    expect(error.code).toBe('DOCUMENT_IO');
    delete fake.options.failures.documentClose;
    await port.release(handle);
    expect(fake.closeCountOf(cardPath)).toBe(1);
  });

  it('release 伪造句柄 → DOCUMENT_NOT_FOUND', async () => {
    const { port } = adapterFixture();
    const forged: IDocumentHandle = { documentHandleBrand: 'chips-parser' };
    const error = await rejectAsChipsError(port.release(forged));
    expect(error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('fingerprint 复合臂：openDocument + documentRevision + documentClose，成员逐字段映射', async () => {
    const { fake, port, boxPath } = adapterFixture();
    const fingerprint = await port.fingerprint(boxPath);
    expect(fake.calls.map((call) => call.fn)).toEqual(['openDocument', 'documentRevision', 'documentClose']);
    expect(fingerprint.members).toEqual([
      { path: 'meta.yaml', size: 128, modifiedAtMs: 2000, crc32: 3735928559 },
      { path: 'structure.yaml', size: 256, modifiedAtMs: 2000, crc32: 2596069104 },
    ]);
  });

  it('fingerprint 源不存在：DOCUMENT_NOT_FOUND 原样透传且无句柄可回收（不上抛裸错误）', async () => {
    const { fake, port } = adapterFixture();
    const error = await rejectAsChipsError(port.fingerprint('/fake/none.card'));
    expect(error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(fake.calls.map((call) => call.fn)).toEqual(['openDocument']);
  });

  it('fingerprint 取数失败仍回收句柄；关闭自身失败静默', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.failures.documentRevision = bindingError('DOCUMENT_IO', '修订取数失败');
    const error = await rejectAsChipsError(port.fingerprint(cardPath));
    expect(error.code).toBe('DOCUMENT_IO');
    expect(fake.calls.map((call) => call.fn)).toEqual(['openDocument', 'documentRevision', 'documentClose']);
    // 关闭自身失败场景：fingerprint 成功返回（GC 终结器兜底口径）。
    const clean = adapterFixture();
    clean.fake.options.failures.documentClose = bindingError('DOCUMENT_IO', '关闭失败');
    await expect(clean.port.fingerprint(clean.cardPath)).resolves.toHaveProperty('members');
  });
});

describe('刀2适配器 serialize：工单036 波 C3 真接（documentSerialize 载体）', () => {
  const baseRequest = (
    cardPath: string,
  ): {
    kind: 'card';
    form: 'directory';
    localPath: string;
    metadata: Record<string, unknown>;
    structure: Record<string, unknown>;
    contents: { nodeId: string; value: { text: string } }[];
    layoutConfig: null;
    changedParts: readonly ['metadata', 'content'];
    removedNodeIds: never[];
  } => ({
    kind: 'card' as const,
    form: 'directory' as const,
    localPath: cardPath,
    metadata: cardMetadata(),
    structure: cardStructure(),
    contents: [{ nodeId: NODE_ID_ONE, value: { text: '序列化改写' } }],
    layoutConfig: null,
    changedParts: ['metadata', 'content'] as const,
    removedNodeIds: [],
  });

  it('端口请求逐字段映射 + 保存时刻单源交付；成员按包内路径升序、字节原样透传', async () => {
    const { fake, port, cardPath } = adapterFixture();
    const before = Date.now();
    const members = await port.serialize(baseRequest(cardPath), freshSignal());
    const after = Date.now();
    const call = fake.calls.find((entry) => entry.fn === 'documentSerialize');
    expect(call).toBeDefined();
    const [nativeRequest, savedAtUnixMs] = call?.args as [Record<string, unknown>, number];
    expect(nativeRequest).toEqual(baseRequest(cardPath));
    // 保存时刻由适配器单源交付（Date.now() 形，取调用窗口内的非负整数毫秒）。
    expect(savedAtUnixMs).toBeGreaterThanOrEqual(before);
    expect(savedAtUnixMs).toBeLessThanOrEqual(after);
    expect(Number.isInteger(savedAtUnixMs)).toBe(true);
    // 成员面：变更集两成员（metadata + content）按路径升序，字节即 JSON 编码。
    expect(members.map((member) => member.packagePath)).toEqual(['content/Cd1eFg2Hi3.yaml', 'meta.yaml']);
    expect(JSON.parse(new TextDecoder().decode(members[0]?.bytes ?? new Uint8Array()))).toEqual({
      text: '序列化改写',
    });
    expect(JSON.parse(new TextDecoder().decode(members[1]?.bytes ?? new Uint8Array()))).toMatchObject({
      card_id: CARD_ID,
    });
  });

  it('backing 契约码原样透传（失败注入臂）', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.failures.documentSerialize = bindingError('DOCUMENT_METADATA_INVALID', '元数据非法');
    const error = await rejectAsChipsError(port.serialize(baseRequest(cardPath), freshSignal()));
    expect(error.code).toBe('DOCUMENT_METADATA_INVALID');
  });

  it('结果形状违约归一 BRIDGE_INTERNAL（成员缺字节位 / 非数组两臂），不自造解析域码', async () => {
    const { fake, port, cardPath } = adapterFixture();
    fake.options.overrides.documentSerialize = { nope: true };
    const error = await rejectAsChipsError(port.serialize(baseRequest(cardPath), freshSignal()));
    expect(error.code).toBe('BRIDGE_INTERNAL');

    const other = adapterFixture();
    other.fake.options.overrides.documentSerialize = [{ packagePath: 'meta.yaml' }];
    const shapeError = await rejectAsChipsError(other.port.serialize(baseRequest(other.cardPath), freshSignal()));
    expect(shapeError.code).toBe('BRIDGE_INTERNAL');
  });

  it('取消预检：signal 已中止即 DOCUMENT_PARSE_CANCELLED，零原生调用', async () => {
    const { fake, port, cardPath } = adapterFixture();
    const controller = new AbortController();
    controller.abort();
    const error = await rejectAsChipsError(port.serialize(baseRequest(cardPath), controller.signal));
    expect(error.code).toBe('DOCUMENT_PARSE_CANCELLED');
    expect(error.retryable).toBe(true);
    expect(fake.calls).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * D 组：真实服务链路（service.ts 全链 + 适配器 + 其余端口替身）
 * ------------------------------------------------------------------ */

describe('刀2真实链路：document:* 服务经适配器跑通', () => {
  function serviceFixture(): {
    fake: IFakeNative;
    harness: ReturnType<typeof createHarness>;
    service: ReturnType<typeof createDocumentService>;
  } {
    const harness = createHarness();
    const fake = createFakeNative(
      new Map([
        [harness.cardPath, cardDocument()],
        [harness.boxPath, boxDocument()],
      ]),
    );
    const service = createDocumentService({
      ...harness.dependencies,
      parser: createNativeDocumentParserPort(fake.module),
    });
    return { fake, harness, service };
  }

  it('executeOpen 全链：逐导出映射 + 输出 digest 等于映射指纹的规范摘要', async () => {
    const { fake, harness, service } = serviceFixture();
    const output = await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    expect(fake.calls.map((call) => call.fn)).toEqual(['openCard', 'documentMetadata', 'documentRevision']);
    expect(fake.calls[0]?.args).toEqual([harness.cardPath]);
    expect(output.documentId).toBe(CARD_ID);
    expect(output.kind).toBe('card');
    expect(output.title).toBe('测试卡片');
    expect(output.digest).toBe(
      computeQuickFingerprintDigest({
        members: cardDocument().members.map((member) => ({
          path: member.path,
          size: member.size,
          modifiedAtMs: member.modifiedMillis ?? 0,
          crc32: member.crc32,
        })),
      }),
    );
  });

  it('executeRead：structure / content(nodeId) 经端口映射，box content 走 documentLayoutConfig 布局臂', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const structure = await service.executeRead({ documentId: CARD_ID, part: 'structure' }, ctxFor(SESSION_A));
    expect(structure.value).toEqual(cardStructure());
    const content = await service.executeRead(
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE },
      ctxFor(SESSION_A),
    );
    expect(content.value).toEqual({ node_id: NODE_ID_ONE, card_type: 'text', value: { text: '第一块内容' } });

    await service.executeOpen({ source: harness.boxUri }, ctxFor(SESSION_A));
    // 服务口径：entries 读取由 structure 切片派生（§4.3），不触达 documentEntries 导出；
    // documentEntries 的逐字映射由 C 组适配器直连用例锁定。
    const entries = await service.executeRead(
      { documentId: BOX_ID, part: 'entries', range: { offset: 0, limit: 1 } },
      ctxFor(SESSION_A),
    );
    expect(entries.value).toEqual(boxDocument().entries.slice(0, 1));
    expect(fake.calls.some((call) => call.fn === 'documentEntries')).toBe(false);
    const layout = await service.executeRead({ documentId: BOX_ID, part: 'content' }, ctxFor(SESSION_A));
    expect(layout.value).toEqual({ active_layout_type: 'grid', columns: 3 });
    const layoutCall = fake.calls.find((call) => call.fn === 'documentLayoutConfig');
    expect(layoutCall).toBeDefined();
  });

  it('executeWrite 走 fingerprint 复合臂复查基线：未外部修改时写入成功', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    fake.calls.length = 0;
    const output = await service.executeWrite(
      { documentId: CARD_ID, part: 'metadata', value: cardMetadata('改名卡片') },
      ctxFor(SESSION_A),
    );
    expect(output.revision).toBe(1);
    expect(fake.calls.map((call) => call.fn)).toEqual(['openDocument', 'documentRevision', 'documentClose']);
  });

  it('外部修改后 executeWrite：DOCUMENT_SOURCE_CHANGED（基线复查经 documentRevision 取数）', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    // 外部修改：替身盘成员修改时间整体前进（等价 harness.mutateExternally 对内存盘的镜像）。
    for (const doc of fake.docs.values()) {
      for (const member of doc.members) {
        member.modifiedMillis = (member.modifiedMillis ?? 0) + 1;
      }
    }
    const error = await service
      .executeWrite({ documentId: CARD_ID, part: 'metadata', value: cardMetadata('改名') }, ctxFor(SESSION_A))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    expect((error as DocumentCapabilityError).code).toBe('DOCUMENT_SOURCE_CHANGED');
  });

  it('脏写后 executeSave：serialize 真经 documentSerialize → storage.commit 落盘（工单036 波 C3 终闸）', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    await service.executeWrite(
      { documentId: CARD_ID, part: 'metadata', value: cardMetadata('待保存') },
      ctxFor(SESSION_A),
    );
    const output = await service.executeSave({ documentId: CARD_ID }, ctxFor(SESSION_A));
    // 序列化臂触达 + 受控提交唯一落盘通道（commit 回执逐成员在账）。
    expect(fake.calls.some((call) => call.fn === 'documentSerialize')).toBe(true);
    expect(harness.commits).toHaveLength(1);
    const commit = harness.commits[0];
    expect(commit?.form).toBe('directory');
    expect(commit?.members.some((member) => member.packagePath === 'meta.yaml')).toBe(true);
    // 保存回执：source 即受管引用，digest 即落盘后磁盘视图的规范摘要（harness 复算同源）。
    expect(output.source).toBe(harness.cardUri);
    expect(output.digest).toMatch(/^sha256:/);
    // 落盘结果可经 harness 磁盘视图回读（真实副作用，非返回值自证）。
    expect(harness.readMember(harness.cardUri, 'meta.yaml')).toContain('待保存');
  });

  it('无变更 executeSave：no-op 直接返回磁盘摘要，serialize 臂不被触达', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const before = fake.calls.length;
    const output = await service.executeSave({ documentId: CARD_ID }, ctxFor(SESSION_A));
    expect(output.source).toBe(harness.cardUri);
    expect(output.digest).toMatch(/^sha256:/);
    // 除打开链路外无新增调用（no-op 不写不序列化）。
    expect(fake.calls.length).toBe(before);
  });

  it('releaseSessions：会话释放联动句柄回收（documentClose 逐记录触达）', async () => {
    const { fake, harness, service } = serviceFixture();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    await service.releaseSessions(SESSION_A);
    expect(fake.closeCountOf(harness.cardPath)).toBe(1);
    expect(service.activeRecordCount()).toBe(0);
  });
});
