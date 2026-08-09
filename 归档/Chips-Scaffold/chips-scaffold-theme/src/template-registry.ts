import fs from 'node:fs';
import path from 'node:path';
import type { ThemeTemplateMeta } from './types';

const TEMPLATES_DIR_CANDIDATES = [
  // 打包后的结构：dist/src -> templates 位于 dist 上一层
  path.resolve(__dirname, '..', 'templates'),
  // 源码直接运行：src -> templates 位于项目根
  path.resolve(__dirname, '..', '..', 'templates')
];

const resolveTemplatesRoot = (): string => {
  for (const candidate of TEMPLATES_DIR_CANDIDATES) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  throw new Error(
    `Cannot locate templates directory. Tried: ${TEMPLATES_DIR_CANDIDATES.join(', ')}`
  );
};

const TEMPLATES_ROOT = resolveTemplatesRoot();

const BUILTIN_TEMPLATES: ThemeTemplateMeta[] = [
  {
    id: 'theme-standard',
    label: '标准主题模板',
    description: '提供完整 tokens/样式/校验脚本结构的标准主题插件模板。',
    recommended: true
  }
];

export const listThemeTemplates = (): ThemeTemplateMeta[] => {
  // 仅返回在文件系统中真实存在的模板，防止文档与实现偏离。
  return BUILTIN_TEMPLATES.filter((meta) => {
    const templateDir = path.join(TEMPLATES_ROOT, meta.id);
    return fs.existsSync(templateDir) && fs.statSync(templateDir).isDirectory();
  });
};

export const resolveTemplateDir = (templateId: string): string => {
  const templateDir = path.join(TEMPLATES_ROOT, templateId);
  if (!fs.existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) {
    throw new Error(`Unknown theme template: ${templateId}`);
  }
  return templateDir;
};

