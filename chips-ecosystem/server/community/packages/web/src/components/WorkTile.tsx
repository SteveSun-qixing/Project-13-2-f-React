/**
 * 作品磁贴（`components/` 作品磁贴，《14 设计》§7.3/§4.4）：
 * 个人主页作品混排的单个磁贴——卡片封面以独立封面入口（iframe 嵌入封面产物）承载，
 * 箱子封面以图片承载，封面缺失回退标题首字占位；管理模式切换为勾选按钮。
 */

import type { ReactNode } from 'react';

import { type CommunityWorkItem } from '../api/types';
import { getInitial, getWorkCoverStyle } from '../lib/format';
import { Link } from '../lib/router';
import './work-grid.css';

export interface WorkTileProps {
  item: CommunityWorkItem;
  manageMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (item: CommunityWorkItem) => void;
}

export function WorkTile({
  item,
  manageMode = false,
  selected = false,
  onToggleSelection,
}: WorkTileProps): ReactNode {
  const isCard = item.type === 'card';
  const typeLabel = isCard ? '卡片' : '箱子';
  const coverStyle = getWorkCoverStyle(item.coverRatio);

  const surface = (
    <div className="ccw-work-tile__surface">
      <div className="ccw-work-tile__cover">
        {item.coverUrl && isCard ? (
          <iframe
            className="ccw-work-tile__frame"
            src={item.coverUrl}
            title={item.title}
            loading="lazy"
            sandbox="allow-scripts"
            scrolling="no"
          />
        ) : item.coverUrl ? (
          <img
            className="ccw-work-tile__image"
            src={item.coverUrl}
            alt={item.title}
            loading="lazy"
          />
        ) : (
          <span className="ccw-work-tile__placeholder" aria-hidden="true">
            {getInitial(item.title)}
          </span>
        )}
      </div>
      {manageMode ? (
        <span
          className={`ccw-work-tile__badge${selected ? ' ccw-work-tile__badge--selected' : ''}`}
          aria-hidden="true"
        />
      ) : null}
      <span className="ccw-work-tile__title">{item.title}</span>
    </div>
  );

  if (manageMode) {
    return (
      <button
        type="button"
        className={`ccw-work-tile ccw-work-tile--manage${selected ? ' is-selected' : ''}`}
        style={coverStyle}
        onClick={() => onToggleSelection?.(item)}
        aria-pressed={selected}
        aria-label={`选择${typeLabel} ${item.title}`}
      >
        {surface}
      </button>
    );
  }

  return (
    <Link
      to={item.href}
      className="ccw-work-tile"
      style={coverStyle}
      aria-label={`${item.title} · ${typeLabel}`}
    >
      {surface}
    </Link>
  );
}
