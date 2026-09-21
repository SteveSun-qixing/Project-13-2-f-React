/**
 * `IDocumentParserPort` 的首个生产适配器：chips-parser 经 Neon 绑定（chips-native）承载
 * （《核心接口规范》§6.4、《06-文档解析器设计》§12.1/§12.2、工单034；W2 金链路刀2）。
 *
 * 权威：
 * - 端口签名与语义：`../ports.ts` `IDocumentParserPort`（失败以已登记 `DOCUMENT_*` 码抛出）；
 * - 注入面与装载闸：`./native-parser-module.ts`（13 项 §6.4 冻结名 + 工单034 两项正式化名，fail-closed）；
 * - 错误还原：§12.2「JS `Error` 携带 `code` / `message` / `details` / `retryable`，与
 *   `ChipsError` 结构一致」——backing 抛出的同构错误经 `@chips/bridge` `normalizeError`
 *   单点还原为唯一类 `ChipsError`（工单024 口径；`preload/bridge.ts` 直连先例），
 *   解析域登记码（06.08 §8.2）经服务侧 `asDocumentCapabilityError` 原样透传；
 *   非该形状的异常归一为 `BRIDGE_INTERNAL`，不裸抛、不自造码。
 *
 * @remarks
 * - 端口臂 → 导出映射（正向逐调用可断言）：
 *   - `open`：`kind==='card'` → `openCard(localPath)`；`'box'` → `openBox(localPath)`；
 *     `null` → `openDocument(localPath)`（§6.2 自动识别）；随后 `documentMetadata(handle)` +
 *     `documentRevision(handle)`（工单034 正式化名）组装 L0 信封；
 *   - `readPart`：`metadata` → `documentMetadata`；`structure` → `documentStructure`；
 *     `content` 带 `nodeId` → `documentContent(handle, nodeId)`；`content` 不带 `nodeId`
 *     （箱子布局，`service.ts` `ensureLayoutConfig`）→ `documentLayoutConfig`（工单034 正式化名）；
 *     `entries` → `documentEntries(handle, range)`（range 逐字转发 `{offset, limit}`）；
 *   - `fingerprint`：`openDocument` + `documentRevision` + `documentClose`（finally，泄漏守卫）；
 *   - `release`：`documentClose`（幂等注册表，见下）。
 * - 句柄生命周期：宿主侧以 `WeakMap` 登记「端口句柄 → 原生句柄 + 已关闭标志」；
 *   未登记句柄（伪造/串用）一律 `DOCUMENT_NOT_FOUND`；释放成功后标志置位，重复释放为
 *   no-op（端口幂等契约）；`documentClose` 抛错时标志保持可重试（原生侧 GC 终结器兜底，§12.2）。
 * - 取消：Neon 导出面没有 token 传参位（工单034 第三项，主智能体裁决③：经文档路在
 *   §6.4 注记「Neon 侧取消仅经宿主 signal 预检、在途取消暂不可达」），适配器只做阶段边界
 *   `signal.aborted` 预检，命中以登记码 `DOCUMENT_PARSE_CANCELLED`（§8.2，可重试）拒绝；
 *   在途调用的原生侧取消不可达，不伪造该能力。
 * - 泄漏守卫：`open` 内取得原生句柄后的任何失败（含预检命中、信封形状违约与
 *   `documentRevision` 失败）都以 `documentClose` 回收原生句柄后再上抛原始错误
 *   （关闭自身失败静默，GC 终结器兜底，§12.2）。
 * - `serialize`：主智能体「金链路集成七刀定案」刀6 裁定落盘序列化权威归 W3
 *   chips-resource 波（解析器导出面无序列化项），本臂按诚实失败交付：
 *   以在册码 `BRIDGE_CAPABILITY_NOT_FOUND`（「能力不存在或已注销」，`@chips/bridge`
 *   错误码表；壳侧先例 `runtime/self-check-runtime.ts` 以同码呈现「能力未注册」）拒绝，
 *   `details` 携带端口臂与裁决出处；服务侧按既有链路包装为
 *   `DOCUMENT_SAVE_FAILED`（`details.cause = BRIDGE_CAPABILITY_NOT_FOUND`）。不产生任何原生调用。
 * - 生产接线（组合根注入、与资源端口同生命周期）为刀4 范围；工单034 ①②两正式化名
 *   已落 `packages/native`（第 33/34 项导出），装载闸按 15 名消费面交付类型化注入面
 *   （旧表产物在装载点即判 `surface-mismatch`，属预期 fail-closed）。
 */

import { BRIDGE_ERROR_CODES, ChipsError, createBridgeError, normalizeError } from '@chips/bridge';

import type { DocumentKind, DocumentValue } from '../contract.js';
import type { ISourceFingerprint } from '../digest.js';
import type {
  IDocumentHandle,
  IDocumentParseOutcome,
  IDocumentPartOutcome,
  IDocumentPartRequest,
  IDocumentParserPort,
  IDocumentSerializedMember,
} from '../ports.js';
import type {
  INativeDocumentEnvelope,
  INativeDocumentHandle,
  INativeDocumentParserModule,
  INativeDocumentRevision,
  INativeDiagnostic,
} from './native-parser-module.js';
import type { INativeDocumentViewModule } from '../../../renderer/document-view-builder.js';

/** 解析域登记码（《06-文档解析器设计》§8.2；端口头注口径「失败以已登记 `DOCUMENT_*` 码抛出」）。 */
const PARSER_CODE = {
  notFound: 'DOCUMENT_NOT_FOUND',
  metadataInvalid: 'DOCUMENT_METADATA_INVALID',
  parseCancelled: 'DOCUMENT_PARSE_CANCELLED',
} as const;

/** §8.2 登记口径：`DOCUMENT_PARSE_CANCELLED` 可重试，其余两码不可重试。 */
const PARSER_CODE_RETRYABLE: Readonly<Record<(typeof PARSER_CODE)[keyof typeof PARSER_CODE], boolean>> = {
  DOCUMENT_NOT_FOUND: false,
  DOCUMENT_METADATA_INVALID: false,
  DOCUMENT_PARSE_CANCELLED: true,
};

function parserError(
  code: (typeof PARSER_CODE)[keyof typeof PARSER_CODE],
  message: string,
  details?: Record<string, unknown>,
): ChipsError {
  return new ChipsError({
    code,
    message,
    retryable: PARSER_CODE_RETRYABLE[code],
    ...(details === undefined ? {} : { details }),
  });
}

/** 内部簿记：端口句柄 → 原生句柄与释放标志（`release` 幂等与失效句柄拒绝的依据）。 */
interface IHandleRecord {
  readonly native: INativeDocumentHandle;
  closed: boolean;
}

/** 原生调用的错误还原单点（§12.2 + 工单024）：同构形状原样还原为唯一类，其余归一 `BRIDGE_INTERNAL`。 */
async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    throw normalizeError(error);
  }
}

/** 绑定层契约违约（信封/字段形状非法）：归一 `BRIDGE_INTERNAL`，不改写解析域码表、不自造码。 */
function shapeViolation(exportName: string, reason: string): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '解析绑定返回的数据形状不符合契约',
    details: { export: exportName, reason },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDiagnostic(value: unknown): value is INativeDiagnostic {
  if (!isRecord(value)) {
    return false;
  }
  return (
    (value.severity === 'error' || value.severity === 'warning' || value.severity === 'info') &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

/**
 * 结果信封守卫（§12.1 `{ kind, value, diagnostics }` 统一形状）：判别字段、`value` 形态
 * （对象或按导出要求的对象数组）、诊断数组逐项校验；非法形状以 `BRIDGE_INTERNAL` 拒绝。
 */
function checkEnvelope(
  exportName: string,
  envelope: unknown,
  valueShape: 'record' | 'array',
): INativeDocumentEnvelope<DocumentValue> {
  if (!isRecord(envelope)) {
    throw shapeViolation(exportName, '结果信封不是对象');
  }
  const { kind, value, diagnostics } = envelope;
  if (kind !== 'card' && kind !== 'box') {
    throw shapeViolation(exportName, '信封 kind 判别字段非法');
  }
  const valueOk = valueShape === 'record' ? isRecord(value) : Array.isArray(value) && value.every(isRecord);
  if (!valueOk) {
    throw shapeViolation(exportName, '信封 value 形态与格式不符');
  }
  if (!Array.isArray(diagnostics) || !diagnostics.every(isDiagnostic)) {
    throw shapeViolation(exportName, '信封 diagnostics 不是诊断数组');
  }
  return {
    kind,
    value: value as DocumentValue,
    diagnostics,
  };
}

/** 源指纹映射（工单034 冻结形状 → `digest.ts` `ISourceFingerprint`；宿主侧不做字节解析）。 */
function mapRevision(exportName: string, revision: INativeDocumentRevision): ISourceFingerprint {
  if (!isRecord(revision) || !isRecord(revision.source) || !Array.isArray(revision.source.members)) {
    throw shapeViolation(exportName, '修订结果缺少成员指纹集合');
  }
  if (revision.source.kind !== 'directory' && revision.source.kind !== 'archive') {
    throw shapeViolation(exportName, '修订结果的源形态非法');
  }
  const members = revision.source.members.map((member) => {
    if (
      !isRecord(member) ||
      typeof member.path !== 'string' ||
      typeof member.size !== 'number' ||
      !Number.isInteger(member.size) ||
      member.size < 0 ||
      !(
        member.modifiedMillis === null ||
        (typeof member.modifiedMillis === 'number' && Number.isInteger(member.modifiedMillis))
      ) ||
      !(member.crc32 === null || (typeof member.crc32 === 'number' && Number.isInteger(member.crc32)))
    ) {
      throw shapeViolation(exportName, '成员指纹形状非法');
    }
    if (member.modifiedMillis === null) {
      // 端口口径 `modifiedAtMs: number`（§5.4 两形态均含修改时间）；缺源字段属绑定违约。
      throw shapeViolation(exportName, '成员缺少修改时间');
    }
    return {
      path: member.path,
      size: member.size,
      modifiedAtMs: member.modifiedMillis,
      crc32: member.crc32,
    };
  });
  return { members };
}

/** 取消预检（阶段边界；在途原生取消不可达，工单034 第三项）。 */
function ensureNotAborted(signal: AbortSignal, stage: string): void {
  if (signal.aborted) {
    throw parserError(PARSER_CODE.parseCancelled, '文档解析已取消', { stage });
  }
}

/**
 * 端口适配器交付面：`IDocumentParserPort` + 视图构建域 `view` 臂。
 *
 * @remarks `view` 臂（工单035 裁定二 / RFC O3 的句柄侧归一点）：入参为服务侧句柄
 * token（会话存储记录持有的 `IDocumentHandle`，即本适配器 `registerHandle` 交付的
 * 投影对象），臂内经私有 WeakMap 还原为真实原生句柄逐字交 `buildDocumentView` /
 * `documentReadResource`——`JsBox` 投影与数值会话同样不出主进程。消费面见
 * `view-channel.ts`（宿主内部取视图通道主进程侧）。
 */
export interface INativeDocumentParserPortAdapter extends IDocumentParserPort {
  readonly view: INativeDocumentViewModule;
}

/**
 * 构造 `IDocumentParserPort` 的 chips-native 生产适配器。
 *
 * @param module 解析域注入面（生产由 `loadNativeDocumentParserBinding` 交付；
 *   测试注入替面对象）。适配器本身不做装载判定，装载闸四分面由调用方（刀4 组合根）执行。
 */
export function createNativeDocumentParserPort(module: INativeDocumentParserModule): INativeDocumentParserPortAdapter {
  const handles = new WeakMap<IDocumentHandle, IHandleRecord>();

  /** 静默回收原生句柄（泄漏守卫与 `fingerprint` 复合臂共用；关闭失败由 GC 终结器兜底，§12.2）。 */
  async function closeQuietly(native: INativeDocumentHandle): Promise<void> {
    try {
      await module.documentClose(native);
    } catch {
      // 静默：调用方各自保有原始错误；原生侧未关闭句柄由 GC 终结器释放。
    }
  }

  function registerHandle(native: INativeDocumentHandle): IDocumentHandle {
    const handle: IDocumentHandle = { documentHandleBrand: 'chips-parser' };
    handles.set(handle, { native, closed: false });
    return handle;
  }

  /** 取仍有效的登记句柄；未登记（伪造）或已释放一律 `DOCUMENT_NOT_FOUND`。 */
  function requireLive(handle: IDocumentHandle, operation: string): IHandleRecord {
    const record = handles.get(handle);
    if (record === undefined || record.closed) {
      throw parserError(PARSER_CODE.notFound, '解析句柄不存在或已释放', { operation });
    }
    return record;
  }

  /** 按切片分发原生导出并过信封守卫。 */
  async function dispatchPart(
    record: IHandleRecord,
    request: IDocumentPartRequest,
  ): Promise<INativeDocumentEnvelope<DocumentValue>> {
    switch (request.part) {
      case 'metadata':
        return checkEnvelope('documentMetadata', await attempt(() => module.documentMetadata(record.native)), 'record');
      case 'structure':
        return checkEnvelope(
          'documentStructure',
          await attempt(() => module.documentStructure(record.native)),
          'record',
        );
      case 'content': {
        const nodeId = request.nodeId;
        if (nodeId === undefined) {
          // 箱子布局臂（`service.ts` `ensureLayoutConfig`）：工单034 正式化名 `documentLayoutConfig`。
          return checkEnvelope(
            'documentLayoutConfig',
            await attempt(() => module.documentLayoutConfig(record.native)),
            'record',
          );
        }
        return checkEnvelope(
          'documentContent',
          await attempt(() => module.documentContent(record.native, nodeId)),
          'record',
        );
      }
      case 'entries': {
        const envelope =
          request.range === undefined
            ? await attempt(() => module.documentEntries(record.native))
            : await attempt(() => module.documentEntries(record.native, request.range));
        return checkEnvelope('documentEntries', envelope, 'array');
      }
    }
  }

  async function open(input: {
    localPath: string;
    kind: DocumentKind | null;
    signal: AbortSignal;
  }): Promise<IDocumentParseOutcome> {
    ensureNotAborted(input.signal, 'open');
    const native =
      input.kind === 'card'
        ? await attempt(() => module.openCard(input.localPath))
        : input.kind === 'box'
          ? await attempt(() => module.openBox(input.localPath))
          : await attempt(() => module.openDocument(input.localPath));
    let metadataEnvelope: INativeDocumentEnvelope<DocumentValue>;
    let fingerprint: ISourceFingerprint;
    try {
      ensureNotAborted(input.signal, 'open/metadata');
      metadataEnvelope = checkEnvelope(
        'documentMetadata',
        await attempt(() => module.documentMetadata(native)),
        'record',
      );
      ensureNotAborted(input.signal, 'open/revision');
      fingerprint = mapRevision('documentRevision', await attempt(() => module.documentRevision(native)));
    } catch (error: unknown) {
      // 句柄已取得：任何后续失败都回收原生句柄再上抛（不留悬置 JsBox）。
      await closeQuietly(native);
      throw error;
    }
    const metadata = metadataEnvelope.value as Record<string, unknown>;
    const idField = metadataEnvelope.kind === 'card' ? 'card_id' : 'box_id';
    const documentId = metadata[idField];
    if (typeof documentId !== 'string' || documentId.length === 0) {
      await closeQuietly(native);
      throw parserError(PARSER_CODE.metadataInvalid, `元数据缺少 ${idField}`, {
        export: 'documentMetadata',
        kind: metadataEnvelope.kind,
      });
    }
    const title = metadata['name'];
    if (typeof title !== 'string') {
      await closeQuietly(native);
      throw parserError(PARSER_CODE.metadataInvalid, '元数据缺少 name', {
        export: 'documentMetadata',
        kind: metadataEnvelope.kind,
      });
    }
    return {
      handle: registerHandle(native),
      documentId,
      kind: metadataEnvelope.kind,
      title,
      metadata,
      fingerprint,
      diagnostics: metadataEnvelope.diagnostics,
    };
  }

  async function readPart(
    handle: IDocumentHandle,
    request: IDocumentPartRequest,
    signal: AbortSignal,
  ): Promise<IDocumentPartOutcome> {
    const record = requireLive(handle, 'readPart');
    ensureNotAborted(signal, `readPart/${request.part}`);
    const envelope = await dispatchPart(record, request);
    return { value: envelope.value, diagnostics: envelope.diagnostics };
  }

  /** 视图构建域臂（句柄 token → 原生句柄还原，WeakMap 私有簿记唯一触达点）。 */
  const view: INativeDocumentViewModule = {
    async buildDocumentView(handle, session) {
      const record = requireLive(handle as unknown as IDocumentHandle, 'buildDocumentView');
      return attempt(() => module.buildDocumentView(record.native, session));
    },
    async documentReadResource(handle, path, range) {
      const record = requireLive(handle as unknown as IDocumentHandle, 'documentReadResource');
      return attempt(() =>
        range === undefined
          ? module.documentReadResource(record.native, path)
          : module.documentReadResource(record.native, path, range),
      );
    },
  };

  return {
    open,

    readPart,

    async fingerprint(localPath: string): Promise<ISourceFingerprint> {
      const native = await attempt(() => module.openDocument(localPath));
      try {
        return mapRevision('documentRevision', await attempt(() => module.documentRevision(native)));
      } finally {
        // 复合臂自回收：成功与失败路径都不留悬置句柄（§12.2 GC 兜底仅覆盖 close 自身失败）。
        await closeQuietly(native);
      }
    },

    serialize(): Promise<readonly IDocumentSerializedMember[]> {
      // 刀6 裁决：落盘序列化权威归 W3 chips-resource 波，13 项解析导出面无序列化项。
      // 诚实失败以 rejection 交付（端口异步失败语义一致），不产生任何原生调用。
      return Promise.reject(
        createBridgeError(BRIDGE_ERROR_CODES.capabilityNotFound, {
          message: '落盘序列化能力未装配于解析端口',
          details: {
            port: 'IDocumentParserPort.serialize',
            adjudication: '金链路集成七刀定案·刀6：落盘序列化权威归 W3 chips-resource 波',
          },
        }),
      );
    },

    async release(handle: IDocumentHandle): Promise<void> {
      const record = handles.get(handle);
      if (record === undefined) {
        throw parserError(PARSER_CODE.notFound, '解析句柄不存在或已释放', { operation: 'release' });
      }
      if (record.closed) {
        return;
      }
      await attempt(() => module.documentClose(record.native));
      // 关闭成功后才置位：失败保持可重试（重复 release 再次触达原生侧）。
      record.closed = true;
    },

    view,
  };
}
