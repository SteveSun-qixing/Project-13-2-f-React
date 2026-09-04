/**
 * 空状态组件
 */

import React from 'react';
import { Button, Empty } from 'antd';
import {
  FolderOpenOutlined,
  FileAddOutlined,
  FileTextOutlined,
  EditOutlined,
} from '@ant-design/icons';

interface EmptyStateProps {
  type: 'no-workspace' | 'no-notebook' | 'no-note' | 'empty-note';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ type, title, description, action }: EmptyStateProps): React.ReactElement {
  const iconMap = {
    'no-workspace': <FolderOpenOutlined style={{ fontSize: 64 }} />,
    'no-notebook': <FileAddOutlined style={{ fontSize: 64 }} />,
    'no-note': <FileTextOutlined style={{ fontSize: 64 }} />,
    'empty-note': <EditOutlined style={{ fontSize: 64 }} />,
  };

  return (
    <div className="empty-state">
      <Empty
        image={iconMap[type]}
        imageStyle={{ height: 80, marginBottom: 24 }}
        description={
          <div className="empty-state-content">
            <h2 className="empty-state-title">{title}</h2>
            {description && <p className="empty-state-description">{description}</p>}
          </div>
        }
      >
        {action && (
          <Button type="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </Empty>
    </div>
  );
}
