import { useAppPreferences } from '../contexts/AppPreferencesContext';
import type { UploadQueueItem as UploadQueueItemModel } from '../types/community';
import { UploadQueueItem } from './UploadQueueItem';

interface UploadQueueProps {
  items: UploadQueueItemModel[];
  profileHref: string;
}

export function UploadQueue({ items, profileHref }: UploadQueueProps) {
  const { t } = useAppPreferences();

  return (
    <section className="workspace-queue">
      <div className="workspace-queue__header">
        <span className="eyebrow">{t('workspace.queueTitle')}</span>
        <h2>{t('workspace.queueTitle')}</h2>
      </div>

      {items.length > 0 ? (
        <div className="workspace-queue__list">
          {[...items].reverse().map((item) => (
            <UploadQueueItem key={item.localId} item={item} profileHref={profileHref} />
          ))}
        </div>
      ) : (
        <div className="panel empty-panel workspace-queue__empty">{t('workspace.queueEmpty')}</div>
      )}
    </section>
  );
}
