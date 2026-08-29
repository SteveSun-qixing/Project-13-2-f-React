/**
 * 文件打开处理器解析器。
 *
 * 职责：为 `resource.open`、`association.openPath`、系统文件关联与
 * `plugin.listHandlers` 提供唯一一致的处理器解析口径：
 *
 * 1. 解析能力串层级（tier）：`@fallback` 后缀表示通用兜底声明，
 *    专用查看器（无后缀，primary 层级）永远优先于兜底查看器。
 * 2. 解析用户默认查看器偏好（`fileOpen.defaults` 配置键）：
 *    偏好命中且目标插件可用时优先于一切自动匹配。
 * 3. 其余情况按既有候选链顺序：精确 MIME → 主类型通配 MIME → 扩展名；
 *    同一候选内 primary 层级先于 fallback 层级，再按插件安装顺序。
 *
 * 本模块必须是纯函数：不访问文件系统、内核或配置服务，输入输出全部显式。
 */

export const FILE_OPEN_DEFAULTS_CONFIG_KEY = 'fileOpen.defaults';

export type HandlerCapabilityKind = 'resource-handler' | 'file-handler';

export type HandlerTier = 'primary' | 'fallback';

export interface ParsedHandlerCapability {
  /** 原始声明串（含层级后缀）。 */
  raw: string;
  /** 去除层级后缀并归一化后的能力串。 */
  capability: string;
  kind: HandlerCapabilityKind;
  tier: HandlerTier;
  /** 仅 resource-handler：声明的意图（如 view）。 */
  intent?: string;
  /** 仅 resource-handler：声明的 MIME（精确或 `主类型/*`）。 */
  mimeType?: string;
  /** 仅 file-handler：声明的扩展名（小写、带点）。 */
  extension?: string;
}

export interface HandlerResolverPlugin {
  pluginId: string;
  capabilities: string[];
}

export interface HandlerResolution {
  pluginId: string;
  /** 命中的归一化能力串。 */
  capability: string;
  /** 是否由用户默认查看器偏好直接命中。 */
  preferenceApplied: boolean;
}

export interface HandlerSlotPluginView {
  pluginId: string;
  name?: string;
  tier: HandlerTier;
  /** 该插件是否是此偏好键上的用户首选。 */
  isPreferred: boolean;
}

export interface HandlerSlotView {
  /** 归一化能力串（无层级后缀）。 */
  capability: string;
  kind: HandlerCapabilityKind;
  intent?: string;
  mimeType?: string;
  extension?: string;
  /** 该槽位写入 `fileOpen.defaults` 时使用的偏好键。 */
  preferenceKey: string;
  /** 偏好键上的原始用户偏好（可能是已停用/已卸载的插件）。 */
  preferencePluginId: string | null;
  /** 当前生效默认：有效偏好优先，否则按层级与安装顺序的第一个。 */
  defaultPluginId: string | null;
  plugins: HandlerSlotPluginView[];
}

const FALLBACK_TIER_SUFFIX = '@fallback';
const PRIMARY_TIER: HandlerTier = 'primary';
const FALLBACK_TIER: HandlerTier = 'fallback';

const normalizeLowercase = (value: string): string => value.trim().toLowerCase();

const splitTierSuffix = (raw: string): { body: string; tier: HandlerTier } | null => {
  const normalized = normalizeLowercase(raw);
  const atIndex = normalized.indexOf('@');
  if (atIndex < 0) {
    return { body: normalized, tier: PRIMARY_TIER };
  }
  if (normalized.slice(atIndex) === FALLBACK_TIER_SUFFIX) {
    return {
      body: normalized.slice(0, atIndex),
      tier: FALLBACK_TIER,
    };
  }
  return null;
};

/**
 * 解析能力串。非处理器能力（如 `file.read` 等权限串或损坏声明）返回 null。
 */
export const parseHandlerCapability = (raw: string): ParsedHandlerCapability | null => {
  if (typeof raw !== 'string') {
    return null;
  }

  const split = splitTierSuffix(raw);
  if (!split) {
    return null;
  }
  const { body, tier } = split;
  if (body.startsWith('resource-handler:')) {
    const withoutPrefix = body.slice('resource-handler:'.length);
    const separatorIndex = withoutPrefix.indexOf(':');
    if (separatorIndex <= 0) {
      return null;
    }
    const intent = withoutPrefix.slice(0, separatorIndex).trim();
    const mimeType = withoutPrefix.slice(separatorIndex + 1).trim();
    if (!intent || !mimeType) {
      return null;
    }
    return {
      raw: normalizeLowercase(raw),
      capability: `resource-handler:${intent}:${mimeType}`,
      kind: 'resource-handler',
      tier,
      intent,
      mimeType,
    };
  }

  if (body.startsWith('file-handler:')) {
    const extension = body.slice('file-handler:'.length).trim();
    if (!extension.startsWith('.') || extension.length < 2) {
      return null;
    }
    return {
      raw: normalizeLowercase(raw),
      capability: `file-handler:${extension}`,
      kind: 'file-handler',
      tier,
      extension,
    };
  }

  return null;
};

/**
 * 按请求构造候选能力链：精确 MIME → 主类型通配 MIME → 扩展名（去重）。
 */
export const buildCandidateCapabilities = (
  intent: string,
  mimeType: string | undefined,
  extension: string | undefined,
): string[] => {
  const candidates: string[] = [];
  if (mimeType) {
    candidates.push(`resource-handler:${intent}:${mimeType}`);
    const slashIndex = mimeType.indexOf('/');
    if (slashIndex > 0) {
      candidates.push(`resource-handler:${intent}:${mimeType.slice(0, slashIndex)}/*`);
    }
  }
  if (extension) {
    candidates.push(`file-handler:${extension}`);
  }
  return [...new Set(candidates)];
};

const declaredCandidateTier = (
  plugin: HandlerResolverPlugin,
  candidate: string,
): HandlerTier | null => {
  let tier: HandlerTier | null = null;
  for (const raw of plugin.capabilities ?? []) {
    const parsed = parseHandlerCapability(raw);
    if (!parsed || parsed.capability !== candidate) {
      continue;
    }
    if (parsed.tier === PRIMARY_TIER) {
      return PRIMARY_TIER;
    }
    tier = FALLBACK_TIER;
  }
  return tier;
};

/**
 * 构造某次资源打开请求应检查的偏好键（按优先级）：
 * 精确 MIME → 主类型通配 MIME → 扩展名。
 */
export const handlerPreferenceKeys = (
  mimeType: string | undefined,
  extension: string | undefined,
): string[] => {
  const keys: string[] = [];
  if (mimeType) {
    keys.push(`mime:${mimeType}`);
    const slashIndex = mimeType.indexOf('/');
    if (slashIndex > 0) {
      keys.push(`mime:${mimeType.slice(0, slashIndex)}/*`);
    }
  }
  if (extension) {
    keys.push(`ext:${extension}`);
  }
  return keys;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * 归一化 `fileOpen.defaults` 配置值：仅保留 string→string 的有效映射。
 */
export const sanitizeHandlerPreferences = (value: unknown): Record<string, string> | undefined => {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const preferences: Record<string, string> = {};
  for (const [key, pluginId] of Object.entries(value)) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      continue;
    }
    if (typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      continue;
    }
    preferences[key.trim()] = pluginId.trim();
  }

  return Object.keys(preferences).length > 0 ? preferences : undefined;
};

/**
 * 统一处理器解析入口。
 *
 * 输入的 plugins 必须是调用方已按「enabled 且 type=app」过滤后的候选；
 * 顺序代表插件安装顺序，解析在同级内保持稳定。
 */
export const resolveHandlerFromRecords = (options: {
  plugins: HandlerResolverPlugin[];
  intent?: string;
  mimeType?: string;
  extension?: string;
  preferences?: Record<string, string>;
}): HandlerResolution | null => {
  const intent = options.intent?.trim().toLowerCase() || 'view';
  const mimeType = options.mimeType?.trim().toLowerCase() || undefined;
  const extension = options.extension?.trim().toLowerCase() || undefined;
  const plugins = options.plugins ?? [];
  const candidates = buildCandidateCapabilities(intent, mimeType, extension);
  if (candidates.length === 0) {
    return null;
  }

  for (const preferenceKey of handlerPreferenceKeys(mimeType, extension)) {
    const preferredPluginId = options.preferences?.[preferenceKey];
    if (!preferredPluginId) {
      continue;
    }
    const preferred = plugins.find((plugin) => plugin.pluginId === preferredPluginId);
    if (!preferred) {
      continue;
    }
    const matchedCandidate = candidates.find((candidate) => declaredCandidateTier(preferred, candidate) !== null);
    if (!matchedCandidate) {
      continue;
    }
    return {
      pluginId: preferredPluginId,
      capability: matchedCandidate,
      preferenceApplied: true,
    };
  }

  for (const candidate of candidates) {
    const declarers = plugins
      .map((plugin) => ({ pluginId: plugin.pluginId, tier: declaredCandidateTier(plugin, candidate) }))
      .filter((entry): entry is { pluginId: string; tier: HandlerTier } => entry.tier !== null);
    const winner = [
      ...declarers.filter((entry) => entry.tier === PRIMARY_TIER),
      ...declarers.filter((entry) => entry.tier === FALLBACK_TIER),
    ][0];
    if (!winner) {
      continue;
    }
    return {
      pluginId: winner.pluginId,
      capability: candidate,
      preferenceApplied: false,
    };
  }

  return null;
};

const compareSlotPluginOrder = (
  left: { tier: HandlerTier; isPreferred: boolean; index: number },
  right: { tier: HandlerTier; isPreferred: boolean; index: number },
): number => {
  if (left.isPreferred !== right.isPreferred) {
    return left.isPreferred ? -1 : 1;
  }
  if (left.tier !== right.tier) {
    return left.tier === PRIMARY_TIER ? -1 : 1;
  }
  return left.index - right.index;
};

/**
 * 汇总全部启用应用插件声明，构建「文件打开方式」治理槽位视图。
 * 顺序：file-handler 在前（扩展名更贴近用户文件类型直觉），同类内按能力串排序。
 */
export const buildHandlerSlots = (
  plugins: Array<HandlerResolverPlugin & { name?: string }>,
  preferences?: Record<string, string>,
): HandlerSlotView[] => {
  const groups = new Map<
    string,
    { parsed: ParsedHandlerCapability; entries: Array<{ pluginId: string; name?: string; tier: HandlerTier; index: number }> }
  >();

  (plugins ?? []).forEach((plugin, pluginIndex) => {
    for (const raw of plugin.capabilities ?? []) {
      const parsed = parseHandlerCapability(raw);
      if (!parsed) {
        continue;
      }
      let group = groups.get(parsed.capability);
      if (!group) {
        group = { parsed, entries: [] };
        groups.set(parsed.capability, group);
      }
      if (group.entries.some((entry) => entry.pluginId === plugin.pluginId)) {
        continue;
      }
      group.entries.push({ pluginId: plugin.pluginId, name: plugin.name, tier: parsed.tier, index: pluginIndex });
    }
  });

  const slots: HandlerSlotView[] = [];
  for (const group of groups.values()) {
    const preferenceKey =
      group.parsed.kind === 'resource-handler' ? `mime:${group.parsed.mimeType}` : `ext:${group.parsed.extension}`;
    const preferencePluginId = preferences?.[preferenceKey] ?? null;
    const orderedEntries = [...group.entries]
      .map((entry) => ({
        ...entry,
        isPreferred: preferencePluginId !== null && entry.pluginId === preferencePluginId,
      }))
      .sort(compareSlotPluginOrder);

    slots.push({
      capability: group.parsed.capability,
      kind: group.parsed.kind,
      intent: group.parsed.intent,
      mimeType: group.parsed.mimeType,
      extension: group.parsed.extension,
      preferenceKey,
      preferencePluginId,
      defaultPluginId: orderedEntries[0]?.pluginId ?? null,
      plugins: orderedEntries.map((entry) => ({
        pluginId: entry.pluginId,
        name: entry.name,
        tier: entry.tier,
        isPreferred: entry.isPreferred,
      })),
    });
  }

  return slots.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'file-handler' ? -1 : 1;
    }
    return left.capability.localeCompare(right.capability);
  });
};
