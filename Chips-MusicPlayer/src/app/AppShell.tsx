import { AppChrome } from "@chips/ui";
import { MusicPlayerStage } from "../components/MusicPlayerStage";
import { useMusicPlayerCommands } from "../commands/useMusicPlayerCommands";
import { useMusicPlayerRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useMusicPlayerRuntime();
  useMusicPlayerCommands();

  return (
    <AppChrome paletteShortcut="Mod+P">
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
