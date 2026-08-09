import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspaceScenePath = fileURLToPath(new URL('../../src/scenes/WorkspaceScene.tsx', import.meta.url));
const appShellPath = fileURLToPath(new URL('../../src/app/AppShell.tsx', import.meta.url));

describe('WorkspaceScene application chrome', () => {
  it('does not mount the application header toolbar above the workspace', async () => {
    const source = await readFile(workspaceScenePath, 'utf8');

    expect(source).not.toContain("from '../components/HeaderBar/HeaderBar'");
    expect(source).not.toContain('<HeaderBar');
  });

  it('mounts the shared AppChrome without menu bar or toolbar rows', async () => {
    const source = await readFile(appShellPath, 'utf8');

    expect(source).toContain('AppChrome');
    expect(source).not.toContain('menus=');
    expect(source).not.toContain('toolbarItems=');
    expect(source).not.toContain('appName=');
  });
});
