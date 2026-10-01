import type { ReactElement } from 'react';
import React from 'react';
import { Form, Input, theme } from '@chips/ui';
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
  buildContent,
  inlineStorageGate,
  readContent,
  readDisplayConfig,
} from './config';
import { hasMeaningfulMarkdownContent, MAX_INLINE_RICHTEXT_LENGTH, normalizeMarkdown } from './markdown/content';
import { capabilityNoticeText, unsupportedDeclaredCapabilities } from './markdown/capabilities';
import { createRichTextEditor } from './milkdown/engine';
import type { MilkdownEditor } from './milkdown/engine';

/**
 * 编辑态视图（08-基础卡片插件接口 §2.4.2、04-基础卡片插件开发指南 §五）。
 *
 * 编辑引擎 = Milkdown（用户裁决 2026-10-01 第 3 项；RA-11 登记在册）：
 * ProseMirror 实例挂载 + commonmark/GFM 预设 + remark 序列化，Markdown 唯一持久化，
 * 序列化与查看态同一归一口径（`normalizeMarkdown`）。装配唯一口径见 ./milkdown/engine。
 *
 * 变更形态按来源分流（08 §4.3）：
 * - inline 来源：`replace` 提交完整内容（正文 + 展示配置，locale 与能力矩阵原样保留）；
 * - file 来源：正文读取通道未接线（在册缺位），编辑器**不得**以不可读的正文回写覆盖
 *   `content_file`，只以 `patch` 提交 `config` 子树增量，且不挂载正编辑面。
 *
 * 编辑回流走 `IBaseCardEditor` 唯一时序：视图只发布草稿，待提交变更、事件与
 * markCommitted 由编辑句柄（./render）统一维护。
 */

/** 编辑器草稿：正文与展示配置的完整快照。 */
export interface IRichTextDraft {
  contentText: string;
  fontSize: number;
  lineHeight: number;
}

interface IRichTextEditorViewProps {
  /** 编辑基线的内容根（已归一）。 */
  content: Record<string, unknown>;
  /** 来源形态（决定变更形态分流与正编辑面挂载）。 */
  contentSource: 'inline' | 'file';
  /** 表单值变化回调；由编辑句柄统一维护待提交变更。 */
  onDraftChange: (draft: IRichTextDraft) => void;
  /** Milkdown 引擎就绪回调；编辑句柄经它持有引擎引用（focus 与程序化编辑面）。 */
  onMilkdownReady: (editor: MilkdownEditor) => void;
}

/** Milkdown 编辑面挂载宿主的类名（结构钩子，非视觉样式）。 */
const EDITOR_HOST_CLASS = 'chips-richtext-card__editor-host';

interface IMilkdownBodyEditorProps {
  /** 编辑基线 Markdown 源文（已归一；实例生命周期内不变，基线替换经句柄 update 重挂载）。 */
  defaultValue: string;
  /** 文档事务序列化回流（engine 已按查看态口径归一）。 */
  onMarkdownChange: (markdown: string) => void;
  /** 引擎就绪回调。 */
  onReady: (editor: MilkdownEditor) => void;
}

/**
 * Milkdown 编辑面：挂载宿主 div 并在其上创建 ProseMirror 实例。
 *
 * 生命周期纪律：卸载或基线替换时销毁引擎实例（`dispose()` 释放全部资源，
 * 08 §4.4）；异步装载完成前卸载的实例在创建完成后立即销毁，不触碰已卸载宿主。
 */
function MilkdownBodyEditor({ defaultValue, onMarkdownChange, onReady }: IMilkdownBodyEditorProps): ReactElement {
  const { token } = theme.useToken();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const markdownChangeRef = React.useRef(onMarkdownChange);
  markdownChangeRef.current = onMarkdownChange;
  const readyRef = React.useRef(onReady);
  readyRef.current = onReady;

  React.useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    let instance: MilkdownEditor | null = null;
    let cancelled = false;
    void createRichTextEditor({ host, defaultValue, onMarkdownChange: markdownChangeRef.current }).then(
      (created) => {
        if (cancelled) {
          void created.destroy();
          return;
        }
        instance = created;
        // 引擎就绪标记（结构钩子）：装载完成（含 listener 回流接线）后置位。
        if (hostRef.current !== null) {
          hostRef.current.dataset['engineReady'] = 'true';
        }
        readyRef.current(created);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
      if (instance !== null) {
        void instance.destroy();
        instance = null;
      }
    };
  }, [defaultValue]);

  return (
    <div
      ref={hostRef}
      className={EDITOR_HOST_CLASS}
      style={{
        width: '100%',
        minHeight: 96,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        padding: `${token.paddingSM}px ${token.padding}px`,
        boxSizing: 'border-box',
      }}
    />
  );
}

/** 正数归一：空值与非法值回退当前值（04 §9.6 toPositiveNumber 同型）。 */
function toPositiveNumber(value: unknown, fallback: number): number {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 编辑态视图：Milkdown 正编辑面（inline）或缺位状态行（file）+ 展示配置表单。
 *
 * 草稿合并口径：正文（Milkdown 序列化）与展示配置两路变化都发布完整草稿快照，
 * 由编辑句柄统一构建待提交变更（同一事务/帧内的多次编辑合并为一次变更发布）。
 */
export function RichTextEditorView({
  content,
  contentSource,
  onDraftChange,
  onMilkdownReady,
}: IRichTextEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readContent(content);
  const displayConfig = readDisplayConfig(content);
  const initialText = resolved.content_text ?? '';
  const latest = React.useRef<IRichTextDraft>({
    contentText: initialText,
    fontSize: displayConfig.fontSize,
    lineHeight: displayConfig.lineHeight,
  });
  const [markdown, setMarkdown] = React.useState<string>(initialText);

  const publish = (): void => {
    onDraftChange({ ...latest.current });
  };

  const handleMarkdownChange = (nextMarkdown: string): void => {
    latest.current.contentText = nextMarkdown;
    setMarkdown(nextMarkdown);
    publish();
  };

  const handleValuesChange = (
    _changed: Partial<Record<string, unknown>>,
    values: { fontSize?: unknown; lineHeight?: unknown }
  ): void => {
    latest.current.fontSize = toPositiveNumber(values.fontSize, latest.current.fontSize);
    latest.current.lineHeight = toPositiveNumber(values.lineHeight, latest.current.lineHeight);
    publish();
  };

  const gate = inlineStorageGate(markdown);
  const notice = capabilityNoticeText(unsupportedDeclaredCapabilities(resolved.markdown_capabilities));

  return (
    <div
      style={{
        width: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.paddingSM,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
      }}
    >
      {contentSource === 'file' ? (
        <p
          role="status"
          style={{
            margin: 0,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          文件来源正文（{resolved.content_file}）读取通道未接入，当前仅可调整展示配置
        </p>
      ) : (
        <>
          <div
            style={{
              color: token.colorText,
              fontSize: displayConfig.fontSize,
              lineHeight: String(displayConfig.lineHeight),
              overflowWrap: 'anywhere',
            }}
          >
            <MilkdownBodyEditor
              defaultValue={initialText}
              onMarkdownChange={handleMarkdownChange}
              onReady={onMilkdownReady}
            />
          </div>
          <p
            role="status"
            data-testid="richtext-inline-gate"
            style={{
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
            }}
          >
            {gate.shouldUseFile
              ? `已提取纯文本 ${String(gate.length)} 字，超过 ${String(MAX_INLINE_RICHTEXT_LENGTH)} 字阈值，保存时正文将文件化存储为卡片内 .md 文件`
              : `已提取纯文本 ${String(gate.length)} 字（≤${String(MAX_INLINE_RICHTEXT_LENGTH)} 字阈值内内联保存）`}
          </p>
          {notice.length > 0 ? (
            <p
              style={{
                margin: 0,
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              {notice}
            </p>
          ) : null}
        </>
      )}
      <Form
        layout="vertical"
        initialValues={{
          fontSize: displayConfig.fontSize,
          lineHeight: displayConfig.lineHeight,
        }}
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="字号（px）" name="fontSize">
          <Input type="number" min={MIN_FONT_SIZE} max={MAX_FONT_SIZE} />
        </Form.Item>
        <Form.Item label="行高倍数" name="lineHeight">
          <Input type="number" min={MIN_LINE_HEIGHT} step={0.1} />
        </Form.Item>
      </Form>
    </div>
  );
}

/**
 * 由编辑基线与草稿组装待提交变更（inline → replace / file → config patch）。
 *
 * @param content - 编辑基线内容根
 * @param contentSource - 来源形态
 * @param draft - 表单草稿
 * @returns 变更载荷；inline 且正文无语义内容时返回 `null`（内容校验不过闸，不发变更）
 */
export function buildEditorChange(
  content: Readonly<Record<string, unknown>>,
  contentSource: 'inline' | 'file',
  draft: IRichTextDraft
):
  | { kind: 'replace'; content: Record<string, unknown> }
  | {
      kind: 'patch';
      operations: readonly [
        { op: 'replace'; path: '/config/fontSize'; value: number },
        { op: 'replace'; path: '/config/lineHeight'; value: number },
      ];
    }
  | null {
  if (contentSource === 'inline') {
    if (!hasMeaningfulMarkdownContent(normalizeMarkdown(draft.contentText))) {
      // 与内容校验同口径：无语义内容的正文不发变更（编辑变更允许中间非法态，但不发布不过闸的载荷）。
      return null;
    }
    return {
      kind: 'replace',
      content: buildContent({ ...(content as Record<string, unknown>), content_text: draft.contentText }, {
        fontSize: draft.fontSize,
        lineHeight: draft.lineHeight,
      }),
    };
  }
  return {
    kind: 'patch',
    operations: [
      { op: 'replace', path: '/config/fontSize', value: draft.fontSize },
      { op: 'replace', path: '/config/lineHeight', value: draft.lineHeight },
    ],
  };
}
