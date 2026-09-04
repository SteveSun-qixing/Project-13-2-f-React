#!/usr/bin/env node
/**
 * 将 pdfjs-dist 的运行时静态资源复制到 public/pdfjs/，
 * 供 Vite 构建与开发服务器按原样提供（dist/pdfjs/...）。
 * cmaps：CJK PDF 必需的字符映射；standard_fonts：未嵌入字体时的标准字体数据。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, "..");
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const targetRoot = path.join(projectRoot, "public", "pdfjs");

const COPIES = [
  { from: "cmaps", to: "cmaps" },
  { from: "standard_fonts", to: "standard_fonts" },
];

rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(targetRoot, { recursive: true });

for (const copy of COPIES) {
  const source = path.join(pdfjsRoot, copy.from);
  if (!existsSync(source)) {
    console.error(`[copy-pdfjs-assets] 缺少源目录：${source}`);
    process.exit(1);
  }
  cpSync(source, path.join(targetRoot, copy.to), { recursive: true });
}

console.log(`[copy-pdfjs-assets] 已复制 pdf.js 静态资源到 ${targetRoot}`);
