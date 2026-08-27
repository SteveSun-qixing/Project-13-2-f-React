import { describe, expect, it } from 'vitest';
import { resolveWebResourceOpenPlanFromPlugins, type WebResourceHandlerPlugin } from './web-resource-open-plan';

const plugins: WebResourceHandlerPlugin[] = [
  {
    manifest: {
      id: 'com.chips.photo-viewer',
      capabilities: ['resource-handler:view:image/*'],
    },
  },
  {
    manifest: {
      id: 'com.chips.music-player',
      capabilities: ['resource-handler:view:audio/*'],
    },
  },
  {
    manifest: {
      id: 'com.chips.video-player',
      capabilities: ['resource-handler:view:video/*'],
    },
  },
  {
    manifest: {
      id: 'com.chips.book-reader',
      capabilities: ['resource-handler:view:application/epub+zip', 'resource-handler:view:application/pdf'],
    },
  },
];

describe('resolveWebResourceOpenPlanFromPlugins', () => {
  it('matches image resources by wildcard MIME capability', () => {
    const plan = resolveWebResourceOpenPlanFromPlugins(
      {
        resource: {
          resourceId: 'https://file.example/cards/photo.png',
        },
      },
      plugins,
    );

    expect(plan).toMatchObject({
      mode: 'plugin',
      pluginId: 'com.chips.photo-viewer',
      matchedCapability: 'resource-handler:view:image/*',
      resolved: {
        mimeType: 'image/png',
        extension: '.png',
      },
    });
  });

  it('matches music, video, and book resources beyond image-only routing', () => {
    expect(
      resolveWebResourceOpenPlanFromPlugins(
        {
          resource: {
            resourceId: 'https://file.example/cards/song.mp3',
          },
        },
        plugins,
      ),
    ).toMatchObject({
      pluginId: 'com.chips.music-player',
      matchedCapability: 'resource-handler:view:audio/*',
      resolved: {
        mimeType: 'audio/mpeg',
        extension: '.mp3',
      },
    });

    expect(
      resolveWebResourceOpenPlanFromPlugins(
        {
          resource: {
            resourceId: 'https://file.example/cards/movie.mp4',
          },
        },
        plugins,
      ),
    ).toMatchObject({
      pluginId: 'com.chips.video-player',
      matchedCapability: 'resource-handler:view:video/*',
      resolved: {
        mimeType: 'video/mp4',
        extension: '.mp4',
      },
    });

    expect(
      resolveWebResourceOpenPlanFromPlugins(
        {
          resource: {
            resourceId: 'https://file.example/cards/book.epub',
          },
        },
        plugins,
      ),
    ).toMatchObject({
      pluginId: 'com.chips.book-reader',
      matchedCapability: 'resource-handler:view:application/epub+zip',
      resolved: {
        mimeType: 'application/epub+zip',
        extension: '.epub',
      },
    });
  });

  it('uses fileName for extension inference when resource URLs do not expose one', () => {
    const plan = resolveWebResourceOpenPlanFromPlugins(
      {
        resource: {
          resourceId: 'https://file.example/object-storage/resource',
          fileName: 'track.flac',
        },
      },
      plugins,
    );

    expect(plan).toMatchObject({
      pluginId: 'com.chips.music-player',
      matchedCapability: 'resource-handler:view:audio/*',
      resolved: {
        mimeType: 'audio/flac',
        extension: '.flac',
        fileName: 'track.flac',
      },
    });
  });

  it('falls back to external mode when no plugin capability matches external resources', () => {
    const plan = resolveWebResourceOpenPlanFromPlugins(
      {
        resource: {
          resourceId: 'https://example.com/archive.unknown',
        },
      },
      plugins,
    );

    expect(plan).toMatchObject({
      mode: 'external',
      resolved: {
        resourceId: 'https://example.com/archive.unknown',
        extension: '.unknown',
      },
    });
  });
});
