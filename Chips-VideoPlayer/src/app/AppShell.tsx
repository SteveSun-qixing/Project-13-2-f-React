import { AppChrome } from "@chips/ui";
import { VideoPlayerStage } from "../components/VideoPlayerStage";
import { useVideoPlayerCommands } from "../commands/useVideoPlayerCommands";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  useVideoPlayerCommands();

  return (
    <AppChrome
      paletteShortcut="Mod+P"
      contentStyle={{ position: "relative", overflow: "hidden" }}
    >
      <VideoPlayerStage
        videoSource={runtime.videoSource}
        controller={runtime.controller}
        isResolving={runtime.isResolving}
        isSaving={runtime.isSaving}
        feedback={runtime.feedback}
        isMorePanelOpen={runtime.isMorePanelOpen}
        onMorePanelOpenChange={runtime.setMorePanelOpen}
        onDropFile={runtime.dropFile}
        queueCount={runtime.queueCount}
        onPlayNext={runtime.playNext}
        t={runtime.t}
      />
    </AppChrome>
  );
}
