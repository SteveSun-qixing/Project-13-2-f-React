import path from 'node:path';

import { test as base } from '@playwright/test';

import { findRenderFrame, type RenderFrameHandle } from './assertions';
import { closeHostApp, launchHostApp, type HostInstance } from './launcher';
import { createTestWorkspace, type TestWorkspace } from './workspace';

/** E2E 可配置项；在用例文件中用 `test.use(...)` 覆盖。 */
export interface E2EOptions {
  /** 被测应用目录；缺省 `packages/host`（harness 自检传夹具应用）。 */
  readonly appPath?: string;
  /** 启动时打开的文档路径；缺省打开工作区目录态卡片。 */
  readonly openDocumentPaths?: readonly string[];
}

/** E2E fixture 集合。 */
export interface E2EFixtures {
  /** 每个用例独立的工作区（含产品级夹具）。 */
  readonly workspace: TestWorkspace;
  /** 已启动且 Bridge 就绪的宿主；用例结束自动逆序关闭。 */
  readonly host: HostInstance;
  /** 任一窗口中首个就绪的渲染帧；惰性求值。 */
  readonly frame: RenderFrameHandle;
}

export const test = base.extend<E2EOptions & E2EFixtures>({
  appPath: [undefined, { option: true }],

  openDocumentPaths: [undefined, { option: true }],

  // Playwright 要求 fixture 首参必须写作对象解构模式；本 fixture 不依赖其它 fixture。
  // eslint-disable-next-line no-empty-pattern
  workspace: async ({}, use) => {
    const workspace = await createTestWorkspace({ label: test.info().title });
    try {
      await use(workspace);
    } finally {
      await workspace.dispose();
    }
  },

  host: async ({ appPath, openDocumentPaths, workspace }, use) => {
    const defaultOpenPaths =
      workspace.cardDirectoryPath === null ? [] : [workspace.cardDirectoryPath];
    const host = await launchHostApp({
      ...(appPath === undefined ? {} : { hostAppPath: path.resolve(appPath) }),
      workspacePath: workspace.root,
      openPaths: openDocumentPaths ?? defaultOpenPaths,
    });
    try {
      await use(host);
    } finally {
      await closeHostApp(host);
    }
  },

  frame: async ({ host }, use) => {
    const frame = await findRenderFrame(host.app);
    await use(frame);
  },
});

export { expect } from '@playwright/test';
export type { HostInstance, RenderFrameHandle, TestWorkspace };
