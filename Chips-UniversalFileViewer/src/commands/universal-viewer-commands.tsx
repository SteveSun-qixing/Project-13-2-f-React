import {
  DownloadOutlined,
  FileAddOutlined,
  FullscreenOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SearchOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import { formatMessage } from "../lib/messages";

export const UNIVERSAL_VIEWER_COMMAND_IDS = {
  openFile: "universal-viewer.open-file",
  saveCopy: "universal-viewer.save-copy",
  reload: "universal-viewer.reload",
  zoomIn: "universal-viewer.zoom-in",
  zoomOut: "universal-viewer.zoom-out",
  zoomFit: "universal-viewer.zoom-fit",
  rotateLeft: "universal-viewer.rotate-left",
  rotateRight: "universal-viewer.rotate-right",
  previousFile: "universal-viewer.previous-file",
  nextFile: "universal-viewer.next-file",
  fullscreen: "universal-viewer.fullscreen",
  print: "universal-viewer.print",
  search: "universal-viewer.search",
} as const;

export interface UniversalViewerCommandContext {
  hasFile: boolean;
  openFile(): void | Promise<void>;
  saveCopy(): void | Promise<void>;
  reload(): void | Promise<void>;
  runToolbarAction(action: "zoom-in" | "zoom-out" | "zoom-reset" | "rotate-left" | "rotate-right" | "fullscreen" | "print" | "search"): void;
  previousFile(): void;
  nextFile(): void;
}

export function createUniversalViewerCommands(context: UniversalViewerCommandContext): CommandItem[] {
  const requiresFile = (command: CommandItem): CommandItem => ({
    ...command,
    enabled: context.hasFile,
  });

  return [
    {
      id: UNIVERSAL_VIEWER_COMMAND_IDS.openFile,
      title: formatMessage("universal-viewer.commands.openFile.title"),
      shortcut: "Mod+O",
      icon: <FileAddOutlined />,
      group: formatMessage("universal-viewer.commands.menu.file"),
      menuId: "file",
      run: () => void context.openFile(),
    },
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.saveCopy,
      title: formatMessage("universal-viewer.commands.saveCopy.title"),
      shortcut: "Mod+S",
      icon: <DownloadOutlined />,
      group: formatMessage("universal-viewer.commands.menu.file"),
      menuId: "file",
      run: () => void context.saveCopy(),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.reload,
      title: formatMessage("universal-viewer.commands.refresh.title"),
      shortcut: "Mod+R",
      icon: <ReloadOutlined />,
      group: formatMessage("universal-viewer.commands.menu.file"),
      menuId: "file",
      run: () => void context.reload(),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.zoomIn,
      title: formatMessage("universal-viewer.commands.zoomIn.title"),
      shortcut: "Mod+=",
      icon: <ZoomInOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("zoom-in"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.zoomOut,
      title: formatMessage("universal-viewer.commands.zoomOut.title"),
      shortcut: "Mod+-",
      icon: <ZoomOutOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("zoom-out"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.zoomFit,
      title: formatMessage("universal-viewer.commands.zoomFit.title"),
      icon: <RollbackOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("zoom-reset"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.rotateLeft,
      title: formatMessage("universal-viewer.commands.rotateLeft.title"),
      icon: <RotateLeftOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("rotate-left"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.rotateRight,
      title: formatMessage("universal-viewer.commands.rotateRight.title"),
      icon: <RotateRightOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("rotate-right"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.previousFile,
      title: formatMessage("universal-viewer.commands.previousFile.title"),
      shortcut: "Mod+ArrowLeft",
      group: formatMessage("universal-viewer.commands.menu.navigate"),
      menuId: "navigate",
      run: () => context.previousFile(),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.nextFile,
      title: formatMessage("universal-viewer.commands.nextFile.title"),
      shortcut: "Mod+ArrowRight",
      group: formatMessage("universal-viewer.commands.menu.navigate"),
      menuId: "navigate",
      run: () => context.nextFile(),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.fullscreen,
      title: formatMessage("universal-viewer.commands.fullscreen.title"),
      icon: <FullscreenOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("fullscreen"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.print,
      title: formatMessage("universal-viewer.commands.print.title"),
      icon: <PrinterOutlined />,
      group: formatMessage("universal-viewer.commands.menu.file"),
      menuId: "file",
      run: () => context.runToolbarAction("print"),
    }),
    requiresFile({
      id: UNIVERSAL_VIEWER_COMMAND_IDS.search,
      title: formatMessage("universal-viewer.commands.search.title"),
      shortcut: "Mod+F",
      icon: <SearchOutlined />,
      group: formatMessage("universal-viewer.commands.menu.view"),
      menuId: "view",
      run: () => context.runToolbarAction("search"),
    }),
  ];
}
