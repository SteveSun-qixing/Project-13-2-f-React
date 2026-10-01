import { useCallback, useEffect, useMemo, useState, type FC, type ReactElement } from 'react';
import {
  App,
  AppstoreOutlined,
  BgColorsOutlined,
  Button,
  ChipsProvider,
  CommandProvider,
  DatabaseOutlined,
  FileDoneOutlined,
  Flex,
  FolderOpenOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  Menu,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  Typography,
  theme,
} from '@chips/ui';
import { findScene, scenesInOrder, type SettingsSceneId } from '../domain/settings/catalog';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import { usePreferenceRuntime } from './usePreferenceRuntime';
import { DegradedScene, PreferenceScene } from './Scenes';

const APP_ID = 'chips.official.settings';

/** 导航行图标（@ant-design/icons 在册图标名；禁止 emoji、字符图标与占位字形）。 */
const SCENE_ICONS: Readonly<Record<SettingsSceneId, ReactElement>> = {
  appearance: <BgColorsOutlined />,
  behavior: <ThunderboltOutlined />,
  workspace: <FolderOpenOutlined />,
  plugins: <AppstoreOutlined />,
  permissions: <SafetyCertificateOutlined />,
  shortcuts: <KeyOutlined />,
  'file-open': <FileDoneOutlined />,
  storage: <DatabaseOutlined />,
  about: <InfoCircleOutlined />,
};

/**
 * 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。
 *
 * 壳层按注册表驱动（《05-生态设置面板设计》§2.3）：左侧九类导航行与右侧内容区
 * 只消费 `SETTINGS_SCENES`，禁止在组件内条件分支追加页面；窄屏切换器随导航臂后续
 * 形态落位（消费同一套注册表）。偏好读写经偏好运行时（config:* 真实现消费，
 * 工单066 翻正第一批）。
 */
const AppContent: FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [activeScene, setActiveScene] = useState<SettingsSceneId>('appearance');
  const { phase, errorCode, setActions, invokeRefresh } = useAppCommands();

  // 成功类反馈走顶部浮层短提示（失败类反馈在页面行内，须显式处置）。
  const notify = useCallback(
    (text: string): void => {
      message.info(text);
    },
    [message],
  );

  const runtime = usePreferenceRuntime({ onNotify: notify });
  const { reload } = runtime;

  // 命令动作装配：分类跳转 + 刷新偏好快照（装配一次，动作内部读取最新状态）。
  useEffect(() => {
    setActions({
      openScene: (sceneId: string): void => {
        const scene = findScene(sceneId);
        if (scene === null) {
          return;
        }
        setActiveScene(scene.id);
      },
      refreshView: (): void => {
        reload();
      },
    });
    return (): void => {
      setActions(null);
    };
  }, [setActions, reload]);

  const scene = findScene(activeScene);
  const menuItems = useMemo(
    () =>
      scenesInOrder().map((item) => ({
        key: item.id,
        icon: SCENE_ICONS[item.id],
        label: item.title,
      })),
    [],
  );

  if (scene === null) {
    // 注册表保证在册标识；防御性分支（未知标识不渲染，避免静默回退首项）。
    return null;
  }

  return (
    <Flex style={{ height: '100%', background: token.colorBgLayout }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: token.paddingSM,
          background: token.colorBgContainer,
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'auto',
        }}
      >
        <Typography.Text strong style={{ paddingInline: token.paddingXS, marginBottom: token.marginSM }}>
          生态设置面板
        </Typography.Text>
        <Menu
          mode="inline"
          selectedKeys={[scene.id]}
          items={menuItems}
          onClick={(info) => setActiveScene(info.key as SettingsSceneId)}
          style={{ borderInlineEnd: 'none', background: 'transparent', flex: 1 }}
        />
        <div style={{ paddingInline: token.paddingXS }}>
          <Typography.Text type="secondary">命令注册状态：{COMMAND_PHASE_LABELS[phase]}</Typography.Text>
          {phase === 'error' && errorCode !== null ? (
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              错误码：{errorCode}
            </Typography.Text>
          ) : null}
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: token.padding }}>
        <Flex vertical gap={token.marginSM}>
          <Flex justify="space-between" align="center">
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {scene.title}
              </Typography.Title>
              <Typography.Text type="secondary">{scene.summary}</Typography.Text>
            </div>
            <Button onClick={invokeRefresh}>刷新当前视图</Button>
          </Flex>
          {scene.requiredDomains.length === 0 ? (
            <PreferenceScene sceneId={scene.id} runtime={runtime} />
          ) : (
            <DegradedScene sceneId={scene.id} />
          )}

        </Flex>
      </main>
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
        <AppContent />
      </App>
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
