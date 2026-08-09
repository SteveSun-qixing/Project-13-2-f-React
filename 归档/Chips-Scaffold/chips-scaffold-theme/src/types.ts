import path from 'node:path';

export interface ThemeTemplateMeta {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
}

export interface CreateThemeProjectOptions {
  /**
   * 目标目录，可以是相对路径或绝对路径。
   * 目录不存在时会自动创建；存在但非空时会抛出错误。
   */
  targetDir: string;
  /**
   * 模板 ID，目前支持：theme-standard。
   * 省略时默认使用 theme-standard。
   */
  templateId?: string;
  /**
   * 主题技术 ID，例如：chips-official.default-theme。
   */
  themeId: string;
  /**
   * 主题显示名称，例如：薯片官方 · 默认主题。
   */
  displayName: string;
  /**
   * 插件 ID（反向域名格式）。未指定时将基于 themeId 自动推导。
   */
  pluginId?: string;
  /**
   * 插件版本号，使用语义化版本规范。未指定时默认 1.0.0。
   */
  version?: string;
  /**
   * 主题描述信息。
   */
  description?: string;
  /**
   * 发行商标识（可选），用于文档或后续生态工具显示。
   */
  publisher?: string;
  /**
   * 父主题 ID（可选），用于主题继承场景。
   */
  parentThemeId?: string;
}

export interface ResolvedCreateThemeProjectOptions extends CreateThemeProjectOptions {
  targetDir: string;
  templateId: string;
  pluginId: string;
  version: string;
}

export const DEFAULT_THEME_TEMPLATE_ID = 'theme-standard';

export const normalizeCreateOptions = (input: CreateThemeProjectOptions): ResolvedCreateThemeProjectOptions => {
  const targetDir = path.resolve(input.targetDir);
  const templateId = input.templateId && input.templateId.trim().length > 0 ? input.templateId : DEFAULT_THEME_TEMPLATE_ID;
  const themeId = input.themeId.trim();
  const displayName = input.displayName.trim();

  if (!themeId) {
    throw new Error('themeId is required.');
  }
  if (!displayName) {
    throw new Error('displayName is required.');
  }

  const version = (input.version && input.version.trim()) || '1.0.0';
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`version must be a valid semantic version, got: ${version}`);
  }

  const pluginId = resolvePluginId(input.pluginId, themeId);

  return {
    ...input,
    targetDir,
    templateId,
    themeId,
    displayName,
    pluginId,
    version
  };
};

const resolvePluginId = (explicitId: string | undefined, themeId: string): string => {
  if (explicitId && explicitId.trim().length > 0) {
    const trimmed = explicitId.trim();
    validatePluginId(trimmed);
    return trimmed;
  }

  const normalized = themeId.toLowerCase();
  if (normalized.includes(':')) {
    const [publisher = 'chips', name = 'theme'] = normalized.split(':');
    const safePublisher = publisher.replace(/[^a-z0-9-]+/g, '-');
    const safeName = name.replace(/[^a-z0-9-]+/g, '-');
    const candidate = `theme.${safeName}.${safePublisher}`;
    validatePluginId(candidate);
    return candidate;
  }

  const safeThemeId = normalized.replace(/[^a-z0-9-]+/g, '-');
  const candidate = `theme.theme.${safeThemeId}`;
  validatePluginId(candidate);
  return candidate;
};

const validatePluginId = (id: string): void => {
  const pattern = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;
  if (!pattern.test(id)) {
    throw new Error(
      `pluginId must use reverse-domain format (e.g. com.example.my-theme), got: ${id}`
    );
  }
};
