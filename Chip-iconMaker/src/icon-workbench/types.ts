export type IconOutputFormat = "png" | "ico" | "icns";

export type IconSourceMode = "image" | "font";

export type IconBackgroundKind = "solid" | "gradient";

export type IconImageFitMode = "fit" | "fill";

export type IconFontKind = "material" | "emoji" | "custom";

export interface IconBackgroundSelection {
  id: string;
  labelKey: string;
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

export const ICON_FORMATS: IconOutputFormat[] = ["png", "ico", "icns"];

export const BACKGROUND_PRESETS: IconBackgroundSelection[] = [
  {
    id: "white",
    labelKey: "iconMaker.background.white",
    kind: "solid",
    start: "#ffffff",
    end: "#ffffff",
  },
  {
    id: "black",
    labelKey: "iconMaker.background.black",
    kind: "solid",
    start: "#050505",
    end: "#050505",
  },
  {
    id: "peach",
    labelKey: "iconMaker.background.peach",
    kind: "gradient",
    start: "#ff9a9e",
    end: "#fad0c4",
  },
  {
    id: "ocean",
    labelKey: "iconMaker.background.ocean",
    kind: "gradient",
    start: "#0a84ff",
    end: "#06b6d4",
  },
  {
    id: "aurora",
    labelKey: "iconMaker.background.aurora",
    kind: "gradient",
    start: "#22c55e",
    end: "#a3e635",
  },
  {
    id: "violet",
    labelKey: "iconMaker.background.violet",
    kind: "gradient",
    start: "#8b5cf6",
    end: "#ec4899",
  },
  {
    id: "ember",
    labelKey: "iconMaker.background.ember",
    kind: "gradient",
    start: "#ff9f0a",
    end: "#ef4444",
  },
  {
    id: "slate",
    labelKey: "iconMaker.background.slate",
    kind: "gradient",
    start: "#0f172a",
    end: "#64748b",
  },
] as const;

export const DEFAULT_ICON_SETTINGS: IconWorkbenchSettings = {
  outputSize: 256,
  formats: ["png", "ico", "icns"],
  background: BACKGROUND_PRESETS[0],
  foregroundColor: "#000000",
  imageFit: "fit",
};
