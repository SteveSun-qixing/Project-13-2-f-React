import type { ChangeEvent, ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Button, Input, Segmented, Tag, theme } from '@chips/ui';
import { deriveDisplayTitle, readConfig, validateConfig } from './config';
import type { IBookConfig, IBookImageItem } from './config';
import { generateStableId, resolveFileName } from './shared/utils';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：字段级错误以行内简体中文提示呈现，仅当整份配置合法
 * 且主资源已填写时才向编辑链路发布 replace 变更。
 *
 * 资源文件落卡片的导入臂（EPUB / 图片包文件选择 → 解包与元数据补全 → 资源写入 → 路径回填）
 * 依赖资源写入链路（工单064 登记缺位），通道就绪后在该面板接线；本面板先行承接
 * 资源路径与书籍信息的编辑与校验。EPUB / ZIP 解析器（`src/shared/epub.ts`、
 * `src/shared/archive.ts`）已随包交付，等导入臂就绪后消费。
 */

/** 编辑器发布变更前要求的最小完整性：整体合法（schema 同口径）且主资源已填写。 */
export function isEditorConfigComplete(config: IBookConfig): boolean {
  if (!validateConfig(config)) {
    return false;
  }

  if (config.source_type === 'image-sequence') {
    return config.image_sequence.some((item) => item.file_path.length > 0);
  }

  return config.book_file.length > 0;
}

export interface IBookEditorViewProps {
  config: IBookConfig;
  onChange: (next: IBookConfig) => void;
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

function SectionTitle({ children }: { children: string }): ReactElement {
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

const SUPPORTED_FORMAT_HINT =
  'epub / epub3 / pdf / txt / md / mobi / azw / azw3 / fb2 / djvu / djv / rtf / doc / docx；图片包为 zip / cbz';

export function BookEditorView({ config, onChange }: IBookEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IBookConfig>(() => readConfig(config));
  const draftRef = useRef(draft);

  const commit = (patch: Partial<IBookConfig>): void => {
    const next = readConfig({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const onStringField =
    (key: 'book_file' | 'book_format' | 'book_name' | 'book_author' | 'cover_image') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      commit({ [key]: event.currentTarget.value });
    };

  const onSourceTypeChange = (value: string): void => {
    if (value === 'ebook' || value === 'image-sequence') {
      commit({ source_type: value });
    }
  };

  const onSortBasisChange = (value: string | number): void => {
    if (value === 'filename' || value === 'entry-time') {
      commit({ image_sort_basis: value });
    }
  };

  const addImageItem = (): void => {
    const item: IBookImageItem = {
      id: generateStableId('book-image'),
      file_path: '',
      file_name: '',
      mime_type: '',
      source_entry_path: '',
    };
    commit({ image_sequence: [...draft.image_sequence, item], source_type: 'image-sequence' });
  };

  const updateImageItem = (itemId: string, patch: Partial<IBookImageItem>): void => {
    commit({
      image_sequence: draft.image_sequence.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        // 路径是图片条目的权威字段：路径变更时展示名同步重派生（导入臂回填的
        // source_entry_path / entry_time 不受影响）。
        const fileName = patch.file_path !== undefined ? resolveFileName(patch.file_path) : undefined;
        return {
          ...item,
          ...patch,
          ...(fileName === undefined ? {} : { file_name: fileName }),
        };
      }),
    });
  };

  const removeImageItem = (itemId: string): void => {
    commit({ image_sequence: draft.image_sequence.filter((item) => item.id !== itemId) });
  };

  const bookFormatInvalid =
    draft.book_format.trim().length > 0 &&
    !/^(epub3|pdf|txt|md|mobi|azw|azw3|fb2|djvu|djv|rtf|doc|docx|markdown|epub|zip|cbz)$/u.test(
      draft.book_format.trim().toLowerCase()
    );
  const displayTitle = deriveDisplayTitle(draft) || '未命名书籍';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      <section style={{ display: 'grid', gap: 0, maxWidth: 720, margin: '0 auto' }}>
        <SectionTitle>来源形态</SectionTitle>

        <FieldRow label="内容来源" hint="电子书文件交付阅读器，解包图片序列交付图片查看器">
          <Segmented
            data-role="source-type-segmented"
            value={draft.source_type}
            onChange={(value) => {
              onSourceTypeChange(String(value));
            }}
            options={[
              { label: '电子书', value: 'ebook' },
              { label: '图片序列', value: 'image-sequence' },
            ]}
          />
        </FieldRow>

        {draft.source_type === 'ebook' ? (
          <>
            <FieldRow label="书籍文件" hint="必填；卡片内相对路径，例如 books/demo.epub">
              <Input
                data-role="book-path-input"
                value={draft.book_file}
                placeholder="books/demo.epub"
                onChange={onStringField('book_file')}
              />
            </FieldRow>
            <FieldRow
              label="书籍格式"
              hint={`必填；受支持格式：${SUPPORTED_FORMAT_HINT}`}
              error={
                bookFormatInvalid ? 'book_format 必须为受支持的电子书或图片包格式' : undefined
              }
            >
              <Input
                data-role="book-format-input"
                value={draft.book_format}
                placeholder="epub"
                {...(bookFormatInvalid ? { status: 'error' as const } : {})}
                onChange={onStringField('book_format')}
              />
            </FieldRow>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: token.marginXS,
                padding: `${token.paddingSM}px 0`,
              }}
            >
              <SectionTitle>图片序列</SectionTitle>
              <Button data-role="add-image-item" onClick={addImageItem}>
                添加图片
              </Button>
            </div>

            {draft.image_sequence.length > 0 ? (
              <div style={{ display: 'grid', gap: token.marginSM, paddingBottom: token.marginSM }}>
                {draft.image_sequence.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gap: token.marginXS,
                      padding: token.paddingSM,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadiusLG,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                      <Tag color="processing">{item.file_name || `第 ${index + 1} 张`}</Tag>
                      <span style={{ flex: '1 1 auto' }} />
                      <Button
                        data-role={`remove-image-item-${item.id}`}
                        size="small"
                        onClick={() => {
                          removeImageItem(item.id);
                        }}
                      >
                        删除图片
                      </Button>
                    </div>
                    <FieldRow label="图片路径" hint="必填；卡片内相对路径，例如 comic/001.jpg">
                      <Input
                        data-role={`image-path-input-${item.id}`}
                        value={item.file_path}
                        placeholder="comic/001.jpg"
                        onChange={(event) => {
                          updateImageItem(item.id, { file_path: event.currentTarget.value });
                        }}
                      />
                    </FieldRow>
                  </div>
                ))}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  paddingBottom: token.marginSM,
                  color: token.colorTextSecondary,
                  fontSize: token.fontSizeSM,
                }}
              >
                还没有图片条目，可以先添加一张图片。
              </p>
            )}

            <FieldRow label="排序依据" hint="文件名按自然序，创建时间按导入条目时间">
              <Segmented
                data-role="sort-basis-segmented"
                value={draft.image_sort_basis}
                onChange={onSortBasisChange}
                options={[
                  { label: '文件名', value: 'filename' },
                  { label: '创建时间', value: 'entry-time' },
                ]}
              />
            </FieldRow>
          </>
        )}

        <div style={{ paddingTop: token.paddingLG }}>
          <SectionTitle>封面</SectionTitle>
        </div>
        <FieldRow label="封面图片" hint="可选；卡片内相对路径，图片序列模式默认取序列首图">
          <Input
            data-role="cover-path-input"
            value={draft.cover_image}
            placeholder="covers/demo.jpg"
            onChange={onStringField('cover_image')}
          />
        </FieldRow>

        <div style={{ paddingTop: token.paddingLG }}>
          <SectionTitle>书籍信息</SectionTitle>
        </div>
        <FieldRow label="书籍名称" hint={`留空时查看态从文件名派生，当前展示：${displayTitle}`}>
          <Input
            data-role="book-name-input"
            value={draft.book_name}
            placeholder="输入书籍名称"
            onChange={onStringField('book_name')}
          />
        </FieldRow>
        <FieldRow label="书籍作者">
          <Input
            data-role="book-author-input"
            value={draft.book_author}
            placeholder="输入书籍作者"
            onChange={onStringField('book_author')}
          />
        </FieldRow>
      </section>
    </div>
  );
}
