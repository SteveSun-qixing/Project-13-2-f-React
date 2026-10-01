/**
 * `resource:open` / `resource:list-handlers` 能力契约面（结构视图）。
 *
 * 权威：`14-资源打开与默认处理器契约` §2.2（请求模型与输入 Schema）、§4.5（结果模型）、
 * §5.5（`resource:opened` 运行中投递）、§6.1（槽位键文法）、§6.2（槽位视图与输入）、
 * §10（错误码）、`04-能力契约规范` §6.2（R19 权限映射）、§7.5（`resource:open` 逐项契约）、
 * `05-事件契约规范` §4.4（`resource:opened` 事件）、`06-资源协议规范` §4.2（权限映射）。
 *
 * @remarks
 * - 本文件是 `@chips/host` 对 `@chips/sdk` 生成常量（`capability-ids.ts` /
 *   `capability-permissions.ts` / `event-ids.ts`）与 `@chips/bridge` 登记表
 *   （`capability-contracts.ts`）的结构视图；`@chips/host` 不在两侧包的依赖边内（与
 *   `capabilities/document/contract.ts` 同纪律），双源不漂移由
 *   `tests/resource-open-contract.test.ts` 逐项锁定。
 * - 能力 ID、事件 ID、权限 ID 在本模块内只出现于常量定义处；业务路径一律引用常量。
 */

/** 本模块交付的两项资源打开能力 ID（14-资源打开与默认处理器契约 §2.2、§6.2）。 */
export const RESOURCE_OPEN_CAPABILITY_IDS = {
  open: 'resource:open',
  listHandlers: 'resource:list-handlers',
} as const;

/** 资源打开能力 ID 联合。 */
export type ResourceOpenCapabilityId = (typeof RESOURCE_OPEN_CAPABILITY_IDS)[keyof typeof RESOURCE_OPEN_CAPABILITY_IDS];

/** 本模块发布的事件 ID（`05-事件契约规范` §4.4；`event-ids.ts` 生成常量镜像）。 */
export const RESOURCE_OPEN_EVENT_IDS = {
  opened: 'resource:opened',
} as const;

/** 资源打开事件 ID 联合。 */
export type ResourceOpenEventId = (typeof RESOURCE_OPEN_EVENT_IDS)[keyof typeof RESOURCE_OPEN_EVENT_IDS];

/** 资源打开能力涉及的权限 ID（基础形式；限定值物化在授权记录，`06-资源协议规范` §4.2）。 */
export const RESOURCE_OPEN_PERMISSION_IDS = {
  resourcesRead: 'resources:read',
} as const;

/**
 * 两能力 → 所需权限映射（R19 §6.2 canonical 行镜像：`resource:open` 需 `resources:read`，
 * `resource:list-handlers` 免权限只读编目；与 `@chips/sdk` `CAPABILITY_PERMISSIONS`、
 * `@chips/bridge` `BUILTIN_CAPABILITIES` 双向锁定）。
 */
export const RESOURCE_OPEN_CAPABILITY_PERMISSIONS: Readonly<Record<ResourceOpenCapabilityId, readonly string[]>> = {
  'resource:open': [RESOURCE_OPEN_PERMISSION_IDS.resourcesRead],
  'resource:list-handlers': [],
};

/** 权限限定值目标规则（与 `@chips/bridge` `IPermissionTargetRule`、`IHostPermissionTargetRule` 同构）。 */
export interface IResourceOpenPermissionTargetRule {
  /** 基础权限 ID。 */
  readonly permission: string;
  /** 输入中的限定值目标字段路径（点分）；空数组表示该权限无调用目标。 */
  readonly targetFields: readonly string[];
}

/**
 * 两能力的限定值目标（R19 §6.2 全表镜像；`resource:open` 的 `resources:read` 与输入
 * `resource.uri` 比对限定值；`resource:list-handlers` 无目标）。
 */
export const RESOURCE_OPEN_CAPABILITY_TARGETS: Readonly<
  Record<ResourceOpenCapabilityId, readonly IResourceOpenPermissionTargetRule[]>
> = {
  'resource:open': [{ permission: RESOURCE_OPEN_PERMISSION_IDS.resourcesRead, targetFields: ['resource.uri'] }],
  'resource:list-handlers': [],
};

/** 输入 JSON Schema 的结构视图（与 `@chips/bridge` `JSONSchema` 一致）。 */
export type IResourceOpenJsonSchema = Readonly<Record<string, unknown>>;

/** MIME 声明/提示文法（§2.2 输入 Schema `pattern`，与 §3.3 声明校验同源）。 */
export const RESOURCE_OPEN_MIME_PATTERN = '^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$';

/** 不可判定 MIME（§4.1：请求 MIME 为该值时跳过 M1/M2 直接按扩展名匹配）。 */
export const RESOURCE_OPEN_OCTET_STREAM = 'application/octet-stream';

/**
 * 两能力输入 Schema（逐字镜像 `14-资源打开与默认处理器契约` §2.2 与 §6.2；
 * Schema 校验主闸在 Bridge，本包注册项按契约携带同一份定义）。
 */
export const RESOURCE_OPEN_INPUT_SCHEMAS: Readonly<Record<ResourceOpenCapabilityId, IResourceOpenJsonSchema>> = {
  'resource:open': {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: ['view', 'edit'] },
      resource: {
        type: 'object',
        additionalProperties: false,
        required: ['uri'],
        properties: {
          uri: { type: 'string', format: 'chips-resource-uri', maxLength: 2048 },
          mimeType: { type: 'string', pattern: RESOURCE_OPEN_MIME_PATTERN, maxLength: 128 },
          fileName: { type: 'string', minLength: 1, maxLength: 255 },
          title: { type: 'string', minLength: 1, maxLength: 128 },
          payload: { type: 'object', maxProperties: 32 },
        },
      },
    },
    required: ['resource'],
  },
  'resource:list-handlers': {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

/** 业务载荷序列化体积上限（§2.2 约束：超限 `BRIDGE_INVALID_INPUT`）。 */
export const RESOURCE_OPEN_PAYLOAD_MAX_BYTES = 64 * 1024;

/**
 * 打开路由错误码（`14-资源打开与默认处理器契约` §10 + 复用的通道级与应用运行时码；
 * 语义权威在对应登记表，本模块只声明本域直接构造的 `RESOURCE_HANDLER_MISSING`，
 * 其余经端口原样透传，禁第二套语义）。
 */
export const RESOURCE_OPEN_ERROR_CODES = {
  /** 无候选处理器且无可用回退（§4.6/§10）。 */
  handlerMissing: 'RESOURCE_HANDLER_MISSING',
} as const;

/** 复用码（透传面）：处理器启用失败 / 投递失败（§4.7 失败语义表；码主为内核与应用运行时）。 */
export const RESOURCE_OPEN_PASSTHROUGH_ERROR_CODES = {
  launchFailed: 'APP_LAUNCH_FAILED',
  openFileUnsupported: 'APP_OPEN_FILE_UNSUPPORTED',
} as const;

/** 打开意图（§2.2）。 */
export const RESOURCE_OPEN_INTENTS = ['view', 'edit'] as const;

/** 打开意图联合。 */
export type ResourceOpenIntent = (typeof RESOURCE_OPEN_INTENTS)[number];

/** 打开来源（§2.1；能力调用面的来源由平台按调用通道判定）。 */
export const RESOURCE_OPEN_ORIGINS = ['os-association', 'drop', 'in-app', 'frame'] as const;

/** 打开来源联合。 */
export type ResourceOpenOrigin = (typeof RESOURCE_OPEN_ORIGINS)[number];

/** 处理器层级（§3.1）。 */
export const RESOURCE_OPEN_HANDLER_TIERS = ['primary', 'fallback'] as const;

/** 处理器层级联合。 */
export type ResourceOpenHandlerTier = (typeof RESOURCE_OPEN_HANDLER_TIERS)[number];

/** 投递模式（§4.5）。 */
export const RESOURCE_OPEN_MODES = ['app', 'service', 'shell', 'external'] as const;

/** 投递模式联合。 */
export type ResourceOpenMode = (typeof RESOURCE_OPEN_MODES)[number];

/** 槽位键的 MIME 形式前缀（§6.1 槽位键文法）。 */
export const RESOURCE_OPEN_SLOT_MIME_PREFIX = 'mime:';

/** 槽位键的扩展名形式前缀（§6.1 槽位键文法）。 */
export const RESOURCE_OPEN_SLOT_EXT_PREFIX = 'ext:';

/**
 * 扩展名 → MIME 内置静态推断表（§2.3 归一规则 2；扩展名清单取
 * `14.03` §3.5 canonical 表中「MIME 面在册」的行——Office 族、`.7z`、`.json` / `.yaml`
 * 精确细分、`.box` 独立 MIME 面均为候勘行，不入表不硬造；音视频逐项 MIME 取
 * §3.5 登记的旧仓历史口径映射）。
 */
export const RESOURCE_OPEN_EXTENSION_MIME_TABLE: Readonly<Record<string, string>> = {
  // image/*（§3.5 image 行，manifest 即权威）
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  // application/pdf（§3.5 pdf 行）
  '.pdf': 'application/pdf',
  // application/epub+zip（§3.5 epub 行）
  '.epub': 'application/epub+zip',
  // application/zip（§3.5 zip 行）
  '.zip': 'application/zip',
  // text/*（§3.5 text 行；仅 `.txt` 的 text/* 槽位在册，精确细分候勘不入表）
  '.txt': 'text/plain',
  // audio/*（§3.5 audio 行，逐项 MIME 取旧仓历史口径映射）
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  // video/*（§3.5 video 行，逐项 MIME 取旧仓历史口径映射）
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ogv': 'video/ogg',
  // 薯片卡片（§3.5 卡片行：`.card` MIME 面 `application/x-card` 在册）
  '.card': 'application/x-card',
};

/**
 * 从扩展名推断 MIME（§2.3 规则 2；未命中返回 `null`，由调用方落到
 * `application/octet-stream`）。
 */
export function inferMimeTypeFromExtension(extension: string | undefined): string | null {
  if (extension === undefined) {
    return null;
  }
  return RESOURCE_OPEN_EXTENSION_MIME_TABLE[extension] ?? null;
}

/** 归一化扩展名（§2.3 规则 3）：取最后一个 `.` 之后的部分，小写并加前缀点；无点或为空即缺席。 */
export function normalizeExtension(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) {
    return undefined;
  }
  const raw = fileName.slice(dot).toLowerCase();
  return raw.length > 1 ? raw : undefined;
}

/** 构造 MIME 槽位键（§6.1）。 */
export function mimeSlotKey(mime: string): string {
  return `${RESOURCE_OPEN_SLOT_MIME_PREFIX}${mime}`;
}

/** 构造扩展名槽位键（§6.1）。 */
export function extensionSlotKey(extension: string): string {
  return `${RESOURCE_OPEN_SLOT_EXT_PREFIX}${extension}`;
}
