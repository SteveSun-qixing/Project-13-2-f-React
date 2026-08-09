import {
  AudioMutedOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  FolderOpenOutlined,
  FullscreenOutlined,
  MoreOutlined,
  PictureOutlined,
  PlayCircleFilled,
  SaveOutlined,
} from "@ant-design/icons";
import { appConfig } from "../../config/app-config";
import type { CommandItem } from "@chips/ui";

export const VIDEO_PLAYER_COMMAND_IDS = {
  openFile: `${appConfig.appId}.file.open`,
  saveCopy: `${appConfig.appId}.file.save-copy`,
  togglePlayback: `${appConfig.appId}.playback.toggle`,
  seekBackward: `${appConfig.appId}.playback.seek-backward`,
  seekForward: `${appConfig.appId}.playback.seek-forward`,
  toggleMute: `${appConfig.appId}.playback.toggle-mute`,
  toggleFullscreen: `${appConfig.appId}.view.toggle-fullscreen`,
  togglePictureInPicture: `${appConfig.appId}.view.toggle-picture-in-picture`,
  toggleMorePanel: `${appConfig.appId}.view.toggle-more-panel`,
} as const;

export type VideoPlayerCommandId = (typeof VIDEO_PLAYER_COMMAND_IDS)[keyof typeof VIDEO_PLAYER_COMMAND_IDS];

export interface VideoPlayerCommandState {
  hasVideo: boolean;
  isSaving: boolean;
  canUsePictureInPicture: boolean;
}

export interface VideoPlayerCommandHandlers {
  openFile: () => void | Promise<void>;
  saveCopy: () => void | Promise<void>;
  togglePlayback: () => void | Promise<void>;
  seekBackward: () => void;
  seekForward: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => void | Promise<void>;
  togglePictureInPicture: () => void | Promise<void>;
  toggleMorePanel: () => void;
}

export function createVideoPlayerCommands(
  handlers: VideoPlayerCommandHandlers,
  state: VideoPlayerCommandState,
): CommandItem[] {
  const { hasVideo, isSaving, canUsePictureInPicture } = state;

  return [
    {
      id: VIDEO_PLAYER_COMMAND_IDS.openFile,
      title: "打开视频",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "player",
      keywords: ["open", "video", "打开", "视频"],
      run: () => void handlers.openFile(),
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.saveCopy,
      title: "另存副本",
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "player",
      keywords: ["save", "copy", "另存", "副本"],
      enabled: hasVideo && !isSaving,
      run: () => void handlers.saveCopy(),
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.togglePlayback,
      title: "播放或暂停",
      icon: <PlayCircleFilled />,
      group: "播放",
      menuId: "playback",
      toolbarId: "player",
      keywords: ["play", "pause", "播放", "暂停"],
      enabled: hasVideo,
      run: () => void handlers.togglePlayback(),
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.seekBackward,
      title: "后退 5 秒",
      icon: <FastBackwardOutlined />,
      group: "播放",
      menuId: "playback",
      toolbarId: "player",
      keywords: ["back", "seek", "后退", "回退"],
      enabled: hasVideo,
      run: handlers.seekBackward,
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.seekForward,
      title: "前进 5 秒",
      icon: <FastForwardOutlined />,
      group: "播放",
      menuId: "playback",
      toolbarId: "player",
      keywords: ["forward", "seek", "前进", "快进"],
      enabled: hasVideo,
      run: handlers.seekForward,
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.toggleMute,
      title: "静音或取消静音",
      icon: <AudioMutedOutlined />,
      group: "播放",
      menuId: "playback",
      toolbarId: "player",
      keywords: ["mute", "volume", "静音", "音量"],
      enabled: hasVideo,
      run: handlers.toggleMute,
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.toggleFullscreen,
      title: "切换全屏",
      icon: <FullscreenOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "player",
      keywords: ["fullscreen", "view", "全屏"],
      enabled: hasVideo,
      run: () => void handlers.toggleFullscreen(),
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture,
      title: "切换画中画",
      icon: <PictureOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "player",
      keywords: ["pip", "picture", "画中画"],
      enabled: hasVideo && canUsePictureInPicture,
      run: () => void handlers.togglePictureInPicture(),
    },
    {
      id: VIDEO_PLAYER_COMMAND_IDS.toggleMorePanel,
      title: "打开或收起更多面板",
      icon: <MoreOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "player",
      keywords: ["more", "info", "subtitles", "更多", "信息"],
      run: handlers.toggleMorePanel,
    },
  ];
}
