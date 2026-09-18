/**
 * 基础卡片注册表（数据）
 * @module basecards/types
 * @description 基础卡片类型定义数据（不包含 React 组件）
 */

export interface BaseCardTypeDefinition {
  type: string;
  name: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}

export const BASE_CARD_TYPES: BaseCardTypeDefinition[] = [
  {
    type: 'chips.basecard.rich-text',
    name: '富文本',
    description: '添加富文本内容',
    defaultConfig: { content: '<p></p>' },
  },
  {
    type: 'chips.basecard.image',
    name: '图片',
    description: '插入图片',
    defaultConfig: { src: '', alt: '' },
  },
  {
    type: 'chips.basecard.video',
    name: '视频',
    description: '插入视频',
    defaultConfig: { src: '', poster: '' },
  },
  {
    type: 'chips.basecard.audio',
    name: '音频',
    description: '插入音频',
    defaultConfig: { src: '', title: '' },
  },
  {
    type: 'chips.basecard.webpage',
    name: '网页',
    description: '嵌入网页链接',
    defaultConfig: { url: '', title: '' },
  },
  {
    type: 'chips.basecard.file',
    name: '文件',
    description: '添加文件附件',
    defaultConfig: { path: '', name: '' },
  },
  {
    type: 'chips.basecard.table',
    name: '表格',
    description: '插入表格',
    defaultConfig: {
      rows: 3,
      columns: 3,
      data: Array(3).fill(null).map(() => Array(3).fill('')),
    },
  },
  {
    type: 'chips.basecard.code',
    name: '代码',
    description: '插入代码块',
    defaultConfig: { code: '', language: 'javascript' },
  },
];

export function getCardTypeDefinitionData(type: string): BaseCardTypeDefinition | undefined {
  return BASE_CARD_TYPES.find((card) => card.type === type);
}

export function getCardTypeName(type: string): string {
  return getCardTypeDefinitionData(type)?.name ?? type;
}
