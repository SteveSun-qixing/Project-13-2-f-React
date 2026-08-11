import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { BoxService } from '../../packages/box-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import type { PluginRuntime } from '../../src/runtime';

const BOX_ID = 'b1C2d3E4f5';
const ENTRY_ID = 'e9K2m1P4q7';

const workspaces: string[] = [];

const createWorkspace = async (): Promise<string> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-box-service-test-'));
  workspaces.push(workspace);
  return workspace;
};

const writeText = async (targetPath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
};

const createValidBoxDirectory = async (rootDir: string, cardFile: string): Promise<void> => {
  await writeText(
    path.join(rootDir, '.box/metadata.yaml'),
    [
      'chip_standards_version: "1.0.0"',
      `box_id: "${BOX_ID}"`,
      'name: "旅行箱"',
      'created_at: "2026-03-23T09:30:00.000Z"',
      'modified_at: "2026-03-23T11:20:00.000Z"',
      'active_layout_type: "chips.layout.grid"',
      'cover_ratio: "3:4"',
      'tags:',
      '  - "旅行"',
      'cover_asset: "assets/placeholders/box-cover.webp"',
      ''
    ].join('\n')
  );

  await writeText(
    path.join(rootDir, '.box/structure.yaml'),
    [
      'entries:',
      `  - entry_id: "${ENTRY_ID}"`,
      `    url: "${pathToFileURL(cardFile).href}"`,
      '    enabled: true',
      '    snapshot:',
      '      document_id: "c7H1k2L9m3"',
      '      title: "第一天"',
      '      summary: "抵达后的路线记录"',
      '      tags:',
      '        - "旅行"',
      '      cover:',
      '        mode: "asset"',
      '        asset_path: "assets/previews/e9K2m1P4q7-cover.webp"',
      '        mime_type: "image/webp"',
      '        width: 640',
      '        height: 360',
      '      last_known_modified_at: "2026-03-22T08:00:00.000Z"',
      '      content_type: "chips/card"',
      '    layout_hints:',
      '      sort_key: "2026-03-22"',
      '      aspect_ratio: 1.7778',
      '      group: "东京"',
      '      priority: 3',
      ''
    ].join('\n')
  );

  await writeText(
    path.join(rootDir, '.box/cover.html'),
    '<!doctype html><html><body>旅行箱封面</body></html>',
  );

  await writeText(
    path.join(rootDir, '.box/content.yaml'),
    [
      'active_layout_type: "chips.layout.grid"',
      'layout_configs:',
      '  chips.layout.grid:',
      '    schema_version: "1.0.0"',
      '    props:',
      '      column_count: 4',
      '      gap: 16',
      '    asset_refs:',
      '      - "assets/layouts/grid/background.webp"',
      ''
    ].join('\n')
  );

  await writeText(path.join(rootDir, 'assets/placeholders/box-cover.webp'), 'cover');
  await writeText(path.join(rootDir, 'assets/previews/e9K2m1P4q7-cover.webp'), 'preview');
  await writeText(path.join(rootDir, 'assets/layouts/grid/background.webp'), 'layout-background');
};

const createBoxDirectoryWithStructure = async (rootDir: string, structureYaml: string): Promise<void> => {
  await writeText(
    path.join(rootDir, '.box/metadata.yaml'),
    [
      'chip_standards_version: "1.0.0"',
      `box_id: "${BOX_ID}"`,
      'name: "旅行箱"',
      'created_at: "2026-03-23T09:30:00.000Z"',
      'modified_at: "2026-03-23T11:20:00.000Z"',
      'active_layout_type: "chips.layout.grid"',
      ''
    ].join('\n')
  );
  await writeText(path.join(rootDir, '.box/structure.yaml'), structureYaml);
  await writeText(
    path.join(rootDir, '.box/cover.html'),
    '<!doctype html><html><body>旅行箱封面</body></html>',
  );
  await writeText(
    path.join(rootDir, '.box/content.yaml'),
    [
      'active_layout_type: "chips.layout.grid"',
      'layout_configs:',
      '  chips.layout.grid: {}',
      ''
    ].join('\n')
  );
};

afterEach(async () => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();
    if (!workspace) {
      continue;
    }
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

describe('BoxService', () => {
  it('validates, reads metadata and inspects the normalized box package', async () => {
    const workspace = await createWorkspace();
    const sourceDir = path.join(workspace, 'source-box');
    const boxFile = path.join(workspace, 'travel.box');
    const cardFile = path.join(workspace, 'cards/day-01.card');
    await writeText(cardFile, 'demo card');
    await createValidBoxDirectory(sourceDir, cardFile);

    const service = new BoxService();
    await service.pack(sourceDir, boxFile);

    await expect(service.validate(boxFile)).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(service.readMetadata(boxFile)).resolves.toMatchObject({
      boxId: BOX_ID,
      name: '旅行箱',
      activeLayoutType: 'chips.layout.grid',
      coverRatio: '3:4',
      coverAsset: 'assets/placeholders/box-cover.webp',
    });

    const inspection = await service.inspect(boxFile);
    expect(inspection.content.activeLayoutType).toBe('chips.layout.grid');
    expect(inspection.assets).toContain('assets/previews/e9K2m1P4q7-cover.webp');
    expect(inspection.entries[0]).toMatchObject({
      entryId: ENTRY_ID,
      enabled: true,
      snapshot: {
        title: '第一天',
        cover: {
          mode: 'asset',
          assetPath: 'assets/previews/e9K2m1P4q7-cover.webp',
        },
      },
      layoutHints: {
        group: '东京',
        priority: 3,
      },
    });
  });

  it('serves box cover documents through managed render urls when configured', async () => {
    const workspace = await createWorkspace();
    const sourceDir = path.join(workspace, 'source-box');
    const boxFile = path.join(workspace, 'travel.box');
    const cardFile = path.join(workspace, 'cards/day-01.card');
    await writeText(cardFile, 'demo card');
    await createValidBoxDirectory(sourceDir, cardFile);

    const service = new BoxService(undefined, { managedDocumentScheme: 'chips-render' });
    await service.pack(sourceDir, boxFile);

    const cover = await service.renderCover(boxFile);
    expect(cover.coverUrl.startsWith('chips-render://box-cover/')).toBe(true);

    const coverPath = service.resolveManagedDocumentFilePath(cover.coverUrl);
    expect(coverPath?.endsWith(path.join('.box', 'cover.html'))).toBe(true);
    await expect(fs.readFile(coverPath ?? '', 'utf-8')).resolves.toContain('旅行箱封面');
  });

  it('serves box session assets through managed render urls when configured', async () => {
    const workspace = await createWorkspace();
    const sourceDir = path.join(workspace, 'source-box');
    const boxFile = path.join(workspace, 'travel.box');
    const cardFile = path.join(workspace, 'cards/day-01.card');
    await writeText(cardFile, 'demo card');
    await createValidBoxDirectory(sourceDir, cardFile);

    const service = new BoxService(undefined, { managedDocumentScheme: 'chips-render' });
    await service.pack(sourceDir, boxFile);
    const opened = await service.openView(boxFile, {
      ownerKey: 'app:test-viewer',
    });

    try {
      const asset = await service.readBoxAsset(opened.sessionId, 'assets/layouts/grid/background.webp', 'app:test-viewer');
      expect(asset.mimeType).toBe('image/webp');
      expect(asset.resourceUrl.startsWith('chips-render://box-session/')).toBe(true);

      const assetPath = service.resolveManagedDocumentFilePath(asset.resourceUrl);
      expect(assetPath?.endsWith(path.join('assets', 'layouts', 'grid', 'background.webp'))).toBe(true);
      await expect(fs.readFile(assetPath ?? '', 'utf-8')).resolves.toBe('layout-background');

      const coverResource = await service.resolveEntryResource(
        opened.sessionId,
        ENTRY_ID,
        { kind: 'cover' },
        {
          ownerKey: 'app:test-viewer',
        }
      );
      expect(coverResource.resourceUrl.startsWith('chips-render://box-session/')).toBe(true);
    } finally {
      await service.closeView(opened.sessionId, 'app:test-viewer');
    }
  });

  it('opens box view sessions and serves entry detail plus box assets', async () => {
    const workspace = await createWorkspace();
    const sourceDir = path.join(workspace, 'source-box');
    const boxFile = path.join(workspace, 'travel.box');
    const cardFile = path.join(workspace, 'cards/day-01.card');
    await writeText(cardFile, 'demo card');
    await createValidBoxDirectory(sourceDir, cardFile);

    const service = new BoxService();
    await service.pack(sourceDir, boxFile);

    const opened = await service.openView(boxFile, {
      ownerKey: 'app:test-viewer',
      initialQuery: {
        limit: 10,
      },
    });

    expect(opened.box.boxId).toBe(BOX_ID);
    expect(opened.box.coverRatio).toBe('3:4');
    expect(opened.initialView.total).toBe(1);
    expect(opened.initialView.items[0]?.entryId).toBe(ENTRY_ID);

    await expect(service.listEntries(opened.sessionId, 'app:test-viewer', { filter: { enabled: true } })).resolves.toMatchObject({
      total: 1,
    });

    await expect(
      service.readEntryDetail(opened.sessionId, [ENTRY_ID], ['status', 'documentInfo'], {
        ownerKey: 'app:test-viewer',
        readCardInfo: async (resolvedCardFile) => ({
          cardFile: resolvedCardFile,
          info: {
            status: {
              state: 'ready',
              exists: true,
              valid: true
            },
            metadata: {
              raw: {
                name: 'Demo Card'
              },
              name: 'Demo Card'
            }
          }
        }),
      })
    ).resolves.toEqual({
      items: [
        {
          entryId: ENTRY_ID,
          detail: {
            status: {
              state: 'ready',
              scheme: 'file',
              url: pathToFileURL(cardFile).href,
            },
            documentInfo: {
              kind: 'card',
              status: {
                state: 'ready',
                exists: true,
                valid: true
              },
              metadata: {
                raw: {
                  name: 'Demo Card'
                },
                name: 'Demo Card'
              }
            },
          },
        },
      ],
    });

    const asset = await service.readBoxAsset(opened.sessionId, 'assets/layouts/grid/background.webp', 'app:test-viewer');
    expect(asset.mimeType).toBe('image/webp');
    expect(asset.resourceUrl.startsWith('file://')).toBe(true);

    const coverResource = await service.resolveEntryResource(
      opened.sessionId,
      ENTRY_ID,
      { kind: 'cover' },
      {
        ownerKey: 'app:test-viewer',
        readCardInfo: async () => ({
          cardFile,
          info: {
            status: {
              state: 'ready',
              exists: true,
              valid: true
            },
            cover: {
              title: 'Demo Card',
              resourceUrl: pathToFileURL(path.join(workspace, 'cover.html')).href,
              mimeType: 'text/html'
            }
          }
        })
      }
    );
    expect(coverResource.mimeType).toBe('image/webp');
    expect(coverResource.resourceUrl.startsWith('file://')).toBe(true);

    await expect(
      service.renderEntryCover(opened.sessionId, ENTRY_ID, {
        ownerKey: 'app:test-viewer',
        readCardInfo: async () => ({
          cardFile,
          info: {
            status: {
              state: 'ready',
              exists: true,
              valid: true
            },
            cover: {
              title: 'Demo Card',
              resourceUrl: pathToFileURL(path.join(workspace, 'cover.html')).href,
              mimeType: 'text/html',
              ratio: '3:4'
            },
            metadata: {
              raw: {
                name: 'Demo Card'
              },
              name: 'Demo Card',
              coverRatio: '3:4'
            }
          }
        })
      })
    ).resolves.toEqual({
      title: '第一天',
      coverUrl: coverResource.resourceUrl,
      mimeType: 'image/webp',
      ratio: '640:360'
    });

    await expect(
      service.prefetchEntries(opened.sessionId, [ENTRY_ID], ['cover', 'documentInfo'], {
        ownerKey: 'app:test-viewer',
        readCardInfo: async () => ({
          cardFile,
          info: {
            status: {
              state: 'ready',
              exists: true,
              valid: true
            }
          }
        }),
      })
    ).resolves.toEqual({ ack: true });

    await expect(
      service.openEntry(opened.sessionId, ENTRY_ID, {
        ownerKey: 'app:test-viewer',
        openCardFile: async (resolvedCardFile) => ({
          mode: 'document-window',
          documentType: 'card',
          windowId: `window:${resolvedCardFile}`
        })
      })
    ).resolves.toEqual({
      mode: 'document-window',
      documentType: 'card',
      windowId: `window:${cardFile}`
    });

    await expect(service.closeView(opened.sessionId, 'app:test-viewer')).resolves.toEqual({ ack: true });
    await expect(service.listEntries(opened.sessionId, 'app:test-viewer')).rejects.toMatchObject({
      code: 'BOX_VIEW_SESSION_NOT_FOUND',
    });
  });

  it('rejects legacy box fields during validation', async () => {
    const workspace = await createWorkspace();
    const invalidRoot = path.join(workspace, 'invalid-box');
    const invalidBoxFile = path.join(workspace, 'invalid.box');
    const cardFile = path.join(workspace, 'cards/day-01.card');
    await writeText(cardFile, 'demo card');
    await writeText(
      path.join(invalidRoot, '.box/metadata.yaml'),
      [
        'chip_standards_version: "1.0.0"',
        `box_id: "${BOX_ID}"`,
        'name: "坏箱子"',
        'created_at: "2026-03-23T09:30:00.000Z"',
        'modified_at: "2026-03-23T11:20:00.000Z"',
        'active_layout_type: "chips.layout.grid"',
        ''
      ].join('\n')
    );
    await writeText(
      path.join(invalidRoot, '.box/structure.yaml'),
      [
        'entries:',
        `  - entry_id: "${ENTRY_ID}"`,
        `    url: "${pathToFileURL(cardFile).href}"`,
        '    enabled: true',
        '    internal: true',
        ''
      ].join('\n')
    );
    await writeText(
      path.join(invalidRoot, '.box/content.yaml'),
      [
        'active_layout_type: "chips.layout.grid"',
        'layout_configs:',
        '  chips.layout.grid: {}',
        ''
      ].join('\n')
    );
    await writeText(
      path.join(invalidRoot, '.box/cover.html'),
      '<!doctype html><html><body>坏箱子封面</body></html>',
    );

    const zipService = new StoreZipService();
    await zipService.compress(invalidRoot, invalidBoxFile);

    const service = new BoxService();
    await expect(service.validate(invalidBoxFile)).resolves.toEqual({
      valid: false,
      errors: ['structure.entries[0] contains legacy location fields.'],
    });
  });

  it('renders box layout editor documents with a full-height editor root', async () => {
    const workspace = await createWorkspace();
    const pluginDir = path.join(workspace, 'plugins/chips-layout-grid');
    await writeText(
      path.join(pluginDir, 'index.mjs'),
      [
        'export const layoutDefinition = {',
        '  pluginId: "chips.layout.grid.plugin",',
        '  layoutType: "chips.layout.grid",',
        '  displayName: "Grid Layout",',
        '  createDefaultConfig() { return {}; },',
        '  normalizeConfig(input = {}) { return input; },',
        '  validateConfig() { return { valid: true, errors: {} }; },',
        '  renderView() {},',
        '  renderEditor() {},',
        '};',
        '',
      ].join('\n'),
    );

    const runtime: Pick<PluginRuntime, 'query'> = {
      query(filter) {
        if (filter?.type !== 'layout') {
          return [];
        }
        return [
          {
            enabled: true,
            installPath: pluginDir,
            manifestPath: path.join(pluginDir, 'manifest.yaml'),
            installedAt: Date.now(),
            manifest: {
              id: 'chips.layout.grid.plugin',
              version: '1.0.0',
              type: 'layout',
              name: 'Grid Layout',
              permissions: [],
              entry: 'index.mjs',
              layout: {
                layoutType: 'chips.layout.grid',
                displayName: 'Grid Layout',
              },
            },
          },
        ];
      },
    };

    const service = new BoxService(undefined, { runtime });

    const rendered = await service.renderLayoutEditor({
      layoutType: 'chips.layout.grid',
      entries: [],
      initialConfig: {},
      theme: {
        id: 'theme.test',
        tokens: {
          'chips.layout.gap.md': '12cpx',
          'chips.layout.size.navigation.primary.min': '160cpx',
        },
      },
      themeCssText: [
        '@font-face { font-family: "Material Symbols Outlined"; src: url("file:///theme/dist/icons/variablefont/MaterialSymbolsOutlined.woff2") format("woff2"); }',
        '[data-scope="box-layout"] { gap: 12cpx; min-inline-size: 160cpx; }',
      ].join('\n'),
    });

    const documentPath = fileURLToPath(rendered.documentUrl);
    const body = await fs.readFile(documentPath, 'utf-8');
    expect(body).toContain('@font-face');
    expect(body).toContain('Material Symbols Outlined');
    expect(body).toContain('file:///theme/dist/icons/variablefont/MaterialSymbolsOutlined.woff2');
    expect(body.indexOf('@font-face')).toBeLessThan(body.indexOf('--chips-layout-gap-md: 1.171875vw;'));
    expect(body.indexOf('--chips-layout-gap-md: 1.171875vw;')).toBeLessThan(
      body.indexOf('#chips-box-layout-editor-root')
    );
    expect(body).toContain('html { margin: 0; padding: 0; width: 100%; height: 100%; min-height: 100%; background: transparent; }');
    expect(body).toContain('body { margin: 0; padding: 0; width: 100%; height: 100%; min-height: 100%; min-width: 0;');
    expect(body).toContain('#chips-box-layout-editor-root { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }');
    expect(body).toContain('--chips-layout-gap-md: 1.171875vw;');
    expect(body).toContain('--chips-layout-size-navigation-primary-min: 15.625vw;');
    expect(body).toContain('gap: 1.171875vw; min-inline-size: 15.625vw;');
    expect(body).not.toContain('12cpx');
    expect(body).not.toContain('160cpx');

    await service.releaseRenderSession(rendered.sessionId);
  });

  it('renders box layout view documents through managed render urls with managed frame CSP', async () => {
    const workspace = await createWorkspace();
    const pluginDir = path.join(workspace, 'plugins/chips-layout-grid');
    await writeText(
      path.join(pluginDir, 'index.mjs'),
      [
        'export const layoutDefinition = {',
        '  pluginId: "chips.layout.grid.plugin",',
        '  layoutType: "chips.layout.grid",',
        '  displayName: "Grid Layout",',
        '  createDefaultConfig() { return {}; },',
        '  normalizeConfig(input = {}) { return input; },',
        '  validateConfig() { return { valid: true, errors: {} }; },',
        '  renderView() {},',
        '  renderEditor() {},',
        '};',
        '',
      ].join('\n'),
    );

    const runtime: Pick<PluginRuntime, 'query'> = {
      query(filter) {
        if (filter?.type !== 'layout') {
          return [];
        }
        return [
          {
            enabled: true,
            installPath: pluginDir,
            manifestPath: path.join(pluginDir, 'manifest.yaml'),
            installedAt: Date.now(),
            manifest: {
              id: 'chips.layout.grid.plugin',
              version: '1.0.0',
              type: 'layout',
              name: 'Grid Layout',
              permissions: [],
              entry: 'index.mjs',
              layout: {
                layoutType: 'chips.layout.grid',
                displayName: 'Grid Layout',
              },
            },
          },
        ];
      },
    };

    const service = new BoxService(undefined, { runtime, managedDocumentScheme: 'chips-render' });

    const rendered = await service.renderLayoutFrame({
      layoutType: 'chips.layout.grid',
      sessionId: 'box-view-session',
      box: {
        boxId: BOX_ID,
        boxFile: path.join(workspace, 'travel.box'),
        name: '旅行箱',
        activeLayoutType: 'chips.layout.grid',
        availableLayouts: ['chips.layout.grid'],
        capabilities: {
          listEntries: true,
          readEntryDetail: true,
          renderEntryCover: true,
          renderEntryDocument: true,
          releaseEntryDocument: true,
          resolveEntryResource: true,
          readBoxAsset: true,
          prefetchEntries: true,
          openEntry: true,
        },
      },
      initialView: {
        items: [],
        total: 0,
      },
      config: {},
      theme: {
        id: 'theme.test',
        tokens: {
          'chips.layout.gap.md': '12cpx',
          'chips.layout.size.navigation.primary.min': '160cpx',
        },
      },
      themeCssText: [
        '@font-face { font-family: "Material Symbols Rounded"; src: url("file:///theme/dist/icons/variablefont/MaterialSymbolsRounded.woff2") format("woff2"); }',
        '[data-scope="box-layout"] { gap: 12cpx; min-inline-size: 160cpx; }',
      ].join('\n'),
    });

    expect(rendered.documentUrl.startsWith('chips-render://session/')).toBe(true);
    const documentPath = service.resolveManagedDocumentFilePath(rendered.documentUrl);
    expect(documentPath?.endsWith('index.html')).toBe(true);

    const body = await fs.readFile(documentPath ?? '', 'utf-8');
    expect(body).toContain('frame-src about: file: http: https: blob: chips-render:');
    expect(body).toContain('font-src data: file: chips-render:');
    expect(body).toContain('@font-face');
    expect(body).toContain('Material Symbols Rounded');
    expect(body).toContain('file:///theme/dist/icons/variablefont/MaterialSymbolsRounded.woff2');
    expect(body.indexOf('@font-face')).toBeLessThan(body.indexOf('--chips-layout-gap-md: 1.171875vw;'));
    expect(body.indexOf('--chips-layout-gap-md: 1.171875vw;')).toBeLessThan(
      body.indexOf('#chips-box-layout-root')
    );
    expect(body).toContain('--chips-layout-gap-md: 1.171875vw;');
    expect(body).toContain('--chips-layout-size-navigation-primary-min: 15.625vw;');
    expect(body).toContain('gap: 1.171875vw; min-inline-size: 15.625vw;');
    expect(body).not.toContain('12cpx');
    expect(body).not.toContain('160cpx');

    await service.releaseRenderSession(rendered.sessionId);
  });

  describe('embedded card entries', () => {
    it('renders embedded cards as owned child sessions and releases them on demand or close', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          '    snapshot:',
          '      title: "第一天"',
          '      content_type: "chips/card"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);
      const opened = await service.openView(boxFile, { ownerKey: 'app:test-viewer' });
      const released: string[] = [];
      const renderedFiles: string[] = [];

      const first = await service.renderEntryDocument(opened.sessionId, ENTRY_ID, {
        ownerKey: 'app:test-viewer',
        mode: 'preview',
        interactionPolicy: 'delegate',
        renderCardFile: async (cardFile, options) => {
          renderedFiles.push(cardFile);
          expect(options).toEqual({ mode: 'preview', interactionPolicy: 'delegate' });
          return {
            title: '嵌入式卡片',
            documentUrl: 'chips-render://session/card-render-1/index.html',
            sessionId: 'card-render-1'
          };
        }
      });

      expect(renderedFiles[0]?.endsWith(path.join('cards', 'day-01.card'))).toBe(true);
      expect(first).toEqual({
        entryId: ENTRY_ID,
        documentType: 'card',
        title: '嵌入式卡片',
        documentUrl: 'chips-render://session/card-render-1/index.html',
        renderSessionId: 'card-render-1'
      });

      await expect(service.releaseEntryDocument(opened.sessionId, first.renderSessionId, {
        ownerKey: 'app:test-viewer',
        releaseCardRenderSession: async (renderSessionId) => {
          released.push(renderSessionId);
        }
      })).resolves.toEqual({ ack: true });
      expect(released).toEqual(['card-render-1']);
      await expect(service.releaseEntryDocument(opened.sessionId, first.renderSessionId, {
        ownerKey: 'app:test-viewer',
        releaseCardRenderSession: async () => undefined
      })).rejects.toMatchObject({ code: 'BOX_ENTRY_RENDER_SESSION_NOT_FOUND' });

      await service.renderEntryDocument(opened.sessionId, ENTRY_ID, {
        ownerKey: 'app:test-viewer',
        renderCardFile: async () => ({
          title: '嵌入式卡片',
          documentUrl: 'chips-render://session/card-render-2/index.html',
          sessionId: 'card-render-2'
        })
      });
      await expect(service.closeView(opened.sessionId, 'app:test-viewer', {
        releaseCardRenderSession: async (renderSessionId) => {
          released.push(renderSessionId);
        }
      })).resolves.toEqual({ ack: true });
      expect(released).toEqual(['card-render-1', 'card-render-2']);
    });

    it('rejects remote cards and nested boxes for inline document rendering', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      const nestedBoxFile = path.join(workspace, 'nested.box');
      await writeText(nestedBoxFile, 'nested box');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: "https://example.com/cards/day-01.card"',
          '    enabled: true',
          '    snapshot:',
          '      content_type: "chips/card"',
          '  - entry_id: "f3J8n2Q6r1"',
          `    url: "${pathToFileURL(nestedBoxFile).href}"`,
          '    enabled: true',
          '    snapshot:',
          '      content_type: "chips/box"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);
      const opened = await service.openView(boxFile, { ownerKey: 'app:test-viewer' });
      const renderCardFile = async () => ({
        title: 'unused',
        documentUrl: 'chips-render://session/unused/index.html',
        sessionId: 'unused'
      });

      try {
        await expect(service.renderEntryDocument(opened.sessionId, ENTRY_ID, {
          ownerKey: 'app:test-viewer',
          renderCardFile
        })).rejects.toMatchObject({ code: 'BOX_ENTRY_DOCUMENT_UNAVAILABLE' });
        await expect(service.renderEntryDocument(opened.sessionId, 'f3J8n2Q6r1', {
          ownerKey: 'app:test-viewer',
          renderCardFile
        })).rejects.toMatchObject({ code: 'BOX_ENTRY_DOCUMENT_TYPE_UNSUPPORTED' });
      } finally {
        await service.closeView(opened.sessionId, 'app:test-viewer');
      }
    });

    it('releases an inline card render that completes while the box view is closing', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: "cards/day-01.card"',
          '    enabled: true',
          '    snapshot:',
          '      document_id: "c7H1k2L9m3"',
          '      title: "嵌入式卡片"',
          '      content_type: "chips/card"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);
      const opened = await service.openView(boxFile, { ownerKey: 'app:test-viewer' });
      let completeRender!: () => void;
      const renderBarrier = new Promise<void>((resolve) => {
        completeRender = resolve;
      });
      let notifyRenderStarted!: () => void;
      const renderStarted = new Promise<void>((resolve) => {
        notifyRenderStarted = resolve;
      });
      const released: string[] = [];

      const rendering = service.renderEntryDocument(opened.sessionId, ENTRY_ID, {
        ownerKey: 'app:test-viewer',
        renderCardFile: async () => {
          notifyRenderStarted();
          await renderBarrier;
          return {
            title: '晚到卡片',
            documentUrl: 'chips-render://session/card-render-late/index.html',
            sessionId: 'card-render-late'
          };
        }
      });
      await renderStarted;
      const closing = service.closeView(opened.sessionId, 'app:test-viewer', {
        releaseCardRenderSession: async (renderSessionId) => {
          released.push(renderSessionId);
        }
      });

      completeRender();
      await expect(rendering).rejects.toMatchObject({ code: 'BOX_VIEW_SESSION_NOT_FOUND' });
      await expect(closing).resolves.toEqual({ ack: true });
      expect(released).toEqual(['card-render-late']);
    });

    it('packs embedded card files and inspects them through the normalized entry model', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          '    snapshot:',
          '      document_id: "c7H1k2L9m3"',
          '      title: "第一天"',
          '      content_type: "chips/card"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);

      await expect(service.validate(boxFile)).resolves.toEqual({
        valid: true,
        errors: []
      });

      const inspection = await service.inspect(boxFile);
      expect(inspection.entries[0]).toMatchObject({
        entryId: ENTRY_ID,
        url: 'cards/day-01.card',
        enabled: true,
        snapshot: {
          documentId: 'c7H1k2L9m3',
          title: '第一天',
          contentType: 'chips/card'
        }
      });

      const opened = await service.openView(boxFile, {
        ownerKey: 'app:test-viewer'
      });
      try {
        expect(opened.initialView.total).toBe(1);
        expect(opened.initialView.items[0]?.url).toBe('cards/day-01.card');
      } finally {
        await service.closeView(opened.sessionId, 'app:test-viewer');
      }
    });

    it('resolves embedded entries through detail, cover, resource and open flows', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          '    snapshot:',
          '      title: "第一天"',
          '      content_type: "chips/card"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);
      const opened = await service.openView(boxFile, {
        ownerKey: 'app:test-viewer'
      });

      try {
        const readCardInfo = async (resolvedCardFile: string) => ({
          cardFile: resolvedCardFile,
          info: {
            status: {
              state: 'ready' as const,
              exists: true,
              valid: true
            },
            metadata: {
              raw: {
                name: '嵌入式卡片'
              },
              name: '嵌入式卡片'
            },
            cover: {
              title: '嵌入式封面',
              resourceUrl: pathToFileURL(path.join(workspace, 'cover.html')).href,
              mimeType: 'text/html' as const,
              ratio: '3:4'
            }
          }
        });

        const detail = await service.readEntryDetail(opened.sessionId, [ENTRY_ID], ['status', 'documentInfo'], {
          ownerKey: 'app:test-viewer',
          readCardInfo
        });
        expect(detail.items[0]?.detail.status).toMatchObject({
          state: 'ready',
          scheme: 'file',
          url: 'cards/day-01.card'
        });
        expect(detail.items[0]?.detail.documentInfo).toMatchObject({
          kind: 'card',
          status: {
            state: 'ready',
            exists: true,
            valid: true
          },
          metadata: {
            name: '嵌入式卡片'
          }
        });

        await expect(
          service.renderEntryCover(opened.sessionId, ENTRY_ID, {
            ownerKey: 'app:test-viewer',
            readCardInfo
          })
        ).resolves.toEqual({
          title: '嵌入式封面',
          coverUrl: pathToFileURL(path.join(workspace, 'cover.html')).href,
          mimeType: 'text/html',
          ratio: '3:4'
        });

        const resource = await service.resolveEntryResource(
          opened.sessionId,
          ENTRY_ID,
          { kind: 'documentFile' },
          {
            ownerKey: 'app:test-viewer',
            readCardInfo
          }
        );
        expect(resource.resourceUrl.startsWith('file://')).toBe(true);
        expect(resource.mimeType).toBe('application/vnd.chips.card+zip');

        await expect(
          service.prefetchEntries(opened.sessionId, [ENTRY_ID], ['cover', 'documentInfo'], {
            ownerKey: 'app:test-viewer',
            readCardInfo
          })
        ).resolves.toEqual({ ack: true });

        await expect(
          service.openEntry(opened.sessionId, ENTRY_ID, {
            ownerKey: 'app:test-viewer',
            openCardFile: async (resolvedCardFile) => ({
              mode: 'document-window',
              documentType: 'card',
              windowId: `window:${resolvedCardFile}`
            })
          })
        ).resolves.toMatchObject({
          mode: 'document-window',
          documentType: 'card',
          windowId: expect.stringContaining(path.join('cards', 'day-01.card'))
        });
      } finally {
        await service.closeView(opened.sessionId, 'app:test-viewer');
      }
    });

    it('supports mixed entries: embedded, local file and remote urls', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      const externalCardFile = path.join(workspace, 'external/day-02.card');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await writeText(externalCardFile, 'external card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          '    snapshot:',
          '      title: "第一天"',
          '      content_type: "chips/card"',
          '  - entry_id: "f3J8n2Q6r1"',
          `    url: "${pathToFileURL(externalCardFile).href}"`,
          '    enabled: true',
          '    snapshot:',
          '      title: "第二天"',
          '      content_type: "chips/card"',
          '  - entry_id: "g4L9p2R6s1"',
          '    url: "https://example.com/cards/day-03.card"',
          '    enabled: true',
          '    snapshot:',
          '      title: "第三天"',
          '      content_type: "chips/card"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await service.pack(sourceDir, boxFile);

      const opened = await service.openView(boxFile, {
        ownerKey: 'app:test-viewer'
      });
      try {
        expect(opened.initialView.total).toBe(3);

        const detail = await service.readEntryDetail(
          opened.sessionId,
          [ENTRY_ID, 'f3J8n2Q6r1', 'g4L9p2R6s1'],
          ['status'],
          {
            ownerKey: 'app:test-viewer'
          }
        );
        const statuses = new Map(detail.items.map((item) => [item.entryId, item.detail.status]));
        expect(statuses.get(ENTRY_ID)).toMatchObject({ state: 'ready', scheme: 'file' });
        expect(statuses.get('f3J8n2Q6r1')).toMatchObject({ state: 'ready', scheme: 'file' });
        expect(statuses.get('g4L9p2R6s1')).toMatchObject({ state: 'remote', scheme: 'https' });

        await expect(
          service.openEntry(opened.sessionId, 'g4L9p2R6s1', {
            ownerKey: 'app:test-viewer',
            openExternalUrl: async () => undefined
          })
        ).resolves.toEqual({
          mode: 'external',
          url: 'https://example.com/cards/day-03.card'
        });
      } finally {
        await service.closeView(opened.sessionId, 'app:test-viewer');
      }
    });

    it('rejects invalid embedded entry paths during directory pack', async () => {
      const cases = [
        {
          fileName: 'cards/day-01.card',
          url: '../cards/day-01.card',
          message: 'contains invalid path segments'
        },
        {
          fileName: 'cards/day-01.card',
          url: '/cards/day-01.card',
          message: 'must be relative'
        },
        {
          fileName: 'cards/day-01.card',
          url: 'cards/notes.txt',
          message: 'must reference a .card file'
        },
        {
          fileName: 'cards/day-01.card',
          url: 'cards/missing.card',
          message: 'missing in the box package'
        },
        {
          fileName: 'nested.box',
          url: 'nested.box',
          message: 'must reference a .card file'
        }
      ];

      for (const testCase of cases) {
        const workspace = await createWorkspace();
        const sourceDir = path.join(workspace, 'source-box');
        const boxFile = path.join(workspace, 'travel.box');
        await writeText(path.join(sourceDir, testCase.fileName), 'content');
        await createBoxDirectoryWithStructure(
          sourceDir,
          [
            'entries:',
            `  - entry_id: "${ENTRY_ID}"`,
            `    url: "${testCase.url}"`,
            '    enabled: true',
            ''
          ].join('\n')
        );

        const service = new BoxService();
        await expect(service.pack(sourceDir, boxFile)).rejects.toMatchObject({
          code: 'BOX_SCHEMA_INVALID',
          message: expect.stringContaining(testCase.message)
        });
      }
    });

    it('rejects embedded entries that claim a box content type', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          '    snapshot:',
          '      content_type: "chips/box"',
          ''
        ].join('\n')
      );

      const service = new BoxService();
      await expect(service.pack(sourceDir, boxFile)).rejects.toMatchObject({
        code: 'BOX_SCHEMA_INVALID',
        message: expect.stringContaining('cannot reference box documents')
      });
    });

    it('allows embedded cards but still rejects box files inside archives', async () => {
      const workspace = await createWorkspace();
      const sourceDir = path.join(workspace, 'source-box');
      const boxFile = path.join(workspace, 'travel.box');
      await writeText(path.join(sourceDir, 'cards/day-01.card'), 'embedded card');
      await writeText(path.join(sourceDir, 'sub/nested.box'), 'nested box');
      await createBoxDirectoryWithStructure(
        sourceDir,
        [
          'entries:',
          `  - entry_id: "${ENTRY_ID}"`,
          '    url: cards/day-01.card',
          '    enabled: true',
          ''
        ].join('\n')
      );

      const zipService = new StoreZipService();
      await zipService.compress(sourceDir, boxFile);

      const service = new BoxService();
      await expect(service.validate(boxFile)).resolves.toEqual({
        valid: false,
        errors: ['Box package cannot embed box files: sub/nested.box']
      });
    });
  });
});
