import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
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
};

const { JSDOM }: { JSDOM: JSDOMConstructor } = require('jsdom');

const zip = new StoreZipService();
const tempDirs: string[] = [];

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
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
    ['structure:', '  - id: "intro"', '    type: "base.richtext"', '  - id: "details"', '    type: "base.richtext"'].join(
      '\n'
    ),
    'utf-8'
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/intro.yaml'),
    ['card_type: "base.richtext"', 'content_source: "inline"', 'content_text: |', '  <h1>Intro</h1>', '  <p>Hello Chips.</p>'].join(
      '\n'
    ),
    'utf-8'
  );
  await fs.writeFile(
    path.join(sourceDir, 'content/details.yaml'),
    ['card_type: "base.richtext"', 'content_source: "inline"', 'content_text: |', '  <h1>Details</h1>', '  <p>Second node body.</p>'].join(
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
    ['structure:', '  - id: "intro"', '    type: "base.richtext"', '  - id: "missing"', '    type: "base.richtext"'].join('\n'),
    'utf-8',
  );
  await fs.writeFile(path.join(sourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
  await fs.writeFile(
    path.join(sourceDir, 'content/intro.yaml'),
    ['card_type: "base.richtext"', 'content_source: "inline"', 'content_text: |', '  <h1>Intro</h1>', '  <p>Hello Chips.</p>'].join('\n'),
    'utf-8',
  );

  return sourceDir;
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
      body: '<span style="font-weight: normal">2</span><p></p><span style="font-weight: normal">22</span><span style="font-weight: normal"><br></span><span style="font-weight: normal">2</span><span style="font-weight: normal">2</span><span style="font-weight: normal">2</span>',
      locale: 'zh-CN',
    }),
    'utf-8',
  );

  return sourceDir;
};

const loadThemeRenderContext = async (
  themeDir = '../ThemePack/Chips-default',
  themeId = 'chips-official.default-theme'
): Promise<{ theme: ReturnType<typeof toRenderThemeSnapshot>; themeCssText: string }> => {
  const themeRoot = path.resolve(process.cwd(), themeDir);
  const tokens = JSON.parse(await fs.readFile(path.join(themeRoot, 'dist', 'tokens.json'), 'utf-8')) as Record<string, unknown>;
  const themeCssText = await fs.readFile(path.join(themeRoot, 'dist', 'theme.css'), 'utf-8');
  const resolved = resolveThemeFromLayers(mergeThemeLayers([{ id: themeId, tokens }]));
  return {
    theme: toRenderThemeSnapshot(themeId, resolved),
    themeCssText
  };
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
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
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.title).toBe('Test Card');
    expect(view.target).toBe('card-iframe');
    expect(view.semanticHash.length).toBeGreaterThan(10);
    expect(view.body).toContain('data-target="card-iframe"');
    expect(view.body).toContain('data-mode="view"');
    expect(view.body).toContain('Intro');
    expect(view.body).toContain('Hello Chips.');
    expect(view.body).toContain('chips.basecard.richtext');
    expect(view.contentFiles).toEqual(['details.yaml', 'intro.yaml']);
  }, 30_000);

  it('can run consistency verification during card render', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'offscreen-render',
      verifyConsistency: true,
      ...themeContext
    });

    expect(view.target).toBe('offscreen-render');
    expect(view.consistency?.consistent).toBe(true);
    expect(view.body).toContain('data-target="offscreen-render"');
  }, 30_000);

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
  }, 30_000);

  it('emits composite node selection bridge only in preview mode', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
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
  }, 30_000);

  it('renders unpacked .card directories through the same unified rendering engine', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.title).toBe('Test Card');
    expect(view.body).toContain('data-target="card-iframe"');
    expect(view.body).toContain('Second node body.');
    expect(view.contentFiles).toEqual(['details.yaml', 'intro.yaml']);
  }, 30_000);

  it('renders formal base card editor documents through the Host card.renderEditor route', async () => {
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.renderEditor({
      cardType: 'base.richtext',
      baseCardId: 'intro',
      initialConfig: {
        id: 'intro',
        body: '<p>Editor Body</p>',
        locale: 'zh-CN'
      },
      ...themeContext
    });

    expect(view.cardType).toBe('base.richtext');
    expect(view.pluginId).toBe('chips.basecard.richtext');
    expect(view.baseCardId).toBe('intro');
    expect(view.body).toContain('data-base-card-id="intro"');
    expect(view.body).toContain('renderBasecardEditor');
    expect(view.body).toContain('chips.card-editor:change');
    expect(view.body).toContain("img-src file: http: https: data: blob:");
    expect(view.body).toContain('overflow: hidden;');
    expect(view.body).toContain('#chips-basecard-editor-root { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; overflow: hidden; }');
    expect(view.body).toContain('.chips-basecard-editor__toolbar-shell { flex: 0 0 auto; width: 100%; }');
    expect(view.body).not.toContain('chips-basecard-editor__floating-toolbar');
    expect(view.body).not.toContain('chips-basecard-toolbar-offset');
  }, 30_000);

  it('emits ready and height messages from Host-managed basecard view documents without srcdoc syntax errors', async () => {
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const session = await service.openBasecardSession({
      cardType: 'base.richtext',
      baseCardId: 'intro',
      sourceConfig: {
        id: 'intro',
        body: '<p>第一段</p><p>第二段</p><p>第三段</p>',
        locale: 'zh-CN',
      },
    });

    const view = await service.renderBasecardSessionView(
      session.sessionId,
      themeContext.theme,
      themeContext.themeCssText,
      'delegate',
    );

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
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

      expect(view.body).toContain("img-src file: http: https: data: blob:");
      expect(postedMessages.some((message) => message.type === 'chips.basecard:ready')).toBe(true);
      const heightMessage = postedMessages.find((message) => message.type === 'chips.basecard:height');
      expect(heightMessage).toBeTruthy();
      expect((heightMessage?.payload as { height: number }).height).toBeGreaterThanOrEqual(64);
    } finally {
      dom.window.close();
      service.closeBasecardSession(session.sessionId);
    }
  }, 30_000);

  it('emits ready and resize messages from Host-managed card editor documents without srcdoc syntax errors', async () => {
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.renderEditor({
      cardType: 'base.richtext',
      baseCardId: 'intro',
      initialConfig: {
        id: 'intro',
        body: '<p>编辑态内容</p>',
        locale: 'zh-CN',
      },
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const runtimeErrors: string[] = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
        window.addEventListener?.('error', (event: unknown) => {
          const errorEvent = event as { error?: { stack?: string }; message?: string };
          runtimeErrors.push(
            String(errorEvent.error?.stack ?? errorEvent.message ?? errorEvent.error ?? 'unknown')
          );
        });
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
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(runtimeErrors).toEqual([]);
      expect(postedMessages.some((message) => message.type === 'chips.card-editor:ready')).toBe(true);
      const resizeMessage = postedMessages.find((message) => message.type === 'chips.card-editor:resize');
      expect(resizeMessage).toBeTruthy();
      expect((resizeMessage?.payload as { height: number }).height).toBeGreaterThanOrEqual(240);
    } finally {
      dom.window.close();
    }
  }, 30_000);

  it('preserves dark theme color-scheme from theme package css', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext(
      '../ThemePack/Chips-theme-default-dark',
      'chips-official.default-dark-theme'
    );
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-dark-theme'
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.body).toContain('color-scheme: dark;');
    expect(view.body).not.toContain('color-scheme: light;');
  }, 30_000);

  it('does not escalate mixed node success and failure into a composite fatal error', async () => {
    const cardDir = await createPartiallyBrokenCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
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

      expect(postedMessages.some((message) => message.type === 'chips.composite:node-error')).toBe(true);
      expect(postedMessages.some((message) => message.type === 'chips.composite:fatal-error')).toBe(false);
    } finally {
      dom.window.close();
    }
  }, 30_000);

  it('renders composite cards at full iframe width with only inner padding gutters', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    expect(view.body).toContain('html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }');
    expect(view.body).toContain('.chips-composite { width: 100%; max-width: none; margin: 0; padding: 28px 22px 40px; box-sizing: border-box; }');
    expect(view.body).not.toContain('width: min(calc(100% - 44px), 980px);');
  }, 30_000);

  it('emits composite resize messages when the composite layout height changes', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    const postedMessages: Array<{ type?: string; payload?: unknown }> = [];
    const dom = new JSDOM(view.body, {
      runScripts: 'dangerously',
      beforeParse(window: JsdomWindowLike) {
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
      );
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
  }, 30_000);

  it('forwards delegated basecard interaction messages to the composite interaction bridge', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
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
              cardType: 'base.richtext',
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
        cardType: 'base.richtext',
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
  }, 30_000);

  it('ignores basecard interaction bridge messages when interaction delegation is disabled', async () => {
    const cardDir = await createCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
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
              cardType: 'base.richtext',
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
  }, 30_000);

  it('renders card content written by yaml.stringify without parse failures', async () => {
    const cardDir = await createYamlStringifiedCardDirectory();
    const themeContext = await loadThemeRenderContext();
    const workspace = await createTempDir('chips-card-runtime-');
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme',
    });
    await runtime.load();
    const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
    await runtime.enable(install.manifest.id);
    const service = new CardService({ runtime, workspaceRoot: process.cwd() });

    const view = await service.render(cardDir, {
      target: 'card-iframe',
      mode: 'preview',
      ...themeContext,
    });

    expect(view.title).toBe('YAML Stringified Card');
    expect(view.body).toContain('1111');
    expect(view.body).toContain('font-weight: normal');
  }, 30_000);
});
