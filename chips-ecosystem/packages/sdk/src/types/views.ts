/**
 * 渲染视图模型（核心接口规范 §6.6 为正式定义，05-渲染引擎设计 §2.5 列消费字段）。
 *
 * 视图是只读快照、必须可结构化克隆：不含句柄、函数、类实例、`Symbol`、循环引用与文件字节。
 * 命名以正式定义为准：`DocumentView = CardRenderView | BoxRenderView`；
 * `CardView` / `BoxView` 名称作废；节点视图统一为 `BaseCardView`。
 */

import type { CardContent } from './document.js';

/** 标签视图：简单标签或结构化标签，与 `metadata.yaml` 口径一致。 */
export type TagView = string | readonly string[];

/** 正式封面视图：入口与比例。 */
export interface CoverView {
  /** 正式封面入口：卡片固定 `.card/cover.html`，箱子固定 `.box/cover.html`。 */
  readonly entry: string;
  /** `metadata.yaml → cover_ratio`，缺省 `3:4`。 */
  readonly ratio: string;
}

/** 卡片级上下文：同一卡片的全部节点共享，来自 `.card/metadata.yaml`。 */
export interface BaseCardContext {
  readonly card_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover_ratio: string;
  readonly tags: readonly TagView[];
}

/** 卡片内单个内容节点的视图切片。 */
export interface CardNodeView {
  readonly node_id: string;
  readonly card_type: string;
  readonly content: Readonly<Record<string, unknown>>;
}

/**
 * 一个基础卡片节点实例的只读渲染视图。
 *
 * 由帧运行时按节点组装后传入 `renderView(basecard, container)`；
 * 编辑链路的就近渲染使用同一构建口径（05-渲染引擎设计 §2.5）。
 */
export interface BaseCardView {
  readonly kind: 'basecard';
  readonly node_id: string;
  readonly card_type: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly revision: number;
  readonly card: BaseCardContext;
}

/** 卡片渲染视图。 */
export interface CardRenderView {
  readonly kind: 'card';
  readonly revision: number;
  readonly card_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover_ratio: string;
  readonly tags: readonly TagView[];
  readonly cover: CoverView;
  readonly content_nodes: readonly CardNodeView[];
}

/** 箱子条目渲染视图（09-箱子布局插件接口 §4.2）。 */
export interface EntryView {
  readonly entry_id: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly snapshot?: Readonly<Record<string, unknown>>;
  readonly layout_hints?: Readonly<Record<string, unknown>>;
  /** 派生展示名：`snapshot.title` 或目标文档标题；无对应持久化字段。 */
  readonly displayTitle: string;
  /** 派生呈现顺序：按 `entries` 数组顺序；无对应持久化字段。 */
  readonly order: number;
}

/** 箱子布局渲染视图。 */
export interface BoxRenderView {
  readonly kind: 'box';
  readonly revision: number;
  readonly box_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly active_layout_type: string;
  readonly layout_config: Readonly<Record<string, unknown>>;
  readonly cover: CoverView;
  readonly entries: readonly EntryView[];
}

/**
 * 条目目标为箱子时的受控封面渲染视图；不展开布局（05-渲染引擎设计 §7.2）。
 */
export interface BoxCoverView {
  readonly kind: 'box';
  readonly box_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover: CoverView;
}

/** 渲染会话视图：卡片与箱子共用同一别名。 */
export type DocumentView = CardRenderView | BoxRenderView;

/** 供 `BaseCardPlugin.createInitialContent` 等纯函数复用的内容形状。 */
export type { CardContent };
