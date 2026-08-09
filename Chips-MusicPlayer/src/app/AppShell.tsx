import { AppChrome, type MenuBarGroup } from "@chips/ui";
import { MusicPlayerStage } from "../components/MusicPlayerStage";
import { useMusicPlayerCommands } from "../commands/useMusicPlayerCommands";
import { useMusicPlayerRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useMusicPlayerRuntime();
  const commands = useMusicPlayerCommands();

  const menus: MenuBarGroup[] = [
    { menuId: "file", label: "文件", commands },
    { menuId: "playback", label: "播放", commands },
  ];

  const toolbarItems = commands.filter((command) => command.toolbarId === "main");

  return (
    <AppChrome
      appName="音乐播放器"
      menus={menus}
      toolbarItems={toolbarItems}
      paletteShortcut="Mod+P"
      tone="dark-glass"
    >
      <MusicPlayerStage
        track={runtime.track}
        queue={runtime.queue}
        queueIndex={runtime.queueIndex}
        canGoPrevious={runtime.canGoPrevious}
        canGoNext={runtime.canGoNext}
        isResolving={runtime.isResolving}
        isSaving={runtime.isSaving}
        feedback={runtime.feedback}
        onOpenFiles={runtime.openFiles}
        onSaveAudio={runtime.saveAudio}
        onDropFiles={runtime.dropFiles}
        onPreviousTrack={runtime.goPreviousTrack}
        onNextTrack={runtime.goNextTrack}
        t={runtime.t}
        setPlayerActions={runtime.setPlayerActions}
      />
    </AppChrome>
  );
}
