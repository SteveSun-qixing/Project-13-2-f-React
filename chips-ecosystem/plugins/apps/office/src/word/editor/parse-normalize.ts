/**
 * word 编辑引擎解析侧归一（清单 §2.14 同源边界的引擎侧实现位；richtext 判例同构）。
 *
 * 与 `plugins/basecards/richtext/src/milkdown/parse-normalize.ts` 同一套两项归一
 * （消费臂随行同款归一是 §2.14 风险①的显式义务；richtext 公开导出面不含引擎内件，
 * word 域按同构实现收口，装配唯一口径不跨包复制）：
 * - **图片属性空值防御**：remark 出料的 mdast `image` 节点 `alt` / `title` 缺省为
 *   `null`，而 preset-commonmark 的 image schema 以 `validate: "string"` 承载
 *   （7.22.2 上游行为：null 触发属性校验 RangeError 且图片节点被静默丢弃）——
 *   归一为空串后序列化按无 alt/title 形态输出；
 * - **容器位 html 归一**：内建 `html` schema 为 inline 组，顶层/块容器位的 html
 *   节点归一包入段落内联位；序列化仍输出裸 html 节点，字节语义不变。
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

const parseNormalizeRemark = $remark('chipsWordParseNormalize', () => () => (tree) => {
  normalizeNode(tree);
});

/** 解析侧归一插件（word 引擎唯一装配点消费；options 切片须先于插件本体注册）。 */
export const parseNormalize: MilkdownPlugin[] = [parseNormalizeRemark.options, parseNormalizeRemark.plugin];
