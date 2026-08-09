import {
  ColumnWidthOutlined,
  CopyOutlined,
  ExpandOutlined,
  FolderOpenOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SaveOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { appConfig } from "../../config/app-config";
import type { CommandItem } from "@chips/ui";

export const PHOTO_VIEWER_COMMAND_IDS = {
  openFile: `${appConfig.appId}.file.open`,
  saveImage: `${appConfig.appId}.file.save-copy`,
  previousImage: `${appConfig.appId}.view.previous-image`,
  nextImage: `${appConfig.appId}.view.next-image`,
  zoomOut: `${appConfig.appId}.view.zoom-out`,
  zoomIn: `${appConfig.appId}.view.zoom-in`,
  fitToWindow: `${appConfig.appId}.view.fit-to-window`,
  actualSize: `${appConfig.appId}.view.actual-size`,
  fullscreen: `${appConfig.appId}.view.fullscreen`,
  rotateClockwise: `${appConfig.appId}.view.rotate-clockwise`,
  rotateCounterclockwise: `${appConfig.appId}.view.rotate-counterclockwise`,
  showInfo: `${appConfig.appId}.view.info`,
  copyImage: `${appConfig.appId}.edit.copy`,
  firstImage: `${appConfig.appId}.navigate.first`,
  lastImage: `${appConfig.appId}.navigate.last`,
} as const;

export type PhotoViewerCommandId =
  (typeof PHOTO_VIEWER_COMMAND_IDS)[keyof typeof PHOTO_VIEWER_COMMAND_IDS];

export interface PhotoViewerCommandState {
  hasImage: boolean;
  isImageLoaded: boolean;
  isSaving: boolean;
  canPreviousImage: boolean;
  canNextImage: boolean;
  canFirst?: boolean;
  canLast?: boolean;
}

export interface PhotoViewerCommandHandlers {
  openFile: () => void | Promise<void>;
  saveImage: () => void | Promise<void>;
  previousImage: () => void;
  nextImage: () => void;
  zoomOut: () => void;
  zoomIn: () => void;
  fitToWindow: () => void;
  actualSize: () => void;
  fullscreen?: () => void | Promise<void>;
  rotateClockwise?: () => void;
  rotateCounterclockwise?: () => void;
  showInfo?: () => void;
  copyImage?: () => void | Promise<void>;
  firstImage?: () => void;
  lastImage?: () => void;
}

export function createPhotoViewerCommands(
  handlers: PhotoViewerCommandHandlers,
  state: PhotoViewerCommandState,
): CommandItem[] {
  const {
    hasImage,
    isImageLoaded,
    isSaving,
    canPreviousImage,
    canNextImage,
    canFirst,
    canLast,
  } = state;

  return [
    {
      id: PHOTO_VIEWER_COMMAND_IDS.openFile,
      title: "打开图片",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "viewer",
      keywords: ["open", "image", "打开", "图片"],
      run: () => void handlers.openFile(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.saveImage,
      title: "保存图片",
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "viewer",
      keywords: ["save", "copy", "保存", "副本"],
      enabled: hasImage && !isSaving,
      run: () => void handlers.saveImage(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.previousImage,
      title: "上一张",
      shortcut: "ArrowLeft",
      icon: <StepBackwardOutlined />,
      group: "导航",
      menuId: "navigate",
      toolbarId: "viewer",
      keywords: ["previous", "上一张", "上一页"],
      enabled: canPreviousImage,
      run: handlers.previousImage,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.nextImage,
      title: "下一张",
      shortcut: "ArrowRight",
      icon: <StepForwardOutlined />,
      group: "导航",
      menuId: "navigate",
      toolbarId: "viewer",
      keywords: ["next", "下一张", "下一页"],
      enabled: canNextImage,
      run: handlers.nextImage,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.firstImage,
      title: "第一张",
      shortcut: "Mod+ArrowLeft",
      icon: <StepBackwardOutlined />,
      group: "导航",
      menuId: "navigate",
      keywords: ["first", "第一张", "首张"],
      enabled: canFirst,
      run: () => void handlers.firstImage?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.lastImage,
      title: "最后一张",
      shortcut: "Mod+ArrowRight",
      icon: <StepForwardOutlined />,
      group: "导航",
      menuId: "navigate",
      keywords: ["last", "最后一张", "末张"],
      enabled: canLast,
      run: () => void handlers.lastImage?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.zoomOut,
      title: "缩小",
      shortcut: "Mod+-",
      icon: <ZoomOutOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "viewer",
      keywords: ["zoom", "out", "缩小"],
      enabled: hasImage && isImageLoaded,
      run: handlers.zoomOut,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.zoomIn,
      title: "放大",
      shortcut: "Mod+=",
      icon: <ZoomInOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "viewer",
      keywords: ["zoom", "in", "放大"],
      enabled: hasImage && isImageLoaded,
      run: handlers.zoomIn,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.fitToWindow,
      title: "适应窗口",
      shortcut: "Mod+0",
      icon: <ExpandOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "viewer",
      keywords: ["fit", "window", "适应窗口"],
      enabled: hasImage && isImageLoaded,
      run: handlers.fitToWindow,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.actualSize,
      title: "实际大小",
      shortcut: "Mod+1",
      icon: <ColumnWidthOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "viewer",
      keywords: ["actual", "size", "实际大小"],
      enabled: hasImage && isImageLoaded,
      run: handlers.actualSize,
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.fullscreen,
      title: "全屏",
      shortcut: "F",
      icon: <FullscreenOutlined />,
      group: "查看",
      menuId: "view",
      toolbarId: "viewer",
      keywords: ["fullscreen", "full", "screen", "全屏"],
      enabled: hasImage,
      run: () => void handlers.fullscreen?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.rotateClockwise,
      title: "顺时针旋转",
      shortcut: "R",
      icon: <RotateRightOutlined />,
      group: "查看",
      menuId: "view",
      keywords: ["rotate", "clockwise", "顺时针", "旋转"],
      enabled: hasImage,
      run: () => void handlers.rotateClockwise?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.rotateCounterclockwise,
      title: "逆时针旋转",
      shortcut: "Mod+Shift+R",
      icon: <RotateLeftOutlined />,
      group: "查看",
      menuId: "view",
      keywords: ["rotate", "counterclockwise", "逆时针", "旋转"],
      enabled: hasImage,
      run: () => void handlers.rotateCounterclockwise?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.showInfo,
      title: "图片信息",
      shortcut: "Mod+I",
      icon: <InfoCircleOutlined />,
      group: "查看",
      menuId: "view",
      keywords: ["info", "information", "信息", "属性"],
      enabled: hasImage,
      run: () => void handlers.showInfo?.(),
    },
    {
      id: PHOTO_VIEWER_COMMAND_IDS.copyImage,
      title: "复制图片",
      shortcut: "Mod+C",
      icon: <CopyOutlined />,
      group: "编辑",
      menuId: "edit",
      keywords: ["copy", "clipboard", "复制", "剪贴板"],
      enabled: hasImage,
      run: () => void handlers.copyImage?.(),
    },
  ];
}
