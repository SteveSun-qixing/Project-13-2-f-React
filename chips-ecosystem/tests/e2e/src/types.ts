/**
 * E2E 使用的桥接契约类型。
 *
 * 权威：`薯片生态文档库/05-接口与契约/01-Bridge-API规范.md`、
 * `04-能力契约规范.md`、`05-事件契约规范.md` 与 `04-文件格式规范`。
 *
 * 本文件只做测试侧的类型收窄，不构成第二处契约定义；字段与文档库不一致时以文档库为准。
 */

export type ResourceScope =
  'workspace' | 'document' | 'plugin' | 'platform' | 'external' | 'temporary' | 'memory';

export type ResourceState = 'open' | 'invalidated' | 'released';

export type ResourceInvalidateReason = 'source-changed' | 'session-closed' | 'scope-revoked';

export interface ChipsSubscription {
  dispose(): void;
}

export interface ChipsResourceMetadata {
  readonly uri: string;
  readonly size: number;
  readonly mimeType: string;
  readonly version: string;
  readonly scope: ResourceScope;
}

export interface ChipsResourceHandle {
  readonly uri: string;
  readonly state: ResourceState;
  metadata(): Promise<ChipsResourceMetadata>;
  read(): Promise<Uint8Array>;
  readRange(offset: number, length: number): Promise<Uint8Array>;
  stream(): ReadableStream<Uint8Array>;
  release(): void;
  onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ChipsSubscription;
}

/** `window.chips` 的唯一形状：`request` / `subscribe` / `resource`。 */
export interface ChipsWindowBridge {
  request<T>(capabilityId: string, input?: unknown): Promise<T>;
  subscribe(eventId: string, handler: (payload: unknown) => void): ChipsSubscription;
  resource(uri: string): ChipsResourceHandle;
}

export type DocumentKind = 'card' | 'box';

export type DocumentPart = 'metadata' | 'structure' | 'content' | 'entries';

export type DocumentExportForm = 'archive' | 'directory';

export interface DocumentCreateInput {
  readonly kind: DocumentKind;
  readonly parent: string;
  readonly name?: string;
  readonly initialContent?: {
    readonly cardType?: string;
    readonly layoutType?: string;
  };
}

export interface DocumentCreateOutput {
  readonly documentId: string;
  readonly source: string;
}

export interface DocumentOpenInput {
  readonly source: string;
  readonly kind?: DocumentKind;
}

export interface DocumentOpenOutput {
  readonly documentId: string;
  readonly source: string;
  readonly kind: DocumentKind;
  readonly title: string;
  readonly digest: string;
}

export interface DocumentDiagnostic {
  readonly code: string;
  readonly message?: string;
  readonly details?: unknown;
}

export interface DocumentReadInput {
  readonly documentId: string;
  readonly part: DocumentPart;
  readonly nodeId?: string;
  readonly range?: { readonly offset: number; readonly limit: number };
}

export interface DocumentReadOutput<TValue = unknown> {
  readonly part: DocumentPart;
  readonly value: TValue;
  readonly diagnostics: readonly DocumentDiagnostic[];
}

export interface DocumentWriteInput {
  readonly documentId: string;
  readonly part: DocumentPart;
  readonly nodeId?: string;
  readonly value: unknown;
}

export interface DocumentWriteOutput {
  readonly revision: number;
}

export interface DocumentSaveInput {
  readonly documentId: string;
}

export interface DocumentSaveOutput {
  readonly source: string;
  readonly digest: string;
}

export interface DocumentExportInput {
  readonly documentId: string;
  readonly target: string;
  readonly form: DocumentExportForm;
  readonly overwrite?: boolean;
}

export interface DocumentExportOutput {
  readonly target: string;
  readonly digest: string;
}

export type WindowDisplayState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';

export interface WindowInfo {
  readonly windowId: number;
  readonly title: string;
  readonly state: WindowDisplayState;
  readonly focused: boolean;
}

export interface WindowListOutput {
  readonly windows: readonly WindowInfo[];
}

export interface SystemInfoOutput {
  readonly platform: 'darwin' | 'win32' | 'linux' | 'android' | 'ios';
  readonly osVersion: string;
  readonly arch: string;
  readonly appVersion: string;
  readonly locale: string;
  readonly paths: Readonly<Record<string, string>>;
}

/** 卡片 metadata 模型切片（《01-卡片文件格式》§四）。 */
export interface CardMetadata {
  readonly [key: string]: unknown;
  readonly chip_standards_version: string;
  readonly card_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly modified_at: string;
  readonly theme?: string;
  readonly cover_ratio?: string;
  readonly tags?: readonly (string | readonly string[])[];
}

/** 箱子 metadata 模型切片（《02-箱子文件格式》§四）。 */
export interface BoxMetadata {
  readonly [key: string]: unknown;
  readonly chip_standards_version: string;
  readonly box_id: string;
  readonly name: string;
  readonly created_at: string;
  readonly modified_at: string;
  readonly active_layout_type: string;
  readonly description?: string;
}

/** `base.richtext` 内容模型切片（《01-卡片文件格式》§6.6）。 */
export interface RichTextContent {
  readonly [key: string]: unknown;
  readonly card_type: string;
  readonly content_format: string;
  readonly content_source: 'file' | 'inline';
  readonly content_text?: string;
  readonly content_file?: string;
  readonly locale?: string;
  readonly markdown_capabilities: Readonly<Record<string, boolean>>;
}

/** 文档会话快照：一次 `document:read` 组合读取的可序列化结果。 */
export interface DocumentSessionSnapshot {
  readonly metadata: Record<string, unknown>;
  readonly structure: Record<string, unknown>;
  readonly content: Record<string, unknown> | null;
}

/** DOM 中渲染帧 iframe 的可观察摘要（《渲染引擎设计》§9 的测试侧投影）。 */
export interface FrameSummary {
  readonly index: number;
  readonly src: string;
  readonly sandbox: readonly string[];
  readonly width: number;
  readonly height: number;
}

/** 资源读取结果：元数据 + 文本内容（非文本资源只保留字节长度）。 */
export interface ResourceSnapshot {
  readonly uri: string;
  readonly metadata: ChipsResourceMetadata;
  readonly text: string | null;
  readonly byteLength: number;
}

/** 夹具清单（`fixtures/manifest.json`）的字段模型。 */
export interface FixtureManifest {
  readonly version: number;
  readonly generatedBy: string;
  readonly card: {
    readonly id: string;
    readonly name: string;
    readonly nodeId: string;
    readonly cardType: string;
    readonly inlineText: string;
    readonly directoryPath: string;
    readonly archivePath: string;
  };
  readonly box: {
    readonly id: string;
    readonly name: string;
    readonly entryId: string;
    readonly layoutType: string;
    readonly embeddedCardPath: string;
    readonly archivePath: string;
  };
}
