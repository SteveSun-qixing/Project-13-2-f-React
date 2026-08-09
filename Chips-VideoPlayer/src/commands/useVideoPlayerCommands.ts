import { useEffect, useMemo, useRef } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import {
  createVideoPlayerCommands,
  type VideoPlayerCommandHandlers,
} from "./video-player-commands";

export function useVideoPlayerCommands(): CommandItem[] {
  const runtime = useAppRuntime();
  const { register } = useCommandRegistry();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;

  const handlers = useMemo<VideoPlayerCommandHandlers>(() => ({
    openFile: () => void runtimeRef.current.openFile(),
    saveCopy: () => void runtimeRef.current.saveVideo(),
    togglePlayback: () => void runtimeRef.current.controller.togglePlayback(),
    seekBackward: () => runtimeRef.current.controller.seekBy(-5),
    seekForward: () => runtimeRef.current.controller.seekBy(5),
    toggleMute: () => runtimeRef.current.controller.toggleMute(),
    toggleFullscreen: () => void runtimeRef.current.controller.toggleFullscreen(),
    togglePictureInPicture: () => void runtimeRef.current.controller.togglePictureInPicture(),
    toggleMorePanel: () => runtimeRef.current.setMorePanelOpen(!runtimeRef.current.isMorePanelOpen),
  }), []);

  const commands = useMemo(
    () =>
      createVideoPlayerCommands(handlers, {
        hasVideo: runtime.videoSource !== null,
        isSaving: runtime.isSaving,
        canUsePictureInPicture: runtime.controller.canUsePictureInPicture,
      }),
    [handlers, runtime.controller.canUsePictureInPicture, runtime.isSaving, runtime.videoSource],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}
