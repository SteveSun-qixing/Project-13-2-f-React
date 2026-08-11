import { useNavigate } from 'react-router-dom';
import { Alert, Button, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getCommunityWorkSelectionKey, type CommunityWorkItem } from '../types/community';
import { WorkTile } from './WorkTile';

interface WorkGridProps {
  items: CommunityWorkItem[];
  isOwner: boolean;
  manageMode: boolean;
  selectedWorkKeys: ReadonlySet<string>;
  manageError: string;
  isDeleting: boolean;
  onToggleManageMode: () => void;
  onToggleWorkSelection: (item: CommunityWorkItem) => void;
  onDeleteSelectedWorks: () => void;
}

export function WorkGrid({
  items,
  isOwner,
  manageMode,
  selectedWorkKeys,
  manageError,
  isDeleting,
  onToggleManageMode,
  onToggleWorkSelection,
  onDeleteSelectedWorks,
}: WorkGridProps) {
  const navigate = useNavigate();
  const workCount = items.length;

  return (
    <section className="works-section">
      <div className="works-section__header">
        <div>
          <h2>最近发布</h2>
        </div>

        {isOwner ? (
          <div className="works-section__actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label="进入工作区"
              onClick={() => navigate('/workspace')}
            />
            <Button
              type={manageMode ? 'primary' : 'default'}
              onClick={onToggleManageMode}
              disabled={isDeleting || workCount === 0}
            >
              {manageMode ? '完成管理' : '管理作品'}
            </Button>
          </div>
        ) : null}
      </div>

      {isOwner && manageMode ? (
        <div className="panel works-section__manage-bar">
          <div className="works-section__manage-copy">
            <strong>作品整理</strong>
            <p className="muted">卡片和箱子都支持勾选后批量删除。</p>
            {manageError ? <Alert type="error" message={manageError} showIcon /> : null}
          </div>

          <div className="works-section__manage-actions">
            <span className="works-section__manage-count">
              已选择 {selectedWorkKeys.size} 个作品
            </span>
            <Button
              type="default"
              danger
              onClick={onDeleteSelectedWorks}
              loading={isDeleting}
              disabled={selectedWorkKeys.size === 0}
            >
              {isDeleting ? '正在删除…' : '删除所选作品'}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="work-grid">
          {items.map((item) => (
            <WorkTile
              key={`${item.type}-${item.id}`}
              item={item}
              manageMode={manageMode}
              selected={selectedWorkKeys.has(getCommunityWorkSelectionKey(item))}
              onToggleSelection={onToggleWorkSelection}
            />
          ))}
        </div>
      ) : (
        <div className="works-section__empty">
          <Empty description="这里还没有对外展示的内容。" />
        </div>
      )}
    </section>
  );
}
