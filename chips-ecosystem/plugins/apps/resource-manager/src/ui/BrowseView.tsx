import { useMemo, type FC } from 'react';
import {
  Alert,
  Badge,
  Button,
  Empty,
  Flex,
  FolderOpenOutlined,
  HomeOutlined,
  Input,
  List,
  Tag,
  Typography,
  theme,
} from '@chips/ui';
import {
  flattenTags,
  presentEntries,
  structureResourceCounts,
  type BrowsedDocumentSummary,
  type DocumentBrowseDetail,
} from '../domain/browse/entryModel';
import type { CommandRegistryPhase } from '../commands/useAppCommands';

/**
 * 资源管理器呈现面（§2.2 三栏结构的最小可用面，只读浏览臂）。
 *
 * 全部样式取 Design Tokens；`Tree` 属 @chips/ui 禁面组件不迁移，位置与条目呈现以
 * 白名单件（List + 分组标题）承担；文案简体中文直写。
 */

/** 左侧导航栏属性。 */
export interface NavigatorColumnProps {
  readonly records: readonly BrowsedDocumentSummary[];
  readonly selectedId: string | null;
  readonly phase: CommandRegistryPhase;
  readonly onSelect: (documentId: string) => void;
}

/**
 * 导航栏：快速访问（工作区根）+ 已打开位置。
 *
 * 目录树数据源（`filesystem:read:${workspace}` 域）宿主处理器缺位（工单036 后续段），
 * 工作区根以「未就绪」如实呈现，不伪造树形列表；位置清单只收录真实打开过的文档。
 */
export const NavigatorColumn: FC<NavigatorColumnProps> = ({ records, selectedId, phase, onSelect }) => {
  const { token } = theme.useToken();
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
        padding: token.padding,
        background: token.colorBgContainer,
        borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'auto',
      }}
    >
      <section>
        <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
          快速访问
        </Typography.Text>
        <Flex vertical gap={token.marginXS}>
          <Flex align="center" gap={token.marginXS}>
            <HomeOutlined style={{ color: token.colorTextSecondary }} />
            <Typography.Text type="secondary">工作区根</Typography.Text>
            <Tag>未就绪</Tag>
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            目录扫描通道（filesystem:read:&#36;&#123;workspace&#125; 域）候工单036 后续段落位
          </Typography.Text>
        </Flex>
      </section>
      <section style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
          <FolderOpenOutlined /> 已打开位置
        </Typography.Text>
        {records.length === 0 ? (
          <Empty description="尚未打开文档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={[...records]}
            renderItem={(item) => (
              <List.Item
                onClick={() => onSelect(item.documentId)}
                style={{
                  cursor: 'pointer',
                  paddingInline: token.paddingXS,
                  borderRadius: token.borderRadiusLG,
                  background: item.documentId === selectedId ? token.colorPrimaryBg : undefined,
                }}
              >
                <Typography.Text ellipsis style={{ maxWidth: '100%' }}>
                  {item.title}
                </Typography.Text>
                <Tag>{item.kind === 'box' ? '箱子' : '卡片'}</Tag>
              </List.Item>
            )}
          />
        )}
      </section>
      <Typography.Text type="secondary">命令注册状态：{phase === 'ready' ? '命令已就绪' : phase === 'registering' ? '命令注册中' : '命令通道异常'}</Typography.Text>
    </aside>
  );
};

/** 内容区属性。 */
export interface ContentColumnProps {
  readonly busy: boolean;
  readonly feedback: string | null;
  readonly statusFailed: boolean;
  readonly onOpen: (source: string) => void;
  readonly onRefresh: () => void;
  readonly summary: BrowsedDocumentSummary | null;
  readonly detail: DocumentBrowseDetail | null;
  readonly selectedEntryId: string | null;
  readonly onSelectEntry: (entryId: string) => void;
}

/**
 * 内容区：工具栏（来源输入 + 刷新）+ 条目视图。
 *
 * 视图模式（列表/网格/时间线，§四）随工作区扫描通道落位后逐档启用，本臂交付
 * 文档条目列表视图；条目呈现契约消费 `document:read` 类型化切片（resources:read 真实现）。
 */
export const ContentColumn: FC<ContentColumnProps> = ({
  busy,
  feedback,
  statusFailed,
  onOpen,
  onRefresh,
  summary,
  detail,
  selectedEntryId,
  onSelectEntry,
}) => {
  const { token } = theme.useToken();
  const entries = useMemo(() => (detail !== null && detail.kind === 'box' ? presentEntries(detail.entries) : []), [detail]);
  const counts = useMemo(() => (detail !== null && detail.kind === 'card' ? structureResourceCounts(detail.structure) : null), [detail]);

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: token.marginSM, padding: token.padding, background: token.colorBgContainer, overflow: 'auto' }}>
      <Flex gap={token.marginSM} align="center">
        <Input.Search
          placeholder="粘贴卡片或箱子来源引用（如工作区路径或 chips-resource:// 引用）"
          enterButton={busy ? '打开中…' : '打开'}
          disabled={busy}
          onSearch={(value) => onOpen(value)}
          style={{ maxWidth: 480 }}
          aria-label="文档来源引用输入"
        />
        <Button onClick={onRefresh}>刷新</Button>
      </Flex>
      {feedback !== null && statusFailed ? <Alert type="error" showIcon message={feedback} /> : null}
      {summary === null || detail === null ? (
        <Empty description="按来源引用打开卡片或箱子后在此呈现条目" style={{ marginTop: token.marginXL }} />
      ) : (
        <>
          <Flex align="center" gap={token.marginSM} wrap="wrap">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {detail.metadata.name}
            </Typography.Title>
            <Badge status="default" text={detail.kind === 'box' ? '箱子文档' : '卡片文档'} />
            <Typography.Text type="secondary" code>
              {summary.documentId}
            </Typography.Text>
          </Flex>
          {detail.kind === 'box' ? (
            entries.length === 0 ? (
              <Empty description="箱子暂无条目" />
            ) : (
              <List
                size="small"
                dataSource={[...entries]}
                renderItem={(entry) => (
                  <List.Item
                    onClick={() => onSelectEntry(entry.entryId)}
                    style={{
                      cursor: 'pointer',
                      paddingInline: token.paddingXS,
                      borderRadius: token.borderRadiusLG,
                      background: entry.entryId === selectedEntryId ? token.colorPrimaryBg : undefined,
                    }}
                  >
                    <Typography.Text ellipsis style={{ maxWidth: '45%' }}>
                      {entry.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" ellipsis style={{ maxWidth: '35%' }} code>
                      {entry.url}
                    </Typography.Text>
                    <Badge status={entry.enabled ? 'success' : 'default'} text={entry.enabled ? '启用' : '停用'} />
                  </List.Item>
                )}
              />
            )
          ) : (
            <Flex vertical gap={token.marginXS}>
              <Typography.Text>
                结构成员：{counts?.cardCount ?? 0} 个内容节点 · {counts?.resourceCount ?? 0} 项资源
              </Typography.Text>
              <List
                size="small"
                dataSource={[...detail.structure.structure]}
                renderItem={(member) => (
                  <List.Item>
                    <Typography.Text code>{member.id}</Typography.Text>
                    <Tag>{member.type}</Tag>
                  </List.Item>
                )}
              />
            </Flex>
          )}
        </>
      )}
    </main>
  );
};

/** 详情面板属性。 */
export interface DetailPanelProps {
  readonly detail: DocumentBrowseDetail | null;
  readonly selectedEntryId: string | null;
}

/**
 * 详情面板：选中条目或文档的属性呈现（§4.6 属性面；标签编辑属写臂候工单036 后续段）。
 */
export const DetailPanel: FC<DetailPanelProps> = ({ detail, selectedEntryId }) => {
  const { token } = theme.useToken();
  if (detail === null) {
    return (
      <aside style={{ width: 240, flexShrink: 0, padding: token.padding, background: token.colorBgContainer, borderInlineStart: `1px solid ${token.colorBorderSecondary}`, overflow: 'auto' }}>
        <Typography.Text type="secondary">选中条目后在此呈现属性</Typography.Text>
      </aside>
    );
  }
  const tags = flattenTags(detail.metadata.tags);
  const selectedEntry =
    detail.kind === 'box' && selectedEntryId !== null
      ? detail.entries.find((entry) => entry.entry_id === selectedEntryId) ?? null
      : null;

  return (
    <aside style={{ width: 240, flexShrink: 0, padding: token.padding, background: token.colorBgContainer, borderInlineStart: `1px solid ${token.colorBorderSecondary}`, overflow: 'auto' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
        详情
      </Typography.Text>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: token.marginXS, columnGap: token.margin }}>
        <dt><Typography.Text type="secondary">名称</Typography.Text></dt>
        <dd style={{ margin: 0 }}>{detail.metadata.name}</dd>
        <dt><Typography.Text type="secondary">修改时间</Typography.Text></dt>
        <dd style={{ margin: 0 }}>{detail.metadata.modified_at}</dd>
      </dl>
      {tags.length > 0 ? (
        <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap', marginTop: token.marginSM }}>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}
      {selectedEntry !== null ? (
        <dl style={{ margin: 0, marginTop: token.margin, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: token.marginXS, columnGap: token.margin }}>
          <dt><Typography.Text type="secondary">条目</Typography.Text></dt>
          <dd style={{ margin: 0 }}>{selectedEntry.entry_id}</dd>
          <dt><Typography.Text type="secondary">引用</Typography.Text></dt>
          <dd style={{ margin: 0, wordBreak: 'break-all' }}>{selectedEntry.url}</dd>
        </dl>
      ) : null}
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: token.margin }}>
        只读浏览臂：批量组织（重命名/移动/删除/批量标签）候 resource:write 注册（工单036 后续段）。
      </Typography.Text>
    </aside>
  );
};
