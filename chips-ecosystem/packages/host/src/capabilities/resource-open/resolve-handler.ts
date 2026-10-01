/**
 * 处理器解析的唯一实现（`14-资源打开与默认处理器契约` §2.3、§4.1、§4.2、§6.2）。
 *
 * 权威：`14.04` §4.1（解析顺序与匹配等级 M1＞M2＞E1）、§4.2（用户偏好覆盖）、
 * `14.02` §2.3（输入归一）、`14.06` §6.2（槽位视图）、§11 OR-2/OR-12（单一解析实现、
 * 固定排序文法）。
 *
 * @remarks
 * - 全部函数为**确定性纯函数**：同样输入与同样插件状态必得同样结果，禁止随机、时间或
 *   会话因素参与排序（§4.1 规则）。全仓唯一解析实现落在本模块；服务层与描述符层只消费，
 *   禁第二套匹配/排序（OR-2）。
 * - 匹配等级：M1（精确 MIME）＞ M2（主类型通配）＞ E1（扩展名）；请求 MIME 为
 *   `application/octet-stream` 时跳过 M1 与 M2（§4.1 规则）；同一插件多等级命中只按其
 *   最佳等级计入一次。
 * - 组内排序：primary 先于 fallback → 安装顺序（先安装优先）→ 插件 ID 字典序升序（OR-12）。
 * - 偏好只改选插件：不改变候选资格、不改变该插件自身匹配等级、不产生授权（OR-7）。
 */

import { parseResourceUri } from '../../protocol/resource-uri.js';
import type { ResourceUriParseResult } from '../../protocol/resource-uri.js';
import {
  RESOURCE_OPEN_OCTET_STREAM,
  RESOURCE_OPEN_SLOT_EXT_PREFIX,
  RESOURCE_OPEN_SLOT_MIME_PREFIX,
  extensionSlotKey,
  inferMimeTypeFromExtension,
  mimeSlotKey,
  normalizeExtension,
} from './contract.js';
import type { ResourceOpenHandlerTier, ResourceOpenIntent } from './contract.js';
import { ResourceOpenError } from './errors.js';

/** 处理器声明（路由域消费的槽位声明投影；来自 manifest `fileAssociations`）。 */
export interface IHandlerDeclaration {
  /** 反向域名插件 ID。 */
  readonly pluginId: string;
  /** manifest `name`（简体中文显示名）。 */
  readonly name: string;
  /** 插件角色；处理器只来自 app / service。 */
  readonly role: 'app' | 'service';
  /** 处理器层级；缺省 primary（§3.3 规则 3）。 */
  readonly tier: ResourceOpenHandlerTier;
  /** 扩展名槽位声明（含点、小写、已按安装校验归一）。 */
  readonly extensions: readonly string[];
  /** MIME 槽位声明（精确 MIME 或主类型通配、小写）。 */
  readonly mimeTypes: readonly string[];
  /** 安装时刻（ISO 8601；同刻安装按插件 ID 字典序，§6.2 顺序规则）。 */
  readonly installedAt: string;
}

/** 归一后的资源视图（§4.5 `resolved` + §5.1 上下文共用的归一产物）。 */
export interface INormalizedResourceView {
  readonly uri: string;
  readonly mimeType: string;
  readonly extension: string | undefined;
  readonly fileName: string | undefined;
  readonly title: string | undefined;
  readonly payload: Readonly<Record<string, unknown>> | undefined;
}

/** 归一后的打开请求。 */
export interface INormalizedOpenRequest {
  readonly intent: ResourceOpenIntent;
  readonly view: INormalizedResourceView;
}

/** 归一失败的确定性原因（服务层据此抛 `BRIDGE_INVALID_INPUT`）。 */
export type ResourceOpenNormalizeFailure = 'uri-invalid' | 'payload-too-large';

/** 归一结果。 */
export type ResourceOpenNormalizeOutcome =
  | { readonly ok: true; readonly request: INormalizedOpenRequest }
  | { readonly ok: false; readonly reason: ResourceOpenNormalizeFailure };

/** 从 URI 路径取展示用文件名（§2.3 规则 4：路径最后一段并百分号解码；无文件名即缺席）。 */
function fileNameFromUri(uri: string): string | undefined {
  const parsed: ResourceUriParseResult = parseResourceUri(uri);
  if (!parsed.ok || parsed.path.length === 0) {
    return undefined;
  }
  const last = parsed.path.split('/').pop() ?? '';
  if (last.length === 0) {
    return undefined;
  }
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * 输入归一（§2.3）：确定性、不读取资源字节、不做网络探测（OR-10）。
 *
 * @param resource 打开请求中的资源描述（schema 准入后的记录）。
 * @param intent 打开意图（缺省 `view`）。
 * @param payloadTextLength payload 序列化后长度（体积校验由服务层以同一输入计算后传入；
 *   归一保持纯函数，不做序列化）。
 */
export function normalizeOpenRequest(
  resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly title?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  },
  intent: ResourceOpenIntent | undefined,
  payloadTextLength: number,
  payloadMaxBytes: number,
): ResourceOpenNormalizeOutcome {
  const parsed = parseResourceUri(resource.uri);
  if (!parsed.ok) {
    return { ok: false, reason: 'uri-invalid' };
  }
  if (payloadTextLength > payloadMaxBytes) {
    return { ok: false, reason: 'payload-too-large' };
  }
  const fileName = resource.fileName ?? fileNameFromUri(resource.uri);
  const extension = fileName === undefined ? undefined : normalizeExtension(fileName);
  const inferred = inferMimeTypeFromExtension(extension);
  const mimeType = resource.mimeType ?? (inferred === null ? RESOURCE_OPEN_OCTET_STREAM : inferred);
  return {
    ok: true,
    request: {
      intent: intent ?? 'view',
      view: {
        uri: parsed.uri,
        mimeType,
        extension,
        fileName,
        title: resource.title,
        payload: resource.payload,
      },
    },
  };
}

/** 匹配等级（§4.1：M1=1 ＞ M2=2 ＞ E1=3；无命中为 `null`）。 */
export type HandlerMatchLevel = 1 | 2 | 3;

/** 单条声明对归一视图的匹配等级（§4.1 等级表）。 */
export function matchDeclarationLevel(
  declaration: Pick<IHandlerDeclaration, 'mimeTypes' | 'extensions'>,
  view: Pick<INormalizedResourceView, 'mimeType' | 'extension'>,
): HandlerMatchLevel | null {
  const mime = view.mimeType;
  const extension = view.extension;
  if (mime !== RESOURCE_OPEN_OCTET_STREAM) {
    if (declaration.mimeTypes.includes(mime)) {
      return 1;
    }
    const primaryType = mime.split('/', 1)[0] ?? '';
    if (primaryType.length > 0 && declaration.mimeTypes.includes(`${primaryType}/*`)) {
      return 2;
    }
  }
  if (extension !== undefined && declaration.extensions.includes(extension)) {
    return 3;
  }
  return null;
}

/** 候选条目：声明 + 其对本次请求的最佳匹配等级与命中槽位。 */
interface IMatchedCandidate {
  readonly declaration: IHandlerDeclaration;
  readonly level: HandlerMatchLevel;
  readonly slot: string;
}

/** 槽位键优先序（§4.2：mime:<精确> → mime:<主类型>/* → ext:<扩展名>）。 */
function preferenceLookupKeys(view: INormalizedResourceView): readonly string[] {
  const keys: string[] = [];
  if (view.mimeType !== RESOURCE_OPEN_OCTET_STREAM) {
    keys.push(mimeSlotKey(view.mimeType));
    const primaryType = view.mimeType.split('/', 1)[0] ?? '';
    if (primaryType.length > 0) {
      keys.push(mimeSlotKey(`${primaryType}/*`));
    }
  }
  if (view.extension !== undefined) {
    keys.push(extensionSlotKey(view.extension));
  }
  return keys;
}

/** 组内排序比较器（§4.1 步骤 3：等级 → primary 先于 fallback → 安装顺序 → 插件 ID 字典序）。 */
function compareCandidates(a: IMatchedCandidate, b: IMatchedCandidate): number {
  if (a.level !== b.level) {
    return a.level - b.level;
  }
  const tierRank = (tier: ResourceOpenHandlerTier): number => (tier === 'primary' ? 0 : 1);
  const tierDelta = tierRank(a.declaration.tier) - tierRank(b.declaration.tier);
  if (tierDelta !== 0) {
    return tierDelta;
  }
  const installedDelta = a.declaration.installedAt.localeCompare(b.declaration.installedAt);
  if (installedDelta !== 0) {
    return installedDelta;
  }
  return a.declaration.pluginId.localeCompare(b.declaration.pluginId);
}

/** 解析命中结果。 */
export interface IResolvedHandler {
  readonly declaration: IHandlerDeclaration;
  /** 该插件自身的最佳匹配等级（§4.2 规则 2）。 */
  readonly level: HandlerMatchLevel;
  /** 命中槽位键（mime:<mime> / ext:<ext>）。 */
  readonly slot: string;
}

/**
 * 处理器解析（§4.1 全表 + §4.2 偏好覆盖；`resolveHandler` 是唯一解析实现）。
 *
 * @param candidates 候选集合（只含 `active` 插件的声明；快照由调用方在解析时取得，§3.4）。
 * @param view 归一后的资源视图。
 * @param preferences 用户偏好（`platform.fileOpen.defaults`；缺省视为空表）。
 * @returns 命中处理器；无候选返回 `null`（未命中降级由服务层按 §4.6 承接）。
 */
export function resolveHandler(
  candidates: readonly IHandlerDeclaration[],
  view: INormalizedResourceView,
  preferences: Readonly<Record<string, string>> = {},
): IResolvedHandler | null {
  // 步骤 1：匹配等级（每插件只按最佳等级计入一次）。
  const matched = new Map<string, IMatchedCandidate>();
  for (const declaration of candidates) {
    const level = matchDeclarationLevel(declaration, view);
    if (level === null) {
      continue;
    }
    const slot =
      level === 3 && view.extension !== undefined
        ? extensionSlotKey(view.extension)
        : mimeSlotKey(level === 2 ? `${view.mimeType.split('/', 1)[0] ?? ''}/*` : view.mimeType);
    const existing = matched.get(declaration.pluginId);
    if (existing === undefined || level < existing.level) {
      matched.set(declaration.pluginId, { declaration, level, slot });
    }
  }
  if (matched.size === 0) {
    return null;
  }
  const ordered = [...matched.values()].sort(compareCandidates);

  // 步骤 2：用户偏好覆盖（§4.2：按槽位键序找第一个存在的键；有效偏好直接改选其插件）。
  for (const key of preferenceLookupKeys(view)) {
    const preferred = preferences[key];
    if (typeof preferred !== 'string' || preferred.length === 0) {
      continue;
    }
    const hit = matched.get(preferred);
    if (hit === undefined) {
      // 指向的插件停用/失败/卸载或未声明任何命中候选：忽略该偏好项，继续查找（§4.2 规则 3）。
      continue;
    }
    return { declaration: hit.declaration, level: hit.level, slot: hit.slot };
  }

  // 步骤 3/4：取排序后的首个候选。
  const first = ordered[0];
  return first === undefined ? null : { declaration: first.declaration, level: first.level, slot: first.slot };
}

/** 槽位候选（§6.2 `IHandlerCandidate` 同构）。 */
export interface IHandlerCandidateView {
  readonly pluginId: string;
  readonly name: string;
  readonly role: 'app' | 'service';
  readonly tier: ResourceOpenHandlerTier;
  readonly isPreferred: boolean;
}

/** 处理器槽位（§6.2 `IHandlerSlot` 同构）。 */
export interface IHandlerSlotView {
  readonly slot: string;
  readonly mimeType: string | undefined;
  readonly extension: string | undefined;
  readonly preferencePluginId: string | null;
  readonly defaultPluginId: string | null;
  readonly handlers: readonly IHandlerCandidateView[];
}

/** 槽位视图输出（§6.2 `IListHandlersOutput` 同构）。 */
export interface IHandlerSlotsOutput {
  readonly slots: readonly IHandlerSlotView[];
}

/**
 * 槽位视图（§6.2）：槽位集合 = 全部候选声明产生的槽位 + 含偏好记录但当前无候选的槽位；
 * 无候选且无偏好记录的槽位不出现；顺序固定：有效偏好项在前，其余 primary 先于 fallback，
 * 同层级按安装顺序，同刻安装按插件 ID 字典序。
 *
 * @remarks 同一插件多声明合并去重（§3.3 规则 4：同一插件在同一槽位保留最强声明）。
 */
export function buildHandlerSlots(
  candidates: readonly IHandlerDeclaration[],
  preferences: Readonly<Record<string, string>> = {},
): IHandlerSlotsOutput {
  // 槽位 → 插件 ID → 最强声明（primary 优先于 fallback）。
  const slotDeclarations = new Map<string, Map<string, IHandlerDeclaration>>();
  for (const declaration of candidates) {
    const slots = new Set<string>();
    for (const mime of declaration.mimeTypes) {
      slots.add(mimeSlotKey(mime));
    }
    for (const extension of declaration.extensions) {
      slots.add(extensionSlotKey(extension));
    }
    for (const slot of slots) {
      let perPlugin = slotDeclarations.get(slot);
      if (perPlugin === undefined) {
        perPlugin = new Map<string, IHandlerDeclaration>();
        slotDeclarations.set(slot, perPlugin);
      }
      const existing = perPlugin.get(declaration.pluginId);
      if (existing === undefined || (existing.tier === 'fallback' && declaration.tier === 'primary')) {
        perPlugin.set(declaration.pluginId, declaration);
      }
    }
  }
  // 含偏好记录但当前无候选的槽位（§6.2 槽位集合规则）。
  for (const key of Object.keys(preferences)) {
    if (
      !slotDeclarations.has(key) &&
      (key.startsWith(RESOURCE_OPEN_SLOT_MIME_PREFIX) || key.startsWith(RESOURCE_OPEN_SLOT_EXT_PREFIX))
    ) {
      slotDeclarations.set(key, new Map<string, IHandlerDeclaration>());
    }
  }

  const declarationOrder = new Map<string, number>();
  candidates.forEach((declaration, index) => {
    if (!declarationOrder.has(declaration.pluginId)) {
      declarationOrder.set(declaration.pluginId, index);
    }
  });
  const slotComparator = (a: string, b: string): number => a.localeCompare(b);

  const slots: IHandlerSlotView[] = [];
  for (const [slot, perPlugin] of [...slotDeclarations.entries()].sort(([a], [b]) => slotComparator(a, b))) {
    const preferencePluginId = preferences[slot];
    const preferenceValid = typeof preferencePluginId === 'string' && perPlugin.has(preferencePluginId);
    const isPreferredOf = (pluginId: string): boolean => preferenceValid && pluginId === preferencePluginId;
    const ordered = [...perPlugin.values()].sort((a, b) => {
      const preferredDelta = (isPreferredOf(b.pluginId) ? 1 : 0) - (isPreferredOf(a.pluginId) ? 1 : 0);
      if (preferredDelta !== 0) {
        return preferredDelta;
      }
      const tierDelta = (a.tier === 'primary' ? 0 : 1) - (b.tier === 'primary' ? 0 : 1);
      if (tierDelta !== 0) {
        return tierDelta;
      }
      const installedDelta = a.installedAt.localeCompare(b.installedAt);
      if (installedDelta !== 0) {
        return installedDelta;
      }
      return a.pluginId.localeCompare(b.pluginId);
    });
    const handlers: IHandlerCandidateView[] = ordered.map((declaration) => ({
      pluginId: declaration.pluginId,
      name: declaration.name,
      role: declaration.role,
      tier: declaration.tier,
      isPreferred: isPreferredOf(declaration.pluginId),
    }));
    const fallbackDefault = ordered[0];
    const isMimeSlot = slot.startsWith(RESOURCE_OPEN_SLOT_MIME_PREFIX);
    slots.push({
      slot,
      ...(isMimeSlot
        ? { mimeType: slot.slice(RESOURCE_OPEN_SLOT_MIME_PREFIX.length), extension: undefined }
        : { mimeType: undefined, extension: slot.slice(RESOURCE_OPEN_SLOT_EXT_PREFIX.length) }),
      preferencePluginId: typeof preferencePluginId === 'string' ? preferencePluginId : null,
      defaultPluginId:
        preferenceValid && typeof preferencePluginId === 'string'
          ? preferencePluginId
          : fallbackDefault === undefined
            ? null
            : fallbackDefault.pluginId,
      handlers,
    });
  }
  return { slots };
}

/** 归一失败 → 服务层抛出的确定性输入错误（`BRIDGE_INVALID_INPUT`）。 */
export function normalizeFailureError(reason: ResourceOpenNormalizeFailure): ResourceOpenError {
  const message =
    reason === 'payload-too-large'
      ? '打开请求的业务载荷序列化后超过 64 KiB 上限'
      : '打开请求的目标地址必须是合法的 chips-resource:// 受管引用';
  return new ResourceOpenError('BRIDGE_INVALID_INPUT', { message, details: { reason } });
}
