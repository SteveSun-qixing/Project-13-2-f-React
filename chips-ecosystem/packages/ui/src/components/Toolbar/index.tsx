/**
 * 工具栏：按 `toolbarId` 过滤并渲染命令视图按钮组。
 *
 * 契约：《13-命令系统契约》§5.1、§5.4——只消费 `ICommandView`，触发一律经 `command:invoke`
 * （`source: 'toolbar'`）；`iconUri` 缺失时不渲染占位图，退化为纯文字按钮；
 * `enabled=false` 渲染为禁用并展示 `state.reason`。
 */

import { App, Button, Tooltip, Typography, theme } from '@chips/antd';
import React from 'react';

import { formatAccelerator } from '../../command/accelerator';
import { useCommandRuntime, useCommandViews } from '../../command/context';
import type { ICommandToolbarPlacement, ICommandView } from '../../command/contract';
import { chipsGlassSurface } from '../../tokens/glass';
import { toChipsUiFailure } from '../../utils';

import type { ToolbarProps } from './types';

/** 取视图在指定工具栏上的放置信息；未放置返回 `null`。 */
function findPlacement(view: ICommandView, toolbarId: string): ICommandToolbarPlacement | null {
  const placements = view.definition.toolbars ?? [];
  return placements.find((placement) => placement.toolbarId === toolbarId) ?? null;
}

/** 取快捷键展示文本：命令记录的 `shortcut` 首个绑定。 */
function shortcutHint(view: ICommandView): string | undefined {
  const shortcut = view.definition.shortcut;
  if (shortcut === undefined) {
    return undefined;
  }
  const first = typeof shortcut === 'string' ? shortcut : shortcut[0];
  return typeof first === 'string' && first.length > 0 ? formatAccelerator(first) : undefined;
}

export const Toolbar: React.FC<ToolbarProps> = ({ toolbarId, children }) => {
  const { token } = theme.useToken();
  const runtime = useCommandRuntime();
  const { views, error } = useCommandViews();
  const { message } = App.useApp();

  const placements = React.useMemo(() => {
    const matched: {
      readonly view: ICommandView;
      readonly order: number;
      readonly index: number;
    }[] = [];
    views.forEach((view, index) => {
      const placement = findPlacement(view, toolbarId);
      if (placement === null || !view.state.visible) {
        return;
      }
      matched.push({ view, order: placement.order ?? Number.MAX_SAFE_INTEGER, index });
    });
    return matched.sort((left, right) =>
      left.order === right.order ? left.index - right.index : left.order - right.order
    );
  }, [views, toolbarId]);

  const handleInvoke = React.useCallback(
    (commandId: string): void => {
      runtime.invoke({ commandId, source: 'toolbar' }).catch((cause: unknown) => {
        message.error(toChipsUiFailure(cause, '命令执行失败，请重试').message);
      });
    },
    [message, runtime]
  );

  return (
    <div
      style={{
        ...chipsGlassSurface(token),
        display: 'flex',
        alignItems: 'center',
        gap: token.marginXXS,
        flexShrink: 0,
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
      }}
    >
      {error === null ? null : (
        <Typography.Text style={{ fontSize: token.fontSizeSM, color: token.colorError }}>
          {error.message}
        </Typography.Text>
      )}
      {placements.map(({ view }) => {
        const { definition, state } = view;
        const hint = shortcutHint(view);
        const tooltipTitle =
          state.enabled || state.reason === undefined
            ? hint === undefined
              ? definition.title
              : `${definition.title}（${hint}）`
            : `${definition.title}：${state.reason}`;
        return (
          <Tooltip key={definition.id} title={tooltipTitle}>
            <Button
              type="text"
              disabled={!state.enabled}
              aria-label={definition.title}
              icon={
                view.iconUri === null ? undefined : (
                  <img
                    src={view.iconUri}
                    alt=""
                    aria-hidden="true"
                    style={{ width: token.fontSizeXL, height: token.fontSizeXL }}
                  />
                )
              }
              onClick={() => {
                handleInvoke(definition.id);
              }}
            >
              {view.iconUri === null ? definition.title : undefined}
            </Button>
          </Tooltip>
        );
      })}
      {children}
    </div>
  );
};

export type { ToolbarProps } from './types';
