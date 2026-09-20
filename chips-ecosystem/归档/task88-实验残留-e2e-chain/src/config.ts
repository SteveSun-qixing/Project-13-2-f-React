/** 卡片配置。 */
export interface ICardConfig {
  fontSize: number;
  lineHeight: number;
}

/** 编辑器草稿：正文与两项配置的完整快照。 */
export interface ICardDraft {
  text: string;
  fontSize: number;
  lineHeight: number;
}

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: ICardConfig = { fontSize: 16, lineHeight: 1.6 };
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 48;
export const MIN_LINE_HEIGHT = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 读取正文。
 *
 * @param content - 卡片内容视图
 * @returns 正文字符串；字段缺失或类型异常时为空字符串
 */
export function readText(content: Record<string, unknown>): string {
  return typeof content.content_text === 'string' ? content.content_text : '';
}

/**
 * 读取配置并回退默认值，保证渲染不因配置问题失败。
 *
 * @param content - 卡片内容视图
 * @returns 归一后的配置
 */
export function readConfig(content: Record<string, unknown>): ICardConfig {
  const raw: Record<string, unknown> = isRecord(content.config) ? content.config : {};
  return {
    fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : DEFAULT_CONFIG.fontSize,
    lineHeight: typeof raw.lineHeight === 'number' ? raw.lineHeight : DEFAULT_CONFIG.lineHeight,
  };
}

/**
 * 从内容视图生成编辑器草稿。
 *
 * @param content - 卡片内容视图
 * @returns 初始化表单用的完整草稿
 */
export function readDraft(content: Record<string, unknown>): ICardDraft {
  const config = readConfig(content);
  return { text: readText(content), fontSize: config.fontSize, lineHeight: config.lineHeight };
}

/**
 * 校验卡片配置；与 configSchema 同语义且不得更宽松。
 *
 * 纯函数：同步、无副作用、不抛异常。
 *
 * @param config - 卡片内容 config 字段的原始值
 * @returns 合法返回 true，否则 false
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (!isRecord(config)) {
    return false;
  }

  const fontSize = config.fontSize;
  if (fontSize !== undefined) {
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize)) {
      return false;
    }
    if (fontSize < MIN_FONT_SIZE || fontSize > MAX_FONT_SIZE) {
      return false;
    }
  }

  const lineHeight = config.lineHeight;
  if (lineHeight !== undefined) {
    if (typeof lineHeight !== 'number' || !Number.isFinite(lineHeight)) {
      return false;
    }
    if (lineHeight < MIN_LINE_HEIGHT) {
      return false;
    }
  }

  return true;
}
