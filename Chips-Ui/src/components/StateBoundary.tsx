import { Button, Empty, Result, Skeleton, Spin } from "antd";
import type { ReactNode } from "react";

export interface StateBoundaryProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: ReactNode;
  minHeight?: number;
}

export function StateBoundary({
  loading,
  error,
  empty,
  emptyText = "暂无内容",
  onRetry,
  children,
  minHeight = 160,
}: StateBoundaryProps): React.ReactElement {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight, padding: 24 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight, padding: 24 }}>
        <Result
          status="error"
          title="出错了"
          subTitle={error}
          extra={
            onRetry ? (
              <Button type="primary" onClick={onRetry}>
                重试
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (empty) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight, padding: 24 }}>
        <Empty description={emptyText} />
      </div>
    );
  }

  if (children === undefined || children === null) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton active />
      </div>
    );
  }

  return <>{children}</>;
}
