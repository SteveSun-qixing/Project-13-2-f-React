/**
 * 超链接基础卡片配置模型（08-基础卡片插件接口 §7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、校验（validateConfig）
 * 与 URL 安全分析（analyzeHyperlinkUrl），与 `assets/schemas/hyperlink-card-config.schema.json`
 * 保持同一口径（08 §7.3：validateConfig 不得比 schema 宽松）。
 */

/** 展示密度：紧凑、舒适、宽松。 */
export type HyperlinkDisplayDensity = 'compact' | 'comfortable' | 'spacious';

/** 超链接卡片配置。 */
export interface IHyperlinkConfig {
  anchor_text: string;
  url: string;
  description: string;
  icon_url: string;
  display_density: HyperlinkDisplayDensity;
  show_security_hint: boolean;
}

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致）。 */
export const CARD_TYPE_ID = 'base.hyperlink';

export const DEFAULT_CONFIG: IHyperlinkConfig = {
  anchor_text: '',
  url: '',
  description: '',
  icon_url: '',
  display_density: 'comfortable',
  show_security_hint: true,
};

export const DENSITY_OPTIONS: readonly HyperlinkDisplayDensity[] = [
  'compact',
  'comfortable',
  'spacious',
];

export const DENSITY_LABELS: Readonly<Record<HyperlinkDisplayDensity, string>> = {
  compact: '紧凑',
  comfortable: '舒适',
  spacious: '宽松',
};

// ---------- URL 安全分析（查看态安全提示与打开判定的唯一口径） ----------

export type HyperlinkUrlSecurityLevel = 'secure' | 'warning' | 'blocked' | 'empty';

export type HyperlinkUrlSecurityReason =
  | 'secure'
  | 'insecure-http'
  | 'empty'
  | 'invalid'
  | 'unsupported-protocol'
  | 'missing-host'
  | 'credentials-blocked';

export interface IHyperlinkUrlAnalysis {
  readonly input: string;
  readonly normalizedUrl: string;
  readonly protocol: string;
  readonly hostname: string;
  readonly openable: boolean;
  readonly level: HyperlinkUrlSecurityLevel;
  readonly reason: HyperlinkUrlSecurityReason;
}

/**
 * 分析一个超链接地址：只接受 http(s)，拒绝携带凭据的 URL；
 * 打开路径统一为 `shell:openExternal`（14-资源打开与默认处理器契约 §8.5.2）。
 */
export function analyzeHyperlinkUrl(value: unknown): IHyperlinkUrlAnalysis {
  const input = typeof value === 'string' ? value.trim() : '';
  if (input.length === 0) {
    return {
      input,
      normalizedUrl: '',
      protocol: '',
      hostname: '',
      openable: false,
      level: 'empty',
      reason: 'empty',
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    // WHATWG 解析器对特殊协议的空主机（如 `https://`）直接抛错；
    // `scheme://` 后主机为空的输入按 missing-host 归一，其余判 invalid。
    const schemeOnly = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?:[/?#:]|$)/.exec(input);
    if (schemeOnly !== null) {
      return {
        input,
        normalizedUrl: '',
        protocol: `${schemeOnly[1]!.toLowerCase()}:`,
        hostname: '',
        openable: false,
        level: 'blocked',
        reason: 'missing-host',
      };
    }
    return {
      input,
      normalizedUrl: '',
      protocol: '',
      hostname: '',
      openable: false,
      level: 'blocked',
      reason: 'invalid',
    };
  }

  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.trim();

  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      level: 'blocked',
      reason: 'unsupported-protocol',
    };
  }
  if (hostname.length === 0) {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      level: 'blocked',
      reason: 'missing-host',
    };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      level: 'blocked',
      reason: 'credentials-blocked',
    };
  }

  const normalizedUrl = url.toString();
  if (protocol === 'http:') {
    return {
      input,
      normalizedUrl,
      protocol,
      hostname,
      openable: true,
      level: 'warning',
      reason: 'insecure-http',
    };
  }
  return {
    input,
    normalizedUrl,
    protocol,
    hostname,
    openable: true,
    level: 'secure',
    reason: 'secure',
  };
}

/** 归一一个可打开的 URL；不可打开时原样返回输入，便于编辑器继续编辑。 */
export function normalizeHyperlinkUrl(value: unknown): string {
  const input = typeof value === 'string' ? value : '';
  const analysis = analyzeHyperlinkUrl(input);
  return analysis.openable ? analysis.normalizedUrl : input.trim();
}

// ---------- 归一与校验 ----------

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeDensity(value: unknown): HyperlinkDisplayDensity {
  return value === 'compact' || value === 'comfortable' || value === 'spacious'
    ? value
    : DEFAULT_CONFIG.display_density;
}

/**
 * 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。
 */
export function readConfig(input: unknown): IHyperlinkConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    anchor_text: asString(record['anchor_text'])?.trim() ?? DEFAULT_CONFIG.anchor_text,
    url: normalizeHyperlinkUrl(record['url']),
    description: asString(record['description']) ?? DEFAULT_CONFIG.description,
    icon_url: normalizeHyperlinkUrl(record['icon_url']),
    display_density: normalizeDensity(record['display_density']),
    show_security_hint:
      asBoolean(record['show_security_hint']) ?? DEFAULT_CONFIG.show_security_hint,
  };
}

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`；判定与 `assets/schemas/hyperlink-card-config.schema.json` 同口径。
 *
 * 口径说明：schema 未设 `required`，字段缺省即由 readConfig 回退默认值（08 §2.4.4 规则 2：
 * `createInitialContent` 产出的初始内容必须可通过），因此按"出现即校验"执行：
 * 字段缺席不阻断，字段出现则类型必须合法；非空 `url` / `icon_url` 须为可打开的 http(s)
 * 地址，比 schema（仅类型约束）更严，属于 §7.3 允许的业务补充校验。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;
  const anchorText = record['anchor_text'];
  if (anchorText !== undefined && typeof anchorText !== 'string') {
    return false;
  }
  const url = record['url'];
  if (url !== undefined) {
    if (typeof url !== 'string') {
      return false;
    }
    if (url.trim().length > 0 && !analyzeHyperlinkUrl(url).openable) {
      return false;
    }
  }
  const description = record['description'];
  if (description !== undefined && typeof description !== 'string') {
    return false;
  }
  const iconUrl = record['icon_url'];
  if (iconUrl !== undefined) {
    if (typeof iconUrl !== 'string') {
      return false;
    }
    if (iconUrl.trim().length > 0 && !analyzeHyperlinkUrl(iconUrl).openable) {
      return false;
    }
  }
  const density = record['display_density'];
  if (
    density !== undefined &&
    density !== 'compact' &&
    density !== 'comfortable' &&
    density !== 'spacious'
  ) {
    return false;
  }
  const showSecurityHint = record['show_security_hint'];
  if (showSecurityHint !== undefined && typeof showSecurityHint !== 'boolean') {
    return false;
  }
  return true;
}

// ---------- 内容组装 ----------

/**
 * 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。
 */
export function buildContent(config: IHyperlinkConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}

/**
 * 查看态安全提示文案（简体中文直写；按 reason 与打开能力归一）。
 */
export function securityHintText(analysis: IHyperlinkUrlAnalysis): string {
  if (!analysis.openable) {
    if (analysis.reason === 'empty') {
      return '尚未填写链接地址';
    }
    if (analysis.reason === 'credentials-blocked') {
      return '链接携带登录凭据，已禁止打开';
    }
    return '链接地址无效，无法打开';
  }
  if (analysis.reason === 'insecure-http') {
    return '不安全的 HTTP 链接，请确认后再打开';
  }
  return '安全的 HTTPS 链接';
}
