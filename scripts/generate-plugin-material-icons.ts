import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ICON_TARGETS } from "./icon-targets.mjs";

type IconKind = "app" | "basecard" | "layout" | "template";

interface IconTarget {
  kind: IconKind;
  sourceBaseName: string;
  materialName: string;
  projectDir?: string;
  projectIconBaseName?: string;
}

const ROOT = process.cwd();
const SIZE = 512;
const SYNC_DATE = "2026-08-29";
const MATERIAL_SVG_DIR = path.join(ROOT, "design-assets/material-symbols/svg/rounded");
const MATERIAL_UPSTREAM_COMMIT = "caeba1e66925218b1fd1464171f93e2656f9a0b9";
const MATERIAL_SVG_BASE_URL = `https://raw.githubusercontent.com/google/material-design-icons/${MATERIAL_UPSTREAM_COMMIT}/symbols/web`;

const TARGETS = ICON_TARGETS as unknown as IconTarget[];

function materialSvgPath(materialName: string): string {
  return path.join(MATERIAL_SVG_DIR, `${materialName}.svg`);
}

async function ensureMaterialSvg(materialName: string): Promise<string> {
  const svgPath = materialSvgPath(materialName);
  try {
    return await readFile(svgPath, "utf-8");
  } catch {
    const url = `${MATERIAL_SVG_BASE_URL}/${materialName}/materialsymbolsrounded/${materialName}_24px.svg`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Material SVG unavailable at locked commit ${MATERIAL_UPSTREAM_COMMIT}: ${materialName} (${response.status})`,
      );
    }
    const svg = await response.text();
    if (!svg.includes("<svg") || !svg.includes("<path")) {
      throw new Error(`Material SVG invalid at locked commit ${MATERIAL_UPSTREAM_COMMIT}: ${materialName}`);
    }
    await mkdir(MATERIAL_SVG_DIR, { recursive: true });
    await writeFile(svgPath, svg, "utf-8");
    return svg;
  }
}

function wrapMaterialSvg(target: IconTarget, materialSvg: string): string {
  const pathData = [...materialSvg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)]
    .map((match) => match[1])
    .filter(Boolean);
  if (pathData.length === 0) {
    throw new Error(`Material SVG has no path data: ${target.materialName}`);
  }
  const paths = pathData
    .map((data) => `  <path d="${data}" fill="#000000"/>`)
    .join("\n");

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg">
  <title>${target.sourceBaseName} - Material Symbols ${target.materialName}</title>
  <rect x="0" y="0" width="960" height="960" fill="#ffffff"/>
  <g transform="translate(0 960)">
${paths}
  </g>
</svg>
`;
}

async function writeIconSvg(directory: string, baseName: string, svg: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${baseName}.svg`), svg, "utf-8");
}

function sourceDirectoryFor(kind: IconKind): string {
  if (kind === "basecard") {
    return path.join(ROOT, "design-assets/Basecardicon");
  }
  if (kind === "layout") {
    return path.join(ROOT, "design-assets/Layouticon");
  }
  return path.join(ROOT, "design-assets/Appicon");
}

function relativePath(filePath: string): string {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function sourceDirectoryName(kind: IconKind): string {
  return relativePath(sourceDirectoryFor(kind));
}

function kindLabel(kind: IconKind): string {
  if (kind === "basecard") {
    return "基础卡片插件";
  }
  if (kind === "layout") {
    return "箱子布局插件";
  }
  if (kind === "template") {
    return "应用插件脚手架模板";
  }
  return "应用插件";
}

function outputBaseName(target: IconTarget): string {
  return target.projectIconBaseName ?? target.sourceBaseName;
}

function iconBoundary(target: IconTarget): string[] {
  if (target.kind === "app" || target.kind === "template") {
    return [
      `- \`${outputBaseName(target)}.svg\` 是设计源与平台中立主图；`,
      `- \`manifest.yaml -> ui.launcher.icon\` 只声明 \`${outputBaseName(target)}.svg\` 或 \`${outputBaseName(target)}.png\`，不声明平台专属容器；`,
      `- \`${outputBaseName(target)}.ico\` 与 \`${outputBaseName(target)}.icns\` 是平台派生的系统入口容器，由平台变体解析链按平台选择；`,
      "- 这些文件只属于系统入口与安装分发链路，不属于运行时 UI 图标链路。",
    ];
  }
  if (target.kind === "basecard") {
    return [
      "- 基础卡片插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；",
      "- `basecard-icon.svg` 是身份四件套的设计源与平台中立主图，`.png` / `.ico` / `.icns` 为同批派生物；",
      "- 清单 `capabilities.cardTypes[].icon` 只声明各卡片类型的平台中立主图（`assets/icons/<类型短名>.svg`）；",
      "- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染。",
    ];
  }
  return [
    "- 箱子布局插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；",
    "- `layout-icon.svg` 是身份四件套的设计源与平台中立主图，`.png` / `.ico` / `.icns` 为同批派生物；",
    "- 清单 `capabilities.layouts[].icon` 只声明各布局类型的平台中立主图（`assets/icons/<布局短名>.svg`）；",
    "- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染。",
  ];
}

function designSourceIntro(kind: IconKind): string[] {
  if (kind === "app" || kind === "template") {
    return [
      "- 本目录保存应用插件系统入口图标的正式设计源；",
      "- 对应运行时消费链路为 `manifest.ui.launcher.icon`、平台安装复制、系统快捷方式与启动台入口；",
      "- 目录内 `.svg` 为设计源，`.png` 为平台中立主图，`.ico` / `.icns` 为平台派生容器；",
      "- 本目录不是运行时 UI 图标目录，运行时 UI 图标统一经 `@chips/ui` 图标出口渲染；",
      "- 基础卡片与布局身份图标分别使用各自的设计源目录，不混入本目录。",
    ];
  }
  if (kind === "basecard") {
    return [
      "- 本目录保存基础卡片插件静态身份图标的正式设计源；",
      "- 工程内同步到 `assets/icons/basecard-icon.*`，用于插件静态身份、物料清点和治理展示链路；",
      "- 目录内 `.svg` 为设计源与平台中立主图，`.png` / `.ico` / `.icns` 为同批派生物；",
      "- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染；",
      "- 本目录不属于 `manifest.ui.launcher.icon` 系统入口链路。",
    ];
  }
  return [
    "- 本目录保存箱子布局插件静态身份图标的正式设计源；",
    "- 工程内同步到 `assets/icons/layout-icon.*`，用于插件静态身份、物料清点和治理展示链路；",
    "- 目录内 `.svg` 为设计源与平台中立主图，`.png` / `.ico` / `.icns` 为同批派生物；",
    "- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染；",
    "- 本目录不属于 `manifest.ui.launcher.icon` 系统入口链路。",
  ];
}

function designSourceTitle(kind: IconKind): string {
  if (kind === "basecard") {
    return "基础卡片插件静态图标源目录说明";
  }
  if (kind === "layout") {
    return "箱子布局插件静态图标源目录说明";
  }
  return "应用启动图标源目录说明";
}

function designUpdateRules(): string[] {
  return [
    "- 图标调整时，先更新本目录正式 SVG 源文件，再通过 `scripts/generate-plugin-material-icons.ts` 同步 SVG 设计源，并通过 `scripts/sync-plugin-icons.mjs`（`chips iconmaker generate`）重新渲染 PNG/ICO/ICNS；",
    "- 不再使用字体码位、HTML 文本渲染或截图方式生成图标，避免出现乱码；",
    "- 每次改动本目录资产，必须同步更新本文件与对应工程 `assets/icons/SOURCE.md`；",
    "- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染。",
  ];
}

function projectSourceDocPath(target: IconTarget): string | null {
  if (!target.projectDir || !target.projectIconBaseName) {
    return null;
  }
  const fileName = target.kind === "template" ? "SOURCE.md.tpl" : "SOURCE.md";
  return path.join(ROOT, target.projectDir, "assets/icons", fileName);
}

async function writeDesignSourceDoc(kind: IconKind, targets: IconTarget[]): Promise<void> {
  const sourceDir = sourceDirectoryName(kind);
  const rows = targets
    .map((target) => {
      const output = target.projectDir && target.projectIconBaseName
        ? `\`${target.projectDir}/assets/icons/${target.projectIconBaseName}.png/.ico/.icns/.svg\``
        : `\`${sourceDir}/${target.sourceBaseName}.png/.ico/.icns\`（设计源目录内派生容器）`;
      return `| \`${target.sourceBaseName}\` | \`${target.materialName}\` | ${target.projectDir ? `\`${target.projectDir}\`` : "无工程输出"} | ${output} |`;
    })
    .join("\n");
  const content = `# ${designSourceTitle(kind)}

- 适用目录：\`${sourceDir}/\`
- 同步时间：${SYNC_DATE}
- SVG 生成脚本：\`scripts/generate-plugin-material-icons.ts\`
- PNG/ICO/ICNS 渲染脚本：\`scripts/sync-plugin-icons.mjs\`（\`chips iconmaker generate\` 命令行链路）
- 上游 SVG 缓存：\`design-assets/material-symbols/svg/rounded/\`
- 视觉基线：白色背景、黑色 Material Symbols Rounded 图标。
- 转换链路：官方 Material Symbols Rounded SVG -> 512px 白底黑色 SVG（本脚本）-> Chip-iconMaker CLI 渲染 PNG/ICO/ICNS。

## 目录职责

${designSourceIntro(kind).join("\n")}

## 当前正式命名基线

| 源文件基名 | Material Symbols 名称 | 对应工程 | 正式输出物 |
| --- | --- | --- | --- |
${rows}

## 更新规则

${designUpdateRules().join("\n")}
`;
  await writeFile(path.join(sourceDirectoryFor(kind), "SOURCE.md"), content, "utf-8");
}

async function writeProjectSourceDoc(target: IconTarget): Promise<void> {
  const docPath = projectSourceDocPath(target);
  if (!docPath) {
    return;
  }
  const baseName = outputBaseName(target);
  const sourceDir = sourceDirectoryName(target.kind);
  const sourceFile = `${target.sourceBaseName}.svg`;
  const materialSource = `design-assets/material-symbols/svg/rounded/${target.materialName}.svg`;
  const title = target.kind === "template"
    ? "应用启动图标说明"
    : `${target.sourceBaseName} ${kindLabel(target.kind)}图标来源说明`;
  const content = `# ${title}

- 正式设计源目录：\`${sourceDir}/\`
- 对应设计源文件：\`${sourceFile}\`（SVG 为唯一源）
- Material Symbols 名称：\`${target.materialName}\`
- 上游 SVG 缓存（锁定提交）：\`${materialSource}\`
- SVG 生成脚本：\`scripts/generate-plugin-material-icons.ts\`
- PNG/ICO/ICNS 渲染脚本：\`scripts/sync-plugin-icons.mjs\`（\`chips iconmaker generate\` 命令行链路）
- 同步时间：${SYNC_DATE}

## 当前工程内纳入版本控制的文件

- \`${baseName}.svg\`（设计源与平台中立主图）
- \`${baseName}.png\`（平台中立主图位图）
- \`${baseName}.ico\`（平台派生容器）
- \`${baseName}.icns\`（平台派生容器）

## 使用边界

${iconBoundary(target).join("\n")}
`;
  await writeFile(docPath, content, "utf-8");
}

async function writeSourceDocs(): Promise<void> {
  const grouped = new Map<IconKind, IconTarget[]>();
  for (const target of TARGETS) {
    const sourceKind = target.kind === "template" ? "app" : target.kind;
    grouped.set(sourceKind, [...(grouped.get(sourceKind) ?? []), target]);
    await writeProjectSourceDoc(target);
  }
  for (const [kind, targets] of grouped) {
    await writeDesignSourceDoc(kind, targets);
  }
}

async function main(): Promise<void> {
  const generated: string[] = [];

  for (const target of TARGETS) {
    const materialSvg = await ensureMaterialSvg(target.materialName);
    const svg = wrapMaterialSvg(target, materialSvg);
    await writeIconSvg(sourceDirectoryFor(target.kind), target.sourceBaseName, svg);
    generated.push(`${target.kind}:${target.sourceBaseName}:${target.materialName}`);

    if (target.projectDir && target.projectIconBaseName) {
      await writeIconSvg(
        path.join(ROOT, target.projectDir, "assets/icons"),
        target.projectIconBaseName,
        svg,
      );
    }
  }

  await writeSourceDocs();

  console.log(`Generated ${generated.length} SVG design sources`);
  for (const item of generated) {
    console.log(`- ${item}`);
  }
  console.log("PNG/ICO/ICNS 由 scripts/sync-plugin-icons.mjs（chips iconmaker generate）渲染。");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
