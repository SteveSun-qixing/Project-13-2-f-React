/**
 * 封面比例解析纯函数（矩阵裁决件依赖收编：自旧仓 Chips-EditingEngine
 * `src/utils/card-cover.ts:6/:17-41/:49-56` 逐字收编 `parseCoverRatio` 的最小依赖闭包）。
 *
 * 裁决口径：旧 `card-cover.ts` 全文件判**废弃**（封面 HTML 生成归 W4 `chips.module.cover`，
 * 见《旧功能覆盖矩阵-编辑引擎与UI与设置面板-2026-09-20》§三「封面服务与封面工具」行）；
 * 但搬运件 `cover-crop-layout.ts` / `cover-panel-layout.ts` 的唯一外部依赖是
 * `parseCoverRatio`（比例字符串 → 宽高数值的呈现数学），属零能力零 Host 纯解析，
 * 故随两布局件收编于此，全文件废弃裁决不变、封面生成面不迁移。
 * 缩进自旧仓 4 空格适配为工作区 2 空格（prettier tabWidth），逻辑零语义差。
 */

export const DEFAULT_COVER_RATIO = '3:4';

export function normalizeCoverRatio(value?: string): string {
  if (typeof value !== 'string') {
    return DEFAULT_COVER_RATIO;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_COVER_RATIO;
  }

  const normalized = trimmed.replace('/', ':');
  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.length !== 2) {
    return DEFAULT_COVER_RATIO;
  }

  const [width, height] = parts;
  const widthValue = Number(width);
  const heightValue = Number(height);
  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
    return DEFAULT_COVER_RATIO;
  }

  return `${width}:${height}`;
}

export function parseCoverRatio(value: string): { width: number; height: number } {
  const normalized = normalizeCoverRatio(value);
  const [width, height] = normalized.split(':');
  return {
    width: Number(width),
    height: Number(height),
  };
}
