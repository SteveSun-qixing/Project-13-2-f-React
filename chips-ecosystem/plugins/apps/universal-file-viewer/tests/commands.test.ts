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

  it('查看命令族覆盖打开、刷新、导航、缩放、旋转、格式信息、全屏与打印', () => {
    expect(APP_COMMAND_IDS.openCard).toBe('universal-file-viewer:open-card');
    expect(APP_COMMAND_IDS.refreshView).toBe('universal-file-viewer:refresh-view');
    expect(APP_COMMAND_IDS.previousFile).toBe('universal-file-viewer:previous-file');
    expect(APP_COMMAND_IDS.nextFile).toBe('universal-file-viewer:next-file');
    expect(APP_COMMAND_IDS.zoomIn).toBe('universal-file-viewer:zoom-in');
    expect(APP_COMMAND_IDS.zoomOut).toBe('universal-file-viewer:zoom-out');
    expect(APP_COMMAND_IDS.zoomReset).toBe('universal-file-viewer:zoom-reset');
    expect(APP_COMMAND_IDS.rotateLeft).toBe('universal-file-viewer:rotate-left');
    expect(APP_COMMAND_IDS.rotateRight).toBe('universal-file-viewer:rotate-right');
    expect(APP_COMMAND_IDS.toggleInfo).toBe('universal-file-viewer:toggle-info');
    expect(APP_COMMAND_IDS.fullscreen).toBe('universal-file-viewer:fullscreen');
    expect(APP_COMMAND_IDS.print).toBe('universal-file-viewer:print');
  });

  it('运行时命令 ID 与 manifest cli.commands 声明逐字对应', () => {
    const manifestIds = readManifestCommandIds();
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
    expect(manifestIds.sort()).toEqual([...Object.values(APP_COMMAND_IDS)].sort());
  });

  it('运行时命令标题与 manifest cli.commands 声明一致', () => {
    const manifest = readFileSync(resolve(process.cwd(), 'manifest.yaml'), 'utf-8');
    const titlesById = new Map<string, string>();
    for (const match of manifest.matchAll(/^\s*commandId:\s*(\S+)\s*$/gmu)) {
      const id = match[1] ?? '';
      const after = manifest.slice(match.index ?? 0);
      const title = after.match(/^\s*title:\s*(\S.*?)\s*$/mu)?.[1] ?? '';
      titlesById.set(id, title);
    }
    for (const definition of appCommandDefinitions) {
      expect(titlesById.get(definition.id), `命令 ${definition.id} 的 manifest title`).toBe(
        definition.title
      );
    }
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
    expect(isAppCommandId(APP_COMMAND_IDS.refreshView)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.toggleInfo)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
