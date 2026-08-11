import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostApplication } from '../../src/main/core/host-application';
import { openAssociatedFile } from '../../src/main/core/file-association';
import { StoreZipService } from '../../packages/zip-service/src';
import { RuntimeClient } from '../../src/renderer/runtime-client';
import { PluginRuntime } from '../../src/runtime';
import type { EventPayload } from '../../src/shared/types';

let workspace: string;
let app: HostApplication;
let runtime: RuntimeClient;

const ELECTRON_MOCK_KEY = '__chipsElectronMock';
const TIFF_SAMPLE_BASE64 =
  'SUkqAAgAAAAKAAABBAABAAAAAgAAAAEBBAABAAAAAgAAAAIBAwADAAAAhgAAAAMBAwABAAAAAQAAAAYBAwABAAAAAgAAABEBBAABAAAAjAAAABUBAwABAAAAAwAAABYBBAABAAAAAgAAABcBBAABAAAADAAAABwBAwABAAAAAQAAAAAAAAAIAAgACAD/AAD/AAD/AAD/AAA=';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const writeText = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
};

const workspaceRoot = path.resolve(__dirname, '../../..');
const finishedProductSpaceRoot = path.join(workspaceRoot, 'ProductFinishedProductTestingSpace');
const officialBaseCardPluginManifests = [
  'Chips-BaseCardPlugin/book-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/hyperlink-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/image-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/music-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/richtext-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/score-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/video-BCP/manifest.yaml',
  'Chips-BaseCardPlugin/webpage-BCP/manifest.yaml',
];
const officialBoxLayoutPluginManifests = [
  'Chips-BoxLayoutPlugin/grid-BLP/manifest.yaml',
  'Chips-BoxLayoutPlugin/list-BLP/manifest.yaml',
];
const officialDocumentAppPluginManifests = [
  'Chips-CardViewer/manifest.yaml',
];

const isArchivedTestingSpacePath = (filePath: string): boolean => {
  const relativePath = path.relative(finishedProductSpaceRoot, filePath);
  return relativePath === '归档' || relativePath.startsWith(`归档${path.sep}`);
};

const collectFinishedProductFiles = async (extension: '.card' | '.box'): Promise<string[]> => {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(directory, entry.name);
      if (isArchivedTestingSpacePath(nextPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(nextPath);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith(extension)) {
        files.push(nextPath);
      }
    }
  };
  await visit(finishedProductSpaceRoot);
  return files.sort((left, right) => left.localeCompare(right));
};

const displayFinishedProductPath = (filePath: string): string =>
  path.relative(finishedProductSpaceRoot, filePath).split(path.sep).join('/');

const expectManagedDocumentUrl = (documentUrl: string, label?: string): void => {
  expect(documentUrl, label).toMatch(/^(chips-render:\/\/|file:\/\/)/);
};

const installAndEnablePluginFromWorkspace = async (relativeManifestPath: string): Promise<string> => {
  const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', {
    manifestPath: path.join(workspaceRoot, relativeManifestPath)
  });
  await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
  return installed.pluginId;
};

const installOfficialCardAndBoxPlugins = async (): Promise<void> => {
  for (const manifestPath of officialDocumentAppPluginManifests) {
    await installAndEnablePluginFromWorkspace(manifestPath);
  }
  for (const manifestPath of officialBaseCardPluginManifests) {
    await installAndEnablePluginFromWorkspace(manifestPath);
  }
  for (const manifestPath of officialBoxLayoutPluginManifests) {
    await installAndEnablePluginFromWorkspace(manifestPath);
  }
};

const prepareTask055RealBoxFixture = async (): Promise<string> => {
  const sourceBoxFile = path.join(finishedProductSpaceRoot, '美食网格箱子.box');
  const extractedDir = path.join(workspace, 'task055-real-box-source');
  const preparedBoxFile = path.join(workspace, 'task055-real-box.box');
  const zip = new StoreZipService();
  await zip.extract(sourceBoxFile, extractedDir);

  const structurePath = path.join(extractedDir, '.box/structure.yaml');
  const structure = yaml.parse(await fs.readFile(structurePath, 'utf-8')) as {
    entries?: Array<{ url?: string }>;
  };
  for (const entry of structure.entries ?? []) {
    if (typeof entry.url !== 'string') {
      continue;
    }
    entry.url = entry.url.replace(
      'file:///Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f/ProductFinishedProductTestingSpace/',
      `${pathToFileURL(`${finishedProductSpaceRoot}${path.sep}`).href}`
    );
  }
  await fs.writeFile(structurePath, yaml.stringify(structure), 'utf-8');
  await zip.compress(extractedDir, preparedBoxFile);
  return preparedBoxFile;
};

const prepareTask056RealBoxFixture = prepareTask055RealBoxFixture;

const appRuntimeYamlLines = [
  'runtime:',
  '  targets:',
  '    desktop:',
  '      supported: true',
  '    web:',
  '      supported: false',
  '    mobile:',
  '      supported: false',
  '    headless:',
  '      supported: false'
];

const appSurfaceYamlLines = [
  '  surface:',
  '    defaultKind: window',
  '    preferredKinds:',
  '      desktop: window',
  '      web: route',
  '      mobile: fullscreen',
  '      headless: window'
];

const appSurfaceYamlLinesAtIndent = (indent: string): string[] =>
  appSurfaceYamlLines.map((line) => `${indent}${line}`);

const createLayoutPluginFixture = async (rootDir: string): Promise<string> => {
  const pluginDir = path.join(rootDir, 'fixture-grid-layout-plugin');
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'id: chips.layout.grid.fixture',
      'name: 网格布局插件',
      'version: "1.0.0"',
      'type: layout',
      'entry: dist/index.mjs',
      'description: Host integration fixture grid layout plugin',
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
      '  displayName: 网格布局插件'
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
      ''
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

const createThemePluginFixture = async (rootDir: string, id: string, themeId: string, displayName: string): Promise<string> => {
  const pluginDir = path.join(rootDir, `fixture-theme-${themeId.replace(/[^a-zA-Z0-9-]/g, '-')}`);
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'id: ' + id,
      'name: ' + displayName,
      'version: "1.0.0"',
      'type: theme',
      'entry:',
      '  tokens: dist/tokens.json',
      '  themeCss: dist/theme.css',
      'themeId: ' + themeId,
      'displayName: ' + displayName,
      'isDefault: false',
      'permissions: []',
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
      '      supported: false'
    ].join('\n') + '\n'
  );
  await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'dist/tokens.json'),
    JSON.stringify({ sys: { color: { primary: '#0a84ff' } } }),
    'utf-8'
  );
  await fs.writeFile(path.join(pluginDir, 'dist/theme.css'), ':root {}\n', 'utf-8');
  return path.join(pluginDir, 'manifest.yaml');
};

const createRichTextCardPluginFixture = async (rootDir: string): Promise<string> => {
  const pluginDir = path.join(rootDir, 'fixture-richtext-card-plugin');
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'id: chips.basecard.richtext.fixture',
      'name: 富文本基础卡片插件',
      'version: "1.0.0"',
      'type: card',
      'entry: dist/index.mjs',
      'description: Host integration fixture rich text base card plugin',
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
      '      supported: true'
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'dist/index.mjs'),
    [
      'export const basecardDefinition = {',
      '  pluginId: "chips.basecard.richtext.fixture",',
      '  cardTypes: ["base.richtext", "RichTextCard"],',
      '  renderView({ config }) {',
      '    const text = config?.content_text ?? config?.contentText ?? "";',
      '    return `<article data-scope="richtext-card"><h1>${String(text).replace(/^#\\\\s*/, "")}</h1></article>`;',
      '  },',
      '  renderEditor() {',
      '    return `<section data-scope="richtext-card-editor"></section>`;',
      '  },',
      '};',
      ''
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

const moduleContractJsonSchema = {
  type: 'object',
  additionalProperties: true
};

const writeModuleContractSchemas = async (
  pluginDir: string,
  methodNames: string[]
): Promise<void> => {
  for (const methodName of methodNames) {
    await writeText(
      path.join(pluginDir, 'contracts', `${methodName}.input.schema.json`),
      JSON.stringify(moduleContractJsonSchema, null, 2)
    );
    await writeText(
      path.join(pluginDir, 'contracts', `${methodName}.output.schema.json`),
      JSON.stringify(moduleContractJsonSchema, null, 2)
    );
  }
};

const createModulePluginFixture = async (
  rootDir: string,
  options: {
    pluginId: string;
    capability: string;
    version: string;
    methods: Array<{ name: string; mode?: 'sync' | 'job' }>;
    entryLines: string[];
    permissions?: string[];
    consumes?: Array<{ capability: string; versionRange?: string }>;
  }
): Promise<string> => {
  const pluginDir = path.join(rootDir, options.pluginId);
  const permissions = options.permissions ?? [];
  const consumes = options.consumes ?? [];
  const manifestLines = [
    `id: ${options.pluginId}`,
    `name: ${options.pluginId}`,
    'type: module',
    'version: "0.1.0"',
    'entry: dist/index.cjs',
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
    ...(permissions.length > 0 ? ['permissions:', ...permissions.map((permission) => `  - ${permission}`)] : ['permissions: []']),
    'module:',
    '  apiVersion: 1',
    '  runtime: worker',
    '  activation: onDemand',
    '  provides:',
    `    - capability: ${options.capability}`,
    `      version: "${options.version}"`,
    '      methods:',
    ...options.methods.flatMap((method) => [
      `        - name: ${method.name}`,
      `          mode: ${method.mode ?? 'sync'}`,
      `          inputSchema: contracts/${method.name}.input.schema.json`,
      `          outputSchema: contracts/${method.name}.output.schema.json`
    ]),
    ...(consumes.length > 0
      ? [
          '  consumes:',
          ...consumes.flatMap((consume) => [
            `    - capability: ${consume.capability}`,
            ...(consume.versionRange ? [`      versionRange: "${consume.versionRange}"`] : [])
          ])
        ]
      : ['  consumes: []'])
  ];

  await writeText(path.join(pluginDir, 'manifest.yaml'), manifestLines.join('\n'));
  await writeText(path.join(pluginDir, 'dist/index.cjs'), options.entryLines.join('\n'));
  await writeModuleContractSchemas(pluginDir, options.methods.map((method) => method.name));
  return path.join(pluginDir, 'manifest.yaml');
};

const installAndEnablePlugin = async (manifestPath: string): Promise<string> => {
  const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath });
  await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
  return installed.pluginId;
};

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-host-it-'));
  const bootstrapRuntime = new PluginRuntime(workspace, {
    locale: 'zh-CN',
    themeId: 'chips-official.default-theme'
  });
  await bootstrapRuntime.load();
  app = new HostApplication({ workspacePath: workspace });
  await app.start();
  runtime = new RuntimeClient(app.createBridge(), {
    defaultTimeout: 5000,
    maxRetries: 1,
    retryDelay: 10,
    retryBackoff: 2,
    enableRetry: true
  });
});

afterEach(async () => {
  delete (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY];
  await app.stop();
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('Host services integration', () => {
  it('reads and writes configuration through routes', async () => {
    await runtime.invoke('config.set', { key: 'ui.language', value: 'zh-CN' });
    const result = await runtime.invoke<{ value: string }>('config.get', { key: 'ui.language' });
    expect(result.value).toBe('zh-CN');
  });

  it('resolves layered config precedence by scope', async () => {
    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'system', scope: 'system' });
    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'workspace', scope: 'workspace' });
    const workspaceValue = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(workspaceValue.value).toBe('workspace');

    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'user', scope: 'user' });
    const userValue = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(userValue.value).toBe('user');

    await runtime.invoke('config.reset', { key: 'chips.layer.key', scope: 'user' });
    const fallbackWorkspace = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(fallbackWorkspace.value).toBe('workspace');

    await runtime.invoke('config.reset', { key: 'chips.layer.key', scope: 'workspace' });
    const fallbackSystem = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(fallbackSystem.value).toBe('system');
  });

  it('supports i18n translation and locale switching', async () => {
    await runtime.invoke('i18n.setCurrent', { locale: 'en-US' });
    const translated = await runtime.invoke<{ text: string }>('i18n.translate', { key: 'system.ready' });
    expect(translated.text).toBe('System ready');
  });

  it('lists enabled box layout plugins through the box service chain', async () => {
    const manifestPath = await createLayoutPluginFixture(workspace);
    const install = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath
    });
    await runtime.invoke('plugin.enable', { pluginId: install.pluginId });

    const listed = await runtime.invoke<{
      descriptors: Array<{
        pluginId: string;
        layoutType: string;
        displayName: string;
      }>;
    }>('box.listLayoutDescriptors', {});

    expect(listed.descriptors).toContainEqual(expect.objectContaining({
      pluginId: 'chips.layout.grid.fixture',
      layoutType: 'chips.layout.grid',
      displayName: '网格布局插件'
    }));

    const descriptor = await runtime.invoke<{
      descriptor: {
        pluginId: string;
        layoutType: string;
        displayName: string;
      };
    }>('box.readLayoutDescriptor', {
      layoutType: 'chips.layout.grid'
    });

    expect(descriptor.descriptor).toMatchObject({
      pluginId: 'chips.layout.grid.fixture',
      layoutType: 'chips.layout.grid',
      displayName: '网格布局插件'
    });
  });

  it('returns structured file entries from file.list', async () => {
    const cardsDir = path.join(workspace, 'cards');
    const cardPath = path.join(cardsDir, 'demo.card');
    await fs.mkdir(cardsDir, { recursive: true });
    await fs.writeFile(cardPath, 'demo', 'utf-8');

    const rootListed = await runtime.invoke<{
      entries: Array<{ path: string; isFile: boolean; isDirectory: boolean }>;
    }>('file.list', { dir: workspace });
    const nestedListed = await runtime.invoke<{
      entries: Array<{ path: string; isFile: boolean; isDirectory: boolean }>;
    }>('file.list', { dir: cardsDir });

    expect(rootListed.entries).toContainEqual(
      expect.objectContaining({
        path: cardsDir,
        isDirectory: true,
        isFile: false
      })
    );
    expect(nestedListed.entries).toContainEqual(
      expect.objectContaining({
        path: cardPath,
        isFile: true,
        isDirectory: false
      })
    );
  });

  it('resolves local resource paths as encoded file urls', async () => {
    const imageDir = path.join(workspace, '资源目录');
    const imageFile = path.join(imageDir, '图 片.png');
    await fs.mkdir(imageDir, { recursive: true });
    await fs.writeFile(imageFile, 'png', 'utf-8');

    const resolved = await runtime.invoke<{ uri: string }>('resource.resolve', {
      resourceId: imageFile
    });

    expect(resolved.uri.startsWith('file://')).toBe(true);
    expect(resolved.uri).toContain('%20');
    expect(fileURLToPath(resolved.uri)).toBe(imageFile);
  });

  it.runIf(process.platform === 'darwin')('converts TIFF resources to PNG files through the resource service', async () => {
    const imageDir = path.join(workspace, 'resource-image');
    const tiffFile = path.join(imageDir, 'cover.tiff');
    const pngFile = path.join(imageDir, 'cover.png');
    await fs.mkdir(imageDir, { recursive: true });
    await fs.writeFile(tiffFile, Buffer.from(TIFF_SAMPLE_BASE64, 'base64'));

    const converted = await runtime.invoke<{
      outputFile: string;
      mimeType: 'image/png';
      sourceMimeType: 'image/tiff';
      width?: number;
      height?: number;
    }>('resource.convertTiffToPng', {
      resourceId: tiffFile,
      outputFile: pngFile,
      overwrite: true
    });

    const outputBuffer = await fs.readFile(pngFile);
    expect(converted).toEqual({
      outputFile: pngFile,
      mimeType: 'image/png',
      sourceMimeType: 'image/tiff',
      width: 2,
      height: 2
    });
    expect(outputBuffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
  });

  it('renders card through unified rendering target options', async () => {
    const manifestPath = await createRichTextCardPluginFixture(workspace);
    const install = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath
    });
    await runtime.invoke('plugin.enable', { pluginId: install.pluginId });

    const source = path.join(workspace, 'render-card-source');
    await fs.mkdir(path.join(source, '.card'), { recursive: true });
    await fs.mkdir(path.join(source, 'content'), { recursive: true });
    await fs.writeFile(path.join(source, '.card/metadata.yaml'), 'card_id: card.render.demo\nname: Render Demo\n', 'utf-8');
    await fs.writeFile(
      path.join(source, '.card/structure.yaml'),
      'structure:\n  - id: "intro"\n    type: "RichTextCard"\n',
      'utf-8'
    );
    await fs.writeFile(path.join(source, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    await fs.writeFile(
      path.join(source, 'content/intro.yaml'),
      'card_type: "RichTextCard"\ncontent_format: "markdown"\ncontent_source: "inline"\ncontent_text: |\n  # Render Intro\n\n  Rendered through host service.\n',
      'utf-8'
    );

    const cardFile = path.join(workspace, 'render-demo.card');
    const zip = new StoreZipService();
    await zip.compress(source, cardFile);

    const rendered = await runtime.invoke<{
      view: {
        target: string;
        body: string;
        documentUrl: string;
        sessionId: string;
        semanticHash: string;
        diagnostics?: Array<{ nodeId: string; path: string; severity: string; qualityGateBlocking: boolean }>;
        qualityGate?: { passed: boolean; blockingCount: number };
        consistency?: { consistent: boolean };
      };
    }>('card.render', {
      cardFile,
      options: {
        target: 'offscreen-render',
        verifyConsistency: true
      }
    });

    expect(rendered.view.target).toBe('offscreen-render');
    expect(rendered.view.body).toContain('data-target="offscreen-render"');
    expect(rendered.view.documentUrl.startsWith('file://')).toBe(true);
    expect(rendered.view.sessionId).toMatch(/^card-render-/);
    const indexPath = fileURLToPath(rendered.view.documentUrl);
    const sessionRoot = path.dirname(indexPath);
    const frameSrc = rendered.view.body.match(/data-node-id="intro"[^>]*src="([^"]+)"/)?.[1];
    expect(frameSrc).toBeTruthy();
    const persistedCompositeHtml = await fs.readFile(indexPath, 'utf-8');
    const introNodeHtml = await fs.readFile(path.resolve(sessionRoot, frameSrc ?? ''), 'utf-8');

    expect(persistedCompositeHtml).toBe(rendered.view.body);
    expect(introNodeHtml).toContain('Render Intro');
    expect(introNodeHtml).toContain('Rendered through host service.');
    expect(rendered.view.semanticHash.length).toBeGreaterThan(10);
    expect(rendered.view.diagnostics).toEqual([]);
    expect(rendered.view.qualityGate).toMatchObject({ passed: true, blockingCount: 0 });
    expect(rendered.view.consistency?.consistent).toBe(true);

    await expect(
      runtime.invoke<{ path: string }>('card.resolveDocumentPath', { documentUrl: rendered.view.documentUrl }),
    ).resolves.toEqual({ path: indexPath });

    await expect(runtime.invoke('card.releaseRenderSession', { sessionId: rendered.view.sessionId })).resolves.toBeDefined();
  }, 30_000);

  it('rejects invalid card.render options target by schema', async () => {
    await expect(
      runtime.invoke('card.render', {
        cardFile: '/tmp/invalid.card',
        options: {
          target: 'invalid-target'
        }
      })
    ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
  });

  it('supports card.render theme and locale overrides', async () => {
    const manifestPath = await createRichTextCardPluginFixture(workspace);
    const richTextInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath
    });
    await runtime.invoke('plugin.enable', { pluginId: richTextInstall.pluginId });

    const source = path.join(workspace, 'render-override-source');
    await fs.mkdir(path.join(source, '.card'), { recursive: true });
    await fs.mkdir(path.join(source, 'content'), { recursive: true });
    await fs.writeFile(path.join(source, '.card/metadata.yaml'), 'card_id: card.render.override\nname: Override Demo\n', 'utf-8');
    await fs.writeFile(
      path.join(source, '.card/structure.yaml'),
      'structure:\n  - id: "intro"\n    type: "RichTextCard"\n',
      'utf-8'
    );
    await fs.writeFile(path.join(source, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    await fs.writeFile(
      path.join(source, 'content/intro.yaml'),
      'card_type: "RichTextCard"\ncontent_format: "markdown"\ncontent_source: "inline"\ncontent_text: |\n  override test\n',
      'utf-8'
    );

    const cardFile = path.join(workspace, 'render-override.card');
    const zip = new StoreZipService();
    await zip.compress(source, cardFile);

    const baseline = await runtime.invoke<{ view: { semanticHash: string } }>('card.render', {
      cardFile
    });
    const overridden = await runtime.invoke<{ view: { body: string; semanticHash: string } }>('card.render', {
      cardFile,
      options: {
        locale: 'en-US'
      }
    });

    expect(overridden.view.body).toContain('<html lang="en-US">');
    expect(overridden.view.semanticHash).not.toBe(baseline.view.semanticHash);
  }, 30_000);

  it('exports local html to pdf through formal platform action', async () => {
    const outputFile = path.join(workspace, 'exported.pdf');
    const htmlDir = path.join(workspace, 'html-export-pdf');
    const executedScripts: string[] = [];
    const printOptions: Record<string, unknown>[] = [];
    await fs.mkdir(htmlDir, { recursive: true });
    await fs.writeFile(path.join(htmlDir, 'index.html'), '<!doctype html><html><body><h1>PDF</h1></body></html>', 'utf-8');

    class MockBrowserWindow {
      public webContents = {
        executeJavaScript: async (code: string) => {
          executedScripts.push(code);
          return [{ code: 'HTML_EXPORT_READY_TIMEOUT' }];
        },
        printToPDF: async (options: Record<string, unknown>) => {
          printOptions.push(options);
          return Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF', 'latin1');
        },
        capturePage: async () => {
          throw new Error('not used');
        },
        send: () => undefined,
        id: 1
      };

      public constructor(_options: Record<string, unknown>) {}
      public focus(): void {}
      public setSize(_width: number, _height: number): void {}
      public getBounds(): { width: number; height: number } {
        return { width: 1280, height: 960 };
      }
      public setTitle(_title: string): void {}
      public isFocused(): boolean { return false; }
      public isMinimized(): boolean { return false; }
      public isMaximized(): boolean { return false; }
      public isFullScreen(): boolean { return false; }
      public minimize(): void {}
      public maximize(): void {}
      public setFullScreen(_flag: boolean): void {}
      public restore(): void {}
      public close(): void {}
      public isDestroyed(): boolean { return false; }
      public on(_event: 'closed', _listener: () => void): void {}
      public async loadURL(_url: string): Promise<void> {}
      public async loadFile(_filePath: string): Promise<void> {}
    }

    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      BrowserWindow: MockBrowserWindow
    };

    const result = await runtime.invoke<{ outputFile: string; pageCount?: number; byteLength?: number; diagnostics?: unknown[] }>('platform.renderHtmlToPdf', {
      htmlDir,
      outputFile,
      options: {
        pageSize: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        headerFooter: {
          enabled: true,
          footerTemplate: '<span class="pageNumber"></span>'
        },
        wait: {
          timeoutMs: 12000,
          quietMs: 120,
          waitForImages: true
        }
      }
    });

    const written = await fs.readFile(outputFile);
    expect(result.outputFile).toBe(outputFile);
    expect(result.pageCount).toBe(1);
    expect(result.byteLength).toBe(written.byteLength);
    expect(result.diagnostics).toEqual([{ code: 'HTML_EXPORT_READY_TIMEOUT' }]);
    expect(written.toString('latin1')).toContain('%PDF-1.7');
    expect(printOptions[0]).toMatchObject({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      footerTemplate: '<span class="pageNumber"></span>'
    });
    expect(executedScripts.some((code) => code.includes('.chips-composite__frame'))).toBe(true);
    expect(executedScripts.some((code) => code.includes('frame.loading = "eager"'))).toBe(true);
    expect(executedScripts.some((code) => code.includes('chipsCompositeReady'))).toBe(true);
    expect(executedScripts.some((code) => code.includes('frame.dataset.renderReady === "true"'))).toBe(true);
    expect(executedScripts.some((code) => code.includes('"timeoutMs":12000'))).toBe(true);
  });

  it('exports local html to image through formal platform action', async () => {
    const outputFile = path.join(workspace, 'exported.png');
    const htmlDir = path.join(workspace, 'html-export-image');
    await fs.mkdir(htmlDir, { recursive: true });
    await fs.writeFile(path.join(htmlDir, 'index.html'), '<!doctype html><html><body><h1>PNG</h1></body></html>', 'utf-8');

    class MockBrowserWindow {
      public webContents = {
        executeJavaScript: async <T,>() => ({ width: 640, height: 360 } as T),
        printToPDF: async () => Buffer.alloc(0),
        capturePage: async () => ({
          toPNG: () => Buffer.from('png-binary'),
          toJPEG: () => Buffer.from('jpeg-binary'),
          getSize: () => ({ width: 640, height: 360 })
        }),
        send: () => undefined,
        id: 1
      };

      public constructor(_options: Record<string, unknown>) {}
      public focus(): void {}
      public setSize(_width: number, _height: number): void {}
      public getBounds(): { width: number; height: number } {
        return { width: 1280, height: 960 };
      }
      public setTitle(_title: string): void {}
      public isFocused(): boolean { return false; }
      public isMinimized(): boolean { return false; }
      public isMaximized(): boolean { return false; }
      public isFullScreen(): boolean { return false; }
      public minimize(): void {}
      public maximize(): void {}
      public setFullScreen(_flag: boolean): void {}
      public restore(): void {}
      public close(): void {}
      public isDestroyed(): boolean { return false; }
      public on(_event: 'closed', _listener: () => void): void {}
      public async loadURL(_url: string): Promise<void> {}
      public async loadFile(_filePath: string): Promise<void> {}
    }

    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      BrowserWindow: MockBrowserWindow
    };

    const result = await runtime.invoke<{ outputFile: string; width?: number; height?: number; format: string }>(
      'platform.renderHtmlToImage',
      {
        htmlDir,
        outputFile,
        options: {
          format: 'png',
          background: 'theme'
        }
      }
    );

    const written = await fs.readFile(outputFile, 'utf-8');
    expect(result.outputFile).toBe(outputFile);
    expect(result.format).toBe('png');
    expect(result.width).toBe(640);
    expect(result.height).toBe(360);
    expect(written).toBe('png-binary');
  });

  it('re-waits and re-measures image export after resizing the capture viewport', async () => {
    const outputFile = path.join(workspace, 'exported-resized.png');
    const htmlDir = path.join(workspace, 'html-export-image-resized');
    await fs.mkdir(htmlDir, { recursive: true });
    await fs.writeFile(path.join(htmlDir, 'index.html'), '<!doctype html><html><body><h1>PNG</h1></body></html>', 'utf-8');

    const setSizeCalls: Array<{ width: number; height: number }> = [];
    const captureRects: Array<{ x: number; y: number; width: number; height: number }> = [];
    let measureCall = 0;

    class MockBrowserWindow {
      public webContents = {
        executeJavaScript: async <T,>(code: string) => {
          if (code.includes('chipsCompositeReady')) {
            return true as T;
          }
          measureCall += 1;
          if (measureCall === 1) {
            return { width: 640, height: 320 } as T;
          }
          return { width: 640, height: 960 } as T;
        },
        printToPDF: async () => Buffer.alloc(0),
        capturePage: async (rect?: { x: number; y: number; width: number; height: number }) => {
          if (rect) {
            captureRects.push(rect);
          }
          return {
            toPNG: () => Buffer.from('png-resized'),
            toJPEG: () => Buffer.from('jpeg-resized'),
            getSize: () => ({ width: rect?.width ?? 0, height: rect?.height ?? 0 })
          };
        },
        send: () => undefined,
        id: 1
      };

      public constructor(_options: Record<string, unknown>) {}
      public focus(): void {}
      public setSize(width: number, height: number): void {
        setSizeCalls.push({ width, height });
      }
      public getBounds(): { width: number; height: number } {
        return { width: 1280, height: 960 };
      }
      public setTitle(_title: string): void {}
      public isFocused(): boolean { return false; }
      public isMinimized(): boolean { return false; }
      public isMaximized(): boolean { return false; }
      public isFullScreen(): boolean { return false; }
      public minimize(): void {}
      public maximize(): void {}
      public setFullScreen(_flag: boolean): void {}
      public restore(): void {}
      public close(): void {}
      public isDestroyed(): boolean { return false; }
      public on(_event: 'closed', _listener: () => void): void {}
      public async loadURL(_url: string): Promise<void> {}
      public async loadFile(_filePath: string): Promise<void> {}
    }

    (globalThis as Record<string, unknown>)[ELECTRON_MOCK_KEY] = {
      BrowserWindow: MockBrowserWindow
    };

    const result = await runtime.invoke<{ outputFile: string; width?: number; height?: number; format: string }>(
      'platform.renderHtmlToImage',
      {
        htmlDir,
        outputFile,
        options: {
          format: 'png',
        }
      }
    );

    expect(result.outputFile).toBe(outputFile);
    expect(result.width).toBe(640);
    expect(result.height).toBe(960);
    expect(setSizeCalls).toEqual([
      { width: 640, height: 320 },
      { width: 640, height: 960 }
    ]);
    expect(captureRects).toEqual([
      { x: 0, y: 0, width: 640, height: 960 }
    ]);
    expect(await fs.readFile(outputFile, 'utf-8')).toBe('png-resized');
  });

  it('packs directory cards through card service routes and restores generated metadata on unpack', async () => {
    const source = path.join(workspace, 'pack-card-source');
    await fs.mkdir(path.join(source, '.card'), { recursive: true });
    await fs.mkdir(path.join(source, 'content'), { recursive: true });
    await fs.writeFile(
      path.join(source, '.card/metadata.yaml'),
      [
        'chip_standards_version: "1.0.0"',
        'card_id: "packcard01"',
        'name: "Packed Through Route"',
        'created_at: "2026-03-17T09:00:00.000Z"',
        'modified_at: "2026-03-17T09:00:00.000Z"'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(
      path.join(source, '.card/structure.yaml'),
      'structure:\n  - id: "intro"\n    type: "RichTextCard"\n',
      'utf-8'
    );
    await fs.writeFile(path.join(source, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    await fs.writeFile(
      path.join(source, 'content/intro.yaml'),
      'card_type: "RichTextCard"\ncontent_format: "markdown"\ncontent_source: "inline"\ncontent_text: |\n  route pack\n',
      'utf-8'
    );

    const cardFile = path.join(workspace, 'route-packed.card');
    const packed = await runtime.invoke<{ cardFile: string }>('card.pack', {
      cardDir: source,
      outputPath: cardFile
    });
    expect(packed.cardFile).toBe(cardFile);

    const metadata = await runtime.invoke<{ metadata: Record<string, unknown> }>('card.readMetadata', {
      cardFile
    });
    expect(metadata.metadata.name).toBe('Packed Through Route');
    expect(metadata.metadata.file_info).toMatchObject({
      file_count: 4,
      total_size: expect.any(Number),
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      generated_at: expect.any(String)
    });

    const unpackDir = path.join(workspace, 'route-packed-unpacked');
    const unpacked = await runtime.invoke<{ outputDir: string }>('card.unpack', {
      cardFile,
      outputDir: unpackDir
    });
    expect(unpacked.outputDir).toBe(unpackDir);

    const structure = yaml.parse(
      await fs.readFile(path.join(unpackDir, '.card/structure.yaml'), 'utf-8')
    ) as Record<string, unknown>;
    expect((structure.manifest as Record<string, unknown>).card_count).toBe(1);
  });

  it('validates real finished .card and .box materials through formal document service routes', async () => {
    await installAndEnablePluginFromWorkspace('Chips-BaseCardPlugin/richtext-BCP/manifest.yaml');
    await installAndEnablePluginFromWorkspace('Chips-BaseCardPlugin/image-BCP/manifest.yaml');
    await installAndEnablePluginFromWorkspace('Chips-BaseCardPlugin/music-BCP/manifest.yaml');
    await installAndEnablePluginFromWorkspace('Chips-BoxLayoutPlugin/grid-BLP/manifest.yaml');

    const cardFile = path.join(finishedProductSpaceRoot, '富文本基础卡片.card');
    const cardValidation = await runtime.invoke<{ valid: boolean; errors: string[] }>('card.validate', { cardFile });
    expect(cardValidation).toEqual({ valid: true, errors: [] });

    const renderedCard = await runtime.invoke<{
      view: {
        title: string;
        body: string;
        documentUrl: string;
        sessionId: string;
        contentFiles: string[];
        diagnostics: Array<{ severity: string }>;
        qualityGate: { passed: boolean; blockingCount: number };
      };
    }>('card.render', {
      cardFile,
      options: {
        target: 'card-iframe',
        verifyConsistency: true,
      }
    });
    expect(renderedCard.view.title).toBe('富文本基础卡片');
    expect(renderedCard.view.contentFiles).toEqual([
      'magrpV5bWu.yaml',
      'qIIDkJWai3.yaml',
      's2J2SH1yMR.yaml'
    ]);
    expect(renderedCard.view.diagnostics).toEqual([]);
    expect(renderedCard.view.qualityGate).toMatchObject({ passed: true, blockingCount: 0 });
    expect(renderedCard.view.body).toContain('data-node-id="magrpV5bWu"');
    expect(renderedCard.view.body).toContain('data-node-id="s2J2SH1yMR"');
    expect(renderedCard.view.body).toContain('data-node-id="qIIDkJWai3"');

    const richTextEditor = await runtime.invoke<{
      view: { cardType: string; pluginId: string; baseCardId?: string; body: string; sessionId: string };
    }>('card.renderEditor', {
      cardType: 'RichTextCard',
      baseCardId: 'magrpV5bWu',
      initialConfig: {
        id: 'magrpV5bWu',
        card_type: 'RichTextCard',
        content_source: 'inline',
        content_text: '任务055.07安装态编辑器验收'
      }
    });
    expect(richTextEditor.view.pluginId).toBe('chips.basecard.richtext');
    expect(richTextEditor.view.body).toContain('renderBasecardEditor');

    const unpackedCardDir = path.join(workspace, 'real-card-unpacked');
    await expect(runtime.invoke('card.unpack', { cardFile, outputDir: unpackedCardDir })).resolves.toMatchObject({
      outputDir: unpackedCardDir
    });
    await fs.appendFile(
      path.join(unpackedCardDir, 'content/magrpV5bWu.yaml'),
      '\nverification_note: "task055.07 route save check"\n',
      'utf-8'
    );
    const repackedCardFile = path.join(workspace, 'real-card-repacked.card');
    await expect(runtime.invoke('card.pack', { cardDir: unpackedCardDir, outputPath: repackedCardFile })).resolves.toMatchObject({
      cardFile: repackedCardFile
    });
    await expect(runtime.invoke('card.validate', { cardFile: repackedCardFile })).resolves.toEqual({ valid: true, errors: [] });

    const boxFile = await prepareTask055RealBoxFixture();
    await expect(runtime.invoke('box.validate', { boxFile })).resolves.toEqual({
      validationResult: { valid: true, errors: [] }
    });

    const inspection = await runtime.invoke<{
      inspection: {
        metadata: { name: string; activeLayoutType: string };
        content: { activeLayoutType: string; layoutConfigs: Record<string, Record<string, unknown>> };
        entries: Array<{ entryId: string; url: string; enabled: boolean }>;
      };
    }>('box.inspect', { boxFile });
    expect(inspection.inspection.metadata).toMatchObject({
      name: '美食网格箱子',
      activeLayoutType: 'chips.layout.grid'
    });
    expect(inspection.inspection.entries).toHaveLength(15);
    expect(inspection.inspection.entries.every((entry) => entry.url.startsWith(pathToFileURL(`${finishedProductSpaceRoot}${path.sep}`).href))).toBe(true);

    const normalizedConfig = await runtime.invoke<{ config: Record<string, unknown> }>('box.normalizeLayoutConfig', {
      layoutType: 'chips.layout.grid',
      config: inspection.inspection.content.layoutConfigs['chips.layout.grid'] ?? {}
    });
    const initialQuery = await runtime.invoke<{ query?: Record<string, unknown> }>('box.getLayoutInitialQuery', {
      layoutType: 'chips.layout.grid',
      config: normalizedConfig.config
    });
    const openedBox = await runtime.invoke<{
      sessionId: string;
      box: { name: string; activeLayoutType: string };
      initialView: { total: number; items: Array<{ entryId: string }> };
    }>('box.openView', {
      boxFile,
      layoutType: 'chips.layout.grid',
      initialQuery: initialQuery.query
    });
    expect(openedBox.box.name).toBe('美食网格箱子');
    expect(openedBox.initialView.total).toBe(15);
    expect(openedBox.initialView.items.length).toBeGreaterThan(0);

    const renderedBox = await runtime.invoke<{
      view: { title: string; layoutType: string; pluginId: string; documentUrl: string; sessionId: string };
    }>('box.renderLayoutFrame', {
      layoutType: 'chips.layout.grid',
      sessionId: openedBox.sessionId,
      box: openedBox.box,
      initialView: openedBox.initialView,
      config: normalizedConfig.config
    });
    expect(renderedBox.view.title).toBe('美食网格箱子');
    expect(renderedBox.view.layoutType).toBe('chips.layout.grid');
    expect(renderedBox.view.pluginId).toBe('chips.layout.grid');

    const boxEditor = await runtime.invoke<{
      view: { title: string; layoutType: string; pluginId: string; documentUrl: string; sessionId: string };
    }>('box.renderLayoutEditor', {
      layoutType: 'chips.layout.grid',
      entries: inspection.inspection.entries,
      initialConfig: normalizedConfig.config
    });
    expect(boxEditor.view.layoutType).toBe('chips.layout.grid');
    expect(boxEditor.view.pluginId).toBe('chips.layout.grid');

    const firstEntryId = openedBox.initialView.items[0]?.entryId;
    expect(firstEntryId).toBeTypeOf('string');
    await expect(runtime.invoke('box.renderEntryCover', {
      sessionId: openedBox.sessionId,
      entryId: firstEntryId
    })).resolves.toMatchObject({
      view: {
        title: expect.any(String),
        mimeType: 'text/html'
      }
    });

    const unpackedBoxDir = path.join(workspace, 'real-box-unpacked');
    await expect(runtime.invoke('box.unpack', { boxFile, outputDir: unpackedBoxDir })).resolves.toMatchObject({
      outputDir: unpackedBoxDir
    });
    const contentPath = path.join(unpackedBoxDir, '.box/content.yaml');
    const content = yaml.parse(await fs.readFile(contentPath, 'utf-8')) as Record<string, unknown>;
    content.verification_note = 'task055.07 route save check';
    await fs.writeFile(contentPath, yaml.stringify(content), 'utf-8');
    const repackedBoxFile = path.join(workspace, 'real-box-repacked.box');
    await expect(runtime.invoke('box.pack', { boxDir: unpackedBoxDir, outputPath: repackedBoxFile })).resolves.toMatchObject({
      boxFile: repackedBoxFile
    });
    await expect(runtime.invoke('box.validate', { boxFile: repackedBoxFile })).resolves.toEqual({
      validationResult: { valid: true, errors: [] }
    });

    await expect(runtime.invoke('card.releaseRenderSession', { sessionId: renderedCard.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('card.releaseRenderSession', { sessionId: richTextEditor.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('box.releaseRenderSession', { sessionId: renderedBox.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('box.releaseRenderSession', { sessionId: boxEditor.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('box.closeView', { sessionId: openedBox.sessionId })).resolves.toMatchObject({ ack: true });
  }, 60_000);

  it('regresses all task056 real .card and .box materials through Host card and box service routes', async () => {
    await installOfficialCardAndBoxPlugins();

    const cardFiles = await collectFinishedProductFiles('.card');
    const boxFiles = await collectFinishedProductFiles('.box');
    expect(cardFiles.map(displayFinishedProductPath)).toEqual([
      'Markdown语法测试.card',
      '一个美食菜单.card',
      '吊带袜天使1.card',
      '富文本基础卡片.card',
      '视频音乐卡片.card',
      '美食卡片成品/美食卡片-01-点心百宝盒.card',
      '美食卡片成品/美食卡片-02-咖喱香料剧场.card',
      '美食卡片成品/美食卡片-03-意面卷起的风景.card',
      '美食卡片成品/美食卡片-04-面包清晨图鉴.card',
      '美食卡片成品/美食卡片-05-丼饭一碗宇宙.card',
      '美食卡片成品/美食卡片-06-寿司色彩案内.card',
      '美食卡片成品/美食卡片-07-炸物金色音阶.card',
      '美食卡片成品/美食卡片-08-果实甜度地图.card',
      '美食卡片成品/美食卡片-09-汤物暖流笔记.card',
      '美食卡片成品/美食卡片-10-洋食怀旧餐盘.card',
      '美食卡片成品/美食卡片-11-町中華热锅气.card',
      '美食卡片成品/美食卡片-12-锅物围坐计划.card',
      '美食卡片成品/美食卡片-13-饮品清爽菜单.card',
      '美食卡片成品/美食卡片-14-鱼介鲜味小港.card',
      '美食卡片成品/美食卡片-15-面类热气路线.card',
      '集大成者.card',
    ]);
    expect(boxFiles.map(displayFinishedProductPath)).toEqual(['美食网格箱子.box']);

    for (const cardFile of cardFiles) {
      const label = displayFinishedProductPath(cardFile);
      await expect(runtime.invoke('card.validate', { cardFile }), label).resolves.toEqual({
        valid: true,
        errors: [],
      });

      const info = await runtime.invoke<{
        info: {
          info: {
            status?: { state: string; valid: boolean; exists: boolean };
            metadata?: { name?: string; cardId?: string; coverRatio?: string };
            cover?: { title: string; resourceUrl: string; mimeType: string; ratio?: string };
          };
        };
      }>('card.readInfo', {
        cardFile,
        fields: ['status', 'metadata', 'cover'],
      });
      expect(info.info.info.status, label).toMatchObject({
        state: 'ready',
        exists: true,
        valid: true,
      });
      expect(info.info.info.metadata?.name, label).toBeTruthy();
      expect(info.info.info.metadata?.cardId, label).toMatch(/^[0-9a-zA-Z]{10}$/);
      expect(info.info.info.metadata?.coverRatio, label).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/);
      expect(info.info.info.cover, label).toMatchObject({
        title: info.info.info.metadata?.name,
        mimeType: 'text/html',
      });
      expect(info.info.info.cover?.resourceUrl, label).toBeTruthy();

      const cover = await runtime.invoke<{
        view: { title: string; coverUrl: string; mimeType?: string; ratio?: string };
      }>('card.renderCover', { cardFile });
      expect(cover.view.title, label).toBe(info.info.info.metadata?.name);
      expect(cover.view.coverUrl, label).toBeTruthy();
      expect(cover.view.ratio, label).toBe(info.info.info.metadata?.coverRatio);

      const rendered = await runtime.invoke<{
        view: {
          title: string;
          body: string;
          documentUrl: string;
          sessionId: string;
          contentFiles: string[];
          diagnostics: Array<{ severity: string }>;
          qualityGate: { passed: boolean; blockingCount: number };
        };
      }>('card.render', {
        cardFile,
        options: {
          target: 'card-iframe',
          verifyConsistency: true,
        },
      });
      expect(rendered.view.title, label).toBe(info.info.info.metadata?.name);
      expectManagedDocumentUrl(rendered.view.documentUrl, label);
      expect(rendered.view.contentFiles.length, label).toBeGreaterThan(0);
      expect(rendered.view.diagnostics, label).toEqual([]);
      expect(rendered.view.qualityGate, label).toMatchObject({
        passed: true,
        blockingCount: 0,
      });
      expect(rendered.view.body, label).toContain('chips-composite');
      await expect(
        runtime.invoke('card.releaseRenderSession', { sessionId: rendered.view.sessionId }),
        label,
      ).resolves.toMatchObject({ ack: true });
    }

    const boxFile = await prepareTask056RealBoxFixture();
    await expect(runtime.invoke('box.validate', { boxFile })).resolves.toEqual({
      validationResult: { valid: true, errors: [] },
    });

    const boxCover = await runtime.invoke<{
      view: { title: string; coverUrl: string; mimeType: string; ratio?: string };
    }>('box.renderCover', { boxFile });
    expect(boxCover.view).toMatchObject({
      title: '美食网格箱子',
      mimeType: 'text/html',
      ratio: '3:4',
    });
    expect(boxCover.view.coverUrl).toBeTruthy();

    const inspection = await runtime.invoke<{
      inspection: {
        metadata: { name: string; activeLayoutType: string };
        content: { layoutConfigs: Record<string, Record<string, unknown>> };
        entries: Array<{ entryId: string; url: string; enabled: boolean }>;
      };
    }>('box.inspect', { boxFile });
    expect(inspection.inspection.metadata).toMatchObject({
      name: '美食网格箱子',
      activeLayoutType: 'chips.layout.grid',
    });
    expect(inspection.inspection.entries).toHaveLength(15);
    expect(inspection.inspection.entries.every((entry) => (
      entry.enabled === true
      && entry.url.startsWith(pathToFileURL(`${finishedProductSpaceRoot}${path.sep}`).href)
    ))).toBe(true);

    const normalizedConfig = await runtime.invoke<{ config: Record<string, unknown> }>('box.normalizeLayoutConfig', {
      layoutType: 'chips.layout.grid',
      config: inspection.inspection.content.layoutConfigs['chips.layout.grid'] ?? {},
    });
    const initialQuery = await runtime.invoke<{ query?: Record<string, unknown> }>('box.getLayoutInitialQuery', {
      layoutType: 'chips.layout.grid',
      config: normalizedConfig.config,
    });
    const openedBox = await runtime.invoke<{
      sessionId: string;
      box: { name: string; activeLayoutType: string };
      initialView: { total: number; items: Array<{ entryId: string }> };
    }>('box.openView', {
      boxFile,
      layoutType: 'chips.layout.grid',
      initialQuery: initialQuery.query,
    });
    expect(openedBox.box).toMatchObject({
      name: '美食网格箱子',
      activeLayoutType: 'chips.layout.grid',
    });
    expect(openedBox.initialView.total).toBe(15);
    expect(openedBox.initialView.items).toHaveLength(15);

    const listed = await runtime.invoke<{
      page: { total: number; items: Array<{ entryId: string; snapshot?: { contentType?: string; title?: string } }> };
    }>('box.listEntries', {
      sessionId: openedBox.sessionId,
      query: { limit: 15 },
    });
    expect(listed.page.total).toBe(15);
    expect(listed.page.items).toHaveLength(15);
    expect(listed.page.items.every((entry) => entry.snapshot?.contentType === 'chips/card')).toBe(true);

    const firstEntryId = listed.page.items[0]?.entryId;
    expect(firstEntryId).toBeTypeOf('string');
    const detail = await runtime.invoke<{
      items: Array<{
        entryId: string;
        detail: {
          documentInfo?: { status?: { state?: string; valid?: boolean }; metadata?: { name?: string } };
          coverDescriptor?: { title?: string; mimeType?: string };
        };
      }>;
    }>('box.readEntryDetail', {
      sessionId: openedBox.sessionId,
      entryIds: [firstEntryId],
      fields: ['documentInfo', 'coverDescriptor', 'status'],
    });
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]?.detail.documentInfo?.status).toMatchObject({
      state: 'ready',
      valid: true,
    });
    expect(detail.items[0]?.detail.documentInfo?.metadata?.name).toBeTruthy();

    const entryCover = await runtime.invoke<{
      view: { title: string; coverUrl: string; mimeType: string; ratio?: string };
    }>('box.renderEntryCover', {
      sessionId: openedBox.sessionId,
      entryId: firstEntryId,
    });
    expect(entryCover.view).toMatchObject({
      title: detail.items[0]?.detail.documentInfo?.metadata?.name,
      mimeType: 'text/html',
      ratio: '3:4',
    });
    expect(entryCover.view.coverUrl).toBeTruthy();

    const entryDocument = await runtime.invoke<{
      view: {
        entryId: string;
        documentType: 'card';
        title: string;
        documentUrl: string;
        renderSessionId: string;
      };
    }>('box.renderEntryDocument', {
      sessionId: openedBox.sessionId,
      entryId: firstEntryId,
      options: {
        mode: 'view',
        interactionPolicy: 'native',
        locale: 'zh-CN',
      },
    });
    expect(entryDocument.view).toMatchObject({
      entryId: firstEntryId,
      documentType: 'card',
      title: detail.items[0]?.detail.documentInfo?.metadata?.name,
      renderSessionId: expect.any(String),
    });
    expectManagedDocumentUrl(entryDocument.view.documentUrl);
    await expect(runtime.invoke('box.releaseEntryDocument', {
      sessionId: openedBox.sessionId,
      renderSessionId: entryDocument.view.renderSessionId,
    })).resolves.toMatchObject({ ack: true });

    const renderedBox = await runtime.invoke<{
      view: { title: string; layoutType: string; pluginId: string; documentUrl: string; sessionId: string };
    }>('box.renderLayoutFrame', {
      layoutType: 'chips.layout.grid',
      sessionId: openedBox.sessionId,
      box: openedBox.box,
      initialView: openedBox.initialView,
      config: normalizedConfig.config,
    });
    expect(renderedBox.view).toMatchObject({
      title: '美食网格箱子',
      layoutType: 'chips.layout.grid',
      pluginId: 'chips.layout.grid',
    });
    expectManagedDocumentUrl(renderedBox.view.documentUrl);

    const boxEditor = await runtime.invoke<{
      view: { title: string; layoutType: string; pluginId: string; documentUrl: string; sessionId: string };
    }>('box.renderLayoutEditor', {
      layoutType: 'chips.layout.grid',
      entries: inspection.inspection.entries,
      initialConfig: normalizedConfig.config,
    });
    expect(boxEditor.view).toMatchObject({
      layoutType: 'chips.layout.grid',
      pluginId: 'chips.layout.grid',
    });

    const openedEntry = await runtime.invoke<{
      result: { mode: string; documentType?: string; pluginId?: string; windowId?: string };
    }>('box.openEntry', {
      sessionId: openedBox.sessionId,
      entryId: firstEntryId,
    });
    expect(openedEntry.result).toMatchObject({
      mode: 'document-window',
      documentType: 'card',
      pluginId: 'com.chips.card-viewer',
    });
    expect(openedEntry.result.windowId).toBeTruthy();

    const unpackedBoxDir = path.join(workspace, 'task056-real-box-unpacked');
    await expect(runtime.invoke('box.unpack', { boxFile, outputDir: unpackedBoxDir })).resolves.toMatchObject({
      outputDir: unpackedBoxDir,
    });
    const repackedBoxFile = path.join(workspace, 'task056-real-box-repacked.box');
    await expect(runtime.invoke('box.pack', { boxDir: unpackedBoxDir, outputPath: repackedBoxFile })).resolves.toMatchObject({
      boxFile: repackedBoxFile,
    });
    await expect(runtime.invoke('box.validate', { boxFile: repackedBoxFile })).resolves.toEqual({
      validationResult: { valid: true, errors: [] },
    });

    await expect(runtime.invoke('box.releaseRenderSession', { sessionId: renderedBox.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('box.releaseRenderSession', { sessionId: boxEditor.view.sessionId })).resolves.toMatchObject({ ack: true });
    await expect(runtime.invoke('box.closeView', { sessionId: openedBox.sessionId })).resolves.toMatchObject({ ack: true });
  }, 120_000);

  it('creates window records via window service', async () => {
    const opened = await runtime.invoke<{ window: { id: string; chrome?: { backgroundColor?: string } } }>('window.open', {
      config: {
        title: 'Demo',
        width: 800,
        height: 600,
        chrome: {
          backgroundColor: '#ffffff'
        }
      }
    });
    expect(opened.window.id).toBeTypeOf('string');
    expect(opened.window.chrome?.backgroundColor).toBe('#ffffff');

    const focused = await runtime.invoke('window.focus', { windowId: opened.window.id });
    expect(focused).toMatchObject({ ack: true });
  });

  it('fills themed window background color when caller does not provide one', async () => {
    const opened = await runtime.invoke<{ window: { chrome?: { backgroundColor?: string } } }>('window.open', {
      config: {
        title: 'Theme Window',
        width: 640,
        height: 480
      }
    });

    expect(opened.window.chrome?.backgroundColor).toBeTypeOf('string');
    expect(opened.window.chrome?.backgroundColor?.length).toBeGreaterThan(0);
  });

  it('writes and queries logs', async () => {
    await runtime.invoke('log.write', { level: 'info', message: 'integration-log' });
    const result = await runtime.invoke<{ entries: Array<{ message: string }> }>('log.query', {});
    expect(result.entries.some((entry) => entry.message === 'integration-log')).toBe(true);
  });

  it('persists logs across host restart', async () => {
    await runtime.invoke('log.write', {
      level: 'info',
      message: 'persistent-integration-log',
      metadata: {
        source: 'integration-test'
      }
    });

    await app.stop();
    app = new HostApplication({ workspacePath: workspace });
    await app.start();
    runtime = new RuntimeClient(app.createBridge(), {
      defaultTimeout: 5000,
      maxRetries: 1,
      retryDelay: 10,
      retryBackoff: 2,
      enableRetry: true
    });

    const result = await runtime.invoke<{ entries: Array<{ message: string; metadata?: Record<string, unknown> }> }>('log.query', {});
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'persistent-integration-log',
          metadata: expect.objectContaining({
            source: 'integration-test'
          })
        })
      ])
    );
  });

  it('persists encrypted credentials across host restart', async () => {
    await runtime.invoke('credential.set', { ref: 'chips.api.token', value: 'secret-token' });
    const stored = await fs.readFile(path.join(workspace, 'credentials.enc.json'), 'utf-8');
    expect(stored.includes('secret-token')).toBe(false);

    await app.stop();
    app = new HostApplication({ workspacePath: workspace });
    await app.start();
    runtime = new RuntimeClient(app.createBridge(), {
      defaultTimeout: 5000,
      maxRetries: 1,
      retryDelay: 10,
      retryBackoff: 2,
      enableRetry: true
    });

    const restored = await runtime.invoke<{ value: string | null }>('credential.get', { ref: 'chips.api.token' });
    expect(restored.value).toBe('secret-token');
  });

  it('returns control-plane health report', async () => {
    const report = await runtime.invoke<{ status: string; report: { routes: number; services: number } }>('control-plane.health', {});
    const checked = await runtime.invoke<{ services: Array<{ name: string }> }>('control-plane.check', {});
    expect(report.status).toBe('ok');
    expect(report.report.services).toBe(checked.services.length);
    expect(checked.services.map((service) => service.name)).toContain('cli-task');
    expect(report.report.routes).toBeGreaterThan(30);
  });

  it('supports plugin runtime handshake flow', async () => {
    const manifestPath = path.join(workspace, 'runtime.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        id: 'chips.runtime.plugin',
        version: '1.0.0',
        type: 'app',
        name: 'Runtime Plugin',
        permissions: ['file.read'],
        runtime: {
          targets: {
            desktop: { supported: true },
            web: { supported: false },
            mobile: { supported: false },
            headless: { supported: false }
          }
        },
        ui: {
          surface: {
            defaultKind: 'window',
            preferredKinds: {
              desktop: 'window',
              web: 'route',
              mobile: 'fullscreen',
              headless: 'window'
            }
          }
        }
      })
    );

    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
    const init = await runtime.invoke<{ session: { sessionId: string; sessionNonce: string } }>('plugin.init', {
      pluginId: installed.pluginId
    });
    const completed = await runtime.invoke<{ session: { status: string } }>('plugin.handshake.complete', {
      sessionId: init.session.sessionId,
      nonce: init.session.sessionNonce
    });
    expect(completed.session.status).toBe('running');
  });

  it('loads, resolves and invokes module plugins through the formal module service', async () => {
    try {
      const moduleProjectDir = path.join(workspace, 'markdown-module');
      await fs.mkdir(path.join(moduleProjectDir, 'dist'), { recursive: true });
      await fs.mkdir(path.join(moduleProjectDir, 'contracts'), { recursive: true });
      await fs.writeFile(
        path.join(moduleProjectDir, 'manifest.yaml'),
        [
          'id: chips.module.markdown-renderer',
          'version: "1.0.0"',
          'type: module',
          'name: Markdown Renderer Module',
          'description: Shared markdown rendering module',
          'permissions:',
          '  - file.read',
          'entry: dist/index.cjs',
          'module:',
          '  apiVersion: 1',
          '  runtime: worker',
          '  activation: onDemand',
          '  provides:',
          '    - capability: text.markdown.render',
          '      version: "1.0.0"',
          '      methods:',
          '        - name: render',
          '          mode: sync',
          '          inputSchema: contracts/render.input.schema.json',
          '          outputSchema: contracts/render.output.schema.json',
          '        - name: inspectFile',
          '          mode: sync',
          '          inputSchema: contracts/inspectFile.input.schema.json',
          '          outputSchema: contracts/inspectFile.output.schema.json',
          '        - name: proxyModuleCall',
          '          mode: sync',
          '          inputSchema: contracts/proxyModuleCall.input.schema.json',
          '          outputSchema: contracts/proxyModuleCall.output.schema.json',
          '        - name: renderAsync',
          '          mode: job',
          '          inputSchema: contracts/renderAsync.input.schema.json',
          '          outputSchema: contracts/renderAsync.output.schema.json',
          '  consumes: []'
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'dist/index.cjs'),
        [
          'const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
          '',
          'module.exports = {',
          '  async activate(ctx) {',
          "    ctx.logger.info('module activated', { capability: 'text.markdown.render' });",
          '  },',
          '  providers: [',
          '    {',
          "      capability: 'text.markdown.render',",
          '      methods: {',
          '        async render(_ctx, input) {',
          '          return {',
          "            html: `<article>${input.markdown}</article>`,",
          "            provider: 'chips.module.markdown-renderer'",
          '          };',
          '        },',
          '        async inspectFile(ctx, input) {',
          "          const result = await ctx.host.invoke('file.stat', { path: input.path });",
          '          return {',
          '            isFile: result.meta?.isFile === true,',
          '            isDirectory: result.meta?.isDirectory === true',
          '          };',
          '        },',
          '        async proxyModuleCall(ctx) {',
          "          return await ctx.host.invoke('module.listProviders', {});",
          '        },',
          '        async renderAsync(ctx, input) {',
          "          await ctx.job?.reportProgress({ stage: 'started', percent: 10 });",
          '          await sleep(typeof input.delayMs === "number" ? input.delayMs : 30);',
          "          await ctx.job?.reportProgress({ stage: 'completed', percent: 100 });",
          '          return {',
          '            ok: true,',
          "            html: `<article>${input.markdown}</article>`",
          '          };',
          '        }',
          '      }',
          '    }',
          '  ]',
          '};'
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/render.input.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['markdown'],
            properties: {
              markdown: { type: 'string' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/render.output.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['html', 'provider'],
            properties: {
              html: { type: 'string' },
              provider: { type: 'string' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/inspectFile.input.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['path'],
            properties: {
              path: { type: 'string' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/inspectFile.output.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['isFile', 'isDirectory'],
            properties: {
              isFile: { type: 'boolean' },
              isDirectory: { type: 'boolean' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/proxyModuleCall.input.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/proxyModuleCall.output.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            additionalProperties: true
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/renderAsync.input.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['markdown'],
            properties: {
              markdown: { type: 'string' },
              delayMs: { type: 'number' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );
      await fs.writeFile(
        path.join(moduleProjectDir, 'contracts/renderAsync.output.schema.json'),
        JSON.stringify(
          {
            type: 'object',
            required: ['ok', 'html'],
            properties: {
              ok: { type: 'boolean' },
              html: { type: 'string' }
            },
            additionalProperties: false
          },
          null,
          2
        ),
        'utf-8'
      );

      const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', {
        manifestPath: path.join(moduleProjectDir, 'manifest.yaml')
      });
      await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

      const listed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          capability: string;
          version: string;
          status: string;
          methods: Array<{ name: string; mode: string }>;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render'
      });
      expect(listed.providers).toContainEqual(
        expect.objectContaining({
          pluginId: 'chips.module.markdown-renderer',
          capability: 'text.markdown.render',
          version: '1.0.0',
          status: 'enabled',
          methods: expect.arrayContaining([
            expect.objectContaining({ name: 'render', mode: 'sync' }),
            expect.objectContaining({ name: 'renderAsync', mode: 'job' })
          ])
        })
      );

      const resolved = await runtime.invoke<{
        provider: {
          pluginId: string;
          capability: string;
          version: string;
        };
      }>('module.resolve', {
        capability: 'text.markdown.render',
        versionRange: '^1.0.0'
      });
      expect(resolved.provider).toMatchObject({
        pluginId: 'chips.module.markdown-renderer',
        capability: 'text.markdown.render',
        version: '1.0.0'
      });

      const syncResult = await runtime.invoke<{
        mode: 'sync';
        output: { html: string; provider: string };
      }>('module.invoke', {
        capability: 'text.markdown.render',
        method: 'render',
        input: {
          markdown: '# Hello Markdown'
        }
      });
      expect(syncResult.mode).toBe('sync');
      const runningListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render'
      });
      expect(runningListed.providers).toContainEqual(
        expect.objectContaining({
          pluginId: 'chips.module.markdown-renderer',
          status: 'running'
        })
      );
      expect(syncResult.output).toMatchObject({
        html: '<article># Hello Markdown</article>',
        provider: 'chips.module.markdown-renderer'
      });

      const inspected = await runtime.invoke<{
        mode: 'sync';
        output: {
          isFile: boolean;
          isDirectory: boolean;
        };
      }>('module.invoke', {
        capability: 'text.markdown.render',
        method: 'inspectFile',
        input: {
          path: path.join(moduleProjectDir, 'manifest.yaml')
        }
      });
      expect(inspected.mode).toBe('sync');
      expect(inspected.output).toMatchObject({
        isFile: true,
        isDirectory: false
      });

      await expect(
        runtime.invoke('module.invoke', {
          capability: 'text.markdown.render',
          method: 'proxyModuleCall',
          input: {}
        })
      ).rejects.toMatchObject({
        code: 'MODULE_HOST_ACTION_FORBIDDEN'
      });

      const started = await runtime.invoke<{ mode: 'job'; jobId: string }>('module.invoke', {
        capability: 'text.markdown.render',
        method: 'renderAsync',
        input: {
          markdown: '## Async Markdown',
          delayMs: 10
        }
      });
      expect(started.mode).toBe('job');
      expect(typeof started.jobId).toBe('string');

      let completedJob:
        | {
            job: {
              status: string;
              output?: { ok: boolean; html: string };
              progress?: { stage?: string; percent?: number };
            };
          }
        | undefined;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const snapshot = await runtime.invoke<{
          job: {
            status: string;
            output?: { ok: boolean; html: string };
            progress?: { stage?: string; percent?: number };
          };
        }>('module.job.get', { jobId: started.jobId });
        if (snapshot.job.status === 'completed') {
          completedJob = snapshot;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(completedJob?.job.status).toBe('completed');
      expect(completedJob?.job.output).toMatchObject({
        ok: true,
        html: '<article>## Async Markdown</article>'
      });
      expect(completedJob?.job.progress?.percent).toBe(100);

      await expect(
        runtime.invoke('module.invoke', {
          capability: 'text.markdown.render',
          method: 'renderAsync',
          input: {
            markdown: 'invalid',
            extra: true
          }
        })
      ).rejects.toMatchObject({
        code: 'MODULE_SCHEMA_INVALID'
      });

      await runtime.invoke('plugin.disable', { pluginId: installed.pluginId });
      const disabledListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render'
      });
      expect(disabledListed.providers).toContainEqual(
        expect.objectContaining({
          pluginId: 'chips.module.markdown-renderer',
          status: 'disabled'
        })
      );
      const disabledEnabledListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render',
        status: 'enabled'
      });
      expect(disabledEnabledListed.providers).toEqual([]);
      const disabledRunningListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render',
        status: 'running'
      });
      expect(disabledRunningListed.providers).toEqual([]);
      await expect(
        runtime.invoke('module.resolve', {
          capability: 'text.markdown.render',
          versionRange: '^1.0.0'
        })
      ).rejects.toMatchObject({
        code: 'MODULE_PROVIDER_NOT_FOUND'
      });

      await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
      const reenabledListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render'
      });
      expect(reenabledListed.providers).toContainEqual(
        expect.objectContaining({
          pluginId: 'chips.module.markdown-renderer',
          status: 'enabled'
        })
      );

      await runtime.invoke('plugin.uninstall', { pluginId: installed.pluginId });
      const uninstalledListed = await runtime.invoke<{
        providers: Array<{
          pluginId: string;
          status: string;
        }>;
      }>('module.listProviders', {
        capability: 'text.markdown.render'
      });
      expect(uninstalledListed.providers).toEqual([]);
      await expect(
        runtime.invoke('module.invoke', {
          capability: 'text.markdown.render',
          method: 'render',
          input: {
            markdown: '# Removed'
          }
        })
      ).rejects.toMatchObject({
        code: 'MODULE_PROVIDER_NOT_FOUND'
      });
    } catch (error) {
      throw error;
    }
  });

  it('builds CLI command index from enabled app and module plugin manifests', async () => {
    const appPluginDir = path.join(workspace, 'cli-index-app');
    await writeText(path.join(appPluginDir, 'dist/index.html'), '<!doctype html>');
    await writeText(
      path.join(appPluginDir, 'manifest.yaml'),
      [
        'id: chips.cli.index.app',
        'name: CLI Index App',
        'version: "1.0.0"',
        'type: app',
        'entry: dist/index.html',
        'permissions:',
        '  - file.read',
        '  - command.invoke',
        ...appRuntimeYamlLines,
        'ui:',
        ...appSurfaceYamlLines,
        'cli:',
        '  commands:',
        '    - commandPath: demo open',
        '      target:',
        '        type: app',
        '        pluginId: chips.cli.index.app',
        '        commandId: chips.cli.index.app.open',
        '        surface:',
        '          open: true',
        '          focus: true',
        '      titleKey: cli.demo.open.title',
        '      permissions:',
        '        - file.read',
        '      arguments:',
        '        - name: path',
        '          position: 0',
        '          type: path',
        '          required: true',
        '          mapsTo: path'
      ].join('\n')
    );

    const modulePluginDir = path.join(workspace, 'cli-index-module');
    await writeText(path.join(modulePluginDir, 'dist/index.cjs'), 'exports.providers = [];');
    await writeText(path.join(modulePluginDir, 'contracts/run.input.schema.json'), '{"type":"object"}');
    await writeText(path.join(modulePluginDir, 'contracts/run.output.schema.json'), '{"type":"object"}');
    await writeText(
      path.join(modulePluginDir, 'manifest.yaml'),
      [
        'id: chips.cli.index.module',
        'name: CLI Index Module',
        'version: "1.0.0"',
        'type: module',
        'entry: dist/index.cjs',
        'permissions:',
        '  - file.read',
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
        'module:',
        '  apiVersion: 1',
        '  runtime: worker',
        '  activation: onDemand',
        '  provides:',
        '    - capability: cli.index.run',
        '      version: "1.0.0"',
        '      methods:',
        '        - name: run',
        '          mode: sync',
        '          inputSchema: contracts/run.input.schema.json',
        '          outputSchema: contracts/run.output.schema.json',
        '  consumes: []',
        'cli:',
        '  commands:',
        '    - commandPath: demo open',
        '      target:',
        '        type: module',
        '        capability: cli.index.run',
        '        method: run',
        '      titleKey: cli.demo.module.open.title',
        '      permissions:',
        '        - file.read'
      ].join('\n')
    );

    const appInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.join(appPluginDir, 'manifest.yaml')
    });

    const disabledIndex = await runtime.invoke<{
      commands: Array<{ commandId: string; enabled: boolean }>;
    }>('cli.command.list', {
      includeDisabled: true
    });
    expect(disabledIndex.commands).toContainEqual(
      expect.objectContaining({
        commandId: 'chips.cli.index.app.cli.demo.open',
        enabled: false
      })
    );
    await expect(
      runtime.invoke<{ commands: unknown[] }>('cli.command.list', {
        commandPath: 'demo open'
      })
    ).resolves.toMatchObject({
      commands: []
    });

    await runtime.invoke('plugin.enable', { pluginId: appInstall.pluginId });
    const enabledIndex = await runtime.invoke<{
      commands: Array<{
        commandId: string;
        commandPath: string[];
        enabled: boolean;
        owner: { pluginId: string; pluginType: string };
        declaration: { target: { type: string; pluginId?: string } };
      }>;
    }>('cli.command.list', {
      commandPath: ['demo', 'open']
    });
    expect(enabledIndex.commands).toEqual([
      expect.objectContaining({
        commandId: 'chips.cli.index.app.cli.demo.open',
        commandPath: ['demo', 'open'],
        enabled: true,
        owner: expect.objectContaining({
          pluginId: 'chips.cli.index.app',
          pluginType: 'app'
        }),
        declaration: expect.objectContaining({
          target: expect.objectContaining({
            type: 'app',
            pluginId: 'chips.cli.index.app'
          })
        })
      })
    ]);

    const moduleInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.join(modulePluginDir, 'manifest.yaml')
    });
    await runtime.invoke('plugin.enable', { pluginId: moduleInstall.pluginId });

    const conflictResult = await runtime.invoke<{
      command?: unknown;
      conflicts: Array<{
        commandPathKey: string;
        enabledCommandIds: string[];
      }>;
    }>('cli.command.resolve', {
      commandPath: 'demo open'
    });
    expect(conflictResult.command).toBeUndefined();
    expect(conflictResult.conflicts).toEqual([
      expect.objectContaining({
        commandPathKey: 'demo open',
        enabledCommandIds: ['chips.cli.index.app.cli.demo.open', 'chips.cli.index.module.cli.demo.open']
      })
    ]);

    await expect(
      runtime.invoke('cli.command.get', {
        commandPath: 'demo open'
      })
    ).rejects.toMatchObject({
      code: 'CLI_COMMAND_CONFLICT'
    });

    const resolvedModule = await runtime.invoke<{
      command?: {
        commandId: string;
        declaration: {
          target: {
            type: string;
            capability: string;
            method: string;
          };
        };
      };
      conflicts: unknown[];
    }>('cli.command.resolve', {
      commandPath: 'demo open',
      pluginId: 'chips.cli.index.module'
    });
    expect(resolvedModule.command).toMatchObject({
      commandId: 'chips.cli.index.module.cli.demo.open',
      declaration: {
        target: {
          type: 'module',
          capability: 'cli.index.run',
          method: 'run'
        }
      }
    });

    await runtime.invoke('plugin.disable', { pluginId: appInstall.pluginId });
    const afterDisable = await runtime.invoke<{
      command?: { commandId: string };
      conflicts: unknown[];
    }>('cli.command.resolve', {
      commandPath: 'demo open'
    });
    expect(afterDisable.command).toMatchObject({
      commandId: 'chips.cli.index.module.cli.demo.open'
    });
    expect(afterDisable.conflicts).toEqual([]);
  });

  it('orders module providers by semantic version', async () => {
    const lowerManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.versioned.lower',
      capability: 'test.versioned.echo',
      version: '1.9.0',
      methods: [{ name: 'run' }],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.versioned.echo',",
        '    methods: {',
        '      async run() { return { version: "1.9.0" }; }',
        '    }',
        '  }]',
        '};'
      ]
    });
    const higherManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.versioned.higher',
      capability: 'test.versioned.echo',
      version: '1.10.0',
      methods: [{ name: 'run' }],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.versioned.echo',",
        '    methods: {',
        '      async run() { return { version: "1.10.0" }; }',
        '    }',
        '  }]',
        '};'
      ]
    });
    const prereleaseManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.versioned.prerelease',
      capability: 'test.versioned.echo',
      version: '1.10.0-beta.1',
      methods: [{ name: 'run' }],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.versioned.echo',",
        '    methods: {',
        '      async run() { return { version: "1.10.0-beta.1" }; }',
        '    }',
        '  }]',
        '};'
      ]
    });

    await installAndEnablePlugin(lowerManifest);
    await installAndEnablePlugin(higherManifest);
    await installAndEnablePlugin(prereleaseManifest);

    const resolved = await runtime.invoke<{
      provider: { pluginId: string; version: string };
    }>('module.resolve', {
      capability: 'test.versioned.echo'
    });
    expect(resolved.provider).toMatchObject({
      pluginId: 'chips.module.versioned.higher',
      version: '1.10.0'
    });
  });

  it('enforces timeout, cancellation and consumes contracts for module invocations', async () => {
    const workerManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.contract.worker',
      capability: 'test.contract.worker',
      version: '1.0.0',
      methods: [
        { name: 'slowSync' },
        { name: 'slowJob', mode: 'job' },
        { name: 'echo' }
      ],
      entryLines: [
        'const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.contract.worker',",
        '    methods: {',
        '      async echo(_ctx, input) { return { ok: true, value: input.value ?? null }; },',
        '      async slowSync(_ctx, input) {',
        '        await sleep(typeof input.delayMs === "number" ? input.delayMs : 50);',
        '        return { ok: true };',
        '      },',
        '      async slowJob(ctx, input) {',
        '        await ctx.job?.reportProgress({ stage: "started", percent: 1 });',
        '        const delayMs = typeof input.delayMs === "number" ? input.delayMs : 80;',
        '        const stepMs = 5;',
        '        for (let elapsed = 0; elapsed < delayMs; elapsed += stepMs) {',
        '          if (ctx.job?.isCancelled()) { throw { code: "MODULE_JOB_CANCELLED", message: "cancelled by test" }; }',
        '          await sleep(stepMs);',
        '        }',
        '        return { ok: true };',
        '      }',
        '    }',
        '  }]',
        '};'
      ]
    });
    await installAndEnablePlugin(workerManifest);

    await expect(
      runtime.invokeWithTimeout(
        'module.invoke',
        {
          capability: 'test.contract.worker',
          method: 'slowSync',
          input: {
            delayMs: 60
          },
          timeoutMs: 5
        },
        5000
      )
    ).rejects.toMatchObject({
      code: 'MODULE_TIMEOUT'
    });

    const timedJobStarted = await runtime.invokeWithTimeout<{ mode: 'job'; jobId: string }>(
      'module.invoke',
      {
        capability: 'test.contract.worker',
        method: 'slowJob',
        input: {
          delayMs: 80
        },
        timeoutMs: 5
      },
      5000
    );
    let timedJob:
      | {
          status: string;
          error?: { code: string };
        }
      | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const snapshot = await runtime.invoke<{
        job: {
          status: string;
          error?: { code: string };
        };
      }>('module.job.get', { jobId: timedJobStarted.jobId });
      if (snapshot.job.status === 'failed') {
        timedJob = snapshot.job;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(timedJob?.status).toBe('failed');
    expect(timedJob?.error?.code).toBe('MODULE_TIMEOUT');

    const cancellableJob = await runtime.invoke<{ mode: 'job'; jobId: string }>('module.invoke', {
      capability: 'test.contract.worker',
      method: 'slowJob',
      input: {
        delayMs: 100
      }
    });
    const cancelledEvent = new Promise<unknown>((resolve) => {
      app.kernel.events.once('module.job.cancelled', (event) => resolve(event.data), {
        filter: (event: EventPayload) => {
          const data = event.data as { jobId?: string };
          return data.jobId === cancellableJob.jobId;
        }
      });
    });
    await runtime.invoke('module.job.cancel', { jobId: cancellableJob.jobId });
    const cancelledSnapshot = await runtime.invoke<{
      job: {
        status: string;
        error?: { code: string };
      };
    }>('module.job.get', { jobId: cancellableJob.jobId });
    expect(cancelledSnapshot.job.status).toBe('cancelled');
    expect(cancelledSnapshot.job.error?.code).toBe('MODULE_JOB_CANCELLED');
    const cancelledPayload = await Promise.race([
      cancelledEvent,
      new Promise((_, reject) => setTimeout(() => reject(new Error('module.job.cancelled event timeout')), 200))
    ]);
    expect(cancelledPayload).toMatchObject({
      jobId: cancellableJob.jobId,
      status: 'cancelled',
      error: expect.objectContaining({ code: 'MODULE_JOB_CANCELLED' })
    });

    const undeclaredCallerManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.contract.undeclared-caller',
      capability: 'test.contract.undeclaredCaller',
      version: '1.0.0',
      methods: [{ name: 'callWorker' }],
      consumes: [],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.contract.undeclaredCaller',",
        '    methods: {',
        '      async callWorker(ctx) {',
        "        return await ctx.module.invoke({ capability: 'test.contract.worker', method: 'echo', input: { value: 'blocked' } });",
        '      }',
        '    }',
        '  }]',
        '};'
      ]
    });
    await installAndEnablePlugin(undeclaredCallerManifest);
    await expect(
      runtime.invoke('module.invoke', {
        capability: 'test.contract.undeclaredCaller',
        method: 'callWorker',
        input: {}
      })
    ).rejects.toMatchObject({
      code: 'MODULE_CONSUME_UNDECLARED'
    });

    const declaredCallerManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.contract.declared-caller',
      capability: 'test.contract.declaredCaller',
      version: '1.0.0',
      methods: [{ name: 'callWorker' }],
      consumes: [
        {
          capability: 'test.contract.worker',
          versionRange: '^1.0.0'
        }
      ],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.contract.declaredCaller',",
        '    methods: {',
        '      async callWorker(ctx) {',
        "        const result = await ctx.module.invoke({ capability: 'test.contract.worker', method: 'echo', input: { value: 'allowed' } });",
        '        return result.mode === "sync" ? result.output : result;',
        '      }',
        '    }',
        '  }]',
        '};'
      ]
    });
    await installAndEnablePlugin(declaredCallerManifest);
    const declaredResult = await runtime.invoke<{
      mode: 'sync';
      output: { ok: boolean; value: string };
    }>('module.invoke', {
      capability: 'test.contract.declaredCaller',
      method: 'callWorker',
      input: {}
    });
    expect(declaredResult.output).toMatchObject({
      ok: true,
      value: 'allowed'
    });

    const mismatchedCallerManifest = await createModulePluginFixture(workspace, {
      pluginId: 'chips.module.contract.mismatched-caller',
      capability: 'test.contract.mismatchedCaller',
      version: '1.0.0',
      methods: [{ name: 'callWorker' }],
      consumes: [
        {
          capability: 'test.contract.worker',
          versionRange: '^2.0.0'
        }
      ],
      entryLines: [
        'module.exports = {',
        '  providers: [{',
        "    capability: 'test.contract.mismatchedCaller',",
        '    methods: {',
        '      async callWorker(ctx) {',
        "        return await ctx.module.invoke({ capability: 'test.contract.worker', method: 'echo', input: { value: 'blocked' } });",
        '      }',
        '    }',
        '  }]',
        '};'
      ]
    });
    await installAndEnablePlugin(mismatchedCallerManifest);
    await expect(
      runtime.invoke('module.invoke', {
        capability: 'test.contract.mismatchedCaller',
        method: 'callWorker',
        input: {}
      })
    ).rejects.toMatchObject({
      code: 'MODULE_PROVIDER_NOT_FOUND'
    });
  });

  it('installs plugin from .cpk package', async () => {
    const packageDir = path.join(workspace, 'demo-cpk-plugin');
    await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(packageDir, 'manifest.yaml'),
      [
        'id: chips.runtime.cpk',
        'version: "1.0.0"',
        'type: app',
        'name: Runtime CPK Plugin',
        'permissions:',
        '  - file.read',
        'entry: dist/main.js',
        ...appRuntimeYamlLines,
        'ui:',
        ...appSurfaceYamlLines
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(packageDir, 'dist/main.js'), 'module.exports = {};', 'utf-8');

    const cpkPath = path.join(workspace, 'chips.runtime.cpk.cpk');
    const zip = new StoreZipService();
    await zip.compress(packageDir, cpkPath);

    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    expect(installed.pluginId).toBe('chips.runtime.cpk');

    const queried = await runtime.invoke<{
      plugins: Array<{ id: string; manifestPath: string; name: string; version: string; enabled: boolean }>;
    }>('plugin.query', {});
    expect(queried.plugins).toContainEqual(
      expect.objectContaining({
        id: 'chips.runtime.cpk',
        name: 'Runtime CPK Plugin',
        version: '1.0.0',
        enabled: false
      })
    );
  });

  it('exposes plugin governance metadata through list/get/query', async () => {
    const fixtureManifest = await createThemePluginFixture(
      workspace,
      'chips.fixture.theme-dark',
      'chips-fixture.default-dark-theme',
      '测试暗夜主题'
    );
    const darkInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: fixtureManifest
    });

    const listed = await runtime.invoke<{
      plugins: Array<{
        id: string;
        name: string;
        version: string;
        type: string;
        theme?: {
          themeId: string;
          displayName: string;
          isDefault: boolean;
        };
      }>;
    }>('plugin.list', { type: 'theme' });
    expect(listed.plugins).toContainEqual(
      expect.objectContaining({
        id: darkInstall.pluginId,
        name: '测试暗夜主题',
        version: '1.0.0',
        type: 'theme',
        theme: expect.objectContaining({
          themeId: 'chips-fixture.default-dark-theme',
          displayName: '测试暗夜主题',
          isDefault: false
        })
      })
    );

    const queried = await runtime.invoke<{
      plugins: Array<{
        id: string;
        enabled: boolean;
        theme?: {
          themeId: string;
          displayName: string;
        };
      }>;
    }>('plugin.query', { type: 'theme' });
    expect(queried.plugins).toContainEqual(
      expect.objectContaining({
        id: darkInstall.pluginId,
        enabled: false,
        theme: expect.objectContaining({
          themeId: 'chips-fixture.default-dark-theme',
          displayName: '测试暗夜主题'
        })
      })
    );

    const fetched = await runtime.invoke<{
      plugin: {
        id: string;
        name: string;
        theme?: {
          themeId: string;
        };
      };
    }>('plugin.get', { pluginId: darkInstall.pluginId });
    expect(fetched.plugin).toMatchObject({
      id: darkInstall.pluginId,
      name: '测试暗夜主题',
      theme: {
        themeId: 'chips-fixture.default-dark-theme'
      }
    });
  });

  it('uses plugin handler when opening associated card file', async () => {
    const pluginDir = path.join(workspace, 'card-handler-plugin');
    await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.yaml'),
      [
        'id: chips.card.handler',
        'version: "1.0.0"',
        'type: app',
        'name: Card Handler',
        'permissions:',
        '  - file.read',
        ...appRuntimeYamlLines,
        'ui:',
        '  window:',
        '    chrome:',
        '      backgroundColor: "#ffffff"',
        '      titleBarStyle: hidden',
        '      titleBarOverlay:',
        '        color: "#ffffff00"',
        '        symbolColor: "#667085"',
        '        height: 44',
        ...appSurfaceYamlLines,
        'capabilities:',
        '  - file-handler:.card',
        'entry: dist/index.html'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(pluginDir, 'dist/index.html'), '<html><body>card handler</body></html>', 'utf-8');

    const zip = new StoreZipService();
    const cpkPath = path.join(workspace, 'chips.card.handler.cpk');
    await zip.compress(pluginDir, cpkPath);
    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const cardSourceDir = path.join(workspace, 'card-open-source');
    await fs.mkdir(path.join(cardSourceDir, '.card'), { recursive: true });
    await fs.writeFile(path.join(cardSourceDir, '.card/metadata.yaml'), 'id: test.card\nname: Test Card\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/structure.yaml'), 'cards: []\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    const cardFile = path.join(workspace, 'associated.card');
    await zip.compress(cardSourceDir, cardFile);

    const result = await openAssociatedFile(runtime, cardFile);
    expect(result.mode).toBe('card');
    expect(result.pluginId).toBe('chips.card.handler');
    expect(result.windowId).toBeTypeOf('string');

    const queried = await runtime.invoke<{
      plugins: Array<{
        id: string;
        ui?: {
          window?: {
            chrome?: {
              titleBarStyle?: string;
              backgroundColor?: string;
            };
          };
        };
      }>;
    }>('plugin.query', { type: 'app' });
    const handler = queried.plugins.find((plugin) => plugin.id === 'chips.card.handler');
    expect(handler?.ui?.window?.chrome?.backgroundColor).toBe('#ffffff');
    expect(handler?.ui?.window?.chrome?.titleBarStyle).toBe('hidden');
  });

  it('routes associated image files to enabled app plugins through generic file-handler capabilities', async () => {
    const pluginDir = path.join(workspace, 'image-handler-plugin');
    await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.yaml'),
      [
        'id: chips.image.handler',
        'version: "1.0.0"',
        'type: app',
        'name: Image Handler',
        'permissions:',
        '  - file.read',
        'entry: dist/index.html',
        ...appRuntimeYamlLines,
        'ui:',
        ...appSurfaceYamlLines,
        'capabilities:',
        '  - file-handler:.png'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(pluginDir, 'dist/index.html'), '<html><body>image handler</body></html>', 'utf-8');

    const zip = new StoreZipService();
    const cpkPath = path.join(workspace, 'chips.image.handler.cpk');
    await zip.compress(pluginDir, cpkPath);
    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const imageFile = path.join(workspace, 'associated image.png');
    await fs.writeFile(imageFile, 'png', 'utf-8');

    const result = await openAssociatedFile(runtime, imageFile);
    expect(result.mode).toBe('plugin');
    expect(result.extension).toBe('.png');
    expect(result.pluginId).toBe('chips.image.handler');
    expect(result.windowId).toBeTypeOf('string');
  });

  it('routes local resources to enabled app plugins through resource-handler capabilities', async () => {
    const pluginDir = path.join(workspace, 'resource-handler-plugin');
    await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.yaml'),
      [
        'id: chips.resource.image.viewer',
        'version: "1.0.0"',
        'type: app',
        'name: Resource Image Viewer',
        'permissions:',
        '  - resource.read',
        'entry: dist/index.html',
        ...appRuntimeYamlLines,
        'ui:',
        ...appSurfaceYamlLines,
        'capabilities:',
        '  - resource-handler:view:image/*'
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(path.join(pluginDir, 'dist/index.html'), '<html><body>resource handler</body></html>', 'utf-8');

    const zip = new StoreZipService();
    const cpkPath = path.join(workspace, 'chips.resource.image.viewer.cpk');
    await zip.compress(pluginDir, cpkPath);
    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const imageFile = path.join(workspace, 'nested', 'resource image.png');
    await fs.mkdir(path.dirname(imageFile), { recursive: true });
    await fs.writeFile(imageFile, 'png', 'utf-8');

    const result = await runtime.invoke<{
      result: {
        mode: string;
        pluginId?: string;
        windowId?: string;
        matchedCapability?: string;
        resolved: {
          filePath?: string;
          mimeType?: string;
        };
      };
    }>('resource.open', {
      resource: {
        resourceId: imageFile,
      },
    });

    expect(result.result.mode).toBe('plugin');
    expect(result.result.pluginId).toBe('chips.resource.image.viewer');
    expect(result.result.windowId).toBeTypeOf('string');
    expect(result.result.matchedCapability).toBe('resource-handler:view:image/*');
    expect(result.result.resolved.filePath).toBe(imageFile);
    expect(result.result.resolved.mimeType).toBe('image/png');
  });
});
