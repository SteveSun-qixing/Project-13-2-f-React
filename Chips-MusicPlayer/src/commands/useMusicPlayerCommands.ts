import { useEffect, useMemo } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import { useMusicPlayerRuntime } from "../app/AppRuntimeProvider";
import { clampVolume } from "../utils/music-player";
import {
  createMusicPlayerCommands,
  type MusicPlayerCommandHandlers,
} from "./music-player-commands";

const VOLUME_COMMAND_STEP = 0.05;

export function useMusicPlayerCommands(): CommandItem[] {
  const runtime = useMusicPlayerRuntime();
  const { register } = useCommandRegistry();

  const handlers = useMemo<MusicPlayerCommandHandlers>(
    () => ({
      openFiles: runtime.openFiles,
      saveAudio: runtime.saveAudio,
      previousTrack: runtime.goPreviousTrack,
      nextTrack: runtime.goNextTrack,
      togglePlayback: () => void runtime.playerActions?.togglePlayback(),
      rewind10: () => runtime.playerActions?.seekBy(-10),
      forward10: () => runtime.playerActions?.seekBy(10),
      volumeUp: () => {
        const nextVolume = clampVolume((runtime.playerActions?.getVolume() ?? 0.85) + VOLUME_COMMAND_STEP);
        runtime.playerActions?.setVolumeLevel(nextVolume);
        runtime.setPlaybackVolume(nextVolume);
      },
      volumeDown: () => {
        const nextVolume = clampVolume((runtime.playerActions?.getVolume() ?? 0.85) - VOLUME_COMMAND_STEP);
        runtime.playerActions?.setVolumeLevel(nextVolume);
        runtime.setPlaybackVolume(nextVolume);
      },
      toggleMute: () => runtime.playerActions?.toggleMute(),
      toggleLoop: () => runtime.playerActions?.toggleLoopMode(),
    }),
    [runtime],
  );

  const commands = useMemo(
    () =>
      createMusicPlayerCommands(handlers, {
        hasTrack: Boolean(runtime.track),
        canSave: Boolean(runtime.track),
        canGoPrevious: runtime.canGoPrevious,
        canGoNext: runtime.canGoNext,
        isSaving: runtime.isSaving,
      }),
    [
      handlers,
      runtime.canGoNext,
      runtime.canGoPrevious,
      runtime.isSaving,
      runtime.track,
    ],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}
