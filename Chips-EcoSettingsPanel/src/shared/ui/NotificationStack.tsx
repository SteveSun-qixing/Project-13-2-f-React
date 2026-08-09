import React from "react";
import { Alert, Flex } from "antd";

export interface FeedbackItem {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface NotificationStackProps {
  ariaLabel: string;
  items: FeedbackItem[];
  closeButtonLabel?: string;
  onDismiss?: (item: FeedbackItem) => void;
}

export function NotificationStack({ ariaLabel, closeButtonLabel, items, onDismiss }: NotificationStackProps): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="settings-feedback-toast" role="region" aria-label={ariaLabel}>
      <Flex vertical gap={8} className="settings-feedback-toast__list">
        {items.map((item) => (
          <Alert
            key={item.id}
            className="settings-feedback-toast__item"
            type={item.tone}
            showIcon
            message={item.title}
            description={item.message}
            closable
            closeText={closeButtonLabel}
            onClose={() => onDismiss?.(item)}
          />
        ))}
      </Flex>
    </div>
  );
}
