export type PreviewQualityEntryKind = "preview" | "contract" | "quality";

export interface PreviewQualityEntryViewModel {
  id: string;
  kind: PreviewQualityEntryKind;
  titleKey: string;
  descriptionKey: string;
  command: string;
  targetKey: string;
  boundaryKey: string;
}

export const PREVIEW_QUALITY_ENTRIES: PreviewQualityEntryViewModel[] = [
  {
    id: "preview-app",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewApp.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewApp.description",
    command: "chipsdev-r preview --target app --mode mock --json --out reports/preview-app.json",
    targetKey: "settingsPanel.previewQuality.targets.app",
    boundaryKey: "settingsPanel.previewQuality.boundaries.previewReport",
  },
  {
    id: "preview-component",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewComponent.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewComponent.description",
    command: "chipsdev-r preview --target component --mode mock --json --out reports/preview-component.json",
    targetKey: "settingsPanel.previewQuality.targets.component",
    boundaryKey: "settingsPanel.previewQuality.boundaries.previewReport",
  },
  {
    id: "preview-card",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewCard.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewCard.description",
    command: "chipsdev-r preview --target card --mode mock --json --out reports/preview-card.json",
    targetKey: "settingsPanel.previewQuality.targets.card",
    boundaryKey: "settingsPanel.previewQuality.boundaries.formalRenderOnly",
  },
  {
    id: "preview-box",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewBox.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewBox.description",
    command: "chipsdev-r preview --target box --mode mock --json --out reports/preview-box.json",
    targetKey: "settingsPanel.previewQuality.targets.box",
    boundaryKey: "settingsPanel.previewQuality.boundaries.formalRenderOnly",
  },
  {
    id: "preview-layout",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewLayout.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewLayout.description",
    command: "chipsdev-r preview --target layout --mode mock --json --out reports/preview-layout.json",
    targetKey: "settingsPanel.previewQuality.targets.layout",
    boundaryKey: "settingsPanel.previewQuality.boundaries.formalRenderOnly",
  },
  {
    id: "preview-theme",
    kind: "preview",
    titleKey: "settingsPanel.previewQuality.entries.previewTheme.title",
    descriptionKey: "settingsPanel.previewQuality.entries.previewTheme.description",
    command: "chipsdev-r preview --target theme --mode mock --json --out reports/preview-theme.json",
    targetKey: "settingsPanel.previewQuality.targets.theme",
    boundaryKey: "settingsPanel.previewQuality.boundaries.previewReport",
  },
  {
    id: "component-gallery",
    kind: "contract",
    titleKey: "settingsPanel.previewQuality.entries.componentGallery.title",
    descriptionKey: "settingsPanel.previewQuality.entries.componentGallery.description",
    command: "chipsdev-r component gallery --json --out reports/component-gallery.json",
    targetKey: "settingsPanel.previewQuality.targets.componentContract",
    boundaryKey: "settingsPanel.previewQuality.boundaries.reportOnly",
  },
  {
    id: "theme-inspect",
    kind: "contract",
    titleKey: "settingsPanel.previewQuality.entries.themeInspect.title",
    descriptionKey: "settingsPanel.previewQuality.entries.themeInspect.description",
    command: "chipsdev-r theme inspect --json --out reports/theme-inspect.json",
    targetKey: "settingsPanel.previewQuality.targets.themeContract",
    boundaryKey: "settingsPanel.previewQuality.boundaries.reportOnly",
  },
  {
    id: "quality-gate",
    kind: "quality",
    titleKey: "settingsPanel.previewQuality.entries.qualityGate.title",
    descriptionKey: "settingsPanel.previewQuality.entries.qualityGate.description",
    command: "chipsdev-r quality gate --json --out reports/quality-gate.json",
    targetKey: "settingsPanel.previewQuality.targets.quality",
    boundaryKey: "settingsPanel.previewQuality.boundaries.reportOnly",
  },
  {
    id: "diagnostics",
    kind: "quality",
    titleKey: "settingsPanel.previewQuality.entries.diagnostics.title",
    descriptionKey: "settingsPanel.previewQuality.entries.diagnostics.description",
    command: "chipsdev-r diagnostics --json --out reports/diagnostics.json",
    targetKey: "settingsPanel.previewQuality.targets.diagnostics",
    boundaryKey: "settingsPanel.previewQuality.boundaries.reportOnly",
  },
];
