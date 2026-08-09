import React, { useState, useMemo, useEffect } from 'react';
import type { ModuleJobRecord, PlatformDialogSaveOptions } from 'chips-sdk';
import { formatMessage } from '../../../lib/messages';
import { useCard } from '../../../context/CardContext';
import { getChipsClient } from '../../../services/bridge-client';
import { fileService } from '../../../services/file-service';
import { ENGINE_ICONS } from '../../../icons/descriptors';
import { RuntimeIcon } from '../../../icons/RuntimeIcon';
import './ExportPanel.css';

interface ExportPanelProps {
  cardId: string;
  onBeforeExport?: () => void | Promise<void>;
}

type ExportFormat = 'card' | 'html' | 'pdf' | 'image';
type ConverterTargetType = Exclude<ExportFormat, 'card'>;
type FileConvertResultLike = {
  outputPath?: string;
};

const FILE_CONVERTER_CAPABILITY = 'converter.file.convert';
const CARD_TO_HTML_CAPABILITY = 'converter.card.to-html';
const HTML_TO_PDF_CAPABILITY = 'converter.html.to-pdf';
const HTML_TO_IMAGE_CAPABILITY = 'converter.html.to-image';
const FILE_CONVERTER_METHOD = 'convert';
const MODULE_JOB_POLL_INTERVAL_MS = 120;
const CONVERSION_PROGRESS_OFFSET = 20;
const CONVERSION_PROGRESS_SCALE = 0.8;

function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function getParentPath(filePath: string): string {
  const normalized = normalizePathForCompare(filePath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex < 0) {
    return '';
  }
  return lastSlashIndex === 0 ? '/' : normalized.slice(0, lastSlashIndex);
}

function stripCardExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith('.card')
    ? fileName.slice(0, -'.card'.length)
    : fileName;
}

function sanitizeExportFileName(fileName: string): string {
  return stripCardExtension(fileName)
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();
}

function ensureCardExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.card')
    ? filePath
    : `${filePath}.card`;
}

function ensureFileExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(extension.toLowerCase())
    ? filePath
    : `${filePath}${extension}`;
}

function buildDefaultExportPath(
  cardPath: string,
  cardName: string | undefined,
  cardId: string,
  extension: string,
): string {
  const parentPath = getParentPath(cardPath);
  const fallbackName = sanitizeExportFileName(cardName ?? '') || cardId || 'card-export';
  const defaultPath = `${parentPath}/${fallbackName}${extension}`;

  if (normalizePathForCompare(defaultPath) === normalizePathForCompare(cardPath)) {
    return `${parentPath}/${fallbackName}-export${extension}`;
  }

  return defaultPath;
}

function buildSaveDialogOptions(
  format: ExportFormat,
  cardPath: string,
  cardName: string | undefined,
  cardId: string,
): PlatformDialogSaveOptions {
  switch (format) {
    case 'card':
      return {
        title: formatMessage('card_settings.export_save_card'),
        defaultPath: buildDefaultExportPath(cardPath, cardName, cardId, '.card'),
      };
    case 'html':
      return {
        title: formatMessage('card_settings.export_save_html'),
        defaultPath: buildDefaultExportPath(cardPath, cardName, cardId, '.zip'),
      };
    case 'pdf':
      return {
        title: formatMessage('card_settings.export_save_pdf'),
        defaultPath: buildDefaultExportPath(cardPath, cardName, cardId, '.pdf'),
      };
    case 'image':
    default:
      return {
        title: formatMessage('card_settings.export_save_image'),
        defaultPath: buildDefaultExportPath(cardPath, cardName, cardId, '.png'),
      };
  }
}

function normalizeOutputPath(format: ExportFormat, outputPath: string): string {
  switch (format) {
    case 'card':
      return ensureCardExtension(outputPath);
    case 'html':
      return ensureFileExtension(outputPath, '.zip');
    case 'pdf':
      return ensureFileExtension(outputPath, '.pdf');
    case 'image':
    default:
      return ensureFileExtension(outputPath, '.png');
  }
}

function toConverterTargetType(format: ConverterTargetType): 'html' | 'pdf' | 'image' {
  return format;
}

function mapConversionProgress(percent: unknown): number {
  const numeric = typeof percent === 'number' && Number.isFinite(percent) ? percent : 0;
  const clamped = Math.max(0, Math.min(100, numeric));
  return Math.round(CONVERSION_PROGRESS_OFFSET + clamped * CONVERSION_PROGRESS_SCALE);
}

function resolveProgressMessage(
  stage: unknown,
  fallbackMessage: unknown,
): string {
  switch (stage) {
    case 'prepare':
      return formatMessage('card_settings.export_prepare');
    case 'render-html':
      return formatMessage('card_settings.export_render_html');
    case 'rewrite-assets':
      return formatMessage('card_settings.export_rewrite_assets');
    case 'write-output':
      return formatMessage('card_settings.export_write_output');
    case 'package-html':
      return formatMessage('card_settings.export_package_html');
    case 'render-pdf':
      return formatMessage('card_settings.export_render_pdf');
    case 'render-image':
      return formatMessage('card_settings.export_render_image');
    case 'cleanup':
      return formatMessage('card_settings.export_cleanup');
    case 'completed':
      return formatMessage('card_settings.export_done');
    default:
      return typeof fallbackMessage === 'string' && fallbackMessage.trim().length > 0
        ? fallbackMessage
        : formatMessage('card_settings.export_launch_conversion');
  }
}

function toJobError(job: ModuleJobRecord): Error {
  const error = new Error(
    job.error?.message
      || formatMessage('card_settings.export_unknown_error'),
  ) as Error & { code?: string };
  if (job.error?.code) {
    error.code = job.error.code;
  }
  return error;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForModuleJob(
  jobId: string,
  onProgress: (job: ModuleJobRecord) => void,
): Promise<FileConvertResultLike> {
  const client = getChipsClient();

  while (true) {
    const job = await client.module.job.get(jobId);
    onProgress(job);

    if (job.status === 'completed') {
      return (job.output ?? {}) as FileConvertResultLike;
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
      throw toJobError(job);
    }

    await sleep(MODULE_JOB_POLL_INTERVAL_MS);
  }
}

function normalizeExportError(error: unknown, fallbackMessage: string): { message: string; code?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      code: (error as Error & { code?: string }).code,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; code?: unknown; error?: unknown };
    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return {
        message: record.message,
        code: typeof record.code === 'string' ? record.code : undefined,
      };
    }
    if (typeof record.error === 'string' && record.error.trim().length > 0) {
      return {
        message: record.error,
        code: typeof record.code === 'string' ? record.code : undefined,
      };
    }
  }

  return { message: fallbackMessage };
}

export function ExportPanel({ cardId, onBeforeExport }: ExportPanelProps) {
  const { getCard, saveCard } = useCard();
  const locale = 'zh-CN';

  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [exportAvailability, setExportAvailability] = useState<Record<ExportFormat, boolean>>({
    card: true,
    html: false,
    pdf: false,
    image: false,
  });
  const card = getCard(cardId);

  // Reset status when cardId changes
  useEffect(() => {
    setExportProgress(0);
    setExportStatus('idle');
    setExportMessage('');
  }, [cardId]);

  useEffect(() => {
    let disposed = false;

    const checkAvailability = async () => {
      try {
        const client = getChipsClient();
        const [fileProviders, cardProviders, pdfProviders, imageProviders] = await Promise.all([
          client.module.listProviders({ capability: FILE_CONVERTER_CAPABILITY }),
          client.module.listProviders({ capability: CARD_TO_HTML_CAPABILITY }),
          client.module.listProviders({ capability: HTML_TO_PDF_CAPABILITY }),
          client.module.listProviders({ capability: HTML_TO_IMAGE_CAPABILITY }),
        ]);

        if (disposed) {
          return;
        }

        const hasEnabledProvider = (providers: Array<{ status?: string }>) =>
          providers.some((provider) => provider.status === 'enabled' || provider.status === 'running');

        const hasFileConverter = hasEnabledProvider(fileProviders);
        const hasCardToHtml = hasEnabledProvider(cardProviders);
        const hasHtmlToPdf = hasEnabledProvider(pdfProviders);
        const hasHtmlToImage = hasEnabledProvider(imageProviders);

        setExportAvailability({
          card: true,
          html: hasFileConverter && hasCardToHtml,
          pdf: hasFileConverter && hasCardToHtml && hasHtmlToPdf,
          image: hasFileConverter && hasCardToHtml && hasHtmlToImage,
        });
      } catch (error) {
        if (disposed) {
          return;
        }

        console.warn('[ExportPanel] Failed to resolve export provider availability.', error);
        setExportAvailability({
          card: true,
          html: false,
          pdf: false,
          image: false,
        });
      }
    };

    void checkAvailability();

    return () => {
      disposed = true;
    };
  }, []);

  const exportFormats = useMemo(() => [
    {
      key: 'card',
      icon: ENGINE_ICONS.box,
      label: formatMessage('card_settings.export_card'),
      desc: '.card',
      available: exportAvailability.card,
    },
    {
      key: 'html',
      icon: ENGINE_ICONS.html,
      label: formatMessage('card_settings.export_html'),
      desc: 'HTML ZIP',
      available: exportAvailability.html,
    },
    {
      key: 'pdf',
      icon: ENGINE_ICONS.pdf,
      label: formatMessage('card_settings.export_pdf'),
      desc: 'PDF',
      available: exportAvailability.pdf,
    },
    {
      key: 'image',
      icon: ENGINE_ICONS.image,
      label: formatMessage('card_settings.export_image'),
      desc: 'PNG',
      available: exportAvailability.image,
    },
  ], [exportAvailability]);

  const handleExport = async (format: ExportFormat) => {
    if (exportStatus === 'exporting') return;
    if (exportAvailability[format] === false) {
      setExportStatus('error');
      setExportProgress(0);
      setExportMessage(formatMessage('card_settings.export_unavailable'));
      return;
    }

    if (!card?.path) {
      setExportStatus('error');
      setExportMessage(formatMessage('card_settings.export_no_card'));
      return;
    }

    try {
      const client = getChipsClient();
      const outputPath = await client.platform.saveFile(
        buildSaveDialogOptions(format, card.path, card.metadata.name, cardId),
      );

      if (!outputPath) {
        setExportProgress(0);
        setExportStatus('idle');
        setExportMessage('');
        return;
      }

      setExportStatus('exporting');
      setExportProgress(0);
      setExportMessage(formatMessage('card_settings.export_start'));
      setExportProgress(10);
      await onBeforeExport?.();
      setExportMessage(formatMessage('card_settings.export_saving_card_state'));
      await saveCard(cardId);
      setExportProgress(format === 'card' ? 55 : CONVERSION_PROGRESS_OFFSET);

      const finalOutputPath = normalizeOutputPath(format, outputPath);
      let exportedPath = finalOutputPath;

      if (format === 'card') {
        setExportMessage(formatMessage('card_settings.export_create_package'));
        exportedPath = await client.card.pack(card.path, finalOutputPath);
        setExportProgress(90);
      } else {
        setExportMessage(formatMessage('card_settings.export_launch_conversion'));
        const started = await client.module.invoke({
          capability: FILE_CONVERTER_CAPABILITY,
          method: FILE_CONVERTER_METHOD,
          input: {
            source: {
              type: 'card',
              path: card.path,
            },
            target: {
              type: toConverterTargetType(format),
            },
            output: {
              path: finalOutputPath,
              overwrite: true,
            },
            options: {
              locale,
              ...(card.metadata.themeId ? { themeId: card.metadata.themeId } : {}),
              ...(format === 'html'
                ? {
                    html: {
                      packageMode: 'zip',
                      includeAssets: true,
                      includeManifest: true,
                    },
                  }
                : {}),
              ...(format === 'image'
                ? {
                    image: {
                      format: 'png',
                    },
                  }
                : {}),
            },
          },
        });

        const handleModuleProgress = (job: ModuleJobRecord) => {
          const progress = job.progress ?? {};
          setExportProgress(mapConversionProgress(progress.percent));
          setExportMessage(resolveProgressMessage(progress.stage, progress.message));
        };

        const result = started.mode === 'job'
          ? await waitForModuleJob(started.jobId, handleModuleProgress)
          : (started.output ?? {}) as FileConvertResultLike;

        exportedPath = typeof result.outputPath === 'string' && result.outputPath.trim().length > 0
          ? result.outputPath
          : finalOutputPath;
        setExportProgress(95);
      }

      setExportMessage(formatMessage('card_settings.export_verify_output'));

      const exportedFile = await fileService.stat(exportedPath);
      if (!exportedFile.isFile) {
        throw new Error(formatMessage('card_settings.export_output_missing'));
      }

      setExportProgress(100);
      setExportStatus('success');
      setExportMessage(
        formatMessage('card_settings.export_done_with_path', { path: exportedPath })
      );

    } catch (error) {
      console.error('[ExportPanel] Failed to export card.', {
        cardId,
        format,
        error,
      });
      const normalizedError = normalizeExportError(
        error,
        formatMessage('card_settings.export_unknown_error'),
      );
      setExportStatus('error');
      setExportProgress(0);
      setExportMessage(
        formatMessage('card_settings.export_failed', {
          error: normalizedError.message,
        })
      );
    }
  };

  return (
    <div className="export-panel">
      <div className="export-panel__field">
        <label className="export-panel__label">
          {formatMessage('card_settings.export_format')}
        </label>
        <div className="export-panel__grid">
          {exportFormats.map(fmt => (
            <button
              key={fmt.key}
              type="button"
              className="export-panel__format-card"
              data-testid={`export-format-${fmt.key}`}
              disabled={exportStatus === 'exporting' || fmt.available === false}
              title={fmt.available === false
                ? formatMessage('card_settings.export_unavailable')
                : undefined}
              onClick={() => handleExport(fmt.key as ExportFormat)}
            >
              <span className="export-panel__format-icon" aria-hidden="true">
                <RuntimeIcon icon={fmt.icon} />
              </span>
              <div className="export-panel__format-text">
                <span className="export-panel__format-title">{fmt.label}</span>
                <span className="export-panel__format-desc">{fmt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {exportStatus !== 'idle' && (
        <div className="export-panel__progress">
          <div className="export-panel__progress-bar-container">
            <div
              className={`export-panel__progress-bar ${exportStatus === 'error' ? 'export-panel__progress-bar--error' : ''}`}
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <p
            className={`export-panel__message ${
              exportStatus === 'success' ? 'export-panel__message--success' : ''
            } ${
              exportStatus === 'error' ? 'export-panel__message--error' : ''
            }`}
          >
            {exportMessage}
          </p>
        </div>
      )}
    </div>
  );
}
