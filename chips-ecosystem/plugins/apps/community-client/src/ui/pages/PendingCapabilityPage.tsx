/**
 * 候前置件登记页（16-CC §9.3 界面语义与 W5 起步臂裁决的统一呈现面）。
 *
 * 数据面依赖域就绪前的路由页（登录/注册、工作区、个人主页、卡片/箱子详情、管理员入口）
 * 共用本页：如实呈现页面身份、依赖域与落波去向，不铺替代数据、不设不可用控件、
 * 不伪造半加载界面。文案简体中文直写，不展示内部 ID 与真实路径。
 */

import { Card, Flex, Typography, theme } from '@chips/ui';
import type { FC } from 'react';
import {
  COMMUNITY_PENDING_CAPABILITIES,
  findPendingCapability,
  type CommunityPendingCapability,
} from '../../domain/community/pendingCapabilities';

/** 候前置件登记页属性：页面身份与依赖的登记项标识清单（由壳层按路由注入）。 */
export interface PendingCapabilityPageProps {
  /** 页面标题（简体中文，如「登录」「工作区」）。 */
  readonly title: string;
  /** 页面说明（该页就绪后将提供什么）。 */
  readonly description: string;
  /** 依赖的候前置件登记项标识（`pendingCapabilities` 在册 id）。 */
  readonly pendingIds: readonly string[];
}

/** 候前置件登记页（登录/注册/工作区/个人主页/卡片详情/箱子详情/管理员入口共用）。 */
export const PendingCapabilityPage: FC<PendingCapabilityPageProps> = ({
  title,
  description,
  pendingIds,
}) => {
  const { token } = theme.useToken();
  const pendingItems = pendingIds.map((id) => findPendingCapability(id)).filter(
    (item): item is CommunityPendingCapability => item !== null,
  );

  return (
    <Card data-role="pending-page" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ marginTop: 0 }} data-role="pending-title">
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" data-role="pending-description">
        {description}
      </Typography.Paragraph>
      <Typography.Title level={5}>候前置件</Typography.Title>
      <Flex vertical gap={token.marginXS}>
        {pendingItems.map((item) => (
          <Flex key={item.id} vertical gap={2}>
            <Typography.Text strong>
              {item.title}（缺失域：{item.domain}）
            </Typography.Text>
            <Typography.Text type="secondary">{item.unlockWave}</Typography.Text>
          </Flex>
        ))}
        {pendingItems.length === 0 ? (
          <Typography.Text type="secondary">
            本页能力在 {COMMUNITY_PENDING_CAPABILITIES.length} 项候前置件登记收口后逐项开放。
          </Typography.Text>
        ) : null}
      </Flex>
    </Card>
  );
};
