/**
 * 旧编辑器窗口类型定义。
 * 该文件从归档项目上层模型迁移而来，用作新架构中的正式窗口语义基线。
 */

/** 窗口类型 */
export type WindowType = "card" | "tool" | "modal";

/** 窗口状态 */
export type WindowState = "normal" | "minimized" | "collapsed" | "cover";

/** 窗口位置 */
export interface WindowPosition {
  x: number;
  y: number;
}

/** 窗口大小 */
export interface WindowSize {
  width: number;
  height: number;
}

/** 窗口配置基础接口 */
export interface WindowConfig {
  id: string;
  type: WindowType;
  title: string;
  position: WindowPosition;
  size: WindowSize;
  state: WindowState;
  zIndex: number;
  resizable?: boolean;
  draggable?: boolean;
  closable?: boolean;
  minimizable?: boolean;
}

/** 卡片窗口配置 */
export interface CardWindowConfig extends WindowConfig {
  type: "card";
  cardId: string;
  isEditing: boolean;
  coverRatio?: string;
  cardType?: string;
}

/** 工具窗口配置 */
export interface ToolWindowConfig extends WindowConfig {
  type: "tool";
  component: string;
  icon?: string;
  dockable?: boolean;
}

/** 模态窗口配置 */
export interface ModalWindowConfig extends WindowConfig {
  type: "modal";
  mask?: boolean;
  maskClosable?: boolean;
}
