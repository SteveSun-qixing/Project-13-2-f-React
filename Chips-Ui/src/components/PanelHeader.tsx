import { Flex, Typography } from "antd";
import type { ReactNode } from "react";

export interface PanelHeaderProps {
  title: string;
  extra?: ReactNode;
  description?: string;
}

export function PanelHeader({ title, extra, description }: PanelHeaderProps): React.ReactElement {
  return (
    <Flex justify="space-between" align="center" style={{ marginBottom: 12, minHeight: 32 }}>
      <Flex vertical gap={0}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Typography.Text>
        ) : null}
      </Flex>
      {extra ? <Flex align="center" gap={8}>{extra}</Flex> : null}
    </Flex>
  );
}
