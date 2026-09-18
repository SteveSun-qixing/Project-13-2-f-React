/**
 * 基础卡片显示组件
 * @module basecards/BaseCardItem
 * @description 在编辑器中展示单个基础卡片（查看+编辑切换）
 */

import React, { useState } from 'react';
import { Card, Tag, Space, Button, Tooltip, Popconfirm } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  DragOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { BaseCardRenderer } from './renderers';
import { BaseCardEditor } from './editors';
import { getCardTypeDefinition, getCardTypeIcon } from './registry';
import type { CardContent } from '../services/note-service';

interface BaseCardItemProps {
  content: CardContent;
  index: number;
  isEditing: boolean;
  cardPath: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (config: any) => void;
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}

export function BaseCardItem({
  content,
  index,
  isEditing,
  cardPath,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: BaseCardItemProps): React.ReactElement {
  const [localConfig, setLocalConfig] = useState<any>(content.config);
  const cardDef = getCardTypeDefinition(content.type);
  const isRichText = content.type === 'chips.basecard.rich-text';

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleCancel = () => {
    setLocalConfig(content.config);
    onCancelEdit();
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        border: isEditing ? '2px solid #1890ff' : '1px solid #e8e8e8',
        borderRadius: 6,
        transition: 'border-color 0.2s',
      }}
      draggable={!isEditing}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      title={
        <Space>
          {getCardTypeIcon(content.type)}
          <span>{cardDef?.name ?? content.type}</span>
          <Tag color="default" style={{ marginLeft: 8 }}>
            #{index + 1}
          </Tag>
          {isRichText && (
            <Tag color="blue">可内联编辑</Tag>
          )}
        </Space>
      }
      extra={
        <Space size="small">
          {!isEditing && (
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={onEdit}
              />
            </Tooltip>
          )}
          {!isEditing && (
            <Tooltip title="拖拽排序">
              <DragOutlined style={{ cursor: 'grab', color: '#999' }} />
            </Tooltip>
          )}
          {!isEditing && (
            <Popconfirm
              title="确认删除这个卡片吗？"
              onConfirm={onDelete}
              okText="删除"
              cancelText="取消"
              okType="danger"
            >
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {isEditing && (
            <>
              <Tooltip title="保存">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleSave}
                />
              </Tooltip>
              <Tooltip title="取消">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancel}
                />
              </Tooltip>
            </>
          )}
        </Space>
      }
    >
      {isEditing || isRichText ? (
        <BaseCardEditor
          cardType={content.type}
          config={localConfig}
          onChange={setLocalConfig}
          baseCardId={content.id}
          cardPath={cardPath}
        />
      ) : (
        <BaseCardRenderer cardType={content.type} config={content.config} />
      )}
    </Card>
  );
}
