import type { ReactElement } from 'react';
import { Form, Input, Segmented, Switch, theme } from '@chips/ui';
import {
  analyzeHyperlinkUrl,
  DENSITY_LABELS,
  DENSITY_OPTIONS,
  readConfig,
  securityHintText,
} from './config';
import type { IHyperlinkConfig } from './config';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：字段级错误以行内简体中文提示呈现，
 * 仅当整份配置合法时才向编辑链路发布 replace 变更。
 */

/** 编辑器发布变更前要求的最小完整性：锚点文本非空且 URL 可打开。 */
export function isEditorConfigComplete(config: IHyperlinkConfig): boolean {
  return config.anchor_text.trim().length > 0 && analyzeHyperlinkUrl(config.url).openable;
}

export interface IHyperlinkEditorViewProps {
  config: IHyperlinkConfig;
  onChange: (next: IHyperlinkConfig) => void;
}

export function HyperlinkEditorView({
  config,
  onChange,
}: IHyperlinkEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const handleValuesChange = (
    _changed: Partial<IHyperlinkConfig>,
    values: IHyperlinkConfig
  ): void => {
    onChange(readConfig(values));
  };
  const analysis = analyzeHyperlinkUrl(config.url);
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
      <Form<IHyperlinkConfig>
        layout="vertical"
        initialValues={config}
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          label="锚点文本"
          name="anchor_text"
          required
          extra="链接卡片的显示标题"
          rules={[
            { required: true, message: '请输入锚点文本' },
            {
              validator: (_rule, value: unknown) =>
                typeof value === 'string' && value.trim().length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('请输入锚点文本')),
            },
          ]}
        >
          <Input placeholder="例如：薯片生态官网" />
        </Form.Item>

        <Form.Item
          label="链接地址"
          name="url"
          required
          extra={securityHintText(analysis)}
          rules={[
            { required: true, message: '请输入链接地址' },
            {
              validator: (_rule, value: unknown) =>
                typeof value === 'string' && analyzeHyperlinkUrl(value).openable
                  ? Promise.resolve()
                  : Promise.reject(new Error('请输入合法的 http(s) 链接地址')),
            },
          ]}
        >
          <Input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/page"
          />
        </Form.Item>

        <Form.Item label="描述" name="description" extra="显示在标题下方的说明文字">
          <Input.TextArea rows={3} placeholder="可选：说明这个链接指向的内容" />
        </Form.Item>

        <Form.Item
          label="图标地址"
          name="icon_url"
          extra="可选：http(s) 图片地址；加载失败或未填写时显示默认箭头图标"
          rules={[
            {
              validator: (_rule, value: unknown) =>
                typeof value !== 'string' ||
                value.trim().length === 0 ||
                analyzeHyperlinkUrl(value).openable
                  ? Promise.resolve()
                  : Promise.reject(new Error('图标地址必须是合法的 http(s) 地址')),
            },
          ]}
        >
          <Input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/icon.png"
          />
        </Form.Item>

        <Form.Item label="显示密度" name="display_density">
          <Segmented
            options={DENSITY_OPTIONS.map((value) => ({ value, label: DENSITY_LABELS[value] }))}
          />
        </Form.Item>

        <Form.Item
          label="显示安全提示"
          name="show_security_hint"
          valuePropName="checked"
          extra="在链接标题旁显示链接安全状态"
        >
          <Switch />
        </Form.Item>
      </Form>
    </div>
  );
}

