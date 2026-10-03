/**
 * 作品网格（`components/` 作品网格，《14 设计》§7.3）：
 * 个人主页作品区——卡片与箱子混排、创建时间倒序由数据侧保证；
 * 本人视角提供发布说明页入口与批量删除管理模式（删除编排由个人主页臂完成，
 * 网格只负责勾选态呈现与删除意图回调）。
 */

import type { ReactNode } from 'react';

import { getCommunityWorkSelectionKey, type CommunityWorkItem } from '../api/types';
import { Link } from '../lib/router';
import { WorkTile } from './WorkTile';
import './work-grid.css';

export interface WorkGridProps {
  items: CommunityWorkItem[];
  /** 本人访问时提供发布与管理入口（§7.3 本人专属入口）。 */
  isOwner?: boolean;
  manageMode?: boolean;
  selectedKeys?: ReadonlySet<string>;
  manageError?: string;
  isDeleting?: boolean;
  onToggleManageMode?: () => void;
  onToggleWorkSelection?: (item: CommunityWorkItem) => void;
  onDeleteSelectedWorks?: () => void;
}

export function WorkGrid({
  items,
  isOwner = false,
  manageMode = false,
  selectedKeys,
  manageError = '',
  isDeleting = false,
  onToggleManageMode,
  onToggleWorkSelection,
  onDeleteSelectedWorks,
}: WorkGridProps): ReactNode {
  const workCount = items.length;
  const selectedCount = selectedKeys?.size ?? 0;

  return (
    <section className="ccw-work-grid-section" aria-label="作品">
      <div className="ccw-work-grid-section__header">
        <h2>最近发布</h2>
        {isOwner ? (
          <div className="ccw-work-grid-section__actions">
            <Link
              to="/workspace"
              className="ccw-work-grid-section__publish"
              aria-label="进入工作区"
            >
              +
            </Link>
            <button
              type="button"
              className="ccw-button ccw-button--secondary"
              onClick={onToggleManageMode}
              disabled={isDeleting || workCount === 0}
            >
              {manageMode ? '完成管理' : '管理作品'}
            </button>
          </div>
        ) : null}
      </div>

      {isOwner && manageMode ? (
        <div className="ccw-work-manage-bar">
          <div className="ccw-work-manage-bar__copy">
            <strong>作品整理</strong>
            <p className="ccw-muted">卡片和箱子都支持勾选后批量删除。</p>
            {manageError.length > 0 ? (
              <p className="ccw-alert ccw-alert--error" role="alert">
                {manageError}
              </p>
            ) : null}
          </div>
          <div className="ccw-work-manage-bar__actions">
            <span className="ccw-work-manage-bar__count">已选择 {selectedCount} 个作品</span>
            <button
              type="button"
              className="ccw-button ccw-button--danger"
              onClick={onDeleteSelectedWorks}
              disabled={isDeleting || selectedCount === 0}
            >
              {isDeleting ? '正在删除…' : '删除所选作品'}
            </button>
          </div>
        </div>
      ) : null}

      {workCount > 0 ? (
        <div className="ccw-work-grid">
          {items.map((item) => {
            const selectionKey = getCommunityWorkSelectionKey(item);
            const tileProps = {
              key: selectionKey,
              item,
              manageMode,
              selected: selectedKeys?.has(selectionKey) ?? false,
              ...(onToggleWorkSelection ? { onToggleSelection: onToggleWorkSelection } : {}),
            };
            return <WorkTile {...tileProps} />;
          })}
        </div>
      ) : (
        <p className="ccw-work-grid__empty">这里还没有对外展示的内容。</p>
      )}
    </section>
  );
}
