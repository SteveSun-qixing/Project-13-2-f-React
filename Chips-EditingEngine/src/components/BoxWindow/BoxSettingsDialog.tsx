import { Button, Input, Modal, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import type { BoxDocumentSessionSnapshot } from '../../services/box-document-service';
import { boxDocumentService } from '../../services/box-document-service';
import { workspaceService } from '../../services/workspace-service';
import { BasicInfoPanel } from '../CardSettings/panels/BasicInfoPanel';
import { CoverPanel, type CoverPanelDraft } from '../CardSettings/panels/CoverPanel';
import { BoxExportPanel } from './BoxExportPanel';
import {
  DOCUMENT_SETTINGS_MODAL_CLASS_NAMES,
  DOCUMENT_SETTINGS_TABS_CLASS_NAMES,
} from '../CardSettings/document-settings-dialog-layout';
import '../CardSettings/CardSettingsDialog.css';
import './BoxSettingsDialog.css';

interface BoxSettingsDialogProps {
  boxId: string;
  visible: boolean;
  session: BoxDocumentSessionSnapshot | null;
  onClose: () => void;
  onSave: () => void;
}

export function BoxSettingsDialog({
  boxId,
  visible,
  session,
  onClose,
  onSave,
}: BoxSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [coverDraft, setCoverDraft] = useState<CoverPanelDraft | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setActiveTab('basic');
    setCoverDraft(null);
    setDescriptionDraft(session?.metadata.description ?? '');
  }, [session?.metadata.description, visible]);

  const isSaveDisabled = activeTab === 'cover' && Boolean(coverDraft?.dirty && !coverDraft.valid);

  const isOpen = visible && Boolean(session);

  const handleUpdateName = (name: string) => {
    boxDocumentService.updateMetadata(boxId, { name });
  };

  const handleUpdateTags = (tags: string[]) => {
    boxDocumentService.updateMetadata(boxId, { tags });
  };

  const handleDescriptionBlur = () => {
    boxDocumentService.updateMetadata(boxId, {
      description: descriptionDraft.trim() || undefined,
    });
  };

  const applyCoverDraft = async () => {
    if (coverDraft?.dirty && coverDraft.valid) {
      await boxDocumentService.updateCover(boxId, {
        html: coverDraft.html,
        ratio: coverDraft.ratio,
        resources: coverDraft.resources.map((resource) => ({
          path: resource.path,
          data: resource.data,
        })),
      });
    }
  };

  const handleSave = async () => {
    await applyCoverDraft();
    if (descriptionDraft !== (session?.metadata.description ?? '')) {
      handleDescriptionBlur();
    }
    await boxDocumentService.saveBox(boxId);
    await workspaceService.refresh();
    onSave();
  };

  return (
    <Modal
      open={isOpen}
      title="箱子设置"
      onCancel={onClose}
      width={960}
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="card-settings-dialog-root"
      classNames={DOCUMENT_SETTINGS_MODAL_CLASS_NAMES}
      footer={
        <div className="box-settings-dialog__footer">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => { void handleSave(); }}
            disabled={isSaveDisabled}
          >
            保存
          </Button>
        </div>
      }
    >
      <Tabs
        className="document-settings-dialog__tabs"
        classNames={DOCUMENT_SETTINGS_TABS_CLASS_NAMES}
        activeKey={activeTab}
        onChange={(value: string) => setActiveTab(value)}
        items={[
          {
            key: 'basic',
            label: '基础信息',
            children: (
              <div className="card-settings-dialog__panel">
                <div className="document-settings-dialog__form">
                  <BasicInfoPanel
                    cardId={boxId}
                    cardInfo={session ? { metadata: session.metadata } : undefined}
                    onUpdateName={handleUpdateName}
                    onUpdateTags={handleUpdateTags}
                    documentIdLabel="箱子ID"
                    nameLabel="箱子名称"
                    namePlaceholder="输入箱子名称"
                    tagsLabel="标签"
                    tagPlaceholder="输入标签名称"
                    addTagLabel="添加标签"
                    metadataLabel="元数据"
                    createdAtLabel="创建时间"
                    modifiedAtLabel="修改时间"
                  />

                  <div className="box-settings-dialog__field">
                    <label className="box-settings-dialog__label">
                      描述
                    </label>
                    <Input.TextArea
                      className="box-settings-dialog__textarea"
                      rows={4}
                      value={descriptionDraft}
                      placeholder="输入箱子描述"
                      onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
                      onBlur={handleDescriptionBlur}
                    />
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'cover',
            label: '封面',
            children: (
              <div className="card-settings-dialog__panel card-settings-dialog__panel--cover">
                <CoverPanel
                  cardId={session?.boxId ?? boxId}
                  cardPath={session?.workspaceDir ?? ''}
                  cardName={session?.metadata.name ?? ''}
                  packageDirectoryName=".box"
                  assetDirectoryName="boxcover"
                  currentCoverHtml={session?.coverHtml}
                  currentRatio={session?.metadata.coverRatio}
                  onDraftChange={setCoverDraft}
                />
              </div>
            ),
          },
          {
            key: 'export',
            label: '导出',
            children: (
              <div className="card-settings-dialog__panel">
                <div className="document-settings-dialog__content">
                  {session && (
                    <BoxExportPanel
                      boxId={boxId}
                      session={session}
                      onBeforeExport={applyCoverDraft}
                    />
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
