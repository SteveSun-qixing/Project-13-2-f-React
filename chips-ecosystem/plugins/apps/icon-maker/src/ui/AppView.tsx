import React from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Flex,
  Input,
  Radio,
  Segmented,
  Typography,
  theme,
  ChipsProvider,
  CommandProvider,
  FileImageOutlined,
  FontColorsOutlined,
  UploadOutlined,
} from '@chips/ui';
import { useAppCommands, COMMAND_PHASE_LABELS } from '../commands/useAppCommands';
import type { GenerateCommandPayload } from '../commands/appCommands';
import { APP_PLUGIN_ID } from '../commands/appCommands';
import {
  createPrivateUseGlyphs,
  EMOJI_FONT_SOURCE,
  MATERIAL_SYMBOLS_FONT_SOURCE,
  loadMaterialSymbolsFontSource,
  registerMaterialSymbolsFontFaces,
} from '../domain/default-fonts';
import { renderIconToCanvas } from '../domain/canvas-renderer';
import { generateIconFiles, generateIconZip } from '../domain/generator';
import { createSourceIconImage, isSupportedIconSource } from '../domain/image-loader';
import {
  BACKGROUND_PRESETS,
  DEFAULT_ICON_SETTINGS,
  ICON_FORMATS,
  OUTPUT_SIZE_MARKS,
  type IconBackgroundSelection,
  type IconFontSource,
  type IconGlyph,
  type IconImageFitMode,
  type IconOutputFormat,
  type IconSourceMode,
  type IconWorkbenchSettings,
  type RenderIconOptions,
  type SourceIconImage,
} from '../domain/types';
import { saveGeneratedIcons, type IconSaveResult } from '../export/iconSave';
import { loadImageSourceFromPath } from '../export/source-image';

const CUSTOM_FONT_ID = 'custom-font';

/** 前景色候选：固定常用色板（取色 GUI 候第十二项裁裁，未落地前不提供自由取色）。 */
const FOREGROUND_SWATCHES = ['#000000', '#ffffff', '#0a84ff', '#34c759', '#ff9f0a', '#ff3b30'];

function backgroundCss(background: IconBackgroundSelection): string {
  if (background.kind === 'gradient' && background.start !== background.end) {
    return `linear-gradient(135deg, ${background.start}, ${background.end})`;
  }
  return background.start;
}

/** 工作台状态聚合（渲染选项与可生成判定共用单一来源）。 */
interface WorkbenchState {
  readonly sourceMode: IconSourceMode;
  readonly imageSource: SourceIconImage | null;
  readonly fontSource: IconFontSource;
  readonly selectedGlyphId: string;
  readonly settings: IconWorkbenchSettings;
}

function resolveSelectedGlyph(state: WorkbenchState): IconGlyph | null {
  const glyphs = state.fontSource.glyphs;
  return glyphs.find((glyph) => glyph.id === state.selectedGlyphId) ?? glyphs[0] ?? null;
}

function toRenderOptions(state: WorkbenchState): RenderIconOptions {
  return {
    size: state.settings.outputSize,
    settings: state.settings,
    sourceMode: state.sourceMode,
    imageSource: state.imageSource,
    fontSource: state.fontSource,
    selectedGlyph: resolveSelectedGlyph(state),
  };
}

function resolveDisabledReason(state: WorkbenchState): string | null {
  if (state.settings.formats.length === 0) {
    return '请至少选择一种输出格式。';
  }
  if (state.sourceMode === 'image' && state.imageSource === null) {
    return '请先上传图片或切换到图标字体。';
  }
  if (state.sourceMode === 'font' && resolveSelectedGlyph(state) === null) {
    return '请先选择一个字体图标。';
  }
  return null;
}

/** 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。 */
const IconWorkbench: React.FC = (): React.ReactElement => {
  const { token } = theme.useToken();
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const fontInputRef = React.useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const [sourceMode, setSourceMode] = React.useState<IconSourceMode>('image');
  const [imageSource, setImageSource] = React.useState<SourceIconImage | null>(null);
  const [materialFontSource, setMaterialFontSource] = React.useState<IconFontSource>(MATERIAL_SYMBOLS_FONT_SOURCE);
  const [customFont, setCustomFont] = React.useState<IconFontSource | null>(null);
  const [activeFontId, setActiveFontId] = React.useState<string>(MATERIAL_SYMBOLS_FONT_SOURCE.id);
  const [selectedGlyphId, setSelectedGlyphId] = React.useState<string>(
    MATERIAL_SYMBOLS_FONT_SOURCE.glyphs[0]?.id ?? '',
  );
  const [settings, setSettings] = React.useState<IconWorkbenchSettings>(DEFAULT_ICON_SETTINGS);
  const [isDragging, setIsDragging] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [outputDir, setOutputDir] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const [exportResult, setExportResult] = React.useState<IconSaveResult | null>(null);

  const fontSources = React.useMemo(
    () => [materialFontSource, EMOJI_FONT_SOURCE, ...(customFont ? [customFont] : [])],
    [customFont, materialFontSource],
  );
  const fontSource = fontSources.find((font) => font.id === activeFontId) ?? materialFontSource;

  const state: WorkbenchState = React.useMemo(
    () => ({ sourceMode, imageSource, fontSource, selectedGlyphId, settings }),
    [sourceMode, imageSource, fontSource, selectedGlyphId, settings],
  );

  const disabledReason = resolveDisabledReason(state);
  const renderOptions = toRenderOptions(state);
  const optionsRef = React.useRef(renderOptions);
  optionsRef.current = renderOptions;
  const outputDirRef = React.useRef(outputDir);
  outputDirRef.current = outputDir;
  const exportingRef = React.useRef(exporting);
  exportingRef.current = exporting;

  React.useEffect(() => {
    return () => {
      if (imageSource) {
        URL.revokeObjectURL(imageSource.objectUrl);
      }
      if (customFont?.objectUrl) {
        URL.revokeObjectURL(customFont.objectUrl);
      }
    };
  }, [customFont, imageSource]);

  React.useEffect(() => {
    let cancelled = false;
    void loadMaterialSymbolsFontSource()
      .then((font) => {
        if (!cancelled) {
          setMaterialFontSource(font);
        }
      })
      .catch(() => undefined);
    void registerMaterialSymbolsFontFaces().then((registration) => {
      if (!cancelled && registration.failed.length > 0) {
        setFeedback({
          kind: 'info',
          text: `图标字体加载了 ${registration.registered.length} 套，以下字体不可用：${registration.failed.join('、')}。`,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    void renderIconToCanvas(canvas, renderOptions).catch(() => {
      if (!cancelled) {
        setFeedback({ kind: 'error', text: '预览生成失败。' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [renderOptions]);

  const updateSettings = (partial: Partial<IconWorkbenchSettings>): void => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  const toggleFormat = (format: IconOutputFormat, checked: boolean): void => {
    setSettings((current) => ({
      ...current,
      formats: checked
        ? Array.from(new Set([...current.formats, format]))
        : current.formats.filter((item) => item !== format),
    }));
  };

  const adoptImageSource = (loaded: SourceIconImage): void => {
    setImageSource((current) => {
      if (current) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return loaded;
    });
    setFeedback({ kind: 'success', text: '图片已载入，预览已更新。' });
  };

  const loadImageFile = async (file: File): Promise<void> => {
    if (!isSupportedIconSource(file)) {
      setFeedback({ kind: 'error', text: '这个文件格式暂不支持。' });
      return;
    }
    try {
      adoptImageSource(await createSourceIconImage(file));
    } catch {
      setFeedback({ kind: 'error', text: '图片解码失败。' });
    }
  };

  const clearImage = (): void => {
    if (imageSource) {
      URL.revokeObjectURL(imageSource.objectUrl);
    }
    setImageSource(null);
    setFeedback(null);
  };

  const loadCustomFont = async (file: File): Promise<void> => {
    const objectUrl = URL.createObjectURL(file);
    const family = `IconMakerCustomFont-${Date.now()}`;
    try {
      const face = new FontFace(family, `url(${objectUrl})`);
      await face.load();
      document.fonts.add(face);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setFeedback({ kind: 'error', text: '图标字体解码失败。' });
      return;
    }

    if (customFont?.objectUrl) {
      URL.revokeObjectURL(customFont.objectUrl);
    }

    const nextFont: IconFontSource = {
      id: CUSTOM_FONT_ID,
      kind: 'custom',
      name: file.name,
      family,
      glyphs: createPrivateUseGlyphs(72),
      objectUrl,
    };
    setCustomFont(nextFont);
    setActiveFontId(nextFont.id);
    setSelectedGlyphId(nextFont.glyphs[0]?.id ?? '');
    setSourceMode('font');
    setFeedback({ kind: 'success', text: '图标字体已载入。' });
  };

  /**
   * 生成执行入口：按钮与 `iconmaker:generate` 命令共用。
   * 渲染失败或落盘失败都以异常上抛（命令通道诚实上报），落盘结果同步写入界面状态。
   */
  const runGenerate = async (payload?: GenerateCommandPayload): Promise<void> => {
    if (exportingRef.current) {
      return;
    }
    const reason = resolveDisabledReason(state);
    if (reason !== null) {
      throw new Error(reason);
    }

    const directory = (payload?.outputDir ?? outputDirRef.current).trim();
    if (directory.length === 0) {
      throw new Error('请先填写输出目录。');
    }

    setFeedback(null);
    setExporting(true);
    try {
      if (payload?.source !== undefined && payload.source.length > 0) {
        adoptImageSource(await loadImageSourceFromPath(payload.source));
      }

      const options = optionsRef.current;
      const files = await generateIconFiles(options);
      const zip = await generateIconZip(options);
      const result = await saveGeneratedIcons([...files, zip], directory);
      setExportResult(result);
      if (result.status === 'failed') {
        throw new Error(result.errorCode ?? 'ICON_SAVE_FAILED');
      }
      setFeedback({ kind: 'success', text: result.message });
    } finally {
      setExporting(false);
    }
  };

  const runGenerateRef = React.useRef(runGenerate);
  runGenerateRef.current = runGenerate;
  const stableGenerate = React.useCallback(
    (payload?: GenerateCommandPayload): Promise<void> => runGenerateRef.current(payload),
    [],
  );

  const { phase, errorCode } = useAppCommands(stableGenerate);

  const glyphPanelStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: token.marginXXS,
    maxHeight: 220,
    overflowY: 'auto',
    padding: token.paddingXXS,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
  };

  return (
    <Flex vertical gap={token.marginSM} style={{ padding: token.padding, height: '100%', overflow: 'auto' }}>
      <Flex justify="space-between" align="center" gap={token.marginSM} wrap="wrap">
        <Typography.Title level={4} style={{ margin: 0 }}>
          图标工坊
        </Typography.Title>
        <Typography.Text type="secondary">
          命令通道：{COMMAND_PHASE_LABELS[phase]}
          {errorCode === null ? '' : `（${errorCode}）`}
        </Typography.Text>
      </Flex>

      <Flex gap={token.marginSM} align="flex-start" wrap="wrap" style={{ flex: 1 }}>
        <Flex vertical gap={token.marginSM} style={{ flex: 1, minWidth: 320 }}>
          <Card title="基础设置" size="small">
            <Flex vertical gap={token.marginSM}>
              <Segmented
                value={sourceMode}
                onChange={(value) => setSourceMode(value as IconSourceMode)}
                options={[
                  { label: '上传图片', value: 'image', icon: <FileImageOutlined /> },
                  { label: '图标字体', value: 'font', icon: <FontColorsOutlined /> },
                ]}
              />

              {sourceMode === 'image' ? (
                <Flex vertical gap={token.marginSM}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) {
                        void loadImageFile(file);
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                  <Button
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
                    style={{
                      height: 96,
                      borderStyle: isDragging ? 'solid' : 'dashed',
                      borderColor: isDragging ? token.colorPrimary : token.colorBorder,
                    }}
                  >
                    {imageSource ? (
                      <Typography.Text>{imageSource.fileName}（点击可更换）</Typography.Text>
                    ) : (
                      <span>
                        <UploadOutlined /> 拖拽或点击上传图片
                      </span>
                    )}
                  </Button>
                  {imageSource ? (
                    <Button onClick={clearImage}>清除图片</Button>
                  ) : null}
                </Flex>
              ) : (
                <Flex vertical gap={token.marginSM}>
                  <Segmented
                    value={fontSource.id}
                    onChange={(value) => {
                      const next = fontSources.find((font) => font.id === value);
                      if (next) {
                        setActiveFontId(next.id);
                        setSelectedGlyphId(next.glyphs[0]?.id ?? '');
                      }
                    }}
                    options={fontSources.map((font) => ({ label: font.name, value: font.id }))}
                  />
                  <Typography.Text type="secondary">
                    {fontSource.name}，{fontSource.glyphs.length} 个图标
                  </Typography.Text>
                  <div role="listbox" aria-label="图标选择面板" style={glyphPanelStyle}>
                    {fontSource.glyphs.map((glyph) => {
                      const active = resolveSelectedGlyph(state)?.id === glyph.id;
                      return (
                        <button
                          key={glyph.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          title={glyph.codepoint ?? glyph.label}
                          onClick={() => setSelectedGlyphId(glyph.id)}
                          style={{
                            fontFamily: fontSource.family,
                            minWidth: 32,
                            minHeight: 28,
                            fontSize: token.fontSizeLG,
                            cursor: 'pointer',
                            borderRadius: token.borderRadiusSM,
                            border: `1px solid ${active ? token.colorPrimary : token.colorBorder}`,
                            background: active ? token.colorPrimaryBg : token.colorBgContainer,
                            color: token.colorText,
                          }}
                        >
                          {glyph.display}
                        </button>
                      );
                    })}
                  </div>
                  <Flex align="center" gap={token.marginSM} wrap="wrap">
                    <Typography.Text>图标颜色</Typography.Text>
                    {FOREGROUND_SWATCHES.map((color) => (
                      <Button
                        key={color}
                        type={settings.foregroundColor === color ? 'primary' : 'default'}
                        onClick={() => updateSettings({ foregroundColor: color })}
                        aria-label={color}
                        style={{ background: color, width: 28, height: 28, padding: 0 }}
                      />
                    ))}
                  </Flex>
                  <Flex align="center" gap={token.marginSM} wrap="wrap">
                    <Typography.Text>背景颜色</Typography.Text>
                    {BACKGROUND_PRESETS.map((background) => (
                      <Button
                        key={background.id}
                        type={settings.background.id === background.id ? 'primary' : 'default'}
                        onClick={() => updateSettings({ background })}
                        aria-label={background.label}
                        title={background.label}
                        style={{ background: backgroundCss(background), width: 28, height: 28, padding: 0 }}
                      />
                    ))}
                  </Flex>
                </Flex>
              )}
            </Flex>
          </Card>

          <Card title="高级设置" size="small">
            <Flex vertical gap={token.marginSM}>
              <Collapse
                items={[
                  {
                    key: 'output',
                    label: '输出格式与尺寸',
                    children: (
                      <Flex vertical gap={token.marginSM}>
                        <Flex gap={token.marginSM} wrap="wrap">
                          {ICON_FORMATS.map((format) => (
                            <Checkbox
                              key={format}
                              checked={settings.formats.includes(format)}
                              onChange={(event) => toggleFormat(format, event.target.checked)}
                            >
                              {format.toUpperCase()}
                            </Checkbox>
                          ))}
                        </Flex>
                        {settings.formats.length === 0 ? (
                          <Typography.Text type="danger">至少选择一种输出格式。</Typography.Text>
                        ) : null}
                        <Segmented
                          value={settings.outputSize}
                          onChange={(value) => updateSettings({ outputSize: Number(value) })}
                          options={OUTPUT_SIZE_MARKS.map((mark) => ({ label: `${mark}px`, value: mark }))}
                        />
                        {sourceMode === 'image' ? (
                          <Radio.Group
                            value={settings.imageFit}
                            onChange={(event) => updateSettings({ imageFit: event.target.value as IconImageFitMode })}
                          >
                            <Radio value="fit">适应（等比例缩放，空白区域显示背景）</Radio>
                            <Radio value="fill">填充（等比例铺满画布并居中裁剪）</Radio>
                          </Radio.Group>
                        ) : (
                          <Flex vertical gap={token.marginXS}>
                            <Typography.Text>自定义图标字体</Typography.Text>
                            <input
                              ref={fontInputRef}
                              type="file"
                              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                              style={{ display: 'none' }}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                if (file) {
                                  void loadCustomFont(file);
                                }
                                event.currentTarget.value = '';
                              }}
                            />
                            <Button onClick={() => fontInputRef.current?.click()}>
                              <span>
                                <FontColorsOutlined /> 上传图标字体
                              </span>
                            </Button>
                          </Flex>
                        )}
                      </Flex>
                    ),
                  },
                ]}
              />
            </Flex>
          </Card>
        </Flex>

        <Card title="实时预览" size="small" style={{ width: 320 }}>
          <Flex vertical gap={token.marginSM}>
            <Flex justify="center" align="center" style={{ minHeight: 200 }}>
              <canvas
                ref={previewCanvasRef}
                aria-label="图标实时预览画布"
                style={{
                  width: settings.outputSize,
                  height: settings.outputSize,
                  maxWidth: '100%',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusLG,
                }}
              />
            </Flex>
            <Typography.Text type="secondary">
              {settings.outputSize} x {settings.outputSize}px
            </Typography.Text>
            <Input
              value={outputDir}
              placeholder="输出目录，例如 ~/Pictures/chips-icons"
              onChange={(event) => setOutputDir(event.target.value)}
            />
            <Button
              id="icon-workbench-generate"
              type="primary"
              block
              loading={exporting}
              disabled={disabledReason !== null || outputDir.trim().length === 0}
              title={disabledReason ?? undefined}
              onClick={() => {
                void runGenerate().catch(() => undefined);
              }}
            >
              {exporting ? '正在生成' : '生成并写入目录'}
            </Button>
            {disabledReason !== null ? <Typography.Text type="secondary">{disabledReason}</Typography.Text> : null}
            {exportResult !== null && exportResult.status === 'failed' ? (
              <Alert
                type="error"
                showIcon
                message="落盘未完成"
                description={`${exportResult.message}（错误码：${exportResult.errorCode}）${
                  exportResult.writtenPaths.length > 0
                    ? `已写入：${exportResult.writtenPaths.join('、')}`
                    : '尚未写入任何文件。'
                }`}
              />
            ) : null}
            {feedback !== null ? (
              <Alert type={feedback.kind} showIcon message={feedback.text} />
            ) : null}
          </Flex>
        </Card>
      </Flex>
    </Flex>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_PLUGIN_ID} surface="window">
    <CommandProvider>
      <IconWorkbench />
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
