/**
 * word 文本编辑引擎装配（RA-11 Milkdown；richtext 判例
 * `plugins/basecards/richtext/src/milkdown/engine.ts` 同构实现，清单 §2.14 统一编辑引擎）。
 *
 * 装配集（§2.14 同源边界随行）：
 * - commonmark + GFM 预设：`singleTilde: false`（双波浪删除线方言与 remark 出料同源）；
 * - 解析侧归一（./parse-normalize）：§2.14 风险①图片空属性 + 容器位 html，消费臂随行义务；
 * - listener：文档事务 → remark 序列化 → `normalizeMarkdown` 归一 → onMarkdownChange
 *   回流（Markdown 唯一编辑表示；word 域编辑器不写文件，落盘唯一出口归 ./../session/save-chain）。
 *
 * 序列化归一口径：`normalizeMarkdown`（换行/行尾空白/多余空行收敛）为域内自持同构实现，
 * 规则与 richtext 卡逐字一致（§2.14 风险③：remark 规范形态须经归一后回流，禁止字节级 diff）。
 */

import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core';
import type { Editor as MilkdownEditor } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm, remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { TextSelection } from '@milkdown/kit/prose/state';
import { replaceAll } from '@milkdown/kit/utils';
import { parseNormalize } from './parse-normalize';

export type { MilkdownEditor };

/** 编辑基线 Markdown 的序列化归一（word 域内同构实现，规则与查看态口径一致）。 */
export function normalizeWordMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+$/gm, '')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 引擎装配选项：挂载宿主、编辑基线 Markdown 与序列化回流回调。 */
export interface IWordEditorOptions {
  /** ProseMirror 实例挂载宿主（word 编辑面就近容器内的编辑面）。 */
  host: HTMLElement;
  /** 编辑基线 Markdown 源文（域模型经 documentToMarkdown 出料，已按序列化口径归一）。 */
  defaultValue: string;
  /** 文档事务的序列化回流回调（入参已按归一口径收敛）。 */
  onMarkdownChange: (markdown: string) => void;
}

/**
 * 创建 word 文本编辑引擎实例（装载唯一入口；判例形制同构）。
 *
 * ProseMirror 编辑面挂载于 `options.host`；装载完成后监听文档事务，把序列化
 * Markdown 经 `normalizeWordMarkdown` 归一后回流。
 */
export async function createWordDocumentEditor(options: IWordEditorOptions): Promise<MilkdownEditor> {
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
      options.onMarkdownChange(normalizeWordMarkdown(markdown));
    });
  });
  return created;
}

/** 把焦点移入 ProseMirror 编辑面。 */
export function focusWordDocumentEditor(editor: MilkdownEditor): void {
  editor.action((ctx) => {
    ctx.get(editorViewCtx).focus();
  });
}

/**
 * 程序化编辑入口：在首个文本块选择处插入文本（宿主驱动/测试面；
 * 与键入同一事务路径：transaction → state → listener 序列化回流）。
 */
export function insertTextIntoWordDocumentEditor(editor: MilkdownEditor, text: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const selection = TextSelection.near(state.doc.resolve(0), 1);
    view.dispatch(state.tr.setSelection(selection).insertText(text));
  });
}

/**
 * 程序化全文替换：以 Markdown 源文整体替换文档（宿主驱动/测试面；
 * 与键入同一事务路径触发序列化回流）。
 */
export function replaceWordDocument(editor: MilkdownEditor, markdown: string): void {
  editor.action(replaceAll(normalizeWordMarkdown(markdown)));
}
