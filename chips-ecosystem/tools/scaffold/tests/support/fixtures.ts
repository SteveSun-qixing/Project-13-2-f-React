import { createScaffoldPlan } from '../../src/generator.js';
import type { IScaffoldOptions, IScaffoldPlan, PluginRole } from '../../src/types.js';

/** 四个角色的规范选项：与《02-SDK-API规范》§8.2、§8.6 的示例一致。 */
export const CANONICAL_OPTIONS: Readonly<Record<PluginRole, IScaffoldOptions>> = {
  basecard: {
    role: 'basecard',
    pluginId: 'chips.basecard.markdown',
    name: 'Markdown 卡片',
    description: 'Markdown 文件与内联内容卡片',
    author: '薯片官方',
    targetDir: 'plugins/markdown-card',
  },
  boxlayout: {
    role: 'boxlayout',
    pluginId: 'chips.layout.grid',
    name: '网格布局',
    description: '以网格方式排列箱子条目',
    author: '薯片官方',
    targetDir: 'plugins/grid-layout',
  },
  app: {
    role: 'app',
    pluginId: 'chips.official.viewer',
    name: '卡片查看器',
    description: '打开并查看卡片',
    author: '薯片官方',
    targetDir: 'plugins/viewer',
  },
  service: {
    role: 'service',
    pluginId: 'chips.service.file-processing',
    name: '文件处理服务',
    description: '后台文件处理任务与健康检查',
    author: '薯片官方',
    targetDir: 'plugins/file-processing',
  },
};

/** 生成规范计划。 */
export function canonicalPlan(
  role: PluginRole,
  overrides: Partial<IScaffoldOptions> = {}
): IScaffoldPlan {
  return createScaffoldPlan({ ...CANONICAL_OPTIONS[role], ...overrides });
}

/** 文件计划转 Map，便于按路径断言。 */
export function fileMap(plan: IScaffoldPlan): Map<string, string> {
  return new Map(plan.files.map((file) => [file.path, file.content]));
}

/** 按路径读取生成文件内容。 */
export function readFile(plan: IScaffoldPlan, path: string): string {
  const content = fileMap(plan).get(path);
  if (content === undefined) {
    throw new Error(`计划中不存在文件：${path}`);
  }
  return content;
}
