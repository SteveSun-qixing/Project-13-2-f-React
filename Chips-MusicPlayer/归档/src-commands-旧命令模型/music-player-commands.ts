import type { CommandDefinitionInput, CommandInvocationContext, CommandState, IconDescriptor } from "chips-sdk";
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

export type MusicPlayerCommandId = (typeof MUSIC_PLAYER_COMMAND_IDS)[keyof typeof MUSIC_PLAYER_COMMAND_IDS];

export const MUSIC_PLAYER_HANDLER_IDS = {
  openFiles: "open-files",
  saveAudio: "save-audio",
  previousTrack: "previous-track",
  nextTrack: "next-track",
  togglePlayback: "toggle-playback",
  rewind10: "rewind-10",
  forward10: "forward-10",
  volumeUp: "volume-up",
  volumeDown: "volume-down",
  toggleMute: "toggle-mute",
  toggleLoop: "toggle-loop",
} as const;

export type MusicPlayerHandlerId = (typeof MUSIC_PLAYER_HANDLER_IDS)[keyof typeof MUSIC_PLAYER_HANDLER_IDS];

const ICONS = {
  openFiles: { name: "folder_open", style: "rounded", decorative: true } satisfies IconDescriptor,
  saveAudio: { name: "download", style: "rounded", decorative: true } satisfies IconDescriptor,
  previousTrack: { name: "skip_previous", style: "rounded", fill: 1, decorative: true } satisfies IconDescriptor,
  nextTrack: { name: "skip_next", style: "rounded", fill: 1, decorative: true } satisfies IconDescriptor,
  togglePlayback: { name: "play_pause", style: "rounded", fill: 1, decorative: true } satisfies IconDescriptor,
  rewind10: { name: "replay_10", style: "rounded", decorative: true } satisfies IconDescriptor,
  forward10: { name: "forward_10", style: "rounded", decorative: true } satisfies IconDescriptor,
  volumeUp: { name: "volume_up", style: "rounded", decorative: true } satisfies IconDescriptor,
  volumeDown: { name: "volume_down", style: "rounded", decorative: true } satisfies IconDescriptor,
  toggleMute: { name: "volume_off", style: "rounded", decorative: true } satisfies IconDescriptor,
  toggleLoop: { name: "repeat_one", style: "rounded", decorative: true } satisfies IconDescriptor,
} as const;

export interface MusicPlayerCommandStateInput {
  hasTrack: boolean;
  canSave: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  loopOne: boolean;
  isSaving: boolean;
}

export function createMusicPlayerCommandContext(input: {
  sceneId?: string;
  surfaceId?: string | null;
}): CommandInvocationContext {
  return {
    pluginId: appConfig.appId,
    ...(input.sceneId ? { sceneId: input.sceneId } : undefined),
    ...(input.surfaceId ? { surfaceId: input.surfaceId } : undefined),
  };
}

export function createMusicPlayerCommandDefinitions(input: {
  sceneId?: string;
  surfaceId?: string | null;
}): CommandDefinitionInput[] {
  const scope = { kind: "app" as const, appId: appConfig.appId };
  const context = createMusicPlayerCommandContext(input);

  return [
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.openFiles,
      titleKey: "music-player.commands.openFiles.title",
      descriptionKey: "music-player.commands.openFiles.description",
      ariaLabelKey: "music-player.commands.openFiles.ariaLabel",
      icon: ICONS.openFiles,
      shortcut: { accelerator: "Mod+O", platform: "desktop", preventDefault: true },
      scope,
      permission: ["platform.read"],
      handlerId: MUSIC_PLAYER_HANDLER_IDS.openFiles,
      menuPlacement: [{ menuId: "file", groupId: "open", order: 10 }],
      toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
      paletteKeywords: ["open", "audio", "music"],
      state: { enabled: true, visible: true, value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.saveAudio,
      titleKey: "music-player.commands.saveAudio.title",
      descriptionKey: "music-player.commands.saveAudio.description",
      ariaLabelKey: "music-player.commands.saveAudio.ariaLabel",
      icon: ICONS.saveAudio,
      shortcut: { accelerator: "Mod+S", platform: "desktop", preventDefault: true },
      scope,
      permission: ["file.read", "file.write"],
      handlerId: MUSIC_PLAYER_HANDLER_IDS.saveAudio,
      menuPlacement: [{ menuId: "file", groupId: "save", order: 20 }],
      toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 20 }],
      paletteKeywords: ["save", "download", "copy"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.previousTrack,
      titleKey: "music-player.commands.previousTrack.title",
      descriptionKey: "music-player.commands.previousTrack.description",
      ariaLabelKey: "music-player.commands.previousTrack.ariaLabel",
      icon: ICONS.previousTrack,
      shortcut: { accelerator: "MediaPreviousTrack", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.previousTrack,
      menuPlacement: [{ menuId: "playback", groupId: "queue", order: 10 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "queue", order: 10 }],
      paletteKeywords: ["previous", "track", "queue"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noPreviousTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.nextTrack,
      titleKey: "music-player.commands.nextTrack.title",
      descriptionKey: "music-player.commands.nextTrack.description",
      ariaLabelKey: "music-player.commands.nextTrack.ariaLabel",
      icon: ICONS.nextTrack,
      shortcut: { accelerator: "MediaNextTrack", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.nextTrack,
      menuPlacement: [{ menuId: "playback", groupId: "queue", order: 20 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "queue", order: 20 }],
      paletteKeywords: ["next", "track", "queue"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noNextTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.togglePlayback,
      titleKey: "music-player.commands.togglePlayback.title",
      descriptionKey: "music-player.commands.togglePlayback.description",
      ariaLabelKey: "music-player.commands.togglePlayback.ariaLabel",
      icon: ICONS.togglePlayback,
      shortcut: [
        { accelerator: "Space", platform: "desktop", preventDefault: true },
        { accelerator: "MediaPlayPause", platform: "desktop", preventDefault: true },
      ],
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.togglePlayback,
      menuPlacement: [{ menuId: "playback", groupId: "transport", order: 10 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "transport", order: 10 }],
      paletteKeywords: ["play", "pause", "audio"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.rewind10,
      titleKey: "music-player.commands.rewind10.title",
      descriptionKey: "music-player.commands.rewind10.description",
      ariaLabelKey: "music-player.commands.rewind10.ariaLabel",
      icon: ICONS.rewind10,
      shortcut: { accelerator: "ArrowLeft", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.rewind10,
      menuPlacement: [{ menuId: "playback", groupId: "transport", order: 20 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "transport", order: 20 }],
      paletteKeywords: ["rewind", "seek"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.forward10,
      titleKey: "music-player.commands.forward10.title",
      descriptionKey: "music-player.commands.forward10.description",
      ariaLabelKey: "music-player.commands.forward10.ariaLabel",
      icon: ICONS.forward10,
      shortcut: { accelerator: "ArrowRight", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.forward10,
      menuPlacement: [{ menuId: "playback", groupId: "transport", order: 30 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "transport", order: 30 }],
      paletteKeywords: ["forward", "seek"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.volumeUp,
      titleKey: "music-player.commands.volumeUp.title",
      descriptionKey: "music-player.commands.volumeUp.description",
      ariaLabelKey: "music-player.commands.volumeUp.ariaLabel",
      icon: ICONS.volumeUp,
      shortcut: { accelerator: "ArrowUp", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.volumeUp,
      menuPlacement: [{ menuId: "playback", groupId: "audio", order: 10 }],
      paletteKeywords: ["volume", "loud"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.volumeDown,
      titleKey: "music-player.commands.volumeDown.title",
      descriptionKey: "music-player.commands.volumeDown.description",
      ariaLabelKey: "music-player.commands.volumeDown.ariaLabel",
      icon: ICONS.volumeDown,
      shortcut: { accelerator: "ArrowDown", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.volumeDown,
      menuPlacement: [{ menuId: "playback", groupId: "audio", order: 20 }],
      paletteKeywords: ["volume", "quiet"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.toggleMute,
      titleKey: "music-player.commands.toggleMute.title",
      descriptionKey: "music-player.commands.toggleMute.description",
      ariaLabelKey: "music-player.commands.toggleMute.ariaLabel",
      icon: ICONS.toggleMute,
      shortcut: { accelerator: "M", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.toggleMute,
      menuPlacement: [{ menuId: "playback", groupId: "audio", order: 30 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "audio", order: 10 }],
      paletteKeywords: ["mute", "volume"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
    {
      commandId: MUSIC_PLAYER_COMMAND_IDS.toggleLoop,
      titleKey: "music-player.commands.toggleLoop.title",
      descriptionKey: "music-player.commands.toggleLoop.description",
      ariaLabelKey: "music-player.commands.toggleLoop.ariaLabel",
      icon: ICONS.toggleLoop,
      shortcut: { accelerator: "L", platform: "desktop", preventDefault: true },
      scope,
      handlerId: MUSIC_PLAYER_HANDLER_IDS.toggleLoop,
      menuPlacement: [{ menuId: "playback", groupId: "audio", order: 40 }],
      toolbarPlacement: [{ toolbarId: "playback", groupId: "audio", order: 20 }],
      paletteKeywords: ["loop", "repeat"],
      state: { enabled: false, visible: true, disabledReasonKey: "music-player.commands.disabled.noTrack", value: context },
    },
  ];
}

export function createMusicPlayerCommandStates(input: MusicPlayerCommandStateInput): Record<MusicPlayerCommandId, CommandState> {
  const trackEnabledState: CommandState = {
    enabled: input.hasTrack,
    visible: true,
    disabledReasonKey: input.hasTrack ? undefined : "music-player.commands.disabled.noTrack",
  };

  return {
    [MUSIC_PLAYER_COMMAND_IDS.openFiles]: {
      enabled: true,
      visible: true,
    },
    [MUSIC_PLAYER_COMMAND_IDS.saveAudio]: {
      enabled: input.canSave && !input.isSaving,
      visible: true,
      busy: input.isSaving,
      disabledReasonKey: input.hasTrack ? undefined : "music-player.commands.disabled.noTrack",
    },
    [MUSIC_PLAYER_COMMAND_IDS.previousTrack]: {
      enabled: input.canGoPrevious,
      visible: true,
      disabledReasonKey: input.canGoPrevious ? undefined : "music-player.commands.disabled.noPreviousTrack",
    },
    [MUSIC_PLAYER_COMMAND_IDS.nextTrack]: {
      enabled: input.canGoNext,
      visible: true,
      disabledReasonKey: input.canGoNext ? undefined : "music-player.commands.disabled.noNextTrack",
    },
    [MUSIC_PLAYER_COMMAND_IDS.togglePlayback]: {
      ...trackEnabledState,
      checked: input.isPlaying,
      value: input.isPlaying ? "playing" : "paused",
    },
    [MUSIC_PLAYER_COMMAND_IDS.rewind10]: trackEnabledState,
    [MUSIC_PLAYER_COMMAND_IDS.forward10]: trackEnabledState,
    [MUSIC_PLAYER_COMMAND_IDS.volumeUp]: trackEnabledState,
    [MUSIC_PLAYER_COMMAND_IDS.volumeDown]: trackEnabledState,
    [MUSIC_PLAYER_COMMAND_IDS.toggleMute]: {
      ...trackEnabledState,
      checked: input.isMuted,
      value: input.isMuted ? "muted" : "audible",
    },
    [MUSIC_PLAYER_COMMAND_IDS.toggleLoop]: {
      ...trackEnabledState,
      checked: input.loopOne,
      value: input.loopOne ? "one" : "off",
    },
  };
}

