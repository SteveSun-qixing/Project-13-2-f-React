/**
 * 封面面板预览框布局纯函数（矩阵裁决件：迁移自旧仓 Chips-EditingEngine
 * `src/components/CardSettings/panels/cover-panel-layout.ts:1-54`，
 * 零 Host 零 UI 纯函数；编辑器主体卡片设置封面面板重写时消费）。
 *
 * 迁移适配（逐字迁移，逻辑零语义差）：`parseCoverRatio` 导入自旧
 * `utils/card-cover.ts`（全文件判废弃 → W4 `chips.module.cover`），其最小依赖闭包
 * 随本件收编为同目录 `cover-ratio.ts`，仅改导入来源。
 */

import { parseCoverRatio } from './cover-ratio';

export interface CoverPreviewFrameSize {
  width: number;
  height: number;
}

export interface ResolveCoverPreviewFrameSizeInput {
  ratio: string;
  containerWidth: number;
  containerHeight: number;
  preferredWidth?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
}

export function resolveCoverPreviewFrameSize({
  ratio,
  containerWidth,
  containerHeight,
  preferredWidth = 300,
  horizontalPadding = 40,
  verticalPadding = 40,
}: ResolveCoverPreviewFrameSizeInput): CoverPreviewFrameSize {
  const { width: ratioWidth, height: ratioHeight } = parseCoverRatio(ratio);
  const availableWidth = Math.max(0, containerWidth - horizontalPadding);
  const availableHeight = Math.max(0, containerHeight - verticalPadding);

  if (!availableWidth || !availableHeight) {
    return {
      width: 0,
      height: 0,
    };
  }

  let width = Math.min(preferredWidth, availableWidth);
  let height = width * (ratioHeight / ratioWidth);

  if (height > availableHeight) {
    height = availableHeight;
    width = height * (ratioWidth / ratioHeight);
  }

  if (width > availableWidth) {
    width = availableWidth;
    height = width * (ratioHeight / ratioWidth);
  }

  return {
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}
