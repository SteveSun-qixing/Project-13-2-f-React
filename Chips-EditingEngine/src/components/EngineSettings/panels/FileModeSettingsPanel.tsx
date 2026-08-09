import React, { useMemo } from 'react';
import type { IconDescriptor } from 'chips-sdk';
import { useSettings } from '../../../context/SettingsContext';
import { ENGINE_ICONS } from '../../../icons/descriptors';
import { RuntimeIcon } from '../../../icons/RuntimeIcon';
import './FileModeSettingsPanel.css';

const CATEGORY_ID = 'fileMode';

interface FileModeSettingsData {
  fileMode: 'link' | 'copy';
}

export function FileModeSettingsPanel() {
  const { getSetting, setSetting } = useSettings();

  const fileModeData = useMemo<FileModeSettingsData>(() => {
    return getSetting<FileModeSettingsData>(CATEGORY_ID, {
      fileMode: 'link',
    }) ?? {
      fileMode: 'link',
    };
  }, [getSetting]);

  const fileModes = useMemo(() => [
    {
      id: 'link' as const,
      label: '保持只读链接（推荐）',
      desc: '在卡片中直接使用原始文件路径引用外部文件。优点：节约磁盘空间。移动原始文件可能导致源丢失。',
      icon: ENGINE_ICONS.link,
    },
    {
      id: 'copy' as const,
      label: '复制到工作区',
      desc: '在将其添加到卡片时，将原文件复制到工作区内部。优点：方便打包导出和随意移动，但增加冗余占用。',
      icon: ENGINE_ICONS.copy,
    },
  ] satisfies Array<{ id: 'link' | 'copy'; label: string; desc: string; icon: IconDescriptor }>, []);

  const handleSelectMode = (mode: 'link' | 'copy') => {
    setSetting<FileModeSettingsData>(CATEGORY_ID, {
      fileMode: mode,
    });
  };

  return (
    <div className="file-mode-settings-panel">
      <div className="settings-panel-header">
        <h3 className="settings-panel-header__title">
          文件管理方式
        </h3>
        <p className="settings-panel-header__desc">
          选择卡片编辑过程中，对本地磁盘文件的操作管理方式。不影响内置缓存机制。
        </p>
      </div>

      <div className="file-mode-options">
        {fileModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`file-mode-option ${fileModeData.fileMode === mode.id ? 'file-mode-option--selected' : ''}`}
            onClick={() => handleSelectMode(mode.id)}
          >
            <div className="file-mode-option__header">
              <span className="file-mode-option__icon">
                <RuntimeIcon icon={mode.icon} />
              </span>
              <span className="file-mode-option__name">{mode.label}</span>
              {fileModeData.fileMode === mode.id && (
                <span className="settings-option-card__check" aria-hidden="true">
                  <RuntimeIcon icon={ENGINE_ICONS.check} />
                </span>
              )}
            </div>
            <p className="file-mode-option__desc">
              {mode.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
