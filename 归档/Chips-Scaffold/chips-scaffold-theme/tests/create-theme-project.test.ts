import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createThemeProject, listThemeTemplates } from '../src';

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');
const FORBIDDEN_PROJECT_DIRS = ['需求文档', '技术文档', '技术手册', '开发计划'];

describe('chips-scaffold-theme', () => {
  it('lists available theme templates', () => {
    const templates = listThemeTemplates();
    const ids = templates.map((t) => t.id);
    expect(ids).toContain('theme-standard');
    const standard = templates.find((t) => t.id === 'theme-standard');
    expect(standard?.recommended).toBe(true);
  });

  it('creates a theme project from theme-standard template', async () => {
    const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'chips-theme-scaffold-test-'));
    const projectDir = path.join(workspace, 'my-theme');

    try {
      await createThemeProject({
        targetDir: projectDir,
        themeId: 'theme.my-theme',
        displayName: 'My Theme',
        pluginId: 'chips.theme.my.theme',
        publisher: 'chips-lab',
        parentThemeId: 'chips-official.default-theme',
        description: 'A generated theme for Chips ecosystem'
      });

      const manifestPath = path.join(projectDir, 'manifest.yaml');
      const packageJsonPath = path.join(projectDir, 'package.json');
      const tokensDir = path.join(projectDir, 'tokens');
      const compTokensDir = path.join(tokensDir, 'comp');
      const sourceWoffPath = path.join(
        __dirname,
        '..',
        'templates',
        'theme-standard',
        'icons',
        'variablefont',
        'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2'
      );
      const generatedWoffPath = path.join(
        projectDir,
        'icons',
        'variablefont',
        'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2'
      );

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      expect(fs.existsSync(tokensDir)).toBe(true);

      const manifestContent = readFile(manifestPath);
      expect(manifestContent).toContain('type: "theme"');
      expect(manifestContent).toContain('themeId: "theme.my-theme"');
      expect(manifestContent).toContain('id: "chips.theme.my.theme"');
      expect(manifestContent).toContain('displayName: "My Theme"');
      expect(manifestContent).toContain('publisher: "chips-lab"');
      expect(manifestContent).toContain('parentTheme: "chips-official.default-theme"');
      expect(manifestContent).toContain('schemaVersion: "1.0.0"');
      expect(manifestContent).toContain('runtime:');
      expect(manifestContent).toContain('headless:');
      expect(manifestContent).toContain('tokens: "dist/tokens.json"');
      expect(manifestContent).toContain('themeCss: "dist/theme.css"');

      const packageJson = JSON.parse(readFile(packageJsonPath)) as { name: string; scripts?: Record<string, string> };
      expect(packageJson.name).toBe('chips.theme.my.theme');
      expect(packageJson.scripts?.build).toContain('build:contracts');
      expect(packageJson.scripts?.verify).toContain('npm run package');
      expect(packageJson.scripts?.['validate:theme']).toBeDefined();
      expect(packageJson.scripts?.validate).toBe('chipsdev validate');
      expect(packageJson.scripts?.package).toBe('chipsdev package');

      expect(fs.existsSync(path.join(tokensDir, 'ref.json'))).toBe(true);
      expect(fs.existsSync(path.join(tokensDir, 'sys.json'))).toBe(true);
      expect(fs.existsSync(path.join(tokensDir, 'motion.json'))).toBe(true);
      expect(fs.existsSync(path.join(tokensDir, 'layout.json'))).toBe(true);
      expect(fs.existsSync(path.join(compTokensDir, 'button.json'))).toBe(true);
      expect(fs.existsSync(path.join(compTokensDir, 'navigation-split-view.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'tokens', 'global.json'))).toBe(false);
      expect(fs.existsSync(path.join(projectDir, 'tokens', 'semantic.json'))).toBe(false);
      expect(fs.existsSync(path.join(projectDir, 'tokens', 'typography.json'))).toBe(false);

      expect(fs.statSync(generatedWoffPath).size).toBe(fs.statSync(sourceWoffPath).size);

      const generatedTextFiles = [
        'manifest.yaml',
        'package.json',
        'README.md',
        'src/build-contracts.ts',
        'src/validate-theme.ts',
        'tests/contract.spec.ts',
        'tests/theme-matrix.spec.ts',
        'preview/theme-matrix.json'
      ];
      for (const relativePath of generatedTextFiles) {
        expect(readFile(path.join(projectDir, relativePath))).not.toMatch(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/);
      }
      expect(readFile(path.join(projectDir, 'src', 'build-contracts.ts'))).not.toContain('Chips-ComponentLibrary');
      expect(readFile(path.join(projectDir, 'src', 'validate-theme.ts'))).not.toContain('Chips-ComponentLibrary');
      expect(readFile(path.join(projectDir, 'preview', 'theme-matrix.json'))).toContain('"themeId": "theme.my-theme"');

      for (const dirName of FORBIDDEN_PROJECT_DIRS) {
        await expect(fsp.stat(path.join(projectDir, dirName))).rejects.toMatchObject({
          code: 'ENOENT'
        });
      }
    } finally {
      await fsp.rm(workspace, { recursive: true, force: true });
    }
  });
});
