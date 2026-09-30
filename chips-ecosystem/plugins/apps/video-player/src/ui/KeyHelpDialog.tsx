import React from 'react';
import { Button, Modal, Typography, theme } from '@chips/ui';
import { KEY_HELP_GROUPS } from '../messages';

/**
 * 键位帮助（重写件）：antd Modal 承载（《03-查看器设计》§10.1 媒体键位行），
 * Esc 关闭由 Modal 自带焦点语义承接，不再自挂 document 监听。
 */

export interface KeyHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export const KeyHelpDialog: React.FC<KeyHelpDialogProps> = ({ open, onClose }) => {
  const { token } = theme.useToken();
  return (
    <Modal
      open={open}
      title="快捷键"
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {KEY_HELP_GROUPS.map((group) => (
          <section key={group.title}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              {group.title}
            </Typography.Title>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map((item) => (
                <li key={`${group.title}-${item.keys}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <kbd
                    style={{
                      minWidth: 96,
                      textAlign: 'center',
                      padding: '2px 8px',
                      borderRadius: token.borderRadiusLG,
                      border: `1px solid ${token.colorBorder}`,
                      fontFamily: 'inherit',
                      fontSize: token.fontSizeSM,
                    }}
                  >
                    {item.keys}
                  </kbd>
                  <Typography.Text>{item.label}</Typography.Text>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
        输入框聚焦时不触发单键快捷键；按 Esc 关闭本窗口。
      </Typography.Text>
    </Modal>
  );
};

export default KeyHelpDialog;
