import React from 'react';
import type { ReactElement } from 'react';
import { Button, Form, Input, Segmented, theme } from '@chips/ui';
import {
  analyzeWebpageUrl,
  DEFAULT_ENTRY_FILE,
  getBundleEntryPath,
  readContent,
  type IWebpageContent,
} from './config';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存、不导入/删除资源
 * （05.06 §6.3：资源写入与清理由编辑链路正式资源桥承担）；允许中间非法态（08 §7.4）：
 * 字段级错误以行内简体中文提示呈现，仅当整份内容合法时才发布 replace 变更。
 * 网页 ZIP 解压导入由编辑链路资源桥承担，本面板以安全路径输入 + 资源清单逐行维护承接
 * 已导入内容的配置面（旧 importArchiveBundle 宿主回调面随旧契约作废）。
 */

const DISPLAY_MODE_OPTIONS: readonly IWebpageContent['display_mode'][] = ['fixed', 'free'];

const DISPLAY_MODE_LABELS: Readonly<Record<IWebpageContent['display_mode'], string>> = {
  fixed: '固定比例',
  free: '自由展开',
};

const SOURCE_TYPE_OPTIONS: readonly IWebpageContent['source_type'][] = ['url', 'bundle'];

const SOURCE_TYPE_LABELS: Readonly<Record<IWebpageContent['source_type'], string>> = {
  url: '链接',
  bundle: '网页目录',
};

const DISPLAY_MODE_HINTS: Readonly<Record<IWebpageContent['display_mode'], string>> = {
  fixed: '固定为宽:高 7:16，在卡片窗口内滚动查看网页。',
  free: '按网页高度展开，最高不超过宽度的 20 倍，超出部分在窗口内滚动。',
};

/** 编辑器发布变更前的最小完整性：地址来源网址合法；目录来源包根与入口清单齐备。 */
export function isEditorContentComplete(content: IWebpageContent): boolean {
  if (content.source_type === 'url') {
    return content.source_url.length === 0 || analyzeWebpageUrl(content.source_url).openable;
  }

  const entryPath = getBundleEntryPath(content);
  return (
    entryPath !== undefined &&
    entryPath.endsWith(`/${DEFAULT_ENTRY_FILE}`) &&
    content.resource_paths.includes(entryPath)
  );
}

interface IEditorFormValues {
  source_type: IWebpageContent['source_type'];
  source_url: string;
  bundle_root: string;
  resource_paths_text: string;
  display_mode: IWebpageContent['display_mode'];
}

function parseResourcePaths(text: string): string[] {
  return text.split('\n');
}

export interface IWebpageEditorViewProps {
  content: IWebpageContent;
  onChange: (next: IWebpageContent) => void;
}

export function WebpageEditorView({
  content,
  onChange,
}: IWebpageEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [form] = Form.useForm<IEditorFormValues>();
  const initialFormValues = React.useMemo<IEditorFormValues>(
    () => ({
      source_type: content.source_type,
      source_url: content.source_url,
      bundle_root: content.bundle_root,
      resource_paths_text: content.resource_paths.join('\n'),
      display_mode: content.display_mode,
    }),
    [content],
  );
  const [draft, setDraft] = React.useState<IWebpageContent>(content);
  const formValuesRef = React.useRef<IEditorFormValues>(initialFormValues);

  const commitValues = (partial: Partial<IEditorFormValues>): void => {
    const merged: IEditorFormValues = {
      ...formValuesRef.current,
      ...partial,
    };
    formValuesRef.current = merged;
    const next = readContent({
      source_type: merged.source_type,
      source_url: merged.source_url,
      bundle_root: merged.bundle_root,
      resource_paths: parseResourcePaths(merged.resource_paths_text),
      display_mode: merged.display_mode,
      entry_file: DEFAULT_ENTRY_FILE,
    });
    setDraft(next);
    onChange(next);
  };

  const handleValuesChange = (
    _changed: Partial<IEditorFormValues>,
    values: IEditorFormValues,
  ): void => {
    commitValues(values);
  };

  const handleClearSource = (): void => {
    const cleared = readContent({ display_mode: draft.display_mode });
    const nextFormValues: IEditorFormValues = {
      source_type: cleared.source_type,
      source_url: cleared.source_url,
      bundle_root: cleared.bundle_root,
      resource_paths_text: '',
      display_mode: cleared.display_mode,
    };
    form.setFieldsValue(nextFormValues);
    formValuesRef.current = nextFormValues;
    setDraft(cleared);
    onChange(cleared);
  };

  const sourceType = draft.source_type;

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
      <Form<IEditorFormValues>
        form={form}
        layout="vertical"
        initialValues={initialFormValues}
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          label="显示比例"
          name="display_mode"
          extra={DISPLAY_MODE_HINTS[draft.display_mode]}
        >
          <Segmented
            options={DISPLAY_MODE_OPTIONS.map((value) => ({
              value,
              label: DISPLAY_MODE_LABELS[value],
            }))}
          />
        </Form.Item>

        <Form.Item
          label="网页模式"
          name="source_type"
          extra="先选择网页来源模式，再填写对应的链接或网页目录。"
        >
          <Segmented
            options={SOURCE_TYPE_OPTIONS.map((value) => ({
              value,
              label: SOURCE_TYPE_LABELS[value],
            }))}
          />
        </Form.Item>

        {sourceType === 'url' ? (
          <Form.Item
            label="网页地址"
            name="source_url"
            extra="输入合法网址后自动刷新；切换到网页目录时会清除网址引用。"
            rules={[
              {
                validator: (_rule, value: unknown) =>
                  typeof value !== 'string' ||
                  value.trim().length === 0 ||
                  analyzeWebpageUrl(value).openable
                    ? Promise.resolve()
                    : Promise.reject(new Error('请输入合法的 http(s) 网页地址')),
              },
            ]}
          >
            <Input
              aria-label="网页地址"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://example.com/page"
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              label="网页目录"
              name="bundle_root"
              extra="网页目录在卡片根目录中的相对路径；ZIP 压缩包解压导入由编辑链路资源桥完成。"
              rules={[
                {
                  validator: (_rule, value: unknown) =>
                    typeof value !== 'string' ||
                    value.trim().length === 0 ||
                    readContent({ source_type: 'bundle', bundle_root: value }).bundle_root.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('请输入合法的包内相对目录路径')),
                },
              ]}
            >
              <Input
                aria-label="网页目录"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="webpage-bundle-a1b2c3"
              />
            </Form.Item>

            <Form.Item label="入口文件" extra="网页目录入口文件正式为 index.html。">
              <Input value={DEFAULT_ENTRY_FILE} disabled aria-label="入口文件" />
            </Form.Item>

            <Form.Item
              label="资源清单"
              name="resource_paths_text"
              extra="每行一个包内相对路径；必须包含入口文件 index.html。"
              rules={[
                {
                  validator: (_rule, value: unknown) =>
                    typeof value !== 'string' ||
                    value.trim().length === 0 ||
                    getBundleEntryPath(readContent({
                      source_type: 'bundle',
                      bundle_root: draft.bundle_root,
                      resource_paths: parseResourcePaths(value),
                    })) !== undefined
                      ? Promise.resolve()
                      : Promise.reject(new Error('请先填写合法的网页目录路径')),
                },
              ]}
            >
              <Input.TextArea
                aria-label="资源清单"
                rows={5}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={'webpage-bundle-a1b2c3/index.html\nwebpage-bundle-a1b2c3/assets/app.js'}
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="当前来源">
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            {sourceType === 'bundle' && draft.bundle_root
              ? `当前显示的是已导入的网页目录（${draft.bundle_root}，入口 ${draft.entry_file}，共 ${draft.resource_paths.length} 个文件）。`
              : sourceType === 'url' && draft.source_url
                ? `当前显示的是远程网页链接（${draft.source_url}）。`
                : '还没有选择网页来源。'}
          </span>
        </Form.Item>

        <Button
          type="default"
          onClick={handleClearSource}
        >
          清除来源
        </Button>
      </Form>
    </div>
  );
}
