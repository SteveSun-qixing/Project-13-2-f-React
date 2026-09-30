/**
 * 卡片 HTML 导出服务的契约类型。
 *
 * 输入/输出形状权威：`contracts/card-to-html.input.schema.json` 与
 * `contracts/card-to-html.output.schema.json`；能力登记权威：
 * 04-能力契约规范 §8.4（`content-converter.card-to-html`）。
 * 文档模型切片形状权威：`@chips/sdk` 文档模型类型（chips-parser 解析域导出面）。
 */

import type { Diagnostic } from '@chips/sdk';

/** 导出产物形态（与输入 schema `output.packageMode` 枚举一致）。 */
export type CardToHtmlPackageMode = 'directory' | 'zip';

/** 输出目标（`output.*`）。 */
export interface ICardToHtmlOutputTarget {
  readonly path: string;
  readonly packageMode?: CardToHtmlPackageMode;
  readonly overwrite?: boolean;
}

/** 导出选项（`options.*`）。 */
export interface ICardToHtmlOptions {
  readonly includeAssets?: boolean;
  readonly includeManifest?: boolean;
}

/** `cardToHtml` 操作输入。 */
export interface ICardToHtmlInput {
  readonly source: string;
  readonly output: ICardToHtmlOutputTarget;
  readonly options?: ICardToHtmlOptions;
}

/** 归一化请求（运行时收窄结果；缺省值已落定）。 */
export interface INormalizedCardToHtmlRequest {
  readonly source: string;
  readonly output: {
    readonly path: string;
    readonly packageMode: CardToHtmlPackageMode;
    readonly overwrite: boolean;
  };
  readonly options: {
    readonly includeAssets: boolean;
    readonly includeManifest: boolean;
  };
}

/** 结果警告码（输出 schema `warnings[].code` 枚举的单一事实源）。 */
export type CardToHtmlWarningCode =
  | 'CONVERTER_ASSETS_SKIPPED'
  | 'CONVERTER_RESOURCE_MISSING'
  | 'CONVERTER_NODE_UNAVAILABLE'
  | 'CONVERTER_MANIFEST_SKIPPED';

/** 一条结果警告（非抛出错误；码域见 `CardToHtmlWarningCode`）。 */
export interface ICardToHtmlWarning {
  readonly code: CardToHtmlWarningCode;
  readonly message: string;
}

/** `cardToHtml` 操作输出。 */
export interface ICardToHtmlOutput {
  readonly packageMode: 'directory';
  readonly outputPath: string;
  readonly entryFile: 'index.html';
  readonly manifestFile?: 'conversion-manifest.json';
  readonly documentId: string;
  readonly digest: string;
  readonly assetCount: number;
  readonly warnings?: readonly ICardToHtmlWarning[];
}

/** `content-converter` Cordis 服务契约（04-能力契约规范 §8.3 描述符 `operations` 面）。 */
export interface IContentConverterService {
  cardToHtml(input: ICardToHtmlInput): Promise<ICardToHtmlOutput>;
}

/** `.card/structure.yaml` 资源条目（运行时收窄视图）。 */
export interface ICardResourceEntry {
  readonly path: string;
  readonly type: string;
  readonly width?: number;
  readonly height?: number;
}

/** `.card/structure.yaml` 结构条目（运行时收窄视图）。 */
export interface ICardStructureEntry {
  readonly id: string;
  readonly type: string;
}

/** 卡片元数据（运行时收窄视图；字段语义权威 01-卡片文件格式 §4）。 */
export interface ICardMetadataView {
  readonly cardId: string;
  readonly name: string;
  readonly createdAt?: string;
  readonly modifiedAt?: string;
  readonly theme?: string;
  readonly tags: readonly (string | readonly string[])[];
}

/** 单个内容节点（document:read `content` 切片收窄视图）。 */
export interface ICardContentNodeModel {
  readonly nodeId: string;
  readonly cardType: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
}

/** 转换核心消费的卡片文档模型（document:open/read 消费结果）。 */
export interface ICardDocumentModel {
  readonly documentId: string;
  readonly source: string;
  readonly digest: string;
  readonly title: string;
  readonly metadata: ICardMetadataView;
  readonly structure: readonly ICardStructureEntry[];
  readonly resources: readonly ICardResourceEntry[];
  readonly nodes: readonly ICardContentNodeModel[];
  /** 结构节点读取阶段产生的警告（节点不可用等；非致命，不中断导出）。 */
  readonly nodeWarnings: readonly ICardToHtmlWarning[];
}
