#!/usr/bin/env node
/**
 * 构建产物资产拷贝：`tsc` 只产出 JS 与类型，本脚本把全局基础样式拷到 `dist/global.css`，
 * 使 `@chips/ui/global.css` 出口在构建后可解析（仅平台壳窗口渲染层导入一次）。
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(packageDir, 'src/styles/global.css');
const target = resolve(packageDir, 'dist/global.css');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`[ui:copy-assets] ${source} -> ${target}`);
