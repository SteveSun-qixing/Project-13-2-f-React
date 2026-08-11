import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { CardService } from '../../packages/card-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import { PluginRuntime } from '../../src/runtime';
import { mergeThemeLayers, resolveThemeFromLayers } from '../../src/main/theme-runtime/resolve-algorithm';
import { toRenderThemeSnapshot } from '../../src/main/theme-runtime/render-bridge';

type JsdomWindowLike = typeof globalThis & {
  parent?: unknown;
  dispatchEvent?: (event: unknown) => boolean;
  document?: {
    querySelector?: (selector: string) => {
      style?: {
        height?: string;
      };
    } | null;
  };
};
type JSDOMInstance = {
  window: JsdomWindowLike & { close: () => void };
};
type JSDOMConstructor = new (
  html?: string,
  options?: {
    runScripts?: 'dangerously' | 'outside-only';
    url?: string;
    resources?: 'usable';
    beforeParse?: (window: JsdomWindowLike) => void;
  },
) => JSDOMInstance;
type DomRectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
  toJSON: () => Record<string, never>;
};
type FrameElementLike = {
  contentWindow?: unknown;
  getBoundingClientRect: () => DomRectLike;
  dispatchEvent?: (event: unknown) => boolean;
};

const { JSDOM }: { JSDOM: JSDOMConstructor } = require('jsdom');

const zip = new StoreZipService();
const tempDirs: string[] = [];
const CARD_RENDER_TEST_TIMEOUT_MS = 60_000;

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const writeText = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
};

type BaseCardPluginFixtureKind = 'richtext' | 'image';

const createBaseCardPluginFixture = async (
  rootDir: string,
  kind: BaseCardPluginFixtureKind,
): Promise<string> => {
  const pluginDir = path.join(rootDir, `fixture-${kind}-basecard-plugin`);
  const pluginId = kind === 'richtext' ? 'chips.basecard.richtext' : 'chips.basecard.image';
  const cardTypes = kind === 'richtext' ? ['base.richtext', 'RichTextCard'] : ['base.image', 'ImageCard'];
  const displayName = kind === 'richtext' ? 'Rich Text Base Card' : 'Image Base Card';

  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      `id: ${pluginId}`,
      `name: ${displayName}`,
      'version: "1.0.0"',
      'type: card',
      'entry: dist/index.mjs',
      `description: Host unit fixture for ${displayName}`,
      'capabilities:',
      '  cardTypes:',
      ...cardTypes.map((cardType) => `    - ${cardType}`),
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
    kind === 'richtext' ? createRichTextPluginEntry(pluginId, cardTypes, displayName) : createImagePluginEntry(pluginId, cardTypes, displayName),
  );

  return path.join(pluginDir, 'manifest.yaml');
};

const installBaseCardPluginFixture = async (
  runtime: PluginRuntime,
  rootDir: string,
  kind: BaseCardPluginFixtureKind,
): Promise<void> => {
  const manifestPath = await createBaseCardPluginFixture(rootDir, kind);
  const install = await runtime.install(manifestPath);
  await runtime.enable(install.manifest.id);
};

const createRichTextPluginEntry = (pluginId: string, cardTypes: string[], displayName: string): string => [
  'const toText = (value) => (value === null || value === undefined ? "" : String(value));',
  'const htmlEntities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", [String.fromCharCode(34)]: "&quot;", [String.fromCharCode(39)]: "&#39;" };',
  'const escapeHtml = (value) => toText(value).replace(/[&<>"\']/g, (char) => htmlEntities[char]);',
  'const richTextDefaults = { card_type: "RichTextCard", content_format: "markdown", content_source: "inline", content_text: "" };',
  'export function renderBasecardView(ctx = {}) {',
  '  const documentRef = ctx.container?.ownerDocument ?? globalThis.document;',
  '  const text = toText(ctx.config?.content_text ?? ctx.config?.contentText);',
  '  const article = documentRef.createElement("article");',
  '  article.dataset.scope = "richtext-card";',
  `  article.dataset.pluginId = ${JSON.stringify(pluginId)};`,
  '  article.innerHTML = `<div class="chips-richtext-view">${escapeHtml(text).replace(/^#\\s*/, "")}</div>`;',
  '  ctx.container?.replaceChildren(article);',
  '  return () => article.remove();',
  '}',
  'export function renderBasecardEditor(ctx = {}) {',
  '  const documentRef = ctx.container?.ownerDocument ?? globalThis.document;',
  '  const toolbar = documentRef.createElement("div");',
  '  toolbar.className = "chips-basecard-editor__floating-toolbar";',
  '  toolbar.textContent = "Rich text tools";',
  '  const editor = documentRef.createElement("textarea");',
  '  editor.className = "chips-basecard-editor__surface";',
  '  editor.value = toText(ctx.initialConfig?.content_text ?? ctx.initialConfig?.contentText);',
  '  editor.addEventListener("input", () => ctx.onChange?.({ ...richTextDefaults, ...(ctx.initialConfig ?? {}), content_text: editor.value }));',
  '  ctx.container?.replaceChildren(toolbar, editor);',
  '  return () => ctx.container?.replaceChildren();',
  '}',
  'export const basecardDefinition = {',
  `  pluginId: ${JSON.stringify(pluginId)},`,
  `  cardType: ${JSON.stringify(cardTypes[0])},`,
  `  cardTypes: ${JSON.stringify(cardTypes)},`,
  `  displayName: ${JSON.stringify(displayName)},`,
  '  icon: { name: "article", decorative: true },',
  '  createDefaultConfig() { return { ...richTextDefaults }; },',
  '  normalizeConfig(input = {}) { return { ...richTextDefaults, ...input }; },',
  '  validateConfig() { return { valid: true, errors: {} }; },',
  '  collectResourcePaths() { return []; },',
  '  renderView: renderBasecardView,',
  '  renderEditor: renderBasecardEditor,',
  '};',
  '',
].join('\n');

const createImagePluginEntry = (pluginId: string, cardTypes: string[], displayName: string): string => [
  'const asImages = (config) => Array.isArray(config?.images) ? config.images : [];',
  'export function renderBasecardView(ctx = {}) {',
  '  globalThis.__chipsLastBasecardContext = ctx;',
  '  const documentRef = ctx.container?.ownerDocument ?? globalThis.document;',
  '  const root = documentRef.createElement("section");',
  '  root.dataset.scope = "image-card";',
  `  root.dataset.pluginId = ${JSON.stringify(pluginId)};`,
  '  for (const image of asImages(ctx.config)) {',
  '    const img = documentRef.createElement("img");',
  '    const source = String(image?.file_path ?? image?.src ?? "");',
  '    img.alt = String(image?.alt ?? image?.title ?? "");',
  '    img.dataset.resourcePath = source;',
  '    if (ctx.resolveResourceUrl && source) {',
  '      Promise.resolve(ctx.resolveResourceUrl(source)).then((url) => { img.src = url; }).catch(() => { img.src = source; });',
  '    } else {',
  '      img.src = source;',
  '    }',
  '    root.appendChild(img);',
  '  }',
  '  ctx.container?.replaceChildren(root);',
  '  return () => root.remove();',
  '}',
  'export function renderBasecardEditor(ctx = {}) {',
  '  const documentRef = ctx.container?.ownerDocument ?? globalThis.document;',
  '  const panel = documentRef.createElement("section");',
  '  panel.className = "chips-image-card-editor";',
  '  panel.textContent = "Image card editor";',
  '  ctx.container?.replaceChildren(panel);',
  '  return () => ctx.container?.replaceChildren();',
  '}',
  'export const basecardDefinition = {',
  `  pluginId: ${JSON.stringify(pluginId)},`,
  `  cardType: ${JSON.stringify(cardTypes[0])},`,
  `  cardTypes: ${JSON.stringify(cardTypes)},`,
  `  displayName: ${JSON.stringify(displayName)},`,
  '  icon: { name: "image", decorative: true },',
  '  createDefaultConfig() { return { card_type: "ImageCard", images: [] }; },',
  '  normalizeConfig(input = {}) { return { card_type: "ImageCard", images: asImages(input), ...input }; },',
  '  validateConfig() { return { valid: true, errors: {} }; },',
  '  collectResourcePaths(config = {}) { return asImages(config).map((image) => image?.file_path).filter((value) => typeof value === "string" && value.length > 0); },',
  '  renderView: renderBasecardView,',
  '  renderEditor: renderBasecardEditor,',
  '};',
  '',
].join('\n');

const installBlobUrlSupport = (window: JsdomWindowLike): void => {
  const url = window.URL as typeof URL & {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  let counter = 0;
  url.createObjectURL = (_blob: Blob) => `blob:https://chips.test/${++counter}`;
  url.revokeObjectURL = (_url: string) => undefined;
};

const createCardDirectory = async (): Promise<string> => {
  const sourceDir = await createTempDir('chips-card-source-');
  await fs.mkdir(path.join(sourceDir, '.card'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'content'), { recursive: true });

  await fs.writeFile(
    path.join(sourceDir, '.card/metadata.yaml'),
    ['card_id: test-card-id', 'name: Test Card', 'theme: chips-official.default-theme'].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(sourceDir, '.card/structure.yaml'),
    ['structure:', '  - id: "intro"', '    type: "RichTextCard"', '  - id: "details"', '    type: "RichTextCard"'].join(
      '\n'
    ),
    'utf-8'
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/intro.yaml'),
    ['card_type: "RichTextCard"', 'content_format: "markdown"', 'content_source: "inline"', 'content_text: |', '  # Intro', '', '  Hello Chips.'].join(
      '\n'
    ),
    'utf-8'
  );
  await fs.writeFile(
    path.join(sourceDir, 'content/details.yaml'),
    ['card_type: "RichTextCard"', 'content_format: "markdown"', 'content_source: "inline"', 'content_text: |', '  # Details', '', '  Second node body.'].join(
      '\n'
    ),
    'utf-8'
  );

  return sourceDir;
};

const createCardArchive = async (): Promise<string> => {
  const sourceDir = await createCardDirectory();
  const outputDir = await createTempDir('chips-card-output-');
  const cardFile = path.join(outputDir, 'demo.card');
  await zip.compress(sourceDir, cardFile);
  return cardFile;
};

const createPartiallyBrokenCardDirectory = async (): Promise<string> => {
  const sourceDir = await createTempDir('chips-card-source-broken-');
  await fs.mkdir(path.join(sourceDir, '.card'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'content'), { recursive: true });

  await fs.writeFile(
    path.join(sourceDir, '.card/metadata.yaml'),
    ['card_id: broken-card-id', 'name: Broken Card', 'theme: chips-official.default-theme'].join('\n'),
    'utf-8',
  );
  await fs.writeFile(
    path.join(sourceDir, '.card/structure.yaml'),
    ['structure:', '  - id: "intro"', '    type: "RichTextCard"', '  - id: "missing"', '    type: "RichTextCard"'].join('\n'),
    'utf-8',
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/intro.yaml'),
    ['card_type: "RichTextCard"', 'content_format: "markdown"', 'content_source: "inline"', 'content_text: |', '  # Intro', '', '  Hello Chips.'].join('\n'),
    'utf-8',
  );

  return sourceDir;
};

const createImageCardDirectory = async (): Promise<string> => {
  const sourceDir = await createTempDir('chips-card-source-image-');
  await fs.mkdir(path.join(sourceDir, '.card'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'content'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'assets'), { recursive: true });

  await fs.writeFile(
    path.join(sourceDir, '.card/metadata.yaml'),
    ['card_id: image-card-id', 'name: Image Card', 'theme: chips-official.default-theme'].join('\n'),
    'utf-8',
  );
  await fs.writeFile(
    path.join(sourceDir, '.card/structure.yaml'),
    ['structure:', '  - id: "gallery"', '    type: "ImageCard"'].join('\n'),
    'utf-8',
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/gallery.yaml'),
    yaml.stringify({
      card_type: 'ImageCard',
      layout_type: 'single',
      layout_options: {
        grid_mode: '2x2',
        single_width_percent: 100,
        single_alignment: 'center',
        spacing_mode: 'comfortable',
      },
      images: [
        {
          id: 'image-1',
          source: 'file',
          file_path: 'assets/hero.png',
          title: 'Hero',
          alt: 'Hero',
        },
      ],
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(sourceDir, 'assets/hero.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZxXcAAAAASUVORK5CYII=',
      'base64',
    ),
  );

  return sourceDir;
};

const createImageCardArchive = async (): Promise<string> => {
  const sourceDir = await createImageCardDirectory();
  const outputDir = await createTempDir('chips-card-image-output-');
  const cardFile = path.join(outputDir, 'image-demo.card');
  await zip.compress(sourceDir, cardFile);
  return cardFile;
};

const createYamlStringifiedCardDirectory = async (): Promise<string> => {
  const sourceDir = await createTempDir('chips-card-source-yaml-stringify-');
  await fs.mkdir(path.join(sourceDir, '.card'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'content'), { recursive: true });

  await fs.writeFile(
    path.join(sourceDir, '.card/metadata.yaml'),
    yaml.stringify({
      chip_standards_version: '1.0.0',
      card_id: 'yaml-stringified-card-id',
      name: 'YAML Stringified Card',
      created_at: '2026-03-13T12:45:33.919Z',
      modified_at: '2026-03-13T12:45:47.501Z',
      theme: '',
      description: '',
      tags: [],
    }),
    'utf-8',
  );
  await fs.writeFile(
    path.join(sourceDir, '.card/structure.yaml'),
    yaml.stringify({
      structure: [
        {
          id: 'intro',
          type: 'base.richtext',
          created_at: '2026-03-13T12:45:33.919Z',
          modified_at: '2026-03-13T12:45:47.501Z',
        },
      ],
      manifest: {
        card_count: 1,
        resource_count: 0,
        resources: [],
      },
    }),
    'utf-8',
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/intro.yaml'),
    yaml.stringify({
      id: 'intro',
      card_type: 'RichTextCard',
      content_format: 'markdown',
      content_source: 'inline',
      content_text: '2\n\n22\n\n222',
      locale: 'zh-CN',
    }),
    'utf-8',
  );

  return sourceDir;
};

const loadThemeRenderContext = async (
  themeId = 'chips-official.default-theme'
): Promise<{ theme: ReturnType<typeof toRenderThemeSnapshot>; themeCssText: string }> => {
  const resolved = resolveThemeFromLayers(mergeThemeLayers([]));
  return {
    theme: toRenderThemeSnapshot(themeId, resolved),
    themeCssText: ''
  };
};

const readPersistedRenderedDocument = async (documentUrl: string): Promise<{ indexPath: string; rootDir: string; html: string }> => {
  const indexPath = fileURLToPath(documentUrl);
  const rootDir = path.dirname(indexPath);
  tempDirs.push(rootDir);
  return {
    indexPath,
    rootDir,
    html: await fs.readFile(indexPath, 'utf-8'),
  };
};

const resolveRenderedDocumentPath = (
  service: CardService,
  documentUrl: string,
): string => {
  if (documentUrl.startsWith('file://')) {
    return fileURLToPath(documentUrl);
  }

  const resolved = service.resolveManagedDocumentFilePath(documentUrl);
  if (!resolved) {
    throw new Error(`Unable to resolve rendered document url: ${documentUrl}`);
  }
  return resolved;
};

const readResolvedRenderedDocument = async (
  service: CardService,
  documentUrl: string,
): Promise<{ indexPath: string; rootDir: string; html: string }> => {
  const indexPath = resolveRenderedDocumentPath(service, documentUrl);
  const rootDir = path.dirname(indexPath);
  tempDirs.push(rootDir);
  return {
    indexPath,
    rootDir,
    html: await fs.readFile(indexPath, 'utf-8'),
  };
};

const readRenderedNodeDocument = async (
  service: CardService,
  view: { documentUrl: string },
  nodeId: string,
): Promise<{ compositeHtml: string; frameSrc: string; nodePath: string; nodeHtml: string }> => {
  const renderedDocument = await readResolvedRenderedDocument(service, view.documentUrl);
  const dom = new JSDOM(renderedDocument.html, { url: view.documentUrl });

  try {
    const frame = dom.window.document?.querySelector?.(
      `.chips-composite__frame[data-node-id="${nodeId}"]`,
    ) as { getAttribute(name: string): string | null } | null;
    const frameSrc = frame?.getAttribute('src');
    if (!frameSrc) {
      throw new Error(`Rendered composite document does not contain a frame src for node ${nodeId}.`);
    }

    const nodePath = resolveRenderedDocumentPath(service, new URL(frameSrc, view.documentUrl).href);
    return {
      compositeHtml: renderedDocument.html,
      frameSrc,
      nodePath,
      nodeHtml: await fs.readFile(nodePath, 'utf-8'),
    };
  } finally {
    dom.window.close();
  }
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
});

describe('CardService rendering', () => {
  it('renders card through unified rendering engine', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.title).toBe('Test Card');
    expect(view.target).toBe('card-iframe');
    expect(view.semanticHash.length).toBeGreaterThan(10);
    expect(view.documentUrl.startsWith('file://')).toBe(true);
    expect(view.sessionId).toMatch(/^card-render-/);
    expect(view.body).toContain('data-target="card-iframe"');
    expect(view.body).toContain('data-mode="view"');
    expect(view.contentFiles).toEqual(['details.yaml', 'intro.yaml']);
    const persistedDocument = await readPersistedRenderedDocument(view.documentUrl);
    const introDocument = await readRenderedNodeDocument(service, view, 'intro');
    const detailsDocument = await readRenderedNodeDocument(service, view, 'details');

    expect(persistedDocument.html).toBe(view.body);
    expect(introDocument.frameSrc).toMatch(/^\.\/nodes\/\d{3}-intro-[a-f0-9]{10}\.html$/);
    expect(introDocument.nodeHtml).toContain('<base href="file://');
    expect(introDocument.nodeHtml).toContain('Intro');
    expect(introDocument.nodeHtml).toContain('Hello Chips.');
    expect(introDocument.nodeHtml).toContain('chips.basecard.richtext');
    expect(detailsDocument.nodeHtml).toContain('Second node body.');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('can run consistency verification during card render', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'offscreen-render',
      verifyConsistency: true,
      ...themeContext
    });

    expect(view.target).toBe('offscreen-render');
    expect(view.consistency?.consistent).toBe(true);
    expect(view.body).toContain('data-target="offscreen-render"');
    expect(view.body).toContain('loading="eager"');
    expect(view.body).toContain('compositeDataset.chipsCompositeReady = frameList.length === 0 ? "true" : "false";');
    expect(view.body).toContain('frame.dataset.renderReady = "true";');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('returns a formal cover file url that points to the card cover html', async () => {
    const cardFile = await createCardArchive();
    const service = new CardService({ workspaceRoot: process.cwd() });

    const view = await service.renderCover(cardFile);
    const coverPath = fileURLToPath(view.coverUrl);
    tempDirs.push(path.dirname(path.dirname(coverPath)));
    const coverHtml = await fs.readFile(coverPath, 'utf-8');

    expect(view.title).toBe('Test Card');
    expect(view.coverUrl.startsWith('file://')).toBe(true);
    expect(view.coverUrl.endsWith('/.card/cover.html')).toBe(true);
    expect(coverHtml).toContain('<h1>cover</h1>');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('emits composite node selection bridge only in preview mode', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const previewView = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext
    });
    const viewOnly = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'view',
      ...themeContext
    });

    expect(previewView.body).toContain('data-mode="preview"');
    expect(previewView.body).toContain('chips.basecard:select');
    expect(previewView.body).toContain('chips.composite:node-select');
    expect(viewOnly.body).toContain('data-mode="view"');
    expect(viewOnly.body).toContain('chips.basecard:select');
    expect(viewOnly.body).toContain('const isPreviewMode = document.body.dataset.mode === "preview";');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('renders unpacked .card directories through the same unified rendering engine', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.title).toBe('Test Card');
    expect(view.documentUrl.startsWith('file://')).toBe(true);
    expect(view.body).toContain('data-target="card-iframe"');
    expect(view.contentFiles).toEqual(['details.yaml', 'intro.yaml']);
    const introDocument = await readRenderedNodeDocument(service, view, 'intro');
    const detailsDocument = await readRenderedNodeDocument(service, view, 'details');

    expect(introDocument.nodeHtml).toContain('<base href="file://');
    expect(detailsDocument.nodeHtml).toContain('Second node body.');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('renders formal base card editor documents through the Host card.renderEditor route', async () => {
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.renderEditor({
      cardType: 'RichTextCard',
      baseCardId: 'intro',
      initialConfig: {
        id: 'intro',
        card_type: 'RichTextCard',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: 'Editor Body',
        locale: 'zh-CN'
      },
      ...themeContext
    });

    expect(view.cardType).toBe('RichTextCard');
    expect(view.pluginId).toBe('chips.basecard.richtext');
    expect(view.baseCardId).toBe('intro');
    expect(view.body).toContain('data-base-card-id="intro"');
    expect(view.body).toContain('renderBasecardEditor');
    expect(view.body).toContain('chips.card-editor:change');
    expect(view.body).toContain('chips.card-editor:resource-request');
    expect(view.body).toContain('chips.card-editor:resource-response');
    expect(view.body).toContain('chips.card-editor:resource-release');
    expect(view.body).toContain("resolveResourceUrl(resourcePath)");
    expect(view.body).toContain("requestResource('import'");
    expect(view.body).toContain("requestResource('importArchiveBundle'");
    expect(view.body).toContain("requestResource('delete'");
    expect(view.body).toContain("requestResource('convertTiffToPng'");
    expect(view.body).toContain("img-src file: http: https: data: blob:");
    expect(view.body).toContain("connect-src file: http: https: data: blob:");
    expect(view.body).toContain("child-src about: file: http: https: blob:");
    expect(view.body).toContain("frame-src about: file: http: https: blob:");
    expect(view.body).toContain('overflow: hidden;');
    expect(view.body).toContain('#chips-basecard-editor-root { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; overflow: hidden; }');
    expect(view.body).toContain('chips-basecard-editor__floating-toolbar');
    expect(view.body).not.toContain('chips-basecard-toolbar-offset');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('renders formal base card documents that keep resource resolution in the single-card runtime', async () => {
    const cardDir = await createImageCardDirectory();
    const themeContext = await loadThemeRenderContext();
    themeContext.theme.tokens['chips.layout.gap.md'] = '12cpx';
    themeContext.theme.tokens['chips.layout.size.navigation.primary.min'] = '160cpx';
    themeContext.themeCssText = '[data-scope="basecard"] { gap: 12cpx; min-inline-size: 160cpx; }';
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'image');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.renderBasecard({
      baseCardId: 'gallery',
      cardType: 'ImageCard',
      title: 'Hero',
      config: {
        card_type: 'ImageCard',
        layout_type: 'single',
        layout_options: {
          grid_mode: '2x2',
          single_width_percent: 100,
          single_alignment: 'center',
          spacing_mode: 'comfortable',
        },
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'assets/hero.png',
            title: 'Hero',
            alt: 'Hero',
          },
        ],
      },
      resourceBaseUrl: pathToFileURL(`${cardDir}${path.sep}`).href,
      interactionPolicy: 'native',
      ...themeContext,
    });

    expect(view.cardType).toBe('ImageCard');
    expect(view.pluginId).toBe('chips.basecard.image');
    expect(view.baseCardId).toBe('gallery');
    expect(view.body).toContain('<base href="file://');
    expect(view.body).toContain('renderBasecardView');
    expect(view.body).toContain('const resolveResourceUrl = async (resourcePath) =>');
    expect(view.body).toContain('assets/hero.png');
    expect(view.body).toContain('--chips-layout-gap-md: 1.171875vw;');
    expect(view.body).toContain('--chips-layout-size-navigation-primary-min: 15.625vw;');
    expect(view.body).toContain('gap: 1.171875vw; min-inline-size: 15.625vw;');
    expect(view.body).not.toContain('12cpx');
    expect(view.body).not.toContain('160cpx');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('normalizes relative resource bases inside exported single-card documents', async () => {
    const cardDir = await createImageCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'image');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.renderBasecard({
      baseCardId: 'gallery',
      cardType: 'ImageCard',
      title: 'Hero',
      config: {
        card_type: 'ImageCard',
        layout_type: 'single',
        layout_options: {
          grid_mode: '2x2',
          single_width_percent: 100,
          single_alignment: 'center',
          spacing_mode: 'comfortable',
        },
        images: [
          {
            id: 'image-1',
            source: 'file',
            file_path: 'assets/hero.png',
            title: 'Hero',
            alt: 'Hero',
          },
        ],
      },
      resourceBaseUrl: './assets/content/',
      interactionPolicy: 'native',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      url: 'https://community.example/cache/gallery.html',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 20));

      const image = dom.window.document?.querySelector?.(
        '[data-scope="image-card"] img',
      ) as { getAttribute(name: string): string | null } | null;
      expect(image?.getAttribute('src')).toBe('https://community.example/cache/assets/content/assets/hero.png');

      postedMessages.length = 0;
      const openResource = (dom.window as unknown as { __chipsLastBasecardContext?: { openResource?: (input: { resourceId: string; mimeType?: string }) => void } })
        .__chipsLastBasecardContext?.openResource;
      expect(typeof openResource).toBe('function');
      openResource?.({
        resourceId: 'assets/hero.png',
        mimeType: 'image/png',
      });

      const resourceOpenMessage = postedMessages.find((message) => message.type === 'chips.basecard:resource-open');
      expect(resourceOpenMessage?.payload).toMatchObject({
        nodeId: 'gallery',
        intent: 'view',
        resourceId: 'https://community.example/cache/assets/content/assets/hero.png',
        mimeType: 'image/png',
      });
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('stitches composite image cards from single-card runtime documents instead of pre-rendered static html', async () => {
    const cardDir = await createImageCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'image');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      ...themeContext,
    });
    const galleryDocument = await readRenderedNodeDocument(service, view, 'gallery');

    expect(galleryDocument.compositeHtml).toContain('sandbox="allow-scripts allow-popups"');
    expect(galleryDocument.frameSrc).toMatch(/^\.\/nodes\/\d{3}-gallery-[a-f0-9]{10}\.html$/);
    expect(galleryDocument.nodeHtml).toContain('<base href="file://');
    expect(galleryDocument.nodeHtml).toContain('renderBasecardView');
    expect(galleryDocument.nodeHtml).toContain('const resolveResourceUrl = async (resourcePath) =>');
    expect(galleryDocument.nodeHtml).toContain('assets/hero.png');
    expect(view.diagnostics).toEqual([]);
    expect(view.qualityGate).toMatchObject({
      passed: true,
      blockingCount: 0
    });
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('keeps archive-backed composite image resources reachable after render returns', async () => {
    const cardFile = await createImageCardArchive();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'image');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext,
    });
    const galleryDocument = await readRenderedNodeDocument(service, view, 'gallery');
    const baseHrefMatch = galleryDocument.nodeHtml.match(/<base href="([^"]+)"/);
    const baseHref = baseHrefMatch?.[1] ?? '';

    expect(baseHref.startsWith('file://')).toBe(true);
    const extractedRoot = fileURLToPath(baseHref);
    tempDirs.push(extractedRoot);

    const imagePath = fileURLToPath(new URL('assets/hero.png', baseHref));
    const imageStats = await fs.stat(imagePath);

    expect(imageStats.isFile()).toBe(true);
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('emits managed render protocol urls when a managed document scheme is configured', async () => {
    const cardFile = await createImageCardArchive();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'image');
    const service = new CardService({
      runtime,
      workspaceRoot: process.cwd(),
      managedDocumentScheme: 'chips-render',
    });

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext,
    });
    const galleryDocument = await readRenderedNodeDocument(service, view, 'gallery');
    const persistedDocument = await readResolvedRenderedDocument(service, view.documentUrl);
    const baseHrefMatch = galleryDocument.nodeHtml.match(/<base href="([^"]+)"/);
    const baseHref = baseHrefMatch?.[1] ?? '';
    const imageUrl = new URL('assets/hero.png', baseHref).href;
    const coverView = await service.renderCover(cardFile);

    expect(view.documentUrl.startsWith('chips-render://session/')).toBe(true);
    expect(persistedDocument.html).toBe(view.body);
    expect(galleryDocument.nodeHtml).toContain('<base href="chips-render://card-root/');
    expect(service.resolveManagedDocumentFilePath(imageUrl)?.endsWith(path.join('assets', 'hero.png'))).toBe(true);
    expect(coverView.coverUrl.startsWith('chips-render://card-root/')).toBe(true);
    expect(service.resolveManagedDocumentFilePath(coverView.coverUrl)?.endsWith(path.join('.card', 'cover.html'))).toBe(true);
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('does not escalate mixed node success and failure into a composite fatal error', async () => {
    const cardDir = await createPartiallyBrokenCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      url: view.documentUrl,
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const introFrame = dom.window.document?.querySelector?.(
        '.chips-composite__frame[data-node-id="intro"]',
      ) as FrameElementLike | null;
      introFrame?.dispatchEvent?.(new dom.window.Event('load'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(postedMessages.some((message) => message.type === 'chips.composite:node-error')).toBe(true);
      expect(postedMessages.some((message) => message.type === 'chips.composite:fatal-error')).toBe(false);
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('renders composite cards as a bare basecard stack without extra chrome', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    expect(view.body).toContain('html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }');
    expect(view.body).toContain('.chips-composite { width: 100%; max-width: none; margin: 0; padding: 0; box-sizing: border-box; }');
    expect(view.body).toContain('.chips-composite__node { min-width: 0; }');
    expect(view.body).not.toContain('chips-composite__header');
    expect(view.body).not.toContain('chips-composite__title');
    expect(view.body).not.toContain('chips-composite__meta');
    expect(view.body).not.toContain('.chips-composite__node {\n  background:');
    expect(view.body).not.toContain('body[data-mode="preview"] .chips-composite__node[data-state="ready"]:hover');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('listens for viewport-driven basecard reflow and resends child heights', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });
    const introDocument = await readRenderedNodeDocument(service, view, 'intro');

    expect(introDocument.nodeHtml).toContain('scheduleEmitHeight');
    expect(introDocument.nodeHtml).toContain('window.addEventListener(');
    expect(introDocument.nodeHtml).toContain('observer.observe(document.documentElement);');
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('emits composite resize messages when the composite layout height changes', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      url: view.documentUrl,
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 5));

      const initialResize = postedMessages.find((message) => message.type === 'chips.composite:resize');
      expect(initialResize).toBeTruthy();
      expect(initialResize?.payload).toMatchObject({
        nodeCount: 2,
        reason: 'initial',
      });

      postedMessages.length = 0;

      const dispatchMessage = dom.window.dispatchEvent;
      if (!dispatchMessage) {
        throw new Error('JSDOM window does not expose dispatchEvent.');
      }

      dispatchMessage.call(
        dom.window,
        new dom.window.MessageEvent('message', {
          data: {
            type: 'chips.basecard:height',
            payload: {
              nodeId: 'intro',
              height: 512,
            },
          },
          origin: 'null',
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 5));

      const introFrame = dom.window.document?.querySelector?.(
        '.chips-composite__frame[data-node-id="intro"]',
      ) as { style?: { height?: string } } | null;
      expect(introFrame?.style?.height).toBe('512px');

      const resizeMessage = postedMessages.find((message) => message.type === 'chips.composite:resize');
      expect(resizeMessage?.payload).toMatchObject({
        nodeCount: 2,
        reason: 'node-height',
      });
      expect((resizeMessage?.payload as { height: number }).height).toBeGreaterThanOrEqual(240);
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('forwards delegated basecard interaction messages to the composite interaction bridge', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      interactionPolicy: 'delegate',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      postedMessages.length = 0;

      const introFrame = dom.window.document?.querySelector?.(
        '.chips-composite__frame[data-node-id="intro"]',
      ) as FrameElementLike | null;
      expect(introFrame).toBeTruthy();

      if (!introFrame) {
        throw new Error('Expected intro frame to exist.');
      }

      const frameWindow = introFrame.contentWindow ?? {};
      if (!introFrame.contentWindow) {
        Object.defineProperty(introFrame, 'contentWindow', {
          configurable: true,
          value: frameWindow,
        });
      }

      introFrame.getBoundingClientRect = () =>
        ({
          left: 48,
          top: 120,
          right: 368,
          bottom: 440,
          width: 320,
          height: 320,
          x: 48,
          y: 120,
          toJSON() {
            return {};
          },
        }) as DomRectLike;

      const dispatchMessage = dom.window.dispatchEvent;
      if (!dispatchMessage) {
        throw new Error('JSDOM window does not expose dispatchEvent.');
      }

      dispatchMessage.call(
        dom.window,
        new dom.window.MessageEvent('message', {
          data: {
            type: 'chips.basecard:interaction',
            payload: {
              nodeId: 'intro',
              cardType: 'RichTextCard',
              device: 'wheel',
              intent: 'scroll',
              deltaX: 12,
              deltaY: 60,
              clientX: 16,
              clientY: 24,
              pointerCount: 1,
            },
          },
          origin: 'null',
          source: frameWindow as never,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 5));

      const interactionMessage = postedMessages.find((message) => message.type === 'chips.composite:interaction');
      expect(interactionMessage?.payload).toMatchObject({
        cardId: 'test-card-id',
        nodeId: 'intro',
        cardType: 'RichTextCard',
        source: 'basecard-frame',
        device: 'wheel',
        intent: 'scroll',
        deltaX: 12,
        deltaY: 60,
        clientX: 64,
        clientY: 144,
        pointerCount: 1,
      });
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('forwards structured resource-open payloads from basecard frames to the composite shell', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      interactionPolicy: 'delegate',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      postedMessages.length = 0;

      const introFrame = dom.window.document?.querySelector?.(
        '.chips-composite__frame[data-node-id="intro"]',
      ) as FrameElementLike | null;
      expect(introFrame).toBeTruthy();

      if (!introFrame) {
        throw new Error('Expected intro frame to exist.');
      }

      const frameWindow = introFrame.contentWindow ?? {};
      if (!introFrame.contentWindow) {
        Object.defineProperty(introFrame, 'contentWindow', {
          configurable: true,
          value: frameWindow,
        });
      }

      const dispatchMessage = dom.window.dispatchEvent;
      if (!dispatchMessage) {
        throw new Error('JSDOM window does not expose dispatchEvent.');
      }

      dispatchMessage.call(
        dom.window,
        new dom.window.MessageEvent('message', {
          data: {
            type: 'chips.basecard:resource-open',
            payload: {
              nodeId: 'intro',
              intent: 'view',
              resourceId: 'chips-render://card-root/session-1/tracks/demo.mp3',
              mimeType: 'audio/mpeg',
              title: 'Evergreen',
              fileName: 'demo.mp3',
              payload: {
                kind: 'chips.music-card',
                version: '1.0.0',
              },
            },
          },
          origin: 'null',
          source: frameWindow as never,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 5));

      const resourceOpenMessage = postedMessages.find((message) => message.type === 'chips.composite:resource-open');
      expect(resourceOpenMessage?.payload).toMatchObject({
        nodeId: 'intro',
        cardType: 'RichTextCard',
        intent: 'view',
        resourceId: 'chips-render://card-root/session-1/tracks/demo.mp3',
        mimeType: 'audio/mpeg',
        title: 'Evergreen',
        fileName: 'demo.mp3',
        payload: {
          kind: 'chips.music-card',
          version: '1.0.0',
        },
      });
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('ignores basecard interaction bridge messages when interaction delegation is disabled', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      interactionPolicy: 'native',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        installBlobUrlSupport(window);
        Object.defineProperty(window, 'parent', {
          configurable: true,
          value: {
            postMessage(message: { type?: string; payload?: unknown }) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      postedMessages.length = 0;

      const introFrame = dom.window.document?.querySelector?.(
        '.chips-composite__frame[data-node-id="intro"]',
      ) as FrameElementLike | null;
      expect(introFrame).toBeTruthy();

      if (!introFrame) {
        throw new Error('Expected intro frame to exist.');
      }

      const frameWindow = introFrame.contentWindow ?? {};
      if (!introFrame.contentWindow) {
        Object.defineProperty(introFrame, 'contentWindow', {
          configurable: true,
          value: frameWindow,
        });
      }

      const dispatchMessage = dom.window.dispatchEvent;
      if (!dispatchMessage) {
        throw new Error('JSDOM window does not expose dispatchEvent.');
      }

      dispatchMessage.call(
        dom.window,
        new dom.window.MessageEvent('message', {
          data: {
            type: 'chips.basecard:interaction',
            payload: {
              nodeId: 'intro',
              cardType: 'RichTextCard',
              device: 'wheel',
              intent: 'scroll',
              deltaX: 12,
              deltaY: 60,
              clientX: 16,
              clientY: 24,
              pointerCount: 1,
            },
          },
          origin: 'null',
          source: frameWindow as never,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(postedMessages.some((message) => message.type === 'chips.composite:interaction')).toBe(false);
    } finally {
      dom.window.close();
    }
  }, CARD_RENDER_TEST_TIMEOUT_MS);

  it('renders card content written by yaml.stringify without parse failures', async () => {
    const cardDir = await createYamlStringifiedCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    await installBaseCardPluginFixture(runtime, workspace, 'richtext');
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });
    const introDocument = await readRenderedNodeDocument(service, view, 'intro');

    expect(view.title).toBe('YAML Stringified Card');
    expect(introDocument.nodeHtml).toContain('renderBasecardView');
    expect(introDocument.nodeHtml).toContain('"content_source":"inline"');
    expect(introDocument.nodeHtml).toContain('"content_text":"2\\n\\n22\\n\\n222"');
  }, CARD_RENDER_TEST_TIMEOUT_MS);
});
