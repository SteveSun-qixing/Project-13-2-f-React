import { AppChrome } from "@chips/ui";
import { useOfficeCommands } from "../commands/useOfficeCommands";
import { PdfScene } from "../scenes/PdfScene";
import { SheetScene } from "../scenes/SheetScene";
import { SlideScene } from "../scenes/SlideScene";
import { StartScene } from "../scenes/StartScene";
import { WordScene } from "../scenes/WordScene";
import { OFFICE_SCENE_IDS } from "./scene-registry";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  useOfficeCommands();

  const immersive = runtime.activeSceneId !== OFFICE_SCENE_IDS.start;

  return (
    <AppChrome paletteShortcut="Mod+P" immersive={immersive}>
      {runtime.activeSceneId === OFFICE_SCENE_IDS.start && <StartScene />}
      {runtime.activeSceneId === OFFICE_SCENE_IDS.word && <WordScene />}
      {runtime.activeSceneId === OFFICE_SCENE_IDS.sheet && <SheetScene />}
      {runtime.activeSceneId === OFFICE_SCENE_IDS.slide && <SlideScene />}
      {runtime.activeSceneId === OFFICE_SCENE_IDS.pdf && <PdfScene />}
    </AppChrome>
  );
}
