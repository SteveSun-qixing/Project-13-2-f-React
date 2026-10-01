/**
 * Milkdown 解析侧归一（remark AST 层；清单 §2.14 同源边界的引擎侧实现位）。
 *
 * 两项归一，全部只作用于 Milkdown 解析管线，序列化仍按 mdast 语义输出：
 * - **图片属性空值防御**：remark 出料的 mdast `image` 节点 `alt` / `title` 缺省为
 *   `null`，而 preset-commonmark 的 image schema 以 `validate: "string"` 承载
 *   （7.22.2 上游行为：null 触发属性校验 RangeError 且图片节点被静默丢弃）——
 *   归一为空串后序列化按无 alt/title 形态输出（mdast-util-to-markdown 对空串
 *   title 不产出 `""` 段），查看态与编辑态对同一 `content_text` 的图片引用保真
 *   （resource-links 的图片扫描口径依赖该行为）；
 * - **容器位 html 归一**：preset-commonmark 内建 `html` schema 为 inline 组
 *   （原始 HTML 全程按原文保真，与查看态 `html:false` 转义呈现同源），顶层/
 *   块容器位的 html 节点归一包入段落内联位；序列化仍输出裸 html 节点，字节语义不变。
 */

import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { $remark } from '@milkdown/kit/utils';

/** mdast 节点的最小结构视图（字段按未知输入防御读取与回写）。 */
interface IMdastNodeLike {
  type: string;
  alt?: unknown;
  title?: unknown;
  children?: IMdastNodeLike[];
}

/** html 节点天然处于内联位的父节点类型（其余容器位一律归一包入段落）。 */
const INLINE_PARENT_TYPES: ReadonlySet<string> = new Set(['paragraph', 'heading', 'tableCell']);

/** 递归归一：图片空属性回填空串；容器位 html 包入段落。 */
function normalizeNode(node: IMdastNodeLike): void {
  if (node.type === 'image') {
    if (node.alt === null || node.alt === undefined) {
      node.alt = '';
    }
    if (node.title === null || node.title === undefined) {
      node.title = '';
    }
  }
  const children = node.children;
  if (children === undefined) {
    return;
  }
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child === undefined) {
      continue;
    }
    if (child.type === 'html' && !INLINE_PARENT_TYPES.has(node.type)) {
      children[index] = { type: 'paragraph', children: [child] };
    }
    normalizeNode(child);
  }
}

const parseNormalizeRemark = $remark('chipsParseNormalize', () => () => (tree) => {
  normalizeNode(tree);
});

/** 解析侧归一插件（engine 唯一装配点消费；options 切片须先于插件本体注册）。 */
export const parseNormalize: MilkdownPlugin[] = [parseNormalizeRemark.options, parseNormalizeRemark.plugin];
