import type { ChangeEvent, ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Input, theme } from '@chips/ui';
import { deriveDisplayFileName, readConfig, validateConfig } from './config';
import type { IFileConfig } from './config';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：非法资源路径经归一回退空串，仅当整份配置合法
 * 且文件资源路径已填写时才向编辑链路发布 replace 变更。
 *
 * 文件选择导入臂（文件选择 → 资源写入 → `file_name` / `file_extension` 按原始文件名
 * 自动识别回填、封面选择、替换 / 删除时旧资源经平台资源管理链路登记删除——《01》§6.9
 * 补充说明第 3~5 条）依赖编辑器资源导入通道（工单062 登记缺位），通道就绪后在该面板
 * 接线；本面板先行承接资源路径编辑与自动识别派生，`sanitizeImportedFileName` 等纯函数
 * 已随包交付待消费。
 *
 * 《01》§6.9：`file_name` 与 `file_extension` 由编辑器在导入文件时自动识别，
 * 不提供手工编辑字段——本面板以只读派生展示呈现。
 */

/** 编辑器发布变更前要求的最小完整性：整体合法（schema 同口径）且文件资源路径非空。 */
export function isEditorConfigComplete(config: IFileConfig): boolean {
  return config.file_file.length > 0 && validateConfig(config);
}

export interface IFileEditorViewProps {
  config: IFileConfig;
  onChange: (next: IFileConfig) => void;
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
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
      </div>
    </div>
  );
}

function DerivedRow({
  label,
  role,
  value,
}: {
  label: string;
  role: string;
  value: string;
}): ReactElement {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 160px) minmax(0, 1fr)',
        gap: token.marginSM,
        padding: `${token.paddingSM}px 0`,
        alignItems: 'start',
      }}
    >
      <span style={{ color: token.colorText, fontSize: token.fontSizeSM, fontWeight: 600 }}>
        {label}
      </span>
      <span
        data-role={role}
        style={{
          minWidth: 0,
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
          lineHeight: '32px',
          overflowWrap: 'anywhere',
        }}
      >
        {value.length > 0 ? value : '—'}
      </span>
    </div>
  );
}

export function FileEditorView({ config, onChange }: IFileEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IFileConfig>(() => readConfig(config));
  const draftRef = useRef(draft);

  const commit = (patch: Partial<IFileConfig>): void => {
    const next = readConfig({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const onPathField =
    (key: 'file_file' | 'cover_image') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      commit({ [key]: event.currentTarget.value });
    };

  const displayFileName = deriveDisplayFileName(draft);

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
        <h3
          style={{
            margin: 0,
            padding: `${token.paddingXS}px 0`,
            color: token.colorText,
            fontSize: token.fontSize,
            fontWeight: 700,
          }}
        >
          文件资源
        </h3>

        <FieldRow label="文件" hint="必填；卡片内相对路径，例如 docs/季度报告.pdf">
          <Input
            data-role="file-path-input"
            value={draft.file_file}
            placeholder="docs/季度报告.pdf"
            onChange={onPathField('file_file')}
          />
        </FieldRow>

        <FieldRow
          label="自定义封面"
          hint="可选；卡片内相对路径，未填写时按文件后缀解析类别显示内置默认封面"
        >
          <Input
            data-role="cover-path-input"
            value={draft.cover_image}
            placeholder="covers/季度报告.png"
            onChange={onPathField('cover_image')}
          />
        </FieldRow>

        <h3
          style={{
            margin: 0,
            paddingTop: token.paddingLG,
            color: token.colorText,
            fontSize: token.fontSize,
            fontWeight: 700,
          }}
        >
          自动识别信息
        </h3>

        <p
          style={{
            margin: 0,
            paddingTop: token.marginSM,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          文件名与后缀由导入文件自动识别，不提供手工编辑字段；文件选择导入通道就绪前，可先填写卡片内相对路径引用。
        </p>

        <DerivedRow label="文件名" role="derived-file-name" value={displayFileName} />
        <DerivedRow label="文件后缀" role="derived-file-extension" value={draft.file_extension} />
      </section>
    </div>
  );
}
