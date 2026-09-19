/** 加载 / 错误 / 空态边界：数据区的三态统一收口。 */

import { Button, Empty, Result, Skeleton, Spin, theme } from '@chips/antd';
import React from 'react';
import type { CSSProperties } from 'react';

import type { StateBoundaryProps } from './types';

/**
 * 状态边界：按 加载 → 错误 → 空态 → 内容 的顺序渲染；内容为 `null` / `undefined` 时给出骨架。
 *
 * @param props 状态属性
 * @returns 状态元素
 */
export const StateBoundary: React.FC<StateBoundaryProps> = ({
  loading = false,
  error = null,
  empty = false,
  emptyText = '暂无内容',
  onRetry,
  minHeight = 160,
  children,
}) => {
  const { token } = theme.useToken();
  const centered: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight,
    padding: token.paddingLG,
  };

  if (loading) {
    return (
      <div style={centered}>
        <Spin />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div style={centered}>
        <Result
          status="error"
          title="出错了"
          subTitle={error.message}
          extra={
            onRetry === undefined ? undefined : (
              // 关闭 antd 双字按钮的自动字距：无障碍名称与界面文案逐字一致。
              <Button type="primary" autoInsertSpace={false} onClick={onRetry}>
                重试
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (empty) {
    return (
      <div style={centered}>
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  if (children === undefined || children === null) {
    return (
      <div style={{ padding: token.padding }}>
        <Skeleton active />
      </div>
    );
  }

  return <>{children}</>;
};

export type { StateBoundaryProps } from './types';
