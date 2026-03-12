import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CardService } from '../../packages/card-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import { PluginRuntime } from '../../src/runtime';
import { mergeThemeLayers, resolveThemeFromLayers } from '../../src/main/theme-runtime/resolve-algorithm';
import { toRenderThemeSnapshot } from '../../src/main/theme-runtime/render-bridge';

const zip = new StoreZipService();
const tempDirs: string[] = [];

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const createCardArchive = async (): Promise<string> => {
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
    ['card_type: "RichTextCard"', 'content_source: "inline"', 'content_text: |', '  <h1>Intro</h1>', '  <p>Hello Chips.</p>'].join(
      '\n'
    ),
    'utf-8'
  );
  await fs.writeFile(
    path.join(sourceDir, 'content/details.yaml'),
    ['card_type: "RichTextCard"', 'content_source: "inline"', 'content_text: |', '  <h1>Details</h1>', '  <p>Second node body.</p>'].join(
      '\n'
    ),
    'utf-8'
  );

  const outputDir = await createTempDir('chips-card-output-');
  const cardFile = path.join(outputDir, 'demo.card');
  await zip.compress(sourceDir, cardFile);
  return cardFile;
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

const createRichtextCardService = async (
  themeId = 'chips-official.default-theme'
): Promise<{ service: CardService; workspace: string }> => {
  const workspace = await createTempDir('chips-card-runtime-');
  const runtime = new PluginRuntime(workspace, {
    locale: 'zh-CN',
    themeId
  });
  await runtime.load();
  const install = await runtime.install(path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP'));
  await runtime.enable(install.manifest.id);
  return {
    service: new CardService({ runtime, workspaceRoot: process.cwd() }),
    workspace
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
    const { service } = await createRichtextCardService();

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.title).toBe('Test Card');
    expect(view.target).toBe('card-iframe');
    expect(view.semanticHash.length).toBeGreaterThan(10);
    expect(view.body).toContain('data-target="card-iframe"');
    expect(view.body).toContain('Intro');
    expect(view.body).toContain('Hello Chips.');
    expect(view.body).toContain('chips.basecard.richtext');
    expect(view.body).toContain('chips.composite:node-select');
    expect(view.contentFiles).toEqual(['details.yaml', 'intro.yaml']);
  }, 30_000);

  it('can run consistency verification during card render', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext();
    const { service } = await createRichtextCardService();

    const view = await service.render(cardFile, {
      target: 'offscreen-render',
      verifyConsistency: true,
      ...themeContext
    });

    expect(view.target).toBe('offscreen-render');
    expect(view.consistency?.consistent).toBe(true);
    expect(view.body).toContain('data-target="offscreen-render"');
  }, 30_000);

  it('preserves dark theme color-scheme from theme package css', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext(
      '../ThemePack/Chips-theme-default-dark',
      'chips-official.default-dark-theme'
    );
    const { service } = await createRichtextCardService('chips-official.default-dark-theme');

    const view = await service.render(cardFile, {
      target: 'card-iframe',
      ...themeContext
    });

    expect(view.body).toContain('color-scheme: dark;');
    expect(view.body).not.toContain('color-scheme: light;');
  }, 30_000);

  it('reads and updates normalized base card config through the formal card service contract', async () => {
    const cardFile = await createCardArchive();
    const { service } = await createRichtextCardService();

    const baseCard = await service.getBaseCard(cardFile, 'intro');
    expect(baseCard.nodeId).toBe('intro');
    expect(baseCard.cardType).toBe('RichTextCard');
    expect(baseCard.pluginId).toBe('chips.basecard.richtext');
    expect(baseCard.title).toBe('Intro');
    expect(baseCard.config).toMatchObject({
      id: 'intro',
      title: 'Intro',
      body: '<p>Hello Chips.</p>',
      locale: 'zh-CN'
    });

    const updated = await service.updateBaseCard(cardFile, 'intro', {
      id: 'intro',
      title: 'Updated Intro',
      body: '<p>Updated body.</p>',
      locale: 'en-US'
    });
    expect(updated.title).toBe('Updated Intro');
    expect(updated.config).toMatchObject({
      id: 'intro',
      title: 'Updated Intro',
      body: '<p>Updated body.</p>',
      locale: 'en-US'
    });

    const reread = await service.getBaseCard(cardFile, 'intro');
    expect(reread.title).toBe('Updated Intro');
    expect(reread.config).toMatchObject({
      id: 'intro',
      title: 'Updated Intro',
      body: '<p>Updated body.</p>',
      locale: 'en-US'
    });

    const extractedDir = await createTempDir('chips-card-updated-');
    await zip.extract(cardFile, extractedDir);
    const introYaml = await fs.readFile(path.join(extractedDir, 'content/intro.yaml'), 'utf-8');
    const metadataYaml = await fs.readFile(path.join(extractedDir, '.card/metadata.yaml'), 'utf-8');
    expect(introYaml).toContain('card_type: "RichTextCard"');
    expect(introYaml).toContain('title: "Updated Intro"');
    expect(introYaml).toContain('locale: "en-US"');
    expect(introYaml).toContain('body: "<p>Updated body.</p>"');
    expect(metadataYaml).toContain('modified_at:');
  }, 30_000);

  it('renders formal base card editor iframe documents through host-owned plugin loading', async () => {
    const cardFile = await createCardArchive();
    const themeContext = await loadThemeRenderContext();
    const { service } = await createRichtextCardService();

    const editor = await service.renderBaseCardEditor(cardFile, 'intro', themeContext.theme, themeContext.themeCssText);
    expect(editor.protocolVersion).toBe('1.0.0');
    expect(editor.baseCard.nodeId).toBe('intro');
    expect(editor.baseCard.pluginId).toBe('chips.basecard.richtext');
    expect(editor.body).toContain('chips.basecard-editor:ready');
    expect(editor.body).toContain('chips.basecard-editor:config-change');
    expect(editor.body).toContain('chips.basecard-editor:fatal-error');
    expect(editor.body).toContain('__chipsBasecardPluginBundle__');
    expect(editor.body).toContain('chips-basecard-editor-root');
  }, 30_000);
});
