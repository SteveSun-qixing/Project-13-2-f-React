import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { ContractSources, ErrorSourceConfig } from './types.js';

const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 生态工作区根：`chips-ecosystem/`。 */
export const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

/** 仓库根：包含 `薯片生态文档库/` 与 `重构大计划/`。 */
export const REPO_ROOT = path.resolve(WORKSPACE_ROOT, '..');

export const DEFAULT_DOCS_ROOT = path.join(REPO_ROOT, '薯片生态文档库');

export const DEFAULT_OUT_DIR = path.join(WORKSPACE_ROOT, 'packages/sdk/src/generated');

const CAPABILITY_SPEC = '05-接口与契约/04.06-04-能力契约规范-六、权限映射（R19 全表）.md';
const CAPABILITY_ERROR_SPEC = '05-接口与契约/04.26-04-能力契约规范-十一、错误码.md';
const PERMISSION_SPEC = '01-架构设计/01-子系统设计/08.04-08-权限系统设计-四、内置权限清单与映射.md';
const PERMISSION_VOCAB_SPEC = '01-架构设计/01-子系统设计/08.03-08-权限系统设计-三、权限 ID 体系.md';
const COMMAND_PERMISSION_SPEC = '05-接口与契约/13.06-13-命令系统契约-六、权限与审计.md';
const EVENT_NAMING_SPEC = '05-接口与契约/05.02-05-事件契约规范-二、命名契约.md';

const errorSources: readonly ErrorSourceConfig[] = [
  {
    file: '01-架构设计/01-子系统设计/02.09-02-Bridge三层设计-九、错误归一.md',
    headingLevel: 3,
    heading: '9.2 Bridge 错误码表',
    note: 'Bridge 通道级错误码',
  },
  {
    file: CAPABILITY_ERROR_SPEC,
    headingLevel: 3,
    heading: '11.2 注册与契约错误码',
    note: '能力注册与契约错误码',
  },
  {
    file: CAPABILITY_ERROR_SPEC,
    headingLevel: 3,
    heading: '11.3 调用错误码',
    note: '能力调用相关错误码',
  },
  {
    file: CAPABILITY_ERROR_SPEC,
    headingLevel: 3,
    heading: '11.4 各域业务错误码',
    note: '内置能力各域业务错误码',
  },
  {
    file: '05-接口与契约/05.18-05-事件契约规范-八、错误码.md',
    headingLevel: 2,
    heading: '八、错误码',
    note: '事件契约错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/08.09-08-权限系统设计-九、拒绝错误码与提示.md',
    headingLevel: 3,
    heading: '9.1 错误码总表',
    note: '权限拒绝错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/01.09-01-薯片内核设计-九、错误传播.md',
    headingLevel: 2,
    heading: '九、错误传播',
    note: '内核错误码',
  },
  {
    file: '05-接口与契约/06.07-06-资源协议规范-七、错误码.md',
    headingLevel: 2,
    heading: '七、错误码',
    note: '资源协议错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/06.08-06-文档解析器设计-八、错误与修复策略.md',
    headingLevel: 3,
    heading: '8.2 致命错误码',
    note: '文档解析致命错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/10.04-10-配置系统设计-四、Schema 与校验.md',
    headingLevel: 3,
    heading: '4.4 错误码',
    note: '配置系统错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/11.10-11-文档服务设计-十、错误码.md',
    headingLevel: 2,
    heading: '十、错误码',
    note: '文档服务错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/12.09-12-编辑引擎设计-九、错误与降级.md',
    headingLevel: 2,
    heading: '九、错误与降级',
    note: '编辑引擎错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/05.11-05-渲染引擎设计-十一、错误模型.md',
    headingLevel: 2,
    heading: '十一、错误模型',
    note: '渲染引擎错误码',
  },
  {
    file: '05-接口与契约/13.07-13-命令系统契约-七、冲突与错误.md',
    headingLevel: 2,
    heading: '七、冲突与错误',
    note: '命令系统错误码',
  },
  {
    file: '05-接口与契约/14.10-14-资源打开与默认处理器契约-十、错误码.md',
    headingLevel: 2,
    heading: '十、错误码',
    note: '资源打开链路错误码',
  },
  {
    file: '05-接口与契约/15.06-15-文件处理契约-六、错误码.md',
    headingLevel: 2,
    heading: '六、错误码',
    note: '文件处理契约错误码',
  },
  {
    file: '05-接口与契约/07.08-07-应用插件接口-八、错误处理.md',
    headingLevel: 2,
    heading: '八、错误处理',
    note: '应用插件错误码',
  },
  {
    file: '05-接口与契约/08.16-08-基础卡片插件接口-十、错误与约束.md',
    headingLevel: 3,
    heading: '10.1 错误码',
    note: '基础卡片插件错误码',
  },
  {
    file: '05-接口与契约/16.18-16-卡片传输协议-八、错误码.md',
    headingLevel: 3,
    heading: '8.2 客户端错误码',
    note: '卡片传输客户端错误码',
  },
  {
    file: '05-接口与契约/04.23-04-能力契约规范-八、内容处理服务能力.md',
    headingLevel: 3,
    heading: '8.6 错误码',
    note: '内容处理服务代表性错误码（完整码随提供方契约发布）',
  },
  {
    file: '04-文件格式规范/03.08-03-插件包格式-八、错误码.md',
    headingLevel: 2,
    heading: '八、错误码',
    note: '插件包校验错误码',
  },
];

/** 标准事件声明文件（按 05.02 §2.2 保留域顺序）。 */
const eventDeclarationFiles: readonly string[] = [
  '05-接口与契约/05.05-05-事件契约规范-四、标准事件-4.1 插件生命周期.md',
  '05-接口与契约/05.06-05-事件契约规范-四、标准事件-4.2 文档.md',
  '05-接口与契约/05.07-05-事件契约规范-四、标准事件-4.3 文件.md',
  '05-接口与契约/05.08-05-事件契约规范-四、标准事件-4.4 资源.md',
  '05-接口与契约/05.09-05-事件契约规范-四、标准事件-4.5 配置.md',
  '05-接口与契约/05.10-05-事件契约规范-四、标准事件-4.6 安全与审计.md',
  '05-接口与契约/05.11-05-事件契约规范-四、标准事件-4.7 窗口与应用.md',
  '05-接口与契约/05.12-05-事件契约规范-四、标准事件-4.8 同步.md',
  '05-接口与契约/05.04-05-事件契约规范-四、标准事件.md',
  '05-接口与契约/05.13-05-事件契约规范-四、标准事件-4.10 托盘、快捷键与传输.md',
];

export const contractSources: ContractSources = {
  capability: {
    table: {
      file: CAPABILITY_SPEC,
      headingLevel: 3,
      heading: '6.2 内置能力与权限总表',
      headerAnchor: '能力 ID',
      capabilityColumnHeader: '能力 ID',
      permissionColumnHeader: '所需权限 ID',
    },
    declaredCountFile: CAPABILITY_SPEC,
    declaredCountPattern: /本表的\s*(\d+)\s*项计数/,
  },
  permission: {
    catalog: {
      file: PERMISSION_SPEC,
      headingLevel: 3,
      heading: '4.1 内置权限清单总表',
      headerAnchor: '权限 ID',
      permissionColumnHeader: '权限 ID',
    },
    vocabulary: [
      {
        kind: 'domain-scope',
        table: {
          file: PERMISSION_VOCAB_SPEC,
          headingLevel: 3,
          heading: '3.2 内置域',
          headerAnchor: 'domain',
          domainColumnHeader: 'domain',
          scopeColumnHeader: 'scope',
        },
      },
      {
        kind: 'permission-id',
        table: {
          file: COMMAND_PERMISSION_SPEC,
          headingLevel: 3,
          heading: '6.1 权限',
          headerAnchor: '权限 ID',
          permissionColumnHeader: '权限 ID',
        },
      },
    ],
    capabilityMappingCheck: {
      file: PERMISSION_SPEC,
      headingLevel: 3,
      heading: '4.3 能力 → 权限映射',
      headerAnchor: '能力 ID',
      capabilityColumnHeader: '能力 ID',
      permissionColumnHeader: '所需权限',
    },
  },
  event: {
    reservedTable: {
      file: EVENT_NAMING_SPEC,
      headingLevel: 3,
      heading: '2.2 平台保留域',
      headerAnchor: '域',
    },
    declarations: eventDeclarationFiles,
  },
  errors: errorSources,
};
