/**
 * 评分基础卡片配置模型（08-基础卡片插件接口 §7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、计分比率（getScoreRatio）、
 * 字段级中文错误（collectConfigErrors）与内容校验（validateConfig），与
 * `assets/schemas/score-card-config.schema.json` 保持同一口径
 * （08 §7.3：validateConfig 不得比 schema 宽松；符号样式的五分制约束为业务补充校验）。
 *
 * 旧族语义迁移（Chips-BaseCardPlugin/score-BCP src/schema/card-config.ts）：
 * 星星/爱心固定五分制且分数取整；数值样式总分 1–100000、分数钳制在 [0, 总分]；
 * 数字字符串按数值解析。`card_type` / `theme` / `locale` 不再入 config
 * （card_type 归一为 `base.score` 并以 manifest aliases 保留兼容读；主题与多语言已随 task030 废弃）。
 */

/** 展示样式：星星、爱心、分数、进度条。 */
export type ScoreStyle = 'stars' | 'hearts' | 'score' | 'progress';

/** 评分卡片配置。 */
export interface IScoreConfig {
  style: ScoreStyle;
  score: number;
  total_score: number;
}

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致）。 */
export const CARD_TYPE_ID = 'base.score';

/** 符号样式（星星/爱心）固定的五分制总分。 */
export const SYMBOL_SCORE_TOTAL = 5;

/** 数值样式总分下限。 */
export const MIN_TOTAL_SCORE = 1;

/** 数值样式总分上限。 */
export const MAX_TOTAL_SCORE = 100000;

export const SCORE_STYLES: readonly ScoreStyle[] = ['stars', 'hearts', 'score', 'progress'];

/** 样式的简体中文名（编辑面板分段选项与展示态共用）。 */
export const STYLE_LABELS: Readonly<Record<ScoreStyle, string>> = {
  stars: '星星',
  hearts: '爱心',
  score: '分数',
  progress: '进度条',
};

export const DEFAULT_CONFIG: IScoreConfig = {
  style: 'stars',
  score: 0,
  total_score: SYMBOL_SCORE_TOTAL,
};

// ---------- 归一 ----------

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isSymbolScoreStyle(style: ScoreStyle): boolean {
  return style === 'stars' || style === 'hearts';
}

function normalizeStyle(value: unknown): ScoreStyle {
  return SCORE_STYLES.includes(value as ScoreStyle) ? (value as ScoreStyle) : DEFAULT_CONFIG.style;
}

function normalizeTotalScore(style: ScoreStyle, value: unknown): number {
  if (isSymbolScoreStyle(style)) {
    return SYMBOL_SCORE_TOTAL;
  }
  return clamp(
    asFiniteNumber(value) ?? DEFAULT_CONFIG.total_score,
    MIN_TOTAL_SCORE,
    MAX_TOTAL_SCORE
  );
}

function normalizeScore(style: ScoreStyle, value: unknown, totalScore: number): number {
  const rawScore = clamp(asFiniteNumber(value) ?? DEFAULT_CONFIG.score, 0, totalScore);
  if (isSymbolScoreStyle(style)) {
    return Math.round(rawScore);
  }
  return rawScore;
}

/** 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。 */
export function readConfig(input: unknown): IScoreConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const style = normalizeStyle(record['style']);
  const totalScore = normalizeTotalScore(style, record['total_score']);
  const score = normalizeScore(style, record['score'], totalScore);
  return { style, score, total_score: totalScore };
}

// ---------- 计分 ----------

/**
 * 计分比率：score / total_score 钳制到 [0, 1]；总分非正或非有限时为 0。
 * 查看态进度条与编辑态实时预览的唯一口径。
 */
export function getScoreRatio(config: Pick<IScoreConfig, 'score' | 'total_score'>): number {
  if (!Number.isFinite(config.total_score) || config.total_score <= 0) {
    return 0;
  }
  return clamp(config.score / config.total_score, 0, 1);
}

/** 中文数字格式化：千位分隔、最多两位小数（查看态与编辑态共用）。 */
export function formatScoreNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
}

// ---------- 校验 ----------

/**
 * 字段级中文错误（编辑面板行内提示口径）；空对象即整份配置合法。
 * 入参为归一后配置；schema 之外的业务口径（符号样式五分制整数）在此补充。
 */
export function collectConfigErrors(config: IScoreConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!SCORE_STYLES.includes(config.style)) {
    errors['style'] = '评分样式必须为星星、爱心、分数或进度条。';
  }
  if (!Number.isFinite(config.total_score) || config.total_score < MIN_TOTAL_SCORE) {
    errors['total_score'] = '总分必须大于或等于 1。';
  } else if (config.total_score > MAX_TOTAL_SCORE) {
    errors['total_score'] = `总分不能超过 ${formatScoreNumber(MAX_TOTAL_SCORE)}。`;
  }
  if (!Number.isFinite(config.score) || config.score < 0) {
    errors['score'] = '获得分数必须大于或等于 0。';
  } else if (Number.isFinite(config.total_score) && config.score > config.total_score) {
    errors['score'] = '获得分数不能超过总分。';
  }
  if (SCORE_STYLES.includes(config.style) && isSymbolScoreStyle(config.style)) {
    if (config.total_score !== SYMBOL_SCORE_TOTAL) {
      errors['total_score'] = '星星和爱心评分固定为五分制。';
    }
    if (!Number.isInteger(config.score)) {
      errors['score'] = '星星和爱心评分必须为整数。';
    }
  }
  return errors;
}

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`；判定与 `assets/schemas/score-card-config.schema.json` 同口径。
 *
 * 口径说明：schema 未设 `required`，字段缺省即由 readConfig 回退默认值（08 §2.4.4 规则 2：
 * `createInitialContent` 产出的初始内容必须可通过），因此按"出现即校验"执行：
 * 字段缺席不阻断，字段出现则类型必须合法；符号样式出现时补充五分制与整数约束、
 * 数值样式补充 `score ≤ total_score`（§7.3 允许的业务补充校验）。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;
  const style = record['style'];
  if (style !== undefined && !SCORE_STYLES.includes(style as ScoreStyle)) {
    return false;
  }
  const totalScore = record['total_score'];
  if (totalScore !== undefined) {
    if (typeof totalScore !== 'number' || !Number.isFinite(totalScore)) {
      return false;
    }
    if (totalScore < MIN_TOTAL_SCORE || totalScore > MAX_TOTAL_SCORE) {
      return false;
    }
  }
  const score = record['score'];
  if (score !== undefined) {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return false;
    }
    if (score < 0) {
      return false;
    }
  }
  const resolvedStyle: ScoreStyle = style === undefined ? DEFAULT_CONFIG.style : (style as ScoreStyle);
  if (isSymbolScoreStyle(resolvedStyle)) {
    if (totalScore !== undefined && totalScore !== SYMBOL_SCORE_TOTAL) {
      return false;
    }
    if (score !== undefined) {
      if (!Number.isInteger(score)) {
        return false;
      }
      if (score > SYMBOL_SCORE_TOTAL) {
        return false;
      }
    }
    return true;
  }
  if (score !== undefined && totalScore !== undefined && score > totalScore) {
    return false;
  }
  return true;
}

// ---------- 内容组装 ----------

/** 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。 */
export function buildContent(config: IScoreConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}
