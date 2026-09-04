import { useEffect, useMemo, useState } from 'react';
import { Modal, Tabs } from 'antd';
import { useSettings } from '../../context/SettingsContext';
import './EngineSettingsDialog.css';

interface EngineSettingsDialogProps {
  visible: boolean;
  initialCategory?: string;
  onClose: () => void;
}

const BUILTIN_TAB_IDS = ['general', 'appearance', 'shortcuts'];

const RESETTABLE_CATEGORY_IDS = new Set(['general', 'appearance', 'shortcuts']);

export function EngineSettingsDialog({
  visible,
  initialCategory,
  onClose,
}: EngineSettingsDialogProps) {
  const { registeredPanels, getSetting, setSetting } = useSettings();
  const [activeTabId, setActiveTabId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setActiveTabId(initialCategory ?? BUILTIN_TAB_IDS[0]);
    }
  }, [visible, initialCategory]);

  const tabItems = useMemo(() => {
    const items = [
      { key: 'general', label: '通用' },
      { key: 'appearance', label: '外观' },
      { key: 'shortcuts', label: '快捷键' },
    ];
    registeredPanels.forEach((panel) => {
      items.push({ key: panel.id, label: panel.name });
    });
    return items;
  }, [registeredPanels]);

  const canResetActiveCategory = RESETTABLE_CATEGORY_IDS.has(activeTabId);

  const handleResetCategory = () => {
    switch (activeTabId) {
      case 'general':
        setSetting('defaultWorkspacePath', '');
        return;
      case 'appearance':
        setSetting('theme', 'default');
        return;
      default:
        return;
    }
  };

  const renderCategoryContent = () => {
    switch (activeTabId) {
      case 'general':
        return (
          <div className="engine-settings-dialog__section">
            <h3 className="engine-settings-dialog__section-title">工作区</h3>
            <div className="engine-settings-dialog__field">
              <label className="engine-settings-dialog__field-label">
                默认工作区路径
              </label>
              <input
                type="text"
                className="engine-settings-dialog__input"
                value={getSetting<string>('defaultWorkspacePath', '') || ''}
                placeholder="输入默认工作区路径"
                onChange={(e) => setSetting('defaultWorkspacePath', e.target.value)}
              />
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div className="engine-settings-dialog__section">
            <h3 className="engine-settings-dialog__section-title">外观</h3>
            <div className="engine-settings-dialog__field">
              <label className="engine-settings-dialog__field-label">
                主题
              </label>
              <select
                className="engine-settings-dialog__select"
                value={getSetting<string>('theme', 'default') || 'default'}
                onChange={(e) => setSetting('theme', e.target.value)}
              >
                <option value="default">默认</option>
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </div>
          </div>
        );
      case 'shortcuts':
        return (
          <div className="engine-settings-dialog__section">
            <h3 className="engine-settings-dialog__section-title">快捷键</h3>
            <p className="engine-settings-dialog__section-desc">
              快捷键设置
            </p>
          </div>
        );
      default:
        return (
          <div className="engine-settings-dialog__section">
            <p className="engine-settings-dialog__section-desc">请选择一个类别</p>
          </div>
        );
    }
  };

  return (
    <Modal
      open={visible}
      title="引擎设置"
      onCancel={onClose}
      width="88%"
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="engine-settings-dialog-root"
      footer={
        <div className="engine-settings-dialog__footer">
          <button
            type="button"
            className="engine-settings-dialog__btn"
            onClick={handleResetCategory}
            disabled={!canResetActiveCategory}
          >
            重置
          </button>
          <button
            type="button"
            className="engine-settings-dialog__btn engine-settings-dialog__btn--primary"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      }
    >
      <Tabs
        className="engine-settings-dialog__tabs"
        activeKey={activeTabId}
        onChange={(key: string) => setActiveTabId(key)}
        items={tabItems.map((item) => ({
          key: item.key,
          label: item.label,
          children: (
            <div className="engine-settings-dialog__main">
              {renderCategoryContent()}
            </div>
          ),
        }))}
      />
    </Modal>
  );
}
