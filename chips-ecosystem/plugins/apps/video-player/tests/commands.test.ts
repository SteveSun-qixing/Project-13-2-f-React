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

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并在执行时上报状态', () => {
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers((status) => {
      seen.push(status);
    });
    expect(registrations.map((registration) => registration.commandId)).toEqual(ids());
    expect(registrations.map((registration) => registration.handlerId)).toEqual(handlerIds());
    for (const registration of registrations) {
      // 处理器类型为 `void | Promise<void>`：以 void 运算符显式收口（no-floating-promises）。
      void registration.handler({ demo: true });
    }
    expect(seen.map((status) => status.commandId)).toEqual(ids());
    expect(seen.every((status) => status.payload !== undefined)).toBe(true);
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
