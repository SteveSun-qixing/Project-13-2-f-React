import type { ChangeEvent, CSSProperties, ReactElement } from 'react';
import React, { useRef, useState } from 'react';
import { Button, Input, Segmented, Slider, Tag, theme } from '@chips/ui';
import { DeleteOutlined } from '@chips/ui';
import {
  analyzeImageUrl,
  applySmartDefaults,
  createUrlImageItem,
  deriveEffectiveLayoutType,
  getSpacingMetrics,
  readConfig,
  validateConfig,
} from './config';
import type {
  IImageConfig,
  IImageItem,
  ImageGridMode,
  ImageLayoutType,
} from './config';
import {
  arrayMove,
  resolveInsertionIndex,
} from './shared/utils';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；允许中间非法态
 * （08 §7.4）：URL 校验失败等以行内简体中文提示呈现，仅当整份配置合法时才向编辑链路发布
 * replace 变更。排序撤销/重做归属编辑链路（08 §4.3 回流唯一时序），编辑器内不建第二套历史。
 *
 * 缺位臂（工单063）：本地图片文件导入（选择/拖放 → 资源写入 → 路径回填）与 TIFF→PNG 转换
 * 依赖编辑器资源导入通道与内容处理服务，通道就绪前编辑器承接链接添加与既有配置编辑，
 * 面板内行内提示如实说明，不伪造导入流程。
 */

const POINTER_DRAG_THRESHOLD = 6;

const LAYOUT_CARDS: ReadonlyArray<{
  value: ImageLayoutType;
  role: string;
  title: string;
  description: string;
  glyph: string;
}> = [
  {
    value: 'grid',
    role: 'layout-card-grid',
    title: '网格排版',
    description: '多图以规则网格展示，适合概览浏览。',
    glyph: '▦',
  },
  {
    value: 'long-scroll',
    role: 'layout-card-long_scroll',
    title: '纵向长图',
    description: '按顺序纵向完整展开，适合漫画、截图和长图。',
    glyph: '▤',
  },
  {
    value: 'horizontal-scroll',
    role: 'layout-card-horizontal_scroll',
    title: '横向滚动',
    description: '横向排列图片，适合画廊和分镜内容。',
    glyph: '▥',
  },
];

const GRID_MODE_OPTIONS: ReadonlyArray<{ label: string; value: ImageGridMode }> = [
  { label: '2 × 2', value: '2x2' },
  { label: '3 × 3', value: '3x3' },
  { label: '3 列无限', value: '3-column-infinite' },
];

export function isEditorConfigComplete(config: IImageConfig): boolean {
  return validateConfig(config);
}

export interface IImageEditorViewProps {
  config: IImageConfig;
  onChange: (next: IImageConfig) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }): ReactElement {
  const { token } = theme.useToken();
  return (
    <h3
      style={{
        margin: 0,
        padding: `${token.paddingXS}px 0`,
        color: token.colorText,
        fontSize: token.fontSize,
        fontWeight: 700,
      }}
    >
      {children}
    </h3>
  );
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactElement;
}): ReactElement {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 160px) minmax(0, 1fr)',
        gap: token.marginSM,
        padding: `${token.paddingSM}px 0`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: 2, paddingTop: 5 }}>
        <span style={{ color: token.colorText, fontSize: token.fontSizeSM, fontWeight: 600 }}>
          {label}
        </span>
        {hint ? (
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>{hint}</span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
        {children}
        {error ? (
          <span role="alert" style={{ color: token.colorError, fontSize: token.fontSizeSM }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceButton(props: {
  active: boolean;
  role: string;
  title: string;
  description: string;
  onClick: () => void;
}): ReactElement {
  const { active, role, title, description, onClick } = props;
  const { token } = theme.useToken();
  return (
    <button
      type="button"
      data-role={role}
      data-active={active ? 'true' : 'false'}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXXS,
        alignItems: 'flex-start',
        minHeight: 72,
        padding: `${token.paddingSM}px ${token.padding}px`,
        borderRadius: token.borderRadius,
        border: `1px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        background: active ? token.colorPrimaryBg : token.colorBgContainer,
        color: active ? token.colorPrimary : token.colorText,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <span style={{ fontWeight: 700 }}>{title}</span>
      <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM, lineHeight: 1.5 }}>
        {description}
      </span>
    </button>
  );
}

function ImageTile(props: {
  item: IImageItem;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (imageId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: (imageId: string) => void;
}): ReactElement {
  const { item, selected, dragging, onPointerDown, onSelect } = props;
  const { token } = theme.useToken();
  const [loadFailed, setLoadFailed] = useState(false);
  const src = item.source === 'url' ? item.url : item.file_path;

  React.useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  return (
    <div
      data-role="image-tile"
      data-image-id={item.id}
      data-dragging={dragging ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      onPointerDown={(event) => {
        onPointerDown(item.id, event);
      }}
      onClick={() => {
        onSelect(item.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      style={{
        position: 'relative',
        width: 96,
        height: 96,
        overflow: 'hidden',
        borderRadius: token.borderRadius,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        boxShadow: selected ? `0 0 0 3px ${token.colorPrimaryBg}` : 'none',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        opacity: dragging ? 0.25 : 1,
        background: token.colorFillQuaternary,
        boxSizing: 'border-box',
      }}
    >
      {src.trim().length > 0 && !loadFailed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => {
            setLoadFailed(true);
          }}
        />
      ) : (
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            padding: token.paddingXS,
            height: '100%',
            boxSizing: 'border-box',
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
            textAlign: 'center',
          }}
        >
          图片暂时不可用
        </span>
      )}
    </div>
  );
}

export function ImageEditorView({ config, onChange }: IImageEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IImageConfig>(() => readConfig(config));
  const draftRef = useRef(draft);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(draft.images[0]?.id ?? null);
  const [urlInput, setUrlInput] = useState('');
  const [replaceUrlInput, setReplaceUrlInput] = useState('');
  const urlInputRef = useRef('');
  const replaceUrlInputRef = useRef('');
  const [messages, setMessages] = useState<string[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    imageId: string;
    previewUrl: string;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [isDeleteZoneOver, setIsDeleteZoneOver] = useState(false);

  const dragSessionRef = useRef<{
    imageId: string;
    originIndex: number;
    startX: number;
    startY: number;
    started: boolean;
  } | null>(null);
  const deleteZoneOverRef = useRef(false);

  const commit = (next: IImageConfig): void => {
    const normalized = readConfig(next);
    draftRef.current = normalized;
    setDraft(normalized);
    onChange(normalized);
  };

  const patchConfig = (patch: Partial<IImageConfig>): void => {
    commit({ ...draftRef.current, ...patch });
  };

  const patchLayoutOptions = (patch: Partial<IImageConfig['layout_options']>): void => {
    patchConfig({
      layout_options: { ...draftRef.current.layout_options, ...patch },
    });
  };

  const emitMessages = (next: string[]): void => {
    setMessages(next.filter((message) => message.trim().length > 0));
  };

  const selectedImage =
    draft.images.find((image) => image.id === selectedImageId) ?? draft.images[0] ?? null;
  const effectiveLayout = deriveEffectiveLayoutType(draft);
  const hasMultipleImages = draft.images.length > 1;

  const handleAddByUrl = (): void => {
    const trimmed = urlInputRef.current.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (!analyzeImageUrl(trimmed).valid) {
      emitMessages(['图片 URL 不合法，请输入 http(s) 或 webdav:// 地址。']);
      return;
    }

    const added = createUrlImageItem(trimmed);
    const previousCount = draftRef.current.images.length;
    const merged = applySmartDefaults(
      { ...draftRef.current, images: [...draftRef.current.images, added] },
      previousCount
    );
    commit(merged);
    setSelectedImageId(added.id);
    urlInputRef.current = '';
    setUrlInput('');
    emitMessages([]);
  };

  const handleReplaceWithUrl = (): void => {
    const target = selectedImage;
    if (!target) {
      return;
    }
    const trimmed = replaceUrlInputRef.current.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (!analyzeImageUrl(trimmed).valid) {
      emitMessages(['图片 URL 不合法，请输入 http(s) 或 webdav:// 地址。']);
      return;
    }

    patchConfig({
      images: draftRef.current.images.map((image) =>
        image.id === target.id
          ? { ...image, source: 'url' as const, file_path: '', url: trimmed }
          : image
      ),
    });
    replaceUrlInputRef.current = '';
    setReplaceUrlInput('');
    emitMessages([]);
  };

  const updateItemFields = (imageId: string, patch: Partial<Pick<IImageItem, 'alt' | 'title'>>): void => {
    patchConfig({
      images: draftRef.current.images.map((image) =>
        image.id === imageId ? { ...image, ...patch } : image
      ),
    });
  };

  const removeImage = (imageId: string): void => {
    const remaining = draftRef.current.images.filter((image) => image.id !== imageId);
    patchConfig({ images: remaining });
    if (selectedImageId === imageId) {
      setSelectedImageId(remaining[0]?.id ?? null);
      replaceUrlInputRef.current = '';
      setReplaceUrlInput('');
    }
  };

  const handleClearAll = (): void => {
    patchConfig({ images: [] });
    setSelectedImageId(null);
    replaceUrlInputRef.current = '';
    setReplaceUrlInput('');
  };

  const moveImageToIndex = (imageId: string, targetIndex: number): void => {
    const currentIndex = draftRef.current.images.findIndex((image) => image.id === imageId);
    if (currentIndex === -1 || currentIndex === targetIndex) {
      return;
    }
    const bounded = Math.max(0, Math.min(targetIndex, draftRef.current.images.length - 1));
    patchConfig({ images: arrayMove(draftRef.current.images, currentIndex, bounded) });
  };

  const handleLayoutTypeChange = (layoutType: ImageLayoutType): void => {
    if (draftRef.current.images.length > 1 && layoutType === 'single') {
      return;
    }
    patchConfig({ layout_type: layoutType });
  };

  const finishDrag = (shouldDelete: boolean, targetIndex: number | null): void => {
    const session = dragSessionRef.current;
    dragSessionRef.current = null;
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerCancel);
    setDraggingImageId(null);
    setDragPreview(null);
    deleteZoneOverRef.current = false;
    setIsDeleteZoneOver(false);

    if (!session || !session.started) {
      return;
    }
    if (shouldDelete) {
      removeImage(session.imageId);
      return;
    }
    if (targetIndex !== null) {
      moveImageToIndex(session.imageId, targetIndex);
    }
  };

  function computeTargetIndex(clientX: number, clientY: number): number | null {
    const session = dragSessionRef.current;
    const root = rootRef.current;
    if (!session || !root) {
      return null;
    }
    const rects = Array.from(
      root.querySelectorAll<HTMLElement>('[data-role="image-tile"][data-dragging="false"]')
    )
      .filter((node) => node.dataset.imageId !== session.imageId)
      .map((node) => node.getBoundingClientRect());
    const visibleCount = draftRef.current.images.length - 1;
    return resolveInsertionIndex(clientX, clientY, rects, visibleCount);
  }

  function isPointerOverDeleteTray(clientX: number, clientY: number): boolean {
    const tray = rootRef.current?.querySelector<HTMLElement>('[data-role="delete-tray"]');
    if (!tray) {
      return false;
    }
    const rect = tray.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function handleWindowPointerMove(event: PointerEvent): void {
    const session = dragSessionRef.current;
    if (!session) {
      return;
    }

    if (!session.started) {
      const deltaX = event.clientX - session.startX;
      const deltaY = event.clientY - session.startY;
      if (Math.hypot(deltaX, deltaY) < POINTER_DRAG_THRESHOLD) {
        return;
      }
      session.started = true;
      setDraggingImageId(session.imageId);
      const item = draftRef.current.images.find((image) => image.id === session.imageId);
      setDragPreview({
        imageId: session.imageId,
        previewUrl:
          item?.source === 'url' ? (item?.url ?? '') : (item?.file_path ?? ''),
        width: 96,
        height: 96,
        offsetX: deltaX,
        offsetY: deltaY,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    event.preventDefault();

    const overTray = isPointerOverDeleteTray(event.clientX, event.clientY);
    deleteZoneOverRef.current = overTray;
    setIsDeleteZoneOver(overTray);
    if (overTray) {
      return;
    }

    const targetIndex = computeTargetIndex(event.clientX, event.clientY);
    if (targetIndex !== null) {
      setDragPreview((current) => (current ? { ...current, clientX: event.clientX, clientY: event.clientY } : current));
    }
  }

  function handleWindowPointerUp(event: PointerEvent): void {
    const shouldDelete = deleteZoneOverRef.current;
    const targetIndex = shouldDelete ? null : computeTargetIndex(event.clientX, event.clientY);
    finishDrag(shouldDelete, targetIndex);
  }

  function handleWindowPointerCancel(): void {
    finishDrag(false, null);
  }

  const handleTilePointerDown = (imageId: string, event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || event.pointerType === 'touch') {
      return;
    }

    const originIndex = draftRef.current.images.findIndex((image) => image.id === imageId);
    if (originIndex === -1) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragSessionRef.current = {
      imageId,
      originIndex,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    deleteZoneOverRef.current = false;
    setIsDeleteZoneOver(false);

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
  };

  const onAddUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    urlInputRef.current = event.currentTarget.value;
    setUrlInput(event.currentTarget.value);
  };

  const onReplaceUrlChange = (event: ChangeEvent<HTMLInputElement>): void => {
    replaceUrlInputRef.current = event.currentTarget.value;
    setReplaceUrlInput(event.currentTarget.value);
  };

  const spacing = getSpacingMetrics(draft.layout_options.spacing_mode);

  const tileListStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: token.marginSM,
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      <section style={{ display: 'grid', gap: 0, maxWidth: 760, margin: '0 auto', paddingBottom: 64 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: token.marginXS,
          }}
        >
          <SectionTitle>图片列表</SectionTitle>
          {draft.images.length > 0 ? (
            <Button
              data-role="clear-all"
              danger
              icon={<DeleteOutlined aria-hidden="true" />}
              onClick={handleClearAll}
            >
              清空全部
            </Button>
          ) : null}
        </div>

        {messages.length > 0 ? (
          <div style={{ display: 'grid', gap: token.marginXXS, paddingTop: token.marginXS }}>
            {messages.map((message, index) => (
              <div
                key={`${message}-${index}`}
                role="alert"
                data-tone="error"
                style={{
                  padding: `${token.paddingXS}px ${token.paddingSM}px`,
                  borderRadius: token.borderRadius,
                  color: token.colorError,
                  background: token.colorErrorBg,
                  fontSize: token.fontSizeSM,
                }}
              >
                {message}
              </div>
            ))}
          </div>
        ) : null}

        {draft.images.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: `${token.paddingLG}px 0`,
              color: token.colorTextSecondary,
              textAlign: 'center',
            }}
          >
            还没有图片，请先通过链接添加远程图片。
          </p>
        ) : (
          <div style={{ ...tileListStyle, paddingTop: token.marginSM }}>
            {draft.images.map((item) => (
              <ImageTile
                key={item.id}
                item={item}
                selected={selectedImage?.id === item.id}
                dragging={draggingImageId === item.id}
                onPointerDown={handleTilePointerDown}
                onSelect={(imageId) => {
                  setSelectedImageId(imageId);
                  replaceUrlInputRef.current = '';
                  setReplaceUrlInput('');
                }}
              />
            ))}
          </div>
        )}

        {draft.images.length > 1 ? (
          <p style={{ margin: 0, paddingTop: token.marginXS, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            拖拽图片可调整顺序，拖到底部托盘可删除图片。
          </p>
        ) : null}

        {selectedImage ? (
          <div
            style={{
              display: 'grid',
              gap: token.marginSM,
              marginTop: token.marginSM,
              padding: token.paddingSM,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, flexWrap: 'wrap' }}>
              <Tag color="processing">
                {selectedImage.source === 'file' ? '本地资源' : '远程链接'}
              </Tag>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                {selectedImage.source === 'file' ? selectedImage.file_path : selectedImage.url}
              </span>
              <span style={{ flex: '1 1 auto' }} />
              <Button data-role="remove-image" size="small" danger onClick={() => {
                removeImage(selectedImage.id);
              }}>
                删除此图
              </Button>
            </div>

            <FieldRow label="图片标题" hint="展示于查看器标题栏">
              <Input
                data-role="image-title-input"
                value={selectedImage.title}
                placeholder="输入查看器标题"
                onChange={(event) => {
                  updateItemFields(selectedImage.id, { title: event.currentTarget.value });
                }}
              />
            </FieldRow>

            <FieldRow label="替代文本" hint="描述图片内容，供辅助技术使用">
              <Input
                data-role="image-alt-input"
                value={selectedImage.alt}
                placeholder="描述图片内容，供辅助技术使用"
                onChange={(event) => {
                  updateItemFields(selectedImage.id, { alt: event.currentTarget.value });
                }}
              />
            </FieldRow>

            <FieldRow label="替换链接" hint="把当前图片替换为远程地址">
              <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap' }}>
                <Input
                  data-role="replace-url-input"
                  style={{ flex: '1 1 240px' }}
                  value={replaceUrlInput}
                  placeholder="https://example.com/photo.jpg"
                  onChange={onReplaceUrlChange}
                  onPressEnter={handleReplaceWithUrl}
                />
                <Button data-role="replace-by-url" onClick={handleReplaceWithUrl}>
                  替换链接
                </Button>
              </div>
            </FieldRow>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gap: token.marginSM,
            marginTop: token.marginLG,
            padding: token.paddingSM,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <SectionTitle>排版设置</SectionTitle>

          {draft.images.length === 0 ? (
            <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
              添加图片后可在此选择排版类型与间距。
            </p>
          ) : hasMultipleImages ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: token.marginSM }}>
              {LAYOUT_CARDS.map((definition) => (
                <button
                  key={definition.value}
                  type="button"
                  data-role={definition.role}
                  data-active={draft.layout_type === definition.value ? 'true' : 'false'}
                  aria-pressed={draft.layout_type === definition.value}
                  onClick={() => {
                    handleLayoutTypeChange(definition.value);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: token.marginXXS,
                    alignItems: 'flex-start',
                    minHeight: 96,
                    padding: token.paddingSM,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${draft.layout_type === definition.value ? token.colorPrimary : token.colorBorderSecondary}`,
                    background: draft.layout_type === definition.value ? token.colorPrimaryBg : token.colorBgContainer,
                    color: draft.layout_type === definition.value ? token.colorPrimary : token.colorText,
                    textAlign: 'left',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: token.fontSizeLG }}>
                    {definition.glyph}
                  </span>
                  <span style={{ fontWeight: 700 }}>{definition.title}</span>
                  <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                    {definition.description}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
              当前只有 1 张图片，渲染时会自动使用单图模式。
            </p>
          )}

          {draft.images.length > 0 && effectiveLayout === 'single' ? (
            <>
              <FieldRow label="单图宽度" hint={`${draft.layout_options.single_width_percent}%（10 ~ 100）`}>
                <div data-role="single-width-slider" style={{ paddingRight: token.marginSM }}>
                  <Slider
                    min={10}
                    max={100}
                    step={5}
                    value={draft.layout_options.single_width_percent}
                    onChange={(value) => {
                      patchLayoutOptions({ single_width_percent: value });
                    }}
                  />
                </div>
              </FieldRow>
              <FieldRow label="单图对齐">
                <div style={{ display: 'inline-flex', gap: token.marginXS, flexWrap: 'wrap' }}>
                  {([
                    ['left', '靠左'],
                    ['center', '居中'],
                    ['right', '靠右'],
                  ] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      data-role={`align-${value}`}
                      type={draft.layout_options.single_alignment === value ? 'primary' : 'default'}
                      onClick={() => {
                        patchLayoutOptions({ single_alignment: value });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </FieldRow>
            </>
          ) : null}

          {draft.images.length > 0 && effectiveLayout === 'grid' ? (
            <FieldRow label="网格模式">
              <span data-role="grid-mode-segmented">
                <Segmented
                  options={GRID_MODE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                  value={draft.layout_options.grid_mode}
                  onChange={(value) => {
                    patchLayoutOptions({ grid_mode: value });
                  }}
                />
              </span>
            </FieldRow>
          ) : null}

          {draft.images.length > 0 && effectiveLayout !== 'single' ? (
            <FieldRow
              label="图片间距"
              hint={
                spacing.gap === 0
                  ? '图片之间无空隙，图片边角保持直角。'
                  : '图片之间保留适当留白，并使用小圆角。'
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: token.marginSM }}>
                <ChoiceButton
                  active={draft.layout_options.spacing_mode === 'none'}
                  role="spacing-none"
                  title="零间距"
                  description="图片之间无空隙，图片边角保持直角。"
                  onClick={() => {
                    patchLayoutOptions({ spacing_mode: 'none' });
                  }}
                />
                <ChoiceButton
                  active={draft.layout_options.spacing_mode !== 'none'}
                  role="spacing-comfortable"
                  title="适当间距"
                  description="图片之间保留适当留白，并使用小圆角。"
                  onClick={() => {
                    patchLayoutOptions({ spacing_mode: 'comfortable' });
                  }}
                />
              </div>
            </FieldRow>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gap: token.marginSM,
            marginTop: token.marginLG,
            padding: token.paddingSM,
            border: `1px dashed ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <SectionTitle>添加图片</SectionTitle>
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            本地图片文件导入依赖编辑器资源导入通道（工单063），通道交付前可先通过链接添加远程图片；
            旧卡片中的本地图片仍可正常编辑信息与排版。
          </p>
          <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap' }}>
            <Input
              data-role="add-url-input"
              style={{ flex: '1 1 240px' }}
              value={urlInput}
              placeholder="输入图片 URL，例如 https://example.com/photo.jpg"
              onChange={onAddUrlChange}
              onPressEnter={handleAddByUrl}
            />
            <Button data-role="add-by-url" type="primary" onClick={handleAddByUrl}>
              通过链接添加
            </Button>
          </div>
        </div>
      </section>

      <div
        data-role="delete-tray"
        data-active={draggingImageId ? 'true' : 'false'}
        data-over={isDeleteZoneOver ? 'true' : 'false'}
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'min(calc(100% - 32px), 280px)',
          minHeight: 52,
          padding: `0 ${token.padding}px`,
          borderRadius: token.borderRadius,
          border: `1px solid ${isDeleteZoneOver ? token.colorError : token.colorErrorBorder}`,
          background: token.colorErrorBg,
          color: token.colorError,
          fontSize: token.fontSizeSM,
          fontWeight: 700,
          opacity: draggingImageId ? 1 : 0,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      >
        拖动到这里删除图片
      </div>

      {dragPreview ? (
        <div
          data-role="drag-preview"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 2147483647,
            width: dragPreview.width,
            height: dragPreview.height,
            pointerEvents: 'none',
            transform: `translate3d(${dragPreview.clientX - dragPreview.offsetX}px, ${dragPreview.clientY - dragPreview.offsetY}px, 0)`,
            overflow: 'hidden',
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          {dragPreview.previewUrl.trim().length > 0 ? (
            <img
              src={dragPreview.previewUrl}
              alt=""
              draggable={false}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                height: '100%',
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              图片暂时不可用
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
