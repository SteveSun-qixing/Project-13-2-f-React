/**
 * 命令参数采集表单（命令面板内使用）。
 *
 * 契约：《13-命令系统契约》§5.2——按 `paramsSchema` 生成采集表单；可选参数留空不写入 `payload`；
 * 平台仍是参数的最终校验者（`COMMAND_ARGS_INVALID`）。控件全部来自 `@chips/ui` 基础组件，
 * 视觉数值取 Design Tokens。
 */

import { Button, Flex, Input, Select, Space, Switch, Typography, theme } from '@chips/antd';
import React from 'react';

import type { CommandParamValue, ICommandParamField } from '../../command/params';
import { buildCommandPayload, createInitialParamValues } from '../../command/params';

export interface CommandParamsFormProps {
  /** 字段描述。 */
  readonly fields: readonly ICommandParamField[];
  /** 提交中（禁用控件并显示加载）。 */
  readonly submitting: boolean;
  /** 提交回调：拿到已校验并组装好的 `payload`。 */
  readonly onSubmit: (payload: Readonly<Record<string, unknown>>) => void;
  /** 返回命令列表。 */
  readonly onCancel: () => void;
}

export const CommandParamsForm: React.FC<CommandParamsFormProps> = ({
  fields,
  submitting,
  onSubmit,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const [values, setValues] = React.useState<Readonly<Record<string, CommandParamValue>>>(() =>
    createInitialParamValues(fields)
  );
  const [errors, setErrors] = React.useState<Readonly<Record<string, string>>>({});

  React.useEffect(() => {
    setValues(createInitialParamValues(fields));
    setErrors({});
  }, [fields]);

  const updateValue = React.useCallback((name: string, value: CommandParamValue): void => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const handleSubmit = React.useCallback((): void => {
    const result = buildCommandPayload(fields, values);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.payload);
  }, [fields, onSubmit, values]);

  return (
    <Flex vertical gap={token.marginSM} style={{ padding: `${token.paddingXS}px 0` }}>
      {fields.map((field) => {
        const error = errors[field.name];
        const inputId = `chips-command-param-${field.name}`;
        return (
          <Flex key={field.name} vertical gap={token.marginXXS}>
            <Typography.Text
              style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}
            >
              {field.title}
              {field.required ? (
                <Typography.Text style={{ color: token.colorError }}> *</Typography.Text>
              ) : null}
            </Typography.Text>
            {field.kind === 'boolean' ? (
              <Switch
                id={inputId}
                checked={values[field.name] === true}
                disabled={submitting}
                aria-label={field.title}
                onChange={(checked) => {
                  updateValue(field.name, checked);
                }}
              />
            ) : field.kind === 'enum' ? (
              <Select
                id={inputId}
                value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
                disabled={submitting}
                aria-label={field.title}
                placeholder={field.description ?? `请选择${field.title}`}
                options={(field.options ?? []).map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
                onChange={(next: string) => {
                  updateValue(field.name, next);
                }}
              />
            ) : field.kind === 'multi-enum' ? (
              <Select
                id={inputId}
                mode="multiple"
                value={
                  Array.isArray(values[field.name]) ? [...(values[field.name] as string[])] : []
                }
                disabled={submitting}
                aria-label={field.title}
                placeholder={field.description ?? `请选择${field.title}`}
                options={(field.options ?? []).map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
                onChange={(next: string[]) => {
                  updateValue(field.name, next);
                }}
              />
            ) : field.kind === 'json' ? (
              <Input.TextArea
                id={inputId}
                rows={3}
                value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
                disabled={submitting}
                aria-label={field.title}
                placeholder={field.description ?? `请输入${field.title}（JSON）`}
                onChange={(event) => {
                  updateValue(field.name, event.target.value);
                }}
              />
            ) : (
              <Input
                id={inputId}
                type={field.kind === 'number' ? 'number' : 'text'}
                value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
                disabled={submitting}
                aria-label={field.title}
                placeholder={field.description ?? `请输入${field.title}`}
                {...(field.maxLength === undefined ? {} : { maxLength: field.maxLength })}
                onChange={(event) => {
                  updateValue(field.name, event.target.value);
                }}
              />
            )}
            {error === undefined ? null : (
              <Typography.Text style={{ fontSize: token.fontSizeSM, color: token.colorError }}>
                {error}
              </Typography.Text>
            )}
          </Flex>
        );
      })}
      <Space>
        {/* 关闭 antd 双字按钮的自动字距：无障碍名称与界面文案逐字一致。 */}
        <Button type="primary" autoInsertSpace={false} loading={submitting} onClick={handleSubmit}>
          执行
        </Button>
        <Button autoInsertSpace={false} disabled={submitting} onClick={onCancel}>
          返回
        </Button>
      </Space>
    </Flex>
  );
};
