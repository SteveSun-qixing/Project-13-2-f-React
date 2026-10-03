import { describe, expect, it } from 'vitest';
import manifestSource from '../manifest.yaml?raw';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  type AppCommandStatus,
  type RichTextCommandActions,
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

  it('命令 ID 与处理器 ID 各自唯一且一一对应', () => {
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
  });
});

describe('manifest cli.commands 与命令族一一对应（单一事实源锁定）', () => {
  it('每条运行时命令都在 manifest cli.commands 声明（commandId 逐字对应）', () => {
    const declaredIds = [...manifestSource.matchAll(/^\s*commandId: (.+)$/gm)].map(
      (match) => match[1] ?? ''
    );
    expect(declaredIds).toEqual(Object.values(APP_COMMAND_IDS));
  });

  it('manifest 权限面覆盖命令与文档链路所需权限', () => {
    const permissionBlock = manifestSource.slice(
      manifestSource.indexOf('permissions:'),
      manifestSource.indexOf('ui:')
    );
    for (const permission of [
      'resources:read',
      'resources:write',
      'command:write',
      'command:execute',
    ]) {
      expect(permissionBlock).toContain(permission);
    }
  });
});

describe('command:invoked 派发消费', () => {
  function recordedActions(calls: string[]): RichTextCommandActions {
    return {
      openCard: (path: string): void => {
        calls.push(`open-card:${path}`);
      },
      saveDocument: (): void => {
        calls.push('save-document');
      },
      exportDocument: (): void => {
        calls.push('export-document');
      },
      newCard: (): void => {
        calls.push('new-card');
      },
      refreshView: (): void => {
        calls.push('refresh-view');
      },
    };
  }

  it('本地处理器按 (commandId, handlerId) 配对并在执行时上报状态', () => {
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(recordedActions([]), (status) => {
      seen.push(status);
    });
    expect(registrations.map((registration) => registration.commandId)).toEqual(ids());
    expect(registrations.map((registration) => registration.handlerId)).toEqual(handlerIds());
    for (const registration of registrations) {
      // 处理器类型为 `void | Promise<void>`：以 void 运算符显式收口（no-floating-promises）。
      void registration.handler({ demo: true });
    }
    expect(seen.map((status) => status.commandId)).toEqual(ids());
    // open-card 的 `{ demo: true }` 载荷不含合法 path：收窄拒绝并如实上报失败（ok: false）；
    // 其余命令无载荷语义，一律成功上报。
    expect(
      seen.every((status) =>
        status.commandId === APP_COMMAND_IDS.openCard ? status.ok === false : status.ok
      )
    ).toBe(true);
  });

  it('打开卡片载荷收窄：合法 path 触发动作，非法载荷如实上报失败', () => {
    const calls: string[] = [];
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(recordedActions(calls), (status) => {
      seen.push(status);
    });
    const openCard = registrations.find(
      (registration) => registration.handlerId === APP_COMMAND_HANDLER_IDS.openCard
    );
    expect(openCard).toBeDefined();
    void openCard?.handler({ path: ' ~/文档/示例.cpk ' });
    expect(calls).toEqual(['open-card:~/文档/示例.cpk']);
    void openCard?.handler({ path: '   ' });
    void openCard?.handler('非对象');
    expect(calls).toHaveLength(1);
    expect(seen.at(-1)).toMatchObject({ commandId: APP_COMMAND_IDS.openCard, ok: false });
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.saveDocument)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.exportDocument)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.newCard)).toBe(true);
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
