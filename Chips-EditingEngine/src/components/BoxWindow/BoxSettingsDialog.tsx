import { InfoCircleOutlined, PictureOutlined } from '@ant-design/icons';
import { Flex, Input, Modal } from 'antd';
import { useEffect, useState } from 'react';
import type { BoxDocumentSessionSnapshot } from '../../services/box-document-service';
import { boxDocumentService } from '../../services/box-document-service';
import { workspaceService } from '../../services/workspace-service';
import { BasicInfoPanel } from '../CardSettings/panels/BasicInfoPanel';
import { CoverPanel, type CoverPanelDraft } from '../CardSettings/panels/CoverPanel';
import '../CardSettings/SettingsSidebar.css';
import '../CardSettings/CardSettingsDialog.css';
import './BoxSettingsDialog.css';

interface BoxSettingsDialogProps {
  boxId: string;
  visible: boolean;
  session: BoxDocumentSessionSnapshot | null;
  onClose: () => void;
  onSave: () => void;
}

type SettingsSectionId = 'basic' | 'cover';

const SETTINGS_SECTIONS = [
  { id: 'basic' as const, label: '基础信息', icon: <InfoCircleOutlined /> },
  { id: 'cover' as const, label: '封面', icon: <PictureOutlined /> },
];

export function BoxSettingsDialog({
  boxId,
  visible,
  session,
  onClose,
  onSave,
}: BoxSettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('basic');
  const [coverDraft, setCoverDraft] = useState<CoverPanelDraft | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setActiveSection('basic');
    setCoverDraft(null);
    setDescriptionDraft(session?.metadata.description ?? '');
  }, [session?.metadata.description, visible]);

  const isSaveDisabled = activeSection === 'cover' && Boolean(coverDraft?.dirty && !coverDraft.valid);

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
      width={860}
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="card-settings-dialog-root"
      footer={
        <Flex justify="flex-end" gap={12}>
          <button type="button" className="settings-dialog__secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="settings-dialog__primary-btn"
            onClick={() => { void handleSave(); }}
            disabled={isSaveDisabled}
          >
            保存
          </button>
        </Flex>
      }
    >
      <div className="card-settings-dialog__layout">
        <nav className="settings-sidebar" aria-label="设置分类">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`settings-sidebar__item ${activeSection === section.id ? 'settings-sidebar__item--active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="settings-sidebar__icon">{section.icon}</span>
              <span className="settings-sidebar__label">{section.label}</span>
            </button>
          ))}
        </nav>

        <div className="card-settings-dialog__main">
          {activeSection === 'basic' && (
            <div className="card-settings-dialog__panel">
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
          )}

          {activeSection === 'cover' && (
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
          )}
        </div>
      </div>
    </Modal>
  );
}
