import React from 'react';
import { Alert, Button, Flex, Form, Input, Modal, Tabs, Typography, theme } from '@chips/ui';
import type { OpenedDocumentSummary } from '../domain/editor/documentGateway';
import type { DocumentLibrary, WorkspaceError, WorkspaceStatus } from './useEditorWorkspace';

/**
 * 卡库 / 卡箱浏览面（08-产品与交互 01.04 口径的最小可用面）。
 *
 * - 「卡片 / 箱子」两标签页展示本会话已打开的文档（条目数随标签呈现），单击选中定位；
 * - 打开臂：来源引用输入（`chips-resource://` 受管引用或路径）经 `document:open` 正式面；
 * - 新建入口：`document:create` 正式契约调用（卡片固定富文本类型；宿主实现在途——缺位已
 *   登记工单，失败时如实呈现真实错误码，不伪造成功、不产生半成品）；
 * - 空态文案对齐 01.04 §4.4 形制（暂无条目 + 说明）。
 */

const EMPTY_TAB_ITEMS = {
  cards: { key: 'cards', label: '卡片' },
  boxes: { key: 'boxes', label: '箱子' },
} as const;

export interface LibraryPanelProps {
  readonly library: DocumentLibrary;
  readonly selectedId: string | null;
  readonly status: WorkspaceStatus;
  readonly feedback: string | null;
  readonly createError: WorkspaceError | null;
  readonly onSelect: (documentId: string) => void;
  readonly onOpenSource: (input: string) => void;
  readonly onCreateDocument: (kind: 'card' | 'box', name: string, parent: string) => void;
}

interface ICreateFormValues {
  readonly name: string;
  readonly parent: string;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  library,
  selectedId,
  status,
  feedback,
  createError,
  onSelect,
  onOpenSource,
  onCreateDocument,
}) => {
  const { token } = theme.useToken();
  const [sourceInput, setSourceInput] = React.useState('');
  const [createKind, setCreateKind] = React.useState<'card' | 'box' | null>(null);
  const [createForm] = Form.useForm<ICreateFormValues>();

  const submitOpen = (): void => {
    onOpenSource(sourceInput);
  };

  const submitCreate = (): void => {
    void (async (): Promise<void> => {
      const values = await createForm.validateFields();
      onCreateDocument(createKind ?? 'card', values.name ?? '', values.parent);
      setCreateKind(null);
      createForm.resetFields();
    })().catch((): void => undefined);
  };

  const renderEntries = (
    entries: readonly OpenedDocumentSummary[],
    emptyText: string
  ): React.ReactNode => {
    if (entries.length === 0) {
      return (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {emptyText}
        </Typography.Text>
      );
    }
    return (
      <Flex vertical gap={token.marginXXS}>
        {entries.map((entry) => {
          const active = entry.documentId === selectedId;
          return (
            <button
              key={entry.documentId}
              type="button"
              onClick={() => onSelect(entry.documentId)}
              style={{
                textAlign: 'start',
                cursor: 'pointer',
                border: 'none',
                borderRadius: token.borderRadiusSM,
                padding: `${token.paddingXXS}px ${token.paddingXS}px`,
                background: active ? token.colorPrimaryBg : 'transparent',
                color: token.colorText,
              }}
            >
              <Typography.Text
                strong={active}
                style={{ display: 'block', fontSize: token.fontSizeSM }}
              >
                {entry.title}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                {entry.kind === 'card' ? '卡片' : '箱子'} · {entry.documentId}
              </Typography.Text>
            </button>
          );
        })}
      </Flex>
    );
  };

  const tabItems = [
    {
      key: EMPTY_TAB_ITEMS.cards.key,
      label: `卡片（${String(library.cards.length)}）`,
      children: renderEntries(library.cards, '暂无卡片：打开或新建富文本卡片后显示'),
    },
    {
      key: EMPTY_TAB_ITEMS.boxes.key,
      label: `箱子（${String(library.boxes.length)}）`,
      children: renderEntries(library.boxes, '暂无箱子：打开箱子后显示'),
    },
  ];

  return (
    <Flex vertical gap={token.marginSM} style={{ height: '100%', minHeight: 0 }}>
      <Typography.Text strong>卡库 / 卡箱</Typography.Text>

      <Flex gap={token.marginXXS}>
        <Input
          value={sourceInput}
          placeholder="chips-resource:// 或路径"
          onChange={(event) => setSourceInput(event.target.value)}
          onPressEnter={submitOpen}
          size="small"
        />
        <Button size="small" type="primary" onClick={submitOpen} loading={status === 'opening'}>
          打开
        </Button>
      </Flex>

      <Flex gap={token.marginXXS}>
        <Button size="small" onClick={() => setCreateKind('card')}>
          新建卡片
        </Button>
        <Button size="small" onClick={() => setCreateKind('box')}>
          新建箱子
        </Button>
      </Flex>

      {createError !== null ? (
        <Alert
          type="warning"
          showIcon
          style={{ fontSize: token.fontSizeSM }}
          message={`新建未完成（${createError.code}）`}
          description={`${createError.message}：document:create 宿主实现在途（缺位在册），入口按正式契约接线。`}
        />
      ) : null}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Tabs defaultActiveKey="cards" items={tabItems} size="small" />
      </div>

      {feedback !== null && status !== 'error' ? (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {feedback}
        </Typography.Text>
      ) : null}
      {feedback !== null && status === 'error' ? (
        <Alert type="error" showIcon style={{ fontSize: token.fontSizeSM }} message={feedback} />
      ) : null}

      <Modal
        title={createKind === 'box' ? '新建箱子' : '新建富文本卡片'}
        open={createKind !== null}
        okText="创建"
        cancelText="取消"
        onOk={submitCreate}
        onCancel={() => setCreateKind(null)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="文档名称（缺省「未命名卡片/未命名箱子」）" name="name">
            <Input placeholder="例如 东京旅行日记" />
          </Form.Item>
          <Form.Item
            label="落点（父目录受管引用）"
            name="parent"
            rules={[{ required: true, message: '请填写落点（父目录受管引用）' }]}
          >
            <Input placeholder="例如 chips-resource://ws" />
          </Form.Item>
          {createKind === 'card' ? (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              卡片为固定复合结构：复合容器 + 一张富文本基础卡片（base.richtext）。
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Flex>
  );
};
