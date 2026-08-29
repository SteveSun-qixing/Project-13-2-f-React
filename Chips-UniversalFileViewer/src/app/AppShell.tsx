import { AppChrome } from "@chips/ui";
import { UniversalViewerStage } from "../components/UniversalViewerStage";
import { useUniversalViewerCommands } from "../commands/useUniversalViewerCommands";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  useUniversalViewerCommands();

  const hasFile = runtime.loadedFiles.length > 0;

  return (
    <AppChrome paletteShortcut="Mod+P" immersive={hasFile} immersiveContentClass="universal-viewer-stage--viewing">
      <UniversalViewerStage
        loadedFiles={runtime.loadedFiles}
        initialIndex={runtime.initialIndex}
        isLoading={runtime.isLoading}
        feedback={runtime.feedback}
        toolbarContext={runtime.toolbarContext}
        onToolbarContext={runtime.setToolbarContext}
        onOpenFile={() => void runtime.openFile()}
        onReload={() => void runtime.reloadCurrent()}
        onSaveCopy={() => void runtime.saveCopy()}
        onDropFile={(file) => void runtime.dropFile(file)}
      />
    </AppChrome>
  );
}
