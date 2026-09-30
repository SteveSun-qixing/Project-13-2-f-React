/**
 * 图标工坊领域类型与预设表（旧 Chip-iconMaker/src/icon-workbench/types.ts 迁移）。
 *
 * 相对旧面的登记适配（W5 迁移日志）：
 * 1. `IconBackgroundSelection.labelKey`（i18n key）改为 `label`（简体中文直写）——
 *    文案去 key 层，i18n/messageKey 机制随 task030 作废（SDK/工具类矩阵 §三）；
 * 2. 其余类型、预设色板与默认设置逐字迁移。
 */

export type IconOutputFormat = 'png' | 'ico' | 'icns';

export type IconSourceMode = 'image' | 'font';

export type IconBackgroundKind = 'solid' | 'gradient';

export type IconImageFitMode = 'fit' | 'fill';

export type IconFontKind = 'material' | 'emoji' | 'custom';

export interface IconBackgroundSelection {
  id: string;
  label: string;
  kind: IconBackgroundKind;
  start: string;
  end: string;
}

export interface IconWorkbenchSettings {
  outputSize: number;
  formats: IconOutputFormat[];
  background: IconBackgroundSelection;
  foregroundColor: string;
  imageFit: IconImageFitMode;
}

export interface SourceIconImage {
  id: string;
  fileName: string;
  baseName: string;
  objectUrl: string;
  width: number;
  height: number;
  file: File;
}

export interface IconGlyph {
  id: string;
  label: string;
  display: string;
  codepoint?: string;
}

export interface IconFontSource {
  id: string;
  kind: IconFontKind;
  name: string;
  family: string;
  glyphs: IconGlyph[];
  objectUrl?: string;
}

export interface BinaryIconFile {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface RenderIconOptions {
  size: number;
  settings: IconWorkbenchSettings;
  sourceMode: IconSourceMode;
  imageSource: SourceIconImage | null;
  fontSource: IconFontSource;
  selectedGlyph: IconGlyph | null;
}

export const OUTPUT_SIZE_MARKS = [16, 32, 48, 64, 128, 256, 512] as const;

export const ICON_FORMATS: IconOutputFormat[] = ['png', 'ico', 'icns'];

export const BACKGROUND_PRESETS: IconBackgroundSelection[] = [
  {
    id: 'white',
    label: '纯白',
    kind: 'solid',
    start: '#ffffff',
    end: '#ffffff',
  },
  {
    id: 'black',
    label: '纯黑',
    kind: 'solid',
    start: '#050505',
    end: '#050505',
  },
  {
    id: 'peach',
    label: '桃粉',
    kind: 'gradient',
    start: '#ff9a9e',
    end: '#fad0c4',
  },
  {
    id: 'ocean',
    label: '海蓝',
    kind: 'gradient',
    start: '#0a84ff',
    end: '#06b6d4',
  },
  {
    id: 'aurora',
    label: '极光',
    kind: 'gradient',
    start: '#22c55e',
    end: '#a3e635',
  },
  {
    id: 'violet',
    label: '紫莓',
    kind: 'gradient',
    start: '#8b5cf6',
    end: '#ec4899',
  },
  {
    id: 'ember',
    label: '暖焰',
    kind: 'gradient',
    start: '#ff9f0a',
    end: '#ef4444',
  },
  {
    id: 'slate',
    label: '石板',
    kind: 'gradient',
    start: '#0f172a',
    end: '#64748b',
  },
] as const;

export const DEFAULT_ICON_SETTINGS: IconWorkbenchSettings = {
  outputSize: 256,
  formats: ['png', 'ico', 'icns'],
  // 预设表为模块内字面量，首项恒存在（纯白）。
  background: BACKGROUND_PRESETS[0]!,
  foregroundColor: '#000000',
  imageFit: 'fit',
};
