import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { Alert, App, ChipsProvider, CommandProvider, Flex, theme } from '@chips/ui';
import { createIsolatedBrowseGateway } from '../domain/browse/browseGateway';
import { useAppCommands } from '../commands/useAppCommands';
import { useResourceBrowser } from './useResourceBrowser';
import { ContentColumn, DetailPanel, NavigatorColumn } from './BrowseView';

const APP_ID = 'chips.official.resource-manager';

/**
 * 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。
 *
 * 三栏结构（《04-资源管理器产品设计》§2.2）的最小可用面：导航栏（快速访问 + 已打开位置）
 * + 内容区（工具栏 + 条目视图）+ 详情面板；栏宽折叠与记忆候跨会话浏览状态通道落位后补齐。
 */
const AppContent: FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const browser = useResourceBrowser(createIsolatedBrowseGateway());
  const { phase, errorCode, setActions, invokeRefresh } = useAppCommands();
  const { feedback, status, openSource, refreshCurrent } = browser;
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // 命令动作装配：领域控制器就绪后接通 open-card / refresh-view 本地处理器
  // （动作函数为稳定 useCallback，动作对象随其引用更替，避免陈旧闭包）。
  const commandActions = useMemo(
    () => ({
      openCard: (path: string): void => {
        void openSource(path);
      },
      refreshView: (): void => {
        void refreshCurrent();
      },
    }),
    [openSource, refreshCurrent],
  );
  useEffect(() => {
    setActions(commandActions);
    return (): void => {
      setActions(null);
    };
  }, [commandActions, setActions]);

  // 成功类反馈走顶部浮层短提示；失败类反馈保留在内容区行内（须显式处置）。
  useEffect(() => {
    if (feedback !== null && status !== 'error') {
      message.info(feedback);
    }
    // message 实例随 App 上下文稳定，仅按反馈文本变化触发。
  }, [feedback, status, message]);

  // 文档切换时清退条目选择（选择属内存态，位置切换不残留）。
  useEffect(() => {
    setSelectedEntryId(null);
  }, [browser.selectedId]);

  const onSelectEntry = useCallback((entryId: string): void => {
    setSelectedEntryId(entryId);
  }, []);

  return (
    <Flex vertical style={{ height: '100%', background: token.colorBgLayout }}>
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <NavigatorColumn
          records={browser.records.items}
          selectedId={browser.selectedId}
          phase={phase}
          onSelect={(documentId) => void browser.select(documentId)}
        />
        <ContentColumn
          busy={status === 'opening'}
          feedback={feedback}
          statusFailed={status === 'error'}
          onOpen={(source) => void browser.openSource(source)}
          onRefresh={invokeRefresh}
          summary={browser.selected}
          detail={browser.detail}
          selectedEntryId={selectedEntryId}
          onSelectEntry={onSelectEntry}
        />
        <DetailPanel detail={browser.detail} selectedEntryId={selectedEntryId} />
      </Flex>
      {phase === 'error' && errorCode !== null ? (
        <Alert type="warning" showIcon message={`命令通道异常（${errorCode}）`} banner />
      ) : null}
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
