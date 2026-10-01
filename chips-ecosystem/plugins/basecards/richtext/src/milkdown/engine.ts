/**
 * Milkdown 编辑引擎装配（RA-11 运行时依赖；@milkdown/kit 子路径最小集，装配唯一口径）。
 *
 * 装配集（清单 §2.14 同源边界）：
 * - commonmark + GFM 预设：`singleTilde: false` 与查看态 markdown 服务（markdown-it，
 *   html:false，GFM 双波浪删除线）同一方言；原始 HTML 由 preset-commonmark 内建
 *   `html` schema 原文保真承载，解析侧归一（./parse-normalize）补齐容器位与图片空属性；
 * - listener：文档事务 → remark 序列化 → `normalizeMarkdown`（与 readContent 同一
 *   归一口径）→ onMarkdownChange 回流；编辑器不写文件（08-基础卡片插件接口 §4.3）。
 *
 * 五项扩展语法（`==高亮==` / `++下划线++` / `^上标^` / `~下标~` / `$数学$`）不装配富渲染臂：
 * 渲染链无承载面，编辑态富渲染将造成查看态↔编辑态双态漂移；两态一致按纯文本呈现 +
 * 能力降级提示（../markdown/capabilities），待渲染链扩展臂统一收口。
 */

import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core';
import type { Editor as MilkdownEditor } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm, remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { TextSelection } from '@milkdown/kit/prose/state';
import { replaceAll } from '@milkdown/kit/utils';
import { normalizeMarkdown } from '../markdown/content';
import { parseNormalize } from './parse-normalize';

export type { MilkdownEditor };

/** 引擎装配选项：挂载宿主、编辑基线 Markdown 与序列化回流回调。 */
export interface IRichTextEngineOptions {
  /** ProseMirror 实例挂载宿主（编辑面板就近容器内的编辑面）。 */
  host: HTMLElement;
  /** 编辑基线 Markdown 源文（已归一）。 */
  defaultValue: string;
  /** 文档事务的序列化回流回调（入参已按查看态口径归一）。 */
  onMarkdownChange: (markdown: string) => void;
}

/**
 * 创建富文本编辑引擎实例（装载唯一入口）。
 *
 * ProseMirror 编辑面挂载于 `options.host`；GFM 双波浪删除线与查看态同源；
 * 装载完成后监听文档事务，把序列化 Markdown 经 `normalizeMarkdown` 归一后回流。
 */
export async function createRichTextEditor(options: IRichTextEngineOptions): Promise<MilkdownEditor> {
  const created = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.host);
      ctx.set(defaultValueCtx, options.defaultValue);
      ctx.set(remarkGFMPlugin.options.key, { singleTilde: false });
      ctx.update(editorViewOptionsCtx, (prev) => ({
        ...prev,
        attributes: {
          ...(typeof prev.attributes === 'object' && prev.attributes !== null ? prev.attributes : {}),
          spellcheck: 'true',
          autocapitalize: 'off',
          autocorrect: 'off',
          translate: 'no',
        },
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(parseNormalize)
    .use(listener)
    .create();

  created.action((ctx) => {
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
      options.onMarkdownChange(normalizeMarkdown(markdown));
    });
  });
  return created;
}

/** 把焦点移入 ProseMirror 编辑面（`IBaseCardEditor.focus` 的引擎臂）。 */
export function focusRichTextEditor(editor: MilkdownEditor): void {
  editor.action((ctx) => {
    ctx.get(editorViewCtx).focus();
  });
}

/**
 * 程序化编辑入口：在首个文本块选择处插入文本（宿主驱动/测试面；
 * 与键入同一事务路径：transaction → state → listener 序列化回流）。
 */
export function insertTextIntoRichTextEditor(editor: MilkdownEditor, text: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const selection = TextSelection.near(state.doc.resolve(0), 1);
    view.dispatch(state.tr.setSelection(selection).insertText(text));
  });
}

/**
 * 程序化全文替换：以 Markdown 源文整体替换文档（宿主驱动/测试面；
 * 与 `update()` 基线替换同构，经同一事务路径触发序列化回流）。
 */
export function replaceRichTextDocument(editor: MilkdownEditor, markdown: string): void {
  editor.action(replaceAll(normalizeMarkdown(markdown)));
}
