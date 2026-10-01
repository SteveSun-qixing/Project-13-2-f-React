import { useMemo, type ReactElement } from 'react';
import { Badge, Button, Empty, Input, List, Tag, Typography, theme } from '@chips/ui';
import { entryDisplayName, flattenTags, type NoteDocumentDetail, type OpenedDocumentSummary } from '../domain/notes/model';
import type { NodeContentEntry } from './useNotesLibrary';

/** 左栏列表条目动作：选中库内文档。 */
export interface NotesListProps {
  readonly library: { notebooks: readonly OpenedDocumentSummary[]; notes: readonly OpenedDocumentSummary[] };
  readonly selectedId: string | null;
  readonly onSelect: (documentId: string) => void;
}

/**
 * 笔记列表：笔记本与笔记两个分区。
 *
 * 旧仓 `DirectoryTreePanel` 的 antd `Tree` 触禁件不迁移（候第十二项裁定）；
 * 本臂以分区 + 列表呈现组织关系（`.box` → 笔记本分区、`.card` → 笔记分区），
 * 树形嵌套呈现候裁后按在册替代件实现。
 */
export function NotesList({ library, selectedId, onSelect }: NotesListProps): ReactElement {
  const { token } = theme.useToken();
  const isEmpty = library.notebooks.length === 0 && library.notes.length === 0;

  const sections = useMemo(
    () => [
      { key: 'notebooks', title: '笔记本（箱子文档）', items: [...library.notebooks] },
      { key: 'notes', title: '笔记（卡片文档）', items: [...library.notes] },
    ],
    [library.notebooks, library.notes],
  );

  if (isEmpty) {
    return (
      <Empty
        description="笔记库为空：粘贴文档来源引用打开笔记本或笔记"
        style={{ padding: token.padding }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key}>
            <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
              {section.title}
            </Typography.Text>
            <List
              size="small"
              dataSource={section.items}
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
                  <Tag>{item.kind === 'box' ? '笔记本' : '笔记'}</Tag>
                </List.Item>
              )}
            />
          </section>
        ),
      )}
    </div>
  );
}

/** 打开臂输入区属性。 */
export interface OpenSourceBarProps {
  readonly onOpen: (source: string) => void;
  readonly busy: boolean;
}

/** 打开臂：来源引用输入 → `document:open` 正式面（工作区扫描通道缺位期的显式入口）。 */
export function OpenSourceBar({ onOpen, busy }: OpenSourceBarProps): ReactElement {
  return (
    <Input.Search
      placeholder="粘贴卡片或箱子来源引用（如工作区路径或 chips-resource:// 引用）"
      enterButton={busy ? '打开中…' : '打开'}
      disabled={busy}
      onSearch={(value) => onOpen(value)}
      style={{ maxWidth: 480 }}
      aria-label="文档来源引用输入"
    />
  );
}

/** 编辑区（只读消费骨架）属性。 */
export interface NoteEditorProps {
  readonly summary: OpenedDocumentSummary | null;
  readonly detail: NoteDocumentDetail | null;
  readonly nodeContents: ReadonlyMap<string, NodeContentEntry>;
  readonly onLoadNodeContent: (nodeId: string) => void;
}

/**
 * 编辑区骨架：选中笔记文档的元数据、标签与组织结构呈现。
 *
 * 本臂为只读消费：内容节点载荷按需读取后以结构化文本如实呈现（插件专有字段
 * 不做语义猜解）；就地编辑与保存属编辑链路臂（候 IEditSession 生产装载，
 * 工单036 波 C 终闸），本臂不接线、不伪造可编辑外观。
 */
export function NoteEditor({ summary, detail, nodeContents, onLoadNodeContent }: NoteEditorProps): ReactElement {
  const { token } = theme.useToken();

  if (summary === null || detail === null) {
    return (
      <Empty
        description="尚未选中笔记文档：从左侧列表选择，或粘贴来源引用打开"
        style={{ padding: token.padding }}
      />
    );
  }

  const tags = flattenTags(detail.metadata.tags);
  const nodeIds = detail.kind === 'card' ? detail.structure.structure.map((item) => item.id) : [];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {detail.metadata.name}
        </Typography.Title>
        <Badge status="default" text={summary.kind === 'box' ? '笔记本' : '笔记'} />
        <Typography.Text type="secondary" code>
          {summary.documentId}
        </Typography.Text>
      </header>

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: token.marginXS, columnGap: token.margin }}>
        <dt>
          <Typography.Text type="secondary">创建时间</Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>{detail.metadata.created_at}</dd>
        <dt>
          <Typography.Text type="secondary">修改时间</Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>{detail.metadata.modified_at}</dd>
        {detail.kind === 'box' && detail.metadata.description !== undefined ? (
          <>
            <dt>
              <Typography.Text type="secondary">描述</Typography.Text>
            </dt>
            <dd style={{ margin: 0 }}>{detail.metadata.description}</dd>
          </>
        ) : null}
        {detail.kind === 'box' && detail.metadata.active_layout_type !== undefined ? (
          <>
            <dt>
              <Typography.Text type="secondary">布局</Typography.Text>
            </dt>
            <dd style={{ margin: 0 }}>{detail.metadata.active_layout_type}</dd>
          </>
        ) : null}
      </dl>

      {tags.length > 0 ? (
        <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}

      {detail.kind === 'box' ? (
        <section>
          <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
            条目（{detail.entries.length} 项）
          </Typography.Text>
          {detail.entries.length === 0 ? (
            <Empty description="笔记本暂无条目" />
          ) : (
            <List
              size="small"
              dataSource={[...detail.entries]}
              renderItem={(entry) => (
                <List.Item>
                  <Typography.Text ellipsis style={{ maxWidth: '60%' }}>
                    {entryDisplayName(entry)}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: '30%' }} code>
                    {entry.entry_id}
                  </Typography.Text>
                  <Badge status={entry.enabled ? 'success' : 'default'} text={entry.enabled ? '启用' : '停用'} />
                </List.Item>
              )}
            />
          )}
        </section>
      ) : (
        <section>
          <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
            内容节点（{nodeIds.length} 个）
          </Typography.Text>
          {nodeIds.length === 0 ? (
            <Empty description="卡片暂无内容节点" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}>
              {nodeIds.map((nodeId) => {
                const cached = nodeContents.get(nodeId);
                return (
                  <div key={nodeId} style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, padding: token.paddingSM }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                      <Typography.Text code>{nodeId}</Typography.Text>
                      {cached === undefined ? (
                        <Button size="small" onClick={() => onLoadNodeContent(nodeId)}>
                          读取内容
                        </Button>
                      ) : (
                        <Badge
                          status={cached.errorCode === null ? 'success' : 'error'}
                          text={cached.errorCode === null ? '已读取' : `读取失败（${cached.errorCode}）`}
                        />
                      )}
                    </div>
                    {cached !== undefined && cached.errorCode === null ? (
                      <pre
                        style={{
                          margin: 0,
                          marginTop: token.marginSM,
                          padding: token.paddingSM,
                          background: token.colorFillQuaternary,
                          borderRadius: token.borderRadiusLG,
                          overflow: 'auto',
                          maxHeight: 240,
                          fontSize: token.fontSizeSM,
                        }}
                      >
                        {cached.display}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Typography.Text type="secondary">
        编辑区骨架（只读消费）：就地编辑与保存候平台编辑链路落位后在本区接线。
      </Typography.Text>
    </section>
  );
}
