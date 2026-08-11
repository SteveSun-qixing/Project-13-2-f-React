import { Link } from 'react-router-dom';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { Icon } from '../runtime/icons/Icon';
import type { UploadQueueItem as UploadQueueItemModel } from '../types/community';

interface UploadQueueItemProps {
  item: UploadQueueItemModel;
  profileHref: string;
}

const statusIconMap = {
  queued: 'clock',
  uploading: 'upload',
  processing: 'sparkles',
  success: 'check',
  error: 'warning',
} as const;

const statusKeyMap = {
  queued: 'workspace.statusQueued',
  uploading: 'workspace.statusUploading',
  processing: 'workspace.statusProcessing',
  success: 'workspace.statusSuccess',
  error: 'workspace.statusError',
} as const;

export function UploadQueueItem({ item, profileHref }: UploadQueueItemProps) {
  const { t } = useAppPreferences();
  const safeProgress = Math.max(0, Math.min(100, item.progress));

  return (
    <article className={`panel upload-item upload-item--${item.status}`}>
      <div className="upload-item__top">
        <div className="upload-item__identity">
          <div className="upload-item__icon">
            <Icon name={item.type === 'card' ? 'card' : 'box'} />
          </div>

          <div className="upload-item__copy">
            <strong>{item.file.name}</strong>
            <span className="muted">{item.type === 'card' ? t('common.card') : t('common.box')}</span>
          </div>
        </div>

        <span className={`status-chip status-chip--${item.status}`}>
          <Icon name={statusIconMap[item.status]} size={14} />
          {t(statusKeyMap[item.status])}
        </span>
      </div>

      <div className="upload-item__progress">
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${safeProgress}%` }} />
        </div>
        <span>{safeProgress}%</span>
      </div>

      <p className="upload-item__detail" aria-live="polite">
        {item.errorMessage || item.detailMessage || '\u00A0'}
      </p>

      {(item.resultHref || item.status === 'success' || item.status === 'error') && (
        <div className="upload-item__actions">
          {item.resultHref ? (
            <Link to={item.resultHref} className="button button--secondary">
              <Icon name="arrow-up-right" size={16} />
              {t('workspace.resultOpen')}
            </Link>
          ) : null}

          <Link to={profileHref} className="button button--ghost">
            {t('workspace.resultProfile')}
          </Link>
        </div>
      )}
    </article>
  );
}
