/**
 * 基础卡片注册表
 * @module basecards/registry
 * @description 定义所有可用的基础卡片类型（包含 React 图标）
 */

import React from 'react';
import {
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  GlobalOutlined,
  FileOutlined,
  AudioOutlined,
  TableOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { BASE_CARD_TYPES } from './types';

export interface BaseCardTypeDefinition {
  type: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  defaultConfig: Record<string, unknown>;
}

export const BASE_CARD_REGISTRY: BaseCardTypeDefinition[] = BASE_CARD_TYPES.map(card => ({
  type: card.type,
  name: card.name,
  description: card.description,
  icon: getIconForType(card.type),
  defaultConfig: card.defaultConfig,
}));

function getIconForType(type: string): React.ReactNode {
  switch (type) {
    case 'chips.basecard.rich-text':
      return <FileTextOutlined />;
    case 'chips.basecard.image':
      return <PictureOutlined />;
    case 'chips.basecard.video':
      return <VideoCameraOutlined />;
    case 'chips.basecard.audio':
      return <AudioOutlined />;
    case 'chips.basecard.webpage':
      return <GlobalOutlined />;
    case 'chips.basecard.file':
      return <FileOutlined />;
    case 'chips.basecard.table':
      return <TableOutlined />;
    case 'chips.basecard.code':
      return <CodeOutlined />;
    default:
      return null;
  }
}

export function getCardTypeDefinition(type: string): BaseCardTypeDefinition | undefined {
  return BASE_CARD_REGISTRY.find((card) => card.type === type);
}

export function getCardTypeName(type: string): string {
  return getCardTypeDefinition(type)?.name ?? type;
}

export function getCardTypeIcon(type: string): React.ReactNode {
  return getCardTypeDefinition(type)?.icon ?? null;
}
