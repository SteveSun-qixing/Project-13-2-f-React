/**
 * 渲染入口构建链注册表锁单测（金链路刀4 / 任务 #100）。
 *
 * 权威：`06-开发与运维/02-构建与打包` §5.1（产物与模块形态）、`05-渲染引擎设计`
 * §3.1（渲染进程结构）、§9.1（帧入口经 `chips-resource://platform/` 装载）。
 *
 * @remarks
 * - 单一事实源为 `src/main/window-entries.ts`：本套件把主进程登记、vite 渲染层构建段、
 *   HTML 复制链、渲染入口源码常量、HTML 源文件、package.json 构建脚本六面钉在一起，
 *   任一面漂移即红。
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import rendererConfigFactory from '../vite.renderer.config.js';
import { CARD_WINDOW_ENTRY_URL, PLATFORM_ENTRY_HTML, PLATFORM_ENTRY_URLS } from '../src/main/window-entries.js';
import { FRAME_ENTRY_URL as MAIN_FRAME_ENTRY_URL } from '../src/main/window-entries.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface RendererUserConfigSlice {
  build: {
    outDir: string;
    emptyOutDir: boolean;
    rollupOptions: {
      input: string;
      output: { format: string; entryFileNames: string };
    };
  };
}

type RendererConfigFactory = (env: { mode: string; command: 'build' | 'serve' }) => RendererUserConfigSlice;

function buildSection(mode: string): RendererUserConfigSlice {
  const factory = rendererConfigFactory as unknown as RendererConfigFactory;
  return factory({ mode, command: 'build' });
}

function readSource(relative: string): string {
  return readFileSync(join(packageRoot, relative), 'utf8');
}

describe('入口注册表（window-entries.ts 单一事实源）', () => {
  it('三入口 HTML / URI 冻结值', () => {
    expect(PLATFORM_ENTRY_HTML).toEqual({
      shell: 'shell.html',
      card: 'entries/card.html',
      frame: 'entries/frame.html',
    });
    expect(PLATFORM_ENTRY_URLS).toEqual({
      shell: 'chips-resource://platform/shell.html',
      card: 'chips-resource://platform/entries/card.html',
      frame: 'chips-resource://platform/entries/frame.html',
    });
    expect(CARD_WINDOW_ENTRY_URL).toBe(PLATFORM_ENTRY_URLS.card);
    expect(MAIN_FRAME_ENTRY_URL).toBe(PLATFORM_ENTRY_URLS.frame);
  });
});

describe('vite.renderer.config.ts 构建段锁', () => {
  it('shell 段：入口壳窗口脚本、产物名与 outDir 不变', () => {
    const section = buildSection('shell');
    expect(section.build.rollupOptions.input).toBe('src/renderer/shell-window.ts');
    expect(section.build.outDir).toBe('dist/renderer');
    expect(section.build.rollupOptions.output.entryFileNames).toBe('shell-window.js');
    expect(section.build.rollupOptions.output.format).toBe('iife');
  });

  it('card 段：入口卡片窗口脚本、产物落 entries 子目录', () => {
    const section = buildSection('card');
    expect(section.build.rollupOptions.input).toBe('src/renderer/entries/card.ts');
    expect(section.build.outDir).toBe('dist/renderer/entries');
    expect(section.build.rollupOptions.output.entryFileNames).toBe('card.js');
    expect(section.build.rollupOptions.output.format).toBe('iife');
  });

  it('frame 段：入口帧运行时脚本、不清空 card 产物目录', () => {
    const section = buildSection('frame');
    expect(section.build.rollupOptions.input).toBe('src/renderer/entries/frame.ts');
    expect(section.build.outDir).toBe('dist/renderer/entries');
    expect(section.build.rollupOptions.output.entryFileNames).toBe('frame.js');
    expect(section.build.emptyOutDir).toBe(false);
  });

  it('未知 mode 直接抛错（禁止静默漏段）', () => {
    expect(() => buildSection('bogus')).toThrow('渲染层构建必须以 --mode shell | card | frame 选择构建段');
  });
});

describe('vite.main.config.ts 主进程入口锁', () => {
  const configSource = readSource('vite.main.config.ts');

  it('正式应用入口 app.ts 已注册且与自检入口并列', () => {
    expect(configSource).toContain('app: ');
    expect(configSource).toContain('src/main/app.ts');
    expect(configSource).toContain("'self-check'");
    expect(configSource).toContain('src/main/main.ts');
  });
});

describe('HTML 复制链与源文件锁', () => {
  const copyScript = readSource('scripts/copy-renderer-html.mjs');

  it('复制清单覆盖三入口且与注册表路径一致', () => {
    expect(copyScript).toContain("'shell.html', 'shell.html'");
    expect(copyScript).toContain("join('entries', 'card.html'), join('entries', 'card.html')");
    expect(copyScript).toContain("join('entries', 'frame.html'), join('entries', 'frame.html')");
  });

  it('卡片窗口 HTML：根容器、脚本引用与壳页同一 CSP', () => {
    const html = readSource('src/renderer/entries/card.html');
    expect(html).toContain('id="chips-card-root"');
    expect(html).toContain('card.js');
    expect(html).toContain('<title>薯片 · 卡片</title>');
    const shellHtml = readSource('src/renderer/shell.html');
    const cspOf = (content: string): string => /Content-Security-Policy"\s+content="([^"]+)"/.exec(content)?.[1] ?? '';
    expect(cspOf(html)).toBe(cspOf(shellHtml));
    expect(cspOf(html)).not.toBe('');
  });

  it('帧入口 HTML：节点容器宿主、脚本引用与壳页同一 CSP', () => {
    const html = readSource('src/renderer/entries/frame.html');
    expect(html).toContain('id="chips-frame-nodes"');
    expect(html).toContain('frame.js');
    expect(html).toContain('<title>薯片 · 渲染帧</title>');
    const shellHtml = readSource('src/renderer/shell.html');
    const cspOf = (content: string): string => /Content-Security-Policy"\s+content="([^"]+)"/.exec(content)?.[1] ?? '';
    expect(cspOf(html)).toBe(cspOf(shellHtml));
  });
});

describe('渲染入口常量与主进程登记一致（源码文本锁）', () => {
  it('card.ts 的帧入口 URL 等于主进程登记表', () => {
    const source = readSource('src/renderer/entries/card.ts');
    const match = /export const FRAME_ENTRY_URL = '([^']+)'/.exec(source);
    expect(match?.[1]).toBe(PLATFORM_ENTRY_URLS.frame);
  });

  it('卡片入口装载根容器 id 与 HTML 对齐', () => {
    const source = readSource('src/renderer/entries/card.ts');
    expect(source).toContain("getElementById('chips-card-root')");
  });

  it('帧入口容器宿主 id 与 HTML 对齐', () => {
    const source = readSource('src/renderer/entries/frame.ts');
    expect(source).toContain("getElementById('chips-frame-nodes')");
  });
});

describe('package.json 构建与冒烟脚本锁', () => {
  const pkg = JSON.parse(readSource('package.json')) as { scripts: Record<string, string> };

  it('build:renderer 顺序驱动三段并随动 HTML 复制', () => {
    const script = pkg.scripts['build:renderer'] ?? '';
    expect(script).toContain('--mode shell');
    expect(script).toContain('--mode card');
    expect(script).toContain('--mode frame');
    expect(script).toContain('copy-renderer-html.mjs');
  });

  it('app / smoke:app 脚本登记', () => {
    expect(pkg.scripts['app']).toContain('electron ./dist/main/app.js');
    expect(pkg.scripts['smoke:app']).toContain('CHIPS_HOST_SMOKE=1');
    expect(pkg.scripts['smoke:app']).toContain('tests/e2e-host');
  });
});

describe('渲染入口零改动既有渲染面（消费面锁）', () => {
  it('entries 目录只从 ../index.js 具名消费渲染面，不触达主进程模块', () => {
    for (const file of ['card.ts', 'frame.ts', 'bridge-data-plane.ts']) {
      const source = readSource(join('src/renderer/entries', file));
      expect(source).not.toMatch(/from '\.\.\/\.\.\/main\//);
      expect(source).not.toMatch(/from '\.\.\/\.\.\/platform\//);
    }
    const cardSource = readSource('src/renderer/entries/card.ts');
    expect(cardSource).toContain("from '../index.js'");
    const frameSource = readSource('src/renderer/entries/frame.ts');
    expect(frameSource).toContain("from '../index.js'");
  });
});
