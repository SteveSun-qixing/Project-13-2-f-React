import { AppChrome, type MenuBarGroup } from "@chips/ui";
import { VideoPlayerStage } from "../components/VideoPlayerStage";
import { useVideoPlayerCommands } from "../commands/useVideoPlayerCommands";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const commands = useVideoPlayerCommands();

  const menus: MenuBarGroup[] = [
    { menuId: "file", label: "文件", commands },
    { menuId: "playback", label: "播放", commands },
    { menuId: "view", label: "查看", commands },
  ];

  const toolbarItems = commands.filter((command) => command.toolbarId === "player");

  return (
    <AppChrome
      appName="视频播放器"
      menus={menus}
      toolbarItems={toolbarItems}
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
