import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostApplication } from '../../src/main/core/host-application';
import { RuntimeClient } from '../../src/renderer/runtime-client';
import { StoreZipService } from '../../packages/zip-service/src';
import { CHIPS_RENDER_DOCUMENT_SCHEME } from '../../src/main/electron/render-document-protocol';

const ELECTRON_MOCK_KEY = '__chipsElectronMock';
const MANAGED_RESOURCE_FILE_NAME = '封面 图.png';
const MANAGED_RESOURCE_CONTENT = Buffer.from('cover-bytes', 'utf-8');

let workspace: string;

const writeText = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
};

const unwrapBinaryRoutePayload = (value: Buffer | { type: 'Buffer'; data: number[] }): Buffer => {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  return Buffer.from(value.data);
};

const createRenderCardArchive = async (): Promise<string> => {
  const source = path.join(workspace, 'render-protocol-card-source');
  await fs.mkdir(path.join(source, '.card'), { recursive: true });
  await fs.mkdir(path.join(source, 'content'), { recursive: true });
  await fs.writeFile(path.join(source, '.card/metadata.yaml'), 'card_id: host.protocol.demo\nname: Host Protocol Demo\n', 'utf-8');
  await fs.writeFile(
    path.join(source, '.card/structure.yaml'),
    'structure:\n  - id: "intro"\n    type: "RichTextCard"\n',
    'utf-8',
  );
  await fs.writeFile(path.join(source, '.card/cover.html'), `<img src="../${MANAGED_RESOURCE_FILE_NAME}" alt="cover" />`, 'utf-8');
  await fs.writeFile(path.join(source, MANAGED_RESOURCE_FILE_NAME), MANAGED_RESOURCE_CONTENT);
  await fs.writeFile(
    path.join(source, 'content/intro.yaml'),
    'card_type: "RichTextCard"\ncontent_format: "markdown"\ncontent_source: "inline"\ncontent_text: |\n  render protocol\n',
    'utf-8',
  );

  const cardFile = path.join(workspace, 'render-protocol-demo.card');
  const zip = new StoreZipService();
  await zip.compress(source, cardFile);
  return cardFile;
};

const createRenderBoxArchive = async (): Promise<string> => {
  const source = path.join(workspace, 'render-protocol-box-source');
  await fs.mkdir(path.join(source, '.box'), { recursive: true });
  await fs.mkdir(path.join(source, 'assets/layouts/grid'), { recursive: true });
  await fs.writeFile(
    path.join(source, '.box/metadata.yaml'),
    [
      'chip_standards_version: "1.0.0"',
      'box_id: "BxPrtcl001"',
      'name: "Host Protocol Box"',
      'created_at: "2026-05-03T10:00:00.000Z"',
      'modified_at: "2026-05-03T10:00:00.000Z"',
      'active_layout_type: "chips.layout.grid"',
      'cover_ratio: "3:4"',
      '',
    ].join('\n'),
    'utf-8',
  );
  await fs.writeFile(path.join(source, '.box/structure.yaml'), 'entries: []\n', 'utf-8');
  await fs.writeFile(
    path.join(source, '.box/content.yaml'),
    [
      'active_layout_type: "chips.layout.grid"',
      'layout_configs:',
      '  chips.layout.grid:',
      '    schema_version: "1.0.0"',
      '    props:',
      '      sort_mode: "manual"',
      '    asset_refs: []',
      '',
    ].join('\n'),
    'utf-8',
  );
  await fs.writeFile(path.join(source, '.box/cover.html'), '<!doctype html><html><body>Box cover</body></html>', 'utf-8');
  await fs.writeFile(path.join(source, 'assets/layouts/grid/background.webp'), 'box-background', 'utf-8');

  const boxFile = path.join(workspace, 'render-protocol-demo.box');
  const zip = new StoreZipService();
  await zip.compress(source, boxFile);
  return boxFile;
};

const createRichTextCardPluginFixture = async (): Promise<string> => {
  const pluginDir = path.join(workspace, 'fixture-richtext-card-plugin');
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'id: chips.basecard.richtext.fixture',
      'name: 富文本基础卡片插件',
      'version: "1.0.0"',
      'type: card',
      'entry: dist/index.mjs',
      'description: Host managed render protocol fixture rich text plugin',
      'capabilities:',
      '  cardTypes:',
      '    - base.richtext',
      '    - RichTextCard',
      'permissions: []',
      'runtime:',
      '  targets:',
      '    desktop:',
      '      supported: true',
      '    web:',
      '      supported: false',
      '    mobile:',
      '      supported: false',
      '    headless:',
      '      supported: true',
      '',
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'dist/index.mjs'),
    [
      'export const basecardDefinition = {',
      '  pluginId: "chips.basecard.richtext.fixture",',
      '  cardTypes: ["base.richtext", "RichTextCard"],',
      '  createDefaultConfig() { return {}; },',
      '  normalizeConfig(input = {}) { return input; },',
      '  validateConfig() { return { valid: true, errors: {} }; },',
      '  collectResourcePaths() { return []; },',
      '  renderView({ config }) {',
      '    const text = String(config?.content_text ?? config?.contentText ?? "");',
      '    return `<article data-scope="richtext-card">${text}</article>`;',
      '  },',
      '  renderEditor() { return `<section data-scope="richtext-card-editor"></section>`; },',
      '};',
      '',
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

const createLayoutPluginFixture = async (): Promise<string> => {
  const pluginDir = path.join(workspace, 'fixture-grid-layout-plugin');
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'id: chips.layout.grid.fixture',
      'name: 网格布局插件',
      'version: "1.0.0"',
      'type: layout',
      'entry: dist/index.mjs',
      'description: Host managed render protocol fixture grid layout plugin',
      'permissions:',
      '  - box.read',
      '  - theme.read',
      '  - i18n.read',
      'runtime:',
      '  targets:',
      '    desktop:',
      '      supported: true',
      '    web:',
      '      supported: false',
      '    mobile:',
      '      supported: false',
      '    headless:',
      '      supported: true',
      'layout:',
      '  layoutType: chips.layout.grid',
      '  displayName: 网格布局插件',
      '',
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'dist/index.mjs'),
    [
      'export const layoutDefinition = {',
      '  pluginId: "chips.layout.grid.fixture",',
      '  layoutType: "chips.layout.grid",',
      '  displayName: "网格布局插件",',
      '  createDefaultConfig() { return {}; },',
      '  normalizeConfig(input = {}) { return input; },',
      '  validateConfig() { return { valid: true, errors: {} }; },',
      '  getInitialQuery() { return {}; },',
      '  renderView() {},',
      '  renderEditor() {},',
      '};',
      '',
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-host-render-protocol-'));
});

afterEach(async () => {
  delete (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY];
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('HostApplication managed render protocol', () => {
  it('registers a protocol handler that resolves managed render session urls back to files', async () => {
    let protocolHandler:
      | ((request: { url: string }) => Promise<Response> | Response)
      | undefined;
    const fetchMock = vi.fn(async (url: string) => new Response(url));

    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      protocol: {
        handle: vi.fn((scheme: string, handler: (request: { url: string }) => Promise<Response> | Response) => {
          expect(scheme).toBe(CHIPS_RENDER_DOCUMENT_SCHEME);
          protocolHandler = handler;
        }),
      },
      net: {
        fetch: fetchMock,
      },
    };

    const bootstrapApp = new HostApplication({ workspacePath: workspace });
    await bootstrapApp.start();
    const bootstrapRuntime = new RuntimeClient(bootstrapApp.createBridge());

    try {
      const richtextPlugin = await bootstrapRuntime.invoke<{ pluginId: string }>('plugin.install', {
        manifestPath: await createRichTextCardPluginFixture(),
      });
      await bootstrapRuntime.invoke('plugin.enable', { pluginId: richtextPlugin.pluginId });

      const cardFile = await createRenderCardArchive();
      const rendered = await bootstrapRuntime.invoke<{
        view: {
          documentUrl: string;
          sessionId: string;
        };
      }>('card.render', {
        cardFile,
      });

      expect(protocolHandler).toBeTypeOf('function');
      expect(rendered.view.documentUrl.startsWith('chips-render://session/')).toBe(true);
      expect(rendered.view.sessionId).toMatch(/^card-render-/);

      const response = await protocolHandler?.({ url: rendered.view.documentUrl });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const resolvedFileUrl = response ? await response.text() : '';
      expect(resolvedFileUrl.startsWith('file://')).toBe(true);
      expect(resolvedFileUrl.endsWith('/index.html')).toBe(true);
    } finally {
      await bootstrapApp.stop();
    }
  }, 30_000);

  it('resolves and reads managed card-root resources through resource routes', async () => {
    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      protocol: {
        handle: vi.fn(),
      },
      net: {
        fetch: vi.fn(async (url: string) => new Response(url)),
      },
    };

    const bootstrapApp = new HostApplication({ workspacePath: workspace });
    await bootstrapApp.start();
    const bootstrapRuntime = new RuntimeClient(bootstrapApp.createBridge());

    try {

      const cardFile = await createRenderCardArchive();
      const coverView = await bootstrapRuntime.invoke<{
        view: {
          coverUrl: string;
        };
      }>('card.renderCover', {
        cardFile,
      });

      expect(coverView.view.coverUrl.startsWith('chips-render://card-root/')).toBe(true);

      const managedResourceId = new URL(`../${MANAGED_RESOURCE_FILE_NAME}`, coverView.view.coverUrl).toString();
      const resolved = await bootstrapRuntime.invoke<{ uri: string }>('resource.resolve', {
        resourceId: managedResourceId,
      });
      const metadata = await bootstrapRuntime.invoke<{
        metadata: {
          size: number;
          isFile: boolean;
        };
      }>('resource.readMetadata', {
        resourceId: managedResourceId,
      });
      const binary = await bootstrapRuntime.invoke<{
        data: Buffer | { type: 'Buffer'; data: number[] };
      }>('resource.readBinary', {
        resourceId: managedResourceId,
      });

      expect(resolved.uri.startsWith('file://')).toBe(true);
      expect(await fs.readFile(fileURLToPath(resolved.uri))).toEqual(MANAGED_RESOURCE_CONTENT);
      expect(metadata.metadata).toMatchObject({
        size: MANAGED_RESOURCE_CONTENT.byteLength,
        isFile: true,
      });
      expect(unwrapBinaryRoutePayload(binary.data)).toEqual(MANAGED_RESOURCE_CONTENT);
    } finally {
      await bootstrapApp.stop();
    }
  }, 30_000);

  it('serves box layout render documents through the managed protocol handler', async () => {
    let protocolHandler:
      | ((request: { url: string }) => Promise<Response> | Response)
      | undefined;
    const fetchMock = vi.fn(async (url: string) => new Response(url));

    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      protocol: {
        handle: vi.fn((scheme: string, handler: (request: { url: string }) => Promise<Response> | Response) => {
          expect(scheme).toBe(CHIPS_RENDER_DOCUMENT_SCHEME);
          protocolHandler = handler;
        }),
      },
      net: {
        fetch: fetchMock,
      },
    };

    const bootstrapApp = new HostApplication({ workspacePath: workspace });
    await bootstrapApp.start();
    const bootstrapRuntime = new RuntimeClient(bootstrapApp.createBridge());

    try {
      const gridLayout = await bootstrapRuntime.invoke<{ pluginId: string }>('plugin.install', {
        manifestPath: await createLayoutPluginFixture(),
      });
      await bootstrapRuntime.invoke('plugin.enable', { pluginId: gridLayout.pluginId });

      const boxFile = await createRenderBoxArchive();
      const opened = await bootstrapRuntime.invoke<{
        sessionId: string;
        box: unknown;
        initialView: unknown;
      }>('box.openView', {
        boxFile,
      });
      const rendered = await bootstrapRuntime.invoke<{
        view: {
          documentUrl: string;
          sessionId: string;
        };
      }>('box.renderLayoutFrame', {
        layoutType: 'chips.layout.grid',
        sessionId: opened.sessionId,
        box: opened.box,
        initialView: opened.initialView,
        config: {},
      });

      expect(protocolHandler).toBeTypeOf('function');
      expect(rendered.view.documentUrl.startsWith('chips-render://session/')).toBe(true);
      expect(rendered.view.sessionId).toMatch(/^box-layout-/);

      const response = await protocolHandler?.({ url: rendered.view.documentUrl });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const resolvedFileUrl = response ? await response.text() : '';
      expect(resolvedFileUrl.startsWith('file://')).toBe(true);
      expect(resolvedFileUrl.endsWith('/index.html')).toBe(true);

      const asset = await bootstrapRuntime.invoke<{
        resource: {
          resourceUrl: string;
        };
      }>('box.readBoxAsset', {
        sessionId: opened.sessionId,
        assetPath: 'assets/layouts/grid/background.webp',
      });
      expect(asset.resource.resourceUrl.startsWith('chips-render://box-session/')).toBe(true);

      const assetResponse = await protocolHandler?.({ url: asset.resource.resourceUrl });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const resolvedAssetUrl = assetResponse ? await assetResponse.text() : '';
      expect(resolvedAssetUrl.startsWith('file://')).toBe(true);
      expect(resolvedAssetUrl.endsWith('/assets/layouts/grid/background.webp')).toBe(true);

      await bootstrapRuntime.invoke('box.releaseRenderSession', { sessionId: rendered.view.sessionId });
      await bootstrapRuntime.invoke('box.closeView', { sessionId: opened.sessionId });
    } finally {
      await bootstrapApp.stop();
    }
  }, 30_000);
});
