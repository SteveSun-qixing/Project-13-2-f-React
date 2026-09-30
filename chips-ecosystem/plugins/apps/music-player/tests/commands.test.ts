import { describe, expect, it, vi } from 'vitest';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  type AppCommandActionMap,
  type AppCommandStatus,
} from '../src/commands/appCommands';

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const HANDLER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 与 manifest `cli.commands` 逐字对应的声明（清单即权威）。 */
const MANIFEST_CLI_COMMANDS = [
  {
    commandId: 'music-player:open-card',
    title: '打开卡片',
    description: '通过「音乐播放器」打开指定卡片文件',
  },
  {
    commandId: 'music-player:refresh-view',
    title: '刷新当前视图',
    description: '请求「音乐播放器」重新拉取当前展示数据',
  },
] as const;

/** 播放控制/队列命令族为 ui 目标命令：不进 manifest `cli.commands`、不声明 shortcut。 */
const PLAYBACK_COMMAND_IDS = [
  'music-player:toggle-playback',
  'music-player:seek-forward',
  'music-player:seek-backward',
  'music-player:volume-up',
  'music-player:volume-down',
  'music-player:toggle-mute',
  'music-player:toggle-loop',
  'music-player:next-track',
  'music-player:previous-track',
] as const;

describe('命令元数据（可序列化）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBeGreaterThanOrEqual(11);
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
      expect(definition.title.length).toBeLessThanOrEqual(64);
    }
  });

  it('命令 ID 与处理器 ID 各自唯一且一一对应', () => {
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
    expect(ids).toEqual(Object.values(APP_COMMAND_IDS));
    expect(handlerIds).toEqual(Object.values(APP_COMMAND_HANDLER_IDS));
  });

  it('open-card 与 refresh-view 元数据和 manifest cli.commands 逐字对应', () => {
    for (const entry of MANIFEST_CLI_COMMANDS) {
      const definition = appCommandDefinitions.find((item) => item.id === entry.commandId);
      expect(definition, `缺少 manifest 命令对应记录：${entry.commandId}`).toBeDefined();
      expect(definition?.title).toBe(entry.title);
      expect(definition?.description).toBe(entry.description);
    }
  });

  it('播放控制/队列命令族：ui 目标、不声明 shortcut、键位提示入描述', () => {
    expect(Object.values(APP_COMMAND_IDS)).toHaveLength(MANIFEST_CLI_COMMANDS.length + PLAYBACK_COMMAND_IDS.length);
    for (const commandId of PLAYBACK_COMMAND_IDS) {
      const definition = appCommandDefinitions.find((item) => item.id === commandId);
      expect(definition, `缺少播放控制命令：${commandId}`).toBeDefined();
      expect(definition?.shortcut).toBeUndefined();
      expect(definition?.description).toBeTruthy();
    }
    for (const entry of MANIFEST_CLI_COMMANDS) {
      const definition = appCommandDefinitions.find((item) => item.id === entry.commandId);
      expect(definition?.shortcut).toBeTruthy();
    }
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并经动作表现取执行', () => {
    const seen: AppCommandStatus[] = [];
    const actions: AppCommandActionMap = {
      togglePlayback: vi.fn(),
      nextTrack: vi.fn(),
    };
    const registrations = createAppCommandHandlers(() => actions, (status) => {
      seen.push(status);
    });

    expect(registrations.map((registration) => registration.commandId)).toEqual(Object.values(APP_COMMAND_IDS));
    expect(registrations.map((registration) => registration.handlerId)).toEqual(
      Object.values(APP_COMMAND_HANDLER_IDS),
    );

    const toggle = registrations.find((registration) => registration.commandId === APP_COMMAND_IDS.togglePlayback);
    const next = registrations.find((registration) => registration.commandId === APP_COMMAND_IDS.nextTrack);
    (toggle?.handler as (payload: unknown) => void)({ demo: true });
    (next?.handler as (payload: unknown) => void)({});

    expect(actions.togglePlayback).toHaveBeenCalledWith({ demo: true });
    expect(actions.nextTrack).toHaveBeenCalledWith({});
    expect(seen.map((status) => status.commandId)).toEqual([
      APP_COMMAND_IDS.togglePlayback,
      APP_COMMAND_IDS.nextTrack,
    ]);
  });

  it('缺位动作静默跳过，执行记录照常上报（空态诚实降级）', () => {
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(() => ({}), (status) => {
      seen.push(status);
    });
    const mute = registrations.find((registration) => registration.commandId === APP_COMMAND_IDS.toggleMute);
    expect(() => {
      (mute?.handler as (payload: unknown) => void)({});
    }).not.toThrow();
    expect(seen.map((status) => status.commandId)).toEqual([APP_COMMAND_IDS.toggleMute]);
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.togglePlayback)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});
