/**
 * 设置页（16-CC §3.2 `/settings`：服务器地址、当前账号；§5.3 设置页校验口径）。
 *
 * 服务器地址：格式归一 + `network:http` 域集合命中校验（`serverConfig` 纯函数面），
 * 保存到窗口会话运行时并即时生效；生效层如实标记「会话内存（未持久化）」
 * （`config:*` 域宿主处理器缺位，工单066 在册；不伪造持久化成功）。
 * 拒绝保存时按在册错误码 `COMMUNITY_CLIENT_SERVER_UNSUPPORTED` 行内呈现并说明支持范围。
 * 当前账号：会话如实呈现「未登录」（候前置件，见登记表）。
 */

import { Alert, App, Button, Card, Descriptions, Flex, Input, Typography, theme } from '@chips/ui';
import type { FC, ReactElement } from 'react';
import { useState } from 'react';
import {
  COMMUNITY_PENDING_CAPABILITIES,
  type CommunityPendingCapability,
} from '../../domain/community/pendingCapabilities';
import { describeServerScope } from '../../domain/community/serverConfig';
import type { CommunityRuntime } from '../runtime/communityRuntime';

/** 设置页属性：窗口会话运行时与刷新反馈回调（由壳层注入）。 */
export interface SettingsPageProps {
  readonly runtime: CommunityRuntime;
  readonly onNotify: (text: string) => void;
}

/** 设置页路由 `/settings`。 */
export const SettingsPage: FC<SettingsPageProps> = ({ runtime, onNotify }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [draft, setDraft] = useState<string>(runtime.getServerBase().url);
  const [snapshot, setSnapshot] = useState(runtime.getServerBase());
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const session = runtime.getSession();

  const save = (): void => {
    const result = runtime.saveServerBase(draft);
    if (result.ok) {
      setErrorCode(null);
      setSnapshot(result.snapshot);
      setDraft(result.snapshot.url);
      message.info('服务器地址已保存并生效（会话内存，未持久化）');
      onNotify(`社区服务器基址：${result.snapshot.url}`);
      return;
    }
    setErrorCode(result.code);
  };

  return (
    <Flex vertical gap={token.marginSM} style={{ width: '100%' }}>
      <Card data-role="server-card">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          社区服务器
        </Typography.Title>
        <Flex gap={token.marginXS} wrap="wrap">
          <Input
            data-role="server-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            style={{ maxWidth: 420 }}
            placeholder={describeServerScope()}
          />
          <Button type="primary" data-role="server-save" onClick={save}>
            保存
          </Button>
        </Flex>
        {errorCode !== null ? (
          <Alert
            data-role="server-error"
            type="error"
            showIcon
            style={{ marginTop: token.marginSM }}
            message="该服务器地址不在客户端支持范围内，请使用列表中的服务器"
            description={describeServerScope()}
          />
        ) : null}
        <Typography.Text type="secondary" data-role="server-effective" style={{ display: 'block', marginTop: token.marginSM }}>
          当前生效：{snapshot.url}（生效层：会话内存，未持久化；候 `config:*` 域宿主处理器落波后写入配置）
        </Typography.Text>
      </Card>
      <Card>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          当前账号
        </Typography.Title>
        <Descriptions column={1} size="small" data-role="account-descriptions">
          <Descriptions.Item label="登录状态">{session.loggedIn ? '已登录' : '未登录'}</Descriptions.Item>
          {session.loggedIn ? null : <Descriptions.Item label="说明">{session.reason}</Descriptions.Item>}
        </Descriptions>
      </Card>
      <Card data-role="pending-card">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          候前置件登记（{COMMUNITY_PENDING_CAPABILITIES.length} 项）
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          以下能力按 W5 派单裁决候宿主域处理器与服务端波次收口；登记期间不铺替代数据、不设不可用控件。
        </Typography.Paragraph>
        <PendingList />
      </Card>
    </Flex>
  );
};

function PendingList(): ReactElement {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.marginXS}>
      {COMMUNITY_PENDING_CAPABILITIES.map((item: CommunityPendingCapability) => (
        <Flex
          key={item.id}
          data-role={`pending-${item.id}`}
          vertical
          gap={2}
          style={{
            padding: token.paddingSM,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Typography.Text strong>{item.title}</Typography.Text>
          <Typography.Text type="secondary">缺失域：{item.domain}</Typography.Text>
          <Typography.Text type="secondary">{item.pendingBecause}</Typography.Text>
          <Typography.Text type="secondary">落波去向：{item.unlockWave}</Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
}
