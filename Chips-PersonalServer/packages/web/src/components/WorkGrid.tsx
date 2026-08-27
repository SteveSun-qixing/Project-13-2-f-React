import { Empty } from 'antd';
import type { CommunityWorkItem } from '../types/community';
import { WorkTile } from './WorkTile';

interface WorkGridProps {
  items: CommunityWorkItem[];
}

export function WorkGrid({ items }: WorkGridProps) {
  return (
    <section className="works-section">
      <div className="works-section__header">
        <div>
          <h2>作品</h2>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="work-grid">
          {items.map((item) => (
            <WorkTile key={`${item.type}-${item.id}`} item={item} />
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
