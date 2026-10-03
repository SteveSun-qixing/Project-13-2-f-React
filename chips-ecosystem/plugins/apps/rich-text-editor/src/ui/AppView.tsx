import { useEffect, useMemo, type FC } from 'react';
import { Alert, App, ChipsProvider, CommandProvider, Flex, Typography, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import type { IResourceOpenContext } from '@chips/sdk';
import { LibraryPanel } from './LibraryPanel';
import { EditorArea } from './EditorArea';
import { useEditorWorkspace } from './useEditorWorkspace';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import { APP_PLUGIN_ID } from '../commands/appCommands';

/**
 * 应用窗口界面根组件（编辑臂收口）：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件；
 * App 提供消息与确认对话框上下文（`App.useApp()` 为许可通道）。
 *
 * 打开面（正式链路三入口，14-资源打开与默认处理器契约 §5.5）：
 * 1. 来源引用输入 / 库选中（document:open 正式面）；
 * 2. 命令派发 `rich-text-editor:open-card`（command:invoked 本地处理器）；
 * 3. 运行中投递 `resource:opened`（插件 ID 匹配后按上下文 URI 打开；宿主路由在途，
 *    订阅面为正式消费位，桥未注入时以空态如实呈现）。
 */

/** `resource:opened` 载荷收窄：仅接收投递给本应用的打开上下文（14 §5.5）。 */
function readOpenedContext(payload: unknown): IResourceOpenContext | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record['pluginId'] !== APP_PLUGIN_ID) {
    return null;
  }
  const context = record['context'];
  if (typeof context !== 'object' || context === null) {
    return null;
  }
  const candidate = context as Record<string, unknown>;
  if (typeof candidate['uri'] !== 'string' || candidate['uri'].trim().length === 0) {
    return null;
  }
  return context as IResourceOpenContext;
}

/** 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。 */
const AppContent: FC = () => {
  const { token } = theme.useToken();
  const workspace = useEditorWorkspace();
  const { openSource, saveNow, exportDocument, createDocument, refreshCurrent, selected } =
    workspace;
  const { phase, errorCode: commandErrorCode, setActions } = useAppCommands();

  // 命令动作装配：领域控制器就绪后接通命令族本地处理器（动作函数为稳定 useCallback，
  // 动作对象随其引用更替，避免陈旧闭包）。
  const commandActions = useMemo(
    () => ({
      openCard: (path: string): void => {
        void openSource(path);
      },
      saveDocument: (): void => {
        void saveNow();
      },
      exportDocument: (): void => {
        void exportDocument('archive', `/${selected?.title ?? '未命名卡片'}.card`);
      },
      newCard: (): void => {
        void createDocument('card', '', 'chips-resource://ws');
      },
      refreshView: (): void => {
        void refreshCurrent();
      },
    }),
    [createDocument, exportDocument, openSource, refreshCurrent, saveNow, selected]
  );
  useEffect(() => {
    setActions(commandActions);
    return (): void => {
      setActions(null);
    };
  }, [commandActions, setActions]);

  // 运行中打开投递：resource:opened 订阅（14 §5.5）；桥未注入时如实空态，不假接线。
  useEffect(() => {
    let cancelled = false;
    let subscription: { dispose(): void } | null = null;
    try {
      subscription = chips.subscribe('resource:opened', (payload: unknown) => {
        if (cancelled) {
          return;
        }
        const context = readOpenedContext(payload);
        if (context !== null) {
          void openSource(context.uri);
        }
      });
    } catch {
      // SDK_BRIDGE_UNAVAILABLE 等：窗口桥接未就绪，界面以空态如实呈现，不伪造内容。
    }
    return () => {
      cancelled = true;
      subscription?.dispose();
    };
  }, [openSource]);

  return (
    <Flex style={{ height: '100%', background: token.colorBgLayout }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: token.padding,
          background: token.colorBgContainer,
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
        }}
      >
        <LibraryPanel
          library={workspace.library}
          selectedId={workspace.selectedId}
          status={workspace.status}
          feedback={workspace.feedback}
          createError={workspace.createError}
          onSelect={(documentId) => void workspace.select(documentId)}
          onOpenSource={(input) => void workspace.openSource(input)}
          onCreateDocument={(kind, name, parent) =>
            void workspace.createDocument(kind, name, parent)
          }
        />
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: token.padding }}>
        <EditorArea
          selected={workspace.selected}
          cardDraft={workspace.cardDraft}
          boxDetail={workspace.boxDetail}
          revision={workspace.revision}
          dirty={workspace.dirty}
          savedDigest={workspace.savedDigest}
          writeError={workspace.writeError}
          saveError={workspace.saveError}
          exportError={workspace.exportError}
          commitBusy={workspace.commitBusy}
          saveBusy={workspace.saveBusy}
          onAttachEditor={workspace.attachEditor}
          onDetachEditor={workspace.detachEditor}
          onSaveNow={() => void workspace.saveNow()}
          onDiscard={workspace.discardEdits}
          onExport={(form, target) => void workspace.exportDocument(form, target)}
          onRefresh={() => void workspace.refreshCurrent()}
        />
      </main>
      {phase !== 'ready' ? (
        <div style={{ position: 'absolute', insetInlineEnd: token.margin, bottom: token.margin }}>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {COMMAND_PHASE_LABELS[phase]}
            {phase === 'error' && commandErrorCode !== null ? `（${commandErrorCode}）` : ''}
          </Typography.Text>
          {phase === 'error' ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: token.marginXXS }}
              message="命令通道异常"
            />
          ) : null}
        </div>
      ) : null}
    </Flex>
  );
};

export const AppView: FC = () => (
  <ChipsProvider appId={APP_PLUGIN_ID} surface="window">
    <CommandProvider>
      <App>
        <AppContent />
      </App>
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
