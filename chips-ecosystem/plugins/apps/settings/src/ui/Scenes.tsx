import { useMemo, useState, type FC } from 'react';
import { Alert, Button, Input, Select, Switch, Typography, theme } from '@chips/ui';
import { SettingsGroup, SettingsLayout, SettingsRow, StateBoundary } from '@chips/ui';
import {
  isDefaultValue,
  SETTINGS_SCENES,
  settingsForScene,
  type SettingDescriptor,
  type SettingValue,
  type SettingsSceneId,
} from '../domain/settings/catalog';
import type { SettingsPreferenceStore } from '../domain/settings/preferenceStore';

/** 生效层展示文案（降级期固定为会话内存层，工单066）。 */
const EFFECT_LAYER_LABEL = '会话内存（未持久化，工单066）';

/** 默认窗口宽度可选档（整数键；键入任意 ≥640 整数亦可提交）。 */
const WIDTH_PRESETS: readonly number[] = [960, 1200, 1440, 1680, 1920];

/** 单项控件属性。 */
interface SettingControlProps {
  readonly descriptor: SettingDescriptor;
  readonly value: SettingValue;
  readonly onChange: (value: SettingValue) => void;
}

/** 偏好项控件：枚举 → Select、布尔 → Switch、整数 → 预设档 + 键入（InputNumber 属禁面组件）。 */
const SettingControl: FC<SettingControlProps> = ({ descriptor, value, onChange }) => {
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  if (descriptor.kind === 'boolean') {
    return <Switch checked={value === true} onChange={(checked) => onChange(checked)} aria-label={descriptor.label} />;
  }
  if (descriptor.kind === 'integer') {
    // 键入草稿态：聚焦编辑期间展示原始键入，归一结果经外部 value 变化回灌（失焦即对齐生效值）。
    const shown = widthDraft ?? String(value);
    return (
      <Input
        value={shown}
        inputMode="numeric"
        style={{ width: 240 }}
        aria-label={descriptor.label}
        onChange={(event) => {
          setWidthDraft(event.target.value);
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isInteger(parsed)) {
            onChange(parsed);
          }
        }}
        addonAfter={
          <Select
            size="small"
            variant="borderless"
            placeholder="常用档"
            style={{ minWidth: 96 }}
            options={WIDTH_PRESETS.map((width) => ({ value: width, label: `${width}px` }))}
            onChange={(picked) => {
              setWidthDraft(null);
              onChange(picked as number);
            }}
          />
        }
      />
    );
  }
  return (
    <Select
      value={String(value)}
      style={{ minWidth: 160 }}
      options={(descriptor.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
      onChange={(picked) => onChange(picked)}
      aria-label={descriptor.label}
    />
  );
};

/** 偏好分类页属性。 */
export interface PreferenceSceneProps {
  readonly sceneId: SettingsSceneId;
  readonly store: SettingsPreferenceStore;
  readonly onNotify: (text: string) => void;
}

/**
 * 偏好分类页（外观 / 行为）：注册表驱动的分组行呈现。
 *
 * 即时生效（《05-生态设置面板设计》§2.4）：修改即写入存储并回显归一值；单项/分组级
 * 「恢复默认」清退显式覆盖；生效层如实标记为会话内存层（工单066，不伪造持久化成功）。
 */
export const PreferenceScene: FC<PreferenceSceneProps> = ({ sceneId, store, onNotify }) => {
  const { token } = theme.useToken();
  const descriptors = useMemo(() => settingsForScene(sceneId), [sceneId]);
  const [values, setValues] = useState<Record<string, SettingValue>>(() =>
    Object.fromEntries(descriptors.map((descriptor) => [descriptor.key, store.read(descriptor.key)])),
  );

  const groups = useMemo(() => {
    const ordered: { group: string; items: SettingDescriptor[] }[] = [];
    for (const descriptor of descriptors) {
      const bucket = ordered.find((entry) => entry.group === descriptor.group);
      if (bucket === undefined) {
        ordered.push({ group: descriptor.group, items: [descriptor] });
      } else {
        bucket.items.push(descriptor);
      }
    }
    return ordered;
  }, [descriptors]);

  const write = (descriptor: SettingDescriptor, value: SettingValue): void => {
    const effective = store.write(descriptor.key, value);
    setValues((current) => ({ ...current, [descriptor.key]: effective }));
    onNotify(`「${descriptor.label}」已更新（${EFFECT_LAYER_LABEL}）`);
  };

  const reset = (descriptor: SettingDescriptor): void => {
    const fallback = store.reset(descriptor.key);
    setValues((current) => ({ ...current, [descriptor.key]: fallback }));
    onNotify(`「${descriptor.label}」已恢复默认`);
  };

  const valueOf = (descriptor: SettingDescriptor): SettingValue =>
    values[descriptor.key] ?? store.read(descriptor.key);

  return (
    <SettingsLayout subtitle={`生效层：${EFFECT_LAYER_LABEL}`}>
      {groups.map((group) => (
        <SettingsGroup key={group.group} title={group.group}>
          {group.items.map((descriptor) => (
            <SettingsRow
              key={descriptor.key}
              label={descriptor.advanced ? `${descriptor.label}（高级）` : descriptor.label}
              description={descriptor.description}
              control={
                <SettingControl
                  descriptor={descriptor}
                  value={valueOf(descriptor)}
                  onChange={(next) => write(descriptor, next)}
                />
              }
            />
          ))}
          {group.items.some((descriptor) => !isDefaultValue(descriptor, valueOf(descriptor))) ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBlock: 4 }}>
              <Button
                size="small"
                onClick={() => {
                  for (const descriptor of group.items) {
                    if (!isDefaultValue(descriptor, valueOf(descriptor))) {
                      reset(descriptor);
                    }
                  }
                }}
              >
                恢复本组默认
              </Button>
            </div>
          ) : null}
        </SettingsGroup>
      ))}
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        偏好当前生效层：{EFFECT_LAYER_LABEL}。配置域宿主处理器落波后换接持久实现，消费面零改动。
      </Typography.Text>
    </SettingsLayout>
  );
};

/** 降级分类页属性。 */
export interface DegradedSceneProps {
  readonly sceneId: SettingsSceneId;
}

/** 按标识取场景注册表项；未登记标识直接失败（壳层保证只传在册标识）。 */
function sceneOf(sceneId: SettingsSceneId): (typeof SETTINGS_SCENES)[number] {
  const scene = SETTINGS_SCENES.find((item) => item.id === sceneId);
  if (scene === undefined) {
    throw new Error(`未登记的设置分类：${sceneId}`);
  }
  return scene;
}

/**
 * 域依赖分类页：宿主查询域未就绪期间的诚实呈现。
 *
 * 只呈现依赖域与登记去向，不呈现替代数据、不铺设不可用控件（不做占位实现）；
 * 域处理器随宿主波次落位后本页按《05-生态设置面板设计》对应节启用。
 */
export const DegradedScene: FC<DegradedSceneProps> = ({ sceneId }) => {
  const registry = useMemo(() => sceneOf(sceneId), [sceneId]);
  const { token } = theme.useToken();
  return (
    <SettingsLayout title={registry.title} subtitle="该分类依赖的宿主查询域尚未就绪">
      <StateBoundary empty emptyText="暂无可呈现数据" />
      <Alert
        type="info"
        showIcon
        message="依赖域缺位说明"
        description={
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}>
            <span>所需能力族：{registry.requiredDomains.join('、')}</span>
            <span>
              {registry.requiredDomains.includes('config:get') ? 'config:get 域缺位已在册工单066；' : ''}
              其余域按宿主缺位勘查账随波落位，落位后本页启用对应治理界面。
            </span>
          </div>
        }
      />
      <Typography.Text type="secondary">
        本页不做占位实现：宿主查询域落位前不呈现替代内容或不可用控件。
      </Typography.Text>
    </SettingsLayout>
  );
};
