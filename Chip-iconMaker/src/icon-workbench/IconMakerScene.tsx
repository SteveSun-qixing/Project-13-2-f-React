import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox } from "antd";
import {
  DownOutlined,
  FontColorsOutlined,
  FontSizeOutlined,
  PictureOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { renderIconToCanvas } from "./canvas-renderer";
import {
  EMOJI_FONT_SOURCE,
  MATERIAL_SYMBOLS_FONT_SOURCE,
  createPrivateUseGlyphs,
  loadMaterialSymbolsFontSource,
} from "./default-fonts";
import { generateIconZip } from "./generator";
import { createSourceIconImage, isSupportedIconSource } from "./image-loader";
import {
  BACKGROUND_PRESETS,
  DEFAULT_ICON_SETTINGS,
  ICON_FORMATS,
  OUTPUT_SIZE_MARKS,
  type IconBackgroundSelection,
  type IconFontSource,
  type IconImageFitMode,
  type IconOutputFormat,
  type IconSourceMode,
  type IconWorkbenchSettings,
  type SourceIconImage,
} from "./types";

export interface IconMakerSceneProps {
  text(key: string, params?: Record<string, string | number>): string;
}

const FOREGROUND_SWATCHES = ["#000000", "#ffffff", "#0a84ff", "#34c759", "#ff9f0a", "#ff3b30"];
const CUSTOM_FONT_ID = "custom-font";

function backgroundCss(background: IconBackgroundSelection): string {
  if (background.kind === "gradient" && background.start !== background.end) {
    return `linear-gradient(135deg, ${background.start}, ${background.end})`;
  }
  return background.start;
}

function formatLabel(format: IconOutputFormat): string {
  return format.toUpperCase();
}

export function IconMakerScene({ text }: IconMakerSceneProps): React.ReactElement {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceMode, setSourceMode] = useState<IconSourceMode>("image");
  const [imageSource, setImageSource] = useState<SourceIconImage | null>(null);
  const [materialFontSource, setMaterialFontSource] = useState(MATERIAL_SYMBOLS_FONT_SOURCE);
  const [customFont, setCustomFont] = useState<IconFontSource | null>(null);
  const [activeFontId, setActiveFontId] = useState(MATERIAL_SYMBOLS_FONT_SOURCE.id);
  const [selectedGlyphId, setSelectedGlyphId] = useState(MATERIAL_SYMBOLS_FONT_SOURCE.glyphs[0]?.id ?? "");
  const [settings, setSettings] = useState<IconWorkbenchSettings>(DEFAULT_ICON_SETTINGS);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);

  const fontSources = useMemo(
    () => [materialFontSource, EMOJI_FONT_SOURCE, ...(customFont ? [customFont] : [])],
    [customFont, materialFontSource],
  );
  const activeFont = fontSources.find((font) => font.id === activeFontId) ?? materialFontSource;
  const selectedGlyph = activeFont.glyphs.find((glyph) => glyph.id === selectedGlyphId) ?? activeFont.glyphs[0] ?? null;
  const hasImageSource = Boolean(imageSource);
  const hasFontGlyph = Boolean(selectedGlyph);
  const hasFormats = settings.formats.length > 0;
  const canDownload = sourceMode === "image" ? hasImageSource && hasFormats : hasFontGlyph && hasFormats;
  const disabledMessageKey = !hasFormats
    ? "iconMaker.preview.disabledNoFormat"
    : sourceMode === "image" && !hasImageSource
      ? "iconMaker.preview.disabledNoImage"
      : sourceMode === "font" && !hasFontGlyph
        ? "iconMaker.preview.disabledNoGlyph"
        : null;

  useEffect(() => {
    return () => {
      if (imageSource) {
        URL.revokeObjectURL(imageSource.objectUrl);
      }
      if (customFont?.objectUrl) {
        URL.revokeObjectURL(customFont.objectUrl);
      }
    };
  }, [customFont, imageSource]);

  useEffect(() => {
    let cancelled = false;
    void loadMaterialSymbolsFontSource()
      .then((fontSource) => {
        if (!cancelled) {
          setMaterialFontSource(fontSource);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    void renderIconToCanvas(canvas, {
      size: settings.outputSize,
      settings,
      sourceMode,
      imageSource,
      fontSource: activeFont,
      selectedGlyph,
    }).catch(() => {
      if (!cancelled) {
        setFeedbackKey("iconMaker.feedback.previewFailed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeFont, imageSource, selectedGlyph, settings, sourceMode]);

  const loadImageFile = useCallback(async (file: File) => {
    if (!isSupportedIconSource(file)) {
      setFeedbackKey("iconMaker.feedback.unsupported");
      return;
    }

    const loaded = await createSourceIconImage(file);
    setImageSource((current) => {
      if (current) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return loaded;
    });
    setFeedbackKey("iconMaker.feedback.loaded");
  }, []);

  function updateSettings(partial: Partial<IconWorkbenchSettings>) {
    setSettings((current) => ({
      ...current,
      ...partial,
    }));
  }

  function selectBackground(background: IconBackgroundSelection) {
    updateSettings({ background });
  }

  function toggleFormat(format: IconOutputFormat, checked: boolean) {
    setSettings((current) => ({
      ...current,
      formats: checked
        ? Array.from(new Set([...current.formats, format]))
        : current.formats.filter((item) => item !== format),
    }));
  }

  function clearImage() {
    if (imageSource) {
      URL.revokeObjectURL(imageSource.objectUrl);
    }
    setImageSource(null);
    setFeedbackKey(null);
  }

  async function loadCustomFont(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const family = `IconMakerCustomFont-${Date.now()}`;
    const face = new FontFace(family, `url(${objectUrl})`);
    await face.load();
    document.fonts.add(face);

    if (customFont?.objectUrl) {
      URL.revokeObjectURL(customFont.objectUrl);
    }

    const nextFont: IconFontSource = {
      id: CUSTOM_FONT_ID,
      kind: "custom",
      name: file.name,
      family,
      glyphs: createPrivateUseGlyphs(72),
      objectUrl,
    };
    setCustomFont(nextFont);
    setActiveFontId(nextFont.id);
    setSelectedGlyphId(nextFont.glyphs[0]?.id ?? "");
    setSourceMode("font");
    setFeedbackKey("iconMaker.feedback.fontLoaded");
  }

  async function downloadZip() {
    if (!canDownload) {
      setFeedbackKey(disabledMessageKey);
      return;
    }

    setIsDownloading(true);
    setFeedbackKey("iconMaker.feedback.downloading");
    try {
      const zip = await generateIconZip({
        size: settings.outputSize,
        settings,
        sourceMode,
        imageSource,
        fontSource: activeFont,
        selectedGlyph,
      });
      const bytes = zip.bytes.slice();
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: zip.mimeType }));
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "icons.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
      setFeedbackKey("iconMaker.feedback.downloadStarted");
    } catch {
      setFeedbackKey("iconMaker.feedback.downloadFailed");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="icon-maker" aria-label={text("iconMaker.aria.scene")}>
      <div className="icon-maker__layout">
        <div className="icon-maker__controls">
          <section className="icon-maker__panel">
            <div className="icon-maker__panel-header icon-maker__panel-header--compact">
              <div role="heading" aria-level={2} className="icon-maker__panel-title">
                {text("iconMaker.basic.title")}
              </div>
            </div>

            <div className="icon-maker__source-toggle" role="tablist" aria-label={text("iconMaker.sourceMode.title")}>
              {(["image", "font"] as const).map((mode) => (
                <Button
                  key={mode}
                  type={sourceMode === mode ? "primary" : "default"}
                  role="tab"
                  aria-pressed={sourceMode === mode}
                  aria-selected={sourceMode === mode}
                  className={`icon-maker__source-button${sourceMode === mode ? " icon-maker__source-button--active" : ""}`}
                  onClick={() => setSourceMode(mode)}
                >
                  <span className="icon-maker__button-content">
                    {mode === "image" ? <PictureOutlined /> : <FontSizeOutlined />}
                    <span>{text(mode === "image" ? "iconMaker.sourceMode.image" : "iconMaker.sourceMode.font")}</span>
                  </span>
                </Button>
              ))}
            </div>

            {sourceMode === "image" ? (
              <div className="icon-maker__mode-body icon-maker__mode-body--image">
                <input
                  ref={imageInputRef}
                  className="icon-maker__hidden-input"
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) {
                      void loadImageFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  id="icon-maker-file-input-trigger"
                  type="button"
                  className={`icon-maker__dropzone${isDragging ? " icon-maker__dropzone--active" : ""}`}
                  onClick={() => imageInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const file = event.dataTransfer.files[0];
                    if (file) {
                      void loadImageFile(file);
                    }
                  }}
                >
                  {imageSource ? (
                    <span className="icon-maker__uploaded">
                      <img src={imageSource.objectUrl} alt={imageSource.fileName} />
                      <span className="icon-maker__uploaded-name">{imageSource.fileName}</span>
                    </span>
                  ) : (
                    <>
                      <UploadOutlined aria-hidden />
                      <span>{text("iconMaker.image.dropHint")}</span>
                    </>
                  )}
                </button>
                {imageSource ? (
                  <span className="icon-maker__secondary-action">
                    <Button type="default" onClick={clearImage}>
                      {text("iconMaker.actions.clear")}
                    </Button>
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="icon-maker__mode-body icon-maker__mode-body--font">
                <div className="icon-maker__font-tabs" role="radiogroup" aria-label={text("iconMaker.font.fontSource")}>
                  {fontSources.map((font) => (
                    <Button
                      key={font.id}
                      type={activeFont.id === font.id ? "primary" : "default"}
                      className={`icon-maker__font-tab${activeFont.id === font.id ? " icon-maker__font-tab--active" : ""}`}
                      onClick={() => {
                        setActiveFontId(font.id);
                        setSelectedGlyphId(font.glyphs[0]?.id ?? "");
                      }}
                    >
                      {font.name}
                    </Button>
                  ))}
                </div>
                <div className="icon-maker__muted">
                  {text("iconMaker.font.summary", {
                    name: activeFont.name,
                    count: activeFont.glyphs.length,
                  })}
                </div>
                <div className="icon-maker__glyph-grid" role="listbox" aria-label={text("iconMaker.font.glyphPanel")}>
                  {activeFont.glyphs.map((glyph) => (
                    <button
                      key={glyph.id}
                      type="button"
                      className={`icon-maker__glyph${selectedGlyph?.id === glyph.id ? " icon-maker__glyph--active" : ""}`}
                      style={{ fontFamily: activeFont.family }}
                      onClick={() => setSelectedGlyphId(glyph.id)}
                      title={glyph.codepoint ?? glyph.label}
                    >
                      {glyph.display}
                    </button>
                  ))}
                </div>
                <div className="icon-maker__color-row">
                  <span className="icon-maker__color-label">
                    {text("iconMaker.font.foreground")}
                  </span>
                  <div className="icon-maker__swatches" aria-label={text("iconMaker.font.commonColors")}>
                    {FOREGROUND_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`icon-maker__swatch${settings.foregroundColor === color ? " icon-maker__swatch--active" : ""}`}
                        style={{ background: color }}
                        aria-label={color}
                        aria-pressed={settings.foregroundColor === color}
                        onClick={() => updateSettings({ foregroundColor: color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sourceMode === "font" ? (
              <div className="icon-maker__field-group icon-maker__background-field">
                <div role="heading" aria-level={3} className="icon-maker__group-title">
                  {text("iconMaker.background.title")}
                </div>
                <div className="icon-maker__background-grid">
                  {BACKGROUND_PRESETS.map((background) => (
                    <button
                      key={background.id}
                      type="button"
                      className={`icon-maker__background-swatch${settings.background.id === background.id ? " icon-maker__background-swatch--active" : ""}`}
                      style={{ background: backgroundCss(background) }}
                      aria-label={text(background.labelKey)}
                      onClick={() => selectBackground(background)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="icon-maker__panel icon-maker__advanced">
            <button
              type="button"
              className="icon-maker__advanced-trigger"
              aria-expanded={isAdvancedOpen}
              onClick={() => setIsAdvancedOpen((open) => !open)}
            >
              <span>{text("iconMaker.advanced.title")}</span>
              <DownOutlined aria-hidden />
            </button>
            {isAdvancedOpen ? (
              <div className="icon-maker__advanced-body">
                <div className="icon-maker__field-group">
                  <div role="heading" aria-level={3} className="icon-maker__group-title">
                    {text("iconMaker.formats.title")}
                  </div>
                  <div className="icon-maker__format-row">
                    {ICON_FORMATS.map((format) => (
                      <Checkbox
                        key={format}
                        checked={settings.formats.includes(format)}
                        onChange={(event) => toggleFormat(format, event.target.checked)}
                      >
                        {text(`iconMaker.formats.${format}`, { format: formatLabel(format) })}
                      </Checkbox>
                    ))}
                  </div>
                  {!hasFormats ? <div className="icon-maker__hint">{text("iconMaker.formats.required")}</div> : null}
                </div>

                <div className="icon-maker__field-group">
                  <div role="heading" aria-level={3} className="icon-maker__group-title">
                    {text("iconMaker.size.title")}
                  </div>
                  <div className="icon-maker__size-presets" role="radiogroup" aria-label={text("iconMaker.size.title")}>
                    {OUTPUT_SIZE_MARKS.map((mark) => (
                      <button
                        key={mark}
                        type="button"
                        className={`icon-maker__size-preset${settings.outputSize === mark ? " icon-maker__size-preset--active" : ""}`}
                        aria-pressed={settings.outputSize === mark}
                        onClick={() => updateSettings({ outputSize: mark })}
                      >
                        {mark}{text("iconMaker.size.unit")}
                      </button>
                    ))}
                  </div>
                </div>

                {sourceMode === "image" ? (
                  <div className="icon-maker__field-group">
                    <div role="heading" aria-level={3} className="icon-maker__group-title">
                      {text("iconMaker.fit.title")}
                    </div>
                    <div className="icon-maker__fit-row">
                      {(["fit", "fill"] as IconImageFitMode[]).map((fit) => (
                        <button
                          key={fit}
                          type="button"
                          className={`icon-maker__fit-card${settings.imageFit === fit ? " icon-maker__fit-card--active" : ""}`}
                          onClick={() => updateSettings({ imageFit: fit })}
                        >
                          <strong>{text(fit === "fit" ? "iconMaker.fit.fitTitle" : "iconMaker.fit.fillTitle")}</strong>
                          <span>{text(fit === "fit" ? "iconMaker.fit.fitDescription" : "iconMaker.fit.fillDescription")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="icon-maker__field-group">
                    <div role="heading" aria-level={3} className="icon-maker__group-title">
                      {text("iconMaker.font.customFont")}
                    </div>
                    <input
                      ref={fontInputRef}
                      className="icon-maker__hidden-input"
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                          void loadCustomFont(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                    <span className="icon-maker__upload-font-action">
                      <Button type="default" onClick={() => fontInputRef.current?.click()}>
                        <span className="icon-maker__button-content">
                          <FontColorsOutlined aria-hidden />
                          <span>{text("iconMaker.font.upload")}</span>
                        </span>
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="icon-maker__preview-panel" aria-label={text("iconMaker.preview.title")}>
          <div className="icon-maker__preview-head">
            <div role="heading" aria-level={2} className="icon-maker__preview-title">
              {text("iconMaker.preview.title")}
            </div>
            <span className="icon-maker__preview-size">{text("iconMaker.preview.size", { size: settings.outputSize })}</span>
          </div>
          <div className="icon-maker__preview-shell">
            <canvas ref={previewCanvasRef} className="icon-maker__preview-canvas" aria-label={text("iconMaker.preview.canvas")} />
          </div>
          <span id="icon-maker-generate-action" className="icon-maker__download-anchor" tabIndex={-1}>
            <Button
              type="primary"
              disabled={!canDownload || isDownloading}
              loading={isDownloading}
              onClick={() => void downloadZip()}
              block
            >
              {text(isDownloading ? "iconMaker.actions.generating" : "iconMaker.actions.download")}
            </Button>
          </span>
          {disabledMessageKey ? <div className="icon-maker__hint">{text(disabledMessageKey)}</div> : null}
          {feedbackKey && !disabledMessageKey ? <div className="icon-maker__feedback">{text(feedbackKey)}</div> : null}
        </aside>
      </div>
    </section>
  );
}
