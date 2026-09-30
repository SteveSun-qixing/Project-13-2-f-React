import React from 'react';
import { Button, ChipsProvider, CommandProvider, theme } from '@chips/ui';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';

const APP_ID = 'chips.official.music-player';

/** 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。 */
const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  const [count, setCount] = React.useState(0);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
        padding: token.padding,
      }}
    >
      <p style={{ margin: 0 }}>你好，这是「音乐播放器」的应用界面。</p>
      <Button type="primary" onClick={() => setCount((value) => value + 1)}>
        点击次数：{count}
      </Button>
    </section>
  );
};

/**
 * 命令消费展示区：挂载命令注册状态与 `command:invoked` 派发执行记录。
 *
 * 两个按钮以 `source: 'api'` 经 `command:invoke` 触发本应用登记的 ui 目标命令，
 * 平台向本窗口派发后由 `attach` 的本地处理器执行并回写状态。
 */
const CommandSection: React.FC = () => {
  const { token } = theme.useToken();
  const { phase, errorCode, lastInvoked, invokeOpenCard, invokeRefreshView } = useAppCommands();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        paddingInline: token.padding,
        paddingBottom: token.padding,
      }}
    >
      <p style={{ margin: 0 }}>命令注册状态：{COMMAND_PHASE_LABELS[phase]}</p>
      {errorCode === null ? null : <p style={{ margin: 0 }}>最近错误码：{errorCode}</p>}
      <div style={{ display: 'flex', gap: token.marginXS }}>
        <Button onClick={() => void invokeOpenCard('~/文档/示例.cpk')}>触发打开卡片命令</Button>
        <Button onClick={() => void invokeRefreshView()}>触发刷新视图命令</Button>
      </div>
      <p style={{ margin: 0 }}>
        {lastInvoked === null
          ? '本窗口尚未执行过命令派发'
          : '最近执行：' + lastInvoked.commandId}
      </p>
    </section>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <AppContent />
      <CommandSection />
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
