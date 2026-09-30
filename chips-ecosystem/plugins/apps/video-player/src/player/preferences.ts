/**
 * 视频播放器偏好（重写件）。
 *
 * 权威口径：《10-官方内容处理与阅读服务设计》§3.3——音量/静音/倍速/循环/字幕偏好属
 * 用户偏好，应写入插件自身配置命名空间（`config:*`，`IAppConfig` / `chips.request('config:set')`）。
 * 旧实现 `localStorage` 旁路（`video-player.preferences` 私有键）违该分层，按矩阵判重写、不随迁。
 *
 * 诚实降级（工单065 在册）：`config:*` 域宿主侧处理器缺位（`packages/host/src/capabilities/`
 * 仅 document 域），渲染会话经 Bridge 写入必以 `BRIDGE_METHOD_NOT_FOUND` 类错误失败。
 * 本臂不假接线：偏好收敛为**窗口会话内存态**——同一次窗口会话内读写一致、跨会话不持久；
 * `config:*` 域处理器落波后，以同一 `VideoPlayerPreferenceStore` 接口换接 `IAppConfig`
 * 读写实现，消费面零改动。
 *
 * 语义保留（旧 preferences.test 判例随迁）：音量钳制 [0,1]、倍速白名单校验、
 * 非法字段类型回退默认值。
 */

import { PLAYBACK_RATES } from './videoPlayer';

/** 播放器用户偏好（字段集与旧实现一致）。 */
export interface VideoPlayerPreferences {
  volume: number;
  muted: boolean;
  playbackRate: number;
  /** 选中的字幕轨索引；null 表示关闭字幕。 */
  subtitleIndex: number | null;
  loop: boolean;
}

export const DEFAULT_PREFERENCES: VideoPlayerPreferences = {
  volume: 0.85,
  muted: false,
  playbackRate: 1,
  subtitleIndex: null,
  loop: false,
};

/** 归一单字段：类型不合法时保留现值。 */
function pickNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** 偏好存储接口：本臂内存实现，`config:*` 落波后换接 `IAppConfig` 实现面。 */
export interface VideoPlayerPreferenceStore {
  /** 读取生效偏好（已钳制与校验）。 */
  read(): VideoPlayerPreferences;
  /** 合并写入一片段偏好；越界与非法字段按规则钳制/回退。 */
  write(patch: Partial<VideoPlayerPreferences>): void;
}

/** 创建窗口会话内存态偏好存储（诚实降级实现，见文件头）。 */
export function createVideoPlayerPreferenceStore(): VideoPlayerPreferenceStore {
  let current: VideoPlayerPreferences = { ...DEFAULT_PREFERENCES };

  /** 合并归一：补丁字段非法时保留现值（不污染既有偏好）；数值越界按规则钳制。 */
  const merge = (patch: Partial<VideoPlayerPreferences>): VideoPlayerPreferences => {
    const candidate = { ...current, ...patch };
    return {
      volume: Math.min(1, Math.max(0, pickNumber(candidate.volume, current.volume))),
      muted: pickBoolean(candidate.muted, current.muted),
      playbackRate: PLAYBACK_RATES.includes(candidate.playbackRate) ? candidate.playbackRate : current.playbackRate,
      subtitleIndex:
        typeof candidate.subtitleIndex === 'number' && Number.isInteger(candidate.subtitleIndex)
          ? candidate.subtitleIndex
          : current.subtitleIndex,
      loop: pickBoolean(candidate.loop, current.loop),
    };
  };

  current = merge({});

  return {
    read: (): VideoPlayerPreferences => ({ ...current }),
    write: (patch: Partial<VideoPlayerPreferences>): void => {
      current = merge(patch);
    },
  };
}

/**
 * 窗口会话默认偏好存储：渲染上下文（窗口会话）内共享、跨会话不持久。
 *
 * 应用组合根（AppView/控制器）缺省消费本实例；测试用 `createVideoPlayerPreferenceStore()`
 * 建立隔离实例。`config:*` 域处理器落波后，本实例换接 `IAppConfig` 读写实现，接口不变。
 */
const windowSessionStore = createVideoPlayerPreferenceStore();

export function getWindowVideoPlayerPreferenceStore(): VideoPlayerPreferenceStore {
  return windowSessionStore;
}
