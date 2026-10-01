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
import { configErrorGuidance } from '../domain/settings/configGateway';
import type { UsePreferenceRuntimeResult } from './usePreferenceRuntime';

/** 默认窗口宽度可选档（整数键；键入任意 ≥640 整数亦可提交）。 */
const WIDTH_PRESETS: readonly number[] = [960, 1200, 1440, 1680, 1920];

/** 聚合生效层的如实呈现文案（§2.4 生效层标记；§8.2 不伪造持久化成功）。 */
function effectLayerSubtitle(layer: string): string {
  if (layer === 'user') {
    return '生效层：用户层持久化配置（未覆盖项为默认值）';
  }
  if (layer === 'default') {
    return '生效层：默认值（无显式覆盖）';
  }
  return '生效层：会话内存（未持久化）';
}

/** 单项控件属性。 */
interface SettingControlProps {
  readonly descriptor: SettingDescriptor;
  readonly value: SettingValue;
  readonly busy: boolean;
  readonly onChange: (value: SettingValue) => void;
}

/** 偏好项控件：枚举 → Select、布尔 → Switch、整数 → 预设档 + 键入（InputNumber 属禁面组件）。 */
const SettingControl: FC<SettingControlProps> = ({ descriptor, value, busy, onChange }) => {
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  if (descriptor.kind === 'boolean') {
    return (
      <Switch
        checked={value === true}
        loading={busy}
        disabled={busy}
        onChange={(checked) => onChange(checked)}
        aria-label={descriptor.label}
      />
    );
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
        disabled={busy}
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
            loading={busy}
            disabled={busy}
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
      loading={busy}
      disabled={busy}
      options={(descriptor.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
      onChange={(picked) => onChange(picked)}
      aria-label={descriptor.label}
    />
  );
};

/** 偏好分类页属性。 */
export interface PreferenceSceneProps {
  readonly sceneId: SettingsSceneId;
  readonly runtime: UsePreferenceRuntimeResult;
}

/**
 * 偏好分类页（外观 / 行为）：注册表驱动的分组行呈现，`config:*` 真实现消费
 * （工单066 翻正第一批）。
 *
 * 即时生效（《05-生态设置面板设计》§2.4）：修改经 `config:set` 回执驱动翻正
 * （写入期间控件锁定、取值不前移），提交失败行内呈现错误码并回滚；单项/分组级
 * 「恢复默认」经 `config:reset` 清退用户层显式覆盖；生效层如实标记，通道不可用
 * 降级会话内存并以降级横幅呈现（不伪造持久化成功）。
 */
export const PreferenceScene: FC<PreferenceSceneProps> = ({ sceneId, runtime }) => {
  const { token } = theme.useToken();
  const descriptors = useMemo(() => settingsForScene(sceneId), [sceneId]);

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

  if (runtime.phase === 'loading' || runtime.snapshot === null) {
    return (
      <SettingsLayout subtitle="正在读取偏好快照">
        <StateBoundary loading minHeight={200} />
      </SettingsLayout>
    );
  }

  const snapshot = runtime.snapshot;
  const valueOf = (descriptor: SettingDescriptor): SettingValue =>
    snapshot.values[descriptor.key] ?? descriptor.defaultValue;

  const writeError = runtime.writeError;
  const sceneWriteError =
    writeError !== null && descriptors.some((descriptor) => descriptor.key === writeError.key)
      ? writeError
      : null;

  return (
    <SettingsLayout subtitle={effectLayerSubtitle(snapshot.layer)}>
      {runtime.degradeNotice !== null ? (
        <Alert
          type="warning"
          showIcon
          data-role="persistence-degraded"
          message="配置持久化通道不可用"
          description={`错误码 ${runtime.degradeNotice.code}：${runtime.degradeNotice.message}。当前偏好为会话内存态，仅本次窗口会话内有效，不写入持久配置。`}
        />
      ) : null}
      {sceneWriteError !== null ? (
        <Alert
          type="error"
          showIcon
          data-role="preference-error"
          message={`偏好写入失败（${sceneWriteError.code}）`}
          description={`${sceneWriteError.message}：${configErrorGuidance(sceneWriteError.code)}`}
        />
      ) : null}
      {groups.map((group) => {
        const overriddenKeys = group.items
          .filter((descriptor) => !isDefaultValue(descriptor, valueOf(descriptor)))
          .map((descriptor) => descriptor.key);
        return (
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
                    busy={runtime.busyKeys.has(descriptor.key)}
                    onChange={(next) => runtime.writeKey(descriptor.key, next)}
                  />
                }
              />
            ))}
            {overriddenKeys.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBlock: 4 }}>
                <Button
                  size="small"
                  onClick={() => runtime.resetKeys(overriddenKeys, group.group)}
                >
                  恢复本组默认
                </Button>
              </div>
            ) : null}
          </SettingsGroup>
        );
      })}
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        偏好经平台配置域（config:*）读写并持久化到用户层；修改即时生效，恢复默认即清退用户层显式覆盖。
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
              {registry.requiredDomains.includes('config:get')
                ? 'config:get 域已随工单066 第一批翻正就位；工作区状态查询与 shell:openExternal 域仍待落波，'
                : ''}
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
