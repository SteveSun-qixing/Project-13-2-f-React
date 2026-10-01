import { describe, expect, it } from 'vitest';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  type AppCommandStatus,
  type NotesCommandActions,
} from '../src/commands/appCommands';

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const HANDLER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** manifest `cli.commands` 在册两入口的锁测对照（逐字对应，与 video-player 判例同形）。 */
const MANIFEST_CLI_COMMANDS: readonly { id: string; title: string; description: string }[] = [
  {
    id: 'notes:open-card',
    title: '打开笔记文档',
    description: '按来源引用打开指定卡片或箱子并加入笔记库定位',
  },
  {
    id: 'notes:refresh-view',
    title: '刷新当前视图',
    description: '重新读取当前选中文档的元数据与内容',
  },
];

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

  it('命令 ID 与处理器 ID 各自唯一且一一对应', () => {
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
  });

  it('运行时命令与 manifest cli.commands 逐字对应（title/description 锁测）', () => {
    expect(appCommandDefinitions).toHaveLength(MANIFEST_CLI_COMMANDS.length);
    for (const manifestCommand of MANIFEST_CLI_COMMANDS) {
      const definition = appCommandDefinitions.find((item) => item.id === manifestCommand.id);
      expect(definition, `manifest 命令 ${manifestCommand.id} 未在运行时登记`).toBeDefined();
      expect(definition?.title).toBe(manifestCommand.title);
      expect(definition?.description).toBe(manifestCommand.description);
    }
  });
});

describe('command:invoked 派发消费', () => {
  function makeHarness(): {
    seen: AppCommandStatus[];
    actions: NotesCommandActions & { opened: string[]; refreshed: number };
    handlerOf: (handlerId: string) => (payload: unknown) => void;
  } {
    const seen: AppCommandStatus[] = [];
    const actions: NotesCommandActions & { opened: string[]; refreshed: number } = {
      opened: [],
      refreshed: 0,
      openCard: (path: string): void => {
        actions.opened.push(path);
      },
      refreshView: (): void => {
        actions.refreshed += 1;
      },
    };
    const registrations = createAppCommandHandlers(actions, (status) => {
      seen.push(status);
    });
    expect(registrations.map((registration) => registration.commandId)).toEqual(ids());
    expect(registrations.map((registration) => registration.handlerId)).toEqual(handlerIds());
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

  it('打开命令按载荷 path 触发领域动作并上报成功', () => {
    const harness = makeHarness();
    harness.handlerOf('open-card')({ path: ' ~/文档/示例.card ' });
    expect(harness.actions.opened).toEqual(['~/文档/示例.card']);
    expect(harness.seen).toEqual([
      { commandId: APP_COMMAND_IDS.openCard, handlerId: APP_COMMAND_HANDLER_IDS.openCard, ok: true },
    ]);
  });

  it('刷新命令无载荷直接触发领域动作', () => {
    const harness = makeHarness();
    harness.handlerOf('refresh-view')(undefined);
    expect(harness.actions.refreshed).toBe(1);
    expect(harness.seen[0]).toMatchObject({ commandId: APP_COMMAND_IDS.refreshView, ok: true });
  });

  it('打开命令载荷非法时如实上报失败、不触发领域动作', () => {
    const harness = makeHarness();
    harness.handlerOf('open-card')({ path: '   ' });
    harness.handlerOf('open-card')(undefined);
    harness.handlerOf('open-card')({ path: 42 });
    expect(harness.actions.opened).toEqual([]);
    expect(harness.seen).toHaveLength(3);
    expect(harness.seen.every((status) => status.ok === false)).toBe(true);
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.refreshView)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
