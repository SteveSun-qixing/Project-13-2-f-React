# 地图布局插件

`map-BLP` 是薯片生态箱子布局插件，用静态地图底图和经纬度点位展示箱子条目。

## 工程定位

- 插件 ID：`chips.layout.map.blp`
- 布局类型：`chips.layout.map.blp`
- 显示名称：`地图布局插件`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 布局行为

- 查看态默认显示静态地图底图、点位和标题；
- 空箱子（无可见条目）时显示地图形态骨架空状态（浅色地图底 + 道路 + 位置钉 + 空态提示），上传条目后切换为正式地图视图；
- 地图底图支持箱子自有图片资源，缺省时显示插件内置静态底图；
- 条目位置保存在 `props.entries[entryId]`，字段为 `latitude`、`longitude` 和可选 `labelOverride`；
- 未定位条目显示在底部列表中，不散落到地图外；
- 点击点位先选中条目，再次点击或按 Enter 通过 `runtime.openEntry(entryId)` 打开条目；
- `showCoverOnSelect` 开启时，仅在选中点位后调用 `runtime.renderEntryCover(entryId)` 加载封面；
- `host-map` 是正式 Host 地图能力预留模式，当前布局插件不会联网请求地图瓦片、地理编码或路线服务。
- 顶部区域无固定比例与高度限制：图片模式按图片自然宽高比显示、宽度撑满且背景透明；HTML 模式按 iframe 实际内容高度显示，拿不到测量值时以容器宽度的 3 倍为高度上限。

## 配置结构

插件运行时对象使用 camelCase：

```ts
{
  schemaVersion: "1.0.0",
  props: {
    mapSource: {
      mode: "image",
      projection: "linear-bounds",
      assetPath: "assets/layouts/map/base-map/tokyo.webp",
      bounds: {
        west: 139.55,
        south: 35.52,
        east: 139.93,
        north: 35.82
      }
    },
    defaultView: {
      latitude: 35.6812,
      longitude: 139.7671,
      zoom: 1
    },
    markerStyle: "dot-title",
    showCoverOnSelect: true,
    entries: {
      "entry-1": {
        latitude: 35.6812,
        longitude: 139.7671,
        labelOverride: "东京站"
      }
    },
    topRegion: {
      mode: "none"
    }
  },
  assetRefs: [
    "assets/layouts/map/base-map/tokyo.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case，由 Host/SDK/编辑引擎负责转换。布局插件只消费 Host 注入的运行时对象，不直接写 YAML。

## 资源边界

地图底图和顶部区域图片必须通过编辑器 asset bridge 导入箱子资源：

- `importBoxAsset({ file, preferredPath })`
- `readBoxAsset(assetPath)`
- `deleteBoxAsset(assetPath)`

地图布局使用的资源路径放在 `assets/layouts/map/...`，并同步进 `assetRefs`。配置不得保存绝对路径、`file://`、`blob:`、`data:`、`http://`、Host 临时 `resourceUrl`、凭证或 `sessionId`。

## 经纬度校验

- 纬度范围：`-90..90`
- 经度范围：`-180..180`
- 图片投影模式固定为 `linear-bounds`
- `bounds.west < bounds.east`
- `bounds.south < bounds.north`
- `defaultView.zoom` 范围：`0.5..8`

## 目录说明

- `src/view/`：查看态地图页面挂载与运行时
- `src/editor/`：地图底图、边界、默认视图和点位编辑
- `src/schema/`：默认配置、归一、校验和 `assetRefs` 同步
- `src/shared/`：共享类型与编辑面板布局组件
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 JSON Schema
- `tests/`：schema、查看态和编辑态单元测试
- `assets/icons/`：静态布局图标资源与来源说明

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

## 常用命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

正式联调路径是构建并打包插件后，通过开发工作区安装启用，由箱子查看器或编辑器通过 Host/SDK 打开 `.box`。
