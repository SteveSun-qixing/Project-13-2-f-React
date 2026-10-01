import { describe, expect, it } from 'vitest';
import { SETTINGS_SCENES } from '../src/domain/settings/catalog';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  type AppCommandStatus,
  type SettingsCommandActions,
} from '../src/commands/appCommands';

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const HANDLER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

describe('命令元数据（可序列化）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBeGreaterThan(0);
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

  it('命令记录 = 刷新 + 九类分类跳转，ID 与处理器 ID 一一对应', () => {
    expect(appCommandDefinitions).toHaveLength(1 + SETTINGS_SCENES.length);
    expect(APP_COMMAND_IDS.refreshView).toBe('settings:refresh-view');
    for (const scene of SETTINGS_SCENES) {
      expect(APP_COMMAND_IDS[scene.id as keyof typeof APP_COMMAND_IDS]).toBe(scene.commandId);
    }
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
  });

  it('刷新命令在 manifest cli.commands 在册且元数据逐字对应（锁测）；分类跳转命令为运行时命令', () => {
    expect(APP_COMMAND_IDS.refreshView).toMatch(COMMAND_ID_PATTERN);
    const refresh = appCommandDefinitions.find((definition) => definition.id === APP_COMMAND_IDS.refreshView);
    expect(refresh).toBeDefined();
    expect(refresh?.title).toBe('刷新当前视图');
    expect(refresh?.description).toBe('重新读取偏好快照并刷新设置面板展示');
  });

  it('命令归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.refreshView)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.appearance)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

describe('command:invoked 派发消费', () => {
  function makeHarness(): {
    seen: AppCommandStatus[];
    actions: SettingsCommandActions & { scenes: string[]; refreshed: number };
    handlerOf: (handlerId: string) => (payload: unknown) => void;
  } {
    const seen: AppCommandStatus[] = [];
    const actions: SettingsCommandActions & { scenes: string[]; refreshed: number } = {
      scenes: [],
      refreshed: 0,
      openScene: (sceneId: string): void => {
        actions.scenes.push(sceneId);
      },
      refreshView: (): void => {
        actions.refreshed += 1;
      },
    };
    const registrations = createAppCommandHandlers(actions, (status) => {
      seen.push(status);
    });
    expect(registrations).toHaveLength(1 + SETTINGS_SCENES.length);
    return {
      seen,
      actions,
      handlerOf: (handlerId: string): ((payload: unknown) => void) => {
        const registration = registrations.find((item) => item.handlerId === handlerId);
        expect(registration).toBeDefined();
        return (registration as unknown as { handler: (payload: unknown) => void }).handler;
      },
    };
  }

  it('分类跳转命令触发对应分类；携带一致 sceneId 载荷同样放行', () => {
    const harness = makeHarness();
    harness.handlerOf(APP_COMMAND_HANDLER_IDS.appearance)(undefined);
    harness.handlerOf(APP_COMMAND_HANDLER_IDS.behavior)({ sceneId: 'behavior' });
    expect(harness.actions.scenes).toEqual(['appearance', 'behavior']);
    expect(harness.seen.every((status) => status.ok)).toBe(true);
  });

  it('分类命令载荷 sceneId 与命令不一致时如实上报失败、不切换分类', () => {
    const harness = makeHarness();
    harness.handlerOf(APP_COMMAND_HANDLER_IDS.appearance)({ sceneId: 'storage' });
    harness.handlerOf(APP_COMMAND_HANDLER_IDS.appearance)({ sceneId: 42 });
    expect(harness.actions.scenes).toEqual([]);
    expect(harness.seen).toEqual([
      { commandId: APP_COMMAND_IDS.appearance, handlerId: APP_COMMAND_HANDLER_IDS.appearance, ok: false },
      { commandId: APP_COMMAND_IDS.appearance, handlerId: APP_COMMAND_HANDLER_IDS.appearance, ok: false },
    ]);
  });

  it('刷新命令直接触发视图刷新动作', () => {
    const harness = makeHarness();
    harness.handlerOf(APP_COMMAND_HANDLER_IDS.refreshView)(undefined);
    expect(harness.actions.refreshed).toBe(1);
    expect(harness.seen[0]).toMatchObject({ commandId: APP_COMMAND_IDS.refreshView, ok: true });
  });
});
