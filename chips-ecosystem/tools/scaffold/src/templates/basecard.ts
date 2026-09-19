import type { IScaffoldContext, IScaffoldFile } from '../types.js';

/** `basecard` 角色模板：一个可直接构建的 Markdown 文本卡片插件。 */

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round" />
</svg>
`;

function configTs(): string {
  return `/** 卡片配置。 */
export interface ICardConfig {
  fontSize: number;
  lineHeight: number;
}

/** 编辑器草稿：正文与两项配置的完整快照。 */
export interface ICardDraft {
  text: string;
  fontSize: number;
  lineHeight: number;
}

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: ICardConfig = { fontSize: 16, lineHeight: 1.6 };
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 48;
export const MIN_LINE_HEIGHT = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 读取正文。
 *
 * @param content - 卡片内容视图
 * @returns 正文字符串；字段缺失或类型异常时为空字符串
 */
export function readText(content: Record<string, unknown>): string {
  return typeof content.content_text === 'string' ? content.content_text : '';
}

/**
 * 读取配置并回退默认值，保证渲染不因配置问题失败。
 *
 * @param content - 卡片内容视图
 * @returns 归一后的配置
 */
export function readConfig(content: Record<string, unknown>): ICardConfig {
  const raw: Record<string, unknown> = isRecord(content.config) ? content.config : {};
  return {
    fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : DEFAULT_CONFIG.fontSize,
    lineHeight: typeof raw.lineHeight === 'number' ? raw.lineHeight : DEFAULT_CONFIG.lineHeight,
  };
}

/**
 * 从内容视图生成编辑器草稿。
 *
 * @param content - 卡片内容视图
 * @returns 初始化表单用的完整草稿
 */
export function readDraft(content: Record<string, unknown>): ICardDraft {
  const config = readConfig(content);
  return { text: readText(content), fontSize: config.fontSize, lineHeight: config.lineHeight };
}

/**
 * 校验卡片配置；与 configSchema 同语义且不得更宽松。
 *
 * 纯函数：同步、无副作用、不抛异常。
 *
 * @param config - 卡片内容 config 字段的原始值
 * @returns 合法返回 true，否则 false
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (!isRecord(config)) {
    return false;
  }

  const fontSize = config.fontSize;
  if (fontSize !== undefined) {
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize)) {
      return false;
    }
    if (fontSize < MIN_FONT_SIZE || fontSize > MAX_FONT_SIZE) {
      return false;
    }
  }

  const lineHeight = config.lineHeight;
  if (lineHeight !== undefined) {
    if (typeof lineHeight !== 'number' || !Number.isFinite(lineHeight)) {
      return false;
    }
    if (lineHeight < MIN_LINE_HEIGHT) {
      return false;
    }
  }

  return true;
}
`;
}

function mainTs(context: IScaffoldContext): string {
  return `import type { BaseCardView, IBaseCardPlugin } from '@chips/sdk';
import { DEFAULT_CONFIG, validateConfig } from './config';

const CARD_TYPE_ID = '${context.capabilityId}';

/**
 * 创建新节点的初始内容；必须能通过 configSchema 与 validateConfig。
 *
 * @returns 初始内容对象
 */
export function createInitialContent(): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    content_format: 'markdown',
    content_source: 'inline',
    content_text: '',
    config: { ...DEFAULT_CONFIG },
  };
}

/**
 * 收集节点内容引用的包内相对路径；本模板不引用包内资源，返回空数组。
 *
 * @param basecard - 只读节点渲染视图
 * @returns 包内相对路径列表（去重且稳定排序）
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  void basecard;
  return [];
}

/** 主进程入口集合：由受管模块加载器在 dist/index.js 中读取。 */
export const mainPlugin: Pick<
  IBaseCardPlugin,
  'validateConfig' | 'createInitialContent' | 'collectResourcePaths'
> = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
`;
}

function renderTsx(): string {
  return `import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Empty, Form, Input, theme } from '@chips/ui';
import { ChipsError } from '@chips/sdk';
import type {
  BaseCardChange,
  BaseCardView,
  Dispose,
  EditorState,
  IBaseCardEditor,
  IBaseCardEditorEventMap,
  IBaseCardPlugin,
  ISubscription,
} from '@chips/sdk';
import {
  DEFAULT_CONFIG,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
  readConfig,
  readDraft,
  readText,
  validateConfig,
} from './config';
import type { ICardDraft } from './config';

const EXPORT_FORMAT_HTML = 'html';

interface ICardViewProps {
  content: Record<string, unknown>;
}

/** 查看态视图：只呈现内容，不读写文件与平台能力。 */
function CardView({ content }: ICardViewProps): ReactElement {
  const { token } = theme.useToken();
  const config = readConfig(content);
  const text = readText(content);
  if (text.length === 0) {
    return <Empty description="暂无内容" />;
  }
  return (
    <article
      style={{
        margin: 0,
        color: token.colorText,
        fontSize: config.fontSize,
        lineHeight: config.lineHeight,
        whiteSpace: 'pre-wrap',
      }}
    >
      {text}
    </article>
  );
}

interface IActiveViewMount {
  dispose: Dispose;
}

const activeViewMounts = new WeakMap<HTMLElement, IActiveViewMount>();

/**
 * 查看态渲染：把卡片内容挂载到容器，返回幂等释放句柄。
 *
 * @param basecard - 只读节点渲染视图
 * @param container - 帧运行时为该节点提供的容器
 * @returns 释放本次挂载的幂等句柄
 */
function renderView(basecard: BaseCardView, container: HTMLElement): Dispose {
  activeViewMounts.get(container)?.dispose();
  container.replaceChildren();

  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(<CardView content={basecard.content} />);
  });

  let released = false;
  const dispose = (): void => {
    if (released) {
      return;
    }
    released = true;
    root.unmount();
    if (activeViewMounts.get(container)?.dispose === dispose) {
      activeViewMounts.delete(container);
    }
  };
  activeViewMounts.set(container, { dispose });
  return dispose;
}

/**
 * 把表单原始值归一为正数；空值与非法值回退默认值。
 *
 * @param value - 表单字段原始值
 * @param fallback - 回退值
 * @returns 归一后的正数
 */
function toPositiveNumber(value: unknown, fallback: number): number {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface ICardEditorViewProps {
  basecard: BaseCardView;
  onDraftChange: (draft: ICardDraft) => void;
}

/** 编辑态视图：每次值变化发布一次完整草稿。 */
function CardEditorView({ basecard, onDraftChange }: ICardEditorViewProps): ReactElement {
  const handleValuesChange = (_changed: Partial<ICardDraft>, values: ICardDraft): void => {
    onDraftChange({
      text: typeof values.text === 'string' ? values.text : '',
      fontSize: toPositiveNumber(values.fontSize, DEFAULT_CONFIG.fontSize),
      lineHeight: toPositiveNumber(values.lineHeight, DEFAULT_CONFIG.lineHeight),
    });
  };

  return (
    <Form<ICardDraft>
      layout="vertical"
      initialValues={readDraft(basecard.content)}
      onValuesChange={handleValuesChange}
    >
      <Form.Item label="正文" name="text">
        <Input.TextArea autoSize={{ minRows: 6 }} />
      </Form.Item>
      <Form.Item label="字号（px）" name="fontSize">
        <Input type="number" min={MIN_FONT_SIZE} max={MAX_FONT_SIZE} />
      </Form.Item>
      <Form.Item label="行高倍数" name="lineHeight">
        <Input type="number" min={MIN_LINE_HEIGHT} step={0.1} />
      </Form.Item>
    </Form>
  );
}

class CardEditor implements IBaseCardEditor {
  public state: EditorState = 'active';

  private base: BaseCardView;
  private revision: number;
  private pending: BaseCardChange | null = null;
  private dirty = false;
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: IBaseCardEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: IBaseCardEditorEventMap['dirty']) => void>();

  public constructor(basecard: BaseCardView, container: HTMLElement) {
    this.base = basecard;
    this.revision = basecard.revision;
    this.host = container;
    container.replaceChildren();
    this.root = createRoot(container);
    this.mount();
  }

  public isDirty(): boolean {
    return this.pending !== null;
  }

  public getChange(): BaseCardChange | null {
    return this.pending;
  }

  public markCommitted(revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    const committed = this.pending;
    this.revision = revision;
    if (committed !== null && committed.kind === 'replace') {
      this.base = { ...this.base, revision, content: committed.content };
    }
    if (this.pending === committed) {
      this.pending = null;
      this.updateDirty(false);
    }
  }

  public update(basecard: BaseCardView, revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    this.revision = revision;
    this.base = { ...basecard, revision };
    this.pending = null;
    this.updateDirty(false);
    this.mount();
  }

  public subscribe<TEvent extends keyof IBaseCardEditorEventMap>(
    event: TEvent,
    handler: (payload: IBaseCardEditorEventMap[TEvent]) => void
  ): ISubscription {
    if (this.state === 'disposed') {
      return { dispose: (): void => undefined };
    }
    if (event === 'change') {
      const typed = handler as (payload: IBaseCardEditorEventMap['change']) => void;
      this.changeHandlers.add(typed);
      return {
        dispose: (): void => {
          this.changeHandlers.delete(typed);
        },
      };
    }
    const typed = handler as (payload: IBaseCardEditorEventMap['dirty']) => void;
    this.dirtyHandlers.add(typed);
    return {
      dispose: (): void => {
        this.dirtyHandlers.delete(typed);
      },
    };
  }

  public focus(): void {
    if (this.state !== 'active') {
      return;
    }
    this.host.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  public dispose(): void {
    if (this.state === 'disposed') {
      return;
    }
    this.root.unmount();
    this.changeHandlers.clear();
    this.dirtyHandlers.clear();
    this.pending = null;
    this.dirty = false;
    this.state = 'disposed';
  }

  private mount(): void {
    flushSync(() => {
      this.root.render(
        <CardEditorView
          key={this.base.revision}
          basecard={this.base}
          onDraftChange={this.handleDraftChange}
        />
      );
    });
  }

  private readonly handleDraftChange = (draft: ICardDraft): void => {
    if (this.state !== 'active') {
      return;
    }
    const content: Record<string, unknown> = {
      ...this.base.content,
      content_text: draft.text,
      config: {
        fontSize: draft.fontSize,
        lineHeight: draft.lineHeight,
      },
    };
    const change: BaseCardChange = { kind: 'replace', content };
    this.pending = change;
    for (const handler of this.changeHandlers) {
      handler({ change });
    }
    this.updateDirty(true);
  };

  private updateDirty(next: boolean): void {
    if (this.dirty === next) {
      return;
    }
    this.dirty = next;
    for (const handler of this.dirtyHandlers) {
      handler({ isDirty: next });
    }
  }
}

/**
 * 编辑态渲染：在就近渲染容器内挂载编辑器。
 *
 * @param basecard - 只读节点渲染视图
 * @param container - 编辑链路的 EditorHost 挂载点
 * @returns 编辑会话句柄
 */
function renderEditor(basecard: BaseCardView, container: HTMLElement): IBaseCardEditor {
  return new CardEditor(basecard, container);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * 导出 HTML 片段。
 *
 * @param basecard - 只读节点渲染视图
 * @param format - 导出格式 ID，必须已在 exportFormats 中声明
 * @returns 与声明 mimeType 一致的 Blob
 * @throws {ChipsError} 格式未声明时为 CARD_EXPORT_UNSUPPORTED
 */
async function exportCard(basecard: BaseCardView, format: string): Promise<Blob> {
  if (format !== EXPORT_FORMAT_HTML) {
    throw new ChipsError({
      code: 'CARD_EXPORT_UNSUPPORTED',
      message: \`该卡片类型不支持导出为 \${format}\`,
      details: { format },
    });
  }
  const config = readConfig(basecard.content);
  const body = escapeHtml(readText(basecard.content)).replaceAll('\\n', '<br>');
  const html = \`<article style="font-size: \${config.fontSize}px; line-height: \${config.lineHeight}">\${body}</article>\`;
  return new Blob([html], { type: 'text/html' });
}

/** 渲染入口：默认导出 IBaseCardPlugin 实现，由渲染帧装载。 */
export const renderPlugin: Pick<IBaseCardPlugin, 'renderView' | 'renderEditor' | 'export'> = {
  renderView,
  renderEditor,
  export: exportCard,
};

export { renderView, renderEditor, exportCard as export };

export default renderPlugin;
`;
}

function indexTs(): string {
  return `// 源码只做拆分导出：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export { validateConfig, createInitialContent, collectResourcePaths, mainPlugin } from './main';
export { renderPlugin, renderView, renderEditor, export as exportCard } from './render';
export { default } from './render';
`;
}

function configSchema(context: IScaffoldContext): string {
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `${context.options.name}配置`,
      type: 'object',
      additionalProperties: false,
      properties: {
        fontSize: {
          type: 'integer',
          minimum: 12,
          maximum: 48,
          default: 16,
          description: '正文字号（px）',
        },
        lineHeight: {
          type: 'number',
          minimum: 1,
          default: 1.6,
          description: '行高倍数',
        },
      },
    },
    null,
    2
  )}\n`;
}

function testsTs(): string {
  return `import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, readConfig, readDraft, readText, validateConfig } from '../src/config';

describe('readConfig', () => {
  it('配置缺失时回退默认值', () => {
    expect(readConfig({})).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ config: 'invalid' })).toEqual(DEFAULT_CONFIG);
  });

  it('读取合法配置并允许部分字段', () => {
    expect(readConfig({ config: { fontSize: 20 } })).toEqual({ fontSize: 20, lineHeight: 1.6 });
  });
});

describe('validateConfig', () => {
  it('接受空配置与缺省字段', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(validateConfig({ fontSize: 16, lineHeight: 1.6 })).toBe(true);
  });

  it('拒绝非对象与越界值', () => {
    expect(validateConfig('markdown')).toBe(false);
    expect(validateConfig({ fontSize: 8 })).toBe(false);
    expect(validateConfig({ fontSize: 16.5 })).toBe(false);
    expect(validateConfig({ lineHeight: 0.5 })).toBe(false);
  });
});

describe('readText 与 readDraft', () => {
  it('读取正文并容忍缺失字段', () => {
    expect(readText({ content_text: '你好' })).toBe('你好');
    expect(readText({})).toBe('');
  });

  it('生成完整草稿', () => {
    expect(readDraft({ content_text: '你好', config: { fontSize: 18, lineHeight: 1.5 } })).toEqual({
      text: '你好',
      fontSize: 18,
      lineHeight: 1.5,
    });
  });
});
`;
}

/** 构建 `basecard` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildBasecardFiles(context: IScaffoldContext): IScaffoldFile[] {
  const { assetSlug } = context;
  return [
    { path: 'src/config.ts', content: configTs() },
    { path: 'src/main.ts', content: mainTs(context) },
    { path: 'src/render.tsx', content: renderTsx() },
    { path: 'src/index.ts', content: indexTs() },
    { path: `assets/icons/${assetSlug}.svg`, content: ICON_SVG },
    { path: `assets/schemas/${assetSlug}-config.schema.json`, content: configSchema(context) },
    { path: 'tests/config.test.ts', content: testsTs() },
  ];
}
