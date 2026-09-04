import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './DefaultEditor.css';

interface FormField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'textarea';
  default?: unknown;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: unknown }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface DefaultEditorProps {
  baseCard: {
    id: string;
    type: string;
    config: Record<string, unknown>;
  };
  schema?: Record<string, unknown>;
  mode?: 'json' | 'form';
  onConfigChange?: (config: Record<string, unknown>) => void;
  onValidation?: (valid: boolean, errors: string[]) => void;
}

export interface DefaultEditorRef {
  currentMode: 'json' | 'form';
  localConfig: Record<string, unknown>;
  hasErrors: boolean;
  validateAll: () => boolean;
  resetConfig: () => void;
  formatJson: () => void;
}

export const DefaultEditor = forwardRef<DefaultEditorRef, DefaultEditorProps>((props, ref) => {
  const {
    baseCard,
    schema,
    mode = 'form',
    onConfigChange,
    onValidation,
  } = props;

  const { t } = useTranslation();

  const [currentMode, setCurrentMode] = useState<'json' | 'form'>(mode);
  const [jsonContent, setJsonContent] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Initialization
  useEffect(() => {
    setLocalConfig({ ...baseCard.config });
    setJsonContent(JSON.stringify(baseCard.config, null, 2));

    if (schema) {
      // Mocked schema parsing - in a real scenario we use generateFieldsFromSchema
      setFormFields([]);
    } else {
      const generateFieldsFromConfig = (config: Record<string, unknown>): FormField[] => {
        return Object.entries(config).map(([key, value]) => ({
          key,
          label: key,
          type: typeof value === 'boolean' ? 'boolean'
            : typeof value === 'number' ? 'number'
            : typeof value === 'string' && value.length > 100 ? 'textarea'
            : 'string',
          default: value,
          required: false,
        }));
      };
      setFormFields(generateFieldsFromConfig({ ...baseCard.config }));
    }
  }, [baseCard, schema]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const hasErrors = (currentMode === 'json' ? jsonError !== null : validationErrors.size > 0);

  const cardTypeName = useMemo(() => {
    const typeNames: Record<string, string> = {
      RichTextCard: t('card_window.type_rich_text') || 'RichTextCard',
      MarkdownCard: t('card_window.type_markdown') || 'MarkdownCard',
      ImageCard: t('card_window.type_image') || 'ImageCard',
      VideoCard: t('card_window.type_video') || 'VideoCard',
      AudioCard: t('card_window.type_audio') || 'AudioCard',
      CodeBlockCard: t('card_window.type_code') || 'CodeBlockCard',
      ListCard: t('card_window.type_list') || 'ListCard',
    };
    return typeNames[baseCard.type] || baseCard.type;
  }, [baseCard.type, t]);

  const parseJsonContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      setLocalConfig(parsed);
      setJsonError(null);
      return parsed;
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : t('default_editor.json_parse_error') || 'JSON 解析错误');
      return null;
    }
  };

  const toggleMode = () => {
    if (currentMode === 'json') {
      if (!parseJsonContent(jsonContent)) return;
      setCurrentMode('form');
    } else {
      setJsonContent(JSON.stringify(localConfig, null, 2));
      setCurrentMode('json');
    }
  };

  const formatJson = () => {
    const parsed = parseJsonContent(jsonContent);
    if (parsed) {
      setJsonContent(JSON.stringify(parsed, null, 2));
    }
  };

  const resetConfig = () => {
    const initial = { ...baseCard.config };
    setLocalConfig(initial);
    setJsonContent(JSON.stringify(initial, null, 2));
    setJsonError(null);
    setValidationErrors(new Map());
    onConfigChange?.(initial);
  };

  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    const parsed = parseJsonContent(value);
    if (parsed) {
      onConfigChange?.(parsed);
    }
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);

    // Simplistic validation
    const newErrors = new Map(validationErrors);
    newErrors.delete(key);
    setValidationErrors(newErrors);

    onConfigChange?.(newConfig);
  };

  const validateAll = () => {
    // Basic verification stub
    const isValid = true;
    onValidation?.(isValid, []);
    return isValid;
  };

  useImperativeHandle(ref, () => ({
    currentMode,
    localConfig,
    hasErrors,
    validateAll,
    resetConfig,
    formatJson,
  }));

  const getFieldValue = (key: string) => localConfig[key] ?? '';
  const getFieldError = (key: string) => validationErrors.get(key);

  return (
    <div className="default-editor">
      <div className="default-editor__toolbar">
        <div className="default-editor__info">
          <span className="default-editor__type">{cardTypeName}</span>
          <span className="default-editor__id">{baseCard.id}</span>
        </div>
        <div className="default-editor__actions">
          <button
            type="button"
            className="default-editor__btn default-editor__btn--mode"
            title={currentMode === 'json' ? (t('default_editor.switch_to_form') || '切换到表单') : (t('default_editor.switch_to_json') || '切换到 JSON')}
            onClick={toggleMode}
          >
            <RuntimeIcon icon={currentMode === 'json' ? ENGINE_ICONS.edit : ENGINE_ICONS.code} />
          </button>
          {currentMode === 'json' && (
            <button
              type="button"
              className="default-editor__btn"
              title={t('default_editor.format_json') || '格式化 JSON'}
              onClick={formatJson}
            >
              <RuntimeIcon icon={ENGINE_ICONS.format} />
            </button>
          )}
          <button
            type="button"
            className="default-editor__btn"
            title={t('default_editor.reset_config') || '重置配置'}
            onClick={resetConfig}
          >
            <RuntimeIcon icon={ENGINE_ICONS.reset} />
          </button>
        </div>
      </div>

      {currentMode === 'json' && (
        <div className="default-editor__json">
          <textarea
            className={`default-editor__json-input ${jsonError ? 'default-editor__json-input--error' : ''}`}
            value={jsonContent}
            onChange={(e) => handleJsonChange(e.target.value)}
          />
          {jsonError && (
            <div className="default-editor__json-error">{jsonError}</div>
          )}
        </div>
      )}

      {currentMode === 'form' && (
        <div className="default-editor__form">
          {formFields.length === 0 ? (
            <div className="default-editor__empty">
              <p>{t('default_editor.empty') || '没有可编辑的配置'}</p>
            </div>
          ) : (
            formFields.map((field) => (
              <div
                key={field.key}
                className={`default-editor__field ${getFieldError(field.key) ? 'default-editor__field--error' : ''}`}
              >
                <label className="default-editor__label" htmlFor={`field-${field.key}`}>
                  {field.label}
                  {field.required && <span className="default-editor__required">*</span>}
                </label>

                {field.type === 'boolean' ? (
                  <label className="default-editor__checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(getFieldValue(field.key))}
                      onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                    />
                    {t('default_editor.checkbox_enable') || '启用'}
                  </label>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={`field-${field.key}`}
                    className="default-editor__textarea"
                    value={String(getFieldValue(field.key))}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <input
                    id={`field-${field.key}`}
                    type={field.type === 'number' ? 'number' : 'text'}
                    className="default-editor__input"
                    value={String(getFieldValue(field.key))}
                    onChange={(e) => handleFieldChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                )}
                {getFieldError(field.key) && (
                  <span className="default-editor__error">{getFieldError(field.key)}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

DefaultEditor.displayName = 'DefaultEditor';
