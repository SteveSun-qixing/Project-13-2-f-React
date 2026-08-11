import { useState } from 'react';
import { formatMessage } from '../../lib/messages';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import { boxDocumentService, type BoxDocumentSessionSnapshot } from '../../services/box-document-service';
import { getChipsClient } from '../../services/bridge-client';
import { fileService } from '../../services/file-service';
import { buildDefaultExportPath, ensureFileExtension } from '../CardSettings/panels/export-utils';
import '../CardSettings/panels/ExportPanel.css';

interface BoxExportPanelProps {
  boxId: string;
  session: BoxDocumentSessionSnapshot;
  onBeforeExport?: () => void | Promise<void>;
}

type BoxExportStatus = 'idle' | 'exporting' | 'success' | 'error';

function normalizeExportError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim().length > 0) {
      return record.error;
    }
  }

  return fallbackMessage;
}

export function BoxExportPanel({ boxId, session, onBeforeExport }: BoxExportPanelProps) {
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<BoxExportStatus>('idle');
  const [exportMessage, setExportMessage] = useState('');

  const handleExport = async () => {
    if (exportStatus === 'exporting') {
      return;
    }

    try {
      const client = getChipsClient();
      const outputPath = await client.platform.saveFile({
        title: formatMessage('box_settings.export_save_box'),
        defaultPath: buildDefaultExportPath({
          sourcePath: session.boxFile,
          displayName: session.metadata.name,
          fallbackName: session.boxId || 'box-export',
          sourceExtension: '.box',
          targetExtension: '.box',
        }),
      });

      if (!outputPath) {
        setExportProgress(0);
        setExportStatus('idle');
        setExportMessage('');
        return;
      }

      setExportStatus('exporting');
      setExportProgress(10);
      setExportMessage(formatMessage('box_settings.export_start'));
      await onBeforeExport?.();
      setExportMessage(formatMessage('box_settings.export_saving_box_state'));
      await boxDocumentService.saveBox(boxId);
      setExportProgress(55);

      const finalOutputPath = ensureFileExtension(outputPath, '.box');
      setExportMessage(formatMessage('box_settings.export_create_package'));
      const exportedPath = await client.box.pack(session.workspaceDir, {
        outputPath: finalOutputPath,
      });
      setExportProgress(90);

      setExportMessage(formatMessage('box_settings.export_verify_output'));
      const exportedFile = await fileService.stat(exportedPath);
      if (!exportedFile.isFile) {
        throw new Error(formatMessage('box_settings.export_output_missing'));
      }

      setExportProgress(100);
      setExportStatus('success');
      setExportMessage(
        formatMessage('box_settings.export_done_with_path', { path: exportedPath })
      );
    } catch (error) {
      console.error('[BoxExportPanel] Failed to export box.', {
        boxId,
        error,
      });
      setExportStatus('error');
      setExportProgress(0);
      setExportMessage(
        formatMessage('box_settings.export_failed', {
          error: normalizeExportError(error, formatMessage('box_settings.export_unknown_error')),
        })
      );
    }
  };

  return (
    <div className="export-panel">
      <div className="export-panel__field">
        <label className="export-panel__label">
          {formatMessage('box_settings.export_format')}
        </label>
        <div className="export-panel__grid">
          <button
            type="button"
            className="export-panel__format-card"
            data-testid="box-export-format-box"
            disabled={exportStatus === 'exporting'}
            onClick={() => { void handleExport(); }}
          >
            <span className="export-panel__format-icon" aria-hidden="true">
              <RuntimeIcon icon={ENGINE_ICONS.box} />
            </span>
            <div className="export-panel__format-text">
              <span className="export-panel__format-title">
                {formatMessage('box_settings.export_box')}
              </span>
              <span className="export-panel__format-desc">.box</span>
            </div>
          </button>
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
