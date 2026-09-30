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
import type { IRichTextDisplayConfig } from './config';
import { hasMeaningfulMarkdownContent, MAX_INLINE_RICHTEXT_LENGTH } from './markdown/content';

/**
 * 编辑态表单（08-基础卡片插件接口 §2.4.2、04-基础卡片插件开发指南 §五）。
 *
 * 编辑引擎缺位登记（W4迁移-richtext-开发计划与日志-2026-09-30 §三.2）：旧实现基于
 * Milkdown（第三方），新生态无选型评估与用户授权记录，本包不引入；富文本所见即所得
 * 编辑引擎候用户选型。本表单为 04 §九官方完整示例的契约基线形制：Markdown 源文
 * TextArea + 展示配置 + 200 字内联/文件化阈值提示，回流走 `IBaseCardEditor` 唯一时序。
 *
 * 变更形态按来源分流（08 §4.3）：
 * - inline 来源：`replace` 提交完整内容（正文 + 展示配置，locale 与能力矩阵原样保留）；
 * - file 来源：正文读取通道未接线（在册缺位），编辑器**不得**以不可读的正文回写覆盖
 *   `content_file`，只以 `patch` 提交 `config` 子树增量。
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
  /** 来源形态（决定变更形态分流）。 */
  contentSource: 'inline' | 'file';
  /** 表单值变化回调；由编辑句柄统一维护待提交变更。 */
  onDraftChange: (draft: IRichTextDraft) => void;
}

/** 正数归一：空值与非法值回退默认值（04 §9.6 toPositiveNumber 同型）。 */
function toPositiveNumber(value: unknown, fallback: number): number {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 编辑态视图：每次值变化发布一次完整草稿。
 */
export function RichTextEditorView({
  content,
  contentSource,
  onDraftChange,
}: IRichTextEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolved = readContent(content);
  const displayConfig = readDisplayConfig(content);
  const [draftText, setDraftText] = React.useState<string>(resolved.content_text ?? '');
  const gate = inlineStorageGate(draftText);

  const handleValuesChange = (
    _changed: Partial<Record<string, unknown>>,
    values: { contentText?: string; fontSize?: unknown; lineHeight?: unknown }
  ): void => {
    const nextText = typeof values.contentText === 'string' ? values.contentText : '';
    const nextDisplay: IRichTextDisplayConfig = {
      fontSize: toPositiveNumber(values.fontSize, displayConfig.fontSize),
      lineHeight: toPositiveNumber(values.lineHeight, displayConfig.lineHeight),
    };
    setDraftText(nextText);
    onDraftChange({
      contentText: nextText,
      fontSize: nextDisplay.fontSize,
      lineHeight: nextDisplay.lineHeight,
    });
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.paddingSM,
        boxSizing: 'border-box',
      }}
    >
      <Form
        layout="vertical"
        initialValues={{
          contentText: resolved.content_text ?? '',
          fontSize: displayConfig.fontSize,
          lineHeight: displayConfig.lineHeight,
        }}
        onValuesChange={handleValuesChange}
      >
        {contentSource === 'file' ? (
          <p
            role="status"
            style={{
              margin: 0,
              marginBottom: token.marginSM,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
            }}
          >
            文件来源正文（{resolved.content_file}）读取通道未接入，当前仅可调整展示配置
          </p>
        ) : null}
        {contentSource === 'inline' ? (
          <Form.Item
            label="正文（Markdown）"
            name="contentText"
            extra={
              gate.shouldUseFile
                ? `已提取纯文本 ${String(gate.length)} 字，超过 ${String(MAX_INLINE_RICHTEXT_LENGTH)} 字阈值，保存时正文将文件化存储为卡片内 .md 文件`
                : `已提取纯文本 ${String(gate.length)} 字（≤${String(MAX_INLINE_RICHTEXT_LENGTH)} 字阈值内内联保存）`
            }
          >
            <Input.TextArea autoSize={{ minRows: 6 }} />
          </Form.Item>
        ) : null}
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
    if (!hasMeaningfulMarkdownContent(draft.contentText)) {
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
