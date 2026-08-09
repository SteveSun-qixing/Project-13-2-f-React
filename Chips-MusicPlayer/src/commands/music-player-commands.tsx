import {
  DownloadOutlined,
  FolderOpenOutlined,
  MutedOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  RetweetOutlined,
  SoundFilled,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import { appConfig } from "../../config/app-config";

export const MUSIC_PLAYER_COMMAND_IDS = {
  openFiles: `${appConfig.appId}.open-files`,
  saveAudio: `${appConfig.appId}.save-audio`,
  previousTrack: `${appConfig.appId}.previous-track`,
  nextTrack: `${appConfig.appId}.next-track`,
  togglePlayback: `${appConfig.appId}.toggle-playback`,
  rewind10: `${appConfig.appId}.rewind-10`,
  forward10: `${appConfig.appId}.forward-10`,
  volumeUp: `${appConfig.appId}.volume-up`,
  volumeDown: `${appConfig.appId}.volume-down`,
  toggleMute: `${appConfig.appId}.toggle-mute`,
  toggleLoop: `${appConfig.appId}.toggle-loop`,
} as const;

export type MusicPlayerCommandId =
  (typeof MUSIC_PLAYER_COMMAND_IDS)[keyof typeof MUSIC_PLAYER_COMMAND_IDS];

export interface MusicPlayerCommandHandlers {
  openFiles: () => void | Promise<void>;
  saveAudio: () => void | Promise<void>;
  previousTrack: () => void | Promise<void>;
  nextTrack: () => void | Promise<void>;
  togglePlayback: () => void | Promise<void>;
  rewind10: () => void;
  forward10: () => void;
  volumeUp: () => void;
  volumeDown: () => void;
  toggleMute: () => void;
  toggleLoop: () => void;
}

export interface MusicPlayerCommandState {
  hasTrack: boolean;
  canSave: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isSaving: boolean;
}

export function createMusicPlayerCommands(
  handlers: MusicPlayerCommandHandlers,
  state: MusicPlayerCommandState,
): CommandItem[] {
  const { hasTrack, canSave, canGoPrevious, canGoNext, isSaving } = state;

  return [
    {
      id: MUSIC_PLAYER_COMMAND_IDS.openFiles,
      title: "打开文件",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["open", "audio", "music", "打开", "音频", "文件"],
      run: () => void handlers.openFiles(),
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.saveAudio,
      title: "保存副本",
      shortcut: "Mod+S",
      icon: <DownloadOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["save", "download", "copy", "保存", "副本"],
      enabled: canSave && !isSaving,
      run: () => void handlers.saveAudio(),
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.previousTrack,
      title: "上一首",
      shortcut: "MediaPreviousTrack",
      icon: <StepBackwardOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["previous", "track", "queue", "上一首", "队列"],
      enabled: canGoPrevious,
      run: () => void handlers.previousTrack(),
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.nextTrack,
      title: "下一首",
      shortcut: "MediaNextTrack",
      icon: <StepForwardOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["next", "track", "queue", "下一首", "队列"],
      enabled: canGoNext,
      run: () => void handlers.nextTrack(),
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.togglePlayback,
      title: "播放 / 暂停",
      shortcut: " ",
      icon: <PlayCircleOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["play", "pause", "audio", "播放", "暂停"],
      enabled: hasTrack,
      run: () => void handlers.togglePlayback(),
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.rewind10,
      title: "后退 10 秒",
      shortcut: "ArrowLeft",
      icon: <UndoOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["rewind", "seek", "后退", "快退"],
      enabled: hasTrack,
      run: handlers.rewind10,
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.forward10,
      title: "前进 10 秒",
      shortcut: "ArrowRight",
      icon: <RedoOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["forward", "seek", "前进", "快进"],
      enabled: hasTrack,
      run: handlers.forward10,
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.volumeUp,
      title: "增大音量",
      shortcut: "ArrowUp",
      icon: <SoundFilled />,
      group: "播放",
      menuId: "playback",
      keywords: ["volume", "loud", "音量", "增大"],
      enabled: hasTrack,
      run: handlers.volumeUp,
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.volumeDown,
      title: "减小音量",
      shortcut: "ArrowDown",
      icon: <SoundOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["volume", "quiet", "音量", "减小"],
      enabled: hasTrack,
      run: handlers.volumeDown,
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.toggleMute,
      title: "静音 / 取消静音",
      shortcut: "M",
      icon: <MutedOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["mute", "volume", "静音"],
      enabled: hasTrack,
      run: handlers.toggleMute,
    },
    {
      id: MUSIC_PLAYER_COMMAND_IDS.toggleLoop,
      title: "单曲循环",
      shortcut: "L",
      icon: <RetweetOutlined />,
      group: "播放",
      menuId: "playback",
      keywords: ["loop", "repeat", "循环"],
      enabled: hasTrack,
      run: handlers.toggleLoop,
    },
  ];
}
