import { defineConfig } from 'vite';

/**
 * 渲染层构建：壳自检页 + 卡片窗口入口 + 平台帧运行时入口（三段 IIFE 独立产物）。
 *
 * 权威：`06-开发与运维/02-构建与打包` §5.1（产物与模块形态）、`05-渲染引擎设计` §3.1
 * （渲染进程结构）、§9.1（帧入口经 `chips-resource://platform/` 装载）。
 *
 * @remarks
 * - IIFE 语境一段一个入口：以 `--mode shell | card | frame` 选择构建段，`build:renderer`
 *   脚本按序驱动三段并随动执行 `scripts/copy-renderer-html.mjs`。
 * - 入口清单与 `src/main/window-entries.ts` 注册表一致
 *   （`tests/host-entry-registry.test.ts` 锁定漂移）；`entries/*` 产物落
 *   `dist/renderer/entries/`，与 `chips-resource://platform/entries/<file>` 装载路径对齐。
 */

/** 构建段定义。 */
interface RendererBuildSection {
  readonly input: string;
  readonly outDir: string;
  readonly entryFileNames: string;
  readonly emptyOutDir: boolean;
}

const SECTIONS: Readonly<Record<'shell' | 'card' | 'frame', RendererBuildSection>> = {
  shell: {
    input: 'src/renderer/shell-window.ts',
    outDir: 'dist/renderer',
    entryFileNames: 'shell-window.js',
    emptyOutDir: true,
  },
  card: {
    input: 'src/renderer/entries/card.ts',
    outDir: 'dist/renderer/entries',
    entryFileNames: 'card.js',
    emptyOutDir: true,
  },
  frame: {
    input: 'src/renderer/entries/frame.ts',
    outDir: 'dist/renderer/entries',
    entryFileNames: 'frame.js',
    emptyOutDir: false,
  },
};

export default defineConfig(({ mode }) => {
  const section = SECTIONS[mode as keyof typeof SECTIONS];
  if (section === undefined) {
    throw new Error(`渲染层构建必须以 --mode shell | card | frame 选择构建段（当前 mode=${JSON.stringify(mode)}）`);
  }
  return {
    build: {
      outDir: section.outDir,
      emptyOutDir: section.emptyOutDir,
      target: 'es2022',
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: section.input,
        external: ['electron'],
        output: {
          format: 'iife',
          entryFileNames: section.entryFileNames,
        },
      },
    },
  };
});
