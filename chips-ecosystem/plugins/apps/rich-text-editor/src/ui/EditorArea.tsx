import React from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Typography,
  theme,
} from '@chips/ui';
import type { IBaseCardEditor } from '@chips/sdk';
import { EditorMount } from './EditorMount';
import type { BoxSummary, CardEditorDraft, WorkspaceError } from './useEditorWorkspace';
import type { OpenedDocumentSummary } from '../domain/editor/documentGateway';

/**
 * 编辑区（编辑臂主体）：文档标题与编辑状态栏 + 插件正式编辑器挂载面 + 保存/放弃/导出臂。
 *
 * - 保存回执驱动保存态呈现（修订号 · 已保存摘要 / 有未保存变更，12 §6.3 规则 6 口径）；
 * - 写链失败（冲突/校验不过闸）行内简体中文如实呈现真实错误码，不吞错、不假成功；
 * - 放弃经确认对话框（未保存修改将丢失），以重挂载丢弃编辑面草稿（08 §4.3 规则 9）；
 * - 导出入口按 `document:export` 正式契约调用；宿主实现（第十三项）在途时如实呈现真实
 *   错误码与在途说明，不伪造成功（缺位已登记工单）。
 */

export interface EditorAreaProps {
  readonly selected: OpenedDocumentSummary | null;
  readonly cardDraft: CardEditorDraft | null;
  readonly boxDetail: BoxSummary | null;
  readonly revision: number;
  readonly dirty: boolean;
  readonly savedDigest: string | null;
  readonly writeError: WorkspaceError | null;
  readonly saveError: WorkspaceError | null;
  readonly exportError: WorkspaceError | null;
  readonly commitBusy: boolean;
  readonly saveBusy: boolean;
  readonly onAttachEditor: (editor: IBaseCardEditor) => void;
  readonly onDetachEditor: () => void;
  readonly onSaveNow: () => void;
  readonly onDiscard: () => void;
  readonly onExport: (form: 'archive' | 'directory', target: string) => void;
  readonly onRefresh: () => void;
}

/** 编辑状态栏文案（修订水位 + 保存态；保存回执驱动）。 */
function saveStateText(dirty: boolean, savedDigest: string | null): string {
  if (dirty) {
    return '有未保存变更';
  }
  return savedDigest === null ? '未保存' : `已保存（摘要 ${savedDigest}）`;
}

interface IExportFormValues {
  readonly form: 'archive' | 'directory';
  readonly target: string;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  selected,
  cardDraft,
  boxDetail,
  revision,
  dirty,
  savedDigest,
  writeError,
  saveError,
  exportError,
  commitBusy,
  saveBusy,
  onAttachEditor,
  onDetachEditor,
  onSaveNow,
  onDiscard,
  onExport,
  onRefresh,
}) => {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportForm] = Form.useForm<IExportFormValues>();

  const selectedId = selected?.documentId ?? null;

  const confirmDiscard = (): void => {
    if (!dirty) {
      return;
    }
    modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前编辑面的未保存修改将被丢弃，文档恢复为最近写入的内容。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: onDiscard,
    });
  };

  const submitExport = (): void => {
    void (async (): Promise<void> => {
      const values = await exportForm.validateFields();
      onExport(values.form, values.target);
      setExportOpen(false);
    })().catch((): void => undefined);
  };

  return (
    <Flex vertical style={{ height: '100%', minWidth: 0 }} gap={token.marginSM}>
      <Flex justify="space-between" align="center" gap={token.marginXS}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {selected === null ? '富文本编辑器' : selected.title}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            修订号 {String(revision)} · {saveStateText(dirty, savedDigest)}
          </Typography.Text>
        </Flex>
        <Flex gap={token.marginXS}>
          <Button onClick={onRefresh}>刷新</Button>
          <Button onClick={confirmDiscard} disabled={!dirty}>
            放弃修改
          </Button>
          <Button onClick={() => setExportOpen(true)} disabled={selectedId === null}>
            导出
          </Button>
          <Button
            type="primary"
            onClick={onSaveNow}
            disabled={selectedId === null}
            loading={saveBusy || commitBusy}
          >
            保存
          </Button>
        </Flex>
      </Flex>

      {writeError !== null ? (
        <Alert
          type="error"
          showIcon
          message={`写入未完成（${writeError.code}）`}
          description={writeError.message}
        />
      ) : null}
      {saveError !== null ? (
        <Alert
          type="error"
          showIcon
          message={`保存失败（${saveError.code}）`}
          description={`${saveError.message}：请重试保存；自动保存已暂停，等待处置。`}
        />
      ) : null}
      {exportError !== null ? (
        <Alert
          type="warning"
          showIcon
          message={`导出未完成（${exportError.code}）`}
          description={`${exportError.message}：document:export 宿主实现候第十三项收口（缺位在册），入口按正式契约接线。`}
        />
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: token.padding,
        }}
      >
        {selected === null ? (
          <Empty
            description="打开或新建一张富文本卡片开始编辑"
            style={{ marginTop: token.marginXXL }}
          />
        ) : boxDetail !== null ? (
          <Flex vertical gap={token.marginSM}>
            <Typography.Text strong>箱子只读摘要（卡箱浏览面）</Typography.Text>
            <Typography.Text>名称：{boxDetail.metadata.name}</Typography.Text>
            <Typography.Text>布局：{boxDetail.metadata.active_layout_type}</Typography.Text>
            <Typography.Text>条目数：{String(boxDetail.entries.length)}</Typography.Text>
            <Typography.Text type="secondary">
              本应用为单文档富文本编辑器：箱子提供浏览面，编辑入口归编辑引擎应用。
            </Typography.Text>
          </Flex>
        ) : cardDraft === null ? (
          <Empty description="文档装配中" />
        ) : (
          <EditorMount view={cardDraft.view} onAttach={onAttachEditor} onDetach={onDetachEditor} />
        )}
      </div>

      <Modal
        title="导出当前文档"
        open={exportOpen}
        okText="导出"
        cancelText="取消"
        onOk={submitExport}
        onCancel={() => setExportOpen(false)}
        destroyOnClose
      >
        <Form form={exportForm} layout="vertical" initialValues={{ form: 'archive' }}>
          <Form.Item
            label="导出形态"
            name="form"
            rules={[{ required: true, message: '请选择导出形态' }]}
          >
            <Select
              options={[
                { value: 'archive', label: '归档单文件（archive）' },
                { value: 'directory', label: '目录（directory）' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="导出目标路径"
            name="target"
            rules={[{ required: true, message: '请填写导出目标路径' }]}
          >
            <Input placeholder="例如 /导出/东京旅行日记.card" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
};
