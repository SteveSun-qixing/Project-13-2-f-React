export type PreviewSource = File | Blob | string | ArrayBuffer;

export type PreviewFit =
  | "contain"
  | "cover"
  | "width"
  | "height"
  | "actual"
  | "scale-down";

export type PreviewFallback = "inline" | "download" | "custom";
export type PreviewToolbarBuiltInAction =
  | "previous"
  | "next"
  | "queue"
  | "zoom-out"
  | "zoom-in"
  | "zoom-reset"
  | "rotate-left"
  | "rotate-right"
  | "download"
  | "fullscreen"
  | "exit-fullscreen"
  | "print"
  | "search";
export type PreviewToolbarActionId = PreviewToolbarBuiltInAction | (string & {});

export interface PreviewFile {
  source: PreviewSource;
  name: string;
  extension: string;
  mimeType: string;
  size?: number | undefined;
  url?: string | undefined;
  blob?: Blob | undefined;
}

export interface PreviewItem {
  file: PreviewSource;
  fileName?: string | undefined;
  mimeType?: string | undefined;
}

export interface PreviewSize {
  width: number;
  height: number;
}

export interface PreviewToolbarOptions {
  zoom?: boolean | undefined;
  rotate?: boolean | undefined;
  download?: boolean | undefined;
  fullscreen?: boolean | undefined;
  print?: boolean | undefined;
  search?: boolean | undefined;
  order?: PreviewToolbarActionId[] | undefined;
  labels?: Partial<Record<PreviewToolbarBuiltInAction, string>> | undefined;
  titles?: Partial<Record<PreviewToolbarBuiltInAction, string>> | undefined;
  icons?: Partial<Record<PreviewToolbarBuiltInAction, string | HTMLElement | SVGElement>> | undefined;
  actions?: PreviewToolbarCustomAction[] | undefined;
  render?: ((ctx: PreviewToolbarRenderContext) => HTMLElement | void) | undefined;
}

export interface PreviewToolbarCustomAction {
  id: string;
  label: string;
  title?: string | undefined;
  icon?: string | HTMLElement | SVGElement | undefined;
  order?: number | undefined;
  disabled?: boolean | ((ctx: PreviewToolbarRenderContext) => boolean) | undefined;
  hidden?: boolean | ((ctx: PreviewToolbarRenderContext) => boolean) | undefined;
  className?: string | undefined;
  onClick: (ctx: PreviewToolbarRenderContext) => void | Promise<void>;
}

export interface PreviewToolbarRenderContext {
  file?: PreviewFile | undefined;
  index: number;
  length: number;
  viewport: HTMLElement;
  canPrevious: boolean;
  canNext: boolean;
  isFullscreen: boolean;
  zoom?: number | undefined;
  zoomLabel?: string | undefined;
  previous: () => Promise<void>;
  next: () => Promise<void>;
  /** Jump to a 1-based page in the active preview. Returns false for non-paginated formats. */
  goToPage: (page: number) => boolean;
  command: (command: PreviewCommand) => void | boolean | undefined;
  canCommand: (command: PreviewCommand) => boolean;
  refreshCommandSupport: () => void;
  setZoom: (zoom?: number) => void;
  download: () => void;
  fullscreen: () => void;
  print: () => void;
  search: (query: string) => number;
  clearSearch: () => void;
}

export interface PreviewOptions {
  container: HTMLElement | string;
  file?: PreviewSource | undefined;
  files?: Array<PreviewSource | PreviewItem> | undefined;
  initialIndex?: number | undefined;
  /** Initial 1-based page for paginated previews. Out-of-range values are clamped. */
  initialPage?: number | undefined;
  fileName?: string | undefined;
  mimeType?: string | undefined;
  width?: number | string | undefined;
  height?: number | string | undefined;
  zoom?: number | undefined;
  fit?: PreviewFit | undefined;
  plugins?: PreviewPlugin[] | undefined;
  fallback?: PreviewFallback | undefined;
  messages?: Partial<PreviewMessages> | undefined;
  renderFallback?: ((ctx: PreviewContext) => Promise<PreviewInstance> | PreviewInstance) | undefined;
  toolbar?: boolean | PreviewToolbarOptions | undefined;
  className?: string | undefined;
  onLoad?: ((file: PreviewFile) => void) | undefined;
  onError?: ((error: Error, file?: PreviewFile) => void) | undefined;
  onUnsupported?: ((file: PreviewFile) => void) | undefined;
}

export interface PreviewMessages {
  [key: string]: string | undefined;
  loading: string;
  unsupportedTitle: string;
  downloadTitle: string;
  downloadFile: string;
  file: string;
  unnamedFile: string;
  format: string;
  unknown: string;
  mime: string;
  undeclared: string;
  size: string;
  source: string;
  remoteUrl: string;
  localFile: string;
  textPlainLanguage: string;
  textLineCount: string;
  textWrap: string;
  textCopy: string;
  textCopied: string;
  textCopyFailed: string;
  textDownload: string;
  textDownloadReady: string;
  textLargeFileNotice: string;
  textHighlightSkipped: string;
  textPreviewFailedTitle: string;
  textPreviewFailedMessage: string;
  textOpenOriginal: string;
  lrcPreviewMode: string;
  lrcDisplayMode: string;
  lrcAnnotatedMode: string;
  lrcSourceMode: string;
  lrcWordTimestamp: string;
  lrcMale: string;
  lrcFemale: string;
  lrcDuet: string;
  lrcAuthor: string;
  lrcLyricist: string;
  lrcLrcBy: string;
  lrcAlbum: string;
  lrcLength: string;
  lrcOffset: string;
  lrcTool: string;
  lrcVersion: string;
  lrcTrackInformation: string;
  lrcEmpty: string;
  officeLegacyConversionTitle: string;
  officeLegacyBinaryNotice: string;
  officeLegacyMetaFormatType: string;
  officeLegacyMetaFileStructure: string;
  officeLegacyOleDetected: string;
  officeLegacyOleMissing: string;
  officeLegacyMetaTextFragments: string;
  officeLegacyTextFragmentCount: string;
  officeLegacyMetaParseStatus: string;
  officeLegacyReadableFragments: string;
  officeLegacyNoText: string;
  officeLegacyWordParseFailed: string;
  officeSheetParseFailed: string;
  officeUnsupportedTitle: string;
  officeUnsupportedLegacyMessage: string;
  officeUnsupportedGenericMessage: string;
  officeUnsupportedIntro: string;
  officeUnsupportedSupportedFormats: string;
  officeErrorWithMessage: string;
  officeErrorWithoutMessage: string;
  officeConvertedTitle: string;
  officeConvertedPdfFailed: string;
  pdfEncryptedTitle: string;
  pdfEncryptedMessage: string;
  pdfPreviewFailedTitle: string;
  pdfCorruptedMessage: string;
  pdfCannotLoadMessage: string;
  pdfDownload: string;
  pdfPageLoading: string;
  pdfPageEmpty: string;
  pdfPageRenderFailed: string;
  pdfPreviousPage: string;
  pdfNextPage: string;
  pdfPageInput: string;
  pdfPagePosition: string;
  pdfPageLabel: string;
  pdfSummaryPages: string;
  pdfSummaryPageSizes: string;
  pdfSummaryFit: string;
  pdfSummaryActualSize: string;
  pdfSummaryFitWidth: string;
  pdfSummaryZoom: string;
  imagePreviewFailedTitle: string;
  imagePreviewFailedMessage: string;
  imageDownload: string;
  imageZoomOut: string;
  imageZoomIn: string;
  imageRotate: string;
  imageReset: string;
}

export interface PreviewContext {
  host: HTMLElement;
  viewport: HTMLElement;
  file: PreviewFile;
  size: PreviewSize;
  options: Omit<PreviewOptions, "messages"> & Required<Pick<PreviewOptions, "fit" | "fallback" | "zoom">> & {
    messages: PreviewMessages;
    /** Whether the caller explicitly selected a fit mode instead of using the viewer default. */
    fitWasProvided: boolean;
  };
  toolbar?: PreviewToolbarRenderContext | undefined;
  /** Aborted when this render is superseded or the viewer is destroyed. */
  signal?: AbortSignal | undefined;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | string) => void;
}

export interface PreviewInstance {
  resize?: ((size: PreviewSize) => void) | undefined;
  /** Jump to a 1-based page. Returns false when the rendered preview has no pages. */
  goToPage?: ((page: number) => boolean) | undefined;
  command?: ((command: PreviewCommand) => void | boolean) | undefined;
  canCommand?: ((command: PreviewCommand) => boolean) | undefined;
  /** Resolve once any lazily rendered content is ready to be captured for printing. */
  preparePrint?: (() => void | Promise<void>) | undefined;
  destroy: () => void;
}

export type PreviewCommand = "zoom-in" | "zoom-out" | "zoom-reset" | "rotate-right" | "rotate-left";

export interface PreviewPlugin {
  name: string;
  match: (file: PreviewFile) => boolean | Promise<boolean>;
  render: (ctx: PreviewContext) => Promise<PreviewInstance> | PreviewInstance;
}

export interface FileViewer {
  reload: (file?: PreviewSource) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  goTo: (index: number) => Promise<void>;
  /** Jump to a 1-based page in the active preview. */
  goToPage: (page: number) => boolean;
  getCurrentIndex: () => number;
  resize: () => void;
  destroy: () => void;
}
