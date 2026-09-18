import React, { useState } from 'react';
import { Card, Typography, Button, message, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNote } from '../context/NoteContext';
import { BASE_CARD_REGISTRY } from '../basecards/registry';
import { BaseCardEditor } from '../basecards/editors';

const { Title, Paragraph } = Typography;

type PanelMode = 'card-library' | 'card-editor';

export function CardLibraryPanel(): React.ReactElement {
  const { currentNote, insertBasecard } = useNote();
  const [mode, setMode] = useState<PanelMode>('card-library');
  const [editingCardType, setEditingCardType] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<any>(null);

  const handleCardClick = async (cardType: string) => {
    if (!currentNote) {
      message.warning('请先打开或创建一个笔记');
      return;
    }

    const cardDef = BASE_CARD_REGISTRY.find(c => c.type === cardType);
    if (!cardDef) {
      message.error('未知的卡片类型');
      return;
    }

    if (cardType === 'chips.basecard.rich-text') {
      try {
        await insertBasecard(cardType);
        message.success('富文本卡片已插入');
      } catch (error) {
        message.error(`插入失败: ${error}`);
      }
    } else {
      setEditingCardType(cardType);
      setDraftConfig({ ...cardDef.defaultConfig });
      setMode('card-editor');
    }
  };

  const handleSaveCard = async () => {
    if (!editingCardType || !currentNote) {
      return;
    }

    try {
      await insertBasecard(editingCardType);
      message.success(`${editingCardType}已插入`);
      setMode('card-library');
      setEditingCardType(null);
      setDraftConfig(null);
    } catch (error) {
      message.error(`插入失败: ${error}`);
    }
  };

  const handleCancelEdit = () => {
    setMode('card-library');
    setEditingCardType(null);
    setDraftConfig(null);
  };

  if (mode === 'card-editor' && editingCardType) {
    const cardDef = BASE_CARD_REGISTRY.find(c => c.type === editingCardType);

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleCancelEdit}
          >
            返回卡片库
          </Button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            新增{cardDef?.name}卡片
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 4 }}>
            编辑卡片内容后点击保存，卡片将插入到笔记末尾
          </Paragraph>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e8e8e8',
            marginBottom: 16,
          }}
        >
          {draftConfig && (
            <BaseCardEditor
              cardType={editingCardType}
              config={draftConfig}
              onChange={setDraftConfig}
              baseCardId=""
              cardPath={currentNote.path}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={handleCancelEdit}>取消</Button>
          <Button type="primary" onClick={handleSaveCard}>
            保存并插入
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>卡片库</Title>
        <Paragraph type="secondary" style={{ marginTop: 4 }}>
          {currentNote ? '点击插入卡片到笔记中' : '请先打开或创建笔记'}
        </Paragraph>
      </div>

      {!currentNote && (
        <Alert
          message="未选择笔记"
          description="请从左侧目录树选择或创建一个笔记"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 12,
          }}
        >
          {BASE_CARD_REGISTRY.map((cardType) => (
            <Card
              key={cardType.type}
              hoverable={!!currentNote}
              style={{
                textAlign: 'center',
                cursor: currentNote ? 'pointer' : 'not-allowed',
                opacity: currentNote ? 1 : 0.5,
              }}
              onClick={() => currentNote && handleCardClick(cardType.type)}
              bodyStyle={{ padding: 12 }}
            >
              <div style={{ marginBottom: 4, fontSize: 24 }}>{cardType.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{cardType.name}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                {cardType.description}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
