import { App, Button, ChipsProvider, CommandProvider, Flex, Tag, Typography, theme } from '@chips/ui';
import { useCallback, useEffect, useState, type FC, type ReactNode } from 'react';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import type { CommunityRoute } from '../domain/community/routeTable';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PendingCapabilityPage } from './pages/PendingCapabilityPage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import { getCommunityRuntime, type CommunityRuntime } from './runtime/communityRuntime';
import { useCommunityRoute } from './useCommunityRoute';

const APP_ID = 'chips.official.community-client';

/** 一条已登记的本地查看请求（命令 `community-client:open-card` 的会话内存登记）。 */
export interface LocalViewRequest {
  readonly path: string;
}

/** 顶栏导航项（路由表驱动，不含未登记入口）。 */
interface ShellNavItem {
  readonly key: string;
  readonly label: string;
  readonly route: CommunityRoute;
}

const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  { key: 'welcome', label: '首页', route: { name: 'welcome' } },
  { key: 'workspace', label: '工作区', route: { name: 'workspace' } },
  { key: 'about', label: '社区简介', route: { name: 'about' } },
  { key: 'settings', label: '设置', route: { name: 'settings' } },
];

/**
 * 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。
 *
 * 壳层按 §3.3 组织：顶栏展示站点名称、工作区、设置与账号入口（未登录时展示登录/注册入口）；
 * 内容区按 §3.2 路由表逐行落位——数据面依赖域就绪前的页面统一由候前置件登记页承载
 * （如实呈现依赖域与落波去向，不铺替代数据、不设不可用控件）；页脚承载简介与命令注册状态。
 * 命令动作装配（打开卡片登记 / 刷新视图）经 ref 现取最新状态，避免陈旧闭包。
 */
const AppContent: FC<{ runtime: CommunityRuntime }> = ({ runtime }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = runtime.getSession();
  const { route, navigate } = useCommunityRoute({
    loggedIn: session.loggedIn,
    username: session.loggedIn ? session.username : null,
  });
  const { phase, errorCode, lastInvoked, setActions, invokeRefreshView } = useAppCommands();
  const [refreshToken, setRefreshToken] = useState(0);
  const [localViewRequest, setLocalViewRequest] = useState<LocalViewRequest | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 命令动作装配：打开卡片登记为会话内存请求（本地查看候 transfer:* 链路，如实呈现）。
  useEffect(() => {
    setActions({
      openCard: (path: string): void => {
        setLocalViewRequest({ path });
        setFeedback(`已登记本地查看请求：${path}（候卡片传输链路落波后开放本地查看）`);
      },
      refreshView: (): void => {
        setRefreshToken((token_) => token_ + 1);
        setFeedback('当前视图已刷新');
      },
    });
    return (): void => {
      setActions(null);
    };
  }, [setActions]);

  // 成功类反馈自动消退；失败类反馈（载荷非法）行内呈现，须显式处置。
  useEffect(() => {
    if (feedback === null) {
      return;
    }
    const timer = window.setTimeout((): void => {
      setFeedback(null);
    }, 3200);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  const notify = useCallback(
    (text: string): void => {
      message.info(text);
    },
    [message],
  );

  const renderRoute = (): ReactNode => {
    switch (route.name) {
      case 'welcome':
        return (
          <WelcomePage
            session={session}
            navigateRegister={() => navigate({ name: 'register' })}
            navigateProfile={() => {
              if (session.loggedIn) {
                navigate({ name: 'profile', username: session.username });
              }
            }}
          />
        );
      case 'about':
        return <AboutPage />;
      case 'login':
        return (
          <PendingCapabilityPage
            title="登录"
            description="使用社区账号登录后可浏览私密内容、上传作品与完整下载。"
            pendingIds={['network', 'session']}
          />
        );
      case 'register':
        return (
          <PendingCapabilityPage
            title="注册"
            description="注册社区账号后即可在社区发布卡片与箱子作品。"
            pendingIds={['network', 'session']}
          />
        );
      case 'workspace':
        return (
          <PendingCapabilityPage
            title="工作区"
            description="展示当前用户的卡片与箱子列表，并提供「上传卡片 / 上传箱子」入口。"
            pendingIds={['network', 'session', 'transfer', 'dialog-shell']}
          />
        );
      case 'profile':
        return (
          <PendingCapabilityPage
            title={`个人主页（@${route.username}）`}
            description="展示用户资料与作品列表（卡片与箱子，按创建时间倒序、分页）。"
            pendingIds={['network']}
          />
        );
      case 'cardDetail':
        return (
          <PendingCapabilityPage
            title="卡片详情"
            description={`展示卡片 ${route.cardId} 的公开信息，并提供本地查看与完整下载入口。`}
            pendingIds={['network', 'transfer', 'dialog-shell']}
          />
        );
      case 'boxDetail':
        return (
          <PendingCapabilityPage
            title="箱子详情"
            description={`展示箱子 ${route.boxId} 的信息与条目快照列表（不展开条目内容）。`}
            pendingIds={['network']}
          />
        );
      case 'admin':
        return (
          <PendingCapabilityPage
            title="管理员入口"
            description="经系统浏览器打开社区管理后台，鉴权在浏览器内完成。"
            pendingIds={['dialog-shell', 'server']}
          />
        );
      case 'settings':
        return <SettingsPage key={refreshToken} runtime={runtime} onNotify={notify} />;
      case 'notFound':
        return <NotFoundPage navigateHome={() => navigate({ name: 'welcome' })} />;
    }
  };

  return (
    <Flex vertical style={{ height: '100%', background: token.colorBgLayout }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          flexWrap: 'wrap',
          paddingInline: token.padding,
          paddingBlock: token.paddingSM,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong style={{ fontSize: token.fontSizeLG }} data-role="site-name">
          薯片社区
        </Typography.Text>
        <Flex gap={token.marginXS} wrap="wrap">
          {SHELL_NAV_ITEMS.map((item) => (
            <Button key={item.key} type="text" onClick={() => navigate(item.route)} data-role={`nav-${item.key}`}>
              {item.label}
            </Button>
          ))}
        </Flex>
        <Flex style={{ marginInlineStart: 'auto' }} gap={token.marginXS} align="center">
          {session.loggedIn ? null : (
            <Button type="link" data-role="nav-login" onClick={() => navigate({ name: 'login' })}>
              登录 / 注册
            </Button>
          )}
        </Flex>
      </header>

      {localViewRequest !== null ? (
        <div style={{ paddingInline: token.padding, paddingTop: token.paddingSM }}>
          <Tag data-role="local-view-request" color="warning">
            本地查看请求待开放：{localViewRequest.path}（候卡片传输链路落波）
          </Tag>
        </div>
      ) : null}

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: token.padding }}>
        <Flex vertical gap={token.marginSM} align="center">
          <div style={{ width: '100%', maxWidth: 880 }} data-role="route-content">
            {renderRoute()}
          </div>
          {feedback !== null ? (
            <Typography.Text type="secondary" data-role="app-feedback" style={{ width: '100%', maxWidth: 880 }}>
              {feedback}
            </Typography.Text>
          ) : null}
          {lastInvoked !== null && !lastInvoked.ok ? (
            <Typography.Text type="warning" data-role="command-invalid" style={{ width: '100%', maxWidth: 880 }}>
              命令 {lastInvoked.commandId} 的载荷不合法，已拒绝执行
            </Typography.Text>
          ) : null}
        </Flex>
      </main>

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: token.marginSM,
          flexWrap: 'wrap',
          paddingInline: token.padding,
          paddingBlock: token.paddingSM,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text type="secondary" data-role="footer-note">
          薯片社区 · 卡片与箱子作品的官方社区
        </Typography.Text>
        <Flex gap={token.marginXS} align="center">
          <Button onClick={() => void invokeRefreshView()} data-role="footer-refresh">
            刷新当前视图
          </Button>
          <Typography.Text type="secondary" data-role="command-phase">
            命令注册状态：{COMMAND_PHASE_LABELS[phase]}
            {phase === 'error' && errorCode !== null ? `（${errorCode}）` : ''}
          </Typography.Text>
        </Flex>
      </footer>
    </Flex>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件；
 * App 提供消息上下文（`App.useApp()` 为许可通道）。
 */
export const AppView: FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <App>
        <AppContent runtime={getCommunityRuntime()} />
      </App>
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
