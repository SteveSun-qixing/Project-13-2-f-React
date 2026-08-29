import { describe, expect, it } from 'vitest';
import {
  buildCandidateCapabilities,
  buildHandlerSlots,
  handlerPreferenceKeys,
  parseHandlerCapability,
  resolveHandlerFromRecords,
  sanitizeHandlerPreferences,
} from '../../packages/resource-open-service/src';

describe('handler capability parsing', () => {
  it('parses primary resource-handler and file-handler declarations', () => {
    expect(parseHandlerCapability('resource-handler:view:image/png')).toEqual({
      raw: 'resource-handler:view:image/png',
      capability: 'resource-handler:view:image/png',
      kind: 'resource-handler',
      tier: 'primary',
      intent: 'view',
      mimeType: 'image/png',
      extension: undefined,
    });
    expect(parseHandlerCapability('FILE-HANDLER:.PNG')).toEqual({
      raw: 'file-handler:.png',
      capability: 'file-handler:.png',
      kind: 'file-handler',
      tier: 'primary',
      intent: undefined,
      mimeType: undefined,
      extension: '.png',
    });
  });

  it('parses fallback tier declarations and normalizes the capability string', () => {
    expect(parseHandlerCapability('resource-handler:view:image/*@fallback')).toMatchObject({
      capability: 'resource-handler:view:image/*',
      tier: 'fallback',
      mimeType: 'image/*',
    });
    expect(parseHandlerCapability('file-handler:.xlsx@fallback')).toMatchObject({
      capability: 'file-handler:.xlsx',
      tier: 'fallback',
      extension: '.xlsx',
    });
  });

  it('rejects malformed or unrelated capability strings', () => {
    expect(parseHandlerCapability('file.read')).toBeNull();
    expect(parseHandlerCapability('resource-handler:image/png')).toBeNull();
    expect(parseHandlerCapability('file-handler:png')).toBeNull();
    expect(parseHandlerCapability('file-handler:.png@premium')).toBeNull();
    expect(parseHandlerCapability('resource-handler:view:@fallback')).toBeNull();
  });
});

describe('candidate and preference keys', () => {
  it('builds the candidate chain from exact mime to wildcard to extension', () => {
    expect(buildCandidateCapabilities('view', 'image/png', '.png')).toEqual([
      'resource-handler:view:image/png',
      'resource-handler:view:image/*',
      'file-handler:.png',
    ]);
    expect(buildCandidateCapabilities('view', undefined, '.xls')).toEqual(['file-handler:.xls']);
    expect(buildCandidateCapabilities('view', 'application/pdf', undefined)).toEqual([
      'resource-handler:view:application/pdf',
      'resource-handler:view:application/*',
    ]);
  });

  it('builds ordered preference keys for a request', () => {
    expect(handlerPreferenceKeys('image/png', '.png')).toEqual([
      'mime:image/png',
      'mime:image/*',
      'ext:.png',
    ]);
    expect(handlerPreferenceKeys(undefined, '.xls')).toEqual(['ext:.xls']);
  });

  it('sanitizes preference records and drops invalid entries', () => {
    expect(sanitizeHandlerPreferences({
      'mime:image/png': ' com.chips.photo-viewer ',
      'ext:.png': 42,
      '': 'chips.x',
      broken: '',
    })).toEqual({ 'mime:image/png': 'com.chips.photo-viewer' });
    expect(sanitizeHandlerPreferences('nope')).toBeUndefined();
    expect(sanitizeHandlerPreferences({})).toBeUndefined();
  });
});

describe('resolveHandlerFromRecords', () => {
  const photoViewer = { pluginId: 'com.chips.photo-viewer', capabilities: ['resource-handler:view:image/*', 'file-handler:.png'] };
  const universalViewer = {
    pluginId: 'com.chips.universal-file-viewer',
    capabilities: ['resource-handler:view:image/*@fallback', 'file-handler:.png@fallback'],
  };

  it('prefers user preference over primary tier and install order', () => {
    expect(resolveHandlerFromRecords({
      plugins: [photoViewer, universalViewer],
      mimeType: 'image/png',
      extension: '.png',
      preferences: { 'ext:.png': 'com.chips.universal-file-viewer' },
    })).toEqual({
      pluginId: 'com.chips.universal-file-viewer',
      capability: 'resource-handler:view:image/*',
      preferenceApplied: true,
    });
  });

  it('checks mime preference keys before extension keys', () => {
    expect(resolveHandlerFromRecords({
      plugins: [photoViewer, universalViewer],
      mimeType: 'image/png',
      extension: '.png',
      preferences: {
        'ext:.png': 'com.chips.universal-file-viewer',
        'mime:image/png': 'com.chips.photo-viewer',
      },
    })).toEqual({
      pluginId: 'com.chips.photo-viewer',
      capability: 'resource-handler:view:image/*',
      preferenceApplied: true,
    });
  });

  it('ranks primary tier above fallback tier within the same candidate', () => {
    expect(resolveHandlerFromRecords({
      plugins: [universalViewer, photoViewer],
      mimeType: 'image/png',
    })).toEqual({
      pluginId: 'com.chips.photo-viewer',
      capability: 'resource-handler:view:image/*',
      preferenceApplied: false,
    });
  });

  it('falls back to fallback-tier declarers when no primary declarer exists', () => {
    expect(resolveHandlerFromRecords({
      plugins: [universalViewer],
      mimeType: 'image/png',
      extension: '.png',
    })).toEqual({
      pluginId: 'com.chips.universal-file-viewer',
      capability: 'resource-handler:view:image/*',
      preferenceApplied: false,
    });
  });

  it('returns null when nothing matches', () => {
    expect(resolveHandlerFromRecords({ plugins: [photoViewer], mimeType: 'video/mp4' })).toBeNull();
    expect(resolveHandlerFromRecords({ plugins: [], extension: '.png' })).toBeNull();
  });
});

describe('buildHandlerSlots', () => {
  it('aggregates declarations into slots with tier and preference annotations', () => {
    const slots = buildHandlerSlots(
      [
        {
          pluginId: 'com.chips.universal-file-viewer',
          name: '万能文件查看器',
          capabilities: ['resource-handler:view:image/*@fallback', 'file-handler:.png@fallback'],
        },
        {
          pluginId: 'com.chips.photo-viewer',
          name: '图片查看器',
          capabilities: ['resource-handler:view:image/*', 'file-handler:.png'],
        },
      ],
      { 'ext:.png': 'com.chips.universal-file-viewer' },
    );

    expect(slots.map((slot) => slot.capability)).toEqual([
      'file-handler:.png',
      'resource-handler:view:image/*',
    ]);

    const fileSlot = slots[0]!;
    expect(fileSlot).toMatchObject({
      kind: 'file-handler',
      extension: '.png',
      preferenceKey: 'ext:.png',
      preferencePluginId: 'com.chips.universal-file-viewer',
      defaultPluginId: 'com.chips.universal-file-viewer',
    });
    expect(fileSlot.plugins.map((plugin) => plugin.pluginId)).toEqual([
      'com.chips.universal-file-viewer',
      'com.chips.photo-viewer',
    ]);

    const mimeSlot = slots[1]!;
    expect(mimeSlot).toMatchObject({
      kind: 'resource-handler',
      intent: 'view',
      mimeType: 'image/*',
      preferenceKey: 'mime:image/*',
      preferencePluginId: null,
      defaultPluginId: 'com.chips.photo-viewer',
    });
    expect(mimeSlot.plugins.map((plugin) => plugin.tier)).toEqual(['primary', 'fallback']);
  });

  it('ignores non-handler capabilities and deduplicates repeated declarations', () => {
    const slots = buildHandlerSlots([
      {
        pluginId: 'app.a',
        capabilities: ['file-handler:.png', 'file-handler:.png', 'file.read', 'resource-handler:view:image/png'],
      },
    ]);
    expect(slots.map((slot) => slot.capability)).toEqual(['file-handler:.png', 'resource-handler:view:image/png']);
  });
});
