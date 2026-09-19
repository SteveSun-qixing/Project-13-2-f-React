/**
 * @chips/e2e 公开面：启动器、断言工具、工作区与 Playwright fixture。
 *
 * 使用方（`specs/` 与后续 W2/W3/W5 E2E）只经本入口消费；内部模块不作为稳定面。
 */

export {
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_LAUNCH_TIMEOUT_MS,
  DEFAULT_RENDER_TIMEOUT_MS,
  isHostAppBuilt,
  resolveE2eRoot,
  resolveEcosystemRoot,
  resolveElectronExecutable,
  resolveFixturesRoot,
  resolveHarnessAppPath,
  resolveHostApp,
} from './environment';

export {
  buildLaunchArgs,
  closeHostApp,
  DEFAULT_READY_PROBE_CAPABILITY,
  launchHostApp,
  waitForHostReady,
  type HostInstance,
  type LaunchHostOptions,
  type WaitForHostReadyOptions,
} from './launcher';

export {
  createDocument,
  expectContentDigest,
  expectFrameContainsText,
  expectResource,
  expectRevisionAdvanced,
  expectWindowList,
  exportDocument,
  findRenderFrame,
  isChipsErrorCode,
  listFrames,
  listWindows,
  openDocument,
  readDocumentPart,
  readDocumentSession,
  readFrameText,
  readResource,
  saveDocument,
  waitForApplicationWindows,
  waitForDocumentPart,
  waitForEvent,
  waitForRenderFrame,
  waitForWindow,
  writeDocumentPart,
  type PollOptions,
  type RenderFrameHandle,
} from './assertions';

export {
  cardContentRelativePath,
  createTestWorkspace,
  loadFixtureManifest,
  type CreateTestWorkspaceOptions,
  type FixtureSelection,
  type TestWorkspace,
} from './workspace';

export { expect, test, type E2EFixtures, type E2EOptions } from './fixtures';

export type {
  BoxMetadata,
  CardMetadata,
  ChipsResourceMetadata,
  DocumentCreateInput,
  DocumentCreateOutput,
  DocumentExportInput,
  DocumentExportOutput,
  DocumentOpenInput,
  DocumentOpenOutput,
  DocumentPart,
  DocumentReadInput,
  DocumentReadOutput,
  DocumentSaveOutput,
  DocumentSessionSnapshot,
  DocumentWriteInput,
  DocumentWriteOutput,
  FixtureManifest,
  FrameSummary,
  ResourceSnapshot,
  RichTextContent,
  SystemInfoOutput,
  WindowInfo,
  WindowListOutput,
} from './types';
