import { describe, expect, it } from 'vitest';
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_BOUNDS,
  DEFAULT_CONFIG,
  ZOOM_MAX,
  ZOOM_MIN,
  clampNumber,
  clampZoom,
  deriveAssetRefs,
  hasCustomMapImage,
  hasFrameRegionContent,
  isSafeBoxAssetPath,
  isValidBounds,
  isValidLatitude,
  isValidLongitude,
  panCenter,
  projectLinear,
  readConfig,
  validateConfig,
} from '../src/config';

describe('默认配置与常量', () => {
  it('默认配置与 schema 版本', () => {
    expect(CONFIG_SCHEMA_VERSION).toBe('1.0.0');
    expect(ZOOM_MIN).toBe(0.5);
    expect(ZOOM_MAX).toBe(8);
    expect(DEFAULT_BOUNDS).toEqual({ west: -180, south: -85, east: 180, north: 85 });
    expect(DEFAULT_CONFIG).toEqual({
      map_source: {
        mode: 'image',
        projection: 'linear-bounds',
        bounds: { west: -180, south: -85, east: 180, north: 85 },
      },
      default_view: { latitude: 0, longitude: 0, zoom: 1 },
      marker_style: 'dot-title',
      show_cover_on_select: true,
      entries: {},
      top_region: { mode: 'none' },
    });
  });

  it('归一空输入回退默认值', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('map')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({})).toEqual(DEFAULT_CONFIG);
  });
});

describe('配置归一', () => {
  it('坐标字符串转数字、非法点位丢弃、显示名覆盖修剪', () => {
    const config = readConfig({
      map_source: {
        mode: 'image',
        projection: 'web-mercator',
        assetPath: 'assets/layouts/map/base-map/tokyo.png',
        bounds: { west: '139.5', south: '35.5', east: '139.9', north: '35.9' },
      },
      default_view: { latitude: '35.6812', longitude: '139.7671', zoom: 2 },
      marker_style: 'pin-title',
      show_cover_on_select: false,
      entries: {
        'entry-1': { latitude: '35.6812', longitude: 139.7671, labelOverride: ' 东京站 ' },
        'entry-2': { latitude: 'bad', longitude: 139 },
        'bad id!': { latitude: 1, longitude: 2 },
        'entry-3': { latitude: 1, longitude: 2, labelOverride: 'x'.repeat(200) },
      },
      top_region: { mode: 'image', assetPath: 'assets/layouts/map/top-region/header.png' },
    });

    expect(config.map_source).toEqual({
      mode: 'image',
      projection: 'linear-bounds',
      assetPath: 'assets/layouts/map/base-map/tokyo.png',
      bounds: { west: 139.5, south: 35.5, east: 139.9, north: 35.9 },
    });
    expect(config.default_view).toEqual({ latitude: 35.6812, longitude: 139.7671, zoom: 2 });
    expect(config.marker_style).toBe('pin-title');
    expect(config.show_cover_on_select).toBe(false);
    expect(config.entries['entry-1']).toEqual({
      latitude: 35.6812,
      longitude: 139.7671,
      labelOverride: '东京站',
    });
    expect(config.entries['entry-2']).toBeUndefined();
    expect(config.entries['bad id!']).toBeUndefined();
    expect(config.entries['entry-3']?.labelOverride).toHaveLength(120);
    expect(deriveAssetRefs(config)).toEqual([
      'assets/layouts/map/base-map/tokyo.png',
      'assets/layouts/map/top-region/header.png',
    ]);
  });

  it('host-map 为预留模式：保留 web-mercator、不携带图片资产、不派生资源引用', () => {
    const config = readConfig({
      map_source: {
        mode: 'host-map',
        projection: 'web-mercator',
        assetPath: 'assets/layouts/map/base-map/unused.png',
        bounds: { west: -180, south: -80, east: 180, north: 80 },
      },
    });
    expect(config.map_source).toEqual({
      mode: 'host-map',
      projection: 'web-mercator',
      bounds: { west: -180, south: -80, east: 180, north: 80 },
    });
    expect(deriveAssetRefs(config)).toEqual([]);
  });

  it('缩放夹取 0.5–8、非法字段回退', () => {
    expect(readConfig({ default_view: { zoom: 99 } }).default_view.zoom).toBe(8);
    expect(readConfig({ default_view: { zoom: -3 } }).default_view.zoom).toBe(0.5);
    expect(readConfig({ default_view: { zoom: 'abc' } }).default_view.zoom).toBe(1);
    expect(readConfig({ marker_style: 'triangle' }).marker_style).toBe('dot-title');
    expect(readConfig({ show_cover_on_select: 'yes' }).show_cover_on_select).toBe(true);
    expect(readConfig({ map_source: { assetPath: '/etc/passwd' } }).map_source.assetPath).toBeUndefined();
  });

  it('派生去重的资源引用列表', () => {
    const config = readConfig({
      map_source: {
        mode: 'image',
        projection: 'linear-bounds',
        assetPath: 'assets/layouts/map/base-map/world.png',
        bounds: { ...DEFAULT_BOUNDS },
      },
      top_region: { mode: 'image', assetPath: 'assets/layouts/map/base-map/world.png' },
    });
    expect(deriveAssetRefs(config)).toEqual(['assets/layouts/map/base-map/world.png']);
    expect(deriveAssetRefs(DEFAULT_CONFIG)).toEqual([]);
  });
});

describe('安全路径与坐标判定', () => {
  it('判定安全的箱子资源路径', () => {
    expect(isSafeBoxAssetPath('assets/layouts/map/base-map/map.webp')).toBe(true);
    for (const path of [
      '/tmp/map.png',
      '../map.png',
      'assets/../map.png',
      'file:///tmp/map.png',
      'blob:map',
      'data:image/png;base64,abc',
      'https://example.com/map.png',
      'assets/layouts/map.png?token=1',
      'assets/layouts/map.png#preview',
      'assets\\layouts\\map.png',
      ' assets/layouts/map.png',
      'assets//map.png',
    ]) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it('经纬度与边界判定', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(90.5)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180.5)).toBe(false);
    expect(isValidBounds({ west: -10, south: -20, east: 30, north: 40 })).toBe(true);
    expect(isValidBounds({ west: 30, south: -20, east: -10, north: 40 })).toBe(false);
    expect(isValidBounds({ west: -10, south: 40, east: 30, north: -20 })).toBe(false);
    expect(isValidBounds({ west: Number.NaN, south: 0, east: 1, north: 1 })).toBe(false);
  });

  it('内容与自定义底图判定', () => {
    expect(hasFrameRegionContent({ mode: 'none' })).toBe(false);
    expect(hasFrameRegionContent({ mode: 'image', assetPath: 'assets/a.png' })).toBe(true);
    expect(hasFrameRegionContent({ mode: 'html', html: '  ' })).toBe(false);
    expect(hasFrameRegionContent({ mode: 'html', html: '<p>顶部</p>' })).toBe(true);
    expect(hasCustomMapImage(DEFAULT_CONFIG.map_source)).toBe(false);
    expect(
      hasCustomMapImage({
        mode: 'image',
        projection: 'linear-bounds',
        assetPath: 'assets/layouts/map/base-map/world.png',
        bounds: { ...DEFAULT_BOUNDS },
      })
    ).toBe(true);
  });
});

describe('validateConfig', () => {
  it('接受空配置与合法完整配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(
      validateConfig({
        map_source: {
          mode: 'image',
          projection: 'linear-bounds',
          assetPath: 'assets/layouts/map/base-map/world.png',
          bounds: { west: -10, south: -20, east: 30, north: 40 },
        },
        default_view: { latitude: 10, longitude: 20, zoom: 1.25 },
        marker_style: 'pin-title',
        show_cover_on_select: false,
        entries: { 'entry-1': { latitude: 35.68, longitude: 139.76, labelOverride: '东京站' } },
        top_region: { mode: 'html', html: '<section>顶部</section>' },
      })
    ).toBe(true);
  });

  it('拒绝非对象与底图来源非法值', () => {
    expect(validateConfig('map')).toBe(false);
    expect(validateConfig({ map_source: { mode: 'tiles' } })).toBe(false);
    expect(
      validateConfig({ map_source: { mode: 'image', projection: 'web-mercator' } })
    ).toBe(false);
    expect(
      validateConfig({ map_source: { mode: 'image', assetPath: 'assets/../evil.png' } })
    ).toBe(false);
    expect(
      validateConfig({ map_source: { bounds: { west: 30, south: 0, east: -10, north: 10 } } })
    ).toBe(false);
  });

  it('拒绝越界默认视图与非法点位样式', () => {
    expect(validateConfig({ default_view: { latitude: 91 } })).toBe(false);
    expect(validateConfig({ default_view: { longitude: -181 } })).toBe(false);
    expect(validateConfig({ default_view: { zoom: 9 } })).toBe(false);
    expect(validateConfig({ default_view: { zoom: 0.4 } })).toBe(false);
    expect(validateConfig({ marker_style: 'triangle' })).toBe(false);
    expect(validateConfig({ show_cover_on_select: 'yes' })).toBe(false);
  });

  it('拒绝非法条目定位与顶部区域', () => {
    expect(validateConfig({ entries: { 'bad id!': { latitude: 1, longitude: 2 } } })).toBe(false);
    expect(validateConfig({ entries: { 'entry-1': { latitude: 91, longitude: 2 } } })).toBe(false);
    expect(validateConfig({ entries: { 'entry-1': { latitude: 1, longitude: 200 } } })).toBe(false);
    expect(validateConfig({ entries: { 'entry-1': { latitude: 1 } } })).toBe(false);
    expect(validateConfig({ top_region: { mode: 'image' } })).toBe(false);
    expect(validateConfig({ top_region: { mode: 'html', html: '  ' } })).toBe(false);
    expect(validateConfig({ top_region: 'text' })).toBe(false);
  });
});

describe('投影与视图数学（对照旧源码算法）', () => {
  it('线性边界投影：默认边界中心映射为 (50, 50)', () => {
    expect(projectLinear({ latitude: 0, longitude: 0 }, DEFAULT_BOUNDS)).toEqual({ x: 50, y: 50 });
  });

  it('线性边界投影：西北角映射为 (0, 0)、东南角映射为 (100, 100)', () => {
    expect(projectLinear({ latitude: 85, longitude: -180 }, DEFAULT_BOUNDS)).toEqual({
      x: 0,
      y: 0,
    });
    expect(projectLinear({ latitude: -85, longitude: 180 }, DEFAULT_BOUNDS)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('线性边界投影：局部边界内插值', () => {
    const bounds = { west: 139.5, south: 35.5, east: 139.9, north: 35.9 };
    const center = projectLinear({ latitude: 35.7, longitude: 139.7 }, bounds);
    expect(center?.x).toBeCloseTo(50, 9);
    expect(center?.y).toBeCloseTo(50, 9);
    const quarter = projectLinear({ latitude: 35.575, longitude: 139.6 }, bounds);
    expect(quarter?.x).toBeCloseTo(25, 9);
    expect(quarter?.y).toBeCloseTo(81.25, 9);
  });

  it('线性边界投影：非法边界或越界坐标返回 undefined', () => {
    expect(projectLinear({ latitude: 0, longitude: 0 }, { west: 10, south: 0, east: -10, north: 10 })).toBeUndefined();
    expect(projectLinear({ latitude: 91, longitude: 0 }, DEFAULT_BOUNDS)).toBeUndefined();
    expect(projectLinear({ latitude: 0, longitude: 181 }, DEFAULT_BOUNDS)).toBeUndefined();
    expect(projectLinear({ latitude: Number.NaN, longitude: 0 }, DEFAULT_BOUNDS)).toBeUndefined();
  });

  it('数值夹取与缩放夹取', () => {
    expect(clampNumber(5, 0, 3)).toBe(3);
    expect(clampNumber(-5, 0, 3)).toBe(0);
    expect(clampNumber(2, 0, 3)).toBe(2);
    expect(clampZoom(0.4)).toBe(0.5);
    expect(clampZoom(9)).toBe(8);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(1.256)).toBe(1.26);
  });

  it('平移中心夹取：纬度 ±90、经度 ±180，不绕回', () => {
    expect(panCenter({ latitude: 0, longitude: 0 }, 5, 5)).toEqual({
      latitude: 5,
      longitude: 5,
    });
    expect(panCenter({ latitude: 88, longitude: 0 }, 5, 0)).toEqual({
      latitude: 90,
      longitude: 0,
    });
    expect(panCenter({ latitude: 0, longitude: 178 }, 0, 5)).toEqual({
      latitude: 0,
      longitude: 180,
    });
    expect(panCenter({ latitude: -89, longitude: -179 }, -5, -5)).toEqual({
      latitude: -90,
      longitude: -180,
    });
  });
});
