import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { getChipsClient } from '../../../services/bridge-client';
import { ENGINE_ICONS } from '../../../icons/descriptors';
import { RuntimeIcon } from '../../../icons/RuntimeIcon';
import './ThemePanel.css';

export interface ThemePanelProps {
  value: string;
  onChange: (themeId: string) => void;
}

export function ThemePanel({ value, onChange }: ThemePanelProps) {
  const { t } = useTranslation();
  const clientRef = useRef(getChipsClient());
  const onChangeRef = useRef(onChange);

  const DEFAULT_THEME_ID = 'chips-official.default-theme';

  const THEME_NAME_KEY_MAP: Record<string, string> = {
    'chips-official.default-theme': 'card_settings.theme_default_light',
    'chips-official.default-dark-theme': 'card_settings.theme_default_dark',
  };

  const [themes, setThemes] = useState<Array<{ id: string; name: string; installed: boolean; version?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const selectedTheme = value || DEFAULT_THEME_ID;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const selectTheme = (themeId: string) => {
    onChangeRef.current(themeId);
  };

  useEffect(() => {
    let active = true;

    async function loadThemes(): Promise<void> {
      setIsLoading(true);
      try {
        const [themeList, currentTheme] = await Promise.all([
          clientRef.current.theme.list(),
          clientRef.current.theme.getCurrent(),
        ]);

        const nextThemes = themeList.length > 0
          ? themeList.map((theme) => ({
              id: theme.id,
              name: t(THEME_NAME_KEY_MAP[theme.id]) || theme.displayName || theme.id,
              installed: true,
              version: theme.version,
            }))
          : [{
              id: currentTheme.themeId || DEFAULT_THEME_ID,
              name: t(THEME_NAME_KEY_MAP[currentTheme.themeId]) || currentTheme.displayName || currentTheme.themeId || DEFAULT_THEME_ID,
              installed: true,
              version: currentTheme.version,
            }];

        if (!active) {
          return;
        }

        setThemes(nextThemes);

        if (!value && currentTheme.themeId) {
          onChangeRef.current(currentTheme.themeId);
          return;
        }

        if (value && !nextThemes.some((theme) => theme.id === value)) {
          onChangeRef.current(nextThemes[0]?.id ?? DEFAULT_THEME_ID);
        }
      } catch (error) {
        console.error('Failed to load themes:', error);
        if (!active) {
          return;
        }
        setThemes([{
          id: DEFAULT_THEME_ID,
          name: t('card_settings.theme_default_light') || '默认浅色',
          installed: true,
        }]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadThemes();

    return () => {
      active = false;
    };
  }, [t, value]);

  useEffect(() => {
    if (themes.length > 0 && !themes.some(th => th.id === selectedTheme)) {
      selectTheme(themes[0]?.id ?? DEFAULT_THEME_ID);
    }
  }, [themes, selectedTheme]);

  return (
    <div className="theme-panel">
      <div className="theme-panel__header">
        <label className="theme-panel__label">
          {t('card_settings.theme_select') || '选择主题'}
        </label>
      </div>

      {isLoading ? (
        <div className="theme-panel__loading">
          <span className="theme-panel__loading-text">
            {t('card_settings.theme_loading') || '加载中...'}
          </span>
        </div>
      ) : (
        <div className="theme-panel__grid">
          {themes.map(theme => (
            <button
              key={theme.id}
              type="button"
              className={`theme-panel__item ${selectedTheme === theme.id ? 'theme-panel__item--selected' : ''}`}
              onClick={() => selectTheme(theme.id)}
            >
              <span className="theme-panel__item-preview" />
              <span className="theme-panel__item-name">
                {theme.version ? `${theme.name} ${theme.version}` : theme.name}
              </span>
              {selectedTheme === theme.id && (
                <span
                  className="theme-panel__item-check"
                  aria-hidden="true"
                >
                  <RuntimeIcon icon={ENGINE_ICONS.check} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {themes.length <= 1 && !isLoading && (
        <div className="theme-panel__hint">
          <span className="theme-panel__hint-icon">
            <RuntimeIcon icon={ENGINE_ICONS.info} />
          </span>
          <span className="theme-panel__hint-message">
            {t('card_settings.theme_hint') || '可前往插件市场下载更多主题。'}
          </span>
        </div>
      )}
    </div>
  );
}
