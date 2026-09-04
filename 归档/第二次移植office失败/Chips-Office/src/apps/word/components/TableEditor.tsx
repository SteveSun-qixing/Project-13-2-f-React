import React, { useCallback, useState } from 'react';
import { Modal, InputNumber, Button, Space } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import type { TableInsertConfig } from '../types';
import { formatMessage } from '../lib/messages';

interface TableEditorProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (config: TableInsertConfig) => void;
}

export function TableEditor({ visible, onClose, onInsert }: TableEditorProps) {
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);

  const handleInsert = useCallback(() => {
    onInsert({ rows, columns });
    onClose();
  }, [rows, columns, onInsert, onClose]);

  return (
    <Modal
      title={
        <Space>
          <TableOutlined />
          <span>{formatMessage('word.table.size')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {formatMessage('word.dialog.cancel')}
        </Button>,
        <Button key="insert" type="primary" onClick={handleInsert}>
          {formatMessage('word.table.insert')}
        </Button>,
      ]}
      width={320}
    >
      <div className="table-editor">
        <div className="table-editor__row">
          <label className="table-editor__label">{formatMessage('word.table.rows')}</label>
          <InputNumber
            min={1}
            max={50}
            value={rows}
            onChange={(value) => setRows(value || 1)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="table-editor__row">
          <label className="table-editor__label">{formatMessage('word.table.columns')}</label>
          <InputNumber
            min={1}
            max={20}
            value={columns}
            onChange={(value) => setColumns(value || 1)}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Modal>
  );
}

export default TableEditor;
