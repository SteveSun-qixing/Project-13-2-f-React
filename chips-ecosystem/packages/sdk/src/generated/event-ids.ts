// 标准事件 ID 常量
// 此文件由 chips-ecosystem/tools/contract-gen 生成，禁止手写修改。
// 事实源（薯片生态文档库）：
//   - 05-接口与契约/05.02-05-事件契约规范-二、命名契约.md §2.2 平台保留域
//   - 05-接口与契约/05.05-05-事件契约规范-四、标准事件-4.1 插件生命周期.md §第四节 标准事件
//   - 05-接口与契约/05.06-05-事件契约规范-四、标准事件-4.2 文档.md §第四节 标准事件
//   - 05-接口与契约/05.07-05-事件契约规范-四、标准事件-4.3 文件.md §第四节 标准事件
//   - 05-接口与契约/05.08-05-事件契约规范-四、标准事件-4.4 资源.md §第四节 标准事件
//   - 05-接口与契约/05.09-05-事件契约规范-四、标准事件-4.5 配置.md §第四节 标准事件
//   - 05-接口与契约/05.10-05-事件契约规范-四、标准事件-4.6 安全与审计.md §第四节 标准事件
//   - 05-接口与契约/05.11-05-事件契约规范-四、标准事件-4.7 窗口与应用.md §第四节 标准事件
//   - 05-接口与契约/05.12-05-事件契约规范-四、标准事件-4.8 同步.md §第四节 标准事件
//   - 05-接口与契约/05.04-05-事件契约规范-四、标准事件.md §第四节 标准事件
//   - 05-接口与契约/05.13-05-事件契约规范-四、标准事件-4.10 托盘、快捷键与传输.md §第四节 标准事件
// 重新生成：pnpm --filter @chips/contract-gen run generate

export const StandardEvent = {
  PLUGIN_INSTALLED: 'plugin:installed',
  PLUGIN_UNINSTALLED: 'plugin:uninstalled',
  PLUGIN_LOADED: 'plugin:loaded',
  PLUGIN_ENABLED: 'plugin:enabled',
  PLUGIN_DISABLED: 'plugin:disabled',
  PLUGIN_UNLOADED: 'plugin:unloaded',
  PLUGIN_FAILED: 'plugin:failed',
  DOCUMENT_OPENED: 'document:opened',
  DOCUMENT_CLOSED: 'document:closed',
  DOCUMENT_CHANGED: 'document:changed',
  DOCUMENT_SAVED: 'document:saved',
  FILE_CHANGED: 'file:changed',
  RESOURCE_INVALIDATED: 'resource:invalidated',
  RESOURCE_OPENED: 'resource:opened',
  CONFIG_CHANGED: 'config:changed',
  SECURITY_AUDIT: 'security:audit',
  PERMISSION_GRANTED: 'permission:granted',
  PERMISSION_DENIED: 'permission:denied',
  WINDOW_CREATED: 'window:created',
  WINDOW_CLOSED: 'window:closed',
  WINDOW_FOCUSED: 'window:focused',
  APP_LAUNCHED: 'app:launched',
  APP_EXITED: 'app:exited',
  APP_OPENED_WITH_URL: 'app:opened-with-url',
  SYNC_STATE_CHANGED: 'sync:state-changed',
  SYNC_PROGRESS: 'sync:progress',
  SYNC_CONFLICT_DETECTED: 'sync:conflict-detected',
  SYNC_CONFLICT_RESOLVED: 'sync:conflict-resolved',
  SYNC_QUEUE_CHANGED: 'sync:queue-changed',
  SYNC_BLOCKED: 'sync:blocked',
  COMMAND_REGISTERED: 'command:registered',
  COMMAND_UNREGISTERED: 'command:unregistered',
  COMMAND_CHANGED: 'command:changed',
  COMMAND_INVOKED: 'command:invoked',
  TRAY_CLICKED: 'tray:clicked',
  SHORTCUT_TRIGGERED: 'shortcut:triggered',
  TRANSFER_PROGRESS: 'transfer:progress',
  TRANSFER_COMPLETED: 'transfer:completed',
  TRANSFER_FAILED: 'transfer:failed',
} as const;

export type EventId = (typeof StandardEvent)[keyof typeof StandardEvent];

export const EVENT_IDS = [
  'plugin:installed',
  'plugin:uninstalled',
  'plugin:loaded',
  'plugin:enabled',
  'plugin:disabled',
  'plugin:unloaded',
  'plugin:failed',
  'document:opened',
  'document:closed',
  'document:changed',
  'document:saved',
  'file:changed',
  'resource:invalidated',
  'resource:opened',
  'config:changed',
  'security:audit',
  'permission:granted',
  'permission:denied',
  'window:created',
  'window:closed',
  'window:focused',
  'app:launched',
  'app:exited',
  'app:opened-with-url',
  'sync:state-changed',
  'sync:progress',
  'sync:conflict-detected',
  'sync:conflict-resolved',
  'sync:queue-changed',
  'sync:blocked',
  'command:registered',
  'command:unregistered',
  'command:changed',
  'command:invoked',
  'tray:clicked',
  'shortcut:triggered',
  'transfer:progress',
  'transfer:completed',
  'transfer:failed',
] as const satisfies readonly EventId[];
