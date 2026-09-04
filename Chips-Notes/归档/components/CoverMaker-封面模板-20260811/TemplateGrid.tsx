import React from 'react';
import type { CoverTemplate, TemplateStyle } from './types';
import { templates } from './templates/index';
import './TemplateGrid.css';

interface TemplateGridProps {
  value: TemplateStyle | null;
  onChange: (value: TemplateStyle) => void;
}

export function TemplateGrid({ value, onChange }: TemplateGridProps) {
  const isSelected = (templateId: TemplateStyle) => {
    return value === templateId;
  };

  const selectTemplate = (template: CoverTemplate) => {
    onChange(template.id);
  };

  return (
    <div className="template-grid">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`template-grid__item ${isSelected(template.id) ? 'template-grid__item--selected' : ''}`}
          onClick={() => selectTemplate(template)}
        >
          <div
            className="template-grid__preview"
            style={
              (() => {
                const styleObj: Record<string, string> = {};
                // Very basic style parser to convert string css to react style object for previewStyle
                if (template.previewStyle) {
                  const rules = template.previewStyle.split(';').filter(Boolean);
                  rules.forEach((rule) => {
                    const [key, val] = rule.split(':');
                    if (key && val) {
                      const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                      styleObj[camelKey] = val.trim();
                    }
                  });
                }
                return styleObj;
              })()
            }
          >
            <span className="template-grid__preview-text">Aa</span>
          </div>
          <div className="template-grid__info">
            <span className="template-grid__name">{template.name}</span>
            <span className="template-grid__description">{template.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
