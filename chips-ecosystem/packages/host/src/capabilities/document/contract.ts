/**
 * `document:*` 能力契约面（结构视图）。
 *
 * 权威：`04-能力契约规范` §6.2（R19 权限映射）、§7.3（逐项契约与 JSON Schema）、
 * `11-文档服务设计` §三～§十、`05-事件契约规范` §4.2、`02-Bridge三层设计` §4.1（注册项）。
 *
 * @remarks
 * - 本文件是 `@chips/host` 对 `@chips/sdk` 生成常量（`capability-ids.ts` /
 *   `capability-permissions.ts` / `event-ids.ts`）与契约类型（`types/capabilities/document.ts`）、
 *   `@chips/bridge` 注册模型（`ICapability` / `ICapabilityRegistration` /
 *   `PLATFORM_CAPABILITY_OWNER`）的结构视图。`@chips/host` 当前不在 `@chips/sdk` /
 *   `@chips/bridge` 的工作区依赖边内（集成缺口已按工单口径登记），故在本包内镜像登记；
 *   双源不漂移由 `tests/document-capability-contract.test.ts` 逐项锁定（读取 SDK / Bridge
 *   生成源与登记表原文比对，任一漂移即红）。
 * - 能力 ID、事件 ID、权限 ID 在本模块内只出现于下列常量定义处；业务路径一律引用常量，
 *   不得再散落硬编码字符串。
 */

/** 本模块交付的四项文档能力 ID（`document:create` / `document:export` 不在本单范围）。 */
export const DOCUMENT_CAPABILITY_IDS = {
  open: 'document:open',
  read: 'document:read',
  write: 'document:write',
  save: 'document:save',
} as const;

/** 文档能力 ID 联合。 */
export type DocumentCapabilityId = (typeof DOCUMENT_CAPABILITY_IDS)[keyof typeof DOCUMENT_CAPABILITY_IDS];

/** 本模块发布的事件 ID（口径：`05-事件契约规范` §4.2；`event-ids.ts` 生成常量镜像）。 */
export const DOCUMENT_EVENT_IDS = {
  opened: 'document:opened',
  changed: 'document:changed',
  saved: 'document:saved',
} as const;

/** 文档事件 ID 联合。 */
export type DocumentEventId = (typeof DOCUMENT_EVENT_IDS)[keyof typeof DOCUMENT_EVENT_IDS];

/** 文档能力涉及的权限 ID（基础形式；限定值物化在授权记录，§6.1）。 */
export const DOCUMENT_PERMISSION_IDS = {
  resourcesRead: 'resources:read',
  resourcesWrite: 'resources:write',
} as const;

/**
 * 四能力 → 所需权限映射（R19 §6.2 canonical 行的镜像；契约测试与
 * `@chips/sdk` 的 `CAPABILITY_PERMISSIONS`、`@chips/bridge` 的 `BUILTIN_CAPABILITIES` 双向锁定）。
 */
export const DOCUMENT_CAPABILITY_PERMISSIONS: Readonly<Record<DocumentCapabilityId, readonly string[]>> = {
  'document:open': [DOCUMENT_PERMISSION_IDS.resourcesRead],
  'document:read': [DOCUMENT_PERMISSION_IDS.resourcesRead],
  'document:write': [DOCUMENT_PERMISSION_IDS.resourcesWrite],
  'document:save': [DOCUMENT_PERMISSION_IDS.resourcesWrite],
};

/** 内置能力提供方标识（与 `@chips/bridge` `PLATFORM_CAPABILITY_OWNER` 同值；契约测试锁定）。 */
export const DOCUMENT_PLATFORM_CAPABILITY_OWNER = 'chips.platform';

/** 文档类型判别键（与 `@chips/sdk` `DocumentKind` 同构）。 */
export type DocumentKind = 'card' | 'box';

/** 文档模型分片（与 `@chips/sdk` `DocumentPart` 同构）。 */
export type DocumentPart = 'metadata' | 'structure' | 'content' | 'entries';

/** 一条解析诊断（与 `@chips/sdk` `types/document.ts` 的 `Diagnostic` 同构）。 */
export interface IDocumentDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly pointer?: string;
  readonly line?: number;
  readonly column?: number;
  readonly hint?: string;
}

/**
 * 文档模型切片的结构视图（`@chips/sdk` `DocumentModel` 联合在壳侧的不透明投影）：
 * 对象为标量/映射成员，数组为条目序列；语义解释在解析器与编辑链路，服务不解释专有字段。
 */
export type DocumentValue = Readonly<Record<string, unknown>> | readonly unknown[];

/** 文档分片（`11-文档服务设计` §5.8）：目录态工作副本（包根目录）或归档态单文件（ZIP Store）。 */
export type DocumentForm = 'directory' | 'archive';

/** 输入 JSON Schema 的结构视图（与 `@chips/bridge` `JSONSchema = Readonly<Record<string, unknown>>` 一致）。 */
export type IDocumentJsonSchema = Readonly<Record<string, unknown>>;

/**
 * 四能力输入 Schema（逐字镜像 `04-能力契约规范` §7.3 的 `documentInputSchemas`；
 * Schema 校验主闸在 Bridge，本包注册项按契约携带同一份定义）。
 */
export const DOCUMENT_INPUT_SCHEMAS: Readonly<Record<DocumentCapabilityId, IDocumentJsonSchema>> = {
  'document:open': {
    type: 'object',
    additionalProperties: false,
    required: ['source'],
    properties: {
      source: { type: 'string', minLength: 1 },
      kind: { type: 'string', enum: ['card', 'box'] },
    },
  },
  'document:read': {
    type: 'object',
    additionalProperties: false,
    required: ['documentId', 'part'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
      part: { type: 'string', enum: ['metadata', 'structure', 'content', 'entries'] },
      nodeId: { type: 'string', minLength: 1 },
      range: {
        type: 'object',
        additionalProperties: false,
        required: ['offset', 'limit'],
        properties: {
          offset: { type: 'integer', minimum: 0 },
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
        },
      },
    },
  },
  'document:write': {
    type: 'object',
    additionalProperties: false,
    required: ['documentId', 'part', 'value'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
      part: { type: 'string', enum: ['metadata', 'structure', 'content', 'entries'] },
      nodeId: { type: 'string', minLength: 1 },
      value: { type: ['object', 'array', 'null'] },
    },
  },
  'document:save': {
    type: 'object',
    additionalProperties: false,
    required: ['documentId'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
    },
  },
};

/** 分页范围（`document:read` 的 `entries` 切片）。 */
export interface IDocumentReadRange {
  readonly offset: number;
  readonly limit: number;
}

/** 能力调用上下文（与 `@chips/bridge` `ICapabilityContext` 同构；Bridge 适配层组装并如实传递）。 */
export interface IDocumentCapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或 Bridge 关闭时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；无截止时为 `undefined`。 */
  readonly deadline?: number;
  /** 触发调用的 Bridge 会话标识；用于会话与权限判定入口与审计。 */
  readonly sessionId: string;
  /** 调用方标识：插件 ID 或 `platform`；仅用于诊断与审计，不参与授权。 */
  readonly callerId: string;
}

/** `document:open` 输入（§7.3 同构）。 */
export interface IDocumentOpenInput {
  readonly source: string;
  readonly kind?: DocumentKind;
}

/** `document:open` 输出。 */
export interface IDocumentOpenOutput {
  readonly documentId: string;
  readonly source: string;
  readonly kind: DocumentKind;
  readonly title: string;
  /** 打开时的快速指纹摘要（不读取资源字节）。 */
  readonly digest: string;
}

/** `document:read` 输入。 */
export interface IDocumentReadInput {
  readonly documentId: string;
  readonly part: DocumentPart;
  readonly nodeId?: string;
  readonly range?: IDocumentReadRange;
}

/** `document:read` 输出。 */
export interface IDocumentReadOutput {
  readonly part: DocumentPart;
  readonly value: DocumentValue;
  readonly diagnostics: readonly IDocumentDiagnostic[];
}

/** `document:write` 输入。 */
export interface IDocumentWriteInput {
  readonly documentId: string;
  readonly part: DocumentPart;
  readonly nodeId?: string;
  readonly value: DocumentValue | null;
}

/** `document:write` 输出；`revision` 从 1 开始，每次成功写入前进 1。 */
export interface IDocumentWriteOutput {
  readonly revision: number;
}

/** `document:save` 输入。 */
export interface IDocumentSaveInput {
  readonly documentId: string;
}

/** `document:save` 输出。 */
export interface IDocumentSaveOutput {
  readonly source: string;
  /** 保存后的包内容摘要（目录态）或文件摘要（归档态）。 */
  readonly digest: string;
}
