import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/** 从 manifest.yaml 提取 `cli.commands[].commandId` 声明（与运行时注册表逐字对应校验）。 */
function readManifestCommandIds(): string[] {
  const manifest = readFileSync(resolve(process.cwd(), 'manifest.yaml'), 'utf-8');
  const ids: string[] = [];
  for (const match of manifest.matchAll(/^\s*commandId:\s*(\S+)\s*$/gmu)) {
    ids.push(match[1] ?? '');
  }
  return ids;
}

describe('命令元数据（可序列化）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBeGreaterThanOrEqual(
      Object.keys(APP_COMMAND_IDS).length
    );
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

  it('阅读控制命令族覆盖翻页、章节、面板与排版', () => {
    expect(APP_COMMAND_IDS.previousPage).toBe('book-reader:previous-page');
    expect(APP_COMMAND_IDS.nextPage).toBe('book-reader:next-page');
    expect(APP_COMMAND_IDS.toggleContents).toBe('book-reader:toggle-contents');
    expect(APP_COMMAND_IDS.toggleBookmarks).toBe('book-reader:toggle-bookmarks');
    expect(APP_COMMAND_IDS.toggleBookmark).toBe('book-reader:toggle-bookmark');
    expect(APP_COMMAND_IDS.increaseFont).toBe('book-reader:increase-font');
    expect(APP_COMMAND_IDS.narrowContent).toBe('book-reader:narrow-content');
  });

  it('运行时命令 ID 与 manifest cli.commands 声明逐字对应', () => {
    const manifestIds = readManifestCommandIds();
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
    expect(manifestIds.sort()).toEqual([...Object.values(APP_COMMAND_IDS)].sort());
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并交给注入执行器', () => {
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
    expect(isAppCommandId(APP_COMMAND_IDS.nextPage)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
