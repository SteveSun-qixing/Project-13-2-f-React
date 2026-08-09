import React from "react";
import { Button, Descriptions, Modal, Typography } from "antd";

export interface InfoDialogSection {
  id: string;
  title: string;
  fields: Array<{
    label: string;
    value: React.ReactNode;
  }>;
}

interface InfoDialogProps {
  open: boolean;
  title: string;
  description: string;
  closeLabel: string;
  sections: InfoDialogSection[];
  onClose: () => void;
}

export function InfoDialog({
  open,
  title,
  description,
  closeLabel,
  sections,
  onClose,
}: InfoDialogProps): React.ReactElement {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      width={720}
      styles={{ body: { padding: "20px 24px 24px" } }}
      footer={[
        <Button key="close" onClick={onClose}>
          {closeLabel}
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {description}
      </Typography.Paragraph>
      <div className="rte-info-dialog__body">
        {sections.map((section) => (
          <section key={section.id} className="rte-info-dialog__section">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {section.title}
            </Typography.Title>
            <Descriptions size="small" column={1} colon>
              {section.fields.map((field) => (
                <Descriptions.Item key={`${section.id}-${field.label}`} label={field.label}>
                  {field.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </section>
        ))}
      </div>
    </Modal>
  );
}
