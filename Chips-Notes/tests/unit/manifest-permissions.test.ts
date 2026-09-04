import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';
import { appConfig } from '../../config/app-config';

describe('editing-engine manifest permissions', () => {
  it('keeps the application identity aligned with the manifest', async () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.yaml');
    const manifest = yaml.parse(await fs.readFile(manifestPath, 'utf-8')) as {
      id?: unknown;
      type?: unknown;
      entry?: unknown;
    };

    expect(manifest.id).toBe('chips-official.editing-engine');
    expect(manifest.id).toBe(appConfig.appId);
    expect(manifest.type).toBe('app');
    expect(manifest.entry).toBe('dist/index.html');
  });

  it('declares the resource permissions required by basecard import flows', async () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.yaml');
    const manifest = yaml.parse(await fs.readFile(manifestPath, 'utf-8')) as {
      permissions?: unknown;
    };

    expect(Array.isArray(manifest.permissions)).toBe(true);
    expect(manifest.permissions).toContain('resource.read');
    expect(manifest.permissions).toContain('zip.manage');
  });

  it('declares command registry permissions without cross-owner command management', async () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.yaml');
    const manifest = yaml.parse(await fs.readFile(manifestPath, 'utf-8')) as {
      permissions?: unknown;
    };

    expect(Array.isArray(manifest.permissions)).toBe(true);
    expect(manifest.permissions).toContain('command.read');
    expect(manifest.permissions).toContain('command.write');
    expect(manifest.permissions).toContain('command.invoke');
    expect(manifest.permissions).not.toContain('command.manage');
  });

  it('no longer declares theme or i18n permissions after their system removal', async () => {
    const manifestPath = path.resolve(__dirname, '../../manifest.yaml');
    const manifest = yaml.parse(await fs.readFile(manifestPath, 'utf-8')) as {
      permissions?: unknown;
    };

    expect(Array.isArray(manifest.permissions)).toBe(true);
    expect(manifest.permissions).not.toContain('theme.read');
    expect(manifest.permissions).not.toContain('i18n.read');
  });
});
