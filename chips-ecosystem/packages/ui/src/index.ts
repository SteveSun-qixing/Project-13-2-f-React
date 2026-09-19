/**
 * `@chips/ui`：薯片生态唯一共享前端层（前端唯一导入面）。
 *
 * 唯一事实源：《08-@chips-ui共享层使用指南》§2（导出清单）；视觉数值以《09-统一视觉规范》为唯一来源。
 * - 业务代码只从本包导入组件、Hooks、Design Tokens 与图标（R4）；
 * - 主题根由 `ChipsProvider` 安装一次；命令运行时由 `CommandProvider` 提供；
 * - `global.css` 只由平台壳窗口渲染层导入一次（`import '@chips/ui/global.css'`）。
 */

export * from './base';
export * from './tokens';
export * from './theme';
export * from './command';
export * from './components';
export * from './utils';
