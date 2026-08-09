import fs from "node:fs/promises";
import path from "node:path";

const ICON_FONT_ASSETS = [
  {
    family: "Material Symbols Outlined",
    fileName: "MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2",
  },
  {
    family: "Material Symbols Rounded",
    fileName: "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2",
  },
  {
    family: "Material Symbols Sharp",
    fileName: "MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2",
  },
] as const;

const fileIfExists = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return "";
    }
    throw error;
  }
};

const ensureFileExists = async (filePath: string): Promise<void> => {
  try {
    await fs.access(filePath);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`缺少正式图标字体资源：${filePath}`);
    }
    throw error;
  }
};

const buildIconFontCss = (): string => {
  return ICON_FONT_ASSETS.map((asset) => `@font-face {
  font-family: "${asset.family}";
  font-style: normal;
  font-weight: 100 700;
  font-display: swap;
  src: url("./icons/variablefont/${asset.fileName}") format("woff2");
}`).join("\n\n");
};

const copyIconAssets = async (projectRoot: string, distDir: string): Promise<void> => {
  const sourceDir = path.join(projectRoot, "icons", "variablefont");
  const targetDir = path.join(distDir, "icons", "variablefont");
  await fs.mkdir(targetDir, { recursive: true });

  for (const asset of ICON_FONT_ASSETS) {
    const sourcePath = path.join(sourceDir, asset.fileName);
    const targetPath = path.join(targetDir, asset.fileName);
    await ensureFileExists(sourcePath);
    await fs.copyFile(sourcePath, targetPath);
  }
};

const main = async (): Promise<void> => {
  const projectRoot = process.cwd();
  const stylesDir = path.join(projectRoot, "styles");

  const baseCss = await fileIfExists(path.join(stylesDir, "base.css"));

  let componentsCss = "";
  try {
    const componentsDir = path.join(stylesDir, "components");
    const entries = await fs.readdir(componentsDir);
    for (const name of entries) {
      if (!name.endsWith(".css")) {
        continue;
      }
      const fullPath = path.join(componentsDir, name);
      componentsCss += "\n" + (await fs.readFile(fullPath, "utf-8"));
    }
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw error;
    }
  }

  const motionsCss = await fileIfExists(path.join(stylesDir, "motions.css"));

  const distDir = path.join(projectRoot, "dist");
  await fs.mkdir(distDir, { recursive: true });
  await copyIconAssets(projectRoot, distDir);

  const finalCss = [buildIconFontCss(), baseCss, componentsCss, motionsCss]
    .filter((chunk) => chunk.trim().length > 0)
    .join("\n\n");

  const outputPath = path.join(distDir, "theme.css");
  await fs.writeFile(outputPath, finalCss, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Theme CSS written to ${outputPath}`);
};

void main();
