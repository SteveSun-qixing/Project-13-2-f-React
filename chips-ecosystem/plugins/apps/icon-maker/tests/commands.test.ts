import { describe, expect, it, vi } from 'vitest';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
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

  it('生成命令与 manifest CLI 声明逐字对应（13-命令系统契约 §八示例口径）', () => {
    expect(APP_COMMAND_IDS.generate).toBe('iconmaker:generate');
    expect(APP_COMMAND_HANDLER_IDS.generate).toBe('generate');
    const generate = appCommandDefinitions[0]!;
    expect(generate.title).toBe('生成图标');
    expect(generate.group).toBe('导出');
    expect(generate.paramsSchema).toMatchObject({ type: 'object', additionalProperties: false });
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并把派发载荷交给生成执行入口', async () => {
    const generate = vi.fn((): Promise<void> => Promise.resolve());
    const registrations = createAppCommandHandlers({ generate });
    expect(registrations.map((registration) => registration.commandId)).toEqual(ids());
    expect(registrations.map((registration) => registration.handlerId)).toEqual(handlerIds());

    const payload = { outputDir: '/tmp/icons', overwrite: true };
    for (const registration of registrations) {
      await registration.handler(payload);
    }
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(payload);
  });

  it('生成执行入口的拒绝原样上抛（命令通道诚实上报）', async () => {
    const generate = vi.fn((): Promise<void> => Promise.reject(new Error('请先填写输出目录。')));
    const registrations = createAppCommandHandlers({ generate });
    await expect(registrations[0]!.handler(undefined)).rejects.toThrow('请先填写输出目录。');
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.generate)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
