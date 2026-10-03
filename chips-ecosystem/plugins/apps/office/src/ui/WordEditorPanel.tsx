import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoxEmptyState, Button, Input, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import type { WordDocument } from '../word/domain/document-model';
import { markdownToDocument } from '../word/domain/markdown-mapping';
import { countDocumentStatistics } from '../word/domain/text-statistics';
import {
  createWordDocumentEditor,
  focusWordDocumentEditor,
  type MilkdownEditor,
} from '../word/editor/engine';
import {
  importWordDocumentFromPath,
  persistWordDocument,
  type WordCapabilityRequest,
} from '../word/session/save-chain';

/** word 域编辑会话的装载阶段。 */
type WordSessionPhase = 'idle' | 'importing' | 'editing';

/** word 域面板属性：能力调用形可注入（生产装配缺省经 `chips.request` 正式能力链）。 */
export interface WordEditorPanelProps {
  readonly request?: WordCapabilityRequest;
}

/**
 * word 域编辑挂载面：导入（file:read 真调）→ Milkdown 编辑 → 保存落盘（file:write 真调）。
 *
 * 编辑引擎为统一编辑引擎 Milkdown（清单 §2.14）；Markdown 唯一编辑表示，保存时经
 * 域映射再入域模型并序列化 docx。能力失败如实回显错误码，不伪造成功（icon-maker 落盘臂判例）。
 */
export const WordEditorPanel: React.FC<WordEditorPanelProps> = ({ request }) => {
  const invoke = useMemo<WordCapabilityRequest>(
    () => request ?? ((capability: string, payload: unknown): Promise<unknown> => chips.request(capability, payload)),
    [request],
  );
  const { token } = theme.useToken();
  const [phase, setPhase] = useState<WordSessionPhase>('idle');
  const [importPath, setImportPath] = useState('');
  const [savePath, setSavePath] = useState('');
  const [document, setDocument] = useState<WordDocument | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [savedMarkdown, setSavedMarkdown] = useState('');
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<MilkdownEditor | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  /** 编辑面装载：进入编辑态后对宿主容器装配引擎一次；卸载即销毁（释放幂等）。 */
  useEffect(() => {
    if (phase !== 'editing' || hostRef.current === null) {
      return;
    }
    let disposed = false;
    let instance: MilkdownEditor | null = null;
    void (async (): Promise<void> => {
      const host = hostRef.current;
      if (host === null) {
        return;
      }
      try {
        instance = await createWordDocumentEditor({
          host,
          defaultValue: savedMarkdown,
          onMarkdownChange: (next) => {
            if (!disposed) {
              setMarkdown(next);
            }
          },
        });
        if (disposed) {
          void instance.destroy();
          instance = null;
          return;
        }
        setEditorInstance(instance);
        focusWordDocumentEditor(instance);
      } catch (error: unknown) {
        if (!disposed) {
          setStatusLine(
            '编辑器装载失败：' +
              (typeof error === 'object' && error !== null && 'message' in error
                ? String(error.message)
                : '未知错误'),
          );
        }
      }
    })();
    return () => {
      disposed = true;
      if (instance !== null) {
        void instance.destroy();
      }
      setEditorInstance(null);
    };
  }, [phase, savedMarkdown]);

  const handleImport = useCallback(async (): Promise<void> => {
    const trimmedPath = importPath.trim();
    if (trimmedPath.length === 0) {
      setStatusLine('请先填写要打开的 .docx 路径。');
      return;
    }
    setPhase('importing');
    setStatusLine(null);
    const result = await importWordDocumentFromPath(invoke, trimmedPath);
    if (result.status === 'failed') {
      setPhase(document === null ? 'idle' : 'editing');
      setStatusLine(`导入失败（${result.errorCode}）：${result.message}`);
      return;
    }
    setDocument(result.document);
    setMarkdown(result.markdown);
    setSavedMarkdown(result.markdown);
    setSavePath(result.path);
    setPhase('editing');
    setStatusLine(`已导入：${result.path}`);
  }, [document, importPath, invoke]);

  const handleSave = useCallback(async (): Promise<void> => {
    const trimmedPath = savePath.trim();
    if (trimmedPath.length === 0) {
      setStatusLine('请先填写保存目标路径。');
      return;
    }
    const current = markdownToDocument(markdown);
    setDocument(current);
    const result = await persistWordDocument(invoke, trimmedPath, current);
    if (result.status === 'failed') {
      setStatusLine(`保存失败（${result.errorCode}）：${result.message}`);
      return;
    }
    setSavedMarkdown(markdown);
    setStatusLine(`已保存：${result.path}`);
  }, [invoke, markdown, savePath]);

  const dirty = useMemo(() => markdown !== savedMarkdown, [markdown, savedMarkdown]);
  const statistics = useMemo(() => countDocumentStatistics(markdownToDocument(markdown)), [markdown]);

  if (phase !== 'editing') {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
        <p style={{ margin: 0, color: token.colorTextSecondary }}>
          迁移状态：领域逻辑与编辑面已迁移（统一编辑引擎 Milkdown；docx 字节级读写网关已就位）
        </p>
        <p style={{ margin: 0 }}>
          打开本机 .docx（file:read 正式能力链）进入编辑；保存经 file:write 正式能力链落盘。
          受控提交编排归 file-processing 服务（在途），能力未就绪时如实回码。
        </p>
        <div style={{ display: 'flex', gap: token.marginXS }}>
          <Input
            style={{ maxWidth: 420 }}
            value={importPath}
            placeholder="例如 ~/文档/示例.docx"
            onChange={(event) => setImportPath(event.target.value)}
          />
          <Button onClick={() => void handleImport()} disabled={phase === 'importing'}>
            {phase === 'importing' ? '导入中' : '打开文档'}
          </Button>
        </div>
        {statusLine === null ? null : <p style={{ margin: 0 }}>{statusLine}</p>}
        <BoxEmptyState
          title="尚未打开文档"
          description="输入 .docx 路径后打开，编辑面将装配统一编辑引擎 Milkdown。"
          compact
        />
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: token.marginXS }}>
        <Input
          style={{ maxWidth: 420 }}
          value={savePath}
          onChange={(event) => setSavePath(event.target.value)}
        />
        <Button onClick={() => void handleSave()}>保存 docx</Button>
        <span style={{ color: token.colorTextSecondary }}>
          字数 {statistics.words} · 字符 {statistics.characters} ·{' '}
          {dirty ? '有未保存变更' : '与上次保存一致'}
        </span>
      </div>
      {statusLine === null ? null : <p style={{ margin: 0 }}>{statusLine}</p>}
      <div
        ref={hostRef}
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: token.padding,
          minHeight: 320,
        }}
      />
      {editorInstance === null ? <p style={{ margin: 0 }}>编辑器装载中</p> : null}
    </section>
  );
};

export default WordEditorPanel;
