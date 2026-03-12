import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createError } from "./errors.js";
import type {
  AppScaffoldTemplateMeta,
  CreateAppProjectOptions,
  TemplateContext,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTERNAL_TEMPLATE_FILES = new Set(["template.json"]);

function resolveTemplatesRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../../templates"),
    path.resolve(__dirname, "../../../templates"),
    path.resolve(process.cwd(), "templates"),
  ];

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw createError("TEMPLATE_NOT_FOUND", "无法解析模板根目录", {
    candidates,
  });
}

const TEMPLATES_ROOT = resolveTemplatesRoot();

export async function listTemplateMetas(): Promise<AppScaffoldTemplateMeta[]> {
  const entries = await fs.readdir(TEMPLATES_ROOT, { withFileTypes: true });
  const metas: AppScaffoldTemplateMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const templateDir = path.join(TEMPLATES_ROOT, entry.name);
    const metaPath = path.join(templateDir, "template.json");
    try {
      const raw = await fs.readFile(metaPath, "utf8");
      const parsed = JSON.parse(raw) as AppScaffoldTemplateMeta;
      if (!parsed.id || !parsed.name) {
        throw new Error("template meta missing id or name");
      }
      metas.push(parsed);
    } catch (error) {
      throw createError("TEMPLATE_INVALID", "模板元数据无效", {
        templateDir,
        error,
      });
    }
  }

  return metas;
}

export async function getTemplateMeta(
  templateId: string,
): Promise<{ meta: AppScaffoldTemplateMeta; templateDir: string }> {
  const metas = await listTemplateMetas();
  const meta = metas.find((m) => m.id === templateId);
  if (!meta) {
    throw createError("TEMPLATE_NOT_FOUND", "未找到指定模板", { templateId });
  }
  const templateDir = path.join(TEMPLATES_ROOT, templateId);
  return { meta, templateDir };
}

function buildContext(options: CreateAppProjectOptions): TemplateContext {
  const {
    projectName,
    targetDir,
    templateId,
    pluginId,
    displayName,
    version,
    authorName,
    authorEmail,
  } = options;

  if (!projectName || !pluginId || !displayName || !version) {
    throw createError("INVALID_ARGUMENT", "缺少必填参数", { options });
  }

  return {
    PROJECT_NAME: projectName,
    TARGET_DIR: targetDir,
    TEMPLATE_ID: templateId,
    PLUGIN_ID: pluginId,
    DISPLAY_NAME: displayName,
    VERSION: version,
    AUTHOR_NAME: authorName,
    AUTHOR_EMAIL: authorEmail,
  };
}

async function ensureTargetDirEmpty(targetDir: string): Promise<void> {
  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw createError(
        "TARGET_DIR_NOT_DIRECTORY",
        "目标路径已存在且不是目录",
        { targetDir },
      );
    }
    const existing = await fs.readdir(targetDir);
    if (existing.length > 0) {
      throw createError(
        "TARGET_DIR_EXISTS",
        "目标目录已存在且非空",
        { targetDir },
      );
    }
  } catch (error: unknown) {
    const err = error as { code?: string } | undefined;
    if (err && err.code === "ENOENT") {
      await fs.mkdir(targetDir, { recursive: true });
      return;
    }
    throw error;
  }
}

function isTextLike(filename: string): boolean {
  const normalizedFilename = filename.endsWith(".tpl")
    ? filename.slice(0, -4)
    : filename;
  const ext = path.extname(normalizedFilename).toLowerCase();
  return [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".html",
    ".css",
    ".md",
    ".yaml",
    ".yml",
    ".gitignore",
    ".mjs",
  ].includes(ext);
}

function renderTemplateString(
  content: string,
  context: TemplateContext,
): string {
  const contextValues: Record<string, string | undefined> = { ...context };
  return content.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (match, key) => {
    const value = contextValues[key];
    if (value === undefined) {
      throw createError("INVALID_ARGUMENT", "模板占位符缺少对应变量", {
        placeholder: key,
      });
    }
    return value;
  });
}

async function copyTemplateDir(
  templateDir: string,
  targetDir: string,
  context: TemplateContext,
): Promise<number> {
  let filesCreated = 0;
  const entries = await fs.readdir(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    if (INTERNAL_TEMPLATE_FILES.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(templateDir, entry.name);
    const renderedName = renderTemplateString(entry.name, context).replace(
      /\.tpl$/,
      "",
    );
    const targetPath = path.join(targetDir, renderedName);

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      filesCreated += await copyTemplateDir(sourcePath, targetPath, context);
    } else if (entry.isFile()) {
      const buf = await fs.readFile(sourcePath);
      if (isTextLike(sourcePath)) {
        const rendered = renderTemplateString(buf.toString("utf8"), context);
        await fs.writeFile(targetPath, rendered, "utf8");
      } else {
        await fs.writeFile(targetPath, buf);
      }
      filesCreated += 1;
    }
  }
  return filesCreated;
}

export async function createAppProjectInternal(
  options: CreateAppProjectOptions,
): Promise<{ projectDir: string; templateId: string; filesCreated: number }> {
  const { templateId, targetDir } = options;
  const { templateDir } = await getTemplateMeta(templateId);
  const context = buildContext(options);

  await ensureTargetDirEmpty(targetDir);

  const filesCreated = await copyTemplateDir(templateDir, targetDir, context);

  // basic post-check: manifest & package.json should exist
  const manifestPath = path.join(targetDir, "manifest.yaml");
  const pkgPath = path.join(targetDir, "package.json");
  try {
    await fs.access(manifestPath);
    await fs.access(pkgPath);
  } catch {
    throw createError("TEMPLATE_INVALID", "生成工程缺少关键文件", {
      targetDir,
    });
  }

  return {
    projectDir: targetDir,
    templateId,
    filesCreated,
  };
}
