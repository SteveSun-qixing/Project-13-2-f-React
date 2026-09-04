import React, { useCallback, useMemo } from 'react';
import { Button, Divider, Dropdown, Tooltip } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  TableOutlined,
  CommentOutlined,
  UndoOutlined,
  RedoOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { WordEditorState, ActiveFormats } from '../types';
import { formatMessage } from '../lib/messages';

interface WordToolbarProps {
  editorState: WordEditorState;
  onCommand: (command: string, value?: unknown) => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onInsertComment: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const FONT_SIZES = [
  { label: '8', value: 16 },
  { label: '9', value: 18 },
  { label: '10', value: 20 },
  { label: '11', value: 22 },
  { label: '12', value: 24 },
  { label: '14', value: 28 },
  { label: '16', value: 32 },
  { label: '18', value: 36 },
  { label: '20', value: 40 },
  { label: '22', value: 44 },
  { label: '24', value: 48 },
  { label: '26', value: 52 },
  { label: '28', value: 56 },
  { label: '36', value: 72 },
  { label: '48', value: 96 },
  { label: '72', value: 144 },
];

const FONTS = [
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: '仿宋', value: 'FangSong' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Calibri', value: 'Calibri' },
];

export function WordToolbar({
  editorState,
  onCommand,
  onInsertImage,
  onInsertTable,
  onInsertComment,
  canUndo = true,
  canRedo = true,
}: WordToolbarProps) {
  const { activeFormats, readOnly, zoom } = editorState;

  const handleFontChange = useCallback(
    (font: string) => {
      onCommand('fontName', font);
    },
    [onCommand]
  );

  const handleFontSizeChange = useCallback(
    (size: number) => {
      onCommand('fontSize', size);
    },
    [onCommand]
  );

  const fontMenuItems: MenuProps['items'] = useMemo(
    () =>
      FONTS.map((font) => ({
        key: font.value,
        label: font.label,
        onClick: () => handleFontChange(font.value),
      })),
    [handleFontChange]
  );

  const fontSizeMenuItems: MenuProps['items'] = useMemo(
    () =>
      FONT_SIZES.map((size) => ({
        key: String(size.value),
        label: size.label,
        onClick: () => handleFontSizeChange(size.value),
      })),
    [handleFontSizeChange]
  );

  const isActive = (key: keyof ActiveFormats, value?: unknown): boolean => {
    if (value !== undefined) {
      return activeFormats[key] === value;
    }
    return Boolean(activeFormats[key]);
  };

  if (readOnly) {
    return (
      <div className="word-toolbar word-toolbar--readonly">
        <span className="word-toolbar__readonly-label">
          {formatMessage('word.statusBar.readOnly')}
        </span>
      </div>
    );
  }

  return (
    <div className="word-toolbar" role="toolbar" aria-label={formatMessage('word.toolbar.bold')}>
      <div className="word-toolbar__group">
        <Tooltip title={`${formatMessage('word.toolbar.undo')} (Ctrl+Z)`}>
          <Button
            type="text"
            icon={<UndoOutlined />}
            onClick={() => onCommand('undo')}
            disabled={!canUndo}
          />
        </Tooltip>
        <Tooltip title={`${formatMessage('word.toolbar.redo')} (Ctrl+Y)`}>
          <Button
            type="text"
            icon={<RedoOutlined />}
            onClick={() => onCommand('redo')}
            disabled={!canRedo}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Dropdown menu={{ items: fontMenuItems }} trigger={['click']}>
          <Button type="text" className="word-toolbar__font-button">
            <span className="word-toolbar__font-name">
              {activeFormats.fontName || formatMessage('word.toolbar.font')}
            </span>
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: fontSizeMenuItems }} trigger={['click']}>
          <Button type="text" icon={<FontSizeOutlined />} className="word-toolbar__fontsize-button">
            <span className="word-toolbar__fontsize-value">
              {activeFormats.fontSize
                ? Math.round(activeFormats.fontSize / 2)
                : formatMessage('word.toolbar.fontSize')}
            </span>
          </Button>
        </Dropdown>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Tooltip title={`${formatMessage('word.toolbar.bold')} (Ctrl+B)`}>
          <Button
            type="text"
            icon={<BoldOutlined />}
            onClick={() => onCommand('bold')}
            className={isActive('bold') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={`${formatMessage('word.toolbar.italic')} (Ctrl+I)`}>
          <Button
            type="text"
            icon={<ItalicOutlined />}
            onClick={() => onCommand('italic')}
            className={isActive('italic') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={`${formatMessage('word.toolbar.underline')} (Ctrl+U)`}>
          <Button
            type="text"
            icon={<UnderlineOutlined />}
            onClick={() => onCommand('underline')}
            className={isActive('underline') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.strikethrough')}>
          <Button
            type="text"
            icon={<StrikethroughOutlined />}
            onClick={() => onCommand('strikethrough')}
            className={isActive('strikethrough') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Tooltip title={formatMessage('word.toolbar.alignLeft')}>
          <Button
            type="text"
            icon={<AlignLeftOutlined />}
            onClick={() => onCommand('alignLeft')}
            className={isActive('align', 'left') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.alignCenter')}>
          <Button
            type="text"
            icon={<AlignCenterOutlined />}
            onClick={() => onCommand('alignCenter')}
            className={isActive('align', 'center') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.alignRight')}>
          <Button
            type="text"
            icon={<AlignRightOutlined />}
            onClick={() => onCommand('alignRight')}
            className={isActive('align', 'right') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.alignJustify')}>
          <Button
            type="text"
            icon={<AlignCenterOutlined style={{ transform: 'scaleX(1.2)' }} />}
            onClick={() => onCommand('alignJustify')}
            className={isActive('align', 'justify') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Tooltip title={formatMessage('word.toolbar.unorderedList')}>
          <Button
            type="text"
            icon={<UnorderedListOutlined />}
            onClick={() => onCommand('unorderedList')}
            className={isActive('listStyle', 'bullet') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.orderedList')}>
          <Button
            type="text"
            icon={<OrderedListOutlined />}
            onClick={() => onCommand('orderedList')}
            className={isActive('listStyle', 'ordered') ? 'ant-btn-primary' : ''}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Tooltip title={formatMessage('word.toolbar.heading1')}>
          <Button
            type="text"
            onClick={() => onCommand('heading', 1)}
            className={isActive('headingLevel', 1) ? 'ant-btn-primary' : ''}
          >
            H1
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.heading2')}>
          <Button
            type="text"
            onClick={() => onCommand('heading', 2)}
            className={isActive('headingLevel', 2) ? 'ant-btn-primary' : ''}
          >
            H2
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.heading3')}>
          <Button
            type="text"
            onClick={() => onCommand('heading', 3)}
            className={isActive('headingLevel', 3) ? 'ant-btn-primary' : ''}
          >
            H3
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.paragraph')}>
          <Button type="text" onClick={() => onCommand('paragraph')}>
            P
          </Button>
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="word-toolbar__group">
        <Tooltip title={formatMessage('word.toolbar.insertImage')}>
          <Button type="text" icon={<PictureOutlined />} onClick={onInsertImage} />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.insertTable')}>
          <Button type="text" icon={<TableOutlined />} onClick={onInsertTable} />
        </Tooltip>
        <Tooltip title={formatMessage('word.toolbar.insertComment')}>
          <Button
            type="text"
            icon={<CommentOutlined />}
            onClick={onInsertComment}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export default WordToolbar;
