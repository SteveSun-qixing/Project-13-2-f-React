import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input } from 'antd';
import './BasicInfoPanel.css';

export interface CardMetaData {
  name?: string;
  tags?: (string | string[])[];
  createdAt?: string | number;
  modifiedAt?: string | number;
  created_at?: string | number;
  modified_at?: string | number;
}
export interface CardInfo {
  metadata: CardMetaData;
}

interface BasicInfoPanelProps {
  cardId: string;
  cardInfo?: CardInfo;
  onUpdateName?: (name: string) => void;
  onUpdateTags?: (tags: string[]) => void;
  documentIdLabel?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  tagsLabel?: string;
  tagPlaceholder?: string;
  addTagLabel?: string;
  metadataLabel?: string;
  createdAtLabel?: string;
  modifiedAtLabel?: string;
}

export function BasicInfoPanel({
  cardId,
  cardInfo,
  onUpdateName,
  onUpdateTags,
  documentIdLabel,
  nameLabel,
  namePlaceholder,
  tagsLabel,
  tagPlaceholder,
  addTagLabel,
  metadataLabel,
  createdAtLabel,
  modifiedAtLabel,
}: BasicInfoPanelProps) {
  const resolvedDocumentIdLabel = documentIdLabel ?? '卡片ID';
  const resolvedCreatedAtLabel = createdAtLabel ?? '创建时间';
  const resolvedModifiedAtLabel = modifiedAtLabel ?? '修改时间';
  const resolvedNameLabel = nameLabel ?? '名称';
  const resolvedNamePlaceholder = namePlaceholder ?? '输入卡片名称';
  const resolvedTagsLabel = tagsLabel ?? '标签';
  const resolvedTagPlaceholder = tagPlaceholder ?? '输入标签名称';
  const resolvedAddTagLabel = addTagLabel ?? '添加标签';
  const resolvedMetadataLabel = metadataLabel ?? '元数据';

  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (cardInfo) {
      setEditName(cardInfo.metadata.name || '');
      const tags = (cardInfo.metadata.tags || []).map((tag) =>
        Array.isArray(tag) ? tag.join('/') : tag
      );
      setEditTags(tags);
    }
  }, [cardInfo]);

  // Synchronize changes upwards
  const handleNameChange = (val: string) => {
    setEditName(val);
    onUpdateName?.(val);
  };

  const handleTagsChange = (newTags: string[]) => {
    setEditTags(newTags);
    onUpdateTags?.(newTags);
  };

  const formatDateTime = (timestamp: string | number | undefined): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !editTags.includes(tag)) {
      const updatedTags = [...editTags, tag];
      handleTagsChange(updatedTags);
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    const updatedTags = editTags.filter((_, i) => i !== index);
    handleTagsChange(updatedTags);
  };

  const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const metadataItems = useMemo(() => [
    {
      label: resolvedDocumentIdLabel,
      value: cardId,
      mono: true,
    },
    {
      label: resolvedCreatedAtLabel,
      value: formatDateTime(cardInfo?.metadata?.createdAt ?? cardInfo?.metadata?.created_at),
      mono: false,
    },
    {
      label: resolvedModifiedAtLabel,
      value: formatDateTime(cardInfo?.metadata?.modifiedAt ?? cardInfo?.metadata?.modified_at),
      mono: false,
    },
  ], [cardId, cardInfo, resolvedCreatedAtLabel, resolvedDocumentIdLabel, resolvedModifiedAtLabel]);

  return (
    <div className="basic-info-panel">
      <div className="basic-info-panel__field">
        <label className="basic-info-panel__label">
          {resolvedNameLabel}
        </label>
        <Input
          value={editName}
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder={resolvedNamePlaceholder}
          className="basic-info-panel__input"
        />
      </div>

      <div className="basic-info-panel__field">
        <label className="basic-info-panel__label">
          {resolvedTagsLabel}
        </label>
        <div className="basic-info-panel__tag-input-row">
          <Input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            placeholder={resolvedTagPlaceholder}
            onKeyDown={handleKeydown}
            className="basic-info-panel__tag-input"
          />
          <Button
            type="default"
            className="basic-info-panel__tag-add-btn"
            onClick={addTag}
          >
            {resolvedAddTagLabel}
          </Button>
        </div>
        {editTags.length > 0 && (
          <div className="basic-info-panel__tag-list">
            {editTags.map((tag, index) => (
              <span
                key={index}
                className="basic-info-panel__tag"
              >
                {tag}
                <button type="button" onClick={() => removeTag(index)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="basic-info-panel__field">
        <label className="basic-info-panel__label">
          {resolvedMetadataLabel}
        </label>
        <div className="basic-info-panel__metadata">
          {metadataItems.map((item) => (
            <div key={item.label} className="basic-info-panel__metadata-row">
              <span className="basic-info-panel__metadata-label">{item.label}</span>
              <span className={`basic-info-panel__metadata-value ${item.mono ? 'basic-info-panel__metadata-value--mono' : ''}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
