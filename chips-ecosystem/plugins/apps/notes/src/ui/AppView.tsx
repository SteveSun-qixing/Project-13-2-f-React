import { useEffect, useMemo, type FC } from 'react';
import { Alert, App, Button, ChipsProvider, CommandProvider, Flex, Typography, theme } from '@chips/ui';
import { NotesList, NoteEditor, OpenSourceBar } from './NoteEditor';
import { useNotesLibrary } from './useNotesLibrary';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';

const APP_ID = 'chips.official.notes';

/**
 * 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。
 *
 * 布局为左列表右编辑区两栏（Flex + 令牌；`Layout` 属 @chips/ui 禁面组件不迁移，
 * 分栏容器以令牌化样式承担，不硬编码视觉数值）。
 */
const AppContent: FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const library = useNotesLibrary();
  const { phase, errorCode, setActions, invokeRefresh } = useAppCommands();
  const { feedback, status, openSource, refreshCurrent } = library;

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

  // 成功类反馈走顶部浮层短提示；失败类反馈保留在行内（须显式处置，见控制器）。
  useEffect(() => {
    if (feedback !== null && status !== 'error') {
      message.info(feedback);
    }
    // message 实例随 App 上下文稳定，仅按反馈文本变化触发。
  }, [feedback, status, message]);

  return (
    <Flex style={{ height: '100%', background: token.colorBgLayout }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: token.marginSM,
          padding: token.padding,
          background: token.colorBgContainer,
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'auto',
        }}
      >
        <Typography.Text strong>笔记库</Typography.Text>
        <OpenSourceBar onOpen={(source) => void library.openSource(source)} busy={status === 'opening'} />
        {feedback !== null && status === 'error' ? (
          <Alert type="error" showIcon message={feedback} />
        ) : null}
        {phase === 'error' && errorCode !== null ? (
          <Alert type="warning" showIcon message={`命令通道异常（${errorCode}）`} />
        ) : null}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <NotesList
            library={library.library}
            selectedId={library.selectedId}
            onSelect={(documentId) => void library.select(documentId)}
          />
        </div>
        <Typography.Text type="secondary">命令注册状态：{COMMAND_PHASE_LABELS[phase]}</Typography.Text>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: token.padding, background: token.colorBgContainer, overflow: 'auto' }}>
        <Flex vertical gap={token.marginSM}>
          <Flex justify="space-between" align="center">
            <Typography.Title level={4} style={{ margin: 0 }}>
              笔记工作台
            </Typography.Title>
            <Button onClick={invokeRefresh}>刷新当前视图</Button>
          </Flex>
          <NoteEditor
            summary={library.selected}
            detail={library.detail}
            nodeContents={library.nodeContents}
            onLoadNodeContent={(nodeId) => void library.loadNodeContent(nodeId)}
            revision={library.revision}
            savedDigest={library.savedDigest}
            writeError={library.writeError}
            pendingChange={library.pendingChange}
            commitBusy={library.commitBusy}
            saveBusy={library.saveBusy}
            onStageRename={library.stageRename}
            onStageDescription={library.stageDescription}
            onStageNodeContent={library.stageNodeContent}
            onDiscardEdits={library.discardEdits}
            onCommitEdits={() => void library.commitPending()}
            onSaveToDisk={() => void library.saveToDisk()}
          />
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
