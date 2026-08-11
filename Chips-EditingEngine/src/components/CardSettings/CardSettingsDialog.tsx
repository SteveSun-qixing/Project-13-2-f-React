import { ExportOutlined, InfoCircleOutlined, PictureOutlined } from '@ant-design/icons';
import { Flex, Modal } from 'antd';
import { useEffect, useState } from 'react';
import { useCard } from '../../context/CardContext';
import { BasicInfoPanel } from './panels/BasicInfoPanel';
import { CoverPanel, type CoverPanelDraft } from './panels/CoverPanel';
import { ExportPanel } from './panels/ExportPanel';
import './SettingsSidebar.css';
import './CardSettingsDialog.css';

interface CardSettingsDialogProps {
  cardId: string;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

type SettingsSectionId = 'basic' | 'cover' | 'export';

const SETTINGS_SECTIONS = [
  { id: 'basic' as const, label: '基础信息', icon: <InfoCircleOutlined /> },
  { id: 'cover' as const, label: '封面', icon: <PictureOutlined /> },
  { id: 'export' as const, label: '导出', icon: <ExportOutlined /> },
];

export function CardSettingsDialog({
  cardId,
  visible,
  onClose,
  onSave,
}: CardSettingsDialogProps) {
  const { getCard, saveCard, updateCardMetadata, updateCardCover } = useCard();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('basic');
  const [coverDraft, setCoverDraft] = useState<CoverPanelDraft | null>(null);

  const card = getCard(cardId);

  useEffect(() => {
    if (visible) {
      setActiveSection('basic');
      setCoverDraft(null);
    }
  }, [visible]);

  const isSaveDisabled = activeSection === 'cover' && Boolean(coverDraft?.dirty && !coverDraft.valid);

  const handleUpdateName = (name: string) => {
    if (card) {
      updateCardMetadata(cardId, { name });
    }
  };

  const handleUpdateTags = (tags: string[]) => {
    if (card) {
      updateCardMetadata(cardId, { tags });
    }
  };

  const applyCoverDraft = () => {
    if (coverDraft?.dirty && coverDraft.valid) {
      updateCardCover(cardId, {
        html: coverDraft.html,
        ratio: coverDraft.ratio,
        resources: coverDraft.resources,
      });
    }
  };

  const handleSave = async () => {
    applyCoverDraft();
    await saveCard(cardId);
    onSave();
  };

  return (
    <Modal
      open={visible}
      title="卡片设置"
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
                cardId={cardId}
                cardInfo={card}
                onUpdateName={handleUpdateName}
                onUpdateTags={handleUpdateTags}
              />
            </div>
          )}

          {activeSection === 'cover' && (
            <div className="card-settings-dialog__panel card-settings-dialog__panel--cover">
              <CoverPanel
                cardId={cardId}
                cardPath={card?.path ?? ''}
                cardName={card?.metadata.name ?? '无标题卡片'}
                currentCoverHtml={card?.cover?.html}
                currentRatio={card?.cover?.ratio ?? card?.metadata.coverRatio}
                onDraftChange={setCoverDraft}
              />
            </div>
          )}

          {activeSection === 'export' && (
            <div className="card-settings-dialog__panel">
              <ExportPanel
                cardId={cardId}
                onBeforeExport={applyCoverDraft}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
