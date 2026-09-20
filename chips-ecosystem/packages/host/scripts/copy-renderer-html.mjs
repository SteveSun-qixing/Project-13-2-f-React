import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 渲染层 HTML 入口复制链：把 `src/renderer` 下的窗口/帧入口页复制到 `dist/renderer` 对应位置。
 *
 * 清单与 `src/main/window-entries.ts`、`vite.renderer.config.ts` 的入口注册表一致
 * （`tests/host-entry-registry.test.ts` 锁定漂移）。
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rendererSrc = resolve(packageRoot, 'src/renderer');
const rendererDist = resolve(packageRoot, 'dist/renderer');

/** [源文件（相对 src/renderer）, 产物路径（相对 dist/renderer）] */
const htmlEntries = [
  ['shell.html', 'shell.html'],
  [join('entries', 'card.html'), join('entries', 'card.html')],
  [join('entries', 'frame.html'), join('entries', 'frame.html')],
];

for (const [source, target] of htmlEntries) {
  const targetPath = resolve(rendererDist, target);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(resolve(rendererSrc, source), targetPath);
  process.stdout.write(`壳页面已复制：${targetPath}\n`);
}
