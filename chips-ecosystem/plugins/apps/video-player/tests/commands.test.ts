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
    commandId: 'video-player:open-card',
    title: '打开卡片',
    description: '通过「视频播放器」打开指定卡片文件',
  },
  {
    commandId: 'video-player:refresh-view',
    title: '刷新当前视图',
    description: '请求「视频播放器」重新拉取当前展示数据',
  },
] as const;

describe('命令元数据（可序列化）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBeGreaterThanOrEqual(10);
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

  it('播放控制命令族齐备且归组一致', () => {
    const playbackIds: readonly string[] = [
      APP_COMMAND_IDS.togglePlayback,
      APP_COMMAND_IDS.seekForward,
      APP_COMMAND_IDS.seekBackward,
      APP_COMMAND_IDS.toggleMute,
      APP_COMMAND_IDS.cyclePlaybackRate,
      APP_COMMAND_IDS.toggleLoop,
    ];
    for (const commandId of playbackIds) {
      const definition = appCommandDefinitions.find((item) => item.id === commandId);
      expect(definition, `缺少播放控制命令：${commandId}`).toBeDefined();
      expect(definition?.group).toBe('播放控制');
    }
    expect(
      appCommandDefinitions.find((item) => item.id === APP_COMMAND_IDS.toggleFullscreen)?.group,
    ).toBe('画面');
    expect(
      appCommandDefinitions.find((item) => item.id === APP_COMMAND_IDS.togglePictureInPicture)?.group,
    ).toBe('画面');
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对，现取动作表执行并上报状态', () => {
    const seen: AppCommandStatus[] = [];
    const actions: AppCommandActionMap = {
      togglePlayback: vi.fn(),
      seekForward: vi.fn(),
    };
    const registrations = createAppCommandHandlers(() => actions, (status) => {
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

    const toggle = vi.mocked(actions.togglePlayback);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledWith({ demo: true });
  });

  it('动作缺位的命令静默跳过业务效应但仍上报执行记录', () => {
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers(() => ({}), (status) => {
      seen.push(status);
    });
    const toggle = registrations.find((registration) => registration.handlerId === APP_COMMAND_HANDLER_IDS.togglePlayback);
    expect(toggle).toBeDefined();
    expect((): void => {
      void toggle?.handler(undefined);
    }).not.toThrow();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.commandId).toBe(APP_COMMAND_IDS.togglePlayback);
  });

  it('动作表按派发时刻现取：后装配的动作在既有注册上生效', () => {
    const seen: AppCommandStatus[] = [];
    const lateAction = vi.fn();
    let current: AppCommandActionMap = {};
    const registrations = createAppCommandHandlers(
      () => current,
      (status) => {
        seen.push(status);
      },
    );
    const toggle = registrations.find(
      (registration) => registration.handlerId === APP_COMMAND_HANDLER_IDS.togglePlayback,
    );
    void toggle?.handler(undefined);
    expect(lateAction).not.toHaveBeenCalled();

    current = { togglePlayback: lateAction };
    void toggle?.handler({});
    expect(lateAction).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.togglePlayback)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
