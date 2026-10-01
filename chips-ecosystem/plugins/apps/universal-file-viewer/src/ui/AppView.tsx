import React from 'react';
import { App, ChipsProvider, CommandProvider } from '@chips/ui';
import { UniversalViewerScene } from './UniversalViewerScene';

const APP_ID = 'chips.official.universal-file-viewer';

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件；
 * antd App 提供全局提示上下文（`App.useApp()` 是提示通道的唯一许可入口）。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <App>
        <UniversalViewerScene />
      </App>
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
