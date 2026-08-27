/**
 * 箱子编辑会话类型定义
 *
 * 会话语义来源：Chips-EditingEngine `src/services/box-document-service.ts`（task034 M3 上移）。
 * 对外契约以 `生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md` 为准。
 */

import type { BoxContent, BoxEntrySnapshot, BoxInspection, BoxLayoutConfig, BoxMetadata } from '../box-service';

export interface BoxSessionSnapshot {
  boxId: string;
  boxFile: string;
  workspaceDir: string;
  metadata: BoxMetadata;
  coverHtml: string;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  assets: string[];
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt?: string;
}

export interface BoxSessionState {
  snapshot: BoxSessionSnapshot;
}

export interface BoxSessionResourceInput {
  filePath: string;
  preferredPath?: string;
}

export interface BoxSessionCoverInput {
  html: string;
  ratio?: string;
  resources?: Array<{ path: string; data: Uint8Array }>;
}

export interface BoxSessionOptions {
  /** 打包/解包/检查（Host box-service 能力） */
  pack(boxDir: string, outputPath: string): Promise<void>;
  unpack(boxFile: string, outputDir: string): Promise<void>;
  inspect(boxFile: string): Promise<BoxInspection>;
  /** 布局描述符读取与配置归一（Host box-service 能力） */
  layout: {
    readDescriptor(layoutType: string): Promise<{ defaultConfig?: Record<string, unknown> }>;
    normalizeConfig(layoutType: string, config: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  /** 文档信息读取（card.readInfo / box.readMetadata 能力） */
  documentInfo: {
    readCardInfo(
      cardFile: string,
    ): Promise<{ name?: string; cardId?: string; tags?: Array<string | string[]>; ready: boolean }>;
    readBoxMetadata(boxFile: string): Promise<{ boxId: string; name: string; tags?: Array<string | string[]> }>;
  };
  /** 默认封面 HTML 生成入口（M5 收敛到 chips.module.cover） */
  createDefaultCoverHtml(name: string): string;
}
