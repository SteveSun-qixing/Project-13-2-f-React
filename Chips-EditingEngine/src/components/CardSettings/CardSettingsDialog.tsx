import { Button, Flex, Modal, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import { useCard } from '../../context/CardContext';
import { BasicInfoPanel } from './panels/BasicInfoPanel';
import { CoverPanel, type CoverPanelDraft } from './panels/CoverPanel';
import { ExportPanel } from './panels/ExportPanel';
import {
  DOCUMENT_SETTINGS_MODAL_CLASS_NAMES,
  DOCUMENT_SETTINGS_TABS_CLASS_NAMES,
} from './document-settings-dialog-layout';
import './CardSettingsDialog.css';

interface CardSettingsDialogProps {
  cardId: string;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function CardSettingsDialog({
  cardId,
  visible,
  onClose,
  onSave,
}: CardSettingsDialogProps) {
  const { getCard, saveCard, updateCardMetadata, updateCardCover } = useCard();
  const [activeTab, setActiveTab] = useState('basic');
  const [coverDraft, setCoverDraft] = useState<CoverPanelDraft | null>(null);

  const card = getCard(cardId);

  useEffect(() => {
    if (visible) {
      setActiveTab('basic');
      setCoverDraft(null);
    }
  }, [visible]);

  const isSaveDisabled = activeTab === 'cover' && Boolean(coverDraft?.dirty && !coverDraft.valid);

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
      width={960}
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="card-settings-dialog-root"
      classNames={DOCUMENT_SETTINGS_MODAL_CLASS_NAMES}
      footer={
        <Flex justify="flex-end" gap={12}>
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
        </Flex>
      }
    >
      <Tabs
        className="document-settings-dialog__tabs"
        classNames={DOCUMENT_SETTINGS_TABS_CLASS_NAMES}
        activeKey={activeTab}
        onChange={(key: string) => setActiveTab(key)}
        items={[
          {
            key: 'basic',
            label: '基础信息',
            children: (
              <div className="card-settings-dialog__panel">
                <div className="document-settings-dialog__form">
                  <BasicInfoPanel
                    cardId={cardId}
                    cardInfo={card}
                    onUpdateName={handleUpdateName}
                    onUpdateTags={handleUpdateTags}
                  />
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
                  cardId={cardId}
                  cardPath={card?.path ?? ''}
                  cardName={card?.metadata.name ?? '无标题卡片'}
                  currentCoverHtml={card?.cover?.html}
                  currentRatio={card?.cover?.ratio ?? card?.metadata.coverRatio}
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
                  <ExportPanel
                    cardId={cardId}
                    onBeforeExport={applyCoverDraft}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
