import { describe, expect, it } from 'vitest';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  readOpenCardPayloadPath,
  type AppCommandStatus,
  type CommunityCommandActions,
} from '../src/commands/appCommands';

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const HANDLER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function createActionsRecorder(): {
  actions: CommunityCommandActions;
  openedPaths: string[];
  refreshes: number;
} {
  const openedPaths: string[] = [];
  let refreshes = 0;
  return {
    actions: {
      openCard: (path: string): void => {
        openedPaths.push(path);
      },
      refreshView: (): void => {
        refreshes += 1;
      },
    },
    openedPaths,
    get refreshes(): number {
      return refreshes;
    },
  };
}

describe('命令元数据（可序列化，与 manifest cli.commands 逐字对应）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBe(2);
    for (const definition of appCommandDefinitions) {
      expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
    }
  });

  it('命令 ID 属于本应用命名空间且携带 ui 目标 handlerId', () => {
    for (const definition of appCommandDefinitions) {
      expect(definition.id).toMatch(COMMAND_ID_PATTERN);
      expect(definition.id.split(':')[0]).toBe(APP_COMMAND_DOMAIN);
      expect(definition.scope).toEqual({ kind: 'app', appId: APP_PLUGIN_ID });
      expect(definition.handlerId).toMatch(HANDLER_ID_PATTERN);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.description?.length).toBeGreaterThan(0);
    }
  });

  it('命令 ID 与处理器 ID 各自唯一且一一对应', () => {
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
  });

  it('运行时命令 ID 与 manifest 声明逐字对应', () => {
    expect(APP_COMMAND_IDS.openCard).toBe('community-client:open-card');
    expect(APP_COMMAND_IDS.refreshView).toBe('community-client:refresh-view');
    expect(APP_COMMAND_HANDLER_IDS.openCard).toBe('open-card');
    expect(APP_COMMAND_HANDLER_IDS.refreshView).toBe('refresh-view');
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并路由业务动作', () => {
    const recorder = createActionsRecorder();
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(recorder.actions, (status) => {
      seen.push(status);
    });
    expect(registrations.map((registration) => registration.commandId)).toEqual([
      APP_COMMAND_IDS.openCard,
      APP_COMMAND_IDS.refreshView,
    ]);
    expect(registrations.map((registration) => registration.handlerId)).toEqual([
      APP_COMMAND_HANDLER_IDS.openCard,
      APP_COMMAND_HANDLER_IDS.refreshView,
    ]);

    const openCard = registrations[0];
    const refreshView = registrations[1];
    void openCard?.handler({ path: ' /tmp/东京旅行.card ' });
    void refreshView?.handler(undefined);

    expect(recorder.openedPaths).toEqual(['/tmp/东京旅行.card']);
    expect(recorder.refreshes).toBe(1);
    expect(seen).toEqual([
      { commandId: APP_COMMAND_IDS.openCard, handlerId: 'open-card', ok: true },
      { commandId: APP_COMMAND_IDS.refreshView, handlerId: 'refresh-view', ok: true },
    ]);
  });

  it('打开卡片载荷非法时如实上报失败，不触发业务动作', () => {
    const recorder = createActionsRecorder();
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(recorder.actions, (status) => {
      seen.push(status);
    });
    const openCard = registrations[0];
    void openCard?.handler(undefined);
    void openCard?.handler({ path: '' });
    void openCard?.handler({ path: '   ' });
    void openCard?.handler({ path: 42 });
    void openCard?.handler('直接字符串');

    expect(recorder.openedPaths).toEqual([]);
    expect(seen).toHaveLength(5);
    expect(seen.every((status) => status.commandId === APP_COMMAND_IDS.openCard && !status.ok)).toBe(true);
  });

  it('载荷收窄：path 必须为非空字符串（manifest mapsTo: path）', () => {
    expect(readOpenCardPayloadPath({ path: '~/卡片/示例.cpk' })).toBe('~/卡片/示例.cpk');
    expect(readOpenCardPayloadPath({ path: '  ' })).toBeNull();
    expect(readOpenCardPayloadPath({})).toBeNull();
    expect(readOpenCardPayloadPath(null)).toBeNull();
    expect(readOpenCardPayloadPath(undefined)).toBeNull();
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.refreshView)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});
