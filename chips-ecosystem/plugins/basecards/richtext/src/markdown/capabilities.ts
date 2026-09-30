/**
 * Markdown 能力矩阵与渲染链支持面对照（旧 `markdown-extensions.ts` 能力语义的迁移归宿）。
 *
 * 旧实现的扩展语法臂（`==高亮==`、`++下划线++`、`^上标^`、`~下标~`、`$数学$`）绑定
 * Milkdown/remark/katex，随编辑引擎缺位不迁（W4迁移-richtext-开发计划与日志-2026-09-30 §三.2）；
 * 本模块保留其**能力声明语义**：`markdown_capabilities` 是卡片数据的正式字段
 * （01-卡片文件格式 §6.6，必须显式写入），查看态按「声明 × 渲染链支持面」对照，
 * 对暂无承载面的能力如实降级提示——不在卡片侧建第二份 Markdown 渲染器（工单057 §六红线）。
 */

import type { IRichTextMarkdownCapabilities } from '../config';

/** 全部能力键（与 01.12 §6.6 能力矩阵字段一一对应）。 */
export type RichTextCapabilityKey =
  | 'commonmark'
  | 'gfm'
  | 'math'
  | 'highlight'
  | 'underline'
  | 'superscript'
  | 'subscript';

export type { IRichTextMarkdownCapabilities };

/** 能力键全表（稳定顺序，供对照与展示）。 */
export const RICHTEXT_CAPABILITY_KEYS: readonly RichTextCapabilityKey[] = [
  'commonmark',
  'gfm',
  'math',
  'highlight',
  'underline',
  'superscript',
  'subscript',
];

/**
 * 当前渲染链支持面：`chips.service.markdown` 契约（render-html 选项面仅
 * `breaks` / `linkify` / `typographer`）承载 commonmark 与 GFM（表格、删除线）；
 * 五项扩展语法在契约中无承载，属在册缺位（§三.3）。
 */
export const RENDERING_SUPPORTED_CAPABILITIES: Readonly<
  Record<RichTextCapabilityKey, boolean>
> = Object.freeze({
  commonmark: true,
  gfm: true,
  math: false,
  highlight: false,
  underline: false,
  superscript: false,
  subscript: false,
});

/** 能力的简体中文显示名（直写口径）。 */
export const CAPABILITY_LABELS: Readonly<Record<RichTextCapabilityKey, string>> = Object.freeze({
  commonmark: '基础语法',
  gfm: 'GFM 扩展',
  math: '数学公式',
  highlight: '高亮标记',
  underline: '下划线',
  superscript: '上标',
  subscript: '下标',
});

/**
 * 对照声明能力与渲染链支持面，给出声明了但渲染链暂不承载的能力键。
 *
 * @param capabilities - 卡片内容声明的 Markdown 能力矩阵
 * @returns 声明了且渲染链暂不承载的能力键（稳定顺序）
 */
export function unsupportedDeclaredCapabilities(
  capabilities: IRichTextMarkdownCapabilities
): RichTextCapabilityKey[] {
  return RICHTEXT_CAPABILITY_KEYS.filter(
    (key) => capabilities[key] === true && RENDERING_SUPPORTED_CAPABILITIES[key] === false
  );
}

/**
 * 查看态能力降级提示文案；无缺位能力时返回空串。
 *
 * @param unsupported - 声明了但渲染链暂不承载的能力键
 * @returns 简体中文提示；空串表示无需提示
 */
export function capabilityNoticeText(unsupported: readonly RichTextCapabilityKey[]): string {
  if (unsupported.length === 0) {
    return '';
  }
  const labels = unsupported.map((key) => CAPABILITY_LABELS[key]);
  return `以下扩展语法当前按纯文本呈现：${labels.join('、')}`;
}
