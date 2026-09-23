import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * `chips-native.node` 解析域导出面的运行时装载闸（工单056 · 形 A）。
 *
 * 纪律与宿主侧 `loadNativeResourceBinding` / `loadNativeBridgeBinding` 同构
 * （fail-closed、不降级、不造假）：
 * - 产物落位唯一权威：`packages/host/native/chips-native.node`
 *  （`@chips/native` `copy-native.mjs` 的在册落位，本包只读消费，禁重建禁改写）；
 * - 判定顺序：文件存在 → require 成功且导出为对象 → 解析域 13 导出全部在位且为
 *   函数（逐项点名）→ `coreVersion()` 非空字符串 → `coreAbiVersion()` 等于在册 ABI；
 *   任一步失败即抛错，绝不交付半成品消费面；
 * - 本模块零静态绑定原生产物：只有真测执行路径显式调用装载器时才触达磁盘。
 */

/** 解析域 13 导出（《核心接口规范》§6.4、§6.6；名取 `abi/export-surface.json` 在册名逐字）。 */
export const NATIVE_PARSER_REQUIRED_EXPORTS = [
  'openDocument',
  'openCard',
  'openBox',
  'documentMetadata',
  'documentStructure',
  'documentContent',
  'documentEntries',
  'documentLayoutConfig',
  'documentRevision',
  'documentReadResource',
  'documentValidate',
  'buildDocumentView',
  'documentClose',
] as const;

/** 在册 ABI 主版本（`CORE_ABI_VERSION = 1`；不一致即旧产物/新契约漂移，fail-closed）。 */
export const CORE_ABI_VERSION_PIN = 1;

/** 不透明文档句柄（与 `chips-native.d.ts` `DocumentHandle` 同族：内部结构不暴露）。 */
export interface NativeDocumentHandle {
  readonly __chipsNativeDocument: 'chips-native.document';
}

/** 解析诊断（《06-文档解析器设计》§8.4 / §12.3 投影）。 */
export interface NativeDiagnosticShape {
  readonly severity: string;
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly pointer?: string;
  readonly line?: number;
  readonly column?: number;
}

/** `{ kind, value, diagnostics }` 三件套访问器回包（L0/L1/L2 共用形状）。 */
export interface NativeDocumentValueResult {
  readonly kind: string;
  readonly value: Record<string, unknown>;
  readonly diagnostics: NativeDiagnosticShape[];
}

/** `documentContent` 回包（《06》§11.3 `ContentNode` 投影）。 */
export interface NativeDocumentContentResult {
  readonly kind: string;
  readonly value: {
    readonly node_id: string;
    readonly file: string;
    readonly card_type: string;
    readonly value: Record<string, unknown>;
    readonly diagnostics: NativeDiagnosticShape[];
  };
  readonly diagnostics: NativeDiagnosticShape[];
}

/** `documentValidate` 回包（《06》§6.5 `ValidationReport` 投影）。 */
export interface NativeValidationReportShape {
  readonly kind: string;
  readonly chip_standards_version: string;
  readonly status: string;
  readonly statistics: {
    readonly member_count: number;
    readonly yaml_bytes: number;
    readonly resource_count: number;
    readonly entry_count: number;
    readonly uncompressed_bytes: number;
  };
  readonly diagnostics: NativeDiagnosticShape[];
}

/** 本包消费的解析域类型化切片。 */
export interface NativeParserSurface {
  readonly coreVersion: () => string;
  readonly coreAbiVersion: () => number;
  readonly openCard: (filePath: string) => Promise<NativeDocumentHandle>;
  readonly openBox: (filePath: string) => Promise<NativeDocumentHandle>;
  readonly documentMetadata: (handle: NativeDocumentHandle) => Promise<NativeDocumentValueResult>;
  readonly documentStructure: (handle: NativeDocumentHandle) => Promise<NativeDocumentValueResult>;
  readonly documentContent: (
    handle: NativeDocumentHandle,
    nodeId: string
  ) => Promise<NativeDocumentContentResult>;
  readonly documentLayoutConfig: (
    handle: NativeDocumentHandle
  ) => Promise<NativeDocumentValueResult>;
  readonly documentValidate: (handle: NativeDocumentHandle) => Promise<NativeValidationReportShape>;
  readonly documentClose: (handle: NativeDocumentHandle) => Promise<void>;
}

/**
 * 生产产物默认路径：`<chips-ecosystem>/packages/host/native/chips-native.node`。
 * 相对本模块文件定位（`tests/perf/src/real` 上溯四级即生态仓库根），与宿主在册落位逐字一致。
 */
export function defaultNativeModulePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(
    moduleDir,
    '..',
    '..',
    '..',
    '..',
    'packages',
    'host',
    'native',
    'chips-native.node'
  );
}

/** 装载并校验解析域消费面；任一步失败即抛错（fail-closed，无降级替身）。 */
export function loadNativeParserSurface(
  modulePath: string = defaultNativeModulePath()
): NativeParserSurface {
  if (!existsSync(modulePath)) {
    throw new Error(
      `原生绑定产物不存在：${modulePath}（解析域真测 fail-closed；本单红线禁重建 .node，缺位即交回）。`
    );
  }
  const requireCjs = createRequire(pathToFileURL(modulePath).href);
  const loaded: unknown = requireCjs(modulePath);
  if (typeof loaded !== 'object' || loaded === null) {
    throw new Error(`原生绑定模块导出不是对象：${modulePath}（解析域真测 fail-closed）。`);
  }
  const moduleValue = loaded as Record<string, unknown>;
  const missing = NATIVE_PARSER_REQUIRED_EXPORTS.filter(
    (name) => typeof moduleValue[name] !== 'function'
  );
  if (missing.length > 0) {
    throw new Error(
      `原生绑定解析域必备导出缺位或非函数：${missing.join('、')}（疑似旧构建产物；解析域真测 fail-closed）。`
    );
  }
  const coreVersion = moduleValue['coreVersion'];
  const coreAbiVersion = moduleValue['coreAbiVersion'];
  if (typeof coreVersion !== 'function' || typeof coreAbiVersion !== 'function') {
    throw new Error(
      '原生绑定元信息导出 coreVersion/coreAbiVersion 缺位（解析域真测 fail-closed）。'
    );
  }
  const version: unknown = (coreVersion as () => unknown)();
  const abi: unknown = (coreAbiVersion as () => unknown)();
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(
      `coreVersion() 未返回非空字符串：${String(version)}（解析域真测 fail-closed）。`
    );
  }
  if (abi !== CORE_ABI_VERSION_PIN) {
    throw new Error(
      `coreAbiVersion() 期望 ${String(CORE_ABI_VERSION_PIN)}，实际 ${String(abi)}（ABI 漂移，解析域真测 fail-closed）。`
    );
  }
  return moduleValue as unknown as NativeParserSurface;
}

/** 错误级诊断闸：回包 diagnostics 出现 `severity === 'error'` 即抛错（点名首个码与消息）。 */
export function assertNoErrorDiagnostics(
  label: string,
  diagnostics: readonly NativeDiagnosticShape[] | undefined
): void {
  const error = (diagnostics ?? []).find((entry) => entry.severity === 'error');
  if (error !== undefined) {
    throw new Error(
      `${label} 携带错误级诊断：${error.code}（${error.message}），解析域真测 fail-closed。`
    );
  }
}
