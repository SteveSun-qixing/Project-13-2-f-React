/**
 * 原始 HTML 保形（Milkdown 编辑引擎臂；清单 §2.14 同源边界 2 的实现位）。
 *
 * 同源口径：查看态 markdown 服务 `html:false` 把原始 HTML 一律转义为文本呈现；
 * 编辑态同样不解析、不富渲染原始 HTML——preset-commonmark 内建 `html` schema
 * （7.22.2）把 remark `html` mdast 节点承载为原子文本节点并按原文逐字序列化回写，
 * 本模块不重复建 schema，只补齐它在容器位的归一：顶层/块容器位的 html 节点
 * 归一包入段落内联位（schema 组为 inline；归一只发生在解析侧，序列化仍输出裸
 * html 节点，字节语义不变——resource-links 的 `<img src>` / `<a href>` 扫描口径
 * 依赖该保真）。
 */

import { $remark } from '@milkdown/kit/utils';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';

/** mdast 节点的最小结构视图（`children` 按未知输入防御读取）。 */
interface IMdastNodeLike {
  type: string;
  children?: IMdastNodeLike[];
}

/** html 节点天然处于内联位的父节点类型（其余容器位一律归一包入段落）。 */
const INLINE_PARENT_TYPES: ReadonlySet<string> = new Set(['paragraph', 'heading', 'tableCell']);

/** 归一容器位上的 html 节点为段落内联位；递归处理，不改写其余结构。 */
function normalizeHtmlPlacement(node: IMdastNodeLike): void {
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
    normalizeHtmlPlacement(child);
  }
}

/**
 * 解析侧归一插件：容器位 html → 段落内联位（对齐 preset-commonmark 内建
 * `html` schema 的 inline 组），与查看态 `html:false` 的转义呈现同源。
 */
const wrapBlockHtmlToParagraph = $remark('chipsWrapBlockHtml', () => () => (tree) => {
  normalizeHtmlPlacement(tree as IMdastNodeLike);
});

/** 原始 HTML 保形插件（engine 唯一装配点消费）。 */
export const htmlPreserve: MilkdownPlugin[] = [wrapBlockHtmlToParagraph.plugin];
