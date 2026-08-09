import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandInvocationContext,
  CommandSetStateOptions,
  CommandSource,
  CommandState,
} from "chips-sdk";
import type { ChipsCommandView } from "@chips/component-library";
import { appConfig } from "../../config/app-config";

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

export const VIDEO_PLAYER_COMMAND_HANDLER_IDS = {
  openFile: "video-player:file.open",
  saveCopy: "video-player:file.save-copy",
  togglePlayback: "video-player:playback.toggle",
  seekBackward: "video-player:playback.seek-backward",
  seekForward: "video-player:playback.seek-forward",
  toggleMute: "video-player:playback.toggle-mute",
  toggleFullscreen: "video-player:view.toggle-fullscreen",
  togglePictureInPicture: "video-player:view.toggle-picture-in-picture",
  toggleMorePanel: "video-player:view.toggle-more-panel",
} as const;

export type VideoPlayerCommandId = (typeof VIDEO_PLAYER_COMMAND_IDS)[keyof typeof VIDEO_PLAYER_COMMAND_IDS];
export type VideoPlayerCommandHandlerId =
  (typeof VIDEO_PLAYER_COMMAND_HANDLER_IDS)[keyof typeof VIDEO_PLAYER_COMMAND_HANDLER_IDS];
export type VideoPlayerCommandPhase = "idle" | "registering" | "ready" | "error";

export interface VideoPlayerCommandRuntimeState {
  hasVideo: boolean;
  isSaving: boolean;
  canUsePictureInPicture: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  isMorePanelOpen: boolean;
}

export interface VideoPlayerCommandStatus {
  commandId: VideoPlayerCommandId;
  handlerId: VideoPlayerCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
  payload?: Record<string, unknown>;
  context?: CommandInvocationContext;
}

const COMMAND_ID_SET = new Set<string>(Object.values(VIDEO_PLAYER_COMMAND_IDS));
const APP_SCOPE = { kind: "app", appId: appConfig.appId } as const;

function shortcut(accelerator: string) {
  return {
    accelerator,
    platform: "desktop" as const,
    preventDefault: true,
  };
}

function commandState(state: Partial<CommandState>): CommandState {
  return {
    enabled: true,
    visible: true,
    ...state,
  };
}

export const videoPlayerCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.openFile,
    titleKey: "video-player.commands.openFile.title",
    descriptionKey: "video-player.commands.openFile.description",
    ariaLabelKey: "video-player.commands.openFile.ariaLabel",
    icon: { name: "folder_open", style: "rounded" },
    scope: APP_SCOPE,
    permission: "platform.read",
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.openFile,
    shortcut: shortcut("Mod+O"),
    menuPlacement: [{ menuId: "file", groupId: "open", order: 10 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "file", order: 10 }],
    paletteKeywords: ["open", "video", "video-player.commands.openFile.title"],
    state: commandState({}),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.saveCopy,
    titleKey: "video-player.commands.saveCopy.title",
    descriptionKey: "video-player.commands.saveCopy.description",
    ariaLabelKey: "video-player.commands.saveCopy.ariaLabel",
    icon: { name: "save", style: "rounded" },
    scope: APP_SCOPE,
    permission: "file.write",
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.saveCopy,
    shortcut: shortcut("Mod+S"),
    menuPlacement: [{ menuId: "file", groupId: "save", order: 20 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "file", order: 20 }],
    paletteKeywords: ["save", "copy", "video-player.commands.saveCopy.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.togglePlayback,
    titleKey: "video-player.commands.togglePlayback.title",
    descriptionKey: "video-player.commands.togglePlayback.description",
    ariaLabelKey: "video-player.commands.togglePlayback.ariaLabel",
    icon: { name: "play_arrow", style: "rounded", fill: 1 },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.togglePlayback,
    shortcut: [shortcut("Space"), shortcut("K")],
    menuPlacement: [{ menuId: "playback", groupId: "transport", order: 10 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "transport", order: 10 }],
    paletteKeywords: ["play", "pause", "video-player.commands.togglePlayback.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.seekBackward,
    titleKey: "video-player.commands.seekBackward.title",
    descriptionKey: "video-player.commands.seekBackward.description",
    ariaLabelKey: "video-player.commands.seekBackward.ariaLabel",
    icon: { name: "fast_rewind", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.seekBackward,
    shortcut: shortcut("ArrowLeft"),
    menuPlacement: [{ menuId: "playback", groupId: "seek", order: 20 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "transport", order: 20 }],
    paletteKeywords: ["back", "seek", "video-player.commands.seekBackward.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.seekForward,
    titleKey: "video-player.commands.seekForward.title",
    descriptionKey: "video-player.commands.seekForward.description",
    ariaLabelKey: "video-player.commands.seekForward.ariaLabel",
    icon: { name: "fast_forward", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.seekForward,
    shortcut: shortcut("ArrowRight"),
    menuPlacement: [{ menuId: "playback", groupId: "seek", order: 30 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "transport", order: 30 }],
    paletteKeywords: ["forward", "seek", "video-player.commands.seekForward.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.toggleMute,
    titleKey: "video-player.commands.toggleMute.title",
    descriptionKey: "video-player.commands.toggleMute.description",
    ariaLabelKey: "video-player.commands.toggleMute.ariaLabel",
    icon: { name: "volume_off", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.toggleMute,
    shortcut: shortcut("M"),
    menuPlacement: [{ menuId: "playback", groupId: "audio", order: 40 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "audio", order: 40 }],
    paletteKeywords: ["mute", "volume", "video-player.commands.toggleMute.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.toggleFullscreen,
    titleKey: "video-player.commands.toggleFullscreen.title",
    descriptionKey: "video-player.commands.toggleFullscreen.description",
    ariaLabelKey: "video-player.commands.toggleFullscreen.ariaLabel",
    icon: { name: "fullscreen", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.toggleFullscreen,
    shortcut: shortcut("F"),
    menuPlacement: [{ menuId: "view", groupId: "display", order: 50 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "view", order: 50 }],
    paletteKeywords: ["fullscreen", "view", "video-player.commands.toggleFullscreen.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.noVideo" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture,
    titleKey: "video-player.commands.togglePictureInPicture.title",
    descriptionKey: "video-player.commands.togglePictureInPicture.description",
    ariaLabelKey: "video-player.commands.togglePictureInPicture.ariaLabel",
    icon: { name: "picture_in_picture_alt", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.togglePictureInPicture,
    menuPlacement: [{ menuId: "view", groupId: "display", order: 60 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "view", order: 60 }],
    paletteKeywords: ["pip", "picture", "video-player.commands.togglePictureInPicture.title"],
    state: commandState({ enabled: false, disabledReasonKey: "video-player.commands.disabled.pictureInPicture" }),
  },
  {
    commandId: VIDEO_PLAYER_COMMAND_IDS.toggleMorePanel,
    titleKey: "video-player.commands.toggleMorePanel.title",
    descriptionKey: "video-player.commands.toggleMorePanel.description",
    ariaLabelKey: "video-player.commands.toggleMorePanel.ariaLabel",
    icon: { name: "more_horiz", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: VIDEO_PLAYER_COMMAND_HANDLER_IDS.toggleMorePanel,
    menuPlacement: [{ menuId: "view", groupId: "panels", order: 70 }],
    toolbarPlacement: [{ toolbarId: "player", groupId: "view", order: 70 }],
    paletteKeywords: ["more", "info", "subtitles", "video-player.commands.toggleMorePanel.title"],
    state: commandState({ checked: false }),
  },
];

export function createVideoPlayerCommandState(
  commandId: VideoPlayerCommandId,
  runtime: VideoPlayerCommandRuntimeState,
): CommandState {
  const noVideoState = commandState({
    enabled: false,
    disabledReasonKey: "video-player.commands.disabled.noVideo",
  });

  switch (commandId) {
    case VIDEO_PLAYER_COMMAND_IDS.openFile:
      return commandState({});
    case VIDEO_PLAYER_COMMAND_IDS.saveCopy:
      return commandState({
        enabled: runtime.hasVideo && !runtime.isSaving,
        busy: runtime.isSaving,
        disabledReasonKey: runtime.hasVideo ? undefined : "video-player.commands.disabled.noVideo",
      });
    case VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture:
      return commandState({
        enabled: runtime.hasVideo && runtime.canUsePictureInPicture,
        checked: runtime.isPictureInPicture,
        disabledReasonKey: runtime.hasVideo
          ? "video-player.commands.disabled.pictureInPicture"
          : "video-player.commands.disabled.noVideo",
      });
    case VIDEO_PLAYER_COMMAND_IDS.togglePlayback:
      return runtime.hasVideo
        ? commandState({ checked: runtime.isPlaying })
        : noVideoState;
    case VIDEO_PLAYER_COMMAND_IDS.toggleMute:
      return runtime.hasVideo
        ? commandState({ checked: runtime.isMuted })
        : noVideoState;
    case VIDEO_PLAYER_COMMAND_IDS.toggleFullscreen:
      return runtime.hasVideo
        ? commandState({ checked: runtime.isFullscreen })
        : noVideoState;
    case VIDEO_PLAYER_COMMAND_IDS.seekBackward:
    case VIDEO_PLAYER_COMMAND_IDS.seekForward:
      return runtime.hasVideo ? commandState({}) : noVideoState;
    case VIDEO_PLAYER_COMMAND_IDS.toggleMorePanel:
      return commandState({ checked: runtime.isMorePanelOpen });
    default:
      return commandState({});
  }
}

export function createVideoPlayerCommandViews(runtime: VideoPlayerCommandRuntimeState): ChipsCommandView[] {
  return videoPlayerCommandDefinitions.map((definition) => ({
    ...definition,
    state: createVideoPlayerCommandState(definition.commandId as VideoPlayerCommandId, runtime),
  })) as unknown as ChipsCommandView[];
}

export function createVideoPlayerCommandSetStateOptions(
  context: CommandInvocationContext,
): CommandSetStateOptions {
  return {
    context,
  };
}

export function createVideoPlayerCommandStatus(event: CommandInvokedEvent): VideoPlayerCommandStatus | null {
  if (!COMMAND_ID_SET.has(event.commandId)) {
    return null;
  }

  if (event.ownerPluginId && event.ownerPluginId !== appConfig.appId) {
    return null;
  }

  const handlerId = event.handlerId;
  if (!handlerId || !Object.values(VIDEO_PLAYER_COMMAND_HANDLER_IDS).includes(handlerId as VideoPlayerCommandHandlerId)) {
    return null;
  }

  return {
    commandId: event.commandId as VideoPlayerCommandId,
    handlerId: handlerId as VideoPlayerCommandHandlerId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
    payload: event.payload,
    context: event.context,
  };
}

export function createVideoPlayerCommandStatusFromCommandId(
  commandId: VideoPlayerCommandId,
  source: CommandSource,
  payload: Record<string, unknown> = {},
  context?: CommandInvocationContext,
): VideoPlayerCommandStatus {
  const definition = videoPlayerCommandDefinitions.find((candidate) => candidate.commandId === commandId);

  return {
    commandId,
    handlerId: definition?.handlerId as VideoPlayerCommandHandlerId,
    source,
    payload,
    context,
  };
}

export function toVideoPlayerCommandErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }

  return "VIDEO_PLAYER_COMMAND_RUNTIME_ERROR";
}

