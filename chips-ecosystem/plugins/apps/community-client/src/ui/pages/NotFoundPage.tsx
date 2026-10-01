/**
 * 404 页（16-CC §3.2 `*`；§3.3：展示返回首页入口，返回行为使用路由器历史，不打开系统新窗口）。
 */

import { Button, Result } from '@chips/ui';
import type { FC } from 'react';

/** 404 页属性：返回首页导航回调（由壳层注入）。 */
export interface NotFoundPageProps {
  readonly navigateHome: () => void;
}

/** 404 页路由 `*`（未登记路径统一归此页）。 */
export const NotFoundPage: FC<NotFoundPageProps> = ({ navigateHome }) => (
  <Result
    data-role="not-found"
    status="404"
    title="404"
    subTitle="页面不存在或路径有误"
    extra={
      <Button type="primary" data-role="not-found-home" onClick={navigateHome}>
        返回首页
      </Button>
    }
  />
);
