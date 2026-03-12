#!/usr/bin/env node

import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_ROOT = path.join(ROOT, "templates");

/** 简单的模板完整性检查脚本，用于在 CI 中作为质量门禁的一部分。 */

async function main() {
  const entries = await readdir(TEMPLATES_ROOT, { withFileTypes: true });
  const templateDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (templateDirs.length === 0) {
    console.error("[check-templates] 未找到任何模板目录");
    process.exitCode = 1;
    return;
  }

  const requiredFiles = [
    "template.json",
    "manifest.yaml.tpl",
    "package.json.tpl",
    ".eslintrc.cjs.tpl",
    "tsconfig.json.tpl",
    "chips.config.mjs.tpl",
    "README.md.tpl",
    "index.html.tpl",
    "src/main.tsx.tpl",
    "src/App.tsx.tpl",
    "src/i18n.ts.tpl",
    "config/app-config.ts.tpl",
    "config/logging.ts.tpl",
    "i18n/zh-CN.json.tpl",
    "i18n/en-US.json.tpl",
    "assets/icons/app-icon.ico",
    "tests/unit/app.test.tsx.tpl",
    "tests/e2e/basic-flow.test.ts.tpl"
  ];

  let hasError = false;

  for (const dir of templateDirs) {
    const base = path.join(TEMPLATES_ROOT, dir);
    try {
      const metaPath = path.join(base, "template.json");
      const raw = await readFile(metaPath, "utf8");
      const meta = JSON.parse(raw);
      if (!meta.id || meta.id !== dir) {
        console.error(
          `[check-templates] 模板 ${dir} 的 template.json.id 不匹配目录名`,
        );
        hasError = true;
      }
    } catch (error) {
      console.error(
        `[check-templates] 模板 ${dir} 的 template.json 无法读取或解析`,
        error,
      );
      hasError = true;
    }

    for (const rel of requiredFiles) {
      const p = path.join(base, rel);
      try {
        const s = await stat(p);
        if (!s.isFile()) {
          console.error(
            `[check-templates] 模板 ${dir} 缺少关键文件（非文件）：${rel}`,
          );
          hasError = true;
        }
      } catch {
        console.error(
          `[check-templates] 模板 ${dir} 缺少关键文件：${rel}`,
        );
        hasError = true;
      }
    }
  }

  if (hasError) {
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log("[check-templates] 模板结构检查通过");
  }
}

main().catch((error) => {
  console.error("[check-templates] 执行失败", error);
  process.exitCode = 1;
});
