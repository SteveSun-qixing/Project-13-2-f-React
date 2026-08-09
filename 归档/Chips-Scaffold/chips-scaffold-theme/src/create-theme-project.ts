import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { listThemeTemplates, resolveTemplateDir } from './template-registry';
import {
  DEFAULT_THEME_TEMPLATE_ID,
  type CreateThemeProjectOptions,
  type ResolvedCreateThemeProjectOptions,
  normalizeCreateOptions
} from './types';

const isDirectoryEmpty = async (dir: string): Promise<boolean> => {
  try {
    const entries = await fsp.readdir(dir);
    return entries.length === 0;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true;
    }
    throw error;
  }
};

const ensureTargetDirectory = async (dir: string): Promise<void> => {
  const stats = await fsp
    .stat(dir)
    .catch((error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? null : Promise.reject(error)));

  if (!stats) {
    await fsp.mkdir(dir, { recursive: true });
    return;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Target path exists and is not a directory: ${dir}`);
  }

  const empty = await isDirectoryEmpty(dir);
  if (!empty) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
};

interface TemplateVariables {
  pluginId: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  themeId: string;
  parentThemeId: string;
  isDefault: string;
  publisher: string;
}

const RENDERABLE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml'
]);

const renderTemplateString = (template: string, variables: TemplateVariables): string => {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return typeof value === 'string' ? value : match;
  });
};

const shouldRenderAsText = (fileName: string): boolean => {
  if (fileName.endsWith('.tpl')) {
    return true;
  }
  return RENDERABLE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
};

const copyTemplateDirectory = async (
  templateRoot: string,
  targetRoot: string,
  variables: TemplateVariables
): Promise<void> => {
  const entries = await fsp.readdir(templateRoot, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(templateRoot, entry.name);
    const renderedName = entry.name.endsWith('.tpl')
      ? entry.name.slice(0, -'.tpl'.length)
      : entry.name;
    const targetPath = path.join(targetRoot, renderedName);

    if (entry.isDirectory()) {
      await fsp.mkdir(targetPath, { recursive: true });
      await copyTemplateDirectory(sourcePath, targetPath, variables);
      continue;
    }

    await fsp.mkdir(path.dirname(targetPath), { recursive: true });

    if (shouldRenderAsText(entry.name)) {
      const raw = await fsp.readFile(sourcePath, 'utf-8');
      const rendered = renderTemplateString(raw, variables);
      await fsp.writeFile(targetPath, rendered, 'utf-8');
      continue;
    }

    await fsp.copyFile(sourcePath, targetPath);
  }
};

const buildTemplateVariables = (options: ResolvedCreateThemeProjectOptions): TemplateVariables => {
  const description =
    options.description && options.description.trim().length > 0
      ? options.description.trim()
      : `Theme package for ${options.displayName}`;

  const publisher = options.publisher?.trim() ?? '';

  return {
    pluginId: options.pluginId,
    name: options.displayName,
    displayName: options.displayName,
    description,
    version: options.version,
    themeId: options.themeId,
    parentThemeId: options.parentThemeId ?? '',
    isDefault: 'false',
    publisher
  };
};

export const createThemeProject = async (input: CreateThemeProjectOptions): Promise<void> => {
  const options = normalizeCreateOptions(input);
  const templates = listThemeTemplates();
  const templateId = options.templateId || DEFAULT_THEME_TEMPLATE_ID;

  if (!templates.some((template) => template.id === templateId)) {
    throw new Error(`Unknown theme template: ${templateId}`);
  }

  await ensureTargetDirectory(options.targetDir);

  const templateDir = resolveTemplateDir(templateId);
  const variables = buildTemplateVariables(options);

  await copyTemplateDirectory(templateDir, options.targetDir, variables);
};
