import type { ContractSources, DocReader } from '../src/types.js';

export function createMemoryReader(files: Readonly<Record<string, string>>): DocReader {
  return {
    read(relativePath: string): string {
      const content = files[relativePath];
      if (content === undefined) {
        throw new Error(`内存文档库缺少文件：${relativePath}`);
      }
      return content;
    },
  };
}

export const fixtureSources: ContractSources = {
  capability: {
    table: {
      file: 'capability.md',
      headingLevel: 3,
      heading: '6.2 内置能力与权限总表',
      headerAnchor: '能力 ID',
      capabilityColumnHeader: '能力 ID',
      permissionColumnHeader: '所需权限 ID',
    },
    declaredCountFile: 'capability.md',
    declaredCountPattern: /本表的\s*(\d+)\s*项计数/,
  },
  permission: {
    catalog: {
      file: 'permission.md',
      headingLevel: 3,
      heading: '4.1 内置权限清单总表',
      headerAnchor: '权限 ID',
      permissionColumnHeader: '权限 ID',
    },
    vocabulary: [
      {
        kind: 'domain-scope',
        table: {
          file: 'domain.md',
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
          file: 'command.md',
          headingLevel: 3,
          heading: '6.1 权限',
          headerAnchor: '权限 ID',
          permissionColumnHeader: '权限 ID',
        },
      },
    ],
    capabilityMappingCheck: {
      file: 'permission.md',
      headingLevel: 3,
      heading: '4.3 能力 → 权限映射',
      headerAnchor: '能力 ID',
      capabilityColumnHeader: '能力 ID',
      permissionColumnHeader: '所需权限',
    },
  },
  event: {
    reservedTable: {
      file: 'event-naming.md',
      headingLevel: 3,
      heading: '2.2 平台保留域',
      headerAnchor: '域',
    },
    declarations: ['event-plugin.md', 'event-file.md'],
  },
  errors: [
    {
      file: 'error.md',
      headingLevel: 2,
      heading: '八、错误码',
      note: '样例错误码',
    },
  ],
};

export const fixtureDocs: Readonly<Record<string, string>> = {
  'capability.md': `# 能力契约规范

## 六、权限映射（样例）

### 6.2 内置能力与权限总表（样例，canonical）

| 能力 ID | 所需权限 ID |
|---|---|
| \`file:read\` / \`file:list\` | \`filesystem:read\` |
| \`file:copy\` | \`filesystem:read\` + \`filesystem:write\` |
| \`window:create\` / \`window:setTitle\` | \`window:control\` |
| \`cli:task-get\` | 无（owner 归属校验） |

本表的 6 项计数只统计 Bridge 内置能力。
`,
  'permission.md': `# 权限系统设计

### 4.1 内置权限清单总表

| 权限 ID | 说明 |
|---|---|
| \`filesystem:read\` | 读取指定目录 |
| \`filesystem:write\` | 写入指定目录 |
| \`window:control\` | 窗口控制 |
| \`command:read\` | 查询命令注册表 |

### 4.3 能力 → 权限映射（样例）

| 能力 ID | 所需权限 |
|---|---|
| \`file:read\`、\`file:list\`、\`file:copy\` | \`filesystem:read\` |
| \`window:create\`、\`window:setTitle\` | \`window:control\` |
`,
  'domain.md': `# 权限系统设计

### 3.2 内置域

| domain | scope | qualifier 文法 | 限定值规则 |
|---|---|---|---|
| \`filesystem\` | \`read\`、\`write\` | 路径模式 | 必需 |
| \`window\` | \`control\` | 窗口 ID 模式 | 可选 |
`,
  'command.md': `# 命令系统契约

### 6.1 权限

| 权限 ID | 说明 | 限定值 |
|---|---|---|
| \`command:read\` | 查询命令注册表 | 无（禁止） |
`,
  'event-naming.md': `# 事件契约规范

### 2.2 平台保留域

| 域 | 发布方 | 事件清单 |
|---|---|---|
| \`plugin\` | 插件运行时 | 4.1（2 个） |
| \`file\` | 资源管理 | 4.3（1 个） |
`,
  'event-plugin.md': `# 事件契约规范

### 4.1 插件生命周期

#### plugin:installed

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| \`pluginId\` | string | 是 | 插件 ID |

#### plugin:failed

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| \`pluginId\` | string | 是 | 插件 ID |
`,
  'event-file.md': `# 事件契约规范

### 4.3 文件

#### file:changed

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| \`uri\` | string | 是 | 文件 URI |
`,
  'error.md': `# 事件契约规范

## 八、错误码

| 错误码 | 触发条件 |
|---|---|
| \`EVENT_ID_INVALID\` | 事件 ID 不符合文法 |
| \`EVENT_PUBLISH_DENIED\` | 发布保留域 |

Rust 侧归一示例：\`Self::LockPoisoned => "KERNEL_LOCK_POISONED"\`；通配族 \`EVENT_*\` 不生成。
`,
};
