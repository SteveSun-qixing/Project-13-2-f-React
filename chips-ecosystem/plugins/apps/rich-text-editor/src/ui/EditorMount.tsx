import React from 'react';
import type { BaseCardView, IBaseCardEditor } from '@chips/sdk';
import { renderEditor } from '@chips/plugin-richtext';

/**
 * 插件正式编辑器挂载点（编辑臂）。
 *
 * 消费 `@chips/plugin-richtext` 公开导出 `renderEditor`（08-基础卡片插件接口 §2.4.2 唯一
 * 装配点；内部唯一持有 Milkdown 引擎装配，《08-官方应用功能总览》§十二「不重写富文本编辑
 * 运行时，直接调用富文本基础卡片的正式编辑器能力」；G9 复用白名单在册）。本组件只承载
 * 容器生命周期：视图变化时释放旧实例并重挂；释放句柄幂等，卸载即 `dispose()`（丢弃待提交
 * 变更且不发布事件，08 §4.3 规则 9）。
 */

export interface EditorMountProps {
  /** 编辑基线视图（只读快照；实例生命周期内不变，基线替换经重挂载承载）。 */
  readonly view: BaseCardView;
  /** 编辑句柄就绪回调（会话经它附着回流时序）。 */
  readonly onAttach: (editor: IBaseCardEditor) => void;
  /** 编辑句柄释放回调（重挂载/卸载前解除会话附着）。 */
  readonly onDetach: () => void;
}

export const EditorMount: React.FC<EditorMountProps> = ({ view, onAttach, onDetach }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const attachRef = React.useRef(onAttach);
  attachRef.current = onAttach;
  const detachRef = React.useRef(onDetach);
  detachRef.current = onDetach;

  React.useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const editor = renderEditor(view, host);
    attachRef.current(editor);
    return () => {
      detachRef.current();
      editor.dispose();
    };
  }, [view]);

  return <div data-testid="editor-mount" style={{ width: '100%', minHeight: 0 }} ref={hostRef} />;
};
