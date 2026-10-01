/**
 * 欢迎页（16-CC §3.2 `/`：数据来源为会话状态；§4.2 展示要点：品牌文案、能力介绍、行动按钮）。
 *
 * 主按钮由会话状态决定：未登录展示「去注册」（导航 `/register`），已登录展示
 * 「进入个人主页」（导航 `/@<username>`，username 取服务器回包）。注册页当前为
 * 候前置件登记面（诚实呈现），导航行为本身真实有效。
 */

import { Button, Card, Typography, theme } from '@chips/ui';
import type { FC } from 'react';
import { COMMUNITY_PENDING_CAPABILITIES } from '../../domain/community/pendingCapabilities';
import type { CommunitySessionState } from '../runtime/communityRuntime';

/** 欢迎页属性：会话状态与导航器（由壳层注入）。 */
export interface WelcomePageProps {
  readonly session: CommunitySessionState;
  readonly navigateRegister: () => void;
  readonly navigateProfile: () => void;
}

/** 欢迎页路由 `/`。 */
export const WelcomePage: FC<WelcomePageProps> = ({ session, navigateRegister, navigateProfile }) => {
  const { token } = theme.useToken();

  return (
    <Card data-role="welcome-card" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        薯片社区
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: token.marginSM }}>
        在这里发布你的卡片与箱子作品：浏览社区内容、登录社区账号、把本地卡片上传为网络资源卡片，
        或把社区卡片完整下载回本地继续编辑。
      </Typography.Paragraph>
      {session.loggedIn ? (
        <Button type="primary" data-role="welcome-primary" onClick={navigateProfile}>
          进入个人主页
        </Button>
      ) : (
        <Button type="primary" data-role="welcome-primary" onClick={navigateRegister}>
          去注册
        </Button>
      )}
      <Typography.Title level={5} style={{ marginTop: token.marginLG }}>
        当前开放能力
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }} data-role="welcome-scope">
        本窗口当前开放：路由浏览、社区简介、服务器地址设置（会话内存生效）；
        {COMMUNITY_PENDING_CAPABILITIES.length} 项能力处于候前置件登记中，详见「设置」页的登记表。
      </Typography.Paragraph>
    </Card>
  );
};
