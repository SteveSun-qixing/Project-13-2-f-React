import { useEffect, useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  ControlOutlined,
  BgColorsOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Flex, Modal } from 'antd';
import { useSettings } from '../../context/SettingsContext';
import './EngineSettingsDialog.css';

interface EngineSettingsDialogProps {
  visible: boolean;
  initialCategory?: string;
  onClose: () => void;
}

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const BUILTIN_CATEGORIES: SettingsCategory[] = [
  { id: 'general', label: '通用', icon: <ControlOutlined /> },
  { id: 'appearance', label: '外观', icon: <BgColorsOutlined /> },
  { id: 'shortcuts', label: '快捷键', icon: <ThunderboltOutlined /> },
];

const RESETTABLE_CATEGORY_IDS = new Set(['general', 'appearance', 'shortcuts']);

export function EngineSettingsDialog({
  visible,
  initialCategory,
  onClose,
}: EngineSettingsDialogProps) {
  const { registeredPanels, getSetting, setSetting } = useSettings();
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setActiveCategoryId(initialCategory ?? BUILTIN_CATEGORIES[0].id);
    }
  }, [visible, initialCategory]);

  const categories = useMemo<SettingsCategory[]>(() => {
    const allCategories: SettingsCategory[] = [...BUILTIN_CATEGORIES];
    registeredPanels.forEach((panel) => {
      allCategories.push({
        id: panel.id,
        label: panel.name,
        icon: <AppstoreOutlined />,
      });
    });
    return allCategories;
  }, [registeredPanels]);

  const canResetActiveCategory = RESETTABLE_CATEGORY_IDS.has(activeCategoryId);

  const handleResetCategory = () => {
    switch (activeCategoryId) {
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
    switch (activeCategoryId) {
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
      width={720}
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="engine-settings-dialog-root"
      footer={
        <Flex justify="flex-end" gap={12}>
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
        </Flex>
      }
    >
      <div className="engine-settings-dialog__layout">
        <nav className="engine-settings-dialog__sidebar" aria-label="设置分类">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`engine-settings-dialog__category-btn ${activeCategoryId === category.id ? 'engine-settings-dialog__category-btn--active' : ''}`}
              onClick={() => setActiveCategoryId(category.id)}
            >
              <span className="engine-settings-dialog__category-icon">{category.icon}</span>
              <span className="engine-settings-dialog__category-label">{category.label}</span>
            </button>
          ))}
        </nav>

        <div className="engine-settings-dialog__main">
          {renderCategoryContent()}
        </div>
      </div>
    </Modal>
  );
}
