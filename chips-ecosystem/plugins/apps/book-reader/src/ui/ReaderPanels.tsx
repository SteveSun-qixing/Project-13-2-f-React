import React from 'react';
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Empty,
  Flex,
  Input,
  List,
  Radio,
  Segmented,
  Select,
  Slider,
  Space,
  Spin,
  Tooltip,
  Typography,
  theme,
} from '@chips/ui';
import { DeleteOutlined, ExportOutlined, SearchOutlined } from '@chips/ui';
import type { EpubLink } from '../domain/epub/types';
import type { SearchResult, ExcerptSegments } from '../engine/search-engine';
import { splitExcerptIntoMatchSegments } from '../engine/search-engine';
import {
  READER_BACKGROUND_TONES,
  READER_READING_MODES,
  type ReaderBackgroundTone,
  type ReaderFontFamily,
  type ReaderPreferences,
  type ReaderReadingMode,
  type ReaderTextAlign,
  type ReaderWritingMode,
} from '../core/book-model';
import type { Bookmark } from './useBookmarks';
import type { ReadingPersistenceMode } from '../reading/config-client';

/** 面板抽屉统一宽度。 */
const PANEL_WIDTH = 360;

/** 持久化形态提示：config 域降级内存态时如实呈现，不伪造持久化成功。 */
export const PersistenceHint: React.FC<{ mode: ReadingPersistenceMode }> = ({ mode }) =>
  mode === 'config' ? null : (
    <Alert
      type="warning"
      showIcon
      role="alert"
      message="偏好暂存于内存（配置域未就绪），窗口关闭后不会保留"
    />
  );

const BACKGROUND_TONE_LABELS: Readonly<Record<ReaderBackgroundTone, string>> = {
  system: '跟随系统',
  theme: '纸白',
  warm: '暖白',
  mist: '雾蓝',
  night: '夜间',
};

const FONT_FAMILY_LABELS: Readonly<Record<ReaderFontFamily, string>> = {
  serif: '衬线',
  sans: '无衬线',
  round: '圆体',
  system: '系统',
};

const READING_MODE_LABELS: Readonly<Record<ReaderReadingMode, string>> = {
  paginated: '分页',
  scroll: '滚动',
};

const TEXT_ALIGN_LABELS: Readonly<Record<ReaderTextAlign, string>> = {
  justify: '两端对齐',
  left: '左对齐',
};

const WRITING_MODE_LABELS: Readonly<Record<ReaderWritingMode, string>> = {
  horizontal: '横排',
  vertical: '竖排',
};

function toSegmentedOptions<T extends string>(
  labels: Readonly<Record<T, string>>
): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

interface PanelDrawerProps {
  readonly title: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children?: React.ReactNode;
}

/** 侧栏面板统一抽屉壳。 */
export const PanelDrawer: React.FC<PanelDrawerProps> = ({ title, open, onClose, children }) => (
  <Drawer
    title={title}
    placement="right"
    width={PANEL_WIDTH}
    open={open}
    onClose={onClose}
    getContainer={false}
  >
    {children}
  </Drawer>
);

export interface ContentsPanelProps {
  readonly toc: readonly EpubLink[];
  readonly activeSectionPath: string | null;
  readonly onSelect: (sectionIndex: number, fragment?: string) => void;
  readonly sectionIndexByPath: ReadonlyMap<string, number>;
}

/** 目录树节点：目录链接携带章节索引时可点选跳转。 */
export const ContentsPanel: React.FC<ContentsPanelProps> = ({
  toc,
  activeSectionPath,
  onSelect,
  sectionIndexByPath,
}) => {
  const { token } = theme.useToken();

  const renderLink = (link: EpubLink): React.ReactNode => {
    const sectionIndex = sectionIndexByPath.get(link.path);
    const isActive = activeSectionPath === link.path;
    const label = (
      <span
        role="button"
        tabIndex={0}
        onClick={() => {
          if (typeof sectionIndex === 'number') {
            onSelect(sectionIndex, link.fragment);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && typeof sectionIndex === 'number') {
            onSelect(sectionIndex, link.fragment);
          }
        }}
        style={{
          color: isActive ? token.colorPrimary : token.colorText,
          fontWeight: isActive ? 600 : 400,
          cursor: typeof sectionIndex === 'number' ? 'pointer' : 'default',
          display: 'block',
          paddingInline: token.paddingXS,
          borderRadius: token.borderRadiusSM,
        }}
      >
        {link.title || link.path}
      </span>
    );
    const children = link.children.filter(
      (child) => typeof sectionIndexByPath.get(child.path) === 'number' || child.children.length > 0
    );
    return (
      <li key={`${link.path}#${link.fragment ?? ''}`}>
        {label}
        {children.length > 0 ? (
          <ul style={{ paddingInlineStart: token.marginSM }}>{children.map(renderLink)}</ul>
        ) : null}
      </li>
    );
  };

  if (toc.length === 0) {
    return <Empty description="本书没有目录信息" />;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, paddingInlineStart: 0 }}>{toc.map(renderLink)}</ul>
  );
};

// ─── 书签面板 ─────────────────────────────────────────────────

export interface BookmarksPanelProps {
  readonly bookmarks: readonly Bookmark[];
  readonly currentBookmarkId: string | null;
  readonly onJump: (bookmark: Bookmark) => void;
  readonly onRemove: (id: string) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  currentBookmarkId,
  onJump,
  onRemove,
}) => {
  if (bookmarks.length === 0) {
    return <Empty description="还没有书签，阅读时点击工具栏的书签按钮即可添加" />;
  }

  return (
    <List
      dataSource={[...bookmarks]}
      renderItem={(bookmark): React.ReactElement => (
        <List.Item
          style={{
            cursor: 'pointer',
            fontWeight: bookmark.id === currentBookmarkId ? 600 : 400,
          }}
          onClick={() => onJump(bookmark)}
          actions={[
            <Tooltip key="remove" title="移除此书签">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                aria-label={`移除书签：${bookmark.sectionTitle}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(bookmark.id);
                }}
              />
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            title={bookmark.sectionTitle}
            description={
              bookmark.excerpt
                ? bookmark.excerpt
                : new Date(bookmark.createdAt).toLocaleString('zh-CN')
            }
          />
        </List.Item>
      )}
    />
  );
};

// ─── 搜索面板 ─────────────────────────────────────────────────

export interface SearchPanelProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly isSearching: boolean;
  readonly progress: { readonly current: number; readonly total: number } | null;
  readonly results: readonly SearchResult[];
  readonly onSelectResult: (result: SearchResult) => void;
}

const MatchSegments: React.FC<{ excerpt: string; query: string }> = ({ excerpt, query }) => {
  const { token } = theme.useToken();
  const segments: ExcerptSegments = splitExcerptIntoMatchSegments(excerpt, query);
  if (!segments.match) {
    return <>{excerpt}</>;
  }
  return (
    <>
      {segments.before}
      <mark
        style={{
          background: token.colorWarningBg,
          color: 'inherit',
          borderRadius: token.borderRadiusSM,
        }}
      >
        {segments.match}
      </mark>
      {segments.after}
    </>
  );
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  onQueryChange,
  isSearching,
  progress,
  results,
  onSelectResult,
}) => {
  const { token } = theme.useToken();
  const statusLabel = isSearching
    ? `正在搜索：${progress?.current ?? 0}/${progress?.total ?? 0} 章`
    : query.trim()
      ? `共 ${results.length} 处匹配`
      : '输入关键词搜索全书文本';

  return (
    <Flex vertical gap={token.marginSM}>
      <Input
        value={query}
        placeholder="搜索全书文本"
        allowClear
        prefix={<SearchOutlined />}
        aria-label="搜索全书文本"
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <Typography.Text type="secondary">{statusLabel}</Typography.Text>
      {isSearching ? <Spin /> : null}
      {results.length > 0 ? (
        <List
          size="small"
          dataSource={[...results]}
          renderItem={(result): React.ReactElement => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => onSelectResult(result)}>
              <List.Item.Meta
                title={result.sectionTitle}
                description={<MatchSegments excerpt={result.excerpt} query={result.query} />}
              />
            </List.Item>
          )}
        />
      ) : null}
    </Flex>
  );
};

// ─── 偏好面板 ─────────────────────────────────────────────────

export interface PreferencesPanelProps {
  readonly preferences: ReaderPreferences;
  readonly persistenceMode: ReadingPersistenceMode;
  readonly onChange: (patch: Partial<ReaderPreferences>) => void;
  readonly onReset: () => void;
}

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  preferences,
  persistenceMode,
  onChange,
  onReset,
}) => {
  const { token } = theme.useToken();

  const sliderRow = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onCommit: (value: number) => void
  ): React.ReactElement => (
    <>
      <Typography.Text>{label}</Typography.Text>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        tooltip={{ formatter: (input): string => `${input}` }}
        onChange={(input): void => onCommit(input)}
      />
    </>
  );

  return (
    <Flex vertical gap={token.marginSM}>
      <PersistenceHint mode={persistenceMode} />
      <div>
        <Typography.Text>阅读模式</Typography.Text>
        <Segmented
          value={preferences.readingMode}
          options={toSegmentedOptions(READING_MODE_LABELS)}
          onChange={(value): void => onChange({ readingMode: value })}
        />
      </div>
      <div>
        <Typography.Text>背景配色</Typography.Text>
        <Radio.Group
          value={preferences.backgroundTone}
          options={toSegmentedOptions(BACKGROUND_TONE_LABELS).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(event): void =>
            onChange({ backgroundTone: event.target.value as ReaderBackgroundTone })
          }
        />
      </div>
      <div>
        <Typography.Text>字体</Typography.Text>
        <Select
          value={preferences.fontFamily}
          options={toSegmentedOptions(FONT_FAMILY_LABELS).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(value): void => onChange({ fontFamily: value })}
        />
      </div>
      {sliderRow('字号', preferences.fontScale, 0.85, 1.4, 0.05, (value) =>
        onChange({ fontScale: value })
      )}
      {sliderRow('行距', preferences.lineHeight ?? 1.65, 1.4, 2, 0.05, (value) =>
        onChange({ lineHeight: value })
      )}
      {sliderRow('字距', preferences.letterSpacing ?? 0.01, 0, 0.06, 0.01, (value) =>
        onChange({ letterSpacing: value })
      )}
      {sliderRow('亮度', preferences.brightness ?? 1, 0.6, 1, 0.05, (value) =>
        onChange({ brightness: value })
      )}
      {sliderRow('版心宽度', preferences.contentWidth, 560, 980, 20, (value) =>
        onChange({ contentWidth: value })
      )}
      <div>
        <Typography.Text>对齐方式</Typography.Text>
        <Radio.Group
          value={preferences.textAlign ?? 'justify'}
          options={toSegmentedOptions(TEXT_ALIGN_LABELS).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(event): void => onChange({ textAlign: event.target.value as ReaderTextAlign })}
        />
      </div>
      <div>
        <Typography.Text>书写方向</Typography.Text>
        <Radio.Group
          value={preferences.writingMode ?? 'horizontal'}
          options={toSegmentedOptions(WRITING_MODE_LABELS).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(event): void =>
            onChange({ writingMode: event.target.value as ReaderWritingMode })
          }
        />
      </div>
      <Divider style={{ margin: 0 }} />
      <Space>
        <Button onClick={onReset}>恢复默认</Button>
      </Space>
    </Flex>
  );
};

// ─── 来源面板（打开臂） ────────────────────────────────────────

export interface SourcePanelProps {
  readonly uriInput: string;
  readonly onUriInputChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly submitting: boolean;
  readonly failureMessage: string | null;
  readonly persistenceMode: ReadingPersistenceMode;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  uriInput,
  onUriInputChange,
  onSubmit,
  submitting,
  failureMessage,
  persistenceMode,
}) => {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.marginSM}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        粘贴一个书籍资源的 chips-resource://
        受管引用，经平台资源打开路由发起阅读。宿主资源路由未就绪时会在此如实提示。
      </Typography.Paragraph>
      <Input
        value={uriInput}
        placeholder="chips-resource://…"
        aria-label="书籍资源受管引用"
        onChange={(event) => onUriInputChange(event.target.value)}
        onPressEnter={onSubmit}
      />
      <Space>
        <Button type="primary" loading={submitting} disabled={!uriInput.trim()} onClick={onSubmit}>
          通过资源路由打开
        </Button>
      </Space>
      {failureMessage === null ? null : (
        <Alert type="error" showIcon role="alert" message={failureMessage} />
      )}
      <Divider style={{ margin: 0 }} />
      <PersistenceHint mode={persistenceMode} />
    </Flex>
  );
};

/** 外部链接图标（导出链接提示用）。 */
export const ExternalLinkIcon: React.FC = () => <ExportOutlined />;

export const PANEL_TITLES = {
  contents: '目录',
  bookmarks: '书签',
  search: '搜索',
  preferences: '阅读偏好',
  source: '打开书籍',
} as const;

export type PanelTitleKey = keyof typeof PANEL_TITLES;

/** 供测试与空态复用的面板集合枚举。 */
export const KNOWN_BACKGROUND_TONES: readonly ReaderBackgroundTone[] = READER_BACKGROUND_TONES;
export const KNOWN_READING_MODES: readonly ReaderReadingMode[] = READER_READING_MODES;
