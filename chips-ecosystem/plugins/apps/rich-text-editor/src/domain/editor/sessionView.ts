/**
 * 编辑会话视图装配（05-渲染引擎设计 §2.5、核心接口规范 §6.6 同口径）。
 *
 * 把宿主文档模型切片（`document:read` 回包）装配为基础卡片节点渲染视图 `BaseCardView`，
 * 供插件正式编辑器（`@chips/plugin-richtext` renderEditor）与 `IBaseCardEditor.update`
 * 重挂基线消费；视图为只读快照、可结构化克隆，不承载句柄与函数。
 */

import type { BaseCardView, TagView } from '@chips/sdk';

/** 封面比例缺省值（01-卡片文件格式 §4.1 `cover_ratio` default）。 */
const DEFAULT_COVER_RATIO = '3:4';

/** 视图装配输入：宿主模型切片的最小闭包。 */
export interface BaseCardViewAssemblyInput {
  /** 基础卡片节点标识（`.card/structure.yaml` 节点 ID）。 */
  readonly nodeId: string;
  /** 卡片文档标识（`.card/metadata.yaml` card_id）。 */
  readonly cardId: string;
  /** 卡片名称（`.card/metadata.yaml` name）。 */
  readonly cardName: string;
  /** 内容根（宿主 `document:read` content 切片 `value`）。 */
  readonly content: Record<string, unknown>;
  /** 会话修订号（`document:write` 回执水位）。 */
  readonly revision: number;
  /** 封面比例；缺省 `3:4`。 */
  readonly coverRatio?: string;
  /** 标签；缺省空数组。 */
  readonly tags?: readonly TagView[];
}

/** 由宿主模型切片装配基础卡片节点渲染视图（只读快照）。 */
export function assembleBaseCardView(input: BaseCardViewAssemblyInput): BaseCardView {
  return {
    kind: 'basecard',
    node_id: input.nodeId,
    card_type: 'base.richtext',
    content: { ...input.content },
    revision: input.revision,
    card: {
      card_id: input.cardId,
      name: input.cardName,
      chip_standards_version: '1.0.0',
      cover_ratio: input.coverRatio ?? DEFAULT_COVER_RATIO,
      tags: input.tags ?? [],
    },
  };
}
