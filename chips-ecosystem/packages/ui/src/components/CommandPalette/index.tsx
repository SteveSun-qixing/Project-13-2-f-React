/**
 * 命令面板：搜索、分组、参数采集与调用。
 *
 * 契约：《13-命令系统契约》§5.1、§5.2——经运行时 `list` 取视图，按 `group` 分组；
 * 搜索匹配 `title` / `description` / `keywords`（大小写不敏感子串）；`visible=false` 不渲染，
 * `enabled=false` 渲染为禁用并展示 `state.reason`；参数型命令先在面板内采集参数；
 * 触发以 `source: 'palette'` 经 `command:invoke` 完成；文案与图标直接取视图字段。
 * 面板按需挂载：关闭时不保留弹层节点与已采集的参数状态。
 */

import { App, Button, Empty, Flex, Input, Modal, Typography, theme } from '@chips/antd';
import React from 'react';

import {
  formatAccelerator,
  isEditableContext,
  matchesAccelerator,
} from '../../command/accelerator';
import { useCommandRuntime, useCommandViews } from '../../command/context';
import type { ICommandView } from '../../command/contract';
import { describeCommandParams, shouldCollectCommandParams } from '../../command/params';
import type { ICommandParamField } from '../../command/params';
import { toChipsUiFailure } from '../../utils';
import { StateBoundary } from '../StateBoundary';

import { CommandParamsForm } from './CommandParamsForm';
import type { CommandPaletteProps } from './types';

/** 默认分组名：未声明 `definition.group` 的命令归入该分组（简体中文）。 */
export const DEFAULT_COMMAND_GROUP = '常规';

/** 默认面板快捷键（与《08》§2.2 一致）。 */
export const DEFAULT_PALETTE_SHORTCUT = 'CommandOrControl+P';

/** 分组：按视图原始顺序（平台已按 `group`、`order`、注册顺序排列）切分。 */
interface ICommandGroup {
  readonly label: string;
  readonly views: readonly ICommandView[];
}

function groupViews(views: readonly ICommandView[]): readonly ICommandGroup[] {
  const groups: { label: string; views: ICommandView[] }[] = [];
  for (const view of views) {
    const label = view.definition.group ?? DEFAULT_COMMAND_GROUP;
    const existing = groups.find((group) => group.label === label);
    if (existing === undefined) {
      groups.push({ label, views: [view] });
    } else {
      existing.views.push(view);
    }
  }
  return groups;
}

function matchesQuery(view: ICommandView, query: string): boolean {
  const { definition } = view;
  const haystacks = [
    definition.title,
    definition.description ?? '',
    ...(definition.keywords ?? []),
  ];
  return haystacks.some((text) => text.toLowerCase().includes(query));
}

/** 首条可执行（enabled）命令。 */
function firstEnabled(views: readonly ICommandView[]): ICommandView | null {
  return views.find((view) => view.state.enabled) ?? null;
}

/** 快捷键展示文本（命令记录的 `shortcut` 首个绑定）。 */
function shortcutHint(view: ICommandView): string | null {
  const shortcut = view.definition.shortcut;
  if (shortcut === undefined) {
    return null;
  }
  const first = typeof shortcut === 'string' ? shortcut : shortcut[0];
  return typeof first === 'string' && first.length > 0 ? formatAccelerator(first) : null;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  paletteShortcut = DEFAULT_PALETTE_SHORTCUT,
  placeholder = '输入命令名称…',
  emptyText = '没有匹配的命令',
}) => {
  const { token } = theme.useToken();
  const runtime = useCommandRuntime();
  const { message } = App.useApp();
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlled ? open : internalOpen;
  const [query, setQuery] = React.useState('');
  const [paramsView, setParamsView] = React.useState<ICommandView | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const { views, loading, error, reload } = useCommandViews({ enabled: isOpen });

  const close = React.useCallback((): void => {
    if (!controlled) {
      setInternalOpen(false);
    }
    onClose?.();
  }, [controlled, onClose]);

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setParamsView(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (controlled) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!matchesAccelerator(event, paletteShortcut) || isEditableContext(event.target)) {
        return;
      }
      event.preventDefault();
      setInternalOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controlled, paletteShortcut]);

  const { available, groups } = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = views.filter((view) => view.state.visible);
    const filtered =
      normalized.length === 0 ? visible : visible.filter((view) => matchesQuery(view, normalized));
    return { available: filtered, groups: groupViews(filtered) };
  }, [views, query]);

  const fields: readonly ICommandParamField[] = React.useMemo(
    () => (paramsView === null ? [] : describeCommandParams(paramsView.definition.paramsSchema)),
    [paramsView]
  );

  const runView = React.useCallback(
    (view: ICommandView, payload?: unknown): void => {
      const input = {
        commandId: view.definition.id,
        source: 'palette' as const,
        ...(payload === undefined ? {} : { payload }),
      };
      setSubmitting(true);
      runtime.invoke(input).then(
        () => {
          setSubmitting(false);
          close();
        },
        (cause: unknown) => {
          setSubmitting(false);
          message.error(toChipsUiFailure(cause, '命令执行失败，请重试').message);
        }
      );
    },
    [close, message, runtime]
  );

  const activateView = React.useCallback(
    (view: ICommandView): void => {
      if (!view.state.enabled) {
        return;
      }
      if (shouldCollectCommandParams(view.definition.paramsSchema)) {
        setParamsView(view);
        return;
      }
      runView(view);
    },
    [runView]
  );

  const handleSearchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      // ESC 关闭交由弹层自身的键盘通路（`onCancel` → `close`）处理：弹层知道自己是几层里的
      // 最上层，组件不重复实现，避免嵌套弹层时一次按键触发多路关闭。
      if (event.key !== 'Enter') {
        return;
      }
      const first = firstEnabled(available);
      if (first !== null) {
        event.preventDefault();
        activateView(first);
      }
    },
    [activateView, available]
  );

  // 面板按需挂载：只在打开时挂载弹层，关闭即卸载弹层节点与采集状态（不做退场驻留）。
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      open
      onCancel={close}
      footer={null}
      closable={false}
      width={480}
      styles={{ body: { padding: token.paddingSM } }}
    >
      {paramsView === null ? (
        <Flex vertical gap={token.marginXS}>
          <Input
            autoFocus
            value={query}
            allowClear
            aria-label="搜索命令"
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <StateBoundary
              loading={loading}
              error={error}
              empty={available.length === 0}
              emptyText={emptyText}
              minHeight={120}
              onRetry={reload}
            >
              <Flex vertical gap={token.marginXXS}>
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <Typography.Text
                      style={{
                        display: 'block',
                        padding: `${token.paddingXS}px ${token.paddingXS}px ${token.marginXXS}px`,
                        fontSize: token.fontSizeSM,
                        color: token.colorTextSecondary,
                      }}
                    >
                      {group.label}
                    </Typography.Text>
                    <Flex vertical gap={token.marginXXS}>
                      {group.views.map((view) => {
                        const hint = shortcutHint(view);
                        const { state } = view;
                        return (
                          <Button
                            key={view.definition.id}
                            type="text"
                            block
                            disabled={!state.enabled}
                            aria-label={view.definition.title}
                            onClick={() => {
                              activateView(view);
                            }}
                            style={{
                              height: 'auto',
                              padding: `${token.paddingXS}px ${token.paddingSM}px`,
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                            }}
                          >
                            <Flex align="center" gap={token.marginXS} style={{ width: '100%' }}>
                              {view.iconUri === null ? null : (
                                <img
                                  src={view.iconUri}
                                  alt=""
                                  aria-hidden="true"
                                  style={{ width: token.fontSizeXL, height: token.fontSizeXL }}
                                />
                              )}
                              <Flex vertical gap={0} style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ color: token.colorText }}>
                                  {view.definition.title}
                                </span>
                                {view.definition.description === undefined ? null : (
                                  <Typography.Text
                                    style={{
                                      fontSize: token.fontSizeSM,
                                      color: token.colorTextTertiary,
                                    }}
                                  >
                                    {view.definition.description}
                                  </Typography.Text>
                                )}
                                {state.enabled || state.reason === undefined ? null : (
                                  <Typography.Text
                                    style={{ fontSize: token.fontSizeSM, color: token.colorError }}
                                  >
                                    {state.reason}
                                  </Typography.Text>
                                )}
                              </Flex>
                              {hint === null ? null : (
                                <Typography.Text
                                  style={{
                                    fontSize: token.fontSizeSM,
                                    color: token.colorTextTertiary,
                                  }}
                                >
                                  {hint}
                                </Typography.Text>
                              )}
                            </Flex>
                          </Button>
                        );
                      })}
                    </Flex>
                  </section>
                ))}
              </Flex>
            </StateBoundary>
          </div>
        </Flex>
      ) : (
        <Flex vertical gap={token.marginSM}>
          <Typography.Text strong style={{ color: token.colorText }}>
            {paramsView.definition.title}
          </Typography.Text>
          {fields.length === 0 ? (
            <Empty description="该命令没有可采集的参数" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <CommandParamsForm
              fields={fields}
              submitting={submitting}
              onSubmit={(payload) => {
                runView(paramsView, payload);
              }}
              onCancel={() => {
                setParamsView(null);
              }}
            />
          )}
        </Flex>
      )}
    </Modal>
  );
};

export type { CommandPaletteProps } from './types';
