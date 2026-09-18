import { describe, expect, it, vi } from 'vitest';
import { ResourceOpenService, type ResourceOpenServiceOptions } from '../../packages/resource-open-service/src';

const createServiceOptions = (
  overrides: Partial<ResourceOpenServiceOptions> & { preferences?: Record<string, string> | undefined },
): ResourceOpenServiceOptions => {
  const { preferences, ...rest } = overrides;
  return {
    queryHandlerPlugins: vi.fn().mockResolvedValue([]),
    readHandlerPreferences: vi.fn().mockResolvedValue(preferences),
    launchPlugin: vi.fn().mockResolvedValue({ windowId: 'window-test' }),
    resolveResourceFilePath: () => null,
    openPath: vi.fn(),
    openExternalUrl: vi.fn(),
    ...rest,
  };
};

describe('ResourceOpenService', () => {
  it('prefers resource-handler capabilities before file-handler fallbacks', async () => {
    const launchPlugin = vi.fn().mockResolvedValue({ windowId: 'window-1' });
    const service = new ResourceOpenService(createServiceOptions({
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.photo.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*', 'file-handler:.png'],
        },
      ]),
      launchPlugin,
      resolveResourceFilePath: () => '/tmp/demo.png',
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: 'chips-render://card-root/test-token/assets/demo.png',
          mimeType: 'image/png',
          payload: {
            kind: 'chips.music-card',
            version: '1.0.0',
          },
        },
      }),
    ).resolves.toEqual({
      mode: 'plugin',
      pluginId: 'chips.photo.viewer',
      windowId: 'window-1',
      matchedCapability: 'resource-handler:view:image/*',
      resolved: {
        resourceId: 'chips-render://card-root/test-token/assets/demo.png',
        filePath: '/tmp/demo.png',
        mimeType: 'image/png',
        extension: '.png',
        fileName: 'demo.png',
      },
    });

    expect(launchPlugin).toHaveBeenCalledWith(
      'chips.photo.viewer',
      expect.objectContaining({
        targetPath: '/tmp/demo.png',
        trigger: 'resource-open-service',
        resourceOpen: expect.objectContaining({
          resourceId: 'chips-render://card-root/test-token/assets/demo.png',
          filePath: '/tmp/demo.png',
          mimeType: 'image/png',
          matchedCapability: 'resource-handler:view:image/*',
          payload: {
            kind: 'chips.music-card',
            version: '1.0.0',
          },
        }),
      }),
    );
  });

  it('falls back to file-handler capability when mime handler is missing', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.png.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['file-handler:.png'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/demo.png',
        },
      }),
    ).resolves.toMatchObject({
      mode: 'plugin',
      pluginId: 'chips.png.viewer',
      matchedCapability: 'file-handler:.png',
    });
  });

  it('infers ebook MIME types from file extensions before resolving resource handlers', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.book.reader',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:application/pdf'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/manual.pdf',
        },
      }),
    ).resolves.toMatchObject({
      mode: 'plugin',
      pluginId: 'chips.book.reader',
      matchedCapability: 'resource-handler:view:application/pdf',
      resolved: {
        mimeType: 'application/pdf',
      },
    });
  });

  it('falls back to shell path opening when no handler plugin exists for a local file', async () => {
    const openPath = vi.fn().mockResolvedValue(undefined);
    const service = new ResourceOpenService(createServiceOptions({
      openPath,
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/manual.pdf',
          mimeType: 'application/pdf',
        },
      }),
    ).resolves.toEqual({
      mode: 'shell',
      resolved: {
        resourceId: '/tmp/manual.pdf',
        filePath: '/tmp/manual.pdf',
        mimeType: 'application/pdf',
        extension: '.pdf',
        fileName: 'manual.pdf',
      },
    });

    expect(openPath).toHaveBeenCalledWith('/tmp/manual.pdf');
  });

  it('opens external urls when no handler exists', async () => {
    const openExternalUrl = vi.fn().mockResolvedValue(undefined);
    const service = new ResourceOpenService(createServiceOptions({
      openExternalUrl,
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: 'https://example.com/demo.png',
          mimeType: 'image/png',
        },
      }),
    ).resolves.toEqual({
      mode: 'external',
      resolved: {
        resourceId: 'https://example.com/demo.png',
        mimeType: 'image/png',
        extension: '.png',
      },
    });

    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/demo.png');
  });

  it('launches the user preferred handler when the preference matches the request', async () => {
    const launchPlugin = vi.fn().mockResolvedValue({ windowId: 'window-pref' });
    const service = new ResourceOpenService(createServiceOptions({
      preferences: { 'mime:image/png': 'chips.universal.viewer' },
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.photo.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*'],
        },
        {
          id: 'chips.universal.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*@fallback', 'file-handler:.png@fallback'],
        },
      ]),
      launchPlugin,
      resolveResourceFilePath: () => '/tmp/demo.png',
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/demo.png',
        },
      }),
    ).resolves.toMatchObject({
      mode: 'plugin',
      pluginId: 'chips.universal.viewer',
      matchedCapability: 'resource-handler:view:image/*',
    });
  });

  it('honors extension preferences when no mime preference exists', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      preferences: { 'ext:.pdf': 'chips.universal.viewer' },
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.book.reader',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:application/pdf'],
        },
        {
          id: 'chips.universal.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:application/pdf@fallback', 'file-handler:.pdf@fallback'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/manual.pdf',
        },
      }),
    ).resolves.toMatchObject({
      pluginId: 'chips.universal.viewer',
      matchedCapability: 'resource-handler:view:application/pdf',
    });
  });

  it('keeps dedicated primary-tier handlers ahead of universal fallback handlers', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.universal.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*@fallback', 'file-handler:.png@fallback'],
        },
        {
          id: 'chips.photo.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*', 'file-handler:.png'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/demo.png',
        },
      }),
    ).resolves.toMatchObject({
      pluginId: 'chips.photo.viewer',
      matchedCapability: 'resource-handler:view:image/*',
    });
  });

  it('lets universal fallback handlers take over when no dedicated handler is installed', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.universal.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:application/vnd.ms-excel@fallback', 'file-handler:.xls@fallback'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/report.xls',
        },
      }),
    ).resolves.toMatchObject({
      pluginId: 'chips.universal.viewer',
      matchedCapability: 'resource-handler:view:application/vnd.ms-excel',
    });
  });

  it('ignores stale preferences that point at disabled or incapable plugins', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      preferences: { 'mime:image/png': 'chips.removed.viewer' },
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.photo.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/demo.png',
        },
      }),
    ).resolves.toMatchObject({
      pluginId: 'chips.photo.viewer',
      matchedCapability: 'resource-handler:view:image/*',
    });
  });

  it('matches wildcard mime preferences against exact mime requests', async () => {
    const service = new ResourceOpenService(createServiceOptions({
      preferences: { 'mime:image/*': 'chips.universal.viewer' },
      queryHandlerPlugins: vi.fn().mockResolvedValue([
        {
          id: 'chips.photo.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*'],
        },
        {
          id: 'chips.universal.viewer',
          enabled: true,
          type: 'app',
          capabilities: ['resource-handler:view:image/*@fallback', 'file-handler:.webp@fallback'],
        },
      ]),
    }));

    await expect(
      service.openResource({
        resource: {
          resourceId: '/tmp/demo.webp',
          mimeType: 'image/webp',
        },
      }),
    ).resolves.toMatchObject({
      pluginId: 'chips.universal.viewer',
      matchedCapability: 'resource-handler:view:image/*',
    });
  });
});
